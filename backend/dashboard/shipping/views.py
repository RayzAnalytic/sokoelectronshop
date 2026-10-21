import logging

from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    KENYA_REGIONS,
    CourierConfig,
    PickupLocation,
    Shipment,
    ShippingMethod,
    ShippingZone,
)
from .serializers import (
    CourierConfigSerializer,
    PickupLocationSerializer,
    PickupLocationWriteSerializer,
    ShipmentSerializer,
    ShipmentStatusWriteSerializer,
    ShippingMethodSerializer,
    ShippingRateWriteSerializer,
    ShippingZoneSerializer,
    ShippingZoneWriteSerializer,
)
from .services import (
    add_rate,
    create_pickup,
    create_zone,
    delete_rate,
    test_courier_connection,
    toggle_courier,
    toggle_method_status,
    toggle_pickup_status,
    update_shipment_status,
)

logger = logging.getLogger(__name__)


class IsLogisticsStaff(BasePermission):
    message = "Only logistics staff can access shipping configuration."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return bool(getattr(user, "is_staff", False))


def _error(message, code="error", http_status=400):
    return Response({"code": code, "detail": message}, status=http_status)


class RegionsView(APIView):
    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        return Response(KENYA_REGIONS)


class ZoneListCreateView(APIView):
    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        qs = ShippingZone.objects.prefetch_related("rates__method").all()
        return Response(ShippingZoneSerializer(qs, many=True).data)

    def post(self, request):
        ser = ShippingZoneWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            zone = create_zone(
                name=ser.validated_data["name"],
                region=ser.validated_data["region"],
                counties=ser.validated_data["counties"],
            )
        except Exception as exc:
            logger.exception("create_zone failed")
            return _error(str(exc), code="zone_create_failed")

        zone = (
            ShippingZone.objects
            .prefetch_related("rates__method")
            .get(pk=zone.pk)
        )
        return Response(
            ShippingZoneSerializer(zone).data,
            status=status.HTTP_201_CREATED,
        )


class ZoneDetailView(APIView):
    permission_classes = [IsLogisticsStaff]

    def delete(self, request, pk):
        deleted, _ = ShippingZone.objects.filter(pk=pk).delete()
        if not deleted:
            return _error("Zone not found.", http_status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ZoneRateAddView(APIView):
    permission_classes = [IsLogisticsStaff]

    def post(self, request, pk):
        zone = ShippingZone.objects.filter(pk=pk).first()
        if not zone:
            return _error("Zone not found.", http_status=404)

        ser = ShippingRateWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            add_rate(
                zone=zone,
                method_name=ser.validated_data["methodName"],
                price=ser.validated_data["price"],
                eta=ser.validated_data.get("eta") or "",
                free_threshold=ser.validated_data.get("freeShippingThreshold"),
            )
        except ValueError as exc:
            return _error(str(exc), code="rate_error")

        zone = (
            ShippingZone.objects
            .prefetch_related("rates__method")
            .get(pk=zone.pk)
        )
        return Response(
            ShippingZoneSerializer(zone).data,
            status=status.HTTP_201_CREATED,
        )


class ZoneRateDeleteView(APIView):
    permission_classes = [IsLogisticsStaff]

    def delete(self, request, pk, rate_id):
        zone = ShippingZone.objects.filter(pk=pk).first()
        if not zone:
            return _error("Zone not found.", http_status=404)

        delete_rate(zone=zone, rate_id=rate_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MethodListView(APIView):
    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        return Response(
            ShippingMethodSerializer(
                ShippingMethod.objects.all(), many=True,
            ).data
        )


class MethodToggleView(APIView):
    permission_classes = [IsLogisticsStaff]

    def post(self, request, pk):
        method = ShippingMethod.objects.filter(pk=pk).first()
        if not method:
            return _error("Method not found.", http_status=404)
        method = toggle_method_status(method)
        return Response(ShippingMethodSerializer(method).data)


class PickupListCreateView(APIView):
    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        qs = PickupLocation.objects.all()
        return Response(PickupLocationSerializer(qs, many=True).data)

    def post(self, request):
        ser = PickupLocationWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        pickup = create_pickup(
            name=ser.validated_data["name"],
            type=ser.validated_data["type"],
            address=ser.validated_data["address"],
            county=ser.validated_data["county"],
            phone=ser.validated_data.get("phone") or "",
            hours=ser.validated_data.get("hours") or "",
        )
        return Response(
            PickupLocationSerializer(pickup).data,
            status=status.HTTP_201_CREATED,
        )


class PickupDetailView(APIView):
    permission_classes = [IsLogisticsStaff]

    def delete(self, request, pk):
        deleted, _ = PickupLocation.objects.filter(pk=pk).delete()
        if not deleted:
            return _error("Pickup location not found.", http_status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PickupToggleView(APIView):
    permission_classes = [IsLogisticsStaff]

    def post(self, request, pk):
        pickup = PickupLocation.objects.filter(pk=pk).first()
        if not pickup:
            return _error("Pickup location not found.", http_status=404)
        pickup = toggle_pickup_status(pickup)
        return Response(PickupLocationSerializer(pickup).data)


class ShipmentListView(APIView):
    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        qs = (
            Shipment.objects
            .select_related("order", "order__user", "method", "provider")
            .all()
        )

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(order__reference__icontains=q)
                | Q(tracking_number__icontains=q)
                | Q(destination__icontains=q)
                | Q(order__contact_email__icontains=q)
                | Q(order__snapshot__full_name__icontains=q)
            )

        return Response(ShipmentSerializer(qs, many=True).data)


class ShipmentStatusView(APIView):
    permission_classes = [IsLogisticsStaff]

    def patch(self, request, pk):
        shipment = (
            Shipment.objects
            .select_related("order")
            .filter(pk=pk)
            .first()
        )
        if not shipment:
            return _error("Shipment not found.", http_status=404)

        ser = ShipmentStatusWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        shipment = update_shipment_status(
            shipment=shipment,
            new_status=ser.validated_data["status"],
            actor=request.user,
            note=ser.validated_data.get("note") or "",
        )
        shipment = (
            Shipment.objects
            .select_related("order", "method", "provider")
            .get(pk=shipment.pk)
        )
        return Response(ShipmentSerializer(shipment).data)


class CourierListView(APIView):
    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        return Response(
            CourierConfigSerializer(
                CourierConfig.objects.all(), many=True,
            ).data
        )


class CourierToggleView(APIView):
    permission_classes = [IsLogisticsStaff]

    def post(self, request, slug):
        courier = CourierConfig.objects.filter(slug=slug).first()
        if not courier:
            return _error("Courier not found.", http_status=404)
        courier = toggle_courier(courier)
        return Response(CourierConfigSerializer(courier).data)


class CourierTestView(APIView):
    permission_classes = [IsLogisticsStaff]

    def post(self, request, slug):
        courier = CourierConfig.objects.filter(slug=slug).first()
        if not courier:
            return _error("Courier not found.", http_status=404)
        result = test_courier_connection(courier)
        return Response(result)


class PublicZoneListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            ShippingZone.objects
            .prefetch_related("rates__method")
            .order_by("name")
        )
        return Response(ShippingZoneSerializer(qs, many=True).data)


class PublicZoneDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        zone = (
            ShippingZone.objects
            .prefetch_related("rates__method")
            .filter(pk=pk)
            .first()
        )
        if not zone:
            return _error("Zone not found.", http_status=404)
        return Response(ShippingZoneSerializer(zone).data)