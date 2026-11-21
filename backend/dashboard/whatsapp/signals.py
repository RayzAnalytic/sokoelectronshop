

import logging
from decimal import Decimal

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from catalog.models import Product
from checkout.models import Order, OrderItem, Payment
from .models import WhatsAppOrder, WhatsAppContact, WhatsAppCatalog


logger = logging.getLogger(__name__)

STATUS_MAP = {
    'PENDING': 'PENDING',
    'CONFIRMED': 'CONFIRMED',
    'PAID': 'CONFIRMED',
    'SHIPPED': 'SHIPPED',
    'DELIVERED': 'DELIVERED',
    'CANCELLED': 'CANCELLED',
}

PAYMENT_MAP = {
    'MPESA': 'MPESA',
    'MPS': 'MPESA',
    'CARD': 'CARD',
    'COD': 'COD',
}

PAYMENT_METHOD_MAP = {
    'MPESA': 'MPS',
    'MPS': 'MPS',
    'CARD': 'MPS',
    'COD': 'COD',
}

PAID_STATUSES = ('PAID', 'SHIPPED', 'DELIVERED')


def _normalize_phone(phone):
    if not phone:
        return ''
    return str(phone).lstrip('+').replace(' ', '').replace('-', '')


def _ensure_contact(phone, name=''):
    wa_id = _normalize_phone(phone)
    if not wa_id:
        return None
    contact, _ = WhatsAppContact.objects.get_or_create(
        wa_id=wa_id,
        defaults={
            'profile_name': name or '',
            'opt_in_status': 'SUBSCRIBED',
            'opt_in_source': 'CHECKOUT',
        },
    )
    return contact


def _ensure_payment(order, wa_order):
    if wa_order.status not in PAID_STATUSES:
        return None
    if Payment.objects.filter(order=order).exists():
        return None

    method = PAYMENT_METHOD_MAP.get((wa_order.payment_method or '').upper(), 'MPS')
    amount = wa_order.total or Decimal('0.00')

    return Payment.objects.create(
        order=order,
        method=method,
        source='C2B',
        status='SUCCESS',
        phone_number=wa_order.contact_wa_id or '',
        amount=amount,
        fee=Decimal('0.00'),
        idempotency_key=f'wa-mirror-{wa_order.order_number}',
        mpesa_receipt_number=wa_order.payment_ref or '',
        result_code=0,
        result_description='Mirrored from WhatsAppOrder',
        settled_at=timezone.now(),
    )


def _mirror_checkout_to_whatsapp(order):
    if WhatsAppOrder.objects.filter(checkout_order=order).exists():
        return
    if WhatsAppOrder.objects.filter(order_number=order.reference).exists():
        return

    contact = _ensure_contact(
        getattr(order, 'contact_phone', '') or '',
        order.full_name or '',
    )

    items = [
        {
            'name': (i.name or '')[:255],
            'qty': int(i.quantity or 1),
            'price': str(i.unit_price or 0),
            'currency': 'KES',
        }
        for i in order.items.all()
    ]

    address = (order.address_street or '')
    if order.address_town:
        address = f'{address}, {order.address_town}' if address else order.address_town

    WhatsAppOrder.objects.create(
        order_number=order.reference or f'WA-{order.pk}',
        contact=contact,
        contact_name=order.full_name or '',
        contact_wa_id=_normalize_phone(getattr(order, 'contact_phone', '')),
        checkout_order=order,
        items=items,
        subtotal=order.subtotal or Decimal('0.00'),
        total=order.total or Decimal('0.00'),
        currency='KES',
        status=(order.status or 'PENDING').upper(),
        payment_method=PAYMENT_MAP.get((order.payment_method or '').upper(), 'MPESA'),
        payment_ref='',
        delivery_address=address,
    )


def _mirror_whatsapp_to_checkout(wa_order):
    order = None
    if wa_order.checkout_order_id:
        order = Order.objects.filter(pk=wa_order.checkout_order_id).first()

    if order is None:
        order = Order.objects.filter(reference=wa_order.order_number).first()

    if order is None:
        payment_status = 'PAID' if wa_order.status in PAID_STATUSES else 'PENDING'
        order = Order.objects.create(
            reference=wa_order.order_number,
            status=STATUS_MAP.get(wa_order.status, 'PENDING'),
            payment_status=payment_status,
            payment_method=wa_order.payment_method or 'MPESA',
            source='whatsapp',
            contact_phone=wa_order.contact_wa_id or '',
            contact_email='',
            full_name=wa_order.contact_name or '',
            subtotal=wa_order.subtotal or Decimal('0.00'),
            total=wa_order.total or Decimal('0.00'),
            delivery_method='delivery',
            address_street=wa_order.delivery_address or '',
            address_town='',
            address_county='',
            notes=f'Mirrored from WhatsAppOrder {wa_order.order_number}',
        )
        for it in (wa_order.items or []):
            OrderItem.objects.create(
                order=order,
                name=(it.get('name') or '')[:255],
                quantity=int(it.get('qty', 1)),
                unit_price=Decimal(str(it.get('price', 0))),
            )
        WhatsAppOrder.objects.filter(pk=wa_order.pk).update(checkout_order=order)

    if order is not None:
        _ensure_payment(order, wa_order)


@receiver(post_save, sender=Order)
def on_checkout_order_saved(sender, instance, created, **kwargs):
    if not created:
        return
    if (instance.source or '').lower() != 'whatsapp':
        return
    transaction.on_commit(lambda: _mirror_checkout_to_whatsapp(instance))


@receiver(post_save, sender=WhatsAppOrder)
def on_whatsapp_order_saved(sender, instance, created, **kwargs):
    transaction.on_commit(lambda: _mirror_whatsapp_to_checkout(instance))


@receiver(post_save, sender=Product)
def on_product_saved(sender, instance, created=False, **kwargs):
    catalog = WhatsAppCatalog.objects.first()
    if not catalog or not catalog.auto_sync:
        return
    transaction.on_commit(lambda: _sync_product_to_catalog(catalog, instance))


def _sync_product_to_catalog(catalog, product):
    try:
        from .services import sync_catalog
        sync_catalog(catalog)
    except Exception:
        logger.exception(
            "WhatsApp auto-sync failed for product %s (catalog %s)",
            product.pk,
            catalog.pk,
        )