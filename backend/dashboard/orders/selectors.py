"""
Read queries for the admin orders module.

Everything the list view, detail view, and stats header needs. Views
call these; they never touch the ORM directly.
"""

from datetime import timedelta

from django.db.models import Count, Prefetch, Q, Sum
from django.utils import timezone

from checkout.models import Order, OrderItem, OrderStatusEvent, Payment

from .constants import ADMIN_ORDER_TABS


# ─────────────────────────────────────────────────────────────────────────────
# Base queryset
# ─────────────────────────────────────────────────────────────────────────────
def orders_base_qs():
    """
    Every order, newest first.

    `select_related("user")` is what makes `customer_display` cheap —
    without it, the list serializer would fire a query per row to read
    the user's name and email.
    """
    return (
        Order.objects
        .select_related("user")
        .order_by("-created_at")
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tab filtering
# ─────────────────────────────────────────────────────────────────────────────
def _apply_tab(qs, tab: str):
    """
    Filter the queryset down to a tab.

    Tabs are not all one dimension:

      * Most filter by `status`.
      * `payment_pending` filters by `status=pending` AND
        `payment_status=unpaid` — an order that has been placed but
        has not been paid for and has not been confirmed.
      * `paid` filters by `payment_status=paid`, regardless of
        fulfillment.
      * `refunded` filters by `payment_status=refunded`.
      * `failed` is the odd one — it means "this order is dead in some
        way". That covers both an order with `status=failed` and one
        where the payment itself failed. The two are unioned.

    Unknown tabs fall through to no filter — the same as `all`. This
    is defensive: a client sending `?tab=garbage` gets the full list
    rather than a 500.
    """
    if tab == "all" or not tab:
        return qs

    if tab == "pending":
        return qs.filter(status=Order.Status.PENDING)

    if tab == "payment_pending":
        return qs.filter(
            status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.UNPAID,
        )

    if tab == "paid":
        return qs.filter(payment_status=Order.PaymentStatus.PAID)

    if tab == "processing":
        return qs.filter(status=Order.Status.PROCESSING)

    if tab == "shipped":
        return qs.filter(status=Order.Status.SHIPPED)

    if tab == "delivered":
        return qs.filter(status=Order.Status.DELIVERED)

    if tab == "cancelled":
        return qs.filter(status=Order.Status.CANCELLED)

    if tab == "failed":
        return qs.filter(
            Q(status=Order.Status.FAILED)
            | Q(payment_status=Order.PaymentStatus.FAILED)
        ).distinct()

    if tab == "refunded":
        return qs.filter(payment_status=Order.PaymentStatus.REFUNDED)

    if tab == "returned":
        return qs.filter(status=Order.Status.RETURNED)

    # Unknown tab — treat as "all".
    return qs


# ─────────────────────────────────────────────────────────────────────────────
# List + filters
# ─────────────────────────────────────────────────────────────────────────────
def list_orders(
    *,
    tab: str = "all",
    search: str = "",
    payment_status: str = "",
    date_from=None,
    date_to=None,
):
    """
    Return a filtered queryset of orders for the admin list page.

    All filtering happens in SQL. Pagination, if added later, wraps
    this queryset.

    `search` matches order reference, contact email, contact phone, or
    the customer's first/last name. The user join is already loaded by
    `orders_base_qs`, so the extra Q clauses do not add a query.

    `date_from` / `date_to` filter on `created_at`. Accept `date` or
    `datetime`; both are converted by Django's field lookup.
    """
    qs = orders_base_qs()
    qs = _apply_tab(qs, tab)

    if search:
        term = search.strip()
        qs = qs.filter(
            Q(reference__icontains=term)
            | Q(contact_email__icontains=term)
            | Q(contact_phone__icontains=term)
            | Q(user__email__icontains=term)
            | Q(user__first_name__icontains=term)
            | Q(user__last_name__icontains=term)
        )

    if payment_status:
        qs = qs.filter(payment_status=payment_status)

    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    return qs


# ─────────────────────────────────────────────────────────────────────────────
# Detail — one order, all tabs loaded up front
# ─────────────────────────────────────────────────────────────────────────────
def get_order_detail(reference: str):
    """
    Return the order with every related object the detail page needs.

    The `status_events` prefetch orders newest-first and loads the
    actor in the same query, so the timeline serializes with zero
    additional queries.
    """
    return (
        Order.objects
        .select_related("user")
        .prefetch_related(
            "items",
            Prefetch(
                "payments",
                queryset=Payment.objects.order_by("-created_at"),
            ),
            Prefetch(
                "status_events",
                queryset=(
                    OrderStatusEvent.objects
                    .select_related("actor")
                    .order_by("-created_at")
                ),
            ),
        )
        .filter(reference=reference)
        .first()
    )


# ─────────────────────────────────────────────────────────────────────────────
# Stats
# ─────────────────────────────────────────────────────────────────────────────
def get_dashboard_stats():
    """
    Headline numbers for the list header tiles.

    Four aggregate queries on Order. All told, one round-trip to the
    database. The alternative — iterating the queryset in Python — is
    fine for a few hundred orders and terrible for a few hundred
    thousand.

    `revenue_today` and `revenue_month` count only paid orders. A
    refunded order is excluded — the money came in and went back out.
    """
    base = Order.objects.all()
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0,
    )

    # Active = anything not in a terminal state. These are the orders
    # the admin might still need to touch.
    terminal = [
        Order.Status.DELIVERED,
        Order.Status.RETURNED,
        Order.Status.CANCELLED,
        Order.Status.FAILED,
    ]

    agg = base.aggregate(
        total_orders=Count("id"),
        active_orders=Count("id", filter=~Q(status__in=terminal)),
        pending_orders=Count(
            "id", filter=Q(status=Order.Status.PENDING),
        ),
        shipped_orders=Count(
            "id", filter=Q(status=Order.Status.SHIPPED),
        ),
        delivered_orders=Count(
            "id", filter=Q(status=Order.Status.DELIVERED),
        ),
        unpaid_orders=Count(
            "id",
            filter=Q(payment_status=Order.PaymentStatus.UNPAID),
        ),
        failed_payments=Count(
            "id",
            filter=Q(payment_status=Order.PaymentStatus.FAILED),
        ),
        revenue_today=Sum(
            "total",
            filter=Q(
                payment_status=Order.PaymentStatus.PAID,
                created_at__gte=today_start,
            ),
        ),
        revenue_month=Sum(
            "total",
            filter=Q(
                payment_status=Order.PaymentStatus.PAID,
                created_at__gte=month_start,
            ),
        ),
    )

    return {
        "total_orders": agg["total_orders"] or 0,
        "active_orders": agg["active_orders"] or 0,
        "pending_orders": agg["pending_orders"] or 0,
        "shipped_orders": agg["shipped_orders"] or 0,
        "delivered_orders": agg["delivered_orders"] or 0,
        "unpaid_orders": agg["unpaid_orders"] or 0,
        "failed_payments": agg["failed_payments"] or 0,
        "revenue_today": str(agg["revenue_today"] or "0.00"),
        "revenue_month": str(agg["revenue_month"] or "0.00"),
    }


def get_tab_counts():
    """
    Count of orders per tab.

    One query per tab. That is fine — 11 tabs, 11 cheap `COUNT(*)`
    calls. If this ever becomes a bottleneck, replace with a single
    `values("status", "payment_status").annotate(Count("id"))` and
    compute the tab totals in Python. That is more code for the same
    answer, so start simple.
    """
    counts = {}
    for key, _ in ADMIN_ORDER_TABS:
        counts[key] = _apply_tab(Order.objects.all(), key).count()
    return counts