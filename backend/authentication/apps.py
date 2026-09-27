# authentication/apps.py

from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "authentication"
    verbose_name = "Authentication"

    def ready(self) -> None:
        # Importing the module registers all @receiver-decorated
        # functions (e.g. user_signed_up → assign_default_role_on_signup).
        import authentication.signals  # noqa: F401