from django.contrib import admin, messages

from .models import Coupon, MpesaCallbackLog, Order, OrderItem, Payment


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = (
        "product_id", "name", "brand",
        "unit_price", "quantity", "image_url",
    )
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "user", "total", "payment_status",
        "status", "delivery_method", "created_at",
    )
    list_filter = ("status", "payment_status", "delivery_method", "created_at")
    search_fields = ("reference", "user__email", "coupon_code")
    readonly_fields = (
        "reference", "snapshot", "client_total",
        "subtotal", "discount", "shipping", "tax", "total",
        "created_at", "updated_at",
    )
    inlines = [OrderItemInline]
    date_hierarchy = "created_at"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "short_id", "order", "status", "amount",
        "phone_number", "mpesa_receipt_number", "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "order__reference", "phone_number",
        "mpesa_receipt_number", "checkout_request_id",
    )
    readonly_fields = (
        "id", "order", "amount", "phone_number", "idempotency_key",
        "merchant_request_id", "checkout_request_id",
        "mpesa_receipt_number", "result_code", "result_description",
        "created_at", "updated_at",
    )
    actions = ["force_success"]

    @admin.display(description="ID")
    def short_id(self, obj):
        return str(obj.id)[:8]

    @admin.action(description="Force payment to SUCCESS (manual override)")
    def force_success(self, request, queryset):
        for payment in queryset:
            if payment.status == Payment.Status.SUCCESS:
                continue
            payment.status = Payment.Status.SUCCESS
            payment.result_description = (
                payment.result_description + " | MANUAL OVERRIDE"
            )
            payment.save()
            Order.objects.filter(pk=payment.order_id).update(
                payment_status=Order.PaymentStatus.PAID,
                status=Order.Status.CONFIRMED,
            )
        messages.success(request, "Forced selected payments to SUCCESS.")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code", "percent_off", "active",
        "used_count", "max_uses", "valid_to",
    )
    list_filter = ("active",)
    search_fields = ("code",)
    readonly_fields = ("used_count",)


@admin.register(MpesaCallbackLog)
class MpesaCallbackLogAdmin(admin.ModelAdmin):
    list_display = (
        "checkout_request_id", "processed", "created_at",
    )
    list_filter = ("processed", "created_at")
    search_fields = ("checkout_request_id",)
    readonly_fields = ("body", "checkout_request_id", "processed", "created_at")