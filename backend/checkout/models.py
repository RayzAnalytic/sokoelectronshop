import uuid

from django.conf import settings
from django.db import models


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        PROCESSING = "processing", "Processing"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"

    reference = models.CharField(max_length=64, unique=True, db_index=True)

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

    delivery_method = models.CharField(max_length=20)
    estimated_delivery = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    coupon_code = models.CharField(max_length=32, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    client_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Frozen payload exactly as received. Immutable after creation.
    snapshot = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return self.reference


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

    def __str__(self):
        return f"{self.quantity} × {self.name}"


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

    def __str__(self):
        return f"{self.code} ({self.percent_off})"


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"
        TIMEOUT = "TIMEOUT", "Timeout"

    TERMINAL_STATUSES = {
        Status.SUCCESS,
        Status.FAILED,
        Status.CANCELLED,
        Status.TIMEOUT,
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name="payment"
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone_number = models.CharField(max_length=20)

    idempotency_key = models.CharField(
        max_length=64, unique=True, db_index=True
    )

    merchant_request_id = models.CharField(
        max_length=64, blank=True, db_index=True
    )
    checkout_request_id = models.CharField(
        max_length=64, blank=True, db_index=True
    )

    mpesa_receipt_number = models.CharField(max_length=32, blank=True)
    result_code = models.IntegerField(null=True, blank=True)
    result_description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "updated_at"]),
        ]

    def __str__(self):
        return f"{self.order.reference} — {self.status}"

    @property
    def order_reference(self):
        return self.order.reference


class MpesaCallbackLog(models.Model):
    checkout_request_id = models.CharField(
        max_length=64, blank=True, db_index=True
    )
    body = models.JSONField()
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.checkout_request_id or 'unknown'} @ {self.created_at}"

   