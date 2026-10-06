# catalog/views/new_arrivals.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.serializers import (
    NewArrivalProductSerializer,
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
# New arrivals — list
# ─────────────────────────────────────────────────────────────────────────────
class NewArrivalListView(generics.ListAPIView):
    """
    GET /api/catalog/new-arrivals/

    Query params (all optional, mirror the page controls):
      ?search=       free text (name / brand / description)
      ?category=     exact category name or "All"
      ?brand=        exact brand name or "All"
      ?min_price=    inclusive lower bound (e.g. 20000)
      ?max_price=    inclusive upper bound (e.g. 300000)
      ?stock=        In Stock | Low Stock | Out of Stock | All
      ?sort_by=      newest | price-low | price-high | rating
      ?limit=        8 (default) — pass limit=0 to return all
      ?window_days=  90 (default) — how far back "new" goes

    The service applies `inventory.hide_out_of_stock` and
    `inventory.allow_backorders` from Settings → Store inside
    `services.filter_new_arrivals()`, so this view does not touch
    those settings directly.
    """
    serializer_class = NewArrivalProductSerializer
    pagination_class = None   # frontend shows one shot

    def get_queryset(self):
        p = self.request.query_params

        limit_raw = p.get("limit")
        if limit_raw is None:
            limit = services.NEW_ARRIVALS_LIMIT
        else:
            try:
                limit = max(0, int(limit_raw))
            except ValueError:
                limit = services.NEW_ARRIVALS_LIMIT

        window_raw = p.get("window_days")
        try:
            window = (
                int(window_raw)
                if window_raw is not None
                else services.NEW_ARRIVALS_WINDOW_DAYS
            )
        except ValueError:
            window = services.NEW_ARRIVALS_WINDOW_DAYS

        return services.filter_new_arrivals(
            search=p.get("search"),
            category=p.get("category"),
            brand=p.get("brand"),
            min_price=p.get("min_price"),
            max_price=p.get("max_price"),
            stock=p.get("stock"),
            sort_by=p.get("sort_by", "newest"),
            limit=limit or None,
            window_days=window or None,
        )

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# New arrivals — detail (modal)
# ─────────────────────────────────────────────────────────────────────────────
class NewArrivalDetailView(APIView):
    """
    GET /api/catalog/new-arrivals/<product_id>/

    Payload for the details modal.

    Deliberately does NOT apply the hide filter — a customer who
    followed a direct link should still see the product page (rendered
    as "out of stock" or "pre-order"). The hide rule is a discoverability
    filter, not a content-access filter.
    """

    def get(self, request, product_id):
        product = services.get_new_arrival_by_id(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return _attach_currency(Response(
            NewArrivalProductSerializer(
                product, context={"request": request}
            ).data
        ))


# ─────────────────────────────────────────────────────────────────────────────
# Filter dropdowns
# ─────────────────────────────────────────────────────────────────────────────
class FilterCategoryListView(generics.ListAPIView):
    """GET /api/catalog/categories/ — powers the category chip row."""
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