from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from catalog.models import Brand

from .serializers import (
    BrandAdminReadSerializer,
    BrandAdminWriteSerializer,
)


class BrandAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD for brands, used by the admin dashboard.

    GET    /api/v1/admin/brands/           → list
    POST   /api/v1/admin/brands/           → create
    GET    /api/v1/admin/brands/<id>/      → detail
    PATCH  /api/v1/admin/brands/<id>/      → partial update
    DELETE /api/v1/admin/brands/<id>/      → delete
    POST   /api/v1/admin/brands/<id>/toggle-featured/
    """
    permission_classes = [IsAdminUser]
    pagination_class = None          # ← added: return a plain array, not {results: [...]}
    lookup_field = "id"

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

    def toggle_featured(self, request, id=None):
        brand = self.get_object()
        brand.featured = not brand.featured
        brand.save(update_fields=["featured", "updated_at"])
        read = BrandAdminReadSerializer(
            brand, context={"request": request},
        )
        return Response(read.data)