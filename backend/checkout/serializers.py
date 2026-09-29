from decimal import Decimal

from rest_framework import serializers

from .models import Coupon, Order, OrderItem, Payment


# ─────────────────────────────────────────────────────────────────────────────
# Inbound: the checkout payload embedded in the stk-push call
# ─────────────────────────────────────────────────────────────────────────────
class CheckoutAddressSerializer(serializers.Serializer):
    street = serializers.CharField(max_length=255)
    town = serializers.CharField(max_length=120)
    county = serializers.CharField(max_length=120)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )


class CheckoutItemSerializer(serializers.Serializer):
    productId = serializers.CharField(max_length=64, allow_blank=True)
    name = serializers.CharField(max_length=255)
    brand = serializers.CharField(
        max_length=120, required=False, allow_blank=True
    )
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = serializers.IntegerField(min_value=1)
    image = serializers.CharField(
        max_length=500, required=False, allow_blank=True
    )


class CheckoutTotalsSerializer(serializers.Serializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping = serializers.DecimalField(max_digits=12, decimal_places=2)
    tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class CheckoutPayloadSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)
    full_name = serializers.CharField(max_length=255)
    address = CheckoutAddressSerializer()
    delivery_method = serializers.ChoiceField(
        choices=("express", "standard", "pickup")
    )
    estimated_delivery = serializers.CharField(
        max_length=64, required=False, allow_blank=True
    )
    coupon = serializers.CharField(
        max_length=32, required=False, allow_blank=True, allow_null=True
    )
    notes = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    items = CheckoutItemSerializer(many=True)
    totals = CheckoutTotalsSerializer()


class StkPushSerializer(serializers.Serializer):
    order_reference = serializers.CharField(max_length=64)
    amount = serializers.IntegerField(min_value=1)
    phone_number = serializers.CharField(max_length=32)
    metadata = serializers.DictField(required=False, allow_null=True)
    checkout = CheckoutPayloadSerializer()

    # Not part of the original frontend payload — accepted so the backend
    # can create the account. Frontend should be updated to send it.
    password = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: Payment — must match the success page's expected shape
# ─────────────────────────────────────────────────────────────────────────────
class PaymentSerializer(serializers.ModelSerializer):
    order_reference = serializers.CharField(read_only=True)
    snapshot = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "status",
            "amount",
            "phone_number",
            "order_reference",
            "created_at",
            "updated_at",
            "user",
            "snapshot",
            "result_code",
            "result_description",
            "mpesa_receipt_number",
        )

    def get_snapshot(self, obj):
        return obj.order.snapshot

    def get_user(self, obj):
        return obj.order.user_id


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: Order (used by /api/orders/<ref>/ if you ever add it)
# ─────────────────────────────────────────────────────────────────────────────
class OrderItemReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "product_id",
            "name",
            "brand",
            "unit_price",
            "quantity",
            "image_url",
        )


class OrderReadSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "reference",
            "status",
            "payment_status",
            "delivery_method",
            "estimated_delivery",
            "notes",
            "coupon_code",
            "subtotal",
            "discount",
            "shipping",
            "tax",
            "total",
            "snapshot",
            "items",
            "created_at",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Coupon validate
# ─────────────────────────────────────────────────────────────────────────────
class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)


    