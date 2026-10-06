from django.contrib import admin

from .models import (
    SocialAccount,
    SocialFollowerSnapshot,
    SocialMedia,
    SocialPost,
    SocialPostTarget,
)


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ("platform", "handle", "display_name", "is_connected", "updated_at")
    list_filter = ("platform", "is_connected")
    search_fields = ("handle", "display_name", "platform_user_id")
    readonly_fields = ("created_at", "updated_at", "connected_at")


class SocialPostTargetInline(admin.TabularInline):
    model = SocialPostTarget
    extra = 0
    readonly_fields = ("published_at", "metrics_synced_at")


class SocialMediaInline(admin.TabularInline):
    model = SocialMedia
    extra = 0


@admin.register(SocialPost)
class SocialPostAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "caption_short", "scheduled_for", "published_at", "created_at")
    list_filter = ("status",)
    search_fields = ("caption", "product_tag")
    inlines = [SocialPostTargetInline, SocialMediaInline]

    @admin.display(description="Caption")
    def caption_short(self, obj):
        return (obj.caption[:60] + "…") if len(obj.caption) > 60 else obj.caption


@admin.register(SocialFollowerSnapshot)
class SocialFollowerSnapshotAdmin(admin.ModelAdmin):
    list_display = ("account", "date", "followers")
    list_filter = ("account__platform",)
    date_hierarchy = "date"