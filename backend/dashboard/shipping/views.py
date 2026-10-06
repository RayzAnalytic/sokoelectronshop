# dashboard/shipping/views.py

"""
Admin shipping API. Mounted at /api/v1/dashboard/shipping/.

Endpoints:

    GET    /regions/                       — Kenya regions map
    GET    /zones/                         — list zones + rates
    POST   /zones/                         — create zone (+ default rate)
    DELETE /zones/<int:pk>/                — delete zone
    POST   /zones/<int:pk>/rates/          — add rate to zone
    DELETE /zones/<int:pk>/rates/<int:rate_id>/  — remove rate

    GET    /methods/                       — list methods
    POST   /methods/<int:pk>/toggle/       — flip Active/Disabled

    GET    /pickups/                       — list pickup locations
    POST   /pickups/                       — create pickup
    DELETE /pickups/<int:pk>/              — delete pickup
    POST   /pickups/<int:pk>/toggle/       — flip Active/Disabled

    GET    /shipments/?q=<search>          — list shipments
    PATCH  /shipments/<int:pk>/status/     — change shipment status

    GET    /couriers/                      — list couriers
    POST   /couriers/<slug:slug>/toggle/   — enable/disable
    POST   /couriers/<slug:slug>/test/     — ping connection

Every endpoint is staff-only. See `IsLogisticsStaff` below.

PATH PARAMETERS
    The courier endpoints key on `slug`, not `pk`. The
    `CourierConfigSerializer` exposes `id = slug` so the frontend
    never sees an integer for a courier — routing by pk would 404
    every toggle and test call. Slugs are also stable across
    database resets and environment differences, which makes them
    the right key for anything a client can hold onto.

    Every other resource uses `<int:pk>` and matches its serializer.
"""

import logging

from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import BasePermission
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


# ─────────────────────────────────────────────────────────────────────────────
# Permission
# ─────────────────────────────────────────────────────────────────────────────
class IsLogisticsStaff(BasePermission):
    """
    Gate for every endpoint in this module.

    Logistics staff see every customer's shipment and can change its
    status, which notifies the customer — that is not a customer-facing
    surface. `is_staff` is the gate today; replace the `is_staff`
    branch with a custom role check if the project's User model grows
    one.
    """

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


# ─────────────────────────────────────────────────────────────────────────────
# Regions — for the Add Zone modal
# ─────────────────────────────────────────────────────────────────────────────
class RegionsView(APIView):
    """
    GET /api/v1/dashboard/shipping/regions/

    The Kenya regions map the Add Zone modal iterates. Served from
    the backend so the region list is authoritative — the frontend
    keeps its own copy as a render fallback, but this endpoint is
    what a future edit writes to.
    """

    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        return Response(KENYA_REGIONS)


# ─────────────────────────────────────────────────────────────────────────────
# Zones & Rates
# ─────────────────────────────────────────────────────────────────────────────
class ZoneListCreateView(APIView):
    """
    GET  /api/v1/dashboard/shipping/zones/   — list with nested rates
    POST /api/v1/dashboard/shipping/zones/   — create (with default rate)
    """

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
    """
    DELETE /api/v1/dashboard/shipping/zones/<int:pk>/

    Cascade-deletes the zone and every rate it contains. Shipments
    that referenced a method inside the zone keep their FK (the FK is
    on the rate, not the zone) — deleting a zone does not orphan a
    shipment.
    """

    permission_classes = [IsLogisticsStaff]

    def delete(self, request, pk):
        deleted, _ = ShippingZone.objects.filter(pk=pk).delete()
        if not deleted:
            return _error("Zone not found.", http_status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ZoneRateAddView(APIView):
    """
    POST /api/v1/dashboard/shipping/zones/<int:pk>/rates/

    Add a rate to an existing zone. Body:
        { methodName, price, eta?, freeShippingThreshold? }
    """

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
    """
    DELETE /api/v1/dashboard/shipping/zones/<int:pk>/rates/<int:rate_id>/

    Idempotent — a rate that does not exist returns 204, matching the
    frontend's local behavior where deleting a rate that has already
    been deleted is a silent no-op.
    """

    permission_classes = [IsLogisticsStaff]

    def delete(self, request, pk, rate_id):
        zone = ShippingZone.objects.filter(pk=pk).first()
        if not zone:
            return _error("Zone not found.", http_status=404)

        delete_rate(zone=zone, rate_id=rate_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Methods
# ─────────────────────────────────────────────────────────────────────────────
class MethodListView(APIView):
    """GET /api/v1/dashboard/shipping/methods/"""

    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        return Response(ShippingMethodSerializer(ShippingMethod.objects.all(), many=True).data)


class MethodToggleView(APIView):
    """
    POST /api/v1/dashboard/shipping/methods/<int:pk>/toggle/

    Flips Active ↔ Disabled. Returns the refreshed method.
    """

    permission_classes = [IsLogisticsStaff]

    def post(self, request, pk):
        method = ShippingMethod.objects.filter(pk=pk).first()
        if not method:
            return _error("Method not found.", http_status=404)
        method = toggle_method_status(method)
        return Response(ShippingMethodSerializer(method).data)


# ─────────────────────────────────────────────────────────────────────────────
# Pickup Locations
# ─────────────────────────────────────────────────────────────────────────────
class PickupListCreateView(APIView):
    """
    GET  /api/v1/dashboard/shipping/pickups/   — list
    POST /api/v1/dashboard/shipping/pickups/   — create
    """

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
    """DELETE /api/v1/dashboard/shipping/pickups/<int:pk>/"""

    permission_classes = [IsLogisticsStaff]

    def delete(self, request, pk):
        deleted, _ = PickupLocation.objects.filter(pk=pk).delete()
        if not deleted:
            return _error("Pickup location not found.", http_status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PickupToggleView(APIView):
    """POST /api/v1/dashboard/shipping/pickups/<int:pk>/toggle/"""

    permission_classes = [IsLogisticsStaff]

    def post(self, request, pk):
        pickup = PickupLocation.objects.filter(pk=pk).first()
        if not pickup:
            return _error("Pickup location not found.", http_status=404)
        pickup = toggle_pickup_status(pickup)
        return Response(PickupLocationSerializer(pickup).data)


# ─────────────────────────────────────────────────────────────────────────────
# Shipments (Tracking tab)
# ─────────────────────────────────────────────────────────────────────────────
class ShipmentListView(APIView):
    """
    GET /api/v1/dashboard/shipping/shipments/?q=<search>

    Free-text search matches the same fields the frontend's filter
    input does: order #, tracking #, customer name, destination.
    """

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
    """
    PATCH /api/v1/dashboard/shipping/shipments/<int:pk>/status/

    Body: { status: "<Shipment.Status value>", note?: "..." }

    Delegates to `services.update_shipment_status`, which maps the
    new logistics state onto `Order.status` and writes the order
    timeline through `checkout.services.change_order_status`.

    The order side fires the customer notification on the transitions
    that matter — no additional notification is triggered here.
    """

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


# ─────────────────────────────────────────────────────────────────────────────
# Couriers (Providers tab)
#
# Routed by SLUG, not pk. The `CourierConfigSerializer` exposes
# `id = slug` — the frontend sends `easycoach`, not `5`. An
# `<int:pk>` route rejects that path segment before the view runs,
# producing a 404 with no view-level log line. See the module
# docstring's PATH PARAMETERS note.
# ─────────────────────────────────────────────────────────────────────────────
class CourierListView(APIView):
    """GET /api/v1/dashboard/shipping/couriers/"""

    permission_classes = [IsLogisticsStaff]

    def get(self, request):
        return Response(CourierConfigSerializer(CourierConfig.objects.all(), many=True).data)


class CourierToggleView(APIView):
    """
    POST /api/v1/dashboard/shipping/couriers/<slug:slug>/toggle/

    Flips the courier's `enabled` flag. Returns the refreshed
    courier with the API key still masked.
    """

    permission_classes = [IsLogisticsStaff]

    def post(self, request, slug):
        courier = CourierConfig.objects.filter(slug=slug).first()
        if not courier:
            return _error("Courier not found.", http_status=404)
        courier = toggle_courier(courier)
        return Response(CourierConfigSerializer(courier).data)


class CourierTestView(APIView):
    """
    POST /api/v1/dashboard/shipping/couriers/<slug:slug>/test/

    Returns `{ ok: bool, message: str }`. Stubbed today — see
    `services.test_courier_connection`.

    `ok: false` returns HTTP 200 with the failure message in the
    body — the frontend toast renders it verbatim, and a 4xx would
    trip the client's generic error path instead of showing the
    specific reason.
    """

    permission_classes = [IsLogisticsStaff]

    def post(self, request, slug):
        courier = CourierConfig.objects.filter(slug=slug).first()
        if not courier:
            return _error("Courier not found.", http_status=404)
        result = test_courier_connection(courier)
        return Response(result)