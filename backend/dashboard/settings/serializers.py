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

_BLOCKED_INTEGRATION_KEYS = frozenset({
    "twitter", "x", "twitter_x", "twitterx",
    "twilio",
})


class _SingletonSerializer(serializers.ModelSerializer):
    class Meta:
        exclude = ("id", "updated_at")


class _ReadOnlySerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        for field in fields.values():
            field.read_only = True
        return fields


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
    class Meta(_SingletonSerializer.Meta):
        model = TaxSettings


class MpesaStatusSerializer(_ReadOnlySerializer):
    class Meta:
        model = MpesaConfig
        fields = ("enabled", "environment", "shortcode", "last_rotated_at")


class WhatsAppStatusSerializer(_ReadOnlySerializer):
    class Meta:
        model = WhatsAppConfig
        fields = ("phone_number_id", "waba_id", "template_map")


class EtimsStatusSerializer(_ReadOnlySerializer):
    class Meta:
        model = EtimsConfig
        fields = ("kra_pin", "control_unit_id", "device_serial")


class ShippingProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingProvider
        fields = "__all__"
        read_only_fields = ("key",)


class DeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryZone
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")

    def validate_fee_kes(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Delivery fee cannot be negative.")
        return value


class MpesaTransactionSerializer(_ReadOnlySerializer):
    class Meta:
        model = MpesaTransaction
        fields = "__all__"


class NotificationLogSerializer(_ReadOnlySerializer):
    class Meta:
        model = NotificationLog
        fields = "__all__"


class LoginEventSerializer(_ReadOnlySerializer):
    class Meta:
        model = LoginEvent
        fields = "__all__"


class EtimsSubmissionSerializer(_ReadOnlySerializer):
    class Meta:
        model = EtimsSubmission
        fields = "__all__"


class IntegrationStatusSerializer(_ReadOnlySerializer):
    class Meta:
        model = IntegrationStatus
        fields = "__all__"

    def to_representation(self, instance):
        key = (getattr(instance, "key", "") or "").lower()
        if key in _BLOCKED_INTEGRATION_KEYS:
            return None
        return super().to_representation(instance)


class SettingsAuditLogSerializer(_ReadOnlySerializer):
    changed_by_email = serializers.EmailField(
        source="changed_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = SettingsAuditLog
        fields = "__all__"


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )

    def validate_new_password(self, value):
        if value.strip() != value:
            raise serializers.ValidationError(
                "Password cannot start or end with whitespace."
            )
        if value.isdigit():
            raise serializers.ValidationError(
                "Password cannot be all digits."
            )
        return value

    def validate(self, attrs):
        if attrs.get("current_password") == attrs.get("new_password"):
            raise serializers.ValidationError(
                {"new_password": "New password must differ from the current one."}
            )
        return attrs


class TwoFAVerifySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, min_length=6)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Code must be six digits.")
        return value