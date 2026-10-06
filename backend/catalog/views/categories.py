# catalog/views/categories.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductListSerializer,
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
# Categories
# ─────────────────────────────────────────────────────────────────────────────
class CategoryListView(generics.ListAPIView):
    """
    GET /api/catalog/categories/

    Powers the Sidebar and every consumer of `data/categories.ts`.
    Each item carries:
      id, name, slug, description, href, icon,
      productCount (int), itemCount ("2 items"), image, is_active

    By default this returns only ROOT categories (parent is null) so the
    sidebar doesn't flatten the hierarchy. Pass ?all=1 to get every
    category, or hit the admin endpoint for the nested tree.

    Note: the count returned here reflects the raw catalog total, not
    the storefront-filtered count. Hiding out-of-stock products does
    not change the badge number — customers see "Category (5)" even if
    only 4 are currently purchasable. This matches Shopify / Amazon
    behaviour and avoids confusing sidebar counts that shrink as stock
    fluctuates.
    """
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        qs = services.get_categories_with_counts()

        # Sidebar wants roots only; admin / pickers can request everything.
        if self.request.query_params.get("all") != "1":
            qs = qs.filter(parent__isnull=True)

        return qs

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class CategoryDetailView(APIView):
    """
    GET /api/catalog/categories/<slug>/

    Powers /pages/categories/<slug>. Response shape:

      {
        "category": { id, name, slug, href, icon, productCount, itemCount, image, ... },
        "products": [ ProductListSerializer, ... ]
      }

    Query params (already emitted by CategoriesLayout):
      ?q=      free text (name / brand)
      ?stock=  all | in-stock | low-stock
      ?sort=   featured | price-low | price-high | newest | rating

    The product list respects `inventory.hide_out_of_stock` and
    `inventory.allow_backorders` from Settings → Store, applied inside
    `services.get_products_for_category()`. The category's
    `productCount` / `itemCount` reflect the FILTERED list length, so
    the badge matches what the page shows.

    A direct link to a category that has zero purchasable products
    still renders (empty list), because the category itself exists.
    """

    def get(self, request, slug):
        category = services.get_category_by_slug(slug)
        if not category:
            return Response(
                {"detail": "Category not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        products = services.get_products_for_category(
            category,
            search=request.query_params.get("q"),
            stock=request.query_params.get("stock"),
            sort_by=request.query_params.get("sort", "featured"),
        )

        # Annotate the category with the filtered count so the serializer's
        # productCount / itemCount reflect what the page actually shows,
        # not the unfiltered total — and match the sidebar's serialiser shape.
        category.product_count = products.count()

        return _attach_currency(Response(
            {
                "category": CategorySerializer(
                    category, context={"request": request}
                ).data,
                "products": ProductListSerializer(
                    products, many=True, context={"request": request}
                ).data,
            }
        ))


class BrandListView(generics.ListAPIView):
    """
    GET /api/catalog/brands/

    All active brands, ordered by name. Used by any dropdown that lets the
    user filter the full catalog by brand. Distinct from
    `DealFilterBrandListView`, which only returns brands that currently have
    a deal running.
    """
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_brands()

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))