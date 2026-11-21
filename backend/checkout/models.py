from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
import logging
import uuid

logger = logging.getLogger(__name__)


def generate_order_reference() -> str:
    return f"ORD-{uuid.uuid4().hex[:10].upper()}"


def generate_verify_token() -> str:
    return uuid.uuid4().hex


class Coupon(models.Model):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    percent_off = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    min_subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    @property
    def is_valid_now(self) -> bool:
        now = timezone.now()
        if not self.active:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_to and now > self.valid_to:
            return False
        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False
        return True


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING    = "PENDING",    "Pending"
        CONFIRMED  = "CONFIRMED",  "Confirmed"
        PROCESSING = "PROCESSING", "Processing"
        SHIPPED    = "SHIPPED",    "Shipped"
        DELIVERED  = "DELIVERED",  "Delivered"
        RETURNED   = "RETURNED",   "Returned"
        CANCELLED  = "CANCELLED",  "Cancelled"
        FAILED     = "FAILED",     "Failed"

    class PaymentStatus(models.TextChoices):
        UNPAID   = "UNPAID",   "Unpaid"
        PAID     = "PAID",     "Paid"
        REFUNDED = "REFUNDED", "Refunded"
        FAILED   = "FAILED",   "Failed"

    class PaymentMethod(models.TextChoices):
        MPESA = "MPESA", "M-Pesa"
        COD   = "COD",   "Cash on delivery"

    class DeliveryMethod(models.TextChoices):
        EXPRESS  = "express",  "Express"
        STANDARD = "standard", "Standard"
        PICKUP   = "pickup",   "Pickup"

    class Source(models.TextChoices):
        WEB      = "web",      "Web"
        WHATSAPP = "whatsapp", "WhatsApp"
        APP      = "app",      "Mobile app"
        ADMIN    = "admin",    "Admin"
        API      = "api",      "API"
        IN_STORE = "in_store", "In-store"

    reference = models.CharField(
        max_length=32, unique=True, db_index=True,
        default=generate_order_reference,
    )
    verify_token = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        default=generate_verify_token,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
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
        max_length=16,
        choices=PaymentMethod.choices,
        default=PaymentMethod.MPESA,
        db_index=True,
    )

    source = models.CharField(
        max_length=16,
        choices=Source.choices,
        default=Source.WEB,
        db_index=True,
    )
    channel_meta = models.JSONField(default=dict, blank=True)

    contact_email = models.EmailField(blank=True, db_index=True)
    contact_phone = models.CharField(max_length=32, blank=True, db_index=True)
    full_name = models.CharField(max_length=120, blank=True)

    address_street = models.CharField(max_length=255, blank=True)
    address_town = models.CharField(max_length=120, blank=True)
    address_county = models.CharField(max_length=120, blank=True)
    address_postal_code = models.CharField(max_length=20, blank=True)

    delivery_method = models.CharField(
        max_length=20,
        choices=DeliveryMethod.choices,
        default=DeliveryMethod.STANDARD,
    )
    estimated_delivery = models.CharField(max_length=64, blank=True)

    coupon = models.ForeignKey(
        Coupon,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    coupon_code = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    courier = models.CharField(max_length=120, blank=True)
    tracking_number = models.CharField(max_length=120, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    client_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    snapshot = models.JSONField(default=dict, blank=True)

    superseded_by = models.ForeignKey(
        "self",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="supersedes",
    )
    abandoned_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    payment_reminder_sent_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["user", "status", "-created_at"]),
            models.Index(fields=["payment_method", "-created_at"]),
            models.Index(fields=["payment_status", "-created_at"]),
            models.Index(fields=["source", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.reference} — {self.status}"

    @property
    def is_paid(self) -> bool:
        return self.payment_status == self.PaymentStatus.PAID

    @property
    def is_cod(self) -> bool:
        return self.payment_method == self.PaymentMethod.COD

    @property
    def is_guest_order(self) -> bool:
        return self.user_id is None

    @property
    def is_terminal(self) -> bool:
        return self.status in {
            self.Status.DELIVERED,
            self.Status.RETURNED,
            self.Status.CANCELLED,
            self.Status.FAILED,
        }

    @property
    def latest_payment(self):
        return self.payments.order_by("-created_at").first()

    @property
    def successful_payment(self):
        return (
            self.payments
            .filter(status=Payment.Status.SUCCESS)
            .order_by("-created_at")
            .first()
        )

    @property
    def amount_paid(self):
        return (
            self.payments
            .filter(status=Payment.Status.SUCCESS)
            .aggregate(total=models.Sum("amount"))["total"]
            or Decimal("0")
        )

    @property
    def customer_name(self) -> str:
        if self.user_id:
            name = (
                f"{self.user.first_name or ''} {self.user.last_name or ''}"
            ).strip()
            return name or self.user.email or "Guest"
        return self.full_name or self.contact_email or "Guest"

    @property
    def customer_email(self) -> str:
        if self.user_id and getattr(self.user, "email", None):
            return self.user.email
        return self.contact_email or ""

    @property
    def customer_phone(self) -> str:
        if self.user_id and getattr(self.user, "phone", None):
            return self.user.phone
        return self.contact_phone or ""


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product_id = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=120, blank=True)
    image_url = models.URLField(max_length=500, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField(default=1)

    serial_number = models.CharField(max_length=120, blank=True, default="")
    imei = models.CharField(max_length=32, blank=True, default="")
    warranty_months = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} x{self.quantity}"

    @property
    def line_total(self) -> Decimal:
        return (self.unit_price or Decimal("0")) * self.quantity


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
        null=True, blank=True,
        on_delete=models.SET_NULL,
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


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    abandoned_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Cart<{self.user_id}>"

    @property
    def total_units(self) -> int:
        return self.items.aggregate(total=models.Sum("quantity"))["total"] or 0

    @property
    def is_empty(self) -> bool:
        return not self.items.exists()


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

    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
        MPS = "MPS", "M-Pesa"
        COD = "COD", "Cash on delivery"

    class Source(models.TextChoices):
        STK    = "STK",    "STK Push"
        C2B    = "C2B",    "Buy Goods / Till"
        MANUAL = "MANUAL", "Manual entry"

    TERMINAL_STATUSES = {
        Status.SUCCESS, Status.FAILED, Status.CANCELLED,
        Status.TIMEOUT, Status.REVERSED,
    }
    SETTLED_STATUSES = {Status.SUCCESS}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    method = models.CharField(
        max_length=16,
        choices=Method.choices,
        default=Method.MPS,
        db_index=True,
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.STK,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    phone_number = models.CharField(max_length=32, blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
            models.Index(fields=["source", "-created_at"]),
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
    def snapshot(self) -> dict:
        return self.order.snapshot or {}

    @property
    def is_terminal(self) -> bool:
        return self.status in self.TERMINAL_STATUSES

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


class PaymentEvent(models.Model):
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


class ReconciliationLog(models.Model):
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
        null=True, blank=True,
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