"""
dashboard/settings/services.py

Cross-cutting helpers that other apps read through. Every function in
this file is designed to be called from a view, a Celery task, or
another service — nothing here touches the request/response cycle.

Contents:

  • RuntimeSettings + get_runtime_settings()
        Flat, computed snapshot of every settings value a page needs
        to gate its UI. Cached. Invalidated by signals.

  • get_settings_bundle() / invalidate_settings_cache() / invalidate_runtime_cache()
        Lower-level readers for callers that want model instances
        instead of a flat dict. Both caches invalidate together.

  • audit_diff()
        Writes a SettingsAuditLog row for each changed field.

  • DarajaClient
        Thin wrapper around Safaricom's Daraja API. Caches the OAuth
        access token for ~50 minutes so a burst of STK pushes only
        authenticates once.

  • handle_mpesa_callback()
        Called by the public callback view. Updates the MpesaTransaction
        row, notifies the admin on success or failure, and queues eTIMS
        submission when the tax module is enabled.

  • notify() + _send_email() + _send_whatsapp()
        Fan-out for order / payment / shipping events.

  • compute_vat()
        Returns (net, vat, gross) in KES based on TaxSettings.

  • queue_etims()
        Creates a pending EtimsSubmission row.

  • refresh_integration_status()
        Celery-beat task entry point. Pings M-Pesa and WhatsApp and
        updates IntegrationStatus rows.
"""

import base64
import logging
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Optional

import requests
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# Cache keys
#
#   SETTINGS_CACHE_KEY      → legacy bundle of model instances
#   RUNTIME_CACHE_KEY       → flat dict of computed values
#   MPESA_TOKEN_CACHE_KEY   → short-lived OAuth token
#
# Both settings caches are cleared together by invalidate_settings_cache()
# so existing callers don't have to know about the split.
# ══════════════════════════════════════════════════════════════

SETTINGS_CACHE_KEY = "dashboard:settings_bundle"
RUNTIME_CACHE_KEY = "dashboard:settings_runtime:v1"
SETTINGS_CACHE_TTL = 300  # seconds

# M-Pesa OAuth tokens are valid for ~1 hour. We cache for 50 minutes
# so a burst of STK pushes shares one token.
MPESA_TOKEN_CACHE_KEY = "dashboard:mpesa_access_token"


def _load_all() -> dict:
    """Load every settings singleton. One code path used by both
    `get_settings_bundle()` and `get_runtime_settings()`.
    """
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
    """Wipe both settings caches.

    Call after any settings write, or just rely on the signals wired in
    `apps.SettingsConfig.ready()` — they call this automatically.
    """
    cache.delete_many([SETTINGS_CACHE_KEY, RUNTIME_CACHE_KEY])


# Backwards-compatible alias — some call sites may use the newer name.
invalidate_runtime_cache = invalidate_settings_cache


# ══════════════════════════════════════════════════════════════
# Legacy bundle reader (model instances)
# ══════════════════════════════════════════════════════════════

def get_settings_bundle() -> dict:
    """Return a cached dict of every *Settings singleton.

    The bundle is keyed by a short name ('general', 'store', ...) so
    callers can do `bundle['store'].is_indexable` without importing
    the model.
    """
    bundle = cache.get(SETTINGS_CACHE_KEY)
    if bundle is not None:
        return bundle

    bundle = _load_all()
    cache.set(SETTINGS_CACHE_KEY, bundle, SETTINGS_CACHE_TTL)
    return bundle


# ══════════════════════════════════════════════════════════════
# Runtime snapshot reader (flat dict of computed values)
#
# This is what every page — admin dashboard and customer app —
# should read from. It hides the split between e.g. PaymentSettings
# and MpesaConfig, exposes derived flags (mpesa_enabled means "the
# store toggle AND the credentials are both on"), and returns a
# single flat object the frontend can cache as-is.
# ══════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class RuntimeSettings:
    """Flat snapshot of every setting a page might gate on."""

    # ── General ──
    currency: str
    timezone: str
    date_format: str
    weight_unit: str
    business_name: str
    business_email: str
    business_phone: str
    business_address: str

    # ── Store ──
    store_status: str  # "open" | "closed" | "paused"
    store_indexable: bool
    store_paused_message: str

    # ── Checkout ──
    allow_guest_checkout: bool
    require_phone: bool
    auto_confirm_orders: bool
    whatsapp_fallback: bool

    # ── Inventory ──
    track_inventory: bool
    low_stock_threshold: int
    allow_backorders: bool
    hide_out_of_stock: bool

    # ── Reviews ──
    reviews_enabled: bool
    require_verified_purchase: bool
    auto_publish_reviews: bool
    allow_review_photos: bool

    # ── Payments ──
    # `mpesa_enabled` is the AND of PaymentSettings.mpesa_enabled and
    # MpesaConfig.enabled, so a page never has to check both.
    mpesa_enabled: bool
    min_amount_kes: str
    max_amount_kes: str
    transaction_fee_kes: str
    auto_capture_payments: bool
    auto_refund: bool

    # ── Shipping ──
    shipping_enabled: bool
    free_shipping_threshold_kes: str
    default_delivery_fee_kes: str
    local_pickup_enabled: bool

    # ── Notifications ──
    email_enabled: bool
    whatsapp_enabled: bool
    notify_on_new_order: bool
    notify_on_payment: bool
    notify_on_shipped: bool
    notify_on_cancelled: bool
    notify_on_low_stock: bool
    notify_on_review: bool
    admin_alert_email: str

    # ── Security ──
    session_timeout_minutes: int
    require_2fa: bool

    # ── Tax ──
    vat_enabled: bool
    vat_rate: str
    prices_include_tax: bool
    etims_enabled: bool

    def to_dict(self) -> dict:
        return asdict(self)


def get_runtime_settings(*, force: bool = False) -> RuntimeSettings:
    """Read everything, compute derived flags, cache the whole payload.

    `force=True` bypasses the cache — used by the admin settings page
    right after a save to guarantee a fresh read.
    """
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
        # General
        currency=general.currency,
        timezone=general.timezone,
        date_format=general.date_format,
        weight_unit=general.weight_unit,
        business_name=general.business_name,
        business_email=general.contact_email,
        business_phone=general.contact_phone,
        business_address=general.address,
        # Store
        store_status=store.status,
        store_indexable=store.is_indexable,
        store_paused_message=store.paused_message,
        # Checkout
        allow_guest_checkout=checkout.allow_guest_checkout,
        require_phone=checkout.require_phone,
        auto_confirm_orders=checkout.auto_confirm_orders,
        whatsapp_fallback=checkout.whatsapp_fallback,
        # Inventory
        track_inventory=inventory.track_inventory,
        low_stock_threshold=inventory.low_stock_threshold,
        allow_backorders=inventory.allow_backorders,
        hide_out_of_stock=inventory.hide_out_of_stock,
        # Reviews
        reviews_enabled=reviews.reviews_enabled,
        require_verified_purchase=reviews.require_verified_purchase,
        auto_publish_reviews=reviews.auto_publish,
        allow_review_photos=reviews.allow_photos,
        # Payments — combined flag
        mpesa_enabled=bool(mpesa_cfg.enabled and payments.mpesa_enabled),
        min_amount_kes=str(payments.min_amount_kes),
        max_amount_kes=str(payments.max_amount_kes),
        transaction_fee_kes=str(payments.transaction_fee_kes),
        auto_capture_payments=payments.auto_capture,
        auto_refund=payments.auto_refund,
        # Shipping
        shipping_enabled=shipping.shipping_enabled,
        free_shipping_threshold_kes=str(shipping.free_shipping_threshold_kes),
        default_delivery_fee_kes=str(shipping.default_delivery_fee_kes),
        local_pickup_enabled=shipping.local_pickup_enabled,
        # Notifications
        email_enabled=notifs.email_enabled,
        whatsapp_enabled=notifs.whatsapp_enabled,
        notify_on_new_order=notifs.notify_on_new_order,
        notify_on_payment=notifs.notify_on_payment,
        notify_on_shipped=notifs.notify_on_shipped,
        notify_on_cancelled=notifs.notify_on_cancelled,
        notify_on_low_stock=notifs.notify_on_low_stock,
        notify_on_review=notifs.notify_on_review,
        admin_alert_email=notifs.admin_alert_email,
        # Security
        session_timeout_minutes=security.session_timeout_minutes,
        require_2fa=security.require_2fa,
        # Tax
        vat_enabled=tax.vat_enabled,
        vat_rate=str(tax.vat_rate),
        prices_include_tax=tax.prices_include_tax,
        etims_enabled=tax.etims_enabled,
    )

    cache.set(RUNTIME_CACHE_KEY, runtime.to_dict(), SETTINGS_CACHE_TTL)
    return runtime


# ══════════════════════════════════════════════════════════════
# Audit
# ══════════════════════════════════════════════════════════════

# Fields that are never part of a diff — auto-managed or internal.
AUDIT_IGNORE_FIELDS = {"id", "updated_at", "pk"}


def audit_diff(
    section: str,
    before: dict,
    after: dict,
    *,
    user=None,
    ip: Optional[str] = None,
) -> int:
    """Write one SettingsAuditLog row per changed field.

    Returns the number of rows written. `before` and `after` are plain
    dicts (usually from DRF's `serializer.initial_data` or a model's
    `__dict__`).
    """
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


# ══════════════════════════════════════════════════════════════
# Daraja client
# ══════════════════════════════════════════════════════════════

class DarajaError(Exception):
    """Raised when Daraja returns an error or times out."""


class DarajaClient:
    """Safaricom Daraja API wrapper.

    Reads credentials from MpesaConfig. Caches the OAuth token in
    Django's cache backend so repeated STK pushes don't re-authenticate.
    """

    SANDBOX = "https://sandbox.safaricom.co.ke"
    PRODUCTION = "https://api.safaricom.co.ke"
    REQUEST_TIMEOUT = 20

    def __init__(self):
        from .models import MpesaConfig

        self.cfg = MpesaConfig.load()
        self.base = (
            self.SANDBOX if self.cfg.environment == "sandbox" else self.PRODUCTION
        )

    # ── auth ───────────────────────────────────────────────────

    def _basic_auth_header(self) -> dict:
        raw = f"{self.cfg.consumer_key}:{self.cfg.consumer_secret}".encode()
        return {"Authorization": f"Basic {base64.b64encode(raw).decode()}"}

    def access_token(self, *, force_refresh: bool = False) -> str:
        """Return a valid OAuth token, cached for ~50 minutes."""
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

    # ── STK Push ───────────────────────────────────────────────

    def stk_push(
        self,
        *,
        phone: str,
        amount: int | float,
        account_ref: str,
        description: str,
    ) -> dict:
        """Send an STK Push to the customer's phone.

        `phone` must be in 2547XXXXXXXX form. `amount` is truncated to
        an integer — M-Pesa does not accept decimals.
        """
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{self.cfg.shortcode}{self.cfg.passkey}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": self.cfg.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
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


# ══════════════════════════════════════════════════════════════
# M-Pesa callback handler
# ══════════════════════════════════════════════════════════════

def handle_mpesa_callback(payload: dict) -> None:
    """Process a Safaricom callback.

    Idempotent — if the transaction is already in a terminal state the
    function returns without doing anything.
    """
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

    if txn.result_code == "0":
        meta = {
            m["Name"]: m.get("Value")
            for m in stk.get("CallbackMetadata", {}).get("Item", [])
        }
        txn.status = "success"
        txn.mpesa_receipt = meta.get("MpesaReceiptNumber", "")
        txn.save()

        if PaymentSettings.load().auto_capture and txn.order_id:
            # TODO: uncomment once the orders app exposes mark_order_paid.
            # from orders.services import mark_order_paid
            # mark_order_paid(txn.order_id, txn)

            notify(
                "payment_received",
                {"order_id": txn.order_id, "amount": str(txn.amount)},
            )

            if TaxSettings.load().etims_enabled:
                queue_etims(txn.order_id)
    else:
        txn.status = "failed"
        txn.save()

        # Notify the admin so a failed payment doesn't go unnoticed.
        # `payment_failed` is a distinct event so it can be toggled
        # independently of payment_received in NotificationSettings.
        notify(
            "payment_failed",
            {
                "order_id": txn.order_id,
                "amount": str(txn.amount),
                "error": txn.result_desc or "Payment failed",
            },
        )

        if PaymentSettings.load().auto_refund and txn.order_id:
            # TODO: uncomment once the orders app exposes refund_order.
            # from orders.services import refund_order
            # refund_order(txn.order_id, reason='mpesa_auto_refund')
            logger.info("Auto-refund queued for order %s", txn.order_id)


# ══════════════════════════════════════════════════════════════
# Notifications
# ══════════════════════════════════════════════════════════════

# Maps an event name to the NotificationSettings boolean that gates it.
# `payment_failed` shares `notify_on_payment` because the admin
# generally wants to know about payment events as a group — split it
# into its own flag later if the need arises.
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
) -> None:
    """Fan out a single event to configured channels.

    Respects NotificationSettings: if the event is not enabled in the
    config, nothing is sent. If `customer_phone` is provided and
    WhatsApp is enabled, the customer also receives a templated
    message.
    """
    from .models import NotificationSettings

    cfg = NotificationSettings.load()
    flag = EVENT_FLAG.get(event)
    if not flag:
        logger.warning("notify() called with unknown event %s", event)
        return
    if not getattr(cfg, flag, False):
        return

    if to_admin and cfg.email_enabled and cfg.admin_alert_email:
        _send_email(event, cfg.admin_alert_email, context)

    if customer_phone and cfg.whatsapp_enabled:
        _send_whatsapp(event, customer_phone, context)


def _send_email(event: str, recipient: str, context: dict) -> None:
    """Send one email and log the attempt. Never raises."""
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


def _send_whatsapp(event: str, phone: str, context: dict) -> None:
    """Send one WhatsApp template message and log the attempt."""
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
                    "parameters": [
                        {"type": "text", "text": str(v)}
                        for v in context.values()
                    ],
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


# ══════════════════════════════════════════════════════════════
# VAT + eTIMS
# ══════════════════════════════════════════════════════════════

def compute_vat(subtotal: float) -> tuple[float, float, float]:
    """Split a subtotal into (net, vat, gross).

    Honors TaxSettings:
      • vat_enabled = False           → (subtotal, 0, subtotal)
      • prices_include_tax = True     → subtotal is the gross
      • prices_include_tax = False    → subtotal is the net

    All values rounded to 2dp.
    """
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
    """Create a pending eTIMS submission row.

    The Celery task picks it up and POSTs to KRA. If the task isn't
    running yet the row just sits as 'pending' until it is.
    """
    from .models import EtimsSubmission

    EtimsSubmission.objects.create(order_id=order_id, status="pending")

    # TODO: uncomment once Celery task is registered.
    # from .tasks import submit_to_etims
    # submit_to_etims.delay(order_id)


# ══════════════════════════════════════════════════════════════
# Integration health checks (called by Celery beat)
# ══════════════════════════════════════════════════════════════

def refresh_integration_status() -> None:
    """Ping each external service and update IntegrationStatus rows.

    Safe to run frequently — every check catches its own errors and
    writes them to `last_error`.
    """
    from .models import IntegrationStatus, WhatsAppConfig

    def _check_mpesa() -> tuple[bool, str]:
        try:
            DarajaClient().access_token(force_refresh=True)
            return True, ""
        except Exception as e:
            return False, str(e)[:500]

    def _check_whatsapp() -> tuple[bool, str]:
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