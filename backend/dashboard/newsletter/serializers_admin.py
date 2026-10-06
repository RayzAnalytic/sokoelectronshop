# newsletter/serializers_admin.py
from rest_framework import serializers

from .models import (
    Subscriber,
    SubscriberList,
    EmailTemplate,
    Campaign,
    CampaignRecipient,
)


# ─────────────────────────────────────────────────────────────────────────────
# Subscribers
# ─────────────────────────────────────────────────────────────────────────────
class SubscriberListRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriberList
        fields = ["id", "name", "color"]


class SubscriberAdminReadSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    lists = SubscriberListRefSerializer(many=True, read_only=True)

    class Meta:
        model = Subscriber
        fields = [
            "id", "email", "name", "tags",
            "source", "is_active", "status",
            "lists",
            "subscribed_at", "unsubscribed_at",
        ]

    def get_status(self, obj):
        return "Subscribed" if obj.is_active else "Unsubscribed"


class SubscriberAdminWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscriber
        fields = ["email", "name", "tags", "source", "is_active"]

    def validate_tags(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list of strings.")
        return [str(t).strip() for t in value if str(t).strip()]


class SubscriberStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    unsubscribed = serializers.IntegerField()
    new_this_month = serializers.IntegerField()
    churn_rate = serializers.FloatField()


# ─────────────────────────────────────────────────────────────────────────────
# Lists
# ─────────────────────────────────────────────────────────────────────────────
class SubscriberListAdminReadSerializer(serializers.ModelSerializer):
    subscriberCount = serializers.SerializerMethodField()

    class Meta:
        model = SubscriberList
        fields = [
            "id", "name", "description", "color",
            "subscriberCount", "created_at",
        ]

    def get_subscriberCount(self, obj):
        annotated = getattr(obj, "active_subscriber_count", None)
        if annotated is not None:
            return annotated
        return obj.subscribers.filter(is_active=True).count()


class SubscriberListAdminWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriberList
        fields = ["name", "description", "color"]


# ─────────────────────────────────────────────────────────────────────────────
# Templates
# ─────────────────────────────────────────────────────────────────────────────
class EmailTemplateAdminReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            "id", "name", "subject", "body",
            "hero_image_url", "cta_text", "cta_url",
            "category",
            "created_at", "updated_at",
        ]


class EmailTemplateAdminWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            "name", "subject", "body",
            "hero_image_url", "cta_text", "cta_url",
            "category",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Campaigns
# ─────────────────────────────────────────────────────────────────────────────
class CampaignAdminReadSerializer(serializers.ModelSerializer):
    audienceLabel = serializers.SerializerMethodField()
    audience_id = serializers.SerializerMethodField()
    openRate = serializers.SerializerMethodField()
    clickRate = serializers.SerializerMethodField()
    bounceRate = serializers.SerializerMethodField()
    unsubRate = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "subject",
            "hero_image_url", "body", "cta_text", "cta_url",
            "audience_type", "audience_id", "audienceLabel",
            "status",
            "recipient_count", "sent_count", "failed_count",
            "openRate", "clickRate", "bounceRate", "unsubRate",
            "scheduled_at", "sent_at",
            "created_at",
        ]

    def get_audienceLabel(self, obj):
        return obj.audience_label()

    def get_audience_id(self, obj):
        return obj.audience_id or ""

    def _rate(self, numerator, denominator):
        if not denominator:
            return 0.0
        return round((numerator or 0) / denominator * 100, 1)

    def get_openRate(self, obj):
        return self._rate(obj.open_count, obj.recipient_count)

    def get_clickRate(self, obj):
        return self._rate(obj.click_count, obj.recipient_count)

    def get_bounceRate(self, obj):
        return self._rate(obj.bounce_count, obj.recipient_count)

    def get_unsubRate(self, obj):
        return self._rate(obj.unsubscribe_count, obj.recipient_count)


class CampaignAdminWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField()
    hero_image_url = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )
    cta_text = serializers.CharField(
        max_length=80, required=False, allow_blank=True, default="",
    )
    cta_url = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default="",
    )
    audience_type = serializers.ChoiceField(
        choices=Campaign.AudienceType.choices,
        default=Campaign.AudienceType.ALL_ACTIVE,
    )
    audience_id = serializers.CharField(
        required=False, allow_blank=True, default="",
    )
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, data):
        atype = data.get("audience_type")
        aid = (data.get("audience_id") or "").strip()

        if atype == Campaign.AudienceType.LIST:
            if not aid:
                raise serializers.ValidationError(
                    {"audience_id": "Required when audience_type is 'list'."}
                )
            if not SubscriberList.objects.filter(pk=aid).exists():
                raise serializers.ValidationError(
                    {"audience_id": "No such list."}
                )
            data["audience_id"] = aid

        elif atype == Campaign.AudienceType.SEGMENT:
            if not aid:
                raise serializers.ValidationError(
                    {"audience_id": "Required when audience_type is 'segment'."}
                )
            data["audience_id"] = aid

        else:
            data["audience_id"] = ""

        return data

    def create(self, validated_data):
        scheduled_at = validated_data.get("scheduled_at")
        status_ = (
            Campaign.Status.SCHEDULED if scheduled_at
            else Campaign.Status.DRAFT
        )
        created_by = validated_data.pop("created_by", None)

        return Campaign.objects.create(
            status=status_,
            created_by=created_by,
            **validated_data,
        )

    def update(self, instance, validated_data):
        scheduled_at = validated_data.pop("scheduled_at", None)

        for key, value in validated_data.items():
            setattr(instance, key, value)

        if scheduled_at is not None:
            instance.scheduled_at = scheduled_at
            if instance.status == Campaign.Status.DRAFT:
                instance.status = Campaign.Status.SCHEDULED

        instance.save()
        return instance


class CampaignStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "id", "status",
            "recipient_count", "sent_count", "failed_count",
            "sent_at",
        ]


class CampaignRecipientAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignRecipient
        fields = ["id", "email", "status", "error_message", "sent_at"]


# ─────────────────────────────────────────────────────────────────────────────
# Segments (read-only — computed in the view)
# ─────────────────────────────────────────────────────────────────────────────
class SegmentSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    rules = serializers.ListField(child=serializers.CharField())
    count = serializers.IntegerField()
    color = serializers.CharField()


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────
class GrowthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    subscribers = serializers.IntegerField()


class CampaignPerformanceSerializer(serializers.Serializer):
    name = serializers.CharField()
    open = serializers.FloatField(allow_null=True, default=0)
    click = serializers.FloatField(allow_null=True, default=0)
    bounce = serializers.FloatField(allow_null=True, default=0)


class AnalyticsSummarySerializer(serializers.Serializer):
    delivered_total = serializers.IntegerField()
    delivery_rate = serializers.FloatField()
    avg_open_rate = serializers.FloatField()
    avg_click_rate = serializers.FloatField()
    avg_unsub_rate = serializers.FloatField()


# ─────────────────────────────────────────────────────────────────────────────
# Upload
# ─────────────────────────────────────────────────────────────────────────────
class CampaignImageUploadSerializer(serializers.Serializer):
    file = serializers.ImageField()