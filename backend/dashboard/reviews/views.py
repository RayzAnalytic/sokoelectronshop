"""
Reviews moderation API.

Endpoints (mounted at /api/v1/admin/reviews/):

    GET    /                       list (filters, search, pagination)
    GET    /<id>/                  detail
    GET    /stats/                 headline stats + rating distribution
    POST   /<id>/approve/          status → published
    POST   /<id>/reject/           status → rejected, sets reason
    POST   /<id>/flag/             set flag + reason
    POST   /<id>/resolve-flag/     flag → resolved
    POST   /<id>/replies/          append a ReviewReply
    POST   /<id>/helpful/          increment helpful_count
    DELETE /<id>/                  hard delete
    POST   /bulk/                  one of approve / reject / flag / delete
"""

import logging

from django.db.models import Avg, Count, Q
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
    """
    Admin moderation for customer reviews.

    The queryset pulls the whole moderation surface in one round-trip:
    the review row, its author, the moderator stamps, and its replies
    (with each reply's author). A list of N reviews costs 4 queries,
    not 4N.
    """

    permission_classes = [IsAdminUser]
    filterset_class = ReviewFilter
    ordering = ["-created_at"]

    # Only list, retrieve, delete are standard HTTP methods. Everything
    # else is a custom action with its own method decorator.
    http_method_names = ["get", "delete", "head", "options", "post"]

    def get_queryset(self):
        return (
            Review.objects
            .select_related("user", "moderated_by", "flagged_by")
            .prefetch_related("replies__author")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        # Every response (list, retrieve, actions) uses the same read
        # serializer. The write payloads are validated by their own
        # serializers inside each action.
        return ModerationReviewSerializer

    # ── List / retrieve use the read serializer ────────────────────────
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

    # ── Stats ──────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        Headline tiles and rating distribution.

        Computed live from the DB. The frontend currently hardcodes
        the distribution — swap it for this once there's real data.
        """
        qs = Review.objects.all()

        total = qs.count()
        pending = qs.filter(status=Review.Status.PENDING).count()
        approved = qs.filter(status=Review.Status.PUBLISHED).count()
        rejected = qs.filter(status=Review.Status.REJECTED).count()
        flagged = qs.filter(flag_status="flagged").count()
        verified = qs.filter(is_verified_purchase=True).count()

        avg = qs.aggregate(a=Avg("rating"))["a"] or 0

        # Rating distribution across all reviews (not just published).
        # Rationale: the admin sees the true distribution of submitted
        # ratings, including pending ones, so they know what's coming.
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

    # ── Approve ────────────────────────────────────────────────────────
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

    # ── Reject ─────────────────────────────────────────────────────────
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

    # ── Flag ───────────────────────────────────────────────────────────
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

    # ── Resolve flag ───────────────────────────────────────────────────
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

    # ── Reply ──────────────────────────────────────────────────────────
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

    # ── Helpful ────────────────────────────────────────────────────────
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

    # ── Delete (single) ────────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        services.delete_review(review)
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    # ── Bulk ───────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """
        One endpoint, four actions.

        `ids` must belong to reviews the caller can see. Any id that
        doesn't resolve to a real review is silently skipped — the
        response reports how many were actually changed.
        """
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