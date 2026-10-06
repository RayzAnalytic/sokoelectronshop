from django.contrib import admin
from .models import (
    AISettings, Conversation, Message, Automation, AutomationTemplate,
    AutomationRun, ContentDraft, BulkJob, Insight, UsageEvent,
    SearchConfig, SearchQuery, AuditLog,
)


@admin.register(AISettings)
class AISettingsAdmin(admin.ModelAdmin):
    list_display = ('enabled', 'provider', 'model', 'updated_at')


@admin.register(Automation)
class AutomationAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_event', 'status', 'runs', 'success_rate')
    list_filter = ('status',)


@admin.register(AutomationTemplate)
class AutomationTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger', 'action')


@admin.register(Insight)
class InsightAdmin(admin.ModelAdmin):
    list_display = ('category', 'priority', 'created_at', 'dismissed_at')


@admin.register(UsageEvent)
class UsageEventAdmin(admin.ModelAdmin):
    list_display = ('day', 'feature', 'tokens_in', 'tokens_out', 'cost_kes')


admin.site.register(Conversation)
admin.site.register(Message)
admin.site.register(AutomationRun)
admin.site.register(ContentDraft)
admin.site.register(BulkJob)
admin.site.register(SearchConfig)
admin.site.register(SearchQuery)
admin.site.register(AuditLog)