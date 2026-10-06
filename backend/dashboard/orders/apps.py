from django.apps import AppConfig


class OrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.orders"
    label = "dashboard_orders" 

    def ready(self):
        # No signal wiring. All writes go through
        # `checkout.services.change_order_status`, which already
        # handles the timeline and notifications.
        pass