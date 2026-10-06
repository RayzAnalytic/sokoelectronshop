from django.contrib import admin

from .models import (
    WhatsAppAccount,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
    WhatsAppCartSession,
)


@admin.register(WhatsAppAccount)
class WhatsAppAccountAdmin(admin.ModelAdmin):
    list_display = ("business_name", "display_phone", "quality_score",
                    "messaging_limit", "is_active", "updated_at")
    list_filter = ("is_active", "quality_score")
    search_fields = ("business_name", "display_phone", "waba_id", "phone_number_id")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WhatsAppContact)
class WhatsAppContactAdmin(admin.ModelAdmin):
    list_display = ("wa_id", "profile_name", "user", "opt_in_status",
                    "is_verified", "last_inbound_at")
    list_filter = ("opt_in_status", "is_verified")
    search_fields = ("wa_id", "profile_name", "user__email")
    autocomplete_fields = ("user",)


class WhatsAppMessageInline(admin.TabularInline):
    model = WhatsAppMessage
    extra = 0
    fields = ("direction", "type", "body", "status", "timestamp")
    readonly_fields = fields
    can_delete = False


@admin.register(WhatsAppConversation)
class WhatsAppConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "contact", "status", "assigned_to", "last_message_at")
    list_filter = ("status",)
    search_fields = ("contact__wa_id", "contact__profile_name")
    autocomplete_fields = ("contact", "assigned_to")
    inlines = [WhatsAppMessageInline]


@admin.register(WhatsAppTemplate)
class WhatsAppTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "language", "category", "status", "quality",
                    "last_synced_at")
    list_filter = ("status", "category", "quality")
    search_fields = ("name",)


@admin.register(WhatsAppCartSession)
class WhatsAppCartSessionAdmin(admin.ModelAdmin):
    list_display = ("token", "user", "contact", "status", "delivery_method",
                    "created_at", "expires_at")
    list_filter = ("status", "delivery_method")
    search_fields = ("token", "user__email", "contact__wa_id")
    readonly_fields = ("token", "created_at", "wa_message_id")