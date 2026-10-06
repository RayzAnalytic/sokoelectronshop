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
        "<str:id>/",                                       # ← was <str:pk>
        BrandAdminViewSet.as_view({
            "get": "retrieve",
            "patch": "partial_update",
            "put": "update",
            "delete": "destroy",
        }),
        name="admin-brands-detail",
    ),
    path(
        "<str:id>/toggle-featured/",                       # ← was <str:pk>
        BrandAdminViewSet.as_view({"post": "toggle_featured"}),
        name="admin-brands-toggle-featured",
    ),
]
