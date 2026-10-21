import logging

from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from authentication.models import Role as AuthRole

from .constants import ROLE_ADMIN
from .models import StaffProfile

logger = logging.getLogger(__name__)
User = get_user_model()


@receiver(post_save, sender=StaffProfile)
def sync_auth_user_on_staff_profile_save(sender, instance, **kwargs):
    try:
        user = instance.user
        is_admin_role = instance.role == ROLE_ADMIN
        target_auth_role = AuthRole.OWNER if is_admin_role else AuthRole.STAFF

        updates = {}
        if user.role != target_auth_role:
            user.role = target_auth_role
            updates['role'] = target_auth_role
        if not user.is_staff:
            user.is_staff = True
            updates['is_staff'] = True
        if updates:
            user.save(update_fields=list(updates.keys()))
    except Exception:
        logger.exception(
            "Failed to sync auth user for StaffProfile %s", instance.pk,
        )


@receiver(post_delete, sender=StaffProfile)
def sync_auth_user_on_staff_profile_delete(sender, instance, **kwargs):
    try:
        user = instance.user
        user.role = AuthRole.CUSTOMER
        user.is_staff = False
        user.save(update_fields=['role', 'is_staff'])
    except Exception:
        logger.exception(
            "Failed to demote auth user after StaffProfile %s delete", instance.pk,
        )