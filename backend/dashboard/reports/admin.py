from django.contrib import admin

from .models import ReportCache, ReportExportLog


@admin.register(ReportCache)
class ReportCacheAdmin(admin.ModelAdmin):
    list_display = ("tab", "range_key", "updated_at")
    list_filter = ("tab",)
    search_fields = ("range_key",)
    readonly_fields = ("updated_at",)


@admin.register(ReportExportLog)
class ReportExportLogAdmin(admin.ModelAdmin):
    list_display = ("tab", "range_key", "fmt", "user", "created_at")
    list_filter = ("tab", "fmt")
    search_fields = ("range_key", "user__username")
    date_hierarchy = "created_at"
    readonly_fields = ("tab", "range_key", "fmt", "user", "created_at")