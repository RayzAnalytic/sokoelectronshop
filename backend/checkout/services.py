"""All commercial logic. Views orchestrate; models stay dumb."""

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from . import constants, mpesa
from .exceptions import (
    CouponError,
    CustomerExists,
    MpesaError,
    PricingError,
)
from .models import Coupon, Order, OrderItem, Payment

logger = logging.getLogger(__name__)
User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Coupons
# ─────────────────────────────────────────────────────────────────────────────
def validate_coupon(code: str, subtotal: Decimal) -> Coupon:
    """Return the Coupon if valid for the given subtotal. Raises CouponError."""
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


# ─────────────────────────────────────────────────────────────────────────────
# Pricing recompute
# ─────────────────────────────────────────────────────────────────────────────
def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def recompute_totals(checkout: dict) -> dict:
    """Recompute totals from server constants and compare to client totals.

    Raises PricingError on mismatch.
    """
    items = checkout["items"]
    subtotal = sum(
        (Decimal(str(i["price"])) * int(i["quantity"]) for i in items),
        Decimal("0"),
    )
    subtotal = _round2(subtotal)

    # Coupon
    discount = Decimal("0")
    coupon_code = (checkout.get("coupon") or "").strip().upper()
    if coupon_code:
        coupon = validate_coupon(coupon_code, subtotal)
        discount = _round2(subtotal * coupon.percent_off)

    # Shipping
    method = checkout["delivery_method"]
    if method not in constants.DELIVERY_FEES:
        raise PricingError(f"Unknown delivery method: {method}")

    if method == "pickup":
        shipping = Decimal("0")
    elif subtotal - discount >= constants.FREE_DELIVERY_THRESHOLD:
        shipping = Decimal("0")
    else:
        shipping = constants.DELIVERY_FEES[method]

    # Tax (on subtotal - discount)
    taxable = subtotal - discount
    tax = _round2(taxable * constants.TAX_RATE)

    total = _round2(subtotal - discount + shipping + tax)

    server_totals = {
        "subtotal": subtotal,
        "discount": discount,
        "shipping": shipping,
        "tax": tax,
        "total": total,
    }

    # Compare against client-declared totals
    client = checkout["totals"]
    for key in ("subtotal", "discount", "shipping", "tax", "total"):
        client_val = Decimal(str(client.get(key, "0"))).quantize(Decimal("0.01"))
        if client_val != server_totals[key]:
            raise PricingError(
                f"Price mismatch on '{key}': "
                f"client={client_val} server={server_totals[key]}"
            )

    return server_totals


# ─────────────────────────────────────────────────────────────────────────────
# Customer
# ─────────────────────────────────────────────────────────────────────────────
def get_or_create_customer(
    *,
    email: str,
    password: str,
    phone: str,
    full_name: str,
) -> tuple:
    """Return (user, created). Raises CustomerExists if email exists and
    the password does not match."""
    email = email.strip().lower()

    existing = User.objects.filter(email__iexact=email).first()
    if existing:
        if password and not existing.check_password(password):
            raise CustomerExists(
                "An account with this email already exists. Please sign in."
            )
        return existing, False

    parts = full_name.strip().split(" ", 1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""

    username_field = getattr(User, "USERNAME_FIELD", "email")
    username_value = email

    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        **({"phone": phone} if hasattr(User, "phone") else {}),
    )
    if username_field != "email":
        setattr(user, username_field, username_value)

    if password:
        user.set_password(password)
    else:
        user.set_unusable_password()

    user.save()
    return user, True


# ─────────────────────────────────────────────────────────────────────────────
# Order
# ─────────────────────────────────────────────────────────────────────────────
def _build_snapshot(checkout: dict, totals: dict) -> dict:
    """Flatten the checkout payload to the exact shape the success page reads."""
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
        "coupon": (checkout.get("coupon") or "").upper() or None,
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


@transaction.atomic
def create_order(
    *,
    user,
    reference: str,
    checkout: dict,
    totals: dict,
    coupon_code: str,
) -> Order:
    """Create Order + items + snapshot in one atomic block."""
    if Order.objects.filter(reference=reference).exists():
        # Reference collision — return the existing order.
        return Order.objects.get(reference=reference)

    snapshot = _build_snapshot(checkout, totals)

    order = Order.objects.create(
        reference=reference,
        user=user,
        status=Order.Status.PENDING,
        payment_status=Order.PaymentStatus.UNPAID,
        delivery_method=checkout["delivery_method"],
        estimated_delivery=checkout.get("estimated_delivery", "") or "",
        notes=checkout.get("notes") or "",
        coupon_code=coupon_code,
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

    if coupon_code:
        Coupon.objects.filter(code=coupon_code).update(
            used_count=F("used_count") + 1
        )

    return order


# ─────────────────────────────────────────────────────────────────────────────
# Payment
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def create_payment(
    *,
    order: Order,
    idempotency_key: str,
    phone: str,
    amount: Decimal,
) -> Payment:
    """Idempotent Payment creation. Returns the existing row on replay."""
    existing = (
        Payment.objects.select_for_update()
        .filter(idempotency_key=idempotency_key)
        .first()
    )
    if existing:
        return existing

    return Payment.objects.create(
        order=order,
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
) -> Payment:
    """The ONLY place Payment.status changes. Idempotent for terminal states."""
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

    payment.save()

    # Mirror onto Order
    if new_status == Payment.Status.SUCCESS:
        Order.objects.filter(pk=payment.order_id).update(
            payment_status=Order.PaymentStatus.PAID,
            status=Order.Status.CONFIRMED,
        )

        # Notify the customer so the account notifications page populates.
        # Lazy import breaks the checkout <-> account import cycle.
        if payment.order.user_id:
            try:
                from account.services import notify
                notify(
                    payment.order.user,
                    type="order",
                    title="Order confirmed",
                    body=(
                        f"Your order {payment.order.reference} "
                        "has been confirmed."
                    ),
                    href=(
                        f"/pages/account/orders/"
                        f"{payment.order.reference}"
                    ),
                    metadata={"reference": payment.order.reference},
                )
            except Exception:
                # A notification failure must never roll back the payment.
                logger.exception(
                    "Failed to create notification for order %s",
                    payment.order.reference,
                )

    return payment


# ─────────────────────────────────────────────────────────────────────────────
# Full checkout submit
# ─────────────────────────────────────────────────────────────────────────────
def process_checkout(
    *,
    payload: dict,
    password: str,
    idempotency_key: str,
) -> Payment:
    """Full flow for a stk-push submission.

    1. Idempotency check
    2. Recompute totals
    3. Get/create user (and adopt address if new)
    4. Create order + items + snapshot
    5. Create payment row
    6. Fire STK push (outside transaction)
    7. Update payment with Daraja IDs
    """
    # 1. Idempotent replay
    existing = Payment.objects.filter(
        idempotency_key=idempotency_key
    ).first()
    if existing and existing.checkout_request_id:
        return existing

    checkout = payload["checkout"]
    reference = payload["order_reference"]
    phone_raw = payload["phone_number"]

    # 2. Recompute
    totals = recompute_totals(checkout)

    # 3. Customer
    user, created = get_or_create_customer(
        email=checkout["email"],
        password=password or "",
        phone=checkout["phone"],
        full_name=checkout["full_name"],
    )

    # 3b. New account → adopt the checkout address as the first default.
    #     Lazy import breaks the checkout <-> account import cycle.
    if created:
        try:
            from account.services import adopt_address_from_checkout
            adopt_address_from_checkout(user, {
                "full_name": checkout["full_name"],
                "phone": checkout["phone"],
                "street": checkout["address"]["street"],
                "town": checkout["address"]["town"],
                "county": checkout["address"]["county"],
                "postal_code": checkout["address"].get("postal_code", ""),
            })
        except Exception:
            logger.exception(
                "Failed to adopt address for user %s", user.pk,
            )

    # 4. Order
    order = create_order(
        user=user,
        reference=reference,
        checkout=checkout,
        totals=totals,
        coupon_code=(checkout.get("coupon") or "").upper(),
    )

    # 5. Payment row
    normalized_phone = mpesa.normalize_phone(phone_raw)
    amount = int(totals["total"])
    payment = create_payment(
        order=order,
        idempotency_key=idempotency_key,
        phone=normalized_phone,
        amount=Decimal(str(amount)),
    )

    # 6. Fire STK push (network call, outside the atomic block)
    if payment.status == Payment.Status.PENDING and not payment.checkout_request_id:
        try:
            result = mpesa.stk_push(
                phone=normalized_phone,
                amount=amount,
                reference=reference,
            )
        except MpesaError as exc:
            transition_payment(
                payment,
                Payment.Status.FAILED,
                result_description=str(exc),
            )
            raise

        # 7. Update with Daraja IDs
        transition_payment(
            payment,
            Payment.Status.PROCESSING,
            merchant_request_id=result["merchant_request_id"],
            checkout_request_id=result["checkout_request_id"],
        )

    return payment