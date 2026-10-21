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


def set_customer_status(user_id: int, blocked: bool) -> User:
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


@transaction.atomic
def set_marketing_consent(user_id: int, consent: str) -> User:
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

    return user


def add_note(*, user_id: int, author_id: int | None, text: str) -> CustomerNote:
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


def log_communication(
    *,
    user_id: int,
    channel: str,
    direction: str,
    subject: str,
    agent: str = "",
) -> CommunicationLog:
    return CommunicationLog.objects.create(
        user_id=user_id,
        channel=channel,
        direction=direction,
        subject=subject.strip(),
        agent=agent,
    )


def send_whatsapp(*, user_id: int, message: str, agent: str = "Admin") -> CommunicationLog:
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
    return log_communication(
        user_id=user_id,
        channel=CommunicationChannel.EMAIL,
        direction=CommunicationDirection.OUTBOUND,
        subject=subject,
        agent=agent,
    )


def refresh_profile(user_id: int) -> CustomerProfile:
    profile, _ = CustomerProfile.objects.get_or_create(user_id=user_id)
    profile.refresh_stats()
    return profile


def export_customers_csv_sync(filters: dict | None = None) -> str:
    import csv
    import io

    from .constants import CustomerSegment
    from .selectors import list_customers

    filters = filters or {}
    qs = list_customers(**filters).select_related("customer_profile")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "email", "phone", "first_name", "last_name",
        "segment", "status", "orders_count", "total_spent",
        "last_order_date", "date_joined",
    ])

    for user in qs.iterator(chunk_size=500):
        p = getattr(user, "customer_profile", None)
        writer.writerow([
            user.pk,
            user.email,
            user.phone,
            user.first_name,
            user.last_name,
            p.segment if p else CustomerSegment.REGULAR,
            user.status,
            p.orders_count if p else 0,
            f"{p.total_spent:.2f}" if p else "0.00",
            p.last_order_date.isoformat() if p and p.last_order_date else "",
            user.date_joined.isoformat(),
        ])

    return buf.getvalue()