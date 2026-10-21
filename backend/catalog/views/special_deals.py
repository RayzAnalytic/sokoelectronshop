# catalog/views/special_deals.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from catalog.serializers import (
    DealCardSerializer,
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


class SpecialDealListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        p = request.query_params
        cards = services.get_filtered_deal_cards(
            request=request,
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


class SpecialDealDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        card = services.get_deal_card_for_product(
            product_id,
            request=request,
        )
        if not card:
            return Response(
                {"detail": "No active deal for this product."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return _attach_currency(Response(DealCardSerializer(card).data))


class DealFilterCategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_deal_categories(request=self.request)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class DealFilterBrandListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = BrandSerializer
    pagination_class = None

    def get_queryset(self):
        return services.get_deal_brands(request=self.request)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))