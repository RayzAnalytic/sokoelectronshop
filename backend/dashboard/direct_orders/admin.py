from django.contrib import admin

from .models import (
    AdCampaign,
    AttributionLink,
    AuditLog,
    Automation,
    Campaign,
    ContentPost,
    Coupon,
    Creator,
    CreatorApplication,
    CreatorSale,
    CreatorSample,
    Customer,
    CustomerSegment,
    DeliveryZone,
    DirectOrder,
    DirectOrderItem,
    DirectProduct,
    Expense,
    FollowUp,
    InboxConversation,
    InboxMessage,
    Integration,
    InventoryMovement,
    Lead,
    LiveSession,
    Location,
    Notification,
    NotificationSetting,
    Partnership,
    PayoutBatch,
    PermissionGroup,
    ProductVariant,
    PurchaseOrder,
    PurchaseOrderItem,
    ReturnRequest,
    Review,
    Supplier,
    SupportTicket,
    TeamMember,
)


@admin.register(DirectProduct)
class DirectProductAdmin(admin.ModelAdmin):
    list_display = (
        "product", "status", "viral", "low_stock_threshold",
        "direct_sales_count", "direct_revenue", "updated_at",
    )
    list_filter = ("status", "viral", "linked_to_website")
    search_fields = ("product__name", "product__slug")
    list_select_related = ("product",)
    readonly_fields = (
        "direct_sales_count", "direct_revenue", "created_at", "updated_at",
    )
    fieldsets = (
        (None, {"fields": ("product", "status", "viral")}),
        ("Promotion", {"fields": ("video_link", "linked_to_website")}),
        ("Stock", {"fields": ("low_stock_threshold",)}),
        ("Rollups (read-only)", {
            "fields": ("direct_sales_count", "direct_revenue"),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = (
        "name", "sku", "size", "color",
        "price_delta", "stock_quantity", "image_url", "is_active",
    )


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_person", "phone", "email", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "contact_person", "phone", "email")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "county", "is_default", "is_active")
    list_filter = ("kind", "is_default", "is_active")
    search_fields = ("name", "county")


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0
    fields = ("product", "product_name", "quantity", "unit_cost", "subtotal")
    readonly_fields = ("subtotal",)
    autocomplete_fields = ("product",)


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "supplier", "status", "expected_at",
        "subtotal", "total", "created_at",
    )
    list_filter = ("status",)
    search_fields = ("reference", "supplier__name")
    list_select_related = ("supplier",)
    readonly_fields = ("reference", "subtotal", "total", "received_at",
                       "created_at", "updated_at")
    inlines = (PurchaseOrderItemInline,)
    date_hierarchy = "created_at"

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recompute_totals()


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = (
        "product", "variant", "location", "kind",
        "quantity", "unit_cost", "reference", "created_at",
    )
    list_filter = ("kind",)
    search_fields = ("product__product__name", "reference")
    list_select_related = ("product", "variant", "location")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "name", "phone", "email", "username", "segment",
        "total_orders", "lifetime_spend", "last_order_at",
    )
    list_filter = ("segment", "county", "whatsapp_opt_in")
    search_fields = ("name", "phone", "email", "username")
    readonly_fields = (
        "total_orders", "lifetime_spend", "avg_order_value",
        "last_order_at", "created_at", "updated_at",
    )
    date_hierarchy = "created_at"


class CreatorSaleInline(admin.TabularInline):
    model = CreatorSale
    extra = 0
    fields = (
        "order", "commission_rate", "commission_amount",
        "status", "paid", "paid_at", "payout",
    )
    readonly_fields = ("attributed_at",)
    autocomplete_fields = ("order",)
    fk_name = "creator"


@admin.register(Creator)
class CreatorAdmin(admin.ModelAdmin):
    list_display = (
        "name", "handle", "platform", "status",
        "commission_rate", "followers", "updated_at",
    )
    list_filter = ("status", "platform")
    search_fields = ("name", "handle", "niche")
    readonly_fields = ("created_at", "updated_at")
    inlines = (CreatorSaleInline,)
    fieldsets = (
        (None, {"fields": ("name", "handle", "platform", "status")}),
        ("Audience", {"fields": ("followers", "niche")}),
        ("Commission", {"fields": ("commission_rate", "start_date")}),
        ("Profile", {"fields": (
            "avatar_url", "user", "phone", "email", "tax_pin",
            "payout_method", "payout_phone",
        )}),
        ("Metrics", {"fields": ("engagement_rate", "avg_views")}),
        ("Notes", {"fields": ("notes",)}),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


@admin.register(CreatorSale)
class CreatorSaleAdmin(admin.ModelAdmin):
    list_display = (
        "creator", "order", "commission_rate", "commission_amount",
        "status", "paid", "attributed_at",
    )
    list_filter = ("paid", "status")
    search_fields = ("creator__handle", "order__reference", "payout_reference")
    list_select_related = ("creator", "order")
    readonly_fields = ("attributed_at",)
    date_hierarchy = "attributed_at"


@admin.register(PayoutBatch)
class PayoutBatchAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "creator", "status", "amount", "total_amount",
        "items_count", "payout_method", "paid_at", "created_at",
    )
    list_filter = ("status", "payout_method")
    search_fields = ("reference", "transaction_reference", "creator__name")
    list_select_related = ("creator",)
    readonly_fields = (
        "reference", "total_amount", "items_count",
        "approved_at", "paid_at", "created_at", "updated_at",
    )
    date_hierarchy = "created_at"

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recompute_totals()


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = (
        "name", "slug", "status", "starts_at", "ends_at",
        "budget", "actual_spend", "created_at",
    )
    list_filter = ("status",)
    search_fields = ("name", "slug")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(AttributionLink)
class AttributionLinkAdmin(admin.ModelAdmin):
    list_display = (
        "code", "kind", "label", "creator", "campaign",
        "clicks", "conversions", "revenue", "is_active",
    )
    list_filter = ("kind", "is_active")
    search_fields = ("code", "label", "utm_campaign")
    list_select_related = ("creator", "campaign")
    readonly_fields = ("created_at", "updated_at")


class DirectOrderItemInline(admin.TabularInline):
    model = DirectOrderItem
    extra = 0
    fields = (
        "product", "product_name", "sku", "image",
        "quantity", "price", "subtotal",
    )
    readonly_fields = ("subtotal",)
    autocomplete_fields = ("product",)


@admin.register(DirectOrder)
class DirectOrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "customer_name", "source", "status",
        "payment_status", "total", "created_at",
    )
    list_filter = ("status", "source", "payment_status", "courier")
    search_fields = (
        "reference", "customer_name", "customer_phone", "customer_email",
        "mpesa_reference",
    )
    list_select_related = ("creator", "customer")
    readonly_fields = (
        "reference", "subtotal", "total",
        "created_at", "updated_at", "delivered_at",
    )
    inlines = (DirectOrderItemInline,)
    date_hierarchy = "created_at"
    fieldsets = (
        ("Reference", {"fields": ("reference",)}),
        ("Customer", {"fields": (
            "customer", "customer_name", "customer_phone", "customer_email",
        )}),
        ("Channel", {"fields": ("source",)}),
        ("Status", {"fields": (
            "status", "payment_status", "payment_method",
            "verification_status",
        )}),
        ("Money", {"fields": ("subtotal", "shipping", "discount", "total")}),
        ("Payment refs", {"fields": (
            "payment_reference", "mpesa_reference",
        )}),
        ("Shipping", {"fields": (
            "courier", "tracking_number", "shipping_zone", "priority",
        )}),
        ("Creator attribution", {"fields": (
            "creator", "commission", "campaign", "attribution",
        )}),
        ("Assignment", {"fields": ("assigned_to", "cod_risk", "tags")}),
        ("Notes", {"fields": ("notes",)}),
        ("Timestamps", {
            "fields": ("created_at", "updated_at", "delivered_at"),
            "classes": ("collapse",),
        }),
    )

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recompute_totals()


@admin.register(ContentPost)
class ContentPostAdmin(admin.ModelAdmin):
    list_display = (
        "title", "content_type", "status", "platform",
        "scheduled_at", "views", "likes", "comments", "updated_at",
    )
    list_filter = ("content_type", "status", "platform")
    search_fields = ("title", "hashtags", "caption")
    readonly_fields = ("created_at", "updated_at", "product_name_display")
    date_hierarchy = "scheduled_at"
    fieldsets = (
        (None, {"fields": ("title", "content_type", "status", "platform")}),
        ("Schedule", {"fields": ("scheduled_at",)}),
        ("Copy", {"fields": (
            "hook", "script", "caption", "hashtags", "sound",
        )}),
        ("Media", {"fields": (
            "video_url", "thumbnail_url", "posted_url",
        )}),
        ("Attribution", {"fields": ("creator", "campaign")}),
        ("Products featured", {"fields": ("products", "product_name_display")}),
        ("Performance (manual)", {"fields": (
            "views", "likes", "comments", "shares", "saves",
            "orders_attributed", "revenue_attributed",
        )}),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Product names")
    def product_name_display(self, obj):
        if not obj.products:
            return "—"
        return " · ".join(str(p) for p in obj.products)


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display = (
        "title", "host_name", "status", "scheduled_start",
        "duration_min", "peak_viewers", "orders_generated", "revenue",
    )
    list_filter = ("status",)
    search_fields = ("title", "host_name", "top_product")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "scheduled_start"
    fieldsets = (
        (None, {"fields": ("title", "host_name", "status")}),
        ("Schedule", {"fields": (
            "scheduled_start", "scheduled_end", "duration_min",
        )}),
        ("Hosts", {"fields": ("cohost_name", "creator", "campaign")}),
        ("Products", {"fields": ("products", "top_product", "coupon_code")}),
        ("Results", {"fields": (
            "peak_viewers", "total_viewers",
            "orders_generated", "revenue", "replay_url",
        )}),
        ("Run sheet", {"fields": ("run_sheet",)}),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


class InboxMessageInline(admin.TabularInline):
    model = InboxMessage
    extra = 0
    fields = ("direction", "body", "attachment_url", "sent_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(InboxConversation)
class InboxConversationAdmin(admin.ModelAdmin):
    list_display = (
        "contact_name", "channel", "status", "subject",
        "unread_count", "last_message_at",
    )
    list_filter = ("channel", "status")
    search_fields = ("contact_name", "contact_handle", "subject")
    readonly_fields = ("last_message_at", "created_at", "updated_at")
    inlines = (InboxMessageInline,)
    date_hierarchy = "last_message_at"


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = (
        "name", "email", "role", "status",
        "location", "last_active_at", "joined_at",
    )
    list_filter = ("role", "status")
    search_fields = ("name", "email", "phone")
    readonly_fields = ("invited_at", "joined_at", "created_at", "updated_at")


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "order", "status", "reason",
        "refund_amount", "restock", "created_at",
    )
    list_filter = ("status", "reason", "restock")
    search_fields = ("reference", "order__reference")
    list_select_related = ("order",)
    readonly_fields = (
        "reference", "restocked_at", "resolved_at",
        "created_at", "updated_at",
    )
    date_hierarchy = "created_at"


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "title", "category", "amount", "paid_on",
        "payment_method", "reference", "recorded_by",
    )
    list_filter = ("category", "payment_method")
    search_fields = ("title", "reference")
    readonly_fields = ("recorded_by", "created_at", "updated_at")
    date_hierarchy = "paid_on"


@admin.register(Automation)
class AutomationAdmin(admin.ModelAdmin):
    list_display = (
        "name", "trigger", "action", "status",
        "delay_minutes", "runs_count", "last_run_at",
    )
    list_filter = ("trigger", "action", "status")
    search_fields = ("name", "channel")
    readonly_fields = ("runs_count", "last_run_at", "created_at", "updated_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title", "kind", "recipient", "read_at", "created_at",
    )
    list_filter = ("kind",)
    search_fields = ("title", "body")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"


@admin.register(NotificationSetting)
class NotificationSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "enabled", "updated_at")
    list_filter = ("enabled",)
    search_fields = ("key", "label")
    readonly_fields = ("updated_at",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "action", "entity", "entity_id", "summary",
        "actor", "created_at",
    )
    list_filter = ("action", "entity")
    search_fields = ("summary", "entity_id")
    readonly_fields = (
        "action", "entity", "entity_id", "summary", "diff",
        "actor", "ip_address", "user_agent", "created_at",
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        "rating", "title", "product", "customer",
        "status", "is_ugc", "created_at",
    )
    list_filter = ("status", "rating", "is_ugc")
    search_fields = ("title", "body")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = (
        "name", "zone", "base_fee", "free_over",
        "eta_days_min", "eta_days_max", "is_active",
    )
    list_filter = ("zone", "is_active")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code", "description", "percent_off", "amount_off",
        "min_order_value", "uses", "max_uses", "is_active",
    )
    list_filter = ("is_active",)
    search_fields = ("code", "description")
    readonly_fields = ("uses", "created_at", "updated_at")


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        "name", "handle", "phone", "source", "status",
        "estimated_value", "assigned_to", "created_at",
    )
    list_filter = ("source", "status")
    search_fields = ("name", "handle", "phone", "email")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = (
        "name", "type", "date", "status",
        "assigned_to", "completed_at",
    )
    list_filter = ("type", "status")
    search_fields = ("name", "phone", "notes")
    readonly_fields = ("completed_at", "created_at", "updated_at")
    date_hierarchy = "date"


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "subject", "customer_name", "priority",
        "status", "assigned_to", "created_at",
    )
    list_filter = ("status", "priority")
    search_fields = ("reference", "subject", "customer_name")
    readonly_fields = ("reference", "resolved_at", "created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(CustomerSegment)
class CustomerSegmentAdmin(admin.ModelAdmin):
    list_display = (
        "name", "slug", "is_dynamic", "member_count",
        "color", "created_at",
    )
    list_filter = ("is_dynamic",)
    search_fields = ("name", "slug")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = (
        "name", "key", "status", "account_name",
        "last_sync_at", "updated_at",
    )
    list_filter = ("status",)
    search_fields = ("name", "key", "account_name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(AdCampaign)
class AdCampaignAdmin(admin.ModelAdmin):
    list_display = (
        "name", "campaign_id", "status", "currency",
        "budget", "spend", "attributed_revenue",
        "impressions", "clicks", "conversions",
    )
    list_filter = ("status", "currency")
    search_fields = ("name", "campaign_id")
    readonly_fields = ("cpa", "roas", "created_at", "updated_at")


@admin.register(CreatorApplication)
class CreatorApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "name", "handle", "status", "followers",
        "niche", "reviewed_by", "created_at",
    )
    list_filter = ("status",)
    search_fields = ("name", "handle", "email", "phone")
    readonly_fields = ("reviewed_at", "created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(Partnership)
class PartnershipAdmin(admin.ModelAdmin):
    list_display = (
        "creator", "status", "commission_rate",
        "start_date", "end_date", "created_at",
    )
    list_filter = ("status",)
    search_fields = ("creator__name", "creator__handle")
    list_select_related = ("creator",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(CreatorSample)
class CreatorSampleAdmin(admin.ModelAdmin):
    list_display = (
        "creator", "product", "quantity", "status",
        "tracking_number", "requested_at",
    )
    list_filter = ("status",)
    search_fields = ("creator__name", "product__product__name")
    list_select_related = ("creator", "product")
    readonly_fields = (
        "requested_at", "dispatched_at", "delivered_at", "updated_at",
    )
    date_hierarchy = "requested_at"


@admin.register(PermissionGroup)
class PermissionGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "updated_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")