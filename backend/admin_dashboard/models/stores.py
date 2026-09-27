# admin_dashboard/models/stores.py

import uuid

from django.conf import settings
from django.db import models


class StoreProfile(models.Model):
    """
    One store per user (the owner). Populated during Step 2 of onboarding.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="store",
    )

    # ── Branding ──
    name = models.CharField(max_length=120)
    tagline = models.CharField(max_length=160, blank=True)
    description = models.CharField(max_length=200, blank=True)
    logo = models.ImageField(upload_to="stores/logos/", null=True, blank=True)

    # ── Physical address ──
    street = models.CharField(max_length=160, blank=True)
    town = models.CharField(max_length=80, blank=True)
    county = models.CharField(max_length=40, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=60, default="Kenya")

    # ── Support contact ──
    support_email = models.EmailField(blank=True)
    support_phone = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_profiles"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.user.email})"