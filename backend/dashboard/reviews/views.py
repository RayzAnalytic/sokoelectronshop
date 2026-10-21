import logging

from django.db.models import Avg, Count
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from account.models import Review

from . import services
from .filters import ReviewFilter
from .serializers import (
    BulkActionSerializer,
    FlagReviewSerializer,
    ModerationReviewSerializer,
    ModerationStatsSerializer,
    RejectReviewSerializer,
    ReplyWriteSerializer,
    ReviewReplySerializer,
)

logger = logging.getLogger(__name__)


class ReviewModerationViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    filterset_class = ReviewFilter
    ordering = ["-created_at"]
    http_method_names = ["get", "delete", "head", "options", "post"]

    def get_queryset(self):
        return (
            Review.objects
            .select_related("user", "moderated_by", "flagged_by")
            .prefetch_related("replies__author")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        return ModerationReviewSerializer

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = ModerationReviewSerializer(
                page, many=True, context=self.get_serializer_context(),
            )
            return self.get_paginated_response(ser.data)

        ser = ModerationReviewSerializer(
            qs, many=True, context=self.get_serializer_context(),
        )
        return Response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        review = self.get_object()
        return Response(
            ModerationReviewSerializer(
                review, context=self.get_serializer_context(),
            ).data
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = Review.objects.all()

        total = qs.count()
        pending = qs.filter(status=Review.Status.PENDING).count()
        approved = qs.filter(status=Review.Status.PUBLISHED).count()
        rejected = qs.filter(status=Review.Status.REJECTED).count()
        flagged = qs.filter(flag_status="flagged").count()
        verified = qs.filter(is_verified_purchase=True).count()

        avg = qs.aggregate(a=Avg("rating"))["a"] or 0

        raw_dist = (
            qs.values("rating")
            .annotate(n=Count("id"))
            .order_by("-rating")
        )
        by_stars = {row["rating"]: row["n"] for row in raw_dist}

        distribution = []
        for stars in (5, 4, 3, 2, 1):
            count = by_stars.get(stars, 0)
            pct = round((count / total * 100) if total else 0, 1)
            distribution.append({
                "stars": stars,
                "count": count,
                "percentage": pct,
            })

        payload = {
            "total": total,
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "flagged": flagged,
            "verified": verified,
            "averageRating": round(avg, 2),
            "ratingDistribution": distribution,
        }
        return Response(ModerationStatsSerializer(payload).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        review = self.get_object()
        services.moderate_review(
            review, "approved", moderator=request.user,
        )
        review.refresh_from_db()
        return Response(
            ModerationReviewSerializer(
                review, context=self.get_serializer_context(),
            ).data
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        ser = RejectReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        review = self.get_object()
        services.moderate_review(
            review, "rejected",
            moderator=request.user,
            reason=ser.validated_data.get("reason", ""),
        )
        review.refresh_from_db()
        return Response(
            ModerationReviewSerializer(
                review, context=self.get_serializer_context(),
            ).data
        )

    @action(detail=True, methods=["post"], url_path="flag")
    def flag(self, request, pk=None):
        ser = FlagReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        review = self.get_object()
        services.flag_review(
            review,
            reason=ser.validated_data.get("reason", ""),
            actor=request.user,
        )
        review.refresh_from_db()
        return Response(
            ModerationReviewSerializer(
                review, context=self.get_serializer_context(),
            ).data
        )

    @action(detail=True, methods=["post"], url_path="resolve-flag")
    def resolve_flag(self, request, pk=None):
        review = self.get_object()
        services.resolve_review_flag(review, actor=request.user)
        review.refresh_from_db()
        return Response(
            ModerationReviewSerializer(
                review, context=self.get_serializer_context(),
            ).data
        )

    @action(detail=True, methods=["post"], url_path="replies")
    def create_reply(self, request, pk=None):
        ser = ReplyWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        review = self.get_object()
        reply = services.add_review_reply(
            review,
            text=ser.validated_data["text"],
            author=request.user,
        )
        return Response(
            ReviewReplySerializer(reply).data,
            status=http_status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="helpful")
    def helpful(self, request, pk=None):
        review = self.get_object()
        services.increment_helpful(review)
        review.refresh_from_db()
        return Response(
            ModerationReviewSerializer(
                review, context=self.get_serializer_context(),
            ).data
        )

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        services.delete_review(review)
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        ser = BulkActionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        action = ser.validated_data["action"]
        ids = ser.validated_data["ids"]
        reason = ser.validated_data.get("reason", "")

        reviews = list(self.get_queryset().filter(pk__in=ids))
        affected = 0

        if action in ("approve", "reject"):
            moderation_action = "approved" if action == "approve" else "rejected"
            for review in reviews:
                services.moderate_review(
                    review, moderation_action,
                    moderator=request.user,
                    reason=reason,
                )
                affected += 1

        elif action == "flag":
            for review in reviews:
                services.flag_review(
                    review,
                    reason=reason or "Bulk flagged by admin",
                    actor=request.user,
                )
                affected += 1

        elif action == "delete":
            for review in reviews:
                services.delete_review(review)
                affected += 1

        return Response({
            "action": action,
            "requested": len(ids),
            "affected": affected,
        })