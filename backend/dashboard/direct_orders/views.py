"""
Admin endpoints for the Direct Orders surface.

Order endpoints are a FILTERED READ over `checkout.Order` — filtered
by `source__in=["whatsapp", "admin", "phone"]`. This app does not own
the Order model; it presents a slice of it under a specific URL
namespace for the TikTok Shop admin page.

The `advance` action is a thin wrapper over
`checkout.services.change_order_status`, which is the ONLY place
`Order.status` is mutated. This view does no business logic — it maps
HTTP to that function and sets `actor=request.user`.
"""
from datetime import timedelta
import os
import uuid

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Order
from checkout.services import change_order_status

from .models import Creator, ContentPost, DirectProduct, LiveSession
from .serializers import (
    ContentPostSerializer,
    CreatorSerializer,
    DirectOrderSerializer,
    DirectProductSerializer,
    LiveSessionSerializer,
    ProductCreateSerializer,   # NEW — see serializers.py
)


# ─────────────────────────────────────────────────────────────────────
# Shared queryset
# ─────────────────────────────────────────────────────────────────────

def _orders_base_qs():
    """
    Filter Order to the social channels only. Add new channels here
    when a new `Order.Source` value lands (e.g. "tiktok" when TikTok
    Shop launches in Kenya).
    """
    return (
        Order.objects
        .filter(source__in=["whatsapp", "admin", "phone"])
        .select_related("user")
        .prefetch_related("items", "payments", "status_events")
    )


# ═════════════════════════════════════════════════════════════════════
# File uploads — one endpoint for both images and videos
# ═════════════════════════════════════════════════════════════════════

# Size limits must match the frontend (see ImageUpload / VideoUpload).
MAX_IMAGE_BYTES = 5 * 1024 * 1024        #   5 MB
MAX_VIDEO_BYTES = 100 * 1024 * 1024      # 100 MB

# Allowed mime types. Kept narrow on purpose — broader lists invite
# SVG-based XSS on the image side and unplayable formats on video.
ALLOWED_IMAGE_MIMES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
ALLOWED_VIDEO_MIMES = {
    "video/mp4",
    "video/quicktime",   # .mov
    "video/webm",
}


class UploadView(APIView):
    """
    POST /api/v1/dashboard/direct-orders/uploads/
    multipart/form-data:
        file: <binary>
        kind: "image" | "video"

    Response:
        200 { "url": "https://cdn.example.com/uploads/images/abc.jpg" }

    Storage:
        Uses Django's `default_storage`, which is `FileSystemStorage` in
        dev and S3 / Cloudinary / GCS in production if you've configured
        it. No hardcoded paths.

    Validation:
        - `kind` must be exactly "image" or "video".
        - Mime type must be in the allow-list for that kind.
        - File size must be under the per-kind cap.

    Failure modes:
        - 400 for missing/invalid input (frontend shows the error and
          keeps a local data-URL preview so the form stays usable).
        - 500 for storage errors (frontend shows the same fallback).
    """
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

        # ── Size ──
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

        # ── Mime type ──
        content_type = (upload.content_type or "").lower()
        allowed = ALLOWED_IMAGE_MIMES if kind == "image" else ALLOWED_VIDEO_MIMES
        if content_type not in allowed:
            return Response(
                {"detail": f"Unsupported {kind} type: {content_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Save ──
        #
        # Namespaced by kind so the media bucket stays navigable, and
        # suffixed with a UUID so two files called "photo.jpg" don't
        # clobber each other.
        ext = os.path.splitext(upload.name)[1].lower() or self._default_ext(content_type)
        key = f"direct-orders/{kind}s/{uuid.uuid4().hex}{ext}"

        try:
            saved_path = default_storage.save(key, upload)
            url = default_storage.url(saved_path)
        except Exception as exc:  # noqa: BLE001 — surface as 500 to the client
            return Response(
                {"detail": f"Storage error: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"url": url}, status=status.HTTP_200_OK)

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


# ─────────────────────────────────────────────────────────────────────
# Orders
# ─────────────────────────────────────────────────────────────────────

class DirectOrderListView(APIView):
    """
    GET /api/v1/dashboard/direct-orders/orders/

    Query params (all optional):
        q         — free-text search: reference, contact_email, contact_phone
        source    — "whatsapp" | "admin" | "phone"
        dateRange — "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days"
        status    — frontend display status label ("Paid", "Shipped", …)

    The `status` filter is applied in Python because the display status
    is derived from two axes and has no DB column. For small result
    sets this is fine. If the list grows past ~10k rows, denormalize a
    `display_status` column on `Order` and filter in the DB.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _orders_base_qs().order_by("-created_at")

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(reference__icontains=q)
                | Q(contact_email__icontains=q)
                | Q(contact_phone__icontains=q)
                | Q(snapshot__full_name__icontains=q)
            )

        source = (request.query_params.get("source") or "").strip().lower()
        if source in {"whatsapp", "admin", "phone"}:
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

        # Hard cap. Swap to DRF pagination when the list justifies it.
        rows = DirectOrderSerializer(qs[:500], many=True).data

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            rows = [r for r in rows if r["status"] == status_filter]

        return Response(rows)


class DirectOrderDetailView(APIView):
    """GET /api/v1/dashboard/direct-orders/orders/<reference>/"""

    permission_classes = [IsAdminUser]

    def get(self, request, reference):
        order = _orders_base_qs().filter(reference=reference).first()
        if not order:
            return Response({"detail": "Not found."}, status=404)
        return Response(DirectOrderSerializer(order).data)


class DirectOrderAdvanceView(APIView):
    """
    POST /api/v1/dashboard/direct-orders/orders/<reference>/advance/

    Body:
        {
          "next": "confirmed" | "processing" | "shipped"
                  | "delivered" | "cancelled" | "returned",
          "note": "optional free text"
        }

    Accepts BOTH the backend status keys and the frontend display
    labels, so the frontend's existing advance buttons keep working
    without a mapping table on the client. All actual logic lives in
    `checkout.services.change_order_status` — this view is a pass-
    through with `actor=request.user`.
    """
    permission_classes = [IsAdminUser]

    # Frontend label → backend status key
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

        # Accept either the display label or the backend key.
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
        return Response(DirectOrderSerializer(order).data)


# ─────────────────────────────────────────────────────────────────────
# Creators
# ─────────────────────────────────────────────────────────────────────

class CreatorListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        # CHANGED: annotate commission totals to avoid N+1 on the list.
        # Previously `commission_owed` / `commission_paid` ran one SUM
        # query per row. Now the serializer reads the annotated values
        # when present (see CreatorSerializer — add an `_annotated` check).
        #
        # If you don't want to change the serializer, drop the annotate
        # and accept the N+1 — it's fine up to a few hundred creators.
        from django.db.models import Sum, Q as _Q
        qs = Creator.objects.all().annotate(
            _commission_owed=Sum(
                "sales__commission_amount",
                filter=_Q(sales__paid=False),
            ),
            _commission_paid=Sum(
                "sales__commission_amount",
                filter=_Q(sales__paid=True),
            ),
        ).order_by("-updated_at")
        return Response(CreatorSerializer(qs, many=True).data)

    def post(self, request):
        ser = CreatorSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        creator = ser.save()
        return Response(CreatorSerializer(creator).data, status=201)


class CreatorDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return Creator.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(CreatorSerializer(c).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = CreatorSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CreatorSerializer(c).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


# ─────────────────────────────────────────────────────────────────────
# Content
# ─────────────────────────────────────────────────────────────────────

class ContentListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        # CHANGED: `scheduled_date` was renamed to `scheduled_at` in the
        # model, so the ordering has to match. Using the new name keeps
        # the "most recently scheduled first" behaviour.
        qs = ContentPost.objects.all().order_by("-scheduled_at", "-created_at")
        return Response(ContentPostSerializer(qs, many=True).data)

    def post(self, request):
        ser = ContentPostSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        post = ser.save()
        return Response(ContentPostSerializer(post).data, status=201)


class ContentDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return ContentPost.objects.filter(pk=pk).first()

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(ContentPostSerializer(c).data)

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        ser = ContentPostSerializer(c, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ContentPostSerializer(c).data)

    def delete(self, request, pk):
        c = self._get(pk)
        if c:
            c.delete()
        return Response(status=204)


# ─────────────────────────────────────────────────────────────────────
# Live sessions
# ─────────────────────────────────────────────────────────────────────

class LiveListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = LiveSession.objects.all().order_by("-scheduled_start")
        return Response(LiveSessionSerializer(qs, many=True).data)

    def post(self, request):
        ser = LiveSessionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        live = ser.save()
        return Response(LiveSessionSerializer(live).data, status=201)


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


# ─────────────────────────────────────────────────────────────────────
# Direct products (thin wrappers over catalog.Product)
# ─────────────────────────────────────────────────────────────────────

class DirectProductListCreateView(APIView):
    """
    GET  — list the wrapper rows (read-only over the catalog fields).
    POST — create a catalog.Product AND its DirectProduct wrapper in
           one transaction, using the flat payload the AddProductModal
           sends.

    The write path used to hand the payload straight to
    `DirectProductSerializer`, which has read-only catalog fields — so
    `name`, `sku`, `price`, etc. were silently dropped. It now uses
    `ProductCreateSerializer`, which fans the flat shape out into both
    tables.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = DirectProduct.objects.select_related("product").order_by("-updated_at")
        return Response(DirectProductSerializer(qs, many=True).data)

    def post(self, request):
        # CHANGED: use the write serializer, not the read serializer.
        ser = ProductCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        wrapper = ser.save()
        return Response(
            DirectProductSerializer(wrapper).data,
            status=status.HTTP_201_CREATED,
        )


class DirectProductDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return DirectProduct.objects.select_related("product").filter(pk=pk).first()

    def get(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({"detail": "Not found."}, status=404)
        return Response(DirectProductSerializer(p).data)

    def patch(self, request, pk):
        """
        PATCH only touches the wrapper fields (status, viral,
        low_stock_threshold, video_link, linked_to_website). Catalog
        fields are read-only here by design — mutate them on the
        catalog product endpoint instead.
        """
        p = self._get(pk)
        if not p:
            return Response({"detail": "Not found."}, status=404)
        ser = DirectProductSerializer(p, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(DirectProductSerializer(p).data)

    def delete(self, request, pk):
        """
        Deleting the wrapper leaves the catalog product intact. If you
        want delete to cascade to the catalog row, do it explicitly
        here — the OneToOne has on_delete=CASCADE from wrapper →
        product only if you construct it the other way around.
        """
        p = self._get(pk)
        if p:
            p.delete()
        return Response(status=204)