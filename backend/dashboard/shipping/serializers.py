from decimal import Decimal

from rest_framework import serializers

from .models import (
    CourierConfig,
    PickupLocation,
    Shipment,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
)


_METHOD_NAME_TO_KEY = {
    "Standard Delivery": "standard",
    "Express Boda": "express",
    "Pickup Mtaani / Locker": "pickup",
    "Nationwide Bus / Parcel": "nationwide",
    "Freight / Bulk Cargo": "freight",
}


class ShippingRateSerializer(serializers.ModelSerializer):
    methodName = serializers.CharField(source="method.name", read_only=True)
    methodId = serializers.IntegerField(source="method.id", read_only=True)
    method = serializers.SerializerMethodField()
    price = serializers.FloatField(read_only=True)
    freeShippingThreshold = serializers.FloatField(
        source="free_shipping_threshold", read_only=True, allow_null=True,
    )

    class Meta:
        model = ShippingRate
        fields = (
            "id",
            "method",
            "methodId",
            "methodName",
            "price",
            "eta",
            "freeShippingThreshold",
        )

    def get_method(self, obj):
        name = obj.method.name if obj.method_id else ""
        if name in _METHOD_NAME_TO_KEY:
            return _METHOD_NAME_TO_KEY[name]
        return name.lower().replace(" ", "-")


class ShippingZoneSerializer(serializers.ModelSerializer):
    rates = ShippingRateSerializer(many=True, read_only=True)
    counties = serializers.ListField(
        child=serializers.CharField(), read_only=True,
    )

    class Meta:
        model = ShippingZone
        fields = ("id", "name", "region", "counties", "rates")


class ShippingZoneWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    region = serializers.CharField(max_length=64)
    counties = serializers.ListField(
        child=serializers.CharField(max_length=64),
        allow_empty=False,
    )


class ShippingRateWriteSerializer(serializers.Serializer):
    methodName = serializers.CharField(max_length=120)
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    eta = serializers.CharField(max_length=64, required=False, allow_blank=True)
    freeShippingThreshold = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        required=False, allow_null=True,
    )


class ShippingMethodSerializer(serializers.ModelSerializer):
    defaultPrice = serializers.FloatField(source="default_price", read_only=True)

    class Meta:
        model = ShippingMethod
        fields = (
            "id", "name", "description",
            "defaultPrice", "eta", "status",
        )


class PickupLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickupLocation
        fields = (
            "id", "name", "type", "address",
            "county", "phone", "hours", "status",
        )


class PickupLocationWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    type = serializers.ChoiceField(choices=PickupLocation.Type.choices)
    address = serializers.CharField(max_length=255)
    county = serializers.CharField(max_length=64)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    hours = serializers.CharField(max_length=120, required=False, allow_blank=True)


class CourierConfigSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)
    logoBg = serializers.CharField(source="logo_bg", read_only=True)
    apiKey = serializers.CharField(source="masked_api_key", read_only=True)

    class Meta:
        model = CourierConfig
        fields = (
            "id", "name", "logoBg", "description",
            "apiKey", "enabled", "regions",
        )


class ShipmentSerializer(serializers.ModelSerializer):
    orderNumber = serializers.CharField(source="order.reference", read_only=True)
    customerName = serializers.SerializerMethodField()
    method = serializers.SerializerMethodField()
    provider = serializers.SerializerMethodField()
    trackingNumber = serializers.CharField(source="tracking_number", read_only=True)
    updatedAt = serializers.DateTimeField(
        source="updated_at", format="%Y-%m-%d %H:%M", read_only=True,
    )

    class Meta:
        model = Shipment
        fields = (
            "id", "orderNumber", "customerName", "method", "provider",
            "trackingNumber", "status", "destination", "updatedAt",
        )

    def get_customerName(self, obj):
        return obj.customer_name

    def get_method(self, obj):
        if obj.method_id:
            return obj.method.name
        return obj.order.delivery_method or "—"

    def get_provider(self, obj):
        if obj.provider_id:
            return obj.provider.name
        return obj.order.courier or "—"


class ShipmentStatusWriteSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Shipment.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)