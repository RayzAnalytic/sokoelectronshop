from django.urls import path

from catalog.views import (
    # Categories & brands
    CategoryListView,
    CategoryDetailView,
    BrandListView,
    # Products
    ProductListView,
    ProductDetailView,
    RelatedProductsView,
    ProductReviewListView,
    # New arrivals
    NewArrivalListView,
    NewArrivalDetailView,
    # Best selling
    BestSellingListView,
    BestSellingDetailView,
    BestSellingRelatedView,
    BestSellingReviewListView,
    # Special deals
    SpecialDealListView,
    SpecialDealDetailView,
    DealFilterCategoryListView,
    DealFilterBrandListView,
)

app_name = "catalog"

urlpatterns = [
    # ── Categories & brands ────────────────────────────────────────
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path(
        "categories/<slug:slug>/",
        CategoryDetailView.as_view(),
        name="category-detail",
    ),
    path("brands/", BrandListView.as_view(), name="brand-list"),

    # ── Products ───────────────────────────────────────────────────
    # Review and related routes are declared BEFORE the generic
    # `<str:product_id>/` detail route. Django anchors each pattern at
    # the end of the path, so the generic route would not actually match
    # `products/foo/reviews/` — but listing the specific suffixes first
    # is defensive: if the generic pattern ever changes to `<path:...>`
    # or the anchors get loosened, the specific routes won't be
    # shadowed.
    path("products/", ProductListView.as_view(), name="product-list"),
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

    # ── New arrivals ───────────────────────────────────────────────
    path("new-arrivals/", NewArrivalListView.as_view(), name="new-arrivals-list"),
    path(
        "new-arrivals/<str:product_id>/",
        NewArrivalDetailView.as_view(),
        name="new-arrivals-detail",
    ),

    # ── Best selling ───────────────────────────────────────────────
    # Same ordering rationale as the products block: specific suffixes
    # (related/, reviews/) before the generic detail route.
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

    # ── Special deals ──────────────────────────────────────────────
    # Literal filter routes (categories/, brands/) come before the
    # generic `<str:product_id>/`. The str converter would reject both
    # literals anyway, but ordering matches the pattern used elsewhere
    # in this file.
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