# newsletter/serializers.py
from rest_framework import serializers

from .models import Subscriber, SubscriberList


# Shared across customer + admin so sources can't drift between the two sides.
ALLOWED_SOURCES = [
    "Footer Popup",
    "Checkout",
    "WhatsApp Opt-in",
    "Manual Import",
]

STATUS_SUBSCRIBED = "Subscribed"
STATUS_UNSUBSCRIBED = "Unsubscribed"


# ─────────────────────────────────────────────────────────────────────────
# Public (storefront) — input
# ─────────────────────────────────────────────────────────────────────────
class SubscribeSerializer(serializers.Serializer):
    """
    Input-only serializer for the storefront signup forms.

    Validation only — deduplication, reactivation, and list-attach live
    in the view. Accepting name/source here (instead of reading raw
    request.data) ensures bad values are rejected with a 400, not
    silently persisted.
    """
    email = serializers.EmailField(max_length=254)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    source = serializers.ChoiceField(choices=ALLOWED_SOURCES, default="Footer Popup")

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_name(self, value: str) -> str:
        return value.strip()


class SubscribeResponseSerializer(serializers.Serializer):
    """
    Shape of the storefront subscribe response.

    The customer page reads res.status and res.detail directly, so this
    exists mainly to document the contract. Not used for validation.
    """
    status = serializers.ChoiceField(
        choices=["subscribed", "reactivated", "already_subscribed"]
    )
    detail = serializers.CharField()


# ─────────────────────────────────────────────────────────────────────────
# Public (storefront) — output
# ─────────────────────────────────────────────────────────────────────────
class SubscriberSerializer(serializers.ModelSerializer):
    """
    Slim read serializer for the public subscribe response.

    Never leaks the unsubscribe token, IP address, tags, or list
    memberships. The admin side uses AdminSubscriberSerializer instead.
    """
    class Meta:
        model = Subscriber
        fields = [
            "id", "email", "is_active", "source",
            "subscribed_at", "unsubscribed_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────────────────
# Unsubscribe — input
# ─────────────────────────────────────────────────────────────────────────
class UnsubscribeSerializer(serializers.Serializer):
    """
    Accepts either the email address or the UUID unsubscribe token.

    If both are supplied, token wins — it's the more specific identifier
    and the one embedded in email footers.
    """
    email = serializers.EmailField(required=False, allow_blank=True)
    token = serializers.UUIDField(required=False)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("token"):
            raise serializers.ValidationError(
                "Provide either an email address or an unsubscribe token."
            )
        return attrs


# ─────────────────────────────────────────────────────────────────────────
# Admin — output
# ─────────────────────────────────────────────────────────────────────────
class SubscriberListMiniSerializer(serializers.ModelSerializer):
    """Compact list shape nested inside subscriber rows on the admin UI."""
    class Meta:
        model = SubscriberList
        fields = ["id", "name", "color"]
        read_only_fields = fields


class AdminSubscriberSerializer(serializers.ModelSerializer):
    """
    Read serializer for the admin subscriber table.

    Adds the fields the admin UI actually reads:
      - status: 'Subscribed' / 'Unsubscribed' (drives the toggle button)
      - tags:   free-form labels (VIP badge, edit modal)
      - lists:  membership chips in the table and edit modal
    """
    status = serializers.SerializerMethodField()
    lists = SubscriberListMiniSerializer(many=True, read_only=True)

    class Meta:
        model = Subscriber
        fields = [
            "id",
            "email",
            "name",
            "tags",
            "status",
            "is_active",
            "source",
            "lists",
            "subscribed_at",
            "unsubscribed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_status(self, obj: Subscriber) -> str:
        return STATUS_SUBSCRIBED if obj.is_active else STATUS_UNSUBSCRIBED