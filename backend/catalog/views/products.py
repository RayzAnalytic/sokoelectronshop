# catalog/views/products.py
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from account.models import Review as AccountReview

from catalog.models import Product
from catalog.serializers import (
    ProductDetailSerializer,
    ProductListSerializer,
    ReviewSerializer,
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
# Pagination
# ─────────────────────────────────────────────────────────────────────────────
class ProductPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 100


# ─────────────────────────────────────────────────────────────────────────────
# Products — list
# ─────────────────────────────────────────────────────────────────────────────
class ProductListView(generics.ListAPIView):
    """
    GET /api/catalog/products/

    Query params:
      ?search=       free text (name / brand / category)
      ?category=     exact category name or "All"
      ?brand=        exact brand name or "All"
      ?price_range=  0-10000 | 10000-50000 | 50000-100000 | 100000-plus | All
      ?stock=        In Stock | Low Stock | Out of Stock | All
      ?sort_by=      featured | price-low | price-high | rating | newest
      ?page=1&page_size=8

    The service applies `inventory.hide_out_of_stock` and
    `inventory.allow_backorders` from Settings → Store inside
    `services.get_products()`, so this view does not touch those
    settings directly.
    """
    serializer_class = ProductListSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        p = self.request.query_params
        return services.get_products(
            search=p.get("search"),
            category=p.get("category"),
            brand=p.get("brand"),
            price_range=p.get("price_range"),
            stock=p.get("stock"),
            sort_by=p.get("sort_by", "featured"),
        )

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# Products — detail
# ─────────────────────────────────────────────────────────────────────────────
class ProductDetailView(APIView):
    """
    GET /api/catalog/products/<product_id>/

    Does NOT apply the hide filter — a customer who followed a direct
    link should still see the product page (rendered as "out of stock"
    or "pre-order"). The hide rule is a discoverability filter, not a
    content-access filter.

    The serializer emits `currency`, `stockLabel`, `lowStock`, and
    `weightUnit` so the frontend can format everything without a
    second request.
    """

    def get(self, request, product_id):
        product = services.get_product_by_id(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        related = services.get_related_products(product)
        serializer = ProductDetailSerializer(
            product,
            context={"request": request, "related_products": related},
        )
        return _attach_currency(Response(serializer.data))


# ─────────────────────────────────────────────────────────────────────────────
# Products — related rail
# ─────────────────────────────────────────────────────────────────────────────
class RelatedProductsView(generics.ListAPIView):
    """
    GET /api/catalog/products/<product_id>/related/

    Applies the hide filter (via `services.get_related_products`) because
    these are suggestions, not the user's direct target — showing a
    sold-out product in a recommendations rail is pointless.
    """
    serializer_class = ProductListSerializer
    pagination_class = None

    def get_queryset(self):
        product = services.get_product_by_id(self.kwargs["product_id"])
        if not product:
            return Product.objects.none()
        return services.get_related_products(product)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# Products — reviews (public, read-only)
# ─────────────────────────────────────────────────────────────────────────────
class ProductReviewListView(APIView):
    """
    GET /api/catalog/products/<product_id>/reviews/

    Public, read-only. Returns every PUBLISHED review for the product,
    newest first.

    The source model is `account.Review`, not the old `catalog.Review` —
    the latter was removed when the customer review write path moved to
    `/api/v1/account/reviews/`. That move was necessary because reviews
    need a User FK (for ownership, moderation, and notification) that
    `catalog.Review` never had.

    Settings awareness:
        `reviews.reviews_enabled` from Settings → Store is honored inside
        `services.get_reviews_for_product()` — when the shop owner turns
        reviews off, this endpoint returns `[]` without any branching here.

    The POST method this view used to expose is gone. Customers submit
    reviews through `POST /api/v1/account/reviews/`, which uses
    `account.serializers.ReviewWriteSerializer` to handle order lookup,
    verified-purchase computation, and moderation state.
    """

    def get(self, request, product_id):
        product = services.get_product_by_id(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        qs = services.get_reviews_for_product(product)
        return _attach_currency(Response(
            ReviewSerializer(qs, many=True, context={"request": request}).data
        ))