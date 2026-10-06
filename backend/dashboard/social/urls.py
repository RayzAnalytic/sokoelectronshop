from django.urls import path

from .views import (
    AccountConnectView,
    AccountDisconnectView,
    AccountListView,
    EngagementAnalyticsView,
    FollowerAnalyticsView,
    MediaUploadView,
    OAuthCallbackView,
    PostDeleteView,
    PostListCreateView,
    PostPublishNowView,
)

app_name = "social"

urlpatterns = [
    # ── Accounts ─────────────────────────────────────────────────────────
    path("accounts/",                       AccountListView.as_view(),        name="account-list"),
    path("accounts/<str:platform>/connect/",    AccountConnectView.as_view(),    name="account-connect"),
    path("accounts/<str:platform>/disconnect/", AccountDisconnectView.as_view(), name="account-disconnect"),

    # ── Posts ────────────────────────────────────────────────────────────
    path("posts/",                    PostListCreateView.as_view(), name="post-list"),
    path("posts/<int:pk>/",           PostDeleteView.as_view(),     name="post-detail"),
    path("posts/<int:pk>/publish/",   PostPublishNowView.as_view(), name="post-publish"),

    # ── Media ────────────────────────────────────────────────────────────
    path("media/upload/",             MediaUploadView.as_view(),    name="media-upload"),

    # ── Analytics ────────────────────────────────────────────────────────
    path("analytics/followers/",      FollowerAnalyticsView.as_view(),   name="analytics-followers"),
    path("analytics/engagement/",     EngagementAnalyticsView.as_view(), name="analytics-engagement"),
]