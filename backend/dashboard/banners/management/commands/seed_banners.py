"""
Seed the storefront hero banners.

This file replaces `lib/bannerStore.ts` on the frontend. All hero
content now lives in the database — the storefront reads it via
`GET /api/v1/banners/hero/` and never ships a hardcoded array again.

Usage:
    python manage.py seed_banners              # idempotent upsert
    python manage.py seed_banners --fresh      # wipe first, then seed
    python manage.py seed_banners --dry-run    # report, don't write
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.dateparse import parse_datetime




SEED_BANNERS: list[dict] = [
    # ── 1. Smart Fridges — premium anchor banner ────────────────────────
    {
        "id": 1,
        "name": "Smart Fridges",
        "placement": "HOME_HERO",
        "order": 1,
        "badge": "Premium Appliances • Smart Living",
        "headline": "Fridges That Think Ahead.",
        "description": (
            "Energy-efficient smart fridges with inverter cooling, "
            "temperature alerts, and 5-year warranties. Built for Kenyan "
            "homes and Kenyan power."
        ),
        "desktop_image": "/hero-fridge.png",
        "tablet_image": "/hero-fridge-tablet.png",
        "mobile_image": "/hero-fridge-mobile.png",
        "primary_cta_text": "Shop Fridges",
        "primary_cta_href": "/pages/products?category=Home%20Appliances",
        "secondary_cta_text": "Compare Models",
        "secondary_cta_href": "/pages/products?category=Home%20Appliances",
        "text_alignment": "LEFT",
        "overlay_style": "GRADIENT",
        "overlay_opacity": 75,
        "status": "ACTIVE",
        "start_at": None,
        "end_at": None,
        "impressions": 14820,
        "clicks": 1103,
        "conversions": 118,
        "updated_at": "2026-10-01T09:00:00Z",
    },

    # ── 2. MacBook Pro — premium laptop banner ──────────────────────────
    {
        "id": 2,
        "name": "MacBook Pro M3",
        "placement": "HOME_HERO",
        "order": 2,
        "badge": "Pro Performance • M3 Max",
        "headline": "The MacBook Pro Everyone's Talking About.",
        "description": (
            "M3 Max chip, 36GB unified memory, 1TB SSD, and a display "
            "that changes how you work. Financing available in-store."
        ),
        "desktop_image": "/hero-macbook.png",
        "tablet_image": "/hero-macbook-tablet.png",
        "mobile_image": "/hero-macbook-mobile.png",
        "primary_cta_text": "Shop MacBooks",
        "primary_cta_href": "/pages/products?search=macbook",
        "secondary_cta_text": "View All Laptops",
        "secondary_cta_href": "/pages/products?category=Laptops",
        "text_alignment": "LEFT",
        "overlay_style": "GRADIENT",
        "overlay_opacity": 75,
        "status": "ACTIVE",
        "start_at": None,
        "end_at": None,
        "impressions": 18240,
        "clicks": 1476,
        "conversions": 152,
        "updated_at": "2026-10-02T10:30:00Z",
    },

    # ── 3. Samsung Galaxy S24 Ultra — flagship phone banner ─────────────
    {
        "id": 3,
        "name": "Galaxy S24 Ultra",
        "placement": "HOME_HERO",
        "order": 3,
        "badge": "New Flagship • Galaxy AI",
        "headline": "A Camera That Replaces Your DSLR.",
        "description": (
            "200MP main sensor, titanium frame, built-in S Pen, and "
            "Galaxy AI that translates calls in real time. In stock now."
        ),
        "desktop_image": "/hero-galaxy.png",
        "tablet_image": "/hero-galaxy-tablet.png",
        "mobile_image": "/hero-galaxy-mobile.png",
        "primary_cta_text": "Shop Galaxy S24",
        "primary_cta_href": "/pages/products?search=galaxy%20s24",
        "secondary_cta_text": "Compare Phones",
        "secondary_cta_href": "/pages/products?category=Smartphones",
        "text_alignment": "LEFT",
        "overlay_style": "GRADIENT",
        "overlay_opacity": 75,
        "status": "ACTIVE",
        "start_at": None,
        "end_at": None,
        "impressions": 16720,
        "clicks": 1284,
        "conversions": 141,
        "updated_at": "2026-10-03T11:15:00Z",
    },

    # ── 4. Sony WH-1000XM5 — premium audio banner ───────────────────────
    {
        "id": 4,
        "name": "Sony WH-1000XM5",
        "placement": "HOME_HERO",
        "order": 4,
        "badge": "Best In Class • Noise Cancelling",
        "headline": "Silence The World, Keep The Music.",
        "description": (
            "Industry-leading noise cancellation, 30-hour battery, and "
            "call quality so clear the other side forgets you're on a "
            "flight. The standard everyone else is measured against."
        ),
        "desktop_image": "/hero-sony.png",
        "tablet_image": "/hero-sony-tablet.png",
        "mobile_image": "/hero-sony-mobile.png",
        "primary_cta_text": "Shop Sony Audio",
        "primary_cta_href": "/pages/products?search=sony%20wh",
        "secondary_cta_text": "Browse Headphones",
        "secondary_cta_href": "/pages/products?category=Audio",
        "text_alignment": "LEFT",
        "overlay_style": "GRADIENT",
        "overlay_opacity": 75,
        "status": "ACTIVE",
        "start_at": None,
        "end_at": None,
        "impressions": 12240,
        "clicks": 892,
        "conversions": 98,
        "updated_at": "2026-10-04T14:45:00Z",
    },

    # ── 5. PS5 Gaming Setup — entertainment banner ──────────────────────
    {
        "id": 5,
        "name": "PlayStation 5 Setup",
        "placement": "HOME_HERO",
        "order": 5,
        "badge": "Entertainment • Next-Gen Gaming",
        "headline": "The Console Everyone's Waiting For.",
        "description": (
            "PlayStation 5 with DualSense controller, 4K 120Hz output, and "
            "a library that keeps growing. Bundles available in-store."
        ),
        "desktop_image": "/hero-ps5.png",
        "tablet_image": "/hero-ps5-tablet.png",
        "mobile_image": "/hero-ps5-mobile.png",
        "primary_cta_text": "Shop PS5",
        "primary_cta_href": "/pages/products?search=playstation",
        "secondary_cta_text": "View Accessories",
        "secondary_cta_href": "/pages/products?category=Gaming",
        "text_alignment": "LEFT",
        "overlay_style": "GRADIENT",
        "overlay_opacity": 75,
        "status": "ACTIVE",
        "start_at": None,
        "end_at": None,
        "impressions": 13960,
        "clicks": 1152,
        "conversions": 127,
        "updated_at": "2026-10-05T09:30:00Z",
    },

    # ── 6. Anker PowerHouse — backup power banner ───────────────────────
    {
        "id": 6,
        "name": "Anker PowerHouse 767",
        "placement": "HOME_HERO",
        "order": 6,
        "badge": "Backup Power • Off-Grid Ready",
        "headline": "Keep The Lights On When The Grid Doesn't.",
        "description": (
            "2048Wh LiFePO4 power station with 2400W output — runs a "
            "fridge, TV, and Wi-Fi router for over 12 hours. Silent, "
            "solar-ready, and maintenance-free."
        ),
        "desktop_image": "/hero-powerstation.png",
        "tablet_image": "/hero-powerstation-tablet.png",
        "mobile_image": "/hero-powerstation-mobile.png",
        "primary_cta_text": "Shop Power Stations",
        "primary_cta_href": "/pages/products?search=powerstation",
        "secondary_cta_text": "View Solar Panels",
        "secondary_cta_href": "/pages/products?category=Solar",
        "text_alignment": "LEFT",
        "overlay_style": "GRADIENT",
        "overlay_opacity": 75,
        "status": "ACTIVE",
        "start_at": None,
        "end_at": None,
        "impressions": 10240,
        "clicks": 786,
        "conversions": 84,
        "updated_at": "2026-10-06T08:00:00Z",
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# MANAGEMENT COMMAND
# ═══════════════════════════════════════════════════════════════════════════

class Command(BaseCommand):
    help = (
        "Seed the six hero banners that power the storefront homepage. "
        "Idempotent — re-running updates rows in place by their fixed id."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--fresh",
            action="store_true",
            help="Delete all existing banners before seeding.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing to the database.",
        )

    def handle(self, *args, **options):
        # Import here so the command can be introspected without
        # Django being fully set up (e.g. `--help` on a fresh clone).
        from dashboard.banners.models import Banner

        fresh = options["fresh"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no writes."))

        # ── --fresh: wipe first ───────────────────────────────────────
        if fresh and not dry_run:
            with transaction.atomic():
                deleted, _ = Banner.objects.all().delete()
            self.stdout.write(f"Cleared {deleted} existing banner row(s).")
        elif fresh and dry_run:
            self.stdout.write(
                f"Would clear {Banner.objects.count()} existing row(s)."
            )

        # ── Upsert each seed row ──────────────────────────────────────
        created = 0
        updated = 0
        skipped = 0

        for row in SEED_BANNERS:
            data = dict(row)
            raw_updated_at = data.pop("updated_at", None)

            if dry_run:
                exists = Banner.objects.filter(pk=data["id"]).exists()
                marker = "UPDATE" if exists else "CREATE"
                self.stdout.write(
                    f"  [{marker}] id={data['id']:<3} {data['name']}"
                )
                skipped += 1
                continue

            with transaction.atomic():
                obj, was_created = Banner.objects.update_or_create(
                    id=data["id"],
                    defaults=data,
                )

                # `auto_now=True` on `updated_at` overrides whatever we
                # pass in `defaults`, so we patch it afterwards in a
                # separate UPDATE that bypasses auto_now.
                if raw_updated_at:
                    ts = parse_datetime(raw_updated_at)
                    if ts is not None:
                        Banner.objects.filter(pk=obj.pk).update(updated_at=ts)

            if was_created:
                created += 1
            else:
                updated += 1

        # ── Report ────────────────────────────────────────────────────
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run complete. {skipped} row(s) would be processed."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Banners seeded — "
                f"{created} created, {updated} updated, "
                f"{Banner.objects.count()} total."
            )
        )