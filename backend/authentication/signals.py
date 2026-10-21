import logging

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.utils import timezone

from .models import PasswordResetToken, Role

logger = logging.getLogger(__name__)


@receiver(user_logged_in)
def claim_guest_orders_on_login(sender, request, user, **kwargs):
    if getattr(user, "role", None) != Role.CUSTOMER:
        return

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
    try:
        now_used = PasswordResetToken.objects.filter(
            user=user, used_at__isnull=True,
        ).update(used_at=timezone.now())
        if now_used:
            logger.info(
                "Invalidated %d pending password-reset token(s) on login for user %s",
                now_used, user.pk,
            )
    except Exception:
        logger.exception(
            "Failed to invalidate reset tokens on login for user %s", user.pk,
        )