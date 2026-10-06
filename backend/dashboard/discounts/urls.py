# dashboard/discounts/urls.py

"""
URL table for the dashboard discounts API.

Mounted under `/api/v1/admin/discounts/` in `config/urls.py`.

Order matters:
  1. Literal routes (`analytics/`, `rules/`) go first so they aren't
     shadowed by the router's dynamic `<id>/` pattern.
  2. The router comes last and handles list/create/retrieve/update/
     destroy plus the custom `<id>/duplicate/`, `<id>/pause/`, etc.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AnalyticsView, DiscountAdminViewSet, RulesView


router = DefaultRouter()
router.register("", DiscountAdminViewSet, basename="discount-admin")


urlpatterns = [
    # Literal routes first — must come before the router.
    path("analytics/", AnalyticsView.as_view(), name="discount-analytics"),
    path("rules/", RulesView.as_view(), name="discount-rules"),

    # Viewset routes — list, create, retrieve, update, destroy,
    # plus <id>/duplicate/, <id>/pause/, <id>/resume/,
    # plus slow_moving/ and bulk_clearance/.
    path("", include(router.urls)),
]