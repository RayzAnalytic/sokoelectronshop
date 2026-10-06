from django.apps import AppConfig


class CustomersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.customers"

    def ready(self):
        # Wire signals once the app registry is populated.
        from . import signals  # noqa: F401