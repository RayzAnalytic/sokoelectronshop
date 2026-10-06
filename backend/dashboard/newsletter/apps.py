from django.apps import AppConfig


class NewsletterDashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.newsletter"
    label = "dashboard_newsletter"      # ← unique label; don't rely on the auto-derived one
    verbose_name = "Dashboard · Newsletter"