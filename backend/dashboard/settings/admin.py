"""
dashboard/settings/admin.py

Admin registration for every settings model.

Layout:

  • Singletons — one ModelAdmin each. All are read-only from the Django
    admin (the store admin edits them through the Settings page, not
    through /admin). This keeps a single source of truth.

  • Credential singletons — read-only. Edits go through the platform
    admin's deploy, never through the Django admin UI.

  • Child models — full CRUD where it makes sense (zones, providers),
    read-only where it doesn't (logs, submissions, audit trail).
"""

from django.contrib import admin

from . import models as m


# ══════════════════════════════════════════════════════════════
# Base — read-only singleton admin
# ══════════════════════════════════════════════════════════════

class ReadOnlySingletonAdmin(admin.ModelAdmin):
    """Base for every *Settings singleton.

    The settings page is the UI for editing config. The Django admin
    is only for inspection. This base enforces that: no add, no change,
    no delete.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ══════════════════════════════════════════════════════════════
# Config singletons
# ══════════════════════════════════════════════════════════════

@admin.register(m.GeneralSettings)
class GeneralSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = ("business_name", "currency", "timezone", "updated_at")


@admin.register(m.StoreSettings)
class StoreSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = ("status", "is_indexable", "updated_at")


@admin.register(m.CheckoutSettings)
class CheckoutSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "allow_guest_checkout",
        "require_phone",
        "auto_confirm_orders",
        "whatsapp_fallback",
        "updated_at",
    )


@admin.register(m.InventorySettings)
class InventorySettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "track_inventory",
        "low_stock_threshold",
        "allow_backorders",
        "hide_out_of_stock",
        "updated_at",
    )


@admin.register(m.ReviewSettings)
class ReviewSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "reviews_enabled",
        "require_verified_purchase",
        "auto_publish",
        "allow_photos",
        "updated_at",
    )


@admin.register(m.PaymentSettings)
class PaymentSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "mpesa_enabled",
        "min_amount_kes",
        "max_amount_kes",
        "auto_capture",
        "auto_refund",
        "updated_at",
    )


@admin.register(m.ShippingSettings)
class ShippingSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "shipping_enabled",
        "free_shipping_threshold_kes",
        "default_delivery_fee_kes",
        "local_pickup_enabled",
        "updated_at",
    )


@admin.register(m.NotificationSettings)
class NotificationSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "email_enabled",
        "whatsapp_enabled",
        "notify_on_new_order",
        "notify_on_low_stock",
        "updated_at",
    )


@admin.register(m.SecuritySettings)
class SecuritySettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "session_timeout_minutes",
        "require_2fa",
        "updated_at",
    )


@admin.register(m.TaxSettings)
class TaxSettingsAdmin(ReadOnlySingletonAdmin):
    list_display = (
        "vat_enabled",
        "vat_rate",
        "prices_include_tax",
        "etims_enabled",
        "updated_at",
    )


# ══════════════════════════════════════════════════════════════
# Credential singletons — read-only, credentials never shown
# ══════════════════════════════════════════════════════════════

@admin.register(m.MpesaConfig)
class MpesaConfigAdmin(ReadOnlySingletonAdmin):
    list_display = ("enabled", "environment", "shortcode", "last_rotated_at")

    def has_view_permission(self, request, obj=None):
        # Only superusers can see this row at all — even read-only.
        return request.user.is_superuser


@admin.register(m.WhatsAppConfig)
class WhatsAppConfigAdmin(ReadOnlySingletonAdmin):
    list_display = ("phone_number_id", "waba_id", "updated_at")

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(m.EtimsConfig)
class EtimsConfigAdmin(ReadOnlySingletonAdmin):
    list_display = ("kra_pin", "control_unit_id", "device_serial", "updated_at")

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser


# ══════════════════════════════════════════════════════════════
# Multi-row — payments
# ══════════════════════════════════════════════════════════════

@admin.register(m.MpesaTransaction)
class MpesaTxnAdmin(admin.ModelAdmin):
    list_display = (
        "order_id",
        "amount",
        "phone",
        "status",
        "mpesa_receipt",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "order_id",
        "checkout_request_id",
        "merchant_request_id",
        "mpesa_receipt",
        "phone",
    )
    date_hierarchy = "created_at"
    readonly_fields = (
        "order_id",
        "merchant_request_id",
        "checkout_request_id",
        "amount",
        "phone",
        "status",
        "result_code",
        "result_desc",
        "mpesa_receipt",
        "raw_callback",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — shipping
# ══════════════════════════════════════════════════════════════

@admin.register(m.ShippingProvider)
class ShippingProviderAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "enabled")
    list_filter = ("enabled",)
    search_fields = ("key", "name")
    readonly_fields = ("key",)


@admin.register(m.DeliveryZone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "region",
        "fee_kes",
        "eta_text",
        "enabled",
        "display_order",
    )
    list_filter = ("enabled", "region")
    search_fields = ("name", "region")
    ordering = ("display_order", "name")


# ══════════════════════════════════════════════════════════════
# Multi-row — notifications
# ══════════════════════════════════════════════════════════════

@admin.register(m.NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = (
        "event",
        "channel",
        "recipient",
        "success",
        "created_at",
    )
    list_filter = ("event", "channel", "success")
    search_fields = ("recipient", "order_id", "error")
    date_hierarchy = "created_at"
    readonly_fields = (
        "event",
        "channel",
        "recipient",
        "order_id",
        "success",
        "error",
        "payload",
        "created_at",
    )

    def has_add_permission(self, request):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — security
# ══════════════════════════════════════════════════════════════

@admin.register(m.LoginEvent)
class LoginEventAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "device_label",
        "ip_address",
        "location",
        "created_at",
    )
    list_filter = ("created_at",)
    search_fields = ("user__email", "ip_address", "device_label")
    date_hierarchy = "created_at"
    readonly_fields = (
        "user",
        "ip_address",
        "user_agent",
        "device_label",
        "location",
        "created_at",
    )

    def has_add_permission(self, request):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — tax
# ══════════════════════════════════════════════════════════════

@admin.register(m.EtimsSubmission)
class EtimsSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "order_id",
        "invoice_number",
        "status",
        "submitted_at",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("order_id", "invoice_number")
    date_hierarchy = "created_at"
    readonly_fields = (
        "order_id",
        "invoice_number",
        "submitted_at",
        "status",
        "response",
        "created_at",
    )

    def has_add_permission(self, request):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — integrations
# ══════════════════════════════════════════════════════════════

@admin.register(m.IntegrationStatus)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = (
        "key",
        "name",
        "category",
        "connected",
        "last_checked_at",
    )
    list_filter = ("category", "connected")
    search_fields = ("key", "name", "badge", "description")
    readonly_fields = (
        "key",
        "name",
        "category",
        "connected",
        "badge",
        "description",
        "last_checked_at",
        "last_error",
        "metadata",
    )

    def has_add_permission(self, request):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — audit
# ══════════════════════════════════════════════════════════════

@admin.register(m.SettingsAuditLog)
class AuditAdmin(admin.ModelAdmin):
    list_display = (
        "section",
        "field_name",
        "changed_by",
        "changed_at",
        "ip_address",
    )
    list_filter = ("section", "changed_at")
    search_fields = ("field_name", "before", "after", "changed_by__email")
    date_hierarchy = "changed_at"
    readonly_fields = (
        "section",
        "field_name",
        "before",
        "after",
        "changed_by",
        "changed_at",
        "ip_address",
    )

    def has_add_permission(self, request):
        return False