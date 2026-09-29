from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import WishlistItem
from ..serializers import WishlistAddSerializer, WishlistItemSerializer


class WishlistListCreateView(APIView):
    """
    GET    /api/v1/account/wishlist/   → list
    POST   /api/v1/account/wishlist/   → add (idempotent on variant_id)
    """

    def get(self, request):
        qs = WishlistItem.objects.filter(user=request.user)
        return Response(WishlistItemSerializer(qs, many=True).data)

    def post(self, request):
        ser = WishlistAddSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        try:
            item, created = WishlistItem.objects.get_or_create(
                user=request.user,
                variant_id=d["variant_id"],
                defaults={
                    "product_id": d["product_id"],
                    "product_name": d["product_name"],
                    "product_slug": d.get("product_slug", ""),
                    "product_brand": d.get("product_brand", ""),
                    "product_image": d.get("product_image", ""),
                    "variant_name": d.get("variant_name", ""),
                    "variant_image": d.get("variant_image", ""),
                    "unit_price": d["unit_price"],
                    "compare_at_price": d.get("compare_at_price"),
                },
            )
        except IntegrityError:
            # Race: another request created it first.
            item = WishlistItem.objects.get(
                user=request.user,
                variant_id=d["variant_id"],
            )
            created = False

        return Response(
            WishlistItemSerializer(item).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WishlistDetailView(APIView):
    """
    DELETE /api/v1/account/wishlist/<pk>/   → remove one row
    """

    def delete(self, request, pk):
        WishlistItem.objects.filter(user=request.user, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistRemoveByVariantView(APIView):
    """
    DELETE /api/v1/account/wishlist/by-variant/<variant_id>/
    Used from product pages where only the variant id is known.
    """

    def delete(self, request, variant_id):
        WishlistItem.objects.filter(
            user=request.user,
            variant_id=variant_id,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistCheckView(APIView):
    """
    GET    /api/v1/account/wishlist/check/?variant_id=...
    Returns whether the given variant is saved.
    """

    def get(self, request):
        variant_id = request.query_params.get("variant_id")
        if not variant_id:
            return Response(
                {"detail": "variant_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item = WishlistItem.objects.filter(
            user=request.user,
            variant_id=variant_id,
        ).first()
        return Response({
            "in_wishlist": item is not None,
            "wishlist_item_id": item.id if item else None,
        })


class WishlistClearView(APIView):
    """
    DELETE /api/v1/account/wishlist/clear/   → remove all rows
    """

    def delete(self, request):
        deleted, _ = WishlistItem.objects.filter(user=request.user).delete()
        return Response({"deleted": deleted})