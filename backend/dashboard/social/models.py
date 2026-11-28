from __future__ import annotations

import base64
import hashlib
from datetime import timedelta

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.utils import timezone


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
    YOUTUBE = "youtube", "YouTube"
    FACEBOOK = "facebook", "Facebook"
    INSTAGRAM = "instagram", "Instagram"
    TIKTOK = "tiktok", "TikTok"


class AccountConnectionStatus(models.TextChoices):
    CONNECTED = "connected", "Connected"
    NOT_CONNECTED = "not_connected", "Not connected"
    CONNECTING = "connecting", "Connecting"
    AUTHORIZATION_EXPIRED = "authorization_expired", "Authorization expired"
    PERMISSION_REQUIRED = "permission_required", "Permission required"
    SYNC_FAILED = "sync_failed", "Sync failed"
    TEMPORARILY_UNAVAILABLE = "temporarily_unavailable", "Temporarily unavailable"


class AccountSyncStatus(models.TextChoices):
    OK = "ok", "OK"
    FAILED = "failed", "Failed"
    PENDING = "pending", "Pending"
    NEVER = "never", "Never"


class SyncLogStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    FAILURE = "failure", "Failure"


class MediaKind(models.TextChoices):
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"


class MediaSource(models.TextChoices):
    UPLOAD = "upload", "Upload"
    LIBRARY = "library", "Library"


class ContentType(models.TextChoices):
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"
    REEL = "reel", "Reel"
    SHORT = "short", "Short"
    STORY = "story", "Story"
    TEXT = "text", "Text post"
    THUMBNAIL = "thumbnail", "Thumbnail"
    CREATIVE = "creative", "Promotional creative"


class ContentStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    IN_REVIEW = "in_review", "In review"
    CHANGES_REQUESTED = "changes_requested", "Changes requested"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    READY_TO_SCHEDULE = "ready_to_schedule", "Ready to schedule"
    SCHEDULED = "scheduled", "Scheduled"
    PUBLISHED = "published", "Published"
    FAILED = "failed", "Failed"
    ARCHIVED = "archived", "Archived"


class ApprovalAction(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    CHANGES_REQUESTED = "changes_requested", "Changes requested"
    SCHEDULED = "scheduled", "Scheduled"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class CampaignStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING_APPROVAL = "pending_approval", "Pending approval"
    SCHEDULED = "scheduled", "Scheduled"
    ACTIVE = "active", "Active"
    PAUSED = "paused", "Paused"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class CampaignType(models.TextChoices):
    PRODUCT_LAUNCH = "product_launch", "Product launch"
    PRODUCT_PROMOTION = "product_promotion", "Product promotion"
    SEASONAL = "seasonal", "Seasonal promotion"
    DISCOUNT = "discount", "Discount campaign"
    BRAND_AWARENESS = "brand_awareness", "Brand awareness"
    VIDEO_PROMOTION = "video_promotion", "Video promotion"
    INFLUENCER = "influencer", "Influencer / Creator"
    ORGANIC = "organic", "Organic social"
    PAID_ADVERTISING = "paid_advertising", "Paid advertising"


class CampaignObjective(models.TextChoices):
    AWARENESS = "awareness", "Awareness"
    ENGAGEMENT = "engagement", "Engagement"
    TRAFFIC = "traffic", "Traffic"
    CONVERSIONS = "conversions", "Conversions"
    SALES = "sales", "Sales"


class CampaignAlertType(models.TextChoices):
    STARTING_SOON = "starting_soon", "Starting soon"
    ENDING_SOON = "ending_soon", "Ending soon"
    BUDGET_WARNING = "budget_warning", "Budget warning"
    INTEGRATION_FAILURE = "integration_failure", "Integration failure"
    STOCK_OUT = "stock_out", "Stock out"
    MISSING_TRACKING = "missing_tracking", "Missing tracking"
    SYNC_FAILURE = "sync_failure", "Sync failure"


class AlertSeverity(models.TextChoices):
    INFO = "info", "Info"
    WARNING = "warning", "Warning"
    ERROR = "error", "Error"


class AttributionStatus(models.TextChoices):
    COMPLETE = "complete", "Complete"
    PARTIAL = "partial", "Partial"
    UNAVAILABLE = "unavailable", "Unavailable"


class PublishStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING_APPROVAL = "pending_approval", "Pending approval"
    APPROVED = "approved", "Approved"
    SCHEDULED = "scheduled", "Scheduled"
    QUEUED = "queued", "Queued"
    PUBLISHING = "publishing", "Publishing"
    PUBLISHED = "published", "Published"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"


class InteractionType(models.TextChoices):
    DM = "dm", "Direct message"
    COMMENT = "comment", "Comment"
    MENTION = "mention", "Mention"


class ConversationStatus(models.TextChoices):
    UNREAD = "unread", "Unread"
    READ = "read", "Read"
    PENDING = "pending", "Pending"
    RESOLVED = "resolved", "Resolved"
    ARCHIVED = "archived", "Archived"


class MessageDirection(models.TextChoices):
    INBOUND = "inbound", "Inbound"
    OUTBOUND = "outbound", "Outbound"
    NOTE = "note", "Internal note"


class Sentiment(models.TextChoices):
    POSITIVE = "positive", "Positive"
    NEUTRAL = "neutral", "Neutral"
    NEGATIVE = "negative", "Negative"


class AttributionEventType(models.TextChoices):
    VISIT = "visit", "Website visit"
    PRODUCT_VIEW = "product_view", "Product page view"
    ADD_TO_CART = "add_to_cart", "Add to cart"
    CHECKOUT = "checkout", "Checkout start"
    ORDER = "order", "Completed order"


class ActivityKind(models.TextChoices):
    PUBLISHED = "published", "Published"
    SCHEDULED = "scheduled", "Scheduled"
    MESSAGE = "message", "Message"
    CAMPAIGN = "campaign", "Campaign"
    FAILED = "failed", "Failed"
    ACCOUNT = "account", "Account"


class NotificationType(models.TextChoices):
    POST_PUBLISHED = "post_published", "Post published"
    POST_FAILED = "post_failed", "Post failed"
    TOKEN_EXPIRING = "token_expiring", "Token expiring"
    TOKEN_EXPIRED = "token_expired", "Token expired"
    APPROVAL_NEEDED = "approval_needed", "Approval needed"
    APPROVAL_GIVEN = "approval_given", "Approval given"
    NEW_COMMENT = "new_comment", "New comment"
    NEW_DM = "new_dm", "New direct message"
    NEW_MENTION = "new_mention", "New mention"
    REPORT_READY = "report_ready", "Report ready"


class TeamRole(models.TextChoices):
    OWNER = "owner", "Owner"
    ADMIN = "admin", "Admin"
    EDITOR = "editor", "Editor"
    APPROVER = "approver", "Approver"
    VIEWER = "viewer", "Viewer"


class QueueSlotKind(models.TextChoices):
    STANDARD = "standard", "Standard"
    EVERGREEN = "evergreen", "Evergreen"


class ReportFormat(models.TextChoices):
    PDF = "pdf", "PDF"
    CSV = "csv", "CSV"
    PNG = "png", "PNG"


class SocialAnalyticsConfig(models.Model):
    attribution_model = models.CharField(max_length=64, default="last_social_touch")
    reporting_window_days = models.PositiveSmallIntegerField(default=30)
    currency = models.CharField(max_length=8, default="KES")
    default_timezone = models.CharField(max_length=64, default="Africa/Nairobi")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Social analytics configuration"
        verbose_name_plural = "Social analytics configurations"

    def __str__(self):
        return f"{self.attribution_model} ({self.reporting_window_days}d, {self.currency})"


class SocialMetaAuthorization(models.Model):
    meta_user_id = models.CharField(max_length=128, db_index=True)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_meta_authorizations",
    )
    user_access_token = EncryptedTextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    scopes = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["meta_user_id", "initiated_by"]),
        ]

    def __str__(self):
        return f"MetaUser {self.meta_user_id or self.pk}"


class SocialAccount(models.Model):
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    status = models.CharField(
        max_length=32,
        choices=AccountConnectionStatus.choices,
        default=AccountConnectionStatus.NOT_CONNECTED,
        db_index=True,
    )
    display_name = models.CharField(max_length=255, blank=True)
    username = models.CharField(max_length=128, blank=True)
    profile_image_url = models.URLField(max_length=2000, blank=True)
    account_type = models.CharField(max_length=64, blank=True)
    account_id = models.CharField(max_length=128, blank=True, db_index=True)
    label = models.CharField(max_length=128, blank=True)
    followers = models.PositiveBigIntegerField(null=True, blank=True)

    access_token = EncryptedTextField(blank=True)
    refresh_token = EncryptedTextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    last_auth_check_at = models.DateTimeField(null=True, blank=True)

    scopes = models.JSONField(default=list, blank=True)
    missing_scopes = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    meta_authorization = models.ForeignKey(
        SocialMetaAuthorization,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_accounts",
    )

    is_default_publishing = models.BooleanField(default=False)
    enabled_for_distribution = models.BooleanField(default=True)
    publishing_formats = models.JSONField(default=list, blank=True)
    publishing_restrictions = models.JSONField(default=list, blank=True)

    supports_dm = models.BooleanField(default=False)
    supports_comments = models.BooleanField(default=True)
    supports_mentions = models.BooleanField(default=False)
    supports_reply = models.BooleanField(default=True)
    supports_react = models.BooleanField(default=False)
    supports_hide = models.BooleanField(default=False)
    supports_moderation = models.BooleanField(default=False)
    inbox_capability_note = models.TextField(blank=True)

    sync_status = models.CharField(
        max_length=16,
        choices=AccountSyncStatus.choices,
        default=AccountSyncStatus.NEVER,
    )
    coverage_start = models.DateField(null=True, blank=True)
    coverage_end = models.DateField(null=True, blank=True)
    missing_metrics = models.JSONField(default=list, blank=True)

    connected_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_failed_sync_at = models.DateTimeField(null=True, blank=True)
    next_sync_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["platform", "-is_default_publishing", "display_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["platform", "account_id"],
                condition=~models.Q(account_id=""),
                name="uniq_social_account_platform_account_id",
            ),
        ]
        indexes = [
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.get_platform_display()} — {self.username or self.display_name or self.account_id or 'unlinked'}"

    @property
    def is_connected(self) -> bool:
        return self.status == AccountConnectionStatus.CONNECTED

    @property
    def can_publish(self) -> bool:
        return self.status == AccountConnectionStatus.CONNECTED and self.enabled_for_distribution

    @property
    def is_token_expired(self) -> bool:
        return bool(self.token_expires_at and self.token_expires_at <= timezone.now())

    @property
    def is_token_expiring_soon(self) -> bool:
        if not self.token_expires_at:
            return False
        return self.token_expires_at <= timezone.now() + timedelta(days=3)


class SocialOAuthState(models.Model):
    state = models.CharField(max_length=128, unique=True)
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices)
    reauthorize_account = models.ForeignKey(
        SocialAccount,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="oauth_states",
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_oauth_states",
    )
    redirect_uri = models.URLField(blank=True)
    code_verifier = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.platform} OAuth state ({self.state[:8]})"


class SocialOAuthSelection(models.Model):
    token = models.CharField(max_length=128, unique=True)
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices)
    meta_authorization = models.ForeignKey(
        SocialMetaAuthorization,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="oauth_selections",
    )
    reauthorize_account = models.ForeignKey(
        SocialAccount,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="oauth_selections",
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_oauth_selections",
    )
    candidates = models.JSONField(default=list, blank=True)
    encrypted_tokens = EncryptedTextField(blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class SocialAccountSyncLog(models.Model):
    account = models.ForeignKey(
        SocialAccount,
        on_delete=models.CASCADE,
        related_name="sync_logs",
    )
    status = models.CharField(max_length=16, choices=SyncLogStatus.choices)
    message = models.TextField(blank=True)
    missing_metrics = models.JSONField(default=list, blank=True)
    coverage_start = models.DateField(null=True, blank=True)
    coverage_end = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.account} · {self.status} @ {self.created_at}"


class SocialAccountShare(models.Model):
    account = models.ForeignKey(
        SocialAccount,
        on_delete=models.CASCADE,
        related_name="shares",
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="social_account_shares",
    )
    permissions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("account", "staff")]
        ordering = ["account", "staff"]

    def __str__(self):
        return f"{self.staff} -> {self.account}"


class SocialContentCategory(models.Model):
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SocialMediaFolder(models.Model):
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=128, unique=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SocialMedia(models.Model):
    folder = models.ForeignKey(
        SocialMediaFolder,
        null=True,
        blank=True,
        related_name="assets",
        on_delete=models.SET_NULL,
    )
    kind = models.CharField(max_length=8, choices=MediaKind.choices, default=MediaKind.IMAGE)
    file = models.FileField(upload_to="social/%Y/%m/", blank=True)
    url = models.URLField(blank=True)
    thumbnail = models.ImageField(upload_to="social/thumbs/%Y/%m/", blank=True)
    thumbnail_url = models.URLField(blank=True)
    name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=128, blank=True)
    tags = models.JSONField(default=list, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    size_bytes = models.PositiveBigIntegerField(null=True, blank=True)
    source = models.CharField(max_length=16, choices=MediaSource.choices, default=MediaSource.UPLOAD)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "id"]
        indexes = [
            models.Index(fields=["kind"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return self.name or f"media #{self.pk}"

    def save(self, *args, **kwargs):
        if self.file and not self.name:
            self.name = self.file.name.rsplit("/", 1)[-1]
        if self.file and not self.size_bytes:
            try:
                self.size_bytes = self.file.size
            except (OSError, ValueError):
                pass
        super().save(*args, **kwargs)


class SocialCampaign(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    objective = models.CharField(
        max_length=24,
        choices=CampaignObjective.choices,
        default=CampaignObjective.AWARENESS,
    )
    type = models.CharField(
        max_length=32,
        choices=CampaignType.choices,
        default=CampaignType.PRODUCT_PROMOTION,
        db_index=True,
    )
    status = models.CharField(
        max_length=24,
        choices=CampaignStatus.choices,
        default=CampaignStatus.DRAFT,
        db_index=True,
    )
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_campaigns",
    )
    internal_notes = models.TextField(blank=True)

    platforms = models.JSONField(default=list, blank=True)
    accounts = models.ManyToManyField(
        SocialAccount,
        blank=True,
        related_name="campaigns",
    )

    discount_id = models.CharField(max_length=64, blank=True, db_index=True)
    promotional_message = models.TextField(blank=True)
    promotional_url = models.URLField(blank=True)
    offer_start = models.DateField(null=True, blank=True)
    offer_end = models.DateField(null=True, blank=True)

    planned_budget = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    actual_spend = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    attributed_revenue = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    advertising_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    creator_commission = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="KES")
    roas = models.FloatField(null=True, blank=True)
    profitability = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    profitability_valid = models.BooleanField(default=False)

    advertising_platform = models.CharField(
        max_length=16,
        choices=SocialPlatform.choices,
        blank=True,
    )
    advertising_account = models.CharField(max_length=255, blank=True)
    advertising_external_id = models.CharField(max_length=255, blank=True)
    advertising_metrics_available = models.BooleanField(default=False)
    advertising_note = models.TextField(blank=True)

    utm_source = models.CharField(max_length=128, blank=True)
    utm_medium = models.CharField(max_length=128, blank=True)
    utm_campaign = models.CharField(max_length=128, blank=True)
    tracking_link = models.URLField(blank=True)
    conversion_attribution = models.CharField(
        max_length=16,
        choices=AttributionStatus.choices,
        default=AttributionStatus.UNAVAILABLE,
    )

    reach = models.PositiveBigIntegerField(null=True, blank=True)
    impressions = models.PositiveBigIntegerField(null=True, blank=True)
    views = models.PositiveBigIntegerField(null=True, blank=True)
    engagement = models.PositiveBigIntegerField(null=True, blank=True)
    link_clicks = models.PositiveBigIntegerField(null=True, blank=True)
    website_visits = models.PositiveBigIntegerField(null=True, blank=True)
    add_to_cart = models.PositiveBigIntegerField(null=True, blank=True)
    orders = models.PositiveBigIntegerField(null=True, blank=True)
    attributed_orders = models.PositiveBigIntegerField(null=True, blank=True)
    unattributed_orders = models.PositiveBigIntegerField(null=True, blank=True)
    organic_metrics = models.JSONField(default=dict, blank=True)
    paid_metrics = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "start_date", "end_date"]),
            models.Index(fields=["type", "status"]),
        ]

    def __str__(self):
        return f"{self.name} [{self.status}]"


class SocialContent(models.Model):
    title = models.CharField(max_length=255, blank=True)
    caption = models.TextField(blank=True)
    description = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    content_type = models.CharField(
        max_length=16,
        choices=ContentType.choices,
        default=ContentType.IMAGE,
        db_index=True,
    )
    category = models.ForeignKey(
        SocialContentCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contents",
    )
    campaign = models.ForeignKey(
        SocialCampaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contents",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_contents_owned",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_contents_reviewed",
    )
    media = models.ManyToManyField(
        SocialMedia,
        through="SocialContentMedia",
        blank=True,
        related_name="contents",
    )
    platforms = models.JSONField(default=list, blank=True)
    platform_configs = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=24,
        choices=ContentStatus.choices,
        default=ContentStatus.DRAFT,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["status", "-updated_at"]),
            models.Index(fields=["content_type"]),
        ]

    def __str__(self):
        return self.title or f"Content #{self.pk}"


class SocialContentMedia(models.Model):
    content = models.ForeignKey(
        SocialContent,
        on_delete=models.CASCADE,
        related_name="content_media_links",
    )
    media = models.ForeignKey(
        SocialMedia,
        on_delete=models.CASCADE,
        related_name="media_content_links",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("content", "media")]
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"Content #{self.content_id} -> Media #{self.media_id}"


class SocialContentProduct(models.Model):
    content = models.ForeignKey(
        SocialContent,
        on_delete=models.CASCADE,
        related_name="linked_products",
    )
    product_id = models.CharField(max_length=64, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("content", "product_id")]
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"Content #{self.content_id} -> Product {self.product_id}"


class SocialContentApprovalLog(models.Model):
    content = models.ForeignKey(
        SocialContent,
        on_delete=models.CASCADE,
        related_name="approval_history",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_content_approval_logs",
    )
    action = models.CharField(max_length=24, choices=ApprovalAction.choices)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Content #{self.content_id} · {self.action}"


class SocialCampaignProduct(models.Model):
    campaign = models.ForeignKey(
        SocialCampaign,
        on_delete=models.CASCADE,
        related_name="campaign_products",
    )
    product_id = models.CharField(max_length=64, db_index=True)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    orders = models.PositiveIntegerField(null=True, blank=True)
    units_sold = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("campaign", "product_id")]
        ordering = ["id"]

    def __str__(self):
        return f"Campaign #{self.campaign_id} -> Product {self.product_id}"


class SocialCampaignContent(models.Model):
    campaign = models.ForeignKey(
        SocialCampaign,
        on_delete=models.CASCADE,
        related_name="campaign_contents",
    )
    content = models.ForeignKey(
        SocialContent,
        on_delete=models.CASCADE,
        related_name="campaign_links",
    )
    publication_status = models.CharField(max_length=32, blank=True)
    reach = models.PositiveBigIntegerField(null=True, blank=True)
    impressions = models.PositiveBigIntegerField(null=True, blank=True)
    views = models.PositiveBigIntegerField(null=True, blank=True)
    engagement = models.PositiveBigIntegerField(null=True, blank=True)
    clicks = models.PositiveBigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("campaign", "content")]
        ordering = ["id"]

    def __str__(self):
        return f"Campaign #{self.campaign_id} -> Content #{self.content_id}"


class SocialCampaignAlert(models.Model):
    campaign = models.ForeignKey(
        SocialCampaign,
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    type = models.CharField(max_length=32, choices=CampaignAlertType.choices)
    message = models.TextField()
    severity = models.CharField(max_length=16, choices=AlertSeverity.choices, default=AlertSeverity.WARNING)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["campaign", "is_resolved"]),
        ]

    def __str__(self):
        return f"{self.campaign} · {self.type} [{self.severity}]"


class SocialScheduledPost(models.Model):
    content = models.ForeignKey(
        SocialContent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="scheduled_posts",
    )
    content_title = models.CharField(max_length=255, blank=True)
    thumbnail_url = models.URLField(blank=True)
    caption = models.TextField(blank=True)
    content_type = models.CharField(max_length=16, choices=ContentType.choices, blank=True)

    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    account = models.ForeignKey(
        SocialAccount,
        on_delete=models.CASCADE,
        related_name="scheduled_posts",
    )
    campaign = models.ForeignKey(
        SocialCampaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="scheduled_posts",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_scheduled_posts_owned",
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_scheduled_posts_approved",
    )

    scheduled_at = models.DateTimeField(db_index=True)
    timezone = models.CharField(max_length=64, default="Africa/Nairobi")
    status = models.CharField(
        max_length=24,
        choices=PublishStatus.choices,
        default=PublishStatus.SCHEDULED,
        db_index=True,
    )
    is_manual_reminder = models.BooleanField(default=False)

    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    published_url = models.URLField(blank=True)
    published_post_id = models.CharField(max_length=255, blank=True, db_index=True)
    attempt_at = models.DateTimeField(null=True, blank=True)
    platform_response = models.TextField(blank=True)
    failure_reason = models.TextField(blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)

    likes = models.PositiveIntegerField(null=True, blank=True)
    comments = models.PositiveIntegerField(null=True, blank=True)
    shares = models.PositiveIntegerField(null=True, blank=True)
    saves = models.PositiveIntegerField(null=True, blank=True)
    reach = models.PositiveBigIntegerField(null=True, blank=True)
    impressions = models.PositiveBigIntegerField(null=True, blank=True)
    views = models.PositiveBigIntegerField(null=True, blank=True)
    watch_time_sec = models.PositiveBigIntegerField(null=True, blank=True)
    link_clicks = models.PositiveBigIntegerField(null=True, blank=True)
    profile_visits = models.PositiveBigIntegerField(null=True, blank=True)
    follower_delta = models.IntegerField(null=True, blank=True)
    attributed_orders = models.PositiveIntegerField(null=True, blank=True)
    attributed_revenue = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    metrics_synced_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at"]
        indexes = [
            models.Index(fields=["status", "scheduled_at"]),
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["account", "scheduled_at"]),
            models.Index(fields=["-published_at"]),
        ]

    def __str__(self):
        return f"{self.platform} · {self.content_title or self.pk} [{self.status}]"

    @property
    def total_engagement(self) -> int | None:
        vals = [v for v in (self.likes, self.comments, self.shares, self.saves) if v is not None]
        if not vals:
            return None
        return sum(vals)

    @property
    def engagement_rate(self) -> float | None:
        eng = self.total_engagement
        denom = self.reach or self.impressions or self.views
        if eng is None or not denom:
            return None
        return round((eng / denom) * 100, 2)


class SocialScheduledPostHistory(models.Model):
    scheduled_post = models.ForeignKey(
        SocialScheduledPost,
        on_delete=models.CASCADE,
        related_name="history",
    )
    status = models.CharField(max_length=24, choices=PublishStatus.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_scheduled_post_history",
    )
    message = models.TextField(blank=True)
    published_url = models.URLField(blank=True)
    is_retry = models.BooleanField(default=False)
    retry_success = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["scheduled_post", "-created_at"]),
        ]

    def __str__(self):
        return f"Post #{self.scheduled_post_id} · {self.status}"


class SocialQueueSlot(models.Model):
    name = models.CharField(max_length=128)
    kind = models.CharField(max_length=16, choices=QueueSlotKind.choices, default=QueueSlotKind.STANDARD)
    days = models.JSONField(default=list, blank=True)
    time_of_day = models.TimeField()
    timezone = models.CharField(max_length=64, default="Africa/Nairobi")
    platforms = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["time_of_day"]

    def __str__(self):
        return f"{self.name} @ {self.time_of_day}"


class SocialEvergreenPost(models.Model):
    content = models.ForeignKey(
        SocialContent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evergreen_entries",
    )
    caption = models.TextField()
    platforms = models.JSONField(default=list, blank=True)
    product_id = models.CharField(max_length=64, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    use_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_used_at", "created_at"]

    def __str__(self):
        return f"Evergreen #{self.pk}"


class SocialInboxConversation(models.Model):
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    account = models.ForeignKey(
        SocialAccount,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inbox_conversations",
    )
    scheduled_post = models.ForeignKey(
        SocialScheduledPost,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inbox_conversations",
    )
    type = models.CharField(max_length=16, choices=InteractionType.choices, db_index=True)
    status = models.CharField(
        max_length=16,
        choices=ConversationStatus.choices,
        default=ConversationStatus.UNREAD,
        db_index=True,
    )
    sentiment = models.CharField(
        max_length=16,
        choices=Sentiment.choices,
        default=Sentiment.NEUTRAL,
    )

    platform_conversation_id = models.CharField(max_length=255, blank=True, db_index=True)
    parent_item_id = models.CharField(max_length=255, blank=True)

    customer_display_name = models.CharField(max_length=255, blank=True)
    customer_username = models.CharField(max_length=255, blank=True)
    customer_avatar_url = models.URLField(blank=True)
    preview = models.TextField(blank=True)

    related_post_title = models.CharField(max_length=255, blank=True)
    related_post_url = models.URLField(blank=True)
    related_post_thumbnail = models.URLField(blank=True)

    last_interaction_at = models.DateTimeField(db_index=True)
    unread = models.BooleanField(default=True, db_index=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_inbox_assigned",
    )

    linked_customer_id = models.CharField(max_length=64, blank=True, db_index=True)
    linked_product_id = models.CharField(max_length=64, blank=True, db_index=True)

    can_reply = models.BooleanField(default=True)
    can_react = models.BooleanField(default=False)
    can_hide = models.BooleanField(default=False)
    can_moderate = models.BooleanField(default=False)
    can_archive = models.BooleanField(default=True)
    can_assign = models.BooleanField(default=True)
    is_hidden = models.BooleanField(default=False)
    is_moderated = models.BooleanField(default=False)
    platform_capability_note = models.TextField(blank=True)

    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_interaction_at"]
        indexes = [
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["type", "status"]),
            models.Index(fields=["unread", "-last_interaction_at"]),
            models.Index(fields=["assigned_to", "status"]),
        ]

    def __str__(self):
        return f"{self.platform} · {self.type} · {self.customer_display_name or self.customer_username or self.pk}"


class SocialInboxMessage(models.Model):
    conversation = models.ForeignKey(
        SocialInboxConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    direction = models.CharField(max_length=16, choices=MessageDirection.choices)
    body = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_inbox_messages",
    )
    author_name = models.CharField(max_length=255, blank=True)
    platform_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    can_reply = models.BooleanField(default=True)
    reaction = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"{self.direction} on conversation #{self.conversation_id}"


class SocialInboxTemplate(models.Model):
    key = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=128)
    body = models.TextField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_inbox_templates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["label"]

    def __str__(self):
        return self.label


class SocialLink(models.Model):
    short_code = models.CharField(max_length=32, unique=True)
    destination = models.URLField()
    utm = models.JSONField(default=dict, blank=True)
    campaign = models.ForeignKey(
        SocialCampaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="links",
    )
    content = models.ForeignKey(
        SocialContent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="links",
    )
    clicks = models.PositiveBigIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_links",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.short_code} -> {self.destination}"


class SocialAttributionEvent(models.Model):
    event_type = models.CharField(max_length=24, choices=AttributionEventType.choices, db_index=True)
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, blank=True, db_index=True)
    account = models.ForeignKey(
        SocialAccount,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_events",
    )
    campaign = models.ForeignKey(
        SocialCampaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_events",
    )
    content = models.ForeignKey(
        SocialContent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_events",
    )
    scheduled_post = models.ForeignKey(
        SocialScheduledPost,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_events",
    )
    session_id = models.CharField(max_length=128, blank=True, db_index=True)
    product_id = models.CharField(max_length=64, blank=True, db_index=True)
    order_id = models.CharField(max_length=64, blank=True, db_index=True)
    units = models.PositiveIntegerField(default=1)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="KES")

    utm_source = models.CharField(max_length=128, blank=True, db_index=True)
    utm_medium = models.CharField(max_length=128, blank=True)
    utm_campaign = models.CharField(max_length=128, blank=True, db_index=True)

    is_assisted = models.BooleanField(default=False)
    is_direct = models.BooleanField(default=False)
    is_verified_paid = models.BooleanField(default=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["event_type", "occurred_at"]),
            models.Index(fields=["platform", "event_type", "occurred_at"]),
            models.Index(fields=["campaign", "event_type"]),
            models.Index(fields=["product_id", "event_type"]),
        ]

    def __str__(self):
        return f"{self.event_type} ({self.platform or 'direct'}) @ {self.occurred_at}"


class SocialPlatformDailyMetric(models.Model):
    account = models.ForeignKey(
        SocialAccount,
        on_delete=models.CASCADE,
        related_name="daily_metrics",
    )
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    date = models.DateField(db_index=True)

    followers = models.PositiveBigIntegerField(null=True, blank=True)
    follower_growth = models.IntegerField(null=True, blank=True)
    reach = models.PositiveBigIntegerField(null=True, blank=True)
    impressions = models.PositiveBigIntegerField(null=True, blank=True)
    views = models.PositiveBigIntegerField(null=True, blank=True)
    engagement = models.PositiveBigIntegerField(null=True, blank=True)
    engagement_rate = models.FloatField(null=True, blank=True)
    link_clicks = models.PositiveBigIntegerField(null=True, blank=True)
    profile_visits = models.PositiveBigIntegerField(null=True, blank=True)
    published_content = models.PositiveIntegerField(null=True, blank=True)
    unavailable_metrics = models.JSONField(default=list, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("account", "date")]
        ordering = ["date"]
        indexes = [
            models.Index(fields=["platform", "date"]),
        ]

    def __str__(self):
        return f"{self.platform} · {self.date}"

    def save(self, *args, **kwargs):
        if self.account_id and not self.platform:
            self.platform = self.account.platform
        super().save(*args, **kwargs)


class SocialFollowerSnapshot(models.Model):
    account = models.ForeignKey(
        SocialAccount,
        on_delete=models.CASCADE,
        related_name="follower_snapshots",
    )
    platform = models.CharField(
        max_length=16,
        choices=SocialPlatform.choices,
        blank=True,
        db_index=True,
    )
    date = models.DateField()
    followers = models.PositiveBigIntegerField()

    class Meta:
        unique_together = [("account", "date")]
        ordering = ["date"]
        indexes = [
            models.Index(fields=["platform", "date"]),
        ]

    def __str__(self):
        return f"{self.platform} · {self.date} · {self.followers}"

    def save(self, *args, **kwargs):
        if self.account_id and not self.platform:
            self.platform = self.account.platform
        super().save(*args, **kwargs)


class SocialEngagementSnapshot(models.Model):
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, unique=True)
    reach = models.PositiveBigIntegerField(default=0)
    engagement = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["platform"]

    def __str__(self):
        return f"{self.platform} · reach={self.reach} · engagement={self.engagement}"

    @property
    def engagement_rate(self) -> float:
        if self.reach <= 0:
            return 0.0
        return round((self.engagement / self.reach) * 100, 2)


class SocialDemographicSnapshot(models.Model):
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    date = models.DateField()
    age_buckets = models.JSONField(default=dict, blank=True)
    gender = models.JSONField(default=dict, blank=True)
    top_cities = models.JSONField(default=list, blank=True)
    top_countries = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("platform", "date")]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.platform} · {self.date} demographics"


class SocialBestTimePost(models.Model):
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, db_index=True)
    day_of_week = models.PositiveSmallIntegerField()
    hour = models.PositiveSmallIntegerField()
    score = models.FloatField(default=0)
    sample_size = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("platform", "day_of_week", "hour")]
        ordering = ["platform", "day_of_week", "hour"]

    def __str__(self):
        return f"{self.platform} · day {self.day_of_week} · {self.hour}:00 · {self.score}"


class SocialNotification(models.Model):
    notification_type = models.CharField(max_length=32, choices=NotificationType.choices)
    severity = models.CharField(max_length=16, choices=AlertSeverity.choices, default=AlertSeverity.INFO)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=512, blank=True)
    action_label = models.CharField(max_length=64, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    is_resolved = models.BooleanField(default=False, db_index=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="social_notifications",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_read", "is_resolved", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_notification_type_display()} — {self.title}"


class SocialActivityLog(models.Model):
    kind = models.CharField(max_length=16, choices=ActivityKind.choices, db_index=True)
    title = models.CharField(max_length=255)
    platform = models.CharField(max_length=16, choices=SocialPlatform.choices, blank=True)
    href = models.CharField(max_length=512, blank=True)
    status = models.CharField(max_length=32, blank=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-occurred_at"]

    def __str__(self):
        return f"{self.kind} · {self.title}"


class SocialAuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_audit_logs",
    )
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} @ {self.created_at}"


class SocialTeamMember(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="social_team_profile",
    )
    role = models.CharField(max_length=16, choices=TeamRole.choices, default=TeamRole.EDITOR)
    is_active = models.BooleanField(default=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_team_invites_sent",
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["role", "id"]

    def __str__(self):
        return f"{self.user} · {self.get_role_display()}"


class SocialReport(models.Model):
    report_type = models.CharField(max_length=64, blank=True, db_index=True)
    name = models.CharField(max_length=255)
    date_from = models.DateField()
    date_to = models.DateField()
    platforms = models.JSONField(default=list, blank=True)
    metrics = models.JSONField(default=list, blank=True)
    branding = models.JSONField(default=dict, blank=True)
    format = models.CharField(max_length=8, choices=ReportFormat.choices, default=ReportFormat.CSV)
    file = models.FileField(upload_to="social/reports/%Y/%m/", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="social_reports",
    )
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name