from django.apps import AppConfig


class OverviewConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.overview"
    label = "overview"
    verbose_name = "Dashboard Overview"