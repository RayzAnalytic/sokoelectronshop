"""
Google OAuth 2.0 / OpenID Connect helper.

Implements the Authorization Code flow for web server applications:
    1. build_authorize_url()  → redirect user to Google
    2. Google redirects back with ?code=...&state=...
    3. exchange_code()        → trade code for access token
    4. fetch_userinfo()       → fetch user profile (email, sub, name)

Reference:
    https://developers.google.com/identity/protocols/oauth2/web-server
"""

import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def new_state() -> str:
    """Random opaque string to prevent CSRF on the OAuth callback."""
    return secrets.token_urlsafe(32)


def build_authorize_url(state: str) -> str:
    """Build the URL the browser is redirected to for consent."""
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Exchange the authorization code for an access token."""
    r = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def fetch_userinfo(access_token: str) -> dict:
    """Fetch the user's profile using the access token."""
    r = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()