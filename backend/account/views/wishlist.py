from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import WishlistItem
from ..serializers import (
    WishlistAddSerializer,
    WishlistBatchAddSerializer,
    WishlistBatchCheckSerializer,
    WishlistCheckSerializer,
    WishlistItemSerializer,
)
from ..services import bulk_merge_wishlist


class WishlistListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = WishlistItem.objects.filter(user=request.user)
        return Response(WishlistItemSerializer(qs, many=True).data)

    def post(self, request):
        ser = WishlistAddSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        defaults = {
            "product_id": data["product_id"],
            "product_name": data["product_name"],
            "product_slug": data.get("product_slug", ""),
            "product_brand": data.get("product_brand", ""),
            "product_image": data.get("product_image", ""),
            "variant_name": data.get("variant_name", ""),
            "variant_image": data.get("variant_image", ""),
            "unit_price": data["unit_price"],
            "compare_at_price": data.get("compare_at_price"),
            "stock": data.get("stock", WishlistItem.Stock.IN),
            "stock_count": data.get("stock_count", 0),
            "discount_percent": data.get("discount_percent", 0),
            "rating": data.get("rating", 0),
            "review_count": data.get("review_count", 0),
        }

        try:
            with transaction.atomic():
                item, created = WishlistItem.objects.update_or_create(
                    user=request.user,
                    variant_id=data["variant_id"],
                    defaults=defaults,
                )
        except IntegrityError:
            item = (
                WishlistItem.objects
                .filter(user=request.user, variant_id=data["variant_id"])
                .first()
            )
            if item is None:
                raise
            created = False

        return Response(
            WishlistItemSerializer(item).data,
            status=(
                status.HTTP_201_CREATED if created else status.HTTP_200_OK
            ),
        )


class WishlistCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        variant_id = request.query_params.get("variant_id", "").strip()
        if not variant_id:
            return Response(
                {"in_wishlist": False, "wishlist_item_id": None}
            )

        item = (
            WishlistItem.objects
            .filter(user=request.user, variant_id=variant_id)
            .only("id")
            .first()
        )

        return Response(
            WishlistCheckSerializer(
                {
                    "in_wishlist": item is not None,
                    "wishlist_item_id": item.pk if item else None,
                }
            ).data
        )


class WishlistBatchCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = WishlistBatchCheckSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        variant_ids = ser.validated_data["variant_ids"]

        if not variant_ids:
            return Response({"in_wishlist": {}})

        found = set(
            WishlistItem.objects
            .filter(user=request.user, variant_id__in=variant_ids)
            .values_list("variant_id", flat=True)
        )

        return Response(
            {"in_wishlist": {v: v in found for v in variant_ids}}
        )


class WishlistBulkAddView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "wishlist_bulk_add"

    def post(self, request):
        ser = WishlistBatchAddSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        items = ser.validated_data["items"]

        added = bulk_merge_wishlist(request.user, items)
        return Response(
            {"added": added, "skipped": len(items) - added},
            status=status.HTTP_200_OK,
        )


class WishlistDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        item = get_object_or_404(
            WishlistItem, pk=pk, user=request.user
        )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistByVariantView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, variant_id):
        WishlistItem.objects.filter(
            user=request.user, variant_id=variant_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistClearView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        deleted, _ = WishlistItem.objects.filter(
            user=request.user
        ).delete()
        return Response({"deleted": deleted})