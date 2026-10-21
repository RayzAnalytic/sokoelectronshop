import logging

from django.db import transaction

from checkout.models import Order, Payment
from checkout.services import change_order_status, record_status_event

from .constants import is_transition_allowed

logger = logging.getLogger(__name__)


@transaction.atomic
def set_status(
    order: Order,
    new_status: str,
    *,
    actor,
    note: str = "",
) -> Order:
    if order.status == new_status:
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


@transaction.atomic
def set_tracking(
    order: Order,
    *,
    courier: str = "",
    tracking_number: str = "",
    actor,
) -> Order:
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


@transaction.atomic
def refund_order(
    order: Order,
    *,
    actor,
    amount=None,
    reason: str = "",
) -> Order:
    from decimal import Decimal

    if order.payment_status == Order.PaymentStatus.REFUNDED:
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


@transaction.atomic
def add_internal_note(order: Order, *, text: str, actor) -> Order:
    text = (text or "").strip()
    if not text:
        raise ValueError("Note text cannot be empty.")

    prefix = (order.internal_notes or "").rstrip()
    suffix = f"[{actor.get_username()}] {text}" if actor else text
    order.internal_notes = f"{prefix}\n{suffix}" if prefix else suffix
    order.save(update_fields=["internal_notes", "updated_at"])

    return order


@transaction.atomic
def send_whatsapp_update(
    order: Order,
    *,
    message: str,
    actor,
) -> Order:
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


def find_order_by_qr_token(token: str) -> Order | None:
    token = (token or "").strip()
    if not token:
        return None

    qs = (
        Order.objects
        .select_related("user")
        .prefetch_related("items", "payments")
    )

    order = qs.filter(verify_token=token).first()
    if order is not None:
        return order

    return qs.filter(reference=token).first()


@transaction.atomic
def mark_fulfilled(order: Order, *, actor) -> Order:
    if order.status == Order.Status.DELIVERED:
        return order

    if order.status in {
        Order.Status.CANCELLED,
        Order.Status.RETURNED,
        Order.Status.FAILED,
    }:
        raise ValueError(
            f"Cannot fulfil an order that is already "
            f"{order.get_status_display().lower()}."
        )

    actor_label = (
        f"Admin {actor.get_username()}" if actor else "Admin"
    )

    return change_order_status(
        order,
        Order.Status.DELIVERED,
        actor=actor,
        actor_label=actor_label,
        note="Fulfilled via QR scan.",
    )