"""
account/views/overview.py

Account dashboard — the first page a customer sees after login.
Aggregates data from three sources in one response:

    * User         — the customer's own model
    * Address      — owned by this app
    * Orders       — proxied from `checkout` (no duplicate model)
    * Stats        — computed in `services.overview_stats()`

One request, one payload. The frontend renders the whole page from
this response without firing a second call.

WHY THE VIEW BUILDS THE PAYLOAD MANUALLY
----------------------------------------
The composite response mixes:

  * Model-derived scalars (user fields)
  * A related object that needs precedence logic (default_address)
  * Aggregates computed by a service (stats)
  * A small projected list (recent_orders)

There is no single queryset that produces this shape, so the view
assembles a dict and hands it to `OverviewSerializer` for shape
validation and JSON rendering.

SETTINGS AWARENESS
==================
    Three settings surface on this payload:

      * `general.currency` — exposed as a top-level `currency` field
                              AND on each `recent_orders[]` row so
                              the dashboard can format every price
                              without a second lookup.

      * `reviews.reviews_enabled` — gates `stats.pending_reviews`.
                                     Handled inside
                                     `services.overview_stats()`, so
                                     when reviews are off the count
                                     is naturally 0 and no "leave a
                                     review" prompt renders.

      * `inventory.*` (via the recent-orders `status`) — the order
                                     statuses themselves are frozen
                                     at what the customer saw, but
                                     future "low stock" hints on the
                                     dashboard will read through the
                                     same cached bundle. Declared
                                     here as a forward reference.

    All reads fail safe to "KES" / "reviews on" during migrations,
    tests, and management commands.

RESPONSE HEADER
---------------
    Every response carries `X-Shop-Currency` matching the body's
    `currency` field. The frontend can read either — the header is
    cheaper for callers that only need to know what symbol to render,
    the body field is right where the prices are.
"""

from django.db.models import Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Address
from ..serializers import OverviewSerializer
from ..services import overview_stats


# ─────────────────────────────────────────────────────────────────────────────
# Settings helpers — safe during migrations / cold boot
# ─────────────────────────────────────────────────────────────────────────────
def _currency() -> str:
    """
    Read the shop's currency from the cached settings bundle.

    Fails safe to KES so management commands, test suites, and the
    first migration don't crash while the settings tables are still
    being created.
    """
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    """
    Add the `X-Shop-Currency` header to any Response.

    Matches the catalog and checkout views' convention so the
    frontend can read the header uniformly across every API call.
    """
    response['X-Shop-Currency'] = _currency()
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Overview
# ─────────────────────────────────────────────────────────────────────────────
class OverviewView(APIView):
    """
    GET /api/v1/account/overview/

    Response shape (matches `lib/api.ts` accountApi.overview):

        {
          user: {
            id: number,
            email: string,
            first_name: string,
            last_name: string,
            phone: string,
            joined_at: string | null
          },
          default_address: Address | null,
          stats: {
            total_orders: number,
            in_transit: number,
            pending: number,
            wishlist_count: number,
            unread_notifications: number,
            pending_reviews: number     # 0 when reviews are disabled
          },
          recent_orders: [
            {
              id: string,              # order reference
              date: string,            # ISO datetime
              status: string,          # human label — "Delivered", etc.
              itemCount: number,       # number of line items, not units
              total: string,           # decimal as string
              currency: string         # ← added: the shop's ISO code
            },
            ...up to 4
          ],
          currency: string             # ← added: same code, top-level
        }

    CURRENCY PROPAGATION
    --------------------
    Two places carry the currency:

      * Top-level `currency` — one field per page, so a caller that
        only needs to know "what symbol do I render" reads it once.

      * Per-row `currency` on each recent order — redundant with the
        top-level field, but present so a future endpoint that returns
        ONLY the recent orders list (e.g. a compact widget) can format
        prices without pulling the whole overview payload.

    Both values come from the same `_currency()` helper, so they can
    never disagree.

    PENDING_REVIEWS GATE
    --------------------
    `stats.pending_reviews` is computed by
    `services.overview_stats()`, which delegates to
    `services.get_pending_reviews()`. That function returns an empty
    list when `reviews.reviews_enabled` is off, so the count here is
    naturally 0 without any branching in the view. The gate lives in
    one place.

    RECENT ORDERS QUERY
    -------------------
    One query, one aggregate: annotate each order with its line-item
    count so we don't fire N+1 for `items.count()`. Capped to 4 rows —
    the dashboard shows at most 4 recent orders and the frontend has
    a "View all" link to the full orders page.

    The `status` field is a human label ("Delivered", "Shipped",
    "Cancelled") from `Order.get_status_display()`. The raw status
    value stays on the order detail endpoint for programmatic checks.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Default address — falls back to the user's first address if
        # none is marked default, else None. The frontend renders an
        # "Add one →" prompt when this is null.
        default_address = (
            Address.objects.filter(user=user, is_default=True).first()
            or Address.objects.filter(user=user).first()
        )

        # Lazy import — keeps `account` decoupled from `checkout` at
        # module load time. `checkout.services` imports `notify` from
        # this app, so a top-level import here would trip the Django
        # app registry during startup.
        from checkout.models import Order

        # One query, one aggregate: annotate each order with its
        # line-item count so we don't fire N+1 queries for
        # `items.count()`. `Count("items")` counts rows, matching what
        # the frontend calls `itemCount` — the number of distinct
        # line items, not the sum of their quantities.
        recent_qs = (
            Order.objects
            .filter(user=user)
            .annotate(item_count=Count("items"))
            .order_by("-created_at")[:4]
        )

        # Read the currency once and reuse — the top-level field and
        # every row's `currency` field stay in sync by construction.
        currency = _currency()

        recent_orders = [
            {
                "id": o.reference,
                "date": o.created_at,
                "status": o.get_status_display(),
                "itemCount": o.item_count,
                # `format(..., "f")` renders Decimal without scientific
                # notation or locale separators. Stable across all
                # Decimal instances and matches the wire format used
                # by the checkout and order-list endpoints.
                "total": format(o.total, "f"),
                "currency": currency,
            }
            for o in recent_qs
        ]

        payload = {
            "user": {
                "id": user.pk,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                # Read by the dashboard's contact block. Falls back to
                # the address phone when this is empty — the frontend
                # handles that, we just never send null.
                "phone": user.phone or "",
                "joined_at": user.date_joined,
            },
            "default_address": default_address,
            # `overview_stats()` gates pending_reviews on
            # `reviews.reviews_enabled` internally — no branching
            # needed here.
            "stats": overview_stats(user),
            "recent_orders": recent_orders,
            # Top-level currency for callers that render the whole
            # page and want one read.
            "currency": currency,
        }

        return _attach_currency(Response(OverviewSerializer(payload).data))