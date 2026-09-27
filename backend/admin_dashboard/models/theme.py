# admin_dashboard/models/theme.py

import uuid

from django.conf import settings
from django.db import models


class StoreTheme(models.Model):
    """Storefront theme configuration. One per store owner."""

    class Font(models.TextChoices):
        INTER = "Inter", "Inter"
        POPPINS = "Poppins", "Poppins"
        ROBOTO = "Roboto", "Roboto"

    class Preset(models.TextChoices):
        BLUE = "blue", "Trust Blue"
        DARK = "dark", "Tech Dark"
        WHITE = "white", "Clean White"
        ORANGE = "orange", "Warm Orange"
        GREEN = "green", "Fresh Green"
        RED = "red", "Bold Red"
        CUSTOM = "custom", "Custom"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="theme",
    )

    preset = models.CharField(
        max_length=20, choices=Preset.choices, default=Preset.BLUE
    )
    primary = models.CharField(max_length=7, default="#1e3a8a")     # hex
    accent = models.CharField(max_length=7, default="#3b82f6")
    font = models.CharField(
        max_length=20, choices=Font.choices, default=Font.INTER
    )
    radius = models.PositiveSmallIntegerField(default=4)             # 0-24
    dark_store = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_themes"
        verbose_name = "Store theme"

    def __str__(self):
        return f"{self.user.email} — {self.preset}"