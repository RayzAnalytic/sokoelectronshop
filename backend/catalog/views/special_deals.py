# catalog/views/special_deals.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.serializers import (
    DealCardSerializer,
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
# Special deals — list
# ─────────────────────────────────────────────────────────────────────────────
class SpecialDealListView(APIView):
    """
    GET /api/catalog/special-deals/

    Query params (all optional, mirror the page controls):
      ?search=           free text (name / brand / category)
      ?category=         exact category name or "All"
      ?brand=            exact brand name or "All"
      ?min_price=        inclusive lower bound on discounted price
      ?max_price=        inclusive upper bound on discounted price
      ?availability=     In Stock | Out of Stock | All
      ?discount_level=   10 | 15 | 20 | All     (min % off)
      ?sort_by=          Featured Deals | Biggest Discount |
                         Price: Low to High | Price: High to Low | Ending Soon

    Settings awareness
    ------------------
    Two settings affect this endpoint, both applied inside the service
    layer (`services.build_all_active_deal_cards`):

      1. `inventory.allow_backorders`
         When on, clearance cards whose stock hit zero stay visible with
         `inStock: true` — the frontend renders "Pre-order" instead of
         "Sold out". When off, those cards disappear the moment stock
         runs out, matching the classic clearance rule.

      2. `inventory.hide_out_of_stock`
         Applied to `resolve_applicable_products()` inside the service.
         When combined with backorders off, only purchasable products
         appear on the deals page.

    `X-Shop-Currency` is stamped on the response so the frontend can
    format discounted prices without a second request.
    """

    def get(self, request):
        p = request.query_params
        cards = services.get_filtered_deal_cards(
            request=request,                       # ← threads into build_deal_card
            search=p.get("search"),
            category=p.get("category"),
            brand=p.get("brand"),
            min_price=p.get("min_price"),
            max_price=p.get("max_price"),
            availability=p.get("availability"),
            discount_level=p.get("discount_level"),
            sort_by=p.get("sort_by", services.SORT_FEATURED),
        )
        serializer = DealCardSerializer(cards, many=True)
        return _attach_currency(Response(serializer.data))


# ─────────────────────────────────────────────────────────────────────────────
# Special deals — detail (modal)
# ─────────────────────────────────────────────────────────────────────────────
class SpecialDealDetailView(APIView):
    """
    GET /api/catalog/special-deals/<product_id>/

    Payload for the details modal (?open=<productId>).

    Deliberately does NOT apply the hide filter — a customer who
    followed a direct deal link should still see the modal (rendered
    as "Pre-order" or "Sold out" based on the `inStock` flag). The
    hide rule is a discoverability filter, not a content-access filter.

    When backorders are on, the `inStock` field on the returned card is
    `true` even at zero stock — the service layer flips it.
    """

    def get(self, request, product_id):
        card = services.get_deal_card_for_product(
            product_id,
            request=request,                       # ← absolute image URL
        )
        if not card:
            return Response(
                {"detail": "No active deal for this product."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return _attach_currency(Response(DealCardSerializer(card).data))


# ─────────────────────────────────────────────────────────────────────────────
# Special deals — filter dropdowns
#
# Both dropdowns are populated from the *currently active* deals, not the
# full catalog — so a user never selects a filter that returns zero results.
# The lists themselves don't change with settings, but the currency header
# is stamped for consistency with the rest of the catalog endpoints.
# ─────────────────────────────────────────────────────────────────────────────
class DealFilterCategoryListView(generics.ListAPIView):
    """GET /api/catalog/special-deals/categories/"""
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_deal_categories(request=self.request)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class DealFilterBrandListView(generics.ListAPIView):
    """GET /api/catalog/special-deals/brands/"""
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_deal_brands(request=self.request)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))