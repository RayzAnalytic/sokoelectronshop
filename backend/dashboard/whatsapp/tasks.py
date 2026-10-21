from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import requests
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from . import services
from .models import (
    WhatsAppAccount,
    WhatsAppAutomation,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppMessage,
    WhatsAppNotification,
    WhatsAppOrder,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)

logger = logging.getLogger("whatsapp")

STATUS_ORDER = {"QUEUED": 0, "SENT": 1, "DELIVERED": 2, "READ": 3, "FAILED": -1}


def _dry_run() -> bool:
    return bool(getattr(settings, "WHATSAPP_DRY_RUN", True))


def _meta_post(path: str, payload: dict) -> dict:
    if _dry_run():
        logger.info("META[DRY] POST %s payload=%s", path, _short(payload))
        return {
            "messages": [{"id": f"wamid.mock.{uuid.uuid4().hex[:20]}"}],
            "dry_run": True,
        }

    token = getattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    base = getattr(settings, "META_GRAPH_BASE_URL", "https://graph.facebook.com/v20.0")
    url = f"{base.rstrip('/')}{path}"
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Meta request failed: {exc}") from exc

    if resp.status_code >= 400:
        raise RuntimeError(f"Meta {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()
    except ValueError:
        return {}


def _meta_get(path: str, params: dict | None = None) -> dict:
    if _dry_run():
        logger.info("META[DRY] GET %s params=%s", path, params or {})
        return {"data": [], "dry_run": True}
    token = getattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    base = getattr(settings, "META_GRAPH_BASE_URL", "https://graph.facebook.com/v20.0")
    url = f"{base.rstrip('/')}{path}"
    try:
        resp = requests.get(
            url,
            params=params or {},
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Meta request failed: {exc}") from exc
    if resp.status_code >= 400:
        raise RuntimeError(f"Meta {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()
    except ValueError:
        return {}


def _short(obj, limit: int = 240) -> str:
    text = repr(obj)
    return text if len(text) <= limit else text[: limit - 3] + "..."


def _verify_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    secret = getattr(settings, "META_APP_SECRET", "")
    if not secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature_header.split("=", 1)[1], expected)


def _normalize_phone(raw: str | None) -> str:
    return "".join(c for c in (raw or "") if c.isdigit())


def _iso_ts(raw) -> datetime:
    if not raw:
        return timezone.now()
    try:
        return datetime.fromtimestamp(int(raw), tz=timezone.utc)
    except (ValueError, TypeError):
        return timezone.now()


def _get_or_create_contact(wa_id: str, profile_name: str = "") -> WhatsAppContact:
    contact, created = WhatsAppContact.objects.get_or_create(
        wa_id=wa_id,
        defaults={
            "profile_name": profile_name or "",
            "opt_in_source": "INBOUND",
            "opt_in_at": timezone.now(),
            "opt_in_status": "SUBSCRIBED",
        },
    )
    if not created and profile_name and contact.profile_name != profile_name:
        contact.profile_name = profile_name
        contact.save(update_fields=["profile_name", "updated_at"])
    return contact


def _get_or_create_conversation(contact: WhatsAppContact) -> WhatsAppConversation:
    conv = (
        WhatsAppConversation.objects.filter(contact=contact)
        .exclude(status="RESOLVED")
        .order_by("-last_message_at", "-id")
        .first()
    )
    if conv:
        return conv
    prefs = WhatsAppSettings.get_solo()
    return WhatsAppConversation.objects.create(
        contact=contact,
        status="OPEN",
        sla_first_response_due_at=timezone.now()
        + timedelta(minutes=prefs.sla_first_response_min or 15),
        sla_resolution_due_at=timezone.now()
        + timedelta(minutes=prefs.sla_resolution_min or 240),
    )


def _touch_conversation(
    conv: WhatsAppConversation, preview: str, *, inbound: bool = False
) -> None:
    now = timezone.now()
    conv.last_message_preview = (preview or "")[:255]
    conv.last_message_at = now
    fields = ["last_message_preview", "last_message_at", "updated_at"]
    if inbound:
        conv.last_inbound_at = now
        conv.unread_count = (conv.unread_count or 0) + 1
        fields.append("last_inbound_at")
        fields.append("unread_count")
        if conv.first_message_at is None:
            conv.first_message_at = now
            fields.append("first_message_at")
    conv.save(update_fields=fields)


def _match_opt_out(body: str, keywords: list[str]) -> bool:
    normalized = (body or "").strip().upper()
    return normalized in {k.strip().upper() for k in (keywords or []) if k}


def _template_body(template_name: str, params: list[str]) -> dict:
    return {
        "name": template_name,
        "language": {"code": getattr(settings, "WHATSAPP_TPL_DEFAULT_LANG", "en")},
        "components": [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in (params or [])],
            }
        ]
        if params
        else [],
    }


def _format_outbound_payload(
    to_phone: str,
    msg_type: str,
    *,
    body: str = "",
    template_name: str = "",
    template_params: list[str] | None = None,
    media_url: str = "",
    media_id: str = "",
    filename: str = "",
    interactive_buttons: list[dict] | None = None,
) -> dict:
    base = {"messaging_product": "whatsapp", "recipient_type": "individual", "to": to_phone}
    if msg_type == "text":
        return {**base, "type": "text", "text": {"preview_url": False, "body": body}}
    if msg_type == "template":
        return {
            **base,
            "type": "template",
            "template": _template_body(template_name, template_params or []),
        }
    if msg_type in ("image", "video", "document", "audio"):
        media_obj = {"id": media_id} if media_id else {"link": media_url}
        if body and msg_type != "audio":
            media_obj["caption"] = body
        if filename and msg_type == "document":
            media_obj["filename"] = filename
        return {**base, "type": msg_type, msg_type: media_obj}
    if msg_type == "interactive":
        buttons = [
            {"type": "reply", "reply": {"id": b["id"], "title": b["label"][:20]}}
            for b in (interactive_buttons or [])
        ][:3]
        return {
            **base,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {"buttons": buttons},
            },
        }
    return {**base, "type": "text", "text": {"body": body or f"[{msg_type}]"}}


def _dispatch_outbound_message(message: WhatsAppMessage) -> dict:
    conv = message.conversation
    contact = conv.contact
    payload = _format_outbound_payload(
        _normalize_phone(contact.wa_id),
        message.type,
        body=message.body,
        template_name=message.template_name,
        template_params=message.template_params,
        media_url=message.media_url,
        media_id=message.media_id,
        filename=message.filename,
        interactive_buttons=message.interactive_buttons,
    )
    path = f"/{getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')}/messages"
    return _meta_post(path, payload)


def _send_via_meta(
    *,
    contact: WhatsAppContact,
    conv: WhatsAppConversation,
    msg_type: str,
    body: str = "",
    template_name: str = "",
    template_params: list[str] | None = None,
    media_url: str = "",
    media_id: str = "",
    filename: str = "",
    interactive_buttons: list[dict] | None = None,
) -> WhatsAppMessage:
    message = WhatsAppMessage.objects.create(
        conversation=conv,
        direction="OUT",
        type=msg_type,
        body=body or template_name or f"[{msg_type}]",
        status="QUEUED",
        timestamp=timezone.now(),
        template_name=template_name,
        template_params=template_params or [],
        media_url=media_url,
        media_id=media_id,
        filename=filename,
        interactive_buttons=interactive_buttons or [],
    )
    try:
        result = _dispatch_outbound_message(message)
        wamids = result.get("messages") or []
        message.wa_message_id = wamids[0]["id"] if wamids else ""
        message.status = "SENT"
        message.save(update_fields=["wa_message_id", "status", "updated_at"])
    except Exception as exc:
        message.status = "FAILED"
        message.error_message = str(exc)[:500]
        message.save(update_fields=["status", "error_message", "updated_at"])
        raise
    _touch_conversation(conv, body or template_name or f"[{msg_type}]", inbound=False)
    return message


def _resolve_audience_contacts(broadcast: WhatsAppBroadcast) -> list[int]:
    qs = WhatsAppContact.objects.filter(opt_in_status="SUBSCRIBED", is_blocked=False)
    if broadcast.segment_id:
        seg = WhatsAppSegment.objects.filter(pk=broadcast.segment_id).first()
        if seg and seg.rules:
            for rule in seg.rules:
                field = rule.get("field")
                op = rule.get("op", "eq")
                value = rule.get("value")
                if field == "tag" and op == "eq":
                    qs = qs.filter(tags__contains=[value])
                elif field == "tag" and op == "neq":
                    qs = qs.exclude(tags__contains=[value])
                elif field == "order_count" and op == "gt":
                    qs = qs.filter(order_count__gt=int(value or 0))
                elif field == "total_spent" and op == "gt":
                    qs = qs.filter(total_spent__gt=Decimal(str(value or 0)))
    return list(qs.values_list("id", flat=True))


def _process_inbound_messages(change_value: dict) -> None:
    contacts_meta = change_value.get("contacts") or []
    name_by_wa: dict[str, str] = {}
    for c in contacts_meta:
        wa_id = _normalize_phone(c.get("wa_id"))
        profile = c.get("profile") or {}
        name_by_wa[wa_id] = profile.get("name") or ""

    prefs = WhatsAppSettings.get_solo()

    for m in change_value.get("messages") or []:
        wa_from = _normalize_phone(m.get("from"))
        if not wa_from:
            continue
        profile_name = name_by_wa.get(wa_from, "")
        contact = _get_or_create_contact(wa_from, profile_name)
        contact.last_inbound_at = timezone.now()
        contact.save(update_fields=["last_inbound_at", "updated_at"])
        conv = _get_or_create_conversation(contact)

        msg_type = m.get("type") or "text"
        body = ""
        media_id = ""
        mime_type = ""
        filename = ""
        interactive_buttons: list[dict] = []
        product_refs: list[dict] = []

        if msg_type == "text":
            body = (m.get("text") or {}).get("body") or ""
        elif msg_type in ("image", "video", "audio", "document", "sticker"):
            media = m.get(msg_type) or {}
            media_id = media.get("id") or ""
            mime_type = media.get("mime_type") or ""
            filename = media.get("filename") or ""
            body = media.get("caption") or ""
        elif msg_type == "button":
            btn = m.get("button") or {}
            body = btn.get("text") or ""
            interactive_buttons = [
                {"id": btn.get("payload") or "", "label": btn.get("text") or ""}
            ]
        elif msg_type == "interactive":
            interactive = m.get("interactive") or {}
            reply = interactive.get(interactive.get("type") or "") or {}
            body = reply.get("title") or ""
            interactive_buttons = [{"id": reply.get("id") or "", "label": reply.get("title") or ""}]
        elif msg_type == "order":
            order = m.get("order") or {}
            product_refs = order.get("product_items") or []
            body = "[order]"
        elif msg_type == "location":
            loc = m.get("location") or {}
            body = f"📍 {loc.get('latitude')},{loc.get('longitude')}"
        else:
            body = f"[{msg_type}]"

        WhatsAppMessage.objects.create(
            conversation=conv,
            wa_message_id=m.get("id") or "",
            direction="IN",
            type=msg_type,
            body=body,
            status="DELIVERED",
            timestamp=_iso_ts(m.get("timestamp")),
            media_id=media_id,
            mime_type=mime_type,
            filename=filename,
            interactive_buttons=interactive_buttons,
            product_refs=product_refs,
        )
        _touch_conversation(conv, body or f"[{msg_type}]", inbound=True)

        if _match_opt_out(body, prefs.opt_out_keywords or []):
            contact.opt_in_status = "UNSUBSCRIBED"
            contact.save(update_fields=["opt_in_status", "updated_at"])
            try:
                _send_via_meta(
                    contact=contact,
                    conv=conv,
                    msg_type="text",
                    body="You have been unsubscribed. Reply START to resubscribe.",
                )
            except Exception:
                logger.exception("Opt-out confirmation failed for %s", wa_from)
            continue

        if msg_type == "order":
            order = m.get("order") or {}
            items = order.get("product_items") or []
            total = Decimal("0.00")
            normalized: list[dict] = []
            for it in items:
                price = Decimal(str(it.get("item_price") or "0"))
                qty = int(it.get("quantity") or 1)
                total += price * qty
                normalized.append(
                    {
                        "name": it.get("product_retailer_id") or "",
                        "qty": qty,
                        "price": str(price),
                        "currency": it.get("currency") or "KES",
                    }
                )
            WhatsAppOrder.objects.create(
                order_number=f"WA-{int(timezone.now().timestamp())}-{conv.pk}",
                contact=contact,
                contact_name=profile_name or contact.wa_id,
                contact_wa_id=contact.wa_id,
                conversation=conv,
                items=normalized,
                subtotal=total,
                total=total,
                currency="KES",
                status="PENDING",
            )
            WhatsAppNotification.objects.create(
                type="order",
                title="New WhatsApp order",
                body=f"{profile_name or contact.wa_id} placed an order.",
                link_tab="Orders",
                payload={"contact_id": contact.pk, "conversation_id": conv.pk},
            )

        if (
            getattr(settings, "WHATSAPP_BOT_ENABLED", False)
            and not conv.bot_paused
            and msg_type in ("text", "interactive", "button")
        ):
            try:
                run_bot_flow.delay(conv.pk, body)
            except Exception:
                logger.exception("Failed to enqueue bot flow")

        try:
            dispatch_automations_for_event.delay(conv.pk, "MESSAGE_RECEIVED")
        except Exception:
            logger.exception("Failed to enqueue automation dispatch")


def _process_statuses(change_value: dict) -> None:
    for st in change_value.get("statuses") or []:
        wamid = st.get("id")
        new = (st.get("status") or "").upper()
        if not wamid or new not in STATUS_ORDER:
            continue
        msg = WhatsAppMessage.objects.filter(wa_message_id=wamid).first()
        if not msg:
            continue
        current_rank = STATUS_ORDER.get(msg.status, -1)
        new_rank = STATUS_ORDER.get(new, -1)
        if new_rank > current_rank:
            msg.status = new
            if new == "FAILED":
                errors = st.get("errors") or []
                if errors:
                    msg.error_message = (
                        errors[0].get("title") or errors[0].get("message") or ""
                    )[:500]
            msg.save(update_fields=["status", "error_message", "updated_at"])


def _process_template_status(change_value: dict) -> None:
    event = (
        change_value.get("message_template_status_update")
        or change_value.get("event")
        or {}
    )
    name = event.get("message_template_name") or ""
    lang = event.get("message_template_language") or "en"
    new_status = (event.get("event") or "").upper()
    reason = event.get("reason") or ""
    if not name or new_status not in dict(WhatsAppTemplate.STATUS_CHOICES):
        return
    tpl = WhatsAppTemplate.objects.filter(name=name, language=lang).first()
    if tpl:
        tpl.status = new_status
        tpl.rejection_reason = reason
        tpl.last_synced_at = timezone.now()
        tpl.save(update_fields=["status", "rejection_reason", "last_synced_at"])


def _process_catalog_status(change_value: dict) -> None:
    for item in change_value.get("product_catalog_status_update") or []:
        retailer_id = item.get("retailer_id") or ""
        status_value = (item.get("status") or "").upper()
        reason = item.get("reason") or ""
        if not retailer_id:
            continue
        qs = WhatsAppCatalogItem.objects.filter(retailer_id=retailer_id)
        if status_value == "APPROVED":
            qs.update(
                sync_status="SYNCED",
                review_status="APPROVED",
                last_error="",
                last_synced_at=timezone.now(),
            )
        elif status_value == "REJECTED":
            qs.update(
                sync_status="REJECTED",
                review_status="REJECTED",
                rejection_reason=reason,
                last_error=reason,
            )


def _dispatch_change_field(field: str, value: dict) -> None:
    if field == "messages":
        _process_inbound_messages(value)
    elif field == "message_status":
        _process_statuses(value)
    elif field == "message_template_status_update":
        _process_template_status(value)
    elif field == "message_template_quality_update":
        _process_template_status(value)
    elif field == "product_catalog_status_update":
        _process_catalog_status(value)
    elif field == "orders":
        _process_inbound_messages(value)
    else:
        logger.debug("Unhandled webhook field: %s", field)


@shared_task(name="dashboard.whatsapp.tasks.process_whatsapp_event", bind=True, max_retries=5, default_retry_delay=30)
def process_whatsapp_event(self, event_id: int):
    event = WhatsAppWebhookEvent.objects.filter(pk=event_id).first()
    if not event:
        return f"event:{event_id}:missing"
    try:
        with transaction.atomic():
            payload = event.payload or {}
            for entry in payload.get("entry") or []:
                for change in entry.get("changes") or []:
                    field = change.get("field") or ""
                    value = change.get("value") or {}
                    _dispatch_change_field(field, value)
            event.status = "DELIVERED"
            event.error = ""
            event.save(update_fields=["status", "error", "received_at"])
        return f"event:{event_id}:ok"
    except Exception as exc:
        logger.exception("Webhook processing failed for event %s", event_id)
        event.attempts = (event.attempts or 1) + 1
        event.error = str(exc)[:500]
        event.status = "RETRYING" if event.attempts < 5 else "FAILED"
        event.save(update_fields=["attempts", "error", "status"])
        raise self.retry(exc=exc)


@shared_task(
    name="dashboard.whatsapp.tasks.send_whatsapp_message",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(RuntimeError,),
    retry_backoff=True,
)
def send_whatsapp_message(self, message_id: int):
    message = (
        WhatsAppMessage.objects.select_related("conversation__contact")
        .filter(pk=message_id)
        .first()
    )
    if not message:
        return f"message:{message_id}:missing"
    if message.status in ("SENT", "DELIVERED", "READ"):
        return f"message:{message_id}:already_sent"
    try:
        result = _dispatch_outbound_message(message)
        wamids = result.get("messages") or []
        message.wa_message_id = wamids[0]["id"] if wamids else message.wa_message_id
        message.status = "SENT"
        message.error_message = ""
        message.save(update_fields=["wa_message_id", "status", "error_message", "updated_at"])
        return f"message:{message_id}:sent"
    except Exception as exc:
        logger.exception("Send failed for message %s", message_id)
        message.status = "FAILED"
        message.error_message = str(exc)[:500]
        message.save(update_fields=["status", "error_message", "updated_at"])
        raise self.retry(exc=exc)


BROADCAST_BATCH_SIZE = 50


@shared_task(name="dashboard.whatsapp.tasks.send_broadcast_batch")
def send_broadcast_batch(broadcast_id: int, offset: int = 0, batch_size: int = BROADCAST_BATCH_SIZE):
    bcast = WhatsAppBroadcast.objects.filter(pk=broadcast_id).select_related("template").first()
    if not bcast:
        return f"broadcast:{broadcast_id}:missing"
    if bcast.status not in ("SENDING", "SCHEDULED", "DRAFT"):
        return f"broadcast:{broadcast_id}:status_{bcast.status}"

    if not bcast.template:
        bcast.status = "FAILED"
        bcast.last_error = "No template attached"
        bcast.save(update_fields=["status", "last_error", "updated_at"])
        return f"broadcast:{broadcast_id}:no_template"

    recipient_ids = _resolve_audience_contacts(bcast)
    total = len(recipient_ids)
    if total == 0:
        bcast.status = "COMPLETED"
        bcast.audience_count = 0
        bcast.completed_at = timezone.now()
        bcast.save(update_fields=["status", "audience_count", "completed_at", "updated_at"])
        return f"broadcast:{broadcast_id}:empty"

    bcast.audience_count = total
    bcast.status = "SENDING"
    if not bcast.sent_at:
        bcast.sent_at = timezone.now()
    bcast.save(update_fields=["audience_count", "status", "sent_at", "updated_at"])

    chunk = recipient_ids[offset : offset + batch_size]
    delivered = 0
    failed = 0
    for contact_id in chunk:
        contact = WhatsAppContact.objects.filter(pk=contact_id).first()
        if not contact:
            failed += 1
            continue
        conv = _get_or_create_conversation(contact)
        params = list((bcast.variable_mapping or {}).get("params") or [])
        try:
            _send_via_meta(
                contact=contact,
                conv=conv,
                msg_type="template",
                template_name=bcast.template.name,
                template_params=params,
            )
            delivered += 1
        except Exception:
            logger.exception("Broadcast delivery failed for contact %s", contact_id)
            failed += 1

    WhatsAppBroadcast.objects.filter(pk=broadcast_id).update(
        delivered=F("delivered") + delivered,
        failed=F("failed") + failed,
        recipients=F("recipients") + len(chunk),
    )

    new_offset = offset + batch_size
    if new_offset < total:
        send_broadcast_batch.apply_async(
            args=[broadcast_id, new_offset, batch_size],
            countdown=2,
        )
        return f"broadcast:{broadcast_id}:batch offset={offset} next={new_offset}"

    WhatsAppBroadcast.objects.filter(pk=broadcast_id).update(
        status="COMPLETED", completed_at=timezone.now()
    )
    return f"broadcast:{broadcast_id}:done recipients={total}"


@shared_task(name="dashboard.whatsapp.tasks.sync_catalog")
def sync_catalog():
    catalog = WhatsAppCatalog.get_solo()

    try:
        services.sync_catalog(catalog)
        catalog.refresh_from_db()
    except Exception:
        logger.exception("catalog.Product sync failed")

    try:
        items = WhatsAppCatalogItem.objects.filter(catalog=catalog, is_removed=False)
        pushed = 0
        failed = 0
        for item in items:
            if not item.eligible or item.is_price_hidden:
                continue
            payload = {
                "retailer_id": item.retailer_id,
                "name": item.resolved_display_title[:200],
                "description": item.resolved_display_description[:1000],
                "price": int((item.effective_price or Decimal("0")) * 100),
                "currency": item.currency,
                "availability": "in stock" if item.in_stock else "out of stock",
                "image_url": item.display_image_url,
            }
            try:
                _meta_post(
                    f"/{getattr(settings, 'WHATSAPP_WABA_ID', '')}/product_catalog_sync",
                    payload,
                )
                WhatsAppCatalogItem.objects.filter(pk=item.pk).update(
                    sync_status="SYNCED",
                    last_synced_at=timezone.now(),
                    last_error="",
                )
                pushed += 1
            except Exception as exc:
                logger.exception("Catalog push failed for %s", item.retailer_id)
                WhatsAppCatalogItem.objects.filter(pk=item.pk).update(
                    sync_status="FAILED",
                    last_error=str(exc)[:500],
                )
                failed += 1

        catalog.last_full_sync_at = timezone.now()
        catalog.last_sync_updated = pushed
        catalog.last_sync_failed = failed
        catalog.last_error = ""
        catalog.save(
            update_fields=[
                "last_full_sync_at",
                "last_sync_updated",
                "last_sync_failed",
                "last_error",
                "updated_at",
            ]
        )
        return f"catalog:synced pushed={pushed} failed={failed}"
    except Exception as exc:
        logger.exception("Catalog sync failed")
        catalog.last_error = str(exc)[:500]
        catalog.save(update_fields=["last_error", "updated_at"])
        raise


@shared_task(name="dashboard.whatsapp.tasks.refresh_template_statuses")
def refresh_template_statuses():
    waba = getattr(settings, "WHATSAPP_WABA_ID", "")
    if not waba:
        return "templates:skipped"
    try:
        data = _meta_get(
            f"/{waba}/message_templates",
            params={"fields": "id,name,language,status,rejected_reason,quality_score"},
        )
    except Exception:
        logger.exception("Template refresh failed")
        return "templates:error"

    updated = 0
    for row in data.get("data") or []:
        name = row.get("name")
        lang = row.get("language")
        if not name:
            continue
        tpl = WhatsAppTemplate.objects.filter(name=name, language=lang).first()
        if not tpl:
            continue
        status_value = (row.get("status") or "").upper()
        if status_value in dict(WhatsAppTemplate.STATUS_CHOICES):
            tpl.status = status_value
        tpl.quality = row.get("quality_score") or tpl.quality
        tpl.rejection_reason = row.get("rejected_reason") or ""
        tpl.meta_template_id = row.get("id") or tpl.meta_template_id
        tpl.last_synced_at = timezone.now()
        tpl.save(
            update_fields=[
                "status",
                "quality",
                "rejection_reason",
                "meta_template_id",
                "last_synced_at",
                "updated_at",
            ]
        )
        updated += 1
    return f"templates:updated={updated}"


@shared_task(name="dashboard.whatsapp.tasks.check_token_expiry")
def check_token_expiry():
    account = WhatsAppAccount.get_solo()
    if not account.token_expires_at:
        return "token:no_expiry"
    days_left = (account.token_expires_at - timezone.now()).days
    if days_left <= 7:
        WhatsAppNotification.objects.create(
            type="system",
            title="WhatsApp access token expiring",
            body=f"Your Meta access token expires in {max(days_left, 0)} day(s). "
            f"Rotate it in Connection settings.",
            link_tab="Connection",
        )
        return f"token:alert days_left={days_left}"
    return "token:ok"


@shared_task(name="dashboard.whatsapp.tasks.refresh_account_status")
def refresh_account_status():
    account = WhatsAppAccount.get_solo()
    waba = getattr(settings, "WHATSAPP_WABA_ID", "")
    phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    if not waba or not phone_id:
        return "account:skipped"
    start = timezone.now()
    try:
        data = _meta_get(
            f"/{phone_id}",
            params={"fields": "quality_rating,messaging_limit_tier,verified_name,display_phone_number"},
        )
        account.quality_score = (data.get("quality_rating") or account.quality_score or "UNKNOWN")
        account.messaging_limit_tier = data.get("messaging_limit_tier") or account.messaging_limit_tier
        account.display_name = data.get("verified_name") or account.display_name
        account.display_phone = data.get("display_phone_number") or account.display_phone
        account.last_synced_at = timezone.now()
        account.last_error = ""
        account.quality_history = (
            (account.quality_history or [])
            + [{"date": timezone.now().isoformat(), "score": account.quality_score}]
        )[-30:]
        account.save(
            update_fields=[
                "quality_score",
                "messaging_limit_tier",
                "display_name",
                "display_phone",
                "last_synced_at",
                "last_error",
                "quality_history",
                "updated_at",
            ]
        )
        WhatsAppHealthCheck.objects.create(
            account=account,
            ok=True,
            latency_ms=int((timezone.now() - start).total_seconds() * 1000),
        )
        return "account:refreshed"
    except Exception as exc:
        logger.exception("Account refresh failed")
        account.last_error = str(exc)[:500]
        account.save(update_fields=["last_error", "updated_at"])
        WhatsAppHealthCheck.objects.create(
            account=account,
            ok=False,
            latency_ms=int((timezone.now() - start).total_seconds() * 1000),
            error=str(exc)[:500],
        )
        return "account:error"


@shared_task(name="dashboard.whatsapp.tasks.expire_cart_sessions")
def expire_cart_sessions():
    ttl_hours = int(getattr(settings, "WHATSAPP_CART_TOKEN_TTL_HOURS", 24))
    cutoff = timezone.now() - timedelta(hours=ttl_hours)
    recovery_template = (getattr(settings, "WHATSAPP_TEMPLATES", {}) or {}).get(
        "CART_RECOVERY", "cart_recovery"
    )
    orders = WhatsAppOrder.objects.filter(status="PENDING", created_at__lt=cutoff)
    sent = 0
    for order in orders:
        if not order.contact:
            continue
        conv = _get_or_create_conversation(order.contact)
        try:
            _send_via_meta(
                contact=order.contact,
                conv=conv,
                msg_type="template",
                template_name=recovery_template,
                template_params=[order.contact_name or order.contact.wa_id, str(order.total)],
            )
            sent += 1
        except Exception:
            logger.exception("Cart recovery send failed for order %s", order.pk)
    return f"carts:recovered={sent}"


@shared_task(name="dashboard.whatsapp.tasks.dispatch_automations_for_event")
def dispatch_automations_for_event(conversation_id: int, trigger: str):
    conv = (
        WhatsAppConversation.objects.select_related("contact")
        .filter(pk=conversation_id)
        .first()
    )
    if not conv:
        return f"automation:{trigger}:no_conversation"
    automations = WhatsAppAutomation.objects.filter(status="ACTIVE", trigger=trigger)
    fired = 0
    for auto in automations:
        if not auto.template:
            continue
        try:
            if auto.delay_minutes and auto.delay_minutes > 0:
                send_automation_message.apply_async(
                    args=[auto.pk, conv.pk], countdown=auto.delay_minutes * 60
                )
            else:
                _run_automation(auto, conv)
            WhatsAppAutomation.objects.filter(pk=auto.pk).update(
                messages_sent=F("messages_sent") + 1,
                last_triggered_at=timezone.now(),
            )
            fired += 1
        except Exception:
            logger.exception("Automation %s failed", auto.pk)
    return f"automation:{trigger}:fired={fired}"


def _run_automation(auto: WhatsAppAutomation, conv: WhatsAppConversation) -> None:
    _send_via_meta(
        contact=conv.contact,
        conv=conv,
        msg_type="template",
        template_name=auto.template.name,
        template_params=[conv.contact.profile_name or conv.contact.wa_id],
    )
    auto.runs = (auto.runs or []) + [
        {
            "id": int(timezone.now().timestamp()),
            "at": timezone.now().isoformat(),
            "status": "DELIVERED",
            "durationMs": 0,
            "error": "",
        }
    ]
    auto.save(update_fields=["runs", "updated_at"])


@shared_task(name="dashboard.whatsapp.tasks.send_automation_message")
def send_automation_message(automation_id: int, conversation_id: int):
    auto = WhatsAppAutomation.objects.filter(pk=automation_id, status="ACTIVE").first()
    conv = WhatsAppConversation.objects.filter(pk=conversation_id).first()
    if not auto or not auto.template or not conv:
        return f"automation:{automation_id}:skip"
    try:
        _run_automation(auto, conv)
        WhatsAppAutomation.objects.filter(pk=automation_id).update(
            messages_sent=F("messages_sent") + 1,
            last_triggered_at=timezone.now(),
        )
        return f"automation:{automation_id}:sent"
    except Exception:
        logger.exception("Automation %s send failed", automation_id)
        return f"automation:{automation_id}:error"


@shared_task(name="dashboard.whatsapp.tasks.run_bot_flow")
def run_bot_flow(conversation_id: int, inbound_body: str):
    from .models import WhatsAppBotFlow, WhatsAppBotNode

    conv = (
        WhatsAppConversation.objects.select_related("contact")
        .filter(pk=conversation_id)
        .first()
    )
    if not conv or conv.bot_paused:
        return "bot:skip"
    flow = WhatsAppBotFlow.get_solo()
    if not flow.is_published:
        return "bot:not_published"
    nodes = {n.key: n for n in flow.nodes.all()}
    entry_key = flow.entry_node_key or (flow.nodes.order_by("order").first().key if flow.nodes.exists() else "")
    if not entry_key or entry_key not in nodes:
        return "bot:no_entry"

    last = (conv.notes or "").strip()

    next_key = entry_key
    if last.startswith("bot:"):
        prev_key = last.split(":", 1)[1].strip()
        prev = nodes.get(prev_key)
        if prev:
            matched = None
            for opt in prev.options or []:
                if (opt.get("label") or "").strip().lower() == inbound_body.strip().lower():
                    matched = opt.get("nextId") or "end"
                    break
            next_key = matched or prev_key
    node = nodes.get(next_key)
    if not node:
        return "bot:no_node"

    if node.kind in ("message", "list"):
        buttons = [
            {"id": o.get("id") or "", "label": o.get("label") or ""}
            for o in (node.options or [])
        ]
        if buttons:
            _send_via_meta(
                contact=conv.contact,
                conv=conv,
                msg_type="interactive",
                body=node.body or node.title,
                interactive_buttons=buttons[:3],
            )
        else:
            _send_via_meta(
                contact=conv.contact,
                conv=conv,
                msg_type="text",
                body=node.body or node.title,
            )
    elif node.kind == "handoff":
        conv.bot_paused = True
        conv.save(update_fields=["bot_paused", "updated_at"])
    elif node.kind == "end":
        conv.notes = ""
        conv.save(update_fields=["notes", "updated_at"])
        return "bot:end"

    conv.notes = f"bot:{node.key}"
    conv.save(update_fields=["notes", "updated_at"])
    return f"bot:node={node.key}"