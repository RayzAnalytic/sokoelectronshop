from django.contrib import admin

from .models import Poster


@admin.register(Poster)
class PosterAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "headline",
        "placement",
        "order",
        "is_published",
        "start_at",
        "end_at",
        "impression_count",
        "click_count",
    ]
    list_filter = ["placement", "is_published"]
    search_fields = ["headline", "brand_name", "subheadline"]
    ordering = ["placement", "order"]