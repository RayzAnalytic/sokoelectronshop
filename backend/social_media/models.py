# social_media/models.py

import uuid

from django.conf import settings
from django.db import models


class SocialAccount(models.Model):
    class Platform(models.TextChoices):
        YOUTUBE = "YOUTUBE", "YouTube"
        FACEBOOK = "FACEBOOK", "Facebook"
        INSTAGRAM = "INSTAGRAM", "Instagram"
        X = "X", "X (Twitter)"
        TIKTOK_SHOP = "TIKTOK_SHOP", "TikTok Shop"   # 👈 ADDED

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="social_accounts",
    )
    platform = models.CharField(max_length=20, choices=Platform.choices)
    platform_user_id = models.CharField(max_length=255, blank=True, db_index=True)
    username = models.CharField(max_length=255, blank=True)

    # OAuth tokens
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)

    # TikTok Shop specific — cipher that identifies the authorized shop
    shop_cipher = models.CharField(max_length=255, blank=True)   # 👈 ADDED

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "social_accounts"
        unique_together = [("user", "platform", "platform_user_id")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} — {self.platform}"
