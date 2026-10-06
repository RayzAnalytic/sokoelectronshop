"""
Write logic. Every mutation goes through here.

No ORM writes in views or serializers. Services return the affected
model instance or None; callers serialize the result.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .constants import (
    CommunicationChannel,
    CommunicationDirection,
    SupportTicketPriority,
    SupportTicketStatus,
)
from .models import CommunicationLog, CustomerNote, CustomerProfile, SupportTicket

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Status — block / unblock
# ─────────────────────────────────────────────────────────────────────────────
def set_customer_status(user_id: int, blocked: bool) -> User:
    """
    Flip the customer between ACTIVE and SUSPENDED.

    Blocking maps to SUSPENDED on the User model — the frontend only
    knows two states, but the User model has three. PENDING (email
    unverified) is left untouched by admin actions.

    Purely a User field write. No profile cache update needed — status
    is read from User at serialize time.
    """
    user = User.objects.get(pk=user_id, role="CUSTOMER")
    user.status = "SUSPENDED" if blocked else "ACTIVE"
    user.save(update_fields=["status"])

    CommunicationLog.objects.create(
        user=user,
        channel=CommunicationChannel.EMAIL,
        direction=CommunicationDirection.OUTBOUND,
        subject=(
            "Account suspended" if blocked else "Account reactivated"
        ),
        agent="Admin",
    )
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Marketing consent
# ─────────────────────────────────────────────────────────────────────────────
@transaction.atomic
def set_marketing_consent(user_id: int, consent: str) -> User:
    """
    Apply a single consent value to the four boolean flags on User.

    "Subscribed"    → all four flags True
    "Unsubscribed"  → all four flags False
    "Pending"       → leave flags unchanged (the frontend only reads)

    The computed value is derived from the flags at serialize time, so
    this remains the single source of truth.
    """
    user = User.objects.get(pk=user_id, role="CUSTOMER")

    if consent == "Subscribed":
        user.whatsapp_updates = True
        user.email_promotions = True
        user.sms_promotions = True
        user.newsletter = True
        user.save(update_fields=[
            "whatsapp_updates",
            "email_promotions",
            "sms_promotions",
            "newsletter",
        ])
    elif consent == "Unsubscribed":
        user.whatsapp_updates = False
        user.email_promotions = False
        user.sms_promotions = False
        user.newsletter = False
        user.save(update_fields=[
            "whatsapp_updates",
            "email_promotions",
            "sms_promotions",
            "newsletter",
        ])
    # "Pending" → no-op

    return user


# ─────────────────────────────────────────────────────────────────────────────
# Notes
# ─────────────────────────────────────────────────────────────────────────────
def add_note(*, user_id: int, author_id: int | None, text: str) -> CustomerNote:
    """
    Create an internal note. `text` is stripped — serializers reject
    empty strings, so this is a second line of defence.
    """
    text = text.strip()
    if not text:
        raise ValueError("Note text cannot be empty.")

    return CustomerNote.objects.create(
        user_id=user_id,
        author_id=author_id,
        text=text,
    )


def delete_note(note_id: int) -> None:
    CustomerNote.objects.filter(pk=note_id).delete()


# ─────────────────────────────────────────────────────────────────────────────
# Support tickets
# ─────────────────────────────────────────────────────────────────────────────
def create_support_ticket(
    *,
    user_id: int,
    subject: str,
    priority: str = SupportTicketPriority.MEDIUM,
    status: str = SupportTicketStatus.OPEN,
) -> SupportTicket:
    return SupportTicket.objects.create(
        user_id=user_id,
        subject=subject.strip(),
        priority=priority,
        status=status,
    )


def update_support_ticket_status(ticket_id: int, status: str) -> SupportTicket:
    ticket = SupportTicket.objects.get(pk=ticket_id)
    ticket.status = status
    ticket.save(update_fields=["status", "last_update"])
    return ticket


# ─────────────────────────────────────────────────────────────────────────────
# Communication
# ─────────────────────────────────────────────────────────────────────────────
def log_communication(
    *,
    user_id: int,
    channel: str,
    direction: str,
    subject: str,
    agent: str = "",
) -> CommunicationLog:
    """
    Append an entry to the customer's communication timeline.

    Callers are responsible for actually sending the message first.
    This is the audit step, not the delivery step — see
    `send_whatsapp` / `send_email` below for the outline.
    """
    return CommunicationLog.objects.create(
        user_id=user_id,
        channel=channel,
        direction=direction,
        subject=subject.strip(),
        agent=agent,
    )


# ─────────────────────────────────────────────────────────────────────────────
# WhatsApp / Email — provider stubs
# ─────────────────────────────────────────────────────────────────────────────
def send_whatsapp(*, user_id: int, message: str, agent: str = "Admin") -> CommunicationLog:
    """
    Placeholder. Replace the body with a real provider call.

    When integrating:
      * Build the payload from `message`
      * Call the provider (Twilio / Africa's Talking / Meta Cloud API)
      * Only log to CommunicationLog after the provider returns success
      * Raise on failure so the view can surface it

    Returning the log entry keeps the call site uniform with email.
    """
    # TODO: integrate WhatsApp Business API.
    return log_communication(
        user_id=user_id,
        channel=CommunicationChannel.WHATSAPP,
        direction=CommunicationDirection.OUTBOUND,
        subject=message[:120],
        agent=agent,
    )


def send_email(
    *,
    user_id: int,
    subject: str,
    body: str,
    agent: str = "Admin",
) -> CommunicationLog:
    """
    Placeholder. Replace with `django.core.mail.send_mail` or an
    external provider (SendGrid, Mailgun, etc.).
    """
    # TODO: integrate email delivery.
    return log_communication(
        user_id=user_id,
        channel=CommunicationChannel.EMAIL,
        direction=CommunicationDirection.OUTBOUND,
        subject=subject,
        agent=agent,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Profile refresh — used by signals and manual repair
# ─────────────────────────────────────────────────────────────────────────────
def refresh_profile(user_id: int) -> CustomerProfile:
    profile, _ = CustomerProfile.objects.get_or_create(user_id=user_id)
    profile.refresh_stats()
    return profile