from django.urls import path

from .views import (
    # Webhook + cart + OTP (existing)
    verify_webhook,
    receive_webhook,
    CartHandoffView,
    CartSessionDetailView,
    OTPRequestView,
    OTPConfirmView,

    # Connection
    WhatsAppAccountView,
    WhatsAppAccountSetActiveView,
    WhatsAppAccountRefreshView,
    WhatsAppAccountProfileView,

    # Inbox
    ConversationListView,
    ConversationDetailView,
    ConversationMessageView,
    ConversationSendTemplateView,
    ConversationCreateOrderView,                              # ── ADDED
    ConversationSendCheckoutLinkView,                         # ── ADDED
    ConversationAssignView,
    ConversationResolveView,
    ConversationReopenView,
    ConversationTagView,
    ConversationNoteView,
    MessagePollView,

    # Templates
    TemplateListCreateView,
    TemplateDetailView,
    TemplateSubmitView,
    TemplateSyncView,

    # Automations
    AutomationListCreateView,
    AutomationDetailView,
    AutomationToggleView,

    # Broadcasts
    BroadcastListCreateView,
    BroadcastDetailView,
    BroadcastSendView,
    BroadcastPauseView,
    BroadcastStatsView,

    # Contacts
    ContactListView,
    ContactDetailView,
    ContactUnsubscribeView,

    # Analytics / Billing
    AnalyticsSummaryView,
    AnalyticsSeriesView,
    CostBreakdownView,
    BillingSummaryView,
    BillingRefreshView,
)

app_name = "whatsapp"

urlpatterns = [
    # ── Meta webhook ───────────────────────────────────────────────────────
    path("webhooks/whatsapp/",       verify_webhook,  name="webhook-verify"),
    path("webhooks/whatsapp/event/", receive_webhook, name="webhook-event"),

    # ── Cart handoff ───────────────────────────────────────────────────────
    path("cart-handoff/", CartHandoffView.as_view(), name="cart-handoff"),
    path("sessions/<uuid:token>/", CartSessionDetailView.as_view(),
         name="cart-session-detail"),

    # ── OTP ────────────────────────────────────────────────────────────────
    path("verify-number/",         OTPRequestView.as_view(), name="otp-request"),
    path("verify-number/confirm/", OTPConfirmView.as_view(), name="otp-confirm"),

    # ── Connection ─────────────────────────────────────────────────────────
    path("account/",             WhatsAppAccountView.as_view(),           name="account"),
    path("account/set-active/",  WhatsAppAccountSetActiveView.as_view(),  name="account-set-active"),
    path("account/refresh/",     WhatsAppAccountRefreshView.as_view(),    name="account-refresh"),
    path("account/profile/",     WhatsAppAccountProfileView.as_view(),    name="account-profile"),

    # ── Inbox ──────────────────────────────────────────────────────────────
    path("conversations/",                              ConversationListView.as_view(),        name="conversation-list"),
    path("conversations/<int:pk>/",                     ConversationDetailView.as_view(),      name="conversation-detail"),
    path("conversations/<int:pk>/messages/",            ConversationMessageView.as_view(),     name="conversation-messages"),
    path("conversations/<int:pk>/send-template/",       ConversationSendTemplateView.as_view(),name="conversation-send-template"),

    # ── Direct-orders integration (staff) ──────────────────────────────
    # Both endpoints back buttons in the admin inbox:
    #   * create-order/       — seller converts the chat into an Order
    #   * send-checkout-link/ — seller sends a WhatsApp checkout URL
    #
    # Staff-only via the view's permission_classes (IsAuthenticated at
    # present — swap to a stricter staff check if your User model has a
    # role flag distinct from `is_staff`).
    #
    # Route ordering: `<int:pk>/create-order/` and
    # `<int:pk>/send-checkout-link/` have an extra segment compared to
    # `<int:pk>/`, so they cannot collide with the detail pattern. Any
    # order in this list resolves correctly.
    path(
        "conversations/<int:pk>/create-order/",
        ConversationCreateOrderView.as_view(),
        name="conversation-create-order",
    ),
    path(
        "conversations/<int:pk>/send-checkout-link/",
        ConversationSendCheckoutLinkView.as_view(),
        name="conversation-send-checkout-link",
    ),

    path("conversations/<int:pk>/assign/",              ConversationAssignView.as_view(),      name="conversation-assign"),
    path("conversations/<int:pk>/resolve/",             ConversationResolveView.as_view(),     name="conversation-resolve"),
    path("conversations/<int:pk>/reopen/",              ConversationReopenView.as_view(),      name="conversation-reopen"),
    path("conversations/<int:pk>/tag/",                 ConversationTagView.as_view(),         name="conversation-tag"),
    path("conversations/<int:pk>/notes/",               ConversationNoteView.as_view(),        name="conversation-notes"),
    path("messages/poll/",                              MessagePollView.as_view(),             name="messages-poll"),

    # ── Templates ──────────────────────────────────────────────────────────
    path("templates/",                 TemplateListCreateView.as_view(), name="template-list"),
    path("templates/<int:pk>/",        TemplateDetailView.as_view(),     name="template-detail"),
    path("templates/<int:pk>/submit/", TemplateSubmitView.as_view(),     name="template-submit"),
    path("templates/sync/",            TemplateSyncView.as_view(),       name="template-sync"),

    # ── Automations ────────────────────────────────────────────────────────
    path("automations/",                 AutomationListCreateView.as_view(), name="automation-list"),
    path("automations/<int:pk>/",        AutomationDetailView.as_view(),     name="automation-detail"),
    path("automations/<int:pk>/toggle/", AutomationToggleView.as_view(),     name="automation-toggle"),

    # ── Broadcasts ─────────────────────────────────────────────────────────
    path("broadcasts/",                 BroadcastListCreateView.as_view(), name="broadcast-list"),
    path("broadcasts/<int:pk>/",        BroadcastDetailView.as_view(),     name="broadcast-detail"),
    path("broadcasts/<int:pk>/send/",   BroadcastSendView.as_view(),       name="broadcast-send"),
    path("broadcasts/<int:pk>/pause/",  BroadcastPauseView.as_view(),      name="broadcast-pause"),
    path("broadcasts/<int:pk>/stats/",  BroadcastStatsView.as_view(),      name="broadcast-stats"),

    # ── Contacts ───────────────────────────────────────────────────────────
    path("contacts/",                     ContactListView.as_view(),        name="contact-list"),
    path("contacts/<int:pk>/",            ContactDetailView.as_view(),      name="contact-detail"),
    path("contacts/<int:pk>/unsubscribe/",ContactUnsubscribeView.as_view(), name="contact-unsubscribe"),

    # ── Analytics ──────────────────────────────────────────────────────────
    path("analytics/summary/",        AnalyticsSummaryView.as_view(), name="analytics-summary"),
    path("analytics/series/",         AnalyticsSeriesView.as_view(),  name="analytics-series"),
    path("analytics/cost-breakdown/", CostBreakdownView.as_view(),    name="analytics-cost-breakdown"),

    # ── Billing ────────────────────────────────────────────────────────────
    path("billing/summary/", BillingSummaryView.as_view(), name="billing-summary"),
    path("billing/refresh/", BillingRefreshView.as_view(), name="billing-refresh"),
]