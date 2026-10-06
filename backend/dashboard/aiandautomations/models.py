import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


def _id():
    return uuid.uuid4().hex[:24]


class AISettings(models.Model):
    """Singleton row holding provider config + cost + privacy settings."""
    PROVIDER_CHOICES = [
        ('groq', 'Groq'),
        ('openai', 'OpenAI'),
        ('gemini', 'Google Gemini'),
        ('openrouter', 'OpenRouter'),
        ('custom', 'Custom'),
    ]

    enabled = models.BooleanField(default=False)
    provider = models.CharField(max_length=32, choices=PROVIDER_CHOICES, default='groq')
    model = models.CharField(max_length=64, default='llama-3.3-70b-versatile')
    base_url = models.CharField(max_length=255, blank=True, default='')
    api_key_encrypted = models.TextField(blank=True, default='')

    monthly_budget_kes = models.DecimalField(max_digits=12, decimal_places=2, default=1000)
    budget_alert = models.BooleanField(default=True)

    masking = models.BooleanField(default=True)
    audit_retention_days = models.PositiveIntegerField(default=30)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'AI Settings'
        verbose_name_plural = 'AI Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Conversation(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_conversations')
    title = models.CharField(max_length=200, default='New chat')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def group_name(self):
        delta = timezone.now() - self.updated_at
        if delta.days < 1:
            return 'Today'
        if delta.days < 2:
            return 'Yesterday'
        if delta.days <= 7:
            return 'Last 7 days'
        return 'Older'


class Message(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    id = models.CharField(max_length=32, primary_key=True, default=_id, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=12, choices=ROLE_CHOICES)
    content = models.TextField()
    chart_json = models.JSONField(null=True, blank=True)
    table_json = models.JSONField(null=True, blank=True)
    link_json = models.JSONField(null=True, blank=True)
    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class AutomationStatus(models.TextChoices):
    ACTIVE = 'Active', 'Active'
    PAUSED = 'Paused', 'Paused'
    DRAFT = 'Draft', 'Draft'


class Automation(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    name = models.CharField(max_length=200)
    trigger_event = models.CharField(max_length=100)      # e.g. "order.placed"
    trigger_label = models.CharField(max_length=200, blank=True, default='')
    conditions = models.JSONField(default=dict, blank=True)
    timing = models.CharField(max_length=50, default='Immediately')
    action_type = models.CharField(max_length=50, default='Send WhatsApp')
    template = models.CharField(max_length=100, blank=True, default='')
    variable_map = models.CharField(max_length=255, blank=True, default='')
    recipients = models.CharField(max_length=50, default='Customer')
    admin_channel = models.CharField(max_length=50, default='Email')

    status = models.CharField(max_length=12, choices=AutomationStatus.choices, default=AutomationStatus.DRAFT)
    runs = models.PositiveIntegerField(default=0)
    successes = models.PositiveIntegerField(default=0)
    last_run_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    @property
    def success_rate(self):
        if not self.runs:
            return 0.0
        return round((self.successes / self.runs) * 100, 1)

    @property
    def last_run_label(self):
        if not self.last_run_at:
            return 'Never'
        delta = timezone.now() - self.last_run_at
        secs = int(delta.total_seconds())
        if secs < 60:
            return f'{secs}s ago'
        if secs < 3600:
            return f'{secs // 60} mins ago'
        if secs < 86400:
            return f'{secs // 3600} hours ago'
        if delta.days == 1:
            return 'Yesterday'
        return f'{delta.days} days ago'


class AutomationTemplate(models.Model):
    name = models.CharField(max_length=200, unique=True)
    trigger = models.CharField(max_length=200)
    trigger_event = models.CharField(max_length=100)
    action = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class AutomationRun(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name='run_logs')
    event_name = models.CharField(max_length=100)
    payload = models.JSONField(default=dict, blank=True)
    success = models.BooleanField(default=True)
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ContentDraft(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    product_id = models.CharField(max_length=64)
    content_type = models.CharField(max_length=64)
    tone = models.CharField(max_length=32, blank=True, default='')
    language = models.CharField(max_length=32, blank=True, default='')
    length = models.CharField(max_length=32, blank=True, default='')
    body = models.TextField()
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class BulkJob(models.Model):
    STATUS = [('queued', 'Queued'), ('running', 'Running'), ('done', 'Done'), ('failed', 'Failed')]
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    product_ids = models.JSONField(default=list)
    content_type = models.CharField(max_length=64)
    tone = models.CharField(max_length=32, blank=True, default='')
    language = models.CharField(max_length=32, blank=True, default='')
    length = models.CharField(max_length=32, blank=True, default='')
    status = models.CharField(max_length=12, choices=STATUS, default='queued')
    results = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Insight(models.Model):
    CATEGORIES = [('sales', 'Sales'), ('inventory', 'Inventory'), ('customer', 'Customer'), ('channel', 'Channel')]
    PRIORITIES = [('high', 'High'), ('medium', 'Medium'), ('low', 'Low')]

    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    category = models.CharField(max_length=20, choices=CATEGORIES)
    priority = models.CharField(max_length=10, choices=PRIORITIES)
    text = models.TextField()
    action_label = models.CharField(max_length=100)
    action_link = models.CharField(max_length=255)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class UsageEvent(models.Model):
    FEATURES = [('assistant', 'Assistant'), ('content', 'Content Gen'), ('search', 'Search')]

    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    feature = models.CharField(max_length=20, choices=FEATURES)
    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    cost_kes = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    day = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['day', 'feature'])]


class SearchConfig(models.Model):
    """Singleton search config."""
    enabled = models.BooleanField(default=True)
    natural_language = models.BooleanField(default=True)
    personalized = models.BooleanField(default=True)
    explain = models.BooleanField(default=False)
    cross_sell = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SearchQuery(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    query = models.CharField(max_length=255)
    results_count = models.PositiveIntegerField(default=0)
    converted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['query'])]


class AuditLog(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=_id, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=100)
    resource = models.CharField(max_length=100, blank=True, default='')
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']