# newsletter/tasks.py
"""
Celery tasks for the newsletter app.

This module is the single point of SendGrid integration. Everything
downstream — models, serializers, views, admin UI, storefront — talks
to Django's normal mail framework; Anymail routes those calls to
SendGrid's HTTP API using SENDGRID_API_KEY from settings.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from .models import Campaign, CampaignRecipient, Subscriber

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Merge-tag rendering
#
# We do NOT use Django's template engine here. `Template(text).render()`
# autoescapes by default, which would turn "O'Brien" into "O&#x27;Brien"
# inside plain-text emails. Simple string replacement is safer and
# matches the exact tag set documented in the admin composer:
#   {{name}}, {{email}}, {{order_number}}, {{store_url}}
# ─────────────────────────────────────────────────────────────────────────────
def _render(text: str, subscriber: Subscriber) -> str:
    """Substitute {{merge_tags}} in subject / body with plain values."""
    values = {
        "name": subscriber.name or subscriber.email.split("@")[0],
        "email": subscriber.email,
        "store_url": getattr(settings, "STORE_URL", ""),
        "order_number": "",
        "amount": "",
    }
    for key, val in values.items():
        text = text.replace("{{" + key + "}}", str(val))
    return text


def _build_html(campaign: Campaign, subscriber: Subscriber) -> str:
    # Render merge tags in the raw body, then escape the result before
    # embedding so a subscriber's name can never inject markup.
    body_html = escape(_render(campaign.body, subscriber))

    hero = (
        f'<img src="{escape(campaign.hero_image_url)}" '
        f'style="width:100%;border-radius:8px;margin-bottom:16px" alt="">'
        if campaign.hero_image_url else ""
    )

    cta = (
        f'<p style="margin-top:24px">'
        f'<a href="{escape(campaign.cta_url)}" '
        f'style="display:inline-block;background:#172554;color:#fff;'
        f'padding:12px 22px;border-radius:4px;text-decoration:none;'
        f'font-weight:600">{escape(campaign.cta_text)}</a></p>'
        if campaign.cta_text and campaign.cta_url else ""
    )

    unsub_url = _unsubscribe_url(subscriber)

    shop = getattr(settings, "SHOP_NAME", "our store")

    return f"""<!DOCTYPE html>
<html><body style="margin:0;background:#f8fafc">
<div style="max-width:600px;margin:0 auto;padding:24px;background:#fff;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            color:#0f172a;line-height:1.6">
  {hero}
  <div style="white-space:pre-wrap">{body_html}</div>
  {cta}
  <hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0">
  <p style="font-size:12px;color:#94a3b8;margin-top:16px">
    You're receiving this because you subscribed to {escape(shop)}.<br>
    <a href="{unsub_url}" style="color:#94a3b8">Unsubscribe</a>
  </p>
</div>
</body></html>"""


def _unsubscribe_url(subscriber: Subscriber) -> str:
    base = getattr(settings, "BACKEND_PUBLIC_URL", "").rstrip("/")
    return f"{base}/api/v1/newsletter/unsubscribe/{subscriber.unsubscribe_token}/"


# ─────────────────────────────────────────────────────────────────────────────
# Single-recipient send
# ─────────────────────────────────────────────────────────────────────────────
class _SkipRecipient(Exception):
    """Raised when a recipient should not be sent to (unsubscribed, deleted)."""


def _send_one(campaign: Campaign, recipient: CampaignRecipient) -> None:
    """
    Send ONE email. Raises on failure; caller records the error.
    This is the SendGrid integration point — msg.send() dispatches
    through Anymail → SendGrid HTTP API.
    """
    sub = recipient.subscriber
    if not sub:
        raise _SkipRecipient("Subscriber record no longer exists")
    if not sub.is_active:
        raise _SkipRecipient("Subscriber unsubscribed before send")

    subject = _render(campaign.subject, sub)
    body_text = _render(campaign.body, sub)
    body_html = _build_html(campaign, sub)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=body_text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient.email],
    )
    msg.attach_alternative(body_html, "text/html")

    # Gmail / Yahoo one-click unsubscribe — required by their 2024+ policy.
    msg.extra_headers["List-Unsubscribe"] = f"<{_unsubscribe_url(sub)}>"
    msg.extra_headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

    msg.send(fail_silently=False)


# ─────────────────────────────────────────────────────────────────────────────
# Audience resolver — shared with admin views
# ─────────────────────────────────────────────────────────────────────────────
def resolve_audience(campaign: Campaign):
    """Return the Subscriber queryset a campaign should target."""
    if (
        campaign.audience_type == Campaign.AudienceType.LIST
        and campaign.audience_id
    ):
        return Subscriber.objects.filter(
            is_active=True,
            lists__id=campaign.audience_id,
        ).distinct()

    if (
        campaign.audience_type == Campaign.AudienceType.SEGMENT
        and campaign.audience_id
    ):
        # TODO: wire real segment rules here. For now, fall back to all
        # active subscribers so segment campaigns don't silently send 0.
        return Subscriber.objects.filter(is_active=True)

    return Subscriber.objects.filter(is_active=True)


def _ensure_recipients(campaign: Campaign) -> int:
    """
    Idempotently create CampaignRecipient rows for the campaign audience
    and keep Campaign.recipient_count in sync.

    Runs inside a transaction so a retry can't double-create. Returns
    the number of recipient rows that now exist.
    """
    with transaction.atomic():
        # Re-read inside the transaction to avoid races on autoretry.
        campaign.refresh_from_db(fields=["recipient_count"])

        existing = campaign.recipients.count()
        if existing:
            if campaign.recipient_count != existing:
                campaign.recipient_count = existing
                campaign.save(update_fields=["recipient_count"])
            return existing

        audience = resolve_audience(campaign)
        rows = [
            CampaignRecipient(
                campaign=campaign,
                subscriber=sub,
                email=sub.email,
            )
            for sub in audience.iterator(chunk_size=500)
        ]
        CampaignRecipient.objects.bulk_create(rows, batch_size=500)

        campaign.recipient_count = len(rows)
        campaign.save(update_fields=["recipient_count"])
        return len(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Main dispatch task
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=3,
)
def send_campaign(campaign_id: int) -> dict:
    """
    Send every QUEUED CampaignRecipient for this campaign.

    - Idempotent: re-running only picks up recipients still in QUEUED.
    - Creates recipient rows on first run if the admin view hasn't yet.
    - Honours PAUSED mid-flight.
    - Counters are recomputed from the DB at the end, so a pause/resume
      cycle doesn't overwrite previous run totals.
    """
    try:
        campaign = Campaign.objects.get(id=campaign_id)
    except Campaign.DoesNotExist:
        log.warning("send_campaign: campaign %s not found", campaign_id)
        return {"campaign_id": campaign_id, "status": "missing"}

    if campaign.status not in (
        Campaign.Status.QUEUED,
        Campaign.Status.SENDING,
        Campaign.Status.PAUSED,
    ):
        log.info(
            "send_campaign: %s status=%s — skipping",
            campaign_id, campaign.status,
        )
        return {"campaign_id": campaign_id, "status": campaign.status}

    total = _ensure_recipients(campaign)
    if total == 0:
        log.warning("send_campaign: %s has 0 recipients", campaign_id)
        campaign.status = Campaign.Status.SENT
        campaign.sent_at = timezone.now()
        campaign.save(update_fields=["status", "sent_at"])
        return {"campaign_id": campaign_id, "status": "sent", "recipients": 0}

    if campaign.status != Campaign.Status.PAUSED:
        campaign.status = Campaign.Status.SENDING
        campaign.save(update_fields=["status"])

    pending = campaign.recipients.filter(
        status=CampaignRecipient.Status.QUEUED
    ).select_related("subscriber")

    sent = failed = skipped = 0

    for i, recipient in enumerate(pending.iterator(chunk_size=200)):
        # Allow admins to pause large sends mid-flight.
        if i and i % 50 == 0:
            campaign.refresh_from_db(fields=["status"])
            if campaign.status == Campaign.Status.PAUSED:
                log.info(
                    "send_campaign: %s paused at recipient %s",
                    campaign_id, i,
                )
                _recount(campaign)
                return {
                    "campaign_id": campaign_id,
                    "status": "paused",
                    "sent": sent,
                    "failed": failed,
                    "skipped": skipped,
                }

        try:
            _send_one(campaign, recipient)
            recipient.status = CampaignRecipient.Status.SENT
            recipient.sent_at = timezone.now()
            recipient.error_message = ""
            recipient.save(
                update_fields=["status", "sent_at", "error_message"]
            )
            sent += 1

        except _SkipRecipient as exc:
            # Not a failure — the subscriber left between queue and send.
            recipient.status = CampaignRecipient.Status.FAILED
            recipient.error_message = str(exc)[:500]
            recipient.save(update_fields=["status", "error_message"])
            skipped += 1

        except Exception as exc:
            log.exception(
                "send_campaign: %s failed for %s",
                campaign_id, recipient.email,
            )
            recipient.status = CampaignRecipient.Status.FAILED
            recipient.error_message = str(exc)[:500]
            recipient.save(update_fields=["status", "error_message"])
            failed += 1

    _recount(campaign)
    campaign.status = Campaign.Status.SENT
    campaign.sent_at = timezone.now()
    campaign.save(update_fields=["status", "sent_count", "failed_count", "sent_at"])

    log.info(
        "send_campaign: %s done — %s sent, %s failed, %s skipped",
        campaign_id, sent, failed, skipped,
    )
    return {
        "campaign_id": campaign_id,
        "status": "sent",
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
    }


def _recount(campaign: Campaign) -> None:
    """
    Recompute denormalized counters from the recipient table.

    Called before every early-exit and at the end so the admin UI never
    shows stale numbers after a pause/resume.
    """
    agg = campaign.recipients.aggregate(
        sent=models.Count("id", filter=models.Q(status=CampaignRecipient.Status.SENT)),
        failed=models.Count("id", filter=models.Q(status=CampaignRecipient.Status.FAILED)),
    )
    campaign.sent_count = agg["sent"] or 0
    campaign.failed_count = agg["failed"] or 0
    campaign.recipient_count = campaign.recipients.count()
    campaign.save(update_fields=["sent_count", "failed_count", "recipient_count"])


# ─────────────────────────────────────────────────────────────────────────────
# Celery-beat job (declared in settings.CELERY_BEAT_SCHEDULE)
# ─────────────────────────────────────────────────────────────────────────────
@shared_task
def send_scheduled_campaigns() -> None:
    """
    Runs every 60 s. Promotes due SCHEDULED campaigns to QUEUED and
    enqueues their send.
    """
    due = Campaign.objects.filter(
        status=Campaign.Status.SCHEDULED,
        scheduled_at__lte=timezone.now(),
    )
    for c in due.iterator():
        c.status = Campaign.Status.QUEUED
        c.save(update_fields=["status"])
        send_campaign.delay(c.id)
        log.info("send_scheduled_campaigns: enqueued %s", c.id)