from django.urls import re_path

from .views import (
    AccountRefreshView,
    AccountSetActiveView,
    AccountView,
    AnalyticsAgentsView,
    AnalyticsCommerceView,
    AnalyticsCostView,
    AnalyticsFunnelView,
    AnalyticsSeriesView,
    AnalyticsSummaryView,
    AnalyticsView,
    AuditListView,
    AutomationListView,
    AutomationToggleView,
    BillingInvoicesView,
    BillingSummaryView,
    BotFlowPublishView,
    BotFlowView,
    BroadcastListView,
    BroadcastPauseView,
    BroadcastSendView,
    CampaignListView,
    CatalogItemBulkView,
    CatalogItemDetailView,
    CatalogItemListView,
    CatalogSyncView,
    CatalogView,
    CommerceCatalogueView,
    CommerceProductListView,
    CommerceProductSyncView,
    ConnectionConnectView,
    ConnectionDisconnectView,
    ConnectionReauthView,
    ConnectionView,
    ContactListView,
    ContactUnsubscribeView,
    ConversationAssignView,
    ConversationDetailView,
    ConversationListView,
    ConversationMessagesView,
    ConversationResolveView,
    ConversationSendMediaView,
    ConversationSendProductView,
    ConversationShareProductView,
    ConversationStatusView,
    HealthView,
    MessageLogListView,
    NotificationConfigDetailView,
    NotificationConfigListView,
    NotificationMarkReadView,
    NotificationsMarkAllReadView,
    NotificationsView,
    OrderListView,
    OverviewView,
    ProductSharePrepareView,
    QuickReplyListView,
    SegmentListView,
    SettingsView,
    TeamListView,
    TemplateDetailView,
    TemplateDisableView,
    TemplateListView,
    TemplatePauseView,
    TemplateSubmitView,
    TemplateSyncSingleView,
    TemplateSyncView,
    WebhookEventListView,
    WebhookEventReplayView,
    WhatsAppWebhookReceiver,
    WorkflowDetailView,
    WorkflowListView,
)


def api_path(route: str, view):
    """Matches both with and without a trailing slash so POST/PATCH never fail."""
    cleaned = route.strip("/")
    return re_path(rf"^{cleaned}/?$", view)


urlpatterns = [
    # ------------------------------------------------------------------
    # Topbar, Overview, Connection & Health
    # ------------------------------------------------------------------
    api_path("overview", OverviewView.as_view()),
    api_path("connection", ConnectionView.as_view()),
    api_path("connection/connect", ConnectionConnectView.as_view()),
    api_path("connection/reauth", ConnectionReauthView.as_view()),
    api_path("connection/disconnect", ConnectionDisconnectView.as_view()),
    api_path("health", HealthView.as_view()),

    # ------------------------------------------------------------------
    # Analytics (Full page + Legacy endpoints)
    # ------------------------------------------------------------------
    api_path("analytics", AnalyticsView.as_view()),
    api_path("analytics/summary", AnalyticsSummaryView.as_view()),
    api_path("analytics/series", AnalyticsSeriesView.as_view()),
    api_path("analytics/cost-breakdown", AnalyticsCostView.as_view()),
    api_path("analytics/funnel", AnalyticsFunnelView.as_view()),
    api_path("analytics/agents", AnalyticsAgentsView.as_view()),
    api_path("analytics/commerce", AnalyticsCommerceView.as_view()),

    # ------------------------------------------------------------------
    # Commerce & Campaigns
    # ------------------------------------------------------------------
    api_path("commerce/catalogue", CommerceCatalogueView.as_view()),
    api_path("commerce/products", CommerceProductListView.as_view()),
    api_path(r"commerce/products/(?P<pk>\d+)/sync", CommerceProductSyncView.as_view()),
    api_path("products/share", ProductSharePrepareView.as_view()),
    api_path("campaigns", CampaignListView.as_view()),

    # ------------------------------------------------------------------
    # Messages, Templates, Notification Config, Workflows & Logs
    # ------------------------------------------------------------------
    api_path("templates", TemplateListView.as_view()),
    api_path("templates/sync", TemplateSyncView.as_view()),
    api_path(r"templates/(?P<pk>\d+)", TemplateDetailView.as_view()),
    api_path(r"templates/(?P<pk>\d+)/sync", TemplateSyncSingleView.as_view()),
    api_path(r"templates/(?P<pk>\d+)/disable", TemplateDisableView.as_view()),
    api_path(r"templates/(?P<pk>\d+)/submit", TemplateSubmitView.as_view()),
    api_path(r"templates/(?P<pk>\d+)/pause", TemplatePauseView.as_view()),

    api_path("notifications/config", NotificationConfigListView.as_view()),
    api_path(r"notifications/config/(?P<pk>\d+)", NotificationConfigDetailView.as_view()),

    api_path("workflows", WorkflowListView.as_view()),
    api_path(r"workflows/(?P<pk>\d+)", WorkflowDetailView.as_view()),

    api_path("messages/logs", MessageLogListView.as_view()),

    # ------------------------------------------------------------------
    # Inbox & Conversations
    # ------------------------------------------------------------------
    api_path("conversations", ConversationListView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)", ConversationDetailView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/messages", ConversationMessagesView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/share-product", ConversationShareProductView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/status", ConversationStatusView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/assign", ConversationAssignView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/send-media", ConversationSendMediaView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/send-product", ConversationSendProductView.as_view()),
    api_path(r"conversations/(?P<pk>\d+)/resolve", ConversationResolveView.as_view()),

    # ------------------------------------------------------------------
    # Legacy Account, Catalog, Automations, Broadcasts, Billing, Webhooks, Bot
    # ------------------------------------------------------------------
    api_path("account", AccountView.as_view()),
    api_path("account/refresh", AccountRefreshView.as_view()),
    api_path("account/set-active", AccountSetActiveView.as_view()),
    api_path("account/settings", SettingsView.as_view()),
    api_path("account/team", TeamListView.as_view()),
    api_path("account/audit", AuditListView.as_view()),
    api_path("account/notifications", NotificationsView.as_view()),
    api_path("account/notifications/mark-all-read", NotificationsMarkAllReadView.as_view()),
    api_path(r"account/notifications/(?P<pk>\d+)/read", NotificationMarkReadView.as_view()),

    api_path("catalog", CatalogView.as_view()),
    api_path("catalog/sync", CatalogSyncView.as_view()),
    api_path("catalog/items", CatalogItemListView.as_view()),
    api_path("catalog/items/bulk", CatalogItemBulkView.as_view()),
    api_path(r"catalog/items/(?P<pk>\d+)", CatalogItemDetailView.as_view()),

    api_path("orders", OrderListView.as_view()),

    api_path("automations", AutomationListView.as_view()),
    api_path(r"automations/(?P<pk>\d+)/toggle", AutomationToggleView.as_view()),

    api_path("broadcasts", BroadcastListView.as_view()),
    api_path(r"broadcasts/(?P<pk>\d+)/send", BroadcastSendView.as_view()),
    api_path(r"broadcasts/(?P<pk>\d+)/pause", BroadcastPauseView.as_view()),

    api_path("contacts", ContactListView.as_view()),
    api_path(r"contacts/(?P<pk>\d+)/unsubscribe", ContactUnsubscribeView.as_view()),

    api_path("segments", SegmentListView.as_view()),
    api_path("quick-replies", QuickReplyListView.as_view()),

    api_path("billing/summary", BillingSummaryView.as_view()),
    api_path("billing/invoices", BillingInvoicesView.as_view()),

    api_path("webhooks/events", WebhookEventListView.as_view()),
    api_path(r"webhooks/events/(?P<pk>\d+)/replay", WebhookEventReplayView.as_view()),
    api_path("webhooks/receive", WhatsAppWebhookReceiver.as_view()),

    api_path("bot/flow", BotFlowView.as_view()),
    api_path("bot/flow/publish", BotFlowPublishView.as_view()),
]