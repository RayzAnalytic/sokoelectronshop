import base64
import logging
from dataclasses import asdict, dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import requests
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)

SETTINGS_CACHE_KEY = "dashboard:settings_bundle"
RUNTIME_CACHE_KEY = "dashboard:settings_runtime:v1"
SETTINGS_CACHE_TTL = 300

MPESA_TOKEN_CACHE_KEY = "dashboard:mpesa_access_token"


def _load_all() -> dict:
    from .models import (
        GeneralSettings,
        StoreSettings,
        CheckoutSettings,
        InventorySettings,
        ReviewSettings,
        PaymentSettings,
        ShippingSettings,
        NotificationSettings,
        TaxSettings,
        SecuritySettings,
    )

    return {
        "general": GeneralSettings.load(),
        "store": StoreSettings.load(),
        "checkout": CheckoutSettings.load(),
        "inventory": InventorySettings.load(),
        "reviews": ReviewSettings.load(),
        "payments": PaymentSettings.load(),
        "shipping": ShippingSettings.load(),
        "notifs": NotificationSettings.load(),
        "tax": TaxSettings.load(),
        "security": SecuritySettings.load(),
    }


def invalidate_settings_cache() -> None:
    cache.delete_many([SETTINGS_CACHE_KEY, RUNTIME_CACHE_KEY])


invalidate_runtime_cache = invalidate_settings_cache


def get_settings_bundle() -> dict:
    bundle = cache.get(SETTINGS_CACHE_KEY)
    if bundle is not None:
        return bundle

    bundle = _load_all()
    cache.set(SETTINGS_CACHE_KEY, bundle, SETTINGS_CACHE_TTL)
    return bundle


@dataclass(frozen=True)
class RuntimeSettings:
    currency: str
    timezone: str
    date_format: str
    weight_unit: str
    business_name: str
    business_email: str
    business_phone: str
    business_address: str

    store_status: str
    store_indexable: bool
    store_paused_message: str

    allow_guest_checkout: bool
    require_phone: bool
    auto_confirm_orders: bool
    whatsapp_fallback: bool

    track_inventory: bool
    low_stock_threshold: int
    allow_backorders: bool
    hide_out_of_stock: bool

    reviews_enabled: bool
    require_verified_purchase: bool
    auto_publish_reviews: bool
    allow_review_photos: bool

    mpesa_enabled: bool
    min_amount_kes: str
    max_amount_kes: str
    transaction_fee_kes: str
    auto_capture_payments: bool
    auto_refund: bool

    shipping_enabled: bool
    free_shipping_threshold_kes: str
    default_delivery_fee_kes: str
    local_pickup_enabled: bool

    email_enabled: bool
    whatsapp_enabled: bool
    notify_on_new_order: bool
    notify_on_payment: bool
    notify_on_shipped: bool
    notify_on_cancelled: bool
    notify_on_low_stock: bool
    notify_on_review: bool
    admin_alert_email: str

    session_timeout_minutes: int
    require_2fa: bool

    vat_enabled: bool
    vat_rate: str
    prices_include_tax: bool
    etims_enabled: bool

    def to_dict(self) -> dict:
        return asdict(self)


def get_runtime_settings(*, force: bool = False) -> RuntimeSettings:
    if not force:
        cached = cache.get(RUNTIME_CACHE_KEY)
        if cached is not None:
            return RuntimeSettings(**cached)

    from .models import MpesaConfig

    bundle = _load_all()

    general = bundle["general"]
    store = bundle["store"]
    checkout = bundle["checkout"]
    inventory = bundle["inventory"]
    reviews = bundle["reviews"]
    payments = bundle["payments"]
    shipping = bundle["shipping"]
    notifs = bundle["notifs"]
    security = bundle["security"]
    tax = bundle["tax"]

    mpesa_cfg = MpesaConfig.load()

    runtime = RuntimeSettings(
        currency=general.currency,
        timezone=general.timezone,
        date_format=general.date_format,
        weight_unit=general.weight_unit,
        business_name=general.business_name,
        business_email=general.contact_email,
        business_phone=general.contact_phone,
        business_address=general.address,
        store_status=store.status,
        store_indexable=store.is_indexable,
        store_paused_message=store.paused_message,
        allow_guest_checkout=checkout.allow_guest_checkout,
        require_phone=checkout.require_phone,
        auto_confirm_orders=checkout.auto_confirm_orders,
        whatsapp_fallback=checkout.whatsapp_fallback,
        track_inventory=inventory.track_inventory,
        low_stock_threshold=inventory.low_stock_threshold,
        allow_backorders=inventory.allow_backorders,
        hide_out_of_stock=inventory.hide_out_of_stock,
        reviews_enabled=reviews.reviews_enabled,
        require_verified_purchase=reviews.require_verified_purchase,
        auto_publish_reviews=reviews.auto_publish,
        allow_review_photos=reviews.allow_photos,
        mpesa_enabled=bool(mpesa_cfg.enabled and payments.mpesa_enabled),
        min_amount_kes=str(payments.min_amount_kes),
        max_amount_kes=str(payments.max_amount_kes),
        transaction_fee_kes=str(payments.transaction_fee_kes),
        auto_capture_payments=payments.auto_capture,
        auto_refund=payments.auto_refund,
        shipping_enabled=shipping.shipping_enabled,
        free_shipping_threshold_kes=str(shipping.free_shipping_threshold_kes),
        default_delivery_fee_kes=str(shipping.default_delivery_fee_kes),
        local_pickup_enabled=shipping.local_pickup_enabled,
        email_enabled=notifs.email_enabled,
        whatsapp_enabled=notifs.whatsapp_enabled,
        notify_on_new_order=notifs.notify_on_new_order,
        notify_on_payment=notifs.notify_on_payment,
        notify_on_shipped=notifs.notify_on_shipped,
        notify_on_cancelled=notifs.notify_on_cancelled,
        notify_on_low_stock=notifs.notify_on_low_stock,
        notify_on_review=notifs.notify_on_review,
        admin_alert_email=notifs.admin_alert_email,
        session_timeout_minutes=security.session_timeout_minutes,
        require_2fa=security.require_2fa,
        vat_enabled=tax.vat_enabled,
        vat_rate=str(tax.vat_rate),
        prices_include_tax=tax.prices_include_tax,
        etims_enabled=tax.etims_enabled,
    )

    cache.set(RUNTIME_CACHE_KEY, runtime.to_dict(), SETTINGS_CACHE_TTL)
    return runtime


AUDIT_IGNORE_FIELDS = {"id", "updated_at", "pk"}


def audit_diff(
    section: str,
    before: dict,
    after: dict,
    *,
    user=None,
    ip: Optional[str] = None,
) -> int:
    from .models import SettingsAuditLog

    rows = []
    for field, old in before.items():
        if field in AUDIT_IGNORE_FIELDS:
            continue
        new = after.get(field)
        if old == new:
            continue
        rows.append(
            SettingsAuditLog(
                section=section,
                field_name=field,
                before=str(old),
                after=str(new),
                changed_by=user if getattr(user, "is_authenticated", False) else None,
                ip_address=ip or None,
            )
        )

    if rows:
        SettingsAuditLog.objects.bulk_create(rows)

    return len(rows)


class DarajaError(Exception):
    pass


class DarajaClient:
    SANDBOX = "https://sandbox.safaricom.co.ke"
    PRODUCTION = "https://api.safaricom.co.ke"
    REQUEST_TIMEOUT = 20

    def __init__(self):
        from .models import MpesaConfig

        self.cfg = MpesaConfig.load()
        self.base = (
            self.SANDBOX if self.cfg.environment == "sandbox" else self.PRODUCTION
        )

    def _basic_auth_header(self) -> dict:
        raw = f"{self.cfg.consumer_key}:{self.cfg.consumer_secret}".encode()
        return {"Authorization": f"Basic {base64.b64encode(raw).decode()}"}

    def access_token(self, *, force_refresh: bool = False) -> str:
        if not force_refresh:
            cached = cache.get(MPESA_TOKEN_CACHE_KEY)
            if cached:
                return cached

        url = f"{self.base}/oauth/v1/generate?grant_type=client_credentials"
        try:
            r = requests.get(
                url,
                headers=self._basic_auth_header(),
                timeout=self.REQUEST_TIMEOUT,
            )
            r.raise_for_status()
        except requests.RequestException as e:
            logger.exception("Daraja auth failed")
            raise DarajaError(f"Daraja auth failed: {e}") from e

        token = r.json().get("access_token")
        if not token:
            raise DarajaError("Daraja auth returned no access_token")

        cache.set(MPESA_TOKEN_CACHE_KEY, token, 50 * 60)
        return token

    def stk_push(
        self,
        *,
        phone: str,
        amount,
        account_ref: str,
        description: str,
    ) -> dict:
        try:
            whole_amount = int(
                Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            )
        except Exception as e:
            raise DarajaError(f"Invalid amount {amount!r}: {e}") from e

        if whole_amount <= 0:
            raise DarajaError(f"Amount must be positive, got {whole_amount}")

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{self.cfg.shortcode}{self.cfg.passkey}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": self.cfg.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": whole_amount,
            "PartyA": phone,
            "PartyB": self.cfg.shortcode,
            "PhoneNumber": phone,
            "CallBackURL": self.cfg.callback_url,
            "AccountReference": account_ref[:12],
            "TransactionDesc": description[:13],
        }

        try:
            r = requests.post(
                f"{self.base}/mpesa/stkpush/v1/processrequest",
                json=payload,
                headers={"Authorization": f"Bearer {self.access_token()}"},
                timeout=self.REQUEST_TIMEOUT,
            )
            r.raise_for_status()
        except requests.RequestException as e:
            logger.exception("Daraja STK push failed for %s", phone)
            raise DarajaError(f"STK push failed: {e}") from e

        return r.json()


def handle_mpesa_callback(payload: dict) -> None:
    from .models import MpesaTransaction, PaymentSettings, TaxSettings

    stk = payload.get("Body", {}).get("stkCallback", {})
    checkout_id = stk.get("CheckoutRequestID")

    if not checkout_id:
        logger.warning("M-Pesa callback missing CheckoutRequestID")
        return

    txn = MpesaTransaction.objects.filter(checkout_request_id=checkout_id).first()
    if not txn:
        logger.warning("M-Pesa callback for unknown txn %s", checkout_id)
        return

    if txn.status in ("success", "failed", "refunded"):
        logger.info("M-Pesa callback for already-settled txn %s", checkout_id)
        return

    txn.result_code = str(stk.get("ResultCode", ""))
    txn.result_desc = stk.get("ResultDesc", "")
    txn.raw_callback = payload

    payment_cfg = PaymentSettings.load()
    tax_cfg = TaxSettings.load()

    if txn.result_code == "0":
        meta = {
            m["Name"]: m.get("Value")
            for m in stk.get("CallbackMetadata", {}).get("Item", [])
        }
        txn.status = "success"
        txn.mpesa_receipt = meta.get("MpesaReceiptNumber", "")
        txn.save()

        if payment_cfg.auto_capture and txn.order_id:
            notify(
                "payment_received",
                {"order_id": txn.order_id, "amount": str(txn.amount)},
            )

            if tax_cfg.etims_enabled:
                queue_etims(txn.order_id)
    else:
        txn.status = "failed"
        txn.save()

        notify(
            "payment_failed",
            {
                "order_id": txn.order_id,
                "amount": str(txn.amount),
                "error": txn.result_desc or "Payment failed",
            },
        )

        if payment_cfg.auto_refund and txn.order_id:
            logger.info("Auto-refund queued for order %s", txn.order_id)


EVENT_FLAG = {
    "new_order": "notify_on_new_order",
    "payment_received": "notify_on_payment",
    "payment_failed": "notify_on_payment",
    "order_shipped": "notify_on_shipped",
    "order_cancelled": "notify_on_cancelled",
    "low_stock": "notify_on_low_stock",
    "new_review": "notify_on_review",
}


def notify(
    event: str,
    context: dict,
    *,
    to_admin: bool = True,
    customer_phone: Optional[str] = None,
    param_order: Optional[list] = None,
) -> None:
    from .models import NotificationSettings

    cfg = NotificationSettings.load()
    flag = EVENT_FLAG.get(event)
    if not flag:
        logger.warning("notify() called with unknown event %s", event)
        return
    if not getattr(cfg, flag, False):
        logger.info("notify() skipped event=%s — flag %s is disabled", event, flag)
        return

    if to_admin and cfg.email_enabled and cfg.admin_alert_email:
        _send_email(event, cfg.admin_alert_email, context)

    if customer_phone and cfg.whatsapp_enabled:
        _send_whatsapp(event, customer_phone, context, param_order=param_order)


def _send_email(event: str, recipient: str, context: dict) -> None:
    from .models import NotificationLog

    order_id = str(context.get("order_id", "") or "")

    try:
        send_mail(
            subject=f"[{event}] notification",
            message=str(context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        NotificationLog.objects.create(
            event=event,
            channel="email",
            recipient=recipient,
            success=True,
            payload=context,
            order_id=order_id,
        )
    except Exception as e:
        logger.exception("Email notification failed for %s", recipient)
        NotificationLog.objects.create(
            event=event,
            channel="email",
            recipient=recipient,
            success=False,
            error=str(e),
            payload=context,
            order_id=order_id,
        )


def _send_whatsapp(
    event: str,
    phone: str,
    context: dict,
    *,
    param_order: Optional[list] = None,
) -> None:
    from .models import WhatsAppConfig, NotificationLog

    cfg = WhatsAppConfig.load()
    template = (cfg.template_map or {}).get(event)
    order_id = str(context.get("order_id", "") or "")

    if not template:
        logger.warning("No WhatsApp template mapped for event=%s", event)
        return

    if not cfg.access_token or not cfg.phone_number_id:
        logger.warning("WhatsApp not configured — skipping send for %s", event)
        return

    keys = param_order if param_order else sorted(context.keys())
    missing = [k for k in keys if k not in context]
    if missing:
        logger.warning(
            "_send_whatsapp: param_order keys %s not in context for event=%s",
            missing,
            event,
        )

    body_params = [
        {"type": "text", "text": str(context.get(k, ""))} for k in keys
    ]

    url = f"https://graph.facebook.com/v20.0/{cfg.phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": body_params,
                }
            ],
        },
    }

    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {cfg.access_token}"},
            timeout=15,
        )
        r.raise_for_status()
        NotificationLog.objects.create(
            event=event,
            channel="whatsapp",
            recipient=phone,
            success=True,
            payload=context,
            order_id=order_id,
        )
    except Exception as e:
        logger.exception("WhatsApp send failed for %s", phone)
        NotificationLog.objects.create(
            event=event,
            channel="whatsapp",
            recipient=phone,
            success=False,
            error=str(e),
            payload=context,
            order_id=order_id,
        )


def compute_vat(subtotal: float) -> tuple:
    from .models import TaxSettings

    cfg = TaxSettings.load()

    if not cfg.vat_enabled:
        return round(subtotal, 2), 0.0, round(subtotal, 2)

    rate = float(cfg.vat_rate) / 100

    if cfg.prices_include_tax:
        net = subtotal / (1 + rate)
        return round(net, 2), round(subtotal - net, 2), round(subtotal, 2)

    vat = subtotal * rate
    return round(subtotal, 2), round(vat, 2), round(subtotal + vat, 2)


def queue_etims(order_id: str) -> None:
    from .models import EtimsSubmission

    submission, created = EtimsSubmission.objects.get_or_create(
        order_id=order_id,
        status="pending",
    )

    if not created:
        logger.info("eTIMS submission already pending for order %s", order_id)
        return


def refresh_integration_status() -> None:
    from .models import IntegrationStatus, WhatsAppConfig

    def _check_mpesa() -> tuple:
        try:
            DarajaClient().access_token(force_refresh=True)
            return True, ""
        except Exception as e:
            return False, str(e)[:500]

    def _check_whatsapp() -> tuple:
        cfg = WhatsAppConfig.load()
        if not cfg.access_token or not cfg.phone_number_id:
            return False, "Missing access token or phone number ID"

        url = f"https://graph.facebook.com/v20.0/{cfg.phone_number_id}"
        try:
            r = requests.get(
                url,
                headers={"Authorization": f"Bearer {cfg.access_token}"},
                timeout=15,
            )
            r.raise_for_status()
            return True, ""
        except Exception as e:
            return False, str(e)[:500]

    checks = {
        "mpesa": _check_mpesa,
        "whatsapp": _check_whatsapp,
    }

    now = timezone.now()
    for key, fn in checks.items():
        try:
            row = IntegrationStatus.objects.filter(key=key).first()
            if not row:
                continue
            try:
                connected, err = fn()
            except Exception as e:
                connected, err = False, str(e)[:500]
            row.connected = connected
            row.last_error = err
            row.last_checked_at = now
            row.save(update_fields=["connected", "last_error", "last_checked_at"])
        except Exception:
            logger.exception("refresh_integration_status: failed for key=%s", key)