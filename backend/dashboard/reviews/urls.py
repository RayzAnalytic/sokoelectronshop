from django.urls import path

from .views import ReviewModerationViewSet


urlpatterns = [
    path(
        "stats/",
        ReviewModerationViewSet.as_view({"get": "stats"}),
        name="admin-reviews-stats",
    ),
    path(
        "bulk/",
        ReviewModerationViewSet.as_view({"post": "bulk"}),
        name="admin-reviews-bulk",
    ),
    path(
        "",
        ReviewModerationViewSet.as_view({
            "get": "list",
        }),
        name="admin-reviews-list",
    ),
    path(
        "<int:pk>/",
        ReviewModerationViewSet.as_view({
            "get": "retrieve",
            "delete": "destroy",
        }),
        name="admin-reviews-detail",
    ),
    path(
        "<int:pk>/approve/",
        ReviewModerationViewSet.as_view({"post": "approve"}),
        name="admin-reviews-approve",
    ),
    path(
        "<int:pk>/reject/",
        ReviewModerationViewSet.as_view({"post": "reject"}),
        name="admin-reviews-reject",
    ),
    path(
        "<int:pk>/flag/",
        ReviewModerationViewSet.as_view({"post": "flag"}),
        name="admin-reviews-flag",
    ),
    path(
        "<int:pk>/resolve-flag/",
        ReviewModerationViewSet.as_view({"post": "resolve_flag"}),
        name="admin-reviews-resolve-flag",
    ),
    path(
        "<int:pk>/replies/",
        ReviewModerationViewSet.as_view({"post": "create_reply"}),
        name="admin-reviews-replies",
    ),
    path(
        "<int:pk>/helpful/",
        ReviewModerationViewSet.as_view({"post": "helpful"}),
        name="admin-reviews-helpful",
    ),
]