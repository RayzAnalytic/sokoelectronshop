# admin_dashboard/models/business.py

import uuid

from django.conf import settings
from django.db import models


class BusinessDetails(models.Model):
    """
    Business & tax info for a store. Populated during Step 3 of onboarding.
    Optional — users can complete it later.
    """

    class BusinessType(models.TextChoices):
        SOLE = "sole", "Sole Proprietor"
        LTD = "ltd", "Limited Company"
        PARTNER = "partner", "Partnership"
        NONE = "none", "Not registered"

    class ETimsEnv(models.TextChoices):
        SANDBOX = "sandbox", "Sandbox"
        PRODUCTION = "production", "Production"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="business",
    )

    # ── Type ──
    type = models.CharField(
        max_length=20,
        choices=BusinessType.choices,
        default=BusinessType.NONE,
    )

    # ── Tax identifiers ──
    kra_pin = models.CharField(max_length=20, blank=True)
    reg_number = models.CharField(max_length=40, blank=True)

    # ── VAT ──
    vat_registered = models.BooleanField(default=False)
    vat_number = models.CharField(max_length=30, blank=True)

    # ── eTIMS ──
    etims_enabled = models.BooleanField(default=False)
    etims_device_id = models.CharField(max_length=80, blank=True)
    etims_pin = models.CharField(max_length=80, blank=True)
    etims_api_key = models.CharField(max_length=255, blank=True)  # never returned to client
    etims_env = models.CharField(
        max_length=20,
        choices=ETimsEnv.choices,
        default=ETimsEnv.SANDBOX,
    )

    # ── Invoice branding ──
    invoice_footer = models.CharField(
        max_length=255,
        default="Thank you for shopping with us!",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "business_details"
        verbose_name_plural = "Business details"

    def __str__(self):
        return f"{self.user.email} — {self.get_type_display()}"