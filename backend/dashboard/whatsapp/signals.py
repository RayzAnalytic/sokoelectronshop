import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from catalog.models import Product
from checkout.models import Order, OrderItem, Payment

from .models import (
    WhatsAppAttributionEvent,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppConsentLog,
    WhatsAppContact,
    WhatsAppOrder,
)

logger = logging.getLogger(__name__)

STATUS_MAP = {
    "PENDING": "PENDING",
    "CONFIRMED": "CONFIRMED",
    "PAID": "CONFIRMED",
    "PROCESSING": "CONFIRMED",
    "SHIPPED": "SHIPPED",
    "DISPATCHED": "SHIPPED",
    "DELIVERED": "DELIVERED",
    "CANCELLED": "CANCELLED",
}

CHECKOUT_TO_WA_STATUS = {
    "PENDING": "PENDING",
    "CONFIRMED": "CONFIRMED",
    "PROCESSING": "CONFIRMED",
    "PAID": "PAID",
    "SHIPPED": "SHIPPED",
    "DISPATCHED": "SHIPPED",
    "DELIVERED": "DELIVERED",
    "CANCELLED": "CANCELLED",
}

PAYMENT_MAP = {
    "MPESA": "MPESA",
    "MPS": "MPESA",
    "CARD": "CARD",
    "COD": "COD",
}

PAYMENT_METHOD_MAP = {
    "MPESA": "MPS",
    "MPS": "MPS",
    "CARD": "MPS",
    "COD": "COD",
}

PAID_STATUSES = ("PAID", "SHIPPED", "DELIVERED")


def _normalize_phone(phone):
    if not phone:
        return ""
    return str(phone).lstrip("+").replace(" ", "").replace("-", "")


def _ensure_contact(phone, name="", email=""):
    wa_id = _normalize_phone(phone)
    if not wa_id:
        return None
    now = timezone.now()
    contact, created = WhatsAppContact.objects.get_or_create(
        wa_id=wa_id,
        defaults={
            "profile_name": name or "",
            "email": email or "",
            "opt_in_status": "SUBSCRIBED",
            "opt_in_source": "CHECKOUT",
            "opt_in_at": now,
        },
    )
    if created:
        WhatsAppConsentLog.objects.create(
            contact=contact,
            action="opt_in",
            source="CHECKOUT",
            recorded_at=now,
        )
    else:
        update_fields = []
        if name and not contact.profile_name:
            contact.profile_name = name[:255]
            update_fields.append("profile_name")
        if email and not contact.email:
            contact.email = email
            update_fields.append("email")
        if update_fields:
            contact.save(update_fields=update_fields + ["updated_at"])
    return contact


def _refresh_contact_order_stats(contact: WhatsAppContact):
    if not contact:
        return
    agg = WhatsAppOrder.objects.filter(contact=contact).exclude(status="CANCELLED").aggregate(
        cnt=Count("id"),
        total=Sum("total"),
    )
    latest = WhatsAppOrder.objects.filter(contact=contact).order_by("-created_at").first()
    contact.order_count = agg["cnt"] or 0
    contact.total_spent = agg["total"] or Decimal("0.00")
    if latest:
        if latest.status in PAID_STATUSES:
            contact.last_payment_status = "paid"
        elif latest.status == "CANCELLED":
            contact.last_payment_status = "cancelled"
        else:
            contact.last_payment_status = "pending"

        if latest.status == "DELIVERED":
            contact.last_delivery_status = "delivered"
        elif latest.status == "SHIPPED":
            contact.last_delivery_status = "dispatched"
        else:
            contact.last_delivery_status = "pending"

    contact.save(
        update_fields=[
            "order_count",
            "total_spent",
            "last_payment_status",
            "last_delivery_status",
            "updated_at",
        ]
    )


def _ensure_payment(order, wa_order):
    if wa_order.status not in PAID_STATUSES:
        return None
    if Payment.objects.filter(order=order).exists():
        return None

    method = PAYMENT_METHOD_MAP.get((wa_order.payment_method or "").upper(), "MPS")
    amount = wa_order.total or Decimal("0.00")

    return Payment.objects.create(
        order=order,
        method=method,
        source="C2B",
        status="SUCCESS",
        phone_number=wa_order.contact_wa_id or "",
        amount=amount,
        fee=Decimal("0.00"),
        idempotency_key=f"wa-mirror-{wa_order.order_number}",
        mpesa_receipt_number=wa_order.payment_ref or "",
        result_code=0,
        result_description="Mirrored from WhatsAppOrder",
        settled_at=timezone.now(),
    )


def _mirror_checkout_to_whatsapp(order):
    existing = (
        WhatsAppOrder.objects.filter(checkout_order=order).first()
        or WhatsAppOrder.objects.filter(order_number=order.reference).first()
    )

    contact = _ensure_contact(
        getattr(order, "contact_phone", "") or "",
        getattr(order, "full_name", "") or "",
        getattr(order, "contact_email", "") or "",
    )

    if existing:
        next_status = CHECKOUT_TO_WA_STATUS.get(
            (order.status or "PENDING").upper(), existing.status
        )
        if (order.payment_status or "").upper() == "PAID" and next_status == "PENDING":
            next_status = "PAID"
        fields = []
        if existing.checkout_order_id != order.pk:
            existing.checkout_order = order
            fields.append("checkout_order")
        if existing.status != next_status:
            existing.status = next_status
            fields.append("status")
        if fields:
            existing.save(update_fields=fields + ["updated_at"])
        _refresh_contact_order_stats(contact or existing.contact)
        return existing

    items = [
        {
            "name": (i.name or "")[:255],
            "qty": int(i.quantity or 1),
            "price": str(i.unit_price or 0),
            "currency": "KES",
        }
        for i in order.items.all()
    ]

    address = getattr(order, "address_street", "") or ""
    town = getattr(order, "address_town", "") or ""
    if town:
        address = f"{address}, {town}" if address else town

    wa_status = CHECKOUT_TO_WA_STATUS.get((order.status or "PENDING").upper(), "PENDING")
    wa_order = WhatsAppOrder.objects.create(
        order_number=order.reference or f"WA-{order.pk}",
        contact=contact,
        contact_name=getattr(order, "full_name", "") or "",
        contact_wa_id=_normalize_phone(getattr(order, "contact_phone", "")),
        checkout_order=order,
        items=items,
        subtotal=order.subtotal or Decimal("0.00"),
        total=order.total or Decimal("0.00"),
        currency="KES",
        status=wa_status,
        payment_method=PAYMENT_MAP.get(
            (getattr(order, "payment_method", "") or "").upper(), "MPESA"
        ),
        payment_ref="",
        delivery_address=address,
    )
    _refresh_contact_order_stats(contact)
    return wa_order


def _mirror_whatsapp_to_checkout(wa_order):
    order = None
    if wa_order.checkout_order_id:
        order = Order.objects.filter(pk=wa_order.checkout_order_id).first()

    if order is None:
        order = Order.objects.filter(reference=wa_order.order_number).first()

    if order is None:
        payment_status = "PAID" if wa_order.status in PAID_STATUSES else "PENDING"
        order = Order.objects.create(
            reference=wa_order.order_number,
            status=STATUS_MAP.get(wa_order.status, "PENDING"),
            payment_status=payment_status,
            payment_method=wa_order.payment_method or "MPESA",
            source="whatsapp",
            contact_phone=wa_order.contact_wa_id or "",
            contact_email="",
            full_name=wa_order.contact_name or "",
            subtotal=wa_order.subtotal or Decimal("0.00"),
            total=wa_order.total or Decimal("0.00"),
            delivery_method="delivery",
            address_street=wa_order.delivery_address or "",
            address_town="",
            address_county="",
            notes=f"Mirrored from WhatsAppOrder {wa_order.order_number}",
        )
        for it in (wa_order.items or []):
            OrderItem.objects.create(
                order=order,
                name=(it.get("name") or "")[:255],
                quantity=int(it.get("qty", 1)),
                unit_price=Decimal(str(it.get("price", 0))),
            )
        WhatsAppOrder.objects.filter(pk=wa_order.pk).update(checkout_order=order)

    if order is not None:
        _ensure_payment(order, wa_order)

    if wa_order.contact:
        _refresh_contact_order_stats(wa_order.contact)


def _handle_order_events(order, created: bool, prev_status: str, prev_payment_status: str):
    from .services import dispatch_transactional_notification, run_automations_for_trigger

    contact = _ensure_contact(
        getattr(order, "contact_phone", "") or "",
        getattr(order, "full_name", "") or "",
        getattr(order, "contact_email", "") or "",
    )
    if not contact:
        return

    ref = getattr(order, "reference", "") or f"#{order.pk}"
    total_str = f"KES {order.total:,.2f}" if getattr(order, "total", None) is not None else ""
    params = [contact.profile_name or "Customer", ref, total_str]

    if created:
        if (getattr(order, "source", "") or "").lower() == "whatsapp":
            WhatsAppAttributionEvent.objects.create(
                event_type="attributed_order",
                contact=contact,
                order=order,
                revenue=order.total or Decimal("0.00"),
                currency="KES",
            )
        dispatch_transactional_notification(
            "order_created",
            contact=contact,
            order=order,
            order_reference=ref,
            params=params,
        )
        run_automations_for_trigger("order_created", contact=contact, params=params)
        return

    cur_status = (getattr(order, "status", "") or "").upper()
    if cur_status != prev_status:
        if cur_status == "PROCESSING":
            dispatch_transactional_notification(
                "order_processing", contact=contact, order=order, order_reference=ref, params=params
            )
        elif cur_status in ("SHIPPED", "DISPATCHED"):
            dispatch_transactional_notification(
                "order_dispatched", contact=contact, order=order, order_reference=ref, params=params
            )
            run_automations_for_trigger("order_dispatched", contact=contact, params=params)
        elif cur_status == "DELIVERED":
            dispatch_transactional_notification(
                "order_delivered", contact=contact, order=order, order_reference=ref, params=params
            )
            run_automations_for_trigger("order_delivered", contact=contact, params=params)
            run_automations_for_trigger("purchase_completed", contact=contact, params=params)
        elif cur_status == "CANCELLED":
            dispatch_transactional_notification(
                "order_cancelled", contact=contact, order=order, order_reference=ref, params=params
            )
        elif cur_status == "REFUNDED":
            dispatch_transactional_notification(
                "refund_processed", contact=contact, order=order, order_reference=ref, params=params
            )

    cur_pay = (getattr(order, "payment_status", "") or "").upper()
    if cur_pay != prev_payment_status:
        if cur_pay == "PAID":
            contact.last_payment_status = "paid"
            contact.save(update_fields=["last_payment_status", "updated_at"])
        elif cur_pay == "FAILED":
            contact.last_payment_status = "failed"
            contact.save(update_fields=["last_payment_status", "updated_at"])
        elif cur_pay == "REFUNDED":
            dispatch_transactional_notification(
                "refund_processed", contact=contact, order=order, order_reference=ref, params=params
            )


def _handle_payment_event(payment, created: bool, prev_status: str):
    from .services import dispatch_transactional_notification, run_automations_for_trigger

    cur_status = (getattr(payment, "status", "") or "").upper()
    if not created and cur_status == prev_status:
        return

    order = getattr(payment, "order", None)
    phone = getattr(payment, "phone_number", "") or (
        getattr(order, "contact_phone", "") if order else ""
    )
    name = getattr(order, "full_name", "") if order else ""
    contact = _ensure_contact(phone, name)
    if not contact:
        return

    ref = (getattr(order, "reference", "") if order else "") or f"#{payment.pk}"
    amount_str = f"KES {payment.amount:,.2f}" if getattr(payment, "amount", None) is not None else ""
    params = [contact.profile_name or "Customer", ref, amount_str]

    if cur_status in ("SUCCESS", "PAID", "COMPLETED"):
        contact.last_payment_status = "paid"
        contact.save(update_fields=["last_payment_status", "updated_at"])
        dispatch_transactional_notification(
            "payment_confirmed", contact=contact, order=order, order_reference=ref, params=params
        )
        run_automations_for_trigger("payment_confirmed", contact=contact, params=params)
    elif cur_status in ("FAILED", "CANCELLED"):
        contact.last_payment_status = "failed"
        contact.save(update_fields=["last_payment_status", "updated_at"])
        dispatch_transactional_notification(
            "payment_failed", contact=contact, order=order, order_reference=ref, params=params
        )


# ---------------------------------------------------------------------------
# Signal Receivers
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Order)
def capture_previous_order_state(sender, instance, **kwargs):
    if instance.pk:
        prev = (
            Order.objects.filter(pk=instance.pk)
            .values("status", "payment_status")
            .first()
        )
        instance._previous_status = (prev["status"] or "").upper() if prev else ""
        instance._previous_payment_status = (
            (prev["payment_status"] or "").upper() if prev else ""
        )
    else:
        instance._previous_status = ""
        instance._previous_payment_status = ""


@receiver(post_save, sender=Order)
def on_checkout_order_saved(sender, instance, created, **kwargs):
    prev_status = getattr(instance, "_previous_status", "")
    prev_pay = getattr(instance, "_previous_payment_status", "")

    def _run():
        if (instance.source or "").lower() == "whatsapp" or WhatsAppOrder.objects.filter(
            checkout_order=instance
        ).exists():
            _mirror_checkout_to_whatsapp(instance)
        _handle_order_events(instance, created, prev_status, prev_pay)

    transaction.on_commit(_run)


@receiver(pre_save, sender=Payment)
def capture_previous_payment_state(sender, instance, **kwargs):
    if instance.pk:
        prev = Payment.objects.filter(pk=instance.pk).values("status").first()
        instance._previous_status = (prev["status"] or "").upper() if prev else ""
    else:
        instance._previous_status = ""


@receiver(post_save, sender=Payment)
def on_payment_saved(sender, instance, created, **kwargs):
    prev_status = getattr(instance, "_previous_status", "")
    transaction.on_commit(lambda: _handle_payment_event(instance, created, prev_status))


@receiver(post_save, sender=WhatsAppOrder)
def on_whatsapp_order_saved(sender, instance, created, **kwargs):
    transaction.on_commit(lambda: _mirror_whatsapp_to_checkout(instance))


@receiver(post_save, sender=Product)
def on_product_saved(sender, instance, created=False, **kwargs):
    catalog = WhatsAppCatalog.objects.first()
    if not catalog or not catalog.auto_sync:
        return
    transaction.on_commit(lambda: _sync_product_to_catalog(catalog, instance))


@receiver(post_delete, sender=Product)
def on_product_deleted(sender, instance, **kwargs):
    WhatsAppCatalogItem.objects.filter(store_product_id=instance.pk).update(
        is_removed=True,
        removed_at=timezone.now(),
        product_status="archived",
        sync_status="archived",
        eligible=False,
    )


def _sync_product_to_catalog(catalog, product):
    try:
        from .services import _product_to_item_fields, _resolve_sync_status, sync_catalog_item

        item = WhatsAppCatalogItem.objects.filter(
            catalog=catalog, retailer_id=str(product.pk)
        ).first()
        if item:
            if not item.store_product_id:
                item.store_product = product
            sync_catalog_item(item)
        else:
            fields = _product_to_item_fields(product, catalog)
            WhatsAppCatalogItem.objects.create(
                catalog=catalog,
                sync_status=_resolve_sync_status(fields, catalog),
                last_synced_at=timezone.now(),
                **fields,
            )
    except Exception:
        logger.exception(
            "WhatsApp auto-sync failed for product %s (catalog %s)",
            product.pk,
            catalog.pk,
        )