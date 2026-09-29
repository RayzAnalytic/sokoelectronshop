import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Payment
from .services import transition_payment

logger = logging.getLogger(__name__)


@shared_task(name="checkout.tasks.sweep_pending_payments")
def sweep_pending_payments():
    cutoff = timezone.now() - timedelta(
        seconds=settings.CHECKOUT_TIMEOUT_SECONDS
    )
    stale = Payment.objects.filter(
        status=Payment.Status.PROCESSING,
        updated_at__lt=cutoff,
    )
    count = 0
    for payment in stale:
        transition_payment(
            payment,
            Payment.Status.TIMEOUT,
            result_description="No response from M-Pesa.",
        )
        count += 1
    logger.info("Swept %d pending payment(s) to TIMEOUT.", count)
    return count