from django.core.files.storage import default_storage
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Discount

from . import services
from .permissions import IsStaff
from .serializers import (
    AnalyticsSerializer,
    DiscountListSerializer,
    DiscountReadSerializer,
    DiscountWriteSerializer,
    RulesSerializer,
    SlowMovingProductSerializer,
)


class DiscountAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaff]
    lookup_field = "id"

    def get_queryset(self):
        return (
            Discount.objects
            .with_links()
            .order_by("-priority", "-created_at")
        )

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DiscountWriteSerializer
        if self.action == "list":
            return DiscountListSerializer
        return DiscountReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        read = DiscountReadSerializer(
            instance, context={"request": request},
        )
        return Response(read.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        read = DiscountReadSerializer(
            instance, context={"request": request},
        )
        return Response(read.data)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, id=None):
        original = self.get_object()
        clone = services.duplicate_discount(original, user=request.user)
        return Response(
            DiscountReadSerializer(clone, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def pause(self, request, id=None):
        discount = self.get_object()
        services.pause_discount(discount)
        discount.refresh_from_db()
        return Response(
            DiscountReadSerializer(discount, context={"request": request}).data
        )

    @action(detail=True, methods=["post"])
    def resume(self, request, id=None):
        discount = self.get_object()
        services.resume_discount(discount)
        discount.refresh_from_db()
        return Response(
            DiscountReadSerializer(discount, context={"request": request}).data
        )

    @action(detail=False, methods=["get"])
    def slow_moving(self, request):
        try:
            min_days  = int(request.query_params.get("min_days", 90))
            max_sales = int(request.query_params.get("max_sales", 5))
            min_stock = int(request.query_params.get("min_stock", 10))
        except ValueError:
            return Response(
                {"detail": "min_days, max_sales, min_stock must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = services.get_slow_moving_candidates(
            min_days=min_days, max_sales=max_sales, min_stock=min_stock,
        )
        return Response(SlowMovingProductSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"])
    def bulk_clearance(self, request):
        product_ids = request.data.get("product_ids") or []
        percent_off = request.data.get("percent_off")
        expires     = request.data.get("expires_when_sold_out", True)
        title       = request.data.get("title")

        if not product_ids:
            return Response(
                {"detail": "product_ids is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            percent_off = int(percent_off)
        except (TypeError, ValueError):
            return Response(
                {"detail": "percent_off must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            discount = services.apply_bulk_clearance(
                product_ids=product_ids,
                percent_off=percent_off,
                expires_when_sold_out=bool(expires),
                title=title,
                user=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            DiscountReadSerializer(discount, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
        url_path="upload_media",
    )
    def upload_media(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ctype = file.content_type or ""
        if not (ctype.startswith("image/") or ctype.startswith("video/")):
            return Response(
                {"detail": "Only image or video files are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_bytes = 60 * 1024 * 1024
        if file.size > max_bytes:
            return Response(
                {"detail": "File too large (max 60MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        path = default_storage.save(f"discounts/{file.name}", file)

        url = default_storage.url(path)
        if request:
            url = request.build_absolute_uri(url)

        return Response({"url": url}, status=status.HTTP_201_CREATED)


class AnalyticsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        try:
            window_days = int(request.query_params.get("window_days", 30))
        except ValueError:
            window_days = 30

        data = services.build_analytics(window_days=window_days)
        return Response(AnalyticsSerializer(data).data)


class RulesView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        data = services.get_rules_metadata()
        return Response(RulesSerializer(data).data)