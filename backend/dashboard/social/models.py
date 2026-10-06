"""
Social media hub models.

Design notes
────────────
• One `SocialAccount` per platform (unique constraint). Multi-account
  support can be added later by dropping the unique constraint and adding
  a `workspace` FK.

• `SocialPost` is the *intent* — what the composer submitted. It carries
  the caption, product tag, and either a publish time or a schedule time.

• `SocialPostTarget` is the *fan-out* — one row per platform. This is
  where metrics live, where per-platform success/failure is tracked, and
  what `PublishedPost` in the frontend maps to.

• OAuth tokens are encrypted at rest via `FIELD_ENCRYPTION_KEY` using
  `cryptography.fernet`. Never store refresh tokens in plaintext.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


# ─────────────────────────────────────────────────────────────────────────────
# Encrypted field
# ─────────────────────────────────────────────────────────────────────────────

def _fernet() -> Fernet:
    """
    Build a Fernet from settings.FIELD_ENCRYPTION_KEY.

    The key may be:
      • a valid urlsafe base64 32-byte Fernet key (preferred), or
      • an arbitrary string, which we SHA-256 and base64url-encode.
    """
    raw = getattr(settings, "FIELD_ENCRYPTION_KEY", "") or ""
    if not raw:
        raise ImproperlyConfigured(
            "FIELD_ENCRYPTION_KEY is empty — social OAuth tokens cannot be stored."
        )
    try:
        # Try as-is first
        return Fernet(raw.encode() if isinstance(raw, str) else raw)
    except (ValueError, TypeError):
        digest = hashlib.sha256(raw.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


class EncryptedTextField(models.TextField):
    """TextField that transparently Fernet-encrypts on save and decrypts on read."""

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
            # Field was stored before encryption was enabled, or the key
            # rotated. Return as-is so callers can decide what to do.
            return value

    def to_python(self, value):
        return value


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class SocialPlatform(models.TextChoices):
    FACEBOOK  = "FACEBOOK",  "Facebook"
    INSTAGRAM = "INSTAGRAM", "Instagram"
    TIKTOK    = "TIKTOK",    "TikTok"
    YOUTUBE   = "YOUTUBE",   "YouTube"
    X         = "X",         "X"


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


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class SocialAccount(models.Model):
    platform          = models.CharField(max_length=16, choices=SocialPlatform.choices, unique=True)
    handle            = models.CharField(max_length=128, blank=True)
    display_name      = models.CharField(max_length=255, blank=True)
    platform_user_id  = models.CharField(max_length=128, blank=True)

    access_token      = EncryptedTextField(blank=True)
    refresh_token     = EncryptedTextField(blank=True)
    token_expires_at  = models.DateTimeField(null=True, blank=True)

    # Platform-specific extras (page id, ig business id, youtube channel id, ...)
    metadata          = models.JSONField(default=dict, blank=True)

    is_connected      = models.BooleanField(default=False)
    connected_at      = models.DateTimeField(null=True, blank=True)
    last_error        = models.TextField(blank=True)

    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["platform"]

    def __str__(self):
        return f"{self.get_platform_display()} — {self.handle or self.platform_user_id or 'disconnected'}"


class SocialPost(models.Model):
    status         = models.CharField(max_length=16, choices=PostStatus.choices, default=PostStatus.DRAFT)
    caption        = models.TextField()
    product_tag    = models.CharField(max_length=255, blank=True)

    scheduled_for  = models.DateTimeField(null=True, blank=True, db_index=True)
    published_at   = models.DateTimeField(null=True, blank=True)

    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "scheduled_for"]),
        ]

    def __str__(self):
        return f"Post #{self.pk} [{self.status}]"


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
    metrics_synced_at = models.DateTimeField(null=True, blank=True)

    published_at      = models.DateTimeField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("post", "platform")]
        ordering = ["platform"]

    def __str__(self):
        return f"Post #{self.post_id} → {self.platform} [{self.status}]"


class SocialMedia(models.Model):
    post       = models.ForeignKey(SocialPost, related_name="media", on_delete=models.CASCADE)
    file       = models.FileField(upload_to="social/%Y/%m/")
    media_type = models.CharField(max_length=8, choices=[("IMAGE", "Image"), ("VIDEO", "Video")])
    filename   = models.CharField(max_length=255, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class SocialFollowerSnapshot(models.Model):
    """
    One row per account per day, written by `social.tasks.snapshot_followers`.
    Feeds the "Follower growth over time" line chart.
    """
    account   = models.ForeignKey(SocialAccount, related_name="followers", on_delete=models.CASCADE)
    date      = models.DateField()
    followers = models.PositiveIntegerField()

    class Meta:
        unique_together = [("account", "date")]
        ordering = ["date"]