"""
catalog/views/__init__.py

Re-exports every view class used by `catalog/urls.py`.

Two classes are defined in multiple view modules with the same name:
    FilterCategoryListView  →  best_selling.py and new_arrivals.py
    FilterBrandListView     →  best_selling.py and new_arrivals.py

Python would silently keep whichever import ran last, and the URL
config could end up pointing at the wrong class. To avoid that, the
copies from `new_arrivals.py` are re-exported with a suffix, and the
URL config imports them under those names.
"""

# ── Categories & brands ──────────────────────────────────────────────
from .categories import (
    CategoryListView,
    CategoryDetailView,
    BrandListView,
)

# ── Products ────────────────────────────────────────────────────────
from .products import (
    ProductListView,
    ProductDetailView,
    RelatedProductsView,
)

# ── Reviews (products page) ─────────────────────────────────────────
# The catalog side is read-only — writes live at
# `POST /api/v1/account/reviews/`. The class was renamed from
# `ProductReviewListCreateView` to `ProductReviewListView` to match.
from .reviews import ProductReviewListView

# ── New arrivals ────────────────────────────────────────────────────
from .new_arrivals import (
    NewArrivalListView,
    NewArrivalDetailView,
    FilterCategoryListView as NewArrivalFilterCategoryListView,
    FilterBrandListView as NewArrivalFilterBrandListView,
)

# ── Best selling ────────────────────────────────────────────────────
from .best_selling import (
    BestSellingListView,
    BestSellingDetailView,
    BestSellingRelatedView,
    BestSellingReviewListView,
    FilterCategoryListView as BestSellingFilterCategoryListView,
    FilterBrandListView as BestSellingFilterBrandListView,
)

# ── Special deals ───────────────────────────────────────────────────
from .special_deals import (
    SpecialDealListView,
    SpecialDealDetailView,
    DealFilterCategoryListView,
    DealFilterBrandListView,
)


__all__ = [
    # Categories & brands
    "CategoryListView",
    "CategoryDetailView",
    "BrandListView",

    # Products
    "ProductListView",
    "ProductDetailView",
    "RelatedProductsView",

    # Reviews
    "ProductReviewListView",

    # New arrivals
    "NewArrivalListView",
    "NewArrivalDetailView",
    "NewArrivalFilterCategoryListView",
    "NewArrivalFilterBrandListView",

    # Best selling
    "BestSellingListView",
    "BestSellingDetailView",
    "BestSellingRelatedView",
    "BestSellingReviewListView",
    "BestSellingFilterCategoryListView",
    "BestSellingFilterBrandListView",

    # Special deals
    "SpecialDealListView",
    "SpecialDealDetailView",
    "DealFilterCategoryListView",
    "DealFilterBrandListView",
]