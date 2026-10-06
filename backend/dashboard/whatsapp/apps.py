from django.apps import AppConfig


class WhatsappConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.whatsapp"      # Python import path (new location)
    label = "whatsapp"                # short label — DO NOT change
    verbose_name = "WhatsApp"