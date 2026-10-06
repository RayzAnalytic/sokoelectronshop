"""
Inventory admin API.

Endpoints (mounted at /api/v1/admin/inventory/):

    GET  /              Stock Levels tab — every catalogue product
    POST /adjust/       Apply an adjustment, write a movement
    GET  /movements/    Movements tab — the ledger

The `adjust` action is the only writer. It runs inside a
transaction, locks the product row, applies the delta, writes a
StockMovement, and returns the updated item. A failure anywhere
rolls back everything.

`reserved` is computed once per list request. See the serializer
for what it means.
"""

import logging

from django.db import transaction
from django.db.models import F, Sum
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
    """
    Return `{product_id: reserved_quantity}` for every product that
    has at least one unit held by a pending / confirmed / processing
    order.

    One query, no matter how many products. Products with zero
    reserved units don't appear — the serializer falls back to 0
    for missing keys.
    """
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
    """
    Return `{product_id: (name, slug)}` for the given ids.

    Feeds the Movements tab so each row can render the product name
    without a query per row. Deleted products simply don't appear —
    the serializer's fallback handles them.
    """
    if not product_ids:
        return {}
    return dict(
        Product.objects
        .filter(pk__in=product_ids)
        .values_list("pk", "name", "slug")
    )


class InventoryViewSet(ViewSet):
    """
    Stock Levels tab + Adjust action.
    """

    permission_classes = [IsAdminUser]

    def list(self, request):
        """
        Every catalogue product with its stock fields.

        Not filtered by `is_active` — an inactive product that still
        has stock on the shelf is worth knowing about, and hiding it
        would make the count mismatch the warehouse.
        """
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
        """
        Apply a stock adjustment.

        Runs atomically: lock the product, compute the new quantity,
        save, write a movement. A concurrent adjust on the same
        product blocks on the lock instead of racing.
        """
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
            else:  # Set
                new_qty = qty

            delta = new_qty - old_qty

            # No-op. Return early without writing a movement — a
            # ledger row with `delta=0` is noise.
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
    """
    Movements tab.

    Read-only. Newest first, capped at 500 rows. If the ledger ever
    grows past what a single page can render, add pagination here and
    the frontend's `unwrapList` will handle the envelope transparently.
    """

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