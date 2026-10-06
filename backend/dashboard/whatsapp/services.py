"""
Thin wrapper around Meta's WhatsApp Cloud API.

Everything outbound goes through `send_message`. Reads the runtime token from
`WhatsAppAccount` (falls back to settings). Honours `WHATSAPP_DRY_RUN`.

SCOPE — OUTBOUND ONLY
    This module sends messages *to* Meta. It does not receive them.

    The inbound path is completely separate:

        Meta  →  POST /api/v1/whatsapp/webhook/   (view, signature check)
              →  parse payload
              →  persist WhatsAppContact + WhatsAppConversation + WhatsAppMessage
              →  fire `customer.first_message` if the contact is new
              →  fire `customer.inbound_message` for every message (future)

    None of that happens here. If you're looking for the AI automations
    hook for inbound messages, it lives in the webhook handler /
    service, not in this file.

    The reason the split is clean: `client.py` is about *sending*. It
    has no concept of "customer", "conversation", or "first contact".
    Those are inbound concepts. Adding automation hooks here would
    mean importing customer/app-user models into what should be a
    dumb HTTP wrapper, and the client would need a DB read for every
    send just to decide whether the customer is new — which is wrong
    on every level.

NO AUTOMATION EVENTS ARE FIRED FROM THIS MODULE.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

import requests
from django.conf import settings

from .models import WhatsAppAccount

logger = logging.getLogger("whatsapp.client")


class MetaAPIError(Exception):
    def __init__(self, status_code: int, payload: Any):
        self.status_code = status_code
        self.payload = payload
        super().__init__(f"Meta API error {status_code}: {payload}")


# ─────────────────────────────────────────────────────────────────────────────
# Account / credentials
# ─────────────────────────────────────────────────────────────────────────────

def get_active_account() -> WhatsAppAccount | None:
    return WhatsAppAccount.get_active()


def _access_token() -> str:
    acc = get_active_account()
    return (acc.access_token if acc else "") or settings.WHATSAPP_ACCESS_TOKEN


def _phone_number_id() -> str:
    acc = get_active_account()
    return (acc.phone_number_id if acc else "") or settings.WHATSAPP_PHONE_NUMBER_ID


def _app_secret() -> str:
    acc = get_active_account()
    return (acc.app_secret if acc else "") or settings.META_APP_SECRET


# ─────────────────────────────────────────────────────────────────────────────
# Signature verification (webhook)
# ─────────────────────────────────────────────────────────────────────────────

def verify_webhook_signature(raw_body: bytes, header_value: str) -> bool:
    """
    Validate `X-Hub-Signature-256` sent by Meta.

    Header format: `sha256=<hex-digest>`.
    """
    if not header_value or not header_value.startswith("sha256="):
        return False
    secret = _app_secret()
    if not secret:
        logger.warning("No META_APP_SECRET configured; rejecting signed webhook")
        return False
    expected = hmac.new(
        secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header_value[len("sha256="):])


# ─────────────────────────────────────────────────────────────────────────────
# Send primitives
# ─────────────────────────────────────────────────────────────────────────────

def _post(payload: dict) -> dict:
    """POST to /{phone_number_id}/messages."""
    if not settings.WHATSAPP_ENABLED:
        logger.info("[disabled] would send: %s", payload.get("type"))
        return {"dry_run": True, "disabled": True}

    if settings.WHATSAPP_DRY_RUN:
        logger.info("[dry-run] would send: %s → %s",
                    payload.get("type"), payload.get("to"))
        return {"dry_run": True}

    url = f"{settings.META_GRAPH_BASE_URL}/{_phone_number_id()}/messages"
    headers = {
        "Authorization": f"Bearer {_access_token()}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=20)
    if not resp.ok:
        try:
            body = resp.json()
        except ValueError:
            body = resp.text
        logger.error("Meta send failed [%s]: %s", resp.status_code, body)
        raise MetaAPIError(resp.status_code, body)
    return resp.json()


def send_text(to: str, body: str, preview_url: bool = False) -> dict:
    return _post({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": preview_url, "body": body},
    })


def send_template(
    to: str,
    template_name: str,
    language_code: str | None = None,
    body_params: list[str] | None = None,
    header_params: list[str] | None = None,
    button_url_param: str | None = None,
) -> dict:
    """
    Send a pre-approved template.

    `body_params`   fill {{1}}, {{2}} … in the body component.
    `header_params` fill {{1}} in a text header.
    `button_url_param` fills a dynamic URL suffix on a URL button.
    """
    lang = language_code or settings.WHATSAPP_DEFAULT_TEMPLATE_LANG
    components: list[dict] = []

    if header_params:
        components.append({
            "type": "header",
            "parameters": [{"type": "text", "text": p} for p in header_params],
        })
    if body_params:
        components.append({
            "type": "body",
            "parameters": [{"type": "text", "text": p} for p in body_params],
        })
    if button_url_param:
        components.append({
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": button_url_param}],
        })

    return _post({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang},
            "components": components or [],
        },
    })


def send_interactive_buttons(
    to: str, body: str, buttons: list[dict], header: str | None = None,
    footer: str | None = None,
) -> dict:
    """Up to 3 quick-reply buttons. `buttons` = [{'id': 'x', 'title': 'X'}]."""
    interactive: dict = {
        "type": "button",
        "body": {"text": body},
        "action": {
            "buttons": [
                {"type": "reply", "reply": {"id": b["id"], "title": b["title"][:20]}}
                for b in buttons[:3]
            ]
        },
    }
    if header:
        interactive["header"] = {"type": "text", "text": header}
    if footer:
        interactive["footer"] = {"text": footer}

    return _post({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "interactive",
        "interactive": interactive,
    })


def mark_as_read(wa_message_id: str) -> dict:
    return _post({
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": wa_message_id,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Template sync
# ─────────────────────────────────────────────────────────────────────────────

def fetch_templates_from_meta() -> list[dict]:
    """Pull the template catalogue from the WABA. Used by a Celery beat task."""
    if not settings.WHATSAPP_ENABLED or settings.WHATSAPP_DRY_RUN:
        logger.info("[dry-run] would fetch templates from Meta")
        return []

    url = f"{settings.META_GRAPH_BASE_URL}/{settings.WHATSAPP_WABA_ID}/message_templates"
    headers = {"Authorization": f"Bearer {_access_token()}"}
    params = {"limit": 200, "fields": "id,name,status,category,language,components,quality_score"}
    resp = requests.get(url, headers=headers, params=params, timeout=20)
    if not resp.ok:
        raise MetaAPIError(resp.status_code, resp.text)
    return resp.json().get("data", [])