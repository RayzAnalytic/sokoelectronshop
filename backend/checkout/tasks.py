"""
checkout/tasks.py

Background sweeps for the checkout app.

    sweep_pending_payments     — flip stale PROCESSING payments to TIMEOUT
    sweep_stale_callback_logs  — prune M-Pesa callback logs after N days
    sweep_abandoned_carts      — fire `cart.abandoned` for idle carts
    sweep_unpaid_orders        — fire `order.unpaid.24h` for stale orders

Why this exists alongside the lazy timeout in `PaymentDetailView`:

    The view only times a payment out when someone polls it. If a
    customer closes the browser right after the STK push and never
    reopens the success page, the Payment stays PROCESSING forever.
    The Celery sweep is the safety net for that case.

    Both paths call `transition_payment(..., TIMEOUT)`, which is
    idempotent — the second caller sees an already-terminal status and
    no-ops. No coordination between them is needed.

INVENTORY INTEGRATION:
    This task does NOT call inventory services directly. When a payment
    times out, `transition_payment(TIMEOUT)` in `checkout/services.py`
    is responsible for releasing any stock reservation the order was
    holding. That keeps one integration point for all three timeout
    paths (this sweep, the lazy poll-timeout in PaymentDetailView, and
    the customer-initiated cancel). Do not add inventory calls here —
    they belong in `transition_payment`.

AI AUTOMATIONS INTEGRATION:
    Two of the sweeps fire automations events through the helper in
    `checkout.services._fire_event`, which is best-effort and never
    raises. An automation failure must not stop the sweep.

        sweep_abandoned_carts  → cart.abandoned
        sweep_unpaid_orders    → order.unpaid.24h

    Both sweeps deduplicate with a marker column on the model so the
    same cart/order is never announced twice:

        Cart.abandoned_at                (nullable DateTimeField)
        Order.payment_reminder_sent_at   (nullable DateTimeField)

    Both fields ship in a small migration — see the note at the bottom
    of this file. The tasks wrap the marker write in a nested
    try/except so a missing column logs and moves on rather than
    crashing the sweep.

Schedule (add to your Celery beat config):

    CELERY_BEAT_SCHEDULE = {
        "sweep-pending-payments": {
            "task": "checkout.tasks.sweep_pending_payments",
            "schedule": 60.0,                        # every minute
        },
        "sweep-abandoned-carts": {
            "task": "checkout.tasks.sweep_abandoned_carts",
            "schedule": crontab(minute=0),           # hourly, top of hour
        },
        "sweep-unpaid-orders": {
            "task": "checkout.tasks.sweep_unpaid_orders",
            "schedule": crontab(minute=15),          # hourly, :15 past
        },
        "sweep-stale-callback-logs": {
            "task": "checkout.tasks.sweep_stale_callback_logs",
            "schedule": crontab(hour=3, minute=0),   # nightly at 03:00
        },
    }
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db.models import Max, Q
from django.utils import timezone

from .models import Cart, MpesaCallbackLog, Order, Payment
from .services import _fire_event, transition_payment

logger = logging.getLogger(__name__)

# How long to keep raw callback bodies around. Long enough to debug a
# misbehaving Safaricom payload a week later; short enough that the
# table doesn't grow without bound.
CALLBACK_LOG_RETENTION_DAYS = 30

# Per-sweep batch cap. Prevents a backlog (e.g. after a worker outage)
# from turning a single task run into a multi-minute operation that
# holds the beat slot open. The next tick picks up where this one left
# off.
SWEEP_BATCH_SIZE = 500

# How long a cart can sit idle before it counts as abandoned. One hour
# matches the pre-built "Abandoned Cart Recovery" template's trigger
# description on the AI & Automations page.
ABANDONED_CART_AGE_HOURS = 1

# How long an order can stay unpaid before we nudge the customer.
# Matches the "Payment Reminder" pre-built template.
UNPAID_ORDER_REMINDER_HOURS = 24


# ═════════════════════════════════════════════════════════════════════════════
# Payments
# ═════════════════════════════════════════════════════════════════════════════
@shared_task(name="checkout.tasks.sweep_pending_payments")
def sweep_pending_payments():
    """
    Move PROCESSING payments older than `CHECKOUT_TIMEOUT_SECONDS` to
    TIMEOUT.

    A payment is PROCESSING only between the moment the STK push lands
    at Safaricom and the moment the callback arrives. If the callback
    never comes — network drop on Safaricom's side, misconfigured
    webhook URL, customer force-quit the app — the payment sits here
    forever. This task is what stops that.

    Per-payment error isolation:
        Each transition runs in its own try/except. A single poisoned
        row (unexpected DB error, notification failure that slipped
        past the inner guards) logs and moves on, so one bad payment
        cannot block the batch and strand every other PROCESSING row
        until the next tick.

    Returns the number of payments transitioned, for logging/alerting.
    """
    cutoff = timezone.now() - timedelta(
        seconds=settings.CHECKOUT_TIMEOUT_SECONDS
    )

    # Fetch a bounded batch. `.select_related("order", "order__user")`
    # because `transition_payment` touches `payment.order` to update
    # the order's payment_status AND `change_order_status` may fire a
    # customer notification that reads `order.user`. Without the
    # select_related, each iteration fires two extra queries; on a
    # 500-payment backlog that's 1000 avoidable round-trips.
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

    # Warn if we hit the batch cap — the next tick will pick up the
    # rest, but the operator should know there is a backlog forming.
    if len(stale_ids) == SWEEP_BATCH_SIZE:
        # Only mention it if we actually filled the cap. A partial
        # batch means the queue drained naturally and there is nothing
        # to warn about.
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
        # `transition_payment` re-checks the current status inside its
        # own transaction. If the callback arrived between our SELECT
        # and this loop, the status is no longer PROCESSING and the
        # transition no-ops.
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


# ═════════════════════════════════════════════════════════════════════════════
# Abandoned carts                                                            NEW
# ═════════════════════════════════════════════════════════════════════════════
@shared_task(name="checkout.tasks.sweep_abandoned_carts")
def sweep_abandoned_carts():
    """
    Fire `cart.abandoned` for carts that have been idle longer than
    `ABANDONED_CART_AGE_HOURS`.

    What "abandoned" means here:
        The cart has at least one item, its most recent item was
        created more than an hour ago, and the customer has not placed
        an order since then. A cart that just got emptied or that led
        to a checkout is not abandoned — it is done.

    Deduplication:
        `Cart.abandoned_at` is the marker. The sweep only looks at
        carts where it is NULL, and stamps it in the same pass that
        fires the event. A cart updated *after* being marked abandoned
        is not re-considered — the customer came back, so the moment
        has passed.

        That is a deliberate simplification: the "Abandoned Cart
        Recovery" automation should not spam a customer who genuinely
        returned to the shop and just did not check out yet. One
        nudge is the point; two is harassment.

    Why we check for a recent order:
        A customer who added to cart, checked out 90 seconds later,
        and left the cart intact would otherwise look "abandoned" an
        hour later — but they bought. The `recent_order` check filters
        those out. The mark-then-skip pattern (stamp `abandoned_at`
        but do not fire) prevents the sweep from re-checking the same
        non-candidate cart forever.

    Returns the number of events fired, for logging/alerting.
    """
    cutoff = timezone.now() - timedelta(hours=ABANDONED_CART_AGE_HOURS)

    # Annotate the cart with the timestamp of its newest item. The
    # `Cart.updated_at` column does not move when an item is added —
    # `add_cart_item` writes to the `CartItem` rows, not the parent —
    # so the parent's timestamp is misleading here.
    stale_carts = (
        Cart.objects
        .annotate(latest_item_at=Max("items__created_at"))
        .filter(
            latest_item_at__lt=cutoff,
            abandoned_at__isnull=True,       # not already handled
        )
        .select_related("user")
        .order_by("latest_item_at")[:SWEEP_BATCH_SIZE]
    )

    fired = 0
    skipped = 0
    errors = 0

    for cart in stale_carts:
        try:
            # Skip guest-less carts — every Cart row is tied to a
            # User (see services.get_or_create_cart), so this is
            # defensive rather than expected.
            if not cart.user_id:
                continue

            # Did the customer place an order after building this
            # cart? If yes, they converted — mark the cart so we do
            # not re-check it, but stay silent.
            converted = Order.objects.filter(
                user_id=cart.user_id,
                created_at__gt=cart.latest_item_at,
            ).exists()

            # Stamp the marker BEFORE firing. If the automation
            # dispatch somehow hangs, the next sweep will not pick
            # the same cart up while this one is still in flight.
            #
            # Wrapped defensively in case the migration has not been
            # applied yet — a missing column logs and skips the
            # marker write, and the sweep still fires the event
            # (accepting the risk of a duplicate on the next tick).
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

            # Fire the automation. `_fire_event` is best-effort and
            # never raises, but wrap anyway so a broken dispatcher
            # does not abort the batch.
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


# ═════════════════════════════════════════════════════════════════════════════
# Unpaid orders                                                              NEW
# ═════════════════════════════════════════════════════════════════════════════
@shared_task(name="checkout.tasks.sweep_unpaid_orders")
def sweep_unpaid_orders():
    """
    Fire `order.unpaid.24h` for orders that have been unpaid longer
    than `UNPAID_ORDER_REMINDER_HOURS`.

    Which orders qualify:
        - `payment_status != PAID` — no money received
        - `created_at` older than the reminder window
        - status is not terminal — CANCELLED, RETURNED, and DELIVERED
          are excluded (a delivered-but-unpaid order is a different
          problem, handled by the ledger's reconcile flow, not by a
          customer reminder)
        - `payment_reminder_sent_at IS NULL` — we have not already
          nudged them

    Deduplication:
        `Order.payment_reminder_sent_at` is the marker. It is stamped
        in the same pass that fires the event, so the same order is
        never reminded twice — even if the automation itself fails
        and writes no `AutomationRun`. That is deliberate: a customer
        who ignores one WhatsApp reminder should not receive a second
        one the next hour just because the first delivery glitched.

    Which orders this does NOT cover:
        Orders that were M-Pesa PENDING and whose Payment was later
        timed out by `sweep_pending_payments`. Those still show as
        unpaid but the customer already saw a failed STK push — a
        second "you have an unpaid order" message would be confusing.

        To exclude them, we skip orders whose related Payment rows are
        all terminal-failed. If the customer genuinely wants to retry,
        the automation for `order.paid` (not this one) is the correct
        hook.

    Returns the number of events fired, for logging/alerting.
    """
    cutoff = timezone.now() - timedelta(hours=UNPAID_ORDER_REMINDER_HOURS)

    # Terminal statuses to skip. `DELIVERED` is excluded because a
    # delivered-but-unpaid order is a collections problem, not a
    # customer-nudge problem — the reconcile flow handles it.
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
            payment_reminder_sent_at__isnull=True,     # not yet nudged
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
            # Skip orders where every Payment row is a terminal
            # failure. The customer already saw the STK push fail;
            # another unpaid-order nudge would be noise.
            has_recoverable_payment = (
                order.payments
                .exclude(status__in=[
                    Payment.Status.FAILED,
                    Payment.Status.TIMEOUT,
                    Payment.Status.CANCELLED,
                ])
                .exists()
            )
            # COD orders have no failed Payment to worry about — the
            # `has_recoverable_payment` check is only relevant to
            # M-Pesa. A COD order in CONFIRMED status is exactly the
            # case we want to nudge.
            is_cod = order.payment_method == Order.PaymentMethod.COD

            if not is_cod and not has_recoverable_payment:
                # M-Pesa order whose every attempt failed. Stamp the
                # marker so we stop rechecking it, but stay silent.
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

            # Stamp the marker BEFORE firing — same reasoning as the
            # cart sweep.
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


# ═════════════════════════════════════════════════════════════════════════════
# Callback log pruning
# ═════════════════════════════════════════════════════════════════════════════
@shared_task(name="checkout.tasks.sweep_stale_callback_logs")
def sweep_stale_callback_logs():
    """
    Delete MpesaCallbackLog rows older than the retention window.

    The callback endpoint writes every inbound body unconditionally —
    including malformed ones — so the table grows with every M-Pesa
    callback and every retry. Without pruning, this is the table that
    eventually fills the disk.

    `.delete()` returns `(total_deleted, {model_label: per_model_count})`.
    A single `.delete()` on a filtered queryset does NOT pull rows into
    Python — Django issues a single SQL DELETE — so even a large
    backlog prunes in one round-trip. The bound is only the DB's own
    row-lock behaviour on the affected range, which is fine for a
    nightly run.

    Returns the number of rows deleted.
    """
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