from django.core.management.base import BaseCommand
from dashboard.direct_orders.models import DirectOrder, Creator
from django.core.management import call_command

class Command(BaseCommand):
    help = 'Seed only if empty (safe for Render start command)'
    def handle(self, *args, **options):
        if Creator.objects.exists() and DirectOrder.objects.exists():
            self.stdout.write("Data exists, skipping seed")
            return
        self.stdout.write("Empty DB detected, seeding...")
        call_command('seed_direct_orders')
