# dashboard/shipping/management/commands/seed_shipping.py

"""
Seed the shipping tables with the shop's real starting data.

    python manage.py seed_shipping

Idempotent: existing rows are matched by name/slug and left alone.
Re-running on a populated DB is a no-op for those rows. The seed
mirrors the frontend's previous mock data so the page is not empty
after the first migration.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from dashboard.shipping.models import (
    CourierConfig,
    PickupLocation,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
)


METHODS = [
    ("Standard Delivery", 300, "2-3 days", "Standard regional courier delivery to door"),
    ("Express Boda", 500, "Same day", "Fast motorcycle dispatch within metropolitan areas"),
    ("Pickup Mtaani / Locker", 200, "1-2 days", "Secure neighborhood pickup agents & lockers"),
    ("Freight / Bulk Cargo", 1500, "3-5 days", "Heavy machinery & large order pallet shipping"),
    ("Nationwide Bus / Parcel", 400, "2-4 days", "Affordable bus parcel services to major towns"),
]


ZONES = [
    (
        "Nairobi Metropolitan", "Nairobi",
        ["Nairobi", "Kiambu", "Kajiado", "Machakos"],
        [
            ("Standard Delivery", 250, "1-2 business days", 3000),
            ("Express Boda", 450, "Same day (2-4 hrs)", 6000),
            ("Pickup Mtaani / Locker", 0, "Ready in 1 hr", None),
        ],
    ),
    (
        "Coastal Region", "Coast",
        ["Mombasa", "Kilifi", "Kwale", "Lamu"],
        [
            ("Standard Delivery", 550, "2-3 business days", 8000),
            ("Express Boda", 950, "Next day delivery", None),
        ],
    ),
    (
        "Rift Valley Region", "Rift Valley",
        ["Nakuru", "Uasin Gishu", "Nandi", "Kericho"],
        [("Nationwide Bus / Parcel", 400, "2-4 business days", 7000)],
    ),
    (
        "Western Region", "Western",
        ["Kakamega", "Bungoma", "Busia", "Vihiga"],
        [("Nationwide Bus / Parcel", 450, "2-4 business days", 7000)],
    ),
    (
        "Nyanza Region", "Nyanza",
        ["Kisumu", "Kisii", "Homa Bay", "Migori"],
        [("Nationwide Bus / Parcel", 450, "2-4 business days", 7000)],
    ),
    (
        "Central Kenya Region", "Central Kenya",
        ["Nyeri", "Murang'a", "Kirinyaga", "Nyandarua"],
        [("Standard Delivery", 350, "2-3 business days", 5000)],
    ),
    (
        "North Eastern Region", "North Eastern",
        ["Garissa", "Wajir", "Mandera"],
        [("Nationwide Bus / Parcel", 700, "3-5 business days", 10000)],
    ),
]


PICKUPS = [
    ("Pickup Mtaani - Westlands", "Agent", "Westlands Square, Shop G12", "Nairobi", "+254 712 000 111", "Mon-Sat 8am-8pm"),
    ("Pickup Mtaani - Thika Road", "Agent", "TRM Mall, Ground Floor", "Nairobi", "+254 712 000 222", "Mon-Sun 9am-9pm"),
    ("SokoFlow Locker - CBD", "Locker", "Kimathi Street, Bihi Towers", "Nairobi", "+254 712 000 333", "24/7"),
    ("Pickup Mtaani - Mombasa", "Agent", "Nyali Centre, Shop 22", "Mombasa", "+254 712 000 444", "Mon-Sat 9am-7pm"),
    ("SokoFlow Store - Kisumu", "Store", "Mega Plaza, 2nd Floor", "Kisumu", "+254 712 000 555", "Mon-Sat 9am-6pm"),
    ("Pickup Mtaani - Nakuru", "Agent", "Westside Mall, Shop 14", "Nakuru", "+254 712 000 666", "Mon-Sat 9am-7pm"),
]


COURIERS = [
    ("sendy", "Sendy Fulfillment", "bg-amber-500",
     "Automated dispatch, motorcycle & truck fulfillment across Kenya.",
     "snd_live_99812736481029384", True,
     ["Nairobi", "Central Kenya", "Coast", "Rift Valley", "Nyanza"]),
    ("glovo", "Glovo Express", "bg-yellow-400",
     "Instant on-demand multi-category delivery for quick commerce.",
     "glv_live_88372649102938475", True,
     ["Nairobi", "Coast", "Nyanza"]),
    ("pickupmtaani", "Pickup Mtaani", "bg-emerald-600",
     "Affordable peer-to-peer neighborhood pickup stations.",
     "pum_test_11223344556677889", True,
     ["Nairobi", "Central Kenya", "Coast", "Rift Valley", "Nyanza", "Western"]),
    ("g4s", "G4S Courier", "bg-blue-700",
     "Secure nationwide courier and cash-in-transit logistics.",
     "g4s_live_55667788990011223", True,
     ["Nairobi", "Coast", "Rift Valley", "Western", "Nyanza",
      "North Eastern", "Central Kenya"]),
    ("easycoach", "Easy Coach Parcel", "bg-red-600",
     "Affordable nationwide bus parcel delivery to major towns.",
     "ec_live_99887766554433221", False,
     ["Western", "Nyanza", "Rift Valley", "Coast", "Central Kenya"]),
]


class Command(BaseCommand):
    help = "Seed shipping methods, zones, rates, pickups, and couriers."

    def handle(self, *args, **options):
        self._seed_methods()
        self._seed_zones()
        self._seed_pickups()
        self._seed_couriers()
        self.stdout.write(self.style.SUCCESS("Shipping seed complete."))

    def _seed_methods(self):
        created = 0
        for name, price, eta, desc in METHODS:
            _, was_created = ShippingMethod.objects.get_or_create(
                name=name,
                defaults={
                    "default_price": Decimal(str(price)),
                    "eta": eta,
                    "description": desc,
                    "status": ShippingMethod.Status.ACTIVE,
                },
            )
            created += was_created
        self.stdout.write(f"  Methods: {created} created")

    def _seed_zones(self):
        methods_by_name = {m.name: m for m in ShippingMethod.objects.all()}
        created_zones = 0
        created_rates = 0

        for name, region, counties, rates in ZONES:
            zone, was_created = ShippingZone.objects.get_or_create(
                name=name,
                defaults={"region": region, "counties": counties},
            )
            created_zones += was_created

            for method_name, price, eta, threshold in rates:
                method = methods_by_name.get(method_name)
                if method is None:
                    continue
                _, rate_created = ShippingRate.objects.get_or_create(
                    zone=zone, method=method,
                    defaults={
                        "price": Decimal(str(price)),
                        "eta": eta,
                        "free_shipping_threshold": (
                            Decimal(str(threshold)) if threshold is not None else None
                        ),
                    },
                )
                created_rates += rate_created

        self.stdout.write(f"  Zones: {created_zones} created, {created_rates} rates created")

    def _seed_pickups(self):
        created = 0
        for name, type_, address, county, phone, hours in PICKUPS:
            _, was_created = PickupLocation.objects.get_or_create(
                name=name,
                defaults={
                    "type": type_,
                    "address": address,
                    "county": county,
                    "phone": phone,
                    "hours": hours,
                    "status": PickupLocation.Status.ACTIVE,
                },
            )
            created += was_created
        self.stdout.write(f"  Pickups: {created} created")

    def _seed_couriers(self):
        created = 0
        for slug, name, logo_bg, desc, api_key, enabled, regions in COURIERS:
            _, was_created = CourierConfig.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "logo_bg": logo_bg,
                    "description": desc,
                    "api_key": api_key,
                    "enabled": enabled,
                    "regions": regions,
                },
            )
            created += was_created
        self.stdout.write(f"  Couriers: {created} created")