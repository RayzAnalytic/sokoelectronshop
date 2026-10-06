import re
from django.utils.deprecation import MiddlewareMixin


MOBILE_RE = re.compile(r"Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini", re.I)
TABLET_RE = re.compile(r"iPad|Tablet|Nexus 7|Nexus 10|KFAPWI", re.I)
BOT_RE = re.compile(r"bot|crawler|spider|crawling|slurp|bingpreview", re.I)

# Only log real storefront routes — skip admin, static, api, etc.
SKIP_PREFIXES = ("/admin", "/static", "/media", "/api", "/_next", "/favicon")


class PageViewMiddleware(MiddlewareMixin):
    """Log one PageView row per storefront request. Fail-silent."""

    def process_request(self, request):
        try:
            path = request.path or "/"
            if any(path.startswith(p) for p in SKIP_PREFIXES):
                return None

            ua = request.META.get("HTTP_USER_AGENT", "")

            if BOT_RE.search(ua):
                device = "bot"
            elif TABLET_RE.search(ua):
                device = "tablet"
            elif MOBILE_RE.search(ua):
                device = "mobile"
            else:
                device = "desktop"

            from .models import PageView

            PageView.objects.create(
                path=path[:255],
                device_type=device,
                user_agent=ua[:2000],
                user=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
                session_key=(request.session.session_key or "")[:64] if hasattr(request, "session") else "",
                referrer=(request.META.get("HTTP_REFERER", "") or "")[:255],
            )
        except Exception:
            # Never let analytics break a page load
            pass
        return None