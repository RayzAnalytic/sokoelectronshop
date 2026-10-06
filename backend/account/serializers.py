"""
account/serializers.py

Read and write serializers for the customer account pages.

SETTINGS AWARENESS
==================
    Two settings surface on order responses so the customer dashboard
    can render prices with the correct currency and hide the tax row
    when the shop doesn't charge VAT:

      * `general.currency`           — shop's ISO code, exposed as
                                        `currency` on every order
                                        payload

      * `tax.vat_enabled`            — gates whether the tax row
                                        should be shown at all

      * `tax.prices_include_tax`     — tells the frontend whether the
                                        subtotal already contains VAT,
                                        which decides whether the tax
                                        row is a breakdown or an add-on

    The historical `tax` value on the Order row is a frozen snapshot
    from the moment the order was placed. It never changes when the
    settings change — orders keep the totals they were created with.
    The settings only affect (a) how the frontend labels things and
    (b) what new orders look like when they're created. The serializer
    exposes the flags so the frontend can make the right display
    choice on a per-order basis.

    Every read fails safe: currency falls back to "KES", VAT falls
    back to enabled, prices_include_tax falls back to False. That
    matches the pre-settings behavior for management commands, tests,
    and the first migration.

ORDER TIMELINE
--------------
`OrderDetailSerializer.timeline` reads from `OrderStatusEvent` — the
model that records every status transition. Each event serializes to:

    {
      "id": 1,
      "status": "Shipped",              # display label
      "from_status": "Processing",      # display label (empty for creation)
      "to_status": "shipped",           # raw value, for programmatic checks
      "actor_label": "Admin Grace",
      "note": "Handed to G4S.",
      "created_at": "2026-10-02T08:15:00Z"
    }

PREFETCH CONTRACT
-----------------
`OrderListSerializer` and `OrderDetailSerializer` assume the view
prefetches with `to_attr` — see the docstring on `get_preview_items`
and `get_timeline` for the exact queries.

SHIPPING FIELDS
---------------
`courier` and `tracking_number` were moved from `Order.snapshot` (a
frozen JSON blob) to first-class columns. The serializer reads the
columns directly. Snapshot fallbacks are kept for legacy rows.

REVIEW MODERATION SURFACE
-------------------------
`ReviewSerializer` (the customer-facing read shape) exposes
`helpful_count` and the shop's `replies[]`. Internal moderation state
(`flag_status`, `flag_reason`, `flagged_by`, `flagged_at`) is
deliberately NOT exposed here; that lives on the admin moderation
serializer in `dashboard/reviews/serializers.py`.

The `reviews.reviews_enabled` gate lives in `account.services` — this
serializer is a pure shape translator. When reviews are disabled,
`get_pending_reviews()` returns an empty list, and the review write
path is refused upstream. Nothing here changes.
"""

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from authentication.managers import normalize_phone
from checkout.constants import KENYAN_COUNTIES
from checkout.models import Order, OrderItem, OrderStatusEvent

from .models import Address, Notification, Review, ReviewReply, WishlistItem


# ═══════════════════════════════════════════════════════════════════════════
# Settings helpers — safe during migrations / cold boot
# ═══════════════════════════════════════════════════════════════════════════
def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _currency() -> str:
    s = _settings()
    return s['general'].currency if s else 'KES'


def _vat_enabled() -> bool:
    s = _settings()
    return bool(s['tax'].vat_enabled) if s else True


def _prices_include_tax() -> bool:
    s = _settings()
    return bool(s['tax'].prices_include_tax) if s else False


# ═══════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════
# Max image size for review uploads. The frontend advertises 5 MB.
# Enforced server-side so a crafted request can't bypass the UI limit.
REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024


# ═══════════════════════════════════════════════════════════════════════════
# 1. ADDRESSES
# ═══════════════════════════════════════════════════════════════════════════
class AddressSerializer(serializers.ModelSerializer):
    """Read shape for an address row."""

    class Meta:
        model = Address
        fields = (
            "id", "label", "full_name", "phone",
            "street", "town", "county", "postal_code",
            "is_default", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class AddressInputSerializer(serializers.ModelSerializer):
    """
    Write shape for address create/update.

    County is validated against the same 47-item list the frontend's
    dropdown restricts to. Phone is normalized through the same helper
    the register and checkout flows use.
    """

    class Meta:
        model = Address
        fields = (
            "label",
            "full_name",
            "phone",
            "street",
            "town",
            "county",
            "postal_code",
            "is_default",
        )

    def validate_phone(self, value):
        phone = (value or "").strip()
        if not phone:
            return ""
        try:
            return normalize_phone(phone)
        except Exception:
            raise serializers.ValidationError(
                "Please enter a valid phone number."
            )

    def validate_county(self, value):
        county = (value or "").strip()
        if county not in KENYAN_COUNTIES:
            raise serializers.ValidationError(
                "Please select a valid Kenyan county."
            )
        return county


# ═══════════════════════════════════════════════════════════════════════════
# 2. NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════
class NotificationSerializer(serializers.ModelSerializer):
    """
    Read shape for a notification row.

    Everything is read-only. The only mutation the API exposes is
    marking a notification read (via a dedicated endpoint) or
    deleting it — the serializer is only used on GET.
    """

    class Meta:
        model = Notification
        fields = (
            "id", "type", "title", "body", "href", "metadata",
            "is_read", "read_at", "created_at",
        )
        read_only_fields = fields


# ═══════════════════════════════════════════════════════════════════════════
# 3. PROFILE & PREFERENCES
# ═══════════════════════════════════════════════════════════════════════════
class ProfileSerializer(serializers.Serializer):
    """
    Read shape — serialized from a User instance.

    Preference booleans live directly on User (they are columns on the
    custom User model, not a related `preferences` OneToOne).
    """

    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    email = serializers.EmailField()
    phone = serializers.CharField(allow_blank=True)

    whatsapp_updates = serializers.BooleanField()
    email_promotions = serializers.BooleanField()
    sms_promotions = serializers.BooleanField()
    newsletter = serializers.BooleanField()

    deletion_requested_at = serializers.DateTimeField(allow_null=True)
    joined_at = serializers.DateTimeField(source="date_joined")


class ProfileUpdateSerializer(serializers.Serializer):
    """
    Write shape — email and preferences are NOT editable here.
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

    def validate_phone(self, value):
        phone = (value or "").strip()
        if not phone:
            return ""

        try:
            phone = normalize_phone(phone)
        except Exception:
            raise serializers.ValidationError(
                "Please enter a valid phone number."
            )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        current = getattr(self.instance, "pk", None)
        qs = User.objects.filter(phone=phone)
        if current is not None:
            qs = qs.exclude(pk=current)
        if qs.exists():
            raise serializers.ValidationError(
                "This phone number is already in use on another account."
            )

        return phone


class PreferencesSerializer(serializers.Serializer):
    """
    Four booleans. Used for both read and write of user preferences.
    """

    whatsapp_updates = serializers.BooleanField(required=False)
    email_promotions = serializers.BooleanField(required=False)
    sms_promotions = serializers.BooleanField(required=False)
    newsletter = serializers.BooleanField(required=False)


# ═══════════════════════════════════════════════════════════════════════════
# 4. REVIEWS
# ═══════════════════════════════════════════════════════════════════════════
class ReviewProductSnapshotSerializer(serializers.Serializer):
    """
    Nested product block on a review read.
    """
    id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField(allow_blank=True)
    image = serializers.CharField(allow_blank=True)
    brand = serializers.CharField(allow_blank=True)


class ReviewReplyReadSerializer(serializers.ModelSerializer):
    """
    Read shape for one staff reply, as the customer sees it.
    """

    author = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ReviewReply
        fields = ("id", "author", "date", "text")
        read_only_fields = fields

    def get_author(self, obj) -> str:
        if not obj.author_id:
            return "Support"
        user = obj.author
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.email or "Support"


class ReviewSerializer(serializers.ModelSerializer):
    """
    Read shape for a Review row — the customer-facing shape.
    """

    product = serializers.SerializerMethodField()
    order_reference = serializers.CharField(read_only=True)
    replies = ReviewReplyReadSerializer(many=True, read_only=True)
    helpful_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Review
        fields = (
            "id", "product", "variant_label",
            "rating", "title", "body", "images",
            "status", "rejection_reason", "is_verified_purchase",
            "order_reference",
            "helpful_count", "replies",
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
    """
    Create / update payload for a review.
    """

    product_id = serializers.CharField(max_length=64)
    product_name = serializers.CharField(max_length=255)
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

    order_reference = serializers.CharField(
        max_length=64, required=False, allow_blank=True,
    )

    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(
        max_length=200, required=False, allow_blank=True,
    )
    body = serializers.CharField()
    images = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True,
    )

    _IMMUTABLE = (
        "order_reference",
        "product_id",
        "product_name",
        "product_slug",
        "product_image",
        "product_brand",
        "variant_label",
    )

    def validate(self, attrs):
        ref = (attrs.get("order_reference") or "").strip()
        product_id = attrs.get("product_id")

        if not ref:
            return attrs

        user = self.context["request"].user
        order = Order.objects.filter(reference=ref, user=user).first()
        if order is None:
            raise serializers.ValidationError(
                {"order_reference": "No such order for this account."}
            )

        if not OrderItem.objects.filter(
            order=order, product_id=product_id,
        ).exists():
            raise serializers.ValidationError(
                {
                    "order_reference": (
                        "This order does not contain the reviewed product."
                    )
                }
            )

        attrs["_resolved_order"] = order
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        order = validated_data.pop("_resolved_order", None)
        validated_data.pop("order_reference", None)

        is_verified = bool(
            order is not None and order.status == Order.Status.DELIVERED
        )

        return Review.objects.create(
            user=user,
            order=order,
            is_verified_purchase=is_verified,
            status=Review.Status.PENDING,
            flag_status=Review.FlagStatus.NONE,
            flag_reason="",
            helpful_count=0,
            **validated_data,
        )

    def update(self, instance, validated_data):
        for immutable in self._IMMUTABLE:
            validated_data.pop(immutable, None)
        validated_data.pop("_resolved_order", None)

        for key, value in validated_data.items():
            setattr(instance, key, value)

        instance.status = Review.Status.PENDING
        instance.rejection_reason = ""
        instance.moderated_at = None
        instance.moderated_by = None

        if instance.flag_status == Review.FlagStatus.FLAGGED:
            instance.flag_status = Review.FlagStatus.NONE
            instance.flag_reason = ""
            instance.flagged_at = None
            instance.flagged_by = None

        instance.save()
        return instance


class ReviewImageUploadSerializer(serializers.Serializer):
    """
    One file per call. Returns the stored URL.
    """

    file = serializers.ImageField()

    def validate_file(self, value):
        if value.size > REVIEW_IMAGE_MAX_BYTES:
            mb = REVIEW_IMAGE_MAX_BYTES // (1024 * 1024)
            raise serializers.ValidationError(
                f"Image must be under {mb} MB."
            )
        return value


class PendingReviewItemSerializer(serializers.Serializer):
    """
    A delivered OrderItem the user hasn't reviewed yet.

    The list is empty when `reviews.reviews_enabled` is off — the gate
    lives in `account.services.get_pending_reviews`, not here.
    """

    order_reference = serializers.CharField()
    delivered_at = serializers.DateTimeField()
    product_id = serializers.CharField()
    product_name = serializers.CharField()
    product_image = serializers.CharField(allow_blank=True)
    product_brand = serializers.CharField(allow_blank=True)
    quantity = serializers.IntegerField()


# ═══════════════════════════════════════════════════════════════════════════
# 5. WISHLIST
# ═══════════════════════════════════════════════════════════════════════════
class WishlistItemSerializer(serializers.ModelSerializer):
    """
    Read shape for a wishlist row.
    """

    product = serializers.SerializerMethodField()

    class Meta:
        model = WishlistItem
        fields = (
            "id", "added_at",
            "product_id", "product_name", "product_slug",
            "product_brand", "product_image",
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
            "rating": str(obj.rating),
            "review_count": obj.review_count,
        }


class WishlistAddSerializer(serializers.Serializer):
    """
    Create-or-update payload. Every field the model stores on add is
    accepted, so a subsequent read reflects what the client sent.
    """

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

    stock = serializers.ChoiceField(
        choices=WishlistItem.Stock.choices,
        required=False,
        default=WishlistItem.Stock.IN,
    )
    stock_count = serializers.IntegerField(
        required=False, default=0, min_value=0,
    )
    discount_percent = serializers.IntegerField(
        required=False, default=0, min_value=0, max_value=100,
    )
    rating = serializers.DecimalField(
        max_digits=3, decimal_places=2, required=False, default=0,
    )
    review_count = serializers.IntegerField(
        required=False, default=0, min_value=0,
    )


class WishlistCheckSerializer(serializers.Serializer):
    """Response shape for a single-variant wishlist membership check."""

    in_wishlist = serializers.BooleanField()
    wishlist_item_id = serializers.IntegerField(allow_null=True)


class WishlistBatchCheckSerializer(serializers.Serializer):
    """
    Batch membership check.
    """

    variant_ids = serializers.ListField(
        child=serializers.CharField(max_length=64),
        allow_empty=True,
        max_length=200,
    )


class WishlistBatchAddSerializer(serializers.Serializer):
    """Batch merge payload — used on login to fold in a guest wishlist."""

    items = WishlistAddSerializer(many=True, max_length=200)


# ═══════════════════════════════════════════════════════════════════════════
# 6. ORDERS
# ═══════════════════════════════════════════════════════════════════════════
def _status_label(value: str) -> str:
    """
    Convert a raw Order.Status value to its display label.
    """
    if not value:
        return ""
    return dict(Order.Status.choices).get(value, value)


class OrderItemSerializer(serializers.ModelSerializer):
    """Line item on a full order detail."""

    price = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2,
    )
    image = serializers.CharField(source="image_url", allow_blank=True)

    class Meta:
        model = OrderItem
        fields = (
            "id", "product_id", "name", "brand",
            "price", "quantity", "image",
        )


class OrderPreviewItemSerializer(serializers.ModelSerializer):
    """Minimal shape for the list-card thumbnail strip."""

    image = serializers.CharField(source="image_url", allow_blank=True)

    class Meta:
        model = OrderItem
        fields = ("image", "name", "quantity")


class OrderStatusEventSerializer(serializers.ModelSerializer):
    """
    One row on the order timeline.
    """

    status = serializers.SerializerMethodField()
    from_status = serializers.SerializerMethodField()
    to_status = serializers.CharField(allow_blank=True)
    note = serializers.CharField(allow_blank=True)
    actor_label = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()

    class Meta:
        model = OrderStatusEvent
        fields = (
            "id",
            "status",
            "from_status",
            "to_status",
            "note",
            "actor_label",
            "created_at",
        )
        read_only_fields = fields

    def get_status(self, obj):
        return _status_label(obj.to_status)

    def get_from_status(self, obj):
        return _status_label(obj.from_status)


class OrderListSerializer(serializers.ModelSerializer):
    """
    List row for /account/orders/.

    Currency added so the frontend can format each row's total without
    a separate header lookup or a per-row settings fetch.
    """

    id = serializers.CharField(source="reference")
    reference = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    preview_items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id", "reference", "status", "payment_status",
            "total", "currency",
            "item_count", "preview_items", "created_at",
        )

    def get_currency(self, obj):
        return _currency()

    def get_item_count(self, obj):
        annotated = getattr(obj, "item_count", None)
        if annotated is not None:
            return annotated
        items = getattr(obj, "prefetched_items", None)
        if items is None:
            items = obj.items.all()
        return sum(i.quantity for i in items)

    def get_preview_items(self, obj):
        items = getattr(obj, "prefetched_items", None)
        if items is None:
            items = list(obj.items.all())
        return OrderPreviewItemSerializer(items[:4], many=True).data


class OrderDetailSerializer(serializers.ModelSerializer):
    """
    Full order detail — used by /account/orders/<ref>/ and the admin
    order detail page.

    CURRENCY + TAX DISPLAY
    ----------------------
    The order stores historical totals. This serializer adds three
    fields that reflect the shop's CURRENT display preferences so the
    frontend knows how to render the totals block:

      * `currency`          — shop's ISO code
      * `tax_enabled`       — whether to render the tax row at all
      * `prices_include_tax` — whether `subtotal` already contains
                                the tax value, or it's an add-on

    The `tax` field itself is the frozen historical value from order
    time. It doesn't change when the setting changes. Only the
    labels and the row visibility do.
    """

    id = serializers.CharField(source="reference")
    reference = serializers.CharField()

    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping = serializers.DecimalField(max_digits=12, decimal_places=2)
    tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.SerializerMethodField()
    tax_enabled = serializers.SerializerMethodField()
    prices_include_tax = serializers.SerializerMethodField()

    payment_method = serializers.SerializerMethodField()
    payment_reference = serializers.SerializerMethodField()
    mpesa_receipt = serializers.SerializerMethodField()
    paid_at = serializers.SerializerMethodField()

    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    address_street = serializers.SerializerMethodField()
    address_town = serializers.SerializerMethodField()
    address_county = serializers.SerializerMethodField()
    address_postal_code = serializers.SerializerMethodField()

    courier = serializers.SerializerMethodField()
    tracking_number = serializers.SerializerMethodField()

    coupon = serializers.CharField(
        source="coupon_code", allow_blank=True, default="",
    )
    notes = serializers.CharField(allow_blank=True, default="")

    items = OrderItemSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()

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
            "currency", "tax_enabled", "prices_include_tax",
            "coupon", "notes",
            "items", "timeline",
            "created_at", "updated_at", "paid_at",
        )

    # ── Currency + tax display ──────────────────────────────────────────
    def get_currency(self, obj):
        return _currency()

    def get_tax_enabled(self, obj):
        return _vat_enabled()

    def get_prices_include_tax(self, obj):
        return _prices_include_tax()

    # ── Snapshot readers ────────────────────────────────────────────────
    def _snap(self, obj, key, default=""):
        snap = obj.snapshot or {}
        value = snap.get(key, default)
        return value if value is not None else default

    def get_email(self, obj):
        return obj.contact_email or self._snap(obj, "email")

    def get_phone(self, obj):
        return obj.contact_phone or self._snap(obj, "phone")

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

    # ── Payment ─────────────────────────────────────────────────────────
    def _successful_payment(self, obj):
        try:
            return obj.successful_payment
        except ObjectDoesNotExist:
            return None

    def _latest_payment(self, obj):
        try:
            return obj.latest_payment
        except ObjectDoesNotExist:
            return None

    def get_payment_method(self, obj):
        if obj.payment_method == Order.PaymentMethod.MPESA:
            return "M-PESA"
        if obj.payment_method == Order.PaymentMethod.COD:
            return "Cash on delivery"
        return obj.payment_method or "—"

    def get_payment_reference(self, obj):
        p = self._successful_payment(obj) or self._latest_payment(obj)
        return getattr(p, "mpesa_receipt_number", "") if p else ""

    def get_mpesa_receipt(self, obj):
        p = self._successful_payment(obj)
        return getattr(p, "mpesa_receipt_number", "") if p else ""

    def get_paid_at(self, obj):
        p = self._successful_payment(obj)
        return p.updated_at.isoformat() if p is not None else None

    # ── Shipping ────────────────────────────────────────────────────────
    def get_courier(self, obj):
        return obj.courier or self._snap(obj, "courier")

    def get_tracking_number(self, obj):
        return obj.tracking_number or self._snap(obj, "tracking_number")

    # ── Timeline ────────────────────────────────────────────────────────
    def get_timeline(self, obj):
        events = getattr(obj, "prefetched_status_events", None)
        if events is None:
            events = obj.status_events.all().order_by("-created_at")
        return OrderStatusEventSerializer(events, many=True).data


class OrderReorderItemSerializer(serializers.Serializer):
    """
    Response shape for /orders/<ref>/reorder/ — one entry per line
    item, in the cart-payload shape the frontend expects.
    """

    variant_id = serializers.CharField(allow_blank=True)
    product_id = serializers.CharField(allow_blank=True)
    name = serializers.CharField()
    brand = serializers.CharField(allow_blank=True)
    image = serializers.CharField(allow_blank=True)
    slug = serializers.CharField(allow_blank=True)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = serializers.IntegerField()


# ═══════════════════════════════════════════════════════════════════════════
# 7. OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════
class OverviewUserSerializer(serializers.Serializer):
    """
    User block on the overview payload.
    """

    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    joined_at = serializers.DateTimeField(allow_null=True)


class OverviewRecentOrderSerializer(serializers.Serializer):
    """
    Compact order row for the overview's recent-orders list.

    `currency` added so the overview page can format the recent-order
    totals without fetching each order's detail.
    """

    id = serializers.CharField()
    date = serializers.DateTimeField()
    status = serializers.CharField()
    itemCount = serializers.IntegerField()
    total = serializers.CharField()
    currency = serializers.CharField()


class OverviewStatsSerializer(serializers.Serializer):
    """
    Stat tiles for the account overview page.
    """

    total_orders = serializers.IntegerField()
    in_transit = serializers.IntegerField()
    pending = serializers.IntegerField()
    wishlist_count = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()
    pending_reviews = serializers.IntegerField(default=0)


class OverviewSerializer(serializers.Serializer):
    """Composite payload for /account/overview/."""

    user = OverviewUserSerializer()
    default_address = AddressSerializer(allow_null=True)
    stats = OverviewStatsSerializer()
    recent_orders = OverviewRecentOrderSerializer(many=True)
    currency = serializers.CharField()


# ═══════════════════════════════════════════════════════════════════════════
# 8. BACKWARD-COMPATIBILITY ALIASES
# ═══════════════════════════════════════════════════════════════════════════
ReviewRowSerializer = ReviewSerializer
ProfileDataSerializer = ProfileSerializer
OrderListRowSerializer = OrderListSerializer