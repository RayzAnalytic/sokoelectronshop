from django.contrib import admin

from .models import OverviewCache


@admin.register(OverviewCache)
class OverviewCacheAdmin(admin.ModelAdmin):
    list_display = ("range_key", "updated_at")
    search_fields = ("range_key",)
    readonly_fields = ("updated_at",)