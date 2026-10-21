from django.urls import path

from .views import AnalyticsView, DiscountAdminViewSet, RulesView


urlpatterns = [
    path(
        "analytics/",
        AnalyticsView.as_view(),
        name="discount-analytics",
    ),
    path(
        "rules/",
        RulesView.as_view(),
        name="discount-rules",
    ),
    path(
        "slow_moving/",
        DiscountAdminViewSet.as_view({"get": "slow_moving"}),
        name="discount-slow-moving",
    ),
    path(
        "bulk_clearance/",
        DiscountAdminViewSet.as_view({"post": "bulk_clearance"}),
        name="discount-bulk-clearance",
    ),
    path(
        "upload_media/",
        DiscountAdminViewSet.as_view({"post": "upload_media"}),
        name="discount-upload-media",
    ),
    path(
        "",
        DiscountAdminViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="discount-list",
    ),
    path(
        "<str:id>/",
        DiscountAdminViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="discount-detail",
    ),
    path(
        "<str:id>/duplicate/",
        DiscountAdminViewSet.as_view({"post": "duplicate"}),
        name="discount-duplicate",
    ),
    path(
        "<str:id>/pause/",
        DiscountAdminViewSet.as_view({"post": "pause"}),
        name="discount-pause",
    ),
    path(
        "<str:id>/resume/",
        DiscountAdminViewSet.as_view({"post": "resume"}),
        name="discount-resume",
    ),
]