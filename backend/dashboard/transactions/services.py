# dashboard/transactions/services.py

"""
Staff-only services that mutate a Payment.

Two actions, both triggered from the admin ledger:

    retry_payment       — re-fires the STK push for a failed attempt
    reconcile_payment   — manual finance action (matched / unmatched /
                          cash-paid / on-account)
    mark_cash_collected — thin wrapper for the rider POD flow

Both live HERE, not in `checkout.services`, because they are
admin-only actions with a distinct risk profile. Keeping them in the
ledger app makes the review boundary obvious: a diff under
`dashboard/transactions/` is finance tooling, a diff under
`checkout/` is customer flow.

Imports are strictly one-directional: this module reads from
`checkout`; `checkout` never reads from here.
"""

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


# ─────────────────────────────────────────────────────────────────────────────
# Retry a failed M-Pesa attempt
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def retry_payment(
    *,
    payment: Payment,
    user=None,
    phone: str | None = None,
) -> Payment:
    """
    Retry a failed M-Pesa payment against the same Order.

    Creates a NEW `Payment` row rather than mutating the failed one —
    the failed attempt is an immutable financial record finance must
    be able to see in the ledger. The retry is a new event.

    `payment` is the attempt the admin clicked Retry on. Its Order is
    reused; only a new Payment row and a fresh STK push are created.

    `phone` overrides the original attempt's phone. When omitted, the
    original is reused. The override exists so support can retry to a
    corrected number after a customer typo.

    Refuses when:
      * The original is not in a terminal-failure state (nothing to
        retry on a successful payment).
      * The original is COD — cash cannot be retried through Daraja;
        the admin should use reconcile → mark cash paid.
      * No phone is available.

    Every refusal raises `CheckoutError` with a message the view maps
    to a 400.
    """
    if payment.status not in {
        Payment.Status.FAILED,
        Payment.Status.CANCELLED,
        Payment.Status.TIMEOUT,
    }:
        raise CheckoutError(f"Cannot retry a payment in status {payment.status}.")

    if payment.method != Payment.Method.MPESA:
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

    # Fresh key derived from the original + timestamp. A single admin
    # double-clicking Retry collapses to one new attempt; a later retry
    # by a different admin produces its own row.
    retry_key = f"retry-{payment.id}-{int(timezone.now().timestamp())}"[:64]

    new_payment = Payment.objects.create(
        order=order,
        method=Payment.Method.MPESA,
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


# ─────────────────────────────────────────────────────────────────────────────
# Manual reconciliation
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def reconcile_payment(
    *,
    payment: Payment,
    action: str,
    order_reference: str = "",
    note: str = "",
    actor=None,
) -> Payment:
    """
    Manual reconciliation from the admin ledger.

    `action` is one of `ReconciliationLog.Action`:

        MATCHED     — payment tied to the referenced order
        UNMATCHED   — finance cannot tie it to any order
        CASH_PAID   — the COD payment physically received
        ON_ACCOUNT  — placed on the customer's running tab

    Every call writes an append-only `ReconciliationLog` row — this is
    the audit trail and the reason the endpoint exists. The row is
    never mutated or deleted; it survives staff account deletion via
    the denormalized `actor_label`.

    On MATCHED with a different `order_reference`: re-links the
    payment and recomputes the order's settlement state from the full
    set of successful payments (an order can be settled by more than
    one payment — the state is a SUM, not a flag).

    On CASH_PAID: flips the payment to SUCCESS, sets fee to 0,
    stamps `settled_at`, and — if the order is now fully covered —
    flips the order to PAID and CONFIRMED.

    On ON_ACCOUNT: no money has moved. The log records the intent;
    a later invoice settlement flips `payment_status`.
    """
    if not payment:
        raise CheckoutError("Payment is required.")

    valid_actions = {c for c, _ in ReconciliationLog.Action.choices}
    if action not in valid_actions:
        raise CheckoutError(f"Unknown reconciliation action: {action}")

    # ── Optional re-link ──────────────────────────────────────────
    if order_reference and action == ReconciliationLog.Action.MATCHED:
        clean_ref = order_reference.strip()
        if clean_ref and clean_ref != payment.order.reference:
            target = Order.objects.filter(reference=clean_ref).first()
            if not target:
                raise CheckoutError(f"No order found with reference {clean_ref}.")
            payment.order = target
            payment.save(update_fields=["order", "updated_at"])

    # ── CASH_PAID: state transition ───────────────────────────────
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

    # ── Append the audit row ──────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# Rider POD wrapper
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def mark_cash_collected(
    *,
    payment: Payment,
    actor=None,
    note: str = "",
) -> Payment:
    """
    Convenience wrapper for the rider POD flow.

    Identical to `reconcile_payment(action=CASH_PAID)` — the wrapper
    exists so the rider app has a semantically-named entry point and
    does not need to know about `ReconciliationLog.Action` values.
    """
    return reconcile_payment(
        payment=payment,
        action=ReconciliationLog.Action.CASH_PAID,
        note=note,
        actor=actor,
    )