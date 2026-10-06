from django.urls import path

from .views import overview, assistant, search, content, automations, insights, settings

app_name = 'aiandautomations'

urlpatterns = [
    # Overview
    path('overview/', overview.overview_view),

    # Assistant
    path('conversations/', assistant.conversations_view),
    path('conversations/<str:conv_id>/messages/', assistant.messages_view),
    path('conversations/<str:conv_id>/messages/stream/', assistant.stream_view),

    # Search
    path('search/config/', search.config_view),
    path('search/analytics/', search.analytics_view),
    path('search/data-quality/', search.data_quality_view),

    # Content
    path('content/generate/', content.generate_view),
    path('content/bulk/', content.bulk_view),
    path('content/drafts/', content.drafts_view),

    # Automations
    path('automations/', automations.automations_view),
    path('automations/<str:pk>/', automations.automation_detail),
    path('automations/<str:pk>/status/', automations.automation_status),
    path('automations/templates/', automations.templates_view),

    # Insights
    path('insights/', insights.list_view),
    path('insights/<str:pk>/dismiss/', insights.dismiss_view),
    path('insights/<str:pk>/execute/', insights.execute_view),

    # Settings & usage
    path('settings/', settings.settings_view),
    path('disable/', settings.disable_view),
    path('usage/', settings.usage_view),
]