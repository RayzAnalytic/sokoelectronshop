"""
dashboard/settings/admin.py

Admin registration for every settings model.

Layout:

  • Singletons — one ModelAdmin each. All are read-only from the Django
    admin (the store admin edits them through the Settings page, not
    through /admin). This keeps a single source of truth.

  • Credential singletons — read-only. Edits go through the platform
    admin's deploy, never through the Django admin UI. The credential
    fields themselves are excluded from the change form entirely.

  • Child models — full CRUD where it makes sense (zones, providers),
    read-only where it doesn't (logs, submissions, audit trail).

Access model:

  • Config singletons (`GeneralSettings`, `StoreSettings`, …) are
    viewable by any staff user — they're just numeric flags and
    business metadata.
  • Credential singletons (`MpesaConfig`, `WhatsAppConfig`,
    `EtimsConfig`) and every transaction/log/submission/audit model
    are viewable ONLY by superusers. Staff can't see the data even
    read-only.
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


class SuperuserViewOnlyMixin:
    """
    Restrict viewing to superusers.

    Applied to credential singletons and every audit / ledger table —
    M-Pesa transactions, notification payloads, eTIMS submissions,
    the settings change history. Staff users with the `admin` app
    installed would otherwise see this data in read-only mode.

    Combined with `has_add_permission = False` on each subclass, this
    leaves superusers with a browse-only view and everyone else with
    no access at all.
    """

    def has_view_permission(self, request, obj=None):
        return bool(request.user and request.user.is_superuser)

    def has_module_permission(self, request):
        # Hide the whole app block from the sidebar for non-superusers.
        return bool(request.user and request.user.is_superuser)


# ══════════════════════════════════════════════════════════════
# Config singletons — visible to any staff user
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
# Credential singletons — superuser-only, credentials hidden
#
# Each admin:
#   • Inherits SuperuserViewOnlyMixin so only superusers can view.
#   • Excludes the actual secret fields from the change form, so
#     they never render even for a superuser. The safe fields
#     (enabled / environment / shortcode) are what admins need to
#     know "which account is this" without leaking the credentials.
# ══════════════════════════════════════════════════════════════

@admin.register(m.MpesaConfig)
class MpesaConfigAdmin(SuperuserViewOnlyMixin, ReadOnlySingletonAdmin):
    list_display = ("enabled", "environment", "shortcode", "last_rotated_at")
    list_filter = ("enabled", "environment")
    # Never render the credential fields.
    exclude = ("consumer_key", "consumer_secret", "passkey", "callback_url")


@admin.register(m.WhatsAppConfig)
class WhatsAppConfigAdmin(SuperuserViewOnlyMixin, ReadOnlySingletonAdmin):
    list_display = ("phone_number_id", "waba_id", "updated_at")
    # Never render the access token.
    exclude = ("access_token",)


@admin.register(m.EtimsConfig)
class EtimsConfigAdmin(SuperuserViewOnlyMixin, ReadOnlySingletonAdmin):
    list_display = ("kra_pin", "control_unit_id", "device_serial", "updated_at")
    # Never render the raw credentials blob.
    exclude = ("api_credentials",)


# ══════════════════════════════════════════════════════════════
# Multi-row — payments
# ══════════════════════════════════════════════════════════════

@admin.register(m.MpesaTransaction)
class MpesaTxnAdmin(SuperuserViewOnlyMixin, admin.ModelAdmin):
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

    def has_change_permission(self, request, obj=None):
        # Read-only ledger — no inline edits even by superusers.
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — shipping
#
# Providers and zones are the two config tables the store admin
# legitimately edits through the Django admin (until the Settings
# page covers them). Full CRUD is allowed.
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
class NotificationLogAdmin(SuperuserViewOnlyMixin, admin.ModelAdmin):
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

    def has_change_permission(self, request, obj=None):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — security
#
# Login events contain IP addresses and device fingerprints.
# Superuser-only access.
# ══════════════════════════════════════════════════════════════

@admin.register(m.LoginEvent)
class LoginEventAdmin(SuperuserViewOnlyMixin, admin.ModelAdmin):
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

    def has_change_permission(self, request, obj=None):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — tax
# ══════════════════════════════════════════════════════════════

@admin.register(m.EtimsSubmission)
class EtimsSubmissionAdmin(SuperuserViewOnlyMixin, admin.ModelAdmin):
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

    def has_change_permission(self, request, obj=None):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — integrations
#
# The integration status grid is the source of truth for the
# Settings → Integrations page. Django admin is a read-only window
# into it, superuser-only.
# ══════════════════════════════════════════════════════════════

@admin.register(m.IntegrationStatus)
class IntegrationAdmin(SuperuserViewOnlyMixin, admin.ModelAdmin):
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

    def has_change_permission(self, request, obj=None):
        return False


# ══════════════════════════════════════════════════════════════
# Multi-row — audit
#
# Every settings change is logged here. Superuser-only.
# ══════════════════════════════════════════════════════════════

@admin.register(m.SettingsAuditLog)
class AuditAdmin(SuperuserViewOnlyMixin, admin.ModelAdmin):
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

    def has_change_permission(self, request, obj=None):
        return False