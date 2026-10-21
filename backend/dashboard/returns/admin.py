from django.contrib import admin

from .models import (
    Refund,
    ReturnItem,
    ReturnReason,
    ReturnRequest,
    ReturnSettings,
)


class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0
    fields = (
        'product_name', 'sku', 'qty', 'price', 'condition', 'image',
    )


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'order', 'customer_name', 'status',
        'refund_status', 'refund_amount', 'requested_at',
    )
    list_filter = ('status', 'refund_status', 'refund_method')
    search_fields = (
        'code', 'order__reference', 'customer_email', 'customer_name',
    )
    readonly_fields = ('code', 'created_at', 'updated_at')
    inlines = [ReturnItemInline]


@admin.register(ReturnReason)
class ReturnReasonAdmin(admin.ModelAdmin):
    list_display = ('label', 'active', 'requires_photo', 'order')
    list_filter = ('active', 'requires_photo')
    list_editable = ('active', 'requires_photo', 'order')


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'return_request', 'amount', 'method',
        'status', 'created_at', 'completed_at',
    )
    list_filter = ('status', 'method')
    search_fields = ('return_request__code', 'reference')


@admin.register(ReturnSettings)
class ReturnSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not ReturnSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False