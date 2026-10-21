import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from checkout.models import Order
from checkout.services import change_order_status

from .models import Refund, ReturnItem, ReturnRequest, ReturnSettings

logger = logging.getLogger(__name__)


def _settings():
    return ReturnSettings.load()


def _round2(value):
    return value.quantize(Decimal('0.01'))


def _compute_original_amount(items):
    total = sum(
        (Decimal(str(i['price'])) * int(i['qty']) for i in items),
        Decimal('0.00'),
    )
    return _round2(total)


def _items_from_order(order):
    items = []
    for oi in order.items.all():
        items.append({
            'product_name': oi.name,
            'sku': getattr(oi, 'sku', '') or '',
            'qty': oi.quantity,
            'price': oi.unit_price,
            'image': oi.image_url or '',
            'condition': ReturnItem.Condition.UNOPENED,
        })
    return items


@transaction.atomic
def create_from_order(
    order,
    *,
    reason=None,
    reason_text='',
    notes='',
    actor=None,
):
    if order.status == Order.Status.CANCELLED:
        raise ValueError('Cannot create a return for a cancelled order.')

    existing = ReturnRequest.objects.filter(order=order).first()
    if existing:
        logger.info(
            'ReturnRequest already exists for order %s (code=%s)',
            order.reference, existing.code,
        )
        return existing

    items = _items_from_order(order)
    if not items:
        raise ValueError('Order has no items to return.')

    snapshot = order.snapshot or {}
    request = ReturnRequest.objects.create(
        order=order,
        reason=reason,
        reason_text=reason_text or (reason.label if reason else ''),
        customer_name=snapshot.get('full_name') or order.contact_email,
        customer_email=order.contact_email,
        customer_phone=order.contact_phone or '',
        notes=notes or '',
        original_amount=_compute_original_amount(items),
        status=ReturnRequest.Status.REQUESTED,
        refund_status=ReturnRequest.RefundStatus.NONE,
        refund_method=ReturnRequest.RefundMethod.ORIGINAL,
    )

    for it in items:
        ReturnItem.objects.create(
            return_request=request,
            product_name=it['product_name'],
            sku=it['sku'],
            qty=it['qty'],
            price=Decimal(str(it['price'])),
            image=it['image'],
            condition=it['condition'],
        )

    return request


@transaction.atomic
def create_return_request(
    *,
    order,
    reason,
    reason_text,
    notes,
    items,
    actor=None,
):
    if order.status != Order.Status.DELIVERED:
        raise ValueError(
            'Only delivered orders are eligible for a return request.'
        )

    snapshot = order.snapshot or {}
    request = ReturnRequest.objects.create(
        order=order,
        reason=reason,
        reason_text=reason_text or (reason.label if reason else ''),
        customer_name=snapshot.get('full_name') or order.contact_email,
        customer_email=order.contact_email,
        customer_phone=order.contact_phone or '',
        notes=notes or '',
        original_amount=_compute_original_amount(items),
        status=ReturnRequest.Status.REQUESTED,
        refund_status=ReturnRequest.RefundStatus.NONE,
        refund_method=ReturnRequest.RefundMethod.ORIGINAL,
    )

    for it in items:
        ReturnItem.objects.create(
            return_request=request,
            product_name=it['product_name'],
            sku=it.get('sku') or '',
            qty=int(it['qty']),
            price=Decimal(str(it['price'])),
            image=it.get('image') or '',
            condition=it.get('condition') or ReturnItem.Condition.UNOPENED,
        )

    s = _settings()
    if (
        s.auto_approve_under > 0
        and request.original_amount <= s.auto_approve_under
    ):
        approve_return(request, actor=actor, auto=True)

    return request


@transaction.atomic
def approve_return(request, *, actor=None, auto=False):
    if request.status not in (
        ReturnRequest.Status.REQUESTED,
        ReturnRequest.Status.UNDER_REVIEW,
    ):
        return request

    request.status = ReturnRequest.Status.APPROVED
    request.refund_status = ReturnRequest.RefundStatus.PENDING
    request.refund_amount = request.original_amount
    request.save(update_fields=[
        'status', 'refund_status', 'refund_amount', 'updated_at',
    ])

    Refund.objects.create(
        return_request=request,
        amount=request.refund_amount,
        method=request.refund_method,
        status=Refund.Status.PENDING,
        created_by=actor if getattr(actor, 'pk', None) else None,
        note='Auto-approved' if auto else '',
    )
    return request


@transaction.atomic
def reject_return(request, *, actor=None, note=''):
    request.status = ReturnRequest.Status.REJECTED
    request.resolved_at = timezone.now()
    if note:
        if request.internal_notes:
            request.internal_notes = request.internal_notes + '\n' + note
        else:
            request.internal_notes = note
    request.save(update_fields=[
        'status', 'resolved_at', 'internal_notes', 'updated_at',
    ])
    return request


@transaction.atomic
def mark_item_received(request, *, actor=None):
    if request.status not in (
        ReturnRequest.Status.APPROVED,
        ReturnRequest.Status.AWAITING_ITEM,
    ):
        return request

    request.status = ReturnRequest.Status.ITEM_RECEIVED
    request.save(update_fields=['status', 'updated_at'])

    change_order_status(
        request.order,
        Order.Status.RETURNED,
        actor=actor,
        actor_label='Returns',
        note=f'Return {request.code} received — items restocked.',
        notify=False,
    )
    return request


@transaction.atomic
def process_refund(
    request,
    *,
    actor=None,
    method=None,
    reference='',
    note='',
):
    if request.status not in (
        ReturnRequest.Status.APPROVED,
        ReturnRequest.Status.ITEM_RECEIVED,
    ):
        return request

    s = _settings()
    gross = request.original_amount
    fee = _round2(gross * s.restocking_fee_pct / Decimal('100'))
    net = _round2(gross - fee)

    if method:
        request.refund_method = method
    request.refund_amount = net
    request.refund_status = ReturnRequest.RefundStatus.COMPLETED
    request.status = ReturnRequest.Status.CLOSED
    request.resolved_at = timezone.now()
    request.save(update_fields=[
        'refund_method', 'refund_amount', 'refund_status',
        'status', 'resolved_at', 'updated_at',
    ])

    latest = request.refunds.order_by('-created_at').first()
    if latest and latest.status != Refund.Status.COMPLETED:
        latest.status = Refund.Status.COMPLETED
        latest.amount = net
        if reference:
            latest.reference = reference
        if note:
            latest.note = note
        latest.completed_at = timezone.now()
        latest.save(update_fields=[
            'status', 'amount', 'reference', 'note', 'completed_at',
        ])
    else:
        Refund.objects.create(
            return_request=request,
            amount=net,
            method=request.refund_method,
            status=Refund.Status.COMPLETED,
            reference=reference,
            note=note,
            created_by=actor if getattr(actor, 'pk', None) else None,
            completed_at=timezone.now(),
        )

    return request