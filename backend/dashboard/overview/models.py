from django.db import models


class OverviewCache(models.Model):
    """Cached JSON payload for the admin overview dashboard.

    One row per `range_key` (today / 7d / 30d / 90d / custom:START..END).
    Cleared by the refresh endpoint or manually in admin.
    """

    range_key = models.CharField(max_length=64, unique=True)
    payload = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Overview cache"
        verbose_name_plural = "Overview cache"
        indexes = [models.Index(fields=["range_key"])]

    def __str__(self) -> str:
        return self.range_key