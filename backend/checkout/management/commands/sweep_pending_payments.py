"""
Sweep PROCESSING payments that Daraja never called back for.

Runs every 30 s via Celery beat (`checkout.tasks.sweep_pending_payments`).
Idempotent and safe to run concurrently — each payment is locked for
the duration of its transition.

Behaviour:
    1. Find PROCESSING payments older than `CHECKOUT_TIMEOUT_SECONDS`.
    2. For each, query Daraja for the terminal state:
         SUCCESS  → transition_payment(SUCCESS)
         FAILED   → transition_payment(FAILED)
         PENDING  → leave as-is; the next sweep will retry
         Network error → leave as-is; the next sweep will retry
    3. If `--no-reconcile` is passed, skip step 2 and go straight to
       TIMEOUT. Use only when Daraja is known to be unreachable and you
       accept the risk of sweeping a completed payment.

Usage:
    python manage.py sweep_pending_payments
    python manage.py sweep_pending_payments --dry-run
    python manage.py sweep_pending_payments --max 50
    python manage.py sweep_pending_payments --no-reconcile
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from checkout import mpesa
from checkout.exceptions import MpesaError
from checkout.models import Payment
from checkout.services import transition_payment

logger = logging.getLogger(__name__)


# Result codes Daraja returns for a terminal-failed STK push.
# Everything else is treated as "still pending — retry next sweep".
_FAILED_RESULT_CODES = {
    1,      # Insufficient funds
    17,     # Rule limited (e.g. daily limit)
    26,     # M-Pesa system busy
    1001,   # Unable to lock subscriber
    1019,   # Transaction expired
    1025,   # System error
    1032,   # Cancelled by user
    1037,   # Timeout — user unreachable
    2001,   # Wrong PIN
    2040,   # Unsupported initiator
}


class Command(BaseCommand):
    help = "Sweep PROCESSING payments older than the timeout to TIMEOUT."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be swept without making changes.",
        )
        parser.add_argument(
            "--max",
            type=int,
            default=500,
            help="Maximum payments to process in one run (default: 500).",
        )
        parser.add_argument(
            "--no-reconcile",
            action="store_true",
            help=(
                "Skip querying Daraja. Sweeps every stale payment straight "
                "to TIMEOUT. Faster, but may mark a completed payment as "
                "timed out if the callback never arrived."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        max_batch = options["max"]
        reconcile = not options["no_reconcile"]

        cutoff = timezone.now() - timedelta(
            seconds=settings.CHECKOUT_TIMEOUT_SECONDS
        )

        stale = (
            Payment.objects.select_related("order")
            .filter(
                status=Payment.Status.PROCESSING,
                updated_at__lt=cutoff,
                checkout_request_id__gt="",   # skip rows that never reached Daraja
            )
            .order_by("updated_at")[:max_batch]
        )

        counters = {
            "scanned": 0,
            "success": 0,
            "failed": 0,
            "timeout": 0,
            "still_pending": 0,
            "unreachable": 0,
            "skipped": 0,
        }

        for payment in stale:
            counters["scanned"] += 1
            outcome = self._process_one(payment, dry_run=dry_run, reconcile=reconcile)
            counters[outcome] = counters.get(outcome, 0) + 1

        # ── Summary ────────────────────────────────────────────────────
        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Swept {counters['timeout']} to TIMEOUT, "
                f"{counters['success']} to SUCCESS, "
                f"{counters['failed']} to FAILED "
                f"({counters['still_pending']} still pending, "
                f"{counters['unreachable']} unreachable, "
                f"{counters['skipped']} skipped, "
                f"{counters['scanned']} scanned)"
            )
        )

    # ─────────────────────────────────────────────────────────────────────
    def _process_one(self, payment: Payment, *, dry_run: bool, reconcile: bool) -> str:
        """
        Handle a single payment. Returns a counter key describing the
        outcome. Never raises — every failure is logged and the loop
        continues so one bad row can't block the batch.
        """
        try:
            # Reconcile with Daraja unless explicitly disabled.
            if reconcile:
                try:
                    raw = mpesa.query_status(payment.checkout_request_id)
                except MpesaError as exc:
                    logger.warning(
                        "Sweep: Daraja unreachable for payment %s (order %s): %s",
                        payment.pk, payment.order.reference, exc,
                    )
                    return "unreachable"

                parsed = mpesa.parse_query_result(raw)
                result_code = parsed["result_code"]
                description = parsed["result_description"] or ""

                # ResultCode 0 → SUCCESS
                if result_code == 0:
                    return self._transition(
                        payment,
                        Payment.Status.SUCCESS,
                        result_code=result_code,
                        result_description=description or "Reconciled as SUCCESS.",
                        dry_run=dry_run,
                    )

                # Known terminal failure → FAILED
                if result_code in _FAILED_RESULT_CODES:
                    return self._transition(
                        payment,
                        Payment.Status.FAILED,
                        result_code=result_code,
                        result_description=description or "Reconciled as FAILED.",
                        dry_run=dry_run,
                    )

                # Daraja reports the request is still in-flight. Leave it
                # alone — the next sweep will re-check.
                logger.info(
                    "Sweep: payment %s still pending on Daraja (code %s)",
                    payment.pk, result_code,
                )
                return "still_pending"

            # --no-reconcile path: sweep straight to TIMEOUT.
            return self._transition(
                payment,
                Payment.Status.TIMEOUT,
                result_description="No callback received within timeout window.",
                dry_run=dry_run,
            )

        except Exception:
            # A surprise (attribute error, DB error) — log and move on.
            logger.exception(
                "Sweep: unexpected failure processing payment %s", payment.pk,
            )
            return "skipped"

    # ─────────────────────────────────────────────────────────────────────
    def _transition(
        self,
        payment: Payment,
        new_status: str,
        *,
        result_code: int | None = None,
        result_description: str | None = None,
        dry_run: bool,
    ) -> str:
        """
        Lock the payment row, re-read its status, and apply the transition.

        The re-read matters: a Safaricom callback may have flipped the
        payment to a terminal state between the outer query and now.
        """
        if dry_run:
            self.stdout.write(
                f"  would transition {payment.pk} "
                f"({payment.order.reference}) "
                f"PROCESSING → {new_status}"
            )
            return {
                Payment.Status.SUCCESS: "success",
                Payment.Status.FAILED: "failed",
                Payment.Status.TIMEOUT: "timeout",
            }[new_status]

        with transaction.atomic():
            locked = (
                Payment.objects.select_for_update()
                .select_related("order")
                .get(pk=payment.pk)
            )

            # A callback arrived between the outer query and the lock.
            if locked.status in Payment.TERMINAL_STATUSES:
                logger.info(
                    "Sweep: payment %s already terminal (%s), skipping",
                    locked.pk, locked.status,
                )
                return "skipped"

            transition_payment(
                locked,
                new_status,
                result_code=result_code,
                result_description=result_description,
            )

        logger.info(
            "Sweep: payment %s (order %s) → %s",
            payment.pk, payment.order.reference, new_status,
        )
        return {
            Payment.Status.SUCCESS: "success",
            Payment.Status.FAILED: "failed",
            Payment.Status.TIMEOUT: "timeout",
        }[new_status]