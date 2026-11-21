from django.db import models
from django.utils import timezone

PLACEMENT_HOME_AFTER_BESTSELLING = "HOME_AFTER_BESTSELLING"
PLACEMENT_CHOICES = [
    (PLACEMENT_HOME_AFTER_BESTSELLING, "Home — after bestselling"),
]


class Poster(models.Model):
    STATUS_ACTIVE = "ACTIVE"
    STATUS_SCHEDULED = "SCHEDULED"
    STATUS_PAUSED = "PAUSED"
    STATUS_EXPIRED = "EXPIRED"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_EXPIRED, "Expired"),
    ]

    placement = models.CharField(
        max_length=64,
        choices=PLACEMENT_CHOICES,
        default=PLACEMENT_HOME_AFTER_BESTSELLING,
        db_index=True,
    )
    order = models.PositiveIntegerField(default=1)
    headline = models.CharField(max_length=120)
    subheadline = models.CharField(max_length=200, blank=True)
    desktop_image = models.ImageField(upload_to="posters/desktop/", blank=True, null=True)
    mobile_image = models.ImageField(upload_to="posters/mobile/", blank=True, null=True)
    cta_text = models.CharField(max_length=60, blank=True)
    cta_href = models.CharField(max_length=500, blank=True)
    brand_name = models.CharField(max_length=80, blank=True)
    sponsor_label = models.CharField(max_length=80, blank=True)
    is_published = models.BooleanField(default=True)
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    impression_count = models.PositiveIntegerField(default=0)
    click_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.headline or f"Poster #{self.pk}"

    @property
    def computed_status(self):
        if not self.is_published:
            return self.STATUS_PAUSED
        now = timezone.now()
        if self.start_at and self.start_at > now:
            return self.STATUS_SCHEDULED
        if self.end_at and self.end_at <= now:
            return self.STATUS_EXPIRED
        return self.STATUS_ACTIVE