from django.urls import path

from . import views

app_name = "aiautomations"

urlpatterns = [
    path("overview/", views.overview, name="overview"),
    path("digest/", views.digest, name="digest"),

    path(
        "assistant/conversations/",
        views.conversations,
        name="conversations",
    ),
    path(
        "assistant/conversations/<int:pk>/",
        views.conversation_detail,
        name="conversation-detail",
    ),
    path(
        "assistant/conversations/<int:pk>/rename/",
        views.conversation_rename,
        name="conversation-rename",
    ),
    path(
        "assistant/conversations/<int:pk>/pin/",
        views.conversation_toggle_pin,
        name="conversation-toggle-pin",
    ),
    path(
        "assistant/conversations/<int:pk>/export/",
        views.conversation_export,
        name="conversation-export",
    ),
    path(
        "assistant/conversations/<int:pk>/messages/",
        views.conversation_messages,
        name="messages",
    ),
    path(
        "assistant/conversations/<int:pk>/stream",
        views.conversation_stream,
        name="stream-noslash",
    ),
    path(
        "assistant/conversations/<int:pk>/stream/",
        views.conversation_stream,
        name="stream",
    ),

    path(
        "assistant/messages/<int:pk>/tool-calls/",
        views.message_tool_calls,
        name="message-tool-calls",
    ),
    path(
        "assistant/messages/<int:pk>/feedback/",
        views.message_feedback,
        name="message-feedback",
    ),

    path("tools/", views.tool_schemas, name="tool-schemas"),
    path("tools/preview/", views.tool_preview, name="tool-preview"),

    path("actions/preview/", views.action_preview, name="action-preview"),
    path("actions/execute/", views.action_execute, name="action-execute"),

    path("alerts/", views.alerts, name="alerts"),
    path(
        "alerts/<int:pk>/dismiss/",
        views.dismiss_alert,
        name="dismiss-alert",
    ),
    path(
        "alerts/<int:pk>/acknowledge/",
        views.acknowledge_alert,
        name="acknowledge-alert",
    ),
    path(
        "alerts/<int:pk>/snooze/",
        views.snooze_alert,
        name="snooze-alert",
    ),

    path("insights/", views.insights, name="insights"),
    path(
        "insights/<int:pk>/dismiss/",
        views.dismiss_insight,
        name="dismiss-insight",
    ),
    path(
        "insights/<int:pk>/execute/",
        views.execute_insight,
        name="execute-insight",
    ),

    path(
        "automations/templates/",
        views.automation_templates,
        name="automation-templates",
    ),
    path("automations/", views.automations, name="automations"),
    path(
        "automations/<int:pk>/",
        views.automation_detail,
        name="automation-detail",
    ),
    path(
        "automations/<int:pk>/status/",
        views.automation_status,
        name="automation-status",
    ),
    path(
        "automations/<int:pk>/runs/",
        views.automation_runs,
        name="automation-runs",
    ),
    path(
        "automations/<int:pk>/run/",
        views.automation_run_now,
        name="automation-run-now",
    ),

    path(
        "content/generate/",
        views.content_generate,
        name="content-generate",
    ),
    path("content/bulk/", views.content_bulk, name="content-bulk"),

    path("search/config/", views.search_config, name="search-config"),
    path(
        "search/analytics/",
        views.search_analytics,
        name="search-analytics",
    ),
    path(
        "search/data-quality/",
        views.search_data_quality,
        name="search-data-quality",
    ),

    path("settings/", views.settings_view, name="settings"),
    path(
        "settings/disable/",
        views.settings_disable,
        name="settings-disable",
    ),

    path("usage/", views.usage, name="usage"),
    path("usage/recent/", views.usage_recent, name="usage-recent"),
    path("audit/", views.audit_log, name="audit-log"),
]