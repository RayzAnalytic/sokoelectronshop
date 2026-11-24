from django.core.files.storage import default_storage
from rest_framework import serializers

from .models import Banner, Placement, Status


def _to_url(path: str) -> str:
    if not path:
        return ''
    try:
        return default_storage.url(path)
    except Exception:
        return path


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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in ('desktop_image', 'tablet_image', 'mobile_image'):
            data[field] = _to_url(data.get(field) or '')
        return data


class BannerAdminSerializer(serializers.ModelSerializer):
    ctr = serializers.FloatField(read_only=True)
    cvr = serializers.FloatField(read_only=True)
    is_live = serializers.BooleanField(read_only=True)

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
            'ctr', 'cvr', 'is_live',
            'created_at', 'updated_at',
        ]
        read_only_fields = (
            'impressions', 'clicks', 'conversions',
            'created_at', 'updated_at',
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in ('desktop_image', 'tablet_image', 'mobile_image'):
            data[field] = _to_url(data.get(field) or '')
        return data

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Name is required.')
        return value

    def validate_order(self, value):
        if value < 1:
            raise serializers.ValidationError('Order must be at least 1.')
        return value

    def validate_overlay_opacity(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Overlay opacity must be between 0 and 100.')
        return value

    def validate(self, attrs):
        instance = self.instance
        placement = attrs.get(
            'placement',
            getattr(instance, 'placement', Placement.HOME_HERO),
        )
        status = attrs.get(
            'status',
            getattr(instance, 'status', Status.DRAFT),
        )
        start_at = attrs.get('start_at', getattr(instance, 'start_at', None))
        end_at = attrs.get('end_at', getattr(instance, 'end_at', None))

        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError(
                {'end_at': 'End date must be after the start date.'}
            )

        if placement == Placement.HOME_HERO and status in (Status.ACTIVE, Status.SCHEDULED):
            qs = Banner.objects.filter(
                placement=Placement.HOME_HERO,
                status__in=[Status.ACTIVE, Status.SCHEDULED],
            )
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.count() >= Banner.MAX_HERO_SLIDES:
                raise serializers.ValidationError({
                    'status': (
                        f'Maximum {Banner.MAX_HERO_SLIDES} hero slides may be '
                        'active or scheduled at once. Deactivate or delete '
                        'one first.'
                    )
                })

        return attrs


class BannerTrackSerializer(serializers.Serializer):
    source = serializers.CharField(required=False, allow_blank=True)
