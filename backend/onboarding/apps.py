# apps/onboarding/apps.py

from django.apps import AppConfig


class OnboardingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "onboarding"
    label = "onboarding"
    verbose_name = "Onboarding"
