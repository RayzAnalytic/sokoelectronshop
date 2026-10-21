from django.apps import AppConfig


class DirectOrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.direct_orders"
    label = "direct_orders"

    def ready(self):
        # Import the signals module so the @receiver decorators register.
        # Wrapped in a try/except so a missing signals.py doesn't crash
        # the app during `manage.py migrate` or `makemigrations`.
        try:
            from . import signals  # noqa: F401
        except ImportError:
            pass