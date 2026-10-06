from django.conf import settings
from django.db import models


# ══════════════════════════════════════════════════════════════
# Base
# ══════════════════════════════════════════════════════════════

class SingletonModel(models.Model):
    """True singleton — always pk=1."""
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ══════════════════════════════════════════════════════════════
# General
# ══════════════════════════════════════════════════════════════

class GeneralSettings(SingletonModel):
    CURRENCY = [('KES', 'Kenyan Shilling'), ('USD', 'US Dollar'), ('EUR', 'Euro')]
    TZ       = [('Africa/Nairobi', 'Africa/Nairobi'), ('UTC', 'UTC')]
    DATE_FMT = [('DD/MM/YYYY', 'DD/MM/YYYY'), ('MM/DD/YYYY', 'MM/DD/YYYY'), ('YYYY-MM-DD', 'ISO')]
    WEIGHT   = [('kg', 'Kilogram'), ('g', 'Gram'), ('lb', 'Pound')]

    business_name = models.CharField(max_length=200, default='SokoFlow Commerce')
    tagline       = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    address       = models.TextField(blank=True)
    currency      = models.CharField(max_length=3, choices=CURRENCY, default='KES')
    timezone      = models.CharField(max_length=64, choices=TZ, default='Africa/Nairobi')
    date_format   = models.CharField(max_length=16, choices=DATE_FMT, default='DD/MM/YYYY')
    weight_unit   = models.CharField(max_length=4, choices=WEIGHT, default='kg')


# ══════════════════════════════════════════════════════════════
# Store / Checkout / Inventory / Reviews
# ══════════════════════════════════════════════════════════════

class StoreSettings(SingletonModel):
    STATUS = [('open', 'Open'), ('closed', 'Closed'), ('paused', 'Paused')]

    status         = models.CharField(max_length=10, choices=STATUS, default='open')
    is_indexable   = models.BooleanField(default=True)
    paused_message = models.TextField(blank=True)


class CheckoutSettings(SingletonModel):
    allow_guest_checkout = models.BooleanField(default=True)
    require_phone        = models.BooleanField(default=True)
    auto_confirm_orders  = models.BooleanField(default=False)
    whatsapp_fallback    = models.BooleanField(default=True)


class InventorySettings(SingletonModel):
    track_inventory     = models.BooleanField(default=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    allow_backorders    = models.BooleanField(default=False)
    hide_out_of_stock   = models.BooleanField(default=False)


class ReviewSettings(SingletonModel):
    reviews_enabled           = models.BooleanField(default=True)
    require_verified_purchase = models.BooleanField(default=True)
    auto_publish              = models.BooleanField(default=False)
    allow_photos              = models.BooleanField(default=True)


# ══════════════════════════════════════════════════════════════
# Payments
# ══════════════════════════════════════════════════════════════

class PaymentSettings(SingletonModel):
    mpesa_enabled       = models.BooleanField(default=True)
    min_amount_kes      = models.DecimalField(max_digits=10, decimal_places=2, default=100)
    max_amount_kes      = models.DecimalField(max_digits=10, decimal_places=2, default=500000)
    transaction_fee_kes = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    auto_capture        = models.BooleanField(default=True)
    auto_refund         = models.BooleanField(default=True)


class MpesaConfig(SingletonModel):
    """Admin-only. Never exposed via API. Encrypt credentials at rest."""
    ENV = [('sandbox', 'Sandbox'), ('production', 'Production')]

    enabled         = models.BooleanField(default=True)
    environment     = models.CharField(max_length=16, choices=ENV, default='sandbox')
    consumer_key    = models.TextField(blank=True)
    consumer_secret = models.TextField(blank=True)
    shortcode       = models.CharField(max_length=16, blank=True)
    passkey         = models.TextField(blank=True)
    callback_url    = models.URLField(blank=True)
    last_rotated_at = models.DateTimeField(null=True, blank=True)


class MpesaTransaction(models.Model):
    STATUS = [
        ('pending', 'Pending'), ('success', 'Success'),
        ('failed', 'Failed'), ('timeout', 'Timeout'), ('refunded', 'Refunded'),
    ]

    order_id            = models.CharField(max_length=64, db_index=True, blank=True)
    merchant_request_id = models.CharField(max_length=64, blank=True, db_index=True)
    checkout_request_id = models.CharField(max_length=64, blank=True, db_index=True)
    amount              = models.DecimalField(max_digits=12, decimal_places=2)
    phone               = models.CharField(max_length=16)
    status              = models.CharField(max_length=16, choices=STATUS, default='pending')
    result_code         = models.CharField(max_length=8, blank=True)
    result_desc         = models.TextField(blank=True)
    mpesa_receipt       = models.CharField(max_length=32, blank=True)
    raw_callback        = models.JSONField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['order_id', 'status'])]


# ══════════════════════════════════════════════════════════════
# Shipping
# ══════════════════════════════════════════════════════════════

class ShippingSettings(SingletonModel):
    shipping_enabled            = models.BooleanField(default=True)
    free_shipping_threshold_kes = models.DecimalField(max_digits=10, decimal_places=2, default=5000)
    default_delivery_fee_kes    = models.DecimalField(max_digits=10, decimal_places=2, default=250)
    local_pickup_enabled        = models.BooleanField(default=True)


class ShippingProvider(models.Model):
    KEY = [
        ('g4s', 'G4S Kenya'), ('fargo', 'Fargo Courier'),
        ('sendy', 'Sendy'), ('riders', 'SokoFlow Riders'),
    ]

    key         = models.CharField(max_length=16, choices=KEY, unique=True)
    name        = models.CharField(max_length=64)
    enabled     = models.BooleanField(default=False)
    credentials = models.JSONField(default=dict, blank=True)


class DeliveryZone(models.Model):
    name          = models.CharField(max_length=128)
    region        = models.CharField(max_length=128)
    fee_kes       = models.DecimalField(max_digits=10, decimal_places=2)
    eta_text      = models.CharField(max_length=64)
    enabled       = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'name']


# ══════════════════════════════════════════════════════════════
# Notifications
# ══════════════════════════════════════════════════════════════

class NotificationSettings(SingletonModel):
    email_enabled    = models.BooleanField(default=True)
    whatsapp_enabled = models.BooleanField(default=True)

    notify_on_new_order = models.BooleanField(default=True)
    notify_on_payment   = models.BooleanField(default=True)
    notify_on_shipped   = models.BooleanField(default=True)
    notify_on_cancelled = models.BooleanField(default=True)
    notify_on_low_stock = models.BooleanField(default=True)
    notify_on_review    = models.BooleanField(default=False)

    admin_alert_email = models.EmailField(blank=True)


class WhatsAppConfig(SingletonModel):
    phone_number_id = models.CharField(max_length=64, blank=True)
    waba_id         = models.CharField(max_length=64, blank=True)
    access_token    = models.TextField(blank=True)          # encrypt at rest
    template_map    = models.JSONField(default=dict, blank=True)


class NotificationLog(models.Model):
    CHANNEL = [('email', 'Email'), ('whatsapp', 'WhatsApp')]

    event      = models.CharField(max_length=64, db_index=True)
    channel    = models.CharField(max_length=16, choices=CHANNEL)
    recipient  = models.CharField(max_length=255)
    order_id   = models.CharField(max_length=64, blank=True, db_index=True)
    success    = models.BooleanField(default=False)
    error      = models.TextField(blank=True)
    payload    = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


# ══════════════════════════════════════════════════════════════
# Security
# ══════════════════════════════════════════════════════════════

class SecuritySettings(SingletonModel):
    session_timeout_minutes = models.PositiveIntegerField(default=60)
    require_2fa             = models.BooleanField(default=True)


class LoginEvent(models.Model):
    user         = models.ForeignKey(settings.AUTH_USER_MODEL,
                                     on_delete=models.CASCADE,
                                     related_name='login_events')
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    user_agent   = models.TextField(blank=True)
    device_label = models.CharField(max_length=128, blank=True)
    location     = models.CharField(max_length=128, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


# ══════════════════════════════════════════════════════════════
# Tax
# ══════════════════════════════════════════════════════════════

class TaxSettings(SingletonModel):
    vat_enabled        = models.BooleanField(default=True)
    vat_rate           = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    prices_include_tax = models.BooleanField(default=True)
    etims_enabled      = models.BooleanField(default=True)


class EtimsConfig(SingletonModel):
    kra_pin         = models.CharField(max_length=16, blank=True)
    control_unit_id = models.CharField(max_length=32, blank=True)
    device_serial   = models.CharField(max_length=32, blank=True)
    api_credentials = models.JSONField(default=dict, blank=True)


class EtimsSubmission(models.Model):
    STATUS = [('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')]

    order_id       = models.CharField(max_length=64, db_index=True)
    invoice_number = models.CharField(max_length=64, blank=True)
    submitted_at   = models.DateTimeField(null=True, blank=True)
    status         = models.CharField(max_length=16, choices=STATUS, default='pending')
    response       = models.JSONField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)


# ══════════════════════════════════════════════════════════════
# Integrations (read-only status)
# ══════════════════════════════════════════════════════════════

class IntegrationStatus(models.Model):
    CATEGORY = [
        ('Payments', 'Payments'), ('Messaging', 'Messaging'),
        ('Social app', 'Social app'), ('Social', 'Social'),
        ('Analytics', 'Analytics'),
    ]

    key             = models.CharField(max_length=32, unique=True)
    name            = models.CharField(max_length=128)
    category        = models.CharField(max_length=16, choices=CATEGORY)
    connected       = models.BooleanField(default=False)
    badge           = models.CharField(max_length=128, blank=True)
    description     = models.TextField(blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_error      = models.TextField(blank=True)
    metadata        = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['category', 'name']


# ══════════════════════════════════════════════════════════════
# Audit
# ══════════════════════════════════════════════════════════════

class SettingsAuditLog(models.Model):
    section    = models.CharField(max_length=64, db_index=True)
    field_name = models.CharField(max_length=64)
    before     = models.TextField(blank=True)
    after      = models.TextField(blank=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL,
                                   null=True, on_delete=models.SET_NULL)
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-changed_at']