import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from .models import (
    WhatsAppAccount,
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
    WhatsAppNotificationConfig,
    WhatsAppSettings,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
    WhatsAppWorkflowRun,
)

logger = logging.getLogger("whatsapp")


def _dry_run():
    return getattr(settings, "WHATSAPP_DRY_RUN", True)


def _enabled():
    account = WhatsAppAccount.get_solo()
    return bool(
        getattr(settings, "WHATSAPP_ENABLED", False)
        or account.is_active
        or account.connection_state == "connected"
    )


def _record_integration_error(kind: str, message: str, detail=None):
    account = WhatsAppAccount.get_solo()
    WhatsAppIntegrationError.objects.create(
        account=account,
        kind=kind,
        message=message[:1000],
        detail=detail or {},
    )
    if kind == "api":
        account.api_status = "degraded"
        account.last_error = message[:1000]
        account.save(update_fields=["api_status", "last_error", "updated_at"])
    elif kind == "webhook":
        account.webhook_status = "degraded"
        account.save(update_fields=["webhook_status", "updated_at"])


class MetaClient:
    def _log(self, action, payload=None):
        logger.info(
            "META[dry_run=%s enabled=%s] %s %s",
            _dry_run(),
            _enabled(),
            action,
            payload or {},
        )

    def _graph_url(self, path):
        base = getattr(
            settings, "META_GRAPH_BASE_URL", "https://graph.facebook.com/v20.0"
        ).rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    def _credentials(self):
        account = WhatsAppAccount.get_solo()
        token = account.access_token or getattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
        phone_id = account.phone_number_id or getattr(
            settings, "WHATSAPP_PHONE_NUMBER_ID", ""
        )
        return account, token, phone_id

    def _post_messages(self, payload):
        account, token, phone_id = self._credentials()

        if not _enabled() or _dry_run():
            logger.info(
                "META short-circuit (dry_run=%s enabled=%s): %s",
                _dry_run(),
                _enabled(),
                json.dumps(payload),
            )
            account.last_api_request_at = timezone.now()
            account.api_status = "ok"
            account.save(update_fields=["last_api_request_at", "api_status", "updated_at"])
            return {"dry_run": True, "payload": payload}

        if not token or not phone_id:
            msg = "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set"
            _record_integration_error("api", msg)
            raise RuntimeError(msg)

        url = self._graph_url(f"{phone_id}/messages")
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = resp.read().decode()
                logger.info("META response %s: %s", resp.status, body)
                account.last_api_request_at = timezone.now()
                account.api_status = "ok"
                account.save(
                    update_fields=["last_api_request_at", "api_status", "updated_at"]
                )
                return json.loads(body)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            logger.error("META HTTP %s: %s", exc.code, body)
            kind = "rate_limit" if exc.code == 429 else "api"
            _record_integration_error(
                kind,
                f"Meta API error {exc.code}: {body}",
                {"status_code": exc.code},
            )
            raise RuntimeError(f"Meta API error {exc.code}: {body}") from exc
        except Exception as exc:
            logger.exception("META request failed: %s", exc)
            _record_integration_error("api", str(exc))
            raise

    def send_text(self, to, body, conversation=None):
        self._log("send_text", {"to": to, "body": body[:64]})
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }
        error_msg = ""
        try:
            result = self._post_messages(payload)
        except Exception as exc:
            result = {"error": True}
            error_msg = str(exc)

        wa_id = ""
        status_value = "SENT" if not result.get("error") else "FAILED"
        try:
            wa_id = result.get("messages", [{}])[0].get("id", "")
        except Exception:
            wa_id = ""

        if conversation:
            return WhatsAppMessage.objects.create(
                conversation=conversation,
                direction="OUT",
                type="text",
                body=body,
                status=status_value,
                error_message=error_msg,
                wa_message_id=wa_id,
                timestamp=timezone.now(),
            )
        if result.get("error"):
            raise RuntimeError(error_msg or "Failed to send text message")
        return result

    def send_image(self, to, link, caption="", conversation=None):
        if not link or not link.startswith(("http://", "https://")):
            raise ValueError(f"image link must be absolute URL, got {link!r}")
        self._log(
            "send_image", {"to": to, "link": link, "caption": (caption or "")[:64]}
        )
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "image",
            "image": {"link": link},
        }
        if caption:
            payload["image"]["caption"] = caption

        error_msg = ""
        try:
            result = self._post_messages(payload)
        except Exception as exc:
            result = {"error": True}
            error_msg = str(exc)

        wa_id = ""
        status_value = "SENT" if not result.get("error") else "FAILED"
        try:
            wa_id = result.get("messages", [{}])[0].get("id", "")
        except Exception:
            wa_id = ""

        if conversation:
            return WhatsAppMessage.objects.create(
                conversation=conversation,
                direction="OUT",
                type="image",
                body=caption or "",
                status=status_value,
                error_message=error_msg,
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                media_url=link,
            )
        if result.get("error"):
            raise RuntimeError(error_msg or "Failed to send image")
        return result

    def send_template(
        self,
        to,
        template_name,
        params=None,
        conversation=None,
        language="en",
        language_code=None,
    ):
        lang = language_code or language or "en"
        self._log(
            "send_template",
            {"to": to, "name": template_name, "language": lang, "params": params or []},
        )
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": lang},
                "components": [],
            },
        }
        if params:
            payload["template"]["components"].append(
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in params],
                }
            )

        error_msg = ""
        try:
            result = self._post_messages(payload)
        except Exception as exc:
            result = {"error": True}
            error_msg = str(exc)

        wa_id = ""
        status_value = "SENT" if not result.get("error") else "FAILED"
        try:
            wa_id = result.get("messages", [{}])[0].get("id", "")
        except Exception:
            wa_id = ""

        if conversation:
            return WhatsAppMessage.objects.create(
                conversation=conversation,
                direction="OUT",
                type="template",
                body=template_name,
                status=status_value,
                error_message=error_msg,
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                template_name=template_name,
                template_params=params or [],
            )
        if result.get("error"):
            raise RuntimeError(error_msg or "Failed to send template")
        return result

    def send_media(
        self, to, kind, media_url="", media_id="", conversation=None, caption=""
    ):
        self._log(
            "send_media", {"to": to, "kind": kind, "url": media_url, "id": media_id}
        )
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": kind,
        }
        media_obj = {}
        if media_id:
            media_obj["id"] = media_id
        elif media_url:
            media_obj["link"] = media_url
        if caption and kind in ("image", "video", "document"):
            media_obj["caption"] = caption
        payload[kind] = media_obj

        error_msg = ""
        try:
            result = self._post_messages(payload)
        except Exception as exc:
            result = {"error": True}
            error_msg = str(exc)

        wa_id = ""
        status_value = "SENT" if not result.get("error") else "FAILED"
        try:
            wa_id = result.get("messages", [{}])[0].get("id", "")
        except Exception:
            wa_id = ""

        if conversation:
            return WhatsAppMessage.objects.create(
                conversation=conversation,
                direction="OUT",
                type=kind,
                status=status_value,
                error_message=error_msg,
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                media_url=media_url or "",
                media_id=media_id or "",
            )
        if result.get("error"):
            raise RuntimeError(error_msg or "Failed to send media")
        return result

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str) -> bool:
        secret = getattr(settings, "META_APP_SECRET", "")
        if not secret:
            return True
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature_header.split("=", 1)[1], expected)


meta_client = MetaClient()


# ---------------------------------------------------------------------------
# Product & Catalog Sync Helpers
# ---------------------------------------------------------------------------

def _absolute_media_url(path):
    if not path:
        return ""
    path_str = str(path)
    if path_str.startswith(("http://", "https://")):
        return path_str

    base = getattr(settings, "PUBLIC_BASE_URL", "") or getattr(
        settings, "BACKEND_PUBLIC_URL", ""
    )
    base = base.rstrip("/")

    media = getattr(settings, "MEDIA_URL", "/media/")
    if not media.startswith("/"):
        media = "/" + media
    media = media.rstrip("/") + "/"

    if path_str.startswith(media):
        return f"{base}{path_str}"
    if path_str.startswith("/"):
        path_str = path_str[1:]
    return f"{base}{media}{path_str}"


def _product_image_url(product):
    try:
        manager = getattr(product, "images", None)
        if manager is not None:
            first = manager.filter(is_primary=True).first() or manager.first()
            if first is not None:
                img = getattr(first, "image", None)
                url = getattr(img, "url", None) if img else None
                if url:
                    return _absolute_media_url(url)
    except Exception:
        pass
    for attr in ("image", "featured_image", "primary_image", "thumbnail"):
        img = getattr(product, attr, None)
        if img:
            url = getattr(img, "url", None)
            if url:
                return _absolute_media_url(url)
    for attr in ("image_url", "thumbnail_url", "photo_url"):
        value = getattr(product, attr, "")
        if value and isinstance(value, str):
            return _absolute_media_url(value)
    return ""


def _product_price(product):
    for attr in ("price", "selling_price", "base_price", "regular_price"):
        value = getattr(product, attr, None)
        if value is not None:
            try:
                return Decimal(str(value))
            except (ValueError, TypeError):
                pass
    return Decimal("0.00")


def _product_sale_price(product):
    for attr in ("sale_price", "discount_price", "compare_at_price"):
        value = getattr(product, attr, None)
        if value is not None:
            try:
                return Decimal(str(value))
            except (ValueError, TypeError):
                pass
    return None


def _product_stock(product):
    for attr in ("stock_quantity", "stock", "inventory_quantity", "quantity"):
        value = getattr(product, attr, None)
        if value is not None:
            try:
                return int(value)
            except (ValueError, TypeError):
                pass
    return 0


def _product_sku(product):
    for attr in ("sku", "code", "barcode"):
        val = getattr(product, attr, None)
        if val:
            return str(val)[:120]
    return str(product.pk)


def _product_variations_count(product):
    for attr in ("variants", "variations", "options"):
        rel = getattr(product, attr, None)
        if rel is not None and hasattr(rel, "count"):
            try:
                return int(rel.count())
            except Exception:
                pass
    return 0


def _product_is_active(product):
    for attr in ("is_active", "is_published", "is_available"):
        value = getattr(product, attr, None)
        if value is not None:
            return bool(value)
    status_value = getattr(product, "status", None)
    if status_value is not None:
        return str(status_value).lower() in ("active", "published", "live")
    return True


def _product_status(product):
    raw = getattr(product, "status", None)
    if raw is not None:
        s = str(raw).lower()
        if s in ("active", "published", "live"):
            return "active"
        if s in ("archived", "deleted"):
            return "archived"
        return "draft"
    return "active" if _product_is_active(product) else "draft"


def _product_tags(product):
    value = getattr(product, "tags", None)
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [tag.strip() for tag in value.split(",") if tag.strip()]
    try:
        return list(value.values_list("name", flat=True))
    except Exception:
        pass
    try:
        return [str(tag) for tag in value.all()]
    except Exception:
        return []


def _product_brand(product):
    value = getattr(product, "brand", None)
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return getattr(value, "name", "") or str(value)


def _product_category(product):
    value = getattr(product, "category", None)
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return getattr(value, "name", "") or str(value)


def _product_store_category(product):
    category = getattr(product, "category", None)
    if category is not None and hasattr(category, "pk"):
        return category
    return None


def _product_url(product):
    for attr in ("product_url", "url"):
        value = getattr(product, attr, None)
        if isinstance(value, str) and value:
            return value
    get_absolute = getattr(product, "get_absolute_url", None)
    if callable(get_absolute):
        try:
            return get_absolute()
        except Exception:
            pass
    store = getattr(settings, "STORE_URL", "").rstrip("/")
    slug = getattr(product, "slug", None)
    if store and slug:
        return f"{store}/product/{slug}"
    return ""


def _product_to_item_fields(product, catalog):
    price = _product_price(product)
    sale_price = _product_sale_price(product)
    stock = _product_stock(product)
    in_stock = stock > 0
    active = _product_is_active(product)
    prod_status = _product_status(product)
    tags = _product_tags(product)
    image_url = _product_image_url(product)
    rule = catalog.eligibility_rule or "ALL_ACTIVE"

    if rule == "ALL_ACTIVE":
        eligible = active
    elif rule == "IN_STOCK_ONLY":
        eligible = active and in_stock
    elif rule == "HAS_IMAGE":
        eligible = active and bool(image_url)
    elif rule == "TAGGED_WHATSAPP":
        eligible = active and any("whatsapp" in str(tag).lower() for tag in tags)
    else:
        eligible = True

    product_name = (getattr(product, "name", "") or "")[:200]
    slug = (getattr(product, "slug", "") or "")[:200]
    description = getattr(product, "description", "") or ""

    return {
        "retailer_id": str(product.pk),
        "sku": (_product_sku(product) or "")[:200],
        "store_product": product,
        "store_category": _product_store_category(product),
        "store_product_name": product_name,
        "store_product_slug": slug,
        "name": product_name,
        "display_title": product_name,
        "description": description,
        "display_description": description,
        "price": price,
        "sale_price": sale_price,
        "currency": "KES",
        "image_url": (image_url or "")[:200],
        "product_url": (_product_url(product) or "")[:200],
        "category": (_product_category(product) or "")[:200],
        "brand": (_product_brand(product) or "")[:200],
        "tags": tags,
        "variations_count": _product_variations_count(product),
        "in_stock": in_stock,
        "stock_quantity": stock,
        "product_status": prod_status,
        "eligible": eligible,
        "is_linked": True,
    }


def _resolve_sync_status(fields: dict, catalog: WhatsAppCatalog) -> str:
    if fields.get("product_status") == "archived":
        return "archived"
    if not fields.get("eligible", True):
        return "not_eligible"
    if catalog.exclude_out_of_stock and not fields.get("in_stock", True):
        return "unavailable"
    return "synced"


def sync_catalog_item(item: WhatsAppCatalogItem):
    """Syncs a single WhatsAppCatalogItem from its linked store_product."""
    if not item.store_product:
        item.sync_status = "unavailable"
        item.last_error = "No linked website product found."
        item.save(update_fields=["sync_status", "last_error", "updated_at"])
        return item

    fields = _product_to_item_fields(item.store_product, item.catalog)
    for key, value in fields.items():
        setattr(item, key, value)
    item.is_removed = False
    item.removed_at = None
    item.sync_status = _resolve_sync_status(fields, item.catalog)
    item.last_synced_at = timezone.now()
    item.last_error = ""
    item.save()
    return item


def sync_catalog(catalog: WhatsAppCatalog):
    try:
        from catalog.models import Product
    except ImportError:
        catalog.last_error = "catalog.Product not importable"
        catalog.save(update_fields=["last_error", "updated_at"])
        logger.warning("catalog.Product not available; skipping catalog sync")
        return

    logger.info("Syncing catalog %s from catalog.Product", catalog.pk)
    added = 0
    updated = 0
    failed = 0
    seen = set()

    for product in Product.objects.all().iterator():
        try:
            fields = _product_to_item_fields(product, catalog)
            retailer_id = fields["retailer_id"]
            seen.add(retailer_id)
            next_sync_status = _resolve_sync_status(fields, catalog)

            existing = WhatsAppCatalogItem.objects.filter(
                catalog=catalog, retailer_id=retailer_id
            ).first()

            if existing:
                for key, value in fields.items():
                    setattr(existing, key, value)
                existing.is_removed = False
                existing.removed_at = None
                existing.sync_status = next_sync_status
                existing.last_synced_at = timezone.now()
                existing.last_error = ""
                existing.save()
                updated += 1
            else:
                WhatsAppCatalogItem.objects.create(
                    catalog=catalog,
                    sync_status=next_sync_status,
                    last_synced_at=timezone.now(),
                    **fields,
                )
                added += 1
        except Exception as exc:
            failed += 1
            logger.exception("Failed to sync product %s", getattr(product, "pk", "?"))
            _record_integration_error(
                "sync",
                f"Failed to sync product {getattr(product, 'pk', '?')}: {exc}",
            )

    stale = (
        WhatsAppCatalogItem.objects.filter(catalog=catalog)
        .exclude(retailer_id__in=seen)
        .exclude(is_removed=True)
    )
    stale.update(
        is_removed=True,
        removed_at=timezone.now(),
        product_status="archived",
        sync_status="archived",
        eligible=False,
    )

    catalog.last_full_sync_at = timezone.now()
    catalog.last_sync_added = added
    catalog.last_sync_updated = updated
    catalog.last_sync_failed = failed
    catalog.last_error = "" if failed == 0 else f"{failed} product(s) failed to sync."
    catalog.save(
        update_fields=[
            "last_full_sync_at",
            "last_sync_added",
            "last_sync_updated",
            "last_sync_failed",
            "last_error",
            "updated_at",
        ]
    )
    if failed > 0:
        WhatsAppNotification.objects.create(
            type="sync_failure",
            title="Catalogue sync errors",
            body=f"{failed} product(s) failed during catalogue sync.",
            link_tab="Commerce",
        )
    logger.info(
        "Catalog %s synced: added=%s updated=%s failed=%s",
        catalog.pk,
        added,
        updated,
        failed,
    )


# ---------------------------------------------------------------------------
# Account, Templates, Notifications & Automation Helpers
# ---------------------------------------------------------------------------

def refresh_account_status(account: WhatsAppAccount):
    logger.info("Refreshing account status for %s", account.pk)
    start = timezone.now()
    if _dry_run() or not _enabled():
        account.last_synced_at = timezone.now()
        account.quality_score = account.quality_score or "GREEN"
        account.api_status = "ok"
        account.save(update_fields=["last_synced_at", "quality_score", "api_status", "updated_at"])
        WhatsAppHealthCheck.objects.create(
            account=account,
            check_type="api",
            status="ok",
            ok=True,
            latency_ms=int((timezone.now() - start).total_seconds() * 1000),
            error="",
        )
        return

    token = account.access_token or getattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    phone_id = account.phone_number_id or getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    if not token or not phone_id:
        WhatsAppHealthCheck.objects.create(
            account=account,
            check_type="api",
            status="down",
            ok=False,
            latency_ms=0,
            error="Missing access token or phone_number_id",
        )
        return

    url = meta_client._graph_url(f"{phone_id}?fields=display_phone_number,verified_name,quality_rating")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            account.display_phone = data.get("display_phone_number") or account.display_phone
            account.display_name = data.get("verified_name") or account.display_name
            account.quality_score = data.get("quality_rating") or account.quality_score
            account.api_status = "ok"
            account.last_synced_at = timezone.now()
            account.last_api_request_at = timezone.now()
            account.save(
                update_fields=[
                    "display_phone",
                    "display_name",
                    "quality_score",
                    "api_status",
                    "last_synced_at",
                    "last_api_request_at",
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
    except Exception as exc:
        _record_integration_error("api", str(exc))
        WhatsAppHealthCheck.objects.create(
            account=account,
            check_type="api",
            status="down",
            ok=False,
            latency_ms=int((timezone.now() - start).total_seconds() * 1000),
            error=str(exc),
        )


def submit_template(template: WhatsAppTemplate):
    template.status = "PENDING"
    template.last_synced_at = timezone.now()
    template.save(update_fields=["status", "last_synced_at", "updated_at"])


def sync_templates():
    now = timezone.now()
    for tpl in WhatsAppTemplate.objects.all():
        if tpl.status in ("PENDING", "APPROVED"):
            tpl.last_synced_at = now
            tpl.save(update_fields=["last_synced_at", "updated_at"])


def dispatch_transactional_notification(
    event: str,
    contact: WhatsAppContact,
    order=None,
    order_reference: str = "",
    params=None,
):
    """
    Sends a configured transactional WhatsApp notification if enabled and compliant.
    """
    cfg = WhatsAppNotificationConfig.objects.select_related("template").filter(event=event).first()
    if not cfg or not cfg.enabled:
        return None

    now = timezone.now()
    tpl = cfg.template
    if not tpl or tpl.status != "APPROVED":
        cfg.last_executed_at = now
        cfg.last_result = "skipped"
        cfg.failure_detail = "No approved template assigned."
        cfg.save(update_fields=["last_executed_at", "last_result", "failure_detail", "updated_at"])
        return None

    if cfg.requires_consent and not contact.marketing_opt_in:
        cfg.last_executed_at = now
        cfg.last_result = "skipped"
        cfg.failure_detail = "Contact has not opted in."
        cfg.save(update_fields=["last_executed_at", "last_result", "failure_detail", "updated_at"])
        return None

    wa_id = ""
    log_status = "sent"
    error_msg = ""
    try:
        result = meta_client.send_template(
            to=contact.wa_id,
            template_name=tpl.name,
            params=params or [],
            language=tpl.language or "en",
        )
        wa_id = result.get("messages", [{}])[0].get("id", "")
        cfg.last_result = "success"
        cfg.failure_detail = ""
    except Exception as exc:
        log_status = "failed"
        error_msg = str(exc)
        cfg.last_result = "failed"
        cfg.failure_detail = error_msg[:500]
        WhatsAppNotification.objects.create(
            type="failed_message",
            title=f"Notification failed ({cfg.label})",
            body=error_msg[:300],
            link_tab="Messages",
        )

    cfg.last_executed_at = now
    cfg.save(update_fields=["last_executed_at", "last_result", "failure_detail", "updated_at"])

    return WhatsAppMessageLog.objects.create(
        wa_message_id=wa_id,
        contact=contact,
        recipient=contact.wa_id,
        customer_name=contact.profile_name or "",
        template=tpl,
        template_name=tpl.name,
        category=(tpl.category or "UTILITY").lower(),
        order=order,
        order_reference=order_reference or (getattr(order, "order_number", "") if order else ""),
        status=log_status,
        failure_reason=error_msg,
        sent_at=now,
    )


def run_automations_for_trigger(
    trigger: str,
    contact: WhatsAppContact,
    conversation: WhatsAppConversation = None,
    params=None,
):
    """
    Executes all ACTIVE workflows matching a trigger.
    """
    workflows = WhatsAppAutomation.objects.select_related("template").filter(
        trigger=trigger, status="ACTIVE"
    )
    now = timezone.now()
    for wf in workflows:
        result = "success"
        detail = ""
        try:
            if wf.action == "route_to_inbox":
                if conversation is None:
                    conversation, _ = WhatsAppConversation.objects.get_or_create(
                        contact=contact, defaults={"status": "OPEN"}
                    )
                if conversation.status != "OPEN":
                    conversation.status = "OPEN"
                    conversation.save(update_fields=["status", "updated_at"])
                detail = "Routed conversation to Inbox"
            else:
                tpl = wf.template
                if not tpl or tpl.status != "APPROVED":
                    result = "skipped"
                    detail = "Template missing or not approved"
                elif tpl.category == "MARKETING" and not contact.marketing_opt_in:
                    result = "skipped"
                    detail = "Skipped: contact not opted in for marketing"
                else:
                    res = meta_client.send_template(
                        to=contact.wa_id,
                        template_name=tpl.name,
                        params=params or [],
                        language=tpl.language or "en",
                    )
                    wa_id = res.get("messages", [{}])[0].get("id", "")
                    WhatsAppMessageLog.objects.create(
                        wa_message_id=wa_id,
                        contact=contact,
                        recipient=contact.wa_id,
                        customer_name=contact.profile_name or "",
                        template=tpl,
                        template_name=tpl.name,
                        category=(tpl.category or "UTILITY").lower(),
                        status="sent",
                        sent_at=now,
                    )
                    wf.messages_sent += 1
        except Exception as exc:
            result = "failed"
            detail = str(exc)
            WhatsAppNotification.objects.create(
                type="automation",
                title=f"Automation failed: {wf.name}",
                body=detail[:300],
                link_tab="Messages",
            )

        WhatsAppWorkflowRun.objects.create(
            automation=wf,
            contact=contact,
            result=result,
            detail=detail,
            executed_at=now,
        )
        if result == "success":
            wf.success_count += 1
        elif result == "failed":
            wf.failure_count += 1
        wf.last_triggered_at = now
        wf.last_run_result = result
        wf.save(
            update_fields=[
                "messages_sent",
                "success_count",
                "failure_count",
                "last_triggered_at",
                "last_run_result",
                "updated_at",
            ]
        )


def send_broadcast(broadcast: WhatsAppBroadcast):
    now = timezone.now()
    broadcast.status = "RUNNING"
    broadcast.sent_at = now
    if not broadcast.start_at:
        broadcast.start_at = now
    broadcast.save(update_fields=["status", "sent_at", "start_at", "updated_at"])

    tpl = broadcast.template
    if not tpl or tpl.status != "APPROVED":
        broadcast.status = "FAILED"
        broadcast.last_error = "Campaign requires an approved template."
        broadcast.save(update_fields=["status", "last_error", "updated_at"])
        return

    # Always exclude opted-out or blocked contacts
    contacts = WhatsAppContact.objects.filter(
        opt_in_status="SUBSCRIBED", is_blocked=False
    )
    submitted = 0
    failed = 0
    for contact in contacts.iterator():
        try:
            res = meta_client.send_template(
                to=contact.wa_id,
                template_name=tpl.name,
                language=tpl.language or "en",
            )
            wa_id = res.get("messages", [{}])[0].get("id", "")
            WhatsAppMessageLog.objects.create(
                wa_message_id=wa_id,
                contact=contact,
                recipient=contact.wa_id,
                customer_name=contact.profile_name or "",
                template=tpl,
                template_name=tpl.name,
                category=(tpl.category or "MARKETING").lower(),
                campaign=broadcast,
                status="sent",
                sent_at=timezone.now(),
            )
            submitted += 1
        except Exception as exc:
            failed += 1
            WhatsAppMessageLog.objects.create(
                contact=contact,
                recipient=contact.wa_id,
                customer_name=contact.profile_name or "",
                template=tpl,
                template_name=tpl.name,
                category=(tpl.category or "MARKETING").lower(),
                campaign=broadcast,
                status="failed",
                failure_reason=str(exc)[:500],
                sent_at=timezone.now(),
            )

    broadcast.submitted = submitted
    broadcast.recipients = submitted
    broadcast.failed = failed
    broadcast.status = "COMPLETED" if failed == 0 or submitted > 0 else "FAILED"
    broadcast.completed_at = timezone.now()
    broadcast.save(
        update_fields=[
            "submitted",
            "recipients",
            "failed",
            "status",
            "completed_at",
            "updated_at",
        ]
    )
    logger.info(
        "Broadcast %s finished: submitted=%s failed=%s (dry-run=%s)",
        broadcast.pk,
        submitted,
        failed,
        _dry_run(),
    )


# ---------------------------------------------------------------------------
# Webhooks & Token Expiry
# ---------------------------------------------------------------------------

def log_webhook_event(
    payload, kind="unknown", signature_valid=True, latency_ms=0, error=""
):
    event = WhatsAppWebhookEvent.objects.create(
        type=kind,
        event_type=(payload.get("field") or "")[:120],
        payload=payload,
        status="FAILED" if error else "DELIVERED",
        signature_valid=signature_valid,
        latency_ms=latency_ms,
        error=error,
    )
    if error:
        _record_integration_error("webhook", error, {"event_id": event.pk})
        WhatsAppNotification.objects.create(
            type="webhook",
            title="Webhook delivery issue",
            body=error[:300],
            link_tab="Health",
        )
    else:
        process_webhook_payload(payload)
    return event


def process_webhook_payload(payload: dict):
    """
    Processes inbound messages, opt-out keywords, and delivery/read status updates.
    """
    entries = (payload or {}).get("entry") or []
    wa_settings = WhatsAppSettings.get_solo()
    opt_out_words = {str(w).strip().upper() for w in (wa_settings.opt_out_keywords or [])}

    for entry in entries:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}

            # 1. Inbound messages
            contacts_map = {
                c.get("wa_id"): (c.get("profile") or {}).get("name", "")
                for c in (value.get("contacts") or [])
                if c.get("wa_id")
            }
            for msg in value.get("messages") or []:
                wa_id = msg.get("from")
                if not wa_id:
                    continue
                now = timezone.now()
                contact, created = WhatsAppContact.objects.get_or_create(
                    wa_id=wa_id,
                    defaults={"profile_name": contacts_map.get(wa_id, "")},
                )
                if contacts_map.get(wa_id) and not contact.profile_name:
                    contact.profile_name = contacts_map[wa_id]
                contact.last_inbound_at = now
                contact.save(update_fields=["profile_name", "last_inbound_at", "updated_at"])

                conv = (
                    WhatsAppConversation.objects.filter(contact=contact)
                    .exclude(status="ARCHIVED")
                    .order_by("-last_message_at")
                    .first()
                )
                if not conv:
                    conv = WhatsAppConversation.objects.create(
                        contact=contact, status="OPEN", first_message_at=now
                    )

                msg_type = msg.get("type", "text")
                body = ""
                if msg_type == "text":
                    body = (msg.get("text") or {}).get("body", "")
                elif msg_type == "button":
                    body = (msg.get("button") or {}).get("text", "")
                elif msg_type == "interactive":
                    inter = msg.get("interactive") or {}
                    body = (
                        (inter.get("button_reply") or {}).get("title")
                        or (inter.get("list_reply") or {}).get("title")
                        or ""
                    )

                WhatsAppMessage.objects.create(
                    conversation=conv,
                    wa_message_id=msg.get("id", ""),
                    direction="IN",
                    type=msg_type,
                    body=body,
                    status="DELIVERED",
                    timestamp=now,
                )
                conv.last_message_preview = (body or f"[{msg_type}]")[:255]
                conv.last_message_at = now
                conv.last_inbound_at = now
                conv.unread_count = (conv.unread_count or 0) + 1
                if conv.status == "RESOLVED":
                    conv.status = "OPEN"
                conv.save(
                    update_fields=[
                        "last_message_preview",
                        "last_message_at",
                        "last_inbound_at",
                        "unread_count",
                        "status",
                        "updated_at",
                    ]
                )

                # Opt-out detection
                if body.strip().upper() in opt_out_words:
                    contact.opt_in_status = "UNSUBSCRIBED"
                    contact.opt_out_at = now
                    contact.save(update_fields=["opt_in_status", "opt_out_at", "updated_at"])
                    WhatsAppConsentLog.objects.create(
                        contact=contact, action="opt_out", source="whatsapp_keyword", recorded_at=now
                    )
                elif created and contact.opt_in_status == "SUBSCRIBED":
                    WhatsAppConsentLog.objects.create(
                        contact=contact, action="opt_in", source="inbound_message", recorded_at=now
                    )

                run_automations_for_trigger("message_received", contact=contact, conversation=conv)

            # 2. Outbound status updates
            for st in value.get("statuses") or []:
                wa_msg_id = st.get("id")
                raw_status = (st.get("status") or "").lower()
                if not wa_msg_id or raw_status not in ("sent", "delivered", "read", "failed"):
                    continue
                now = timezone.now()
                errors = st.get("errors") or []
                err_text = errors[0].get("message", "") if errors else ""

                WhatsAppMessage.objects.filter(wa_message_id=wa_msg_id).update(
                    status=raw_status.upper(),
                    error_message=err_text,
                )
                log_updates = {"status": raw_status}
                if err_text:
                    log_updates["failure_reason"] = err_text
                if raw_status == "delivered":
                    log_updates["delivered_at"] = now
                elif raw_status == "read":
                    log_updates["read_at"] = now
                WhatsAppMessageLog.objects.filter(wa_message_id=wa_msg_id).update(**log_updates)


def check_token_expiry(account: WhatsAppAccount):
    if not account.token_expires_at:
        return None
    now = timezone.now()
    if account.token_expires_at <= now:
        account.connection_state = "expired"
        account.save(update_fields=["connection_state", "updated_at"])
    if account.token_expires_at < now + timedelta(days=7):
        WhatsAppNotification.objects.create(
            type="webhook",
            title="WhatsApp token expiring",
            body=f"Your WhatsApp access token expires on {account.token_expires_at:%b %d, %Y}.",
            link_tab="Connection",
        )