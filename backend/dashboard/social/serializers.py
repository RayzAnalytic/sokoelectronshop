"""
DRF serializers for the social app.

The *response* shapes are camelCase to match the TS interfaces in
`lib/admin-types.ts` (see `AdminWhatsApp*` for the established pattern).
The *input* serializers stay snake_case internally for validation.
"""
from __future__ import annotations

from rest_framework import serializers

from .models import (
    SocialAccount,
    SocialMedia,
    SocialPlatform,
    SocialPost,
    SocialPostTarget,
)


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class SocialAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialAccount
        fields = [
            "id", "platform", "handle", "display_name", "platform_user_id",
            "is_connected", "connected_at", "token_expires_at", "last_error",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class SocialMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = SocialMedia
        fields = ["id", "url", "media_type", "filename", "size_bytes", "sort_order"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class SocialPostTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialPostTarget
        fields = [
            "id", "platform", "status",
            "platform_post_id", "platform_url", "error_message",
            "likes", "comments", "shares", "reach", "impressions",
            "metrics_synced_at", "published_at",
        ]
        read_only_fields = fields


class SocialPostSerializer(serializers.ModelSerializer):
    targets = SocialPostTargetSerializer(many=True, read_only=True)
    media   = SocialMediaSerializer(many=True, read_only=True)

    class Meta:
        model = SocialPost
        fields = [
            "id", "status", "caption", "product_tag",
            "scheduled_for", "published_at",
            "created_at", "updated_at",
            "targets", "media",
        ]
        read_only_fields = ["id", "status", "published_at", "created_at", "updated_at"]


# ─────────────────────────────────────────────────────────────────────────────
# Input — composer
# ─────────────────────────────────────────────────────────────────────────────

class PostCreateSerializer(serializers.Serializer):
    """
    Shape of a `POST /api/v1/admin/social/posts/` request.

    Frontend sends:
        {
          caption: string,
          platforms: SocialPlatform[],           # ['Instagram', 'Facebook', ...] or ['INSTAGRAM', ...]
          product_tag?: string,
          media_ids?: number[],                  # returned by media upload
          schedule_at?: string,                  # ISO8601 — present only if scheduling
        }
    """
    caption     = serializers.CharField(allow_blank=False, max_length=5000)
    platforms   = serializers.ListField(
        child=serializers.CharField(), allow_empty=False,
    )
    product_tag = serializers.CharField(required=False, allow_blank=True, max_length=255)
    media_ids   = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True,
    )
    schedule_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_platforms(self, value):
        valid = {choice for choice, _ in SocialPlatform.choices}
        upper = [p.upper() for p in value]
        bad = [p for p in upper if p not in valid]
        if bad:
            raise serializers.ValidationError(
                f"Unknown platform(s): {', '.join(bad)}. "
                f"Valid: {', '.join(sorted(valid))}."
            )
        # De-dupe, preserve order
        seen, out = set(), []
        for p in upper:
            if p not in seen:
                seen.add(p)
                out.append(p)
        return out

    def validate(self, data):
        schedule_at = data.get("schedule_at")
        if schedule_at is not None:
            from django.utils import timezone
            if schedule_at <= timezone.now():
                raise serializers.ValidationError(
                    {"schedule_at": "Scheduled time must be in the future."}
                )
        return data


class MediaUploadSerializer(serializers.Serializer):
    file = serializers.FileField()