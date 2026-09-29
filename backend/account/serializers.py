from rest_framework import serializers

from .models import Address, Notification, Review, WishlistItem
from checkout.models import Order, OrderItem


# ─────────────────────────────────────────────────────────────────────────────
# Address
# ─────────────────────────────────────────────────────────────────────────────
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            "id", "label", "full_name", "phone",
            "street", "town", "county", "postal_code",
            "is_default", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


# ─────────────────────────────────────────────────────────────────────────────
# Notification
# ─────────────────────────────────────────────────────────────────────────────
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id", "type", "title", "body", "href", "metadata",
            "is_read", "read_at", "created_at",
        )
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────────────────────
# Review
# ─────────────────────────────────────────────────────────────────────────────
class ReviewProductSnapshotSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField(allow_blank=True)
    image = serializers.CharField(allow_blank=True)
    brand = serializers.CharField(allow_blank=True)


class ReviewSerializer(serializers.ModelSerializer):
    product = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id", "product", "variant_label", "rating", "title", "body",
            "images", "status", "rejection_reason", "is_verified_purchase",
            "created_at", "updated_at", "moderated_at",
        )
        read_only_fields = fields

    def get_product(self, obj):
        return {
            "id": obj.product_id,
            "name": obj.product_name,
            "slug": obj.product_slug,
            "image": obj.product_image,
            "brand": obj.product_brand,
        }


class ReviewWriteSerializer(serializers.Serializer):
    product_id = serializers.CharField(max_length=64, required=False)
    product_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True,
    )
    product_slug = serializers.CharField(
        max_length=255, required=False, allow_blank=True,
    )
    product_image = serializers.CharField(
        max_length=500, required=False, allow_blank=True,
    )
    product_brand = serializers.CharField(
        max_length=120, required=False, allow_blank=True,
    )
    variant_label = serializers.CharField(
        max_length=120, required=False, allow_blank=True,
    )
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(
        max_length=200, required=False, allow_blank=True,
    )
    body = serializers.CharField()
    images = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Wishlist
# ─────────────────────────────────────────────────────────────────────────────
class WishlistItemSerializer(serializers.ModelSerializer):
    product = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    stock_count = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()

    class Meta:
        model = WishlistItem
        fields = (
            "id", "added_at",
            "variant_id", "variant_name", "variant_image",
            "unit_price", "compare_at_price",
            "stock", "stock_count", "discount_percent",
            "product",
        )

    def get_product(self, obj):
        return {
            "id": obj.product_id,
            "name": obj.product_name,
            "slug": obj.product_slug,
            "brand": obj.product_brand,
            "image": obj.product_image,
            # Placeholders until a catalog provides ratings.
            "rating": "0.0",
            "review_count": 0,
        }

    def get_stock(self, obj):
        # Replace with a real variant lookup when catalog lands.
        return "In Stock"

    def get_stock_count(self, obj):
        return 0

    def get_discount_percent(self, obj):
        if obj.compare_at_price and obj.compare_at_price > obj.unit_price:
            pct = (
                (obj.compare_at_price - obj.unit_price)
                / obj.compare_at_price
                * 100
            )
            return int(pct)
        return 0


class WishlistAddSerializer(serializers.Serializer):
    product_id = serializers.CharField(max_length=64)
    variant_id = serializers.CharField(max_length=64)
    product_name = serializers.CharField(max_length=255)
    product_slug = serializers.CharField(
        max_length=255, required=False, allow_blank=True,
    )
    product_brand = serializers.CharField(
        max_length=120, required=False, allow_blank=True,
    )
    product_image = serializers.CharField(
        max_length=500, required=False, allow_blank=True,
    )
    variant_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True,
    )
    variant_image = serializers.CharField(
        max_length=500, required=False, allow_blank=True,
    )
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True,
    )


class WishlistCheckSerializer(serializers.Serializer):
    in_wishlist = serializers.BooleanField()
    wishlist_item_id = serializers.IntegerField(allow_null=True)


# ─────────────────────────────────────────────────────────────────────────────
# Orders (reads from checkout.Order — no model in this app)
# ─────────────────────────────────────────────────────────────────────────────
class OrderItemSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2,
    )
    image = serializers.CharField(source="image_url", allow_blank=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            "id", "product_id", "name", "brand",
            "price", "quantity", "image", "line_total",
        )

    def get_line_total(self, obj):
        return str(obj.unit_price * obj.quantity)


class OrderListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference")
    item_count = serializers.IntegerField(read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = Order
        fields = (
            "id", "reference", "status", "payment_status",
            "total", "item_count", "created_at",
        )


class OrderDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference")
    reference = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping = serializers.DecimalField(max_digits=12, decimal_places=2)
    tax = serializers.DecimalField(max_digits=12, decimal_places=2)

    payment_method = serializers.SerializerMethodField()
    payment_reference = serializers.SerializerMethodField()
    mpesa_receipt = serializers.SerializerMethodField()

    # Read from the frozen snapshot, not from User or Address.
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    address_street = serializers.SerializerMethodField()
    address_town = serializers.SerializerMethodField()
    address_county = serializers.SerializerMethodField()
    address_postal_code = serializers.SerializerMethodField()

    courier = serializers.SerializerMethodField()
    tracking_number = serializers.SerializerMethodField()

    coupon = serializers.CharField(source="coupon_code", allow_blank=True)
    notes = serializers.CharField(allow_blank=True)

    items = OrderItemSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()

    paid_at = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id", "reference", "status", "payment_status",
            "payment_method", "payment_reference", "mpesa_receipt",
            "email", "phone", "full_name",
            "address_street", "address_town", "address_county",
            "address_postal_code",
            "delivery_method", "estimated_delivery",
            "courier", "tracking_number",
            "subtotal", "discount", "shipping", "tax", "total",
            "coupon", "notes",
            "items", "timeline",
            "created_at", "updated_at", "paid_at",
        )

    # ── Snapshot readers ──
    def _snap(self, obj, key, default=""):
        return (obj.snapshot or {}).get(key, default) or default

    def get_email(self, obj):
        return self._snap(obj, "email")

    def get_phone(self, obj):
        return self._snap(obj, "phone")

    def get_full_name(self, obj):
        return self._snap(obj, "full_name")

    def get_address_street(self, obj):
        return self._snap(obj, "address_street")

    def get_address_town(self, obj):
        return self._snap(obj, "address_town")

    def get_address_county(self, obj):
        return self._snap(obj, "address_county")

    def get_address_postal_code(self, obj):
        return self._snap(obj, "address_postal_code")

    # ── Payment ──
    def _payment(self, obj):
        try:
            return obj.payment
        except Exception:
            return None

    def get_payment_method(self, obj):
        return "MPESA"

    def get_payment_reference(self, obj):
        p = self._payment(obj)
        return p.mpesa_receipt_number if p else ""

    def get_mpesa_receipt(self, obj):
        p = self._payment(obj)
        return p.mpesa_receipt_number if p else ""

    def get_paid_at(self, obj):
        p = self._payment(obj)
        if p and p.status == "SUCCESS":
            return p.updated_at.isoformat()
        return None

    # ── Placeholders until shipping integration ──
    def get_courier(self, obj):
        return ""

    def get_tracking_number(self, obj):
        return ""

    # ── Empty until OrderEvent model exists ──
    def get_timeline(self, obj):
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Overview
# ─────────────────────────────────────────────────────────────────────────────
class OverviewRecentOrderSerializer(serializers.Serializer):
    id = serializers.CharField()
    date = serializers.DateTimeField()
    status = serializers.CharField()
    itemCount = serializers.IntegerField()
    total = serializers.CharField()


class OverviewStatsSerializer(serializers.Serializer):
    total_orders = serializers.IntegerField()
    in_transit = serializers.IntegerField()
    wishlist_count = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()


class OverviewSerializer(serializers.Serializer):
    user = serializers.DictField()
    default_address = AddressSerializer(allow_null=True)
    stats = OverviewStatsSerializer()
    recent_orders = OverviewRecentOrderSerializer(many=True)


# ─────────────────────────────────────────────────────────────────────────────
# Profile / preferences (settings page)
# ─────────────────────────────────────────────────────────────────────────────
class ProfileSerializer(serializers.Serializer):
    """Read shape — matches the frontend's ProfileData type."""

    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(allow_blank=True)

    whatsapp_updates = serializers.BooleanField()
    email_promotions = serializers.BooleanField()
    sms_promotions = serializers.BooleanField()
    newsletter = serializers.BooleanField()

    deletion_requested_at = serializers.DateTimeField(allow_null=True)
    joined_at = serializers.DateTimeField(source="date_joined")


class ProfileUpdateSerializer(serializers.Serializer):
    """Write shape — email and preferences are NOT editable here.

    Email is the login identifier — changing it needs re-verification.
    Preferences have their own endpoint.
    """

    first_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150,
    )
    last_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150,
    )
    phone = serializers.CharField(
        required=False, allow_blank=True, max_length=32,
    )


class PreferencesSerializer(serializers.Serializer):
    """Four booleans. Used for both read and write."""

    whatsapp_updates = serializers.BooleanField(required=False)
    email_promotions = serializers.BooleanField(required=False)
    sms_promotions = serializers.BooleanField(required=False)
    newsletter = serializers.BooleanField(required=False)