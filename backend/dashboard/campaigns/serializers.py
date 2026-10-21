from rest_framework import serializers

from .models import Campaign, CampaignDispatch


class CampaignDispatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignDispatch
        fields = (
            "id",
            "channel",
            "status",
            "external_ref_id",
            "result",
            "error",
            "sent_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "status",
            "external_ref_id",
            "result",
            "error",
            "sent_at",
            "created_at",
        )


class CampaignSerializer(serializers.ModelSerializer):
    dispatches = CampaignDispatchSerializer(many=True, read_only=True)

    class Meta:
        model = Campaign
        fields = (
            "id",
            "name",
            "campaign_type",
            "audience_source",
            "audience_ref_id",
            "audience_size_cached",
            "status",
            "scheduled_at",
            "channels",
            "content",
            "dispatches",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "audience_size_cached",
            "dispatches",
            "created_at",
            "updated_at",
        )


class CampaignWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    campaign_type = serializers.ChoiceField(choices=Campaign.CampaignType.choices)
    audience_source = serializers.ChoiceField(
        choices=Campaign.AudienceSource.choices,
        default=Campaign.AudienceSource.ALL,
    )
    audience_ref_id = serializers.CharField(
        max_length=64,
        required=False,
        allow_blank=True,
        default="",
    )
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    channels = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=False,
    )
    content = serializers.DictField(required=False, default=dict)

    def validate_channels(self, value):
        valid = {c.value for c in CampaignDispatch.Channel}
        unknown = [c for c in value if c not in valid]
        if unknown:
            raise serializers.ValidationError(f"Unknown channels: {unknown}")
        return value

    def validate(self, attrs):
        source = attrs.get("audience_source")
        ref_id = (attrs.get("audience_ref_id") or "").strip()
        if source and source != Campaign.AudienceSource.ALL and not ref_id:
            raise serializers.ValidationError(
                {"audience_ref_id": "Required when audience_source is not 'all'."}
            )
        return attrs