from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Category,
    Brand,
    Product,
    ProductImage,
    ProductFeature,
    ProductSpec,
    Discount,
)


# ─────────────────────────────────────────────────────────────────────────────
# Category
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name", "slug", "icon_name",
        "product_count", "is_active", "sort_order", "preview",
    )
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "icon_name")
    prepopulated_fields = {"slug": ("name",)}
    list_editable = ("is_active", "sort_order")
    ordering = ("sort_order", "name")

    fieldsets = (
        ("Identity", {
            "fields": ("name", "slug", "description"),
        }),
        ("Hierarchy", {
            "fields": ("parent",),
        }),
        ("Storefront", {
            "fields": ("icon_name", "image", "sort_order", "is_active"),
        }),
        ("SEO", {
            "fields": (
                "meta_title", "meta_description",
                "meta_keywords", "canonical_url",
            ),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("parent",)

    @admin.display(description="Products")
    def product_count(self, obj):
        return obj.products.filter(is_active=True).count()

    @admin.display(description="Image")
    def preview(self, obj):
        if not obj.image:
            return "—"
        return format_html(
            '<img src="{}" style="height:32px;border-radius:4px;" />',
            obj.image.url,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Brand
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = (
        "name", "slug", "is_active", "featured",
        "product_count", "logo_preview",
    )
    list_filter = ("is_active", "featured")
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    list_editable = ("is_active", "featured")
    ordering = ("name",)

    fieldsets = (
        ("Identity", {
            "fields": ("name", "slug", "logo", "description"),
        }),
        ("Storefront", {
            "fields": ("website_url", "featured", "is_active"),
        }),
        ("SEO", {
            "fields": (
                "meta_title", "meta_description",
                "meta_keywords", "canonical_url",
            ),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Products")
    def product_count(self, obj):
        return obj.products.filter(is_active=True).count()

    @admin.display(description="Logo")
    def logo_preview(self, obj):
        if not obj.logo:
            return "—"
        return format_html(
            '<img src="{}" style="height:32px;border-radius:4px;" />',
            obj.logo.url,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Product inlines
# ─────────────────────────────────────────────────────────────────────────────
class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    # `external_url` is listed before `image` because it's the common path
    # for products created through the admin API — the URL field is what
    # gets populated, and admins rarely upload files directly.
    fields = ("external_url", "image", "alt_text", "sort_order", "is_primary")


class ProductFeatureInline(admin.TabularInline):
    model = ProductFeature
    extra = 1
    fields = ("text", "sort_order")


class ProductSpecInline(admin.TabularInline):
    model = ProductSpec
    extra = 1
    fields = ("key", "value", "sort_order")


# ─────────────────────────────────────────────────────────────────────────────
# Product
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id", "name", "brand", "category",
        "price", "compare_at_price",
        "stock_badge",
        "featured", "best_seller",
        "sales_count", "review_count",
        "is_active",
    )
    list_filter = (
        "is_active", "featured", "best_seller",
        "category", "brand",
    )
    search_fields = ("id", "name", "brand__name", "category__name", "slug")
    readonly_fields = (
        "id", "slug",
        "rating_avg", "review_count",
        "created_at", "updated_at",
    )
    inlines = [ProductImageInline, ProductFeatureInline, ProductSpecInline]
    list_select_related = ("brand", "category")
    ordering = ("-created_at",)
    list_per_page = 25

    fieldsets = (
        ("Identity", {
            "fields": ("id", "name", "slug", "brand", "category", "description"),
        }),
        ("Pricing", {
            "fields": ("price", "compare_at_price"),
        }),
        ("Inventory", {
            "fields": ("stock_quantity", "low_stock_threshold"),
        }),
        ("Storefront flags", {
            "fields": ("featured", "best_seller", "is_active"),
        }),
        ("Sales & reviews", {
            "fields": (
                "sales_volume", "sales_count",
                "rating_avg", "review_count",
            ),
        }),
        ("Promo", {
            "fields": ("promo_end_date",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    @admin.display(description="Stock")
    def stock_badge(self, obj):
        colors = {
            "In Stock": "#16a34a",
            "Low Stock": "#d97706",
            "Out of Stock": "#dc2626",
        }
        return format_html(
            '<span style="color:{};font-weight:600;">{} ({})</span>',
            colors.get(obj.stock_status, "#333"),
            obj.stock_status,
            obj.stock_quantity,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Review
#
# The `Review` model was moved to the `account` app (see the note at the
# bottom of `catalog/models.py`). It is registered in
# `account/admin.py` as `account.Review`. Do not register it here.
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Discount
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Discount)
class DiscountAdmin(admin.ModelAdmin):
    list_display = (
        "code", "deal_title", "type", "value",
        "applies_to", "status_badge",
        "start_date", "end_date",
        "priority", "display_on_deals_page",
    )
    list_filter = (
        "type", "applies_to", "display_on_deals_page",
        "promotion_type", "is_most_deal",
    )
    search_fields = ("code", "deal_title", "description", "badge_text")
    filter_horizontal = ("linked_products", "linked_categories")
    readonly_fields = ("usage_count", "created_at", "updated_at")
    ordering = ("-priority", "-created_at")
    date_hierarchy = "start_date"

    fieldsets = (
        ("Identity", {
            "fields": ("code", "description", "deal_title", "badge_text", "image"),
        }),
        ("Mechanics", {
            "fields": ("type", "value", "min_order", "max_cap", "promotion_type"),
        }),
        ("Limits", {
            "fields": ("usage_limit", "per_customer", "usage_count"),
        }),
        ("Window", {
            "fields": ("start_date", "end_date"),
        }),
        ("Targeting", {
            "fields": (
                "applies_to", "linked_products", "linked_categories",
                "eligibility", "target_audience",
            ),
        }),
        ("Storefront", {
            "fields": ("display_on_deals_page", "is_most_deal", "priority"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    @admin.display(description="Status")
    def status_badge(self, obj):
        colors = {
            "Active": "#16a34a",
            "Scheduled": "#d97706",
            "Expired": "#dc2626",
        }
        s = obj.status
        return format_html(
            '<span style="color:{};font-weight:600;">{}</span>',
            colors.get(s, "#333"), s,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Admin site branding
# ─────────────────────────────────────────────────────────────────────────────
admin.site.site_header = "Myshop Administration"
admin.site.site_title = "Myshop Admin"
admin.site.index_title = "Catalog, Checkout & Accounts"