# whatsapp/serializers.py

from rest_framework import serializers

from .models import StoreWhatsAppConfig, WhatsAppMessage


# ─────────────────────────────────────────────────────────────
# WHATSAPP MESSAGE — READ
# ─────────────────────────────────────────────────────────────
class WhatsAppMessageSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for WhatsApp message history.
    Used by:
      GET /api/whatsapp/messages/
      GET /api/whatsapp/messages/<uuid:id>/
    """
    direction_display = serializers.CharField(
        source="get_direction_display",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = WhatsAppMessage
        fields = [
            "id",
            "wa_message_id",
            "direction",
            "direction_display",
            "from_number",
            "to_number",
            "body",
            "status",
            "status_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────
# WHATSAPP — SEND TEXT (outbound)
# ─────────────────────────────────────────────────────────────
class WhatsAppSendSerializer(serializers.Serializer):
    """
    Payload for POST /api/whatsapp/send/

    Free-form text is only allowed within 24 hours of the customer's
    last message. Outside that window, use a template.
    """
    to = serializers.CharField(
        max_length=20,
        help_text="Recipient in E.164 format, e.g. +254712345678",
    )
    text = serializers.CharField(
        max_length=4096,
        help_text="Message body (max 4096 characters per WhatsApp)",
    )

    def validate_to(self, value):
        """Normalize to E.164 without spaces/dashes."""
        v = value.replace(" ", "").replace("-", "").strip()
        if not v.startswith("+"):
            raise serializers.ValidationError(
                "Phone number must start with + and the country code."
            )
        digits = v.replace("+", "")
        if not digits.isdigit() or len(digits) < 10:
            raise serializers.ValidationError("Enter a valid phone number.")
        return v

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Message body cannot be empty.")
        return value


# ─────────────────────────────────────────────────────────────
# WHATSAPP — SEND TEMPLATE (outbound, outside 24h window)
# ─────────────────────────────────────────────────────────────
class WhatsAppTemplateComponentSerializer(serializers.Serializer):
    """
    A single component inside a template message.
    Common shapes:
      {"type": "body", "parameters": [{"type": "text", "text": "..."}]}
      {"type": "header", "parameters": [{"type": "image", "image": {"link": "..."}}]}
      {"type": "button", "sub_type": "url", "index": "0", "parameters": [...]}
    """
    type = serializers.ChoiceField(choices=["header", "body", "button"])
    parameters = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
        required=False,
        default=list,
    )
    sub_type = serializers.CharField(required=False, allow_blank=True)
    index = serializers.CharField(required=False, allow_blank=True)


class WhatsAppSendTemplateSerializer(serializers.Serializer):
    """
    Payload for POST /api/whatsapp/send/ with `template_name`.

    Templates must be pre-approved in the Meta Business dashboard.
    """
    to = serializers.CharField(max_length=20)
    template_name = serializers.CharField(max_length=100)
    language = serializers.CharField(max_length=10, default="en_US")
    components = WhatsAppTemplateComponentSerializer(
        many=True,
        required=False,
        default=list,
    )

    def validate_to(self, value):
        v = value.replace(" ", "").replace("-", "").strip()
        if not v.startswith("+"):
            raise serializers.ValidationError(
                "Phone number must start with + and the country code."
            )
        return v

    def validate_template_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Template name is required.")
        return value


# ─────────────────────────────────────────────────────────────
# STORE WHATSAPP CONFIG — READ (used by onboarding Step 5)
# ─────────────────────────────────────────────────────────────
class StoreWhatsAppConfigSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for a store owner's WhatsApp configuration.
    Used by onboarding Step 5 GET.
    """
    class Meta:
        model = StoreWhatsAppConfig
        fields = [
            "number",
            "verified",
            "verified_at",
            "template",
            "new_order_alert",
            "auto_reply",
        ]
        read_only_fields = fields