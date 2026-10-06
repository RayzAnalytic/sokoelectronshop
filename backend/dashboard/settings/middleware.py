"""
dashboard/settings/middleware.py

Server-side session timeout enforcement.

Reads `SecuritySettings.session_timeout_minutes` and logs out any
authenticated user whose session has been idle longer than that.

Complements the frontend's idle timer (if any): the frontend can warn
the user a minute before the timeout; this middleware is the
authoritative enforcement point.

Skips a small set of paths so login / static / admin pages don't
accidentally reset or short-circuit the timer.
"""

from django.contrib.auth import logout
from django.utils import timezone


# Paths that should NOT reset the last-activity timestamp.
# - Login flow: the user is not yet authenticated on GET, and POST-ing
#   credentials should not count as "activity" on an old session.
# - Static / media: browser fetches, not user activity.
# - Admin: Django's own admin has its own session expiry.
SKIP_PREFIXES = (
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/static/",
    "/media/",
    "/admin/",
    "/favicon.ico",
)


class SessionTimeoutMiddleware:
    """Enforces SecuritySettings.session_timeout_minutes server-side."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and not self._is_skipped(request.path):
            self._check_timeout(request)
        return self.get_response(request)

    # ── helpers ────────────────────────────────────────────────

    @staticmethod
    def _is_skipped(path: str) -> bool:
        return any(path.startswith(p) for p in SKIP_PREFIXES)

    @staticmethod
    def _timeout_minutes() -> int:
        try:
            from .models import SecuritySettings
            minutes = SecuritySettings.load().session_timeout_minutes
            return int(minutes) if minutes else 60
        except Exception:
            # Missing table during first migrate, or transient DB hiccup.
            # Default to 60 minutes so nobody gets logged out unexpectedly.
            return 60

    def _check_timeout(self, request) -> None:
        now = timezone.now().timestamp()
        last = request.session.get("last_activity_ts")

        if last is None:
            # First request on this session — seed the timestamp and let it through.
            request.session["last_activity_ts"] = now
            return

        idle_seconds = now - float(last)
        timeout_seconds = self._timeout_minutes() * 60

        if idle_seconds > timeout_seconds:
            logout(request)
            # Clear the seed so the next request on this cookie (if any)
            # starts fresh rather than immediately timing out again.
            request.session.pop("last_activity_ts", None)
            return

        # Still valid — refresh the timestamp so the clock restarts.
        request.session["last_activity_ts"] = now