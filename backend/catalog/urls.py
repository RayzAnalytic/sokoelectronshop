from django.urls import path

from catalog.views import (
    CategoryListView,
    CategoryDetailView,
    BrandListView,
    ProductListView,
    ProductDetailView,
    ProductLookupView,
    RelatedProductsView,
    ProductReviewListView,
    NewArrivalListView,
    NewArrivalDetailView,
    BestSellingListView,
    BestSellingDetailView,
    BestSellingRelatedView,
    BestSellingReviewListView,
    SpecialDealListView,
    SpecialDealDetailView,
    DealFilterCategoryListView,
    DealFilterBrandListView,
)

app_name = "catalog"

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path(
        "categories/<slug:slug>/",
        CategoryDetailView.as_view(),
        name="category-detail",
    ),
    path("brands/", BrandListView.as_view(), name="brand-list"),

    path("products/", ProductListView.as_view(), name="product-list"),
    path(
        "products/lookup/",
        ProductLookupView.as_view(),
        name="product-lookup",
    ),
    path(
        "products/<str:product_id>/reviews/",
        ProductReviewListView.as_view(),
        name="product-reviews",
    ),
    path(
        "products/<str:product_id>/related/",
        RelatedProductsView.as_view(),
        name="product-related",
    ),
    path(
        "products/<str:product_id>/",
        ProductDetailView.as_view(),
        name="product-detail",
    ),

    path("new-arrivals/", NewArrivalListView.as_view(), name="new-arrivals-list"),
    path(
        "new-arrivals/<str:product_id>/",
        NewArrivalDetailView.as_view(),
        name="new-arrivals-detail",
    ),

    path("best-selling/", BestSellingListView.as_view(), name="best-selling-list"),
    path(
        "best-selling/<str:product_id>/reviews/",
        BestSellingReviewListView.as_view(),
        name="best-selling-reviews",
    ),
    path(
        "best-selling/<str:product_id>/related/",
        BestSellingRelatedView.as_view(),
        name="best-selling-related",
    ),
    path(
        "best-selling/<str:product_id>/",
        BestSellingDetailView.as_view(),
        name="best-selling-detail",
    ),

    path("special-deals/", SpecialDealListView.as_view(), name="special-deals-list"),
    path(
        "special-deals/categories/",
        DealFilterCategoryListView.as_view(),
        name="special-deals-categories",
    ),
    path(
        "special-deals/brands/",
        DealFilterBrandListView.as_view(),
        name="special-deals-brands",
    ),
    path(
        "special-deals/<str:product_id>/",
        SpecialDealDetailView.as_view(),
        name="special-deals-detail",
    ),
]