from datetime import timedelta
import os
import uuid

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q, Sum, Count, Avg
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Order
from checkout.services import change_order_status

from .models import (
    AdCampaign,
    AttributionLink,
    AuditLog,
    Automation,
    Campaign,
    ContentPost,
    Coupon,
    Creator,
    CreatorApplication,
    CreatorSale,
    CreatorSample,
    Customer,
    CustomerSegment,
    DeliveryZone,
    DirectOrder,
    DirectOrderItem,
    DirectProduct,
    Expense,
    FollowUp,
    InboxConversation,
    InboxMessage,
    Integration,
    InventoryMovement,
    Lead,
    LiveSession,
    Location,
    Notification,
    NotificationSetting,
    Partnership,
    PayoutBatch,
    PermissionGroup,
    ProductVariant,
    PurchaseOrder,
    ReturnRequest,
    Review,
    Supplier,
    SupportTicket,
    TeamMember,
)
from .serializers import (
    AdCampaignSerializer,
    AttributionLinkSerializer,
    AuditLogSerializer,
    AutomationSerializer,
    CampaignSerializer,
    ContentPostSerializer,
    CouponSerializer,
    CreatorApplicationSerializer,
    CreatorSaleSerializer,
    CreatorSampleSerializer,
    CreatorSerializer,
    CustomerSegmentSerializer,
    CustomerSerializer,
    CustomerStatsSerializer,
    DeliveryZoneSerializer,
    DirectOrderReadSerializer,
    DirectOrderSerializer,
    DirectOrderStatusSerializer,
    DirectOrderWriteSerializer,
    DirectProductSerializer,
    DirectProductWriteSerializer,
    ExpenseSerializer,
    FollowUpSerializer,
    InboxConversationSerializer,
    InboxMessageSerializer,
    IntegrationSerializer,
    InventoryMovementSerializer,
    LeadSerializer,
    LiveSessionSerializer,
    LocationSerializer,
    NotificationSerializer,
    NotificationSettingSerializer,
    PartnershipSerializer,
    PayoutBatchSerializer,
    PermissionGroupSerializer,
    ProductCreateSerializer,
    ProductVariantSerializer,
    PurchaseOrderSerializer,
    ReturnRequestSerializer,
    ReviewSerializer,
    SupplierSerializer,
    SupportTicketSerializer,
    TeamMemberSerializer,
)


def _orders_base_qs():
    return (
        Order.objects
        .select_related("user")
        .prefetch_related(
            "items",
            "payments",
            "status_events",
            "creator_sales__creator",
        )
    )


def _apply_order_filters(qs, request):
    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(reference__icontains=q)
            | Q(contact_email__icontains=q)
            | Q(contact_phone__icontains=q)
            | Q(snapshot__full_name__icontains=q)
        )

    source = (request.query_params.get("source") or "").strip().lower()
    if source:
        qs = qs.filter(source=source)

    date_range = (request.query_params.get("dateRange") or "").strip()
    now = timezone.now()
    if date_range == "Today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        qs = qs.filter(created_at__gte=start)
    elif date_range == "Yesterday":
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        qs = qs.filter(
            created_at__gte=start_today - timedelta(days=1),
            created_at__lt=start_today,
        )
    elif date_range == "Last 7 Days":
        qs = qs.filter(created_at__gte=now - timedelta(days=7))
    elif date_range == "Last 30 Days":
        qs = qs.filter(created_at__gte=now - timedelta(days=30))

    return qs


MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024

ALLOWED_IMAGE_MIMES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
ALLOWED_VIDEO_MIMES = {
    "video/mp4",
    "video/quicktime",
    "video/webm",
}


def _paginate(qs, request, default_limit=500):
    try:
        limit = int(request.query_params.get("limit") or default_limit)
    except (TypeError, ValueError):
        limit = default_limit
    limit = max(1, min(limit, 1000))

    try:
        offset = int(request.query_params.get("offset") or 0)
    except (TypeError, ValueError):
        offset = 0
    offset = max(0, offset)

    total = qs.count()
    rows = qs[offset: offset + limit]
    return rows, total, limit, offset


def _paginated_response(serializer_cls, qs, request, **serializer_kwargs):
    rows, total, limit, offset = _paginate(qs, request)
    data = serializer_cls(
        rows, many=True, context={"request": request}, **serializer_kwargs,
    ).data
    return Response(
        {
            "results": data,
            "count": total,
            "limit": limit,
            "offset": offset,
            "hasMore": offset + limit < total,
        }
    )


class UploadView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        kind = (request.data.get("kind") or "").strip().lower()

        if kind not in {"image", "video"}:
            return Response(
                {"detail": "`kind` must be 'image' or 'video'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not upload:
            return Response(
                {"detail": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if kind == "image" and upload.size > MAX_IMAGE_BYTES:
            return Response(
                {"detail": "Image must be smaller than 5 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if kind == "video" and upload.size > MAX_VIDEO_BYTES:
            return Response(
                {"detail": "Video must be smaller than 100 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = (upload.content_type or "").lower()
        allowed = ALLOWED_IMAGE_MIMES if kind == "image" else ALLOWED_VIDEO_MIMES
        if content_type not in allowed:
            return Response(
                {"detail": f"Unsupported {kind} type: {content_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = os.path.splitext(upload.name)[1].lower() or self._default_ext(content_type)
        key = f"direct-orders/{kind}s/{uuid.uuid4().hex}{ext}"

        try:
            saved_path = default_storage.save(key, upload)
            relative = default_storage.url(saved_path)
            absolute = request.build_absolute_uri(relative)
        except Exception as exc:
            return Response(
                {"detail": f"Storage error: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"url": absolute}, status=status.HTTP_200_OK)

    @staticmethod
    def _default_ext(content_type: str) -> str:
        return {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "video/mp4": ".mp4",
            "video/quicktime": ".mov",
            "video/webm": ".webm",
        }.get(content_type, "")


class DirectOrderListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            DirectOrder.objects
            .prefetch_related("items")
            .select_related("creator", "customer")
            .order_by("-created_at")
        )

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(reference__icontains=q)
                | Q(customer_name__icontains=q)
                | Q(customer_phone__icontains=q)
                | Q(customer_email__icontains=q)
            )

        source = (request.query_params.get("source") or "").strip().lower()
        if source:
            qs = qs.filter(source=source)

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        verification = (request.query_params.get("verification") or "").strip()
        if verification:
            qs = qs.filter(verification_status=verification)

        now = timezone.now()
        date_range = (request.query_params.get("dateRange") or "").strip()
        if date_range == "Today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            qs = qs.filter(created_at__gte=start)
        elif date_range == "Yesterday":
            start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            qs = qs.filter(
                created_at__gte=start_today - timedelta(days=1),
                created_at__lt=start_today,
            )
        elif date_range == "Last 7 Days":
            qs = qs.filter(created_at__gte=now - timedelta(days=7))
        elif date_range == "Last 30 Days":
            qs = qs.filter(created_at__gte=now - timedelta(days=30))

        return _paginated_response(DirectOrderReadSerializer, qs, request)

    def post(self, request):
        ser = DirectOrderWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        order = ser.save()
        return Response(
            DirectOrderReadSerializer(
                order, context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class DirectOrderDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, reference):
        return (
            DirectOrder.objects
            .select_related("creator", "customer")
            .prefetch_related("items")
            .filter(reference=reference)
            .first()
        )

    def get(self, request, reference):
        order = self._get(reference)
        if not order:
            return Response({"detail": "Not found."}, status=404)
        return Response(
            DirectOrderReadSerializer(
                order, context={"request": request},
            ).data,
        )

    def patch(self, request, reference):
        order = self._get(reference)
        if not order:
            return Response({"detail": "Not found."}, status=404)
        ser = DirectOrderWriteSerializer(order, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            DirectOrderReadSerializer(
                order, context={"request": request},
            ).data,
        )

    def delete(self, request, reference):
        order = self._get(reference)
        if order:
            order.delete()
        return Response(status=204)


class DirectOrderStatusAdvanceView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = DirectOrder.objects.filter(reference=reference).first()
        if not order:
            return Response({"detail": "Not found."}, status=404)

        ser = DirectOrderStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        next_status = ser.validated_data["status"]

        order.status = next_status

        if next_status in {"Paid", "Awaiting Shipment", "Shipped", "Delivered"}:
            order.payment_status = "paid"
        elif next_status in {"Cancelled", "Returned"}:
            order.payment_status = "refunded"

        if next_status == "Delivered" and order.delivered_at is None:
            order.delivered_at = timezone.now()

        order.save(
            update_fields=[
                "status", "payment_status", "delivered_at", "updated_at",
            ]
        )
        return Response(
            DirectOrderReadSerializer(
                order, context={"request": request},
            ).data,
        )


class DirectOrderReconcileView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, reference):
        order = DirectOrder.objects.filter(reference=reference).first()
        if not order:
            return Response({"detail": "Not found."}, status=404)

        new_status = (request.data.get("verificationStatus") or "").strip()
        if new_status not in {"unverified", "verified", "failed"}:
            return Response(
                {"detail": "verificationStatus must be unverified, verified, or failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.verification_status = new_status
        if new_status == "verified":
            order.payment_status = "paid"
            if order.status == "Awaiting Payment":
                order.status = "Paid"

        order.save(
            update_fields=[
                "verification_status", "payment_status", "status", "updated_at",
            ]
        )

        AuditLog.objects.create(
            action="status_change",
            entity="DirectOrder",
            entity_id=str(order.pk),
            summary=f"{order.reference}: verification={new_status}",
            actor=request.user if request.user.is_authenticated else None,
        )

        return Response(
            DirectOrderReadSerializer(
                order, context={"request": request},
            ).data,
        )


class CheckoutOrderListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _orders_base_qs().order_by("-created_at")
        qs = _apply_order_filters(qs, request)

        status_filter = (request.query_params.get("status") or "").strip()

        rows = DirectOrderSerializer(
            qs[:500],
            many=True,
            context={"request": request},
        ).data

        if status_filter:
            rows = [r for r in rows if r["status"] == status_filter]

        return Response(rows)


class CheckoutOrderDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, reference):
        order = _orders_base_qs().filter(reference=reference).first()
        if not order:
            return Response({"detail": "Not found."}, status=404)
        return Response(
            DirectOrderSerializer(
                order, context={"request": request},
            ).data,
        )


class CheckoutOrderAdvanceView(APIView):
    permission_classes = [IsAdminUser]

    FRONTEND_TO_BACKEND = {
        "New": "pending",
        "Awaiting Payment": "pending",
        "Paid": "confirmed",
        "Awaiting Shipment": "processing",
        "Shipped": "shipped",
        "Delivered": "delivered",
        "Cancelled": "cancelled",
        "Returned": "returned",
    }

    ALLOWED_BACKEND = {
        "confirmed", "processing", "shipped",
        "delivered", "cancelled", "returned",
    }

    def post(self, request, reference):
        order = _orders_base_qs().filter(reference=reference).first()
        if not order:
            return Response({"detail": "Not found."}, status=404)

        raw_next = (request.data.get("next") or "").strip()
        if not raw_next:
            return Response({"detail": "'next' is required."}, status=400)

        backend_next = self.FRONTEND_TO_BACKEND.get(raw_next, raw_next.lower())

        if backend_next not in self.ALLOWED_BACKEND:
            return Response(
                {"detail": f"Invalid status '{raw_next}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        note = (request.data.get("note") or "").strip()

        change_order_status(
            order,
            backend_next,
            actor=request.user,
            actor_label="Admin",
            note=note,
        )

        order.refresh_from_db()
        return Response(
            DirectOrderSerializer(
                order, context={"request": request},
            ).data,
        )


class CreatorListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            Creator.objects
            .all()
            .annotate(
                _commission_owed=Sum(
                    "sales__commission_amount",
                    filter=Q(sales__paid=False),
                ),
                _commission_paid=Sum(
                    "sales__commission_amount",
                    filter=Q(sales__paid=True),
                ),
            )
            .order_by("-updated_at")
        )

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(handle__icontains=q))

        return Response(
            CreatorSerializer(
                qs, many=True, context={"request": request},
            ).data,
        )

    def post(self, request):
        ser = CreatorSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        creator = ser.save()
        return Response(
            CreatorSerializer(creator, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CreatorDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Creator.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(CreatorSerializer(c, context={"request": request}).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = CreatorSerializer(c, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CreatorSerializer(c, context={"request": request}).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


class CreatorSaleListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            CreatorSale.objects
            .select_related("creator", "order")
            .order_by("-attributed_at")
        )

        creator_id = request.query_params.get("creator")
        if creator_id:
            qs = qs.filter(creator_id=creator_id)

        paid = request.query_params.get("paid")
        if paid is not None and paid != "":
            qs = qs.filter(paid=paid.lower() in {"1", "true", "yes"})

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response(CreatorSaleSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = CreatorSaleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sale = ser.save()
        return Response(
            CreatorSaleSerializer(sale).data,
            status=status.HTTP_201_CREATED,
        )


class CreatorSaleDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return (
            CreatorSale.objects
            .select_related("creator", "order")
            .filter(pk=pk)
            .first()
        )

    def get(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        return Response(CreatorSaleSerializer(s).data)

    def patch(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)

        was_paid = s.paid
        ser = CreatorSaleSerializer(s, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()

        if not was_paid and s.paid and s.paid_at is None:
            s.paid_at = timezone.now()
            s.save(update_fields=["paid_at"])

        return Response(CreatorSaleSerializer(s).data)

    def delete(self, request, pk):
        s = self._get(pk)
        if s:
            s.delete()
        return Response(status=204)


class PayoutBatchListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = PayoutBatch.objects.select_related("creator").order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        creator_id = request.query_params.get("creator")
        if creator_id:
            qs = qs.filter(creator_id=creator_id)
        return Response(PayoutBatchSerializer(qs[:200], many=True).data)

    def post(self, request):
        ser = PayoutBatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        sale_ids = request.data.get("saleIds") or []
        batch = ser.save()

        if not batch.amount:
            batch.amount = request.data.get("amount") or 0
            batch.save(update_fields=["amount", "updated_at"])

        if sale_ids:
            CreatorSale.objects.filter(pk__in=sale_ids).update(payout=batch)
            batch.recompute_totals()
            if not batch.amount:
                batch.amount = batch.total_amount
                batch.save(update_fields=["amount", "updated_at"])

        return Response(
            PayoutBatchSerializer(batch).data,
            status=status.HTTP_201_CREATED,
        )


class PayoutBatchDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return PayoutBatch.objects.filter(pk=pk).first()

    def get(self, request, pk):
        b = self._get(pk)
        if not b:
            return Response({"detail": "Not found."}, status=404)
        return Response(PayoutBatchSerializer(b).data)

    def patch(self, request, pk):
        b = self._get(pk)
        if not b:
            return Response({"detail": "Not found."}, status=404)

        previous_status = b.status
        ser = PayoutBatchSerializer(b, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()

        if b.status == "Approved" and b.approved_at is None:
            b.approved_at = timezone.now()
            b.approved_by = request.user if request.user.is_authenticated else None
            b.save(update_fields=["approved_at", "approved_by"])

        if b.status == "Paid" and b.paid_at is None:
            b.paid_at = timezone.now()
            b.sales.update(
                paid=True,
                paid_at=timezone.now(),
                payout_reference=b.reference,
                status="Paid",
            )
            b.save(update_fields=["paid_at"])

        if previous_status != b.status:
            AuditLog.objects.create(
                action="payout",
                entity="PayoutBatch",
                entity_id=str(b.pk),
                summary=f"{b.reference}: {previous_status} → {b.status}",
                actor=request.user if request.user.is_authenticated else None,
            )

        return Response(PayoutBatchSerializer(b).data)

    def delete(self, request, pk):
        b = self._get(pk)
        if b:
            b.delete()
        return Response(status=204)


class ContentListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = ContentPost.objects.all().order_by("-scheduled_at", "-created_at")

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response(
            ContentPostSerializer(
                qs, many=True, context={"request": request},
            ).data,
        )

    def post(self, request):
        ser = ContentPostSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        post = ser.save()
        return Response(
            ContentPostSerializer(
                post, context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ContentDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return ContentPost.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(
            ContentPostSerializer(
                c, context={"request": request},
            ).data,
        )

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = ContentPostSerializer(c, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            ContentPostSerializer(
                c, context={"request": request},
            ).data,
        )

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


class LiveListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = LiveSession.objects.all().order_by("-scheduled_start")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(LiveSessionSerializer(qs, many=True).data)

    def post(self, request):
        ser = LiveSessionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        live = ser.save()
        return Response(
            LiveSessionSerializer(live).data,
            status=status.HTTP_201_CREATED,
        )


class LiveDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return LiveSession.objects.filter(pk=pk).first()

    def get(self, request, pk):
        live = self._get(pk)
        if not live:
            return Response({"detail": "Not found."}, status=404)
        return Response(LiveSessionSerializer(live).data)

    def patch(self, request, pk):
        live = self._get(pk)
        if not live:
            return Response({"detail": "Not found."}, status=404)
        ser = LiveSessionSerializer(live, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(LiveSessionSerializer(live).data)

    def delete(self, request, pk):
        live = self._get(pk)
        if live:
            live.delete()
        return Response(status=204)


class DirectProductListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            DirectProduct.objects
            .select_related("product", "product__brand", "product__category", "supplier")
            .prefetch_related("product__images", "variants")
            .order_by("-updated_at")
        )

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(product__name__icontains=q)
                | Q(product__slug__icontains=q)
            )

        low_stock = request.query_params.get("lowStock")
        if low_stock and low_stock.lower() in {"1", "true", "yes"}:
            qs = qs.filter(product__stock_quantity__lte=5)

        return Response(
            DirectProductSerializer(
                qs, many=True, context={"request": request},
            ).data,
        )

    def post(self, request):
        ser = ProductCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        wrapper = ser.save()
        wrapper = (
            DirectProduct.objects
            .select_related("product", "product__brand", "product__category", "supplier")
            .prefetch_related("product__images", "variants")
            .get(pk=wrapper.pk)
        )
        return Response(
            DirectProductSerializer(
                wrapper, context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class DirectProductDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return (
            DirectProduct.objects
            .select_related("product", "product__brand", "product__category", "supplier")
            .prefetch_related("product__images", "variants")
            .filter(pk=pk)
            .first()
        )

    def get(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({"detail": "Not found."}, status=404)
        return Response(
            DirectProductSerializer(
                p, context={"request": request},
            ).data,
        )

    def patch(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({"detail": "Not found."}, status=404)
        ser = DirectProductWriteSerializer(p, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            DirectProductSerializer(
                p, context={"request": request},
            ).data,
        )

    def delete(self, request, pk):
        p = self._get(pk)
        if p:
            p.delete()
        return Response(status=204)


class ProductVariantListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = ProductVariant.objects.all().order_by("product_id", "id")
        product_id = request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return Response(ProductVariantSerializer(qs, many=True).data)

    def post(self, request):
        ser = ProductVariantSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.save()
        return Response(
            ProductVariantSerializer(v).data,
            status=status.HTTP_201_CREATED,
        )


class ProductVariantDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return ProductVariant.objects.filter(pk=pk).first()

    def get(self, request, pk):
        v = self._get(pk)
        if not v:
            return Response({"detail": "Not found."}, status=404)
        return Response(ProductVariantSerializer(v).data)

    def patch(self, request, pk):
        v = self._get(pk)
        if not v:
            return Response({"detail": "Not found."}, status=404)
        ser = ProductVariantSerializer(v, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ProductVariantSerializer(v).data)

    def delete(self, request, pk):
        v = self._get(pk)
        if v:
            v.delete()
        return Response(status=204)


class SupplierListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Supplier.objects.all().order_by("name")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(phone__icontains=q))
        return Response(SupplierSerializer(qs, many=True).data)

    def post(self, request):
        ser = SupplierSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        s = ser.save()
        return Response(
            SupplierSerializer(s).data,
            status=status.HTTP_201_CREATED,
        )


class SupplierDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Supplier.objects.filter(pk=pk).first()

    def get(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        return Response(SupplierSerializer(s).data)

    def patch(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        ser = SupplierSerializer(s, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(SupplierSerializer(s).data)

    def delete(self, request, pk):
        s = self._get(pk)
        if s:
            s.delete()
        return Response(status=204)


class PurchaseOrderListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            PurchaseOrder.objects
            .select_related("supplier")
            .prefetch_related("items")
            .order_by("-created_at")
        )
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(PurchaseOrderSerializer(qs[:200], many=True).data)

    def post(self, request):
        ser = PurchaseOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        po = ser.save()
        return Response(
            PurchaseOrderSerializer(po).data,
            status=status.HTTP_201_CREATED,
        )


class PurchaseOrderDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return (
            PurchaseOrder.objects
            .select_related("supplier")
            .prefetch_related("items")
            .filter(pk=pk)
            .first()
        )

    def get(self, request, pk):
        po = self._get(pk)
        if not po:
            return Response({"detail": "Not found."}, status=404)
        return Response(PurchaseOrderSerializer(po).data)

    def patch(self, request, pk):
        po = self._get(pk)
        if not po:
            return Response({"detail": "Not found."}, status=404)

        previous_status = po.status
        ser = PurchaseOrderSerializer(po, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        po = ser.save()

        if po.status == "Received" and po.received_at is None:
            po.received_at = timezone.now()
            po.save(update_fields=["received_at"])

            for item in po.items.select_related("product").all():
                if not item.product_id:
                    continue
                InventoryMovement.objects.create(
                    product_id=item.product_id,
                    kind="in",
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    reference=po.reference,
                    notes=f"Received from PO {po.reference}",
                )

        if previous_status != po.status:
            AuditLog.objects.create(
                action="status_change",
                entity="PurchaseOrder",
                entity_id=str(po.pk),
                summary=f"{po.reference}: {previous_status} → {po.status}",
                actor=request.user if request.user.is_authenticated else None,
            )

        return Response(PurchaseOrderSerializer(po).data)

    def delete(self, request, pk):
        po = self._get(pk)
        if po:
            po.delete()
        return Response(status=204)


class LocationListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Location.objects.all().order_by("name")
        return Response(LocationSerializer(qs, many=True).data)

    def post(self, request):
        ser = LocationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        loc = ser.save()
        return Response(
            LocationSerializer(loc).data,
            status=status.HTTP_201_CREATED,
        )


class LocationDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Location.objects.filter(pk=pk).first()

    def get(self, request, pk):
        loc = self._get(pk)
        if not loc:
            return Response({"detail": "Not found."}, status=404)
        return Response(LocationSerializer(loc).data)

    def patch(self, request, pk):
        loc = self._get(pk)
        if not loc:
            return Response({"detail": "Not found."}, status=404)
        ser = LocationSerializer(loc, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(LocationSerializer(loc).data)

    def delete(self, request, pk):
        loc = self._get(pk)
        if loc:
            loc.delete()
        return Response(status=204)


class InventoryMovementListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            InventoryMovement.objects
            .select_related("product", "variant", "location")
            .order_by("-created_at")
        )

        product_id = request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)

        kind = request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)

        return Response(InventoryMovementSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = InventoryMovementSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        movement = ser.save(
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(
            InventoryMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryMovementDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        m = InventoryMovement.objects.filter(pk=pk).first()
        if not m:
            return Response({"detail": "Not found."}, status=404)
        return Response(InventoryMovementSerializer(m).data)


class InventorySummaryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            DirectProduct.objects
            .select_related("product")
            .prefetch_related("variants")
        )

        out_of_stock = []
        low_stock = []
        healthy = []
        total_value = 0

        for product in qs:
            catalog = getattr(product, "product", None)
            stock = getattr(catalog, "stock_quantity", 0) if catalog else 0
            price = getattr(catalog, "price", 0) if catalog else 0
            threshold = product.low_stock_threshold or 5

            try:
                total_value += float(price) * int(stock)
            except Exception:
                pass

            entry = {
                "id": product.pk,
                "name": getattr(catalog, "name", "") if catalog else "",
                "sku": getattr(catalog, "slug", "") if catalog else "",
                "stock": stock,
                "threshold": threshold,
                "reorderPoint": product.reorder_point,
            }

            if stock <= 0:
                out_of_stock.append(entry)
            elif stock <= threshold:
                low_stock.append(entry)
            else:
                healthy.append(entry)

        return Response(
            {
                "totalSkus": qs.count(),
                "outOfStock": out_of_stock,
                "lowStock": low_stock,
                "healthy": healthy,
                "stockValue": round(total_value, 2),
            }
        )


class CustomerListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Customer.objects.all().order_by("-last_order_at", "-created_at")

        segment = (request.query_params.get("segment") or "").strip()
        if segment:
            qs = qs.filter(segment=segment)

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(phone__icontains=q)
                | Q(email__icontains=q)
                | Q(username__icontains=q)
            )

        return _paginated_response(CustomerSerializer, qs, request)

    def post(self, request):
        ser = CustomerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        c = ser.save()
        return Response(
            CustomerSerializer(c).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Customer.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(CustomerSerializer(c).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = CustomerSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CustomerSerializer(c).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


class CustomerStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        total = Customer.objects.count()
        repeat = Customer.objects.filter(total_orders__gte=2).count()
        vip = Customer.objects.filter(segment="VIP").count()
        new = Customer.objects.filter(segment="New").count()
        inactive = Customer.objects.filter(segment="Inactive").count()
        aggregate = Customer.objects.aggregate(spend=Sum("lifetime_spend"), avg=Avg("lifetime_spend"))
        total_spend = aggregate["spend"] or 0
        avg_spend = aggregate["avg"] or 0

        data = {
            "total": total,
            "vip": vip,
            "repeat": repeat,
            "new": new,
            "inactive": inactive,
            "repeatRate": round((repeat / total) * 100, 2) if total else 0,
            "totalSpend": total_spend,
            "avgSpend": avg_spend,
        }
        return Response(CustomerStatsSerializer(data).data)


class InboxConversationListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            InboxConversation.objects
            .select_related("customer", "assigned_to", "converted_order")
            .prefetch_related("messages")
            .order_by("-last_message_at", "-created_at")
        )

        channel = (request.query_params.get("channel") or "").strip()
        if channel:
            qs = qs.filter(channel=channel)

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(contact_name__icontains=q)
                | Q(contact_handle__icontains=q)
                | Q(subject__icontains=q)
            )

        return Response(
            InboxConversationSerializer(qs[:200], many=True).data
        )

    def post(self, request):
        ser = InboxConversationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        convo = ser.save()
        return Response(
            InboxConversationSerializer(convo).data,
            status=status.HTTP_201_CREATED,
        )


class InboxConversationDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return (
            InboxConversation.objects
            .prefetch_related("messages")
            .filter(pk=pk)
            .first()
        )

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(InboxConversationSerializer(c).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = InboxConversationSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(InboxConversationSerializer(c).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


class InboxMessageListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            InboxMessage.objects
            .select_related("conversation")
            .order_by("created_at")
        )
        conversation_id = request.query_params.get("conversation")
        if conversation_id:
            qs = qs.filter(conversation_id=conversation_id)
        return Response(InboxMessageSerializer(qs[:1000], many=True).data)

    def post(self, request):
        ser = InboxMessageSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = ser.save(
            sent_by=request.user if request.user.is_authenticated else None,
        )
        conversation = message.conversation
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=["last_message_at", "updated_at"])
        return Response(
            InboxMessageSerializer(message).data,
            status=status.HTTP_201_CREATED,
        )


class InboxConvertView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        convo = InboxConversation.objects.filter(pk=pk).first()
        if not convo:
            return Response({"detail": "Not found."}, status=404)

        order_payload = request.data or {}
        order_payload.setdefault("customerName", convo.contact_name or "—")
        order_payload.setdefault("customerPhone", convo.contact_handle or "")
        order_payload.setdefault("source", "tiktok_dm")

        ser = DirectOrderWriteSerializer(data=order_payload)
        ser.is_valid(raise_exception=True)
        order = ser.save()

        convo.converted_order = order
        convo.status = "converted"
        if convo.customer_id is None:
            try:
                customer, _ = Customer.objects.get_or_create(
                    phone=order.customer_phone,
                    defaults={
                        "name": order.customer_name,
                        "email": order.customer_email,
                    },
                )
                convo.customer = customer
            except Exception:
                pass
        convo.save()

        return Response(
            DirectOrderReadSerializer(
                order, context={"request": request},
            ).data,
        )


class LeadListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Lead.objects.all().order_by("-created_at")

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        source = (request.query_params.get("source") or "").strip()
        if source:
            qs = qs.filter(source=source)

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(handle__icontains=q)
                | Q(phone__icontains=q)
            )

        return _paginated_response(LeadSerializer, qs, request)

    def post(self, request):
        ser = LeadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lead = ser.save()
        return Response(
            LeadSerializer(lead).data,
            status=status.HTTP_201_CREATED,
        )


class LeadDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Lead.objects.filter(pk=pk).first()

    def get(self, request, pk):
        lead = self._get(pk)
        if not lead:
            return Response({"detail": "Not found."}, status=404)
        return Response(LeadSerializer(lead).data)

    def patch(self, request, pk):
        lead = self._get(pk)
        if not lead:
            return Response({"detail": "Not found."}, status=404)
        ser = LeadSerializer(lead, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(LeadSerializer(lead).data)

    def delete(self, request, pk):
        lead = self._get(pk)
        if lead:
            lead.delete()
        return Response(status=204)


class LeadConvertView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        lead = Lead.objects.filter(pk=pk).first()
        if not lead:
            return Response({"detail": "Not found."}, status=404)

        payload = request.data or {}
        payload.setdefault("customerName", lead.name)
        payload.setdefault("customerPhone", lead.phone)
        payload.setdefault("customerEmail", lead.email)
        payload.setdefault("source", lead.source or "tiktok_dm")

        ser = DirectOrderWriteSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        order = ser.save()

        lead.status = "Converted"
        lead.converted_order = order
        lead.save(update_fields=["status", "converted_order", "updated_at"])

        return Response(
            {
                "lead": LeadSerializer(lead).data,
                "order": DirectOrderReadSerializer(
                    order, context={"request": request},
                ).data,
            }
        )


class FollowUpListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = FollowUp.objects.all().order_by("date")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(FollowUpSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = FollowUpSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        f = ser.save()
        return Response(
            FollowUpSerializer(f).data,
            status=status.HTTP_201_CREATED,
        )


class FollowUpDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return FollowUp.objects.filter(pk=pk).first()

    def get(self, request, pk):
        f = self._get(pk)
        if not f:
            return Response({"detail": "Not found."}, status=404)
        return Response(FollowUpSerializer(f).data)

    def patch(self, request, pk):
        f = self._get(pk)
        if not f:
            return Response({"detail": "Not found."}, status=404)
        ser = FollowUpSerializer(f, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(FollowUpSerializer(f).data)

    def delete(self, request, pk):
        f = self._get(pk)
        if f:
            f.delete()
        return Response(status=204)


class SupportTicketListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = SupportTicket.objects.select_related("customer", "order").order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        priority = (request.query_params.get("priority") or "").strip()
        if priority:
            qs = qs.filter(priority=priority)
        return Response(SupportTicketSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = SupportTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        if not ser.validated_data.get("reference"):
            import random
            ser.validated_data["reference"] = f"TCK-{random.randint(10000, 99999)}"

        t = ser.save()
        return Response(
            SupportTicketSerializer(t).data,
            status=status.HTTP_201_CREATED,
        )


class SupportTicketDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return SupportTicket.objects.filter(pk=pk).first()

    def get(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        return Response(SupportTicketSerializer(t).data)

    def patch(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        ser = SupportTicketSerializer(t, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if t.status in {"Resolved", "Closed"} and t.resolved_at is None:
            t.resolved_at = timezone.now()
            t.save(update_fields=["resolved_at"])
        return Response(SupportTicketSerializer(t).data)

    def delete(self, request, pk):
        t = self._get(pk)
        if t:
            t.delete()
        return Response(status=204)


class CustomerSegmentListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = CustomerSegment.objects.all().order_by("name")
        return Response(CustomerSegmentSerializer(qs, many=True).data)

    def post(self, request):
        ser = CustomerSegmentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        s = ser.save()
        return Response(
            CustomerSegmentSerializer(s).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerSegmentDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return CustomerSegment.objects.filter(pk=pk).first()

    def get(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        return Response(CustomerSegmentSerializer(s).data)

    def patch(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        ser = CustomerSegmentSerializer(s, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CustomerSegmentSerializer(s).data)

    def delete(self, request, pk):
        s = self._get(pk)
        if s:
            s.delete()
        return Response(status=204)


class TeamMemberListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = TeamMember.objects.all().order_by("name")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        role = (request.query_params.get("role") or "").strip()
        if role:
            qs = qs.filter(role=role)
        return Response(TeamMemberSerializer(qs, many=True).data)

    def post(self, request):
        ser = TeamMemberSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        member = ser.save()
        return Response(
            TeamMemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )


class TeamMemberDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return TeamMember.objects.filter(pk=pk).first()

    def get(self, request, pk):
        m = self._get(pk)
        if not m:
            return Response({"detail": "Not found."}, status=404)
        return Response(TeamMemberSerializer(m).data)

    def patch(self, request, pk):
        m = self._get(pk)
        if not m:
            return Response({"detail": "Not found."}, status=404)
        ser = TeamMemberSerializer(m, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(TeamMemberSerializer(m).data)

    def delete(self, request, pk):
        m = self._get(pk)
        if m:
            m.delete()
        return Response(status=204)


class ReturnRequestListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            ReturnRequest.objects
            .select_related("order")
            .order_by("-created_at")
        )
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(ReturnRequestSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = ReturnRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        if not ser.validated_data.get("reference"):
            import random
            ser.validated_data["reference"] = f"RT-{random.randint(10000, 99999)}"

        ret = ser.save()
        return Response(
            ReturnRequestSerializer(ret).data,
            status=status.HTTP_201_CREATED,
        )


class ReturnRequestDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return ReturnRequest.objects.select_related("order").filter(pk=pk).first()

    def get(self, request, pk):
        r = self._get(pk)
        if not r:
            return Response({"detail": "Not found."}, status=404)
        return Response(ReturnRequestSerializer(r).data)

    def patch(self, request, pk):
        r = self._get(pk)
        if not r:
            return Response({"detail": "Not found."}, status=404)
        ser = ReturnRequestSerializer(r, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ret = ser.save()

        if ret.status in {"Refunded", "Received"} and ret.resolved_at is None:
            ret.resolved_at = timezone.now()
            ret.resolved_by = request.user if request.user.is_authenticated else None
            ret.save(update_fields=["resolved_at", "resolved_by"])

        return Response(ReturnRequestSerializer(ret).data)

    def delete(self, request, pk):
        r = self._get(pk)
        if r:
            r.delete()
        return Response(status=204)


class ExpenseListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Expense.objects.all().order_by("-paid_on", "-created_at")

        category = (request.query_params.get("category") or "").strip()
        if category:
            qs = qs.filter(category=category)

        return _paginated_response(ExpenseSerializer, qs, request)

    def post(self, request):
        ser = ExpenseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        e = ser.save(
            recorded_by=request.user if request.user.is_authenticated else None,
        )
        return Response(
            ExpenseSerializer(e).data,
            status=status.HTTP_201_CREATED,
        )


class ExpenseDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Expense.objects.filter(pk=pk).first()

    def get(self, request, pk):
        e = self._get(pk)
        if not e:
            return Response({"detail": "Not found."}, status=404)
        return Response(ExpenseSerializer(e).data)

    def patch(self, request, pk):
        e = self._get(pk)
        if not e:
            return Response({"detail": "Not found."}, status=404)
        ser = ExpenseSerializer(e, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ExpenseSerializer(e).data)

    def delete(self, request, pk):
        e = self._get(pk)
        if e:
            e.delete()
        return Response(status=204)


class AutomationListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Automation.objects.all().order_by("-updated_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(AutomationSerializer(qs, many=True).data)

    def post(self, request):
        ser = AutomationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        a = ser.save()
        return Response(
            AutomationSerializer(a).data,
            status=status.HTTP_201_CREATED,
        )


class AutomationDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Automation.objects.filter(pk=pk).first()

    def get(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        return Response(AutomationSerializer(a).data)

    def patch(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        ser = AutomationSerializer(a, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(AutomationSerializer(a).data)

    def delete(self, request, pk):
        a = self._get(pk)
        if a:
            a.delete()
        return Response(status=204)


class NotificationListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Notification.objects.all().order_by("-created_at")
        unread = request.query_params.get("unread")
        if unread and unread.lower() in {"1", "true", "yes"}:
            qs = qs.filter(read_at__isnull=True)
        return Response(NotificationSerializer(qs[:200], many=True).data)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        n = Notification.objects.filter(pk=pk).first()
        if not n:
            return Response({"detail": "Not found."}, status=404)
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=["read_at"])
        return Response(NotificationSerializer(n).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        Notification.objects.filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"ok": True})


class NotificationSettingListUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = NotificationSetting.objects.all().order_by("key")
        return Response(NotificationSettingSerializer(qs, many=True).data)

    def patch(self, request):
        updates = request.data or {}
        if not isinstance(updates, dict):
            return Response(
                {"detail": "Payload must be a key→enabled map."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for key, value in updates.items():
            NotificationSetting.objects.filter(key=key).update(enabled=bool(value))
        qs = NotificationSetting.objects.all().order_by("key")
        return Response(NotificationSettingSerializer(qs, many=True).data)


class AuditLogListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = AuditLog.objects.select_related("actor").order_by("-created_at")

        entity = (request.query_params.get("entity") or "").strip()
        if entity:
            qs = qs.filter(entity=entity)

        action = (request.query_params.get("action") or "").strip()
        if action:
            qs = qs.filter(action=action)

        return _paginated_response(AuditLogSerializer, qs, request)


class ReviewListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Review.objects.all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(ReviewSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = ReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        r = ser.save()
        return Response(
            ReviewSerializer(r).data,
            status=status.HTTP_201_CREATED,
        )


class ReviewDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Review.objects.filter(pk=pk).first()

    def get(self, request, pk):
        r = self._get(pk)
        if not r:
            return Response({"detail": "Not found."}, status=404)
        return Response(ReviewSerializer(r).data)

    def patch(self, request, pk):
        r = self._get(pk)
        if not r:
            return Response({"detail": "Not found."}, status=404)
        ser = ReviewSerializer(r, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ReviewSerializer(r).data)

    def delete(self, request, pk):
        r = self._get(pk)
        if r:
            r.delete()
        return Response(status=204)


class DeliveryZoneListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = DeliveryZone.objects.all().order_by("name")
        return Response(DeliveryZoneSerializer(qs, many=True).data)

    def post(self, request):
        ser = DeliveryZoneSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        z = ser.save()
        return Response(
            DeliveryZoneSerializer(z).data,
            status=status.HTTP_201_CREATED,
        )


class DeliveryZoneDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return DeliveryZone.objects.filter(pk=pk).first()

    def get(self, request, pk):
        z = self._get(pk)
        if not z:
            return Response({"detail": "Not found."}, status=404)
        return Response(DeliveryZoneSerializer(z).data)

    def patch(self, request, pk):
        z = self._get(pk)
        if not z:
            return Response({"detail": "Not found."}, status=404)
        ser = DeliveryZoneSerializer(z, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(DeliveryZoneSerializer(z).data)

    def delete(self, request, pk):
        z = self._get(pk)
        if z:
            z.delete()
        return Response(status=204)


class CouponListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Coupon.objects.all().order_by("-created_at")
        active = request.query_params.get("active")
        if active and active.lower() in {"1", "true", "yes"}:
            qs = qs.filter(is_active=True)
        return Response(CouponSerializer(qs, many=True).data)

    def post(self, request):
        ser = CouponSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        c = ser.save()
        return Response(
            CouponSerializer(c).data,
            status=status.HTTP_201_CREATED,
        )


class CouponDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Coupon.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(CouponSerializer(c).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = CouponSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CouponSerializer(c).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


class CampaignListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Campaign.objects.all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(CampaignSerializer(qs, many=True).data)

    def post(self, request):
        ser = CampaignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        c = ser.save()
        return Response(
            CampaignSerializer(c).data,
            status=status.HTTP_201_CREATED,
        )


class CampaignDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Campaign.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(CampaignSerializer(c).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = CampaignSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CampaignSerializer(c).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


class AdCampaignListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = AdCampaign.objects.all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(AdCampaignSerializer(qs, many=True).data)

    def post(self, request):
        ser = AdCampaignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        a = ser.save()
        return Response(
            AdCampaignSerializer(a).data,
            status=status.HTTP_201_CREATED,
        )


class AdCampaignDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return AdCampaign.objects.filter(pk=pk).first()

    def get(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        return Response(AdCampaignSerializer(a).data)

    def patch(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        ser = AdCampaignSerializer(a, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(AdCampaignSerializer(a).data)

    def delete(self, request, pk):
        a = self._get(pk)
        if a:
            a.delete()
        return Response(status=204)


class AttributionLinkListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = AttributionLink.objects.all().order_by("-created_at")
        creator_id = request.query_params.get("creator")
        if creator_id:
            qs = qs.filter(creator_id=creator_id)
        campaign_id = request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return Response(AttributionLinkSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = AttributionLinkSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        a = ser.save()
        return Response(
            AttributionLinkSerializer(a).data,
            status=status.HTTP_201_CREATED,
        )


class AttributionLinkDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return AttributionLink.objects.filter(pk=pk).first()

    def get(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        return Response(AttributionLinkSerializer(a).data)

    def patch(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        ser = AttributionLinkSerializer(a, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(AttributionLinkSerializer(a).data)

    def delete(self, request, pk):
        a = self._get(pk)
        if a:
            a.delete()
        return Response(status=204)


class CreatorApplicationListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = CreatorApplication.objects.all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(CreatorApplicationSerializer(qs[:500], many=True).data)

    def post(self, request):
        ser = CreatorApplicationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        a = ser.save()
        return Response(
            CreatorApplicationSerializer(a).data,
            status=status.HTTP_201_CREATED,
        )


class CreatorApplicationDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return CreatorApplication.objects.filter(pk=pk).first()

    def get(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)
        return Response(CreatorApplicationSerializer(a).data)

    def patch(self, request, pk):
        a = self._get(pk)
        if not a:
            return Response({"detail": "Not found."}, status=404)

        ser = CreatorApplicationSerializer(a, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        a = ser.save()

        if a.status in {"Approved", "Rejected", "Accepted", "Declined"} and a.reviewed_at is None:
            a.reviewed_at = timezone.now()
            a.reviewed_by = request.user if request.user.is_authenticated else None
            a.save(update_fields=["reviewed_at", "reviewed_by"])

        return Response(CreatorApplicationSerializer(a).data)

    def delete(self, request, pk):
        a = self._get(pk)
        if a:
            a.delete()
        return Response(status=204)


class PartnershipListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Partnership.objects.select_related("creator").order_by("-start_date")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        creator_id = request.query_params.get("creator")
        if creator_id:
            qs = qs.filter(creator_id=creator_id)
        return Response(PartnershipSerializer(qs, many=True).data)

    def post(self, request):
        ser = PartnershipSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        p = ser.save()
        return Response(
            PartnershipSerializer(p).data,
            status=status.HTTP_201_CREATED,
        )


class PartnershipDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Partnership.objects.filter(pk=pk).first()

    def get(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({"detail": "Not found."}, status=404)
        return Response(PartnershipSerializer(p).data)

    def patch(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({"detail": "Not found."}, status=404)
        ser = PartnershipSerializer(p, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(PartnershipSerializer(p).data)

    def delete(self, request, pk):
        p = self._get(pk)
        if p:
            p.delete()
        return Response(status=204)


class CreatorSampleListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = CreatorSample.objects.select_related("creator", "product").order_by("-requested_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        creator_id = request.query_params.get("creator")
        if creator_id:
            qs = qs.filter(creator_id=creator_id)
        return Response(
            CreatorSampleSerializer(
                qs[:500], many=True, context={"request": request},
            ).data
        )

    def post(self, request):
        ser = CreatorSampleSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        s = ser.save()
        return Response(
            CreatorSampleSerializer(s, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CreatorSampleDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return CreatorSample.objects.filter(pk=pk).first()

    def get(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        return Response(CreatorSampleSerializer(s, context={"request": request}).data)

    def patch(self, request, pk):
        s = self._get(pk)
        if not s:
            return Response({"detail": "Not found."}, status=404)
        ser = CreatorSampleSerializer(s, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        s = ser.save()

        if s.status == "Dispatched" and s.dispatched_at is None:
            s.dispatched_at = timezone.now()
            s.save(update_fields=["dispatched_at"])
        if s.status == "Delivered" and s.delivered_at is None:
            s.delivered_at = timezone.now()
            s.save(update_fields=["delivered_at"])

        return Response(CreatorSampleSerializer(s, context={"request": request}).data)

    def delete(self, request, pk):
        s = self._get(pk)
        if s:
            s.delete()
        return Response(status=204)


class IntegrationListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Integration.objects.all().order_by("name")
        return Response(IntegrationSerializer(qs, many=True).data)

    def post(self, request):
        ser = IntegrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        i = ser.save()
        return Response(
            IntegrationSerializer(i).data,
            status=status.HTTP_201_CREATED,
        )


class IntegrationDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, key):
        return Integration.objects.filter(key=key).first()

    def get(self, request, key):
        i = self._get(key)
        if not i:
            return Response({"detail": "Not found."}, status=404)
        return Response(IntegrationSerializer(i).data)

    def patch(self, request, key):
        i = self._get(key)
        if not i:
            return Response({"detail": "Not found."}, status=404)
        ser = IntegrationSerializer(i, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(IntegrationSerializer(i).data)


class IntegrationActionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, key, action):
        i = Integration.objects.filter(key=key).first()
        if not i:
            return Response({"detail": "Not found."}, status=404)

        if action == "connect":
            i.status = "connected"
            i.error_message = ""
            i.last_sync_at = timezone.now()
        elif action == "disconnect":
            i.status = "disconnected"
            i.account_name = ""
            i.permissions = ""
            i.last_sync_at = None
            i.error_message = ""
        elif action == "reconnect":
            i.status = "connected"
            i.error_message = ""
            i.last_sync_at = timezone.now()
        elif action == "test":
            i.last_sync_at = timezone.now()
        else:
            return Response(
                {"detail": "Unknown action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        i.save()

        AuditLog.objects.create(
            action="status_change",
            entity="Integration",
            entity_id=str(i.pk),
            summary=f"{i.name}: {action} → {i.status}",
            actor=request.user if request.user.is_authenticated else None,
        )

        return Response(IntegrationSerializer(i).data)


class PermissionGroupListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = PermissionGroup.objects.all().order_by("name")
        return Response(PermissionGroupSerializer(qs, many=True).data)

    def post(self, request):
        ser = PermissionGroupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        g = ser.save()
        return Response(
            PermissionGroupSerializer(g).data,
            status=status.HTTP_201_CREATED,
        )


class PermissionGroupDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return PermissionGroup.objects.filter(pk=pk).first()

    def get(self, request, pk):
        g = self._get(pk)
        if not g:
            return Response({"detail": "Not found."}, status=404)
        return Response(PermissionGroupSerializer(g).data)

    def patch(self, request, pk):
        g = self._get(pk)
        if not g:
            return Response({"detail": "Not found."}, status=404)
        ser = PermissionGroupSerializer(g, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(PermissionGroupSerializer(g).data)

    def delete(self, request, pk):
        g = self._get(pk)
        if g:
            g.delete()
        return Response(status=204)


class AnalyticsSummaryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        orders = DirectOrder.objects.all()
        now = timezone.now()
        start_of_month = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0,
        )

        month_orders = orders.filter(created_at__gte=start_of_month)
        month_revenue = month_orders.aggregate(
            total=Sum("total"),
        )["total"] or 0

        pending_shipment = orders.filter(
            status__in=["Paid", "Awaiting Shipment"],
        ).count()

        active_creators = Creator.objects.filter(status="Active").count()

        total_orders = orders.count()
        converted_leads = Lead.objects.filter(status="Converted").count()
        conversion_rate = (
            round((converted_leads / total_orders) * 100, 2)
            if total_orders else 0
        )

        by_source = list(
            orders.values("source").annotate(
                count=Count("id"),
                revenue=Sum("total"),
            )
        )

        by_status = list(
            orders.values("status").annotate(count=Count("id"))
        )

        daily = []
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).date()
            day_orders = orders.filter(created_at__date=day)
            daily.append(
                {
                    "day": day.strftime("%a"),
                    "date": day.isoformat(),
                    "orders": day_orders.count(),
                    "revenue": str(
                        day_orders.aggregate(t=Sum("total"))["t"] or 0
                    ),
                }
            )

        customers_total = Customer.objects.count()
        new_customers = Customer.objects.filter(
            created_at__gte=now - timedelta(days=30),
        ).count()
        returning_customers = Customer.objects.filter(total_orders__gte=2).count()

        ad_spend = AdCampaign.objects.aggregate(t=Sum("spend"))["t"] or 0
        attributed_revenue = AdCampaign.objects.aggregate(
            t=Sum("attributed_revenue"),
        )["t"] or 0
        roas = (
            round(float(attributed_revenue) / float(ad_spend), 2)
            if ad_spend else 0
        )

        fulfillment = {
            "delivered": orders.filter(status="Delivered").count(),
            "shipped": orders.filter(status="Shipped").count(),
            "cancelled": orders.filter(status="Cancelled").count(),
            "returned": orders.filter(status="Returned").count(),
        }

        return Response(
            {
                "monthOrders": month_orders.count(),
                "monthRevenue": str(month_revenue),
                "pendingShipment": pending_shipment,
                "activeCreators": active_creators,
                "conversionRate": conversion_rate,
                "bySource": by_source,
                "byStatus": by_status,
                "daily": daily,
                "customers": {
                    "total": customers_total,
                    "new30d": new_customers,
                    "returning": returning_customers,
                },
                "marketing": {
                    "adSpend": str(ad_spend),
                    "attributedRevenue": str(attributed_revenue),
                    "roas": roas,
                },
                "fulfillment": fulfillment,
            }
        )


class FinanceSummaryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        orders = DirectOrder.objects.all()
        creators = Creator.objects.all()

        gross = orders.aggregate(t=Sum("total"))["t"] or 0
        refunds = ReturnRequest.objects.filter(status="Refunded").aggregate(
            t=Sum("refund_amount"),
        )["t"] or 0
        commissions = creators.aggregate(
            t=Sum("sales__commission_amount", filter=Q(sales__paid=False))
        )["t"] or 0
        withholding = float(commissions) * 0.05

        expenses = Expense.objects.aggregate(t=Sum("amount"))["t"] or 0
        ad_spend = AdCampaign.objects.aggregate(t=Sum("spend"))["t"] or 0

        net = (
            float(gross)
            - float(refunds)
            - float(commissions)
            - withholding
            - float(expenses)
            - float(ad_spend)
        )

        return Response(
            {
                "grossRevenue": str(gross),
                "refunds": str(refunds),
                "creatorCommissions": str(commissions),
                "withholdingTax": str(round(withholding, 2)),
                "expenses": str(expenses),
                "advertisingSpend": str(ad_spend),
                "netRevenue": str(round(net, 2)),
            }
        )


class HealthSummaryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        rows = []
        for i in Integration.objects.all().order_by("name"):
            rows.append(
                {
                    "key": i.key,
                    "name": i.name,
                    "status": i.status,
                    "accountName": i.account_name,
                    "lastSyncAt": i.last_sync_at.isoformat() if i.last_sync_at else None,
                    "error": i.error_message,
                    "warnings": 1 if i.error_message else 0,
                    "syncFailures": 1 if i.status == "error" else 0,
                }
            )
        return Response({"integrations": rows})