# dashboard/shipping/serializers.py

"""
Wire shapes for the admin shipping API.

Field-name conventions, per tab:

  * Zones & Rates     camelCase (`methodName`, `freeShippingThreshold`)
  * Methods           camelCase (`defaultPrice`)
  * Pickup Locations  camelCase (`type` is PascalCase — it's an enum)
  * Tracking          camelCase (`orderNumber`, `trackingNumber`,
                      `customerName`, `updatedAt`)
  * Providers         camelCase (`logoBg`, `apiKey`)

This matches the frontend's `ShippingPage` types exactly. Do NOT
rename an output key — the page reads them directly.
"""

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


# ─────────────────────────────────────────────────────────────────────────────
# Zones & Rates
# ─────────────────────────────────────────────────────────────────────────────
class ShippingRateSerializer(serializers.ModelSerializer):
    """
    One rate inside a zone card.

    `price` and `freeShippingThreshold` are floats on the wire — the
    frontend calls `.toLocaleString()` on them directly, which does
    the wrong thing on a decimal string. The DB stores Decimal; the
    serializer coerces at the boundary.
    """

    methodName = serializers.CharField(source="method.name", read_only=True)
    price = serializers.FloatField(read_only=True)
    freeShippingThreshold = serializers.FloatField(
        source="free_shipping_threshold", read_only=True, allow_null=True,
    )

    class Meta:
        model = ShippingRate
        fields = ("id", "methodName", "price", "eta", "freeShippingThreshold")


class ShippingZoneSerializer(serializers.ModelSerializer):
    """
    A zone card with its nested rates. Read-only — the write path is
    `ShippingZoneWriteSerializer` plus the add-rate action, because a
    zone and its rates are created as two distinct steps in the UI.
    """

    rates = ShippingRateSerializer(many=True, read_only=True)
    counties = serializers.ListField(
        child=serializers.CharField(), read_only=True,
    )

    class Meta:
        model = ShippingZone
        fields = ("id", "name", "region", "counties", "rates")


class ShippingZoneWriteSerializer(serializers.Serializer):
    """
    Input for `POST /zones/`.

    The Add Zone modal sends name, region, counties. The service also
    creates a default `Standard Delivery` rate so the new zone renders
    with at least one row — matching the frontend's local behavior
    before it was wired up.
    """

    name = serializers.CharField(max_length=120)
    region = serializers.CharField(max_length=64)
    counties = serializers.ListField(
        child=serializers.CharField(max_length=64),
        allow_empty=False,
    )


class ShippingRateWriteSerializer(serializers.Serializer):
    """
    Input for `POST /zones/<id>/rates/`.

    `methodName` (not a method id) because that is what the Add Rate
    modal sends — a fixed dropdown of method names. The service looks
    up the method by name and returns a 400 if it does not exist.
    """

    methodName = serializers.CharField(max_length=120)
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    eta = serializers.CharField(max_length=64, required=False, allow_blank=True)
    freeShippingThreshold = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        required=False, allow_null=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Methods
# ─────────────────────────────────────────────────────────────────────────────
class ShippingMethodSerializer(serializers.ModelSerializer):
    defaultPrice = serializers.FloatField(source="default_price", read_only=True)

    class Meta:
        model = ShippingMethod
        fields = (
            "id", "name", "description",
            "defaultPrice", "eta", "status",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Pickup Locations
# ─────────────────────────────────────────────────────────────────────────────
class PickupLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickupLocation
        fields = (
            "id", "name", "type", "address",
            "county", "phone", "hours", "status",
        )


class PickupLocationWriteSerializer(serializers.Serializer):
    """
    Input for `POST /pickups/`. The modal sends `name`, `type`,
    `address`, `county`, and (optionally) `phone`, `hours`.
    """

    name = serializers.CharField(max_length=180)
    type = serializers.ChoiceField(choices=PickupLocation.Type.choices)
    address = serializers.CharField(max_length=255)
    county = serializers.CharField(max_length=64)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    hours = serializers.CharField(max_length=120, required=False, allow_blank=True)


# ─────────────────────────────────────────────────────────────────────────────
# Couriers (Providers tab)
# ─────────────────────────────────────────────────────────────────────────────
class CourierConfigSerializer(serializers.ModelSerializer):
    """
    Read shape. `apiKey` is masked — the full secret never leaves the
    server. The frontend renders it in a `readOnly` password input,
    which is fine because it is a display-only field.
    """

    id = serializers.CharField(source="slug", read_only=True)
    logoBg = serializers.CharField(source="logo_bg", read_only=True)
    apiKey = serializers.CharField(source="masked_api_key", read_only=True)

    class Meta:
        model = CourierConfig
        fields = (
            "id", "name", "logoBg", "description",
            "apiKey", "enabled", "regions",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Shipments (Tracking tab)
# ─────────────────────────────────────────────────────────────────────────────
class ShipmentSerializer(serializers.ModelSerializer):
    """
    One row of the Tracking tab.

    `customerName` and `method` fall back to values on the Order when
    the Shipment's own FKs are unset — a shipment created before the
    admin links a method still renders a sensible row.
    """

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
    """
    Input for `PATCH /shipments/<id>/status/`.

    `status` is the raw model value ("Picked Up", "In Transit", …) —
    the frontend's dropdown sends the display label, which happens to
    match the choice's first element for every state.
    """

    status = serializers.ChoiceField(choices=Shipment.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)