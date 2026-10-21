from rest_framework import serializers

from checkout.models import Order, OrderItem, OrderStatusEvent, Payment

from .constants import (
    FULFILLMENT_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
)


# ─────────────────────────────────────────────────────────────────────
# Field helpers
#
# The Order model stores status / payment_status as UPPERCASE choice
# keys. The storefront and admin SPA both expect the lowercase contract
# (e.g. 'pending', 'paid'). Rather than change the model or the clients,
# we normalise at the API boundary:
#
#   LowercaseValueField       — emits model values lowercased on read
#   CaseInsensitiveChoiceField — accepts either case on write, returns
#                                the matched uppercase model value
# ─────────────────────────────────────────────────────────────────────

class LowercaseValueField(serializers.CharField):
    def __init__(self, **kwargs):
        kwargs.setdefault("read_only", True)
        super().__init__(**kwargs)

    def to_representation(self, value):
        if value in (None, ""):
            return ""
        return str(value).lower()


class CaseInsensitiveChoiceField(serializers.ChoiceField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.upper()
        return super().to_internal_value(data)


def _lookup_label(mapping, key):
    """Case-tolerant label lookup against FULFILLMENT/PAYMENT label maps."""
    if not key:
        return ""
    return (
        mapping.get(key)
        or mapping.get(key.lower())
        or mapping.get(key.upper())
        or key
    )


def _customer_display(order: Order) -> str:
    return order.customer_name


def _customer_phone(order: Order) -> str:
    return order.customer_phone


def _payment_method_label(order: Order) -> str:
    if order.payment_method == Order.PaymentMethod.MPESA:
        return "M-Pesa"
    if order.payment_method == Order.PaymentMethod.COD:
        return "Cash on Delivery"
    return order.payment_method or "—"


class AdminOrderListRowSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference")
    reference = serializers.CharField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="contact_email")
    item_count = serializers.SerializerMethodField()
    preview_items = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    payment_status = LowercaseValueField()
    payment_status_label = serializers.SerializerMethodField()
    status = LowercaseValueField()
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
        return _lookup_label(PAYMENT_STATUS_LABELS, obj.payment_status)


class AdminOrderItemSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2,
    )
    subtotal = serializers.SerializerMethodField()
    image = serializers.CharField(source="image_url", allow_blank=True)

    serial_number = serializers.CharField(allow_blank=True)
    imei = serializers.CharField(allow_blank=True)
    warranty_months = serializers.IntegerField()

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product_id",
            "name",
            "brand",
            "price",
            "quantity",
            "subtotal",
            "image",
            "serial_number",
            "imei",
            "warranty_months",
        )

    def get_subtotal(self, obj):
        return str(obj.line_total)


class AdminOrderStatusEventSerializer(serializers.ModelSerializer):
    to_status = LowercaseValueField()
    from_status = LowercaseValueField()
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
        return _lookup_label(FULFILLMENT_STATUS_LABELS, obj.to_status)

    def get_from_label(self, obj):
        if not obj.from_status:
            return ""
        return _lookup_label(FULFILLMENT_STATUS_LABELS, obj.from_status)


class AdminPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id", "status", "amount", "phone_number",
            "mpesa_receipt_number", "checkout_request_id",
            "merchant_request_id", "result_code",
            "result_description", "created_at", "updated_at",
        )


class AdminOrderDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference")
    reference = serializers.CharField()

    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="contact_email")

    status = LowercaseValueField()
    status_label = serializers.SerializerMethodField()
    payment_status = LowercaseValueField()
    payment_status_label = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()

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

    verify_token = serializers.CharField(read_only=True)

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
            "verify_token",
            "created_at", "updated_at",
        )

    def get_customer_name(self, obj):
        return _customer_display(obj)

    def get_customer_phone(self, obj):
        return _customer_phone(obj)

    def get_payment_method(self, obj):
        return _payment_method_label(obj)

    def get_payment_status_label(self, obj):
        return _lookup_label(PAYMENT_STATUS_LABELS, obj.payment_status)

    def get_status_label(self, obj):
        return _lookup_label(FULFILLMENT_STATUS_LABELS, obj.status)


class AdminQRVerifyRequestSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128, trim_whitespace=True)

    def validate_token(self, value):
        if not value.strip():
            raise serializers.ValidationError("Token cannot be empty.")
        return value


class AdminQRVerifyResponseSerializer(serializers.ModelSerializer):
    reference = serializers.CharField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="contact_email")

    status = LowercaseValueField()
    status_label = serializers.SerializerMethodField()
    payment_status = LowercaseValueField()
    payment_status_label = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()

    mpesa_receipt_number = serializers.SerializerMethodField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    created_at = serializers.DateTimeField()

    items = AdminOrderItemSerializer(many=True, read_only=True)

    fulfilled = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "reference",
            "customer_name",
            "customer_phone",
            "customer_email",
            "status",
            "status_label",
            "payment_status",
            "payment_status_label",
            "payment_method",
            "mpesa_receipt_number",
            "total",
            "created_at",
            "items",
            "fulfilled",
        )

    def get_customer_name(self, obj):
        return _customer_display(obj)

    def get_customer_phone(self, obj):
        return _customer_phone(obj)

    def get_status_label(self, obj):
        return _lookup_label(FULFILLMENT_STATUS_LABELS, obj.status)

    def get_payment_status_label(self, obj):
        return _lookup_label(PAYMENT_STATUS_LABELS, obj.payment_status)

    def get_payment_method(self, obj):
        return _payment_method_label(obj)

    def get_mpesa_receipt_number(self, obj):
        payments = list(obj.payments.all())
        success = next(
            (p for p in payments if p.status == Payment.Status.SUCCESS),
            None,
        )
        chosen = success or (payments[0] if payments else None)
        return chosen.mpesa_receipt_number if chosen else None

    def get_fulfilled(self, obj):
        return obj.status == Order.Status.DELIVERED


class AdminOrderStatsSerializer(serializers.Serializer):
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


class AdminStatusUpdateSerializer(serializers.Serializer):
    status = CaseInsensitiveChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )


class AdminTrackingSerializer(serializers.Serializer):
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
            raise serializers.ValidationError("Note text cannot be empty.")
        return value


class AdminWhatsAppSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value


class AdminOrderExportSerializer(serializers.Serializer):
    tab = serializers.CharField(required=False, allow_blank=True, default="all")
    search = serializers.CharField(required=False, allow_blank=True, default="")
    payment_status = serializers.CharField(
        required=False, allow_blank=True, default="",
    )
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)

    def validate_payment_status(self, value):
        return value.upper() if value else ""