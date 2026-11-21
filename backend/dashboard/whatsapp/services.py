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
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppHealthCheck,
    WhatsAppMessage,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)

logger = logging.getLogger("whatsapp")


def _dry_run():
    return getattr(settings, "WHATSAPP_DRY_RUN", True)


def _enabled():
    return getattr(settings, "WHATSAPP_ENABLED", False)


class MetaClient:
    def _log(self, action, payload=None):
        logger.info("META[dry_run=%s enabled=%s] %s %s", _dry_run(), _enabled(), action, payload or {})

    def _graph_url(self, path):
        base = getattr(settings, "META_GRAPH_BASE_URL", "").rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    def _post_messages(self, payload):
        if not _enabled() or _dry_run():
            logger.info("META short-circuit (dry_run=%s enabled=%s): %s", _dry_run(), _enabled(), json.dumps(payload))
            return {"dry_run": True, "payload": payload}

        token = getattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
        phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
        if not token or not phone_id:
            raise RuntimeError("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set")

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
                return json.loads(body)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            logger.error("META HTTP %s: %s", exc.code, body)
            raise RuntimeError(f"Meta API error {exc.code}: {body}") from exc
        except Exception as exc:
            logger.exception("META request failed: %s", exc)
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
        try:
            result = self._post_messages(payload)
        except Exception:
            result = {"error": True}
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
                wa_message_id=wa_id,
                timestamp=timezone.now(),
            )
        return result

    def send_image(self, to, link, caption="", conversation=None):
        if not link or not link.startswith(("http://", "https://")):
            raise ValueError(f"image link must be absolute URL, got {link!r}")
        self._log("send_image", {"to": to, "link": link, "caption": (caption or "")[:64]})
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "image",
            "image": {"link": link},
        }
        if caption:
            payload["image"]["caption"] = caption
        try:
            result = self._post_messages(payload)
        except Exception:
            result = {"error": True}
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
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                media_url=link,
            )
        return result

    def send_template(self, to, template_name, params=None, conversation=None, language="en"):
        self._log("send_template", {"to": to, "name": template_name, "params": params or []})
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
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
        try:
            result = self._post_messages(payload)
        except Exception:
            result = {"error": True}
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
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                template_name=template_name,
                template_params=params or [],
            )
        return result

    def send_media(self, to, kind, media_url="", media_id="", conversation=None, caption=""):
        self._log("send_media", {"to": to, "kind": kind, "url": media_url, "id": media_id})
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
        try:
            result = self._post_messages(payload)
        except Exception:
            result = {"error": True}
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
                wa_message_id=wa_id,
                timestamp=timezone.now(),
                media_url=media_url or "",
                media_id=media_id or "",
            )
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


def _absolute_media_url(path):
    if not path:
        return ""
    path_str = str(path)
    if path_str.startswith("http://") or path_str.startswith("https://"):
        return path_str

    base = getattr(settings, "PUBLIC_BASE_URL", "")
    if not base:
        base = getattr(settings, "BACKEND_PUBLIC_URL", "")
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


def _product_is_active(product):
    for attr in ("is_active", "is_published", "is_available"):
        value = getattr(product, attr, None)
        if value is not None:
            return bool(value)
    status_value = getattr(product, "status", None)
    if status_value is not None:
        return str(status_value).lower() in ("active", "published", "live")
    return True


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

    product_name = (getattr(product, "name", "") or "")[:255]
    slug = (getattr(product, "slug", "") or "")[:255]
    description = getattr(product, "description", "") or ""

    return {
        "retailer_id": str(product.pk),
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
        "image_url": image_url,
        "product_url": _product_url(product),
        "category": _product_category(product),
        "brand": _product_brand(product),
        "tags": tags,
        "in_stock": in_stock,
        "stock_quantity": stock,
        "eligible": eligible,
        "is_linked": True,
    }


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

            existing = WhatsAppCatalogItem.objects.filter(
                catalog=catalog, retailer_id=retailer_id
            ).first()

            if existing:
                for key, value in fields.items():
                    setattr(existing, key, value)
                existing.is_removed = False
                existing.removed_at = None
                existing.sync_status = "SYNCED"
                existing.last_synced_at = timezone.now()
                existing.last_error = ""
                existing.save()
                updated += 1
            else:
                WhatsAppCatalogItem.objects.create(
                    catalog=catalog,
                    sync_status="SYNCED",
                    last_synced_at=timezone.now(),
                    **fields,
                )
                added += 1
        except Exception:
            failed += 1
            logger.exception("Failed to sync product %s", getattr(product, "pk", "?"))

    stale = WhatsAppCatalogItem.objects.filter(catalog=catalog).exclude(
        retailer_id__in=seen
    ).exclude(is_removed=True)
    stale.update(
        is_removed=True,
        removed_at=timezone.now(),
        sync_status="NOT_SYNCED",
        eligible=False,
    )

    catalog.last_full_sync_at = timezone.now()
    catalog.last_sync_added = added
    catalog.last_sync_updated = updated
    catalog.last_sync_failed = failed
    catalog.last_error = ""
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
    logger.info(
        "Catalog %s synced: added=%s updated=%s failed=%s",
        catalog.pk, added, updated, failed,
    )


def refresh_account_status(account):
    logger.info("Refreshing account status for %s", account.pk)
    start = timezone.now()
    if _dry_run() or not _enabled():
        account.last_synced_at = timezone.now()
        account.quality_score = account.quality_score or "GREEN"
        account.save(update_fields=["last_synced_at", "quality_score"])
        WhatsAppHealthCheck.objects.create(
            account=account,
            ok=True,
            latency_ms=int((timezone.now() - start).total_seconds() * 1000),
            error="",
        )
        return


def submit_template(template: WhatsAppTemplate):
    template.status = "PENDING"
    template.last_synced_at = timezone.now()
    template.save(update_fields=["status", "last_synced_at"])


def sync_templates():
    for tpl in WhatsAppTemplate.objects.all():
        if tpl.status in ("PENDING", "APPROVED"):
            tpl.last_synced_at = timezone.now()
            tpl.save(update_fields=["last_synced_at"])


def send_broadcast(broadcast: WhatsAppBroadcast):
    broadcast.status = "SENDING"
    broadcast.sent_at = timezone.now()
    broadcast.save(update_fields=["status", "sent_at"])
    logger.info("Broadcast %s dispatch requested (dry-run=%s)", broadcast.pk, _dry_run())


def log_webhook_event(payload, kind="unknown", signature_valid=True, latency_ms=0, error=""):
    return WhatsAppWebhookEvent.objects.create(
        type=kind,
        event_type=(payload.get("field") or "")[:120],
        payload=payload,
        status="FAILED" if error else "DELIVERED",
        signature_valid=signature_valid,
        latency_ms=latency_ms,
        error=error,
    )


def check_token_expiry(account):
    if not account.token_expires_at:
        return None
    if account.token_expires_at < timezone.now() + timedelta(days=7):
        from .models import WhatsAppNotification
        WhatsAppNotification.objects.create(
            type="system",
            title="WhatsApp token expiring",
            body=f"Your WhatsApp access token expires on {account.token_expires_at:%b %d, %Y}.",
            link_tab="Connection",
        )