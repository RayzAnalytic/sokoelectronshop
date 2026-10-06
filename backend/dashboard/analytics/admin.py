from django.contrib import admin

from .models import AnalyticsCache, PageView


@admin.register(AnalyticsCache)
class AnalyticsCacheAdmin(admin.ModelAdmin):
    list_display = ("tab", "range_key", "updated_at")
    list_filter = ("tab",)
    search_fields = ("range_key",)
    readonly_fields = ("updated_at",)


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ("created_at", "path", "device_type", "user", "session_key")
    list_filter = ("device_type", "created_at")
    search_fields = ("path", "user_agent", "session_key")
    date_hierarchy = "created_at"
    readonly_fields = (
        "path",
        "device_type",
        "user_agent",
        "user",
        "session_key",
        "referrer",
        "created_at",
    )

    def has_add_permission(self, request):
        # Rows are only written by middleware.
        return False

    def has_change_permission(self, request, obj=None):
        # Read-only — nobody should edit a view log.
        return False