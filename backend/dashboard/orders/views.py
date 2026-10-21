import csv
import io
import logging

from django.http import FileResponse
from rest_framework import status as http_status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import selectors, services
from .serializers import (
    AdminNoteSerializer,
    AdminOrderDetailSerializer,
    AdminOrderExportSerializer,
    AdminOrderListRowSerializer,
    AdminOrderStatsSerializer,
    AdminOrderTabCountsSerializer,
    AdminQRVerifyRequestSerializer,
    AdminQRVerifyResponseSerializer,
    AdminRefundSerializer,
    AdminStatusUpdateSerializer,
    AdminTrackingSerializer,
    AdminWhatsAppSerializer,
)

logger = logging.getLogger(__name__)


def _error(message, code="error", http_status_=400):
    return Response(
        {"code": code, "detail": message},
        status=http_status_,
    )


def _get_order_or_404(reference: str):
    return selectors.get_order_detail(reference)


class AdminOrderListView(APIView):
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


class AdminOrderStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        stats = selectors.get_dashboard_stats()
        return Response(AdminOrderStatsSerializer(stats).data)


class AdminOrderTabCountsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        counts = selectors.get_tab_counts()
        return Response(AdminOrderTabCountsSerializer(counts).data)


class AdminOrderDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )
        return Response(AdminOrderDetailSerializer(order).data)


class AdminOrderPdfView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        try:
            from .pdf import build_receipt_pdf
            pdf_buffer = build_receipt_pdf(order)
        except Exception:
            logger.exception(
                "Failed to render receipt PDF for order %s",
                order.reference,
            )
            return _error(
                "Could not render the receipt PDF.",
                code="pdf_error",
                http_status_=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response = FileResponse(
            pdf_buffer,
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="receipt-{order.reference}.pdf"'
        )
        return response


class AdminOrderVerifyQRView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        ser = AdminQRVerifyRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        order = selectors.get_order_by_qr_token(
            ser.validated_data["token"],
        )
        if not order:
            return _error(
                "No order matches this QR code.",
                code="qr_not_found",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        return Response(AdminQRVerifyResponseSerializer(order).data)


class AdminOrderFulfillQRView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = _get_order_or_404(reference)
        if not order:
            return _error(
                "Order not found.",
                http_status_=http_status.HTTP_404_NOT_FOUND,
            )

        try:
            order = services.mark_fulfilled(order, actor=request.user)
        except ValueError as exc:
            return _error(str(exc), code="fulfill_error")

        return Response(AdminQRVerifyResponseSerializer(order).data)


class AdminOrderStatusView(APIView):
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


class AdminOrderTrackingView(APIView):
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


class AdminOrderRefundView(APIView):
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


class AdminOrderReturnView(APIView):
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


class AdminOrderNoteView(APIView):
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


class AdminOrderWhatsAppView(APIView):
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


class AdminOrderExportView(APIView):
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
                order.customer_name,
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

        return Response({"csv": csv_text})