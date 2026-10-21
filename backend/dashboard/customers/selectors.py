from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Prefetch, Q, Sum
from django.utils import timezone

from account.models import Address, Review, WishlistItem
from checkout.models import CartItem, Order

from .constants import CustomerSegment
from .models import CommunicationLog, CustomerNote, CustomerProfile, SupportTicket

User = get_user_model()


def customers_base_qs():
    return (
        User.objects
        .filter(role="CUSTOMER")
        .select_related("customer_profile")
    )


def list_customers(*, search=None, segment=None, order_count=None, spent_range=None):
    qs = customers_base_qs()

    if search:
        q = search.strip()
        qs = qs.filter(
            Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(phone__icontains=q)
        )

    if segment:
        qs = qs.filter(customer_profile__segment=segment)

    if order_count:
        if order_count == "1":
            qs = qs.filter(customer_profile__orders_count=1)
        elif order_count == "2-5":
            qs = qs.filter(
                customer_profile__orders_count__gte=2,
                customer_profile__orders_count__lte=5,
            )
        elif order_count == "5+":
            qs = qs.filter(customer_profile__orders_count__gt=5)

    if spent_range:
        if spent_range == "100k+":
            qs = qs.filter(customer_profile__total_spent__gte=100_000)
        elif spent_range == "50k-100k":
            qs = qs.filter(
                customer_profile__total_spent__gte=50_000,
                customer_profile__total_spent__lte=100_000,
            )
        elif spent_range == "<50k":
            qs = qs.filter(customer_profile__total_spent__lt=50_000)

    return qs.order_by("-date_joined")


def get_customer_detail(user_id: int):
    return (
        customers_base_qs()
        .filter(pk=user_id)
        .prefetch_related(
            "orders",
            "addresses",
            "reviews",
            "wishlist_items",
            Prefetch("support_tickets", queryset=SupportTicket.objects.all()),
            Prefetch("communication_log", queryset=CommunicationLog.objects.all()),
            Prefetch("customer_notes", queryset=CustomerNote.objects.select_related("author")),
            "cart__items",
        )
        .first()
    )


def get_customer_orders(user_id: int, limit: int | None = None):
    qs = (
        Order.objects
        .filter(user_id=user_id)
        .exclude(status=Order.Status.CANCELLED)
        .order_by("-created_at")
    )
    return qs[:limit] if limit else qs


def get_customer_wishlist(user_id: int):
    return WishlistItem.objects.filter(user_id=user_id).order_by("-added_at")


def get_customer_cart(user_id: int):
    return (
        CartItem.objects
        .filter(cart__user_id=user_id)
        .order_by("-added_at")
    )


def get_customer_reviews(user_id: int):
    return Review.objects.filter(user_id=user_id).order_by("-created_at")


def get_customer_addresses(user_id: int):
    return Address.objects.filter(user_id=user_id).order_by("-is_default", "-updated_at")


def get_customer_notes(user_id: int):
    return (
        CustomerNote.objects
        .filter(user_id=user_id)
        .select_related("author")
        .order_by("-created_at")
    )


def get_customer_tickets(user_id: int):
    return SupportTicket.objects.filter(user_id=user_id).order_by("-opened_at")


def get_customer_communication(user_id: int):
    return CommunicationLog.objects.filter(user_id=user_id).order_by("-created_at")


def get_dashboard_stats():
    profiles = CustomerProfile.objects.all()

    total_customers = customers_base_qs().count()

    thirty_days_ago = timezone.now() - timedelta(days=30)
    new_this_month = customers_base_qs().filter(
        date_joined__gte=thirty_days_ago,
    ).count()

    agg = profiles.aggregate(
        total_spent=Sum("total_spent"),
        total_orders=Sum("orders_count"),
        repeat_count=Count("id", filter=Q(orders_count__gt=1)),
    )

    total_spent = agg["total_spent"] or 0
    total_orders = agg["total_orders"] or 0
    repeat_count = agg["repeat_count"] or 0

    repeat_rate = (
        round((repeat_count / total_customers) * 100) if total_customers else 0
    )
    avg_order_value = (
        round(total_spent / total_orders) if total_orders else 0
    )

    return {
        "total_customers": total_customers,
        "new_this_month": new_this_month,
        "repeat_rate": repeat_rate,
        "avg_order_value": avg_order_value,
        "total_revenue": total_spent,
    }


def get_segment_counts() -> dict[str, int]:
    counts = {s: 0 for s in CustomerSegment.values}
    rows = (
        CustomerProfile.objects
        .values("segment")
        .annotate(n=Count("id"))
    )
    for row in rows:
        counts[row["segment"]] = row["n"]
    return counts