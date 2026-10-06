from django.apps import AppConfig


class AiAndAutomationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard.aiandautomations'
    verbose_name = 'AI & Automations'

    def ready(self):
        # Register signal receivers (fires when checkout/catalog/account emit events)
        from . import signals  # noqa: F401