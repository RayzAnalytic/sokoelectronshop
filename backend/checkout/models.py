"""
checkout/models.py

Schema notes (guest + authenticated checkout):

  * Checkout supports BOTH guest and authenticated sessions.

      - Signed-in customer  → `Order.user` is set at creation time
                              from `request.user`
      - Guest customer      → `Order.user` is NULL; the order is later
                              claimed on login/register by the
                              `claim_guest_orders` signal, matching on
                              `contact_email` OR `contact_phone`

    This is what lets a guest check out without friction, then create
    an account on the order-success page and immediately see their
    order in `/pages/account/orders`.

  * `Order.user` is `null=True`. This is intentional, not legacy.
    Views set it when `request.user.is_authenticated`, otherwise
    leave it NULL and trust the claim signal.

  * `contact_email` / `contact_phone` are the DELIVERY contact for
    this order — snapshot at checkout time. They are always
    populated for new orders, whether the customer is a guest or
    signed-in, because:

      - For guests, these are the ONLY way to find the order later
        and the only way `claim_guest_orders` can match it.
      - For signed-in customers, they may legitimately differ from
        the account email/phone (e.g. deliver to the office).

  * `is_guest_order` is a real, load-bearing property — not legacy.
    It is True whenever `user_id IS NULL`, which is the state of
    every guest order until its owner authenticates.

Cart notes:

  * `Cart` and `CartItem` were added so the admin Customers page can
    show a live cart per customer, and so abandoned-cart recovery is
    possible later. Before this, the cart lived only in the frontend
    (Zustand / localStorage) and was invisible to the backend.

  * One `Cart` per user (`OneToOneField`). Anonymous carts live in
    the browser. On login/register the frontend calls the merge
    endpoint and the server folds the anonymous items into this cart
    exactly once.

  * `CartItem` is denormalized the same way `WishlistItem` is —
    product name, brand, image, and price are copied on add so the
    cart endpoint never fans out to the catalog. Stale values are
    acceptable; the client re-adds on product-detail visit.

  * Stock is a snapshot for display only. Checkout re-validates
    against live inventory at order-creation time.

Order status notes:

  * `Order.Status` was extended with RETURNED and FAILED so the admin
    order list can filter by those states without a join. RETURNED
    means the item is physically back at the warehouse. FAILED means
    the order terminated and will never ship (stock-out, payment
    failure, manual rejection).

    Note that REFUNDED is deliberately NOT a fulfillment status.
    Refunds are payment events — see `PaymentStatus.REFUNDED`. An
    order can be `delivered` + `refunded` (returned after delivery,
    money back), or `cancelled` + `refunded` (cancelled after M-Pesa,
    refund processed). Keeping the two axes independent avoids an
    enum explosion.

  * `Order.PaymentStatus` was extended with FAILED. Without it, an
    M-Pesa failure left the order at `unpaid` forever, which made
    "show me failed payments" impossible to express.

  * `Order.Source` records the CHANNEL the order came through — web,
    whatsapp, admin, or phone. It is a reporting axis only: no
    commercial logic keys off it, and no state transition reads it.
    It exists so the admin can answer "WhatsApp revenue this month"
    without joining to a log table. Set from
    `checkout_payload["source"]` at creation time via
    `checkout.services._persist_order`. Defaults to `web`.

  * `Order.channel_meta` is a free-form JSON dict carrying channel-
    specific attribution — the WhatsApp conversation id, the TikTok
    handle, the video URL, the staff member who logged the order,
    etc. It is deliberately SEPARATE from `snapshot`: the snapshot is
    frozen at checkout and documented as "the exact shape the success
    page reads", whereas `channel_meta` is metadata that an admin
    may edit after the fact and that no customer-facing page reads.
    Defaults to `{}` so callers that never set it are unaffected.
    Read via `Order.meta("key")` to avoid the `(x or {}).get(...)`
    dance at every call site. Set from
    `checkout_payload["channel_meta"]` at creation time.

  * `Order.courier`, `Order.tracking_number`, and `Order.internal_notes`
    are first-class columns. The first two were previously buried
    inside `Order.snapshot` (a JSON blob frozen at creation), which
    meant they could never be updated and were invisible until the
    order already existed. `internal_notes` is separate from `notes`
    so admin comments never overwrite the customer's checkout note.

  * `OrderStatusEvent` records every status transition. Both the
    customer order page and the admin order page read from it. It is
    what makes the timeline possible and what makes refunds
    auditable. Every write path that changes `Order.status` must
    record an event — see `checkout.services.change_order_status`.

Payment ledger notes (transactions admin page):

  * `Payment` is the FINANCIAL event; `Order` is the COMMERCIAL
    purchase. The admin transactions page reads from `Payment`, not
    from `Order`. Multiple `Payment` rows can settle one `Order`
    (failed attempt → retry → success).

  * `Payment.method` mirrors `Order.payment_method` at creation time
    so the ledger can be filtered by method WITHOUT joining to
    `Order`. This is what lets the summary cards split M-Pesa / COD
    without a fan-out. It is denormalized — if `Order.payment_method`
    is ever corrected by an admin, backfill this column too.

  * `Payment.fee` is the Safaricom transaction fee. Daraja does NOT
    return this on STK push, so it is populated from
    `constants.mpesa_fee_for()` at success time. Zero for COD.

  * `Payment.raw_callback` is the raw Daraja body, denormalized onto
    the Payment so the admin detail drawer can render the payload
    without a second query. `MpesaCallbackLog` remains the immutable
    webhook audit log; `raw_callback` is the convenient copy.

  * `PaymentEvent` records the payment lifecycle (STK triggered,
    PIN entered, callback received) — distinct from
    `OrderStatusEvent` (pending → confirmed → shipped). The admin
    drawer shows both, but they are not the same timeline.

  * `ReconciliationLog` records manual finance actions (mark
    matched, mark unmatched, mark cash-paid, post to account). It is
    append-only and never mutated — the audit trail of who touched
    which payment and why.

TRANSACTION-SAFETY NOTE:
    `PaymentEvent.log()` writes a row inside whatever transaction
    the caller is already in. It is documented as "best-effort,
    never raises" — a failed INSERT must not roll back the caller's
    work. To honour that contract, the DB write is wrapped in a
    nested `transaction.atomic()` block. The nested block creates a
    savepoint, so only the savepoint rolls back on error and the
    outer transaction stays usable for the caller's next query.
    Without the nested block, a failed INSERT would poison the outer
    transaction and the caller's next query would raise
    `TransactionManagementError`.
"""

import logging
import secrets
import uuid

from django.conf import settings
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Reference generator
# ─────────────────────────────────────────────────────────────────────────────
def generate_order_reference() -> str:
    """
    Format: ORD-YYYYMMDD-XXXXXXXX

    The suffix is 8 hex characters from `secrets.token_hex`, giving
    ~4.3 billion combinations per day. Combined with the unique
    constraint on `reference`, collisions are effectively impossible.
    """
    ts = timezone.now().strftime("%Y%m%d")
    suffix = secrets.token_hex(4).upper()      # e.g. "3F9A2C1D"
    return f"ORD-{ts}-{suffix}"


# ─────────────────────────────────────────────────────────────────────────────
# Order
# ─────────────────────────────────────────────────────────────────────────────
class Order(models.Model):
    class Status(models.TextChoices):
        PENDING    = "pending",    "Pending"
        CONFIRMED  = "confirmed",  "Confirmed"
        PROCESSING = "processing", "Processing"
        SHIPPED    = "shipped",    "Shipped"
        DELIVERED  = "delivered",  "Delivered"
        RETURNED   = "returned",   "Returned"
        CANCELLED  = "cancelled",  "Cancelled"
        FAILED     = "failed",     "Failed"

    class PaymentStatus(models.TextChoices):
        UNPAID   = "unpaid",   "Unpaid"
        PAID     = "paid",     "Paid"
        REFUNDED = "refunded", "Refunded"
        FAILED   = "failed",   "Failed"

    class PaymentMethod(models.TextChoices):
        MPESA = "MPESA", "M-Pesa"
        COD   = "COD",   "Cash on Delivery"

    class Source(models.TextChoices):
        WEB      = "web",      "Web"
        WHATSAPP = "whatsapp", "WhatsApp"
        ADMIN    = "admin",    "Admin"
        PHONE    = "phone",    "Phone"

    reference = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_order_reference,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
    )

    payment_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
        default=PaymentMethod.MPESA,
        db_index=True,
    )

    # Channel the order came through. Reporting axis only — no
    # commercial logic keys off it. Defaults to "web" so callers that
    # do not pass a source produce the historical behaviour. Set from
    # `checkout_payload["source"]` in `services._persist_order`.
    source = models.CharField(
        max_length=16,
        choices=Source.choices,
        default=Source.WEB,
        db_index=True,
    )

    # Channel-specific attribution. Free-form JSON because the shape
    # varies per source: WhatsApp orders carry the conversation id
    # and the customer's WA id; TikTok-sourced orders carry the video
    # URL and the customer's TikTok handle; admin-logged orders carry
    # the staff member who typed them in.
    #
    # Deliberately SEPARATE from `snapshot` — the snapshot is frozen
    # at checkout and documented as the exact shape the success page
    # reads. Attribution is metadata, not the customer-facing order
    # record, and it may legitimately be edited after the fact.
    #
    # Expected keys (all optional):
    #   whatsapp_conversation_id  int    — originating conversation
    #   whatsapp_contact_wa_id    str    — E.164 digits, no '+'
    #   tiktok_handle             str    — e.g. "@amina.m"
    #   tiktok_video_url          str    — the video/LIVE that drove the sale
    #   creator_handle            str    — affiliate who referred
    #   logged_by_user_id         int    — staff who typed it in
    #
    # Read via `order.meta("key")` rather than indexing directly.
    channel_meta = models.JSONField(default=dict, blank=True)      # ── ADDED

    delivery_method = models.CharField(max_length=20)
    estimated_delivery = models.CharField(max_length=64, blank=True)

    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    coupon_code = models.CharField(max_length=32, blank=True)

    contact_email = models.EmailField(blank=True, db_index=True)
    contact_phone = models.CharField(max_length=32, blank=True, db_index=True)

    courier = models.CharField(max_length=120, blank=True)
    tracking_number = models.CharField(max_length=120, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    client_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    snapshot = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["payment_method", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["payment_status", "-created_at"]),
            models.Index(fields=["source", "-created_at"]),
            models.Index(
                fields=["contact_email"],
                name="order_guest_email_idx",
                condition=models.Q(user__isnull=True),
            ),
            models.Index(
                fields=["contact_phone"],
                name="order_guest_phone_idx",
                condition=models.Q(user__isnull=True),
            ),
        ]

    def __str__(self):
        return self.reference

    def save(self, *args, **kwargs):
        if not self.reference:
            for _ in range(5):
                candidate = generate_order_reference()
                if not Order.objects.filter(reference=candidate).exists():
                    self.reference = candidate
                    break
            else:
                raise RuntimeError(
                    "Could not generate a unique order reference after 5 tries."
                )
        super().save(*args, **kwargs)

    # ── Derived helpers ─────────────────────────────────────────────────
    @property
    def is_paid(self) -> bool:
        return self.payment_status == self.PaymentStatus.PAID

    @property
    def is_cod(self) -> bool:
        return self.payment_method == self.PaymentMethod.COD

    @property
    def is_terminal(self) -> bool:
        return self.status in {
            self.Status.DELIVERED,
            self.Status.RETURNED,
            self.Status.CANCELLED,
            self.Status.FAILED,
        }

    @property
    def is_guest_order(self) -> bool:
        return self.user_id is None

    @property
    def is_social_order(self) -> bool:                            # ── CHANGED
        """                                                            # ── CHANGED
        True for orders that originated outside the storefront.        # ── CHANGED
                                                                       # ── CHANGED
        Reads `source`, not `channel_meta`, so a caller can decide     # ── CHANGED
        whether it needs to hydrate attribution without loading the    # ── CHANGED
        JSON column first. Matches all non-web sources — extend when   # ── CHANGED
        a new channel lands.                                           # ── CHANGED
        """                                                            # ── CHANGED
        return self.source != self.Source.WEB                          # ── CHANGED

    def meta(self, key: str, default=None):                        # ── ADDED
        """                                                            # ── ADDED
        Read a `channel_meta` key safely.                              # ── ADDED
                                                                       # ── ADDED
        Every call site that needs attribution otherwise writes        # ── ADDED
        `(order.channel_meta or {}).get(...)` — this centralises the   # ── ADDED
        null-guard so a future migration that resets `channel_meta`    # ── ADDED
        to NULL (it shouldn't, but JSONField is easy to misuse)        # ── ADDED
        cannot crash a page.                                           # ── ADDED
        """                                                            # ── ADDED
        return (self.channel_meta or {}).get(key, default)             # ── ADDED

    @property
    def latest_payment(self):
        return self.payments.order_by("-created_at").first()

    @property
    def successful_payment(self):
        return self.payments.filter(status="SUCCESS").order_by("-created_at").first()

    @property
    def amount_paid(self):
        from decimal import Decimal
        return (
            self.payments
            .filter(status=Payment.Status.SUCCESS)
            .aggregate(total=models.Sum("amount"))["total"]
            or Decimal("0")
        )

    @property
    def is_fully_settled(self) -> bool:
        return self.amount_paid >= self.total

    @property
    def is_ledger_visible(self) -> bool:
        return (
            self.payments.exists()
            or self.payment_method == self.PaymentMethod.COD
        )


# ─────────────────────────────────────────────────────────────────────────────
# OrderItem
# ─────────────────────────────────────────────────────────────────────────────
class OrderItem(models.Model):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items"
    )
    product_id = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=120, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField()
    image_url = models.URLField(max_length=500, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} × {self.name}"

    @property
    def line_total(self):
        return self.unit_price * self.quantity


# ─────────────────────────────────────────────────────────────────────────────
# OrderStatusEvent
# ─────────────────────────────────────────────────────────────────────────────
class OrderStatusEvent(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_events",
    )
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, choices=Order.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_status_events",
    )
    actor_label = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order", "-created_at"]),
            models.Index(fields=["to_status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.order.reference}: {self.from_status or '∅'} → {self.to_status}"

    @property
    def is_creation(self) -> bool:
        return not self.from_status


# ─────────────────────────────────────────────────────────────────────────────
# Cart
# ─────────────────────────────────────────────────────────────────────────────
class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Cart({self.user_id})"

    @property
    def total_units(self) -> int:
        return self.items.aggregate(total=models.Sum("quantity"))["total"] or 0

    @property
    def is_empty(self) -> bool:
        return not self.items.exists()


# ─────────────────────────────────────────────────────────────────────────────
# CartItem
# ─────────────────────────────────────────────────────────────────────────────
class CartItem(models.Model):
    class Stock(models.TextChoices):
        IN  = "In Stock",     "In Stock"
        LOW = "Low Stock",    "Low Stock"
        OUT = "Out of Stock", "Out of Stock"

    cart = models.ForeignKey(
        Cart, on_delete=models.CASCADE, related_name="items",
    )
    product_id = models.CharField(max_length=64, db_index=True)
    variant_id = models.CharField(max_length=64, blank=True, default="")

    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=120, blank=True)
    image = models.CharField(max_length=500, blank=True)
    variant_label = models.CharField(max_length=120, blank=True)

    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )

    quantity = models.PositiveIntegerField(default=1)

    stock = models.CharField(
        max_length=20, choices=Stock.choices, default=Stock.IN,
    )
    stock_count = models.PositiveIntegerField(default=0)

    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-added_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product_id", "variant_id"],
                name="one_cart_item_per_variant_per_cart",
            ),
        ]
        indexes = [
            models.Index(fields=["cart", "-added_at"]),
            models.Index(fields=["cart", "product_id"]),
        ]

    def __str__(self):
        return f"{self.cart.user_id} · {self.name} × {self.quantity}"

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    @property
    def on_sale(self) -> bool:
        return (
            self.compare_at_price is not None
            and self.compare_at_price > self.unit_price
        )


# ─────────────────────────────────────────────────────────────────────────────
# Coupon
# ─────────────────────────────────────────────────────────────────────────────
class Coupon(models.Model):
    code = models.CharField(max_length=32, unique=True)
    percent_off = models.DecimalField(max_digits=5, decimal_places=4)
    active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    min_subtotal = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.percent_off})"

    def is_available(self, at=None) -> bool:
        if not self.active:
            return False
        at = at or timezone.now()
        if self.valid_from and at < self.valid_from:
            return False
        if self.valid_to and at > self.valid_to:
            return False
        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False
        return True

    def increment_usage(self):
        Coupon.objects.filter(pk=self.pk).update(used_count=F("used_count") + 1)
        self.refresh_from_db(fields=["used_count"])


# ─────────────────────────────────────────────────────────────────────────────
# Payment — the financial event
# ─────────────────────────────────────────────────────────────────────────────
class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING    = "PENDING",    "Pending"
        PROCESSING = "PROCESSING", "Processing"
        SUCCESS    = "SUCCESS",    "Success"
        FAILED     = "FAILED",     "Failed"
        CANCELLED  = "CANCELLED",  "Cancelled"
        TIMEOUT    = "TIMEOUT",    "Timeout"
        REVERSED   = "REVERSED",   "Reversed"

    class Method(models.TextChoices):
        MPESA = "MPESA", "M-Pesa"
        COD   = "COD",   "Cash on Delivery"

    TERMINAL_STATUSES = {
        Status.SUCCESS,
        Status.FAILED,
        Status.CANCELLED,
        Status.TIMEOUT,
        Status.REVERSED,
    }

    SETTLED_STATUSES = {Status.SUCCESS}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="payments",
    )

    # Denormalized from `Order.payment_method` at creation.
    # `db_index=True` here is retained for compatibility with any
    # ad-hoc queries that filter on `method` alone without a
    # `status` or `created_at` clause. Note that the two composite
    # indexes below also start with `method`, so in a pure Postgres
    # deployment this single-column index is technically redundant —
    # Postgres uses the composite for `WHERE method = ?`. It is kept
    # because removing it costs a migration and buys ~1 write IOPS
    # on an INSERT-heavy table. If `Payment` INSERT volume ever
    # becomes a bottleneck, drop it.
    method = models.CharField(
        max_length=10,
        choices=Method.choices,
        default=Method.MPESA,
        db_index=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(max_length=20)

    fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    idempotency_key = models.CharField(
        max_length=64, unique=True, db_index=True,
    )

    merchant_request_id = models.CharField(
        max_length=64, blank=True, db_index=True,
    )
    checkout_request_id = models.CharField(
        max_length=64, blank=True, db_index=True,
    )

    mpesa_receipt_number = models.CharField(max_length=32, blank=True)
    result_code = models.IntegerField(null=True, blank=True)
    result_description = models.TextField(blank=True)

    raw_callback = models.JSONField(default=dict, blank=True)

    reversal_of = models.ForeignKey(
        "self",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="reversals",
    )
    reversal_reason = models.TextField(blank=True)

    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="collected_payments",
    )
    settled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "updated_at"]),
            models.Index(fields=["order", "-created_at"]),
            models.Index(fields=["method", "status", "-created_at"]),
            models.Index(fields=["method", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.order.reference} — {self.method} — {self.status}"

    @property
    def user(self):
        return self.order.user_id

    @property
    def order_reference(self):
        return self.order.reference

    @property
    def is_terminal(self) -> bool:
        return self.status in self.TERMINAL_STATUSES

    # ── Ledger display helpers ─────────────────────────────────────────
    @property
    def customer_name(self) -> str:
        snap = (self.order.snapshot or {})
        return (
            snap.get("full_name")
            or (self.order.user.get_full_name() if self.order.user else "")
            or "—"
        )

    @property
    def customer_email(self) -> str:
        return self.order.contact_email or ""

    @property
    def masked_phone(self) -> str:
        raw = self.phone_number or ""
        digits = "".join(c for c in raw if c.isdigit())
        if len(digits) < 9:
            return raw or "—"
        return f"+{digits[:3]} {digits[3:6]} *** {digits[-3:]}"

    @property
    def display_status(self) -> str:
        return {
            self.Status.SUCCESS:    "Success",
            self.Status.PENDING:    "Pending",
            self.Status.PROCESSING: "Pending",
            self.Status.FAILED:     "Failed",
            self.Status.CANCELLED:  "Failed",
            self.Status.TIMEOUT:    "Failed",
            self.Status.REVERSED:   "Reversed",
        }.get(self.status, "Failed")


# ─────────────────────────────────────────────────────────────────────────────
# PaymentEvent — payment lifecycle timeline (distinct from order status)
# ─────────────────────────────────────────────────────────────────────────────
class PaymentEvent(models.Model):
    """
    One row per payment lifecycle milestone.

    This is NOT the same as `OrderStatusEvent`. `OrderStatusEvent`
    tracks commercial fulfillment (pending → confirmed → shipped).
    `PaymentEvent` tracks the financial handshake with the gateway
    (STK triggered → PIN entered → callback received).

    The admin detail drawer on the transactions page renders this
    timeline. The customer order page does not — customers see the
    order timeline, not the payment micro-steps.

    Written through `PaymentEvent.log()`. Callers never construct a
    row directly — the classmethod centralises the best-effort
    contract: a failure to write a timeline row logs and returns
    None rather than rolling back the caller's transaction.
    """

    class State(models.TextChoices):
        COMPLETED = "completed", "Completed"
        ACTIVE    = "active",    "Active"
        FAILED    = "failed",    "Failed"

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="events",
    )
    title = models.CharField(max_length=120)
    state = models.CharField(
        max_length=20,
        choices=State.choices,
        default=State.COMPLETED,
    )
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["payment", "created_at"]),
        ]

    def __str__(self):
        return f"{self.payment_id}: {self.title}"

    @classmethod
    def log(
        cls,
        payment: "Payment",
        title: str,
        *,
        state: str = State.COMPLETED,
        detail: str = "",
    ) -> "PaymentEvent | None":
        """
        Best-effort timeline writer.

        Mirrors `record_status_event`'s contract on the order side:
        a failure here logs and returns None rather than rolling back
        the caller. The payment state change is the important part;
        the timeline row is an audit convenience for the admin drawer.

        Called from:
          * `checkout.services.transition_payment` on every state change
          * `checkout.services.process_checkout` when the STK push fires
          * `checkout.services.retry_payment` on retry initiation
          * `checkout.services.reconcile_payment` on CASH_PAID
          * `checkout.services._persist_order` for a COD order's first row

        The DB write is wrapped in a nested `transaction.atomic()`.
        The nested block creates a savepoint — a failed INSERT rolls
        back only the savepoint, and the caller's outer transaction
        stays usable for its next query. Without the nested block, a
        failed INSERT would poison the parent transaction and the
        caller's next query would raise
        `TransactionManagementError`. The "never raises" contract
        depends on this — an exception swallowed inside a poisoned
        transaction is worse than one that propagates.
        """
        try:
            with transaction.atomic():
                return cls.objects.create(
                    payment=payment,
                    title=title[:120],
                    state=state,
                    detail=detail or "",
                )
        except Exception:
            logger.exception(
                "Failed to log payment event for payment %s: %s",
                payment.pk, title,
            )
            return None


# ─────────────────────────────────────────────────────────────────────────────
# ReconciliationLog — audit trail for manual finance actions
# ─────────────────────────────────────────────────────────────────────────────
class ReconciliationLog(models.Model):
    """
    Append-only audit trail for manual reconciliations.

    The admin transactions page offers four manual actions:

        * Mark matched      — the payment has been tied to an order
        * Mark unmatched    — finance could not tie it to anything
        * Mark paid by cash — a COD payment physically received
        * Post to account   — placed on the customer's running tab

    Every one of them writes a row here. The row is never mutated or
    deleted — the point of the table is to answer "who touched this
    payment, when, and why" months later.

    `actor_label` is denormalized for the same reason as on
    `OrderStatusEvent`: the label must survive account deletion.
    """

    class Action(models.TextChoices):
        MATCHED    = "matched",    "Matched"
        UNMATCHED  = "unmatched",  "Unmatched"
        CASH_PAID  = "cash_paid",  "Marked paid by cash"
        ON_ACCOUNT = "on_account", "Posted to account"

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="reconciliations",
    )
    action = models.CharField(max_length=20, choices=Action.choices)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciliations",
    )
    actor_label = models.CharField(max_length=120, blank=True)
    matched_order_reference = models.CharField(max_length=64, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["payment", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.payment_id}: {self.action} @ {self.created_at}"


# ─────────────────────────────────────────────────────────────────────────────
# MpesaCallbackLog
# ─────────────────────────────────────────────────────────────────────────────
class MpesaCallbackLog(models.Model):
    checkout_request_id = models.CharField(
        max_length=64, blank=True, db_index=True,
    )
    body = models.JSONField()
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.checkout_request_id or 'unknown'} @ {self.created_at}"