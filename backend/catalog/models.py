import re
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import models
from django.db.models import Avg, Count
from django.utils import timezone
from django.utils.text import slugify


def generate_product_id():
    return f"prod_{uuid.uuid4().hex[:6]}"


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
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)
    image_alt = models.CharField(max_length=200, blank=True)
    icon_name = models.CharField(max_length=64, blank=True)

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

    @property
    def href(self) -> str:
        return f"/pages/categories/{self.slug}"

    @property
    def icon(self) -> str:
        return self.icon_name or "Package"

    @property
    def item_count(self) -> int:
        return getattr(self, "product_count", 0)

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    logo = models.ImageField(upload_to="brands/", blank=True, null=True)
    logo_alt = models.CharField(max_length=200, blank=True)

    description = models.TextField(blank=True)
    website_url = models.CharField(max_length=500, blank=True)
    featured = models.BooleanField(default=False)

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


class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def with_relations(self):
        return (
            self.select_related("brand", "category")
            .prefetch_related("images", "features", "specs")
        )

    def slow_moving(self, *, min_days=90, max_sales=5, min_stock=10):
        cutoff = timezone.now() - timezone.timedelta(days=min_days)
        return self.filter(
            is_active=True,
            created_at__lte=cutoff,
            sales_count__lte=max_sales,
            stock_quantity__gte=min_stock,
        )

    def tagged(self, tag):
        return self.filter(tags__contains=[tag])

    def with_images(self):
        return self.filter(images__isnull=False).distinct()


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

    sku = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )
    barcode = models.CharField(max_length=64, blank=True, default="")

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
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)

    featured = models.BooleanField(default=False)
    best_seller = models.BooleanField(default=False)

    sales_volume = models.CharField(max_length=120, blank=True)
    sales_count = models.PositiveIntegerField(default=0)

    views_count = models.PositiveIntegerField(default=0, db_index=True)

    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    review_count = models.PositiveIntegerField(default=0)

    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Free-form tags, e.g. ['whatsapp', 'clearance'].",
    )

    weight_kg = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
    )
    warranty_months = models.PositiveSmallIntegerField(
        default=12,
        help_text="Manufacturer warranty in months. 0 = no warranty.",
    )
    return_window_days = models.PositiveSmallIntegerField(
        default=30,
        help_text="Days the customer has to return. 0 = no returns.",
    )

    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.TextField(blank=True)
    meta_keywords = models.CharField(max_length=255, blank=True)
    canonical_url = models.CharField(max_length=500, blank=True)

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
            models.Index(fields=["sku"]),
            models.Index(fields=["-views_count"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:260] or "product"
            self.slug = f"{base}-{self.id[-6:]}"
        if not self.sku:
            self.sku = self.id.upper()
        super().save(*args, **kwargs)

    @property
    def stock_status(self) -> str:
        if self.stock_quantity == 0:
            return self.STOCK_OUT
        if self.stock_quantity <= self.low_stock_threshold:
            return self.STOCK_LOW
        return self.STOCK_IN

    @property
    def is_in_stock(self) -> bool:
        return self.stock_quantity > 0

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

    @property
    def profit_margin(self) -> Decimal:
        if self.cost_price is None:
            return Decimal("0")
        return (self.price - self.cost_price).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    @property
    def profit_margin_percentage(self) -> float:
        if not self.cost_price or self.cost_price <= 0:
            return 0.0
        return float(
            ((self.price - self.cost_price) / self.price) * Decimal("100")
        )

    @property
    def days_since_listed(self) -> int:
        return (timezone.now() - self.created_at).days

    @property
    def is_slow_moving(self) -> bool:
        return (
            self.days_since_listed >= 90
            and self.sales_count <= 5
            and self.stock_quantity >= 10
            and self.is_active
        )

    @property
    def active_automatic_discount(self):
        from catalog.services import get_best_automatic_discount_for_product

        return get_best_automatic_discount_for_product(self)

    @property
    def effective_price(self) -> Decimal:
        discount = self.active_automatic_discount
        if discount is None:
            return self.price
        return discount.price_for(self.price)

    @property
    def effective_discount_percentage(self) -> int:
        discount = self.active_automatic_discount
        if discount is not None:
            return discount.percent_off_for(self.price)
        return self.discount_percentage or 0

    def has_tag(self, tag: str) -> bool:
        return tag in (self.tags or [])

    def recompute_rating_aggregates(self, *, save: bool = True) -> None:
        from account.models import Review as AccountReview

        agg = AccountReview.objects.filter(
            product_id=self.id,
            status=AccountReview.Status.PUBLISHED,
        ).aggregate(
            avg=Avg("rating"),
            count=Count("id"),
        )
        self.rating_avg = round(agg["avg"] or 0, 2)
        self.review_count = agg["count"] or 0
        if save:
            self.save(update_fields=["rating_avg", "review_count", "updated_at"])

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images"
    )
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


class DiscountType(models.TextChoices):
    PERCENTAGE = "Percentage", "Percentage"
    FIXED_AMOUNT = "Fixed Amount", "Fixed Amount"
    FREE_SHIPPING = "Free Shipping", "Free Shipping"
    BUY_X_GET_Y = "Buy X Get Y", "Buy X Get Y"


class PromotionType(models.TextChoices):
    PERCENTAGE_DISCOUNT = "Percentage Discount", "Percentage Discount"
    FIXED_AMOUNT_DISCOUNT = "Fixed Amount Discount", "Fixed Amount Discount"
    SALE_PRICE = "Sale Price", "Sale Price"
    CAMPAIGN = "Campaign", "Campaign"
    FREE_SHIPPING = "Free Shipping", "Free Shipping"
    FLASH_SALE = "Flash Sale", "Flash Sale"
    BOGO = "BOGO", "BOGO"
    BUNDLE_DISCOUNT = "Bundle Discount", "Bundle Discount"
    TIERED_DISCOUNT = "Tiered Discount", "Tiered Discount"


class AppliesTo(models.TextChoices):
    ALL_PRODUCTS = "All Products", "All Products"
    SPECIFIC_PRODUCTS = "Specific Products", "Specific Products"
    SPECIFIC_CATEGORIES = "Specific Categories", "Specific Categories"


class DiscountSource(models.TextChoices):
    CAMPAIGN = "campaign", "Campaign"
    CLEARANCE = "clearance", "Clearance"
    MANUAL = "manual", "Manual"
    AUTO_SLOW_MOVING = "auto_slow_moving", "Auto (slow moving)"


class DiscountQuerySet(models.QuerySet):
    def visible_on_deals_page(self):
        return self.filter(display_on_deals_page=True)

    def active(self, at=None):
        at = at or timezone.now()
        return self.filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=at),
            start_date__lte=at,
        )

    def automatic(self):
        return self.filter(is_automatic=True)

    def clearance(self):
        return self.filter(source=DiscountSource.CLEARANCE)

    def with_links(self):
        return self.prefetch_related("linked_products", "linked_categories")


class Discount(models.Model):
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)

    type = models.CharField(max_length=32, choices=DiscountType.choices)
    value = models.CharField(max_length=32)
    min_order = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_cap = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    usage_limit = models.PositiveIntegerField(default=0)
    per_customer = models.PositiveIntegerField(default=1)
    usage_count = models.PositiveIntegerField(default=0)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)

    applies_to = models.CharField(max_length=32, choices=AppliesTo.choices)
    eligibility = models.CharField(max_length=120, blank=True)
    target_audience = models.CharField(max_length=120, blank=True)

    source = models.CharField(
        max_length=32,
        choices=DiscountSource.choices,
        default=DiscountSource.MANUAL,
        db_index=True,
    )
    is_automatic = models.BooleanField(default=False, db_index=True)
    is_clearance = models.BooleanField(default=False)
    expires_when_sold_out = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_discounts",
    )

    is_most_deal = models.BooleanField(default=False)
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

    channels = models.JSONField(default=list, blank=True)
    tiktok_video = models.CharField(max_length=2_000_000, blank=True)

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

    @property
    def status(self) -> str:
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
        m = re.search(r"[\d.]+", self.value or "")
        return float(m.group()) if m else 0.0

    def price_for(self, original_price: Decimal) -> Decimal:
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
        if self.applies_to == AppliesTo.ALL_PRODUCTS:
            return True
        if self.applies_to == AppliesTo.SPECIFIC_PRODUCTS:
            return self.linked_products.filter(pk=product.pk).exists()
        if self.applies_to == AppliesTo.SPECIFIC_CATEGORIES:
            return self.linked_categories.filter(pk=product.category_id).exists()
        return False

    def __str__(self):
        return f"{self.code} — {self.deal_title or self.description[:40]}"