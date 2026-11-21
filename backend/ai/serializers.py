from rest_framework import serializers

from .models import ChatMessage, ChatSession


class ChatRequestSerializer(serializers.Serializer):
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


class ChatProductCardSerializer(serializers.Serializer):
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
        return [u for u in value if u]


class ChatResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    message = serializers.CharField(allow_blank=True)
    products = ChatProductCardSerializer(many=True, required=False, default=list)
    chips = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    requires_auth = serializers.BooleanField(required=False, default=False)


class ChatMessageSerializer(serializers.ModelSerializer):
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
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta(ChatSessionSerializer.Meta):
        fields = ChatSessionSerializer.Meta.fields + ["messages"]
        read_only_fields = fields