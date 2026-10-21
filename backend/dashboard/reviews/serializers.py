from rest_framework import serializers

from account.models import Review, ReviewReply


_STATUS_TO_WIRE = {
    Review.Status.PENDING: "Pending",
    Review.Status.PUBLISHED: "Approved",
    Review.Status.REJECTED: "Rejected",
}
_STATUS_TO_DB = {v: k for k, v in _STATUS_TO_WIRE.items()}


class ReviewReplySerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ReviewReply
        fields = ("id", "author", "date", "text")

    def get_id(self, obj) -> str:
        return str(obj.pk)

    def get_author(self, obj) -> str:
        if not obj.author:
            return "Support"
        full = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return full or obj.author.email or "Support"


class ModerationReviewSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()

    productId = serializers.CharField(source="product_id", read_only=True)
    productName = serializers.CharField(source="product_name", read_only=True)
    productImage = serializers.CharField(source="product_image", read_only=True, allow_blank=True)
    productSlug = serializers.CharField(source="product_slug", read_only=True, allow_blank=True)
    productBrand = serializers.CharField(source="product_brand", read_only=True, allow_blank=True)

    customerId = serializers.SerializerMethodField()
    customerName = serializers.SerializerMethodField()
    customerEmail = serializers.SerializerMethodField()

    comment = serializers.CharField(source="body", read_only=True)
    date = serializers.DateTimeField(source="created_at", read_only=True)
    status = serializers.SerializerMethodField()
    rejectionReason = serializers.CharField(source="rejection_reason", read_only=True, allow_blank=True)
    verifiedPurchase = serializers.BooleanField(source="is_verified_purchase", read_only=True)

    flagStatus = serializers.CharField(source="flag_status", read_only=True)
    flagReason = serializers.CharField(source="flag_reason", read_only=True, allow_blank=True)

    helpfulCount = serializers.IntegerField(source="helpful_count", read_only=True)

    replies = ReviewReplySerializer(many=True, read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "productId", "productName", "productImage", "productSlug", "productBrand",
            "customerId", "customerName", "customerEmail",
            "rating",
            "comment", "title", "images",
            "date",
            "status", "rejectionReason", "verifiedPurchase",
            "flagStatus", "flagReason",
            "helpfulCount",
            "replies",
        )

    def get_id(self, obj) -> str:
        return str(obj.pk)

    def get_status(self, obj) -> str:
        return _STATUS_TO_WIRE.get(obj.status, obj.status)

    def get_customerId(self, obj) -> str:
        return str(obj.user_id) if obj.user_id else ""

    def get_customerName(self, obj) -> str:
        if obj.user_id:
            user = obj.user
            full = f"{user.first_name} {user.last_name}".strip()
            return full or user.email or "Customer"
        return obj.guest_author_name or "Anonymous"

    def get_customerEmail(self, obj) -> str:
        return obj.user.email if obj.user_id else ""


class RejectReviewSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="",
    )


class FlagReviewSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="Flagged by admin",
    )


class ReplyWriteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000, allow_blank=False)


class BulkActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject", "flag", "delete"])
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=200,
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="",
    )


class RatingBucketSerializer(serializers.Serializer):
    stars = serializers.IntegerField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class ModerationStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()
    flagged = serializers.IntegerField()
    verified = serializers.IntegerField()
    averageRating = serializers.FloatField()
    ratingDistribution = RatingBucketSerializer(many=True)