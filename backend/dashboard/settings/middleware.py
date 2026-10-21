from django.contrib.auth import logout
from django.http import JsonResponse
from django.utils import timezone

EXACT_SKIP_PATHS = frozenset({
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/auth/register",
    "/api/v1/auth/csrf",
    "/api/v1/auth/token/refresh",
})

PREFIX_SKIP_PATHS = (
    "/static/",
    "/media/",
    "/admin/",
)

EXACT_BYPASS_PATHS = frozenset({
    "/favicon.ico",
})

_TIMEOUT_CACHE = {}
_TIMEOUT_CACHE_TTL_SECONDS = 30.0
_TIMEOUT_CACHE_KEY = "session_timeout_minutes"
_TIMEOUT_DEFAULT = 60


def _read_timeout_minutes():
    now = timezone.now().timestamp()
    cached = _TIMEOUT_CACHE.get(_TIMEOUT_CACHE_KEY)
    if cached is not None:
        value, expires_at = cached
        if now < expires_at:
            return value

    try:
        from .models import SecuritySettings

        minutes = SecuritySettings.load().session_timeout_minutes
        value = int(minutes) if minutes else _TIMEOUT_DEFAULT
    except Exception:
        value = _TIMEOUT_DEFAULT

    _TIMEOUT_CACHE[_TIMEOUT_CACHE_KEY] = (value, now + _TIMEOUT_CACHE_TTL_SECONDS)
    return value


class SessionTimeoutMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        if path in EXACT_BYPASS_PATHS:
            return self.get_response(request)
        if self._is_skipped(path):
            return self.get_response(request)
        if not request.user.is_authenticated:
            return self.get_response(request)

        if self._check_timeout(request):
            return JsonResponse(
                {
                    "detail": "Session expired due to inactivity. Please sign in again.",
                    "code": "session_timeout",
                },
                status=401,
            )

        return self.get_response(request)

    @staticmethod
    def _is_skipped(path):
        if path in EXACT_SKIP_PATHS:
            return True
        return any(path.startswith(p) for p in PREFIX_SKIP_PATHS)

    def _check_timeout(self, request):
        now = timezone.now().timestamp()
        last = request.session.get("last_activity_ts")

        if last is None:
            request.session["last_activity_ts"] = now
            return False

        try:
            idle_seconds = now - float(last)
        except (TypeError, ValueError):
            request.session["last_activity_ts"] = now
            return False

        timeout_seconds = _read_timeout_minutes() * 60

        if idle_seconds > timeout_seconds:
            logout(request)
            return True

        request.session["last_activity_ts"] = now
        return False