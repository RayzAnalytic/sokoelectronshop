from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("social.oauth")


STATE_SALT = "social-oauth-state"
STATE_MAX_AGE_SECONDS = 600
PKCE_SALT = "social-oauth-pkce"


class StateError(Exception):
    """Raised when an OAuth state payload is invalid, tampered, or expired."""


class PKCEError(Exception):
    """Raised when a PKCE verifier cannot be resolved or is malformed."""


_VALID_PLATFORMS: frozenset[str] = frozenset({
    "FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE", "X",
})


_AUTHORIZE_URLS: dict[str, str] = {
    "FACEBOOK":  "https://www.facebook.com/v21.0/dialog/oauth",
    "INSTAGRAM": "https://www.facebook.com/v21.0/dialog/oauth",
    "TIKTOK":    "https://www.tiktok.com/v2/auth/authorize/",
    "YOUTUBE":   "https://accounts.google.com/o/oauth2/v2/auth",
    "X":         "https://twitter.com/i/oauth2/authorize",
}


_DEFAULT_SCOPES: dict[str, list[str]] = {
    "FACEBOOK": [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_manage_engagement",
        "pages_read_user_content",
        "read_insights",
        "business_management",
    ],
    "INSTAGRAM": [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
    ],
    "TIKTOK": [
        "user.info.basic",
        "user.info.profile",
        "video.publish",
        "video.list",
        "video.upload",
    ],
    "YOUTUBE": [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
    "X": [
        "tweet.read",
        "tweet.write",
        "users.read",
        "offline.access",
    ],
}


def _canonical_platform(platform: str) -> str:
    if not platform:
        raise StateError("Platform is required.")
    code = platform.strip().upper()
    if code not in _VALID_PLATFORMS:
        raise StateError(f"Unknown platform {platform!r}.")
    return code


def build_state(
    platform: str,
    user_id: int,
    *,
    extra: dict | None = None,
    code_verifier: str = "",
) -> str:
    payload: dict[str, Any] = {
        "platform": _canonical_platform(platform),
        "user_id": int(user_id),
        "nonce": secrets.token_urlsafe(12),
        "iat": int(timezone.now().timestamp()),
    }
    if extra:
        payload["extra"] = extra
    if code_verifier:
        payload["cv"] = code_verifier
    return signing.dumps(payload, salt=STATE_SALT, compress=True)


def parse_state(state: str) -> dict:
    if not state:
        raise StateError("Missing OAuth state.")
    try:
        payload = signing.loads(
            state,
            salt=STATE_SALT,
            max_age=STATE_MAX_AGE_SECONDS,
        )
    except signing.SignatureExpired as exc:
        raise StateError("OAuth state has expired. Please try connecting again.") from exc
    except signing.BadSignature as exc:
        raise StateError("OAuth state is invalid (bad signature).") from exc

    if not isinstance(payload, dict):
        raise StateError("OAuth state payload is malformed.")

    payload["platform"] = _canonical_platform(payload.get("platform", ""))
    return payload


_PLATFORM_REDIRECT_SETTINGS: dict[str, str] = {
    "FACEBOOK":  "FACEBOOK_REDIRECT_URI",
    "INSTAGRAM": "INSTAGRAM_REDIRECT_URI",
    "TIKTOK":    "TIKTOK_REDIRECT_URI",
    "YOUTUBE":   "YOUTUBE_REDIRECT_URI",
    "X":         "X_REDIRECT_URI",
}


_PLATFORM_CLIENT_ID_SETTINGS: dict[str, str] = {
    "FACEBOOK":  "META_APP_ID",
    "INSTAGRAM": "META_APP_ID",
    "TIKTOK":    "TIKTOK_CLIENT_KEY",
    "YOUTUBE":   "GOOGLE_CLIENT_ID",
    "X":         "X_CLIENT_ID",
}


_PLATFORM_CLIENT_SECRET_SETTINGS: dict[str, str] = {
    "FACEBOOK":  "META_APP_SECRET",
    "INSTAGRAM": "META_APP_SECRET",
    "TIKTOK":    "TIKTOK_CLIENT_SECRET",
    "YOUTUBE":   "GOOGLE_CLIENT_SECRET",
    "X":         "X_CLIENT_SECRET",
}


def redirect_uri(platform: str) -> str:
    code = _canonical_platform(platform)
    platform_lc = code.lower()

    setting_name = _PLATFORM_REDIRECT_SETTINGS.get(code)
    if setting_name:
        override = getattr(settings, setting_name, "")
        if override:
            return override

    redirects = getattr(settings, "SOCIAL_OAUTH_REDIRECTS", {}) or {}
    if code in redirects and redirects[code]:
        return redirects[code]
    if platform_lc in redirects and redirects[platform_lc]:
        return redirects[platform_lc]

    base = getattr(settings, "SOCIAL_OAUTH_REDIRECT_BASE", "").rstrip("/")
    if not base:
        raise StateError(
            "SOCIAL_OAUTH_REDIRECT_BASE is not set and no per-platform "
            "redirect URI was provided."
        )
    return f"{base}/api/v1/social/oauth/{platform_lc}/callback/"


def client_credentials(platform: str) -> tuple[str, str]:
    code = _canonical_platform(platform)
    id_name = _PLATFORM_CLIENT_ID_SETTINGS.get(code, "")
    secret_name = _PLATFORM_CLIENT_SECRET_SETTINGS.get(code, "")
    client_id = getattr(settings, id_name, "") if id_name else ""
    client_secret = getattr(settings, secret_name, "") if secret_name else ""
    return client_id, client_secret


def default_scopes(platform: str) -> list[str]:
    code = _canonical_platform(platform)
    return list(_DEFAULT_SCOPES.get(code, []))


def _b64url_no_pad(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def generate_pkce_pair() -> tuple[str, str]:
    verifier = _b64url_no_pad(secrets.token_bytes(64))
    challenge = _b64url_no_pad(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def build_authorize_url(
    platform: str,
    *,
    state: str,
    code_challenge: str = "",
    scopes: list[str] | None = None,
    extra_params: dict | None = None,
) -> str:
    code = _canonical_platform(platform)
    client_id, _ = client_credentials(code)
    if not client_id:
        raise StateError(
            f"Missing client id for {code}. Set the corresponding "
            f"settings variable."
        )

    base = _AUTHORIZE_URLS.get(code)
    if not base:
        raise StateError(f"No authorize endpoint configured for {code}.")

    params: dict[str, str] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri(code),
        "state": state,
        "response_type": "code",
    }

    scope_list = scopes if scopes is not None else default_scopes(code)
    if scope_list:
        params["scope"] = " ".join(scope_list)

    if code_verifier := code_challenge:
        params["code_challenge"] = code_verifier
        params["code_challenge_method"] = "S256"

    if code == "FACEBOOK" or code == "INSTAGRAM":
        params["auth_type"] = "rerequest"

    if extra_params:
        for key, value in extra_params.items():
            if value is not None and value != "":
                params[str(key)] = str(value)

    return f"{base}?{urlencode(params)}"


def upsert_account(
    platform: str,
    *,
    handle: str = "",
    display_name: str = "",
    platform_user_id: str = "",
    access_token: str = "",
    refresh_token: str = "",
    expires_at=None,
    scopes: list[str] | None = None,
    followers: int | None = None,
    avatar_url: str = "",
    metadata: dict | None = None,
):
    from ..models import SocialAccount

    code = _canonical_platform(platform)

    with transaction.atomic():
        account, created = SocialAccount.objects.select_for_update().get_or_create(
            platform=code,
        )

        if handle:
            account.handle = handle
        if display_name:
            account.display_name = display_name
        if platform_user_id:
            account.platform_user_id = platform_user_id
        if access_token:
            account.access_token = access_token
        if refresh_token:
            account.refresh_token = refresh_token
        if expires_at is not None:
            account.token_expires_at = expires_at
        if scopes is not None:
            account.scopes = list(scopes)
        if followers is not None:
            account.followers = int(followers)
        if avatar_url:
            account.avatar_url = avatar_url
        if metadata:
            account.metadata = {**(account.metadata or {}), **metadata}

        account.is_connected = True
        account.connected_at = timezone.now()
        account.last_synced_at = timezone.now()
        account.last_error = ""
        account.save()

    logger.info(
        "%s account %s for %s (%s) scopes=%s",
        "Created" if created else "Updated",
        code,
        account.handle or account.platform_user_id or "no handle",
        account.pk,
        account.scopes,
    )
    return account


def disconnect_account(platform: str):
    from ..models import SocialAccount

    code = _canonical_platform(platform)
    try:
        account = SocialAccount.objects.get(platform=code)
    except SocialAccount.DoesNotExist:
        logger.info("disconnect_account: %s has no account row (no-op)", code)
        return None

    account.is_connected = False
    account.handle = ""
    account.access_token = ""
    account.refresh_token = ""
    account.token_expires_at = None
    account.scopes = []
    account.avatar_url = ""
    account.last_error = ""
    account.save(update_fields=[
        "is_connected", "handle",
        "access_token", "refresh_token", "token_expires_at",
        "scopes", "avatar_url",
        "last_error", "updated_at",
    ])
    logger.info("Disconnected %s account %s", code, account.pk)
    return account


def mark_token_error(platform: str, message: str):
    from ..models import SocialAccount

    code = _canonical_platform(platform)
    try:
        account = SocialAccount.objects.get(platform=code)
    except SocialAccount.DoesNotExist:
        logger.info("mark_token_error: %s has no account row (no-op)", code)
        return None

    account.last_error = str(message)[:2000]
    account.save(update_fields=["last_error", "updated_at"])
    logger.warning("Stamped token error on %s account %s: %s", code, account.pk, message)
    return account


def clear_token_error(platform: str):
    from ..models import SocialAccount

    code = _canonical_platform(platform)
    try:
        account = SocialAccount.objects.get(platform=code)
    except SocialAccount.DoesNotExist:
        return None

    if not account.last_error:
        return account
    account.last_error = ""
    account.save(update_fields=["last_error", "updated_at"])
    return account


def touch_last_synced(platform: str):
    from ..models import SocialAccount

    code = _canonical_platform(platform)
    try:
        account = SocialAccount.objects.get(platform=code)
    except SocialAccount.DoesNotExist:
        return None

    account.last_synced_at = timezone.now()
    account.save(update_fields=["last_synced_at", "updated_at"])
    return account


__all__ = [
    "STATE_SALT",
    "STATE_MAX_AGE_SECONDS",
    "PKCE_SALT",
    "StateError",
    "PKCEError",
    "build_state",
    "parse_state",
    "redirect_uri",
    "client_credentials",
    "default_scopes",
    "generate_pkce_pair",
    "build_authorize_url",
    "upsert_account",
    "disconnect_account",
    "mark_token_error",
    "clear_token_error",
    "touch_last_synced",
]