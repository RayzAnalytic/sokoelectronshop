"""
Authentication signal handlers.

Currently one handler: claim any unowned guest orders that match the
logging-in user's contact info. This is what makes a guest order show
up in the customer's account after they sign in or register.

Why `user_logged_in` covers both login AND register
────────────────────────────────────────────────────
Your register view and your Google callback both call Django's
`login(request, user)`. That helper fires `user_logged_in` before
returning. So this signal runs in all three cases:

    • customer logs in with email + password
    • customer registers and is auto-logged-in
    • customer signs in or registers via Google

No separate `post_save` handler is needed — one signal, one code path.

The handler is intentionally defensive — a failure here must never
break login. Any exception is logged and swallowed.
"""

import logging

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from .models import Role

logger = logging.getLogger(__name__)


@receiver(user_logged_in)
def claim_guest_orders_on_login(sender, request, user, **kwargs):
    """
    Attach unowned guest orders matching this user's email or phone.

    Only runs for CUSTOMER role — staff and owners have no orders to
    claim, and the match is meaningless for them.

    Wrapped in try/except so a failure inside `claim_guest_orders`
    (a DB blip, a missing migration) cannot prevent the login from
    succeeding. The user is already authenticated at this point; the
    claim is a best-effort enrichment, not a precondition.

    Note on ordering with the cart-migration hook:
        If your cart app also hooks `user_logged_in` (to move a guest
        cart onto the user), keep both handlers independent. The order
        DRF fires them in is the import order of the apps — do not
        rely on it. Each handler must be safe to run in isolation.
    """
    if getattr(user, "role", None) != Role.CUSTOMER:
        return

    # Guard against the migration not having been applied yet — a
    # MissingTable error would otherwise spam the logs on every login
    # during a partial deploy.
    try:
        from checkout.services import claim_guest_orders
    except ImportError:
        logger.exception("Could not import claim_guest_orders")
        return

    try:
        claimed = claim_guest_orders(user)
        if claimed:
            logger.info(
                "Login claimed %d guest order(s) for user %s",
                claimed, user.pk,
            )
    except Exception:
        logger.exception(
            "Failed to claim guest orders on login for user %s", user.pk,
        )


@receiver(user_logged_in)
def clear_pending_password_resets_on_login(sender, request, user, **kwargs):
    """
    Invalidate any unused password-reset tokens the moment the user
    successfully logs in.

    Rationale: a pending reset token is a second key to the account.
    If the user just proved ownership by logging in, that key should
    stop working — otherwise a leaked reset link remains valid even
    after the account owner is actively using the account.

    This runs for every role (customer, staff, owner) because every
    account is subject to the same "one active key" rule.

    Best-effort: a failure here must not break login.
    """
    try:
        from .models import PasswordResetToken
    except ImportError:
        return

    try:
        now_used = PasswordResetToken.objects.filter(
            user=user, used_at__isnull=True,
        ).update(used_at=__import__("django.utils.timezone", fromlist=["now"]).now())
        if now_used:
            logger.info(
                "Invalidated %d pending password-reset token(s) on login for user %s",
                now_used, user.pk,
            )
    except Exception:
        logger.exception(
            "Failed to invalidate reset tokens on login for user %s", user.pk,
        )