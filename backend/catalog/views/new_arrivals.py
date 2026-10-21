# catalog/views/new_arrivals.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from catalog.serializers import (
    NewArrivalProductSerializer,
    CategorySerializer,
    BrandSerializer,
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


class NewArrivalListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = NewArrivalProductSerializer
    pagination_class = None

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


class NewArrivalDetailView(APIView):
    permission_classes = [AllowAny]

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


class FilterCategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_categories()

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class FilterBrandListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_brands()

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))