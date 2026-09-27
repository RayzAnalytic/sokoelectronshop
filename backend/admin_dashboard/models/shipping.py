# admin_dashboard/models/shipping.py

import uuid

from django.conf import settings
from django.db import models


class StoreShippingConfig(models.Model):
    """One shipping config per store owner."""

    class Preset(models.TextChoices):
        NATIONAL = "national", "Nationwide (Kenya)"
        NAIROBI = "nairobi", "Nairobi only"
        CUSTOM = "custom", "Custom"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shipping_config",
    )
    preset = models.CharField(
        max_length=20,
        choices=Preset.choices,
        default=Preset.NATIONAL,
    )
    free_shipping_enabled = models.BooleanField(default=False)
    free_shipping_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_shipping_configs"

    def __str__(self):
        return f"{self.user.email} — {self.get_preset_display()}"


class ShippingZone(models.Model):
    """A named delivery zone with a list of counties."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    config = models.ForeignKey(
        StoreShippingConfig,
        on_delete=models.CASCADE,
        related_name="zones",
    )
    name = models.CharField(max_length=80)
    # Counties stored as JSON list — flexible, no extra join table
    counties = models.JSONField(default=list, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shipping_zones"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.name} ({len(self.counties)} counties)"


class ShippingRate(models.Model):
    """A delivery method + price + ETA, scoped to a zone."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(
        ShippingZone,
        on_delete=models.CASCADE,
        related_name="rates",
    )
    method = models.CharField(max_length=80, default="Standard")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    eta = models.CharField(max_length=80, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shipping_rates"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.zone.name} — {self.method} ({self.price} KES)"