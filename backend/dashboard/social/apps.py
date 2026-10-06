from django.apps import AppConfig


class SocialConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.social"
    label = "social"
    verbose_name = "Social Media Hub"