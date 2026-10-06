"""
Server-side constants for checkout. The single source of truth for
pricing and location data — the frontend values are previews only.

Three intentional divergences from the frontend that are worth knowing
about when reading or editing:

  1. `KENYAN_COUNTIES` below lists all 47 counties. The frontend's
     `KENYAN_COUNTIES` in `app/pages/checkout/page.tsx` is a shorter
     subset for dropdown usability. That's fine — the server validates
     against the full list, so any value the frontend offers is
     accepted. If the frontend ever lets a customer type a county
     freehand, the server-side list becomes the real gate.

  2. `MAX_STK_PUSH_AMOUNT` is duplicated by a literal in
     `StkPushSerializer.validate_amount`. The serializer should import
     this constant rather than hardcode `1_000_000`. If you touch one,
     touch both, or make the import change and delete the literal.

  3. Express delivery is free for signed-in customers. Guests pay the
     standard `DELIVERY_FEES["express"]` rate. This two-tier rule is
     enforced ONLY by `delivery_fee()` below — callers must never read
     `DELIVERY_FEES` directly for express. The function is the single
     source of truth. Do not duplicate the rule in the view.

     The frontend has this rule only partially implemented:

         cart/page.tsx       →  express = 500 (matches guest rate)
         checkout/page.tsx   →  express = 0   (WRONG for guests)

     Both pages should read the fee from the same helper on the client
     side, or accept the server's recomputed total at submit time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHIPPING MIGRATION — read before editing the delivery block
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The `DELIVERY_METHODS` / `DELIVERY_FEES` / `EXPRESS_FEE_MEMBER` /
`FREE_DELIVERY_THRESHOLD` / `DELIVERY_DAYS` constants below are being
replaced by database-backed shipping records that the admin
`/dashboard/shipping` page manages:

    ShippingZone       — named region + the counties it covers
    ShippingRate       — per-zone method + price + ETA + free threshold
    ShippingMethod     — the catalogue of delivery methods
    PickupLocation     — physical pickup points
    CourierConfig      — third-party courier credentials

While the shipping models are being built, THIS FILE REMAINS THE
FALLBACK. `checkout/services.recompute_totals()` still reads from
here, so customer checkout is unaffected by the migration in flight.

Once the models are live, the intended end state is:

  * `recompute_totals()` reads the shipping rate for the customer's
    county via `ShippingZone.for_county(county)` and uses the
    per-zone price instead of `DELIVERY_FEES[method]`.
  * The `CheckoutConfigView` (in `checkout/views.py`) serves methods
    and prices from `ShippingMethod` + `ShippingRate` rows instead of
    building a static `delivery_fees` dict from these constants.
  * This file keeps only the constants that are genuinely global —
    `TAX_RATE`, `KENYAN_COUNTIES`, `ORDER_REFERENCE_*`,
    `MAX_STK_PUSH_AMOUNT`, `mpesa_fee_for()` — and the delivery block
    is deleted.

Until then: DO NOT add new shipping logic here. If a new shipping
rule is needed, model it in `dashboard/shipping/` — because anything
added here is one more thing to migrate and one more place for the
frontend and backend to drift.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from datetime import date, timedelta
from decimal import Decimal

# ── Pricing ──────────────────────────────────────────────────────────────────
TAX_RATE = Decimal("0.16")
FREE_DELIVERY_THRESHOLD = Decimal("5000")

# Guest rates. The membership rate for express lives in
# `EXPRESS_FEE_MEMBER` below and is applied by `delivery_fee()`.
#
# MIGRATION NOTE: once `ShippingRate` rows exist, this dict is no
# longer read by `recompute_totals`. It is kept so nothing breaks
# mid-migration — see the header above.
DELIVERY_FEES = {
    "express": Decimal("500"),
    "standard": Decimal("300"),
    "pickup": Decimal("0"),
}

# Signed-in customers get express delivery free. Applied ONLY by
# `delivery_fee()` — never read this constant directly from a view.
EXPRESS_FEE_MEMBER = Decimal("0")

DELIVERY_METHODS = ("express", "standard", "pickup")

# Days from order confirmation to expected delivery, per method.
# Used by `estimated_delivery_date()` below and mirrored in the
# frontend's checkout preview — keep the two in sync.
DELIVERY_DAYS = {
    "express": 1,
    "standard": 3,
    "pickup": 0,
}

# ── Order references ─────────────────────────────────────────────────────────
# Format: ORD-YYYYMMDD-XXXXXXXX. The prefix is a constant so the frontend
# and any test fixtures can reference it without re-typing "ORD-".
ORDER_REFERENCE_PREFIX = "ORD"
ORDER_REFERENCE_DATE_FMT = "%Y%m%d"
ORDER_REFERENCE_SUFFIX_BYTES = 4       # → 8 hex chars

# ── Payments ─────────────────────────────────────────────────────────────────
# Upper bound on a single STK push. Anything above this is rejected by
# `StkPushSerializer.validate_amount` before we ever hit Safaricom.
# The M-Pesa per-transaction cap is currently KES 250,000; this value is
# deliberately higher so the failure surfaces with a clear message from
# the serializer rather than a confusing one from Daraja.
MAX_STK_PUSH_AMOUNT = 1_000_000

# ── Kenya ────────────────────────────────────────────────────────────────────
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

# ── Payment ──────────────────────────────────────────────────────────────────
DEFAULT_CURRENCY = "KES"


# ─────────────────────────────────────────────────────────────────────────────
# Pricing helpers — the ONLY place delivery-fee and totals logic lives
# ─────────────────────────────────────────────────────────────────────────────
def delivery_fee(method: str, *, is_member: bool) -> Decimal:
    """
    Return the shipping fee for a delivery method, honouring the
    member-free-express rule.

    Parameters
    ----------
    method
        One of `DELIVERY_METHODS`. Raises `ValueError` otherwise.
    is_member
        True when the request is authenticated (any role — CUSTOMER,
        STAFF, or OWNER). Passed explicitly rather than inferred so
        this function stays a pure calculator with no request coupling.

    Rules, applied in order
    -----------------------
    1. `pickup` is always free.
    2. `express` is free for members.
    3. Everything else falls back to `DELIVERY_FEES[method]`.

    This function does NOT apply the free-delivery-above-threshold
    rule. That is a subtotal-dependent decision and lives in
    `compute_totals()` — the only place with enough context to decide
    it correctly.

    MIGRATION NOTE: once `ShippingRate` rows are live, this function
    is superseded by zone-aware pricing. Do not add new rules here.
    """
    if method not in DELIVERY_METHODS:
        raise ValueError(f"Unknown delivery method: {method!r}")

    if method == "pickup":
        return Decimal("0")

    if method == "express" and is_member:
        return EXPRESS_FEE_MEMBER

    return DELIVERY_FEES[method]


def compute_totals(
    *,
    subtotal: Decimal,
    discount: Decimal,
    delivery_method: str,
    is_member: bool,
) -> dict[str, Decimal]:
    """
    Single source of truth for order totals. Every caller — checkout
    view, order-create service, serializer validation — must go through
    this function. Divergent totals across callers are how the frontend
    cart-vs-checkout mismatch happened; do not let the backend repeat
    that mistake.

    Rules, applied in order
    -----------------------
    1. Free shipping above `FREE_DELIVERY_THRESHOLD`, regardless of
       method or membership.
    2. Otherwise, `delivery_fee(method, is_member=is_member)` decides.
       A guest picking express under the threshold pays 500. A member
       picking express under the threshold pays 0.
    3. VAT applies to `subtotal - discount`, not to shipping.

    Rounding
    --------
    Tax is quantized to 2 decimal places (nearest cent). Totals are
    the sum of already-rounded components, so line-level rounding
    never accumulates. All values are `Decimal` — never float.

    MIGRATION NOTE: once shipping is zone-aware, this function is
    replaced by one that takes the customer's county and looks up
    the appropriate `ShippingRate`. The current implementation stays
    as the fallback while the shipping models are being built.
    """
    cent = Decimal("0.01")

    # Shipping — free above threshold, otherwise the method fee.
    if subtotal >= FREE_DELIVERY_THRESHOLD:
        shipping = Decimal("0")
    else:
        shipping = delivery_fee(delivery_method, is_member=is_member)

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


# ─────────────────────────────────────────────────────────────────────────────
# Delivery-date helper
# ─────────────────────────────────────────────────────────────────────────────
def estimated_delivery_date(method: str, from_date: date | None = None) -> date:
    """
    Return the calendar date a delivery of `method` is expected to arrive.

    Mirrors the frontend's `estimatedDelivery` computation in
    `app/pages/checkout/page.tsx`. Both sides must agree — if you
    change `DELIVERY_DAYS` here, change the frontend too, or better,
    have the frontend read this value from the checkout config endpoint.

    Raises `ValueError` for an unknown method. The `CheckoutPayloadSerializer`
    already constrains `delivery_method` to `DELIVERY_METHODS`, so a bad
    value here means the constant and the serializer have drifted.
    """
    if method not in DELIVERY_DAYS:
        raise ValueError(f"Unknown delivery method: {method!r}")

    start = from_date or date.today()
    return start + timedelta(days=DELIVERY_DAYS[method])


# ─────────────────────────────────────────────────────────────────────────────
# M-Pesa tariff table — the fee the ledger stamps on successful payments
# ─────────────────────────────────────────────────────────────────────────────
# Safaricom's published send-money / paybill tariff. Tiers are INCLUSIVE
# upper bounds: an amount <= 100 pays 0, <= 500 pays 7, etc.
#
# Why this exists:
#   Daraja does NOT return the transaction fee on STK push. The admin
#   transactions ledger needs the fee to render the "M-Pesa Fees"
#   summary card and the "Net settled = Successful − Fees" balance.
#   Without this table, `Payment.fee` stays 0 forever and that card is
#   a lie.
#
# Why the merchant often sees fee = 0 in practice:
#   On Paybill/Till COLLECTION, the customer pays the fee — the
#   merchant receives `amount` in full. If your accounting treats
#   `fee` as "cost to the merchant", set all tiers to 0. If it treats
#   `fee` as "what the customer paid out of pocket", the table below
#   is correct. Decide which, and make it consistent with the summary
#   card's label. The table is here so the decision is a one-line
#   change, not a schema change.
#
# Ranges per Safaricom (simplified — extend as tiers change):
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
    (150_000,  108),   # ceiling — matches MAX_STK_PUSH_AMOUNT
]


def mpesa_fee_for(amount: int) -> int:
    """
    Return the Safaricom fee (in KES, integer) for a given transaction
    amount.

    Called by `services.transition_payment` on SUCCESS to stamp
    `Payment.fee`. The lookup is by inclusive upper bound, so a
    700 KES transaction pays the 1000-tier fee.

    Unknown / out-of-range amounts fall through to the last tier — the
    service layer already rejects amounts above `MAX_STK_PUSH_AMOUNT`
    before this is called, so the fall-through is a safety net, not a
    normal path.
    """
    if amount <= 0:
        return 0
    for ceiling, fee in _MPESA_FEE_TIERS:
        if amount <= ceiling:
            return fee
    return _MPESA_FEE_TIERS[-1][1]