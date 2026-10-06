# dashboard/shipping/services.py

"""
Business logic for the shipping app.

Two categories:

  1. CRUD helpers that do more than a serializer save — `create_zone`
     creates a default rate, `add_rate` looks up the method by name.
  2. The Shipment → Order bridge — `update_shipment_status` maps the
     granular logistics state onto `Order.status` and delegates the
     write to `checkout.services.change_order_status`.

`checkout` is imported lazily inside functions to keep the module
graph acyclic: `checkout` does not import from here, and a top-level
import would create a load-order dependency Django would have to
resolve.
"""

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


# ─────────────────────────────────────────────────────────────────────────────
# Zones & Rates
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def create_zone(*, name: str, region: str, counties: list[str]) -> ShippingZone:
    """
    Create a zone with a default Standard Delivery rate.

    The default rate mirrors the frontend's previous local behavior:
    every new zone got a Standard Delivery rate at 300 / 3,000 free
    threshold. It keeps the new card non-empty and gives the admin
    something to edit instead of a blank rates block.

    If the Standard Delivery method does not exist yet, the zone is
    created without a rate and a warning is logged. The admin can add
    a rate manually. This is the correct trade-off: refusing to create
    the zone would be worse than a temporarily empty rate list.
    """
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
def add_rate(
    *,
    zone: ShippingZone,
    method_name: str,
    price,
    eta: str = "",
    free_threshold=None,
) -> ShippingRate:
    """
    Add a rate to a zone. Raises `ValueError` if the method does not
    exist or a rate for that method already exists in this zone.

    Both are 400-level conditions the view maps to a clear error. The
    unique constraint on `(zone, method)` is the source of truth for
    the second check — the service checks first so the caller gets a
    friendly message rather than an IntegrityError.
    """
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
    """
    Delete a rate from a zone. Returns True if a row was deleted,
    False if it did not exist. Silent on the not-found case so the
    view can return 204 either way.
    """
    deleted, _ = ShippingRate.objects.filter(zone=zone, pk=rate_id).delete()
    return deleted > 0


# ─────────────────────────────────────────────────────────────────────────────
# Pickup Locations
# ─────────────────────────────────────────────────────────────────────────────
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
    """Flip Active ↔ Disabled. Idempotent in the sense that it always
    flips — calling it twice returns the pickup to its original state."""
    pickup.status = (
        PickupLocation.Status.DISABLED
        if pickup.status == PickupLocation.Status.ACTIVE
        else PickupLocation.Status.ACTIVE
    )
    pickup.save(update_fields=["status", "updated_at"])
    return pickup


# ─────────────────────────────────────────────────────────────────────────────
# Methods
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def toggle_method_status(method: ShippingMethod) -> ShippingMethod:
    """Flip Active ↔ Disabled on a shipping method."""
    method.status = (
        ShippingMethod.Status.DISABLED
        if method.status == ShippingMethod.Status.ACTIVE
        else ShippingMethod.Status.ACTIVE
    )
    method.save(update_fields=["status", "updated_at"])
    return method


# ─────────────────────────────────────────────────────────────────────────────
# Couriers
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def toggle_courier(courier: CourierConfig) -> CourierConfig:
    courier.enabled = not courier.enabled
    courier.save(update_fields=["enabled", "updated_at"])
    return courier


def test_courier_connection(courier: CourierConfig) -> dict:
    """
    Stubbed connection probe. In a real integration this would call
    the courier's ping endpoint with `courier.api_key`.

    Returns a dict the view serializes. Today the response is a
    deterministic fake so the frontend's toast has something concrete
    to show.
    """
    if not courier.enabled:
        return {"ok": False, "message": f"{courier.name} is disabled."}

    # A real implementation would do:
    #     resp = requests.get(courier.ping_url, headers={"Authorization": f"Bearer {courier.api_key}"})
    # and inspect resp.status_code. Today: hardcoded.
    return {
        "ok": True,
        "message": f"{courier.name} API responded 200 OK (114ms)",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Shipments — the bridge to checkout.Order
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def update_shipment_status(
    *,
    shipment: Shipment,
    new_status: str,
    actor=None,
    note: str = "",
) -> Shipment:
    """
    Move a shipment to a new logistics status, and — where the mapping
    says so — reflect the change onto the parent Order.

    This is the ONLY place `Shipment.status` changes. Views call this;
    nothing else writes the field.

    The Order-status side is delegated to
    `checkout.services.change_order_status`, which is the only place
    `Order.status` changes and which handles the timeline event,
    the customer notification, and the RETURNED restock.

    Idempotent for the shipment side: a repeat call with the same
    status is a no-op. The order side has its own idempotency inside
    `change_order_status` — passing the status the order already has
    is also a no-op there, so the double-guard is deliberate but not
    redundant (they protect different invariants).

    PENDING and LABEL_CREATED have no Order-status mapping: the order
    is already paid and confirmed by the time a shipment exists. The
    shipment is created in PENDING and moved to LABEL_CREATED when the
    courier generates a label; neither transition is customer-visible.
    """
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
        # Order is already at the target. The change is customer-
        # invisible, but it happened at the shipment level.
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