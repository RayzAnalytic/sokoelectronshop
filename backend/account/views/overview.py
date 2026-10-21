from django.db.models import Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Address
from ..serializers import OverviewSerializer
from ..services import overview_stats


def _currency() -> str:
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    response['X-Shop-Currency'] = _currency()
    return response


class OverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        default_address = (
            Address.objects.filter(user=user, is_default=True).first()
            or Address.objects.filter(user=user).first()
        )

        from checkout.models import Order

        recent_qs = (
            Order.objects
            .filter(user=user)
            .annotate(item_count=Count("items"))
            .order_by("-created_at")[:4]
        )

        currency = _currency()

        recent_orders = [
            {
                "id": o.reference,
                "date": o.created_at,
                "status": o.get_status_display(),
                "itemCount": o.item_count,
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
                "phone": user.phone or "",
                "joined_at": user.date_joined,
            },
            "default_address": default_address,
            "stats": overview_stats(user),
            "recent_orders": recent_orders,
            "currency": currency,
        }

        return _attach_currency(Response(OverviewSerializer(payload).data))