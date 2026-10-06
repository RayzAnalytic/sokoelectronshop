from django.contrib import admin

from .models import ChatSession, ChatMessage


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ("role", "content", "created_at")
    can_delete = False


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "updated_at", "message_count")
    list_filter = ("user",)
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [ChatMessageInline]

    @admin.display(description="Messages")
    def message_count(self, obj):
        return obj.messages.count()


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("session", "role", "content_preview", "created_at")
    list_filter = ("role",)
    search_fields = ("content",)
    readonly_fields = ("session", "role", "content", "created_at")

    @admin.display(description="Preview")
    def content_preview(self, obj):
        return obj.content[:80]