from django.db.models import Count

from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Order
from ..models import Address, Notification, WishlistItem
from ..serializers import AddressSerializer


# Backend Order.status → customer-facing label. The frontend's statusColor
# helper expects Title Case and knows the set of values below.
_STATUS_LABELS = {
    "pending": "Pending",
    "confirmed": "Processing",
    "processing": "Processing",
    "packed": "Packed",
    "shipped": "Shipped",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
}

# Statuses that count as "on the way" for the In Transit stat.
_IN_TRANSIT_STATUSES = ("confirmed", "processing", "packed", "shipped")


class OverviewView(APIView):
    def get(self, request):
        user = request.user

        # Default address — prefer the flagged one, fall back to newest.
        default_address = (
            Address.objects.filter(user=user, is_default=True).first()
            or Address.objects.filter(user=user).order_by("-updated_at").first()
        )

        # Orders with per-order item counts, newest first.
        orders = (
            Order.objects.filter(user=user)
            .annotate(item_count=Count("items"))
            .order_by("-created_at")
        )
        total_orders = orders.count()
        in_transit = orders.filter(status__in=_IN_TRANSIT_STATUSES).count()
        recent = orders[:3]

        # Counters for the stat cards.
        wishlist_n = WishlistItem.objects.filter(user=user).count()
        unread_n = Notification.objects.filter(user=user, is_read=False).count()

        return Response({
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "joined_at": (
                    user.date_joined.isoformat() if user.date_joined else None
                ),
            },
            "default_address": (
                AddressSerializer(default_address).data
                if default_address else None
            ),
            "stats": {
                "total_orders": total_orders,
                "in_transit": in_transit,
                "wishlist_count": wishlist_n,
                "unread_notifications": unread_n,
            },
            "recent_orders": [
                {
                    "id": o.reference,
                    "date": o.created_at.isoformat(),
                    "status": _STATUS_LABELS.get(o.status, "Pending"),
                    "itemCount": o.item_count,
                    "total": str(o.total),
                }
                for o in recent
            ],
        })