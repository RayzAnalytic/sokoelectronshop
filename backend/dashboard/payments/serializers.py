from rest_framework import serializers

from checkout.serializers import TransactionSerializer


def _mask(value: str) -> str:
    if not value:
        return ''
    if len(value) <= 10:
        return '*' * len(value)
    return f'{value[:6]}{"*" * 8}{value[-4:]}'


class PaymentConfigReadSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    environment = serializers.CharField()
    shortcode = serializers.CharField()
    callback_url = serializers.CharField()
    consumer_key_masked = serializers.CharField()
    consumer_secret_masked = serializers.CharField()
    passkey_masked = serializers.CharField()
    has_consumer_key = serializers.BooleanField()
    has_consumer_secret = serializers.BooleanField()
    has_passkey = serializers.BooleanField()

    min_amount_kes = serializers.CharField()
    max_amount_kes = serializers.CharField()
    transaction_fee_kes = serializers.CharField()
    auto_capture = serializers.BooleanField()
    auto_refund = serializers.BooleanField()

    last_rotated_at = serializers.DateTimeField(allow_null=True)


class PaymentConfigWriteSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    environment = serializers.ChoiceField(
        choices=('sandbox', 'production'), required=False,
    )
    shortcode = serializers.CharField(
        max_length=32, required=False, allow_blank=True,
    )
    callback_url = serializers.URLField(
        required=False, allow_blank=True,
    )
    consumer_key = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )
    consumer_secret = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )
    passkey = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )

    min_amount_kes = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
    )
    max_amount_kes = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
    )
    transaction_fee_kes = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
    )
    auto_capture = serializers.BooleanField(required=False)
    auto_refund = serializers.BooleanField(required=False)


class PaymentTestResultSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    message = serializers.CharField()
    checked_at = serializers.DateTimeField()


__all__ = (
    'PaymentConfigReadSerializer',
    'PaymentConfigWriteSerializer',
    'PaymentTestResultSerializer',
    'TransactionSerializer',
)