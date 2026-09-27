# payments/models.py

import uuid

from django.conf import settings
from django.db import models


# ─────────────────────────────────────────────────────────────
# PAYMENT — one row per order payment
# ─────────────────────────────────────────────────────────────
class Payment(models.Model):
    """
    One payment per order.
    Represents the overall payment lifecycle.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"
        REFUNDED = "REFUNDED", "Refunded"

    class Gateway(models.TextChoices):
        DUSUPAY = "DUSUPAY", "DusuPay"
        PESAPAL = "PESAPAL", "Pesapal"
        MPESA = "MPESA", "M-Pesa"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    order_reference = models.CharField(
        max_length=64, unique=True, db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="KES")
    gateway = models.CharField(max_length=20, choices=Gateway.choices)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    description = models.CharField(max_length=255, blank=True)

    # Gateway-issued identifiers (nullable — populated once gateway responds)
    internal_reference = models.CharField(
        max_length=128, blank=True, db_index=True
    )
    gateway_reference = models.CharField(
        max_length=128, blank=True, db_index=True
    )
    payment_url = models.URLField(blank=True)

    # Provider-specific raw payloads for debugging/audit
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order_reference", "status"]),
            models.Index(fields=["gateway", "status"]),
        ]

    def __str__(self):
        return f"{self.order_reference} — {self.gateway} — {self.status}"


# ─────────────────────────────────────────────────────────────
# PAYMENT ATTEMPT — one row per retry
# ─────────────────────────────────────────────────────────────
class PaymentAttempt(models.Model):
    """
    Each retry is its own attempt.
    Useful for M-Pesa STK where users retry with a different phone.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="attempts",
    )

    gateway_checkout_id = models.CharField(
        max_length=128, blank=True, db_index=True
    )
    raw_request = models.JSONField(default=dict, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    status_code = models.CharField(max_length=32, blank=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_attempts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Attempt for {self.payment.order_reference}"


# ─────────────────────────────────────────────────────────────
# STORE PAYMENT CONFIG — one row per store owner
# ─────────────────────────────────────────────────────────────
class StorePaymentConfig(models.Model):
    """
    A store's payment configuration.
    One row per user. Contains M-Pesa credentials + a single aggregator
    (Pesapal or Dusupay) that covers Airtel, Bank, and Card.
    """

    class Aggregator(models.TextChoices):
        NONE = "none", "None"
        PESAPAL = "pesapal", "Pesapal"
        DUSUPAY = "dusupay", "Dusupay"

    class Env(models.TextChoices):
        SANDBOX = "sandbox", "Sandbox"
        PRODUCTION = "production", "Production"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_config",
    )

    # ── M-Pesa (direct Safaricom) ──
    mpesa_enabled = models.BooleanField(default=False)
    mpesa_consumer_key = models.CharField(max_length=255, blank=True)
    mpesa_consumer_secret = models.CharField(max_length=255, blank=True)
    mpesa_passkey = models.CharField(max_length=255, blank=True)
    mpesa_shortcode = models.CharField(max_length=20, blank=True)
    mpesa_env = models.CharField(
        max_length=20, choices=Env.choices, default=Env.SANDBOX
    )

    # ── Aggregator (covers Airtel, Bank, Card) ──
    aggregator = models.CharField(
        max_length=20, choices=Aggregator.choices, default=Aggregator.NONE
    )
    aggregator_public_key = models.CharField(max_length=255, blank=True)
    aggregator_secret_key = models.CharField(max_length=255, blank=True)
    aggregator_env = models.CharField(
        max_length=20, choices=Env.choices, default=Env.SANDBOX
    )

    # ── Last test results ──
    mpesa_tested_at = models.DateTimeField(null=True, blank=True)
    mpesa_test_ok = models.BooleanField(default=False)
    aggregator_tested_at = models.DateTimeField(null=True, blank=True)
    aggregator_test_ok = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_payment_configs"
        verbose_name = "Store payment config"

    def __str__(self):
        return f"{self.user.email} — mpesa={self.mpesa_enabled}, agg={self.aggregator}"