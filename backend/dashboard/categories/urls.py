from django.urls import path

from .views import CategoryAdminViewSet


urlpatterns = [
    path(
        "",
        CategoryAdminViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="admin-categories-list",
    ),
    path(
        "<str:id>/",
        CategoryAdminViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="admin-categories-detail",
    ),
]
