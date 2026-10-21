from __future__ import annotations

import logging
from typing import Callable

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

logger = logging.getLogger("social.services")


__all__ = [
    "PlatformClient",
    "PublishResult",
    "MetricsResult",
    "CommentResult",
    "DirectMessageResult",
    "MentionResult",
    "DemographicResult",
    "BestTimeResult",
    "BoostResult",
    "PlatformError",
    "TokenExpiredError",
    "QuotaExceededError",
    "RateLimitError",
    "UnsupportedOperationError",
    "get_client",
    "registered_platforms",
    "platform_capabilities",
]


def _facebook_client():
    from .facebook import FacebookClient
    return FacebookClient


def _instagram_client():
    from .instagram import InstagramClient
    return InstagramClient


def _tiktok_client():
    from .tiktok import TikTokClient
    return TikTokClient


def _youtube_client():
    from .youtube import YouTubeClient
    return YouTubeClient


_REGISTRY: dict[str, Callable[[], type[PlatformClient]]] = {
    "FACEBOOK":  _facebook_client,
    "INSTAGRAM": _instagram_client,
    "TIKTOK":    _tiktok_client,
    "YOUTUBE":   _youtube_client,
}


def get_client(account) -> PlatformClient:
    platform = getattr(account, "platform", "") or ""
    code = platform.strip().upper()

    if not code:
        raise PlatformError("SocialAccount has no platform set.")

    factory = _REGISTRY.get(code)
    if factory is None:
        known = ", ".join(sorted(_REGISTRY))
        raise PlatformError(
            f"No client registered for platform {platform!r}. "
            f"Known platforms: {known}."
        )

    try:
        client_cls = factory()
    except PlatformError:
        raise
    except ImportError as exc:
        raise PlatformError(
            f"Could not import the {code} client — missing dependency? "
            f"({exc})"
        ) from exc

    return client_cls(account)


def registered_platforms() -> list[str]:
    return sorted(_REGISTRY.keys())


def platform_capabilities() -> dict[str, dict]:
    """
    Return a capability map for every registered platform.

    The frontend composer / inbox / analytics views use this to decide
    which actions to offer per channel without hard-coding the rules.
    """
    out: dict[str, dict] = {}
    for code in sorted(_REGISTRY):
        try:
            cls = _REGISTRY[code]()
        except Exception as exc:
            logger.warning("platform_capabilities: %s failed — %s", code, exc)
            continue
        out[code] = {
            "supports_comments":        getattr(cls, "SUPPORTS_COMMENTS", False),
            "supports_direct_messages": getattr(cls, "SUPPORTS_DIRECT_MESSAGES", False),
            "supports_mentions":        getattr(cls, "SUPPORTS_MENTIONS", False),
            "supports_demographics":    getattr(cls, "SUPPORTS_DEMOGRAPHICS", False),
            "supports_best_times":      getattr(cls, "SUPPORTS_BEST_TIMES", False),
            "supports_boost":           getattr(cls, "SUPPORTS_BOOST", False),
            "supports_delete_post":     getattr(cls, "SUPPORTS_DELETE_POST", False),
            "supports_edit_caption":    getattr(cls, "SUPPORTS_EDIT_CAPTION", False),
            "supports_first_comment":   getattr(cls, "SUPPORTS_FIRST_COMMENT", False),
            "supports_stories":         getattr(cls, "SUPPORTS_STORIES", False),
            "supports_reels":           getattr(cls, "SUPPORTS_REELS", False),
            "supports_shorts":          getattr(cls, "SUPPORTS_SHORTS", False),
            "supports_carousel":        getattr(cls, "SUPPORTS_CAROUSEL", False),
            "max_caption_length":       getattr(cls, "MAX_CAPTION_LENGTH", 0),
            "max_media_count":          getattr(cls, "MAX_MEDIA_COUNT", 1),
            "max_video_duration_sec":   getattr(cls, "MAX_VIDEO_DURATION_SEC", 0),
            "requires_video":           getattr(cls, "REQUIRES_VIDEO", False),
        }
    return out