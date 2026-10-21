from django.urls import path

from .views import BrandAdminViewSet


urlpatterns = [
    path(
        "",
        BrandAdminViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="admin-brands-list",
    ),
    path(
        "<str:id>/",
        BrandAdminViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="admin-brands-detail",
    ),
    path(
        "<str:id>/toggle-featured/",
        BrandAdminViewSet.as_view({"post": "toggle_featured"}),
        name="admin-brands-toggle-featured",
    ),
]
