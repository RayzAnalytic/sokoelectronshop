import logging

from django.db import transaction
from django.db.models import Sum
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from catalog.models import Product
from checkout.models import Order, OrderItem

from .models import StockMovement
from .serializers import (
    AdjustStockWriteSerializer,
    InventoryItemSerializer,
    MovementSerializer,
)

logger = logging.getLogger(__name__)


def _reserved_map() -> dict:
    rows = (
        OrderItem.objects
        .filter(
            order__status__in=[
                Order.Status.PENDING,
                Order.Status.CONFIRMED,
                Order.Status.PROCESSING,
            ],
        )
        .values("product_id")
        .annotate(total=Sum("quantity"))
    )
    return {row["product_id"]: row["total"] for row in rows}


def _product_map(product_ids) -> dict:
    if not product_ids:
        return {}
    return {
        pk: (name, slug)
        for pk, name, slug in (
            Product.objects
            .filter(pk__in=product_ids)
            .values_list("pk", "name", "slug")
        )
    }


class InventoryViewSet(ViewSet):
    permission_classes = [IsAdminUser]

    def list(self, request):
        qs = (
            Product.objects
            .select_related("category", "brand")
            .prefetch_related("images")
            .order_by("-created_at")
        )
        serializer = InventoryItemSerializer(
            qs,
            many=True,
            context={
                "request": request,
                "reserved_map": _reserved_map(),
            },
        )
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="adjust")
    def adjust(self, request):
        ser = AdjustStockWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        with transaction.atomic():
            product = (
                Product.objects
                .select_for_update()
                .filter(pk=d["productId"])
                .first()
            )
            if not product:
                return Response(
                    {"detail": "Product not found."},
                    status=http_status.HTTP_404_NOT_FOUND,
                )

            old_qty = product.stock_quantity
            operation = d["type"]
            qty = d["quantity"]

            if operation == "Add":
                new_qty = old_qty + qty
            elif operation == "Remove":
                new_qty = max(0, old_qty - qty)
            else:
                new_qty = qty

            delta = new_qty - old_qty

            if delta == 0:
                product.refresh_from_db()
                return Response(
                    InventoryItemSerializer(
                        product,
                        context={"request": request},
                    ).data
                )

            product.stock_quantity = new_qty
            product.save(update_fields=["stock_quantity", "updated_at"])

            StockMovement.objects.create(
                product_id=product.pk,
                quantity_delta=delta,
                reason=(d.get("reason") or "adjustment")[:20],
                actor=request.user,
                notes=d.get("notes") or "",
                reference="",
            )

        product.refresh_from_db()
        return Response(
            InventoryItemSerializer(
                product,
                context={"request": request},
            ).data
        )


class MovementListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            StockMovement.objects
            .select_related("actor")
            .order_by("-created_at")[:500]
        )
        rows = list(qs)

        product_map = _product_map({r.product_id for r in rows})

        serializer = MovementSerializer(
            rows,
            many=True,
            context={
                "request": request,
                "product_map": product_map,
            },
        )
        return Response(serializer.data)