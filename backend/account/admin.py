from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import Address, Notification, Review, WishlistItem
from .services import notify, notify_review_moderated


# ═══════════════════════════════════════════════════════════════════════════
# Address
# ═══════════════════════════════════════════════════════════════════════════
@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = (
        "user", "label", "town", "county",
        "is_default", "updated_at",
    )
    list_filter = ("is_default", "county", "label")
    search_fields = ("user__email", "full_name", "phone", "town", "street")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("user",)
    ordering = ("-is_default", "-updated_at")

    fieldsets = (
        (None, {
            "fields": ("user", "label", "is_default"),
        }),
        ("Recipient", {
            "fields": ("full_name", "phone"),
        }),
        ("Location", {
            "fields": ("street", "town", "county", "postal_code"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ═══════════════════════════════════════════════════════════════════════════
# Notification
# ═══════════════════════════════════════════════════════════════════════════
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "user", "type", "title", "is_read",
        "created_at", "read_at",
    )
    list_filter = ("type", "is_read", "created_at")
    search_fields = ("user__email", "title", "body")
    readonly_fields = ("created_at", "read_at")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    actions = ["mark_as_read", "mark_as_unread", "send_test_notification"]

    fieldsets = (
        (None, {
            "fields": ("user", "type", "title"),
        }),
        ("Content", {
            "fields": ("body", "href", "metadata"),
        }),
        ("State", {
            "fields": ("is_read", "read_at", "created_at"),
        }),
    )

    @admin.action(description="Mark selected as read")
    def mark_as_read(self, request, queryset):
        updated = queryset.filter(is_read=False).update(
            is_read=True, read_at=timezone.now(),
        )
        self.message_user(request, f"{updated} notification(s) marked read.")

    @admin.action(description="Mark selected as unread")
    def mark_as_unread(self, request, queryset):
        updated = queryset.filter(is_read=True).update(
            is_read=False, read_at=None,
        )
        self.message_user(request, f"{updated} notification(s) marked unread.")

    @admin.action(description="Send a test notification to selected users")
    def send_test_notification(self, request, queryset):
        users = {n.user for n in queryset if n.user_id}
        for user in users:
            notify(
                user,
                type=Notification.Type.SYSTEM,
                title="Test notification",
                body="Fired from Django admin.",
                href="/pages/account/notifications",
                metadata={"source": "admin_test"},
            )
        self.message_user(request, f"Sent to {len(users)} user(s).")


# ═══════════════════════════════════════════════════════════════════════════
# Review
# ═══════════════════════════════════════════════════════════════════════════
@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        "user", "product_name", "rating_stars",
        "status", "is_verified_purchase", "created_at",
    )
    list_filter = (
        "status", "rating", "is_verified_purchase", "created_at",
    )
    search_fields = (
        "user__email", "product_name", "product_id", "body", "title",
    )
    readonly_fields = (
        "created_at", "updated_at", "moderated_at",
        "is_verified_purchase", "order",
    )
    list_select_related = ("user", "order")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    actions = ["publish_reviews", "reject_reviews", "reset_to_pending"]

    fieldsets = (
        (None, {
            "fields": ("user", "order", "is_verified_purchase", "status"),
        }),
        ("Product snapshot", {
            "fields": (
                "product_id", "product_name", "product_slug",
                "product_brand", "variant_label",
            ),
        }),
        ("Review", {
            "fields": ("rating", "title", "body", "images"),
        }),
        ("Moderation", {
            "fields": ("rejection_reason", "moderated_at"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Rating")
    def rating_stars(self, obj):
        filled = "★" * obj.rating
        empty = "☆" * (5 - obj.rating)
        return format_html(
            '<span style="color:#f59e0b;letter-spacing:1px;">{}{}</span>',
            filled, empty,
        )

    # ── Actions ──────────────────────────────────────────────────────────
    @admin.action(description="Publish selected reviews")
    def publish_reviews(self, request, queryset):
        count = 0
        skipped = 0
        for review in queryset.exclude(status=Review.Status.PUBLISHED):
            review.status = Review.Status.PUBLISHED
            review.rejection_reason = ""
            review.moderated_at = timezone.now()
            review.save(update_fields=[
                "status", "rejection_reason", "moderated_at", "updated_at",
            ])
            if review.user_id:
                notify_review_moderated(review.user, review)
            else:
                skipped += 1
            count += 1
        msg = f"{count} review(s) published."
        if skipped:
            msg += f" ({skipped} guest review(s) had no user to notify.)"
        self.message_user(request, msg)

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        count = 0
        skipped = 0
        for review in queryset.exclude(status=Review.Status.REJECTED):
            review.status = Review.Status.REJECTED
            review.moderated_at = timezone.now()
            review.save(update_fields=[
                "status", "moderated_at", "updated_at",
            ])
            if review.user_id:
                notify_review_moderated(review.user, review)
            else:
                skipped += 1
            count += 1
        msg = f"{count} review(s) rejected."
        if skipped:
            msg += f" ({skipped} guest review(s) had no user to notify.)"
        self.message_user(request, msg)

    @admin.action(description="Reset to pending")
    def reset_to_pending(self, request, queryset):
        count = queryset.update(
            status=Review.Status.PENDING,
            rejection_reason="",
            moderated_at=None,
        )
        self.message_user(request, f"{count} review(s) reset to pending.")


# ═══════════════════════════════════════════════════════════════════════════
# Wishlist
# ═══════════════════════════════════════════════════════════════════════════
@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = (
        "user", "product_name", "variant_name",
        "unit_price", "stock_display", "added_at",
    )
    list_filter = ("stock", "added_at", "product_brand")
    search_fields = (
        "user__email", "product_name", "product_id",
        "variant_id", "variant_name", "product_brand",
    )
    readonly_fields = (
        "added_at",
        "stock", "stock_count", "discount_percent",
        "rating", "review_count",
    )
    list_select_related = ("user",)
    date_hierarchy = "added_at"
    ordering = ("-added_at",)
    actions = ["clear_selected"]

    fieldsets = (
        (None, {
            "fields": ("user", "added_at"),
        }),
        ("Product", {
            "fields": (
                "product_id", "product_name", "product_slug",
                "product_brand", "product_image",
            ),
        }),
        ("Variant", {
            "fields": ("variant_id", "variant_name", "variant_image"),
        }),
        ("Pricing", {
            "fields": ("unit_price", "compare_at_price"),
        }),
        ("Catalog snapshot", {
            "fields": (
                "stock", "stock_count", "discount_percent",
                "rating", "review_count",
            ),
            "classes": ("collapse",),
            "description": (
                "Snapshot captured when the item was added. Refreshed "
                "when the customer re-adds the item — not live."
            ),
        }),
    )

    @admin.display(description="Stock", ordering="stock")
    def stock_display(self, obj):
        colors = {
            WishlistItem.Stock.IN:  "#16a34a",
            WishlistItem.Stock.LOW: "#f59e0b",
            WishlistItem.Stock.OUT: "#dc2626",
        }
        return format_html(
            '<span style="color:{};font-weight:600;">{}</span>',
            colors.get(obj.stock, "#64748b"),
            obj.stock,
        )

    @admin.action(description="Remove selected items from wishlists")
    def clear_selected(self, request, queryset):
        count, _ = queryset.delete()
        self.message_user(request, f"{count} wishlist item(s) removed.")