from django.contrib import admin
from django.utils.html import format_html

from .models import ChatMessage, ChatSession


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    can_delete = False
    show_change_link = True
    fields = ("role", "content_preview", "created_at")
    readonly_fields = ("role", "content_preview", "created_at")
    ordering = ("created_at",)

    @admin.display(description="Content")
    def content_preview(self, obj):
        if not obj.pk:
            return "—"
        text = (obj.content or "").strip().replace("\n", " ")
        return text[:120] + ("…" if len(text) > 120 else "")


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = (
        "short_id",
        "title_or_placeholder",
        "user",
        "is_active",
        "message_count",
        "updated_at",
    )
    list_filter = ("is_active", "created_at", "updated_at")
    search_fields = ("id", "title", "user__email", "user__username")
    readonly_fields = (
        "id",
        "user",
        "title",
        "metadata",
        "created_at",
        "updated_at",
    )
    date_hierarchy = "created_at"
    inlines = [ChatMessageInline]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _message_count=admin.models.Count("messages"),
        )

    @admin.display(description="Session", ordering="id")
    def short_id(self, obj):
        return str(obj.id)[:8]

    @admin.display(description="Title", ordering="title")
    def title_or_placeholder(self, obj):
        return obj.title or "—"

    @admin.display(description="Messages", ordering="_message_count")
    def message_count(self, obj):
        return getattr(obj, "_message_count", obj.messages.count())


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = (
        "short_session",
        "role",
        "content_preview",
        "has_products",
        "has_chips",
        "created_at",
    )
    list_filter = ("role", "created_at")
    search_fields = ("content", "session__id")
    readonly_fields = (
        "session",
        "role",
        "content",
        "products",
        "chips",
        "metadata",
        "created_at",
    )
    date_hierarchy = "created_at"
    list_select_related = ("session",)

    @admin.display(description="Session", ordering="session__created_at")
    def short_session(self, obj):
        return str(obj.session_id)[:8]

    @admin.display(description="Preview", ordering="content")
    def content_preview(self, obj):
        text = (obj.content or "").strip().replace("\n", " ")
        return text[:80] + ("…" if len(text) > 80 else "")

    @admin.display(boolean=True, description="Products")
    def has_products(self, obj):
        return bool(obj.products)

    @admin.display(boolean=True, description="Chips")
    def has_chips(self, obj):
        return bool(obj.chips)

    def has_add_permission(self, request):
        # Messages are only ever created by run_chat_turn().
        return False