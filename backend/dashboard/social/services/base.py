from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from django.conf import settings

logger = logging.getLogger("social.publish")


class PlatformError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, response: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class TokenExpiredError(PlatformError):
    pass


class QuotaExceededError(PlatformError):
    def __init__(self, message: str, *, retry_after_seconds: int | None = None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class RateLimitError(PlatformError):
    def __init__(self, message: str, *, retry_after_seconds: int = 60):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class UnsupportedOperationError(PlatformError):
    pass


@dataclass
class PublishResult:
    platform_post_id: str
    platform_url: str = ""
    raw: dict = field(default_factory=dict)


@dataclass
class MetricsResult:
    likes: int = 0
    comments: int = 0
    shares: int = 0
    reach: int = 0
    impressions: int = 0
    saves: int = 0
    video_views: int = 0
    watch_time_sec: int = 0
    link_clicks: int = 0
    profile_visits: int = 0
    follower_delta: int = 0
    raw: dict = field(default_factory=dict)


@dataclass
class CommentResult:
    platform_comment_id: str
    author_name: str = ""
    author_handle: str = ""
    author_avatar: str = ""
    body: str = ""
    permalink: str = ""
    parent_id: str = ""
    received_at: datetime | None = None
    raw: dict = field(default_factory=dict)


@dataclass
class DirectMessageResult:
    platform_message_id: str
    author_name: str = ""
    author_handle: str = ""
    author_avatar: str = ""
    body: str = ""
    received_at: datetime | None = None
    raw: dict = field(default_factory=dict)


@dataclass
class MentionResult:
    platform_mention_id: str
    author_name: str = ""
    author_handle: str = ""
    author_avatar: str = ""
    body: str = ""
    permalink: str = ""
    received_at: datetime | None = None
    raw: dict = field(default_factory=dict)


@dataclass
class DemographicResult:
    age_buckets: dict = field(default_factory=dict)
    gender: dict = field(default_factory=dict)
    top_cities: list = field(default_factory=list)
    top_countries: list = field(default_factory=list)
    raw: dict = field(default_factory=dict)


@dataclass
class BestTimeResult:
    day_of_week: int
    hour: int
    score: float
    sample_size: int = 0


@dataclass
class BoostResult:
    platform_boost_id: str
    status: str = "PENDING"
    estimated_reach: int = 0
    raw: dict = field(default_factory=dict)


class PlatformClient:
    platform: str = ""
    request_timeout: int = 30

    SUPPORTS_COMMENTS: bool = False
    SUPPORTS_DIRECT_MESSAGES: bool = False
    SUPPORTS_MENTIONS: bool = False
    SUPPORTS_DEMOGRAPHICS: bool = False
    SUPPORTS_BEST_TIMES: bool = False
    SUPPORTS_BOOST: bool = False
    SUPPORTS_DELETE_POST: bool = False
    SUPPORTS_EDIT_CAPTION: bool = False
    SUPPORTS_FIRST_COMMENT: bool = False
    SUPPORTS_STORIES: bool = False
    SUPPORTS_REELS: bool = False
    SUPPORTS_SHORTS: bool = False
    SUPPORTS_CAROUSEL: bool = False

    MAX_CAPTION_LENGTH: int = 5_000
    MAX_MEDIA_COUNT: int = 1
    MAX_VIDEO_DURATION_SEC: int = 0
    REQUIRES_VIDEO: bool = False

    def __init__(self, account):
        if not self.platform:
            raise RuntimeError(
                f"{type(self).__name__} must define a `platform` class attribute."
            )
        self.account = account
        self._log_prefix = f"[{self.platform} account={account.pk}]"

    def publish(
        self,
        caption: str,
        media_paths: list[str],
        product_tag: str = "",
        first_comment: str = "",
        options: dict | None = None,
    ) -> PublishResult:
        raise NotImplementedError(
            f"{type(self).__name__}.publish() is not implemented."
        )

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        raise NotImplementedError(
            f"{type(self).__name__}.fetch_metrics() is not implemented."
        )

    def refresh_access_token(self) -> datetime | None:
        return None

    def fetch_followers(self) -> int:
        return 0

    def fetch_comments(self, platform_post_id: str, since: datetime | None = None) -> list[CommentResult]:
        if not self.SUPPORTS_COMMENTS:
            raise UnsupportedOperationError(
                f"{self.platform} does not support fetching comments."
            )
        return []

    def reply_to_comment(self, platform_comment_id: str, body: str) -> CommentResult:
        if not self.SUPPORTS_COMMENTS:
            raise UnsupportedOperationError(
                f"{self.platform} does not support replying to comments."
            )
        raise NotImplementedError(
            f"{type(self).__name__}.reply_to_comment() is not implemented."
        )

    def delete_comment(self, platform_comment_id: str) -> None:
        if not self.SUPPORTS_COMMENTS:
            raise UnsupportedOperationError(
                f"{self.platform} does not support deleting comments."
            )
        raise NotImplementedError(
            f"{type(self).__name__}.delete_comment() is not implemented."
        )

    def hide_comment(self, platform_comment_id: str, hidden: bool = True) -> None:
        if not self.SUPPORTS_COMMENTS:
            raise UnsupportedOperationError(
                f"{self.platform} does not support hiding comments."
            )
        raise NotImplementedError(
            f"{type(self).__name__}.hide_comment() is not implemented."
        )

    def fetch_direct_messages(self, since: datetime | None = None) -> list[DirectMessageResult]:
        if not self.SUPPORTS_DIRECT_MESSAGES:
            raise UnsupportedOperationError(
                f"{self.platform} does not support direct messages."
            )
        return []

    def reply_to_direct_message(self, platform_message_id: str, body: str) -> DirectMessageResult:
        if not self.SUPPORTS_DIRECT_MESSAGES:
            raise UnsupportedOperationError(
                f"{self.platform} does not support direct messages."
            )
        raise NotImplementedError(
            f"{type(self).__name__}.reply_to_direct_message() is not implemented."
        )

    def fetch_mentions(self, since: datetime | None = None) -> list[MentionResult]:
        if not self.SUPPORTS_MENTIONS:
            raise UnsupportedOperationError(
                f"{self.platform} does not support fetching mentions."
            )
        return []

    def fetch_demographics(self) -> DemographicResult:
        if not self.SUPPORTS_DEMOGRAPHICS:
            raise UnsupportedOperationError(
                f"{self.platform} does not support demographics."
            )
        return DemographicResult()

    def fetch_best_times(self) -> list[BestTimeResult]:
        if not self.SUPPORTS_BEST_TIMES:
            raise UnsupportedOperationError(
                f"{self.platform} does not support best-time data."
            )
        return []

    def delete_post(self, platform_post_id: str) -> None:
        if not self.SUPPORTS_DELETE_POST:
            raise UnsupportedOperationError(
                f"{self.platform} does not support deleting posts."
            )
        raise NotImplementedError(
            f"{type(self).__name__}.delete_post() is not implemented."
        )

    def edit_caption(self, platform_post_id: str, caption: str) -> None:
        if not self.SUPPORTS_EDIT_CAPTION:
            raise UnsupportedOperationError(
                f"{self.platform} does not support editing published posts."
            )
        raise NotImplementedError(
            f"{type(self).__name__}.edit_caption() is not implemented."
        )

    def boost_post(
        self,
        platform_post_id: str,
        budget_cents: int,
        duration_days: int,
        audience: dict | None = None,
    ) -> BoostResult:
        if not self.SUPPORTS_BOOST:
            raise UnsupportedOperationError(
                f"{self.platform} does not support boosting."
            )
        if self.dry_run:
            self._log_dry_run(
                "boost",
                platform_post_id=platform_post_id,
                budget_cents=budget_cents,
                duration_days=duration_days,
            )
            return BoostResult(
                platform_boost_id=f"dryrun_boost_{random.randint(1_000_000, 9_999_999)}",
                status="PENDING",
                estimated_reach=budget_cents * random.randint(3, 8),
            )
        raise NotImplementedError(
            f"{type(self).__name__}.boost_post() is not implemented."
        )

    @property
    def dry_run(self) -> bool:
        return bool(getattr(settings, "SOCIAL_DRY_RUN", True))

    def _simulate_publish(self, caption: str, media_paths: list[str]) -> PublishResult:
        slug = self.platform.lower()
        fake_id = f"dryrun_{slug}_{random.randint(1_000_000, 9_999_999)}"
        url_templates = {
            "FACEBOOK":  "https://facebook.com/permalink/{id}",
            "INSTAGRAM": "https://instagram.com/p/{id}",
            "TIKTOK":    "https://tiktok.com/@dryrun/video/{id}",
            "YOUTUBE":   "https://youtube.com/watch?v={id}",
            "X":         "https://x.com/i/status/{id}",
        }
        url = url_templates.get(self.platform, "https://example.com/{id}").format(
            id=fake_id
        )
        logger.info(
            "%s [DRY-RUN] publish caption_len=%s media=%s → %s",
            self._log_prefix, len(caption), len(media_paths), fake_id,
        )
        return PublishResult(
            platform_post_id=fake_id,
            platform_url=url,
            raw={"dry_run": True},
        )

    def _simulate_metrics(self) -> MetricsResult:
        reach = random.randint(500, 25_000)
        video_views = reach if random.random() > 0.5 else 0
        return MetricsResult(
            likes=random.randint(20, max(50, reach // 20)),
            comments=random.randint(0, max(10, reach // 200)),
            shares=random.randint(0, max(5, reach // 500)),
            reach=reach,
            impressions=int(reach * random.uniform(1.05, 1.4)),
            saves=random.randint(0, max(5, reach // 400)),
            video_views=video_views,
            watch_time_sec=video_views * random.randint(3, 25),
            link_clicks=random.randint(0, max(10, reach // 300)),
            profile_visits=random.randint(0, max(20, reach // 150)),
            follower_delta=random.randint(-5, max(5, reach // 800)),
            raw={"dry_run": True},
        )

    def _simulate_comment(self, platform_comment_id: str | None = None) -> CommentResult:
        cid = platform_comment_id or f"dryrun_cmt_{random.randint(1_000_000, 9_999_999)}"
        return CommentResult(
            platform_comment_id=cid,
            author_name=f"user_{random.randint(1000, 9999)}",
            author_handle=f"@dryrun_{random.randint(100, 999)}",
            body="Dry-run comment body",
            permalink=f"https://example.com/comment/{cid}",
            received_at=datetime.utcnow(),
            raw={"dry_run": True},
        )

    def _simulate_dm(self, platform_message_id: str | None = None) -> DirectMessageResult:
        mid = platform_message_id or f"dryrun_dm_{random.randint(1_000_000, 9_999_999)}"
        return DirectMessageResult(
            platform_message_id=mid,
            author_name=f"user_{random.randint(1000, 9999)}",
            author_handle=f"@dryrun_{random.randint(100, 999)}",
            body="Dry-run DM body",
            received_at=datetime.utcnow(),
            raw={"dry_run": True},
        )

    def _simulate_demographics(self) -> DemographicResult:
        return DemographicResult(
            age_buckets={
                "13-17": random.randint(1, 5),
                "18-24": random.randint(20, 35),
                "25-34": random.randint(25, 40),
                "35-44": random.randint(10, 20),
                "45-54": random.randint(5, 12),
                "55+":   random.randint(2, 8),
            },
            gender={"female": random.randint(40, 60), "male": random.randint(30, 50)},
            top_cities=[
                {"name": "Nairobi", "count": random.randint(2000, 8000)},
                {"name": "Mombasa", "count": random.randint(500, 2500)},
                {"name": "Kisumu",  "count": random.randint(200, 1200)},
            ],
            top_countries=[
                {"code": "KE", "name": "Kenya",  "count": random.randint(5000, 20000)},
                {"code": "UG", "name": "Uganda", "count": random.randint(300, 1500)},
                {"code": "TZ", "name": "Tanzania", "count": random.randint(200, 1200)},
            ],
            raw={"dry_run": True},
        )

    def _simulate_best_times(self) -> list[BestTimeResult]:
        out: list[BestTimeResult] = []
        for day in range(7):
            for hour in range(24):
                if hour in (7, 8, 12, 13, 18, 19, 20, 21):
                    out.append(
                        BestTimeResult(
                            day_of_week=day,
                            hour=hour,
                            score=random.uniform(0.4, 1.0),
                            sample_size=random.randint(10, 200),
                        )
                    )
        return out

    def _require_connected(self) -> None:
        if not self.account.is_connected:
            raise PlatformError(f"{self.platform} account is not connected.")
        if not self.account.access_token:
            raise PlatformError(f"{self.platform} account has no access token.")

    def _require_fresh_token(self) -> None:
        if self.account.is_token_expired:
            raise TokenExpiredError(
                f"{self.platform} access token expired at "
                f"{self.account.token_expires_at.isoformat() if self.account.token_expires_at else 'unknown'}. "
                f"Reconnect the account."
            )

    def _require_supported(self, capability: str) -> None:
        flag = f"SUPPORTS_{capability}"
        if not getattr(self, flag, False):
            raise UnsupportedOperationError(
                f"{self.platform} does not support {capability.lower().replace('_', ' ')}."
            )

    def _log_dry_run(self, action: str, **kwargs: Any) -> None:
        logger.info(
            "%s [DRY-RUN] %s payload=%s",
            self._log_prefix, action, kwargs,
        )

    def _parse_json(self, response, *, context: str = "") -> dict:
        try:
            data = response.json()
        except ValueError as exc:
            snippet = (getattr(response, "text", "") or "")[:200]
            raise PlatformError(
                f"{self.platform} {context or 'response'} was not JSON "
                f"(status={getattr(response, 'status_code', '?')}): {snippet!r}"
            ) from exc
        if not isinstance(data, dict):
            raise PlatformError(
                f"{self.platform} {context or 'response'} returned unexpected "
                f"payload type {type(data).__name__}."
            )
        return data

    def __repr__(self) -> str:
        return f"<{type(self).__name__} account={self.account.pk} platform={self.platform}>"


__all__ = [
    "PlatformError",
    "TokenExpiredError",
    "QuotaExceededError",
    "RateLimitError",
    "UnsupportedOperationError",
    "PublishResult",
    "MetricsResult",
    "CommentResult",
    "DirectMessageResult",
    "MentionResult",
    "DemographicResult",
    "BestTimeResult",
    "BoostResult",
    "PlatformClient",
]
      