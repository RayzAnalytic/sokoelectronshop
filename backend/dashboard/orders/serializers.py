"""
Serializers for the admin orders module.

Two directions:

  OUTBOUND — list rows, detail payloads, stats, tab counts. Field
             names match what the React admin page reads.

  INBOUND  — small action payloads. Every write endpoint has its own
             serializer so validation lives next to the shape.
"""

from rest_framework import serializers

from checkout.models import Order, OrderItem, OrderStatusEvent, Payment

from .constants import (
    FULFILLMENT_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
)


# ─────────────────────────────────────────────────────────────────────────────
# Display helpers
# ─────────────────────────────────────────────────────────────────────────────
def _customer_display(order: Order) -> str:
    """
    Name of the customer, falling back to contact email, then to
    "Guest" for legacy pre-rewrite rows.

    Always returns something printable — the list never shows an empty
    cell.
    """
    if order.user_id:
        name = (
            f"{order.user.first_name or ''} "
            f"{order.user.last_name or ''}"
        ).strip()
        return name or order.user.email
    # Legacy guest row (user_id is None). Use contact_email.
    return order.contact_email or "Guest"


def _customer_phone(order: Order) -> str:
    if order.user_id and order.user.phone:
        return order.user.phone
    return order.contact_phone or ""


def _payment_method_label(order: Order) -> str:
    if order.payment_method == Order.PaymentMethod.MPESA:
        return "M-Pesa"
    if order.payment_method == Order.PaymentMethod.COD:
        return "Cash on Delivery"
    return order.payment_method or "—"


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: list
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderListRowSerializer(serializers.ModelSerializer):
    """
    One row of the admin orders table.

    Everything the table needs is denormalized onto this shape. The
    view prefetches `items` so `preview_items` and `item_count` are
    cheap.
    """

    id = serializers.CharField(source="reference")
    reference = serializers.CharField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="contact_email")
    item_count = serializers.SerializerMethodField()
    preview_items = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    payment_status_label = serializers.SerializerMethodField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    date = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Order
        fields = (
            "id",
            "reference",
            "customer_name",
            "customer_phone",
            "customer_email",
            "item_count",
            "preview_items",
            "total",
            "payment_method",
            "payment_status",
            "payment_status_label",
            "status",
            "date",
        )

    def get_customer_name(self, obj):
        return _customer_display(obj)

    def get_customer_phone(self, obj):
        return _customer_phone(obj)

    def get_item_count(self, obj):
        items = getattr(obj, "prefetched_items", None)
        if items is None:
            return obj.items.count()
        return sum(i.quantity for i in items)

    def get_preview_items(self, obj):
        items = getattr(obj, "prefetched_items", None)
        if items is None:
            items = list(obj.items.all()[:4])
        return [
            {
                "image": i.image_url or "",
                "name": i.name,
                "quantity": i.quantity,
            }
            for i in items[:4]
        ]

    def get_payment_method(self, obj):
        return _payment_method_label(obj)

    def get_payment_status_label(self, obj):
        return PAYMENT_STATUS_LABELS.get(obj.payment_status, obj.payment_status)


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: detail
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderItemSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2,
    )
    subtotal = serializers.SerializerMethodField()
    image = serializers.CharField(source="image_url", allow_blank=True)

    class Meta:
        model = OrderItem
        fields = (
            "id", "product_id", "name", "brand",
            "price", "quantity", "subtotal", "image",
        )

    def get_subtotal(self, obj):
        return str(obj.line_total)


class AdminOrderStatusEventSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()
    from_label = serializers.SerializerMethodField()
    actor_label = serializers.CharField(allow_blank=True)
    note = serializers.CharField(allow_blank=True)

    class Meta:
        model = OrderStatusEvent
        fields = (
            "id",
            "to_status",
            "status_label",
            "from_status",
            "from_label",
            "actor_label",
            "note",
            "created_at",
        )

    def get_status_label(self, obj):
        return FULFILLMENT_STATUS_LABELS.get(obj.to_status, obj.to_status)

    def get_from_label(self, obj):
        if not obj.from_status:
            return ""
        return FULFILLMENT_STATUS_LABELS.get(
            obj.from_status, obj.from_status,
        )


class AdminPaymentSerializer(serializers.ModelSerializer):
    """Compact view of a Payment attempt for the detail page."""

    class Meta:
        model = Payment
        fields = (
            "id", "status", "amount", "phone_number",
            "mpesa_receipt_number", "checkout_request_id",
            "merchant_request_id", "result_code",
            "result_description", "created_at", "updated_at",
        )


class AdminOrderDetailSerializer(serializers.ModelSerializer):
    """
    Full order shape for the admin detail page.

    Includes fields the customer serializer deliberately hides:
    `internal_notes`, `contact_email`, `contact_phone`, the full
    payment attempt history, and the actor labels on every timeline
    event.
    """

    id = serializers.CharField(source="reference")
    reference = serializers.CharField()

    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="contact_email")

    payment_method = serializers.SerializerMethodField()
    payment_status_label = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping = serializers.DecimalField(max_digits=12, decimal_places=2)
    tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)

    items = AdminOrderItemSerializer(many=True, read_only=True)
    timeline = AdminOrderStatusEventSerializer(
        source="status_events", many=True, read_only=True,
    )
    payments = AdminPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id", "reference",
            "customer_name", "customer_phone", "customer_email",
            "status", "status_label",
            "payment_status", "payment_status_label",
            "payment_method",
            "subtotal", "discount", "shipping", "tax", "total",
            "coupon_code",
            "notes",
            "internal_notes",
            "delivery_method", "estimated_delivery",
            "courier", "tracking_number",
            "contact_email", "contact_phone",
            "items", "timeline", "payments",
            "snapshot",
            "created_at", "updated_at",
        )

    def get_customer_name(self, obj):
        return _customer_display(obj)

    def get_customer_phone(self, obj):
        return _customer_phone(obj)

    def get_payment_method(self, obj):
        return _payment_method_label(obj)

    def get_payment_status_label(self, obj):
        return PAYMENT_STATUS_LABELS.get(
            obj.payment_status, obj.payment_status,
        )

    def get_status_label(self, obj):
        return FULFILLMENT_STATUS_LABELS.get(obj.status, obj.status)


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: stats and tab counts
# ─────────────────────────────────────────────────────────────────────────────
class AdminOrderStatsSerializer(serializers.Serializer):
    """
    Stat tiles for the admin orders header. Every field is an integer
    except the two revenue fields, which are decimal strings — the
    frontend formats them with the same `formatKES` helper it uses
    everywhere.
    """

    total_orders = serializers.IntegerField()
    active_orders = serializers.IntegerField()
    pending_orders = serializers.IntegerField()
    shipped_orders = serializers.IntegerField()
    delivered_orders = serializers.IntegerField()
    unpaid_orders = serializers.IntegerField()
    failed_payments = serializers.IntegerField()
    revenue_today = serializers.CharField()
    revenue_month = serializers.CharField()


class AdminOrderTabCountsSerializer(serializers.Serializer):
    """
    One integer per tab. The frontend iterates `Object.entries(counts)`
    and renders the badges. New tabs added to `ADMIN_ORDER_TABS`
    appear automatically once the selector is updated.
    """

    all = serializers.IntegerField()
    pending = serializers.IntegerField()
    payment_pending = serializers.IntegerField()
    paid = serializers.IntegerField()
    processing = serializers.IntegerField()
    shipped = serializers.IntegerField()
    delivered = serializers.IntegerField()
    cancelled = serializers.IntegerField()
    failed = serializers.IntegerField()
    refunded = serializers.IntegerField()
    returned = serializers.IntegerField()


# ─────────────────────────────────────────────────────────────────────────────
# Inbound: action payloads
# ─────────────────────────────────────────────────────────────────────────────
class AdminStatusUpdateSerializer(serializers.Serializer):
    """
    Payload for PATCH /orders/<ref>/status/.

    `status` must be one of the model's enum values. Whether the
    *transition* is allowed (e.g. shipped → delivered, not the other
    way) is validated in the service — the serializer only checks the
    value is a real status.
    """

    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )


class AdminTrackingSerializer(serializers.Serializer):
    """
    Payload for PATCH /orders/<ref>/tracking/.

    Both fields are optional but at least one must be provided — an
    update that changes nothing is a client bug, not a no-op.
    """

    courier = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )
    tracking_number = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )

    def validate(self, attrs):
        if not attrs.get("courier") and not attrs.get("tracking_number"):
            raise serializers.ValidationError(
                "Provide a courier, a tracking number, or both."
            )
        return attrs


class AdminRefundSerializer(serializers.Serializer):
    """
    Payload for POST /orders/<ref>/refund/.

    `amount` is optional — when omitted, the service refunds the full
    order total. When provided, the service validates it matches the
    total. Partial refunds are not supported yet.
    """

    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        required=False, allow_null=True,
    )
    reason = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )


class AdminNoteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Note text cannot be empty."
            )
        return value


class AdminWhatsAppSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Message cannot be empty."
            )
        return value


class AdminOrderExportSerializer(serializers.Serializer):
    """
    Payload for POST /orders/export/.

    Reuses the same filter keys the list endpoint accepts, so an admin
    can export exactly what they are viewing.
    """

    tab = serializers.CharField(required=False, allow_blank=True, default="all")
    search = serializers.CharField(required=False, allow_blank=True, default="")
    payment_status = serializers.CharField(
        required=False, allow_blank=True, default="",
    )
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)