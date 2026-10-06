"""
Write actions for the admin orders module.

Every function here is a single action the admin can take. Views call
these; they never touch the ORM directly.

STATUS TRANSITIONS go through `checkout.services.change_order_status`,
which handles the timeline event and the customer notification. This
module does NOT duplicate that logic — it just checks the transition
is legal from the admin panel's perspective and delegates.

PAYMENT STATUS is separate. A refund is not a fulfillment transition —
it updates `payment_status` and writes a timeline event, but leaves
`status` alone unless the admin also asks to move it. That is why
refunds live here, not on the order service.
"""

import logging

from django.db import transaction

from checkout.models import Order
from checkout.services import change_order_status, record_status_event

from .constants import is_transition_allowed

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Status transitions
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def set_status(
    order: Order,
    new_status: str,
    *,
    actor,
    note: str = "",
) -> Order:
    """
    Move an order to a new fulfillment status.

    Validates against `ALLOWED_TRANSITIONS` — a stricter contract than
    the underlying model allows. The model would happily let you go
    `delivered` → `pending`; the admin panel forbids it. Rewriting
    history on an already-shipped order is a footgun.

    Idempotent: calling with the current status is a no-op and returns
    the order unchanged, no timeline event, no notification.

    Raises ValueError with a customer-safe message when the transition
    is not allowed.

    Delegates to `checkout.services.change_order_status`, which writes
    the timeline event and fires the notification.
    """
    if order.status == new_status:
        # Idempotent no-op.
        return order

    if not is_transition_allowed(order.status, new_status):
        from_display = dict(Order.Status.choices).get(
            order.status, order.status,
        )
        to_display = dict(Order.Status.choices).get(
            new_status, new_status,
        )
        raise ValueError(
            f"Cannot move an order from {from_display} to {to_display}."
        )

    actor_label = (
        f"Admin {actor.get_username()}" if actor else "Admin"
    )

    return change_order_status(
        order,
        new_status,
        actor=actor,
        actor_label=actor_label,
        note=note,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tracking
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def set_tracking(
    order: Order,
    *,
    courier: str = "",
    tracking_number: str = "",
    actor,
) -> Order:
    """
    Set or update the courier and tracking number on an order.

    These are first-class columns, so this is a plain field write.
    Does NOT advance the status — the admin sets tracking, then
    separately moves the order to Shipped. Two clicks, but predictable.

    Writes a timeline event so the customer sees the tracking details
    appear on the order. The event uses the current status as both
    from and to, so it does not look like a status transition.

    Returns the updated order.
    """
    courier = (courier or "").strip()[:120]
    tracking_number = (tracking_number or "").strip()[:120]

    changed = False
    if order.courier != courier:
        order.courier = courier
        changed = True
    if order.tracking_number != tracking_number:
        order.tracking_number = tracking_number
        changed = True

    if not changed:
        return order

    order.save(update_fields=["courier", "tracking_number", "updated_at"])

    actor_label = (
        f"Admin {actor.get_username()}" if actor else "Admin"
    )

    bits = []
    if courier:
        bits.append(f"Courier: {courier}")
    if tracking_number:
        bits.append(f"Tracking: {tracking_number}")
    note = " · ".join(bits) or "Tracking updated."

    record_status_event(
        order,
        from_status=order.status,
        to_status=order.status,
        actor=actor,
        actor_label=actor_label,
        note=note,
    )

    return order


# ─────────────────────────────────────────────────────────────────────────────
# Refund
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def refund_order(
    order: Order,
    *,
    actor,
    amount=None,
    reason: str = "",
) -> Order:
    """
    Mark an order as refunded.

    IMPORTANT: This does NOT move money. It flips `payment_status` to
    REFUNDED and writes a timeline event. The actual M-Pesa reversal
    or manual bank transfer is a separate step the admin performs
    outside this system. If you later add an automated refund provider
    (Daraja's reversal API, for instance), this is where the network
    call goes.

    `amount` is optional. When omitted, the full order total is
    refunded. When provided, it must equal the order total — partial
    refunds are not supported yet and would need a `Refund` model that
    records each partial against the order.

    Reasons:
      * Full refund only, for now.
      * Cannot refund an already-refunded order (idempotent — returns
        unchanged).
      * Cannot refund an order with `payment_status = UNPAID` — there
        is nothing to refund. COD orders that were never delivered are
        simply cancelled, not refunded.

    Returns the updated order. Raises ValueError on invalid input.
    """
    from decimal import Decimal
    from django.core.exceptions import ValidationError as DjangoValidationError

    if order.payment_status == Order.PaymentStatus.REFUNDED:
        # Idempotent — clicking twice is harmless.
        return order

    if order.payment_status == Order.PaymentStatus.UNPAID:
        raise ValueError(
            "Cannot refund an order that was never paid. "
            "Cancel it instead."
        )

    refund_amount = order.total if amount is None else Decimal(str(amount))

    if refund_amount <= 0:
        raise ValueError("Refund amount must be greater than zero.")

    if refund_amount != order.total:
        raise ValueError(
            "Partial refunds are not supported. "
            f"The full amount is KES {order.total}."
        )

    order.payment_status = Order.PaymentStatus.REFUNDED
    order.save(update_fields=["payment_status", "updated_at"])

    actor_label = (
        f"Admin {actor.get_username()}" if actor else "Admin"
    )

    note = f"Refunded KES {refund_amount}"
    if reason:
        note = f"{note} · {reason.strip()[:280]}"

    record_status_event(
        order,
        from_status=order.status,
        to_status=order.status,
        actor=actor,
        actor_label=actor_label,
        note=note,
    )

    # Notify the customer. Best-effort — a failure here does not roll
    # back the refund.
    if order.user_id:
        try:
            from account.services import notify_order_refunded
            notify_order_refunded(
                order.user, order,
                amount=str(refund_amount),
                reason=reason,
            )
        except Exception:
            logger.exception(
                "Failed to notify customer for refund on order %s",
                order.reference,
            )

    return order


# ─────────────────────────────────────────────────────────────────────────────
# Internal notes
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def add_internal_note(order: Order, *, text: str, actor) -> Order:
    """
    Append a staff-only note to the order.

    Writes to `Order.internal_notes` — a separate field from
    `Order.notes`, which is the customer's checkout note. The two are
    distinct so this function never overwrites what the customer typed.

    Does NOT write a timeline event. The timeline is the customer-
    facing story; internal notes are admin-only and should not appear
    on it.

    Raises ValueError when `text` is empty.
    """
    text = (text or "").strip()
    if not text:
        raise ValueError("Note text cannot be empty.")

    prefix = (order.internal_notes or "").rstrip()
    suffix = f"[{actor.get_username()}] {text}" if actor else text
    order.internal_notes = f"{prefix}\n{suffix}" if prefix else suffix
    order.save(update_fields=["internal_notes", "updated_at"])

    return order


# ─────────────────────────────────────────────────────────────────────────────
# WhatsApp update
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def send_whatsapp_update(
    order: Order,
    *,
    message: str,
    actor,
) -> Order:
    """
    Log a WhatsApp update against the order.

    NOTE: This does not actually send a WhatsApp message — no provider
    is wired up yet. It records the intent on the timeline so the
    action is auditable, and returns success.

    When a WhatsApp Business provider is integrated, this is where the
    network call goes. The timeline event already captures what would
    have been sent, so the audit trail survives the provider swap.
    """
    message = (message or "").strip()
    if not message:
        raise ValueError("Message cannot be empty.")

    actor_label = (
        f"Admin {actor.get_username()}" if actor else "Admin"
    )

    record_status_event(
        order,
        from_status=order.status,
        to_status=order.status,
        actor=actor,
        actor_label=actor_label,
        note=f"WhatsApp sent: {message[:200]}",
    )

    return order