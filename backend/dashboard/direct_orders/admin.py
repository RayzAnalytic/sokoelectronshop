"""
Django admin registration. Optional — the DRF endpoints are the real
admin surface. This exists so you can inspect/edit rows from the
Django admin during development.
"""
from django.contrib import admin

from .models import Creator, CreatorSale, ContentPost, DirectProduct, LiveSession


@admin.register(DirectProduct)
class DirectProductAdmin(admin.ModelAdmin):
    list_display = ("product", "status", "viral", "low_stock_threshold", "updated_at")
    list_filter = ("status", "viral")
    search_fields = ("product__name", "product__sku")


@admin.register(Creator)
class CreatorAdmin(admin.ModelAdmin):
    # CHANGED: added `platform` so it's visible at a glance.
    list_display = ("name", "handle", "platform", "status", "commission_rate", "followers")
    list_filter = ("status", "platform")
    search_fields = ("name", "handle")
    # NEW: avatar_url is a URLField — exclude from the form for cleanliness
    # (it's set via the API, not typed by hand). Add it back if you want it editable.
    exclude = ("avatar_url",)


@admin.register(CreatorSale)
class CreatorSaleAdmin(admin.ModelAdmin):
    list_display = ("creator", "order", "commission_amount", "paid", "attributed_at")
    list_filter = ("paid",)
    search_fields = ("creator__handle", "order__reference")


@admin.register(ContentPost)
class ContentPostAdmin(admin.ModelAdmin):
    # CHANGED: `scheduled_date` → `scheduled_at` (renamed in the model).
    # CHANGED: added `platform` to the list for visibility.
    list_display = ("title", "content_type", "status", "platform", "scheduled_at", "views")
    list_filter = ("content_type", "status", "platform")
    search_fields = ("title", "hashtags")
    # NEW: video_url and thumbnail_url are set via the API — leave them out
    # of the manual add/edit form. Comment this out if you want to edit URLs by hand.
    exclude = ("video_url", "thumbnail_url")


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    # NEW: added `host_name` so the operator can see who is hosting.
    list_display = ("title", "host_name", "status", "scheduled_start", "peak_viewers", "revenue")
    list_filter = ("status",)
    search_fields = ("title", "host_name")