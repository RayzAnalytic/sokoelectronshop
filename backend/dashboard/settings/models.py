from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction

_BLOCKED_INTEGRATION_KEYS = {
    "twitter", "x", "twitter_x", "twitterx", "twilio",
}


class SingletonModel(models.Model):
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "updated_at" not in update_fields:
            kwargs["update_fields"] = list(update_fields) + ["updated_at"]
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        try:
            return cls.objects.get(pk=1)
        except cls.DoesNotExist:
            try:
                with transaction.atomic():
                    return cls.objects.create(pk=1)
            except IntegrityError:
                return cls.objects.get(pk=1)


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

    class Meta:
        verbose_name = "General settings"
        verbose_name_plural = "General settings"


class StoreSettings(SingletonModel):
    STATUS = [('open', 'Open'), ('closed', 'Closed'), ('paused', 'Paused')]

    status         = models.CharField(max_length=10, choices=STATUS, default='open')
    is_indexable   = models.BooleanField(default=True)
    paused_message = models.TextField(blank=True)

    class Meta:
        verbose_name = "Store settings"
        verbose_name_plural = "Store settings"


class CheckoutSettings(SingletonModel):
    allow_guest_checkout = models.BooleanField(default=True)
    require_phone        = models.BooleanField(default=True)
    auto_confirm_orders  = models.BooleanField(default=False)
    whatsapp_fallback    = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Checkout settings"
        verbose_name_plural = "Checkout settings"


class InventorySettings(SingletonModel):
    track_inventory     = models.BooleanField(default=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    allow_backorders    = models.BooleanField(default=False)
    hide_out_of_stock   = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Inventory settings"
        verbose_name_plural = "Inventory settings"


class ReviewSettings(SingletonModel):
    reviews_enabled           = models.BooleanField(default=True)
    require_verified_purchase = models.BooleanField(default=True)
    auto_publish              = models.BooleanField(default=False)
    allow_photos              = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Review settings"
        verbose_name_plural = "Review settings"


class PaymentSettings(SingletonModel):
    mpesa_enabled       = models.BooleanField(default=True)
    min_amount_kes      = models.DecimalField(max_digits=10, decimal_places=2, default=100)
    max_amount_kes      = models.DecimalField(max_digits=10, decimal_places=2, default=500000)
    transaction_fee_kes = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    auto_capture        = models.BooleanField(default=True)
    auto_refund         = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Payment settings"
        verbose_name_plural = "Payment settings"


class MpesaConfig(SingletonModel):
    ENV = [('sandbox', 'Sandbox'), ('production', 'Production')]

    enabled         = models.BooleanField(default=True)
    environment     = models.CharField(max_length=16, choices=ENV, default='sandbox')
    consumer_key    = models.TextField(blank=True)
    consumer_secret = models.TextField(blank=True)
    shortcode       = models.CharField(max_length=16, blank=True)
    passkey         = models.TextField(blank=True)
    callback_url    = models.URLField(blank=True)
    last_rotated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "M-Pesa configuration"
        verbose_name_plural = "M-Pesa configuration"


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
        verbose_name = "M-Pesa transaction"
        verbose_name_plural = "M-Pesa transactions"


class ShippingSettings(SingletonModel):
    shipping_enabled            = models.BooleanField(default=True)
    free_shipping_threshold_kes = models.DecimalField(max_digits=10, decimal_places=2, default=5000)
    default_delivery_fee_kes    = models.DecimalField(max_digits=10, decimal_places=2, default=250)
    local_pickup_enabled        = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Shipping settings"
        verbose_name_plural = "Shipping settings"


class ShippingProvider(models.Model):
    KEY = [
        ('g4s', 'G4S Kenya'), ('fargo', 'Fargo Courier'),
        ('sendy', 'Sendy'), ('riders', 'SokoFlow Riders'),
    ]

    key         = models.CharField(max_length=16, choices=KEY, unique=True)
    name        = models.CharField(max_length=64)
    enabled     = models.BooleanField(default=False)
    credentials = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Shipping provider"
        verbose_name_plural = "Shipping providers"

    def __str__(self):
        return self.name


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
        verbose_name = "Delivery zone"
        verbose_name_plural = "Delivery zones"

    def __str__(self):
        return f"{self.name} ({self.region})"


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

    class Meta:
        verbose_name = "Notification settings"
        verbose_name_plural = "Notification settings"


class WhatsAppConfig(SingletonModel):
    phone_number_id = models.CharField(max_length=64, blank=True)
    waba_id         = models.CharField(max_length=64, blank=True)
    access_token    = models.TextField(blank=True)
    template_map    = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "WhatsApp configuration"
        verbose_name_plural = "WhatsApp configuration"


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
        verbose_name = "Notification log"
        verbose_name_plural = "Notification logs"


class SecuritySettings(SingletonModel):
    session_timeout_minutes = models.PositiveIntegerField(default=60)
    require_2fa             = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Security settings"
        verbose_name_plural = "Security settings"


class LoginEvent(models.Model):
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='login_events',
    )
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    user_agent   = models.TextField(blank=True)
    device_label = models.CharField(max_length=128, blank=True)
    location     = models.CharField(max_length=128, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Login event"
        verbose_name_plural = "Login events"

    def __str__(self):
        return f"{self.user} @ {self.created_at:%Y-%m-%d %H:%M}"


class TaxSettings(SingletonModel):
    vat_enabled        = models.BooleanField(default=True)
    vat_rate           = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    prices_include_tax = models.BooleanField(default=True)
    etims_enabled      = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Tax settings"
        verbose_name_plural = "Tax settings"


class EtimsConfig(SingletonModel):
    kra_pin         = models.CharField(max_length=16, blank=True)
    control_unit_id = models.CharField(max_length=32, blank=True)
    device_serial   = models.CharField(max_length=32, blank=True)
    api_credentials = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "eTIMS configuration"
        verbose_name_plural = "eTIMS configuration"


class EtimsSubmission(models.Model):
    STATUS = [('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')]

    order_id       = models.CharField(max_length=64, db_index=True)
    invoice_number = models.CharField(max_length=64, blank=True)
    submitted_at   = models.DateTimeField(null=True, blank=True)
    status         = models.CharField(max_length=16, choices=STATUS, default='pending')
    response       = models.JSONField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "eTIMS submission"
        verbose_name_plural = "eTIMS submissions"


class IntegrationStatus(models.Model):
    CATEGORY = [
        ('Payments', 'Payments'), ('Messaging', 'Messaging'),
        ('Social app', 'Social app'), ('Social', 'Social'),
        ('Analytics', 'Analytics'),
    ]

    key             = models.CharField(max_length=64, unique=True)
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
        verbose_name = "Integration status"
        verbose_name_plural = "Integration statuses"

    def __str__(self):
        return f"{self.name} ({self.category})"

    def clean(self):
        super().clean()
        if self.key and self.key.lower() in _BLOCKED_INTEGRATION_KEYS:
            raise ValidationError(
                {
                    "key": (
                        f"'{self.key}' is blocked — Twitter/X and SMS "
                        f"gateways are not supported on this platform."
                    )
                }
            )


class SettingsAuditLog(models.Model):
    section    = models.CharField(max_length=64, db_index=True)
    field_name = models.CharField(max_length=64)
    before     = models.TextField(blank=True)
    after      = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
    )
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-changed_at']
        verbose_name = "Settings audit log entry"
        verbose_name_plural = "Settings audit log"