"""
HTTP handlers for the admin orders module.

Every view requires `IsAdminUser`. Reads go through `selectors`,
writes go through `services`. Nothing touches the ORM directly.
"""

import csv
import io
import logging

from django.http import HttpResponse
from rest_framework import status as http_status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import selectors, services
from .constants import ADMIN_ORDER_TABS
from .serializers import (
    AdminNoteSerializer,
    AdminOrderDetailSerializer,
    AdminOrderExportSerializer,
    AdminOrderListRowSerializer,
    AdminOrderStatsSerializer,
    AdminOrderTabCountsSerializer,
    AdminRefundSerializer,
    AdminStatusUpdateSerializer,
    AdminTrackingSerializer,
    AdminWhatsAppSerializer,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _error(message, code="error", http_status_=400):
    return Response(
        {"code": code, "detail": message},
        status=http_status_,
    )


def _get_order_or_404(reference: str):
    """Load an order by reference, or return None."""
    return selectors.get_order_detail(reference)


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderListView(APIView):
    """
    GET /api/v1/admin/orders/

    Query params (all optional):
        ?tab=<key>              — one of ADMIN_ORDER_TABS keys
        ?search=<term>          — reference, email, phone, name
        ?payment_status=<value> — one of PaymentStatus values
        ?date_from=YYYY-MM-DD
        ?date_to=YYYY-MM-DD

    Returns `{ results: [...] }`.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = selectors.list_orders(
            tab=request.query_params.get("tab", "all"),
            search=request.query_params.get("search", ""),
            payment_status=request.query_params.get(
                "payment_status", "",
            ),
            date_from=request.query_params.get("date_from") or None,
            date_to=request.query_params.get("date_to") or None,
        )
        serializer = AdminOrderListRowSerializer(qs, many=True)
        return Response({"results": serializer.data})


# ─────────────────────────────────────────────────────────────────────────────
# Stats + tab counts
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderStatsView(APIView):
    """GET /api/v1/admin/orders/stats/"""

    permission_classes = [IsAdminUser]

    def get(self, request):
        stats = selectors.get_dashboard_stats()
        return Response(AdminOrderStatsSerializer(stats).data)


class AdminOrderTabCountsView(APIView):
    """GET /api/v1/admin/orders/tab-counts/"""

    permission_classes = [IsAdminUser]

    def get(self, request):
        counts = selectors.get_tab_counts()
        return Response(AdminOrderTabCountsSerializer(counts).data)


# ─────────────────────────────────────────────────────────────────────────────
# Detail
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderDetailView(APIView):
    """GET /api/v1/admin/orders/<reference>/"""

    permission_classes = [IsAdminUser]

    def get(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )
        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — status
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderStatusView(APIView):
    """
    PATCH /api/v1/admin/orders/<reference>/status/

    Body: { "status": "shipped", "note": "Handed to G4S." }
    """

    permission_classes = [IsAdminUser]

    def patch(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        ser = AdminStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            order = services.set_status(
                order,
                ser.validated_data["status"],
                actor=request.user,
                note=ser.validated_data.get("note", ""),
            )
        except ValueError as exc:
            return _error(str(exc), code="transition_not_allowed")

        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — tracking
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderTrackingView(APIView):
    """PATCH /api/v1/admin/orders/<reference>/tracking/"""

    permission_classes = [IsAdminUser]

    def patch(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        ser = AdminTrackingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        order = services.set_tracking(
            order,
            courier=ser.validated_data.get("courier", ""),
            tracking_number=ser.validated_data.get(
                "tracking_number", "",
            ),
            actor=request.user,
        )
        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — refund
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderRefundView(APIView):
    """POST /api/v1/admin/orders/<reference>/refund/"""

    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        ser = AdminRefundSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            order = services.refund_order(
                order,
                actor=request.user,
                amount=ser.validated_data.get("amount"),
                reason=ser.validated_data.get("reason", ""),
            )
        except ValueError as exc:
            return _error(str(exc), code="refund_error")

        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — mark returned
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderReturnView(APIView):
    """
    POST /api/v1/admin/orders/<reference>/returned/

    Shortcut for `set_status(RETURNED)`. Exists so the frontend has a
    dedicated button instead of the admin picking "Returned" from the
    status dropdown.
    """

    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        note = str(request.data.get("reason", "")).strip()[:500]

        try:
            order = services.set_status(
                order,
                "returned",
                actor=request.user,
                note=note or "Marked returned by admin.",
            )
        except ValueError as exc:
            return _error(str(exc), code="transition_not_allowed")

        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — internal note
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderNoteView(APIView):
    """POST /api/v1/admin/orders/<reference>/notes/"""

    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        ser = AdminNoteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            order = services.add_internal_note(
                order,
                text=ser.validated_data["text"],
                actor=request.user,
            )
        except ValueError as exc:
            return _error(str(exc), code="note_error")

        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — WhatsApp
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderWhatsAppView(APIView):
    """
    POST /api/v1/admin/orders/<reference>/whatsapp/

    Records the send on the order timeline. Does not deliver a message
    yet — no provider is wired up. The action is auditable; the
    delivery is a future integration.
    """

    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        ser = AdminWhatsAppSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            order = services.send_whatsapp_update(
                order,
                message=ser.validated_data["message"],
                actor=request.user,
            )
        except ValueError as exc:
            return _error(str(exc), code="whatsapp_error")

        return Response(AdminOrderDetailSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────────────
# Export
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderExportView(APIView):
    """
    POST /api/v1/admin/orders/export/

    Body carries the same filters the list accepts. Returns a CSV
    body with a `text/csv` content type. The frontend triggers a
    download with it.

    Synchronous for now. If the export grows past a few thousand rows,
    move it to `tasks.py` and return a job id instead.
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        ser = AdminOrderExportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        qs = selectors.list_orders(
            tab=d.get("tab") or "all",
            search=d.get("search") or "",
            payment_status=d.get("payment_status") or "",
            date_from=d.get("date_from"),
            date_to=d.get("date_to"),
        ).select_related("user")

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "Reference",
            "Date",
            "Customer",
            "Email",
            "Phone",
            "Items",
            "Subtotal",
            "Discount",
            "Shipping",
            "Tax",
            "Total",
            "Payment Method",
            "Payment Status",
            "Fulfillment Status",
            "Courier",
            "Tracking Number",
        ])

        for order in qs.iterator(chunk_size=500):
            writer.writerow([
                order.reference,
                order.created_at.isoformat(),
                _customer_name(order),
                order.contact_email,
                order.contact_phone,
                order.items.count(),
                str(order.subtotal),
                str(order.discount),
                str(order.shipping),
                str(order.tax),
                str(order.total),
                order.payment_method,
                order.payment_status,
                order.status,
                order.courier,
                order.tracking_number,
            ])

        csv_text = buf.getvalue()

        # Also return as JSON so the frontend can pick either shape.
        # The customer-side export uses JSON; keeping the same pattern
        # here means one frontend helper handles both.
        return Response({"csv": csv_text})