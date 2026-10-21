from django.db.models import Sum
from rest_framework import serializers

from catalog.models import Product
from checkout.models import Order, OrderItem

from .models import StockMovement


class InventoryItemSerializer(serializers.ModelSerializer):
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


class MovementSerializer(serializers.ModelSerializer):
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
        if not hasattr(self, "_product_cache"):
            self._product_cache = self.context.get("product_map") or {}
        return self._product_cache

    def _product_lookup(self, product_id: str):
        cache = self._product_map()
        if product_id in cache:
            return cache[product_id]

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


class AdjustStockWriteSerializer(serializers.Serializer):
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