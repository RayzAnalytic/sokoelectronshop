# catalog/urls.py

from django.urls import path

from .views import (
    CategoryDetailView,
    CategoryListView,
    ProductDetailView,
    ProductListView,
)

app_name = "catalog"

urlpatterns = [
    # Categories
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path(
        "categories/<uuid:id>/",
        CategoryDetailView.as_view(),
        name="category-detail",
    ),

    # Products
    path("products/", ProductListView.as_view(), name="product-list"),
    path(
        "products/<uuid:id>/",
        ProductDetailView.as_view(),
        name="product-detail",
    ),
]