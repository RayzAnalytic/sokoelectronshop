import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from checkout import mpesa
from checkout.exceptions import CheckoutError, MpesaError
from checkout.models import (
    Order,
    Payment,
    PaymentEvent,
    ReconciliationLog,
)
from checkout.services import change_order_status, transition_payment

logger = logging.getLogger(__name__)


@transaction.atomic
def retry_payment(
    *,
    payment: Payment,
    user=None,
    phone: str | None = None,
) -> Payment:
    if payment.status not in {
        Payment.Status.FAILED,
        Payment.Status.CANCELLED,
        Payment.Status.TIMEOUT,
    }:
        raise CheckoutError(f"Cannot retry a payment in status {payment.status}.")

    if payment.method != Payment.Method.MPS:
        raise CheckoutError(
            "Only M-Pesa payments can be retried through the gateway. "
            "Use reconcile to mark cash or account payments as settled."
        )

    target_phone_raw = phone or payment.phone_number
    if not target_phone_raw:
        raise CheckoutError("No phone number available to retry against.")

    normalized_phone = mpesa.normalize_phone(target_phone_raw)
    order = payment.order
    amount = int(payment.amount)

    retry_key = f"retry-{payment.id}-{int(timezone.now().timestamp())}"[:64]

    new_payment = Payment.objects.create(
        order=order,
        method=Payment.Method.MPS,
        status=Payment.Status.PENDING,
        amount=payment.amount,
        phone_number=normalized_phone,
        idempotency_key=retry_key,
    )

    PaymentEvent.log(
        new_payment,
        "Retry initiated",
        detail=f"Retry of {payment.id}",
    )

    try:
        result = mpesa.stk_push(
            phone=normalized_phone,
            amount=amount,
            reference=order.reference,
        )
    except MpesaError as exc:
        transition_payment(
            new_payment,
            Payment.Status.FAILED,
            result_description=str(exc),
        )
        raise

    transition_payment(
        new_payment,
        Payment.Status.PROCESSING,
        merchant_request_id=result["merchant_request_id"],
        checkout_request_id=result["checkout_request_id"],
    )
    PaymentEvent.log(
        new_payment,
        "Awaiting customer PIN",
        state=PaymentEvent.State.ACTIVE,
        detail=f"CheckoutRequestID {result['checkout_request_id']}",
    )

    return new_payment


@transaction.atomic
def reconcile_payment(
    *,
    payment: Payment,
    action: str,
    order_reference: str = "",
    note: str = "",
    actor=None,
) -> Payment:
    if not payment:
        raise CheckoutError("Payment is required.")

    valid_actions = {c for c, _ in ReconciliationLog.Action.choices}
    if action not in valid_actions:
        raise CheckoutError(f"Unknown reconciliation action: {action}")

    if order_reference and action == ReconciliationLog.Action.MATCHED:
        clean_ref = order_reference.strip()
        if clean_ref and clean_ref != payment.order.reference:
            target = Order.objects.filter(reference=clean_ref).first()
            if not target:
                raise CheckoutError(f"No order found with reference {clean_ref}.")
            payment.order = target
            payment.save(update_fields=["order", "updated_at"])

    if action == ReconciliationLog.Action.CASH_PAID:
        if payment.status in Payment.TERMINAL_STATUSES:
            logger.warning(
                "CASH_PAID on terminal payment %s (status=%s) — logging only",
                payment.id, payment.status,
            )
        else:
            payment.status = Payment.Status.SUCCESS
            payment.fee = Decimal("0")
            payment.settled_at = timezone.now()
            payment.save(update_fields=[
                "status", "fee", "settled_at", "updated_at",
            ])

            actor_name = getattr(actor, "get_full_name", lambda: "")() or "Admin"
            PaymentEvent.log(
                payment,
                "Cash collected by rider",
                detail=f"Recorded by {actor_name}",
            )

            order = payment.order
            total_settled = sum(
                (
                    p.amount
                    for p in order.payments.filter(status=Payment.Status.SUCCESS)
                ),
                Decimal("0"),
            )
            if total_settled >= order.total:
                Order.objects.filter(pk=order.pk).update(
                    payment_status=Order.PaymentStatus.PAID,
                    payment_method=Order.PaymentMethod.COD,
                )
                order.refresh_from_db(
                    fields=["payment_status", "payment_method"],
                )
                if order.status == Order.Status.PENDING:
                    change_order_status(
                        order,
                        Order.Status.CONFIRMED,
                        actor=actor,
                        actor_label="Admin",
                        note="Cash collected on delivery.",
                    )

    actor_name = getattr(actor, "get_full_name", lambda: "")() or "Admin"
    ReconciliationLog.objects.create(
        payment=payment,
        action=action,
        actor=actor if getattr(actor, "pk", None) else None,
        actor_label=actor_name[:120],
        matched_order_reference=order_reference[:64] if order_reference else "",
        note=note or "",
    )

    return payment


@transaction.atomic
def mark_cash_collected(
    *,
    payment: Payment,
    actor=None,
    note: str = "",
) -> Payment:
    return reconcile_payment(
        payment=payment,
        action=ReconciliationLog.Action.CASH_PAID,
        note=note,
        actor=actor,
    )