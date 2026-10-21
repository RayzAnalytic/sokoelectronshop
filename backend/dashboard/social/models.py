from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _fernet() -> Fernet:
    raw = getattr(settings, "FIELD_ENCRYPTION_KEY", "") or ""
    if not raw:
        raise ImproperlyConfigured(
            "FIELD_ENCRYPTION_KEY is empty — social OAuth tokens cannot be stored."
        )
    try:
        return Fernet(raw.encode() if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        digest = hashlib.sha256(raw.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


class EncryptedTextField(models.TextField):
    def get_prep_value(self, value):
        if value is None or value == "":
            return value
        return _fernet().encrypt(str(value).encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value is None or value == "":
            return value
        try:
            return _fernet().decrypt(value.encode()).decode()
        except (InvalidToken, ValueError):
            return value

    def to_python(self, value):
        return value


class SocialPlatform(models.TextChoices):
    FACEBOOK  = "FACEBOOK",  "Facebook"
    INSTAGRAM = "INSTAGRAM", "Instagram"
    TIKTOK    = "TIKTOK",    "TikTok"
    YOUTUBE   = "YOUTUBE",   "YouTube"


PLATFORM_FROM_FRONTEND: dict[str, str] = {
    "facebook":  SocialPlatform.FACEBOOK.value,
    "instagram": SocialPlatform.INSTAGRAM.value,
    "tiktok":    SocialPlatform.TIKTOK.value,
    "youtube":   SocialPlatform.YOUTUBE.value,
}


class PostStatus(models.TextChoices):
    DRAFT      = "DRAFT",      "Draft"
    SCHEDULED  = "SCHEDULED",  "Scheduled"
    PUBLISHING = "PUBLISHING", "Publishing"
    PUBLISHED  = "PUBLISHED",  "Published"
    PARTIAL    = "PARTIAL",    "Partially published"
    FAILED     = "FAILED",     "Failed"


class TargetStatus(models.TextChoices):
    PENDING   = "PENDING",   "Pending"
    PUBLISHED = "PUBLISHED", "Published"
    FAILED    = "FAILED",    "Failed"


class MediaType(models.TextChoices):
    IMAGE = "IMAGE", "Image"
    VIDEO = "VIDEO", "Video"


class MediaKind(models.TextChoices):
    IMAGE    = "IMAGE",    "Image"
    VIDEO    = "VIDEO",    "Video"
    CAROUSEL = "CAROUSEL", "Carousel"


class InboxItemType(models.TextChoices):
    COMMENT = "COMMENT", "Comment"
    DM      = "DM",      "Direct message"
    MENTION = "MENTION", "Mention"


class InboxItemStatus(models.TextChoices):
    OPEN     = "OPEN",     "Open"
    RESOLVED = "RESOLVED", "Resolved"
    SNOOZED  = "SNOOZED",  "Snoozed"
    SPAM     = "SPAM",     "Spam"


class Sentiment(models.TextChoices):
    POSITIVE = "POSITIVE", "Positive"
    NEUTRAL  = "NEUTRAL",  "Neutral"
    NEGATIVE = "NEGATIVE", "Negative"


class DraftStatus(models.TextChoices):
    DRAFT     = "DRAFT",     "Draft"
    PENDING   = "PENDING",   "Pending approval"
    APPROVED  = "APPROVED",  "Approved"
    REJECTED  = "REJECTED",  "Rejected"
    SCHEDULED = "SCHEDULED", "Scheduled"


class ApprovalDecision(models.TextChoices):
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    CHANGES  = "CHANGES",  "Changes requested"


class NotificationType(models.TextChoices):
    POST_PUBLISHED  = "POST_PUBLISHED",  "Post published"
    POST_FAILED     = "POST_FAILED",     "Post failed"
    TOKEN_EXPIRING  = "TOKEN_EXPIRING",  "Token expiring"
    TOKEN_EXPIRED   = "TOKEN_EXPIRED",   "Token expired"
    APPROVAL_NEEDED = "APPROVAL_NEEDED", "Approval needed"
    APPROVAL_GIVEN  = "APPROVAL_GIVEN",  "Approval given"
    NEW_COMMENT     = "NEW_COMMENT",     "New comment"
    NEW_DM          = "NEW_DM",          "New direct message"
    NEW_MENTION     = "NEW_MENTION",     "New mention"
    REPORT_READY    = "REPORT_READY",    "Report ready"


class TeamRole(models.TextChoices):
    OWNER    = "OWNER",    "Owner"
    ADMIN    = "ADMIN",    "Admin"
    EDITOR   = "EDITOR",   "Editor"
    APPROVER = "APPROVER", "Approver"
    VIEWER   = "VIEWER",   "Viewer"


class QueueSlotKind(models.TextChoices):
    STANDARD  = "STANDARD",  "Standard"
    EVERGREEN = "EVERGREEN", "Evergreen"


class ReportFormat(models.TextChoices):
    PDF = "PDF", "PDF"
    CSV = "CSV", "CSV"
    PNG = "PNG", "PNG"


class SocialAccount(models.Model):
    DEFAULT_AVATAR_BG: dict[str, str] = {
        SocialPlatform.FACEBOOK.value:  "bg-[#1877F2]",
        SocialPlatform.INSTAGRAM.value: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]",
        SocialPlatform.TIKTOK.value:    "bg-black",
        SocialPlatform.YOUTUBE.value:   "bg-[#FF0000]",
    }

    platform          = models.CharField(max_length=16, choices=SocialPlatform.choices, unique=True)
    handle            = models.CharField(max_length=128, blank=True)
    display_name      = models.CharField(max_length=255, blank=True)
    platform_user_id  = models.CharField(max_length=128, blank=True)

    access_token      = EncryptedTextField(blank=True)
    refresh_token     = EncryptedTextField(blank=True)
    token_expires_at  = models.DateTimeField(null=True, blank=True)

    metadata          = models.JSONField(default=dict, blank=True)
    scopes            = models.JSONField(default=list, blank=True)
    followers         = models.PositiveBigIntegerField(default=0)
    avatar_url        = models.URLField(blank=True)

    is_connected      = models.BooleanField(default=False)
    connected_at      = models.DateTimeField(null=True, blank=True)
    last_synced_at    = models.DateTimeField(null=True, blank=True)
    last_error        = models.TextField(blank=True)

    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["platform"]
        indexes  = [
            models.Index(fields=["is_connected"]),
        ]

    def __str__(self):
        return f"{self.get_platform_display()} — {self.handle or self.platform_user_id or 'disconnected'}"

    @property
    def avatar_bg(self) -> str:
        return self.DEFAULT_AVATAR_BG.get(self.platform, "bg-slate-700")

    @property
    def name(self) -> str:
        return self.display_name or self.get_platform_display()

    @property
    def is_token_expired(self) -> bool:
        from django.utils import timezone
        return bool(self.token_expires_at and self.token_expires_at <= timezone.now())

    @property
    def is_token_expiring_soon(self) -> bool:
        from datetime import timedelta
        from django.utils import timezone
        if not self.token_expires_at:
            return False
        return self.token_expires_at <= timezone.now() + timedelta(days=3)


class SocialMediaFolder(models.Model):
    name       = models.CharField(max_length=128)
    slug       = models.SlugField(max_length=128, unique=True)
    parent     = models.ForeignKey(
        "self", null=True, blank=True, related_name="children", on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SocialMedia(models.Model):
    post             = models.ForeignKey(
        "SocialPost",
        related_name="media",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    folder           = models.ForeignKey(
        SocialMediaFolder, null=True, blank=True, related_name="assets", on_delete=models.SET_NULL,
    )
    file             = models.FileField(upload_to="social/%Y/%m/")
    media_type       = models.CharField(max_length=8, choices=MediaType.choices)
    title            = models.CharField(max_length=255, blank=True)
    filename         = models.CharField(max_length=255, blank=True)
    tags             = models.JSONField(default=list, blank=True)
    size_bytes       = models.PositiveBigIntegerField(default=0)
    width            = models.PositiveIntegerField(default=0)
    height           = models.PositiveIntegerField(default=0)
    duration_seconds = models.FloatField(default=0)
    sort_order       = models.PositiveSmallIntegerField(default=0)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        indexes  = [
            models.Index(fields=["media_type"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return self.filename or f"media #{self.pk}"

    def save(self, *args, **kwargs):
        if self.file and not self.filename:
            self.filename = self.file.name.rsplit("/", 1)[-1]
        if self.file and not self.size_bytes:
            try:
                self.size_bytes = self.file.size
            except (OSError, ValueError):
                pass
        super().save(*args, **kwargs)


class SocialPost(models.Model):
    status         = models.CharField(max_length=16, choices=PostStatus.choices, default=PostStatus.DRAFT)
    caption        = models.TextField()
    first_comment  = models.TextField(blank=True)
    product_tag    = models.CharField(max_length=255, blank=True)
    campaign       = models.CharField(max_length=128, blank=True, db_index=True)
    link_url       = models.URLField(blank=True)
    link_utm       = models.JSONField(default=dict, blank=True)

    scheduled_for  = models.DateTimeField(null=True, blank=True, db_index=True)
    published_at   = models.DateTimeField(null=True, blank=True)

    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_posts",
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["status", "scheduled_for"]),
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["campaign"]),
        ]

    def __str__(self):
        return f"Post #{self.pk} [{self.status}]"

    @property
    def platforms(self) -> list[str]:
        return [t.get_platform_display() for t in self.targets.all()]

    @property
    def primary_media_url(self) -> str | None:
        first = self.media.first()
        return first.file.url if first and first.file else None


class SocialPostTarget(models.Model):
    post              = models.ForeignKey(SocialPost, related_name="targets", on_delete=models.CASCADE)
    platform          = models.CharField(max_length=16, choices=SocialPlatform.choices)
    status            = models.CharField(max_length=16, choices=TargetStatus.choices, default=TargetStatus.PENDING)

    platform_post_id  = models.CharField(max_length=255, blank=True)
    platform_url      = models.URLField(blank=True)
    error_message     = models.TextField(blank=True)

    likes             = models.PositiveIntegerField(default=0)
    comments          = models.PositiveIntegerField(default=0)
    shares            = models.PositiveIntegerField(default=0)
    reach             = models.PositiveIntegerField(default=0)
    impressions       = models.PositiveIntegerField(default=0)
    saves             = models.PositiveIntegerField(default=0)
    video_views       = models.PositiveIntegerField(default=0)
    watch_time_sec    = models.PositiveIntegerField(default=0)
    link_clicks       = models.PositiveIntegerField(default=0)
    profile_visits    = models.PositiveIntegerField(default=0)
    follower_delta    = models.IntegerField(default=0)
    metrics_synced_at = models.DateTimeField(null=True, blank=True)

    published_at      = models.DateTimeField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("post", "platform")]
        ordering        = ["platform"]
        indexes         = [
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["-published_at"]),
        ]

    def __str__(self):
        return f"Post #{self.post_id} → {self.platform} [{self.status}]"

    @property
    def total_engagement(self) -> int:
        return self.likes + self.comments + self.shares

    @property
    def engagement_rate(self) -> float:
        if self.reach <= 0:
            return 0.0
        return round((self.total_engagement / self.reach) * 100, 2)


class SocialDraft(models.Model):
    title          = models.CharField(max_length=255, blank=True)
    caption        = models.TextField(blank=True)
    platforms      = models.JSONField(default=list, blank=True)
    fields         = models.JSONField(default=dict, blank=True)
    status         = models.CharField(max_length=16, choices=DraftStatus.choices, default=DraftStatus.DRAFT)

    author         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_drafts",
    )
    reviewer       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_reviews",
    )
    source_post    = models.ForeignKey(
        SocialPost, null=True, blank=True, related_name="drafts", on_delete=models.SET_NULL,
    )

    last_edited_at = models.DateTimeField(auto_now=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_edited_at"]
        indexes  = [
            models.Index(fields=["status", "-last_edited_at"]),
        ]

    def __str__(self):
        return self.title or f"Draft #{self.pk}"


class SocialDraftComment(models.Model):
    draft      = models.ForeignKey(SocialDraft, related_name="comments", on_delete=models.CASCADE)
    author     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_draft_comments",
    )
    body       = models.TextField()
    decision   = models.CharField(
        max_length=16, choices=ApprovalDecision.choices, blank=True, default="",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment on draft #{self.draft_id}"


class SocialInboxItem(models.Model):
    item_type      = models.CharField(max_length=16, choices=InboxItemType.choices, db_index=True)
    status         = models.CharField(max_length=16, choices=InboxItemStatus.choices, default=InboxItemStatus.OPEN)
    sentiment      = models.CharField(max_length=16, choices=Sentiment.choices, default=Sentiment.NEUTRAL)

    platform       = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    account        = models.ForeignKey(
        SocialAccount, null=True, blank=True, related_name="inbox_items", on_delete=models.SET_NULL,
    )
    target         = models.ForeignKey(
        SocialPostTarget, null=True, blank=True, related_name="inbox_items", on_delete=models.SET_NULL,
    )

    platform_item_id = models.CharField(max_length=255, blank=True, db_index=True)
    parent_item_id   = models.CharField(max_length=255, blank=True)

    author_name    = models.CharField(max_length=255, blank=True)
    author_handle  = models.CharField(max_length=255, blank=True)
    author_avatar  = models.URLField(blank=True)

    body           = models.TextField(blank=True)
    permalink      = models.URLField(blank=True)

    assigned_to    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_inbox_assigned",
    )
    resolved_at    = models.DateTimeField(null=True, blank=True)
    snoozed_until  = models.DateTimeField(null=True, blank=True)

    received_at    = models.DateTimeField(db_index=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at"]
        indexes  = [
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["item_type", "status"]),
            models.Index(fields=["-received_at"]),
        ]

    def __str__(self):
        return f"{self.get_item_type_display()} from {self.author_handle or self.author_name or 'unknown'}"


class SocialInboxReply(models.Model):
    item         = models.ForeignKey(SocialInboxItem, related_name="replies", on_delete=models.CASCADE)
    author       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_inbox_replies",
    )
    body         = models.TextField()
    platform_reply_id = models.CharField(max_length=255, blank=True)
    is_outbound  = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Reply on item #{self.item_id}"


class SocialTemplate(models.Model):
    name        = models.CharField(max_length=255)
    category    = models.CharField(max_length=128, blank=True, db_index=True)
    caption     = models.TextField(blank=True)
    platforms   = models.JSONField(default=list, blank=True)
    fields      = models.JSONField(default=dict, blank=True)
    is_shared   = models.BooleanField(default=True)

    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_templates",
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SocialQueueSlot(models.Model):
    name       = models.CharField(max_length=128)
    kind       = models.CharField(max_length=16, choices=QueueSlotKind.choices, default=QueueSlotKind.STANDARD)
    days       = models.JSONField(default=list, blank=True)
    time_of_day = models.TimeField()
    timezone   = models.CharField(max_length=64, default="Africa/Nairobi")
    platforms  = models.JSONField(default=list, blank=True)
    is_active  = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["time_of_day"]

    def __str__(self):
        return f"{self.name} @ {self.time_of_day}"


class SocialEvergreenPost(models.Model):
    caption     = models.TextField()
    platforms   = models.JSONField(default=list, blank=True)
    product_tag = models.CharField(max_length=255, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    use_count   = models.PositiveIntegerField(default=0)
    is_active   = models.BooleanField(default=True)

    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_used_at", "created_at"]

    def __str__(self):
        return f"Evergreen #{self.pk}"


class SocialLink(models.Model):
    short_code  = models.CharField(max_length=32, unique=True)
    destination = models.URLField()
    utm         = models.JSONField(default=dict, blank=True)
    clicks      = models.PositiveBigIntegerField(default=0)

    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_links",
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.short_code} → {self.destination}"


class SocialNotification(models.Model):
    notification_type = models.CharField(max_length=32, choices=NotificationType.choices)
    title             = models.CharField(max_length=255)
    message           = models.TextField(blank=True)
    link              = models.CharField(max_length=512, blank=True)
    is_read           = models.BooleanField(default=False, db_index=True)

    recipient         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
        related_name="social_notifications",
    )
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_notification_type_display()} — {self.title}"


class SocialAuditLog(models.Model):
    actor       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_audit_entries",
    )
    action      = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=64, blank=True)
    target_id   = models.CharField(max_length=64, blank=True)
    details     = models.JSONField(default=dict, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} @ {self.created_at}"


class SocialTeamMember(models.Model):
    user       = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="social_team_profile",
    )
    role       = models.CharField(max_length=16, choices=TeamRole.choices, default=TeamRole.EDITOR)
    is_active  = models.BooleanField(default=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_invites_sent",
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    joined_at  = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["role", "id"]

    def __str__(self):
        return f"{self.user} · {self.get_role_display()}"


class SocialReport(models.Model):
    name          = models.CharField(max_length=255)
    date_from     = models.DateField()
    date_to       = models.DateField()
    platforms     = models.JSONField(default=list, blank=True)
    metrics       = models.JSONField(default=list, blank=True)
    branding      = models.JSONField(default=dict, blank=True)
    format        = models.CharField(max_length=8, choices=ReportFormat.choices, default=ReportFormat.PDF)
    file          = models.FileField(upload_to="social/reports/%Y/%m/", null=True, blank=True)

    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="social_reports",
    )
    generated_at  = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class SocialBestTimePost(models.Model):
    platform   = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    day_of_week = models.PositiveSmallIntegerField()
    hour       = models.PositiveSmallIntegerField()
    score      = models.FloatField(default=0)
    sample_size = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("platform", "day_of_week", "hour")]
        ordering        = ["platform", "day_of_week", "hour"]

    def __str__(self):
        return f"{self.platform} · day {self.day_of_week} · {self.hour}:00 · {self.score}"


class SocialDemographicSnapshot(models.Model):
    platform   = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    date       = models.DateField()
    age_buckets = models.JSONField(default=dict, blank=True)
    gender     = models.JSONField(default=dict, blank=True)
    top_cities = models.JSONField(default=list, blank=True)
    top_countries = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("platform", "date")]
        ordering        = ["-date"]

    def __str__(self):
        return f"{self.platform} · {self.date} demographics"


class SocialFollowerSnapshot(models.Model):
    account   = models.ForeignKey(
        SocialAccount, related_name="follower_snapshots", on_delete=models.CASCADE,
    )
    platform  = models.CharField(
        max_length=16,
        choices=SocialPlatform.choices,
        default="",
        blank=True,
        db_index=True,
    )
    date      = models.DateField()
    followers = models.PositiveIntegerField()

    class Meta:
        unique_together = [("account", "date")]
        ordering        = ["date"]
        indexes         = [
            models.Index(fields=["platform", "date"]),
        ]

    def __str__(self):
        return f"{self.platform} · {self.date} · {self.followers}"

    def save(self, *args, **kwargs):
        if self.account_id and not self.platform:
            self.platform = self.account.platform
        super().save(*args, **kwargs)


class SocialEngagementSnapshot(models.Model):
    platform    = models.CharField(max_length=16, choices=SocialPlatform.choices, unique=True)
    reach       = models.PositiveBigIntegerField(default=0)
    engagement  = models.PositiveBigIntegerField(default=0)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["platform"]

    def __str__(self):
        return f"{self.platform} · reach={self.reach} · engagement={self.engagement}"

    @property
    def engagement_rate(self) -> float:
        if self.reach <= 0:
            return 0.0
        return round((self.engagement / self.reach) * 100, 2)