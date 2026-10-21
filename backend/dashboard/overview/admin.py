from django.contrib import admin

from .models import OverviewCache


@admin.register(OverviewCache)
class OverviewCacheAdmin(admin.ModelAdmin):
    list_display = ("range_key", "updated_at")
    list_filter = ("updated_at",)
    search_fields = ("range_key",)
    ordering = ("-updated_at",)
    readonly_fields = ("updated_at",)
    actions = ("clear_selected", "clear_all")

    @admin.action(description="Clear selected cache rows")
    def clear_selected(self, request, queryset):
        deleted, _ = queryset.delete()
        self.message_user(request, f"Cleared {deleted} cache row(s).")

    @admin.action(description="Clear all cache rows")
    def clear_all(self, request, queryset):
        deleted, _ = OverviewCache.objects.all().delete()
        self.message_user(request, f"Cleared all cache ({deleted} row(s)).")