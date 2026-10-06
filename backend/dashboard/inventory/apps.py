from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.inventory"
    label = "dashboard_inventory"
    verbose_name = "Inventory"