# newsletter/views_public.py
"""
Public (unauthenticated) newsletter endpoints used by the storefront.

  POST /api/v1/newsletter/subscribe/
  POST /api/v1/newsletter/unsubscribe/
  GET  /api/v1/newsletter/unsubscribe/<uuid>/

Security model:
  - No session, no CSRF surface (authentication_classes = []).
  - Subscribe and Unsubscribe have separate throttle buckets so one
    cannot starve the other.
  - SubscribeView is idempotent and intentionally enumerating: an
    already-subscribed address gets an "already_subscribed" response
    so the storefront can show a helpful message. This is a deliberate
    trade-off, not an oversight.
  - Unsubscribe always returns 200 whether the address existed or not,
    and never reveals whether the token was valid.
"""

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import Subscriber, SubscriberList
from .serializers import SubscribeSerializer, UnsubscribeSerializer


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _client_ip(request) -> str | None:
    """
    Best-effort client IP. Respects X-Forwarded-For when running behind
    a reverse proxy (Nginx, Cloudflare, ngrok). Returns the left-most
    (closest to client) address, or None if nothing usable is present.
    """
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    return request.META.get("REMOTE_ADDR")


def _default_list() -> SubscriberList | None:
    """
    The list every fresh homepage signup is auto-attached to.

    Looks up by exact name so the behaviour is predictable once the
    list is seeded (via data migration or the admin UI). Returns None
    if the list doesn't exist yet — the view handles that gracefully
    rather than failing the signup.
    """
    return SubscriberList.objects.filter(name__iexact="All Subscribers").first()


def _shop_name() -> str:
    """Never let a missing setting break an unsubscribe page."""
    return getattr(settings, "SHOP_NAME", "our store")


def _store_url() -> str:
    """Never let a missing setting break an unsubscribe page."""
    return getattr(settings, "STORE_URL", "/")


# ─────────────────────────────────────────────────────────────────────────────
# Throttles
# ─────────────────────────────────────────────────────────────────────────────
class SubscribeThrottle(AnonRateThrottle):
    """
    Uses REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['subscribe'] → 30/hour.
    Anonymous only; logged-in admin users are unaffected.
    """
    scope = "subscribe"


class UnsubscribeThrottle(AnonRateThrottle):
    """
    Separate bucket from subscribe so a user who signs up then
    immediately unsubscribes doesn't consume two hits from one quota.
    Uses REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['unsubscribe'].
    """
    scope = "unsubscribe"


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/newsletter/subscribe/
# ─────────────────────────────────────────────────────────────────────────────
class SubscribeView(APIView):
    """
    Idempotent public signup endpoint.

    Body (JSON):
        {
          "email":  "user@example.com",         # required
          "name":   "Jane Wanjiru",             # optional
          "source": "Footer Popup"              # optional
                                                # one of: Footer Popup,
                                                # Checkout, WhatsApp Opt-in,
                                                # Manual Import
        }

    Responses:
        201 { "detail": "...", "status": "subscribed" }
        200 { "detail": "...", "status": "already_subscribed" }
        200 { "detail": "...", "status": "reactivated" }
        400 { "email": ["Enter a valid email address."] }  etc.
        429 { "detail": "Request was throttled..." }
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SubscribeThrottle]

    def post(self, request):
        ser = SubscribeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        # Serializer has already lowercased + stripped email and name.
        email = ser.validated_data["email"]
        name = ser.validated_data.get("name", "")
        source = ser.validated_data.get("source", "Footer Popup")
        ip = _client_ip(request)

        existing = Subscriber.objects.filter(email=email).first()

        # ── Case 1: already active — nothing to do, report success.
        if existing and existing.is_active:
            return Response(
                {
                    "detail": "This email is already subscribed to our newsletter.",
                    "status": "already_subscribed",
                },
                status=status.HTTP_200_OK,
            )

        # ── Case 2: previously unsubscribed — reactivate in place.
        if existing and not existing.is_active:
            # mark_subscribed flips is_active, clears unsubscribed_at,
            # refreshes subscribed_at, and optionally updates source.
            existing.mark_subscribed(source=source, save=False)

            update_fields = [
                "is_active",
                "unsubscribed_at",
                "subscribed_at",
                "source",
                "updated_at",
            ]
            if ip and not existing.ip_address:
                existing.ip_address = ip
                update_fields.append("ip_address")
            if name and not existing.name:
                existing.name = name
                update_fields.append("name")

            existing.save(update_fields=update_fields)

            # Re-attach to the default list if they aren't on it anymore,
            # so reactivated users show up under the default list filter.
            default_list = _default_list()
            if default_list and not existing.lists.filter(pk=default_list.pk).exists():
                existing.lists.add(default_list)

            return Response(
                {
                    "detail": "Welcome back! Your subscription has been reactivated.",
                    "status": "reactivated",
                },
                status=status.HTTP_200_OK,
            )

        # ── Case 3: brand new email — create the subscriber.
        sub = Subscriber.objects.create(
            email=email,
            name=name,
            source=source,
            ip_address=ip,
            is_active=True,
        )

        default_list = _default_list()
        if default_list:
            sub.lists.add(default_list)

        return Response(
            {
                "detail": "Subscribed successfully.",
                "status": "subscribed",
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/newsletter/unsubscribe/
# ─────────────────────────────────────────────────────────────────────────────
class UnsubscribeView(APIView):
    """
    Programmatic unsubscribe for the storefront.

    Body:
        { "email": "user@example.com" }
        OR
        { "token": "2f3b5b2e-4a61-4f31-b0c5-1e8b1f7d9c0a" }

    If both are provided, token wins — it's the more specific identifier
    and the one embedded in email footers. The serializer normalizes
    email to lowercase, so no re-normalization is needed here.

    Always 200 — response does not reveal whether the address existed.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [UnsubscribeThrottle]

    def post(self, request):
        ser = UnsubscribeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        email = ser.validated_data.get("email")
        token = ser.validated_data.get("token")

        qs = Subscriber.objects.all()
        if token:
            sub = qs.filter(unsubscribe_token=token).first()
        elif email:
            sub = qs.filter(email=email).first()
        else:
            sub = None

        if sub and sub.is_active:
            sub.mark_unsubscribed()

        return Response(
            {
                "detail": (
                    "If that address was subscribed, "
                    "it has been removed from our mailing list."
                )
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/newsletter/unsubscribe/<uuid:token>/
# ─────────────────────────────────────────────────────────────────────────────
class UnsubscribeLinkView(APIView):
    """
    One-click unsubscribe target used in the footer of every campaign
    email. Renders an HTML confirmation card instead of JSON so the
    recipient sees something human, and marks the subscriber inactive
    on the way through.

    URL pattern must declare <uuid:token> so Django validates the UUID
    before this view runs. Throttled in the same bucket as the JSON
    unsubscribe — this endpoint is hit from email clients, not scripts,
    so the limit is generous but still protects against token scanning.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [UnsubscribeThrottle]

    HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed · {shop}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }}
    .card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 32px;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }}
    h1 {{
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 8px;
    }}
    p {{
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 20px;
    }}
    a {{
      display: inline-block;
      background: #172554;
      color: #ffffff;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 6px;
    }}
    a:hover {{
      background: #1e3a8a;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed</h1>
    <p>
      You will no longer receive marketing emails from {shop}.
      Transactional emails about your orders will still be sent.
    </p>
    <a href="{store_url}">Return to store</a>
  </div>
</body>
</html>"""

    def get(self, request, token):
        # token is guaranteed to be a UUID by the URL converter.
        sub = Subscriber.objects.filter(unsubscribe_token=token).first()

        if sub and sub.is_active:
            sub.mark_unsubscribed()

        # Same page whether the token existed or not — never leak state.
        return HttpResponse(
            self.HTML.format(
                shop=_shop_name(),
                store_url=_store_url(),
            ),
            content_type="text/html",
        )