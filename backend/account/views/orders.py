from django.db.models import Count, Prefetch
from django.http import FileResponse
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


def _currency() -> str:
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    response['X-Shop-Currency'] = _currency()
    return response


def _lc(value) -> str:
    """Lowercase a model status for the API response contract.

    The Order model stores status as UPPERCASE choice keys. The storefront
    and admin SPA both expect lowercase. Serializers already handle this
    for list/detail reads, but a few action endpoints return a raw status
    in their response body — this helper keeps those consistent.
    """
    return (value or "").lower()


class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Order.objects
            .filter(user=request.user)
            # ── Hide cancelled orders from the customer's list ────────
            # Abandoned M-Pesa attempts (customer switched to COD) get
            # auto-cancelled by the checkout service. They're kept in
            # the DB for audit, but showing them under "Recent Orders"
            # makes it look like the customer placed a duplicate order.
            #
            # If you later add an `is_abandoned_attempt` flag and want
            # manual (admin/self-service) cancellations to remain
            # visible, replace this with:
            #   .exclude(is_abandoned_attempt=True)
            .exclude(status=Order.Status.CANCELLED)
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


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        # Cancelled orders remain accessible by reference on purpose:
        # the customer may still have a link to one (from an email, a
        # support reply, or a bookmarked URL) and needs to see why it
        # was cancelled.
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


class OrderPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        order = get_object_or_404(
            Order.objects
            .select_related("user")
            .prefetch_related("items", "payments"),
            reference=reference,
            user=request.user,
        )

        try:
            from dashboard.orders.pdf import build_receipt_pdf
            pdf_buffer = build_receipt_pdf(order)
        except Exception:
            import logging
            logging.getLogger(__name__).exception(
                "Failed to render receipt PDF for order %s", reference,
            )
            return Response(
                {"detail": "Could not render the receipt."},
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response = FileResponse(
            pdf_buffer,
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="receipt-{order.reference}.pdf"'
        )
        return response


class OrderReorderView(APIView):
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
            if item.product_id
        ]

        return _attach_currency(
            Response(OrderReorderItemSerializer(payload, many=True).data)
        )


class OrderRejectView(APIView):
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

        return _attach_currency(Response({"status": _lc(order.status)}))


class OrderClaimView(APIView):
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

        return _attach_currency(Response({"status": _lc(order.status)}))