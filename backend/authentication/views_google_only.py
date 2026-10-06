"""
Views for the Google OAuth 2.0 / OpenID Connect login flow.

Two endpoints:

    GET /api/v1/auth/google/           → redirects to Google
    GET /api/v1/auth/google/callback/  → receives code + state, logs user in

The state and `next` parameter both live in the Django session for the
duration of the round-trip — they are NEVER sent to Google, so the
browser cannot tamper with them.

On success, the view redirects the browser to:

    {FRONTEND_URL}{next || user.redirect_path}

On failure, the view redirects to:

    {FRONTEND_URL}/auth/login?error=<code>

where <code> is one of: google, state, code, exchange, email, admin_email.
The frontend maps each to a friendly message.
"""

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import login
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.views import View

from . import google
from .models import Role, Status, User

logger = logging.getLogger(__name__)

SESSION_STATE_KEY = "google_oauth_state"
SESSION_NEXT_KEY = "google_oauth_next"

FRONTEND_LOGIN_PATH = "/auth/login"


# ══════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════

def _frontend_url(path: str) -> str:
    """Join FRONTEND_URL and a path with exactly one slash between them."""
    base = settings.FRONTEND_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def _redirect_error(code: str) -> HttpResponseRedirect:
    """Redirect to the login page with an error code the FE understands."""
    return HttpResponseRedirect(
        _frontend_url(f"{FRONTEND_LOGIN_PATH}?{urlencode({'error': code})}")
    )


def _safe_next(raw: str | None) -> str | None:
    """
    Whitelist the `next` parameter so it can't be used as an open redirect.

    Only allow paths that start with a single `/` and contain no `://`.
    Anything else is discarded — the caller falls back to
    `user.redirect_path`.
    """
    if not raw:
        return None
    raw = raw.strip()
    if not raw.startswith("/") or raw.startswith("//") or "://" in raw:
        return None
    return raw


def _normalize_userinfo(raw: dict) -> dict:
    """
    Normalize the raw Google userinfo payload before the view touches it.

    Guarantees:
        - `email` is lowercased and stripped.
        - `email_verified` is a real Python bool.
        - `sub` is always a non-empty string.
        - `given_name` / `family_name` are always strings.
    """
    return {
        "sub": str(raw.get("sub") or ""),
        "email": (raw.get("email") or "").strip().lower(),
        "email_verified": bool(raw.get("email_verified")),
        "given_name": raw.get("given_name") or "",
        "family_name": raw.get("family_name") or "",
        "picture": raw.get("picture") or "",
    }


# ══════════════════════════════════════════════════════════════════════════
# View 1 — Entry point: redirect the browser to Google
# ══════════════════════════════════════════════════════════════════════════

class GoogleLoginView(View):
    """
    Kick off the OAuth flow.

    Steps:
        1. Generate a CSRF state and store it on the session.
        2. Store the `?next=` parameter on the session (sanitized).
        3. Redirect the browser to Google's consent screen.
    """

    def get(self, request):
        state = google.new_state()
        request.session[SESSION_STATE_KEY] = state

        next_path = _safe_next(request.GET.get("next"))
        if next_path:
            request.session[SESSION_NEXT_KEY] = next_path
        else:
            request.session.pop(SESSION_NEXT_KEY, None)

        authorize_url = google.build_authorize_url(state)
        return HttpResponseRedirect(authorize_url)


# ══════════════════════════════════════════════════════════════════════════
# View 2 — Callback: Google redirects here with ?code=...&state=...
# ══════════════════════════════════════════════════════════════════════════

class GoogleCallbackView(View):
    """
    Handle Google's redirect back to us.

    Order of validation:
        1. state match             (cheap, session lookup)
        2. code present            (cheap, query param)
        3. exchange code           (network)
        4. fetch userinfo          (network)
        5. email_verified check    (cheap, dict lookup)
        6. match or create user    (DB)
        7. session login           (cheap)
        8. redirect to FE
    """

    def get(self, request):
        # ── 1. Validate state (CSRF protection) ──────────────────────
        expected_state = request.session.pop(SESSION_STATE_KEY, None)
        received_state = request.GET.get("state")

        if not expected_state or not received_state:
            return _redirect_error("state")
        if expected_state != received_state:
            logger.warning(
                "Google OAuth state mismatch: expected=%r received=%r",
                expected_state, received_state,
            )
            return _redirect_error("state")

        # ── 2. Handle "user cancelled" — Google sends error=access_denied ──
        if request.GET.get("error"):
            return _redirect_error("google")

        # ── 3. Ensure we have an authorization code ──────────────────
        code = request.GET.get("code")
        if not code:
            return _redirect_error("code")

        # ── 4. Exchange code for token, then fetch profile ───────────
        try:
            token_data = google.exchange_code(code)
            access_token = token_data.get("access_token")
            if not access_token:
                logger.warning(
                    "Google token response missing access_token: %s", token_data
                )
                return _redirect_error("exchange")

            raw_info = google.fetch_userinfo(access_token)
        except Exception:
            logger.exception("Google OAuth exchange or userinfo failed")
            return _redirect_error("exchange")

        info = _normalize_userinfo(raw_info)

        # ── 5. Reject unverified emails ──────────────────────────────
        if not info["email"] or not info["email_verified"]:
            logger.warning(
                "Google userinfo missing verified email: sub=%s email=%r verified=%s",
                info["sub"], info["email"], info["email_verified"],
            )
            return _redirect_error("email")

        # ── 6. Match or create the user ──────────────────────────────
        user_or_error = self._resolve_user(info)
        if isinstance(user_or_error, str):
            return _redirect_error(user_or_error)

        user = user_or_error

        # ── 7. Log the user in (sets the session cookie) ─────────────
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")

        # ── 8. Redirect to the frontend ──────────────────────────────
        next_path = request.session.pop(SESSION_NEXT_KEY, None)
        target = next_path or user.redirect_path
        return HttpResponseRedirect(_frontend_url(target))

    # ── User resolution ──────────────────────────────────────────────
    def _resolve_user(self, info: dict):
        """
        Match an existing user by google_sub, then by email, or create a
        new customer account.

        Returns either a `User` instance or a string error code.
        """
        sub = info["sub"]
        email = info["email"]

        with transaction.atomic():
            # 6a. Match by google_sub.
            existing = (
                User.objects
                .select_for_update()
                .filter(google_sub=sub)
                .first()
            )

            # 6b. Fall back to email match.
            if existing is None:
                existing = (
                    User.objects
                    .select_for_update()
                    .filter(email=email)
                    .first()
                )

            if existing is not None:
                if existing.is_admin_role:
                    logger.info(
                        "Google login blocked for admin email=%s role=%s",
                        existing.email, existing.role,
                    )
                    return "admin_email"

                if existing.status != Status.ACTIVE or not existing.is_active:
                    logger.info(
                        "Google login blocked for inactive user email=%s status=%s",
                        existing.email, existing.status,
                    )
                    return "google"

                if not existing.google_sub:
                    existing.google_sub = sub
                    existing.save(update_fields=["google_sub"])

                if not existing.is_email_verified and info["email_verified"]:
                    existing.is_email_verified = True
                    existing.email_verified_at = timezone.now()
                    existing.save(
                        update_fields=["is_email_verified", "email_verified_at"]
                    )

                return existing

            # 6c. No match — create a new CUSTOMER account.
            try:
                new_user = User.objects.create_user(
                    email=email,
                    password=None,
                    first_name=info["given_name"][:150],
                    last_name=info["family_name"][:150],
                    google_sub=sub,
                    is_email_verified=True,
                    email_verified_at=timezone.now(),
                    role=Role.CUSTOMER,
                    status=Status.ACTIVE,
                )
            except Exception:
                logger.exception("Race while creating Google user for %s", email)
                winner = User.objects.filter(email=email).first()
                if winner is None:
                    return "exchange"
                return winner

            logger.info(
                "Created new customer via Google: id=%s email=%s",
                new_user.id, email,
            )
            return new_user