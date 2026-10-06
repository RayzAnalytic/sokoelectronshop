from django.db.models import Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from catalog.models import (
    Product,
    ProductFeature,
    ProductImage,
    ProductSpec,
)
from .serializers import (
    AdminProductReadSerializer,
    AdminProductWriteSerializer,
)


class ProductAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD for products, used by the admin dashboard.

    GET    /api/v1/admin/products/           → list
    POST   /api/v1/admin/products/           → create
    GET    /api/v1/admin/products/<id>/      → detail
    PATCH  /api/v1/admin/products/<id>/      → partial update
    PUT    /api/v1/admin/products/<id>/      → full update
    DELETE /api/v1/admin/products/<id>/      → delete
    POST   /api/v1/admin/products/bulk/      → bulk create
    POST   /api/v1/admin/products/<id>/toggle-featured/
    POST   /api/v1/admin/products/<id>/toggle-best-seller/
    """
    permission_classes = [IsAdminUser]
    pagination_class = None          # ← plain array, not {count, results}
    lookup_field = "id"

    def get_queryset(self):
        qs = Product.objects.select_related("brand", "category")

        qs = qs.prefetch_related(
            Prefetch(
                "images",
                queryset=ProductImage.objects.order_by("sort_order", "id"),
            ),
            Prefetch(
                "features",
                queryset=ProductFeature.objects.order_by("sort_order", "id"),
            ),
            Prefetch(
                "specs",
                queryset=ProductSpec.objects.order_by("sort_order", "id"),
            ),
        )

        category = self.request.query_params.get("category")
        brand = self.request.query_params.get("brand")
        status_filter = self.request.query_params.get("status")
        stock_filter = self.request.query_params.get("stock")
        search = self.request.query_params.get("search")

        if category:
            qs = qs.filter(category_id=category)
        if brand:
            qs = qs.filter(brand_id=brand)

        if status_filter == "published":
            qs = qs.filter(is_active=True)
        elif status_filter in ("draft", "archived"):
            qs = qs.filter(is_active=False)

        if stock_filter == "out":
            qs = qs.filter(stock_quantity=0)
        elif stock_filter == "low":
            qs = qs.filter(stock_quantity__gt=0, stock_quantity__lte=10)
        elif stock_filter == "in":
            qs = qs.filter(stock_quantity__gt=10)

        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(slug__icontains=search)
            )

        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return AdminProductReadSerializer
        return AdminProductWriteSerializer

    def create(self, request, *args, **kwargs):
        """Create → respond with the read shape (nested children)."""
        ser = self.get_serializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"errors": ser.errors, "detail": "Validation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product = ser.save()
        read = AdminProductReadSerializer(
            product, context={"request": request},
        )
        return Response(read.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update → respond with the read shape."""
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

        product = ser.save()
        read = AdminProductReadSerializer(
            product, context={"request": request},
        )
        return Response(read.data)

    def bulk(self, request):
        """Bulk import from the CSV importer — creates one Product per row."""
        rows = request.data.get("rows", [])
        if not isinstance(rows, list):
            return Response(
                {"detail": "rows must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        errors = []
        for i, row in enumerate(rows):
            ser = AdminProductWriteSerializer(
                data=row, context={"request": request},
            )
            if ser.is_valid():
                created.append(ser.save())
            else:
                errors.append({"row": i, "errors": ser.errors})

        read = AdminProductReadSerializer(
            created, many=True, context={"request": request},
        )
        return Response(
            {"created": read.data, "errors": errors},
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_400_BAD_REQUEST
            ),
        )

    def toggle_featured(self, request, id=None):
        product = self.get_object()
        product.featured = not product.featured
        product.save(update_fields=["featured", "updated_at"])
        read = AdminProductReadSerializer(
            product, context={"request": request},
        )
        return Response(read.data)

    def toggle_best_seller(self, request, id=None):
        product = self.get_object()
        product.best_seller = not product.best_seller
        product.save(update_fields=["best_seller", "updated_at"])
        read = AdminProductReadSerializer(
            product, context={"request": request},
        )
        return Response(read.data)