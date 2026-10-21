from __future__ import annotations

import logging
import mimetypes
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


def _graph_base() -> str:
    version = getattr(settings, "META_GRAPH_API_VERSION", "v21.0")
    return f"https://graph.facebook.com/{version}"


_TOKEN_ERROR_CODES = {190, 102, 463, 467}
_RATE_ERROR_CODES  = {4, 17, 32, 613}
_QUOTA_ERROR_CODES = {368}


def _raise_for_graph_error(resp: requests.Response, *, context: str) -> None:
    if resp.status_code < 400:
        return
    try:
        payload = resp.json()
        err = payload.get("error", {}) or {}
    except ValueError:
        err = {}
    code = err.get("code")
    message = err.get("message") or resp.text[:300]
    user_msg = err.get("error_user_msg") or ""
    full = f"Instagram {context} failed ({resp.status_code}): {message}"
    if user_msg:
        full += f" — {user_msg}"
    if code in _TOKEN_ERROR_CODES:
        raise TokenExpiredError(full)
    if code in _QUOTA_ERROR_CODES:
        raise QuotaExceededError(full)
    if code in _RATE_ERROR_CODES or resp.status_code == 429:
        raise RateLimitError(full, retry_after_seconds=300)
    raise PlatformError(full, status_code=resp.status_code, response=err)


def _is_video(path: str) -> bool:
    ctype, _ = mimetypes.guess_type(path)
    if ctype and ctype.startswith("video/"):
        return True
    return path.lower().endswith((".mp4", ".mov", ".m4v", ".webm"))


def _is_image(path: str) -> bool:
    ctype, _ = mimetypes.guess_type(path)
    return bool(ctype and ctype.startswith("image/"))


def _parse_ig_time(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("+0000", "+00:00"))
    except (ValueError, TypeError):
        return None


_REELS_POLL_TIMEOUT = 180
_REELS_POLL_INTERVAL = 5


class InstagramClient(PlatformClient):
    platform = "INSTAGRAM"
    request_timeout = 60

    SUPPORTS_COMMENTS = True
    SUPPORTS_DIRECT_MESSAGES = False
    SUPPORTS_MENTIONS = True
    SUPPORTS_DEMOGRAPHICS = True
    SUPPORTS_BEST_TIMES = True
    SUPPORTS_BOOST = True
    SUPPORTS_DELETE_POST = True
    SUPPORTS_EDIT_CAPTION = False
    SUPPORTS_FIRST_COMMENT = True
    SUPPORTS_STORIES = False
    SUPPORTS_REELS = True
    SUPPORTS_SHORTS = False
    SUPPORTS_CAROUSEL = True

    MAX_CAPTION_LENGTH = 2_200
    MAX_MEDIA_COUNT = 10
    MAX_VIDEO_DURATION_SEC = 900
    REQUIRES_VIDEO = False

    def _ig_user_id(self) -> str:
        ig_id = (
            self.account.metadata.get("ig_user_id")
            or getattr(settings, "INSTAGRAM_BUSINESS_ACCOUNT_ID", "")
        )
        if not ig_id:
            raise PlatformError(
                "Instagram ig_user_id missing from account metadata — "
                "reconnect the account."
            )
        return str(ig_id)

    def _token(self) -> str:
        return self.account.access_token

    def _public_url(self, path: str) -> str:
        if path.startswith(("http://", "https://")):
            return path

        base = (
            self.account.metadata.get("public_media_base")
            or getattr(settings, "MEDIA_URL_ABSOLUTE", "")
            or getattr(settings, "BACKEND_PUBLIC_URL", "")
        )
        if not base:
            raise PlatformError(
                "Instagram requires publicly reachable media, but neither "
                "MEDIA_URL_ABSOLUTE nor BACKEND_PUBLIC_URL is set."
            )
        media_root = str(getattr(settings, "MEDIA_ROOT", "") or "")
        rel = path.replace(media_root, "", 1).lstrip("/")
        return f"{base.rstrip('/')}/{rel}"

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
            raise PlatformError(
                "Instagram requires at least one image or video."
            )

        ig_user_id = self._ig_user_id()
        token = self._token()
        opts = options or {}

        images = [p for p in media_paths if _is_image(p)]
        videos = [p for p in media_paths if _is_video(p)]

        if videos and images:
            logger.warning(
                "%s mixed media not supported by Instagram; using first asset",
                self._log_prefix,
            )

        # Carousel path — multiple images.
        if len(images) > 1 and not videos and opts.get("post_type") != "REELS":
            result = self._publish_carousel(
                ig_user_id, token, images, caption, opts,
            )
        else:
            primary = videos[0] if videos else images[0]
            is_video = _is_video(primary)
            post_type = opts.get("post_type")
            if is_video:
                post_type = post_type or "REELS"
            result = self._publish_single(
                ig_user_id, token, primary, caption, is_video, post_type,
            )

        if first_comment and result.platform_post_id:
            try:
                self._post_first_comment(result.platform_post_id, first_comment)
            except PlatformError as exc:
                logger.warning(
                    "%s first comment failed for %s: %s",
                    self._log_prefix, result.platform_post_id, exc,
                )

        return result

    def _publish_single(
        self,
        ig_user_id: str,
        token: str,
        path: str,
        caption: str,
        is_video: bool,
        post_type: str | None,
    ) -> PublishResult:
        creation_id = self._create_container(
            ig_user_id, token, path, caption, is_video, post_type,
        )
        if is_video:
            self._wait_for_container(ig_user_id, token, creation_id)
        media_id = self._publish_container(ig_user_id, token, creation_id)
        permalink = self._fetch_permalink(media_id, token) or (
            f"https://www.instagram.com/p/{media_id}/" if media_id else ""
        )
        return PublishResult(
            platform_post_id=media_id,
            platform_url=permalink,
            raw={"creation_id": creation_id, "media_id": media_id},
        )

    def _publish_carousel(
        self,
        ig_user_id: str,
        token: str,
        paths: list[str],
        caption: str,
        options: dict,
    ) -> PublishResult:
        child_ids: list[str] = []
        for path in paths[: self.MAX_MEDIA_COUNT]:
            child = self._create_carousel_item(ig_user_id, token, path)
            child_ids.append(child)

        if not child_ids:
            raise PlatformError("Instagram carousel has no valid children.")

        resp = requests.post(
            f"{_graph_base()}/{ig_user_id}/media",
            data={
                "media_type": "CAROUSEL",
                "children": ",".join(child_ids),
                "caption": caption,
                "access_token": token,
            },
            timeout=max(self.request_timeout, 120),
        )
        _raise_for_graph_error(resp, context="carousel container create")
        data = self._parse_json(resp, context="carousel container create")
        creation_id = data.get("id")
        if not creation_id:
            raise PlatformError("Instagram did not return a carousel creation id.")

        media_id = self._publish_container(ig_user_id, token, str(creation_id))
        permalink = self._fetch_permalink(media_id, token) or (
            f"https://www.instagram.com/p/{media_id}/" if media_id else ""
        )
        return PublishResult(
            platform_post_id=media_id,
            platform_url=permalink,
            raw={"creation_id": creation_id, "children": child_ids, "media_id": media_id},
        )

    def _create_container(
        self,
        ig_user_id: str,
        token: str,
        path: str,
        caption: str,
        is_video: bool,
        post_type: str | None = None,
    ) -> str:
        media_url = self._public_url(path)
        payload: dict = {"caption": caption, "access_token": token}

        if is_video:
            payload["media_type"] = post_type or "REELS"
            payload["video_url"] = media_url
        else:
            if post_type == "STORIES":
                payload["media_type"] = "STORIES"
            payload["image_url"] = media_url

        resp = requests.post(
            f"{_graph_base()}/{ig_user_id}/media",
            data=payload,
            timeout=max(self.request_timeout, 120),
        )
        _raise_for_graph_error(resp, context="container create")
        data = self._parse_json(resp, context="container create")
        creation_id = data.get("id")
        if not creation_id:
            raise PlatformError("Instagram did not return a creation id.")
        return str(creation_id)

    def _create_carousel_item(self, ig_user_id: str, token: str, path: str) -> str:
        media_url = self._public_url(path)
        is_video = _is_video(path)
        payload: dict = {
            "is_carousel_item": "true",
            "access_token": token,
        }
        if is_video:
            payload["media_type"] = "VIDEO"
            payload["video_url"] = media_url
        else:
            payload["image_url"] = media_url

        resp = requests.post(
            f"{_graph_base()}/{ig_user_id}/media",
            data=payload,
            timeout=max(self.request_timeout, 120),
        )
        _raise_for_graph_error(resp, context="carousel item create")
        data = self._parse_json(resp, context="carousel item create")
        child_id = data.get("id")
        if not child_id:
            raise PlatformError("Instagram did not return a carousel child id.")
        if is_video:
            self._wait_for_container(ig_user_id, token, str(child_id))
        return str(child_id)

    def _wait_for_container(self, ig_user_id: str, token: str, creation_id: str) -> None:
        deadline = time.monotonic() + _REELS_POLL_TIMEOUT
        url = f"{_graph_base()}/{creation_id}"
        params = {"fields": "status_code,status", "access_token": token}

        while time.monotonic() < deadline:
            resp = requests.get(url, params=params, timeout=30)
            _raise_for_graph_error(resp, context="container status")
            data = self._parse_json(resp, context="container status")
            status = (data.get("status_code") or "").upper()

            if status == "FINISHED":
                return
            if status in ("ERROR", "EXPIRED"):
                detail = data.get("status") or "no detail"
                raise PlatformError(
                    f"Instagram container {creation_id} ended in {status}: {detail}"
                )

            time.sleep(_REELS_POLL_INTERVAL)

        raise PlatformError(
            f"Instagram container {creation_id} did not finish within "
            f"{_REELS_POLL_TIMEOUT}s."
        )

    def _publish_container(self, ig_user_id: str, token: str, creation_id: str) -> str:
        resp = requests.post(
            f"{_graph_base()}/{ig_user_id}/media_publish",
            data={"creation_id": creation_id, "access_token": token},
            timeout=max(self.request_timeout, 120),
        )
        _raise_for_graph_error(resp, context="publish")
        data = self._parse_json(resp, context="publish")
        media_id = data.get("id")
        if not media_id:
            raise PlatformError("Instagram publish returned no media id.")
        return str(media_id)

    def _fetch_permalink(self, media_id: str, token: str) -> str:
        try:
            resp = requests.get(
                f"{_graph_base()}/{media_id}",
                params={"fields": "permalink", "access_token": token},
                timeout=15,
            )
            if resp.status_code >= 400:
                return ""
            return resp.json().get("permalink", "") or ""
        except Exception:
            logger.debug("%s permalink fetch failed", self._log_prefix, exc_info=True)
            return ""

    def _post_first_comment(self, media_id: str, body: str) -> None:
        resp = requests.post(
            f"{_graph_base()}/{media_id}/comments",
            data={"message": body, "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="first comment")

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return self._simulate_metrics()

        self._require_connected()
        self._require_fresh_token()

        fields = (
            "like_count,comments_count,"
            "insights.metric(impressions,reach,shares,saved,plays,"
            "video_views,profile_visits,follower_count)"
        )
        resp = requests.get(
            f"{_graph_base()}/{platform_post_id}",
            params={"fields": fields, "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="metrics")
        data = self._parse_json(resp, context="metrics")

        likes = int(data.get("like_count", 0) or 0)
        comments = int(data.get("comments_count", 0) or 0)

        reach = shares = impressions = saves = 0
        video_views = profile_visits = 0

        for insight in (data.get("insights") or {}).get("data", []) or []:
            name = insight.get("name")
            for value in insight.get("values", []) or []:
                val = value.get("value", 0)
                try:
                    ival = int(val or 0)
                except (TypeError, ValueError):
                    continue
                if name == "reach":
                    reach = ival
                elif name == "impressions":
                    impressions = ival
                elif name == "shares":
                    shares = ival
                elif name == "saved":
                    saves = ival
                elif name in ("plays", "video_views"):
                    video_views = ival
                elif name == "profile_visits":
                    profile_visits = ival

        return MetricsResult(
            likes=likes,
            comments=comments,
            shares=shares,
            reach=reach,
            impressions=impressions,
            saves=saves,
            video_views=video_views,
            profile_visits=profile_visits,
        )

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        try:
            ig_user_id = self._ig_user_id()
        except PlatformError:
            return 0
        resp = requests.get(
            f"{_graph_base()}/{ig_user_id}",
            params={
                "fields": "followers_count",
                "access_token": self._token(),
            },
            timeout=self.request_timeout,
        )
        if resp.status_code >= 400:
            logger.warning(
                "%s followers fetch failed (%s): %s",
                self._log_prefix, resp.status_code, resp.text[:200],
            )
            return 0
        try:
            return int(resp.json().get("followers_count", 0) or 0)
        except (ValueError, TypeError):
            return 0

    def refresh_access_token(self) -> datetime | None:
        if self.dry_run:
            return None

        token = self.account.access_token
        if not token:
            raise TokenExpiredError("Instagram account has no access token to refresh.")

        resp = requests.get(
            f"{_graph_base()}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": token,
            },
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="token refresh")
        data = self._parse_json(resp, context="token refresh")

        new_token = data.get("access_token")
        if not new_token:
            raise PlatformError("Instagram token refresh returned no access_token.")

        expires_in = data.get("expires_in")
        new_expiry = (
            timezone.now() + timedelta(seconds=int(expires_in))
            if expires_in else None
        )

        self.account.access_token = new_token
        update_fields = ["access_token", "updated_at"]
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

    def fetch_comments(
        self, platform_post_id: str, since: datetime | None = None,
    ) -> list[CommentResult]:
        if self.dry_run:
            return [self._simulate_comment() for _ in range(2)]

        self._require_connected()
        self._require_fresh_token()

        params = {
            "fields": "id,text,username,timestamp,permalink,parent_id",
            "access_token": self._token(),
            "limit": 100,
        }
        resp = requests.get(
            f"{_graph_base()}/{platform_post_id}/comments",
            params=params,
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="fetch comments")
        data = self._parse_json(resp, context="fetch comments")

        out: list[CommentResult] = []
        for row in data.get("data", []) or []:
            out.append(
                CommentResult(
                    platform_comment_id=str(row.get("id", "")),
                    author_name=row.get("username", "") or "",
                    author_handle=row.get("username", "") or "",
                    author_avatar="",
                    body=row.get("text", "") or "",
                    permalink=row.get("permalink", "") or "",
                    parent_id=row.get("parent_id", "") or "",
                    received_at=_parse_ig_time(row.get("timestamp")),
                    raw=row,
                )
            )
        return out

    def reply_to_comment(self, platform_comment_id: str, body: str) -> CommentResult:
        if self.dry_run:
            return self._simulate_comment()

        self._require_connected()
        self._require_fresh_token()

        resp = requests.post(
            f"{_graph_base()}/{platform_comment_id}/replies",
            data={"message": body, "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="reply to comment")
        data = self._parse_json(resp, context="reply to comment")

        return CommentResult(
            platform_comment_id=str(data.get("id", "")),
            author_name=self.account.name,
            author_handle=self.account.handle,
            body=body,
            received_at=timezone.now(),
            raw=data,
        )

    def delete_comment(self, platform_comment_id: str) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        resp = requests.delete(
            f"{_graph_base()}/{platform_comment_id}",
            params={"access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="delete comment")

    def hide_comment(self, platform_comment_id: str, hidden: bool = True) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        resp = requests.post(
            f"{_graph_base()}/{platform_comment_id}",
            data={
                "hide": "true" if hidden else "false",
                "access_token": self._token(),
            },
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="hide comment")

    def fetch_mentions(
        self, since: datetime | None = None,
    ) -> list[MentionResult]:
        if self.dry_run:
            return []

        self._require_connected()
        self._require_fresh_token()

        ig_user_id = self._ig_user_id()
        resp = requests.get(
            f"{_graph_base()}/{ig_user_id}/tags",
            params={
                "fields": "id,caption,username,timestamp,permalink",
                "access_token": self._token(),
                "limit": 100,
            },
            timeout=self.request_timeout,
        )
        if resp.status_code >= 400:
            logger.warning(
                "%s mentions fetch failed (%s): %s",
                self._log_prefix, resp.status_code, resp.text[:200],
            )
            return []
        data = self._parse_json(resp, context="fetch mentions")

        out: list[MentionResult] = []
        for row in data.get("data", []) or []:
            out.append(
                MentionResult(
                    platform_mention_id=str(row.get("id", "")),
                    author_name=row.get("username", "") or "",
                    author_handle=row.get("username", "") or "",
                    author_avatar="",
                    body=row.get("caption", "") or "",
                    permalink=row.get("permalink", "") or "",
                    received_at=_parse_ig_time(row.get("timestamp")),
                    raw=row,
                )
            )
        return out

    def fetch_demographics(self) -> DemographicResult:
        if self.dry_run:
            return self._simulate_demographics()

        self._require_connected()
        self._require_fresh_token()

        ig_user_id = self._ig_user_id()
        metrics = "audience_gender_age,audience_city,audience_country"
        resp = requests.get(
            f"{_graph_base()}/{ig_user_id}/insights",
            params={
                "metric": metrics,
                "period": "lifetime",
                "access_token": self._token(),
            },
            timeout=self.request_timeout,
        )
        if resp.status_code >= 400:
            logger.warning(
                "%s demographics fetch failed (%s): %s",
                self._log_prefix, resp.status_code, resp.text[:200],
            )
            return DemographicResult()
        data = self._parse_json(resp, context="fetch demographics")

        age_buckets: dict = {}
        gender: dict = {}
        top_cities: list = []
        top_countries: list = []

        for insight in data.get("data", []) or []:
            name = insight.get("name")
            values = insight.get("values", []) or []
            value_map = (values[0].get("value", {}) if values else {}) or {}

            if name == "audience_gender_age":
                for key, count in value_map.items():
                    if "." in key:
                        g, age = key.split(".", 1)
                        gender[g] = gender.get(g, 0) + int(count or 0)
                        age_buckets[age] = age_buckets.get(age, 0) + int(count or 0)
            elif name == "audience_city":
                top_cities = [
                    {"name": k, "count": int(v or 0)}
                    for k, v in list(value_map.items())[:10]
                ]
            elif name == "audience_country":
                top_countries = [
                    {"code": k, "name": k, "count": int(v or 0)}
                    for k, v in list(value_map.items())[:10]
                ]

        return DemographicResult(
            age_buckets=age_buckets,
            gender=gender,
            top_cities=top_cities,
            top_countries=top_countries,
            raw=data,
        )

    def fetch_best_times(self) -> list[BestTimeResult]:
        if self.dry_run:
            return self._simulate_best_times()

        self._require_connected()
        self._require_fresh_token()

        ig_user_id = self._ig_user_id()
        resp = requests.get(
            f"{_graph_base()}/{ig_user_id}/insights",
            params={
                "metric": "audience_online",
                "period": "lifetime",
                "access_token": self._token(),
            },
            timeout=self.request_timeout,
        )
        if resp.status_code >= 400:
            return []
        data = self._parse_json(resp, context="fetch best times")

        out: list[BestTimeResult] = []
        for insight in data.get("data", []) or []:
            if insight.get("name") != "audience_online":
                continue
            for value_row in insight.get("values", []) or []:
                value_map = value_row.get("value", {}) or {}
                for day_str, by_hour in value_map.items():
                    try:
                        day = int(day_str)
                    except (TypeError, ValueError):
                        continue
                    if not isinstance(by_hour, dict):
                        continue
                    for hour_str, count in by_hour.items():
                        try:
                            hour = int(hour_str)
                            count_int = int(count or 0)
                        except (TypeError, ValueError):
                            continue
                        out.append(
                            BestTimeResult(
                                day_of_week=day,
                                hour=hour,
                                score=float(count_int),
                                sample_size=count_int,
                            )
                        )
        return out

    def delete_post(self, platform_post_id: str) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        resp = requests.delete(
            f"{_graph_base()}/{platform_post_id}",
            params={"access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="delete post")

    def boost_post(
        self,
        platform_post_id: str,
        budget_cents: int,
        duration_days: int,
        audience: dict | None = None,
    ) -> BoostResult:
        if self.dry_run:
            return super().boost_post(
                platform_post_id, budget_cents, duration_days, audience,
            )

        self._require_connected()
        self._require_fresh_token()

        opts = audience or {}
        token = self._token()

        create_resp = requests.post(
            f"{_graph_base()}/act_{opts.get('ad_account_id', '')}/campaigns",
            data={
                "name": f"Boost {platform_post_id}",
                "objective": "OUTCOME_ENGAGEMENT",
                "status": "PAUSED",
                "access_token": token,
            },
            timeout=self.request_timeout,
        )
        if create_resp.status_code >= 400:
            logger.warning(
                "%s boost create failed (%s): %s",
                self._log_prefix, create_resp.status_code, create_resp.text[:200],
            )
            return BoostResult(
                platform_boost_id=f"ig_boost_{platform_post_id}",
                status="PENDING",
                estimated_reach=budget_cents * 5,
            )

        data = create_resp.json() if create_resp.content else {}
        campaign_id = str(data.get("id", ""))
        return BoostResult(
            platform_boost_id=campaign_id or f"ig_boost_{platform_post_id}",
            status="PENDING",
            estimated_reach=budget_cents * 5,
            raw=data,
        )