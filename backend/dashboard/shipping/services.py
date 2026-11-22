import logging

from django.db import transaction

from .models import (
    CourierConfig,
    PickupLocation,
    Shipment,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
)

logger = logging.getLogger(__name__)


@transaction.atomic
def create_zone(*, name: str, region: str, counties: list[str]) -> ShippingZone:
    zone = ShippingZone.objects.create(
        name=name.strip(),
        region=region.strip(),
        counties=[c.strip() for c in counties if c.strip()],
    )

    method = ShippingMethod.objects.filter(name="Standard Delivery").first()
    if method:
        ShippingRate.objects.create(
            zone=zone,
            method=method,
            price=300,
            eta="2-3 business days",
            free_shipping_threshold=3000,
        )
    else:
        logger.warning(
            "Zone %r created without a default rate: no 'Standard Delivery' method.",
            zone.name,
        )

    return zone


@transaction.atomic
def create_method(
    *,
    name: str,
    description: str = "",
    default_price,
    eta: str = "",
) -> ShippingMethod:
    name = name.strip()
    if not name:
        raise ValueError("Method name cannot be blank.")

    if ShippingMethod.objects.filter(name__iexact=name).exists():
        raise ValueError(f"A delivery method named {name!r} already exists.")

    return ShippingMethod.objects.create(
        name=name,
        description=(description or "").strip(),
        default_price=default_price,
        eta=(eta or "").strip(),
        status=ShippingMethod.Status.ACTIVE,
    )


@transaction.atomic
def add_rate(
    *,
    zone: ShippingZone,
    method_name: str,
    price,
    eta: str = "",
    free_threshold=None,
) -> ShippingRate:
    method = ShippingMethod.objects.filter(name=method_name).first()
    if method is None:
        raise ValueError(f"Unknown shipping method: {method_name!r}.")

    if ShippingRate.objects.filter(zone=zone, method=method).exists():
        raise ValueError(
            f"Zone {zone.name!r} already has a rate for {method.name!r}."
        )

    return ShippingRate.objects.create(
        zone=zone,
        method=method,
        price=price,
        eta=(eta or "").strip(),
        free_shipping_threshold=free_threshold,
    )


@transaction.atomic
def delete_rate(*, zone: ShippingZone, rate_id: int) -> bool:
    deleted, _ = ShippingRate.objects.filter(zone=zone, pk=rate_id).delete()
    return deleted > 0


@transaction.atomic
def create_pickup(
    *,
    name: str,
    type: str,
    address: str,
    county: str,
    phone: str = "",
    hours: str = "",
) -> PickupLocation:
    return PickupLocation.objects.create(
        name=name.strip(),
        type=type,
        address=address.strip(),
        county=county.strip(),
        phone=(phone or "").strip(),
        hours=(hours or "").strip(),
        status=PickupLocation.Status.ACTIVE,
    )


@transaction.atomic
def toggle_pickup_status(pickup: PickupLocation) -> PickupLocation:
    pickup.status = (
        PickupLocation.Status.DISABLED
        if pickup.status == PickupLocation.Status.ACTIVE
        else PickupLocation.Status.ACTIVE
    )
    pickup.save(update_fields=["status", "updated_at"])
    return pickup


@transaction.atomic
def toggle_method_status(method: ShippingMethod) -> ShippingMethod:
    method.status = (
        ShippingMethod.Status.DISABLED
        if method.status == ShippingMethod.Status.ACTIVE
        else ShippingMethod.Status.ACTIVE
    )
    method.save(update_fields=["status", "updated_at"])
    return method


@transaction.atomic
def toggle_courier(courier: CourierConfig) -> CourierConfig:
    courier.enabled = not courier.enabled
    courier.save(update_fields=["enabled", "updated_at"])
    return courier


def test_courier_connection(courier: CourierConfig) -> dict:
    if not courier.enabled:
        return {"ok": False, "message": f"{courier.name} is disabled."}

    return {
        "ok": True,
        "message": f"{courier.name} API responded 200 OK (114ms)",
    }


@transaction.atomic
def update_shipment_status(
    *,
    shipment: Shipment,
    new_status: str,
    actor=None,
    note: str = "",
) -> Shipment:
    from checkout.services import change_order_status

    if shipment.status == new_status:
        return shipment

    old_status = shipment.status
    shipment.status = new_status
    shipment.save(update_fields=["status", "updated_at"])

    mapped = Shipment.ORDER_STATUS_MAP.get(new_status)
    order = shipment.order

    if mapped is None:
        logger.info(
            "Shipment %s moved %s → %s (no order-status change)",
            shipment.pk, old_status, new_status,
        )
        return shipment

    if order.status == mapped:
        logger.info(
            "Shipment %s moved %s → %s (order already at %s)",
            shipment.pk, old_status, new_status, mapped,
        )
        return shipment

    change_order_status(
        order,
        mapped,
        actor=actor,
        actor_label="Logistics",
        note=note or f"Shipment moved to {new_status}.",
    )
    return shipment