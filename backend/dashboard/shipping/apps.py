# dashboard/shipping/apps.py

from django.apps import AppConfig


class ShippingConfig(AppConfig):
    """
    Admin shipping configuration + operational tracking.

    Owns the delivery-zone / rate / method / pickup / courier records
    that the checkout page will eventually read from, plus the
    `Shipment` record that carries the granular logistics status the
    customer's order page renders as "tracking".

    The `Shipment → Order` bridge is one-way: this app writes to
    `checkout.Order.status` via `checkout.services.change_order_status`,
    never directly. `checkout` never imports from here.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.shipping"
    label = "shipping"
    verbose_name = "Shipping"