from rest_framework import serializers

from .models import Poster


class NullableImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if data is None or data == "":
            return None
        return super().to_internal_value(data)


class NullableDateTimeField(serializers.DateTimeField):
    def to_internal_value(self, value):
        if value in ("", None):
            return None
        return super().to_internal_value(value)


class PosterSerializer(serializers.ModelSerializer):
    status = serializers.CharField(source="computed_status", read_only=True)
    desktop_image = NullableImageField(required=False, allow_null=True)
    mobile_image = NullableImageField(required=False, allow_null=True)
    start_at = NullableDateTimeField(required=False, allow_null=True)
    end_at = NullableDateTimeField(required=False, allow_null=True)

    class Meta:
        model = Poster
        fields = [
            "id",
            "placement",
            "order",
            "headline",
            "subheadline",
            "desktop_image",
            "mobile_image",
            "cta_text",
            "cta_href",
            "brand_name",
            "sponsor_label",
            "status",
            "is_published",
            "start_at",
            "end_at",
            "impression_count",
            "click_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "impression_count",
            "click_count",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        start = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end = attrs.get("end_at", getattr(self.instance, "end_at", None))
        if start and end and start >= end:
            raise serializers.ValidationError(
                {"end_at": "End must be after start."}
            )
        return attrs