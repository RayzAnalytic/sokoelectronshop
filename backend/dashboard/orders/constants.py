"""
Constants for the admin order module.

Two things live here:

  * The tab list — one row per tab on the list page. Each tab has a
    stable key (used in URLs and query strings) and a display label.

  * The payment status label map — because "PAID" is a horrible label
    to render. The frontend reads these from the API, so changing a
    label here changes it everywhere.

The status enums themselves are NOT duplicated. They live on
`checkout.models.Order.Status` and `.PaymentStatus`, and every module
that cares reads from there.
"""

from checkout.models import Order


# ─────────────────────────────────────────────────────────────────────────────
# Tabs
# ─────────────────────────────────────────────────────────────────────────────
# Each tab is (key, label). The key is what the frontend sends in the
# `?tab=` query param. The label is what the tab renders.
#
# The order here is the order on screen. Change with care — moving a
# tab moves it for every admin.
ADMIN_ORDER_TABS = [
    ("all",             "All"),
    ("pending",         "Pending"),
    ("payment_pending", "Payment Pending"),
    ("paid",            "Paid"),
    ("processing",      "Processing"),
    ("shipped",         "Shipped"),
    ("delivered",       "Delivered"),
    ("cancelled",       "Cancelled"),
    ("failed",          "Failed"),
    ("refunded",        "Refunded"),
    ("returned",        "Returned"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Payment status labels
# ─────────────────────────────────────────────────────────────────────────────
# Human labels for the payment status enum. Kept here so the admin UI
# can render them without hardcoding strings that could drift.
PAYMENT_STATUS_LABELS = {
    Order.PaymentStatus.UNPAID:   "Unpaid",
    Order.PaymentStatus.PAID:     "Paid",
    Order.PaymentStatus.REFUNDED: "Refunded",
    Order.PaymentStatus.FAILED:   "Failed",
}


# ─────────────────────────────────────────────────────────────────────────────
# Fulfillment status labels
# ─────────────────────────────────────────────────────────────────────────────
# Same idea for the fulfillment status enum. Note that this is derived
# from the model choices, so a new status added to `Order.Status` shows
# up here automatically — but only after this module is reloaded.
FULFILLMENT_STATUS_LABELS = dict(Order.Status.choices)


# ─────────────────────────────────────────────────────────────────────────────
# Filter options
# ─────────────────────────────────────────────────────────────────────────────
# Sentinel value used by the frontend to mean "no filter". Kept as a
# constant so the same string is used on both sides.
FILTER_ALL = "all"


# ─────────────────────────────────────────────────────────────────────────────
# Status transitions allowed from the admin panel
# ─────────────────────────────────────────────────────────────────────────────
# A map from current status to the list of statuses the admin can move
# to. Used by the UI to grey out impossible transitions and by the
# service layer to reject invalid requests.
#
# The rules:
#   * `delivered` and `returned` are terminal. Nothing follows.
#   * `cancelled` is terminal for the fulfillment pipeline. An admin
#     can still refund money — that is a payment transition, not a
#     fulfillment one.
#   * `failed` is terminal. The order never entered the pipeline.
#   * Backward transitions are not allowed (delivered → shipped). If
#     the admin made a mistake, they should refund and create a new
#     order — not silently rewrite history.
ALLOWED_TRANSITIONS = {
    Order.Status.PENDING: [
        Order.Status.CONFIRMED,
        Order.Status.CANCELLED,
        Order.Status.FAILED,
    ],
    Order.Status.CONFIRMED: [
        Order.Status.PROCESSING,
        Order.Status.CANCELLED,
        Order.Status.FAILED,
    ],
    Order.Status.PROCESSING: [
        Order.Status.SHIPPED,
        Order.Status.CANCELLED,
        Order.Status.FAILED,
    ],
    Order.Status.SHIPPED: [
        Order.Status.DELIVERED,
        Order.Status.RETURNED,
    ],
    Order.Status.DELIVERED: [
        Order.Status.RETURNED,
    ],
    Order.Status.RETURNED: [],
    Order.Status.CANCELLED: [],
    Order.Status.FAILED: [],
}


def is_transition_allowed(from_status: str, to_status: str) -> bool:
    """True when the admin may move an order between these statuses."""
    return to_status in ALLOWED_TRANSITIONS.get(from_status, [])