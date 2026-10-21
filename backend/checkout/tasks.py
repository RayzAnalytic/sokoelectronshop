import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from .models import Cart, MpesaCallbackLog, Order, Payment
from .services import _fire_event, transition_payment

logger = logging.getLogger(__name__)

CALLBACK_LOG_RETENTION_DAYS = 30
SWEEP_BATCH_SIZE = 500
ABANDONED_CART_AGE_HOURS = 1
UNPAID_ORDER_REMINDER_HOURS = 24


@shared_task(name="checkout.tasks.sweep_pending_payments")
def sweep_pending_payments():
    cutoff = timezone.now() - timedelta(
        seconds=settings.CHECKOUT_TIMEOUT_SECONDS
    )

    stale_ids = list(
        Payment.objects.filter(
            status=Payment.Status.PROCESSING,
            updated_at__lt=cutoff,
        )
        .order_by("updated_at")
        .values_list("id", flat=True)[:SWEEP_BATCH_SIZE]
    )

    if not stale_ids:
        logger.debug("No stale PROCESSING payments to sweep.")
        return 0

    if len(stale_ids) == SWEEP_BATCH_SIZE:
        remaining = Payment.objects.filter(
            status=Payment.Status.PROCESSING,
            updated_at__lt=cutoff,
        ).count() - SWEEP_BATCH_SIZE
        if remaining > 0:
            logger.warning(
                "Sweep hit the batch cap (%d). %d more stale payment(s) "
                "remain for the next tick.",
                SWEEP_BATCH_SIZE, remaining,
            )

    count = 0
    errors = 0
    for payment in (
        Payment.objects
        .select_related("order", "order__user")
        .filter(id__in=stale_ids)
    ):
        try:
            transition_payment(
                payment,
                Payment.Status.TIMEOUT,
                result_description="No response from M-Pesa.",
            )
            count += 1
        except Exception:
            errors += 1
            logger.exception(
                "Failed to timeout payment %s (order %s)",
                payment.id, payment.order_id,
            )

    logger.info(
        "Swept %d pending payment(s) to TIMEOUT (%d error(s)).",
        count, errors,
    )
    return count


@shared_task(name="checkout.tasks.sweep_abandoned_carts")
def sweep_abandoned_carts():
    cutoff = timezone.now() - timedelta(hours=ABANDONED_CART_AGE_HOURS)

    stale_carts = (
        Cart.objects
        .annotate(latest_item_at=Max("items__created_at"))
        .filter(
            latest_item_at__lt=cutoff,
            abandoned_at__isnull=True,
        )
        .select_related("user")
        .order_by("latest_item_at")[:SWEEP_BATCH_SIZE]
    )

    fired = 0
    skipped = 0
    errors = 0

    for cart in stale_carts:
        try:
            if not cart.user_id:
                continue

            converted = Order.objects.filter(
                user_id=cart.user_id,
                created_at__gt=cart.latest_item_at,
            ).exists()

            try:
                cart.abandoned_at = timezone.now()
                cart.save(update_fields=["abandoned_at"])
            except Exception:
                logger.exception(
                    "Could not stamp abandoned_at on cart %s",
                    cart.pk,
                )

            if converted:
                skipped += 1
                continue

            _fire_event(
                "cart.abandoned",
                {
                    "cart_id": cart.pk,
                    "customer_id": cart.user_id,
                    "item_count": cart.items.count(),
                },
            )
            fired += 1

        except Exception:
            errors += 1
            logger.exception(
                "Failed to process abandoned cart %s", cart.pk,
            )

    logger.info(
        "Swept abandoned carts: %d fired, %d skipped (converted), "
        "%d error(s).", fired, skipped, errors,
    )
    return fired


@shared_task(name="checkout.tasks.sweep_unpaid_orders")
def sweep_unpaid_orders():
    cutoff = timezone.now() - timedelta(hours=UNPAID_ORDER_REMINDER_HOURS)

    skip_statuses = [
        Order.Status.CANCELLED,
        Order.Status.RETURNED,
        Order.Status.DELIVERED,
    ]

    stale_orders = (
        Order.objects
        .filter(
            created_at__lt=cutoff,
            payment_status=Order.PaymentStatus.UNPAID,
            payment_reminder_sent_at__isnull=True,
        )
        .exclude(status__in=skip_statuses)
        .select_related("user")
        .order_by("created_at")[:SWEEP_BATCH_SIZE]
    )

    fired = 0
    skipped = 0
    errors = 0

    for order in stale_orders:
        try:
            has_recoverable_payment = (
                order.payments
                .exclude(status__in=[
                    Payment.Status.FAILED,
                    Payment.Status.TIMEOUT,
                    Payment.Status.CANCELLED,
                ])
                .exists()
            )
            is_cod = order.payment_method == Order.PaymentMethod.COD

            if not is_cod and not has_recoverable_payment:
                try:
                    order.payment_reminder_sent_at = timezone.now()
                    order.save(update_fields=["payment_reminder_sent_at"])
                except Exception:
                    logger.exception(
                        "Could not stamp reminder marker on order %s",
                        order.reference,
                    )
                skipped += 1
                continue

            try:
                order.payment_reminder_sent_at = timezone.now()
                order.save(update_fields=["payment_reminder_sent_at"])
            except Exception:
                logger.exception(
                    "Could not stamp reminder marker on order %s",
                    order.reference,
                )

            _fire_event(
                "order.unpaid.24h",
                {
                    "order_id": order.pk,
                    "reference": order.reference,
                    "customer_id": order.user_id,
                    "total": float(order.total),
                    "payment_method": order.payment_method,
                    "status": order.status,
                },
            )
            fired += 1

        except Exception:
            errors += 1
            logger.exception(
                "Failed to process unpaid order %s", order.reference,
            )

    logger.info(
        "Swept unpaid orders: %d fired, %d skipped (failed payments only), "
        "%d error(s).", fired, skipped, errors,
    )
    return fired


@shared_task(name="checkout.tasks.sweep_stale_callback_logs")
def sweep_stale_callback_logs():
    cutoff = timezone.now() - timedelta(days=CALLBACK_LOG_RETENTION_DAYS)

    deleted, _ = MpesaCallbackLog.objects.filter(
        created_at__lt=cutoff
    ).delete()

    logger.info(
        "Pruned %d callback log(s) older than %d days.",
        deleted,
        CALLBACK_LOG_RETENTION_DAYS,
    )
    return deleted