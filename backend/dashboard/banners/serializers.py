from rest_framework import serializers

from .models import Banner


class BannerSerializer(serializers.ModelSerializer):
    ctr = serializers.FloatField(read_only=True)
    cvr = serializers.FloatField(read_only=True)

    class Meta:
        model = Banner
        fields = [
            'id', 'name', 'placement', 'order',
            'badge', 'headline', 'description',
            'desktop_image', 'tablet_image', 'mobile_image',
            'primary_cta_text', 'primary_cta_href',
            'secondary_cta_text', 'secondary_cta_href',
            'text_alignment', 'overlay_style', 'overlay_opacity',
            'status', 'start_at', 'end_at',
            'impressions', 'clicks', 'conversions',
            'ctr', 'cvr',
            'created_at', 'updated_at',
        ]
        read_only_fields = (
            'impressions', 'clicks', 'conversions',
            'created_at', 'updated_at',
        )


class BannerTrackSerializer(serializers.Serializer):
    """Small body schema for the tracking endpoint (optional payload)."""

    source = serializers.CharField(required=False, allow_blank=True)