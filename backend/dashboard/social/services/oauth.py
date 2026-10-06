"""
Shared helpers for OAuth flows — state signing, callback URL building,
and token persistence into `SocialAccount`.
"""
from __future__ import annotations

import secrets

from django.conf import settings
from django.core import signing
from django.utils import timezone


STATE_SALT = "social-oauth-state"
STATE_MAX_AGE_SECONDS = 600  # 10 minutes


def build_state(platform: str, user_id: int) -> str:
    """Signed, tamper-proof OAuth state value."""
    payload = {"platform": platform, "user_id": user_id, "nonce": secrets.token_urlsafe(8)}
    return signing.dumps(payload, salt=STATE_SALT)


def parse_state(state: str) -> dict:
    """Validate and decode an OAuth state. Raises `BadSignature` if tampered."""
    return signing.loads(state, salt=STATE_SALT, max_age=STATE_MAX_AGE_SECONDS)


def redirect_uri(platform: str) -> str:
    """
    Full callback URL the platform should redirect to.

    Prefers the per-platform override (`YOUTUBE_REDIRECT_URI`, `X_REDIRECT_URI`)
    and falls back to `SOCIAL_OAUTH_REDIRECTS[platform]`, which itself is
    built from `SOCIAL_OAUTH_REDIRECT_BASE`.
    """
    redirects = getattr(settings, "SOCIAL_OAUTH_REDIRECTS", {})
    if platform in redirects and redirects[platform]:
        return redirects[platform]
    base = getattr(settings, "SOCIAL_OAUTH_REDIRECT_BASE", "").rstrip("/")
    return f"{base}/api/v1/social/oauth/{platform.lower()}/callback/"


def upsert_account(platform: str, *, handle: str = "", display_name: str = "",
                   platform_user_id: str = "", access_token: str = "",
                   refresh_token: str = "", expires_at=None, metadata: dict | None = None):
    """
    Create or update a `SocialAccount` in a way that never wipes a stored
    refresh token with an empty value (Google only returns it once).
    """
    from ..models import SocialAccount

    account, _ = SocialAccount.objects.get_or_create(platform=platform)
    if handle:
        account.handle = handle
    if display_name:
        account.display_name = display_name
    if platform_user_id:
        account.platform_user_id = platform_user_id
    if access_token:
        account.access_token = access_token
    if refresh_token:                       # ← guarded on purpose
        account.refresh_token = refresh_token
    if expires_at is not None:
        account.token_expires_at = expires_at
    if metadata:
        merged = {**(account.metadata or {}), **metadata}
        account.metadata = merged
    account.is_connected = True
    account.connected_at = timezone.now()
    account.last_error = ""
    account.save()
    return account