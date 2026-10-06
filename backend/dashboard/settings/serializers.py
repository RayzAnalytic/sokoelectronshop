"""
dashboard/settings/serializers.py

Serializers for the singleton and multi-row models that back the
Settings page.

Three families:

  • Singletons — every *Settings config model. All inherit from
    `_SingletonSerializer` so they share the same exclude list.

  • Multi-row — providers, zones, transactions, logs, submissions,
    integration status, audit log. One serializer each.

  • Read-only — anything the store admin can't write. These inherit
    from `_ReadOnlySerializer`, which marks every field read-only in
    `get_fields()` so we never have to keep `read_only_fields` in sync
    with `fields`. (Doing `read_only_fields = fields` breaks when
    `fields = "__all__"` because `fields` then resolves to the string
    `"__all__"` rather than a tuple.)

Credential singletons (MpesaConfig, WhatsAppConfig, EtimsConfig) have
dedicated *Status* serializers that expose only safe fields.
"""

from rest_framework import serializers

from .models import (
    GeneralSettings, StoreSettings, CheckoutSettings, InventorySettings,
    ReviewSettings, PaymentSettings, MpesaConfig, MpesaTransaction,
    ShippingSettings, ShippingProvider, DeliveryZone,
    NotificationSettings, WhatsAppConfig, NotificationLog,
    SecuritySettings, LoginEvent,
    TaxSettings, EtimsConfig, EtimsSubmission,
    IntegrationStatus, SettingsAuditLog,
)


# ══════════════════════════════════════════════════════════════
# Base serializers
# ══════════════════════════════════════════════════════════════

class _SingletonSerializer(serializers.ModelSerializer):
    """Base for every singleton config serializer.

    Excludes the auto-managed `id` and `updated_at` fields — the
    frontend never sends them, and the client shouldn't see them.
    """

    class Meta:
        exclude = ("id", "updated_at")


class _ReadOnlySerializer(serializers.ModelSerializer):
    """Base for every read-only serializer.

    Marks each field read-only at build time. This is the correct way
    to express "everything is read-only" — `read_only_fields = fields`
    only works when `fields` is an explicit tuple/list, and silently
    misbehaves when `fields = "__all__"` (the RHS resolves to the
    string `"__all__"`, which DRF rejects).
    """

    def get_fields(self):
        fields = super().get_fields()
        for field in fields.values():
            field.read_only = True
        return fields


# ══════════════════════════════════════════════════════════════
# Config singletons
# ══════════════════════════════════════════════════════════════

class GeneralSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = GeneralSettings


class StoreSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = StoreSettings


class CheckoutSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = CheckoutSettings


class InventorySerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = InventorySettings


class ReviewSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = ReviewSettings


class PaymentSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = PaymentSettings


class ShippingSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = ShippingSettings


class NotificationSerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = NotificationSettings


class SecuritySerializer(_SingletonSerializer):
    class Meta(_SingletonSerializer.Meta):
        model = SecuritySettings


class TaxSerializer(_SingletonSerializer):
    """VAT config.

    `vat_rate` is a DecimalField on the model. The frontend sends it as
    a plain string ("16", "16.5"). DRF's DecimalField accepts strings
    out of the box, so no custom field is needed.
    """

    class Meta(_SingletonSerializer.Meta):
        model = TaxSettings


# ══════════════════════════════════════════════════════════════
# Credential singletons — status-only, never expose secrets
# ══════════════════════════════════════════════════════════════

class MpesaStatusSerializer(_ReadOnlySerializer):
    """Read-only view of M-Pesa credentials.

    Exposes only the fields the Settings UI needs to display. Consumer
    key, secret, and passkey are never returned.
    """

    class Meta:
        model = MpesaConfig
        fields = ("enabled", "environment", "shortcode", "last_rotated_at")


class WhatsAppStatusSerializer(_ReadOnlySerializer):
    """Read-only view of WhatsApp credentials.

    The access token is never returned. The frontend uses this only to
    show which number is connected and which templates are approved.
    """

    class Meta:
        model = WhatsAppConfig
        fields = ("phone_number_id", "waba_id", "template_map")


class EtimsStatusSerializer(_ReadOnlySerializer):
    """Read-only view of eTIMS credentials.

    API credentials are never returned. The Settings UI shows the KRA
    PIN and control unit so the admin knows which taxpayer this store
    is filing under.
    """

    class Meta:
        model = EtimsConfig
        fields = ("kra_pin", "control_unit_id", "device_serial")


# ══════════════════════════════════════════════════════════════
# Multi-row: Shipping
# ══════════════════════════════════════════════════════════════

class ShippingProviderSerializer(serializers.ModelSerializer):
    """One row per courier (G4S / Fargo / Sendy / Riders).

    `key` is a unique choice field — write it once at seed time and
    never again. `credentials` holds API keys; it's write-only from the
    frontend's perspective (list responses still return it, but the
    Settings page never displays it).
    """

    class Meta:
        model = ShippingProvider
        fields = "__all__"
        read_only_fields = ("key",)


class DeliveryZoneSerializer(serializers.ModelSerializer):
    """Region-by-region delivery rates.

    `display_order` is writable so the admin can control the order
    zones appear in on the storefront. When it's not supplied, the
    view falls back to appending (max + 1).
    """

    class Meta:
        model = DeliveryZone
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")

    def validate_fee_kes(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Delivery fee cannot be negative.")
        return value


# ══════════════════════════════════════════════════════════════
# Multi-row: Payments
# ══════════════════════════════════════════════════════════════

class MpesaTransactionSerializer(_ReadOnlySerializer):
    """Read-only ledger of every M-Pesa attempt.

    `raw_callback` is exposed because the Transactions page renders it
    as a collapsible JSON block for reconciliation. If you ever want to
    hide it, drop it from `fields`.
    """

    class Meta:
        model = MpesaTransaction
        fields = "__all__"


# ══════════════════════════════════════════════════════════════
# Multi-row: Notifications
# ══════════════════════════════════════════════════════════════

class NotificationLogSerializer(_ReadOnlySerializer):
    """Read-only audit of every email / WhatsApp message sent."""

    class Meta:
        model = NotificationLog
        fields = "__all__"


# ══════════════════════════════════════════════════════════════
# Multi-row: Security
# ══════════════════════════════════════════════════════════════

class LoginEventSerializer(_ReadOnlySerializer):
    """Read-only history of login events for the current admin."""

    class Meta:
        model = LoginEvent
        fields = "__all__"


# ══════════════════════════════════════════════════════════════
# Multi-row: Tax
# ══════════════════════════════════════════════════════════════

class EtimsSubmissionSerializer(_ReadOnlySerializer):
    """Read-only list of KRA eTIMS submissions."""

    class Meta:
        model = EtimsSubmission
        fields = "__all__"


# ══════════════════════════════════════════════════════════════
# Multi-row: Integrations
# ══════════════════════════════════════════════════════════════

class IntegrationStatusSerializer(_ReadOnlySerializer):
    """Read-only connection grid shown on Settings → Integrations.

    Every field is read-only — connections are managed by the platform
    administrator, not by the store admin.
    """

    class Meta:
        model = IntegrationStatus
        fields = "__all__"


# ══════════════════════════════════════════════════════════════
# Multi-row: Audit
# ══════════════════════════════════════════════════════════════

class SettingsAuditLogSerializer(_ReadOnlySerializer):
    """Read-only record of every settings change.

    `changed_by_email` is denormalized from the FK so the frontend
    doesn't need a second lookup to render "changed by Alice
    <alice@shop.co.ke>".
    """

    changed_by_email = serializers.EmailField(
        source="changed_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = SettingsAuditLog
        fields = "__all__"


# ══════════════════════════════════════════════════════════════
# Auth payloads
# ══════════════════════════════════════════════════════════════

class ChangePasswordSerializer(serializers.Serializer):
    """Payload for POST /security/password/.

    The view is responsible for verifying `current_password` against
    the authenticated user. This serializer only enforces shape.
    """

    current_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )

    def validate_new_password(self, value: str) -> str:
        if value.strip() != value:
            raise serializers.ValidationError(
                "Password cannot start or end with whitespace."
            )
        if value.isdigit():
            raise serializers.ValidationError(
                "Password cannot be all digits."
            )
        return value


class TwoFAVerifySerializer(serializers.Serializer):
    """Payload for POST /security/2fa/verify/.

    Six-digit TOTP code, digits only.
    """

    code = serializers.CharField(max_length=6, min_length=6)

    def validate_code(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError("Code must be six digits.")
        return value