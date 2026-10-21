from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from catalog.models import Category

from .serializers import (
    CategoryAdminReadSerializer,
    CategoryAdminWriteSerializer,
)


def _build_tree(flat):
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
    permission_classes = [IsAdminUser]
    pagination_class = None
    lookup_field = "id"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Category.objects.with_product_counts().select_related("parent")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return CategoryAdminReadSerializer
        return CategoryAdminWriteSerializer

    def list(self, request):
        qs = self.get_queryset().order_by("sort_order", "name")
        flat = CategoryAdminReadSerializer(
            qs, many=True, context={"request": request},
        ).data
        return Response(_build_tree(flat))

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = CategoryAdminReadSerializer(
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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)