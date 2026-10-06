"""
Celery tasks for the WhatsApp app.

Three responsibilities:
  1. Process inbound webhook events (messages + statuses).
  2. Send outbound messages asynchronously.
  3. Housekeeping (expire cart sessions, sync templates, warn on token expiry).

AUTOMATIONS (AI & Automations page):
    One event is fired from this module:

        customer.first_message  — fired once per WhatsAppContact, the
                                   first time a message arrives from a
                                   wa_id we have never seen before.

    Deduplication is free: `WhatsAppContact.objects.get_or_create`
    returns a `created` flag, and the event only fires when that flag
    is True. On a Celery retry, `created` is False the second time and
    the event does not re-fire. Same protection pattern the automation
    dispatcher relies on elsewhere.

    Payload:
        {
            "customer_id":   contact.user_id,       # may be None
            "wa_id":         contact.wa_id,
            "contact_id":    contact.pk,
            "conversation_id": conversation.pk,
            "profile_name":  contact.profile_name,
        }

    `customer_id` is None when the WhatsApp contact has not been linked
    to a Django user yet. Most first messages come from people who have
    never signed up — the "Welcome Message" automation should reply to
    the WhatsApp number regardless, using `wa_id` and `conversation_id`.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import (
    WhatsAppCartSession,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
)
from .services import fetch_templates_from_meta, send_text

logger = logging.getLogger("whatsapp.tasks")


# ─────────────────────────────────────────────────────────────────────────────
# Automation dispatch (best-effort side effect)                         ── NEW
# ─────────────────────────────────────────────────────────────────────────────
def _fire_event(event_name: str, payload: dict) -> None:
    """
    Hand an event to the AI automations dispatcher.

    Never raises. An automation failure must not roll back the inbound
    message write — persisting the customer's message is the important
    part; the automation is a side effect.

    Lazy import: `dashboard.aiandautomations` pulls in catalog,
    account, and checkout models at module load. A top-level import
    would risk a circular dependency the first time Django resolves
    the app registry, and would also slow down cold worker starts.
    """
    try:
        from dashboard.aiandautomations.services.automations import dispatch
        dispatch(event_name, payload)
    except Exception:
        logger.exception(
            "Automation dispatch failed for event %s", event_name,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Inbound processing
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="whatsapp.tasks.process_whatsapp_event", bind=True,
             autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def process_whatsapp_event(self, data: dict) -> str:
    """Entry point called from the webhook view. Never inline."""
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                _handle_messages(value)
                _handle_statuses(value)
        return "ok"
    except Exception as exc:
        logger.exception("Failed to process WhatsApp event: %s", exc)
        raise


def _handle_messages(value: dict) -> None:
    for msg in value.get("messages", []):
        wa_id = msg.get("from")
        if not wa_id:
            continue

        profile_name = (
            value.get("contacts", [{}])[0].get("profile", {}).get("name", "")
            if value.get("contacts") else ""
        )

        # `contact_created` is the dedup anchor for `customer.first_message`.
        # On a Celery retry (up to 3 attempts), get_or_create returns
        # created=False and the automation does not re-fire — the
        # customer is not welcomed twice.
        contact, contact_created = WhatsAppContact.objects.get_or_create(
            wa_id=wa_id,
            defaults={"profile_name": profile_name},
        )
        if profile_name and not contact.profile_name:
            contact.profile_name = profile_name

        contact.last_inbound_at = timezone.now()
        contact.save(update_fields=["last_inbound_at", "profile_name", "updated_at"])

        conversation, _ = WhatsAppConversation.objects.get_or_create(
            contact=contact,
            defaults={"status": "OPEN"},
        )
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=["last_message_at"])

        msg_type = msg.get("type", "unknown")
        body = _extract_body(msg, msg_type)

        WhatsAppMessage.objects.update_or_create(
            wa_message_id=msg.get("id"),
            defaults={
                "conversation": conversation,
                "direction": "IN",
                "type": msg_type,
                "body": body,
                "payload": msg,
                "status": "DELIVERED",
                "timestamp": timezone.now(),
            },
        )

        # ── Automation: customer.first_message ─────────────────────
        # Fire only for the FIRST message from this wa_id. The
        # `contact_created` flag makes this idempotent across Celery
        # retries.
        #
        # Fires AFTER the message row exists so any automation that
        # wants to reply can look up context by `conversation_id`
        # without racing the write.
        #
        # `customer_id` is None for contacts that have not been
        # linked to a Django user. The "Welcome Message" automation
        # should use `wa_id` / `conversation_id` — a first-time
        # WhatsApp sender has almost never signed up on the site.
        if contact_created:
            _fire_event(
                "customer.first_message",
                {
                    "customer_id": contact.user_id,
                    "wa_id": contact.wa_id,
                    "contact_id": contact.pk,
                    "conversation_id": conversation.pk,
                    "profile_name": contact.profile_name,
                },
            )

        # Route to bot (single-branch for now)
        _route_inbound(contact, msg)


def _handle_statuses(value: dict) -> None:
    for st in value.get("statuses", []):
        wa_message_id = st.get("id")
        status = st.get("status", "").upper()
        if not wa_message_id or not status:
            continue

        update = {"status": status if status in {"SENT", "DELIVERED", "READ", "FAILED"} else "SENT"}
        if status == "FAILED":
            errors = st.get("errors") or []
            if errors:
                update["error_message"] = str(errors[0])

        WhatsAppMessage.objects.filter(wa_message_id=wa_message_id).update(**update)

        if status in {"DELIVERED", "READ"}:
            WhatsAppCartSession.objects.filter(wa_message_id=wa_message_id).update(
                status=status
            )


def _extract_body(msg: dict, msg_type: str) -> str:
    if msg_type == "text":
        return msg.get("text", {}).get("body", "")
    if msg_type == "interactive":
        inter = msg.get("interactive", {})
        if inter.get("type") == "button_reply":
            return inter["button_reply"].get("title", "")
        if inter.get("type") == "list_reply":
            return inter["list_reply"].get("title", "")
    if msg_type in {"image", "video", "audio", "document", "sticker"}:
        return f"[{msg_type}]"
    if msg_type == "location":
        loc = msg.get("location", {})
        return f"[location: {loc.get('latitude')},{loc.get('longitude')}]"
    return f"[{msg_type}]"


# ─────────────────────────────────────────────────────────────────────────────
# Bot router (v1: keyword-based, swap for LLM later)
# ─────────────────────────────────────────────────────────────────────────────

def _route_inbound(contact: WhatsAppContact, msg: dict) -> None:
    """Very small dispatcher. Extend per intent."""
    if msg.get("type") != "text":
        return

    text = (msg.get("text") or {}).get("body", "").strip().lower()
    if not text:
        return

    if any(k in text for k in ("stop", "unsubscribe")):
        contact.opt_in_status = "UNSUBSCRIBED"
        contact.save(update_fields=["opt_in_status", "updated_at"])
        send_text(contact.wa_id, "You have been unsubscribed. Reply START to resubscribe.")
        return

    if any(k in text for k in ("cart", "my order", "checkout")):
        send_text(
            contact.wa_id,
            "To resume your cart, please visit our store — or reply HELP to reach a human.",
        )
        return

    if any(k in text for k in ("human", "agent", "help")):
        WhatsAppConversation.objects.filter(
            contact=contact, status="OPEN"
        ).update(status="PENDING")
        send_text(contact.wa_id, "Connecting you to our team. Please hold on.")
        return


# ─────────────────────────────────────────────────────────────────────────────
# Outbound
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="whatsapp.tasks.send_whatsapp_message", bind=True,
             autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_whatsapp_message(self, to: str, body: str) -> str:
    send_text(to, body)
    return "sent"


@shared_task(name="whatsapp.tasks.send_broadcast_batch")
def send_broadcast_batch(contact_ids: list[int], template_name: str) -> str:
    """Stub for now — wire when Broadcasts admin is connected."""
    logger.info("Broadcast '%s' queued for %d contacts", template_name, len(contact_ids))
    return "queued"


# ─────────────────────────────────────────────────────────────────────────────
# Housekeeping (beat)
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="whatsapp.tasks.expire_cart_sessions")
def expire_cart_sessions() -> int:
    now = timezone.now()
    updated = WhatsAppCartSession.objects.filter(
        expires_at__lt=now,
        status__in=["CREATED", "SENT", "DELIVERED", "READ", "OPENED"],
    ).update(status="EXPIRED")
    if updated:
        logger.info("Expired %d WhatsApp cart sessions", updated)
    return updated


@shared_task(name="whatsapp.tasks.refresh_template_statuses")
def refresh_template_statuses() -> int:
    try:
        rows = fetch_templates_from_meta()
    except Exception as exc:
        logger.warning("Template sync failed: %s", exc)
        return 0

    if not rows:
        return 0

    synced = 0
    for row in rows:
        WhatsAppTemplate.objects.update_or_create(
            name=row.get("name", ""),
            language=row.get("language", settings.WHATSAPP_DEFAULT_TEMPLATE_LANG),
            defaults={
                "category": (row.get("category") or "UTILITY").upper(),
                "status": (row.get("status") or "PENDING").upper(),
                "quality": ((row.get("quality_score") or {}).get("score") or "UNKNOWN").upper(),
                "components": row.get("components", []),
                "meta_template_id": row.get("id", ""),
                "last_synced_at": timezone.now(),
            },
        )
        synced += 1
    logger.info("Synced %d templates from Meta", synced)
    return synced


@shared_task(name="whatsapp.tasks.check_token_expiry")
def check_token_expiry() -> str:
    from .models import WhatsAppAccount

    acc = WhatsAppAccount.get_active()
    expires = acc.token_expires_at if acc else None
    if not expires:
        return "no expiry set"

    days_left = (expires - timezone.now().date()).days
    if days_left <= 7:
        logger.warning("WhatsApp access token expires in %d days", days_left)
    return f"{days_left} days left"