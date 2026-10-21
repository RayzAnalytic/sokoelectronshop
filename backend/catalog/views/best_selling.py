# catalog/views/best_selling.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from account.models import Review as AccountReview
from catalog.models import Product
from catalog.serializers import (
    BestSellerProductSerializer,
    RelatedProductSerializer,
    ReviewSerializer,
    ReviewCreateSerializer,
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


class BestSellingListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = BestSellerProductSerializer
    pagination_class = None

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


class BestSellingDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        product = services.get_best_seller_by_id(product_id)
        if not product:
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        related = services.get_best_seller_related_products(product)

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


class BestSellingRelatedView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = RelatedProductSerializer
    pagination_class = None

    def get_queryset(self):
        product = services.get_best_seller_by_id(self.kwargs["product_id"])
        if not product:
            return Product.objects.none()
        return services.get_best_seller_related_products(product)

    def list(self, request, *args, **kwargs):
        return _attach_currency(super().list(request, *args, **kwargs))


class BestSellingReviewListView(generics.ListCreateAPIView):
    permission_classes = [AllowAny]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ReviewCreateSerializer
        return ReviewSerializer

    def get_product(self):
        return services.get_best_seller_by_id(self.kwargs["product_id"])

    def get_queryset(self):
        product = self.get_product()
        if not product:
            return AccountReview.objects.none()
        return services.get_reviews_for_product(product)

    def list(self, request, *args, **kwargs):
        if not self.get_product():
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return _attach_currency(super().list(request, *args, **kwargs))

    def create(self, request, *args, **kwargs):
        product = self.get_product()
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