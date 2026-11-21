import logging

from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from catalog.models import Category

from .serializers import (
    CategoryAdminReadSerializer,
    CategoryAdminWriteSerializer,
)

logger = logging.getLogger(__name__)


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
        logger.warning("CATEGORY CREATE payload: %s", request.data)
        ser = self.get_serializer(data=request.data)
        if not ser.is_valid():
            logger.warning("CATEGORY CREATE failed: %s", ser.errors)
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
        logger.warning(
            "CATEGORY UPDATE id=%s partial=%s payload: %s",
            instance.pk, partial, request.data,
        )
        ser = self.get_serializer(
            instance, data=request.data, partial=partial,
        )
        if not ser.is_valid():
            logger.warning(
                "CATEGORY UPDATE id=%s failed: %s",
                instance.pk, ser.errors,
            )
            return Response(
                {"errors": ser.errors, "detail": "Validation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance = ser.save()
        read = CategoryAdminReadSerializer(
            instance, context={"request": request},
        )
        return Response(read.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        logger.warning("CATEGORY DELETE id=%s", instance.pk)

        product_count = (
            instance.products.count() if hasattr(instance, "products") else 0
        )
        child_count = (
            instance.children.count() if hasattr(instance, "children") else 0
        )

        reassign_to = request.query_params.get("reassign_to")

        if reassign_to:
            Model = self.get_queryset().model
            try:
                target = Model.objects.get(pk=reassign_to)
            except (Model.DoesNotExist, ValueError):
                return Response(
                    {
                        "detail": "Target category not found.",
                        "code": "INVALID_REASSIGN_TARGET",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if target.pk == instance.pk:
                return Response(
                    {
                        "detail": "Cannot reassign to the same category.",
                        "code": "SAME_TARGET",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if hasattr(instance, "products"):
                instance.products.update(category=target)
            if hasattr(instance, "children"):
                instance.children.update(parent=target)

        try:
            instance.delete()
        except ProtectedError as exc:
            protected = list(exc.protected_objects)[:25]
            logger.warning(
                "CATEGORY DELETE id=%s blocked by ProtectedError", instance.pk,
            )
            return Response(
                {
                    "detail": (
                        f"Cannot delete '{getattr(instance, 'name', instance.pk)}' "
                        f"because it is still in use. Reassign or remove the "
                        f"linked items first."
                    ),
                    "code": "PROTECTED",
                    "product_count": product_count,
                    "child_count": child_count,
                    "products": [
                        {
                            "id": getattr(p, "id", None),
                            "name": getattr(p, "name", str(p)),
                        }
                        for p in protected
                    ],
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)