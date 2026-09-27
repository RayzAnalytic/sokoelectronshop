# social_media/serializers.py

from rest_framework import serializers

from .models import SocialAccount


class SocialAccountSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for connected social accounts.
    Never exposes access_token or refresh_token to the client.
    """
    platform_display = serializers.CharField(
        source="get_platform_display",
        read_only=True,
    )

    class Meta:
        model = SocialAccount
        fields = [
            "id",
            "platform",
            "platform_display",
            "platform_user_id",
            "username",
            "shop_cipher",
            "is_active",
            "token_expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields