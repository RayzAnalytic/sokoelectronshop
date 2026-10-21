from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta

import requests
from django.conf import settings
from django.utils import timezone

from .base import (
    BestTimeResult,
    BoostResult,
    CommentResult,
    DemographicResult,
    DirectMessageResult,
    MentionResult,
    MetricsResult,
    PlatformClient,
    PlatformError,
    PublishResult,
    QuotaExceededError,
    RateLimitError,
    TokenExpiredError,
    UnsupportedOperationError,
)

logger = logging.getLogger("social.publish")


TIKTOK_API = "https://open.tiktokapis.com/v2"

_SINGLE_CHUNK_MAX   = 5 * 1024 * 1024
_CHUNK_MIN          = 5 * 1024 * 1024
_CHUNK_MAX          = 64 * 1024 * 1024
_CHUNK_DEFAULT      = 32 * 1024 * 1024

_PUBLISH_POLL_TIMEOUT  = 300
_PUBLISH_POLL_INTERVAL = 5

_TOKEN_ERROR_CODES = {
    "access_token_invalid",
    "access_token_expired",
    "refresh_token_invalid",
}
_RATE_ERROR_CODES = {
    "rate_limit_exceeded",
    "too_many_requests",
}
_QUOTA_ERROR_CODES = {
    "spam_risk_too_many_posts",
    "daily_quota_exceeded",
    "user_daily_quota_exceeded",
    "video_publish_quota_exceeded",
}
_FAILED_STATUSES = {"FAILED", "PUBLISH_FAILED"}


def _raise_for_tiktok_error(resp: requests.Response, *, context: str) -> None:
    if resp.status_code < 400:
        try:
            body = resp.json()
        except ValueError:
            return
        err = (body or {}).get("error") or {}
        if err.get("code") and err["code"] != "ok":
            _raise_from_code(err, context=context, status_code=resp.status_code)
        return

    try:
        body = resp.json()
        err = (body or {}).get("error") or {}
    except ValueError:
        err = {}

    _raise_from_code(
        err, context=context, status_code=resp.status_code,
        fallback_text=resp.text[:300],
    )


def _raise_from_code(
    err: dict,
    *,
    context: str,
    status_code: int,
    fallback_text: str = "",
) -> None:
    code = err.get("code") or ""
    message = err.get("message") or fallback_text or "unknown error"
    log_id = err.get("log_id") or ""

    suffix = f" [log_id={log_id}]" if log_id else ""
    full = f"TikTok {context} failed ({status_code or '?'}): {code or 'error'} — {message}{suffix}"

    if code in _TOKEN_ERROR_CODES:
        raise TokenExpiredError(full)
    if code in _QUOTA_ERROR_CODES:
        raise QuotaExceededError(full)
    if code in _RATE_ERROR_CODES or status_code == 429:
        raise RateLimitError(full, retry_after_seconds=3600)

    raise PlatformError(full, status_code=status_code, response=err)


def _plan_chunks(file_size: int) -> tuple[int, int]:
    if file_size <= _CHUNK_MAX:
        return file_size, 1
    chunk_size = _CHUNK_DEFAULT
    total = (file_size + chunk_size - 1) // chunk_size
    return chunk_size, total


class TikTokClient(PlatformClient):
    platform = "TIKTOK"
    request_timeout = 60

    SUPPORTS_COMMENTS = False
    SUPPORTS_DIRECT_MESSAGES = False
    SUPPORTS_MENTIONS = False
    SUPPORTS_DEMOGRAPHICS = False
    SUPPORTS_BEST_TIMES = False
    SUPPORTS_BOOST = False
    SUPPORTS_DELETE_POST = False
    SUPPORTS_EDIT_CAPTION = False
    SUPPORTS_FIRST_COMMENT = False
    SUPPORTS_STORIES = False
    SUPPORTS_REELS = False
    SUPPORTS_SHORTS = False
    SUPPORTS_CAROUSEL = False

    MAX_CAPTION_LENGTH = 2_200
    MAX_MEDIA_COUNT = 1
    MAX_VIDEO_DURATION_SEC = 600
    REQUIRES_VIDEO = True

    def _auth_headers(self, *, json_body: bool = True) -> dict:
        headers = {"Authorization": f"Bearer {self.account.access_token}"}
        if json_body:
            headers["Content-Type"] = "application/json; charset=UTF-8"
        return headers

    def _creds(self) -> tuple[str, str]:
        key = getattr(settings, "TIKTOK_CLIENT_KEY", "")
        secret = getattr(settings, "TIKTOK_CLIENT_SECRET", "")
        if not key or not secret:
            raise PlatformError(
                "TikTok client key/secret are not configured. "
                "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET."
            )
        return key, secret

    def publish(
        self,
        caption: str,
        media_paths: list[str],
        product_tag: str = "",
        first_comment: str = "",
        options: dict | None = None,
    ) -> PublishResult:
        if self.dry_run:
            if first_comment:
                logger.info(
                    "%s dry-run ignoring first_comment — TikTok does not support it",
                    self._log_prefix,
                )
            return self._simulate_publish(caption, media_paths)

        self._require_connected()
        self._require_fresh_token()

        if not media_paths:
            raise PlatformError("TikTok requires a video file.")

        video_path = media_paths[0]
        if not os.path.exists(video_path):
            raise PlatformError(f"TikTok video file not found: {video_path}")

        file_size = os.path.getsize(video_path)
        if file_size == 0:
            raise PlatformError("TikTok video file is empty.")

        opts = options or {}

        upload_url, publish_id = self._init_publish(
            video_path, file_size, caption, opts,
        )
        self._upload_chunks(upload_url, video_path, file_size)
        self._wait_for_publish(publish_id)

        permalink = self._fetch_permalink(publish_id)
        return PublishResult(
            platform_post_id=publish_id,
            platform_url=permalink,
            raw={"publish_id": publish_id, "file_size": file_size},
        )

    def _init_publish(
        self, path: str, file_size: int, caption: str, options: dict,
    ) -> tuple[str, str]:
        chunk_size, total_chunks = _plan_chunks(file_size)

        post_info: dict = {
            "title": caption[: self.MAX_CAPTION_LENGTH],
            "privacy_level": options.get("privacy_level", "PUBLIC_TO_EVERYONE"),
            "disable_duet": bool(options.get("disable_duet", False)),
            "disable_comment": bool(options.get("disable_comment", False)),
            "disable_stitch": bool(options.get("disable_stitch", False)),
        }
        if options.get("branded_content"):
            post_info["brand_content_toggle"] = True
        if options.get("brand_organic"):
            post_info["brand_organic_toggle"] = True
        if options.get("video_cover_timestamp_ms") is not None:
            post_info["video_cover_timestamp_ms"] = int(
                options["video_cover_timestamp_ms"]
            )

        payload = {
            "post_info": post_info,
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": file_size,
                "chunk_size": chunk_size,
                "total_chunk_count": total_chunks,
            },
        }

        resp = requests.post(
            f"{TIKTOK_API}/post/publish/video/init/",
            headers=self._auth_headers(),
            json=payload,
            timeout=self.request_timeout,
        )
        _raise_for_tiktok_error(resp, context="publish init")
        data = self._parse_json(resp, context="publish init").get("data", {}) or {}

        upload_url = data.get("upload_url")
        publish_id = data.get("publish_id")
        if not upload_url or not publish_id:
            raise PlatformError(
                "TikTok init returned no upload_url / publish_id."
            )
        logger.info(
            "%s upload session opened publish_id=%s size=%s chunks=%s",
            self._log_prefix, publish_id, file_size, total_chunks,
        )
        return upload_url, publish_id

    def _upload_chunks(self, upload_url: str, path: str, file_size: int) -> None:
        chunk_size, total_chunks = _plan_chunks(file_size)

        with open(path, "rb") as fh:
            for idx in range(total_chunks):
                start = idx * chunk_size
                end = min(start + chunk_size, file_size) - 1
                length = end - start + 1

                fh.seek(start)
                body = fh.read(length)

                resp = requests.put(
                    upload_url,
                    data=body,
                    headers={
                        "Content-Type": "video/mp4",
                        "Content-Length": str(length),
                        "Content-Range": f"bytes {start}-{end}/{file_size}",
                    },
                    timeout=max(self.request_timeout, 600),
                )
                if resp.status_code >= 400:
                    raise PlatformError(
                        f"TikTok chunk upload failed "
                        f"(chunk {idx + 1}/{total_chunks}, "
                        f"{resp.status_code}): {resp.text[:200]}"
                    )

        logger.info(
            "%s uploaded %s bytes in %s chunk(s)",
            self._log_prefix, file_size, total_chunks,
        )

    def _wait_for_publish(self, publish_id: str) -> None:
        deadline = time.monotonic() + _PUBLISH_POLL_TIMEOUT
        url = f"{TIKTOK_API}/post/publish/status/fetch/"

        while time.monotonic() < deadline:
            resp = requests.post(
                url,
                headers=self._auth_headers(),
                json={"publish_id": publish_id},
                timeout=self.request_timeout,
            )
            _raise_for_tiktok_error(resp, context="publish status")
            data = self._parse_json(resp, context="publish status").get("data", {}) or {}
            status = (data.get("status") or "").upper()

            if status == "PUBLISH_COMPLETE":
                return
            if status in _FAILED_STATUSES:
                detail = data.get("fail_reason") or "no reason given"
                raise PlatformError(
                    f"TikTok publish {publish_id} failed: {detail}"
                )

            time.sleep(_PUBLISH_POLL_INTERVAL)

        raise PlatformError(
            f"TikTok publish {publish_id} did not complete within "
            f"{_PUBLISH_POLL_TIMEOUT}s."
        )

    def _fetch_permalink(self, publish_id: str) -> str:
        try:
            resp = requests.post(
                f"{TIKTOK_API}/video/list/",
                headers=self._auth_headers(),
                params={"fields": "id,share_url"},
                json={},
                timeout=self.request_timeout,
            )
            if resp.status_code >= 400:
                return ""
            videos = (resp.json().get("data") or {}).get("videos") or []
            for v in videos:
                if str(v.get("id")) == str(publish_id):
                    return v.get("share_url", "") or ""
        except Exception:
            logger.debug("%s permalink fetch failed", self._log_prefix, exc_info=True)
        return ""

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return self._simulate_metrics()

        self._require_connected()
        self._require_fresh_token()

        resp = requests.post(
            f"{TIKTOK_API}/video/list/",
            headers=self._auth_headers(),
            params={
                "fields": "id,like_count,comment_count,share_count,view_count",
            },
            json={},
            timeout=self.request_timeout,
        )
        _raise_for_tiktok_error(resp, context="metrics")
        body = self._parse_json(resp, context="metrics")
        videos = (body.get("data") or {}).get("videos") or []

        for v in videos:
            if str(v.get("id")) == str(platform_post_id):
                views = int(v.get("view_count", 0) or 0)
                return MetricsResult(
                    likes=int(v.get("like_count", 0) or 0),
                    comments=int(v.get("comment_count", 0) or 0),
                    shares=int(v.get("share_count", 0) or 0),
                    reach=views,
                    impressions=views,
                    video_views=views,
                )
        return MetricsResult()

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        resp = requests.get(
            f"{TIKTOK_API}/user/info/",
            headers=self._auth_headers(json_body=False),
            params={"fields": "follower_count,following_count,likes_count"},
            timeout=self.request_timeout,
        )
        if resp.status_code >= 400:
            logger.warning(
                "%s followers fetch failed (%s): %s",
                self._log_prefix, resp.status_code, resp.text[:200],
            )
            return 0
        try:
            body = resp.json()
            return int(
                ((body.get("data") or {}).get("user") or {}).get("follower_count", 0)
                or 0
            )
        except (ValueError, TypeError):
            return 0

    def fetch_comments(
        self, platform_post_id: str, since: datetime | None = None,
    ) -> list[CommentResult]:
        raise UnsupportedOperationError(
            "TikTok does not expose comment moderation via the Content "
            "Posting API — apply for the Research API or use TikTok Business."
        )

    def reply_to_comment(self, platform_comment_id: str, body: str) -> CommentResult:
        raise UnsupportedOperationError(
            "TikTok does not expose comment replies via the Content Posting API."
        )

    def delete_comment(self, platform_comment_id: str) -> None:
        raise UnsupportedOperationError(
            "TikTok does not expose comment deletion via the Content Posting API."
        )

    def hide_comment(self, platform_comment_id: str, hidden: bool = True) -> None:
        raise UnsupportedOperationError(
            "TikTok does not expose comment hiding via the Content Posting API."
        )

    def fetch_direct_messages(
        self, since: datetime | None = None,
    ) -> list[DirectMessageResult]:
        raise UnsupportedOperationError(
            "TikTok does not expose direct messages via the Content Posting API."
        )

    def reply_to_direct_message(
        self, platform_message_id: str, body: str,
    ) -> DirectMessageResult:
        raise UnsupportedOperationError(
            "TikTok does not expose direct message replies via the Content Posting API."
        )

    def fetch_mentions(
        self, since: datetime | None = None,
    ) -> list[MentionResult]:
        raise UnsupportedOperationError(
            "TikTok does not expose mentions via the Content Posting API."
        )

    def fetch_demographics(self) -> DemographicResult:
        raise UnsupportedOperationError(
            "TikTok does not expose audience demographics via the Content Posting API."
        )

    def fetch_best_times(self) -> list[BestTimeResult]:
        raise UnsupportedOperationError(
            "TikTok does not expose best-time data via the Content Posting API."
        )

    def delete_post(self, platform_post_id: str) -> None:
        raise UnsupportedOperationError(
            "TikTok does not expose post deletion via the Content Posting API."
        )

    def edit_caption(self, platform_post_id: str, caption: str) -> None:
        raise UnsupportedOperationError(
            "TikTok does not expose post editing via the Content Posting API."
        )

    def boost_post(
        self,
        platform_post_id: str,
        budget_cents: int,
        duration_days: int,
        audience: dict | None = None,
    ) -> BoostResult:
        raise UnsupportedOperationError(
            "TikTok boosting is handled through TikTok Ads Manager, not the "
            "Content Posting API."
        )

    def refresh_access_token(self) -> datetime | None:
        if self.dry_run:
            return None

        if not self.account.refresh_token:
            raise TokenExpiredError(
                "TikTok account has no refresh token; user must reconnect."
            )

        client_key, client_secret = self._creds()
        resp = requests.post(
            f"{TIKTOK_API}/oauth/token/",
            data={
                "client_key": client_key,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": self.account.refresh_token,
            },
            timeout=self.request_timeout,
        )
        _raise_for_tiktok_error(resp, context="token refresh")
        data = self._parse_json(resp, context="token refresh")

        new_access = data.get("access_token")
        if not new_access:
            raise PlatformError("TikTok refresh returned no access_token.")

        new_refresh = data.get("refresh_token")
        if not new_refresh:
            raise PlatformError(
                "TikTok refresh returned no refresh_token "
                "(the old one is now invalid)."
            )

        expires_in = data.get("expires_in")
        new_expiry = (
            timezone.now() + timedelta(seconds=int(expires_in))
            if expires_in else None
        )

        self.account.access_token = new_access
        self.account.refresh_token = new_refresh
        update_fields = ["access_token", "refresh_token", "updated_at"]
        if new_expiry:
            self.account.token_expires_at = new_expiry
            update_fields.append("token_expires_at")
        self.account.last_error = ""
        update_fields.append("last_error")
        self.account.save(update_fields=update_fields)

        logger.info(
            "%s token refreshed (expires_at=%s)",
            self._log_prefix,
            new_expiry.isoformat() if new_expiry else "unknown",
        )
        return new_expiry