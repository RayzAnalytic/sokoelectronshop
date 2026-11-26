from django.contrib import admin

from .models import (
    WhatsAppAccount,
    WhatsAppAlert,
    WhatsAppAttributionEvent,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppConsentLog,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppIntegrationError,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppMessageAttachment,
    WhatsAppMessageLog,
    WhatsAppMessagingCost,
    WhatsAppNotification,
    WhatsAppNotificationConfig,
    WhatsAppOrder,
    WhatsAppProductShare,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
    WhatsAppWorkflowRun,
)


@admin.register(WhatsAppAccount)
class WhatsAppAccountAdmin(admin.ModelAdmin):
    list_display = (
        "display_phone",
        "business_name",
        "connection_state",
        "is_active",
        "api_status",
        "webhook_status",
        "quality_score",
        "last_synced_at",
    )
    list_filter = ("connection_state", "is_active", "api_status", "webhook_status", "quality_score")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WhatsAppHealthCheck)
class WhatsAppHealthCheckAdmin(admin.ModelAdmin):
    list_display = ("account", "check_type", "status", "ok", "latency_ms", "created_at")
    list_filter = ("check_type", "status", "ok")


@admin.register(WhatsAppIntegrationError)
class WhatsAppIntegrationErrorAdmin(admin.ModelAdmin):
    list_display = ("kind", "message", "resolved", "created_at")
    list_filter = ("kind", "resolved")
    search_fields = ("message",)


@admin.register(WhatsAppAlert)
class WhatsAppAlertAdmin(admin.ModelAdmin):
    list_display = ("severity", "title", "is_active", "created_at")
    list_filter = ("severity", "is_active")
    search_fields = ("title", "description")


@admin.register(WhatsAppCatalog)
class WhatsAppCatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "meta_catalog_id", "connected", "auto_sync", "last_full_sync_at")
    list_filter = ("connected", "auto_sync")


@admin.register(WhatsAppCatalogItem)
class WhatsAppCatalogItemAdmin(admin.ModelAdmin):
    list_display = (
        "retailer_id",
        "sku",
        "name",
        "price",
        "in_stock",
        "product_status",
        "eligible",
        "sync_status",
    )
    list_filter = ("sync_status", "product_status", "in_stock", "eligible")
    search_fields = ("name", "sku", "retailer_id")


@admin.register(WhatsAppProductShare)
class WhatsAppProductShareAdmin(admin.ModelAdmin):
    list_display = ("product_name", "mode", "status", "conversation", "shared_by", "shared_at")
    list_filter = ("mode", "status")
    search_fields = ("product_name",)


@admin.register(WhatsAppContact)
class WhatsAppContactAdmin(admin.ModelAdmin):
    list_display = (
        "wa_id",
        "profile_name",
        "opt_in_status",
        "order_count",
        "total_spent",
        "last_payment_status",
        "last_delivery_status",
    )
    list_filter = ("opt_in_status", "is_verified", "is_blocked")
    search_fields = ("wa_id", "profile_name", "email")


@admin.register(WhatsAppConsentLog)
class WhatsAppConsentLogAdmin(admin.ModelAdmin):
    list_display = ("contact", "action", "source", "recorded_at")
    list_filter = ("action", "source")
    search_fields = ("contact__wa_id", "contact__profile_name")


@admin.register(WhatsAppConversation)
class WhatsAppConversationAdmin(admin.ModelAdmin):
    list_display = ("contact", "status", "priority", "assigned_to", "last_message_at", "unread_count")
    list_filter = ("status", "priority")
    search_fields = ("contact__wa_id", "contact__profile_name")


class WhatsAppMessageAttachmentInline(admin.TabularInline):
    model = WhatsAppMessageAttachment
    extra = 0


@admin.register(WhatsAppMessage)
class WhatsAppMessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "direction", "type", "status", "timestamp", "is_internal_note")
    list_filter = ("direction", "status", "type", "is_internal_note")
    search_fields = ("body", "wa_message_id", "template_name")
    inlines = [WhatsAppMessageAttachmentInline]


@admin.register(WhatsAppMessageAttachment)
class WhatsAppMessageAttachmentAdmin(admin.ModelAdmin):
    list_display = ("message", "kind", "filename", "mime_type", "size_bytes", "created_at")
    list_filter = ("kind",)
    search_fields = ("filename",)


@admin.register(WhatsAppTemplate)
class WhatsAppTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "language", "category", "status", "header_type", "is_paused", "updated_at")
    list_filter = ("status", "category", "header_type")
    search_fields = ("name", "body_text")


@admin.register(WhatsAppNotificationConfig)
class WhatsAppNotificationConfigAdmin(admin.ModelAdmin):
    list_display = ("event", "label", "template", "enabled", "last_result", "last_executed_at")
    list_filter = ("enabled", "last_result", "requires_consent")
    search_fields = ("event", "label")


class WhatsAppWorkflowRunInline(admin.TabularInline):
    model = WhatsAppWorkflowRun
    extra = 0
    readonly_fields = ("contact", "result", "detail", "executed_at")


@admin.register(WhatsAppAutomation)
class WhatsAppAutomationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "trigger",
        "action",
        "status",
        "messages_sent",
        "success_count",
        "failure_count",
        "last_run_result",
    )
    list_filter = ("status", "trigger", "action", "last_run_result")
    search_fields = ("name",)
    inlines = [WhatsAppWorkflowRunInline]


@admin.register(WhatsAppWorkflowRun)
class WhatsAppWorkflowRunAdmin(admin.ModelAdmin):
    list_display = ("automation", "contact", "result", "executed_at")
    list_filter = ("result",)


@admin.register(WhatsAppBroadcast)
class WhatsAppBroadcastAdmin(admin.ModelAdmin):
    list_display = (
        "campaign_name",
        "status",
        "audience_count",
        "submitted",
        "delivered",
        "read",
        "failed",
        "orders_count",
        "revenue",
    )
    list_filter = ("status",)
    search_fields = ("campaign_name", "objective", "discount_code")


@admin.register(WhatsAppMessageLog)
class WhatsAppMessageLogAdmin(admin.ModelAdmin):
    list_display = (
        "recipient",
        "customer_name",
        "template_name",
        "category",
        "order_reference",
        "status",
        "sent_at",
    )
    list_filter = ("status", "category")
    search_fields = ("recipient", "customer_name", "template_name", "order_reference", "wa_message_id")


@admin.register(WhatsAppAttributionEvent)
class WhatsAppAttributionEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "campaign", "order", "revenue", "currency", "occurred_at")
    list_filter = ("event_type", "currency")


@admin.register(WhatsAppMessagingCost)
class WhatsAppMessagingCostAdmin(admin.ModelAdmin):
    list_display = ("date", "category", "campaign", "conversation_count", "cost", "currency")
    list_filter = ("category", "currency")


@admin.register(WhatsAppOrder)
class WhatsAppOrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "contact_name", "total", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("order_number", "contact_name", "contact_wa_id")


@admin.register(WhatsAppWebhookEvent)
class WhatsAppWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("type", "event_type", "status", "signature_valid", "received_at")
    list_filter = ("status", "signature_valid")


@admin.register(WhatsAppInvoice)
class WhatsAppInvoiceAdmin(admin.ModelAdmin):
    list_display = ("period_start", "period_end", "amount_kes", "status", "issued_at")
    list_filter = ("status",)


@admin.register(WhatsAppSettings)
class WhatsAppSettingsAdmin(admin.ModelAdmin):
    list_display = ("routing", "timezone", "csat_enabled", "data_retention_days")


@admin.register(WhatsAppTeamMember)
class WhatsAppTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "active", "last_seen_at")
    list_filter = ("role", "active")


@admin.register(WhatsAppAuditEntry)
class WhatsAppAuditEntryAdmin(admin.ModelAdmin):
    list_display = ("actor_name", "action", "target", "timestamp")
    list_filter = ("action",)
    search_fields = ("actor_name", "action", "target")


@admin.register(WhatsAppSegment)
class WhatsAppSegmentAdmin(admin.ModelAdmin):
    list_display = ("name", "cached_count", "updated_at")
    search_fields = ("name",)


@admin.register(WhatsAppQuickReply)
class WhatsAppQuickReplyAdmin(admin.ModelAdmin):
    list_display = ("shortcut", "title", "category")
    search_fields = ("shortcut", "title")


@admin.register(WhatsAppNotification)
class WhatsAppNotificationAdmin(admin.ModelAdmin):
    list_display = ("type", "title", "read", "timestamp")
    list_filter = ("type", "read")
    search_fields = ("title", "body")


@admin.register(WhatsAppBotFlow)
class WhatsAppBotFlowAdmin(admin.ModelAdmin):
    list_display = ("name", "is_published", "entry_node_key", "updated_at")


@admin.register(WhatsAppBotNode)
class WhatsAppBotNodeAdmin(admin.ModelAdmin):
    list_display = ("flow", "key", "kind", "title")
    list_filter = ("kind",)