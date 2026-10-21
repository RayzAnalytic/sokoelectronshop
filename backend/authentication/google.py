# authentication/google.py
"""
Google OAuth utility module.

No views here — the HTTP layer lives in authentication/views.py
(GoogleStartView, GoogleCallbackView).

This module owns:
    - Settings access (client id / secret / redirect_uri)
    - Signed state generation & verification (no session dependency)
    - Google authorize URL construction
    - Authorization code exchange
    - Userinfo fetch
    - URL & payload normalization helpers
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import urlencode

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.http import HttpResponseRedirect

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Google endpoints
# ─────────────────────────────────────────────────────────────────────────────
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"


# ─────────────────────────────────────────────────────────────────────────────
# Frontend paths
# ─────────────────────────────────────────────────────────────────────────────
FRONTEND_LOGIN_PATH = "/auth/login"
FRONTEND_CALLBACK_PATH = "/auth/callback"


# ─────────────────────────────────────────────────────────────────────────────
# Signed state — self-contained, no session dependency.
# Format: <next_path>:<timestamp>:<signature>
# Default max age: 10 minutes.
# ─────────────────────────────────────────────────────────────────────────────
_STATE_SIGNER = TimestampSigner(salt="authentication.google.oauth.state")
_STATE_MAX_AGE = 600


# ─────────────────────────────────────────────────────────────────────────────
# Settings helpers
# ─────────────────────────────────────────────────────────────────────────────
def _client_id() -> str:
    cid = (
        getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", None)
        or getattr(settings, "GOOGLE_CLIENT_ID", "")
        or ""
    )
    if not cid:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured.")
    return cid


def _client_secret() -> str:
    sec = (
        getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", None)
        or getattr(settings, "GOOGLE_CLIENT_SECRET", "")
        or ""
    )
    if not sec:
        raise RuntimeError("GOOGLE_CLIENT_SECRET is not configured.")
    return sec


def _redirect_uri() -> str:
    uri = getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "") or ""
    if not uri:
        raise RuntimeError("GOOGLE_OAUTH_REDIRECT_URI is not configured.")
    return uri


# ─────────────────────────────────────────────────────────────────────────────
# Signed state — survives session loss
# ─────────────────────────────────────────────────────────────────────────────
def new_state(next_path: str = "/") -> str:
    """
    Return a signed, tamper-proof state token that embeds the `next` path.

    Google echoes this back in ?state=... on the callback. We verify it
    server-side without touching request.session, so the flow works even
    if the browser drops the session cookie between requests.
    """
    if not next_path:
        next_path = "/"
    return _STATE_SIGNER.sign(next_path)


def read_state(state: str, max_age: int = _STATE_MAX_AGE) -> str | None:
    """
    Verify a signed state token and return its embedded next_path.

    Returns None if the token is missing, tampered with, or older than
    `max_age` seconds.
    """
    if not state:
        return None
    try:
        value = _STATE_SIGNER.unsign(state, max_age=max_age)
    except SignatureExpired:
        logger.info("Google OAuth state expired")
        return None
    except BadSignature:
        logger.warning("Google OAuth state signature invalid")
        return None
    return value or "/"


# ─────────────────────────────────────────────────────────────────────────────
# Google endpoints
# ─────────────────────────────────────────────────────────────────────────────
def build_authorize_url(state: str) -> str:
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


def exchange_code(code: str) -> dict:
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "redirect_uri": _redirect_uri(),
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(detail)
            msg = (
                payload.get("error_description")
                or payload.get("error")
                or detail
            )
        except json.JSONDecodeError:
            msg = detail
        raise RuntimeError(f"Google token exchange failed: {msg}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Could not reach Google token endpoint: {exc.reason}"
        ) from exc


def fetch_userinfo(access_token: str) -> dict:
    req = urllib.request.Request(
        GOOGLE_USERINFO_ENDPOINT,
        method="GET",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Google userinfo fetch failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Could not reach Google userinfo endpoint: {exc.reason}"
        ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# URL helpers
# ─────────────────────────────────────────────────────────────────────────────
def _frontend_url(path: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def _redirect_error(code: str) -> HttpResponseRedirect:
    return HttpResponseRedirect(
        _frontend_url(
            f"{FRONTEND_LOGIN_PATH}?{urlencode({'error': code})}"
        )
    )


def _safe_next(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if not raw.startswith("/") or raw.startswith("//") or "://" in raw:
        return None
    return raw


def _normalize_userinfo(raw: dict) -> dict:
    return {
        "sub": str(raw.get("sub") or ""),
        "email": (raw.get("email") or "").strip().lower(),
        "email_verified": bool(raw.get("email_verified")),
        "given_name": raw.get("given_name") or "",
        "family_name": raw.get("family_name") or "",
        "picture": raw.get("picture") or "",
    }