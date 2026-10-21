from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from account.models import Review as AccountReview

from catalog.models import Product
from catalog.serializers import (
    ProductDetailSerializer,
    ProductListSerializer,
    ReviewSerializer,
    ReviewCreateSerializer,
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


class ProductPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 100


class ProductListView(generics.ListAPIView):
    permission_classes = [AllowAny]
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


class ProductDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        product = services.get_product_by_id(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        services.increment_product_views(product.id)

        related = services.get_related_products(product)
        serializer = ProductDetailSerializer(
            product,
            context={"request": request, "related_products": related},
        )
        return _attach_currency(Response(serializer.data))


class ProductLookupView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        sku = (request.query_params.get("sku") or "").strip()
        barcode = (request.query_params.get("barcode") or "").strip()

        if not sku and not barcode:
            return Response(
                {"detail": "Provide either `sku` or `barcode`."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product = None
        if sku:
            product = services.get_product_by_sku(sku)
        if product is None and barcode:
            product = services.get_product_by_barcode(barcode)

        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ProductListSerializer(
            product,
            context={"request": request},
        )
        return _attach_currency(Response(serializer.data))


class RelatedProductsView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ProductListSerializer
    pagination_class = None

    def get_queryset(self):
        product = services.get_product_by_id(self.kwargs["product_id"])
        if not product:
            return Product.objects.none()
        return services.get_related_products(product)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class ProductReviewListView(APIView):
    permission_classes = [AllowAny]

    def _get_product(self, product_id):
        return services.get_product_by_id(product_id)

    def get(self, request, product_id):
        product = self._get_product(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        qs = services.get_reviews_for_product(product)
        return _attach_currency(Response(
            ReviewSerializer(qs, many=True, context={"request": request}).data
        ))

    def post(self, request, product_id):
        product = self._get_product(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        primary_image = ""
        first_img = product.images.first()
        if first_img is not None:
            if first_img.external_url:
                primary_image = first_img.external_url
            elif first_img.image:
                primary_image = request.build_absolute_uri(first_img.image.url)

        user = request.user if request.user.is_authenticated else None

        review = AccountReview.objects.create(
            user=user,
            guest_author_name="" if user else serializer.validated_data["author"],
            product_id=product.id,
            product_name=product.name,
            product_slug=product.slug,
            product_image=primary_image,
            product_brand=product.brand.name if product.brand_id else "",
            rating=serializer.validated_data["rating"],
            title=serializer.validated_data.get("title", ""),
            body=serializer.validated_data["body"],
            status=AccountReview.Status.PUBLISHED,
            is_verified_purchase=False,
        )

        return _attach_currency(Response(
            ReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        ))
     