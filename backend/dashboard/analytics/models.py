from django.db import models


class AnalyticsCache(models.Model):
    TAB_CHOICES = [
        ("traffic", "Traffic"),
        ("sales", "Sales"),
        ("customers", "Customers"),
        ("products", "Products"),
        ("channels", "Channels"),
    ]

    tab = models.CharField(max_length=32, choices=TAB_CHOICES)
    range_key = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("tab", "range_key")
        verbose_name = "Analytics cache"
        verbose_name_plural = "Analytics cache"
        indexes = [
            models.Index(fields=["tab", "range_key"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.tab} · {self.range_key}"


class PageView(models.Model):
    DEVICE_CHOICES = [
        ("mobile", "Mobile"),
        ("desktop", "Desktop"),
        ("tablet", "Tablet"),
        ("bot", "Bot"),
    ]

    path = models.CharField(max_length=255)
    device_type = models.CharField(max_length=16, choices=DEVICE_CHOICES)
    user_agent = models.TextField(blank=True)
    user = models.ForeignKey(
        "authentication.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="page_views",
    )
    session_key = models.CharField(max_length=64, blank=True)
    referrer = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Page view"
        verbose_name_plural = "Page views"
        indexes = [
            models.Index(fields=["created_at", "device_type"]),
            models.Index(fields=["path"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} · {self.device_type} · {self.path}"