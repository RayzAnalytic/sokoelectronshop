# team/services.py

import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import TeamInvite

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# INVITE — CREATE
# ─────────────────────────────────────────────────────────────
def create_invite(owner, email, role):
    """
    Create a new pending invite for `email`, replacing any existing
    pending invite for the same (owner, email) pair.

    Returns the newly created TeamInvite.
    """
    # Normalize FIRST — so the delete lookup matches what we'll store
    clean_email = email.strip().lower()

    # Delete any existing pending invite for the same email
    TeamInvite.objects.filter(
        owner=owner,
        email__iexact=clean_email,
        status=TeamInvite.Status.PENDING,
    ).delete()

    invite = TeamInvite.objects.create(
        owner=owner,
        email=clean_email,
        role=role,
        token=secrets.token_urlsafe(32),
        expires_at=timezone.now() + timedelta(days=7),
    )
    return invite


# ─────────────────────────────────────────────────────────────
# INVITE — SEND EMAIL
# ─────────────────────────────────────────────────────────────
def send_invite_email(invite):
    """
    Send the invite email.

    Returns True if the email was dispatched, False otherwise.
    Never raises — failures are logged.
    """
    frontend = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    accept_url = f"{frontend.rstrip('/')}/team/accept?token={invite.token}"
    owner_name = invite.owner.get_full_name() or invite.owner.email

    subject = f"{owner_name} invited you to join their store"
    message = (
        f"Hi,\n\n"
        f"{owner_name} has invited you to join their Sokoelectron store "
        f"as a {invite.get_role_display()}.\n\n"
        f"Accept the invitation by clicking the link below:\n"
        f"{accept_url}\n\n"
        f"This link expires in 7 days.\n\n"
        f"If you didn't expect this, you can ignore this email."
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invite.email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception(
            "Failed to send invite email to %s (invite=%s)",
            invite.email,
            invite.id,
        )
        return False


# ─────────────────────────────────────────────────────────────
# INVITE — LOOKUP BY TOKEN
# ─────────────────────────────────────────────────────────────
def get_invite_by_token(token):
    """
    Return the TeamInvite for the given token, or None if not found.
    Does NOT check expiry or status — callers decide what to do.
    """
    if not token:
        return None
    return TeamInvite.objects.filter(token=token).first()


# ─────────────────────────────────────────────────────────────
# INVITE — ACCEPT
# ─────────────────────────────────────────────────────────────
def accept_invite(invite, user):
    """
    Mark the invite as accepted and attach the accepting user.

    Returns a tuple (ok, message):
        (True,  "") — accepted
        (False, "reason") — refused
    """
    if invite.status != TeamInvite.Status.PENDING:
        return False, "This invitation is no longer valid."

    if timezone.now() > invite.expires_at:
        invite.status = TeamInvite.Status.EXPIRED
        invite.save(update_fields=["status", "updated_at"])
        return False, "This invitation has expired."

    invite.status = TeamInvite.Status.ACCEPTED
    invite.accepted_by = user
    invite.accepted_at = timezone.now()
    invite.save(update_fields=[
        "status", "accepted_by", "accepted_at", "updated_at",
    ])

    return True, ""


# ─────────────────────────────────────────────────────────────
# INVITE — REVOKE
# ─────────────────────────────────────────────────────────────
def revoke_invite(invite):
    """Mark a pending invite as revoked. No-op if already terminal."""
    if invite.status != TeamInvite.Status.PENDING:
        return False
    invite.status = TeamInvite.Status.REVOKED
    invite.save(update_fields=["status", "updated_at"])
    return True


# ─────────────────────────────────────────────────────────────
# INVITE — EXPIRE STALE ROWS (call from a Celery beat task)
# ─────────────────────────────────────────────────────────────
def expire_stale_invites():
    """
    Mark every PENDING invite whose expires_at is in the past as EXPIRED.
    Returns the number of rows updated.

    Schedule this daily via Celery beat:
        from team.services import expire_stale_invites
        expire_stale_invites()
    """
    now = timezone.now()
    updated = TeamInvite.objects.filter(
        status=TeamInvite.Status.PENDING,
        expires_at__lt=now,
    ).update(
        status=TeamInvite.Status.EXPIRED,
        updated_at=now,
    )
    if updated:
        logger.info("Expired %d stale team invites", updated)
    return updated