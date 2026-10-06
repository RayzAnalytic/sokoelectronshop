from django.contrib import admin

from .models import Banner


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'placement', 'order', 'status', 'updated_at',
    )
    list_filter = ('placement', 'status')
    search_fields = ('name', 'headline', 'badge')
    list_editable = ('order', 'status')
    ordering = ('placement', 'order')
    readonly_fields = (
        'impressions', 'clicks', 'conversions',
        'created_at', 'updated_at',
    )
    fieldsets = (
        ('Identity', {
            'fields': ('name', 'placement', 'order', 'status'),
        }),
        ('Content', {
            'fields': ('badge', 'headline', 'description'),
        }),
        ('Media', {
            'fields': ('desktop_image', 'tablet_image', 'mobile_image'),
        }),
        ('CTA', {
            'fields': (
                'primary_cta_text', 'primary_cta_href',
                'secondary_cta_text', 'secondary_cta_href',
            ),
        }),
        ('Design', {
            'fields': ('text_alignment', 'overlay_style', 'overlay_opacity'),
        }),
        ('Schedule', {
            'fields': ('start_at', 'end_at'),
        }),
        ('Metrics (read-only)', {
            'fields': ('impressions', 'clicks', 'conversions',
                       'created_at', 'updated_at'),
        }),
    )