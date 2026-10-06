"""
Inventory serializers.

Two read shapes and one write shape:

  * `InventoryItemSerializer`   — a catalogue product with stock fields
  * `MovementSerializer`        — one row from the StockMovement ledger
  * `AdjustStockWriteSerializer` — the Adjust modal's payload

The `currentStock`, `reserved`, and `available` numbers on an
inventory item are computed, not stored:

    currentStock = Product.stock_quantity
    reserved     = sum of quantities on pending / confirmed / processing
                   OrderItems for this product
    available    = max(0, currentStock - reserved)

`reserved` is what makes "available" honest. A customer with a
confirmed order has units held; the storefront shouldn't advertise
them as purchasable until the order either ships or is cancelled.
"""

from django.db.models import Sum
from rest_framework import serializers

from catalog.models import Product
from checkout.models import Order, OrderItem

from .models import StockMovement


# ─────────────────────────────────────────────────────────────────────────────
# Stock Levels tab
# ─────────────────────────────────────────────────────────────────────────────
class InventoryItemSerializer(serializers.ModelSerializer):
    """
    One row on the Stock Levels tab.

    `id` is the catalogue product id (a string), not a numeric pk.
    The frontend keys rows by it and passes it back on `adjust`.
    """

    name = serializers.CharField()
    sku = serializers.CharField(source="slug", allow_blank=True)
    image = serializers.SerializerMethodField()
    category = serializers.CharField(source="category.name")
    brand = serializers.CharField(source="brand.name")

    currentStock = serializers.IntegerField(source="stock_quantity")
    threshold = serializers.IntegerField(source="low_stock_threshold")
    status = serializers.CharField(source="stock_status")

    reserved = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "image", "category", "brand",
            "currentStock", "threshold", "status",
            "reserved", "available",
        )

    def get_image(self, obj) -> str:
        """
        Prefer the first image's `external_url` (admin / CDN / data URL),
        fall back to the uploaded file, return "" if neither exists.

        The frontend renders an icon placeholder when the string is
        empty — no broken `<img>` tags.
        """
        first = obj.images.first()
        if not first:
            return ""
        if first.external_url:
            return first.external_url
        if not first.image:
            return ""
        request = self.context.get("request")
        url = first.image.url
        return request.build_absolute_uri(url) if request else url

    def _reserved_qty(self, obj) -> int:
        """
        Units held by in-flight orders.

        Uses the view's prefetched map when available (one query for
        the whole list), falls back to a per-row query otherwise. Same
        pattern as the suppliers serializer's `currentStock`.
        """
        reserved_map = self.context.get("reserved_map")
        if reserved_map is not None:
            return reserved_map.get(obj.pk, 0)

        return (
            OrderItem.objects
            .filter(
                product_id=obj.pk,
                order__status__in=[
                    Order.Status.PENDING,
                    Order.Status.CONFIRMED,
                    Order.Status.PROCESSING,
                ],
            )
            .aggregate(total=Sum("quantity"))["total"]
            or 0
        )

    def get_reserved(self, obj) -> int:
        return self._reserved_qty(obj)

    def get_available(self, obj) -> int:
        return max(0, obj.stock_quantity - self._reserved_qty(obj))


# ─────────────────────────────────────────────────────────────────────────────
# Movements tab
# ─────────────────────────────────────────────────────────────────────────────
class MovementSerializer(serializers.ModelSerializer):
    """
    One row from the ledger.

    `productName` and `sku` are denormalized on read — the movement
    stores only `product_id`, so we look the catalogue product up.
    Cached per-serializer instance to avoid a query per row.

    `type` is the raw reason (`sale`, `restock`), not the display
    label. The frontend maps it to a label. Keeping the raw value on
    the wire means adding a new reason doesn't break the client.
    """

    type = serializers.CharField(source="reason")
    productName = serializers.SerializerMethodField()
    sku = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source="created_at")
    quantity = serializers.IntegerField(source="quantity_delta")

    class Meta:
        model = StockMovement
        fields = (
            "id", "date", "productName", "sku", "type", "quantity",
            "reference", "user", "notes",
        )

    def _product_map(self) -> dict:
        """
        Lazy-built `{product_id: (name, slug)}` cache.

        Built once per serializer instance the first time a row needs
        it. The view prefetches every product referenced by the
        movements list and stashes the result here to keep this a
        dict lookup.

        If the view didn't prefetch, this returns `{}` and each row
        falls back to a per-row query — correct but slow.
        """
        if not hasattr(self, "_product_cache"):
            self._product_cache = self.context.get("product_map") or {}
        return self._product_cache

    def _product_lookup(self, product_id: str):
        """
        Return (name, slug) for a product id, or a fallback pair for
        a deleted product. Uses the prefetched map when available.
        """
        cache = self._product_map()
        if product_id in cache:
            return cache[product_id]

        # Fallback: no prefetch, or a product id not in the map
        # (deleted product that still has movements).
        row = (
            Product.objects
            .filter(pk=product_id)
            .values_list("name", "slug")
            .first()
        )
        if row:
            cache[product_id] = row
            return row
        return ("(deleted product)", "")

    def get_productName(self, obj) -> str:
        name, _ = self._product_lookup(obj.product_id)
        return name

    def get_sku(self, obj) -> str:
        _, slug = self._product_lookup(obj.product_id)
        return slug

    def get_user(self, obj) -> str:
        if not obj.actor:
            return "System"
        full = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
        return full or obj.actor.email or f"User {obj.actor.pk}"


# ─────────────────────────────────────────────────────────────────────────────
# Adjust modal
# ─────────────────────────────────────────────────────────────────────────────
class AdjustStockWriteSerializer(serializers.Serializer):
    """
    Payload for `POST /api/v1/admin/inventory/adjust/`.

    `type` maps to three arithmetic operations:

        Add     new = current + quantity
        Remove  new = max(0, current - quantity)
        Set     new = quantity (overwrite)

    `reason` is free-form and stored as-is on the movement row. The
    frontend sends `restock`, `damage`, `return`, or `correction`.
    The backend does not enforce membership — the reason is for the
    audit trail, not for logic.
    """

    productId = serializers.CharField(max_length=64)
    type = serializers.ChoiceField(choices=["Add", "Remove", "Set"])
    quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        default="adjustment",
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )