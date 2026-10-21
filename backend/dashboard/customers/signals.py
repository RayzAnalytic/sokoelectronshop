import logging

from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from checkout.models import Order

from .constants import CommunicationChannel, CommunicationDirection
from .models import CommunicationLog, CustomerProfile

logger = logging.getLogger(__name__)
User = get_user_model()


@receiver(post_save, sender=User)
def ensure_customer_profile(sender, instance, created, **kwargs):
    if instance.role != "CUSTOMER":
        return
    try:
        CustomerProfile.objects.get_or_create(user=instance)
    except Exception:
        logger.exception("Failed to ensure CustomerProfile for user %s", instance.pk)


@receiver(post_save, sender=Order)
def sync_profile_on_order_save(sender, instance, created, **kwargs):
    if not instance.user_id:
        return

    try:
        profile, _ = CustomerProfile.objects.get_or_create(user_id=instance.user_id)
        profile.refresh_stats()
    except Exception:
        logger.exception(
            "Failed to refresh CustomerProfile for user %s", instance.user_id,
        )

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