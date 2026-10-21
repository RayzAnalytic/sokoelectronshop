from __future__ import annotations

import logging
import mimetypes
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
    full = f"Facebook {context} failed ({resp.status_code}): {message}"
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
    return bool(ctype and ctype.startswith("video/"))


def _is_image(path: str) -> bool:
    ctype, _ = mimetypes.guess_type(path)
    return bool(ctype and ctype.startswith("image/"))


class FacebookClient(PlatformClient):
    platform = "FACEBOOK"
    request_timeout = 60

    SUPPORTS_COMMENTS = True
    SUPPORTS_DIRECT_MESSAGES = True
    SUPPORTS_MENTIONS = True
    SUPPORTS_DEMOGRAPHICS = True
    SUPPORTS_BEST_TIMES = True
    SUPPORTS_BOOST = True
    SUPPORTS_DELETE_POST = True
    SUPPORTS_EDIT_CAPTION = True
    SUPPORTS_FIRST_COMMENT = True
    SUPPORTS_STORIES = False
    SUPPORTS_REELS = True
    SUPPORTS_SHORTS = False
    SUPPORTS_CAROUSEL = True

    MAX_CAPTION_LENGTH = 63_206
    MAX_MEDIA_COUNT = 10
    MAX_VIDEO_DURATION_SEC = 14400
    REQUIRES_VIDEO = False

    def _page_id(self) -> str:
        page_id = (
            self.account.metadata.get("page_id")
            or getattr(settings, "FACEBOOK_PAGE_ID", "")
        )
        if not page_id:
            raise PlatformError(
                "Facebook page_id missing from account metadata — "
                "reconnect the account."
            )
        return str(page_id)

    def _token(self) -> str:
        return self.account.access_token

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

        page_id = self._page_id()
        token = self._token()
        opts = options or {}

        images = [p for p in media_paths if _is_image(p)]
        videos = [p for p in media_paths if _is_video(p)]

        if not media_paths:
            result = self._publish_text(page_id, token, caption)
        elif videos and not images:
            result = self._publish_video(page_id, token, caption, videos[0], opts)
        elif len(images) == 1 and not videos:
            result = self._publish_single_photo(page_id, token, caption, images[0])
        elif len(images) > 1 and not videos:
            result = self._publish_multi_photo(page_id, token, caption, images)
        else:
            logger.warning(
                "%s mixed media not supported by Graph API; using first asset only",
                self._log_prefix,
            )
            if videos:
                result = self._publish_video(page_id, token, caption, videos[0], opts)
            else:
                result = self._publish_single_photo(page_id, token, caption, images[0])

        if first_comment and result.platform_post_id:
            try:
                self._post_first_comment(result.platform_post_id, first_comment)
            except PlatformError as exc:
                logger.warning(
                    "%s first comment failed for %s: %s",
                    self._log_prefix, result.platform_post_id, exc,
                )

        return result

    def _post_first_comment(self, post_id: str, body: str) -> None:
        resp = requests.post(
            f"{_graph_base()}/{post_id}/comments",
            data={"message": body, "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="first comment")

    def _publish_text(self, page_id: str, token: str, caption: str) -> PublishResult:
        resp = requests.post(
            f"{_graph_base()}/{page_id}/feed",
            data={"message": caption, "access_token": token},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="text publish")
        data = self._parse_json(resp, context="text publish")
        post_id = data.get("id", "")
        return PublishResult(
            platform_post_id=post_id,
            platform_url=self._permalink(page_id, post_id),
            raw=data,
        )

    def _publish_single_photo(
        self, page_id: str, token: str, caption: str, path: str,
    ) -> PublishResult:
        with open(path, "rb") as fh:
            resp = requests.post(
                f"{_graph_base()}/{page_id}/photos",
                data={"caption": caption, "access_token": token},
                files={"source": fh},
                timeout=self.request_timeout,
            )
        _raise_for_graph_error(resp, context="photo publish")
        data = self._parse_json(resp, context="photo publish")
        post_id = data.get("post_id") or data.get("id", "")
        return PublishResult(
            platform_post_id=post_id,
            platform_url=self._permalink(page_id, post_id),
            raw=data,
        )

    def _publish_multi_photo(
        self, page_id: str, token: str, caption: str, paths: list[str],
    ) -> PublishResult:
        media_fbids: list[str] = []
        for path in paths:
            with open(path, "rb") as fh:
                resp = requests.post(
                    f"{_graph_base()}/{page_id}/photos",
                    data={"published": "false", "access_token": token},
                    files={"source": fh},
                    timeout=self.request_timeout,
                )
            _raise_for_graph_error(resp, context="photo upload")
            data = self._parse_json(resp, context="photo upload")
            fb_id = data.get("id")
            if not fb_id:
                raise PlatformError(
                    f"Facebook photo upload returned no id for {path!r}."
                )
            media_fbids.append(fb_id)

        attached = [{"media_fbid": fid} for fid in media_fbids]
        resp = requests.post(
            f"{_graph_base()}/{page_id}/feed",
            data={
                "message": caption,
                "access_token": token,
                "attached_media": attached,
            },
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="multi-photo publish")
        data = self._parse_json(resp, context="multi-photo publish")
        post_id = data.get("id", "")
        return PublishResult(
            platform_post_id=post_id,
            platform_url=self._permalink(page_id, post_id),
            raw=data,
        )

    def _publish_video(
        self, page_id: str, token: str, caption: str, path: str,
        options: dict | None = None,
    ) -> PublishResult:
        opts = options or {}
        data = {"description": caption, "access_token": token}
        if opts.get("title"):
            data["title"] = str(opts["title"])[:255]
        if opts.get("thumbnail_path"):
            pass
        if opts.get("published") is False:
            data["published"] = "false"
        if opts.get("scheduled_publish_time"):
            data["scheduled_publish_time"] = str(int(opts["scheduled_publish_time"]))
            data["published"] = "false"

        with open(path, "rb") as fh:
            resp = requests.post(
                f"{_graph_base()}/{page_id}/videos",
                data=data,
                files={"source": fh},
                timeout=max(self.request_timeout, 300),
            )
        _raise_for_graph_error(resp, context="video publish")
        body = self._parse_json(resp, context="video publish")
        video_id = body.get("id", "")
        return PublishResult(
            platform_post_id=video_id,
            platform_url=(
                f"https://facebook.com/{page_id}/videos/{video_id}"
                if video_id else ""
            ),
            raw=body,
        )

    def _permalink(self, page_id: str, post_id: str) -> str:
        if not post_id:
            return f"https://facebook.com/{page_id}"
        if "_" in post_id:
            return f"https://facebook.com/{post_id}"
        return f"https://facebook.com/{page_id}/posts/{post_id}"

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return self._simulate_metrics()

        self._require_connected()
        self._require_fresh_token()

        fields = ",".join([
            "shares",
            "comments.summary(true).limit(0)",
            "reactions.summary(true).limit(0)",
            "insights.metric(post_impressions_unique,post_impressions,post_clicks,post_video_views,post_video_avg_time_watched)",
        ])
        resp = requests.get(
            f"{_graph_base()}/{platform_post_id}",
            params={"fields": fields, "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="metrics")
        data = self._parse_json(resp, context="metrics")

        likes = (data.get("reactions") or {}).get("summary", {}).get("total_count", 0)
        comments = (data.get("comments") or {}).get("summary", {}).get("total_count", 0)
        shares = (data.get("shares") or {}).get("count", 0)
        reach = self._extract_insight_value(data, "post_impressions_unique")
        impressions = self._extract_insight_value(data, "post_impressions")
        link_clicks = self._extract_insight_value(data, "post_clicks")
        video_views = self._extract_insight_value(data, "post_video_views")
        watch_time = self._extract_insight_value(data, "post_video_avg_time_watched")

        return MetricsResult(
            likes=int(likes or 0),
            comments=int(comments or 0),
            shares=int(shares or 0),
            reach=int(reach or 0),
            impressions=int(impressions or 0),
            link_clicks=int(link_clicks or 0),
            video_views=int(video_views or 0),
            watch_time_sec=int(watch_time or 0),
        )

    @staticmethod
    def _extract_insight_value(data: dict, metric_name: str) -> int:
        for insight in (data.get("insights") or {}).get("data", []) or []:
            if insight.get("name") != metric_name:
                continue
            for value in insight.get("values", []) or []:
                v = value.get("value")
                if isinstance(v, int):
                    return v
        return 0

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        try:
            page_id = self._page_id()
        except PlatformError:
            return 0
        resp = requests.get(
            f"{_graph_base()}/{page_id}",
            params={"fields": "followers_count", "access_token": self._token()},
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
            raise TokenExpiredError("Facebook account has no access token to refresh.")

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
            raise PlatformError("Facebook token refresh returned no access_token.")

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
            self._log_prefix, new_expiry.isoformat() if new_expiry else "unknown",
        )
        return new_expiry

    def fetch_comments(
        self, platform_post_id: str, since: datetime | None = None,
    ) -> list[CommentResult]:
        if self.dry_run:
            return [self._simulate_comment() for _ in range(3)]

        self._require_connected()
        self._require_fresh_token()

        params = {
            "fields": "id,message,from{id,name,picture},created_time,permalink_url,parent{id}",
            "access_token": self._token(),
            "limit": 100,
        }
        if since:
            params["since"] = int(since.timestamp())

        resp = requests.get(
            f"{_graph_base()}/{platform_post_id}/comments",
            params=params,
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="fetch comments")
        data = self._parse_json(resp, context="fetch comments")

        out: list[CommentResult] = []
        for row in data.get("data", []) or []:
            sender = row.get("from") or {}
            out.append(
                CommentResult(
                    platform_comment_id=str(row.get("id", "")),
                    author_name=sender.get("name", "") or "",
                    author_handle="",
                    author_avatar=(sender.get("picture") or {}).get("data", {}).get("url", "") or "",
                    body=row.get("message", "") or "",
                    permalink=row.get("permalink_url", "") or "",
                    parent_id=(row.get("parent") or {}).get("id", "") or "",
                    received_at=_parse_fb_time(row.get("created_time")),
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
            f"{_graph_base()}/{platform_comment_id}/comments",
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
            data={"is_hidden": "true" if hidden else "false", "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="hide comment")

    def fetch_direct_messages(
        self, since: datetime | None = None,
    ) -> list[DirectMessageResult]:
        if self.dry_run:
            return [self._simulate_dm() for _ in range(2)]

        self._require_connected()
        self._require_fresh_token()

        page_id = self._page_id()
        params = {
            "fields": "id,message,from{id,name},created_time",
            "access_token": self._token(),
            "limit": 50,
        }
        if since:
            params["since"] = int(since.timestamp())

        resp = requests.get(
            f"{_graph_base()}/{page_id}/conversations",
            params=params,
            timeout=self.request_timeout,
        )
        if resp.status_code >= 400:
            logger.warning(
                "%s DM fetch failed (%s): %s",
                self._log_prefix, resp.status_code, resp.text[:200],
            )
            return []
        data = self._parse_json(resp, context="fetch DMs")

        out: list[DirectMessageResult] = []
        for row in data.get("data", []) or []:
            sender = row.get("from") or {}
            out.append(
                DirectMessageResult(
                    platform_message_id=str(row.get("id", "")),
                    author_name=sender.get("name", "") or "",
                    author_handle="",
                    author_avatar="",
                    body=row.get("message", "") or "",
                    received_at=_parse_fb_time(row.get("created_time")),
                    raw=row,
                )
            )
        return out

    def reply_to_direct_message(
        self, platform_message_id: str, body: str,
    ) -> DirectMessageResult:
        if self.dry_run:
            return self._simulate_dm()

        self._require_connected()
        self._require_fresh_token()

        page_id = self._page_id()
        resp = requests.post(
            f"{_graph_base()}/{page_id}/messages",
            data={
                "recipient": platform_message_id,
                "message": body,
                "access_token": self._token(),
            },
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="reply to DM")
        data = self._parse_json(resp, context="reply to DM")

        return DirectMessageResult(
            platform_message_id=str(data.get("message_id") or data.get("id", "")),
            author_name=self.account.name,
            author_handle=self.account.handle,
            body=body,
            received_at=timezone.now(),
            raw=data,
        )

    def fetch_mentions(
        self, since: datetime | None = None,
    ) -> list[MentionResult]:
        if self.dry_run:
            return []

        self._require_connected()
        self._require_fresh_token()

        page_id = self._page_id()
        params = {
            "fields": "id,message,from{id,name},created_time,permalink_url",
            "access_token": self._token(),
            "limit": 100,
        }
        if since:
            params["since"] = int(since.timestamp())

        resp = requests.get(
            f"{_graph_base()}/{page_id}/tagged",
            params=params,
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
            sender = row.get("from") or {}
            out.append(
                MentionResult(
                    platform_mention_id=str(row.get("id", "")),
                    author_name=sender.get("name", "") or "",
                    author_handle="",
                    author_avatar="",
                    body=row.get("message", "") or "",
                    permalink=row.get("permalink_url", "") or "",
                    received_at=_parse_fb_time(row.get("created_time")),
                    raw=row,
                )
            )
        return out

    def fetch_demographics(self) -> DemographicResult:
        if self.dry_run:
            return self._simulate_demographics()

        self._require_connected()
        self._require_fresh_token()

        page_id = self._page_id()
        metrics = ",".join([
            "page_fans_gender_age",
            "page_fans_city",
            "page_fans_country",
        ])
        resp = requests.get(
            f"{_graph_base()}/{page_id}/insights",
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
            if name == "page_fans_gender_age":
                for key, count in value_map.items():
                    if "." in key:
                        g, age = key.split(".", 1)
                        gender[g] = gender.get(g, 0) + int(count or 0)
                        age_buckets[age] = age_buckets.get(age, 0) + int(count or 0)
            elif name == "page_fans_city":
                top_cities = [
                    {"name": k, "count": int(v or 0)}
                    for k, v in list(value_map.items())[:10]
                ]
            elif name == "page_fans_country":
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

        page_id = self._page_id()
        resp = requests.get(
            f"{_graph_base()}/{page_id}/insights",
            params={
                "metric": "page_fans_online",
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
            if insight.get("name") != "page_fans_online":
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

    def edit_caption(self, platform_post_id: str, caption: str) -> None:
        if self.dry_run:
            return
        self._require_connected()
        self._require_fresh_token()
        resp = requests.post(
            f"{_graph_base()}/{platform_post_id}",
            data={"message": caption, "access_token": self._token()},
            timeout=self.request_timeout,
        )
        _raise_for_graph_error(resp, context="edit caption")

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

        page_id = self._page_id()
        token = self._token()
        opts = audience or {}

        create_resp = requests.post(
            f"{_graph_base()}/act_{opts.get('ad_account_id', '')}/campaigns",
            data={
                "name": f"Boost {platform_post_id}",
                "objective": "POST_ENGAGEMENT",
                "status": "PAUSED",
                "access_token": token,
            },
            timeout=self.request_timeout,
        )
        if create_resp.status_code >= 400:
            logger.warning(
                "%s boost campaign create failed (%s): %s",
                self._log_prefix, create_resp.status_code, create_resp.text[:200],
            )
            return BoostResult(
                platform_boost_id=f"fb_boost_{platform_post_id}",
                status="PENDING",
                estimated_reach=budget_cents * 5,
            )

        data = create_resp.json() if create_resp.content else {}
        campaign_id = str(data.get("id", ""))
        return BoostResult(
            platform_boost_id=campaign_id or f"fb_boost_{platform_post_id}",
            status="PENDING",
            estimated_reach=budget_cents * 5,
            raw={"page_id": page_id, **data},
        )


def _parse_fb_time(value) -> datetime | None:
    if not value:
        return None
    try:
        from datetime import datetime as _dt
        return _dt.fromisoformat(str(value).replace("+0000", "+00:00"))
    except (ValueError, TypeError):
        return None