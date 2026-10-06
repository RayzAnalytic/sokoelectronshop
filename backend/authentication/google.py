# authentication/google.py
"""
Google OAuth 2.0 helpers.

Four public functions, matching what `authentication/views.py` imports:

    build_authorize_url(state)   → str
    new_state()                  → str
    exchange_code(code)          → dict  (token payload)
    fetch_userinfo(access_token) → dict  (user profile)

Uses only the stdlib (urllib) so there's no extra dependency to install.
Swap in `requests` if it's already in your requirements.
"""

from __future__ import annotations

import json
import secrets
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings


GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"


def _client_id() -> str:
    cid = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or ""
    if not cid:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID is not configured.")
    return cid


def _client_secret() -> str:
    sec = getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or ""
    if not sec:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_SECRET is not configured.")
    return sec


def _redirect_uri() -> str:
    uri = getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "") or ""
    if not uri:
        raise RuntimeError("GOOGLE_OAUTH_REDIRECT_URI is not configured.")
    return uri


def new_state() -> str:
    """Return a URL-safe random string to embed as the `state` param."""
    return secrets.token_urlsafe(32)


def build_authorize_url(state: str) -> str:
    """Compose the Google consent-screen URL."""
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
    """POST the authorization code to Google's token endpoint."""
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
            msg = payload.get("error_description") or payload.get("error") or detail
        except json.JSONDecodeError:
            msg = detail
        raise RuntimeError(f"Google token exchange failed: {msg}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Google token endpoint: {exc.reason}") from exc


def fetch_userinfo(access_token: str) -> dict:
    """GET the OpenID Connect userinfo endpoint."""
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
        raise RuntimeError(f"Could not reach Google userinfo endpoint: {exc.reason}") from exc