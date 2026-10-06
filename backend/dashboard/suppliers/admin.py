from django.contrib import admin

from .models import Purchase, Supplier, SupplierActivity, SupplierProduct


class SupplierProductInline(admin.TabularInline):
    model = SupplierProduct
    extra = 0
    fields = (
        "product_id", "product_name", "product_sku",
        "supplier_sku", "cost_price", "min_order_qty", "lead_time_days",
    )


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("company", "contact_name", "type", "city", "country", "status")
    list_filter = ("status", "type", "country")
    search_fields = ("company", "contact_name", "email", "phone")
    inlines = [SupplierProductInline]


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("number", "supplier", "date", "total_amount", "payment_status", "status")
    list_filter = ("payment_status", "status")
    search_fields = ("number", "supplier__company")


@admin.register(SupplierActivity)
class SupplierActivityAdmin(admin.ModelAdmin):
    list_display = ("supplier", "kind", "description", "user_label", "created_at")
    list_filter = ("kind",)
    search_fields = ("supplier__company", "description")