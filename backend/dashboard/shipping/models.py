from django.db import models


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


class ShippingMethod(models.Model):
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


class ShippingZone(models.Model):
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
        if not county:
            return None
        for zone in cls.objects.all():
            if county in (zone.counties or []):
                return zone
        return None


class ShippingRate(models.Model):
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


class PickupLocation(models.Model):
    class Type(models.TextChoices):
        LOCKER = "Locker", "Locker"
        AGENT = "Agent", "Agent"
        STORE = "Store", "Store"

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
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


class CourierConfig(models.Model):
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
        key = self.api_key or ""
        if len(key) <= 12:
            return "•" * len(key)
        return f"{key[:12]}…{key[-3:]}"


class Shipment(models.Model):
    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        LABEL_CREATED = "Label Created", "Label Created"
        PICKED_UP = "Picked Up", "Picked Up"
        IN_TRANSIT = "In Transit", "In Transit"
        OUT_FOR_DELIVERY = "Out for Delivery", "Out for Delivery"
        DELIVERED = "Delivered", "Delivered"
        FAILED = "Failed", "Failed"
        RETURNED = "Returned", "Returned"

    ORDER_STATUS_MAP = {
        Status.PICKED_UP: "shipped",
        Status.IN_TRANSIT: "shipped",
        Status.OUT_FOR_DELIVERY: "shipped",
        Status.DELIVERED: "delivered",
        Status.FAILED: "failed",
        Status.RETURNED: "returned",
    }

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
        return self.ORDER_STATUS_MAP.get(self.status)

    @property
    def customer_name(self) -> str:
        snap = self.order.snapshot or {}
        return snap.get("full_name") or self.order.contact_email or "—"