from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from catalog.models import Brand

from .serializers import (
    BrandAdminReadSerializer,
    BrandAdminWriteSerializer,
)


def _counted_order_statuses():
    try:
        from checkout.models import Order
        return [Order.Status.DELIVERED]
    except Exception:
        return ["delivered"]


def _attach_brand_stats(brands):
    if not brands:
        return

    for b in brands:
        b.sales_total = Decimal("0")
        b._sales_last_30 = Decimal("0")
        b._sales_prev_30 = Decimal("0")
        b.customers_count = 0

    try:
        from checkout.models import Order, OrderItem
    except Exception:
        return

    if hasattr(OrderItem, "unit_price") and hasattr(OrderItem, "quantity"):
        line_total = F("unit_price") * F("quantity")
    elif hasattr(OrderItem, "subtotal"):
        line_total = F("subtotal")
    elif hasattr(OrderItem, "total"):
        line_total = F("total")
    elif hasattr(OrderItem, "unit_price"):
        line_total = F("unit_price")
    else:
        return

    customer_field = None
    for candidate in ("user", "customer"):
        if hasattr(Order, candidate):
            customer_field = candidate
            break

    brand_names = [b.name for b in brands]
    now = timezone.now()
    last_30 = now - timedelta(days=30)
    prev_30 = now - timedelta(days=60)
    counted = _counted_order_statuses()

    try:
        base_qs = OrderItem.objects.filter(
            brand__in=brand_names,
            order__status__in=counted,
        )
        totals_map = {
            r["brand"]: (r["total"] or Decimal("0"))
            for r in base_qs.values("brand").annotate(total=Sum(line_total))
        }
    except Exception:
        return

    try:
        last_map = {
            r["brand"]: (r["total"] or Decimal("0"))
            for r in (
                base_qs
                .filter(order__created_at__gte=last_30)
                .values("brand")
                .annotate(total=Sum(line_total))
            )
        }
    except Exception:
        last_map = {}

    try:
        prev_map = {
            r["brand"]: (r["total"] or Decimal("0"))
            for r in (
                base_qs
                .filter(
                    order__created_at__gte=prev_30,
                    order__created_at__lt=last_30,
                )
                .values("brand")
                .annotate(total=Sum(line_total))
            )
        }
    except Exception:
        prev_map = {}

    customers_map = {}
    if customer_field:
        try:
            customers_map = {
                r["brand"]: r["count"]
                for r in (
                    base_qs
                    .values("brand")
                    .annotate(
                        count=Count(f"order__{customer_field}", distinct=True)
                    )
                )
            }
        except Exception:
            customers_map = {}

    for b in brands:
        b.sales_total = totals_map.get(b.name, Decimal("0"))
        b._sales_last_30 = last_map.get(b.name, Decimal("0"))
        b._sales_prev_30 = prev_map.get(b.name, Decimal("0"))
        b.customers_count = customers_map.get(b.name, 0)


class BrandAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    pagination_class = None
    lookup_field = "id"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Brand.objects.annotate(
            product_count=Count(
                "products",
                filter=Q(products__is_active=True),
                distinct=True,
            )
        )

        status_filter = self.request.query_params.get("status")
        search = self.request.query_params.get("search")

        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "inactive":
            qs = qs.filter(is_active=False)

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(slug__icontains=search)
                | Q(description__icontains=search)
            )

        return qs.order_by("name")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return BrandAdminReadSerializer
        return BrandAdminWriteSerializer

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        brands = list(qs)
        _attach_brand_stats(brands)
        data = BrandAdminReadSerializer(
            brands, many=True, context={"request": request},
        ).data
        return Response(data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _attach_brand_stats([instance])
        data = BrandAdminReadSerializer(
            instance, context={"request": request},
        ).data
        return Response(data)

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"errors": ser.errors, "detail": "Validation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        brand = ser.save()
        read = BrandAdminReadSerializer(
            brand, context={"request": request},
        )
        return Response(read.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = self.get_serializer(
            instance, data=request.data, partial=partial,
        )
        if not ser.is_valid():
            return Response(
                {"errors": ser.errors, "detail": "Validation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        brand = ser.save()
        read = BrandAdminReadSerializer(
            brand, context={"request": request},
        )
        return Response(read.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-featured")
    def toggle_featured(self, request, id=None):
        brand = self.get_object()
        brand.featured = not brand.featured
        brand.save(update_fields=["featured", "updated_at"])
        read = BrandAdminReadSerializer(
            brand, context={"request": request},
        )
        return Response(read.data)