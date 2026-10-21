# catalog/views/__init__.py
from .categories import (
    CategoryListView,
    CategoryDetailView,
    BrandListView,
)

from .products import (
    ProductListView,
    ProductDetailView,
    ProductLookupView,
    RelatedProductsView,
    ProductReviewListView,
)

from .new_arrivals import (
    NewArrivalListView,
    NewArrivalDetailView,
    FilterCategoryListView as NewArrivalFilterCategoryListView,
    FilterBrandListView as NewArrivalFilterBrandListView,
)

from .best_selling import (
    BestSellingListView,
    BestSellingDetailView,
    BestSellingRelatedView,
    BestSellingReviewListView,
    FilterCategoryListView as BestSellingFilterCategoryListView,
    FilterBrandListView as BestSellingFilterBrandListView,
)

from .special_deals import (
    SpecialDealListView,
    SpecialDealDetailView,
    DealFilterCategoryListView,
    DealFilterBrandListView,
)


__all__ = [
    "CategoryListView",
    "CategoryDetailView",
    "BrandListView",

    "ProductListView",
    "ProductDetailView",
    "ProductLookupView",
    "RelatedProductsView",
    "ProductReviewListView",

    "NewArrivalListView",
    "NewArrivalDetailView",
    "NewArrivalFilterCategoryListView",
    "NewArrivalFilterBrandListView",

    "BestSellingListView",
    "BestSellingDetailView",
    "BestSellingRelatedView",
    "BestSellingReviewListView",
    "BestSellingFilterCategoryListView",
    "BestSellingFilterBrandListView",

    "SpecialDealListView",
    "SpecialDealDetailView",
    "DealFilterCategoryListView",
    "DealFilterBrandListView",
]