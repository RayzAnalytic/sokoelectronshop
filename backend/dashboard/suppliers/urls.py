from django.urls import path

from .views import SupplierViewSet

urlpatterns = [
    path(
        "",
        SupplierViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="admin-suppliers-list",
    ),
    path(
        "<int:pk>/",
        SupplierViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="admin-suppliers-detail",
    ),
    path(
        "<int:pk>/toggle-status/",
        SupplierViewSet.as_view({"post": "toggle_status"}),
        name="admin-suppliers-toggle-status",
    ),
    path(
        "<int:pk>/add-products/",
        SupplierViewSet.as_view({"post": "add_products"}),
        name="admin-suppliers-add-products",
    ),
    path(
        "<int:pk>/remove-product/<str:sp_id>/",
        SupplierViewSet.as_view({"post": "remove_product"}),
        name="admin-suppliers-remove-product",
    ),
    path(
        "<int:pk>/purchases/",
        SupplierViewSet.as_view({"post": "record_purchase"}),
        name="admin-suppliers-record-purchase",
    ),
]