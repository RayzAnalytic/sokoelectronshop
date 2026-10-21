import logging

from django.utils import timezone

from checkout.services import (
    reconcile_payment as checkout_reconcile,
    retry_payment as checkout_retry,
)

from .serializers import _mask

logger = logging.getLogger(__name__)


def _load_models():
    from dashboard.settings.models import MpesaConfig, PaymentSettings
    return MpesaConfig, PaymentSettings


def get_config_dict() -> dict:
    MpesaConfig, PaymentSettings = _load_models()

    mpesa, _ = MpesaConfig.objects.get_or_create(pk=1)
    pay, _ = PaymentSettings.objects.get_or_create(pk=1)

    return {
        'enabled': bool(mpesa.enabled),
        'environment': mpesa.environment or 'sandbox',
        'shortcode': mpesa.shortcode or '',
        'callback_url': mpesa.callback_url or '',
        'consumer_key_masked': _mask(mpesa.consumer_key or ''),
        'consumer_secret_masked': _mask(mpesa.consumer_secret or ''),
        'passkey_masked': _mask(mpesa.passkey or ''),
        'has_consumer_key': bool(mpesa.consumer_key),
        'has_consumer_secret': bool(mpesa.consumer_secret),
        'has_passkey': bool(mpesa.passkey),
        'min_amount_kes': str(pay.min_amount_kes),
        'max_amount_kes': str(pay.max_amount_kes),
        'transaction_fee_kes': str(pay.transaction_fee_kes),
        'auto_capture': bool(pay.auto_capture),
        'auto_refund': bool(pay.auto_refund),
        'last_rotated_at': mpesa.last_rotated_at,
    }


def update_config(data: dict, actor=None) -> dict:
    MpesaConfig, PaymentSettings = _load_models()

    mpesa, _ = MpesaConfig.objects.get_or_create(pk=1)
    pay, _ = PaymentSettings.objects.get_or_create(pk=1)

    mpesa_fields = []
    rotated = False

    if 'enabled' in data:
        mpesa.enabled = bool(data['enabled'])
        mpesa_fields.append('enabled')

    if 'environment' in data:
        mpesa.environment = data['environment']
        mpesa_fields.append('environment')

    if 'shortcode' in data:
        mpesa.shortcode = data['shortcode'] or ''
        mpesa_fields.append('shortcode')

    if 'callback_url' in data:
        mpesa.callback_url = data['callback_url'] or ''
        mpesa_fields.append('callback_url')

    for src, dst in (
        ('consumer_key', 'consumer_key'),
        ('consumer_secret', 'consumer_secret'),
        ('passkey', 'passkey'),
    ):
        if src in data and data[src]:
            setattr(mpesa, dst, data[src])
            mpesa_fields.append(dst)
            rotated = True

    if rotated:
        mpesa.last_rotated_at = timezone.now()
        mpesa_fields.append('last_rotated_at')

    if mpesa_fields:
        mpesa.save(update_fields=mpesa_fields + ['updated_at'])

    pay_fields = []

    for f in (
        'min_amount_kes',
        'max_amount_kes',
        'transaction_fee_kes',
    ):
        if f in data:
            setattr(pay, f, data[f])
            pay_fields.append(f)

    for f in ('auto_capture', 'auto_refund'):
        if f in data:
            setattr(pay, f, bool(data[f]))
            pay_fields.append(f)

    if 'enabled' in data:
        pay.mpesa_enabled = bool(data['enabled'])
        pay_fields.append('mpesa_enabled')

    if pay_fields:
        pay.save(update_fields=pay_fields + ['updated_at'])

    return get_config_dict()


def test_connection() -> dict:
    MpesaConfig, _ = _load_models()
    mpesa = MpesaConfig.objects.first()

    problems = []

    if not mpesa:
        problems.append('M-Pesa config has not been set up yet.')
    else:
        if not mpesa.consumer_key:
            problems.append('Consumer key is missing.')
        if not mpesa.consumer_secret:
            problems.append('Consumer secret is missing.')
        if not mpesa.passkey:
            problems.append('Passkey is missing.')
        if not mpesa.shortcode:
            problems.append('Shortcode is missing.')
        if not mpesa.callback_url:
            problems.append('Callback URL is missing.')

    if problems:
        return {
            'ok': False,
            'message': ' '.join(problems),
            'checked_at': timezone.now(),
        }

    return {
        'ok': True,
        'message': (
            'M-Pesa credentials are present and the callback URL is set. '
            'Live gateway verification is deferred to the checkout flow.'
        ),
        'checked_at': timezone.now(),
    }


def retry_payment(payment, *, actor=None, phone: str | None = None):
    return checkout_retry(payment=payment, user=actor, phone=phone)


def reconcile_payment(
    payment,
    *,
    action: str,
    order_reference: str = '',
    note: str = '',
    actor=None,
):
    return checkout_reconcile(
        payment=payment,
        action=action,
        order_reference=order_reference,
        note=note,
        actor=actor,
    )