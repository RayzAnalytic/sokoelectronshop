"""
Platform service layer.

Each module in this package exposes a `Client` class implementing the
`PlatformClient` interface declared in `base.py`. `get_client(account)`
returns the right client for a given `SocialAccount`.
"""
from __future__ import annotations

from .base import PlatformClient, PublishResult, MetricsResult, PlatformError

__all__ = [
    "PlatformClient",
    "PublishResult",
    "MetricsResult",
    "PlatformError",
    "get_client",
]


def get_client(account):
    """
    Return the PlatformClient for `account.platform`.
    Import is lazy so we don't pay for google-api-python-client etc. unless used.
    """
    from ..models import SocialPlatform

    platform = account.platform
    if platform == SocialPlatform.FACEBOOK:
        from .facebook import FacebookClient
        return FacebookClient(account)
    if platform == SocialPlatform.INSTAGRAM:
        from .instagram import InstagramClient
        return InstagramClient(account)
    if platform == SocialPlatform.TIKTOK:
        from .tiktok import TikTokClient
        return TikTokClient(account)
    if platform == SocialPlatform.YOUTUBE:
        from .youtube import YouTubeClient
        return YouTubeClient(account)
    if platform == SocialPlatform.X:
        from .x import XClient
        return XClient(account)

    raise PlatformError(f"No client registered for platform {platform!r}")