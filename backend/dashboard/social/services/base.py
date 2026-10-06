"""
Shared interface for all platform clients.

Every client must:
  • implement `publish(caption, media_paths, product_tag) -> PublishResult`
  • implement `fetch_metrics(platform_post_id) -> MetricsResult`
  • optionally implement `refresh_access_token()`
  • optionally implement `fetch_followers() -> int`

When `settings.SOCIAL_DRY_RUN` is True, `publish()` must NOT call the
platform's API — it should simulate success so the UI can be wired up
before OAuth credentials exist.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from django.conf import settings

logger = logging.getLogger("social.publish")


class PlatformError(Exception):
    """Raised when a platform API call fails unrecoverably."""


class TokenExpiredError(PlatformError):
    """Raised when the stored access token is expired and unrefreshable."""


class QuotaExceededError(PlatformError):
    """Raised on platform quota limits (esp. YouTube: 1,600 units/upload)."""


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


class PlatformClient:
    """
    Base class. Subclasses override `publish` and `fetch_metrics`.

    `self.account` is a `SocialAccount` instance. Tokens are decrypted
    transparently by `EncryptedTextField` — read `self.account.access_token`.
    """

    platform: str = ""

    def __init__(self, account):
        self.account = account

    # ── Required overrides ──────────────────────────────────────────────

    def publish(self, caption: str, media_paths: list[str], product_tag: str = "") -> PublishResult:
        raise NotImplementedError

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        raise NotImplementedError

    # ── Optional overrides ──────────────────────────────────────────────

    def refresh_access_token(self) -> None:
        """
        Refresh `self.account.access_token` in place and save.
        Default: no-op. Subclasses override when their platform supports it.
        """
        return None

    def fetch_followers(self) -> int:
        """Return the current follower count for the account."""
        return 0

    # ── Shared helpers ──────────────────────────────────────────────────

    @property
    def dry_run(self) -> bool:
        return bool(getattr(settings, "SOCIAL_DRY_RUN", True))

    def _require_connected(self):
        if not self.account.is_connected:
            raise PlatformError(f"{self.platform} account is not connected.")
        if not self.account.access_token:
            raise PlatformError(f"{self.platform} account has no access token.")

    def _log_dry_run(self, action: str, **kwargs):
        logger.info(
            "[DRY-RUN] %s %s account=%s payload=%s",
            self.platform, action, self.account.pk, kwargs,
        )