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
        "<str:id>/",                                       # ← was <str:pk>
        CategoryAdminViewSet.as_view({
            "get": "retrieve",
            "patch": "partial_update",
            "put": "update",
            "delete": "destroy",
        }),
        name="admin-categories-detail",
    ),
]
