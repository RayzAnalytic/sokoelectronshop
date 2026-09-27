# payments/serializers.py

from rest_framework import serializers

from .models import Payment, PaymentAttempt


# ─────────────────────────────────────────────────────────────
# PAYMENT — READ
# ─────────────────────────────────────────────────────────────
class PaymentReadSerializer(serializers.ModelSerializer):
    """
    Returned to the frontend for GET/list.
    Never exposes raw request/response payloads.
    """
    attempts_count = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "order_reference",
            "amount",
            "currency",
            "gateway",
            "status",
            "description",
            "payment_url",
            "internal_reference",
            "gateway_reference",
            "attempts_count",
            "created_at",
            "updated_at",
            "completed_at",
        ]
        read_only_fields = fields

    def get_attempts_count(self, obj):
        # Use prefetch when listing to avoid N+1
        return obj.attempts.count()


# ─────────────────────────────────────────────────────────────
# PAYMENT ATTEMPT — READ
# ─────────────────────────────────────────────────────────────
class PaymentAttemptReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAttempt
        fields = [
            "id",
            "gateway_checkout_id",
            "status_code",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────
# DUSUPAY — INITIATE
# ─────────────────────────────────────────────────────────────
class DusupayInitiateSerializer(serializers.Serializer):
    """
    Payload for POST /api/payments/dusupay/initiate/
    Matches Dusupay's collection request body.
    """
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=1
    )
    currency = serializers.CharField(max_length=3, default="KES")
    provider_code = serializers.CharField(
        max_length=32,
        help_text="e.g. mpesa_ke, local_ngn, card_ngn",
    )
    transaction_method = serializers.ChoiceField(
        choices=["MOBILE_MONEY", "CARD", "BANK_TRANSFER"],
        default="MOBILE_MONEY",
    )
    msisdn = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )
    customer_email = serializers.EmailField(
        required=False, allow_blank=True
    )
    customer_name = serializers.CharField(
        max_length=128, required=False, allow_blank=True
    )
    description = serializers.CharField(max_length=30)
    redirect_url = serializers.URLField()
    order_reference = serializers.CharField(max_length=64)

    def validate_provider_code(self, value):
        return value.strip().lower()


# ─────────────────────────────────────────────────────────────
# PESAPAL — INITIATE
# ─────────────────────────────────────────────────────────────
class PesapalInitiateSerializer(serializers.Serializer):
    """
    Payload for POST /api/payments/pesapal/initiate/
    Matches Pesapal's SubmitOrderRequest.
    """
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=1
    )
    currency = serializers.CharField(max_length=3, default="KES")
    description = serializers.CharField(max_length=255)
    order_reference = serializers.CharField(max_length=64)

    # Billing info (Pesapal requires email + phone)
    email_address = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)
    country_code = serializers.CharField(max_length=2, default="KE")
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)

    callback_url = serializers.URLField()
    cancellation_url = serializers.URLField(
        required=False, allow_blank=True
    )

    def validate_country_code(self, value):
        return value.strip().upper()

    def validate_phone_number(self, value):
        # Normalize spaces/dashes
        return value.replace(" ", "").replace("-", "").strip()


# ─────────────────────────────────────────────────────────────
# M-PESA — INITIATE
# ─────────────────────────────────────────────────────────────
class MpesaInitiateSerializer(serializers.Serializer):
    """
    Payload for POST /api/payments/mpesa/initiate/
    Triggers Safaricom STK push.
    """
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=1
    )
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Any Kenyan format: 0712..., 254712..., +254712...",
    )
    order_reference = serializers.CharField(max_length=64)
    description = serializers.CharField(max_length=13, default="Payment")

    def validate_phone_number(self, value):
        """
        Normalize to 254XXXXXXXXX (Safaricom's expected format).
        Accepts 0712..., 712..., 254712..., +254712...
        """
        p = value.replace("+", "").replace(" ", "").replace("-", "").strip()
        if p.startswith("0"):
            p = "254" + p[1:]
        elif p.startswith("7") and len(p) == 9:
            p = "254" + p
        elif p.startswith("1") and len(p) == 9:
            p = "254" + p
        if not p.isdigit() or len(p) != 12 or not p.startswith("254"):
            raise serializers.ValidationError(
                "Enter a valid Kenyan phone number (e.g. 0712345678)."
            )
        return p

    def validate_description(self, value):
        if not value:
            return "Payment"
        return value[:13]