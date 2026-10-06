"""
Event listeners that keep CustomerProfile in sync with Order data, and
that seed the communication timeline for system-generated events.

Two rules:

  1. Never raise from a signal. A failure here would roll back the
     originating transaction (order creation, user registration) for a
     non-critical cache update. Every handler swallows exceptions.
  2. Never write to Order or User. Signals react, they do not mutate.
"""

import logging

from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from checkout.models import Order

from .constants import CommunicationChannel, CommunicationDirection
from .models import CommunicationLog, CustomerProfile

logger = logging.getLogger(__name__)
User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Customer profile bootstrap — user registered
# ─────────────────────────────────────────────────────────────────────────────
@receiver(post_save, sender=User)
def ensure_customer_profile(sender, instance, created, **kwargs):
    """
    Every CUSTOMER gets a profile on creation.

    Registration in the auth flow creates the User with role=CUSTOMER
    by default, so this fires on the normal path. If role is changed
    later via admin, the update branch also handles it.
    """
    if instance.role != "CUSTOMER":
        return
    try:
        CustomerProfile.objects.get_or_create(user=instance)
    except Exception:
        logger.exception("Failed to ensure CustomerProfile for user %s", instance.pk)


# ─────────────────────────────────────────────────────────────────────────────
# Profile stats — order saved
# ─────────────────────────────────────────────────────────────────────────────
@receiver(post_save, sender=Order)
def sync_profile_on_order_save(sender, instance, created, **kwargs):
    """
    Recompute the customer's cached stats whenever an order is created
    or updated.

    Only recalculates for orders that actually affect the totals —
    cancelled and pending orders are ignored by `refresh_stats`, so
    this is a cheap no-op for those.

    Logs a communication entry when the order is confirmed and paid
    (only once, on the transition to paid).
    """
    if not instance.user_id:
        return

    try:
        profile, _ = CustomerProfile.objects.get_or_create(user_id=instance.user_id)
        profile.refresh_stats()
    except Exception:
        logger.exception(
            "Failed to refresh CustomerProfile for user %s", instance.user_id,
        )

    # Order-confirmation log — only on first save with paid status.
    if created and instance.payment_status == Order.PaymentStatus.PAID:
        try:
            CommunicationLog.objects.create(
                user_id=instance.user_id,
                channel=CommunicationChannel.EMAIL,
                direction=CommunicationDirection.OUTBOUND,
                subject=f"Order {instance.reference} confirmed",
                agent="System",
            )
        except Exception:
            logger.exception(
                "Failed to log order confirmation for %s", instance.reference,
            )


@receiver(post_delete, sender=Order)
def sync_profile_on_order_delete(sender, instance, **kwargs):
    if not instance.user_id:
        return
    try:
        profile = CustomerProfile.objects.filter(user_id=instance.user_id).first()
        if profile:
            profile.refresh_stats()
    except Exception:
        logger.exception(
            "Failed to refresh CustomerProfile after order delete for user %s",
            instance.user_id,
        )