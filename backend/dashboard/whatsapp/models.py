"""
WhatsApp Cloud API models.

Identity chain:
    wa_id  →  WhatsAppContact  →  (optional) User
    WhatsAppContact  →  WhatsAppConversation  →  WhatsAppMessage
    WhatsAppContact  →  WhatsAppCartSession  →  (optional) Order
                       ↳  User (optional — see Cart session note below)

Cart session note:
    `WhatsAppCartSession.user` is NULLABLE. Two kinds of sessions exist:

      * Customer-initiated — the customer is logged in and taps
        "Continue with WhatsApp" on the checkout page. `user` is set,
        and the checkout link is delivered to their verified contact.

      * Admin-initiated — a seller in the WhatsApp inbox is talking to
        a walk-in customer who has no account. `user` is NULL, and the
        session is anchored to the `contact` FK instead. This is the
        common case in Kenya, where most social commerce buyers never
        create an account.

    The `contact` FK is the anchor for BOTH cases — it is required and
    is what the WhatsApp message is actually sent to. `user` is
    metadata that becomes populated only when the buyer already has an
    account on the storefront. If `user` is later set (via
    `claim_guest_orders` on login), the session retroactively links to
    the account without any change to the WhatsApp side.
"""
from __future__ import annotations

import uuid

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
# Encrypted field (kept here to avoid an extra file)
# ─────────────────────────────────────────────────────────────────────────────

class EncryptedTextField(models.TextField):
    """
    Fernet-encrypted TextField. Reads FIELD_ENCRYPTION_KEY from settings.

    Generate a key with:
        python -c "from cryptography.fernet import Fernet; \\
                   print(Fernet.generate_key().decode())"
    """

    def _fernet(self) -> Fernet:
        key = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
        if not key:
            raise ImproperlyConfigured(
                "FIELD_ENCRYPTION_KEY is not set. "
                "Generate one with cryptography.fernet.Fernet.generate_key()."
            )
        return Fernet(key.encode() if isinstance(key, str) else key)

    def get_prep_value(self, value):
        if value in (None, ""):
            return value
        return self._fernet().encrypt(str(value).encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        try:
            return self._fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Written with a different key. Return opaque ciphertext so the
            # caller can decide what to do (normally: rotate via a task).
            return value


# ─────────────────────────────────────────────────────────────────────────────
# Account (singleton in practice)
# ─────────────────────────────────────────────────────────────────────────────

class WhatsAppAccount(models.Model):
    """Your WhatsApp Business Account. One active row is expected."""

    waba_id = models.CharField(max_length=64, unique=True)
    phone_number_id = models.CharField(max_length=64, unique=True)
    display_phone = models.CharField(max_length=32, help_text="E.164, digits only")
    business_name = models.CharField(max_length=128, blank=True)

    access_token = EncryptedTextField(blank=True)
    app_secret = EncryptedTextField(blank=True)
    verify_token = models.CharField(max_length=128, blank=True)

    quality_score = models.CharField(
        max_length=16,
        default="GREEN",
        choices=[("GREEN", "Green"), ("YELLOW", "Yellow"), ("RED", "Red")],
    )
    messaging_limit = models.CharField(max_length=32, default="TIER_1K")
    token_expires_at = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Account"
        verbose_name_plural = "WhatsApp Accounts"

    def __str__(self) -> str:
        return f"{self.business_name or 'WhatsApp'} ({self.display_phone})"

    @classmethod
    def get_active(cls) -> "WhatsAppAccount | None":
        return cls.objects.filter(is_active=True).first()


# ─────────────────────────────────────────────────────────────────────────────
# Contacts
# ─────────────────────────────────────────────────────────────────────────────

class WhatsAppContact(models.Model):
    """A phone number we've exchanged messages with."""

    OPT_IN = [("SUBSCRIBED", "Subscribed"), ("UNSUBSCRIBED", "Unsubscribed")]

    wa_id = models.CharField(max_length=32, unique=True, db_index=True,
                             help_text="E.164 digits, no '+' e.g. 254712345678")
    profile_name = models.CharField(max_length=128, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="whatsapp_contacts",
    )
    is_verified = models.BooleanField(default=False)
    opt_in_status = models.CharField(max_length=16, choices=OPT_IN, default="SUBSCRIBED")
    tags = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    last_inbound_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_inbound_at", "-created_at"]
        indexes = [models.Index(fields=["user", "opt_in_status"])]

    def __str__(self) -> str:
        return f"{self.profile_name or self.wa_id} ({self.wa_id})"


# ─────────────────────────────────────────────────────────────────────────────
# Conversations & messages
# ─────────────────────────────────────────────────────────────────────────────

class WhatsAppConversation(models.Model):
    STATUS = [
        ("OPEN", "Open"),
        ("PENDING", "Pending"),
        ("RESOLVED", "Resolved"),
    ]

    contact = models.ForeignKey(
        WhatsAppContact, on_delete=models.CASCADE, related_name="conversations"
    )
    status = models.CharField(max_length=16, choices=STATUS, default="OPEN")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="whatsapp_assignments",
    )
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]

    def __str__(self) -> str:
        return f"Conv #{self.pk} · {self.contact}"

    def is_within_service_window(self) -> bool:
        """True if we may send free-form (non-template) messages."""
        if not self.last_message_at:
            return False
        delta = timezone.now() - self.last_message_at
        return delta.total_seconds() < settings.WHATSAPP_SERVICE_WINDOW_HOURS * 3600


class WhatsAppMessage(models.Model):
    DIRECTION = [("IN", "inbound"), ("OUT", "outbound")]
    STATUS = [
        ("QUEUED", "Queued"),
        ("SENT", "Sent"),
        ("DELIVERED", "Delivered"),
        ("READ", "Read"),
        ("FAILED", "Failed"),
    ]
    TYPE = [
        ("text", "text"),
        ("template", "template"),
        ("interactive", "interactive"),
        ("image", "image"),
        ("document", "document"),
        ("audio", "audio"),
        ("video", "video"),
        ("sticker", "sticker"),
        ("location", "location"),
        ("contacts", "contacts"),
        ("unknown", "unknown"),
    ]

    conversation = models.ForeignKey(
        WhatsAppConversation, on_delete=models.CASCADE, related_name="messages"
    )
    wa_message_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    direction = models.CharField(max_length=3, choices=DIRECTION)
    type = models.CharField(max_length=16, choices=TYPE, default="text")
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=16, choices=STATUS, default="QUEUED")
    error_message = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["conversation", "timestamp"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.direction} {self.type} · {self.timestamp:%Y-%m-%d %H:%M}"


# ─────────────────────────────────────────────────────────────────────────────
# Templates
# ─────────────────────────────────────────────────────────────────────────────

class WhatsAppTemplate(models.Model):
    CATEGORY = [("UTILITY", "Utility"), ("MARKETING", "Marketing"),
                ("AUTHENTICATION", "Authentication")]
    STATUS = [
        ("DRAFT", "Draft"),
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("PAUSED", "Paused"),
    ]
    QUALITY = [("GREEN", "Green"), ("YELLOW", "Yellow"), ("RED", "Red"), ("UNKNOWN", "Unknown")]

    name = models.CharField(max_length=128, db_index=True)
    language = models.CharField(max_length=16, default="en")
    category = models.CharField(max_length=24, choices=CATEGORY, default="UTILITY")
    status = models.CharField(max_length=16, choices=STATUS, default="DRAFT")
    quality = models.CharField(max_length=16, choices=QUALITY, default="UNKNOWN")
    components = models.JSONField(default=list, blank=True)
    meta_template_id = models.CharField(max_length=64, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("name", "language")]
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.language}) · {self.status}"


# ─────────────────────────────────────────────────────────────────────────────
# Cart handoff sessions
# ─────────────────────────────────────────────────────────────────────────────

class WhatsAppCartSession(models.Model):
    STATUS = [
        ("CREATED", "Created"),
        ("SENT", "Sent"),
        ("DELIVERED", "Delivered"),
        ("READ", "Read"),
        ("OPENED", "Opened"),
        ("ORDERED", "Ordered"),
        ("EXPIRED", "Expired"),
        ("FAILED", "Failed"),
    ]
    DELIVERY = [("standard", "Standard"), ("express", "Express"), ("pickup", "Pickup")]

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # `user` is NULLABLE — two kinds of sessions exist:
    #
    #   * Customer-initiated — the buyer is logged in on the storefront
    #     and taps "Continue with WhatsApp". `user` is set. The
    #     checkout link is delivered to their verified contact.
    #
    #   * Admin-initiated — a seller in the WhatsApp inbox is talking
    #     to a walk-in customer who has no account. `user` is NULL,
    #     and the session is anchored to `contact` instead.
    #
    # `contact` is the load-bearing FK for both cases. It is what the
    # WhatsApp message is actually sent to, and it is required. `user`
    # is metadata that fills in only when the buyer already has a
    # storefront account.
    #
    # `on_delete=CASCADE` is retained: if a customer deletes their
    # account, their cart sessions are noise. Sessions with `user=NULL`
    # are unaffected by user deletion (there is no user to cascade
    # from), which is correct — an admin-created session stays valid
    # until it expires or is converted.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,                                  # ── ADDED
        blank=True,                                 # ── ADDED
        on_delete=models.CASCADE,
        related_name="whatsapp_cart_sessions",
    )

    # Required anchor for both customer- and admin-initiated sessions.
    # `PROTECT` (not CASCADE) so deleting a contact never silently
    # orphans a session that may still be awaiting conversion to an
    # order — the admin must explicitly clean up.
    contact = models.ForeignKey(
        WhatsAppContact, on_delete=models.PROTECT,
        related_name="cart_sessions",
    )

    cart_snapshot = models.JSONField(default=dict)
    delivery_method = models.CharField(max_length=16, choices=DELIVERY, default="standard")
    coupon_code = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)

    status = models.CharField(max_length=16, choices=STATUS, default="CREATED")
    wa_message_id = models.CharField(max_length=128, blank=True)
    order = models.ForeignKey(
        "checkout.Order",
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="whatsapp_sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "expires_at"]),
            models.Index(fields=["user", "-created_at"]),        # ── ADDED
            models.Index(fields=["contact", "-created_at"]),     # ── ADDED
        ]

    def __str__(self) -> str:
        return f"CartSession {self.token} · {self.status}"

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_anonymous(self) -> bool:                              # ── ADDED
        """                                                            # ── ADDED
        True when the session was created by an admin on behalf of a     # ── ADDED
        WhatsApp contact with no storefront account.                     # ── ADDED
                                                                          # ── ADDED
        The admin inbox uses this to decide whether the "Convert to     # ── ADDED
        order" button should prompt for a name (anonymous) or           # ── ADDED
        prefill it from the linked User (identified).                    # ── ADDED
        """                                                              # ── ADDED
        return self.user_id is None                                      # ── ADDED