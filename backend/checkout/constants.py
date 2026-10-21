from datetime import date, timedelta
from decimal import Decimal

TAX_RATE = Decimal("0.16")
FREE_DELIVERY_THRESHOLD = Decimal("5000")

DELIVERY_METHODS = ("express", "standard", "pickup")

DELIVERY_DAYS = {
    "express": 1,
    "standard": 3,
    "pickup": 0,
}

_DELIVERY_TO_METHOD_NAME = {
    "standard": "Standard Delivery",
    "express": "Express Boda",
    "pickup": "Pickup Mtaani / Locker",
}

ORDER_REFERENCE_PREFIX = "ORD"
ORDER_REFERENCE_DATE_FMT = "%Y%m%d"
ORDER_REFERENCE_SUFFIX_BYTES = 4

MAX_STK_PUSH_AMOUNT = 250_000

KENYAN_COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
    "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
    "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
    "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
    "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi",
    "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
    "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
    "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
]

DEFAULT_CURRENCY = "KES"


def _resolve_zone(county: str):
    if not county:
        return None
    normalized = county.strip().lower()
    if not normalized:
        return None

    try:
        from dashboard.shipping.models import ShippingZone
    except Exception:
        return None

    for zone in ShippingZone.objects.all():
        for c in (zone.counties or []):
            if str(c).strip().lower() == normalized:
                return zone
    return None


def _resolve_shipping_rate(method: str, county: str):
    name = _DELIVERY_TO_METHOD_NAME.get(method)
    if not name:
        return None

    zone = _resolve_zone(county)
    if zone is None:
        return None

    try:
        from dashboard.shipping.models import ShippingMethod, ShippingRate
    except Exception:
        return None

    shipping_method = (
        ShippingMethod.objects
        .filter(name=name, status=ShippingMethod.Status.ACTIVE)
        .first()
    )
    if shipping_method is None:
        return None

    return (
        ShippingRate.objects
        .filter(zone=zone, method=shipping_method)
        .first()
    )


def _free_shipping_threshold(method: str = "", county: str = "") -> Decimal:
    if method:
        rate = _resolve_shipping_rate(method, county)
        if rate is not None:
            if rate.free_shipping_threshold is not None:
                return Decimal(str(rate.free_shipping_threshold))
            return Decimal("0")
    return FREE_DELIVERY_THRESHOLD


def delivery_fee(
    method: str,
    *,
    county: str = "",
    is_member: bool = False,
) -> Decimal:
    if method not in DELIVERY_METHODS:
        raise ValueError(f"Unknown delivery method: {method!r}")

    if method == "pickup":
        rate = _resolve_shipping_rate(method, county)
        if rate is not None:
            return Decimal(str(rate.price))
        return Decimal("0")

    rate = _resolve_shipping_rate(method, county)
    if rate is not None:
        return Decimal(str(rate.price))

    try:
        from dashboard.shipping.models import ShippingMethod
        name = _DELIVERY_TO_METHOD_NAME.get(method)
        if name:
            row = (
                ShippingMethod.objects
                .filter(name=name, status=ShippingMethod.Status.ACTIVE)
                .first()
            )
            if row is not None:
                return Decimal(str(row.default_price))
    except Exception:
        pass

    return Decimal("0")


def compute_totals(
    *,
    subtotal: Decimal,
    discount: Decimal,
    delivery_method: str,
    is_member: bool,
    county: str = "",
) -> dict[str, Decimal]:
    cent = Decimal("0.01")

    threshold = _free_shipping_threshold(delivery_method, county)
    if threshold > 0 and subtotal >= threshold:
        shipping = Decimal("0")
    else:
        shipping = delivery_fee(
            delivery_method,
            county=county,
            is_member=is_member,
        )

    taxable = (subtotal - discount).quantize(cent)
    tax = (taxable * TAX_RATE).quantize(cent)
    total = (subtotal - discount + shipping + tax).quantize(cent)

    return {
        "subtotal": subtotal.quantize(cent),
        "discount": discount.quantize(cent),
        "shipping": shipping.quantize(cent),
        "tax": tax,
        "total": total,
    }


def estimated_delivery_date(method: str, from_date: date | None = None) -> date:
    if method not in DELIVERY_DAYS:
        raise ValueError(f"Unknown delivery method: {method!r}")

    start = from_date or date.today()
    return start + timedelta(days=DELIVERY_DAYS[method])


_MPESA_FEE_TIERS = [
    (100,      0),
    (500,      7),
    (1_000,    13),
    (1_500,    23),
    (2_500,    33),
    (3_500,    53),
    (5_000,    57),
    (7_500,    78),
    (10_000,   90),
    (15_000,   100),
    (20_000,   105),
    (35_000,   108),
    (50_000,   108),
    (150_000,  108),
    (250_000,  108),
]


def mpesa_fee_for(amount: int) -> int:
    if amount <= 0:
        return 0
    for ceiling, fee in _MPESA_FEE_TIERS:
        if amount <= ceiling:
            return fee
    return _MPESA_FEE_TIERS[-1][1]