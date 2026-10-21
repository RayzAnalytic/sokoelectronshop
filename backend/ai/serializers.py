from rest_framework import serializers

from .models import ChatMessage, ChatSession


# ─────────────────────────────────────────────────────────────────────
# Request
# ─────────────────────────────────────────────────────────────────────

class ChatRequestSerializer(serializers.Serializer):
    """
    Incoming turn from the frontend.

    `session_id` is optional: omit it (or send null) for a brand-new
    conversation. If it's a UUID that doesn't match a live session the
    view treats it as a new conversation rather than erroring out, so
    a stale localStorage value never breaks the chat.
    """

    message = serializers.CharField(
        max_length=2000,
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            "blank": "Message cannot be empty.",
            "max_length": "Message is too long (2000 characters max).",
        },
    )
    session_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )


# ─────────────────────────────────────────────────────────────────────
# Outgoing — product cards & assistant reply
# ─────────────────────────────────────────────────────────────────────

class ChatProductCardSerializer(serializers.Serializer):
    """
    Shape consumed by the frontend `AIChatProduct` type. Field names are
    intentionally camelCase (`compareAtPrice`) because the storefront
    reads them directly. Do not rename without updating the client.
    """

    id = serializers.CharField()
    name = serializers.CharField()
    brand = serializers.CharField(allow_blank=True, default="")
    category = serializers.CharField(allow_blank=True, default="")
    price = serializers.CharField()
    compareAtPrice = serializers.CharField(
        allow_null=True,
        required=False,
        default=None,
    )
    images = serializers.ListField(
        child=serializers.CharField(allow_blank=True),
        required=False,
        default=list,
    )
    stock = serializers.CharField()
    url = serializers.CharField(allow_blank=True, default="")

    def validate_images(self, value):
        # Frontend falls back to /placeholder.jpeg when empty, so an
        # empty list is fine — but strip blanks defensively.
        return [u for u in value if u]


class ChatResponseSerializer(serializers.Serializer):
    """
    Turn result returned to the frontend. This is what the client feeds
    directly into the message list, so keys must stay stable.
    """

    session_id = serializers.UUIDField()
    message = serializers.CharField(allow_blank=True)
    products = ChatProductCardSerializer(many=True, required=False, default=list)
    chips = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    requires_auth = serializers.BooleanField(required=False, default=False)


# ─────────────────────────────────────────────────────────────────────
# Persistence — read models back out for history / admin
# ─────────────────────────────────────────────────────────────────────

class ChatMessageSerializer(serializers.ModelSerializer):
    """
    Read-only representation of a stored turn. Used when a client reloads
    a session and needs to rehydrate the chat UI, including the product
    cards and chips that were shown originally.
    """

    products = ChatProductCardSerializer(many=True, read_only=True)
    chips = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )

    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "role",
            "content",
            "products",
            "chips",
            "created_at",
        ]
        read_only_fields = fields


class ChatSessionSerializer(serializers.ModelSerializer):
    """
    Lightweight session listing — no messages. Use this for a sidebar of
    past conversations.
    """

    is_anonymous = serializers.BooleanField(read_only=True)
    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ChatSession
        fields = [
            "id",
            "title",
            "is_active",
            "is_anonymous",
            "message_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ChatSessionDetailSerializer(ChatSessionSerializer):
    """
    Full session with all turns. Use this when a client reopens a
    conversation from history.
    """

    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta(ChatSessionSerializer.Meta):
        fields = ChatSessionSerializer.Meta.fields + ["messages"]
        read_only_fields = fields