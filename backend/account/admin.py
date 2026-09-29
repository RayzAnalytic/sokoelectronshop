from django.contrib import admin
from django.utils import timezone

from .models import Address, Notification, Review, WishlistItem


# ─────────────────────────────────────────────────────────────────────────────
# Address
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = (
        "user", "label", "town", "county", "is_default", "updated_at",
    )
    list_filter = ("is_default", "county")
    search_fields = ("user__email", "full_name", "phone", "town", "street")
    readonly_fields = ("created_at", "updated_at")


# ─────────────────────────────────────────────────────────────────────────────
# Notification
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "type", "title", "is_read", "created_at")
    list_filter = ("type", "is_read", "created_at")
    search_fields = ("user__email", "title", "body")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"


# ─────────────────────────────────────────────────────────────────────────────
# Review
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("user", "product_name", "rating", "status", "created_at")
    list_filter = ("status", "rating", "created_at")
    search_fields = ("user__email", "product_name", "product_id", "body")
    readonly_fields = ("created_at", "updated_at", "is_verified_purchase")
    date_hierarchy = "created_at"
    actions = ["publish_reviews", "reject_reviews"]

    @admin.action(description="Publish selected reviews")
    def publish_reviews(self, request, queryset):
        queryset.update(
            status=Review.Status.PUBLISHED,
            rejection_reason="",
            moderated_at=timezone.now(),
        )

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        queryset.update(
            status=Review.Status.REJECTED,
            moderated_at=timezone.now(),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Wishlist
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = (
        "user", "product_name", "variant_name",
        "unit_price", "added_at",
    )
    list_filter = ("added_at",)
    search_fields = (
        "user__email", "product_name", "variant_id", "product_id",
    )
    readonly_fields = ("added_at",)
    date_hierarchy = "added_at"