import re
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def generate_product_id():
    return f"prod_{uuid.uuid4().hex[:6]}"


# ─────────────────────────────────────────────────────────────────────────────
# Category
# ─────────────────────────────────────────────────────────────────────────────
class CategoryQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def with_product_counts(self):
        return self.annotate(
            product_count=models.Count(
                "products",
                filter=models.Q(products__is_active=True),
                distinct=True,
            )
        )

    def roots(self):
        return self.filter(parent__isnull=True)


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    # Self-referential FK — supports the parent / children hierarchy.
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )

    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)

    # Lucide icon name so the sidebar can map to a component client-side
    icon_name = models.CharField(
        max_length=64,
        blank=True,
        help_text="Lucide icon name, e.g. Smartphone, Laptop, Tv",
    )

    # SEO metadata — surfaced in the admin's SEO drawer.
    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.TextField(blank=True)
    meta_keywords = models.CharField(max_length=255, blank=True)
    canonical_url = models.CharField(max_length=500, blank=True)

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CategoryQuerySet.as_manager()

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Categories"
        indexes = [
            models.Index(fields=["is_active", "sort_order"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["parent", "sort_order"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# Brand
# ─────────────────────────────────────────────────────────────────────────────
class Brand(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    logo = models.ImageField(upload_to="brands/", blank=True, null=True)

    # Brand metadata shown in the admin drawer
    description = models.TextField(blank=True)
    website_url = models.CharField(max_length=500, blank=True)

    # Marketing flag — brands the homepage highlights
    featured = models.BooleanField(default=False)

    # SEO metadata — mirrors Category so the frontend can reuse the
    # same SEO drawer component.
    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.TextField(blank=True)
    meta_keywords = models.CharField(max_length=255, blank=True)
    canonical_url = models.CharField(max_length=500, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_active", "name"]),
            models.Index(fields=["featured"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# Product
#
# `rating_avg` and `review_count` are denormalised aggregates. They are
# populated by `account.services.recompute_product_rating(product_id)`,
# which aggregates the published reviews in `account.Review`. This app
# no longer owns a Review model — the review data lives in `account`
# because it needs a User FK for moderation and ownership scoping.
#
# Slow-stock workflow
# -------------------
# `days_since_listed`, `is_slow_moving`, and `effective_price` exist to
# support the "clear old inventory" use case:
#
#   * `is_slow_moving` is a heuristic that flags products that have been
#     listed a long time, sold very few units, and still have stock.
#   * `effective_price` returns the discounted price when the product is
#     under an active automatic (clearance) discount, or `price` when it
#     is not. Every storefront and checkout caller should use this
#     property, not `price`, so automatic discounts are honoured
#     everywhere without a per-view opt-in.
# ─────────────────────────────────────────────────────────────────────────────
class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def with_relations(self):
        return (
            self.select_related("brand", "category")
            .prefetch_related("images", "features", "specs")
        )

    def slow_moving(self, *, min_days=90, max_sales=5, min_stock=10):
        """
        Products that have been listed for at least `min_days`, sold at
        most `max_sales` units, and still have at least `min_stock` on
        hand. Used by the "Clear Slow Stock" admin workflow.
        """
        cutoff = timezone.now() - timezone.timedelta(days=min_days)
        return self.filter(
            is_active=True,
            created_at__lte=cutoff,
            sales_count__lte=max_sales,
            stock_quantity__gte=min_stock,
        )


class Product(models.Model):
    STOCK_IN = "In Stock"
    STOCK_LOW = "Low Stock"
    STOCK_OUT = "Out of Stock"

    id = models.CharField(
        primary_key=True,
        max_length=32,
        default=generate_product_id,
        editable=False,
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    brand = models.ForeignKey(
        Brand, on_delete=models.PROTECT, related_name="products"
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="products"
    )
    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)

    # Storefront flags
    featured = models.BooleanField(default=False)
    best_seller = models.BooleanField(default=False)

    # "2.4k+ sold this month" style copy, plus a real numeric counter
    sales_volume = models.CharField(max_length=120, blank=True)
    sales_count = models.PositiveIntegerField(default=0)

    # Denormalised review aggregates — kept in sync by
    # `account.services.recompute_product_rating()` whenever a review
    # is approved, rejected, or deleted.
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    review_count = models.PositiveIntegerField(default=0)

    # Deals / promo
    promo_end_date = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["brand", "is_active"]),
            models.Index(fields=["-created_at"]),
            models.Index(fields=["-rating_avg"]),
            models.Index(fields=["-sales_count"]),
            models.Index(fields=["featured"]),
            models.Index(fields=["best_seller"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:260] or "product"
            self.slug = f"{base}-{self.id[-6:]}"
        super().save(*args, **kwargs)

    # ── Computed helpers ──────────────────────────────────────
    @property
    def stock_status(self) -> str:
        if self.stock_quantity == 0:
            return self.STOCK_OUT
        if self.stock_quantity <= self.low_stock_threshold:
            return self.STOCK_LOW
        return self.STOCK_IN

    @property
    def discount_percentage(self):
        if self.compare_at_price and self.compare_at_price > self.price:
            return round(
                ((self.compare_at_price - self.price) / self.compare_at_price)
                * 100
            )
        return None

    @property
    def is_on_promo(self) -> bool:
        return bool(self.promo_end_date and self.promo_end_date > timezone.now())

    # ── Slow-stock helpers ────────────────────────────────────
    @property
    def days_since_listed(self) -> int:
        """How many full days this product has been in the catalog."""
        return (timezone.now() - self.created_at).days

    @property
    def is_slow_moving(self) -> bool:
        """
        Heuristic for the "clear slow stock" workflow:
          * listed at least 90 days
          * sold no more than 5 units
          * still has at least 10 units in stock

        The thresholds match `ProductQuerySet.slow_moving()` so a single
        product and the list view agree on what counts.
        """
        return (
            self.days_since_listed >= 90
            and self.sales_count <= 5
            and self.stock_quantity >= 10
            and self.is_active
        )

    @property
    def active_automatic_discount(self):
        """
        The best currently-active automatic discount on this product, or
        `None`. "Automatic" is any discount with `applies_to` matching
        this product and `is_automatic=True`. When multiple qualify, the
        one with the largest effective markdown wins.

        A local import avoids a circular reference at module load time
        (`catalog.services` imports from `catalog.models`).
        """
        from catalog.services import get_best_automatic_discount_for_product

        return get_best_automatic_discount_for_product(self)

    @property
    def effective_price(self) -> Decimal:
        """
        The price a customer actually pays right now.

        If an active automatic (clearance) discount applies, returns the
        discounted price. Otherwise returns `price`. Storefront and
        checkout serializers should read this, not `price`.
        """
        discount = self.active_automatic_discount
        if discount is None:
            return self.price
        return discount.price_for(self.price)

    @property
    def effective_discount_percentage(self) -> int:
        """
        Percent off currently in force, or 0 if none. Combines the
        catalog's `compare_at_price` markdown with any active automatic
        discount so the storefront badge reflects the true saving.
        """
        discount = self.active_automatic_discount
        if discount is not None:
            return discount.percent_off_for(self.price)
        return self.discount_percentage or 0

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# Product children
# ─────────────────────────────────────────────────────────────────────────────
class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images"
    )

    # Two ways to attach an image:
    #   - `image`: file uploaded to MEDIA_ROOT/products/
    #   - `external_url`: a path, CDN URL, or base64 data URL from the admin
    # The serializer prefers `external_url` when present, so admin-created
    # products can carry image references without forcing a file upload.
    #
    # NOTE: This is intentionally a CharField — data URLs (`data:image/...`)
    # are far too long for URLField's 200-char default and don't pass
    # Django's URL validator.
    image = models.ImageField(upload_to="products/", blank=True)
    external_url = models.CharField(max_length=2_000_000, blank=True)

    alt_text = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.product.name} image #{self.sort_order}"


class ProductFeature(models.Model):
    """Bullet highlights shown on the deal / product modal."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="features"
    )
    text = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.text


class ProductSpec(models.Model):
    """Key/value spec table shown on the deal / product modal."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="specs"
    )
    key = models.CharField(max_length=120)
    value = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.key}: {self.value}"


# ═════════════════════════════════════════════════════════════════════════════
# NOTE ON THE FORMER `Review` MODEL
#
# This file used to define a `Review` model — a lightweight, catalog-owned
# row with `product`, `author_name`, `rating`, `title`, `body`,
# `is_verified`, and `created_at`, but no user FK and no moderation state.
#
# It has been removed. Customer reviews now live in `account.Review`,
# which carries:
#
#   * a real `user` FK (ownership, moderation, notifications)
#   * moderation state (`status`, `rejection_reason`, `moderated_at`,
#     `moderated_by`)
#   * flag state (`flag_status`, `flag_reason`, `flagged_at`, `flagged_by`)
#   * social state (`helpful_count`, related `ReviewReply` rows)
#   * a full product snapshot (`product_name`, `product_image`, etc.)
#     so the storefront renders without joining back to this app
#
# `Product.rating_avg` and `Product.review_count` are still here, but
# they are populated from `account.Review` by
# `account.services.recompute_product_rating()`. The storefront reads
# these columns directly; it does not fan out to a reviews table.
#
# Migration sequence for removing the old table:
#
#   1. Data migration (`catalog/migrations/00XX_move_reviews_to_account.py`)
#      copies every `catalog.Review` row into `account.Review`, setting
#      `guest_author_name = author_name`, `status = "published"`, and
#      copying `is_verified → is_verified_purchase`.
#      This migration must run BEFORE the model deletion below.
#
#   2. Model deletion (`catalog/migrations/00XX_delete_review.py`)
#      generated by `makemigrations` after this file's `Review` class
#      was removed. Drops the `catalog_review` table.
#
# If the model deletion runs before the data migration, the rows are
# lost. Always apply the data migration first, then delete the model.
# ═════════════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────────────
# Discount
#
# Two workflows write to this table:
#
#   * Campaign-first — marketing creates a time-boxed promo and attaches
#     products or categories. `is_automatic=False`, `end_date` set,
#     `display_on_deals_page=True`.
#   * Product-first (clearance) — ops marks a slow-moving product down
#     to clear stock. `is_automatic=True`, `is_clearance=True`, usually
#     no `end_date` (runs until sold out), attached to specific products.
#
# The storefront treats both identically except that clearance discounts
# carry a "Clearance" badge and are hidden once stock hits zero.
# ─────────────────────────────────────────────────────────────────────────────
class DiscountType(models.TextChoices):
    PERCENTAGE = "Percentage", "Percentage"
    FIXED_AMOUNT = "Fixed Amount", "Fixed Amount"
    FREE_SHIPPING = "Free Shipping", "Free Shipping"
    BUY_X_GET_Y = "Buy X Get Y", "Buy X Get Y"


class PromotionType(models.TextChoices):
    """
    Marketing label for a discount. Distinct from `DiscountType`
    (mechanics). A "Free Shipping" discount is still typed
    `DiscountType.FREE_SHIPPING`; this enum decides what header the
    storefront renders on the deal card and lets analytics bucket
    promotions by presentation style.
    """
    PERCENTAGE_DISCOUNT = "Percentage Discount", "Percentage Discount"
    FIXED_AMOUNT_DISCOUNT = "Fixed Amount Discount", "Fixed Amount Discount"
    SALE_PRICE = "Sale Price", "Sale Price"
    CAMPAIGN = "Campaign", "Campaign"
    FREE_SHIPPING = "Free Shipping", "Free Shipping"     # ← added
    FLASH_SALE = "Flash Sale", "Flash Sale"              # ← added
    BOGO = "BOGO", "BOGO"                                # ← added
    BUNDLE_DISCOUNT = "Bundle Discount", "Bundle Discount"  # ← added
    TIERED_DISCOUNT = "Tiered Discount", "Tiered Discount"  # ← added


class AppliesTo(models.TextChoices):
    ALL_PRODUCTS = "All Products", "All Products"
    SPECIFIC_PRODUCTS = "Specific Products", "Specific Products"
    SPECIFIC_CATEGORIES = "Specific Categories", "Specific Categories"


class DiscountSource(models.TextChoices):
    """
    Why this discount exists. Lets ops filter the admin list by origin,
    and lets the storefront decide whether to render a "Deal" or a
    "Clearance" badge.
    """
    CAMPAIGN = "campaign", "Campaign"          # marketing-created
    CLEARANCE = "clearance", "Clearance"        # ops, clearing slow stock
    MANUAL = "manual", "Manual"                 # ad-hoc, admin-created
    AUTO_SLOW_MOVING = "auto_slow_moving", "Auto (slow moving)"


class DiscountQuerySet(models.QuerySet):
    def visible_on_deals_page(self):
        return self.filter(display_on_deals_page=True)

    def active(self, at=None):
        """
        Discounts live at `at`. `end_date` may be null for open-ended
        clearance discounts — those never expire on their own.
        """
        at = at or timezone.now()
        return self.filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=at),
            start_date__lte=at,
        )

    def automatic(self):
        """Only discounts that apply without a code."""
        return self.filter(is_automatic=True)

    def clearance(self):
        return self.filter(source=DiscountSource.CLEARANCE)

    def with_links(self):
        return self.prefetch_related("linked_products", "linked_categories")


class Discount(models.Model):
    # Identity
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)

    # Mechanics
    type = models.CharField(max_length=32, choices=DiscountType.choices)
    value = models.CharField(max_length=32)          # "15%" or "KES 500"
    min_order = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_cap = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Limits
    usage_limit = models.PositiveIntegerField(default=0)   # 0 = unlimited
    per_customer = models.PositiveIntegerField(default=1)
    usage_count = models.PositiveIntegerField(default=0)

    # Window — `end_date` is nullable so clearance discounts can run
    # open-ended until the stock is gone.
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)

    # Targeting
    applies_to = models.CharField(max_length=32, choices=AppliesTo.choices)
    eligibility = models.CharField(max_length=120, blank=True)
    target_audience = models.CharField(max_length=120, blank=True)

    # ── Slow-stock / clearance fields ────────────────────────────────
    source = models.CharField(
        max_length=32,
        choices=DiscountSource.choices,
        default=DiscountSource.MANUAL,
        db_index=True,
        help_text="Why this discount exists — campaign, clearance, manual, or auto.",
    )
    is_automatic = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            "When True, the discount is applied automatically to matching "
            "products without requiring a code. Required for clearance."
        ),
    )
    is_clearance = models.BooleanField(
        default=False,
        help_text="Renders a 'Clearance' badge on the storefront instead of 'Deal'.",
    )
    expires_when_sold_out = models.BooleanField(
        default=False,
        help_text=(
            "Stop showing this discount on a product the moment its "
            "stock_quantity hits zero. Intended for clearance runs."
        ),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_discounts",
        help_text="Staff member who created this discount. Null for system jobs.",
    )

    # Storefront presentation
    is_most_deal = models.BooleanField(default=False)
    # `image` stores either a static path ("/tvs.jpeg"), a CDN URL, or a
    # base64 data URL uploaded from the admin. Length matches
    # `ProductImage.external_url` so data URLs fit.
    image = models.CharField(max_length=2_000_000, blank=True)
    display_on_deals_page = models.BooleanField(default=True)
    promotion_type = models.CharField(
        max_length=32,
        choices=PromotionType.choices,
        default=PromotionType.PERCENTAGE_DISCOUNT,
    )
    deal_title = models.CharField(max_length=200, blank=True)
    badge_text = models.CharField(max_length=64, blank=True)
    priority = models.PositiveIntegerField(default=0)

    # ── Admin channels (Website / WhatsApp / TikTok) ─────────────────
    # A JSON list of channel strings. Stored as JSON rather than a M2M
    # because the values are a fixed, small set the frontend and admin
    # both hardcode — no need for a join table or a choices constraint.
    channels = models.JSONField(
        default=list,
        blank=True,
        help_text="Channels this discount runs on, e.g. ['Website', 'TikTok'].",
    )
    tiktok_video = models.CharField(
        max_length=2_000_000,
        blank=True,
        help_text="Video URL or data URL for the scheduled TikTok post.",
    )

    # ── Admin-only status override (Draft, Paused) ───────────────────
    # Blank means "use the computed `status` property". Set to 'Draft' or
    # 'Paused' to freeze a discount regardless of its dates.
    status_override = models.CharField(
        max_length=16,
        blank=True,
        choices=[
            ("", "Auto (from dates)"),
            ("Draft", "Draft"),
            ("Paused", "Paused"),
        ],
        default="",
    )

    # Links
    linked_products = models.ManyToManyField(
        Product, blank=True, related_name="discounts"
    )
    linked_categories = models.ManyToManyField(
        Category, blank=True, related_name="discounts"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = DiscountQuerySet.as_manager()

    class Meta:
        ordering = ["-priority", "-created_at"]
        indexes = [
            models.Index(fields=["display_on_deals_page", "start_date", "end_date"]),
            models.Index(fields=["-priority"]),
            models.Index(fields=["is_automatic", "start_date"]),
            models.Index(fields=["source", "-created_at"]),
        ]

    # ── Computed helpers (mirror data/discounts.ts) ──────────
    @property
    def status(self) -> str:
        """
        Effective status. Honours `status_override` first (Draft / Paused
        freeze the discount), then falls back to the date window. A null
        `end_date` never expires.
        """
        if self.status_override:
            return self.status_override

        now = timezone.now()
        if now < self.start_date:
            return "Scheduled"
        if self.end_date and now > self.end_date:
            return "Expired"
        return "Active"

    @property
    def numeric_value(self) -> float:
        """Parse '15%' or 'KES 500' → 15.0 or 500.0"""
        m = re.search(r"[\d.]+", self.value or "")
        return float(m.group()) if m else 0.0

    def price_for(self, original_price: Decimal) -> Decimal:
        """The price a customer pays under this discount."""
        original_price = Decimal(original_price)
        if self.type == DiscountType.PERCENTAGE:
            factor = (Decimal("100") - Decimal(str(self.numeric_value))) / Decimal("100")
            price = original_price * factor
        elif self.type == DiscountType.FIXED_AMOUNT:
            price = original_price - Decimal(str(self.numeric_value))
        else:
            price = original_price
        if price < 0:
            price = Decimal("0")
        return price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def percent_off_for(self, original_price: Decimal) -> int:
        original_price = Decimal(original_price)
        if original_price <= 0:
            return 0
        final = self.price_for(original_price)
        pct = ((original_price - final) / original_price) * Decimal("100")
        return int(pct.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def applies_to_product(self, product: "Product") -> bool:
        """
        Whether this discount's targeting rules match `product`.

        `All Products` matches everything. `Specific Products` matches
        the M2M. `Specific Categories` matches if the product's category
        is in the M2M.
        """
        if self.applies_to == AppliesTo.ALL_PRODUCTS:
            return True
        if self.applies_to == AppliesTo.SPECIFIC_PRODUCTS:
            return self.linked_products.filter(pk=product.pk).exists()
        if self.applies_to == AppliesTo.SPECIFIC_CATEGORIES:
            return self.linked_categories.filter(pk=product.category_id).exists()
        return False

    def __str__(self):
        return f"{self.code} — {self.deal_title or self.description[:40]}"