# catalog/views/best_selling.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from account.models import Review as AccountReview
from catalog.models import Product
from catalog.serializers import (
    BestSellerProductSerializer,
    RelatedProductSerializer,
    ReviewSerializer,
    CategorySerializer,
    BrandSerializer,
)
from catalog import services


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────
def _currency() -> str:
    """
    Read the shop's currency from the cached settings bundle.

    Fails safe to KES during migrations / cold boot so management
    commands and tests that touch views don't crash.
    """
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    """Add the shop currency header to any Response object."""
    response['X-Shop-Currency'] = _currency()
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Best selling — list
# ─────────────────────────────────────────────────────────────────────────────
class BestSellingListView(generics.ListAPIView):
    """
    GET /api/catalog/best-selling/

    Query params (all optional, mirror the page controls):
      ?search=         free text
      ?category=       exact category name or "All"
      ?brand=          exact brand name or "All"
      ?price_range=    under-5000 | 5000-20000 | 20000-50000 | over-50000 | All
      ?stock=          In Stock | Low Stock | Out of Stock | All
      ?sort_by=        best-selling | price-low-high | price-high-low | rating
      ?limit=          8 (default) — pass limit=0 for no cap

    The service applies `hide_out_of_stock` and `allow_backorders`
    internally, so this view does not touch those settings.
    """
    serializer_class = BestSellerProductSerializer
    pagination_class = None   # frontend caps at 8; page here is one shot

    def get_queryset(self):
        p = self.request.query_params
        limit_raw = p.get("limit")
        if limit_raw is None:
            limit = services.BEST_SELLERS_LIMIT
        else:
            try:
                limit = max(0, int(limit_raw))
            except ValueError:
                limit = services.BEST_SELLERS_LIMIT

        return services.filter_best_sellers(
            search=p.get("search"),
            category=p.get("category"),
            brand=p.get("brand"),
            price_range=p.get("price_range"),
            stock=p.get("stock"),
            sort_by=p.get("sort_by", "best-selling"),
            limit=limit or None,
        )

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# Best selling — detail (modal)
# ─────────────────────────────────────────────────────────────────────────────
class BestSellingDetailView(APIView):
    """
    GET /api/catalog/best-selling/<product_id>/

    Full payload for the modal + related rail. Does NOT apply the
    hide filter — a direct link should still render the detail view.
    """

    def get(self, request, product_id):
        product = services.get_best_seller_by_id(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        related = services.get_related_products(product)

        return _attach_currency(Response(
            {
                "product": BestSellerProductSerializer(
                    product, context={"request": request}
                ).data,
                "related": RelatedProductSerializer(
                    related, many=True, context={"request": request}
                ).data,
            }
        ))


# ─────────────────────────────────────────────────────────────────────────────
# Best selling — related rail
# ─────────────────────────────────────────────────────────────────────────────
class BestSellingRelatedView(generics.ListAPIView):
    """GET /api/catalog/best-selling/<product_id>/related/"""
    serializer_class = RelatedProductSerializer
    pagination_class = None

    def get_queryset(self):
        product = services.get_best_seller_by_id(self.kwargs["product_id"])
        if not product:
            return Product.objects.none()
        return services.get_related_products(product)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# Best selling — reviews (read-only)
# ─────────────────────────────────────────────────────────────────────────────
class BestSellingReviewListView(generics.ListAPIView):
    """
    GET /api/catalog/best-selling/<product_id>/reviews/

    Read-only. The write path lives at
    `POST /api/v1/account/reviews/` — see `account.views` for the
    create endpoint.

    The service layer honors `reviews.reviews_enabled` from Settings →
    Store. When reviews are off, `get_reviews_for_product()` returns an
    empty queryset, so this view returns `[]` — no branching needed.
    """
    serializer_class = ReviewSerializer
    pagination_class = None

    def get_product(self):
        return services.get_best_seller_by_id(self.kwargs["product_id"])

    def get_queryset(self):
        product = self.get_product()
        if not product:
            return AccountReview.objects.none()
        return services.get_reviews_for_product(product)

    def list(self, request, *args, **kwargs):
        """
        Return a clean 404 when the product doesn't exist, so the
        storefront can tell "product missing" from "product has no
        published reviews" (which is a 200 with `[]`).
        """
        if not self.get_product():
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return _attach_currency(super().list(request, *args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# Filter dropdowns
# ─────────────────────────────────────────────────────────────────────────────
class FilterCategoryListView(generics.ListAPIView):
    """
    GET /api/catalog/categories/ — powers the category dropdown.

    Previously used `queryset = services.get_categories`, which DRF
    cannot evaluate (it expects a QuerySet or a callable that returns
    one when called with no arguments). Switching to `get_queryset()`
    is the correct pattern.
    """
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_categories()

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class FilterBrandListView(generics.ListAPIView):
    """GET /api/catalog/brands/ — powers the brand dropdown."""
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_brands()

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))