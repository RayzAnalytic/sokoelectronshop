from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

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


def relative_time(dt) -> str:
    if not dt:
        return "Never"
    seconds = int((timezone.now() - dt).total_seconds())
    if seconds < 60:
        return "Just now"
    if seconds < 3600:
        return f"{seconds // 60} mins ago"
    if seconds < 86400:
        return f"{seconds // 3600} hours ago"
    if seconds < 172800:
        return "Yesterday"
    return f"{seconds // 86400} days ago"


def day_group(dt) -> str:
    if not dt:
        return "Earlier"
    seconds = int((timezone.now() - dt).total_seconds())
    if seconds < 86400:
        return "Today"
    if seconds < 172800:
        return "Yesterday"
    if seconds < 604800:
        return "Last 7 days"
    return "Earlier"


class AISettingsSerializer(serializers.ModelSerializer):
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = AISettings
        fields = [
            "enabled",
            "provider",
            "model",
            "base_url",
            "masking",
            "mask_fields",
            "allow_write_actions",
            "require_confirmation_for_destructive",
            "budget_alert",
            "monthly_budget_kes",
            "monthly_token_cap",
            "audit_retention_days",
            "conversation_retention_days",
            "temperature",
            "max_output_tokens",
            "streaming_enabled",
            "system_prompt",
            "allowed_modules",
            "cache_ttl_seconds",
            "has_api_key",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "has_api_key"]

    def get_has_api_key(self, obj: AISettings) -> bool:
        return bool(obj.resolved_api_key())

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["hasApiKey"] = data.pop("has_api_key", None)
        data["maskFields"] = data.pop("mask_fields", None)
        data["allowWriteActions"] = data.pop("allow_write_actions", None)
        data["requireConfirmationForDestructive"] = data.pop("require_confirmation_for_destructive", None)
        data["budgetAlert"] = data.pop("budget_alert", None)
        data["monthlyBudgetKes"] = data.pop("monthly_budget_kes", None)
        data["monthlyTokenCap"] = data.pop("monthly_token_cap", None)
        data["auditRetentionDays"] = data.pop("audit_retention_days", None)
        data["conversationRetentionDays"] = data.pop("conversation_retention_days", None)
        data["maxOutputTokens"] = data.pop("max_output_tokens", None)
        data["streamingEnabled"] = data.pop("streaming_enabled", None)
        data["systemPrompt"] = data.pop("system_prompt", None)
        data["allowedModules"] = data.pop("allowed_modules", None)
        data["cacheTtlSeconds"] = data.pop("cache_ttl_seconds", None)
        data["baseUrl"] = data.pop("base_url", None)
        data["updatedAt"] = data.pop("updated_at", None)
        return data


class AISettingsUpdateSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    provider = serializers.ChoiceField(
        choices=[c[0] for c in AISettings.PROVIDER_CHOICES],
        required=False,
    )
    model = serializers.CharField(required=False, allow_blank=True, max_length=128)
    base_url = serializers.CharField(required=False, allow_blank=True)
    api_key = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
        max_length=512,
    )
    masking = serializers.BooleanField(required=False)
    mask_fields = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
    )
    allow_write_actions = serializers.BooleanField(required=False)
    require_confirmation_for_destructive = serializers.BooleanField(required=False)
    budget_alert = serializers.BooleanField(required=False)
    monthly_budget_kes = serializers.IntegerField(required=False, min_value=0)
    monthly_token_cap = serializers.IntegerField(required=False, min_value=0)
    audit_retention_days = serializers.IntegerField(
        required=False, min_value=1, max_value=365
    )
    conversation_retention_days = serializers.IntegerField(
        required=False, min_value=1, max_value=3650
    )
    temperature = serializers.FloatField(
        required=False, min_value=0.0, max_value=2.0
    )
    max_output_tokens = serializers.IntegerField(required=False, min_value=1)
    streaming_enabled = serializers.BooleanField(required=False)
    system_prompt = serializers.CharField(
        required=False, allow_blank=True, max_length=8000
    )
    allowed_modules = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
    )
    cache_ttl_seconds = serializers.IntegerField(required=False, min_value=0)


class AIToolCallSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIToolCall
        fields = [
            "id",
            "tool_name",
            "arguments",
            "result_summary",
            "row_count",
            "duration_ms",
            "status",
            "error_message",
            "created_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["name"] = data.pop("tool_name", None)
        data["params"] = data.pop("arguments", None)
        data["resultSummary"] = data.pop("result_summary", None)
        data["rowCount"] = data.pop("row_count", None)
        data["durationMs"] = data.pop("duration_ms", None)
        data["errorMessage"] = data.pop("error_message", None)
        data["createdAt"] = data.pop("created_at", None)
        return data


class AIMessageSerializer(serializers.ModelSerializer):
    tool_calls = AIToolCallSerializer(many=True, read_only=True)

    class Meta:
        model = AIMessage
        fields = [
            "id",
            "role",
            "status",
            "content",
            "chart",
            "table",
            "link",
            "quick_replies",
            "tool_name",
            "tool_args",
            "tool_result_size",
            "is_verified",
            "data_sources",
            "missing_data",
            "error_message",
            "tokens_in",
            "tokens_out",
            "latency_ms",
            "model",
            "tool_calls",
            "created_at",
        ]

    def _build_provenance(self, sources):
        if not sources:
            return []
        if isinstance(sources, dict):
            return [
                {"label": str(k), "detail": str(v) if v is not None else None}
                for k, v in sources.items()
            ]
        result = []
        for item in sources:
            if isinstance(item, dict):
                result.append({
                    "label": item.get("label") or item.get("name") or str(item),
                    "detail": item.get("detail"),
                    "href": item.get("href"),
                    "count": item.get("count"),
                })
            else:
                result.append({"label": str(item)})
        return result

    def to_representation(self, instance):
        data = super().to_representation(instance)
        created_at = instance.created_at
        if created_at:
            data["timestamp"] = timezone.localtime(created_at).strftime("%I:%M %p")
        else:
            data["timestamp"] = ""
        data["quickReplies"] = data.pop("quick_replies", None)
        data["toolName"] = data.pop("tool_name", None)
        data["toolArgs"] = data.pop("tool_args", None)
        data["isVerified"] = data.pop("is_verified", None)
        data["dataSources"] = data.pop("data_sources", None)
        data["missingData"] = data.pop("missing_data", None)
        data["errorMessage"] = data.pop("error_message", None)
        data["latencyMs"] = data.pop("latency_ms", None)
        data["tokensIn"] = data.pop("tokens_in", None)
        data["tokensOut"] = data.pop("tokens_out", None)
        data["streaming"] = instance.status == "streaming"
        data["provenance"] = self._build_provenance(data.get("dataSources"))
        tool_calls = data.pop("tool_calls", None) or []
        data["toolCalls"] = tool_calls
        if instance.error_message:
            data["error"] = "stream_error" if instance.status == "error" else "network"
        return data


class AIMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(allow_blank=False, max_length=8000)
    context = serializers.DictField(required=False)
    attachments = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


class AIMessageFeedbackSerializer(serializers.Serializer):
    feedback = serializers.ChoiceField(choices=[("up", "up"), ("down", "down")])


class AIConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIConversation
        fields = [
            "id",
            "title",
            "status",
            "origin_path",
            "origin_module",
            "model",
            "provider",
            "total_tokens_in",
            "total_tokens_out",
            "total_cost_kes",
            "message_count",
            "is_pinned",
            "created_at",
            "updated_at",
        ]

    def _resolve_last_message(self, instance):
        cache = getattr(instance, "_prefetched_objects_cache", {})
        if "messages" in cache:
            messages = cache["messages"]
            if not messages:
                return None
            return max(messages, key=lambda m: m.created_at)
        for attr in ("last_message", "prefetched_last_message"):
            msg = getattr(instance, attr, None)
            if msg is not None:
                return msg
        return instance.messages.order_by("-created_at").first()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["updatedAt"] = instance.updated_at.isoformat() if instance.updated_at else None
        data["updatedAtRelative"] = relative_time(instance.updated_at)
        data["updatedAtIso"] = data["updatedAt"]
        data["group"] = day_group(instance.updated_at)
        data["messageCount"] = data.pop("message_count", None)
        data["isPinned"] = data.pop("is_pinned", None)
        data["originPath"] = data.pop("origin_path", None)
        data["originModule"] = data.pop("origin_module", None)
        data["totalTokensIn"] = data.pop("total_tokens_in", None)
        data["totalTokensOut"] = data.pop("total_tokens_out", None)
        data["totalCostKes"] = data.pop("total_cost_kes", None)
        data["createdAt"] = data.pop("created_at", None)
        data["updatedAtRaw"] = data.pop("updated_at", None)
        last = self._resolve_last_message(instance)
        data["preview"] = (last.content or "")[:80] if last else ""
        data["pinned"] = data["isPinned"]
        return data


class AIConversationDetailSerializer(AIConversationSerializer):
    messages = AIMessageSerializer(many=True, read_only=True)

    class Meta(AIConversationSerializer.Meta):
        fields = AIConversationSerializer.Meta.fields + ["messages"]


class AIConversationCreateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    origin_path = serializers.CharField(required=False, allow_blank=True, max_length=255)
    origin_module = serializers.CharField(required=False, allow_blank=True, max_length=64)
    model = serializers.CharField(required=False, allow_blank=True, max_length=128)


class AIConversationUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    status = serializers.ChoiceField(
        choices=[c[0] for c in AIConversation.STATUS_CHOICES],
        required=False,
    )
    is_pinned = serializers.BooleanField(required=False)


class AIAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAlert
        fields = [
            "id",
            "severity",
            "category",
            "source",
            "title",
            "description",
            "href",
            "action_label",
            "count",
            "is_dismissed",
            "dismissed_at",
            "acknowledged_at",
            "snoozed_until",
            "expires_at",
            "automation",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "severity",
            "category",
            "source",
            "title",
            "description",
            "href",
            "action_label",
            "count",
            "automation",
            "is_dismissed",
            "dismissed_at",
            "acknowledged_at",
            "snoozed_until",
            "expires_at",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["actionLabel"] = data.pop("action_label", None)
        data["timestamp"] = relative_time(instance.created_at)
        data["isActive"] = instance.is_active
        data["isDismissed"] = data.pop("is_dismissed", None)
        data["dismissedAt"] = data.pop("dismissed_at", None)
        data["acknowledgedAt"] = data.pop("acknowledged_at", None)
        data["snoozedUntil"] = data.pop("snoozed_until", None)
        data["expiresAt"] = data.pop("expires_at", None)
        data["createdAt"] = data.pop("created_at", None)
        data["updatedAt"] = data.pop("updated_at", None)
        return data


class AIAlertDismissSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class AIAlertSnoozeSerializer(serializers.Serializer):
    minutes = serializers.IntegerField(min_value=1, max_value=10080)


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = [
            "id",
            "category",
            "priority",
            "text",
            "action_label",
            "href",
            "action",
            "evidence",
            "is_dismissed",
            "dismissed_at",
            "viewed_at",
            "executed_at",
            "expires_at",
            "automation",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "category",
            "priority",
            "text",
            "action_label",
            "href",
            "action",
            "evidence",
            "automation",
            "is_dismissed",
            "dismissed_at",
            "viewed_at",
            "executed_at",
            "expires_at",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["actionLabel"] = data.pop("action_label", None)
        data["isDismissed"] = data.pop("is_dismissed", None)
        data["dismissedAt"] = data.pop("dismissed_at", None)
        data["viewedAt"] = data.pop("viewed_at", None)
        data["executedAt"] = data.pop("executed_at", None)
        data["expiresAt"] = data.pop("expires_at", None)
        data["createdAt"] = data.pop("created_at", None)
        data["updatedAt"] = data.pop("updated_at", None)
        return data


class AIInsightExecuteSerializer(serializers.Serializer):
    confirm = serializers.BooleanField(required=False, default=False)
    params = serializers.DictField(required=False)


class AIAutomationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAutomationRun
        fields = [
            "id",
            "automation",
            "status",
            "triggered_by",
            "triggered_by_user",
            "started_at",
            "finished_at",
            "duration_ms",
            "summary",
            "output",
            "items_affected",
            "error_message",
            "error_trace",
            "request_id",
            "tokens_in",
            "tokens_out",
            "cost_kes",
            "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["triggeredBy"] = data.pop("triggered_by", None)
        data["triggeredByUser"] = data.pop("triggered_by_user", None)
        data["startedAt"] = data.pop("started_at", None)
        data["finishedAt"] = data.pop("finished_at", None)
        data["durationMs"] = data.pop("duration_ms", None)
        data["itemsAffected"] = data.pop("items_affected", None)
        data["errorMessage"] = data.pop("error_message", None)
        data["errorTrace"] = data.pop("error_trace", None)
        data["requestId"] = data.pop("request_id", None)
        data["tokensIn"] = data.pop("tokens_in", None)
        data["tokensOut"] = data.pop("tokens_out", None)
        data["costKes"] = data.pop("cost_kes", None)
        data["createdAt"] = data.pop("created_at", None)
        data["startedRelative"] = relative_time(instance.started_at)
        return data


class AIAutomationSerializer(serializers.ModelSerializer):
    lastRun = serializers.SerializerMethodField()
    recentRuns = serializers.SerializerMethodField()

    class Meta:
        model = AIAutomation
        fields = [
            "id",
            "name",
            "kind",
            "description",
            "trigger",
            "action",
            "trigger_config",
            "action_config",
            "status",
            "is_enabled",
            "schedule_kind",
            "schedule_interval_minutes",
            "schedule_cron",
            "timezone",
            "next_run_at",
            "cooldown_minutes",
            "max_runs_per_day",
            "requires_approval",
            "created_by",
            "owner",
            "runs",
            "runs_failed",
            "success_rate",
            "last_run_at",
            "last_run_status",
            "last_error",
            "lastRun",
            "recentRuns",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "runs",
            "runs_failed",
            "success_rate",
            "last_run_at",
            "last_run_status",
            "last_error",
            "created_at",
            "updated_at",
        ]

    def get_lastRun(self, obj: AIAutomation) -> str:
        return relative_time(obj.last_run_at)

    def get_recentRuns(self, obj: AIAutomation):
        qs = getattr(obj, "prefetched_runs", None)
        if qs is None:
            qs = getattr(obj, "_prefetched_runs", None)
        if qs is None:
            qs = obj.executions.order_by("-started_at")[:5]
        return AIAutomationRunSerializer(qs, many=True).data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["successRate"] = data.pop("success_rate", None)
        data["isEnabled"] = data.pop("is_enabled", None)
        data["triggerConfig"] = data.pop("trigger_config", None)
        data["actionConfig"] = data.pop("action_config", None)
        data["scheduleKind"] = data.pop("schedule_kind", None)
        data["scheduleIntervalMinutes"] = data.pop("schedule_interval_minutes", None)
        data["scheduleCron"] = data.pop("schedule_cron", None)
        data["nextRunAt"] = data.pop("next_run_at", None)
        data["cooldownMinutes"] = data.pop("cooldown_minutes", None)
        data["maxRunsPerDay"] = data.pop("max_runs_per_day", None)
        data["requiresApproval"] = data.pop("requires_approval", None)
        data["createdBy"] = data.pop("created_by", None)
        data["runsFailed"] = data.pop("runs_failed", None)
        data["lastRunAt"] = data.pop("last_run_at", None)
        data["lastRunStatus"] = data.pop("last_run_status", None)
        data["lastError"] = data.pop("last_error", None)
        data["createdAt"] = data.pop("created_at", None)
        data["updatedAt"] = data.pop("updated_at", None)
        data["isDue"] = instance.is_due
        return data


class AIAutomationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128)
    kind = serializers.ChoiceField(
        choices=[c[0] for c in AIAutomation.KIND_CHOICES],
        required=False,
        default="custom",
    )
    description = serializers.CharField(required=False, allow_blank=True)
    trigger = serializers.CharField(max_length=255)
    action = serializers.CharField(required=False, allow_blank=True, max_length=255)
    trigger_config = serializers.DictField(required=False)
    action_config = serializers.DictField(required=False)
    status = serializers.ChoiceField(
        choices=[c[0] for c in AIAutomation.STATUS_CHOICES],
        required=False,
        default="Draft",
    )
    is_enabled = serializers.BooleanField(required=False, default=False)
    schedule_kind = serializers.ChoiceField(
        choices=[c[0] for c in AIAutomation.SCHEDULE_KIND_CHOICES],
        required=False,
        default="manual",
    )
    schedule_interval_minutes = serializers.IntegerField(
        required=False, min_value=1, default=60
    )
    schedule_cron = serializers.CharField(required=False, allow_blank=True, max_length=64)
    timezone = serializers.CharField(required=False, max_length=64, default="Africa/Nairobi")
    cooldown_minutes = serializers.IntegerField(required=False, min_value=0, default=0)
    max_runs_per_day = serializers.IntegerField(required=False, min_value=0, default=0)
    requires_approval = serializers.BooleanField(required=False, default=False)


class AIAutomationUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, max_length=128)
    kind = serializers.ChoiceField(
        choices=[c[0] for c in AIAutomation.KIND_CHOICES],
        required=False,
    )
    description = serializers.CharField(required=False, allow_blank=True)
    trigger = serializers.CharField(required=False, max_length=255)
    action = serializers.CharField(required=False, allow_blank=True, max_length=255)
    trigger_config = serializers.DictField(required=False)
    action_config = serializers.DictField(required=False)
    status = serializers.ChoiceField(
        choices=[c[0] for c in AIAutomation.STATUS_CHOICES],
        required=False,
    )
    is_enabled = serializers.BooleanField(required=False)
    schedule_kind = serializers.ChoiceField(
        choices=[c[0] for c in AIAutomation.SCHEDULE_KIND_CHOICES],
        required=False,
    )
    schedule_interval_minutes = serializers.IntegerField(required=False, min_value=1)
    schedule_cron = serializers.CharField(required=False, allow_blank=True, max_length=64)
    timezone = serializers.CharField(required=False, max_length=64)
    cooldown_minutes = serializers.IntegerField(required=False, min_value=0)
    max_runs_per_day = serializers.IntegerField(required=False, min_value=0)
    requires_approval = serializers.BooleanField(required=False)


class AIAutomationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[c[0] for c in AIAutomation.STATUS_CHOICES])
    is_enabled = serializers.BooleanField(required=False)


class AIAutomationRunRequestSerializer(serializers.Serializer):
    confirm = serializers.BooleanField(required=False, default=False)
    dry_run = serializers.BooleanField(required=False, default=False)
    params = serializers.DictField(required=False)


class AIUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIUsageLog
        fields = [
            "id",
            "feature",
            "provider",
            "model",
            "tokens_in",
            "tokens_out",
            "cost_kes",
            "user",
            "conversation",
            "request_id",
            "latency_ms",
            "cache_hit",
            "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["tokensIn"] = data.pop("tokens_in", None)
        data["tokensOut"] = data.pop("tokens_out", None)
        data["costKes"] = data.pop("cost_kes", None)
        data["requestId"] = data.pop("request_id", None)
        data["latencyMs"] = data.pop("latency_ms", None)
        data["cacheHit"] = data.pop("cache_hit", None)
        data["createdAt"] = data.pop("created_at", None)
        data["timestamp"] = relative_time(instance.created_at)
        return data


class AIUsageSummarySerializer(serializers.Serializer):
    period_start = serializers.DateTimeField()
    period_end = serializers.DateTimeField()
    total_tokens_in = serializers.IntegerField()
    total_tokens_out = serializers.IntegerField()
    total_cost_kes = serializers.FloatField()
    by_feature = serializers.ListField(child=serializers.DictField())
    by_day = serializers.ListField(child=serializers.DictField())

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["periodStart"] = data.pop("period_start", None)
        data["periodEnd"] = data.pop("period_end", None)
        data["totalTokensIn"] = data.pop("total_tokens_in", None)
        data["totalTokensOut"] = data.pop("total_tokens_out", None)
        data["totalCostKes"] = data.pop("total_cost_kes", None)
        data["byFeature"] = data.pop("by_feature", None)
        data["byDay"] = data.pop("by_day", None)
        return data


class AIAuditLogSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()

    class Meta:
        model = AIAuditLog
        fields = [
            "id",
            "user",
            "user_display",
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
            "created_at",
        ]
        read_only_fields = fields

    def get_user_display(self, obj: AIAuditLog) -> str:
        if not obj.user:
            return "system"
        return obj.user.get_username()

    def _normalise_status(self, obj: AIAuditLog) -> str:
        if obj.action in ("destructive", "write"):
            if obj.was_confirmed is False:
                return "cancelled"
            if obj.was_confirmed is None:
                return "pending"
        if obj.is_verified is False:
            return "failed"
        return "success"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["userDisplay"] = data.pop("user_display", None)
        data["resultSize"] = data.pop("result_size", None)
        data["requestId"] = data.pop("request_id", None)
        data["ipAddress"] = data.pop("ip_address", None)
        data["userAgent"] = data.pop("user_agent", None)
        data["permissionSnapshot"] = data.pop("permission_snapshot", None)
        data["wasConfirmed"] = data.pop("was_confirmed", None)
        data["isVerified"] = data.pop("is_verified", None)
        data["createdAt"] = data.pop("created_at", None)
        data["timestamp"] = relative_time(instance.created_at)
        data["timestampIso"] = instance.created_at.isoformat() if instance.created_at else None
        data["actor"] = data["userDisplay"] or "system"
        data["target"] = instance.tool or ""
        data["params"] = data.pop("args", None)
        data["status"] = self._normalise_status(instance)
        return data


class AIContentGenerateSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    content_type = serializers.CharField()
    tone = serializers.CharField(required=False, default="Professional")
    language = serializers.CharField(required=False, default="English")
    length = serializers.CharField(required=False, default="Medium")


class AIContentBulkSerializer(serializers.Serializer):
    product_ids = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=False,
        max_length=50,
    )
    content_type = serializers.CharField()
    tone = serializers.CharField(required=False, default="Professional")
    language = serializers.CharField(required=False, default="English")
    length = serializers.CharField(required=False, default="Medium")


class AIActionPreviewSerializer(serializers.Serializer):
    tool = serializers.CharField(max_length=64)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True)
    params = serializers.DictField(required=False)
    confirm_label = serializers.CharField(required=False, default="Confirm")
    cancel_label = serializers.CharField(required=False, default="Cancel")
    destructive = serializers.BooleanField(required=False, default=False)
    preview = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["confirmLabel"] = data.pop("confirm_label", None)
        data["cancelLabel"] = data.pop("cancel_label", None)
        data["id"] = f"pending-{data.get('tool', 'action')}"
        return data


class AIActionExecuteSerializer(serializers.Serializer):
    tool = serializers.CharField(max_length=64)
    params = serializers.DictField(required=False)
    confirm = serializers.BooleanField(required=False, default=False)
    confirmation_token = serializers.CharField(required=False, allow_blank=True)


class AIFeedbackAggregateSerializer(serializers.Serializer):
    message_id = serializers.CharField()
    feedback = serializers.ChoiceField(choices=[("up", "up"), ("down", "down")])
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)