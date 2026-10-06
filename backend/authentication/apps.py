from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    """
    App config for the `authentication` app.

    Responsibilities:
      * Declares the default primary-key type for models in this app.
      * Imports the signal handlers in `ready()` so they're registered
        once the app registry is fully populated.

    Why signals are imported here (and not at module top):
      Signal receiver modules import models at module scope. Importing
      them from `apps.py` before Django has finished loading the app
      registry raises `AppRegistryNotReady`. The `ready()` hook fires
      *after* all apps are loaded, so it's the one safe place to wire
      them in.

    Signals currently registered:
      * `user_logged_in` → `claim_guest_orders_on_login`
        Attaches any unowned guest orders matching the user's email
        or phone to the CUSTOMER account at login/register time.
      * `user_logged_in` → `clear_pending_password_resets_on_login`
        Invalidates any outstanding password-reset tokens when the
        user logs in. A pending reset token is a second key to the
        account; logging in should kill it.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "authentication"

    def ready(self) -> None:
        # Import the signal module so its @receiver decorators run.
        # The `# noqa: F401` silences flake8's "imported but unused"
        # warning — the side effect of import is the whole point.
        from . import signals  # noqa: F401