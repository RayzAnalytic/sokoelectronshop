from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class AISettings(models.Model):
    PROVIDER_CHOICES = [
        ("groq", "Groq"),
        ("openai", "OpenAI"),
        ("gemini", "Google Gemini"),
        ("openrouter", "OpenRouter"),
        ("anthropic", "Anthropic"),
        ("custom", "Custom endpoint"),
    ]

    enabled = models.BooleanField(default=False)
    provider = models.CharField(max_length=32, choices=PROVIDER_CHOICES, default="groq")
    model = models.CharField(max_length=128, default="llama-3.3-70b-versatile")
    api_key = models.CharField(max_length=512, blank=True, default="")
    base_url = models.URLField(blank=True, default="")

    masking = models.BooleanField(
        default=True,
        help_text="Mask PII (emails, phones, card numbers) before sending to the model.",
    )
    mask_fields = models.JSONField(
        default=list,
        blank=True,
        help_text="Additional field names to always mask (e.g. ['customer_email']).",
    )
    allow_write_actions = models.BooleanField(
        default=False,
        help_text="Allow the assistant to perform writes (create/update) after user confirmation.",
    )
    require_confirmation_for_destructive = models.BooleanField(default=True)

    budget_alert = models.BooleanField(default=True)
    monthly_budget_kes = models.PositiveIntegerField(default=1000)
    monthly_token_cap = models.PositiveIntegerField(
        default=0,
        help_text="0 = unlimited.",
    )

    audit_retention_days = models.PositiveSmallIntegerField(default=30)
    conversation_retention_days = models.PositiveSmallIntegerField(default=90)

    temperature = models.FloatField(
        default=0.3,
        validators=[MinValueValidator(0.0), MaxValueValidator(2.0)],
    )
    max_output_tokens = models.PositiveIntegerField(default=1024)
    streaming_enabled = models.BooleanField(default=True)
    system_prompt = models.TextField(
        blank=True,
        default="",
        help_text="Optional override appended to the built-in system prompt.",
    )

    allowed_modules = models.JSONField(
        default=list,
        blank=True,
        help_text="Whitelist of admin module keys the assistant may query. Empty = all allowed by role.",
    )
    cache_ttl_seconds = models.PositiveIntegerField(
        default=60,
        help_text="How long to cache expensive analytics answers.",
    )

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_settings_updates",
    )

    class Meta:
        verbose_name = "AI Settings"
        verbose_name_plural = "AI Settings"

    def __str__(self) -> str:
        return f"AI Settings ({self.provider}/{self.model}, enabled={self.enabled})"

    @classmethod
    def get_solo(cls) -> "AISettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def resolved_api_key(self) -> str:
        env_map = {
            "groq": "GROQ_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
        }
        env_name = env_map.get(self.provider)
        env_val = getattr(settings, env_name, "") if env_name else ""
        return self.api_key or env_val or ""

    def resolved_base_url(self) -> str:
        if self.base_url:
            return self.base_url
        defaults = {
            "groq": "https://api.groq.com/openai/v1",
            "openai": "https://api.openai.com/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "gemini": "https://generativelanguage.googleapis.com/v1beta",
            "anthropic": "https://api.anthropic.com/v1",
        }
        return defaults.get(self.provider, "")


class AIConversation(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("archived", "Archived"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_conversations",
    )
    title = models.CharField(max_length=255, default="New chat")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")

    origin_path = models.CharField(max_length=255, blank=True, default="")
    origin_module = models.CharField(max_length=64, blank=True, default="")

    model = models.CharField(max_length=128, blank=True, default="")
    provider = models.CharField(max_length=32, blank=True, default="")

    total_tokens_in = models.PositiveIntegerField(default=0)
    total_tokens_out = models.PositiveIntegerField(default=0)
    total_cost_kes = models.FloatField(default=0.0)
    message_count = models.PositiveIntegerField(default=0)

    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
            models.Index(fields=["user", "status", "-updated_at"]),
        ]
        permissions = [
            ("view_all_conversations", "Can view all AI conversations"),
            ("export_aidata", "Can export AI data"),
        ]

    def __str__(self) -> str:
        return self.title

    def refresh_totals(self) -> None:
        from django.db.models import Sum

        agg = self.messages.exclude(role="tool").aggregate(
            tin=Sum("tokens_in"),
            tout=Sum("tokens_out"),
        )
        self.total_tokens_in = int(agg["tin"] or 0)
        self.total_tokens_out = int(agg["tout"] or 0)
        self.total_cost_kes = round(
            self.total_tokens_in / 1_000_000 * 18.0
            + self.total_tokens_out / 1_000_000 * 40.0,
            4,
        )
        self.message_count = self.messages.count()
        self.save(update_fields=[
            "total_tokens_in",
            "total_tokens_out",
            "total_cost_kes",
            "message_count",
            "updated_at",
        ])


class AIMessage(models.Model):
    ROLE_CHOICES = [
        ("system", "System"),
        ("user", "User"),
        ("assistant", "Assistant"),
        ("tool", "Tool"),
    ]
    STATUS_CHOICES = [
        ("ok", "OK"),
        ("error", "Error"),
        ("streaming", "Streaming"),
        ("cancelled", "Cancelled"),
    ]

    conversation = models.ForeignKey(
        AIConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ok")
    content = models.TextField(blank=True, default="")

    chart = models.JSONField(
        null=True,
        blank=True,
        help_text="Chart spec: {type, data, xKey, series:[{key,label,color}]}.",
    )
    table = models.JSONField(
        null=True,
        blank=True,
        help_text="Table spec: {headers:[...], rows:[[...]]}.",
    )
    link = models.JSONField(
        null=True,
        blank=True,
        help_text="Link spec: {label, href}.",
    )
    quick_replies = models.JSONField(
        null=True,
        blank=True,
        help_text="List of suggested follow-up prompts.",
    )

    tool_name = models.CharField(max_length=64, blank=True, default="")
    tool_args = models.JSONField(null=True, blank=True)
    tool_result_size = models.PositiveIntegerField(default=0)

    is_verified = models.BooleanField(
        default=True,
        help_text="True when every figure comes from a real DB query; False when the model estimated.",
    )
    data_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="List of module/table names the answer was built from.",
    )
    missing_data = models.JSONField(
        default=list,
        blank=True,
        help_text="Fields the assistant could not resolve.",
    )
    error_message = models.TextField(blank=True, default="")

    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    model = models.CharField(max_length=128, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["status"]),
        ]
        permissions = [
            ("view_sensitive_ai_data", "Can view sensitive AI data"),
            ("perform_destructive_ai_actions", "Can perform destructive AI actions"),
        ]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:40]}"


class AIAlert(models.Model):
    SEVERITY_CHOICES = [
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]
    CATEGORY_CHOICES = [
        ("inventory", "Inventory"),
        ("orders", "Orders"),
        ("payments", "Payments"),
        ("customers", "Customers"),
        ("returns", "Returns"),
        ("messages", "Messages"),
    ]
    SOURCE_CHOICES = [
        ("automation", "Automation"),
        ("manual", "Manual"),
        ("system", "System"),
    ]

    severity = models.CharField(max_length=8, choices=SEVERITY_CHOICES, default="low")
    category = models.CharField(max_length=16, choices=CATEGORY_CHOICES)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default="system")

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    href = models.CharField(max_length=255, blank=True, default="/admin")
    action_label = models.CharField(max_length=64, default="View")
    count = models.PositiveIntegerField(default=1)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_alerts",
    )

    is_dismissed = models.BooleanField(default=False)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    dismissed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_alerts_dismissed",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    automation = models.ForeignKey(
        "AIAutomation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["severity", "-created_at"]
        indexes = [
            models.Index(fields=["is_dismissed", "severity"]),
            models.Index(fields=["category", "-created_at"]),
            models.Index(fields=["owner", "-created_at"]),
        ]
        permissions = [
            ("dismiss_aialert", "Can dismiss AI alerts"),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def is_active(self) -> bool:
        if self.is_dismissed:
            return False
        now = timezone.now()
        if self.expires_at and self.expires_at < now:
            return False
        if self.snoozed_until and self.snoozed_until > now:
            return False
        return True


class AIInsight(models.Model):
    CATEGORY_CHOICES = [
        ("sales", "Sales"),
        ("inventory", "Inventory"),
        ("customer", "Customer"),
        ("channel", "Channel"),
    ]
    PRIORITY_CHOICES = [
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]

    category = models.CharField(max_length=16, choices=CATEGORY_CHOICES)
    priority = models.CharField(max_length=8, choices=PRIORITY_CHOICES, default="medium")
    text = models.TextField()
    action_label = models.CharField(max_length=64, default="View")
    href = models.CharField(max_length=255, default="/admin")

    action = models.JSONField(
        null=True,
        blank=True,
        help_text="Optional {kind, payload} for a server-side action.",
    )
    evidence = models.JSONField(
        default=dict,
        blank=True,
        help_text="The numbers/rows that support this insight.",
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_insights",
    )
    automation = models.ForeignKey(
        "AIAutomation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="insights",
    )

    is_dismissed = models.BooleanField(default=False)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    dismissed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_insights_dismissed",
    )
    viewed_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["priority", "-created_at"]
        indexes = [
            models.Index(fields=["is_dismissed", "priority"]),
            models.Index(fields=["category", "-created_at"]),
            models.Index(fields=["owner", "-created_at"]),
        ]
        permissions = [
            ("dismiss_aiinsight", "Can dismiss AI insights"),
        ]

    def __str__(self) -> str:
        return self.text[:60]

    @property
    def is_active(self) -> bool:
        if self.is_dismissed:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True


class AIAutomation(models.Model):
    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Paused", "Paused"),
        ("Draft", "Draft"),
    ]
    KIND_CHOICES = [
        ("low_stock", "Low stock alert"),
        ("abandoned_cart", "Abandoned cart follow-up"),
        ("pending_order", "Pending order reminder"),
        ("failed_payment", "Failed payment monitoring"),
        ("return_refund", "Return / refund tracking"),
        ("sales_summary", "Sales summary"),
        ("newsletter_perf", "Newsletter performance"),
        ("unusual_change", "Unusual sales / inventory change"),
        ("custom", "Custom"),
    ]
    SCHEDULE_KIND_CHOICES = [
        ("interval", "Every N minutes"),
        ("hourly", "Hourly"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
        ("event", "On event"),
        ("manual", "Manual only"),
    ]

    name = models.CharField(max_length=128)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES, default="custom")
    description = models.TextField(blank=True, default="")

    trigger = models.CharField(max_length=255)
    action = models.CharField(max_length=255, blank=True, default="")

    trigger_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="e.g. {'threshold': 5, 'categories': [...], 'warehouses': [...]}",
    )
    action_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="e.g. {'channel': 'whatsapp', 'template': 'low_stock_v1'}",
    )

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="Draft")
    is_enabled = models.BooleanField(default=False)

    schedule_kind = models.CharField(
        max_length=16,
        choices=SCHEDULE_KIND_CHOICES,
        default="manual",
    )
    schedule_interval_minutes = models.PositiveIntegerField(default=60)
    schedule_cron = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional cron expression when schedule_kind is daily/weekly/monthly.",
    )
    timezone = models.CharField(max_length=64, default="Africa/Nairobi")
    next_run_at = models.DateTimeField(null=True, blank=True)

    cooldown_minutes = models.PositiveIntegerField(
        default=0,
        help_text="Minimum time between runs. 0 = no cooldown.",
    )
    max_runs_per_day = models.PositiveIntegerField(default=0, help_text="0 = unlimited.")
    requires_approval = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_automations_created",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_automations_owned",
    )

    runs = models.PositiveIntegerField(default=0)
    runs_failed = models.PositiveIntegerField(default=0)
    success_rate = models.FloatField(default=0.0)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_run_status = models.CharField(max_length=16, blank=True, default="")
    last_error = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["status", "is_enabled"]),
            models.Index(fields=["kind"]),
            models.Index(fields=["next_run_at"]),
        ]
        permissions = [
            ("run_aiautomation", "Can run AI automations"),
            ("toggle_aiautomation", "Can enable/disable AI automations"),
        ]

    def __str__(self) -> str:
        return f"{self.name} [{self.status}]"

    @property
    def is_due(self) -> bool:
        if self.status != "Active" or not self.is_enabled:
            return False
        if self.next_run_at is None:
            return True
        return self.next_run_at <= timezone.now()


class AIAutomationRun(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("success", "Success"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
        ("cancelled", "Cancelled"),
    ]
    TRIGGERED_BY_CHOICES = [
        ("schedule", "Schedule"),
        ("manual", "Manual"),
        ("event", "Event"),
        ("api", "API"),
    ]

    automation = models.ForeignKey(
        AIAutomation,
        on_delete=models.CASCADE,
        related_name="executions",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="queued")
    triggered_by = models.CharField(
        max_length=16,
        choices=TRIGGERED_BY_CHOICES,
        default="schedule",
    )
    triggered_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_automation_runs",
    )

    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)

    summary = models.CharField(max_length=255, blank=True, default="")
    output = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured result (counts, ids, generated payloads, etc.).",
    )
    items_affected = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    error_trace = models.TextField(blank=True, default="")

    request_id = models.CharField(max_length=64, blank=True, default="")
    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    cost_kes = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["automation", "-started_at"]),
            models.Index(fields=["status", "-started_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.automation_id} · {self.status} · {self.started_at:%Y-%m-%d %H:%M}"

    @property
    def duration_seconds(self) -> float:
        return round((self.duration_ms or 0) / 1000.0, 2)


class AIUsageLog(models.Model):
    FEATURE_CHOICES = [
        ("assistant", "Assistant"),
        ("content", "Content Generator"),
        ("search", "AI Search"),
        ("insights", "Insights"),
        ("automation", "Automation"),
        ("chart", "Chart / Report"),
    ]

    feature = models.CharField(max_length=16, choices=FEATURE_CHOICES)
    model = models.CharField(max_length=128)
    provider = models.CharField(max_length=32, blank=True, default="")

    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    cost_kes = models.FloatField(default=0.0)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_usage_logs",
    )
    conversation = models.ForeignKey(
        AIConversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usage_logs",
    )

    request_id = models.CharField(max_length=64, blank=True, default="")
    latency_ms = models.PositiveIntegerField(default=0)
    cache_hit = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["feature", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.feature} · {self.tokens_in + self.tokens_out} tokens"


class AIAuditLog(models.Model):
    ACTION_CHOICES = [
        ("chat", "Chat"),
        ("query", "Data query"),
        ("tool_call", "Tool call"),
        ("write", "Write action"),
        ("destructive", "Destructive action"),
        ("automation_run", "Automation run"),
        ("automation_toggle", "Automation toggle"),
        ("settings_update", "Settings update"),
        ("alert_dismiss", "Alert dismiss"),
        ("insight_execute", "Insight execute"),
        ("conversation_clear", "Conversation clear"),
        ("export", "Export"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_audit_logs",
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    tool = models.CharField(max_length=64, blank=True, default="")
    args = models.JSONField(null=True, blank=True)
    result_size = models.PositiveIntegerField(default=0)

    request_id = models.CharField(max_length=64, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    path = models.CharField(max_length=255, blank=True, default="")

    permission_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="The permissions the user had at the time of the action.",
    )
    was_confirmed = models.BooleanField(
        default=False,
        help_text="True if the user explicitly confirmed a destructive/financial action.",
    )

    is_verified = models.BooleanField(
        default=True,
        help_text="False if any figure in the response was an estimate.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} · {self.action}"


class AIToolCall(models.Model):
    STATUS_CHOICES = [
        ("ok", "OK"),
        ("error", "Error"),
        ("timeout", "Timeout"),
    ]

    message = models.ForeignKey(
        AIMessage,
        on_delete=models.CASCADE,
        related_name="tool_calls",
    )
    tool_name = models.CharField(max_length=64)
    arguments = models.JSONField(null=True, blank=True)
    result_summary = models.CharField(max_length=255, blank=True, default="")
    result_payload = models.JSONField(null=True, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ok")
    error_message = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["message", "created_at"]),
            models.Index(fields=["tool_name"]),
        ]

    def __str__(self) -> str:
        return f"{self.tool_name} ({self.status})"

    @property
    def result_preview(self) -> str:
        if self.error_message:
            return self.error_message[:80]
        if self.result_summary:
            return self.result_summary[:80]
        return f"{self.row_count} row(s)"