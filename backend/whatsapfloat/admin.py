from django.contrib import admin
from .models import WhatsAppConfig, WhatsAppQuickAction


@admin.register(WhatsAppConfig)
class WhatsAppConfigAdmin(admin.ModelAdmin):
    list_display = ('shop_name', 'phone_number', 'display_number', 'enabled', 'updated_at')
    list_editable = ('enabled',)
    fieldsets = (
        (None, {
            'fields': ('enabled', 'shop_name'),
        }),
        ('Contact', {
            'fields': ('phone_number', 'display_number', 'hours_label'),
        }),
        ('Messaging', {
            'fields': ('default_message',),
        }),
    )

    def has_add_permission(self, request):
        # Singleton: only allow adding if no row exists yet.
        return not WhatsAppConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WhatsAppQuickAction)
class WhatsAppQuickActionAdmin(admin.ModelAdmin):
    list_display = ('order', 'label', 'icon', 'is_active')
    list_editable = ('order', 'is_active', 'icon')
    list_display_links = ('label',)
    ordering = ('order', 'id')