from django.contrib import admin

from .models import (
    WhatsAppAccount,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppNotification,
    WhatsAppOrder,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)


@admin.register(WhatsAppAccount)
class WhatsAppAccountAdmin(admin.ModelAdmin):
    list_display = ("display_phone", "business_name", "is_active", "quality_score", "last_synced_at")
    list_filter = ("is_active", "quality_score")


@admin.register(WhatsAppHealthCheck)
class WhatsAppHealthCheckAdmin(admin.ModelAdmin):
    list_display = ("account", "ok", "latency_ms", "created_at")
    list_filter = ("ok",)


@admin.register(WhatsAppCatalog)
class WhatsAppCatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "meta_catalog_id", "connected", "auto_sync", "last_full_sync_at")


@admin.register(WhatsAppCatalogItem)
class WhatsAppCatalogItemAdmin(admin.ModelAdmin):
    list_display = ("retailer_id", "name", "price", "in_stock", "eligible", "sync_status")
    list_filter = ("sync_status", "in_stock", "eligible")
    search_fields = ("name", "retailer_id")


@admin.register(WhatsAppContact)
class WhatsAppContactAdmin(admin.ModelAdmin):
    list_display = ("wa_id", "profile_name", "opt_in_status", "order_count", "total_spent")
    list_filter = ("opt_in_status",)
    search_fields = ("wa_id", "profile_name")


@admin.register(WhatsAppConversation)
class WhatsAppConversationAdmin(admin.ModelAdmin):
    list_display = ("contact", "status", "assigned_to", "last_message_at", "unread_count")
    list_filter = ("status",)


@admin.register(WhatsAppMessage)
class WhatsAppMessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "direction", "type", "status", "timestamp", "is_internal_note")
    list_filter = ("direction", "status", "type")


@admin.register(WhatsAppTemplate)
class WhatsAppTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "language", "category", "status", "is_paused", "updated_at")
    list_filter = ("status", "category")


@admin.register(WhatsAppAutomation)
class WhatsAppAutomationAdmin(admin.ModelAdmin):
    list_display = ("name", "trigger", "status", "messages_sent")


@admin.register(WhatsAppBroadcast)
class WhatsAppBroadcastAdmin(admin.ModelAdmin):
    list_display = ("campaign_name", "status", "audience_count", "delivered", "read", "failed")
    list_filter = ("status",)


@admin.register(WhatsAppOrder)
class WhatsAppOrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "contact_name", "total", "status", "created_at")
    list_filter = ("status",)


@admin.register(WhatsAppWebhookEvent)
class WhatsAppWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("type", "event_type", "status", "signature_valid", "received_at")
    list_filter = ("status", "signature_valid")


@admin.register(WhatsAppInvoice)
class WhatsAppInvoiceAdmin(admin.ModelAdmin):
    list_display = ("period_start", "period_end", "amount_kes", "status", "issued_at")


@admin.register(WhatsAppSettings)
class WhatsAppSettingsAdmin(admin.ModelAdmin):
    list_display = ("routing", "timezone", "csat_enabled", "data_retention_days")


@admin.register(WhatsAppTeamMember)
class WhatsAppTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "active", "last_seen_at")


@admin.register(WhatsAppAuditEntry)
class WhatsAppAuditEntryAdmin(admin.ModelAdmin):
    list_display = ("actor_name", "action", "target", "timestamp")
    list_filter = ("action",)


@admin.register(WhatsAppSegment)
class WhatsAppSegmentAdmin(admin.ModelAdmin):
    list_display = ("name", "cached_count", "updated_at")


@admin.register(WhatsAppQuickReply)
class WhatsAppQuickReplyAdmin(admin.ModelAdmin):
    list_display = ("shortcut", "title", "category")


@admin.register(WhatsAppNotification)
class WhatsAppNotificationAdmin(admin.ModelAdmin):
    list_display = ("type", "title", "read", "timestamp")
    list_filter = ("type", "read")


@admin.register(WhatsAppBotFlow)
class WhatsAppBotFlowAdmin(admin.ModelAdmin):
    list_display = ("name", "is_published", "entry_node_key", "updated_at")


@admin.register(WhatsAppBotNode)
class WhatsAppBotNodeAdmin(admin.ModelAdmin):
    list_display = ("flow", "key", "kind", "title")
    list_filter = ("kind",)