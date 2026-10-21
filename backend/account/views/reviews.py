from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from django.utils.text import get_valid_filename

from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Review
from ..serializers import (
    PendingReviewItemSerializer,
    ReviewRowSerializer,
    ReviewWriteSerializer,
)
from ..services import get_pending_reviews


def _reviews_enabled() -> bool:
    try:
        from dashboard.settings.services import get_settings_bundle
        return bool(get_settings_bundle()['reviews'].reviews_enabled)
    except Exception:
        return True


def _reviews_disabled_response():
    return Response(
        {
            "detail": (
                "Reviews are currently disabled on this shop. "
                "You can still view and delete your existing reviews."
            ),
            "code": "reviews_disabled",
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024
REVIEW_IMAGE_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


class ReviewListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Review.objects.filter(user=request.user)
        return Response(ReviewRowSerializer(qs, many=True).data)

    def post(self, request):
        if not _reviews_enabled():
            return _reviews_disabled_response()

        ser = ReviewWriteSerializer(
            data=request.data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)

        product_id = ser.validated_data["product_id"]
        if Review.objects.filter(
            user=request.user, product_id=product_id
        ).exists():
            return Response(
                {"detail": "You've already reviewed this product."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        review = ser.save()

        return Response(
            ReviewRowSerializer(review).data,
            status=status.HTTP_201_CREATED,
        )


class ReviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        review = get_object_or_404(Review, pk=pk, user=request.user)
        return Response(ReviewRowSerializer(review).data)

    def patch(self, request, pk):
        if not _reviews_enabled():
            return _reviews_disabled_response()

        review = get_object_or_404(Review, pk=pk, user=request.user)

        ser = ReviewWriteSerializer(
            review,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        review = ser.save()

        return Response(ReviewRowSerializer(review).data)

    def delete(self, request, pk):
        review = get_object_or_404(Review, pk=pk, user=request.user)
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PendingReviewListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = get_pending_reviews(request.user)
        return Response(
            PendingReviewItemSerializer(rows, many=True).data
        )


class ReviewImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "reviews_upload"

    def post(self, request):
        if not _reviews_enabled():
            return _reviews_disabled_response()

        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "No file uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > REVIEW_IMAGE_MAX_BYTES:
            mb = REVIEW_IMAGE_MAX_BYTES // (1024 * 1024)
            return Response(
                {"detail": f"Image must be under {mb} MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = (file.content_type or "").lower()
        if content_type not in REVIEW_IMAGE_ALLOWED_TYPES:
            return Response(
                {"detail": "Only JPG, PNG, or WEBP images are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw = file.read()

        try:
            Image.open(ContentFile(raw)).verify()
        except (UnidentifiedImageError, OSError):
            return Response(
                {"detail": "The uploaded file is not a valid image."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        safe_name = get_valid_filename(file.name or "image")
        path = default_storage.save(
            f"reviews/{request.user.pk}/{safe_name}",
            ContentFile(raw),
        )
        url = default_storage.url(path)

        return Response({"url": url}, status=status.HTTP_201_CREATED)