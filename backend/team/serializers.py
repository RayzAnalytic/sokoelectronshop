# team/serializers.py

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import TeamInvite

User = get_user_model()


# ─────────────────────────────────────────────────────────────
# INVITE — READ
# ─────────────────────────────────────────────────────────────
class TeamInviteSerializer(serializers.ModelSerializer):
    """
    Read-only view of a TeamInvite.
    Used by:
      GET  /api/team/invites/
      POST /api/team/accept/  (returns the accepted invite)
    """
    role_display = serializers.CharField(
        source="get_role_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    owner_email = serializers.CharField(
        source="owner.email", read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = TeamInvite
        fields = [
            "id",
            "email",
            "role",
            "role_display",
            "status",
            "status_display",
            "owner_email",
            "is_expired",
            "created_at",
            "expires_at",
            "accepted_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────
# INVITE — CREATE (single)
# ─────────────────────────────────────────────────────────────
class TeamInviteCreateSerializer(serializers.Serializer):
    """
    Used when the owner creates a single invite from the dashboard.
    (Onboarding Step 11 uses its own bulk serializer.)
    """
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=TeamInvite.Role.choices)

    def validate_email(self, value):
        value = value.strip().lower()
        owner = self.context["request"].user
        if value == owner.email.lower():
            raise serializers.ValidationError(
                "You can't invite yourself."
            )
        return value

    def create(self, validated_data):
        from .services import create_invite, send_invite_email

        owner = self.context["request"].user
        invite = create_invite(
            owner,
            validated_data["email"],
            validated_data["role"],
        )
        send_invite_email(invite)
        return invite


# ─────────────────────────────────────────────────────────────
# INVITE — ACCEPT
# ─────────────────────────────────────────────────────────────
class AcceptInviteSerializer(serializers.Serializer):
    """Payload for POST /api/team/accept/."""
    token = serializers.CharField(max_length=64)

    def validate_token(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Token is required.")
        return value