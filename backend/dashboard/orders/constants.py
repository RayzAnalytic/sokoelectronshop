from checkout.models import Order


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


PAYMENT_STATUS_LABELS = {
    Order.PaymentStatus.UNPAID:   "Unpaid",
    Order.PaymentStatus.PAID:     "Paid",
    Order.PaymentStatus.REFUNDED: "Refunded",
    Order.PaymentStatus.FAILED:   "Failed",
}


FULFILLMENT_STATUS_LABELS = dict(Order.Status.choices)


FILTER_ALL = "all"


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
    return to_status in ALLOWED_TRANSITIONS.get(from_status, [])