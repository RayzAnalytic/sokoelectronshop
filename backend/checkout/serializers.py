from decimal import Decimal

from rest_framework import serializers

from . import constants
from .models import (
    Cart,
    CartItem,
    Coupon,
    Order,
    OrderItem,
    Payment,
    PaymentEvent,
    ReconciliationLog,
)


def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _require_phone() -> bool:
    s = _settings()
    return bool(s['checkout'].require_phone) if s else True


class CheckoutAddressSerializer(serializers.Serializer):
    street = serializers.CharField(max_length=255)
    town = serializers.CharField(max_length=120)
    county = serializers.CharField(max_length=120)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )


class CheckoutItemSerializer(serializers.Serializer):
    productId = serializers.CharField(
        max_length=64,
        required=False,
        allow_blank=True,
        default="",
    )
    name = serializers.CharField(max_length=255)
    brand = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = serializers.IntegerField(min_value=1)
    image = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )


class CheckoutTotalsSerializer(serializers.Serializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        required=False, default=Decimal("0.00"),
    )
    shipping = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        required=False, default=Decimal("0.00"),
    )
    tax = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        required=False, default=Decimal("0.00"),
    )
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class CheckoutPayloadSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        default="",
    )
    full_name = serializers.CharField(max_length=255)
    address = CheckoutAddressSerializer()
    delivery_method = serializers.ChoiceField(
        choices=constants.DELIVERY_METHODS,
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

    source = serializers.ChoiceField(
        choices=Order.Source.choices,
        required=False,
        default=Order.Source.WEB,
    )
    channel_meta = serializers.DictField(
        required=False,
        default=dict,
        allow_empty=True,
    )


class StkPushSerializer(serializers.Serializer):
    order_reference = serializers.CharField(
        max_length=64,
        required=False,
        allow_blank=True,
    )
    amount = serializers.IntegerField(min_value=1)
    phone_number = serializers.CharField(max_length=32)
    metadata = serializers.DictField(required=False, allow_null=True)
    checkout = CheckoutPayloadSerializer()

    def validate_amount(self, value):
        if value > constants.MAX_STK_PUSH_AMOUNT:
            raise serializers.ValidationError(
                "Amount exceeds the maximum allowed for a single order."
            )
        return value


class OrderCreateSerializer(serializers.Serializer):
    checkout = CheckoutPayloadSerializer()
    payment_method = serializers.ChoiceField(
        choices=(Order.PaymentMethod.COD,),
        default=Order.PaymentMethod.COD,
    )


class PaymentSerializer(serializers.ModelSerializer):
    order_reference = serializers.CharField(read_only=True)
    snapshot = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    paid_at = serializers.SerializerMethodField()
    source = serializers.CharField(read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "status",
            "source",
            "amount",
            "phone_number",
            "order_reference",
            "payment_method",
            "created_at",
            "updated_at",
            "paid_at",
            "user",
            "snapshot",
            "result_code",
            "result_description",
            "mpesa_receipt_number",
            "checkout_request_id",
            "merchant_request_id",
        )

    def get_snapshot(self, obj):
        raw = obj.order.snapshot or None
        if not raw:
            return None
        return {k: v for k, v in raw.items() if not k.startswith("_")}

    def get_user(self, obj):
        return obj.order.user_id

    def get_payment_method(self, obj):
        return obj.order.payment_method

    def get_paid_at(self, obj):
        if obj.status == Payment.Status.SUCCESS:
            return obj.updated_at
        return None


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
    is_guest_order = serializers.BooleanField(read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    snapshot = serializers.SerializerMethodField()
    tax_rate = serializers.SerializerMethodField()
    prices_include_tax = serializers.SerializerMethodField()
    tax_enabled = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "reference",
            "status",
            "payment_status",
            "payment_method",
            "source",
            "channel_meta",
            "is_paid",
            "is_guest_order",
            "delivery_method",
            "estimated_delivery",
            "address_street",
            "address_town",
            "address_county",
            "address_postal_code",
            "notes",
            "coupon_code",
            "contact_email",
            "contact_phone",
            "courier",
            "tracking_number",
            "subtotal",
            "discount",
            "shipping",
            "tax",
            "total",
            "client_total",
            "tax_rate",
            "tax_enabled",
            "prices_include_tax",
            "snapshot",
            "items",
            "created_at",
            "updated_at",
        )

    def get_snapshot(self, obj):
        raw = obj.snapshot or None
        if not raw:
            return None
        return {k: v for k, v in raw.items() if not k.startswith("_")}

    def get_prices_include_tax(self, obj):
        s = _settings()
        if s and "checkout" in s:
            cfg = s["checkout"]
            if hasattr(cfg, "prices_include_tax"):
                return bool(cfg.prices_include_tax)
        return True

    def get_tax_enabled(self, obj):
        s = _settings()
        if s and "checkout" in s:
            cfg = s["checkout"]
            if hasattr(cfg, "tax_enabled"):
                return bool(cfg.tax_enabled)
        return True

    def get_tax_rate(self, obj):
        sub = float(obj.subtotal or 0)
        tax = float(obj.tax or 0)
        if sub > 0 and tax > 0:
            inclusive = self.get_prices_include_tax(obj)
            if inclusive and sub > tax:
                rate = tax / (sub - tax) * 100
                if 0 < rate < 100:
                    return round(rate)
            elif not inclusive:
                rate = tax / sub * 100
                if 0 < rate < 100:
                    return round(rate)
        s = _settings()
        if s and "checkout" in s:
            cfg = s["checkout"]
            if hasattr(cfg, "tax_rate"):
                try:
                    r = float(cfg.tax_rate)
                    return round(r * 100) if r <= 1 else round(r)
                except (TypeError, ValueError):
                    pass
        return 16


class OrderCreateResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = (
            "reference",
            "status",
            "payment_status",
            "payment_method",
            "source",
            "total",
            "created_at",
        )


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)


class CouponValidateResultSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    code = serializers.CharField(required=False, allow_blank=True)
    percent_off = serializers.DecimalField(
        max_digits=5,
        decimal_places=4,
        required=False,
        allow_null=True,
    )
    message = serializers.CharField()


class CartItemSerializer(serializers.ModelSerializer):
    productId = serializers.CharField(source="product_id", read_only=True)
    variantId = serializers.CharField(source="variant_id", read_only=True)
    variantLabel = serializers.CharField(source="variant_label", read_only=True)
    unitPrice = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2, read_only=True,
    )
    compareAtPrice = serializers.DecimalField(
        source="compare_at_price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    stockCount = serializers.IntegerField(source="stock_count", read_only=True)
    lineTotal = serializers.SerializerMethodField()
    addedAt = serializers.DateTimeField(source="added_at", read_only=True)

    class Meta:
        model = CartItem
        fields = (
            "id",
            "productId",
            "variantId",
            "name",
            "brand",
            "image",
            "variantLabel",
            "unitPrice",
            "compareAtPrice",
            "quantity",
            "stock",
            "stockCount",
            "lineTotal",
            "addedAt",
        )

    def get_lineTotal(self, obj) -> str:
        return str(obj.line_total)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    itemCount = serializers.SerializerMethodField()
    totalUnits = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Cart
        fields = (
            "id",
            "items",
            "itemCount",
            "totalUnits",
            "subtotal",
            "updatedAt",
        )

    def get_itemCount(self, obj) -> int:
        return len(obj.items.all())

    def get_totalUnits(self, obj) -> int:
        return sum(item.quantity for item in obj.items.all())

    def get_subtotal(self, obj) -> str:
        total = sum(
            (item.unit_price * item.quantity for item in obj.items.all()),
            Decimal("0"),
        )
        return str(total.quantize(Decimal("0.01")))


class AddCartItemSerializer(serializers.Serializer):
    productId = serializers.CharField(max_length=64)
    variantId = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default="",
    )
    name = serializers.CharField(max_length=255)
    brand = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )
    image = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )
    variantLabel = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )
    unitPrice = serializers.DecimalField(max_digits=12, decimal_places=2)
    compareAtPrice = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None,
    )
    quantity = serializers.IntegerField(min_value=1, default=1)
    stock = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default="In Stock",
    )
    stockCount = serializers.IntegerField(
        min_value=0, required=False, default=0,
    )

    def to_service_kwargs(self) -> dict:
        d = self.validated_data
        return {
            "product_id": d["productId"],
            "variant_id": d.get("variantId") or "",
            "name": d["name"],
            "brand": d.get("brand") or "",
            "image": d.get("image") or "",
            "variant_label": d.get("variantLabel") or "",
            "unit_price": d["unitPrice"],
            "compare_at_price": d.get("compareAtPrice"),
            "quantity": d["quantity"],
            "stock": d.get("stock") or "In Stock",
            "stock_count": d.get("stockCount") or 0,
        }


class UpdateCartItemQtySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class MergeCartItemSerializer(serializers.Serializer):
    productId = serializers.CharField(max_length=64)
    variantId = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default="",
    )
    name = serializers.CharField(max_length=255)
    brand = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )
    image = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )
    variantLabel = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="",
    )
    unitPrice = serializers.DecimalField(max_digits=12, decimal_places=2)
    compareAtPrice = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None,
    )
    quantity = serializers.IntegerField(min_value=1, default=1)
    stock = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default="In Stock",
    )
    stockCount = serializers.IntegerField(
        min_value=0, required=False, default=0,
    )

    def to_service_dict(self) -> dict:
        d = self.validated_data
        return {
            "productId": d["productId"],
            "variantId": d.get("variantId") or "",
            "name": d["name"],
            "brand": d.get("brand") or "",
            "image": d.get("image") or "",
            "variantLabel": d.get("variantLabel") or "",
            "unitPrice": d["unitPrice"],
            "compareAtPrice": d.get("compareAtPrice"),
            "quantity": d["quantity"],
            "stock": d.get("stock") or "In Stock",
            "stockCount": d.get("stockCount") or 0,
        }


class MergeCartSerializer(serializers.Serializer):
    items = MergeCartItemSerializer(many=True, required=False, default=list)


class PaymentEventSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    status = serializers.CharField(source="state", read_only=True)

    class Meta:
        model = PaymentEvent
        fields = ("title", "time", "status")

    def get_time(self, obj) -> str:
        return obj.created_at.strftime("%H:%M:%S")


class TransactionSerializer(serializers.ModelSerializer):
    ref               = serializers.CharField(source="mpesa_receipt_number", read_only=True)
    orderNumber       = serializers.SerializerMethodField()

    amount            = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )
    fee               = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )

    phoneNumber       = serializers.CharField(source="masked_phone", read_only=True)
    source            = serializers.CharField(read_only=True)

    status            = serializers.CharField(source="display_status", read_only=True)
    responseCode      = serializers.SerializerMethodField()
    responseDesc      = serializers.CharField(source="result_description", read_only=True)

    date              = serializers.SerializerMethodField()

    customerName      = serializers.CharField(source="customer_name", read_only=True)
    customerEmail     = serializers.CharField(source="customer_email", read_only=True)

    merchantRequestId = serializers.CharField(source="merchant_request_id", read_only=True)
    checkoutRequestId = serializers.CharField(source="checkout_request_id", read_only=True)

    payload           = serializers.JSONField(source="raw_callback", read_only=True)
    timeline          = PaymentEventSerializer(source="events", many=True, read_only=True)

    method            = serializers.CharField(read_only=True)
    settledAt         = serializers.DateTimeField(source="settled_at", read_only=True, allow_null=True)
    reversals         = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "ref",
            "orderNumber",
            "amount",
            "fee",
            "phoneNumber",
            "source",
            "status",
            "responseCode",
            "responseDesc",
            "date",
            "customerName",
            "customerEmail",
            "merchantRequestId",
            "checkoutRequestId",
            "payload",
            "timeline",
            "method",
            "settledAt",
            "reversals",
        )

    def get_orderNumber(self, obj):
        return obj.order.reference if obj.order_id else None

    def get_responseCode(self, obj) -> str:
        if obj.result_code is None:
            return ""
        return str(obj.result_code)

    def get_date(self, obj) -> str:
        return obj.created_at.strftime("%Y-%m-%d %H:%M")

    def get_reversals(self, obj):
        qs = obj.reversals.all() if obj.status == Payment.Status.REVERSED else obj.reversals.none()
        return [
            {
                "id": str(rev.id),
                "status": rev.display_status,
                "createdAt": rev.created_at.isoformat(),
                "reason": rev.reversal_reason or "",
            }
            for rev in qs
        ]


class TransactionSummarySerializer(serializers.Serializer):
    totalSuccessful = serializers.DecimalField(max_digits=14, decimal_places=2)
    totalPending    = serializers.DecimalField(max_digits=14, decimal_places=2)
    totalFailed     = serializers.DecimalField(max_digits=14, decimal_places=2)
    totalFees       = serializers.DecimalField(max_digits=14, decimal_places=2)
    netAmount       = serializers.DecimalField(max_digits=14, decimal_places=2)

    perMethod = serializers.DictField(
        child=serializers.DictField(),
        required=False,
    )

    transactionCount = serializers.IntegerField(required=False)


class ReconciliationLogSerializer(serializers.ModelSerializer):
    actorLabel = serializers.CharField(source="actor_label", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    matchedOrderReference = serializers.CharField(
        source="matched_order_reference", read_only=True,
    )

    class Meta:
        model = ReconciliationLog
        fields = (
            "id",
            "action",
            "actorLabel",
            "matchedOrderReference",
            "note",
            "createdAt",
        )


class ReconcilePaymentSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=("Matched", "Unmatched", "Cash Paid"),
    )
    orderNumber = serializers.CharField(
        max_length=64, required=False, allow_blank=True,
    )
    note = serializers.CharField(
        required=False, allow_blank=True, allow_null=True,
    )


class RetryPaymentSerializer(serializers.Serializer):
    phone_number = serializers.CharField(
        max_length=32, required=False, allow_blank=True,
    )


class BulkExportSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )


class C2BConfirmationSerializer(serializers.Serializer):
    TransID = serializers.CharField(max_length=32)
    TransAmount = serializers.DecimalField(max_digits=12, decimal_places=2)
    MSISDN = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    FirstName = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    MiddleName = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    LastName = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    BusinessShortCode = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    BillRefNumber = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    TransTime = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    TransactionType = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    OrgAccountBalance = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    ThirdPartyTransID = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    InvoiceNumber = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")


class CompleteOrderItemSerializer(serializers.Serializer):
    product_id = serializers.CharField(required=False, allow_blank=True, default="")
    name = serializers.CharField()
    brand = serializers.CharField(required=False, allow_blank=True, default="")
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = serializers.IntegerField(min_value=1, default=1)
    image_url = serializers.CharField(required=False, allow_blank=True, default="")
    serial_number = serializers.CharField(required=False, allow_blank=True, default="")
    imei = serializers.CharField(required=False, allow_blank=True, default="")


class CompleteOrderSerializer(serializers.Serializer):
    items = CompleteOrderItemSerializer(many=True)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_phone = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)


class StickerDataSerializer(serializers.Serializer):
    order_reference = serializers.CharField()
    item_id = serializers.IntegerField()
    name = serializers.CharField()
    brand = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.IntegerField()
    unit_price = serializers.CharField()
    serial_number = serializers.CharField(required=False, allow_blank=True)
    imei = serializers.CharField(required=False, allow_blank=True)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_phone_last4 = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.CharField()
    qr_payload = serializers.CharField()