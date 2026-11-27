from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_business_hours():
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    return {
        d: {"open": "09:00", "close": "18:00", "closed": d in ("saturday", "sunday")}
        for d in days
    }


# ---------------------------------------------------------------------------
# 1. Account, Connection, Health & Alerts
# ---------------------------------------------------------------------------

class WhatsAppAccount(models.Model):
    CONNECTION_STATE_CHOICES = [
        ("connected", "Connected"),
        ("connecting", "Connecting"),
        ("disconnected", "Disconnected"),
        ("expired", "Connection expired"),
        ("action_required", "Action required"),
        ("error", "Error"),
    ]
    SERVICE_STATUS_CHOICES = [
        ("ok", "OK"),
        ("degraded", "Degraded"),
        ("down", "Down"),
    ]

    is_active = models.BooleanField(default=False)
    connection_state = models.CharField(
        max_length=24, choices=CONNECTION_STATE_CHOICES, default="disconnected"
    )
    meta_business_portfolio = models.CharField(max_length=200, blank=True)
    waba_name = models.CharField(max_length=200, blank=True)
    display_phone = models.CharField(max_length=32, blank=True)
    display_name = models.CharField(max_length=120, blank=True)
    business_name = models.CharField(max_length=200, blank=True)
    about = models.TextField(blank=True)
    address = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    vertical = models.CharField(max_length=60, blank=True)
    profile_picture_url = models.URLField(blank=True)

    phone_number_id = models.CharField(max_length=80, blank=True)
    waba_id = models.CharField(max_length=80, blank=True)
    business_id = models.CharField(max_length=80, blank=True)
    phone_verified = models.BooleanField(default=False)

    # Stored server-side only; never serialized to browser responses
    access_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)

    quality_score = models.CharField(max_length=16, blank=True, default="UNKNOWN")
    messaging_limit = models.CharField(max_length=32, blank=True)
    messaging_limit_tier = models.CharField(max_length=32, blank=True)
    verification_status = models.CharField(max_length=32, blank=True)
    review_status = models.CharField(max_length=32, blank=True)
    two_step_pin = models.BooleanField(default=False)
    official_business_account = models.BooleanField(default=False)

    webhook_url = models.URLField(blank=True)
    webhook_verify_token = models.CharField(max_length=120, blank=True)
    webhook_fields = models.JSONField(default=list, blank=True)
    webhook_verified = models.BooleanField(default=False)

    api_status = models.CharField(
        max_length=16, choices=SERVICE_STATUS_CHOICES, default="ok"
    )
    webhook_status = models.CharField(
        max_length=16, choices=SERVICE_STATUS_CHOICES, default="ok"
    )
    last_api_request_at = models.DateTimeField(null=True, blank=True)
    last_webhook_event_at = models.DateTimeField(null=True, blank=True)

    permissions = models.JSONField(default=list, blank=True)  # [{"name": str, "granted": bool}]
    required_action = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    has_catalog = models.BooleanField(default=False)
    quality_history = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Account"
        verbose_name_plural = "WhatsApp Account"

    @classmethod
    def get_solo(cls):
        active = getattr(settings, "WHATSAPP_ENABLED", False)
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                "is_active": active,
                "connection_state": "connected" if active else "disconnected",
                "display_phone": getattr(settings, "WHATSAPP_DISPLAY_PHONE", ""),
                "business_name": getattr(settings, "WHATSAPP_BUSINESS_NAME", ""),
                "phone_number_id": getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", ""),
                "waba_id": getattr(settings, "WHATSAPP_WABA_ID", ""),
                "webhook_verify_token": getattr(settings, "WHATSAPP_VERIFY_TOKEN", ""),
                "webhook_url": getattr(settings, "BACKEND_PUBLIC_URL", "").rstrip("/")
                + getattr(settings, "WHATSAPP_WEBHOOK_PATH", "/api/webhooks/whatsapp/"),
                "webhook_fields": [
                    "messages",
                    "message_template_status_update",
                    "message_template_quality_update",
                    "product_catalog_status_update",
                    "orders",
                    "message_status",
                ],
            },
        )
        # For demo without Meta keys - show as connected
        if getattr(settings, 'WHATSAPP_DRY_RUN', False):
            obj.connection_state = 'connected'
        return obj

    @property
    def token_days_left(self):
        if not self.token_expires_at:
            return None
        return max(0, (self.token_expires_at - timezone.now()).days)

    @property
    def token_status(self):
        if not self.token_expires_at:
            return "ok" if self.connection_state == "connected" else "expired"
        now = timezone.now()
        if self.token_expires_at <= now:
            return "expired"
        if self.token_expires_at <= now + timedelta(days=7):
            return "expiring"
        return "ok"

    @property
    def latest_health_check(self):
        return self.health_checks.order_by("-created_at").first()


class WhatsAppHealthCheck(models.Model):
    CHECK_TYPE_CHOICES = [
        ("api", "API"),
        ("webhook", "Webhook"),
        ("token", "Token"),
    ]
    STATUS_CHOICES = [
        ("ok", "OK"),
        ("degraded", "Degraded"),
        ("down", "Down"),
    ]

    account = models.ForeignKey(
        WhatsAppAccount, on_delete=models.CASCADE, related_name="health_checks"
    )
    check_type = models.CharField(max_length=16, choices=CHECK_TYPE_CHOICES, default="api")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ok")
    ok = models.BooleanField(default=True)
    latency_ms = models.IntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class WhatsAppIntegrationError(models.Model):
    KIND_CHOICES = [
        ("api", "API"),
        ("webhook", "Webhook"),
        ("rate_limit", "Rate limit"),
        ("permission", "Permission"),
        ("sync", "Sync"),
    ]

    account = models.ForeignKey(
        WhatsAppAccount,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="integration_errors",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="api", db_index=True)
    message = models.TextField()
    detail = models.JSONField(default=dict, blank=True)
    resolved = models.BooleanField(default=False, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class WhatsAppAlert(models.Model):
    SEVERITY_CHOICES = [
        ("critical", "Critical"),
        ("warning", "Warning"),
        ("info", "Info"),
    ]

    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="warning")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    resolve_href = models.CharField(max_length=255, default="/whatsapp/analytics?tab=health")
    resolve_label = models.CharField(max_length=80, default="Resolve")
    is_active = models.BooleanField(default=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


# ---------------------------------------------------------------------------
# 2. Commerce Catalogue, Products & Sharing
# ---------------------------------------------------------------------------

class WhatsAppCatalog(models.Model):
    name = models.CharField(max_length=200, default="Main Catalog")
    meta_catalog_id = models.CharField(max_length=80, blank=True)
    connected = models.BooleanField(default=False)
    auto_sync = models.BooleanField(default=True)
    eligibility_rule = models.CharField(max_length=60, default="ALL_PRODUCTS")
    sync_frequency_minutes = models.IntegerField(default=60)
    hide_price = models.BooleanField(default=False)
    default_sort = models.CharField(max_length=32, default="name")
    exclude_out_of_stock = models.BooleanField(default=True)
    required_action = models.TextField(blank=True)
    last_full_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_added = models.IntegerField(default=0)
    last_sync_updated = models.IntegerField(default=0)
    last_sync_failed = models.IntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Catalog"
        verbose_name_plural = "WhatsApp Catalogs"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def item_counts(self):
        qs = self.items.all()
        return {
            "total": qs.count(),
            "eligible": qs.filter(eligible=True).count(),
            "synced": qs.filter(sync_status="synced").count(),
            "pending": qs.filter(sync_status="pending").count(),
            "syncing": qs.filter(sync_status="syncing").count(),
            "failed": qs.filter(sync_status="failed").count(),
            "notEligible": qs.filter(sync_status="not_eligible").count(),
            "unavailable": qs.filter(sync_status="unavailable").count(),
            "archived": qs.filter(sync_status="archived").count(),
            "linked": qs.filter(is_linked=True).count(),
            "unlinked": qs.filter(is_linked=False).count(),
            "inStock": qs.filter(in_stock=True).count(),
            "pinned": qs.filter(pinned=True).count(),
            "removed": qs.filter(is_removed=True).count(),
        }


class WhatsAppCatalogItem(models.Model):
    SYNC_STATUS_CHOICES = [
        ("synced", "Synced"),
        ("pending", "Pending"),
        ("syncing", "Syncing"),
        ("failed", "Failed"),
        ("not_eligible", "Not eligible"),
        ("unavailable", "Unavailable"),
        ("archived", "Archived"),
    ]
    PRODUCT_STATUS_CHOICES = [
        ("active", "Active"),
        ("draft", "Draft"),
        ("archived", "Archived"),
    ]

    catalog = models.ForeignKey(
        WhatsAppCatalog, on_delete=models.CASCADE, related_name="items"
    )
    retailer_id = models.CharField(max_length=120)
    sku = models.CharField(max_length=120, blank=True, db_index=True)
    meta_product_id = models.CharField(max_length=120, blank=True)
    store_product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_items",
    )
    store_category = models.ForeignKey(
        "catalog.Category",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_items",
    )
    store_product_name = models.CharField(max_length=255, blank=True)
    store_product_slug = models.SlugField(max_length=255, blank=True)
    is_linked = models.BooleanField(default=False)
    is_removed = models.BooleanField(default=False)
    is_browsable = models.BooleanField(default=True)
    name = models.CharField(max_length=255)
    display_title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    display_description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    sale_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    currency = models.CharField(max_length=8, default="KES")
    image_url = models.URLField(blank=True)
    custom_image_url = models.URLField(blank=True)
    product_url = models.URLField(blank=True)
    category = models.CharField(max_length=120, blank=True)
    tags = models.JSONField(default=list, blank=True)
    brand = models.CharField(max_length=120, blank=True)
    variations_count = models.IntegerField(default=0)
    in_stock = models.BooleanField(default=True)
    stock_quantity = models.IntegerField(default=0)
    product_status = models.CharField(
        max_length=16, choices=PRODUCT_STATUS_CHOICES, default="active", db_index=True
    )
    eligible = models.BooleanField(default=True)
    pinned = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    hide_price = models.BooleanField(default=False)
    custom_title = models.CharField(max_length=255, blank=True)
    custom_description = models.TextField(blank=True)
    view_count = models.IntegerField(default=0)
    add_to_cart_count = models.IntegerField(default=0)
    removed_at = models.DateTimeField(null=True, blank=True)
    sync_status = models.CharField(
        max_length=16, choices=SYNC_STATUS_CHOICES, default="pending", db_index=True
    )
    review_status = models.CharField(max_length=32, blank=True, null=True)
    rejection_reason = models.TextField(blank=True)
    last_error = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("catalog", "retailer_id")]
        ordering = ["sort_order", "id"]

    @property
    def effective_sku(self):
        return self.sku or self.retailer_id

    @property
    def effective_price(self):
        return self.sale_price if self.sale_price is not None else self.price

    @property
    def display_image_url(self):
        # Return fresh URL from store_product to avoid expired S3 presigned URLs
        # Custom image has priority if not expired
        if self.custom_image_url and "X-Amz-Algorithm" not in self.custom_image_url:
            return self.custom_image_url
        
        # Try to get fresh URL from linked store product
        try:
            if self.store_product:
                imgs = self.store_product.images.all()
                first = imgs.filter(is_primary=True).first() or imgs.first()
                if first and first.image:
                    # This generates fresh presigned URL each time
                    url = first.image.url
                    if url:
                        # Convert to absolute if needed
                        from django.conf import settings
                        if url.startswith('/'):
                            base = getattr(settings, 'MEDIA_URL', '')
                            if base and not base.startswith('http'):
                                site_url = getattr(settings, 'SITE_URL', 'https://sokoelectronshop.onrender.com')
                                url = site_url.rstrip('/') + url
                        return url
                # Fallback to external_url if present
                if first and getattr(first, 'external_url', ''):
                    return first.external_url
        except Exception:
            pass
        
        # Fallback to stored image_url if not expired, else custom, else image_url
        # If image_url contains X-Amz-Algorithm and is expired, try to regenerate
        candidate = self.custom_image_url or self.image_url
        if candidate and "X-Amz-Algorithm" in candidate:
            # Check if expired - if url contains date, try to get fresh from store_product again via direct storage
            try:
                if self.store_product:
                    from catalog.models import ProductImage
                    img = ProductImage.objects.filter(product=self.store_product).first()
                    if img and img.image:
                        return img.image.url
            except Exception:
                pass
        
        return candidate

    @property
    def resolved_display_title(self):
        return self.custom_title or self.display_title or self.name

    @property
    def resolved_display_description(self):
        return self.custom_description or self.display_description or self.description

    @property
    def is_price_hidden(self):
        return self.hide_price or self.catalog.hide_price


class WhatsAppProductShare(models.Model):
    MODE_CHOICES = [
        ("native", "Native product message"),
        ("link", "Website product link"),
    ]
    STATUS_CHOICES = [
        ("prepared", "Prepared for Inbox"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    catalog_item = models.ForeignKey(
        WhatsAppCatalogItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shares",
    )
    store_product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_product_shares",
    )
    product_name = models.CharField(max_length=255)
    conversation = models.ForeignKey(
        "WhatsAppConversation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_shares",
    )
    contact = models.ForeignKey(
        "WhatsAppContact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_shares",
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_product_shares",
    )
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default="native")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="prepared")
    shared_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-shared_at"]


# ---------------------------------------------------------------------------
# 3. Contacts, Consent, Conversations & Inbox Messages
# ---------------------------------------------------------------------------

class WhatsAppContact(models.Model):
    OPT_IN_CHOICES = [
        ("SUBSCRIBED", "Subscribed"),
        ("UNSUBSCRIBED", "Unsubscribed"),
    ]

    wa_id = models.CharField(max_length=32, unique=True)
    profile_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_contacts",
    )
    is_verified = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)
    tags = models.JSONField(default=list, blank=True)
    attributes = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    opt_in_status = models.CharField(
        max_length=16, choices=OPT_IN_CHOICES, default="SUBSCRIBED"
    )
    opt_in_source = models.CharField(max_length=60, blank=True)
    opt_in_at = models.DateTimeField(null=True, blank=True)
    opt_out_at = models.DateTimeField(null=True, blank=True)
    last_inbound_at = models.DateTimeField(null=True, blank=True)
    order_count = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    last_payment_status = models.CharField(max_length=60, blank=True)
    last_delivery_status = models.CharField(max_length=60, blank=True)
    product_affinity = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.profile_name or self.wa_id

    @property
    def marketing_opt_in(self):
        return self.opt_in_status == "SUBSCRIBED" and not self.is_blocked


class WhatsAppConsentLog(models.Model):
    ACTION_CHOICES = [
        ("opt_in", "Opt in"),
        ("opt_out", "Opt out"),
    ]

    contact = models.ForeignKey(
        WhatsAppContact, on_delete=models.CASCADE, related_name="consent_logs"
    )
    action = models.CharField(max_length=16, choices=ACTION_CHOICES, db_index=True)
    source = models.CharField(max_length=80, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-recorded_at"]


class WhatsAppConversation(models.Model):
    STATUS_CHOICES = [
        ("OPEN", "Open"),
        ("PENDING", "Pending"),
        ("RESOLVED", "Resolved"),
        ("ARCHIVED", "Archived"),
    ]
    PRIORITY_CHOICES = [
        ("LOW", "Low"),
        ("NORMAL", "Normal"),
        ("HIGH", "High"),
    ]

    contact = models.ForeignKey(
        WhatsAppContact, on_delete=models.CASCADE, related_name="conversations"
    )
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default="OPEN", db_index=True
    )
    priority = models.CharField(
        max_length=16, choices=PRIORITY_CHOICES, default="NORMAL"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_conversations",
    )
    last_message_preview = models.CharField(max_length=255, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_inbound_at = models.DateTimeField(null=True, blank=True)
    first_message_at = models.DateTimeField(null=True, blank=True)
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    bot_paused = models.BooleanField(default=False)
    starred = models.BooleanField(default=False)
    unread_count = models.IntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)  # exposed as `labels` in Inbox
    sla_first_response_due_at = models.DateTimeField(null=True, blank=True)
    sla_resolution_due_at = models.DateTimeField(null=True, blank=True)
    sla_breached = models.BooleanField(default=False)
    csat = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-id"]

    @property
    def window_open(self):
        if not self.last_inbound_at:
            return False
        hours = getattr(settings, "WHATSAPP_SERVICE_WINDOW_HOURS", 24)
        return timezone.now() < self.last_inbound_at + timedelta(hours=hours)

    @property
    def service_window_expires_at(self):
        if not self.last_inbound_at:
            return None
        hours = getattr(settings, "WHATSAPP_SERVICE_WINDOW_HOURS", 24)
        return self.last_inbound_at + timedelta(hours=hours)

    @property
    def assigned_to_name(self):
        if not self.assigned_to:
            return None
        return self.assigned_to.get_full_name() or self.assigned_to.get_username()


class WhatsAppMessage(models.Model):
    DIRECTION_CHOICES = [("IN", "Inbound"), ("OUT", "Outbound")]
    STATUS_CHOICES = [
        ("SENDING", "Sending"),
        ("QUEUED", "Queued"),
        ("SENT", "Sent"),
        ("DELIVERED", "Delivered"),
        ("READ", "Read"),
        ("FAILED", "Failed"),
    ]

    conversation = models.ForeignKey(
        WhatsAppConversation, on_delete=models.CASCADE, related_name="messages"
    )
    wa_message_id = models.CharField(max_length=120, blank=True, db_index=True)
    direction = models.CharField(max_length=4, choices=DIRECTION_CHOICES, default="OUT")
    type = models.CharField(max_length=32, default="text")
    body = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="QUEUED")
    error_message = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    media_id = models.CharField(max_length=120, blank=True)
    media_url = models.URLField(blank=True, max_length=500)
    mime_type = models.CharField(max_length=120, blank=True)
    filename = models.CharField(max_length=255, blank=True)
    template = models.ForeignKey(
        "WhatsAppTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_messages",
    )
    template_name = models.CharField(max_length=120, blank=True)
    template_params = models.JSONField(default=list, blank=True)
    product_refs = models.JSONField(default=list, blank=True)
    cart_items = models.JSONField(default=list, blank=True)
    interactive_buttons = models.JSONField(default=list, blank=True)
    reply_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies"
    )
    reactions = models.JSONField(default=list, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_messages",
    )
    is_internal_note = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["timestamp", "id"]

    @property
    def author_name(self):
        if not self.author:
            return None
        return self.author.get_full_name() or self.author.get_username()


class WhatsAppMessageAttachment(models.Model):
    KIND_CHOICES = [
        ("image", "Image"),
        ("document", "Document"),
        ("video", "Video"),
        ("audio", "Audio"),
    ]

    message = models.ForeignKey(
        WhatsAppMessage, on_delete=models.CASCADE, related_name="attachments"
    )
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default="document")
    media_id = models.CharField(max_length=120, blank=True)
    url = models.URLField(max_length=500)
    filename = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


# ---------------------------------------------------------------------------
# 4. Templates, Notifications, Automations, Campaigns & Message Logs
# ---------------------------------------------------------------------------

class WhatsAppTemplate(models.Model):
    CATEGORY_CHOICES = [
        ("MARKETING", "Marketing"),
        ("UTILITY", "Utility"),
        ("AUTHENTICATION", "Authentication"),
    ]
    STATUS_CHOICES = [
        ("DRAFT", "Draft"),
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("DISABLED", "Disabled"),
        ("PAUSED", "Paused"),
    ]
    HEADER_TYPE_CHOICES = [
        ("none", "None"),
        ("text", "Text"),
        ("image", "Image"),
        ("document", "Document"),
    ]

    name = models.CharField(max_length=120)
    language = models.CharField(max_length=16, default="en")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="UTILITY")
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default="DRAFT", db_index=True
    )
    quality = models.CharField(max_length=32, blank=True)
    components = models.JSONField(default=list, blank=True)
    header_type = models.CharField(
        max_length=16, choices=HEADER_TYPE_CHOICES, default="none"
    )
    body_text = models.TextField(blank=True)
    footer = models.CharField(max_length=255, blank=True)
    variable_count = models.IntegerField(default=0)
    button_count = models.IntegerField(default=0)
    meta_template_id = models.CharField(max_length=120, blank=True)
    rejection_reason = models.TextField(blank=True)
    attached_catalog_item_ids = models.JSONField(default=list, blank=True)
    has_product_attachment = models.BooleanField(default=False)
    is_paused = models.BooleanField(default=False)
    sent_count = models.IntegerField(default=0)
    delivered_count = models.IntegerField(default=0)
    read_count = models.IntegerField(default=0)
    replied_count = models.IntegerField(default=0)
    version = models.IntegerField(default=1)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("name", "language")]
        ordering = ["-updated_at"]


class WhatsAppNotificationConfig(models.Model):
    EVENT_CHOICES = [
        ("order_created", "Order created"),
        ("payment_confirmed", "Payment confirmed"),
        ("payment_failed", "Payment failed"),
        ("order_processing", "Order processing"),
        ("order_dispatched", "Order dispatched"),
        ("order_delivered", "Order delivered"),
        ("order_cancelled", "Order cancelled"),
        ("refund_processed", "Refund processed"),
    ]
    RESULT_CHOICES = [
        ("success", "Success"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
    ]

    event = models.CharField(max_length=40, choices=EVENT_CHOICES, unique=True)
    label = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    template = models.ForeignKey(
        WhatsAppTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_configs",
    )
    enabled = models.BooleanField(default=False)
    requires_consent = models.BooleanField(default=False)
    requires_verified_state = models.BooleanField(default=True)
    last_executed_at = models.DateTimeField(null=True, blank=True)
    last_result = models.CharField(
        max_length=16, choices=RESULT_CHOICES, null=True, blank=True
    )
    failure_detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]


class WhatsAppAutomation(models.Model):
    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("PAUSED", "Paused"),
        ("DRAFT", "Draft"),
    ]
    TRIGGER_CHOICES = [
        ("order_created", "Order created"),
        ("payment_confirmed", "Payment confirmed"),
        ("order_dispatched", "Order dispatched"),
        ("order_delivered", "Order delivered"),
        ("message_received", "Message received"),
        ("purchase_completed", "Purchase completed"),
    ]
    ACTION_CHOICES = [
        ("send_template", "Send template"),
        ("route_to_inbox", "Route to Inbox"),
    ]
    RUN_RESULT_CHOICES = [
        ("success", "Success"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
    ]

    name = models.CharField(max_length=200)
    trigger = models.CharField(max_length=80, choices=TRIGGER_CHOICES)
    trigger_label = models.CharField(max_length=120, blank=True)
    action = models.CharField(
        max_length=32, choices=ACTION_CHOICES, default="send_template"
    )
    template = models.ForeignKey(
        WhatsAppTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="automations",
    )
    delay_minutes = models.IntegerField(default=0)
    delay_seconds = models.IntegerField(default=0)
    recipients = models.CharField(max_length=120, default="ALL")
    conditions = models.TextField(blank=True)
    conditions_list = models.JSONField(default=list, blank=True)  # list[str]
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="DRAFT")
    steps = models.JSONField(default=list, blank=True)
    messages_sent = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    last_run_result = models.CharField(
        max_length=16, choices=RUN_RESULT_CHOICES, null=True, blank=True
    )
    runs = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    @property
    def enabled(self):
        return self.status == "ACTIVE"


class WhatsAppWorkflowRun(models.Model):
    RESULT_CHOICES = [
        ("success", "Success"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
    ]

    automation = models.ForeignKey(
        WhatsAppAutomation, on_delete=models.CASCADE, related_name="workflow_runs"
    )
    contact = models.ForeignKey(
        WhatsAppContact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="workflow_runs",
    )
    result = models.CharField(max_length=16, choices=RESULT_CHOICES, db_index=True)
    detail = models.TextField(blank=True)
    executed_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-executed_at"]


class WhatsAppSegment(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    rules = models.JSONField(default=list, blank=True)
    cached_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]


class WhatsAppBroadcast(models.Model):
    STATUS_CHOICES = [
        ("DRAFT", "Draft"),
        ("SCHEDULED", "Scheduled"),
        ("RUNNING", "Running"),
        ("SENDING", "Sending"),
        ("PAUSED", "Paused"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
        ("CANCELLED", "Cancelled"),
    ]

    campaign_name = models.CharField(max_length=200)
    objective = models.CharField(max_length=255, blank=True)
    template = models.ForeignKey(
        WhatsAppTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="broadcasts",
    )
    audience = models.CharField(max_length=120, default="ALL")
    audience_label = models.CharField(max_length=160, blank=True)
    audience_rule_ref = models.CharField(max_length=120, blank=True)
    segment = models.ForeignKey(
        WhatsAppSegment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="broadcasts",
    )
    audience_count = models.IntegerField(default=0)
    products = models.ManyToManyField(
        WhatsAppCatalogItem, blank=True, related_name="campaigns"
    )
    attached_catalog_item_ids = models.JSONField(default=list, blank=True)
    has_product_attachment = models.BooleanField(default=False)
    discount_code = models.CharField(max_length=64, blank=True)
    variable_mapping = models.JSONField(default=dict, blank=True)
    ab_test = models.BooleanField(default=False)

    # Metrics (platform + website tracking)
    recipients = models.IntegerField(default=0)  # estimatedRecipients / submitted
    submitted = models.IntegerField(default=0)
    delivered = models.IntegerField(default=0)
    read = models.IntegerField(default=0)
    replied = models.IntegerField(default=0)
    failed = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    visits = models.IntegerField(default=0)
    orders_count = models.IntegerField(default=0)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, default="KES")
    estimated_cost_kes = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    actual_cost_kes = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default="DRAFT", db_index=True
    )
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class WhatsAppMessageLog(models.Model):
    STATUS_CHOICES = [
        ("accepted", "Accepted"),
        ("sent", "Sent"),
        ("delivered", "Delivered"),
        ("read", "Read"),
        ("failed", "Failed"),
    ]
    CATEGORY_CHOICES = [
        ("utility", "Utility"),
        ("marketing", "Marketing"),
        ("authentication", "Authentication"),
    ]

    message = models.ForeignKey(
        WhatsAppMessage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="log_entries",
    )
    wa_message_id = models.CharField(max_length=120, blank=True, db_index=True)
    contact = models.ForeignKey(
        WhatsAppContact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="message_logs",
    )
    recipient = models.CharField(max_length=32, db_index=True)
    customer_name = models.CharField(max_length=255, blank=True)
    template = models.ForeignKey(
        WhatsAppTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="message_logs",
    )
    template_name = models.CharField(max_length=120, blank=True)
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default="utility", db_index=True
    )
    campaign = models.ForeignKey(
        WhatsAppBroadcast,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="message_logs",
    )
    order = models.ForeignKey(
        "checkout.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_message_logs",
    )
    order_reference = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default="accepted", db_index=True
    )
    failure_reason = models.TextField(blank=True)
    sent_at = models.DateTimeField(default=timezone.now, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-sent_at"]


# ---------------------------------------------------------------------------
# 5. Attribution, Messaging Costs & Commerce Orders
# ---------------------------------------------------------------------------

class WhatsAppAttributionEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ("click", "Link click"),
        ("referred_visit", "Referred visit"),
        ("product_page_visit", "Product page visit"),
        ("enquiry", "Enquiry"),
        ("attributed_order", "Attributed order"),
    ]

    event_type = models.CharField(
        max_length=24, choices=EVENT_TYPE_CHOICES, db_index=True
    )
    campaign = models.ForeignKey(
        WhatsAppBroadcast,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attribution_events",
    )
    conversation = models.ForeignKey(
        WhatsAppConversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attribution_events",
    )
    contact = models.ForeignKey(
        WhatsAppContact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attribution_events",
    )
    catalog_item = models.ForeignKey(
        WhatsAppCatalogItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attribution_events",
    )
    order = models.ForeignKey(
        "checkout.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_attribution_events",
    )
    revenue = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00")
    )
    currency = models.CharField(max_length=8, default="KES")
    target_url = models.URLField(blank=True, max_length=500)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-occurred_at"]


class WhatsAppMessagingCost(models.Model):
    CATEGORY_CHOICES = [
        ("utility", "Utility"),
        ("marketing", "Marketing"),
        ("authentication", "Authentication"),
        ("service", "Service"),
    ]

    date = models.DateField(db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    campaign = models.ForeignKey(
        WhatsAppBroadcast,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cost_entries",
    )
    conversation_count = models.IntegerField(default=0)
    cost = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0.0000"))
    currency = models.CharField(max_length=8, default="KES")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]


class WhatsAppOrder(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("CONFIRMED", "Confirmed"),
        ("PAID", "Paid"),
        ("SHIPPED", "Shipped"),
        ("DELIVERED", "Delivered"),
        ("CANCELLED", "Cancelled"),
    ]

    order_number = models.CharField(max_length=64, unique=True)
    contact = models.ForeignKey(
        WhatsAppContact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    contact_name = models.CharField(max_length=255, blank=True)
    contact_wa_id = models.CharField(max_length=32, blank=True)
    conversation = models.ForeignKey(
        WhatsAppConversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    checkout_order = models.ForeignKey(
        "checkout.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_orders",
    )
    items = models.JSONField(default=list, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, default="KES")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    payment_method = models.CharField(max_length=32, blank=True)
    payment_ref = models.CharField(max_length=120, blank=True)
    delivery_address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


# ---------------------------------------------------------------------------
# 6. Webhooks, Billing, Settings, Team, Audit & Notifications
# ---------------------------------------------------------------------------

class WhatsAppWebhookEvent(models.Model):
    STATUS_CHOICES = [
        ("DELIVERED", "Delivered"),
        ("FAILED", "Failed"),
        ("RETRYING", "Retrying"),
    ]

    type = models.CharField(max_length=80)
    event_type = models.CharField(max_length=120, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="DELIVERED")
    attempts = models.IntegerField(default=1)
    signature_valid = models.BooleanField(default=True)
    latency_ms = models.IntegerField(default=0)
    error = models.TextField(blank=True)
    received_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-received_at"]


class WhatsAppInvoice(models.Model):
    STATUS_CHOICES = [("PAID", "Paid"), ("PENDING", "Pending"), ("OVERDUE", "Overdue")]

    period_start = models.DateField()
    period_end = models.DateField()
    amount_kes = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default="KES")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    issued_at = models.DateTimeField(default=timezone.now)
    pdf_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class WhatsAppSettings(models.Model):
    business_hours = models.JSONField(default=default_business_hours, blank=True)
    timezone = models.CharField(max_length=64, default="Africa/Nairobi")
    notifications = models.JSONField(default=dict, blank=True)
    routing = models.CharField(max_length=32, default="ROUND_ROBIN")
    sla_first_response_min = models.IntegerField(default=15)
    sla_resolution_min = models.IntegerField(default=240)
    opt_out_keywords = models.JSONField(default=list, blank=True)
    default_language = models.CharField(max_length=16, default="en")
    csat_enabled = models.BooleanField(default=True)
    data_retention_days = models.IntegerField(default=365)
    welcome_message = models.TextField(blank=True)
    away_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Settings"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                "opt_out_keywords": ["STOP", "UNSUBSCRIBE", "CANCEL"],
                "notifications": {
                    "new_messages": True,
                    "new_orders": True,
                    "template_updates": True,
                    "quality_alerts": True,
                },
            },
        )
        return obj


class WhatsAppTeamMember(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="whatsapp_team_member",
    )
    role = models.CharField(max_length=32, default="AGENT")
    active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class WhatsAppAuditEntry(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="whatsapp_audit",
    )
    actor_name = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=80)
    target = models.CharField(max_length=255, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-timestamp"]


class WhatsAppQuickReply(models.Model):
    shortcut = models.CharField(max_length=60, unique=True)
    title = models.CharField(max_length=120)
    body = models.TextField()
    category = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["shortcut"]


class WhatsAppNotification(models.Model):
    TYPE_CHOICES = [
        ("failed_message", "Failed message"),
        ("sync_failure", "Sync failure"),
        ("template_update", "Template update"),
        ("webhook", "Webhook"),
        ("automation", "Automation"),
        ("campaign", "Campaign"),
        ("message", "Message"),
        ("template", "Template"),
        ("order", "Order"),
        ("system", "System"),
        ("broadcast", "Broadcast"),
        ("quality", "Quality"),
    ]

    type = models.CharField(max_length=24, choices=TYPE_CHOICES, default="system")
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    link_tab = models.CharField(max_length=40, blank=True)
    read = models.BooleanField(default=False, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp"]


# ---------------------------------------------------------------------------
# 7. Bot Flows (Existing)
# ---------------------------------------------------------------------------

class WhatsAppBotFlow(models.Model):
    name = models.CharField(max_length=200, default="Main Flow")
    is_published = models.BooleanField(default=False)
    entry_node_key = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class WhatsAppBotNode(models.Model):
    KIND_CHOICES = [
        ("message", "Message"),
        ("list", "List"),
        ("products", "Products"),
        ("product_detail", "Product Detail"),
        ("cart", "Cart"),
        ("condition", "Condition"),
        ("collect", "Collect"),
        ("handoff", "Handoff"),
        ("end", "End"),
    ]

    flow = models.ForeignKey(
        WhatsAppBotFlow, on_delete=models.CASCADE, related_name="nodes"
    )
    key = models.CharField(max_length=80)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="message")
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(blank=True)
    options = models.JSONField(default=list, blank=True)
    config = models.JSONField(default=dict, blank=True)
    position = models.JSONField(default=dict, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        unique_together = [("flow", "key")]
        ordering = ["order", "id"]