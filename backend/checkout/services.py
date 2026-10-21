import logging
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils import timezone

from authentication.managers import normalize_phone

from catalog.models import Product
from dashboard.inventory.models import StockMovement

from . import constants, mpesa
from .exceptions import (
    CheckoutError,
    CouponError,
    MpesaError,
    PricingError,
)
from .models import (
    Cart,
    CartItem,
    Coupon,
    Order,
    OrderItem,
    OrderStatusEvent,
    Payment,
    PaymentEvent,
    ReconciliationLog,
)

logger = logging.getLogger(__name__)


_DELIVERY_KEY_TO_METHOD_NAME = {
    "standard": "Standard Delivery",
    "express": "Express Boda",
    "pickup": "Pickup Mtaani / Locker",
}


def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _allow_guest_checkout() -> bool:
    s = _settings()
    return bool(s['checkout'].allow_guest_checkout) if s else True


def _require_phone() -> bool:
    s = _settings()
    return bool(s['checkout'].require_phone) if s else True


def _auto_confirm_orders() -> bool:
    s = _settings()
    return bool(s['checkout'].auto_confirm_orders) if s else False


def _mpesa_enabled() -> bool:
    s = _settings()
    return bool(s['payments'].mpesa_enabled) if s else True


def _min_amount_kes() -> Decimal:
    s = _settings()
    if s:
        return Decimal(str(s['payments'].min_amount_kes))
    return Decimal("0")


def _max_amount_kes() -> Decimal:
    s = _settings()
    if s:
        return Decimal(str(s['payments'].max_amount_kes))
    return Decimal("999999999")


def _transaction_fee_kes() -> Decimal:
    s = _settings()
    if s:
        return Decimal(str(s['payments'].transaction_fee_kes))
    return Decimal("0")


def _shipping_enabled() -> bool:
    s = _settings()
    return bool(s['shipping'].shipping_enabled) if s else True


def _local_pickup_enabled() -> bool:
    s = _settings()
    return bool(s['shipping'].local_pickup_enabled) if s else True


def _resolve_zone(county: str):
    if not county:
        return None
    normalized = county.strip().lower()
    if not normalized:
        return None

    from dashboard.shipping.models import ShippingZone

    for zone in ShippingZone.objects.all():
        counties = zone.counties or []
        for c in counties:
            if str(c).strip().lower() == normalized:
                return zone
    return None


def _resolve_shipping_rate(delivery_method: str, county: str):
    name = _DELIVERY_KEY_TO_METHOD_NAME.get(delivery_method)
    if not name:
        return None

    zone = _resolve_zone(county)
    if zone is None:
        return None

    from dashboard.shipping.models import ShippingMethod, ShippingRate

    method = (
        ShippingMethod.objects
        .filter(name=name, status=ShippingMethod.Status.ACTIVE)
        .first()
    )
    if method is None:
        return None

    return (
        ShippingRate.objects
        .filter(zone=zone, method=method)
        .first()
    )


def _resolve_shipping_fee(delivery_method: str, county: str = "") -> Decimal:
    if delivery_method == "pickup":
        rate = _resolve_shipping_rate(delivery_method, county)
        if rate is not None:
            return Decimal(str(rate.price))
        return Decimal("0")

    rate = _resolve_shipping_rate(delivery_method, county)
    if rate is not None:
        return Decimal(str(rate.price))

    return Decimal("0")


def _default_delivery_fee() -> Decimal:
    return _resolve_shipping_fee("standard")


def _free_shipping_threshold(
    delivery_method: str = "",
    county: str = "",
) -> Decimal:
    if delivery_method:
        rate = _resolve_shipping_rate(delivery_method, county)
        if rate is not None:
            if rate.free_shipping_threshold is not None:
                return Decimal(str(rate.free_shipping_threshold))
            return Decimal("0")

    s = _settings()
    if s:
        return Decimal(str(s['shipping'].free_shipping_threshold_kes))
    return constants.FREE_DELIVERY_THRESHOLD


def _vat_enabled() -> bool:
    s = _settings()
    return bool(s['tax'].vat_enabled) if s else True


def _vat_rate() -> Decimal:
    s = _settings()
    if s:
        return Decimal(str(s['tax'].vat_rate)) / Decimal("100")
    return constants.TAX_RATE


def _prices_include_tax() -> bool:
    s = _settings()
    return bool(s['tax'].prices_include_tax) if s else False


def _notify_on_shipped() -> bool:
    s = _settings()
    return bool(s['notifs'].notify_on_shipped) if s else True


def _notify_on_cancelled() -> bool:
    s = _settings()
    return bool(s['notifs'].notify_on_cancelled) if s else True


def _fire_event(event_name: str, payload: dict) -> None:
    try:
        from dashboard.aiautomations.services import dispatch
        dispatch(event_name, payload)
    except Exception:
        logger.exception(
            "Automation dispatch failed for event %s", event_name,
        )


def validate_coupon(code: str, subtotal: Decimal) -> Coupon:
    if not code:
        raise CouponError("Coupon code is required.")

    code = code.strip().upper()
    try:
        coupon = Coupon.objects.get(code=code)
    except Coupon.DoesNotExist:
        raise CouponError("Invalid coupon code.")

    if not coupon.active:
        raise CouponError("This coupon is no longer active.")

    now = timezone.now()
    if coupon.valid_from and now < coupon.valid_from:
        raise CouponError("This coupon is not yet valid.")
    if coupon.valid_to and now > coupon.valid_to:
        raise CouponError("This coupon has expired.")
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        raise CouponError("This coupon has reached its usage limit.")
    if subtotal < coupon.min_subtotal:
        raise CouponError(
            f"Minimum order of {coupon.min_subtotal} KES required."
        )

    return coupon


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _validate_amount_bounds(total: Decimal) -> None:
    floor = _min_amount_kes()
    ceiling = _max_amount_kes()

    if floor > 0 and total < floor:
        raise PricingError(
            f"Order total is below the shop's minimum of KES {floor:,.0f}."
        )
    if ceiling > 0 and total > ceiling:
        raise PricingError(
            f"Order total exceeds the shop's maximum of KES {ceiling:,.0f}. "
            "Please contact support to place this order."
        )


def _validate_shipping_method(method: str) -> None:
    if method == 'pickup':
        if not _local_pickup_enabled():
            raise PricingError("Local pickup is currently unavailable.")
        return

    if not _shipping_enabled():
        raise PricingError(
            "Delivery is currently unavailable. "
            "Please choose a different option or try again later."
        )


def recompute_totals(checkout: dict, *, is_member: bool) -> dict:
    items = checkout["items"]
    subtotal = sum(
        (Decimal(str(i["price"])) * int(i["quantity"]) for i in items),
        Decimal("0"),
    )
    subtotal = _round2(subtotal)

    discount = Decimal("0")
    coupon_code = (checkout.get("coupon") or "").strip().upper()
    if coupon_code:
        coupon = validate_coupon(coupon_code, subtotal)
        discount = _round2(subtotal * coupon.percent_off)

    method = checkout["delivery_method"]
    _validate_shipping_method(method)

    address = checkout.get("address") or {}
    county = (address.get("county") or "").strip()

    threshold = _free_shipping_threshold(method, county)
    if threshold > 0 and (subtotal - discount) >= threshold:
        shipping = Decimal("0")
    elif method == "pickup":
        shipping = Decimal("0")
    elif method == "express" and is_member:
        shipping = Decimal("0")
    else:
        shipping = _resolve_shipping_fee(method, county)

    taxable = subtotal - discount
    if not _vat_enabled():
        tax = Decimal("0")
    elif _prices_include_tax():
        rate = _vat_rate()
        tax = _round2(taxable * rate / (Decimal("1") + rate))
    else:
        tax = _round2(taxable * _vat_rate())

    txn_fee = _transaction_fee_kes()

    if _prices_include_tax() and _vat_enabled():
        total = _round2(subtotal - discount + shipping + txn_fee)
    else:
        total = _round2(subtotal - discount + shipping + tax + txn_fee)

    _validate_amount_bounds(total)

    server_totals = {
        "subtotal": subtotal,
        "discount": discount,
        "shipping": shipping,
        "tax": tax,
        "total": total,
    }

    client = checkout["totals"]
    strict_keys = ("subtotal", "discount", "tax")
    advisory_keys = ("shipping", "total")

    for key in strict_keys:
        client_val = Decimal(str(client.get(key, "0"))).quantize(Decimal("0.01"))
        if client_val != server_totals[key]:
            raise PricingError(
                f"Price mismatch on '{key}': "
                f"client={client_val} server={server_totals[key]}"
            )

    for key in advisory_keys:
        client_val = Decimal(str(client.get(key, "0"))).quantize(Decimal("0.01"))
        if client_val != server_totals[key]:
            logger.info(
                "Server overrode client '%s': client=%s server=%s",
                key, client_val, server_totals[key],
            )

    return server_totals


def _build_snapshot(checkout: dict, totals: dict) -> dict:
    address = checkout["address"]
    return {
        "email": checkout["email"],
        "phone": checkout["phone"],
        "full_name": checkout["full_name"],
        "address_street": address["street"],
        "address_town": address["town"],
        "address_county": address["county"],
        "address_postal_code": address.get("postal_code", "") or "",
        "delivery_method": checkout["delivery_method"],
        "estimated_delivery": checkout.get("estimated_delivery", "") or "",
        "coupon": (checkout.get("coupon") or "").strip().upper() or None,
        "notes": checkout.get("notes") or None,
        "subtotal": str(totals["subtotal"]),
        "discount": str(totals["discount"]),
        "shipping": str(totals["shipping"]),
        "tax": str(totals["tax"]),
        "total": str(totals["total"]),
        "items": [
            {
                "productId": i.get("productId", ""),
                "name": i["name"],
                "brand": i.get("brand", "") or "",
                "price": str(i["price"]),
                "quantity": int(i["quantity"]),
                "image": i.get("image", "") or "",
            }
            for i in checkout["items"]
        ],
    }


def record_status_event(
    order: Order,
    *,
    from_status: str,
    to_status: str,
    actor=None,
    actor_label: str = "",
    note: str = "",
) -> OrderStatusEvent:
    try:
        with transaction.atomic():
            return OrderStatusEvent.objects.create(
                order=order,
                from_status=from_status or "",
                to_status=to_status,
                actor=actor if getattr(actor, "pk", None) else None,
                actor_label=(actor_label or "")[:120],
                note=note or "",
            )
    except Exception:
        logger.exception(
            "Failed to record status event for order %s (%s → %s)",
            order.reference, from_status or "∅", to_status,
        )
        return None


def change_order_status(
    order: Order,
    new_status: str,
    *,
    actor=None,
    actor_label: str = "System",
    note: str = "",
    notify: bool = True,
) -> Order:
    old_status = order.status

    if old_status == new_status:
        return order

    should_restock = False
    restock_reason = None
    restock_note = ""

    if new_status == Order.Status.RETURNED:
        should_restock = True
        restock_reason = StockMovement.Reason.RETURN
        restock_note = f"Returned on order {order.reference}"

    elif new_status == Order.Status.CANCELLED and old_status not in (
        Order.Status.DELIVERED,
        Order.Status.RETURNED,
        Order.Status.CANCELLED,
    ):
        should_restock = True
        restock_reason = getattr(
            StockMovement.Reason, "CANCELLATION",
            StockMovement.Reason.RETURN,
        )
        restock_note = f"Restocked — order {order.reference} cancelled"

    order.status = new_status
    order.save(update_fields=["status", "updated_at"])

    record_status_event(
        order,
        from_status=old_status,
        to_status=new_status,
        actor=actor,
        actor_label=actor_label,
        note=note,
    )

    _fire_event(
        f"order.status.{new_status}",
        {
            "order_id": order.pk,
            "reference": order.reference,
            "customer_id": order.user_id,
            "old_status": old_status,
            "new_status": new_status,
            "note": note or "",
        },
    )

    if should_restock:
        for item in order.items.all():
            if not item.product_id:
                continue

            updated = Product.objects.filter(pk=item.product_id).update(
                stock_quantity=F("stock_quantity") + item.quantity
            )
            if not updated:
                logger.warning(
                    "Cannot restock deleted product %s on %s of %s",
                    item.product_id, new_status, order.reference,
                )
                continue

            StockMovement.objects.create(
                product_id=item.product_id,
                quantity_delta=item.quantity,
                reason=restock_reason,
                reference=order.reference,
                actor=actor if getattr(actor, "pk", None) else None,
                notes=restock_note,
            )

    if notify and order.user_id:
        try:
            from account.services import (
                notify_order_shipped,
                notify_order_delivered,
                notify_order_cancelled,
            )

            if new_status == Order.Status.SHIPPED and _notify_on_shipped():
                notify_order_shipped(order.user, order)
            elif new_status == Order.Status.DELIVERED:
                notify_order_delivered(order.user, order)
            elif new_status == Order.Status.CANCELLED and _notify_on_cancelled():
                notify_order_cancelled(order.user, order, reason=note)
        except Exception:
            logger.exception(
                "Failed to notify customer for order %s status change to %s",
                order.reference, new_status,
            )

    return order


@transaction.atomic
def _persist_order(
    *,
    user,
    checkout: dict,
    totals: dict,
    coupon_code: str,
    payment_method: str,
    status: str,
    payment_status: str,
    idempotency_key: str,
    source: str = Order.Source.WEB,
    channel_meta: dict | None = None,
) -> Order:
    snapshot = _build_snapshot(checkout, totals)
    if idempotency_key:
        snapshot["_idempotency_key"] = idempotency_key

    raw_email = (
        (checkout.get("email") or "").strip().lower()
        or (getattr(user, "email", "") or "").strip().lower()
    )
    raw_phone = (
        (checkout.get("phone") or "").strip()
        or (getattr(user, "phone", "") or "").strip()
    )

    order = Order.objects.create(
        user=user,
        source=source,
        channel_meta=channel_meta or {},
        payment_method=payment_method,
        status=status,
        payment_status=payment_status,
        delivery_method=checkout["delivery_method"],
        estimated_delivery=checkout.get("estimated_delivery", "") or "",
        notes=checkout.get("notes") or "",
        coupon_code=coupon_code,
        contact_email=raw_email,
        contact_phone=normalize_phone(raw_phone),
        subtotal=totals["subtotal"],
        discount=totals["discount"],
        shipping=totals["shipping"],
        tax=totals["tax"],
        total=totals["total"],
        client_total=Decimal(str(checkout["totals"]["total"])),
        snapshot=snapshot,
    )

    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                product_id=i.get("productId", ""),
                name=i["name"],
                brand=i.get("brand", "") or "",
                unit_price=Decimal(str(i["price"])),
                quantity=int(i["quantity"]),
                image_url=i.get("image", "") or "",
            )
            for i in checkout["items"]
        ]
    )

    for item in checkout["items"]:
        pid = item.get("productId")
        if not pid:
            continue

        qty = int(item["quantity"])

        updated = (
            Product.objects
            .filter(pk=pid, stock_quantity__gte=qty)
            .update(stock_quantity=F("stock_quantity") - qty)
        )

        if not updated:
            product = (
                Product.objects
                .filter(pk=pid)
                .values("name", "stock_quantity")
                .first()
            )
            if product is None:
                raise CheckoutError(
                    "A product in your cart is no longer available."
                )
            raise CheckoutError(
                f"Only {product['stock_quantity']} of "
                f"“{product['name']}” left in stock. "
                f"You requested {qty}."
            )

        StockMovement.objects.create(
            product_id=pid,
            quantity_delta=-qty,
            reason=StockMovement.Reason.SALE,
            reference=order.reference,
            actor=user if user else None,
            notes=f"Sold on order {order.reference}",
        )

        try:
            row = (
                Product.objects
                .filter(pk=pid)
                .values("stock_quantity", "low_stock_threshold")
                .first()
            )
            if (
                row
                and row["low_stock_threshold"]
                and row["stock_quantity"] < row["low_stock_threshold"]
            ):
                _fire_event(
                    "stock.below_threshold",
                    {
                        "product_id": pid,
                        "stock": row["stock_quantity"],
                        "threshold": row["low_stock_threshold"],
                    },
                )
        except Exception:
            logger.exception(
                "Failed to evaluate stock threshold for product %s", pid,
            )

    if coupon_code:
        Coupon.objects.filter(code=coupon_code).update(
            used_count=F("used_count") + 1
        )

    record_status_event(
        order,
        from_status="",
        to_status=status,
        actor=user,
        actor_label="Customer" if user else "Guest",
        note="Order placed.",
    )

    if payment_method == Order.PaymentMethod.COD:
        cod_payment = Payment.objects.create(
            order=order,
            method=Payment.Method.COD,
            status=Payment.Status.PENDING,
            amount=totals["total"],
            fee=Decimal("0"),
            phone_number=order.contact_phone or "",
            idempotency_key=f"cod-{order.reference}-{idempotency_key}"[:64],
        )
        PaymentEvent.log(
            cod_payment,
            "Cash-on-delivery order placed",
            detail="Awaiting rider collection.",
        )

    _fire_event(
        "order.placed",
        {
            "order_id": order.pk,
            "reference": order.reference,
            "customer_id": order.user_id,
            "total": float(totals["total"]),
            "channel": source,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "item_count": len(checkout["items"]),
        },
    )

    return order


def _find_order_by_idempotency_key(idempotency_key: str) -> Order | None:
    if not idempotency_key:
        return None
    return (
        Order.objects
        .filter(snapshot___idempotency_key=idempotency_key)
        .first()
    )


def _find_orphan_pending_orders(*, user, checkout: dict) -> list:
    qs = Order.objects.filter(
        status=Order.Status.PENDING,
        payment_status=Order.PaymentStatus.UNPAID,
    )

    if user is not None:
        qs = qs.filter(user=user)
    else:
        email = (checkout.get("email") or "").strip().lower()
        phone = normalize_phone(checkout.get("phone") or "")
        q = Q()
        if email:
            q |= Q(contact_email__iexact=email)
        if phone:
            q |= Q(contact_phone=phone)
        if not q:
            return []
        qs = qs.filter(q, user__isnull=True)

    qs = qs.exclude(payments__status=Payment.Status.SUCCESS)

    return list(qs)


def _kill_live_payments(order: Order, *, reason: str) -> None:
    if not order or not order.pk:
        return

    for p in order.payments.filter(
        status__in=[Payment.Status.PENDING, Payment.Status.PROCESSING],
    ):
        try:
            transition_payment(
                p,
                Payment.Status.CANCELLED,
                result_description=reason,
            )
        except Exception:
            logger.exception(
                "Failed to cancel live payment %s on order %s",
                p.pk, order.reference,
            )


def claim_guest_orders(user) -> int:
    email = (getattr(user, "email", "") or "").strip().lower()
    phone = normalize_phone(getattr(user, "phone", "") or "")

    q = Q()
    if email:
        q |= Q(contact_email__iexact=email)
    if phone:
        q |= Q(contact_phone=phone)

    if not q:
        return 0

    updated = (
        Order.objects
        .filter(q, user__isnull=True)
        .update(user=user)
    )

    if updated:
        logger.info(
            "Claimed %d guest order(s) for user %s", updated, user.pk,
        )
    return updated


def _validate_checkout_gates(user, checkout_payload: dict) -> None:
    if user is None and not _allow_guest_checkout():
        raise CheckoutError(
            "Guest checkout is currently disabled. Please sign in to place an order."
        )

    if _require_phone():
        phone = (checkout_payload.get("phone") or "").strip()
        if not phone:
            user_phone = (getattr(user, "phone", "") or "").strip() if user else ""
            if not user_phone:
                raise CheckoutError(
                    "A phone number is required to complete this order."
                )


@transaction.atomic
def create_order(
    *,
    checkout_payload: dict,
    payment_method: str,
    user,
    idempotency_key: str,
) -> Order:
    _validate_checkout_gates(user, checkout_payload)

    if payment_method == Order.PaymentMethod.MPESA and not _mpesa_enabled():
        raise CheckoutError(
            "M-Pesa is currently unavailable. Please choose Cash on Delivery."
        )

    existing = _find_order_by_idempotency_key(idempotency_key)
    if existing:
        if user is not None and existing.user_id != user.id:
            raise CheckoutError("Idempotency key already used.")
        logger.info(
            "Replayed create_order for key %s → %s",
            idempotency_key,
            existing.reference,
        )
        return existing

    for stale in _find_orphan_pending_orders(
        user=user, checkout=checkout_payload,
    ):
        _kill_live_payments(
            stale, reason="Superseded by a new checkout attempt.",
        )
        change_order_status(
            stale,
            Order.Status.CANCELLED,
            actor=user,
            actor_label="System",
            note="Superseded by a new checkout attempt.",
            notify=False,
        )

    is_member = user is not None
    totals = recompute_totals(checkout_payload, is_member=is_member)

    if payment_method == Order.PaymentMethod.COD:
        status_value = Order.Status.CONFIRMED
        payment_status_value = Order.PaymentStatus.UNPAID
    else:
        status_value = Order.Status.PENDING
        payment_status_value = Order.PaymentStatus.UNPAID

    source = checkout_payload.get("source") or Order.Source.WEB
    channel_meta = checkout_payload.get("channel_meta") or {}

    return _persist_order(
        user=user,
        checkout=checkout_payload,
        totals=totals,
        coupon_code=(checkout_payload.get("coupon") or "").strip().upper(),
        payment_method=payment_method,
        status=status_value,
        payment_status=payment_status_value,
        idempotency_key=idempotency_key,
        source=source,
        channel_meta=channel_meta,
    )


@transaction.atomic
def abandon_pending_order(*, order: Order, user) -> Order | None:
    if not order:
        return None

    if order.status == Order.Status.CANCELLED:
        return order

    if order.status != Order.Status.PENDING:
        return None

    if order.payment_status == Order.PaymentStatus.PAID:
        return None
    if Payment.objects.filter(
        order=order, status=Payment.Status.SUCCESS,
    ).exists():
        return None

    _kill_live_payments(
        order, reason="Abandoned — customer changed payment method.",
    )

    return change_order_status(
        order,
        Order.Status.CANCELLED,
        actor=user,
        actor_label="Customer" if user else "Guest",
        note="Abandoned — customer changed payment method.",
        notify=False,
    )


@transaction.atomic
def create_payment(
    *,
    order: Order,
    idempotency_key: str,
    phone: str,
    amount: Decimal,
) -> Payment:
    existing = (
        Payment.objects.select_for_update()
        .filter(idempotency_key=idempotency_key)
        .first()
    )
    if existing:
        return existing

    return Payment.objects.create(
        order=order,
        method=order.payment_method,
        status=Payment.Status.PENDING,
        amount=amount,
        phone_number=phone,
        idempotency_key=idempotency_key,
    )


def transition_payment(
    payment: Payment,
    new_status: str,
    *,
    result_code: int | None = None,
    result_description: str | None = None,
    mpesa_receipt_number: str | None = None,
    merchant_request_id: str | None = None,
    checkout_request_id: str | None = None,
    raw_callback: dict | None = None,
) -> Payment:
    if payment.status in Payment.TERMINAL_STATUSES:
        logger.warning(
            "Attempted transition on terminal payment %s from %s to %s",
            payment.id,
            payment.status,
            new_status,
        )
        return payment

    payment.status = new_status
    if result_code is not None:
        payment.result_code = result_code
    if result_description is not None:
        payment.result_description = result_description
    if mpesa_receipt_number is not None:
        payment.mpesa_receipt_number = mpesa_receipt_number
    if merchant_request_id is not None:
        payment.merchant_request_id = merchant_request_id
    if checkout_request_id is not None:
        payment.checkout_request_id = checkout_request_id
    if raw_callback is not None:
        payment.raw_callback = raw_callback

    if new_status == Payment.Status.SUCCESS:
        if payment.method == Payment.Method.MPESA:
            payment.fee = Decimal(
                str(constants.mpesa_fee_for(int(payment.amount)))
            )
        else:
            payment.fee = Decimal("0")
        payment.settled_at = timezone.now()

    payment.save()

    if new_status == Payment.Status.SUCCESS:
        Order.objects.filter(pk=payment.order_id).update(
            payment_status=Order.PaymentStatus.PAID,
        )
        payment.order.refresh_from_db(fields=["payment_status"])

        order = payment.order

        if order.status == Order.Status.CANCELLED:
            logger.error(
                "Payment %s succeeded on CANCELLED order %s — "
                "manual reconciliation required.",
                payment.id, order.reference,
            )
            record_status_event(
                order,
                from_status=Order.Status.CANCELLED,
                to_status=Order.Status.CANCELLED,
                actor=None,
                actor_label="System",
                note=(
                    "Late payment received on cancelled order · "
                    f"{payment.mpesa_receipt_number or 'M-Pesa'}. "
                    "Refund or reinstate required."
                ),
            )
            PaymentEvent.log(
                payment,
                "Payment settled on cancelled order",
                detail=(
                    f"Receipt {payment.mpesa_receipt_number}"
                    if payment.mpesa_receipt_number
                    else f"Method {payment.get_method_display()}"
                ),
            )
            _fire_event(
                "order.paid_on_cancelled",
                {
                    "order_id": order.pk,
                    "reference": order.reference,
                    "customer_id": order.user_id,
                    "amount": float(payment.amount),
                    "method": payment.method,
                    "receipt": payment.mpesa_receipt_number or "",
                },
            )
            return payment

        if order.status == Order.Status.PENDING:
            change_order_status(
                order,
                Order.Status.CONFIRMED,
                actor=None,
                actor_label="System",
                note=f"Payment received · {payment.mpesa_receipt_number or 'M-Pesa'}",
            )
        else:
            record_status_event(
                order,
                from_status=order.status,
                to_status=order.status,
                actor=None,
                actor_label="System",
                note=(
                    f"Payment received · "
                    f"{payment.mpesa_receipt_number or 'M-Pesa'}"
                ),
            )

        PaymentEvent.log(
            payment,
            "Payment settled",
            detail=(
                f"Receipt {payment.mpesa_receipt_number}"
                if payment.mpesa_receipt_number
                else f"Method {payment.get_method_display()}"
            ),
        )

        _fire_event(
            "order.paid",
            {
                "order_id": payment.order_id,
                "reference": payment.order.reference,
                "customer_id": payment.order.user_id,
                "amount": float(payment.amount),
                "method": payment.method,
                "receipt": payment.mpesa_receipt_number or "",
            },
        )

    elif new_status in (
        Payment.Status.FAILED,
        Payment.Status.TIMEOUT,
        Payment.Status.CANCELLED,
    ):
        label = {
            Payment.Status.FAILED: "Payment failed",
            Payment.Status.TIMEOUT: "Payment timed out",
            Payment.Status.CANCELLED: "Payment cancelled by user",
        }[new_status]

        try:
            record_status_event(
                payment.order,
                from_status=payment.order.status,
                to_status=payment.order.status,
                actor=None,
                actor_label="System",
                note=f"{label} · {result_description or 'No details'}",
            )
        except Exception:
            logger.exception(
                "Failed to log payment failure event for %s",
                payment.order_id,
            )

        PaymentEvent.log(
            payment,
            label,
            state=PaymentEvent.State.FAILED,
            detail=result_description or "",
        )

    return payment


def process_checkout(
    *,
    payload: dict,
    user,
    idempotency_key: str,
) -> Payment:
    _validate_checkout_gates(user, payload["checkout"])
    if not _mpesa_enabled():
        raise CheckoutError(
            "M-Pesa is currently unavailable. Please choose Cash on Delivery."
        )

    existing = Payment.objects.filter(
        idempotency_key=idempotency_key
    ).first()

    if existing:
        if user is not None and existing.order.user_id != user.id:
            raise CheckoutError("Idempotency key already used.")
        if existing.checkout_request_id:
            return existing
        order = existing.order
    else:
        order = None

    checkout = payload["checkout"]
    reference = (payload.get("order_reference") or "").strip()
    phone_raw = payload["phone_number"]

    is_member = user is not None
    totals = recompute_totals(checkout, is_member=is_member)

    if order is None and reference:
        qs = Order.objects.filter(reference=reference)
        if user is not None:
            qs = qs.filter(user=user)
        else:
            qs = qs.filter(user__isnull=True)
        order = qs.first()
        if order:
            if order.payment_method != Order.PaymentMethod.MPESA:
                raise CheckoutError(
                    "Order reference does not match M-Pesa payments."
                )
            if order.status != Order.Status.PENDING:
                raise CheckoutError(
                    f"Cannot retry payment on an order in status "
                    f"{order.status}."
                )
            if order.total != totals["total"]:
                raise CheckoutError(
                    "Cart has changed since the previous payment "
                    "attempt. Please review your cart and try again."
                )
            logger.info("Reusing order %s for M-Pesa retry", reference)

    if order is None:
        for stale in _find_orphan_pending_orders(user=user, checkout=checkout):
            _kill_live_payments(
                stale, reason="Superseded by a new M-Pesa attempt.",
            )
            change_order_status(
                stale,
                Order.Status.CANCELLED,
                actor=user,
                actor_label="System",
                note="Superseded by a new M-Pesa attempt.",
                notify=False,
            )

        source = checkout.get("source") or Order.Source.WEB
        channel_meta = checkout.get("channel_meta") or {}
        order = _persist_order(
            user=user,
            checkout=checkout,
            totals=totals,
            coupon_code=(checkout.get("coupon") or "").strip().upper(),
            payment_method=Order.PaymentMethod.MPESA,
            status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.UNPAID,
            idempotency_key=idempotency_key,
            source=source,
            channel_meta=channel_meta,
        )

    normalized_phone = mpesa.normalize_phone(phone_raw)
    amount = int(totals["total"])
    payment = create_payment(
        order=order,
        idempotency_key=idempotency_key,
        phone=normalized_phone,
        amount=Decimal(str(amount)),
    )

    if payment.status == Payment.Status.PENDING and not payment.checkout_request_id:
        PaymentEvent.log(
            payment,
            "STK push triggered",
            detail=f"To {normalized_phone} for KES {amount:,}",
        )

        try:
            result = mpesa.stk_push(
                phone=normalized_phone,
                amount=amount,
                reference=order.reference,
            )
        except MpesaError as exc:
            transition_payment(
                payment,
                Payment.Status.FAILED,
                result_description=str(exc),
            )
            raise

        transition_payment(
            payment,
            Payment.Status.PROCESSING,
            merchant_request_id=result["merchant_request_id"],
            checkout_request_id=result["checkout_request_id"],
        )

        PaymentEvent.log(
            payment,
            "Awaiting customer PIN",
            state=PaymentEvent.State.ACTIVE,
            detail=f"CheckoutRequestID {result['checkout_request_id']}",
        )

    return payment


def get_cart(user) -> Cart | None:
    if user is None or not user.is_authenticated:
        return None
    return (
        Cart.objects
        .filter(user=user)
        .prefetch_related("items")
        .first()
    )


def get_or_create_cart(user) -> Cart:
    if user is None or not user.is_authenticated:
        raise CheckoutError("Cart requires an authenticated user.")
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


@transaction.atomic
def add_cart_item(
    user,
    *,
    product_id: str,
    variant_id: str = "",
    name: str,
    brand: str = "",
    image: str = "",
    variant_label: str = "",
    unit_price: Decimal,
    compare_at_price: Decimal | None = None,
    quantity: int = 1,
    stock: str = CartItem.Stock.IN,
    stock_count: int = 0,
) -> CartItem:
    if quantity < 1:
        raise CheckoutError("Quantity must be at least 1.")

    cart = get_or_create_cart(user)

    existing = (
        CartItem.objects
        .select_for_update()
        .filter(cart=cart, product_id=product_id, variant_id=variant_id)
        .first()
    )

    if existing:
        existing.quantity = F("quantity") + quantity
        existing.name = name
        existing.brand = brand or ""
        existing.image = image or ""
        existing.variant_label = variant_label or ""
        existing.unit_price = unit_price
        existing.compare_at_price = compare_at_price
        existing.stock = stock
        existing.stock_count = stock_count
        existing.save()
        existing.refresh_from_db(fields=["quantity"])
        return existing

    return CartItem.objects.create(
        cart=cart,
        product_id=product_id,
        variant_id=variant_id,
        name=name,
        brand=brand or "",
        image=image or "",
        variant_label=variant_label or "",
        unit_price=unit_price,
        compare_at_price=compare_at_price,
        quantity=quantity,
        stock=stock,
        stock_count=stock_count,
    )


@transaction.atomic
def update_cart_item_qty(user, item_id: int, quantity: int) -> CartItem:
    if quantity < 1:
        raise CheckoutError("Quantity must be at least 1.")

    item = (
        CartItem.objects
        .select_for_update()
        .filter(pk=item_id, cart__user=user)
        .first()
    )
    if not item:
        raise CheckoutError("Cart item not found.")

    item.quantity = quantity
    item.save(update_fields=["quantity", "updated_at"])
    return item


@transaction.atomic
def remove_cart_item(user, item_id: int) -> None:
    CartItem.objects.filter(pk=item_id, cart__user=user).delete()


@transaction.atomic
def clear_cart(user) -> None:
    cart = get_cart(user)
    if cart:
        cart.items.all().delete()


@transaction.atomic
def merge_cart(user, items: list[dict]) -> Cart:
    cart = get_or_create_cart(user)
    if not items:
        return cart

    for raw in items:
        product_id = str(raw.get("productId") or raw.get("product_id") or "")
        variant_id = str(raw.get("variantId") or raw.get("variant_id") or "")
        if not product_id:
            continue

        quantity = int(raw.get("quantity") or 1)
        if quantity < 1:
            quantity = 1

        unit_price = Decimal(str(raw.get("unitPrice") or raw.get("unit_price") or 0))
        compare_at_raw = raw.get("compareAtPrice") or raw.get("compare_at_price")
        compare_at_price = (
            Decimal(str(compare_at_raw)) if compare_at_raw not in (None, "", 0) else None
        )

        existing = (
            CartItem.objects
            .select_for_update()
            .filter(cart=cart, product_id=product_id, variant_id=variant_id)
            .first()
        )

        if existing:
            existing.quantity = F("quantity") + quantity
            existing.save(update_fields=["quantity", "updated_at"])
        else:
            CartItem.objects.create(
                cart=cart,
                product_id=product_id,
                variant_id=variant_id,
                name=str(raw.get("name") or ""),
                brand=str(raw.get("brand") or ""),
                image=str(raw.get("image") or ""),
                variant_label=str(raw.get("variantLabel") or raw.get("variant_label") or ""),
                unit_price=unit_price,
                compare_at_price=compare_at_price,
                quantity=quantity,
                stock=str(raw.get("stock") or CartItem.Stock.IN),
                stock_count=int(raw.get("stockCount") or raw.get("stock_count") or 0),
            )

    return cart


def snapshot_cart(user) -> dict:
    cart = get_cart(user)
    if cart is None:
        return {"items": []}

    return {
        "items": [
            {
                "product_id": item.product_id,
                "variant_id": item.variant_id,
                "name": item.name,
                "brand": item.brand,
                "image": item.image,
                "variant_label": item.variant_label,
                "unit_price": str(item.unit_price),
                "compare_at_price": (
                    str(item.compare_at_price)
                    if item.compare_at_price is not None
                    else None
                ),
                "quantity": item.quantity,
            }
            for item in cart.items.all()
        ]
    }


@transaction.atomic
def restore_cart_from_snapshot(user, snapshot: dict) -> Cart:
    cart = get_or_create_cart(user)
    cart.items.all().delete()

    for raw in (snapshot or {}).get("items", []):
        compare_raw = raw.get("compare_at_price")
        CartItem.objects.create(
            cart=cart,
            product_id=str(raw.get("product_id") or ""),
            variant_id=str(raw.get("variant_id") or ""),
            name=str(raw.get("name") or ""),
            brand=str(raw.get("brand") or ""),
            image=str(raw.get("image") or ""),
            variant_label=str(raw.get("variant_label") or ""),
            unit_price=Decimal(str(raw.get("unit_price") or "0")),
            compare_at_price=(
                Decimal(str(compare_raw)) if compare_raw else None
            ),
            quantity=int(raw.get("quantity") or 1),
            stock=CartItem.Stock.IN,
            stock_count=0,
        )

    return cart


@transaction.atomic
def retry_payment(
    *,
    payment: Payment,
    user=None,
    phone: str | None = None,
) -> Payment:
    if not _mpesa_enabled():
        raise CheckoutError(
            "M-Pesa is currently disabled in Settings. "
            "Enable it before retrying."
        )

    if payment.status not in {
        Payment.Status.FAILED,
        Payment.Status.CANCELLED,
        Payment.Status.TIMEOUT,
    }:
        raise CheckoutError(
            f"Cannot retry a payment in status {payment.status}."
        )

    if payment.method != Payment.Method.MPESA:
        raise CheckoutError(
            "Only M-Pesa payments can be retried through the gateway. "
            "Use reconcile to mark cash or account payments as settled."
        )

    target_phone_raw = phone or payment.phone_number
    if not target_phone_raw:
        raise CheckoutError("No phone number available to retry against.")

    normalized_phone = mpesa.normalize_phone(target_phone_raw)
    order = payment.order
    amount = int(payment.amount)

    retry_key = f"retry-{payment.id}-{int(timezone.now().timestamp())}"[:64]

    try:
        with transaction.atomic():
            new_payment = Payment.objects.create(
                order=order,
                method=Payment.Method.MPESA,
                status=Payment.Status.PENDING,
                amount=payment.amount,
                phone_number=normalized_phone,
                idempotency_key=retry_key,
            )
    except IntegrityError:
        logger.info(
            "Concurrent retry on payment %s — returning existing attempt %s",
            payment.id, retry_key,
        )
        return Payment.objects.get(idempotency_key=retry_key)

    PaymentEvent.log(
        new_payment,
        "Retry initiated",
        detail=f"Retry of {payment.id}",
    )

    try:
        result = mpesa.stk_push(
            phone=normalized_phone,
            amount=amount,
            reference=order.reference,
        )
    except MpesaError as exc:
        transition_payment(
            new_payment,
            Payment.Status.FAILED,
            result_description=str(exc),
        )
        raise

    transition_payment(
        new_payment,
        Payment.Status.PROCESSING,
        merchant_request_id=result["merchant_request_id"],
        checkout_request_id=result["checkout_request_id"],
    )
    PaymentEvent.log(
        new_payment,
        "Awaiting customer PIN",
        state=PaymentEvent.State.ACTIVE,
        detail=f"CheckoutRequestID {result['checkout_request_id']}",
    )

    return new_payment


@transaction.atomic
def reconcile_payment(
    *,
    payment: Payment,
    action: str,
    order_reference: str = "",
    note: str = "",
    actor=None,
) -> Payment:
    if not payment:
        raise CheckoutError("Payment is required.")

    valid_actions = {c for c, _ in ReconciliationLog.Action.choices}
    if action not in valid_actions:
        raise CheckoutError(f"Unknown reconciliation action: {action}")

    if order_reference and action == ReconciliationLog.Action.MATCHED:
        clean_ref = order_reference.strip()
        if clean_ref and clean_ref != payment.order.reference:
            target = Order.objects.filter(reference=clean_ref).first()
            if not target:
                raise CheckoutError(
                    f"No order found with reference {clean_ref}."
                )
            payment.order = target
            payment.save(update_fields=["order", "updated_at"])

    if action == ReconciliationLog.Action.CASH_PAID:
        if payment.status in Payment.TERMINAL_STATUSES:
            logger.warning(
                "CASH_PAID on terminal payment %s (status=%s) — logging only",
                payment.id, payment.status,
            )
        else:
            actor_pk = actor if getattr(actor, "pk", None) else None

            payment.status = Payment.Status.SUCCESS
            payment.fee = Decimal("0")
            payment.settled_at = timezone.now()
            payment.collected_by = actor_pk
            payment.save(update_fields=[
                "status",
                "fee",
                "settled_at",
                "collected_by",
                "updated_at",
            ])

            actor_name = getattr(actor, "get_full_name", lambda: "")() or "Admin"
            PaymentEvent.log(
                payment,
                "Cash collected by rider",
                detail=f"Recorded by {actor_name}",
            )

            order = payment.order
            total_settled = sum(
                (
                    p.amount
                    for p in order.payments.filter(
                        status=Payment.Status.SUCCESS,
                    )
                ),
                Decimal("0"),
            )
            if total_settled >= order.total:
                Order.objects.filter(pk=order.pk).update(
                    payment_status=Order.PaymentStatus.PAID,
                    payment_method=Order.PaymentMethod.COD,
                )
                order.refresh_from_db(
                    fields=["payment_status", "payment_method"],
                )
                if order.status == Order.Status.PENDING:
                    change_order_status(
                        order,
                        Order.Status.CONFIRMED,
                        actor=actor,
                        actor_label="Admin",
                        note="Cash collected on delivery.",
                    )

    actor_name = getattr(actor, "get_full_name", lambda: "")() or "Admin"
    ReconciliationLog.objects.create(
        payment=payment,
        action=action,
        actor=actor if getattr(actor, "pk", None) else None,
        actor_label=actor_name[:120],
        matched_order_reference=order_reference[:64] if order_reference else "",
        note=note or "",
    )

    return payment


@transaction.atomic
def mark_cash_collected(
    *,
    payment: Payment,
    actor=None,
    note: str = "",
) -> Payment:
    return reconcile_payment(
        payment=payment,
        action=ReconciliationLog.Action.CASH_PAID,
        note=note,
        actor=actor,
    )