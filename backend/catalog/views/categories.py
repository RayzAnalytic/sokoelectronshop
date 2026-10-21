# catalog/views/categories.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from catalog.serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductListSerializer,
)
from catalog import services


def _currency() -> str:
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    response['X-Shop-Currency'] = _currency()
    return response


class CategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        qs = services.get_categories_with_counts()

        if self.request.query_params.get("all") != "1":
            qs = qs.filter(parent__isnull=True)

        return qs

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class CategoryDetailView(APIView):
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_brands()

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))