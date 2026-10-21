# ai/admin.py

from django.contrib import admin, messages
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    AIAlert,
    AIAuditLog,
    AIAutomation,
    AIAutomationRun,
    AIConversation,
    AIInsight,
    AIMessage,
    AISettings,
    AIToolCall,
    AIUsageLog,
)


# ═══════════════════════════════════════════════════════════════════════════
# CUSTOM FILTERS
# ═══════════════════════════════════════════════════════════════════════════

class RecentlyUpdatedFilter(admin.SimpleListFilter):
    title = "updated"
    parameter_name = "updated"

    def lookups(self, request, model_admin):
        return [
            ("today", "Today"),
            ("7d", "Last 7 days"),
            ("30d", "Last 30 days"),
        ]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == "today":
            return queryset.filter(updated_at__date=now.date())
        if self.value() == "7d":
            return queryset.filter(updated_at__gte=now - timezone.timedelta(days=7))
        if self.value() == "30d":
            return queryset.filter(updated_at__gte=now - timezone.timedelta(days=30))
        return queryset


class HasApiKeyFilter(admin.SimpleListFilter):
    title = "api key"
    parameter_name = "has_key"

    def lookups(self, request, model_admin):
        return [("yes", "Configured"), ("no", "Missing")]

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.exclude(api_key="")
        if self.value() == "no":
            return queryset.filter(api_key="")
        return queryset


class ActiveAlertFilter(admin.SimpleListFilter):
    title = "lifecycle"
    parameter_name = "lifecycle"

    def lookups(self, request, model_admin):
        return [
            ("active", "Active"),
            ("dismissed", "Dismissed"),
            ("snoozed", "Snoozed"),
            ("expired", "Expired"),
        ]

    def queryset(self, request, queryset):
        now = timezone.now()
        v = self.value()
        if v == "active":
            return queryset.filter(
                is_dismissed=False,
            ).filter(Q(expires_at__isnull=True) | Q(expires_at__gte=now)).filter(
                Q(snoozed_until__isnull=True) | Q(snoozed_until__lt=now)
            )
        if v == "dismissed":
            return queryset.filter(is_dismissed=True)
        if v == "snoozed":
            return queryset.filter(snoozed_until__gte=now)
        if v == "expired":
            return queryset.filter(expires_at__lt=now)
        return queryset


# ═══════════════════════════════════════════════════════════════════════════
# INLINES
# ═══════════════════════════════════════════════════════════════════════════

class AIMessageInline(admin.TabularInline):
    model = AIMessage
    extra = 0
    fields = ("role", "status", "content", "model", "tokens_in", "tokens_out", "created_at")
    readonly_fields = ("created_at",)
    show_change_link = True


class AIToolCallInline(admin.TabularInline):
    model = AIToolCall
    extra = 0
    fields = (
        "tool_name",
        "status",
        "row_count",
        "duration_ms",
        "error_message",
        "created_at",
    )
    readonly_fields = ("created_at",)
    can_delete = False


class AIAutomationRunInline(admin.TabularInline):
    model = AIAutomationRun
    extra = 0
    fields = (
        "status",
        "triggered_by",
        "started_at",
        "finished_at",
        "duration_ms",
        "items_affected",
        "summary",
    )
    readonly_fields = ("started_at", "finished_at", "duration_ms")
    can_delete = False
    show_change_link = True


# ═══════════════════════════════════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AISettings)
class AISettingsAdmin(admin.ModelAdmin):
    list_display = (
        "provider",
        "model",
        "enabled",
        "masking",
        "allow_write_actions",
        "monthly_budget_kes",
        "has_key",
        "updated_at",
    )
    list_filter = ("enabled", "provider", "masking", "allow_write_actions", HasApiKeyFilter)
    readonly_fields = ("updated_at", "updated_by", "has_key_display")

    fieldsets = (
        ("Connection", {
            "fields": ("enabled", "provider", "model", "api_key", "base_url", "has_key_display"),
        }),
        ("Privacy & governance", {
            "fields": (
                "masking",
                "mask_fields",
                "allow_write_actions",
                "require_confirmation_for_destructive",
            ),
        }),
        ("Budget & quotas", {
            "fields": ("budget_alert", "monthly_budget_kes", "monthly_token_cap"),
        }),
        ("Retention", {
            "fields": ("audit_retention_days", "conversation_retention_days"),
        }),
        ("Generation", {
            "fields": (
                "temperature",
                "max_output_tokens",
                "streaming_enabled",
                "system_prompt",
            ),
        }),
        ("Scope & caching", {
            "fields": ("allowed_modules", "cache_ttl_seconds"),
        }),
        ("Meta", {
            "fields": ("updated_by", "updated_at"),
        }),
    )

    @admin.display(description="API key")
    def has_key(self, obj):
        return bool(obj.resolved_api_key())

    has_key.boolean = True

    @admin.display(description="Resolved API key")
    def has_key_display(self, obj):
        if obj.resolved_api_key():
            return "✅ configured"
        return "❌ not set (DB + env empty)"

    def has_add_permission(self, request):
        # Singleton — no manual add.
        return not AISettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if request.user.is_authenticated:
            obj.updated_by = request.user
        super().save_model(request, obj, form, change)


# ═══════════════════════════════════════════════════════════════════════════
# CONVERSATIONS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIConversation)
class AIConversationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "user",
        "status",
        "message_count",
        "model",
        "is_pinned",
        "updated_at",
    )
    list_filter = ("status", "is_pinned", "provider", RecentlyUpdatedFilter)
    search_fields = ("title", "user__username", "origin_module")
    readonly_fields = (
        "created_at",
        "updated_at",
        "total_tokens_in",
        "total_tokens_out",
        "total_cost_kes",
        "message_count",
    )
    list_select_related = ("user",)
    inlines = [AIMessageInline]

    fieldsets = (
        (None, {
            "fields": ("user", "title", "status", "is_pinned"),
        }),
        ("Origin", {
            "fields": ("origin_path", "origin_module"),
        }),
        ("Model", {
            "fields": ("provider", "model"),
        }),
        ("Rollups (read-only)", {
            "fields": (
                "message_count",
                "total_tokens_in",
                "total_tokens_out",
                "total_cost_kes",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    actions = ["archive_selected", "unarchive_selected", "delete_empty"]

    @admin.action(description="Archive selected conversations")
    def archive_selected(self, request, queryset):
        updated = queryset.update(status="archived")
        self.message_user(request, f"{updated} conversation(s) archived.", messages.SUCCESS)

    @admin.action(description="Unarchive selected conversations")
    def unarchive_selected(self, request, queryset):
        updated = queryset.update(status="active")
        self.message_user(request, f"{updated} conversation(s) restored.", messages.SUCCESS)

    @admin.action(description="Delete conversations with no messages")
    def delete_empty(self, request, queryset):
        empty = queryset.annotate(n=Count("messages")).filter(n=0)
        count = empty.count()
        empty.delete()
        self.message_user(request, f"{count} empty conversation(s) deleted.", messages.SUCCESS)


# ═══════════════════════════════════════════════════════════════════════════
# MESSAGES
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIMessage)
class AIMessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "conversation",
        "role",
        "status",
        "short_content",
        "model",
        "tokens_in",
        "tokens_out",
        "latency_ms",
        "is_verified",
        "created_at",
    )
    list_filter = ("role", "status", "is_verified", "model")
    search_fields = ("content", "tool_name", "conversation__title")
    readonly_fields = (
        "created_at",
        "tokens_in",
        "tokens_out",
        "latency_ms",
        "tool_result_size",
    )
    list_select_related = ("conversation",)
    inlines = [AIToolCallInline]

    fieldsets = (
        (None, {
            "fields": ("conversation", "role", "status", "content"),
        }),
        ("Rich payloads", {
            "fields": ("chart", "table", "link", "quick_replies"),
        }),
        ("Tool trace", {
            "fields": ("tool_name", "tool_args", "tool_result_size"),
        }),
        ("Provenance", {
            "fields": ("is_verified", "data_sources", "missing_data", "error_message"),
        }),
        ("Metering", {
            "fields": ("model", "tokens_in", "tokens_out", "latency_ms"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    @admin.display(description="Content")
    def short_content(self, obj):
        return (obj.content[:60] + "…") if obj.content and len(obj.content) > 60 else obj.content


# ═══════════════════════════════════════════════════════════════════════════
# TOOL CALLS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIToolCall)
class AIToolCallAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tool_name",
        "status",
        "message",
        "row_count",
        "duration_ms",
        "created_at",
    )
    list_filter = ("status", "tool_name")
    search_fields = ("tool_name", "error_message", "message__conversation__title")
    readonly_fields = ("created_at", "result_payload", "arguments")
    list_select_related = ("message", "message__conversation")

    fieldsets = (
        (None, {
            "fields": ("message", "tool_name", "status"),
        }),
        ("Input / output", {
            "fields": ("arguments", "result_summary", "result_payload"),
        }),
        ("Metrics", {
            "fields": ("row_count", "duration_ms"),
        }),
        ("Errors", {
            "fields": ("error_message",),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )


# ═══════════════════════════════════════════════════════════════════════════
# ALERTS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIAlert)
class AIAlertAdmin(admin.ModelAdmin):
    list_display = (
        "severity_badge",
        "category",
        "title",
        "count",
        "lifecycle",
        "source",
        "owner",
        "created_at",
    )
    list_filter = ("severity", "category", "source", "is_dismissed", ActiveAlertFilter)
    search_fields = ("title", "description")
    list_select_related = ("owner", "automation")
    readonly_fields = (
        "created_at",
        "updated_at",
        "dismissed_at",
        "dismissed_by",
        "acknowledged_at",
    )

    fieldsets = (
        (None, {
            "fields": ("severity", "category", "source", "title", "description"),
        }),
        ("Action link", {
            "fields": ("href", "action_label", "count"),
        }),
        ("Attribution", {
            "fields": ("owner", "automation"),
        }),
        ("Lifecycle", {
            "fields": (
                "is_dismissed",
                "dismissed_at",
                "dismissed_by",
                "acknowledged_at",
                "snoozed_until",
                "expires_at",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    actions = ["mark_dismissed", "mark_acknowledged", "clear_snooze"]

    @admin.display(description="Severity")
    def severity_badge(self, obj):
        color = {"high": "#ef4444", "medium": "#f59e0b", "low": "#64748b"}.get(obj.severity, "#64748b")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 6px;border-radius:2px;font-size:11px">{}</span>',
            color,
            obj.severity.upper(),
        )

    @admin.display(description="Lifecycle")
    def lifecycle(self, obj):
        if obj.is_dismissed:
            return "Dismissed"
        if obj.expires_at and obj.expires_at < timezone.now():
            return "Expired"
        if obj.snoozed_until and obj.snoozed_until >= timezone.now():
            return "Snoozed"
        return "Active"

    @admin.action(description="Dismiss selected alerts")
    def mark_dismissed(self, request, queryset):
        updated = queryset.update(
            is_dismissed=True,
            dismissed_at=timezone.now(),
            dismissed_by=request.user,
        )
        self.message_user(request, f"{updated} alert(s) dismissed.", messages.SUCCESS)

    @admin.action(description="Acknowledge selected alerts")
    def mark_acknowledged(self, request, queryset):
        updated = queryset.update(acknowledged_at=timezone.now())
        self.message_user(request, f"{updated} alert(s) acknowledged.", messages.SUCCESS)

    @admin.action(description="Clear snooze")
    def clear_snooze(self, request, queryset):
        updated = queryset.update(snoozed_until=None)
        self.message_user(request, f"{updated} alert(s) un-snoozed.", messages.SUCCESS)


# ═══════════════════════════════════════════════════════════════════════════
# INSIGHTS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIInsight)
class AIInsightAdmin(admin.ModelAdmin):
    list_display = (
        "priority",
        "category",
        "text_short",
        "action_label",
        "lifecycle",
        "owner",
        "created_at",
    )
    list_filter = ("category", "priority", "is_dismissed")
    search_fields = ("text",)
    list_select_related = ("owner", "automation")
    readonly_fields = (
        "created_at",
        "updated_at",
        "dismissed_at",
        "dismissed_by",
        "viewed_at",
        "executed_at",
    )

    fieldsets = (
        (None, {
            "fields": ("category", "priority", "text"),
        }),
        ("Action", {
            "fields": ("action_label", "href", "action", "evidence"),
        }),
        ("Attribution", {
            "fields": ("owner", "automation"),
        }),
        ("Lifecycle", {
            "fields": (
                "is_dismissed",
                "dismissed_at",
                "dismissed_by",
                "viewed_at",
                "executed_at",
                "expires_at",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    actions = ["mark_dismissed"]

    @admin.display(description="Text")
    def text_short(self, obj):
        return (obj.text[:60] + "…") if obj.text and len(obj.text) > 60 else obj.text

    @admin.display(description="Lifecycle")
    def lifecycle(self, obj):
        if obj.is_dismissed:
            return "Dismissed"
        if obj.expires_at and obj.expires_at < timezone.now():
            return "Expired"
        if obj.executed_at:
            return "Executed"
        return "Active"

    @admin.action(description="Dismiss selected insights")
    def mark_dismissed(self, request, queryset):
        updated = queryset.update(
            is_dismissed=True,
            dismissed_at=timezone.now(),
            dismissed_by=request.user,
        )
        self.message_user(request, f"{updated} insight(s) dismissed.", messages.SUCCESS)


# ═══════════════════════════════════════════════════════════════════════════
# AUTOMATIONS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIAutomation)
class AIAutomationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "kind",
        "status",
        "is_enabled",
        "schedule_kind",
        "next_run_at",
        "runs",
        "success_rate",
        "last_run_status",
        "last_run_at",
    )
    list_filter = ("status", "kind", "is_enabled", "schedule_kind")
    search_fields = ("name", "trigger", "action", "description")
    readonly_fields = (
        "runs",
        "runs_failed",
        "success_rate",
        "last_run_at",
        "last_run_status",
        "last_error",
        "created_at",
        "updated_at",
    )
    list_select_related = ("created_by", "owner")
    inlines = [AIAutomationRunInline]

    fieldsets = (
        (None, {
            "fields": ("name", "kind", "description", "status", "is_enabled"),
        }),
        ("Trigger & action", {
            "fields": ("trigger", "action", "trigger_config", "action_config"),
        }),
        ("Schedule", {
            "fields": (
                "schedule_kind",
                "schedule_interval_minutes",
                "schedule_cron",
                "timezone",
                "next_run_at",
            ),
        }),
        ("Guardrails", {
            "fields": (
                "cooldown_minutes",
                "max_runs_per_day",
                "requires_approval",
            ),
        }),
        ("Ownership", {
            "fields": ("created_by", "owner"),
        }),
        ("Rollups (read-only)", {
            "fields": (
                "runs",
                "runs_failed",
                "success_rate",
                "last_run_at",
                "last_run_status",
                "last_error",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    actions = ["activate", "pause", "reset_stats"]

    @admin.action(description="Activate and enable selected automations")
    def activate(self, request, queryset):
        updated = queryset.update(status="Active", is_enabled=True)
        self.message_user(request, f"{updated} automation(s) activated.", messages.SUCCESS)

    @admin.action(description="Pause selected automations")
    def pause(self, request, queryset):
        updated = queryset.update(status="Paused", is_enabled=False)
        self.message_user(request, f"{updated} automation(s) paused.", messages.SUCCESS)

    @admin.action(description="Reset run stats (runs, failures, success rate)")
    def reset_stats(self, request, queryset):
        updated = queryset.update(
            runs=0,
            runs_failed=0,
            success_rate=0.0,
            last_run_at=None,
            last_run_status="",
            last_error="",
        )
        self.message_user(request, f"{updated} automation(s) reset.", messages.SUCCESS)


# ═══════════════════════════════════════════════════════════════════════════
# AUTOMATION RUNS
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIAutomationRun)
class AIAutomationRunAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "automation",
        "status",
        "triggered_by",
        "started_at",
        "duration_ms",
        "items_affected",
        "short_summary",
    )
    list_filter = ("status", "triggered_by")
    search_fields = ("automation__name", "summary", "error_message", "request_id")
    readonly_fields = (
        "started_at",
        "finished_at",
        "duration_ms",
        "created_at",
        "output",
        "error_trace",
    )
    list_select_related = ("automation", "triggered_by_user")
    date_hierarchy = "started_at"

    fieldsets = (
        (None, {
            "fields": ("automation", "status", "triggered_by", "triggered_by_user"),
        }),
        ("Timing", {
            "fields": ("started_at", "finished_at", "duration_ms"),
        }),
        ("Outcome", {
            "fields": ("summary", "items_affected", "output"),
        }),
        ("Errors", {
            "fields": ("error_message", "error_trace"),
        }),
        ("Metering", {
            "fields": ("request_id", "tokens_in", "tokens_out", "cost_kes"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    @admin.display(description="Summary")
    def short_summary(self, obj):
        if not obj.summary:
            return ""
        return (obj.summary[:50] + "…") if len(obj.summary) > 50 else obj.summary


# ═══════════════════════════════════════════════════════════════════════════
# USAGE
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIUsageLog)
class AIUsageLogAdmin(admin.ModelAdmin):
    list_display = (
        "feature",
        "provider",
        "model",
        "tokens_in",
        "tokens_out",
        "cost_kes",
        "latency_ms",
        "cache_hit",
        "user",
        "created_at",
    )
    list_filter = ("feature", "provider", "model", "cache_hit")
    search_fields = ("request_id", "user__username", "model")
    readonly_fields = (
        "created_at",
        "tokens_in",
        "tokens_out",
        "cost_kes",
        "latency_ms",
        "request_id",
    )
    list_select_related = ("user", "conversation")
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ═══════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════════

@admin.register(AIAuditLog)
class AIAuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "action",
        "tool",
        "result_size",
        "was_confirmed",
        "is_verified",
        "ip_address",
        "created_at",
    )
    list_filter = ("action", "was_confirmed", "is_verified")
    search_fields = (
        "user__username",
        "tool",
        "request_id",
        "ip_address",
        "path",
    )
    readonly_fields = (
        "created_at",
        "user",
        "action",
        "tool",
        "args",
        "result_size",
        "request_id",
        "ip_address",
        "user_agent",
        "path",
        "permission_snapshot",
        "was_confirmed",
        "is_verified",
    )
    list_select_related = ("user",)
    date_hierarchy = "created_at"

    fieldsets = (
        (None, {
            "fields": ("user", "action", "tool", "created_at"),
        }),
        ("Payload", {
            "fields": ("args", "result_size", "permission_snapshot"),
        }),
        ("Context", {
            "fields": ("request_id", "ip_address", "user_agent", "path"),
        }),
        ("Flags", {
            "fields": ("was_confirmed", "is_verified"),
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # Allow deletion only for superusers, for retention cleanup.
        return bool(request.user and request.user.is_superuser)