from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from catalog.models import Category

from .serializers import (
    CategoryAdminReadSerializer,
    CategoryAdminWriteSerializer,
)


def _build_tree(flat):
    """
    Turn a flat list of serialized category dicts into a nested tree
    where each root has a `children` array. Preserves the API ordering.
    """
    by_id = {c["id"]: {**c, "children": []} for c in flat}
    roots = []
    for c in flat:
        node = by_id[c["id"]]
        parent_id = c.get("parent_id")
        if parent_id and parent_id in by_id:
            by_id[parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


class CategoryAdminViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/admin/categories/       → nested tree
    POST   /api/v1/admin/categories/       → create
    GET    /api/v1/admin/categories/<id>/  → flat detail
    PATCH  /api/v1/admin/categories/<id>/  → update
    DELETE /api/v1/admin/categories/<id>/  → delete (cascades to children)
    """
    permission_classes = [IsAdminUser]
    pagination_class = None          # ← explicit: custom list() bypasses it anyway
    lookup_field = "id"

    def get_queryset(self):
        return Category.objects.with_product_counts().select_related("parent")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return CategoryAdminReadSerializer
        return CategoryAdminWriteSerializer

    def list(self, request):
        """Return the full nested tree, not a paginated flat list."""
        qs = self.get_queryset().order_by("sort_order", "name")
        flat = CategoryAdminReadSerializer(
            qs, many=True, context={"request": request},
        ).data
        return Response(_build_tree(flat))

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"errors": ser.errors, "detail": "Validation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance = ser.save()
        read = CategoryAdminReadSerializer(
            instance, context={"request": request},
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
        instance = ser.save()
        read = CategoryAdminReadSerializer(
            instance, context={"request": request},
        )
        return Response(read.data)