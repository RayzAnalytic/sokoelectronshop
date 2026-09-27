# whatsapp/models.py

import uuid

from django.conf import settings
from django.db import models


# ─────────────────────────────────────────────────────────────
# WHATSAPP MESSAGE — message log (inbound + outbound)
# ─────────────────────────────────────────────────────────────
class WhatsAppMessage(models.Model):
    """
    Stores incoming and outgoing WhatsApp messages for auditing
    and conversation history.
    """

    class Direction(models.TextChoices):
        INBOUND = "INBOUND", "Inbound"
        OUTBOUND = "OUTBOUND", "Outbound"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        DELIVERED = "DELIVERED", "Delivered"
        READ = "READ", "Read"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    wa_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    direction = models.CharField(max_length=10, choices=Direction.choices)
    from_number = models.CharField(max_length=20, db_index=True)
    to_number = models.CharField(max_length=20, db_index=True)
    body = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    raw_payload = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "whatsapp_messages"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["direction", "status"]),
            models.Index(fields=["from_number", "created_at"]),
            models.Index(fields=["to_number", "created_at"]),
        ]

    def __str__(self):
        return f"{self.direction} — {self.from_number} → {self.to_number}"


# ─────────────────────────────────────────────────────────────
# STORE WHATSAPP CONFIG — one row per store owner
# ─────────────────────────────────────────────────────────────
class StoreWhatsAppConfig(models.Model):
    """
    A store owner's WhatsApp configuration.
    The platform's Meta credentials are shared; each owner has their
    own WhatsApp number, message template, and notification preferences.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="whatsapp_config",
    )

    # ── Business number ──
    number = models.CharField(max_length=20, blank=True)
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)

    # ── Cart message template ──
    default_template = (
        "Hello {store_name}, I'd like to order:\n"
        "{items}\nTotal: {total}\nMy delivery address: {address}"
    )
    template = models.TextField(default=default_template, blank=True)

    # ── Notification toggles ──
    new_order_alert = models.BooleanField(default=True)
    auto_reply = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_whatsapp_configs"
        verbose_name = "Store WhatsApp config"

    def __str__(self):
        return f"{self.user.email} — {self.number or '(no number)'}"
