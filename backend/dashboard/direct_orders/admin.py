"""
Django admin registration. Optional — the DRF endpoints are the real
admin surface. This exists so you can inspect/edit rows from the Django
admin during development.

Design rules applied here:

  * Every model the DRF layer exposes gets a registration. If you can
    create it via the API, you can inspect it here.

  * Derived / rollup fields (`direct_sales_count`, `direct_revenue`)
    are read-only in the admin — editing them by hand would desync
    them from the source-of-truth rows.

  * URLs and file paths that are set programmatically (uploads) are
    excluded from add/edit forms by default; un-exclude them if you
    need to hand-edit.

  * `DirectOrderItem` is an inline under `DirectOrder`, because editing
    a line item outside the context of its order makes no sense.

  * Where an admin save can invalidate a denormalized column
    (`DirectOrder.total`, `DirectProduct.direct_sales_count`), we
    recompute it in `save_related` / `save_model`.
"""
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    ContentPost,
    Creator,
    CreatorSale,
    DirectOrder,
    DirectOrderItem,
    DirectProduct,
    LiveSession,
)


# ═════════════════════════════════════════════════════════════════════
# DirectProduct
# ═════════════════════════════════════════════════════════════════════

@admin.register(DirectProduct)
class DirectProductAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "status",
        "viral",
        "low_stock_threshold",
        "direct_sales_count",
        "direct_revenue",
        "updated_at",
    )
    list_filter = ("status", "viral", "linked_to_website")
    search_fields = ("product__name", "product__sku")
    list_select_related = ("product",)
    readonly_fields = (
        "direct_sales_count",
        "direct_revenue",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (None, {
            "fields": ("product", "status", "viral"),
        }),
        ("Promotion", {
            "fields": ("video_link", "linked_to_website"),
        }),
        ("Stock", {
            "fields": ("low_stock_threshold",),
        }),
        ("Rollups (read-only)", {
            "fields": ("direct_sales_count", "direct_revenue"),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ═════════════════════════════════════════════════════════════════════
# Creator
# ═════════════════════════════════════════════════════════════════════

@admin.register(Creator)
class CreatorAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "handle",
        "platform",
        "status",
        "commission_rate",
        "followers",
        "updated_at",
    )
    list_filter = ("status", "platform")
    search_fields = ("name", "handle", "niche")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {
            "fields": ("name", "handle", "platform", "status"),
        }),
        ("Audience", {
            "fields": ("followers", "niche"),
        }),
        ("Commission", {
            "fields": ("commission_rate", "start_date"),
        }),
        ("Profile", {
            "fields": ("avatar_url", "user"),
        }),
        ("Notes", {
            "fields": ("notes",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ═════════════════════════════════════════════════════════════════════
# CreatorSale
# ═════════════════════════════════════════════════════════════════════

@admin.register(CreatorSale)
class CreatorSaleAdmin(admin.ModelAdmin):
    list_display = (
        "creator",
        "order",
        "commission_rate",
        "commission_amount",
        "paid",
        "attributed_at",
    )
    list_filter = ("paid",)
    search_fields = ("creator__handle", "order__reference", "payout_reference")
    list_select_related = ("creator", "order")
    readonly_fields = ("attributed_at",)
    date_hierarchy = "attributed_at"
    fieldsets = (
        (None, {
            "fields": ("creator", "order"),
        }),
        ("Commission snapshot", {
            "fields": ("commission_rate", "commission_amount"),
        }),
        ("Payout", {
            "fields": ("paid", "paid_at", "payout_reference"),
        }),
        ("Notes", {
            "fields": ("notes",),
        }),
        ("Timestamps", {
            "fields": ("attributed_at",),
            "classes": ("collapse",),
        }),
    )


# ═════════════════════════════════════════════════════════════════════
# DirectOrder + inline items
# ═════════════════════════════════════════════════════════════════════

class DirectOrderItemInline(admin.TabularInline):
    """
    Line items edited inline under their order.

    `subtotal` is computed in the model's save(); we mark it read-only
    so nobody types a value that disagrees with quantity × price.
    """
    model = DirectOrderItem
    extra = 0
    fields = (
        "product", "product_name", "sku", "image",
        "quantity", "price", "subtotal",
    )
    readonly_fields = ("subtotal",)
    autocomplete_fields = ("product",)


@admin.register(DirectOrder)
class DirectOrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "customer_name",
        "source",
        "status",
        "payment_status",
        "total",
        "created_at",
    )
    list_filter = ("status", "source", "payment_status")
    search_fields = (
        "reference",
        "customer_name",
        "customer_phone",
        "customer_email",
    )
    list_select_related = ("creator",)
    readonly_fields = (
        "reference",
        "subtotal",
        "total",
        "created_at",
        "updated_at",
        "delivered_at",
    )
    inlines = (DirectOrderItemInline,)
    date_hierarchy = "created_at"
    fieldsets = (
        ("Reference", {
            "fields": ("reference",),
        }),
        ("Customer", {
            "fields": ("customer_name", "customer_phone", "customer_email"),
        }),
        ("Channel", {
            "fields": ("source",),
        }),
        ("Status", {
            "fields": ("status", "payment_status", "payment_method"),
        }),
        ("Money", {
            "fields": ("subtotal", "shipping", "discount", "total"),
        }),
        ("Creator attribution", {
            "fields": ("creator", "commission"),
        }),
        ("Notes", {
            "fields": ("notes",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at", "delivered_at"),
            "classes": ("collapse",),
        }),
    )

    def save_related(self, request, form, formsets, change):
        """
        After inline items are saved, refresh the order's denormalized
        money totals and every involved product's sales rollup.
        """
        super().save_related(request, form, formsets, change)
        form.instance.recompute_totals()


# ═════════════════════════════════════════════════════════════════════
# ContentPost
# ═════════════════════════════════════════════════════════════════════

@admin.register(ContentPost)
class ContentPostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "content_type",
        "status",
        "platform",
        "scheduled_at",
        "views",
        "likes",
        "comments",
        "updated_at",
    )
    list_filter = ("content_type", "status", "platform")
    search_fields = ("title", "hashtags", "caption")
    readonly_fields = ("created_at", "updated_at", "product_name_display")
    date_hierarchy = "scheduled_at"
    fieldsets = (
        (None, {
            "fields": ("title", "content_type", "status", "platform"),
        }),
        ("Schedule", {
            "fields": ("scheduled_at",),
        }),
        ("Copy", {
            "fields": ("script", "caption", "hashtags"),
        }),
        ("Media", {
            "fields": ("video_url", "thumbnail_url", "posted_url"),
        }),
        ("Products featured", {
            "fields": ("products", "product_name_display"),
        }),
        ("Performance (manual)", {
            "fields": ("views", "likes", "comments"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Product names")
    def product_name_display(self, obj):
        """Read-only echo of the joined products list."""
        if not obj.products:
            return "—"
        return " · ".join(str(p) for p in obj.products)


# ═════════════════════════════════════════════════════════════════════
# LiveSession
# ═════════════════════════════════════════════════════════════════════

@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "host_name",
        "status",
        "scheduled_start",
        "duration_min",
        "peak_viewers",
        "orders_generated",
        "revenue",
    )
    list_filter = ("status",)
    search_fields = ("title", "host_name", "top_product")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "scheduled_start"
    fieldsets = (
        (None, {
            "fields": ("title", "host_name", "status"),
        }),
        ("Schedule", {
            "fields": ("scheduled_start", "duration_min"),
        }),
        ("Products", {
            "fields": ("products", "top_product"),
        }),
        ("Results", {
            "fields": ("peak_viewers", "orders_generated", "revenue"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )