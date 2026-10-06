"""
checkout/serializers.py

Two directions of data flow:

  INBOUND  — what the frontend sends when placing an order:
             nested `address` object, `items[].price` as number, totals

  OUTBOUND — what we store on `Order.snapshot` and return on reads:
             flat `address_*` fields, `items[].price` as string (matches
             DRF's Decimal serialisation so the frontend's parseFloat
             doesn't have to special-case numbers vs strings)

The snapshot shape lives in ONE place: `services._build_snapshot()`.
`CheckoutPayloadSerializer` produces the nested payload that the
service consumes; it does not produce a snapshot itself.

NOTE ON AUTH:
    Checkout accepts BOTH guest and authenticated sessions — gated by
    Settings → Store → Checkout → `allow_guest_checkout`. When that
    setting is off, the view rejects anonymous submissions before the
    serializer is even reached.

    * Signed-in customer → the view reads `request.user` and passes
                            it to `create_order` / `process_checkout`.
                            The Order is created with `user=<that user>`.
    * Guest customer     → the view passes `user=None`. The Order is
                            created with `user=NULL` and `contact_email`
                            / `contact_phone` snapshotted so the
                            `claim_guest_orders` signal can attach it
                            later when the customer registers.

    `email`, `phone`, and `full_name` are the delivery contact. They
    may legitimately differ from the account contact. The view falls
    back to the account values when a field arrives blank.

    There is no `password` field. Account creation happens exclusively
    at `/api/v1/auth/register/` — never at checkout.

NOTE ON `phone` (SETTINGS-AWARE):
    The `phone` field is OPTIONAL at the serializer layer, regardless
    of the `checkout.require_phone` setting.

    Why: the service-level gate (`_validate_checkout_gates`) is the
    single place that decides whether a phone is required, because it
    has access to the authenticated user and can fall back to
    `user.phone` when the payload is blank. Making the field required
    here would force every guest submission to carry a phone even
    when `require_phone=False`, and it would short-circuit the
    account-phone fallback for signed-in users.

    So the flow is:
      1. Serializer accepts an empty phone.
      2. Service checks `_require_phone()`:
           * if off — nothing to validate.
           * if on — requires `checkout["phone"]` OR `user.phone`.
      3. A missing phone when required produces a clean 400 from the
         service with the message "A phone number is required to
         complete this order."

    The frontend should read `require_phone` from the store-status
    endpoint and mark its own phone input as required, so the user
    sees the field constraint before submitting.

NOTE ON CART:
    Cart endpoints require an authenticated user. Anonymous carts live
    in the browser (Zustand / localStorage) and are folded in via
    `POST /cart/merge/` after login. The merge endpoint accepts the
    same camelCase shape the frontend already stores — no translation
    on the client.

NOTE ON CHANNEL ATTRIBUTION:
    `CheckoutPayloadSerializer` declares `source` and `channel_meta`
    because DRF's `validated_data` only carries fields that are
    explicitly declared. The service layer reads
    `checkout_payload["source"]` and `checkout_payload["channel_meta"]`
    — if those keys are not declared here, DRF strips them before the
    service ever sees them and every order silently falls back to the
    model defaults (`source="web"`, `channel_meta={}`).

    Both fields are OPTIONAL so the main storefront checkout (which
    sends neither) keeps producing web orders without change.

NOTE ON THE TRANSACTIONS LEDGER (admin):
    The admin transactions page reads from `Payment`, not from `Order`.
    Its serializers live at the bottom of this file and are the ONLY
    place where the ledger's wire contract (camelCase `phoneNumber`,
    `orderNumber`, `responseCode`, …) is defined. Do not rename those
    fields server-side without updating the frontend in the same
    commit — they are a hard contract with `TransactionsLedgerPage`.
"""

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


# ─────────────────────────────────────────────────────────────────────────────
# Settings helpers — safe during migrations / cold boot
#
# The serializer layer only needs `require_phone` today (see module
# docstring). Everything else — amount bounds, shipping method gating,
# VAT computation — lives in `services.recompute_totals()` and
# `services._validate_checkout_gates()`, where the authenticated user
# and the full checkout payload are both available.
#
# Adding the helper here makes the settings boundary explicit and
# keeps future serializer-level validations (e.g. a min-length address
# rule) in one discoverable place.
# ─────────────────────────────────────────────────────────────────────────────
def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _require_phone() -> bool:
    s = _settings()
    return bool(s['checkout'].require_phone) if s else True


# ─────────────────────────────────────────────────────────────────────────────
# Inbound building blocks
# ─────────────────────────────────────────────────────────────────────────────
class CheckoutAddressSerializer(serializers.Serializer):
    street = serializers.CharField(max_length=255)
    town = serializers.CharField(max_length=120)
    county = serializers.CharField(max_length=120)
    postal_code = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )


class CheckoutItemSerializer(serializers.Serializer):
    """
    One line in the checkout payload.

    `productId` is camelCase because that is what the frontend's
    `CheckoutPayload.items[]` uses. It is OPTIONAL because the frontend
    type marks it as `productId?` — anonymous-storefront lines may not
    carry a catalog id, and rejecting the request at the serializer
    layer is worse than accepting an empty string and letting the
    service decide.

    `price` accepts a number or a numeric string — `DecimalField`
    coerces both.
    """
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
    """
    `discount`, `shipping`, and `tax` are OPTIONAL with a zero default
    to match the frontend's `CheckoutTotalsPayload` type:

        { subtotal: number; discount?: number; shipping?: number;
          tax?: number; total: number }

    The frontend omits them when they are zero, so requiring them here
    produced a 400 on every no-discount / free-shipping order.

    Note: these numbers are still a CLAIM. `services.recompute_totals()`
    verifies them against server-side rules (which now read from
    Settings → Payments / Shipping / Tax) and raises `PricingError` on
    any mismatch. Making them optional does not relax that check — it
    just moves the failure from the serializer to the service.
    """
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
    """
    The embedded payload for placing an order.

    These fields are the *delivery* contact, not identity. The view
    treats them as preferences and falls back to the authenticated
    user's values when blank — that prevents an Order row with an
    empty `contact_email`. Do NOT write them back to `User.email` /
    `User.phone`; profile edits go through `/api/v1/auth/profile/`.

    The `totals` block is a CLAIM. `services.recompute_totals()` verifies
    it against server-side rules and raises `PricingError` on any
    mismatch (down to the cent). Never trust these numbers directly.

    `source` and `channel_meta` carry channel attribution. Both are
    optional — the main storefront checkout sends neither, and the
    model defaults (`source="web"`, `channel_meta={}`) preserve the
    historical behaviour.
    """
    email = serializers.EmailField()

    # ── phone is OPTIONAL ────────────────────────────────────────────
    # Whether a phone is actually required is decided by
    # `services._validate_checkout_gates()` — see the module docstring
    # for why the check lives in the service, not here.
    phone = serializers.CharField(                             # ── CHANGED
        max_length=32,                                          # ── CHANGED
        required=False,                                         # ── CHANGED
        allow_blank=True,                                       # ── CHANGED
        default="",                                             # ── CHANGED
    )                                                           # ── CHANGED

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

    # ── Channel attribution ─────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# Inbound: STK push (M-Pesa path)
# ─────────────────────────────────────────────────────────────────────────────
class StkPushSerializer(serializers.Serializer):
    """
    Payload for `POST /api/v1/checkout/payments/stk-push/`.

    Guests allowed — the view decides whether to pass `user=request.user`
    or `user=None` to `services.process_checkout`.

    The M-Pesa-disabled gate (`payments.mpesa_enabled`) and the shop's
    min / max order bounds are both enforced in the service. This
    serializer only catches the two things Daraja would reject with a
    less friendly error:

      * amount exceeds the Daraja per-transaction ceiling
      * amount is below 1 KES

    `order_reference` is OPTIONAL:

      * First attempt — omitted. The backend creates the Order from the
        embedded `checkout` snapshot, generates a reference, and creates
        a Payment.
      * Retry — the frontend passes back the reference the backend
        assigned. The backend finds the existing Order and creates a
        second Payment against it. This is why `Payment.order` is a
        ForeignKey, not OneToOne.
    """
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
        """
        Bound check against the Daraja per-transaction ceiling.

        Mirrors the guard in `mpesa.stk_push()`. Catching it here means
        the caller gets a field-level 400 instead of a 502 from the
        Daraja layer. The shop-specific min / max (Settings → Payments)
        is enforced later in `services._validate_amount_bounds()`.
        """
        if value > constants.MAX_STK_PUSH_AMOUNT:
            raise serializers.ValidationError(
                "Amount exceeds the maximum allowed for a single order."
            )
        return value


# ─────────────────────────────────────────────────────────────────────────────
# Inbound: Order creation (COD path)
# ─────────────────────────────────────────────────────────────────────────────
class OrderCreateSerializer(serializers.Serializer):
    """
    Payload for `POST /api/v1/checkout/orders/`.

    Guests allowed — the view passes `user=None` for unauthenticated
    requests, and the service creates the Order without an owner.

    `payment_method` is restricted to COD. Accepting MPESA here would
    let a caller create an Order labelled "paid online" with no Payment
    row behind it. MPESA flows must go through `/payments/stk-push/`,
    where a Payment is guaranteed to exist.
    """
    checkout = CheckoutPayloadSerializer()
    payment_method = serializers.ChoiceField(
        choices=(Order.PaymentMethod.COD,),
        default=Order.PaymentMethod.COD,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: Payment
# ─────────────────────────────────────────────────────────────────────────────
class PaymentSerializer(serializers.ModelSerializer):
    """
    Shape consumed by the order-success page.

    `snapshot` and `user` are read off the *order*, not the payment.
    The frontend expects them at the top level of the payment object:

        payment.user      → account detection (existing vs new customer)
        payment.snapshot  → receipt data (items, totals, address, notes)

    `snapshot` has the internal `_idempotency_key` stripped before
    returning. That key is a replay-guard used by `services.create_order`
    and must never leave the backend.
    """
    order_reference = serializers.CharField(read_only=True)
    snapshot = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    paid_at = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "status",
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


# ─────────────────────────────────────────────────────────────────────────────
# Outbound: Order
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
    """
    Full order read shape, used by the account orders list and the
    admin orders list.

    `is_guest_order` is True while `user_id IS NULL`. After
    `claim_guest_orders` runs, it flips to False automatically.

    `snapshot` is stripped of internal-only keys (`_idempotency_key`)
    before returning — same reason as in `PaymentSerializer`.

    Does NOT expose `internal_notes`. This serializer is shared with
    the customer-facing account order list, and `internal_notes` is
    documented as "admin comments".
    """
    items = OrderItemReadSerializer(many=True, read_only=True)
    is_guest_order = serializers.BooleanField(read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    snapshot = serializers.SerializerMethodField()

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


class OrderCreateResponseSerializer(serializers.ModelSerializer):
    """
    Minimal response returned by `POST /api/v1/checkout/orders/`.
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# Inbound: Coupon validation
# ─────────────────────────────────────────────────────────────────────────────
class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)


class CouponValidateResultSerializer(serializers.Serializer):
    """
    Response shape for `POST /api/v1/checkout/validate-coupon/`. Matches
    the frontend's `CouponValidateResult` interface exactly.
    """
    valid = serializers.BooleanField()
    code = serializers.CharField(required=False, allow_blank=True)
    percent_off = serializers.DecimalField(
        max_digits=5,
        decimal_places=4,
        required=False,
        allow_null=True,
    )
    message = serializers.CharField()


# ─────────────────────────────────────────────────────────────────────────────
# Cart — outbound
# ─────────────────────────────────────────────────────────────────────────────
class CartItemSerializer(serializers.ModelSerializer):
    """
    One line in the cart, shaped for the frontend's `CartItem` type.

    Every field is camelCase on the wire. `lineTotal` is precomputed
    server-side so the cart page renders the line total without doing
    its own multiplication.
    """
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
    """
    Full cart shape for the frontend's `Cart` state.

    Subtotal is pre-discount, pre-tax, pre-shipping. Coupons and
    delivery are applied at checkout, not here.
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# Cart — inbound: add one item
# ─────────────────────────────────────────────────────────────────────────────
class AddCartItemSerializer(serializers.Serializer):
    """
    Payload for `POST /api/v1/checkout/cart/items/`.
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# Cart — inbound: update quantity
# ─────────────────────────────────────────────────────────────────────────────
class UpdateCartItemQtySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


# ─────────────────────────────────────────────────────────────────────────────
# Cart — inbound: merge (post-login)
# ─────────────────────────────────────────────────────────────────────────────
class MergeCartItemSerializer(serializers.Serializer):
    """
    One entry of the anonymous cart that gets merged after login.
    """
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


# ═════════════════════════════════════════════════════════════════════════════
# ═══ TRANSACTIONS LEDGER (admin) ═════════════════════════════════════════════
# ═════════════════════════════════════════════════════════════════════════════
# The admin transactions page reads from `Payment`. The wire contract
# below is what makes the frontend's field names line up. Do NOT rename
# the output keys — the frontend depends on them.
# ═════════════════════════════════════════════════════════════════════════════


class PaymentEventSerializer(serializers.ModelSerializer):
    """
    One row of the drawer's lifecycle timeline.
    """
    time = serializers.SerializerMethodField()
    status = serializers.CharField(source="state", read_only=True)

    class Meta:
        model = PaymentEvent
        fields = ("title", "time", "status")

    def get_time(self, obj) -> str:
        return obj.created_at.strftime("%H:%M:%S")


class TransactionSerializer(serializers.ModelSerializer):
    """
    Row shape for the ledger table AND the detail drawer.
    """
    ref               = serializers.CharField(source="mpesa_receipt_number", read_only=True)
    orderNumber       = serializers.CharField(source="order.reference", read_only=True)

    amount            = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )
    fee               = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )

    phoneNumber       = serializers.CharField(source="masked_phone", read_only=True)

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
    """
    Response shape for `GET /api/v1/transactions/summary/`.
    """
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
    """
    Read shape for the reconcile history panel.
    """
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
    """
    Input payload for `POST /api/v1/transactions/<id>/reconcile/`.
    """
    status = serializers.ChoiceField(choices=("Matched", "Unmatched"))
    orderNumber = serializers.CharField(
        max_length=64, required=False, allow_blank=True,
    )
    note = serializers.CharField(
        required=False, allow_blank=True, allow_null=True,
    )


class RetryPaymentSerializer(serializers.Serializer):
    """
    Input payload for `POST /api/v1/transactions/<id>/retry/`.
    """
    phone_number = serializers.CharField(
        max_length=32, required=False, allow_blank=True,
    )


class BulkExportSerializer(serializers.Serializer):
    """
    Input payload for the bulk-export action on the ledger page.
    """
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )