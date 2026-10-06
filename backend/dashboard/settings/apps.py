from django.apps import AppConfig


class SettingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard.settings'
    label = 'settings'

    def ready(self):
        from . import signals  # noqa: F401