from django.db.models import Count, Prefetch, Q, Sum
from django.utils import timezone

from checkout.models import Order, OrderStatusEvent, Payment

from .constants import ADMIN_ORDER_TABS


def orders_base_qs():
    return (
        Order.objects
        .select_related("user")
        .order_by("-created_at")
    )


def _apply_tab(qs, tab: str):
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

    return qs


def list_orders(
    *,
    tab: str = "all",
    search: str = "",
    payment_status: str = "",
    date_from=None,
    date_to=None,
):
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


def get_order_detail(reference: str):
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


def get_order_by_qr_token(token: str):
    token = (token or "").strip()
    if not token:
        return None

    qs = (
        Order.objects
        .select_related("user")
        .prefetch_related(
            "items",
            Prefetch(
                "payments",
                queryset=Payment.objects.order_by("-created_at"),
            ),
        )
    )

    order = qs.filter(verify_token=token).first()
    if order is not None:
        return order

    return qs.filter(reference=token).first()


def get_dashboard_stats():
    base = Order.objects.all()
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0,
    )

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
    counts = {}
    for key, _ in ADMIN_ORDER_TABS:
        counts[key] = _apply_tab(Order.objects.all(), key).count()
    return counts