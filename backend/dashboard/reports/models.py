from django.conf import settings
from django.db import models


class ReportCache(models.Model):
    """Cached JSON payload for a (tab, range) pair.

    The reports views prefer this cache; if it is empty they fall back to
    live aggregation from your other apps. A management command or a Celery
    beat task can refresh it.
    """

    TAB_CHOICES = [
        ("sales", "Sales"),
        ("orders", "Orders"),
        ("customers", "Customers"),
        ("products", "Products"),
        ("inventory", "Inventory"),
        ("payments", "Payments"),
        ("taxes", "Taxes & VAT"),
        ("shipping", "Shipping"),
        ("discounts", "Discounts"),
        ("social", "Social Videos"),
    ]

    tab = models.CharField(max_length=32, choices=TAB_CHOICES)
    range_key = models.CharField(max_length=64)          # e.g. "7days", "2026-09-01..2026-09-23"
    payload = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("tab", "range_key")
        verbose_name = "Report cache"
        verbose_name_plural = "Report cache"

    def __str__(self) -> str:
        return f"{self.tab} · {self.range_key}"


class ReportExportLog(models.Model):
    """One row per export click from the Reports UI."""

    FORMAT_CHOICES = [("CSV", "CSV"), ("Excel", "Excel"), ("PDF", "PDF")]

    tab = models.CharField(max_length=32)
    range_key = models.CharField(max_length=64)
    fmt = models.CharField(max_length=8, choices=FORMAT_CHOICES)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Report export log"
        verbose_name_plural = "Report export logs"

    def __str__(self) -> str:
        return f"{self.tab} · {self.fmt} · {self.created_at:%Y-%m-%d %H:%M}"