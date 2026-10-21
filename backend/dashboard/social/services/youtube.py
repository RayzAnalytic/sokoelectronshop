from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from google.auth.exceptions import RefreshError, TransportError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

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


OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token"

TITLE_MAX_LEN        = 100
DESCRIPTION_MAX_LEN  = 5_000
DEFAULT_CATEGORY_ID  = "22"
DEFAULT_PRIVACY      = "public"
VALID_PRIVACY        = {"public", "private", "unlisted"}

_QUOTA_REASONS = {
    "quotaExceeded",
    "dailyLimitExceeded",
    "uploadLimitExceeded",
}
_RATE_REASONS = {
    "rateLimitExceeded",
    "userRateLimitExceeded",
}
_AUTH_REASONS = {
    "authError",
    "invalid_grant",
    "unauthorized",
}
_TITLE_REASONS = {
    "invalidTitle",
    "invalidVideoMetadata",
    "invalidDescription",
}


_TITLE_BAD_CHARS = re.compile(r"[<>]")


def _sanitise_title(raw: str) -> str:
    cleaned = _TITLE_BAD_CHARS.sub("", raw or "")
    cleaned = " ".join(cleaned.split())
    cleaned = cleaned[:TITLE_MAX_LEN].strip()
    return cleaned or "Untitled"


def _split_caption(caption: str) -> tuple[str, str]:
    text = (caption or "").strip()
    if not text:
        return "Untitled", ""
    lines = text.split("\n", 1)
    title = _sanitise_title(lines[0])
    description = (lines[1] if len(lines) > 1 else text).strip()
    return title, description[:DESCRIPTION_MAX_LEN]


def _error_reason(exc: HttpError) -> tuple[str, str]:
    status = getattr(exc.resp, "status", None) or 0
    try:
        body = getattr(exc, "error_details", None) or []
        if body:
            reason = (body[0].get("reason") or "").lower()
            return str(status), reason
    except Exception:
        pass
    text = str(exc)
    for reason in _QUOTA_REASONS | _RATE_REASONS | _AUTH_REASONS | _TITLE_REASONS:
        if reason.lower() in text.lower():
            return str(status), reason.lower()
    return str(status), ""


def _translate_http_error(exc: HttpError, *, context: str) -> Exception:
    status, reason = _error_reason(exc)
    short = str(exc)[:300]

    if reason in _QUOTA_REASONS:
        return QuotaExceededError(
            f"YouTube {context} quota exceeded (reason={reason}). "
            f"1,600 units per upload, 10,000 units/day."
        )
    if reason in _RATE_REASONS or status == "429":
        return RateLimitError(
            f"YouTube {context} rate-limited (reason={reason}).",
            retry_after_seconds=60,
        )
    if reason in _AUTH_REASONS or status == "401":
        return TokenExpiredError(
            f"YouTube {context} auth failed (reason={reason or 'unknown'}). "
            f"Reconnect the account."
        )
    if reason in _TITLE_REASONS:
        return PlatformError(
            f"YouTube {context} rejected the metadata: {short}"
        )
    return PlatformError(f"YouTube {context} failed ({status}): {short}")


def _parse_yt_time(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


class YouTubeClient(PlatformClient):
    platform = "YOUTUBE"
    request_timeout = 120

    SUPPORTS_COMMENTS = True
    SUPPORTS_DIRECT_MESSAGES = False
    SUPPORTS_MENTIONS = False
    SUPPORTS_DEMOGRAPHICS = True
    SUPPORTS_BEST_TIMES = False
    SUPPORTS_BOOST = False
    SUPPORTS_DELETE_POST = True
    SUPPORTS_EDIT_CAPTION = True
    SUPPORTS_FIRST_COMMENT = True
    SUPPORTS_STORIES = False
    SUPPORTS_REELS = False
    SUPPORTS_SHORTS = True
    SUPPORTS_CAROUSEL = False

    MAX_CAPTION_LENGTH = 5_000
    MAX_MEDIA_COUNT = 1
    MAX_VIDEO_DURATION_SEC = 43_200
    REQUIRES_VIDEO = True

    def _credentials(self) -> Credentials:
        creds = Credentials(
            token=self.account.access_token or None,
            refresh_token=self.account.refresh_token or None,
            token_uri=OAUTH_TOKEN_URI,
            client_id=getattr(settings, "GOOGLE_CLIENT_ID", ""),
            client_secret=getattr(settings, "GOOGLE_CLIENT_SECRET", ""),
            scopes=getattr(settings, "YOUTUBE_SCOPES", []),
        )

        if creds.valid:
            return creds

        if not creds.refresh_token:
            raise TokenExpiredError(
                "YouTube access token expired and no refresh token is stored. "
                "Reconnect the account."
            )

        try:
            creds.refresh(Request())
        except RefreshError as exc:
            raise TokenExpiredError(
                f"YouTube token refresh rejected: {exc}. Reconnect the account."
            ) from exc
        except TransportError as exc:
            raise PlatformError(f"YouTube token refresh transport error: {exc}") from exc
        except Exception as exc:
            raise PlatformError(f"YouTube token refresh failed: {exc}") from exc

        self.account.access_token = creds.token or ""
        update_fields = ["access_token", "updated_at"]
        if creds.refresh_token:
            self.account.refresh_token = creds.refresh_token
            update_fields.append("refresh_token")
        if creds.expiry:
            self.account.token_expires_at = creds.expiry
            update_fields.append("token_expires_at")
        self.account.last_error = ""
        update_fields.append("last_error")
        self.account.save(update_fields=update_fields)

        logger.info(
            "%s access token refreshed (expires_at=%s)",
            self._log_prefix,
            creds.expiry.isoformat() if creds.expiry else "unknown",
        )
        return creds

    def _service(self):
        return build(
            "youtube", "v3",
            credentials=self._credentials(),
            cache_discovery=False,
        )

    def _analytics_service(self):
        return build(
            "youtubeAnalytics", "v2",
            credentials=self._credentials(),
            cache_discovery=False,
        )

    def publish(
        self,
        caption: str,
        media_paths: list[str],
        product_tag: str = "",
        first_comment: str = "",
        options: dict | None = None,
    ) -> PublishResult:
        if self.dry_run:
            result = self._simulate_publish(caption, media_paths)
            if first_comment:
                try:
                    self._post_first_comment(result.platform_post_id, first_comment)
                except Exception as exc:
                    logger.warning(
                        "%s dry-run first comment skipped: %s",
                        self._log_prefix, exc,
                    )
            return result

        self._require_connected()
        self._require_fresh_token()

        if not media_paths:
            raise PlatformError("YouTube requires a video file.")

        opts = options or {}
        title = _sanitise_title(opts.get("title") or caption.split("\n", 1)[0] or "")
        description = str(opts.get("description") or _split_caption(caption)[1])[
            :DESCRIPTION_MAX_LEN
        ]
        category_id = str(opts.get("category_id") or DEFAULT_CATEGORY_ID)
        privacy = opts.get("privacy_status") or DEFAULT_PRIVACY
        if privacy not in VALID_PRIVACY:
            privacy = DEFAULT_PRIVACY

        tags = opts.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        snippet: dict = {
            "title": title,
            "description": description,
            "categoryId": category_id,
        }
        if tags:
            snippet["tags"] = tags
        if opts.get("default_language"):
            snippet["defaultLanguage"] = str(opts["default_language"])

        status_payload: dict = {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": bool(opts.get("made_for_kids", False)),
        }
        if opts.get("embeddable") is not None:
            status_payload["embeddable"] = bool(opts["embeddable"])
        if opts.get("license"):
            status_payload["license"] = str(opts["license"])
        if opts.get("publish_at"):
            status_payload["privacyStatus"] = "private"
            status_payload["publishAt"] = str(opts["publish_at"])

        body = {"snippet": snippet, "status": status_payload}

        media = MediaFileUpload(
            media_paths[0],
            chunksize=8 * 1024 * 1024,
            resumable=True,
        )

        insert = self._service().videos().insert(
            part="snippet,status",
            body=body,
            media_body=media,
        )

        response = self._execute_resumable(insert)
        video_id = response.get("id", "")
        if not video_id:
            raise PlatformError("YouTube insert returned no video id.")

        thumbnail_path = opts.get("thumbnail_path")
        if thumbnail_path:
            self._set_thumbnail(video_id, thumbnail_path)

        if first_comment:
            try:
                self._post_first_comment(video_id, first_comment)
            except PlatformError as exc:
                logger.warning(
                    "%s first comment failed for %s: %s",
                    self._log_prefix, video_id, exc,
                )

        return PublishResult(
            platform_post_id=video_id,
            platform_url=f"https://youtu.be/{video_id}",
            raw=response,
        )

    def _execute_resumable(self, request) -> dict:
        response = None
        last_logged_pct = -10

        while response is None:
            try:
                status, response = request.next_chunk()
            except HttpError as exc:
                raise _translate_http_error(exc, context="upload")

            if status is None:
                continue

            pct = int(status.progress() * 100)
            if pct >= last_logged_pct + 10:
                logger.info(
                    "%s upload progress %s%%",
                    self._log_prefix, pct,
                )
                last_logged_pct = pct

        return response or {}

    def _set_thumbnail(self, video_id: str, path: str) -> None:
        try:
            self._service().thumbnails().set(
                videoId=video_id,
                media_body=MediaFileUpload(path),
            ).execute()
        except HttpError as exc:
            logger.warning(
                "%s thumbnail upload failed for %s: %s",
                self._log_prefix, video_id, str(exc)[:200],
            )

    def _post_first_comment(self, video_id: str, body: str) -> None:
        try:
            self._service().commentThreads().insert(
                part="snippet",
                body={
                    "snippet": {
                        "videoId": video_id,
                        "topLevelComment": {
                            "snippet": {"textOriginal": body}
                        },
                    }
                },
            ).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="first comment")

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return self._simulate_metrics()

        self._require_connected()
        self._require_fresh_token()

        try:
            resp = self._service().videos().list(
                part="statistics",
                id=platform_post_id,
            ).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="metrics")

        items = resp.get("items") or []
        if not items:
            return MetricsResult()

        stats = items[0].get("statistics", {}) or {}
        views = int(stats.get("viewCount", 0) or 0)
        return MetricsResult(
            likes=int(stats.get("likeCount", 0) or 0),
            comments=int(stats.get("commentCount", 0) or 0),
            shares=0,
            reach=views,
            impressions=0,
            video_views=views,
        )

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        try:
            resp = self._service().channels().list(
                part="statistics",
                mine=True,
            ).execute()
        except HttpError as exc:
            logger.warning(
                "%s subscribers fetch failed: %s",
                self._log_prefix, str(exc)[:200],
            )
            return 0
        except TokenExpiredError:
            raise

        items = resp.get("items") or []
        if not items:
            return 0
        stats = items[0].get("statistics", {}) or {}
        return int(stats.get("subscriberCount", 0) or 0)

    def refresh_access_token(self) -> datetime | None:
        if self.dry_run:
            return None
        if not self.account.refresh_token:
            raise TokenExpiredError(
                "YouTube account has no refresh token; user must reconnect."
            )

        creds = self._credentials()
        return creds.expiry if creds.expiry else None

    def fetch_comments(
        self, platform_post_id: str, since: datetime | None = None,
    ) -> list[CommentResult]:
        if self.dry_run:
            return [self._simulate_comment() for _ in range(3)]

        self._require_connected()
        self._require_fresh_token()

        params = {
            "part": "snippet",
            "videoId": platform_post_id,
            "maxResults": 100,
            "textFormat": "plainText",
            "order": "time",
        }
        if since:
            params["publishedAfter"] = since.isoformat()

        try:
            resp = self._service().commentThreads().list(**params).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="fetch comments")

        out: list[CommentResult] = []
        for thread in resp.get("items", []) or []:
            top = (thread.get("snippet") or {}).get("topLevelComment", {}) or {}
            sn = top.get("snippet", {}) or {}
            out.append(
                CommentResult(
                    platform_comment_id=str(top.get("id", "")),
                    author_name=sn.get("authorDisplayName", "") or "",
                    author_handle=sn.get("authorChannelId", {}).get("value", "") or "",
                    author_avatar=sn.get("authorProfileImageUrl", "") or "",
                    body=sn.get("textDisplay", "") or "",
                    permalink="",
                    parent_id="",
                    received_at=_parse_yt_time(sn.get("publishedAt")),
                    raw=top,
                )
            )

            # Replies within the thread — flatten into the same list so
            # the inbox can show them under their parent.
            for reply in (thread.get("replies") or {}).get("comments", []) or []:
                rsn = reply.get("snippet", {}) or {}
                out.append(
                    CommentResult(
                        platform_comment_id=str(reply.get("id", "")),
                        author_name=rsn.get("authorDisplayName", "") or "",
                        author_handle=rsn.get("authorChannelId", {}).get("value", "") or "",
                        author_avatar=rsn.get("authorProfileImageUrl", "") or "",
                        body=rsn.get("textDisplay", "") or "",
                        permalink="",
                        parent_id=str(top.get("id", "")),
                        received_at=_parse_yt_time(rsn.get("publishedAt")),
                        raw=reply,
                    )
                )
        return out

    def reply_to_comment(self, platform_comment_id: str, body: str) -> CommentResult:
        if self.dry_run:
            return self._simulate_comment()

        self._require_connected()
        self._require_fresh_token()

        try:
            resp = self._service().comments().insert(
                part="snippet",
                body={
                    "snippet": {
                        "parentId": platform_comment_id,
                        "textOriginal": body,
                    }
                },
            ).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="reply to comment")

        sn = resp.get("snippet", {}) or {}
        return CommentResult(
            platform_comment_id=str(resp.get("id", "")),
            author_name=self.account.name,
            author_handle=self.account.handle,
            body=body,
            received_at=timezone.now(),
            raw=resp,
        )

    def delete_comment(self, platform_comment_id: str) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        try:
            self._service().comments().delete(id=platform_comment_id).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="delete comment")

    def hide_comment(self, platform_comment_id: str, hidden: bool = True) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        try:
            self._service().comments().setModerationStatus(
                id=platform_comment_id,
                moderationStatus="heldForReview" if hidden else "published",
            ).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="hide comment")

    def fetch_demographics(self) -> DemographicResult:
        if self.dry_run:
            return self._simulate_demographics()

        self._require_connected()
        self._require_fresh_token()

        end = timezone.now().date()
        start = end - timedelta(days=28)

        try:
            resp = self._analytics_service().reports().query(
                ids="channel==MINE",
                startDate=start.isoformat(),
                endDate=end.isoformat(),
                metrics="viewerPercentage",
                dimensions="ageGroup,gender",
                sort="-viewerPercentage",
            ).execute()
        except HttpError as exc:
            logger.warning(
                "%s demographics fetch failed: %s",
                self._log_prefix, str(exc)[:200],
            )
            return DemographicResult()
        except Exception as exc:
            logger.warning("%s demographics error: %s", self._log_prefix, exc)
            return DemographicResult()

        age_buckets: dict = {}
        gender: dict = {}

        headers = [h.get("name") for h in (resp.get("columnHeaders") or [])]
        try:
            age_idx = headers.index("ageGroup")
            gender_idx = headers.index("gender")
            pct_idx = headers.index("viewerPercentage")
        except ValueError:
            return DemographicResult()

        for row in resp.get("rows", []) or []:
            age = str(row[age_idx])
            g = str(row[gender_idx])
            pct = float(row[pct_idx] or 0)
            age_buckets[age] = age_buckets.get(age, 0) + pct
            gender[g] = gender.get(g, 0) + pct

        return DemographicResult(
            age_buckets={k: round(v, 2) for k, v in age_buckets.items()},
            gender={k: round(v, 2) for k, v in gender.items()},
            top_cities=[],
            top_countries=[],
            raw=resp,
        )

    def fetch_best_times(self) -> list[BestTimeResult]:
        raise UnsupportedOperationError(
            "YouTube does not expose a best-time-to-publish endpoint. "
            "Best-time data is computed offline from the analytics table."
        )

    def fetch_direct_messages(
        self, since: datetime | None = None,
    ) -> list[DirectMessageResult]:
        raise UnsupportedOperationError(
            "YouTube does not expose direct messages via the Data API."
        )

    def reply_to_direct_message(
        self, platform_message_id: str, body: str,
    ) -> DirectMessageResult:
        raise UnsupportedOperationError(
            "YouTube does not expose direct messages via the Data API."
        )

    def fetch_mentions(
        self, since: datetime | None = None,
    ) -> list[MentionResult]:
        raise UnsupportedOperationError(
            "YouTube does not expose brand mentions via the Data API."
        )

    def delete_post(self, platform_post_id: str) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        try:
            self._service().videos().delete(id=platform_post_id).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="delete video")

    def edit_caption(self, platform_post_id: str, caption: str) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()

        title, description = _split_caption(caption)
        try:
            self._service().videos().update(
                part="snippet",
                body={
                    "id": platform_post_id,
                    "snippet": {
                        "title": title,
                        "description": description,
                        "categoryId": str(DEFAULT_CATEGORY_ID),
                    },
                },
            ).execute()
        except HttpError as exc:
            raise _translate_http_error(exc, context="edit caption")

    def boost_post(
        self,
        platform_post_id: str,
        budget_cents: int,
        duration_days: int,
        audience: dict | None = None,
    ) -> BoostResult:
        raise UnsupportedOperationError(
            "YouTube boosting is handled through Google Ads, not the Data API."
        )