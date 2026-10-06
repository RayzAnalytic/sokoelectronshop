# dashboard/newsletter/urls.py
from django.urls import path

from .views import (
    SubscriberAdminViewSet,
    SubscriberListAdminViewSet,
    EmailTemplateAdminViewSet,
    CampaignAdminViewSet,
    SegmentListView,
    GrowthAnalyticsView,
    CampaignPerformanceView,
    AnalyticsSummaryView,
    CampaignImageUploadView,
)


urlpatterns = [
    # ── Subscribers ────────────────────────────────────────────────────
    path(
        "subscribers/",
        SubscriberAdminViewSet.as_view({
            "get":  "list",
            "post": "create",
        }),
        name="admin-newsletter-subscribers-list",
    ),
    path(
        "subscribers/stats/",
        SubscriberAdminViewSet.as_view({"get": "stats"}),
        name="admin-newsletter-subscribers-stats",
    ),
    path(
        "subscribers/<int:id>/",
        SubscriberAdminViewSet.as_view({
            "get":    "retrieve",
            "patch":  "partial_update",
            "put":    "update",
            "delete": "destroy",
        }),
        name="admin-newsletter-subscribers-detail",
    ),
    path(
        "subscribers/<int:id>/toggle-active/",
        SubscriberAdminViewSet.as_view({"post": "toggle_active"}),
        name="admin-newsletter-subscribers-toggle-active",
    ),

    # ── Lists ──────────────────────────────────────────────────────────
    path(
        "lists/",
        SubscriberListAdminViewSet.as_view({
            "get":  "list",
            "post": "create",
        }),
        name="admin-newsletter-lists-list",
    ),
    path(
        "lists/<int:id>/",
        SubscriberListAdminViewSet.as_view({
            "get":    "retrieve",
            "patch":  "partial_update",
            "put":    "update",
            "delete": "destroy",
        }),
        name="admin-newsletter-lists-detail",
    ),

    # ── Segments ───────────────────────────────────────────────────────
    path(
        "segments/",
        SegmentListView.as_view(),
        name="admin-newsletter-segments",
    ),

    # ── Templates ──────────────────────────────────────────────────────
    path(
        "templates/",
        EmailTemplateAdminViewSet.as_view({
            "get":  "list",
            "post": "create",
        }),
        name="admin-newsletter-templates-list",
    ),
    path(
        "templates/<int:id>/",
        EmailTemplateAdminViewSet.as_view({
            "get":    "retrieve",
            "patch":  "partial_update",
            "put":    "update",
            "delete": "destroy",
        }),
        name="admin-newsletter-templates-detail",
    ),

    # ── Campaigns ──────────────────────────────────────────────────────
    path(
        "campaigns/",
        CampaignAdminViewSet.as_view({
            "get":  "list",
            "post": "create",
        }),
        name="admin-newsletter-campaigns-list",
    ),
    path(
        "campaigns/<int:id>/",
        CampaignAdminViewSet.as_view({
            "get":    "retrieve",
            "patch":  "partial_update",
            "put":    "update",
            "delete": "destroy",
        }),
        name="admin-newsletter-campaigns-detail",
    ),
    path(
        "campaigns/<int:id>/send/",
        CampaignAdminViewSet.as_view({"post": "send"}),
        name="admin-newsletter-campaigns-send",
    ),
    path(
        "campaigns/<int:id>/pause/",
        CampaignAdminViewSet.as_view({"post": "pause"}),
        name="admin-newsletter-campaigns-pause",
    ),
    path(
        "campaigns/<int:id>/resume/",
        CampaignAdminViewSet.as_view({"post": "resume"}),
        name="admin-newsletter-campaigns-resume",
    ),
    path(
        "campaigns/<int:id>/status/",
        CampaignAdminViewSet.as_view({"get": "status"}),
        name="admin-newsletter-campaigns-status",
    ),
    path(
        "campaigns/<int:id>/recipients/",
        CampaignAdminViewSet.as_view({"get": "recipients"}),
        name="admin-newsletter-campaigns-recipients",
    ),

    # ── Analytics ──────────────────────────────────────────────────────
    path(
        "analytics/growth/",
        GrowthAnalyticsView.as_view(),
        name="admin-newsletter-analytics-growth",
    ),
    path(
        "analytics/campaigns/",
        CampaignPerformanceView.as_view(),
        name="admin-newsletter-analytics-campaigns",
    ),
    path(
        "analytics/summary/",
        AnalyticsSummaryView.as_view(),
        name="admin-newsletter-analytics-summary",
    ),

    # ── Uploads ────────────────────────────────────────────────────────
    path(
        "uploads/",
        CampaignImageUploadView.as_view(),
        name="admin-newsletter-uploads",
    ),
]