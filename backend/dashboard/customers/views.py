"""
Admin-facing endpoints for the Customers page.

Every view requires `IsAdminUser`. No endpoint returns raw ORM data —
all reads go through selectors, all writes go through services.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AddressWriteSerializer,
    BlockCustomerSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    CustomerNoteWriteSerializer,
    EmailSendSerializer,
    MarketingConsentSerializer,
    WhatsAppSendSerializer,
)
from . import selectors, services

User = get_user_model()


def _error(message, code="error", http=status.HTTP_400_BAD_REQUEST):
    return Response({"code": code, "detail": message}, status=http)


# ─────────────────────────────────────────────────────────────────────────────
# List + stats + segments
# ─────────────────────────────────────────────────────────────────────────────
class CustomerListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = selectors.list_customers(
            search=request.query_params.get("search") or None,
            segment=request.query_params.get("segment") or None,
            order_count=request.query_params.get("orders") or None,
            spent_range=request.query_params.get("spent") or None,
        )
        serializer = CustomerListSerializer(qs, many=True)
        return Response({
            "stats": selectors.get_dashboard_stats(),
            "segment_counts": selectors.get_segment_counts(),
            "results": serializer.data,
        })


class CustomerStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(selectors.get_dashboard_stats())


class SegmentCountsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(selectors.get_segment_counts())


# ─────────────────────────────────────────────────────────────────────────────
# Detail
# ─────────────────────────────────────────────────────────────────────────────
class CustomerDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, user_id):
        user = selectors.get_customer_detail(user_id)
        if not user:
            return _error("Customer not found.", "not_found", status.HTTP_404_NOT_FOUND)
        return Response(CustomerDetailSerializer(user).data)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — status
# ─────────────────────────────────────────────────────────────────────────────
class BlockCustomerView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        ser = BlockCustomerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = services.set_customer_status(user_id, ser.validated_data["blocked"])
        return Response({"status": user.status})


# ─────────────────────────────────────────────────────────────────────────────
# Actions — consent
# ─────────────────────────────────────────────────────────────────────────────
class MarketingConsentView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, user_id):
        ser = MarketingConsentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.set_marketing_consent(user_id, ser.validated_data["consent"])
        return Response({"consent": ser.validated_data["consent"]})


# ─────────────────────────────────────────────────────────────────────────────
# Actions — notes
# ─────────────────────────────────────────────────────────────────────────────
class NoteListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        ser = CustomerNoteWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        note = services.add_note(
            user_id=user_id,
            author_id=request.user.pk,
            text=ser.validated_data["text"],
        )
        from .serializers import CustomerNoteSerializer
        return Response(
            CustomerNoteSerializer(note).data,
            status=status.HTTP_201_CREATED,
        )


class NoteDeleteView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, user_id, note_id):
        services.delete_note(note_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Actions — messages
# ─────────────────────────────────────────────────────────────────────────────
class WhatsAppSendView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        ser = WhatsAppSendSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        log = services.send_whatsapp(
            user_id=user_id,
            message=ser.validated_data["message"],
            agent=request.user.get_username(),
        )
        return Response({"id": log.pk})


class EmailSendView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        ser = EmailSendSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        log = services.send_email(
            user_id=user_id,
            subject=ser.validated_data["subject"],
            body=ser.validated_data["body"],
            agent=request.user.get_username(),
        )
        return Response({"id": log.pk})


# ─────────────────────────────────────────────────────────────────────────────
# Actions — addresses
# ─────────────────────────────────────────────────────────────────────────────
class AddressCreateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        ser = AddressWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        from account.models import Address
        addr = Address.objects.create(
            user_id=user_id,
            label=data["label"],
            full_name=request.data.get("fullName", ""),
            phone=request.data.get("phone", ""),
            street=data["street"],
            town=data["town"],
            county=request.data.get("county", ""),
            postal_code=request.data.get("postal_code", ""),
            is_default=data.get("is_default", False),
        )
        from .serializers import CustomerAddressSerializer
        return Response(
            CustomerAddressSerializer(addr).data,
            status=status.HTTP_201_CREATED,
        )


class AddressDeleteView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, user_id, address_id):
        from account.models import Address
        Address.objects.filter(pk=address_id, user_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Export
# ─────────────────────────────────────────────────────────────────────────────
class ExportCustomersView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        """
        Synchronous CSV export. Swap for an async task + email link
        when the customer base grows past a few thousand rows.
        """
        csv_text = services.export_customers_csv_sync(request.data or {})
        return Response({"csv": csv_text})