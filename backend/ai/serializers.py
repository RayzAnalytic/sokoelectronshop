from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(
        max_length=2000, allow_blank=False, trim_whitespace=True,
    )
    session_id = serializers.UUIDField(required=False, allow_null=True)


class ChatProductCardSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    brand = serializers.CharField()
    category = serializers.CharField()
    price = serializers.CharField()
    compareAtPrice = serializers.CharField(allow_null=True)
    images = serializers.ListField(child=serializers.CharField())
    stock = serializers.CharField()
    url = serializers.CharField()


class ChatResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    message = serializers.CharField()
    products = ChatProductCardSerializer(many=True)
    chips = serializers.ListField(child=serializers.CharField())
    requires_auth = serializers.BooleanField()