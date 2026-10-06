"""
Models for the Direct Orders (social-commerce) admin surface.

These models DO NOT store orders — orders live in `checkout.Order`. This
app owns the metadata that surrounds social selling:

    Creator       — a person who promotes products for commission
    CreatorSale   — one order attributed to a creator, with the commission
    ContentPost   — a TikTok video / carousel / LIVE promo, planned or posted
    LiveSession   — a TikTok LIVE selling session
    DirectProduct — a catalog product flagged as promoted on social

The `DirectProduct` row is a thin wrapper (OneToOne) over
`catalog.Product`. Stock, price, and identity stay in the catalog; the
wrapper only adds the social-selling metadata. This avoids adding five
nullable fields to every catalog row to support the minority that are
actually promoted.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models


# ─────────────────────────────────────────────────────────────────────────
# Shared choice vocabularies
#
# The frontend's Creators and Content tabs both offer the same four
# platform options, so we define the tuple once and reference it from
# both models. Keeping it here means a future "TikTok Shop" or "X" entry
# is a one-line change.
# ─────────────────────────────────────────────────────────────────────────

SOCIAL_PLATFORM_CHOICES = [
    ("TikTok", "TikTok"),
    ("Instagram", "Instagram"),
    ("YouTube", "YouTube"),
    ("Facebook", "Facebook"),
]


class DirectProduct(models.Model):
    """A catalog product flagged as promoted on social/TikTok channels."""

    STATUS = [
        ("DRAFT", "Draft"),
        ("ACTIVE", "Active"),
        ("PAUSED", "Paused"),
        ("SOLD_OUT", "Sold Out"),
    ]

    product = models.OneToOneField(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="direct_listing",
    )
    status = models.CharField(max_length=16, choices=STATUS, default="DRAFT")
    viral = models.BooleanField(default=False)
    video_link = models.URLField(max_length=500, blank=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    linked_to_website = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Direct Product"
        verbose_name_plural = "Direct Products"

    def __str__(self):
        return f"{self.product.name} ({self.status})"


class Creator(models.Model):
    """
    A social creator who promotes products for commission.

    Commission analytics (`sales_driven`, `commission_owed`,
    `commission_paid`) are DERIVED from `CreatorSale` rows, not stored
    — denormalized totals drift, and the money truth lives in the sales
    ledger.
    """

    STATUS = [
        ("ACTIVE", "Active"),
        ("PAUSED", "Paused"),
        ("ENDED", "Ended"),
    ]

    name = models.CharField(max_length=128)
    handle = models.CharField(
        max_length=64,
        unique=True,
        help_text="TikTok handle without @, e.g. 'njeritech'",
    )
    followers = models.PositiveIntegerField(default=0)
    niche = models.CharField(max_length=64, blank=True)
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Percentage, e.g. 15.00 for 15%",
    )
    start_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default="ACTIVE")
    notes = models.TextField(blank=True)

    # ── NEW: surface fields the Add Creator modal now sends ──
    avatar_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Public URL of the creator's profile picture.",
    )
    platform = models.CharField(
        max_length=32,
        choices=SOCIAL_PLATFORM_CHOICES,
        default="TikTok",
        help_text="Primary platform this creator works on.",
    )

    # Optional link to a storefront account. Nullable because most
    # creators never sign up on your storefront — they just push a link.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="creator_profiles",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} (@{self.handle})"

    @property
    def sales_driven(self) -> int:
        return self.sales.count()

    @property
    def commission_owed(self):
        from django.db.models import Sum
        return (
            self.sales.filter(paid=False)
            .aggregate(total=Sum("commission_amount"))["total"]
            or 0
        )

    @property
    def commission_paid(self):
        from django.db.models import Sum
        return (
            self.sales.filter(paid=True)
            .aggregate(total=Sum("commission_amount"))["total"]
            or 0
        )


class CreatorSale(models.Model):
    """
    One order attributed to a creator, with the commission owed.

    `commission_rate` and `commission_amount` are SNAPSHOTS — the rate
    at the moment of attribution. If the creator's rate changes later,
    existing sales keep their original commission.
    """

    creator = models.ForeignKey(
        Creator,
        on_delete=models.CASCADE,
        related_name="sales",
    )
    order = models.ForeignKey(
        "checkout.Order",
        on_delete=models.PROTECT,
        related_name="creator_sales",
    )
    attributed_at = models.DateTimeField(auto_now_add=True)

    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)

    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    payout_reference = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-attributed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["creator", "order"],
                name="one_sale_per_creator_per_order",
            ),
        ]

    def __str__(self):
        return f"{self.creator.handle} ← {self.order.reference}"


class ContentPost(models.Model):
    """A TikTok video / photo carousel / LIVE promo — planned or posted."""

    TYPE = [
        ("VIDEO", "Video"),
        ("PHOTO_CAROUSEL", "Photo carousel"),
        ("LIVE_PROMO", "LIVE promotion"),
    ]
    STATUS = [
        ("IDEA", "Idea"),
        ("SCRIPTED", "Scripted"),
        ("FILMED", "Filmed"),
        ("POSTED", "Posted"),
    ]

    title = models.CharField(max_length=255)
    content_type = models.CharField(max_length=20, choices=TYPE, default="VIDEO")
    status = models.CharField(max_length=16, choices=STATUS, default="IDEA")

    # ── NEW: platform, so content isn't implicitly TikTok-only ──
    platform = models.CharField(
        max_length=32,
        choices=SOCIAL_PLATFORM_CHOICES,
        default="TikTok",
    )

    # ── CHANGED: DateField → DateTimeField, and renamed ──
    #
    # The frontend sends a full ISO datetime (from <input type="datetime-local">),
    # not just a date. Renamed to `scheduled_at` so the name matches the type.
    #
    # MIGRATION NOTE: if you already have data in `scheduled_date`, do the
    # rename in two steps (add new field → data migration → drop old field)
    # so the existing rows aren't wiped.
    scheduled_at = models.DateTimeField(null=True, blank=True)

    script = models.TextField(blank=True)
    hashtags = models.CharField(max_length=255, blank=True)

    # ── NEW: caption separate from script ──
    #
    # `script` is the video script (production); `caption` is the text
    # posted alongside the video. They serve different purposes and the
    # Add Content modal captures them separately.
    caption = models.TextField(blank=True)

    posted_url = models.URLField(max_length=500, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)

    # ── NEW: the actual video file URL ──
    #
    # This is the big one — people need to see the video, not just a
    # thumbnail. Uploaded via /api/admin/uploads/ and returned as a
    # public URL. Empty for photo-carousel posts that have no video.
    video_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Public URL of the uploaded video. Empty for photo-only posts.",
    )

    # Product names as free strings. Deliberately NOT an FK to
    # catalog.Product — TikTok content promotes "the keyboard", not a
    # specific SKU, and a rename should not break historical content.
    # Swap to M2M later if you need per-product performance attribution.
    products = models.JSONField(default=list, blank=True)

    # Manually entered — TikTok does not share view counts with your
    # site. These are the seller's typed-in numbers.
    views = models.PositiveIntegerField(default=0)
    likes = models.PositiveIntegerField(default=0)
    comments = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # CHANGED: uses the renamed field
        ordering = ["-scheduled_at", "-created_at"]

    def __str__(self):
        return self.title


class LiveSession(models.Model):
    """A TikTok LIVE selling session — planned or completed."""

    STATUS = [
        ("SCHEDULED", "Scheduled"),
        ("LIVE", "Live"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    ]

    title = models.CharField(max_length=255)
    scheduled_start = models.DateTimeField()
    duration_min = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=16, choices=STATUS, default="SCHEDULED")

    # ── NEW: host name ──
    #
    # Who is running the livestream. Free text, not an FK to Creator —
    # the host might be a staff member, a guest, or the creator herself,
    # and forcing a relationship would block the common case.
    host_name = models.CharField(max_length=128, blank=True)

    products = models.JSONField(default=list, blank=True)

    peak_viewers = models.PositiveIntegerField(default=0)
    orders_generated = models.PositiveIntegerField(default=0)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    top_product = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_start"]

    def __str__(self):
        return self.title