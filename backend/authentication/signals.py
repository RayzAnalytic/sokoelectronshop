# authentication/signals.py

import logging

from allauth.account.signals import user_signed_up
from django.contrib.auth import get_user_model
from django.dispatch import receiver

User = get_user_model()
logger = logging.getLogger(__name__)


@receiver(user_signed_up)
def assign_default_role_on_signup(request, user, **kwargs):
    """
    Ensure every user created through allauth (Google OAuth, allauth's
    own email/password signup) has the CUSTOMER role.

    NOTE: This signal does NOT fire for our custom DRF RegisterAPIView
    or GoogleLoginView — those views set `role` explicitly when they
    create the user. The signal exists only to cover allauth's own
    signup flows.
    """
    if user.role != User.Roles.CUSTOMER:
        user.role = User.Roles.CUSTOMER
        user.save(update_fields=['role'])
        logger.info(
            "Assigned CUSTOMER role to %s via allauth signup", user.email
        )