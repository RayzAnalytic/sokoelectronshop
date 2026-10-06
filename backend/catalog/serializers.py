from rest_framework import serializers

from account.models import Review as AccountReview

from .models import (
    Category,
    Brand,
    Product,
    ProductImage,
    ProductFeature,
    ProductSpec,
)


# ─────────────────────────────────────────────────────────────────────────────
# Settings helper — safe to call during migrations / cold boot
#
# Every serializer that needs a settings value calls `_settings()`.
# The bundle is cached in-process for 5 minutes and invalidated on
# every write from the Settings page, so the overhead per call is
# negligible. The try/except guard protects management commands and
# test runs that touch serializers before the settings tables exist.
# ─────────────────────────────────────────────────────────────────────────────
def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _safe_currency() -> str:
    s = _settings()
    return s['general'].currency if s else 'KES'


def _safe_weight_unit() -> str:
    s = _settings()
    return s['general'].weight_unit if s else 'kg'


def _allow_backorders() -> bool:
    s = _settings()
    return bool(s['inventory'].allow_backorders) if s else False


def _low_stock_threshold() -> int:
    s = _settings()
    return s['inventory'].low_stock_threshold if s else 5


def _storefront_stock_status(obj) -> str:
    """
    Stock label that respects `allow_backorders`.

    With backorders enabled, a zero-stock product is 'preorder' rather
    than 'out_of_stock' — the frontend renders a "Pre-order" button.
    """
    if obj.stock_quantity <= 0:
        return 'preorder' if _allow_backorders() else 'out_of_stock'
    if obj.stock_quantity <= _low_stock_threshold():
        return 'low_stock'
    return 'in_stock'


# ─────────────────────────────────────────────────────────────────────────────
# Category  — powers Sidebar, category page header, dropdowns, and the admin
# ─────────────────────────────────────────────────────────────────────────────
class CategorySerializer(serializers.ModelSerializer):
    """
    Read shape for the storefront AND the admin.

    Storefront uses: { id, name, slug, href, icon, productCount, itemCount, image }
    Admin additionally consumes: parent_id, displayOrder, seo.
    """
    href = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    productCount = serializers.SerializerMethodField()
    itemCount = serializers.SerializerMethodField()

    icon = serializers.CharField(source="icon_name", read_only=True, allow_blank=True)

    parent_id = serializers.IntegerField(read_only=True, allow_null=True)
    displayOrder = serializers.IntegerField(source="sort_order", read_only=True)
    seo = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id", "name", "slug", "description",
            "parent_id", "displayOrder",
            "href", "icon",
            "productCount", "itemCount",
            "image", "is_active",
            "seo",
        ]

    def get_href(self, obj):
        return f"/pages/categories/{obj.slug}"

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def get_productCount(self, obj):
        return getattr(obj, "product_count", 0)

    def get_itemCount(self, obj):
        count = getattr(obj, "product_count", 0)
        return f"{count} {'item' if count == 1 else 'items'}"

    def get_seo(self, obj):
        return {
            "metaTitle": obj.meta_title or "",
            "metaDescription": obj.meta_description or "",
            "metaKeywords": obj.meta_keywords or "",
            "canonicalUrl": obj.canonical_url or "",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Brand  — powers the storefront brand dropdown AND the admin brands page
# ─────────────────────────────────────────────────────────────────────────────
class BrandSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    websiteUrl = serializers.CharField(
        source="website_url", allow_blank=True, read_only=True,
    )
    productsCount = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            "id", "name", "slug", "logo", "is_active",
            "description", "websiteUrl", "featured",
            "productsCount", "seo",
            "created_at", "updated_at",
        ]

    def get_logo(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        url = obj.logo.url
        return request.build_absolute_uri(url) if request else url

    def get_productsCount(self, obj):
        return getattr(obj, "product_count", 0)

    def get_seo(self, obj):
        return {
            "metaTitle": obj.meta_title or "",
            "metaDescription": obj.meta_description or "",
            "metaKeywords": obj.meta_keywords or "",
            "canonicalUrl": obj.canonical_url or "",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Product images
# ─────────────────────────────────────────────────────────────────────────────
class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "url", "alt_text", "sort_order", "is_primary"]

    def get_url(self, obj):
        if obj.external_url:
            return obj.external_url
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


# ─────────────────────────────────────────────────────────────────────────────
# Reviews — read-only, sourced from account.Review
# ─────────────────────────────────────────────────────────────────────────────
class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="display_author", read_only=True)
    verified = serializers.BooleanField(
        source="is_verified_purchase", read_only=True,
    )
    date = serializers.SerializerMethodField()

    class Meta:
        model = AccountReview
        fields = ["id", "author", "rating", "title", "body", "date", "verified"]
        read_only_fields = fields

    def get_date(self, obj):
        return obj.created_at.date().isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Product image helper — shared by every product serializer
# ─────────────────────────────────────────────────────────────────────────────
def _absolute_image_urls(obj, request):
    urls = []
    for img in obj.images.all():
        if img.external_url:
            urls.append(img.external_url)
            continue
        if not img.image:
            continue
        url = img.image.url
        if request:
            url = request.build_absolute_uri(url)
        urls.append(url)
    return urls


# ─────────────────────────────────────────────────────────────────────────────
# Pricing mixin — every product serializer that ships `price` should use this
# ─────────────────────────────────────────────────────────────────────────────
class _EffectivePricingMixin:
    def get_effective_price(self, obj):
        return str(obj.effective_price)

    def get_original_price(self, obj):
        return str(obj.price)

    def get_effective_discount_percentage(self, obj):
        return obj.effective_discount_percentage


# ─────────────────────────────────────────────────────────────────────────────
# Storefront-shared mixin — currency + stock + low_stock via settings
#
# Every product serializer that emits `stock`, `stockStatus`, or `price`
# should inherit this so the shop's current settings are the single
# source of truth for what the customer sees. Priority: Settings →
# Store and Settings → General.
# ─────────────────────────────────────────────────────────────────────────────
class _StorefrontContextMixin:
    """
    Adds:
      * `currency`      — the shop's ISO currency code
      * `stockLabel`    — 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder'
      * `lowStock`      — boolean, true when 0 < qty <= threshold
    """

    def get_currency(self, obj):
        return _safe_currency()

    def get_stockLabel(self, obj):
        return _storefront_stock_status(obj)

    def get_lowStock(self, obj):
        qty = obj.stock_quantity
        return 0 < qty <= _low_stock_threshold()


# ─────────────────────────────────────────────────────────────────────────────
# Products — list + detail (ProductsPage)
# ─────────────────────────────────────────────────────────────────────────────
class ProductListSerializer(
    _StorefrontContextMixin,
    _EffectivePricingMixin,
    serializers.ModelSerializer,
):
    brand = serializers.CharField(source="brand.name", read_only=True)
    category = serializers.CharField(source="category.name", read_only=True)

    images = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    stockQuantity = serializers.IntegerField(source="stock_quantity", read_only=True)

    currency = serializers.SerializerMethodField()
    stockLabel = serializers.SerializerMethodField()
    lowStock = serializers.SerializerMethodField()

    price = serializers.SerializerMethodField()
    originalPrice = serializers.SerializerMethodField()

    compareAtPrice = serializers.DecimalField(
        source="compare_at_price",
        max_digits=12, decimal_places=2,
        allow_null=True, read_only=True,
    )
    rating = serializers.DecimalField(
        source="rating_avg", max_digits=3, decimal_places=2, read_only=True,
    )
    reviewCount = serializers.IntegerField(source="review_count", read_only=True)

    bestSeller = serializers.BooleanField(source="best_seller", read_only=True)
    salesVolume = serializers.CharField(source="sales_volume", read_only=True, allow_blank=True)

    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    promoEndDate = serializers.DateTimeField(
        source="promo_end_date", allow_null=True, read_only=True,
    )

    discountPercentage = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "brand", "category",
            "images", "price", "originalPrice", "compareAtPrice",
            "stock", "stockQuantity", "stockLabel", "lowStock",
            "currency",
            "rating", "reviewCount",
            "featured", "bestSeller", "salesVolume",
            "createdAt", "promoEndDate", "discountPercentage",
            "description",
        ]

    def get_images(self, obj):
        return _absolute_image_urls(obj, self.context.get("request"))

    def get_stock(self, obj):
        """
        Legacy `stock` string. Kept for backward compat — new consumers
        should read `stockLabel` and `lowStock` instead.
        """
        return _storefront_stock_status(obj)

    def get_price(self, obj):
        return str(obj.effective_price)

    def get_originalPrice(self, obj):
        return str(obj.price)

    def get_discountPercentage(self, obj):
        pct = obj.effective_discount_percentage
        return pct if pct else None


class ProductDetailSerializer(ProductListSerializer):
    """
    Modal payload — adds features[], specs{}, relatedProducts[].

    `weightUnit` is included so the frontend can render weights in the
    shop's chosen unit without a second request. `weight` itself is a
    spec key the backend already stores in kg — the frontend does the
    conversion for display.
    """
    features = serializers.SerializerMethodField()
    specs = serializers.SerializerMethodField()
    relatedProducts = serializers.SerializerMethodField()

    weightUnit = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "features", "specs", "relatedProducts", "weightUnit",
        ]

    def get_features(self, obj):
        return [f.text for f in obj.features.all()]

    def get_specs(self, obj):
        return {s.key: s.value for s in obj.specs.all()}

    def get_relatedProducts(self, obj):
        related = self.context.get("related_products")
        if not related:
            return []
        return ProductListSerializer(
            related, many=True, context=self.context,
        ).data

    def get_weightUnit(self, obj):
        return _safe_weight_unit()


class ProductWriteSerializer(serializers.ModelSerializer):
    """Admin / seed / API POST."""
    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "brand", "category", "description",
            "price", "compare_at_price", "stock_quantity",
            "low_stock_threshold", "featured", "best_seller",
            "sales_volume", "sales_count",
            "promo_end_date", "is_active",
        ]
        read_only_fields = ["id", "slug"]


# ─────────────────────────────────────────────────────────────────────────────
# Best selling page
# ─────────────────────────────────────────────────────────────────────────────
class BestSellerProductSerializer(
    _StorefrontContextMixin,
    _EffectivePricingMixin,
    serializers.ModelSerializer,
):
    bestSeller = serializers.BooleanField(source="best_seller", read_only=True)
    brand = serializers.CharField(source="brand.name", read_only=True)
    category = serializers.CharField(source="category.name", read_only=True)

    price = serializers.SerializerMethodField()
    previousPrice = serializers.SerializerMethodField()

    rating = serializers.DecimalField(
        source="rating_avg", max_digits=3, decimal_places=2, read_only=True,
    )
    reviewCount = serializers.IntegerField(source="review_count", read_only=True)

    # SerializerMethodField so we can honor `allow_backorders`
    stockStatus = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    stockLabel = serializers.SerializerMethodField()
    lowStock = serializers.SerializerMethodField()

    images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "bestSeller", "brand", "name", "description",
            "price", "previousPrice", "rating", "reviewCount",
            "stockStatus", "stockLabel", "lowStock", "currency",
            "images", "category",
        ]

    def get_images(self, obj):
        return _absolute_image_urls(obj, self.context.get("request"))

    def get_stockStatus(self, obj):
        return _storefront_stock_status(obj)

    def get_price(self, obj):
        return str(obj.effective_price)

    def get_previousPrice(self, obj):
        if obj.effective_price < obj.price:
            return str(obj.price)
        if obj.compare_at_price and obj.compare_at_price > obj.price:
            return str(obj.compare_at_price)
        return None


class RelatedProductSerializer(_EffectivePricingMixin, serializers.ModelSerializer):
    """'You may also like' rail on the best selling modal."""
    brand = serializers.CharField(source="brand.name", read_only=True)
    images = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "name", "brand", "price", "currency", "images"]

    def get_images(self, obj):
        return _absolute_image_urls(obj, self.context.get("request"))

    def get_price(self, obj):
        return str(obj.effective_price)

    def get_currency(self, obj):
        return _safe_currency()


# ─────────────────────────────────────────────────────────────────────────────
# New arrivals page
# ─────────────────────────────────────────────────────────────────────────────
class NewArrivalProductSerializer(
    _StorefrontContextMixin,
    _EffectivePricingMixin,
    serializers.ModelSerializer,
):
    brand = serializers.CharField(source="brand.name", read_only=True)
    category = serializers.CharField(source="category.name", read_only=True)

    price = serializers.SerializerMethodField()
    compareAtPrice = serializers.SerializerMethodField()

    stockStatus = serializers.SerializerMethodField()
    stockQuantity = serializers.IntegerField(source="stock_quantity", read_only=True)

    currency = serializers.SerializerMethodField()
    stockLabel = serializers.SerializerMethodField()
    lowStock = serializers.SerializerMethodField()

    rating = serializers.DecimalField(
        source="rating_avg", max_digits=3, decimal_places=2, read_only=True,
    )
    reviewCount = serializers.IntegerField(source="review_count", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "brand", "category",
            "price", "compareAtPrice",
            "stockStatus", "stockQuantity", "stockLabel", "lowStock",
            "currency",
            "images", "description",
            "rating", "reviewCount", "createdAt",
        ]

    def get_images(self, obj):
        return _absolute_image_urls(obj, self.context.get("request"))

    def get_stockStatus(self, obj):
        return _storefront_stock_status(obj)

    def get_price(self, obj):
        return str(obj.effective_price)

    def get_compareAtPrice(self, obj):
        if obj.effective_price < obj.price:
            return str(obj.price)
        if obj.compare_at_price:
            return str(obj.compare_at_price)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Special deals page
# ─────────────────────────────────────────────────────────────────────────────
class DealCardSerializer(serializers.Serializer):
    """
    Shape matches the `DealProduct` interface inside SpecialDealsPage.tsx.
    Cards are built by `catalog.services.build_deal_card()` — this serializer
    documents the schema and validates the service output when serialising.

    `endDate` is nullable because clearance discounts run open-ended until
    the stock is gone. The storefront hides the countdown when it is null.

    `currency` is added so the deals grid can render prices consistently
    with the rest of the storefront even when the user lands here first.
    """
    id = serializers.CharField()
    productId = serializers.CharField()
    discountCode = serializers.CharField()
    name = serializers.CharField()
    brand = serializers.CharField()
    category = serializers.CharField()

    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    originalPrice = serializers.DecimalField(max_digits=12, decimal_places=2)
    discountPct = serializers.IntegerField()

    inStock = serializers.BooleanField()
    stockCount = serializers.IntegerField()

    image = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    features = serializers.ListField(child=serializers.CharField())
    specs = serializers.DictField(child=serializers.CharField())

    startDate = serializers.DateTimeField()
    endDate = serializers.DateTimeField(allow_null=True)
    promotionType = serializers.CharField()

    rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    reviewCount = serializers.IntegerField()

    isClearance = serializers.BooleanField(required=False, default=False)
    source = serializers.CharField(required=False, allow_blank=True, default="")

    # NEW — shop currency code so the deals grid can format consistently
    currency = serializers.SerializerMethodField()

    def get_currency(self, obj):
        return _safe_currency()