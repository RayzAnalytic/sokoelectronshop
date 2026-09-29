from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Review
from ..serializers import ReviewSerializer, ReviewWriteSerializer


class ReviewListCreateView(APIView):
    def get(self, request):
        qs = Review.objects.filter(user=request.user)
        return Response(ReviewSerializer(qs, many=True).data)

    def post(self, request):
        ser = ReviewWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        product_id = (d.get("product_id") or "").strip()
        if not product_id:
            return Response(
                {"detail": "product_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Review.objects.filter(user=request.user, product_id=product_id).exists():
            return Response(
                {"detail": "You already reviewed this product."},
                status=status.HTTP_409_CONFLICT,
            )

        review = Review.objects.create(
            user=request.user,
            product_id=product_id,
            product_name=d.get("product_name", ""),
            product_slug=d.get("product_slug", ""),
            product_image=d.get("product_image", ""),
            product_brand=d.get("product_brand", ""),
            variant_label=d.get("variant_label", ""),
            rating=d["rating"],
            title=d.get("title", ""),
            body=d["body"],
            images=d.get("images", []),
            is_verified_purchase=self._verify_purchase(request.user, product_id),
        )
        return Response(
            ReviewSerializer(review).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _verify_purchase(user, product_id: str) -> bool:
        from checkout.models import OrderItem
        return OrderItem.objects.filter(
            order__user=user,
            product_id=product_id,
        ).exists()


class ReviewDetailView(APIView):
    def get(self, request, pk):
        review = get_object_or_404(Review, pk=pk, user=request.user)
        return Response(ReviewSerializer(review).data)

    def patch(self, request, pk):
        review = get_object_or_404(Review, pk=pk, user=request.user)

        ser = ReviewWriteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        for f in ("rating", "title", "body", "variant_label", "images"):
            if f in d:
                setattr(review, f, d[f])

        # Any edit resets moderation — the review goes back to pending.
        review.status = Review.Status.PENDING
        review.rejection_reason = ""
        review.moderated_at = None
        review.save()

        return Response(ReviewSerializer(review).data)

    def delete(self, request, pk):
        get_object_or_404(Review, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)