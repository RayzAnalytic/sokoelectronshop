from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime

from dashboard.banners.models import Banner
from dashboard.banners.seeds import SEED_BANNERS


def seed():
    """Idempotent: creates or updates each seed row by its fixed id."""
    for row in SEED_BANNERS:
        data = dict(row)
        updated_at_raw = data.pop('updated_at', None)

        Banner.objects.update_or_create(id=data['id'], defaults=data)

        # auto_now=True on the model would clobber this, so patch after save.
        if updated_at_raw:
            ts = parse_datetime(updated_at_raw)
            if ts is not None:
                Banner.objects.filter(pk=data['id']).update(updated_at=ts)


class Command(BaseCommand):
    help = 'Seed the 6 banners from lib/bannerStore.ts (SEED_BANNERS).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fresh',
            action='store_true',
            help='Delete all existing banners before seeding.',
        )

    def handle(self, *args, **options):
        if options['fresh']:
            Banner.objects.all().delete()
            self.stdout.write('Cleared existing banners.')

        seed()
        self.stdout.write(
            self.style.SUCCESS(f'Seeded {Banner.objects.count()} banners.')
        )