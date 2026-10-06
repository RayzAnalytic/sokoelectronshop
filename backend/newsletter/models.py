import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


# ═══════════════════════════════════════════════════════════════════════════
# Subscriber
# ═══════════════════════════════════════════════════════════════════════════
class Subscriber(models.Model):
    """
    One row per email address that has ever subscribed.

    We keep the row (with is_active=False) after an unsubscribe so that
    re-subscribing is a state flip, not a new record — and so we retain
    subscription history for the admin.
    """
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="Normalized to lowercase on save.",
    )
    name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional display name; may be edited in the admin.",
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Free-form labels, e.g. ['vip', 'buyer', 'student'].",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False once the user unsubscribes.",
    )
    source = models.CharField(
        max_length=64,
        default="homepage",
        help_text="Where the signup came from (e.g. 'homepage', 'checkout').",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Best-effort capture for abuse mitigation.",
    )
    unsubscribe_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Used for one-click unsubscribe links in emails.",
    )
    subscribed_at = models.DateTimeField(
        default=timezone.now,
        help_text="Last time this address (re)subscribed.",
    )
    unsubscribed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set when is_active flips to False.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-subscribed_at"]
        verbose_name = "Subscriber"
        verbose_name_plural = "Subscribers"
        indexes = [
            models.Index(fields=["is_active", "-subscribed_at"]),
        ]

    def __str__(self) -> str:
        status = "active" if self.is_active else "inactive"
        return f"{self.email} ({status})"

    def save(self, *args, **kwargs):
        # Normalize email so "User@X.com" and "user@x.com" don't create
        # two rows (and so the unique constraint behaves as expected).
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    # ── Convenience transitions ───────────────────────────────
    def mark_unsubscribed(self, save: bool = True) -> None:
        """Flip to inactive and record when."""
        self.is_active = False
        self.unsubscribed_at = timezone.now()
        if save:
            self.save(update_fields=["is_active", "unsubscribed_at", "updated_at"])

    def mark_subscribed(self, source: str | None = None, save: bool = True) -> None:
        """Flip back to active (re-subscribe flow)."""
        self.is_active = True
        self.unsubscribed_at = None
        self.subscribed_at = timezone.now()
        if source:
            self.source = source
        if save:
            self.save(
                update_fields=[
                    "is_active",
                    "unsubscribed_at",
                    "subscribed_at",
                    "source",
                    "updated_at",
                ]
            )


# ═══════════════════════════════════════════════════════════════════════════
# SubscriberList
# ═══════════════════════════════════════════════════════════════════════════
class SubscriberList(models.Model):
    """
    A manual grouping of subscribers. Distinct from a Segment (which is
    rule-based and computed on demand). A subscriber can belong to many
    lists.
    """
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(
        max_length=64,
        blank=True,
        help_text="Tailwind class fragment for the badge, e.g. 'bg-blue-50 text-blue-950 border-blue-100'.",
    )
    subscribers = models.ManyToManyField(
        Subscriber,
        blank=True,
        related_name="lists",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Subscriber List"
        verbose_name_plural = "Subscriber Lists"

    def __str__(self) -> str:
        return self.name

    @property
    def active_count(self) -> int:
        return self.subscribers.filter(is_active=True).count()


# ═══════════════════════════════════════════════════════════════════════════
# EmailTemplate
# ═══════════════════════════════════════════════════════════════════════════
class EmailTemplate(models.Model):
    """
    A reusable starting point for campaigns. The composer pre-fills its
    fields from a selected template; the resulting Campaign stores its
    own copy so template edits don't retroactively change sent emails.
    """
    class Category(models.TextChoices):
        WELCOME = "Welcome", "Welcome"
        PROMOTIONAL = "Promotional", "Promotional"
        TRANSACTIONAL = "Transactional", "Transactional"
        RE_ENGAGEMENT = "Re-engagement", "Re-engagement"

    name = models.CharField(max_length=120)
    subject = models.CharField(max_length=200)
    body = models.TextField(help_text="Plain text. Newlines become <p> tags.")
    hero_image_url = models.CharField(max_length=500, blank=True)
    cta_text = models.CharField(max_length=64, blank=True)
    cta_url = models.CharField(max_length=500, blank=True)
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.PROMOTIONAL,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Email Template"
        verbose_name_plural = "Email Templates"

    def __str__(self) -> str:
        return f"{self.name} ({self.category})"


# ═══════════════════════════════════════════════════════════════════════════
# Campaign
# ═══════════════════════════════════════════════════════════════════════════
class Campaign(models.Model):
    """
    A single broadcast. Created as DRAFT, transitions through QUEUED →
    SENDING → SENT (or PAUSED / FAILED). The per-recipient rows live in
    CampaignRecipient.
    """
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SCHEDULED = "scheduled", "Scheduled"
        QUEUED = "queued", "Queued"
        SENDING = "sending", "Sending"
        SENT = "sent", "Sent"
        PAUSED = "paused", "Paused"
        FAILED = "failed", "Failed"

    class AudienceType(models.TextChoices):
        ALL_ACTIVE = "all_active", "All Active Subscribers"
        LIST = "list", "List"
        SEGMENT = "segment", "Segment"

    # ── Content ──────────────────────────────────────────────────────
    name = models.CharField(
        max_length=200,
        help_text="Internal label for the campaign; not visible to recipients.",
    )
    subject = models.CharField(max_length=200)
    hero_image_url = models.CharField(max_length=500, blank=True)
    body = models.TextField(help_text="Plain text with {{merge_tags}}.")
    cta_text = models.CharField(max_length=64, blank=True)
    cta_url = models.CharField(max_length=500, blank=True)

    # ── Audience ─────────────────────────────────────────────────────
    audience_type = models.CharField(
        max_length=16,
        choices=AudienceType.choices,
        default=AudienceType.ALL_ACTIVE,
    )
    audience_id = models.CharField(
        max_length=64,
        blank=True,
        help_text="List id or segment id; empty for 'all_active'.",
    )

    # ── State ────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    # ── Counters (denormalized so the campaigns list stays fast) ─────
    recipient_count = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)

    open_count = models.PositiveIntegerField(default=0)
    click_count = models.PositiveIntegerField(default=0)
    bounce_count = models.PositiveIntegerField(default=0)
    unsubscribe_count = models.PositiveIntegerField(default=0)

    # ── Timing ───────────────────────────────────────────────────────
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    # ── Provenance ───────────────────────────────────────────────────
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        help_text="Audit: which template this campaign was seeded from.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Campaign"
        verbose_name_plural = "Campaigns"
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.status})"

    def audience_label(self) -> str:
        """Human-readable audience name for the admin table."""
        if self.audience_type == self.AudienceType.ALL_ACTIVE:
            return "All Subscribers"
        if self.audience_type == self.AudienceType.LIST:
            lst = SubscriberList.objects.filter(pk=self.audience_id).first()
            return lst.name if lst else "Unknown list"
        if self.audience_type == self.AudienceType.SEGMENT:
            return f"Segment · {self.audience_id}"
        return "Unknown"


# ═══════════════════════════════════════════════════════════════════════════
# CampaignRecipient
# ═══════════════════════════════════════════════════════════════════════════
class CampaignRecipient(models.Model):
    """
    One row per address per campaign. Exists so we know exactly who was
    sent what — critical for retries, delivery auditing, and per-recipient
    open/click tracking once webhooks are wired up.
    """
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        BOUNCED = "bounced", "Bounced"

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="recipients",
    )
    email = models.EmailField(
        help_text="Snapshot of the address at send time.",
    )
    subscriber = models.ForeignKey(
        Subscriber,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_recipients",
        help_text="Null if the subscriber was deleted after the send.",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-sent_at"]
        verbose_name = "Campaign Recipient"
        verbose_name_plural = "Campaign Recipients"
        indexes = [
            models.Index(fields=["campaign", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.campaign_id} → {self.email}"