"""
dashboard/settings/signals.py

Two responsibilities:

  1. Invalidate the settings caches whenever a settings model changes.
     The runtime cache (see services.get_runtime_settings) is a flat
     snapshot of every settings singleton plus the credential rows
     (MpesaConfig / WhatsAppConfig / EtimsConfig) and the multi-row
     config models (ShippingProvider / DeliveryZone). All of them feed
     the snapshot, so all of them must bump the cache.

  2. Record a LoginEvent for every successful authentication so the
     Security → Login history panel has data to render.

The `user_logged_in` handler is intentionally not tied to any settings
model — it lives here because the settings app already owns LoginEvent.
"""

from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import (
    # Singletons the runtime snapshot reads
    GeneralSettings,
    StoreSettings,
    CheckoutSettings,
    InventorySettings,
    ReviewSettings,
    PaymentSettings,
    ShippingSettings,
    NotificationSettings,
    SecuritySettings,
    TaxSettings,
    # Credential singletons — merged into the snapshot's derived flags
    MpesaConfig,
    WhatsAppConfig,
    EtimsConfig,
    # Multi-row config that the snapshot also depends on
    ShippingProvider,
    DeliveryZone,
    # Login history
    LoginEvent,
)
from .services import invalidate_settings_cache


# ══════════════════════════════════════════════════════════════
# Cache invalidation
# ══════════════════════════════════════════════════════════════

# Every model whose save or delete should invalidate the runtime cache.
WATCHED = (
    # Singletons
    GeneralSettings,
    StoreSettings,
    CheckoutSettings,
    InventorySettings,
    ReviewSettings,
    PaymentSettings,
    ShippingSettings,
    NotificationSettings,
    SecuritySettings,
    TaxSettings,
    # Credentials — `mpesa_enabled` and friends depend on these.
    MpesaConfig,
    WhatsAppConfig,
    EtimsConfig,
    # Multi-row config the runtime snapshot reads indirectly.
    ShippingProvider,
    DeliveryZone,
)


@receiver(post_save, dispatch_uid="settings_invalidate_on_save")
def _on_settings_saved(sender, **kwargs):
    if sender in WATCHED:
        invalidate_settings_cache()


@receiver(post_delete, dispatch_uid="settings_invalidate_on_delete")
def _on_settings_deleted(sender, **kwargs):
    if sender in WATCHED:
        invalidate_settings_cache()


# ══════════════════════════════════════════════════════════════
# Login history
# ══════════════════════════════════════════════════════════════

@receiver(user_logged_in, dispatch_uid="settings_record_login")
def _record_login(sender, request, user, **kwargs):
    ua = request.META.get("HTTP_USER_AGENT", "")[:200]
    LoginEvent.objects.create(
        user=user,
        ip_address=request.META.get("REMOTE_ADDR"),
        user_agent=ua,
        device_label=_short_device(ua),
    )


def _short_device(ua: str) -> str:
    """Best-effort human label for a User-Agent string.

    Order matters: check Mobile before Desktop for Chrome, and check
    Edge/Opera before Chrome (they spoof Chrome in their UA).
    """
    if not ua:
        return "Unknown device"

    # Mobile checks first
    if "Edg" in ua and "Mobile" in ua:
        return "Edge · Mobile"
    if "Edg" in ua:
        return "Edge · Desktop"
    if "OPR" in ua or "Opera" in ua:
        return "Opera"
    if "Chrome" in ua and "Mobile" not in ua:
        return "Chrome · Desktop"
    if "Chrome" in ua and "Mobile" in ua:
        return "Chrome · Mobile"
    if "Firefox" in ua and "Mobile" in ua:
        return "Firefox · Mobile"
    if "Firefox" in ua:
        return "Firefox"
    if "Safari" in ua and "Mobile" in ua:
        return "Safari · Mobile"
    if "Safari" in ua:
        return "Safari · Desktop"
    return "Unknown device"