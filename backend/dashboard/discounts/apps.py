# dashboard/discounts/apps.py

from django.apps import AppConfig


class DiscountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.discounts"     # ← full dotted path, matches INSTALLED_APPS
    verbose_name = "Dashboard: Discounts & Promotions"