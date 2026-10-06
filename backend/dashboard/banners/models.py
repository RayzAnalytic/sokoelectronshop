from django.db import models
from django.utils import timezone


class Placement(models.TextChoices):
    HOME_HERO = 'HOME_HERO', 'Homepage hero'
    CATEGORY_HERO = 'CATEGORY_HERO', 'Category hero'
    PROMO_STRIP = 'PROMO_STRIP', 'Promo strip'


class Status(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    ACTIVE = 'ACTIVE', 'Active'
    EXPIRED = 'EXPIRED', 'Expired'


class Alignment(models.TextChoices):
    LEFT = 'LEFT', 'Left'
    CENTER = 'CENTER', 'Center'
    RIGHT = 'RIGHT', 'Right'


class Overlay(models.TextChoices):
    NONE = 'NONE', 'None'
    DARK = 'DARK', 'Dark'
    LIGHT = 'LIGHT', 'Light'
    GRADIENT = 'GRADIENT', 'Gradient'


class Banner(models.Model):
    name = models.CharField(max_length=200)
    placement = models.CharField(
        max_length=20, choices=Placement.choices, default=Placement.HOME_HERO
    )
    order = models.PositiveIntegerField(default=1)

    badge = models.CharField(max_length=200, blank=True)
    headline = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)

    # Relative path ("/hero01.png") or absolute URL — same field handles both.
    desktop_image = models.CharField(max_length=500, blank=True)
    tablet_image = models.CharField(max_length=500, blank=True)
    mobile_image = models.CharField(max_length=500, blank=True)

    primary_cta_text = models.CharField(max_length=80, blank=True)
    primary_cta_href = models.CharField(max_length=300, blank=True)
    secondary_cta_text = models.CharField(max_length=80, blank=True)
    secondary_cta_href = models.CharField(max_length=300, blank=True)

    text_alignment = models.CharField(
        max_length=10, choices=Alignment.choices, default=Alignment.LEFT
    )
    overlay_style = models.CharField(
        max_length=10, choices=Overlay.choices, default=Overlay.GRADIENT
    )
    overlay_opacity = models.PositiveSmallIntegerField(default=80)

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.DRAFT
    )
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)

    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']
        indexes = [models.Index(fields=['placement', 'status', 'order'])]

    def __str__(self):
        return f'{self.name} [{self.placement}]'

    # ── derived metrics (mirror ctr()/cvr() in bannerStore.ts) ──
    @property
    def ctr(self):
        return round(self.clicks / self.impressions * 100, 2) if self.impressions else 0.0

    @property
    def cvr(self):
        return round(self.conversions / self.clicks * 100, 2) if self.clicks else 0.0

    @property
    def is_live(self):
        """Same rule used by activeHeroSlides() in bannerStore.ts."""
        if self.status != Status.ACTIVE:
            return False
        now = timezone.now()
        if self.start_at and self.start_at > now:
            return False
        if self.end_at and self.end_at <= now:
            return False
        return True