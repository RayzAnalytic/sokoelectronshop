# dashboard/shipping/models.py

"""
Shipping configuration + operational tracking.

Two layers:

  1. CONFIGURATION — the rules that price a delivery:
       ShippingMethod   — the catalogue of delivery methods
       ShippingZone     — a named region covering a list of counties
       ShippingRate     — per-zone method + price + free threshold
       PickupLocation   — physical pickup points
       CourierConfig    — third-party courier credentials

  2. OPERATIONS — the fulfillment record:
       Shipment         — per-order tracking with a granular status

The checkout-facing pricing path will eventually call
`ShippingZone.for_county()` and read the matching `ShippingRate`.
Until that migration lands, `checkout.constants.DELIVERY_FEES` remains
the source of truth for the customer. This app is the admin UI for the
records that will replace it.

`Shipment.status` is NOT `Order.status`. The order has 8 fulfillment
states; the shipment has 8 logistics states, and four of them
(Label Created, Picked Up, In Transit, Out for Delivery) all map onto
`Order.Status.SHIPPED`. The finer state is admin-only — the customer
sees "Shipped" for all four. See `services.update_shipment_status` for
the mapping.
"""

from django.db import models


# ─────────────────────────────────────────────────────────────────────────────
# Kenya geography — the regions the Add Zone modal offers.
#
# This is a fixed reference table, not a model. The frontend's
# `KENYA_REGIONS` dict mirrors it and is the source the UI iterates;
# this copy exists so the backend can serve it from a single endpoint
# and stay authoritative if the UI ever drifts.
# ─────────────────────────────────────────────────────────────────────────────
KENYA_REGIONS = {
    "Nairobi": ["Nairobi"],
    "Central Kenya": [
        "Kiambu", "Murang'a", "Nyeri", "Kirinyaga", "Nyandarua",
    ],
    "Coast": [
        "Mombasa", "Kilifi", "Kwale", "Lamu", "Tana River", "Taita Taveta",
    ],
    "Western": ["Kakamega", "Bungoma", "Busia", "Vihiga"],
    "Rift Valley": [
        "Nakuru", "Uasin Gishu", "Trans Nzoia", "Nandi", "Kericho",
        "Bomet", "Laikipia", "Elgeyo Marakwet", "West Pokot",
        "Samburu", "Turkana", "Narok", "Kajiado",
    ],
    "Nyanza": ["Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Siaya"],
    "North Eastern": ["Garissa", "Wajir", "Mandera", "Isiolo", "Marsabit"],
    "Eastern": [
        "Machakos", "Kitui", "Makueni", "Embu", "Tharaka Nithi", "Meru",
        "Marsabit",
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# ShippingMethod — the catalogue of delivery methods
# ─────────────────────────────────────────────────────────────────────────────
class ShippingMethod(models.Model):
    """
    A delivery method the shop offers. The Methods tab renders this
    table directly.

    `default_price` is a preview — the actual price the customer pays
    is decided by the `ShippingRate` row for their county's zone. If
    no zone-specific rate exists, this is the fallback.

    `status` gates whether the method appears in the checkout options
    once the checkout side reads from here. Disabling a method does
    NOT delete it — existing shipments and historical orders keep
    referencing it.
    """

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        DISABLED = "Disabled", "Disabled"

    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    default_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
    )
    eta = models.CharField(max_length=64, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.ACTIVE, db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Shipping method"
        verbose_name_plural = "Shipping methods"

    def __str__(self):
        return f"{self.name} ({self.status})"


# ─────────────────────────────────────────────────────────────────────────────
# ShippingZone — a named region covering counties
# ─────────────────────────────────────────────────────────────────────────────
class ShippingZone(models.Model):
    """
    A named region and the counties it covers.

    `counties` is a JSON list of county-name strings. Deliberately not
    a M2M to a County model — the county list is static geography,
    there is no per-county data to store, and the frontend renders the
    list verbatim.

    A county should belong to at most one zone. The `for_county()`
    helper assumes that; overlapping zones resolve to the first match
    by id, which is deterministic but arbitrary. Enforce uniqueness at
    the admin level if it becomes a concern.
    """

    name = models.CharField(max_length=120, unique=True)
    region = models.CharField(max_length=64)
    counties = models.JSONField(
        default=list,
        help_text="List of county names covered by this zone.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Shipping zone"
        verbose_name_plural = "Shipping zones"

    def __str__(self):
        return f"{self.name} ({len(self.counties or [])} counties)"

    @classmethod
    def for_county(cls, county: str):
        """
        Return the zone that covers `county`, or None.

        Linear scan over zones because the table is small (single
        digits) and JSON containment queries are not portable across
        the databases Django supports. If the zone table ever grows,
        swap `counties` to a proper FK and index it.
        """
        if not county:
            return None
        for zone in cls.objects.all():
            if county in (zone.counties or []):
                return zone
        return None


# ─────────────────────────────────────────────────────────────────────────────
# ShippingRate — per-zone method + price + free threshold
# ─────────────────────────────────────────────────────────────────────────────
class ShippingRate(models.Model):
    """
    One method's price for one zone.

    `free_shipping_threshold` is per-rate, not per-zone, because the
    threshold legitimately varies by method — a Nairobi express might
    waive above 6,000 while standard waives above 3,000.

    `eta` here overrides `method.eta` for this zone. A zone-specific
    ETA is common (Coast takes 3 days by bus, 1 day by air) and the
    override means the Methods tab's generic ETA stays clean.
    """

    zone = models.ForeignKey(
        ShippingZone, on_delete=models.CASCADE, related_name="rates",
    )
    method = models.ForeignKey(
        ShippingMethod, on_delete=models.PROTECT, related_name="rates",
    )
    price = models.DecimalField(max_digits=12, decimal_places=2)
    eta = models.CharField(max_length=64, blank=True)
    free_shipping_threshold = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["method__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["zone", "method"],
                name="one_rate_per_method_per_zone",
            ),
        ]
        verbose_name = "Shipping rate"
        verbose_name_plural = "Shipping rates"

    def __str__(self):
        return f"{self.zone.name} · {self.method.name} · KES {self.price}"


# ─────────────────────────────────────────────────────────────────────────────
# PickupLocation — physical pickup points
# ─────────────────────────────────────────────────────────────────────────────
class PickupLocation(models.Model):
    """
    A physical pickup point. Three types:

      * Locker — an unattended parcel locker
      * Agent  — a shop that accepts parcels on behalf of the courier
      * Store  — an own-brand pickup counter

    The type is display-only today; the checkout UI shows the same
    picker for all three. If the customer experience ever branches by
    type (e.g. lockers support 24/7 self-service), the checkout
    endpoint reads `type` and changes the picker accordingly.
    """

    class Type(models.TextChoices):
        LOCKER = "Locker", "Locker"
        AGENT  = "Agent",  "Agent"
        STORE  = "Store",  "Store"

    class Status(models.TextChoices):
        ACTIVE   = "Active",   "Active"
        DISABLED = "Disabled", "Disabled"

    name = models.CharField(max_length=180)
    type = models.CharField(max_length=20, choices=Type.choices)
    address = models.CharField(max_length=255)
    county = models.CharField(max_length=64, db_index=True)
    phone = models.CharField(max_length=32, blank=True)
    hours = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.ACTIVE, db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Pickup location"
        verbose_name_plural = "Pickup locations"

    def __str__(self):
        return f"{self.name} ({self.type}, {self.county})"


# ─────────────────────────────────────────────────────────────────────────────
# CourierConfig — third-party courier credentials
# ─────────────────────────────────────────────────────────────────────────────
class CourierConfig(models.Model):
    """
    A courier integration. The Providers tab renders this table.

    `slug` is the stable identifier — the frontend's mock uses
    `'sendy'`, `'glovo'`, etc. as the primary key. Slugging it (rather
    than exposing the integer pk) keeps the API stable across
    environments where the auto-increment may differ.

    `api_key` is a plaintext CharField today. This is a known gap —
    real production should encrypt at rest (django-fernet-fields or
    AWS Secrets Manager). The field is marked `sensitive` in the admin
    and only ever returned masked on read; the write path (rotating
    a key) is a separate flow that does not yet exist.

    `regions` is a JSON list of region-name strings. Informational —
    the frontend renders it as chips.
    """

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    logo_bg = models.CharField(
        max_length=64, blank=True,
        help_text="Tailwind colour class for the logo chip (e.g. 'bg-amber-500').",
    )
    description = models.TextField(blank=True)
    api_key = models.CharField(max_length=255, blank=True)
    enabled = models.BooleanField(default=False, db_index=True)
    regions = models.JSONField(
        default=list,
        help_text="Regions this courier serves.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Courier integration"
        verbose_name_plural = "Courier integrations"

    def __str__(self):
        return f"{self.name} ({'on' if self.enabled else 'off'})"

    @property
    def masked_api_key(self) -> str:
        """
        `snd_live_9981…384` — enough to identify which key is loaded,
        not enough to use. The Providers tab displays this; the full
        value never leaves the server.
        """
        key = self.api_key or ""
        if len(key) <= 12:
            return "•" * len(key)
        return f"{key[:12]}…{key[-3:]}"


# ─────────────────────────────────────────────────────────────────────────────
# Shipment — per-order tracking
# ─────────────────────────────────────────────────────────────────────────────
class Shipment(models.Model):
    """
    The logistics record for one order.

    One-to-one with `checkout.Order`. When the shop dispatches an
    order, a Shipment row is created (or the admin creates it), and
    subsequent status changes on the Shipment drive the Order's
    fulfillment state through the mapping below.

    `ORDER_STATUS_MAP` is the bridge. Four logistics states collapse
    onto `Order.Status.SHIPPED` — the customer sees "Shipped" for
    Label Created, Picked Up, In Transit, and Out for Delivery. The
    finer state stays in this table for the admin's Tracking tab.

    PENDING and LABEL_CREATED map to None — the order's status is
    unchanged by those transitions. The order is already paid and
    confirmed by the time a shipment exists.
    """

    class Status(models.TextChoices):
        PENDING           = "Pending",           "Pending"
        LABEL_CREATED     = "Label Created",     "Label Created"
        PICKED_UP         = "Picked Up",         "Picked Up"
        IN_TRANSIT        = "In Transit",        "In Transit"
        OUT_FOR_DELIVERY  = "Out for Delivery",  "Out for Delivery"
        DELIVERED         = "Delivered",         "Delivered"
        FAILED            = "Failed",            "Failed"
        RETURNED          = "Returned",          "Returned"

    ORDER_STATUS_MAP = {
        Status.PICKED_UP:         "shipped",
        Status.IN_TRANSIT:        "shipped",
        Status.OUT_FOR_DELIVERY:  "shipped",
        Status.DELIVERED:         "delivered",
        Status.FAILED:            "failed",
        Status.RETURNED:          "returned",
    }

    # Statuses that mean "this shipment will never advance again".
    # Used by the services layer to refuse a re-transition and by the
    # admin UI to grey out the status dropdown.
    TERMINAL_STATUSES = {
        Status.DELIVERED,
        Status.FAILED,
        Status.RETURNED,
    }

    order = models.OneToOneField(
        "checkout.Order",
        on_delete=models.CASCADE,
        related_name="shipment",
    )
    method = models.ForeignKey(
        ShippingMethod,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="shipments",
    )
    provider = models.ForeignKey(
        CourierConfig,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="shipments",
    )
    tracking_number = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=32, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )

    # Denormalized for the Tracking tab's Destination column — the
    # snapshot's `address_town`/`address_county` never changes, so
    # there's no risk of it going stale. Written at Shipment creation
    # time from `order.snapshot`.
    destination = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["status", "-updated_at"]),
        ]
        verbose_name = "Shipment"
        verbose_name_plural = "Shipments"

    def __str__(self):
        return f"{self.order.reference} — {self.status}"

    @property
    def is_terminal(self) -> bool:
        return self.status in self.TERMINAL_STATUSES

    @property
    def mapped_order_status(self):
        """The `Order.Status` value this shipment implies, or None."""
        return self.ORDER_STATUS_MAP.get(self.status)

    @property
    def customer_name(self) -> str:
        snap = self.order.snapshot or {}
        return snap.get("full_name") or self.order.contact_email or "—"