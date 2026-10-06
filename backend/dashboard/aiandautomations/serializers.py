from rest_framework import serializers
from .models import (
    Conversation, Message, Automation, AutomationTemplate,
    ContentDraft, BulkJob, Insight, UsageEvent, SearchConfig,
    SearchQuery, AISettings,
)


class ConversationSerializer(serializers.ModelSerializer):
    updatedAt = serializers.SerializerMethodField()
    group = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'updatedAt', 'group']

    def get_updatedAt(self, obj):
        from django.utils.timesince import timesince
        return f'{timesince(obj.updated_at).split(",")[0]} ago'

    def get_group(self, obj):
        return obj.group_name()


class MessageSerializer(serializers.ModelSerializer):
    chart = serializers.JSONField(source='chart_json', allow_null=True)
    table = serializers.JSONField(source='table_json', allow_null=True)
    link = serializers.JSONField(source='link_json', allow_null=True)
    timestamp = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'chart', 'table', 'link', 'timestamp']

    def get_timestamp(self, obj):
        return obj.created_at.strftime('%H:%M')


class AutomationSerializer(serializers.ModelSerializer):
    trigger = serializers.CharField(source='trigger_label')
    lastRun = serializers.CharField(source='last_run_label', read_only=True)
    successRate = serializers.FloatField(source='success_rate', read_only=True)

    class Meta:
        model = Automation
        fields = [
            'id', 'name', 'trigger', 'status', 'runs', 'lastRun', 'successRate',
            'trigger_event', 'conditions', 'timing', 'action_type', 'template',
            'variable_map', 'recipients', 'admin_channel',
        ]
        read_only_fields = ['runs', 'successRate', 'lastRun']


class AutomationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationTemplate
        fields = ['name', 'trigger', 'action']


class ContentDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentDraft
        fields = ['id', 'product_id', 'content_type', 'body', 'published', 'created_at']


class InsightSerializer(serializers.ModelSerializer):
    actionLabel = serializers.CharField(source='action_label')
    actionLink = serializers.CharField(source='action_link')

    class Meta:
        model = Insight
        fields = ['id', 'category', 'priority', 'text', 'actionLabel', 'actionLink']


class SearchConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SearchConfig
        fields = ['enabled', 'natural_language', 'personalized', 'explain', 'cross_sell']


class AISettingsSerializer(serializers.ModelSerializer):
    monthly_budget_kes = serializers.DecimalField(max_digits=12, decimal_places=2)
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = AISettings
        fields = [
            'enabled', 'provider', 'model', 'base_url',
            'monthly_budget_kes', 'budget_alert',
            'masking', 'audit_retention_days', 'has_api_key',
        ]

    def get_has_api_key(self, obj):
        return bool(obj.api_key_encrypted)