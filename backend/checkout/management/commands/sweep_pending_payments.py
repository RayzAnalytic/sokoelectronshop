from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from checkout.models import Payment
from checkout.services import transition_payment


class Command(BaseCommand):
    help = "Sweep PROCESSING payments older than the timeout to TIMEOUT."

    def handle(self, *args, **options):
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

        self.stdout.write(self.style.SUCCESS(f"Swept {count} payment(s)."))