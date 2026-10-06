from django.urls import path

from .views import ProductAdminViewSet


urlpatterns = [
    path(
        "",
        ProductAdminViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="admin-products-list",
    ),
    path(
        "bulk/",
        ProductAdminViewSet.as_view({"post": "bulk"}),
        name="admin-products-bulk",
    ),
    path(
        "<str:id>/",                                       # ← was <str:pk>
        ProductAdminViewSet.as_view({
            "get": "retrieve",
            "patch": "partial_update",
            "put": "update",
            "delete": "destroy",
        }),
        name="admin-products-detail",
    ),
    path(
        "<str:id>/toggle-featured/",                       # ← was <str:pk>
        ProductAdminViewSet.as_view({"post": "toggle_featured"}),
        name="admin-products-toggle-featured",
    ),
    path(
        "<str:id>/toggle-best-seller/",                    # ← was <str:pk>
        ProductAdminViewSet.as_view({"post": "toggle_best_seller"}),
        name="admin-products-toggle-best-seller",
    ),
]