"""
DRF serializers. Two directions:

  OUTBOUND — what the admin page reads. Field names match the
             frontend's TypeScript interfaces exactly.

  INBOUND  — small, focused payloads for actions (block, notes,
             messages).

NOTE on `dateJoined`:
    `User.date_joined` is a `DateTimeField`. DRF's `DateField` refuses
    to coerce a datetime to a date because it would silently drop
    timezone information — it raises an `AssertionError` at serialization
    time. Both the list and detail serializers therefore use a
    `SerializerMethodField` that formats the datetime explicitly with
    `.date().isoformat()`, which is the `YYYY-MM-DD` shape the frontend
    expects.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from account.models import Address, Review, WishlistItem
from checkout.models import CartItem, Order

from .constants import (
    CommunicationChannel,
    CustomerSegment,
    CustomerStatus,
    MarketingConsent,
    SupportTicketPriority,
    SupportTicketStatus,
)
from .models import CommunicationLog, CustomerNote, SupportTicket

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Mapping helpers
# ─────────────────────────────────────────────────────────────────────────────
def _map_status(user_status: str) -> str:
    """User.SUSPENDED → Blocked. Everything else → Active."""
    return (
        CustomerStatus.BLOCKED
        if user_status == "SUSPENDED"
        else CustomerStatus.ACTIVE
    )


def _map_consent(user) -> str:
    flags = [
        user.whatsapp_updates,
        user.email_promotions,
        user.sms_promotions,
        user.newsletter,
    ]
    if all(flags):
        return MarketingConsent.SUBSCRIBED
    if not any(flags):
        return MarketingConsent.UNSUBSCRIBED
    return MarketingConsent.PENDING


def _display_name(user) -> str:
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.email


def _location_from_default_address(user) -> str:
    """
    Derive a display location from the customer's default address.

    Returns "" when the customer has no address yet — the frontend
    already handles empty strings gracefully.
    """
    addr = (
        Address.objects
        .filter(user_id=user.pk)
        .order_by("-is_default", "-updated_at")
        .first()
    )
    if not addr:
        return ""
    parts = [p for p in (addr.town, addr.county, "Kenya") if p]
    return ", ".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# List serializer — one row of the table
# ─────────────────────────────────────────────────────────────────────────────
class CustomerListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    dateJoined = serializers.SerializerMethodField()
    ordersCount = serializers.SerializerMethodField()
    totalSpent = serializers.SerializerMethodField()
    lastOrderDate = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    segment = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "avatar",
            "email",
            "phone",
            "location",
            "dateJoined",
            "ordersCount",
            "totalSpent",
            "lastOrderDate",
            "status",
            "segment",
        )

    def get_name(self, obj):
        return _display_name(obj)

    def get_avatar(self, obj):
        # No avatar field exists on User. Return empty string — the
        # frontend falls back to initials when this is falsy.
        return ""

    def get_location(self, obj):
        return _location_from_default_address(obj)

    def get_dateJoined(self, obj):
        return obj.date_joined.date().isoformat() if obj.date_joined else None

    def _profile(self, obj):
        return getattr(obj, "customer_profile", None)

    def get_ordersCount(self, obj):
        p = self._profile(obj)
        return p.orders_count if p else 0

    def get_totalSpent(self, obj):
        p = self._profile(obj)
        return float(p.total_spent) if p else 0.0

    def get_lastOrderDate(self, obj):
        p = self._profile(obj)
        if not p or not p.last_order_date:
            return None
        return p.last_order_date.date().isoformat()

    def get_status(self, obj):
        return _map_status(obj.status)

    def get_segment(self, obj):
        p = self._profile(obj)
        return p.segment if p else CustomerSegment.REGULAR


# ─────────────────────────────────────────────────────────────────────────────
# Nested read serializers
# ─────────────────────────────────────────────────────────────────────────────
class CustomerOrderSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference", read_only=True)
    orderNumber = serializers.CharField(source="reference", read_only=True)
    date = serializers.SerializerMethodField()
    itemsCount = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    paymentMethod = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id", "orderNumber", "date", "itemsCount",
            "total", "status", "paymentMethod",
        )

    def get_date(self, obj):
        return obj.created_at.date().isoformat()

    def get_itemsCount(self, obj):
        return obj.items.count()

    def get_total(self, obj):
        return float(obj.total)

    def get_status(self, obj):
        return obj.get_status_display()

    def get_paymentMethod(self, obj):
        return "M-Pesa" if obj.payment_method == "MPESA" else "Cash on Delivery"


class CustomerAddressSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    title = serializers.CharField(source="label", read_only=True)
    address = serializers.SerializerMethodField()
    city = serializers.CharField(source="town", read_only=True)
    isDefault = serializers.BooleanField(source="is_default", read_only=True)

    class Meta:
        model = Address
        fields = ("id", "title", "address", "city", "isDefault")

    def get_address(self, obj):
        parts = [obj.street, obj.town, obj.county]
        return ", ".join(p for p in parts if p)


class CustomerNoteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    author = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()

    class Meta:
        model = CustomerNote
        fields = ("id", "author", "date", "text")

    def get_author(self, obj):
        if not obj.author:
            return "System"
        return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.email

    def get_date(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")


class CustomerWishlistSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    productName = serializers.CharField(source="product_name", read_only=True)
    sku = serializers.CharField(source="variant_id", read_only=True)
    price = serializers.SerializerMethodField()
    addedDate = serializers.SerializerMethodField()
    image = serializers.CharField(source="variant_image", read_only=True)

    class Meta:
        model = WishlistItem
        fields = ("id", "productName", "sku", "price", "addedDate", "image")

    def get_price(self, obj):
        return float(obj.unit_price)

    def get_addedDate(self, obj):
        return obj.added_at.date().isoformat()


class CustomerCartSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    productName = serializers.CharField(source="name", read_only=True)
    sku = serializers.CharField(source="product_id", read_only=True)
    price = serializers.SerializerMethodField()
    qty = serializers.IntegerField(source="quantity", read_only=True)
    addedDate = serializers.SerializerMethodField()
    image = serializers.CharField(source="image", read_only=True)

    class Meta:
        model = CartItem
        fields = ("id", "productName", "sku", "price", "qty", "addedDate", "image")

    def get_price(self, obj):
        return float(obj.unit_price)

    def get_addedDate(self, obj):
        return obj.added_at.date().isoformat()


class CustomerReviewSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    productName = serializers.CharField(source="product_name", read_only=True)
    rating = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(source="body", read_only=True)
    date = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "productName", "rating", "comment", "date", "status")

    def get_date(self, obj):
        return obj.created_at.date().isoformat()

    def get_status(self, obj):
        return obj.status.capitalize()


class CustomerTicketSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    subject = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    priority = serializers.CharField(read_only=True)
    date = serializers.SerializerMethodField()
    lastUpdate = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = ("id", "subject", "status", "priority", "date", "lastUpdate")

    def get_date(self, obj):
        return obj.opened_at.date().isoformat()

    def get_lastUpdate(self, obj):
        return obj.last_update.date().isoformat()


class CustomerCommunicationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    channel = serializers.CharField(read_only=True)
    direction = serializers.CharField(read_only=True)
    subject = serializers.CharField(read_only=True)
    date = serializers.SerializerMethodField()
    agent = serializers.CharField(read_only=True)

    class Meta:
        model = CommunicationLog
        fields = ("id", "channel", "direction", "subject", "date", "agent")

    def get_date(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")


# ─────────────────────────────────────────────────────────────────────────────
# Detail serializer — the full Customer object
# ─────────────────────────────────────────────────────────────────────────────
class CustomerDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="pk", read_only=True)
    name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    dateJoined = serializers.SerializerMethodField()
    ordersCount = serializers.SerializerMethodField()
    totalSpent = serializers.SerializerMethodField()
    lastOrderDate = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    segment = serializers.SerializerMethodField()
    mostPurchasedCategory = serializers.SerializerMethodField()
    preferredPayment = serializers.SerializerMethodField()
    marketingConsent = serializers.SerializerMethodField()

    orders = serializers.SerializerMethodField()
    addresses = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    wishlist = serializers.SerializerMethodField()
    cart = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    supportTickets = serializers.SerializerMethodField()
    communicationLog = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "name", "avatar", "email", "phone", "location",
            "dateJoined", "ordersCount", "totalSpent", "lastOrderDate",
            "status", "segment", "mostPurchasedCategory", "preferredPayment",
            "marketingConsent", "orders", "addresses", "notes",
            "wishlist", "cart", "reviews", "supportTickets", "communicationLog",
        )

    def get_name(self, obj):
        return _display_name(obj)

    def get_avatar(self, obj):
        return ""

    def get_location(self, obj):
        return _location_from_default_address(obj)

    def get_dateJoined(self, obj):
        return obj.date_joined.date().isoformat() if obj.date_joined else None

    def _profile(self, obj):
        return getattr(obj, "customer_profile", None)

    def get_ordersCount(self, obj):
        p = self._profile(obj)
        return p.orders_count if p else 0

    def get_totalSpent(self, obj):
        p = self._profile(obj)
        return float(p.total_spent) if p else 0.0

    def get_lastOrderDate(self, obj):
        p = self._profile(obj)
        if not p or not p.last_order_date:
            return None
        return p.last_order_date.date().isoformat()

    def get_status(self, obj):
        return _map_status(obj.status)

    def get_segment(self, obj):
        p = self._profile(obj)
        return p.segment if p else CustomerSegment.REGULAR

    def get_mostPurchasedCategory(self, obj):
        p = self._profile(obj)
        return p.most_purchased_category if p else ""

    def get_preferredPayment(self, obj):
        p = self._profile(obj)
        return p.preferred_payment if p else ""

    def get_marketingConsent(self, obj):
        return _map_consent(obj)

    # ── Nested collections ─────────────────────────────────────────────
    def get_orders(self, obj):
        qs = (
            Order.objects
            .filter(user_id=obj.pk)
            .order_by("-created_at")[:30]
        )
        return CustomerOrderSerializer(qs, many=True).data

    def get_addresses(self, obj):
        return CustomerAddressSerializer(obj.addresses.all(), many=True).data

    def get_notes(self, obj):
        return CustomerNoteSerializer(obj.customer_notes.all(), many=True).data

    def get_wishlist(self, obj):
        return CustomerWishlistSerializer(obj.wishlist_items.all(), many=True).data

    def get_cart(self, obj):
        cart = getattr(obj, "cart", None)
        if not cart:
            return []
        return CustomerCartSerializer(cart.items.all(), many=True).data

    def get_reviews(self, obj):
        return CustomerReviewSerializer(obj.reviews.all(), many=True).data

    def get_supportTickets(self, obj):
        return CustomerTicketSerializer(obj.support_tickets.all(), many=True).data

    def get_communicationLog(self, obj):
        return CustomerCommunicationSerializer(
            obj.communication_log.all()[:50], many=True,
        ).data


# ─────────────────────────────────────────────────────────────────────────────
# Inbound action serializers
# ─────────────────────────────────────────────────────────────────────────────
class BlockCustomerSerializer(serializers.Serializer):
    blocked = serializers.BooleanField()


class MarketingConsentSerializer(serializers.Serializer):
    consent = serializers.ChoiceField(choices=MarketingConsent.choices)


class CustomerNoteWriteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("Note text cannot be empty.")
        return value


class WhatsAppSendSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)


class EmailSendSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField(max_length=5000)


class AddressWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=64, source="label")
    address = serializers.CharField(max_length=255, source="street")
    city = serializers.CharField(max_length=120, source="town")
    isDefault = serializers.BooleanField(default=False, source="is_default")