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
from django.db.models import F
from django.utils import timezone

from . import services
from .models import (
    WhatsAppAccount,
    WhatsAppAttributionEvent,
    WhatsAppAutomation,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppConsentLog,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppIntegrationError,
    WhatsAppMessage,
    WhatsAppMessageLog,
    WhatsAppNotification,
    WhatsAppOrder,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
    WhatsAppWorkflowRun,
)

logger = logging.getLogger("whatsapp")

STATUS_ORDER = {"SENDING": 0, "QUEUED": 0, "SENT": 1, "DELIVERED": 2, "READ": 3, "FAILED": -1}


def _dry_run() -> bool:
    return bool(getattr(settings, "WHATSAPP_DRY_RUN", True))


def _get_token_and_phone() -> tuple[WhatsAppAccount, str, str]:
    account = WhatsAppAccount.get_solo()
    token = account.access_token or getattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    phone_id = account.phone_number_id or getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    return account, token, phone_id


def _record_api_error(account: WhatsAppAccount, message: str, kind: str = "api", detail: dict | None = None):
    WhatsAppIntegrationError.objects.create(
        account=account,
        kind=kind,
        message=message[:1000],
        detail=detail or {},
    )
    if kind in ("api", "rate_limit"):
        account.api_status = "degraded"
        account.last_error = message[:500]
        account.save(update_fields=["api_status", "last_error", "updated_at"])


def _meta_post(path: str, payload: dict) -> dict:
    account, token, _ = _get_token_and_phone()
    if _dry_run():
        logger.info("META[DRY] POST %s payload=%s", path, _short(payload))
        account.last_api_request_at = timezone.now()
        account.api_status = "ok"
        account.save(update_fields=["last_api_request_at", "api_status", "updated_at"])
        return {
            "messages": [{"id": f"wamid.mock.{uuid.uuid4().hex[:20]}"}],
            "dry_run": True,
        }

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
        _record_api_error(account, f"Meta request failed: {exc}")
        raise RuntimeError(f"Meta request failed: {exc}") from exc

    if resp.status_code >= 400:
        kind = "rate_limit" if resp.status_code == 429 else "api"
        msg = f"Meta {resp.status_code}: {resp.text[:300]}"
        _record_api_error(account, msg, kind=kind, detail={"status_code": resp.status_code})
        raise RuntimeError(msg)

    account.last_api_request_at = timezone.now()
    account.api_status = "ok"
    account.save(update_fields=["last_api_request_at", "api_status", "updated_at"])
    try:
        return resp.json()
    except ValueError:
        return {}


def _meta_get(path: str, params: dict | None = None) -> dict:
    account, token, _ = _get_token_and_phone()
    if _dry_run():
        logger.info("META[DRY] GET %s params=%s", path, params or {})
        account.last_api_request_at = timezone.now()
        account.api_status = "ok"
        account.save(update_fields=["last_api_request_at", "api_status", "updated_at"])
        return {"data": [], "dry_run": True}

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
        _record_api_error(account, f"Meta request failed: {exc}")
        raise RuntimeError(f"Meta request failed: {exc}") from exc

    if resp.status_code >= 400:
        kind = "rate_limit" if resp.status_code == 429 else "api"
        msg = f"Meta {resp.status_code}: {resp.text[:300]}"
        _record_api_error(account, msg, kind=kind, detail={"status_code": resp.status_code})
        raise RuntimeError(msg)

    account.last_api_request_at = timezone.now()
    account.api_status = "ok"
    account.save(update_fields=["last_api_request_at", "api_status", "updated_at"])
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
    now = timezone.now()
    contact, created = WhatsAppContact.objects.get_or_create(
        wa_id=wa_id,
        defaults={
            "profile_name": profile_name or "",
            "opt_in_source": "INBOUND",
            "opt_in_at": now,
            "opt_in_status": "SUBSCRIBED",
        },
    )
    if created:
        WhatsAppConsentLog.objects.create(
            contact=contact,
            action="opt_in",
            source="INBOUND",
            recorded_at=now,
        )
    elif profile_name and contact.profile_name != profile_name:
        contact.profile_name = profile_name
        contact.save(update_fields=["profile_name", "updated_at"])
    return contact


def _get_or_create_conversation(contact: WhatsAppContact) -> WhatsAppConversation:
    conv = (
        WhatsAppConversation.objects.filter(contact=contact)
        .exclude(status__in=["RESOLVED", "ARCHIVED"])
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
        fields.extend(["last_inbound_at", "unread_count"])
        if conv.first_message_at is None:
            conv.first_message_at = now
            fields.append("first_message_at")
    else:
        if conv.first_response_at is None:
            conv.first_response_at = now
            fields.append("first_response_at")
    conv.save(update_fields=fields)


def _match_opt_out(body: str, keywords: list[str]) -> bool:
    normalized = (body or "").strip().upper()
    return normalized in {k.strip().upper() for k in (keywords or []) if k}


def _template_body(template_name: str, params: list[str], language: str = "en") -> dict:
    return {
        "name": template_name,
        "language": {"code": language or getattr(settings, "WHATSAPP_TPL_DEFAULT_LANG", "en")},
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
    template_language: str = "en",
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
            "template": _template_body(template_name, template_params or [], template_language),
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
    _, _, phone_id = _get_token_and_phone()
    tpl_lang = message.template.language if message.template else "en"
    payload = _format_outbound_payload(
        _normalize_phone(contact.wa_id),
        message.type,
        body=message.body,
        template_name=message.template_name,
        template_params=message.template_params,
        template_language=tpl_lang,
        media_url=message.media_url,
        media_id=message.media_id,
        filename=message.filename,
        interactive_buttons=message.interactive_buttons,
    )
    path = f"/{phone_id}/messages"
    return _meta_post(path, payload)


def _send_via_meta(
    *,
    contact: WhatsAppContact,
    conv: WhatsAppConversation,
    msg_type: str,
    body: str = "",
    template: WhatsAppTemplate | None = None,
    template_name: str = "",
    template_params: list[str] | None = None,
    media_url: str = "",
    media_id: str = "",
    filename: str = "",
    interactive_buttons: list[dict] | None = None,
    campaign: WhatsAppBroadcast | None = None,
) -> WhatsAppMessage:
    now = timezone.now()
    tpl_name = template_name or (template.name if template else "")
    message = WhatsAppMessage.objects.create(
        conversation=conv,
        direction="OUT",
        type=msg_type,
        body=body or tpl_name or f"[{msg_type}]",
        status="QUEUED",
        timestamp=now,
        template=template,
        template_name=tpl_name,
        template_params=template_params or [],
        media_url=media_url,
        media_id=media_id,
        filename=filename,
        interactive_buttons=interactive_buttons or [],
    )
    log_category = (template.category.lower() if template else "utility")
    try:
        result = _dispatch_outbound_message(message)
        wamids = result.get("messages") or []
        message.wa_message_id = wamids[0]["id"] if wamids else ""
        message.status = "SENT"
        message.save(update_fields=["wa_message_id", "status", "updated_at"])

        WhatsAppMessageLog.objects.create(
            message=message,
            wa_message_id=message.wa_message_id,
            contact=contact,
            recipient=contact.wa_id,
            customer_name=contact.profile_name or "",
            template=template,
            template_name=tpl_name,
            category=log_category,
            campaign=campaign,
            status="sent",
            sent_at=now,
        )
    except Exception as exc:
        err = str(exc)[:500]
        message.status = "FAILED"
        message.error_message = err
        message.save(update_fields=["status", "error_message", "updated_at"])

        WhatsAppMessageLog.objects.create(
            message=message,
            wa_message_id=message.wa_message_id,
            contact=contact,
            recipient=contact.wa_id,
            customer_name=contact.profile_name or "",
            template=template,
            template_name=tpl_name,
            category=log_category,
            campaign=campaign,
            status="failed",
            failure_reason=err,
            sent_at=now,
        )
        WhatsAppNotification.objects.create(
            type="failed_message",
            title="Message delivery failed",
            body=f"Failed to send to {contact.profile_name or contact.wa_id}: {err[:180]}",
            link_tab="Messages",
        )
        raise

    _touch_conversation(conv, body or tpl_name or f"[{msg_type}]", inbound=False)
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
        now = timezone.now()
        contact.last_inbound_at = now
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

        # Opt-out keyword handling
        if _match_opt_out(body, prefs.opt_out_keywords or []):
            contact.opt_in_status = "UNSUBSCRIBED"
            contact.opt_out_at = now
            contact.save(update_fields=["opt_in_status", "opt_out_at", "updated_at"])
            WhatsAppConsentLog.objects.create(
                contact=contact,
                action="opt_out",
                source="whatsapp_keyword",
                recorded_at=now,
            )
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

        # Re-subscribe keyword handling
        if body.strip().upper() == "START" and contact.opt_in_status == "UNSUBSCRIBED":
            contact.opt_in_status = "SUBSCRIBED"
            contact.opt_in_at = now
            contact.opt_in_source = "whatsapp_keyword"
            contact.save(
                update_fields=["opt_in_status", "opt_in_at", "opt_in_source", "updated_at"]
            )
            WhatsAppConsentLog.objects.create(
                contact=contact,
                action="opt_in",
                source="whatsapp_keyword",
                recorded_at=now,
            )

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
            wa_order = WhatsAppOrder.objects.create(
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
            WhatsAppAttributionEvent.objects.create(
                event_type="attributed_order",
                conversation=conv,
                contact=contact,
                revenue=total,
                currency="KES",
                occurred_at=now,
            )
            WhatsAppNotification.objects.create(
                type="order",
                title="New WhatsApp order",
                body=f"{profile_name or contact.wa_id} placed order {wa_order.order_number}.",
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
            dispatch_automations_for_event.delay(conv.pk, "message_received")
        except Exception:
            logger.exception("Failed to enqueue automation dispatch")


def _process_statuses(change_value: dict) -> None:
    for st in change_value.get("statuses") or []:
        wamid = st.get("id")
        new = (st.get("status") or "").upper()
        if not wamid or new not in STATUS_ORDER:
            continue

        now = timezone.now()
        err_text = ""
        if new == "FAILED":
            errors = st.get("errors") or []
            if errors:
                err_text = (errors[0].get("title") or errors[0].get("message") or "")[:500]

        msg = WhatsAppMessage.objects.filter(wa_message_id=wamid).first()
        if msg:
            current_rank = STATUS_ORDER.get(msg.status, -1)
            new_rank = STATUS_ORDER.get(new, -1)
            if new_rank > current_rank or new == "FAILED":
                msg.status = new
                if err_text:
                    msg.error_message = err_text
                msg.save(update_fields=["status", "error_message", "updated_at"])

        # Keep MessageLog & Campaign metrics in sync
        log_qs = WhatsAppMessageLog.objects.filter(wa_message_id=wamid)
        for log_entry in log_qs:
            prev_log_status = log_entry.status
            next_log_status = new.lower()
            if prev_log_status == next_log_status:
                continue
            log_entry.status = next_log_status
            update_fields = ["status"]
            if err_text:
                log_entry.failure_reason = err_text
                update_fields.append("failure_reason")
            if next_log_status == "delivered" and not log_entry.delivered_at:
                log_entry.delivered_at = now
                update_fields.append("delivered_at")
            elif next_log_status == "read" and not log_entry.read_at:
                log_entry.read_at = now
                update_fields.append("read_at")
            log_entry.save(update_fields=update_fields)

            if log_entry.campaign_id:
                if next_log_status == "delivered":
                    WhatsAppBroadcast.objects.filter(pk=log_entry.campaign_id).update(
                        delivered=F("delivered") + 1
                    )
                elif next_log_status == "read":
                    WhatsAppBroadcast.objects.filter(pk=log_entry.campaign_id).update(
                        read=F("read") + 1
                    )
                elif next_log_status == "failed":
                    WhatsAppBroadcast.objects.filter(pk=log_entry.campaign_id).update(
                        failed=F("failed") + 1
                    )


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
        tpl.save(update_fields=["status", "rejection_reason", "last_synced_at", "updated_at"])
        if new_status in ("APPROVED", "REJECTED", "DISABLED"):
            WhatsAppNotification.objects.create(
                type="template_update",
                title=f"Template {new_status.lower()}: {name}",
                body=reason or f"Meta updated template status to {new_status.lower()}.",
                link_tab="Messages",
            )


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
                sync_status="synced",
                review_status="APPROVED",
                rejection_reason="",
                last_error="",
                last_synced_at=timezone.now(),
            )
        elif status_value == "REJECTED":
            qs.update(
                sync_status="failed",
                review_status="REJECTED",
                rejection_reason=reason,
                last_error=reason,
            )
            WhatsAppNotification.objects.create(
                type="sync_failure",
                title="Catalogue item rejected",
                body=f"Item {retailer_id}: {reason[:180]}",
                link_tab="Commerce",
            )


def _dispatch_change_field(field: str, value: dict) -> None:
    if field == "messages":
        _process_inbound_messages(value)
    elif field == "message_status":
        _process_statuses(value)
    elif field in ("message_template_status_update", "message_template_quality_update"):
        _process_template_status(value)
    elif field == "product_catalog_status_update":
        _process_catalog_status(value)
    elif field == "orders":
        _process_inbound_messages(value)
    else:
        logger.debug("Unhandled webhook field: %s", field)


@shared_task(
    name="dashboard.whatsapp.tasks.process_whatsapp_event",
    bind=True,
    max_retries=5,
    default_retry_delay=30,
)
def process_whatsapp_event(self, event_id: int):
    event = WhatsAppWebhookEvent.objects.filter(pk=event_id).first()
    if not event:
        return f"event:{event_id}:missing"
    account = WhatsAppAccount.get_solo()
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

            account.last_webhook_event_at = timezone.now()
            account.webhook_status = "ok"
            account.webhook_verified = True
            account.save(
                update_fields=[
                    "last_webhook_event_at",
                    "webhook_status",
                    "webhook_verified",
                    "updated_at",
                ]
            )
        return f"event:{event_id}:ok"
    except Exception as exc:
        logger.exception("Webhook processing failed for event %s", event_id)
        event.attempts = (event.attempts or 1) + 1
        event.error = str(exc)[:500]
        event.status = "RETRYING" if event.attempts < 5 else "FAILED"
        event.save(update_fields=["attempts", "error", "status"])
        WhatsAppIntegrationError.objects.create(
            account=account,
            kind="webhook",
            message=f"Webhook event {event_id} failed: {exc}"[:1000],
        )
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
        WhatsAppMessage.objects.select_related("conversation__contact", "template")
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
def send_broadcast_batch(
    broadcast_id: int, offset: int = 0, batch_size: int = BROADCAST_BATCH_SIZE
):
    bcast = (
        WhatsAppBroadcast.objects.filter(pk=broadcast_id)
        .select_related("template")
        .first()
    )
    if not bcast:
        return f"broadcast:{broadcast_id}:missing"
    if bcast.status not in ("RUNNING", "SENDING", "SCHEDULED", "DRAFT"):
        return f"broadcast:{broadcast_id}:status_{bcast.status}"

    if not bcast.template or bcast.template.status != "APPROVED":
        bcast.status = "FAILED"
        bcast.last_error = "No approved template attached"
        bcast.save(update_fields=["status", "last_error", "updated_at"])
        return f"broadcast:{broadcast_id}:no_template"

    recipient_ids = _resolve_audience_contacts(bcast)
    total = len(recipient_ids)
    if total == 0:
        bcast.status = "COMPLETED"
        bcast.audience_count = 0
        bcast.completed_at = timezone.now()
        bcast.save(
            update_fields=["status", "audience_count", "completed_at", "updated_at"]
        )
        return f"broadcast:{broadcast_id}:empty"

    now = timezone.now()
    bcast.audience_count = total
    bcast.status = "RUNNING"
    if not bcast.sent_at:
        bcast.sent_at = now
    if not bcast.start_at:
        bcast.start_at = now
    bcast.save(
        update_fields=["audience_count", "status", "sent_at", "start_at", "updated_at"]
    )

    chunk = recipient_ids[offset : offset + batch_size]
    submitted = 0
    failed = 0
    for contact_id in chunk:
        contact = WhatsAppContact.objects.filter(pk=contact_id).first()
        if not contact or not contact.marketing_opt_in:
            continue
        conv = _get_or_create_conversation(contact)
        params = list((bcast.variable_mapping or {}).get("params") or [])
        try:
            _send_via_meta(
                contact=contact,
                conv=conv,
                msg_type="template",
                template=bcast.template,
                template_name=bcast.template.name,
                template_params=params,
                campaign=bcast,
            )
            submitted += 1
        except Exception:
            logger.exception("Broadcast delivery failed for contact %s", contact_id)
            failed += 1

    WhatsAppBroadcast.objects.filter(pk=broadcast_id).update(
        submitted=F("submitted") + submitted,
        recipients=F("recipients") + len(chunk),
        failed=F("failed") + failed,
    )

    new_offset = offset + batch_size
    if new_offset < total:
        send_broadcast_batch.apply_async(
            args=[broadcast_id, new_offset, batch_size],
            countdown=2,
        )
        return f"broadcast:{broadcast_id}:batch offset={offset} next={new_offset}"

    WhatsAppBroadcast.objects.filter(pk=broadcast_id).update(
        status="COMPLETED",
        completed_at=timezone.now(),
        end_at=timezone.now(),
    )
    return f"broadcast:{broadcast_id}:done recipients={total}"


@shared_task(name="dashboard.whatsapp.tasks.sync_catalog")
def sync_catalog():
    catalog = WhatsAppCatalog.get_solo()
    account = WhatsAppAccount.get_solo()

    try:
        services.sync_catalog(catalog)
        catalog.refresh_from_db()
    except Exception:
        logger.exception("catalog.Product sync failed")

    try:
        waba_id = account.waba_id or getattr(settings, "WHATSAPP_WABA_ID", "")
        items = WhatsAppCatalogItem.objects.filter(catalog=catalog, is_removed=False)
        pushed = 0
        failed = 0
        for item in items:
            if not item.eligible or item.is_price_hidden:
                WhatsAppCatalogItem.objects.filter(pk=item.pk).update(
                    sync_status="not_eligible"
                )
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
                res = _meta_post(f"/{waba_id}/product_catalog_sync", payload)
                WhatsAppCatalogItem.objects.filter(pk=item.pk).update(
                    sync_status="synced",
                    meta_product_id=res.get("id") or item.meta_product_id or f"meta_{item.retailer_id}",
                    last_synced_at=timezone.now(),
                    last_error="",
                )
                pushed += 1
            except Exception as exc:
                logger.exception("Catalog push failed for %s", item.retailer_id)
                WhatsAppCatalogItem.objects.filter(pk=item.pk).update(
                    sync_status="failed",
                    last_error=str(exc)[:500],
                )
                WhatsAppIntegrationError.objects.create(
                    account=account,
                    kind="sync",
                    message=f"Product {item.sku or item.retailer_id} sync failed: {exc}"[:1000],
                )
                failed += 1

        catalog.last_full_sync_at = timezone.now()
        catalog.last_sync_updated = pushed
        catalog.last_sync_failed = failed
        catalog.last_error = "" if failed == 0 else f"{failed} item(s) failed to sync."
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
    account = WhatsAppAccount.get_solo()
    waba = account.waba_id or getattr(settings, "WHATSAPP_WABA_ID", "")
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
    now = timezone.now()
    days_left = (account.token_expires_at - now).days
    if days_left <= 0:
        account.connection_state = "expired"
        account.required_action = "Reauthorize WhatsApp Business connection."
        account.save(update_fields=["connection_state", "required_action", "updated_at"])
    if days_left <= 7:
        WhatsAppNotification.objects.create(
            type="webhook",
            title="WhatsApp access token expiring",
            body=(
                f"Your Meta access token expires in {max(days_left, 0)} day(s). "
                "Rotate it in Connection settings."
            ),
            link_tab="Connection",
        )
        return f"token:alert days_left={days_left}"
    return "token:ok"


@shared_task(name="dashboard.whatsapp.tasks.refresh_account_status")
def refresh_account_status():
    account, _, phone_id = _get_token_and_phone()
    waba = account.waba_id or getattr(settings, "WHATSAPP_WABA_ID", "")
    if not waba or not phone_id:
        return "account:skipped"
    start = timezone.now()
    try:
        data = _meta_get(
            f"/{phone_id}",
            params={
                "fields": "quality_rating,messaging_limit_tier,verified_name,display_phone_number,code_verification_status"
            },
        )
        account.quality_score = (
            data.get("quality_rating") or account.quality_score or "UNKNOWN"
        )
        account.messaging_limit_tier = (
            data.get("messaging_limit_tier") or account.messaging_limit_tier
        )
        account.display_name = data.get("verified_name") or account.display_name
        account.display_phone = data.get("display_phone_number") or account.display_phone
        if data.get("code_verification_status") == "VERIFIED":
            account.phone_verified = True
        account.api_status = "ok"
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
                "phone_verified",
                "api_status",
                "last_synced_at",
                "last_error",
                "quality_history",
                "updated_at",
            ]
        )
        WhatsAppHealthCheck.objects.create(
            account=account,
            check_type="api",
            status="ok",
            ok=True,
            latency_ms=int((timezone.now() - start).total_seconds() * 1000),
        )
        return "account:refreshed"
    except Exception as exc:
        logger.exception("Account refresh failed")
        account.last_error = str(exc)[:500]
        account.api_status = "down"
        account.save(update_fields=["last_error", "api_status", "updated_at"])
        WhatsAppHealthCheck.objects.create(
            account=account,
            check_type="api",
            status="down",
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
    tpl = WhatsAppTemplate.objects.filter(name=recovery_template).first()
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
                template=tpl,
                template_name=recovery_template,
                template_params=[
                    order.contact_name or order.contact.wa_id,
                    str(order.total),
                ],
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

    normalized_trigger = (trigger or "").lower()
    automations = WhatsAppAutomation.objects.select_related("template").filter(
        status="ACTIVE",
        trigger__in=[trigger, normalized_trigger, normalized_trigger.upper()],
    )
    fired = 0
    for auto in automations:
        delay = auto.delay_seconds or ((auto.delay_minutes or 0) * 60)
        try:
            if delay > 0:
                send_automation_message.apply_async(
                    args=[auto.pk, conv.pk], countdown=delay
                )
            else:
                _run_automation(auto, conv)
            fired += 1
        except Exception:
            logger.exception("Automation %s failed", auto.pk)
    return f"automation:{normalized_trigger}:fired={fired}"


def _run_automation(auto: WhatsAppAutomation, conv: WhatsAppConversation) -> None:
    now = timezone.now()
    contact = conv.contact
    result = "success"
    error_detail = ""

    try:
        if auto.action == "route_to_inbox":
            if conv.status != "OPEN":
                conv.status = "OPEN"
                conv.save(update_fields=["status", "updated_at"])
        else:
            if not auto.template or auto.template.status != "APPROVED":
                result = "skipped"
                error_detail = "Template missing or not approved"
            elif auto.template.category == "MARKETING" and not contact.marketing_opt_in:
                result = "skipped"
                error_detail = "Contact not opted in for marketing"
            else:
                _send_via_meta(
                    contact=contact,
                    conv=conv,
                    msg_type="template",
                    template=auto.template,
                    template_name=auto.template.name,
                    template_params=[contact.profile_name or contact.wa_id],
                )
                auto.messages_sent += 1
    except Exception as exc:
        result = "failed"
        error_detail = str(exc)[:500]
        WhatsAppNotification.objects.create(
            type="automation",
            title=f"Automation failed: {auto.name}",
            body=error_detail[:200],
            link_tab="Messages",
        )

    WhatsAppWorkflowRun.objects.create(
        automation=auto,
        contact=contact,
        result=result,
        detail=error_detail,
        executed_at=now,
    )
    if result == "success":
        auto.success_count += 1
    elif result == "failed":
        auto.failure_count += 1
    auto.last_triggered_at = now
    auto.last_run_result = result
    auto.runs = (auto.runs or []) + [
        {
            "id": int(now.timestamp()),
            "at": now.isoformat(),
            "status": result.upper(),
            "durationMs": 0,
            "error": error_detail,
        }
    ]
    auto.save(
        update_fields=[
            "messages_sent",
            "success_count",
            "failure_count",
            "last_triggered_at",
            "last_run_result",
            "runs",
            "updated_at",
        ]
    )


@shared_task(name="dashboard.whatsapp.tasks.send_automation_message")
def send_automation_message(automation_id: int, conversation_id: int):
    auto = (
        WhatsAppAutomation.objects.select_related("template")
        .filter(pk=automation_id, status="ACTIVE")
        .first()
    )
    conv = (
        WhatsAppConversation.objects.select_related("contact")
        .filter(pk=conversation_id)
        .first()
    )
    if not auto or not conv:
        return f"automation:{automation_id}:skip"
    _run_automation(auto, conv)
    return f"automation:{automation_id}:{auto.last_run_result}"


@shared_task(name="dashboard.whatsapp.tasks.run_bot_flow")
def run_bot_flow(conversation_id: int, inbound_body: str):
    from .models import WhatsAppBotFlow

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
    entry_key = flow.entry_node_key or (
        flow.nodes.order_by("order").first().key if flow.nodes.exists() else ""
    )
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