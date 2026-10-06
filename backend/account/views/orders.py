"""
account/views/orders.py

Order endpoints. All require authentication and scope by
`user=request.user`. Orders live in `checkout` — this module is a
proxy layer that shapes them for the customer-facing account pages.

Endpoints:

    GET  /api/v1/account/orders/                        — list
    GET  /api/v1/account/orders/<reference>/            — detail
    POST /api/v1/account/orders/<reference>/reorder/    — reorder payload
    POST /api/v1/account/orders/<reference>/reject/     — customer cancels
    POST /api/v1/account/orders/<reference>/claim/      — customer confirms receipt

Response shapes match `lib/api.ts` exactly:

    OrderListRow     — reference, status, payment_status, total, currency,
                       item_count, preview_items, created_at
    OrderDetail      — full receipt, timeline, items, address, payment,
                       currency, tax_enabled, prices_include_tax
    OrderReorderItem — variant_id, product_id, name, brand, image,
                       slug, unit_price, quantity
    OrderLifecycleResult — { status }

SETTINGS AWARENESS
==================
    Three settings reach these endpoints, all through the serializers
    and the service layer — the views themselves are pass-through:

      * `general.currency`      — exposed as `currency` on the list,
                                    detail, and reorder responses,
                                    plus an `X-Shop-Currency` header
                                    on every response for consistency
                                    with the catalog endpoints.

      * `tax.vat_enabled`       — exposed as `tax_enabled` on the
                                    detail response so the frontend
                                    knows whether to render the tax
                                    row.

      * `tax.prices_include_tax` — exposed as `prices_include_tax`
                                    on the detail response so the
                                    frontend knows whether the tax
                                    row is a breakdown or an add-on.

      * `notifications.notify_on_cancelled` — gates the cancellation
                                               email when the customer
                                               rejects an order.

      * `reviews.reviews_enabled` — gates the review prompt that
                                     fires when the customer confirms
                                     delivery (via the delivered
                                     notification).

    The serializers self-compute the currency and tax flags via
    `SerializerMethodField`. The notification gates live inside
    `checkout.services.change_order_status`, which the lifecycle
    services call. The views below do not read settings directly —
    they just attach the currency header for uniform client handling.

NOTE ON LIFECYCLE VIEWS (reject / claim):
    Both delegate to `account.services.reject_order` and
    `claim_order_received`. Those functions call
    `checkout.services.change_order_status`, which handles:

      * updating `Order.status`
      * writing the `OrderStatusEvent` (timeline)
      * firing the customer notification, GATED by the shop's
        `notify_on_shipped` / `notify_on_cancelled` settings

    The views do NOT fire notifications themselves. Doing so would
    produce two notifications for the same transition. The only job
    here is calling the service, translating `ValueError` into a 400
    with a customer-safe message, and returning the new status.

NOTE ON `item_count`:
    Annotated as `Count("items")` — the number of distinct line items,
    not the sum of their quantities. The frontend's list card compares
    this against `preview_items.length` to render "+N more", which
    only makes sense if both numbers are counts of lines.
"""

from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404

from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Order, OrderItem, OrderStatusEvent

from .. import services
from ..serializers import (
    OrderDetailSerializer,
    OrderListRowSerializer,
    OrderReorderItemSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
#
# The serializers self-compute `currency` on the response body via
# `SerializerMethodField`. This helper exists so the header added below
# reads from the same cache and the same fallback logic — one source of
# truth for "what currency is this shop in right now?".
# ─────────────────────────────────────────────────────────────────────────────
def _currency() -> str:
    """
    Read the shop's currency from the cached settings bundle.

    Fails safe to KES during migrations / cold boot so management
    commands and tests that touch these views don't crash.
    """
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    """
    Add the `X-Shop-Currency` header to any Response.

    Matches the catalog endpoints' convention so the frontend can read
    the header uniformly across every API call without special-casing
    which endpoint it hit.
    """
    response['X-Shop-Currency'] = _currency()
    return response


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────
class OrderListView(APIView):
    """
    GET /api/v1/account/orders/

    Returns every order the customer has placed, newest first.

    `item_count` is `Count("items")` — number of distinct line items,
    matching what the frontend's card compares against
    `preview_items.length`.

    Each row carries `currency` from `OrderListRowSerializer`, and the
    response carries `X-Shop-Currency` for callers that read the header
    instead of the body.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Order.objects
            .filter(user=request.user)
            .annotate(item_count=Count("items"))
            .prefetch_related(
                Prefetch(
                    "items",
                    queryset=OrderItem.objects.order_by("id"),
                    to_attr="prefetched_items",
                ),
            )
            .order_by("-created_at")
        )
        return _attach_currency(
            Response(OrderListRowSerializer(qs, many=True).data)
        )


# ─────────────────────────────────────────────────────────────────────────────
# Detail
# ─────────────────────────────────────────────────────────────────────────────
class OrderDetailView(APIView):
    """
    GET /api/v1/account/orders/<reference>/

    Full order receipt. Ownership-scoped — a customer can only see
    their own orders. A reference to someone else's order returns 404,
    not 403, so the endpoint doesn't leak whether a reference exists.

    The response carries three settings-derived display hints:

      * `currency`           — the shop's ISO code
      * `tax_enabled`        — whether to render the tax row at all
      * `prices_include_tax` — whether `subtotal` already contains the
                                tax value, or it's an add-on

    The `tax` value itself stays frozen at what the customer actually
    paid at order time — that's a historical fact, not a display
    preference. Only the flags reflect current settings.

    Prefetches:

      * `items` — the line items the receipt renders
      * `status_events` — the timeline, with `select_related("actor")`
        so each event's actor label resolves without a follow-up query.
        Loaded via `to_attr="prefetched_status_events"`; the serializer
        reads that attribute directly.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        order = get_object_or_404(
            Order.objects
            .select_related("user")
            .prefetch_related(
                "items",
                Prefetch(
                    "status_events",
                    queryset=(
                        OrderStatusEvent.objects
                        .select_related("actor")
                        .order_by("-created_at")
                    ),
                    to_attr="prefetched_status_events",
                ),
            )
            .filter(user=request.user),
            reference=reference,
        )
        return _attach_currency(
            Response(OrderDetailSerializer(order).data)
        )


# ─────────────────────────────────────────────────────────────────────────────
# Reorder
# ─────────────────────────────────────────────────────────────────────────────
class OrderReorderView(APIView):
    """
    POST /api/v1/account/orders/<reference>/reorder/

    Returns the line items from a past order in the shape the cart
    expects. The frontend loops over the response and calls
    `useCart.addItem` once per line, multiplied by quantity.

    Two fields are stubbed because `OrderItem` doesn't carry them yet:

      * `variant_id` — OrderItem has only `product_id`. Returning the
        product id here means the cart treats every variant of the same
        product as interchangeable, which is fine for a re-order.

      * `slug` — OrderItem has no slug. Returning `""` makes the
        frontend fall back to a product search.

    Ownership-scoped. Any status can be reordered — even cancelled.

    Response is a JSON array of OrderReorderItem. Empty array if the
    order has no line items with a product binding.

    The `X-Shop-Currency` header carries the shop's currency so the
    cart can format each row's `unit_price` without a separate
    settings fetch.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, reference):
        order = get_object_or_404(
            Order.objects
            .filter(user=request.user)
            .prefetch_related("items"),
            reference=reference,
        )

        payload = [
            {
                "variant_id": item.product_id or "",
                "product_id": item.product_id or "",
                "name": item.name,
                "brand": item.brand or "",
                "image": item.image_url or "",
                "slug": "",
                "unit_price": item.unit_price,
                "quantity": item.quantity,
            }
            for item in order.items.all()
            if item.product_id          # skip rows with no product binding
        ]

        return _attach_currency(
            Response(OrderReorderItemSerializer(payload, many=True).data)
        )


# ─────────────────────────────────────────────────────────────────────────────
# Reject — customer cancels before dispatch
# ─────────────────────────────────────────────────────────────────────────────
class OrderRejectView(APIView):
    """
    POST /api/v1/account/orders/<reference>/reject/

    Customer cancels their own order before it has shipped.

    Allowed only while the order status is `pending`, `confirmed`, or
    `processing`. Once `shipped`, the service raises ValueError and the
    view returns 400 with a customer-safe message directing the
    customer to returns instead.

    Request body (optional):
        { "reason": "Ordered by mistake" }

    Response (200):
        { "status": "cancelled" }

    Errors:
        400  — invalid transition (already shipped, already delivered)
               or the reason field is not a string
        404  — reference does not belong to this customer, or does not
               exist.

    The service is idempotent on already-cancelled orders.

    Settings awareness
    ------------------
    The cancellation email is gated by
    `notifications.notify_on_cancelled`. That gate lives inside
    `checkout.services.change_order_status` — this view does not need
    to know about it. When the shop owner turns cancellation emails
    off, the customer still sees the timeline event and the order
    status flips, but no email goes out.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, reference):
        raw_reason = request.data.get("reason", "")
        if raw_reason is not None and not isinstance(raw_reason, str):
            return _attach_currency(Response(
                {"detail": "Reason must be a string."},
                status=http_status.HTTP_400_BAD_REQUEST,
            ))

        reason = (raw_reason or "").strip()[:500]

        try:
            order = services.reject_order(
                request.user, reference, reason=reason,
            )
        except ValueError as exc:
            return _attach_currency(Response(
                {"detail": str(exc)},
                status=http_status.HTTP_400_BAD_REQUEST,
            ))

        # No notification call here. `change_order_status` inside the
        # service already fired `notify_order_cancelled` — gated by the
        # shop's notification settings.
        return _attach_currency(Response({"status": order.status}))


# ─────────────────────────────────────────────────────────────────────────────
# Claim — customer confirms receipt
# ─────────────────────────────────────────────────────────────────────────────
class OrderClaimView(APIView):
    """
    POST /api/v1/account/orders/<reference>/claim/

    Customer confirms they received a shipped order.

    Allowed only from `shipped`. Any other status either means the
    order hasn't been dispatched yet (too early) or was already
    confirmed (idempotent — returns 200 with the current status).

    For COD orders, delivery implies the rider collected the cash, so
    `payment_status` flips to `paid` inside the service before the
    fulfillment transition.

    Response (200):
        { "status": "delivered" }

    Errors:
        400  — order is not in `shipped` and not already `delivered`
        404  — reference does not belong to this customer

    Settings awareness
    ------------------
    Two settings affect the delivered flow, both applied by the
    services the view calls — nothing to do here:

      * `reviews.reviews_enabled` — when off, the review prompt is
                                     suppressed. The delivery
                                     notification itself still fires.

      * `notifications.email_enabled` / `whatsapp_enabled` — future
                                     gates for the outbound pass.

    The `X-Shop-Currency` header lets the frontend refresh its
    currency context in case the shop owner changed it between page
    loads.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, reference):
        try:
            order = services.claim_order_received(
                request.user, reference,
            )
        except ValueError as exc:
            return _attach_currency(Response(
                {"detail": str(exc)},
                status=http_status.HTTP_400_BAD_REQUEST,
            ))

        # No notification call here. `change_order_status` inside the
        # service fired `notify_order_delivered`, which also triggers
        # the review prompt (gated by `reviews.reviews_enabled`).
        return _attach_currency(Response({"status": order.status}))