import logging
import re

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)

MOBILE_RE = re.compile(r"Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini", re.I)
TABLET_RE = re.compile(r"iPad|Tablet|Nexus 7|Nexus 10|KFAPWI", re.I)
BOT_RE = re.compile(r"bot|crawler|spider|crawling|slurp|bingpreview", re.I)

_HARDCODED_SKIP = (
    "/ops-7f3k9z",
    "/assets",
    "/fonts",
    "/robots.txt",
    "/sitemap.xml",
)


def _skip_prefixes():
    extra = tuple(getattr(settings, "ANALYTICS_PAGEVIEW_SKIP_PREFIXES", ()) or ())
    return extra + _HARDCODED_SKIP


def _device_from_ua(ua: str) -> str:
    if not ua:
        return "desktop"
    if BOT_RE.search(ua):
        return "bot"
    if TABLET_RE.search(ua):
        return "tablet"
    if MOBILE_RE.search(ua):
        return "mobile"
    return "desktop"


class PageViewMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if not getattr(settings, "ANALYTICS_PAGEVIEW_ENABLED", True):
            return None

        try:
            path = request.path or "/"
            if any(path.startswith(p) for p in _skip_prefixes()):
                return None

            ua = request.META.get("HTTP_USER_AGENT", "") or ""
            device = _device_from_ua(ua)

            from .models import PageView

            user = getattr(request, "user", None)
            user = user if (user is not None and user.is_authenticated) else None

            session_key = ""
            if hasattr(request, "session") and request.session is not None:
                session_key = (request.session.session_key or "")[:64]

            PageView.objects.create(
                path=path[:255],
                device_type=device,
                user_agent=ua[:2000],
                user=user,
                session_key=session_key,
                referrer=(request.META.get("HTTP_REFERER", "") or "")[:255],
            )
        except Exception as exc:
            logger.debug("PageView middleware skipped: %s", exc)

        return None