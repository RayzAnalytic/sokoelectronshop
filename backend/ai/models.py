import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatSession(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_chat_sessions",
    )
    title = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
            models.Index(fields=["-updated_at"]),
            models.Index(fields=["is_active", "-updated_at"]),
        ]
        verbose_name = "AI chat session"
        verbose_name_plural = "AI chat sessions"

    def __str__(self):
        who = self.user_id or "anon"
        return f"ChatSession {self.id} ({who})"

    def touch(self, *, save: bool = True) -> None:
        self.updated_at = timezone.now()
        if save:
            self.save(update_fields=["updated_at"])

    @property
    def is_anonymous(self) -> bool:
        return self.user_id is None


class ChatMessage(models.Model):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_SYSTEM = "system"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ASSISTANT, "Assistant"),
        (ROLE_SYSTEM, "System"),
    ]

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
        db_index=True,
    )
    content = models.TextField(blank=True)
    products = models.JSONField(
        default=list,
        blank=True,
    )
    chips = models.JSONField(
        default=list,
        blank=True,
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "created_at"]),
            models.Index(fields=["session", "role", "created_at"]),
        ]
        verbose_name = "AI chat message"
        verbose_name_plural = "AI chat messages"

    def __str__(self):
        preview = (self.content or "").strip().replace("\n", " ")
        return f"{self.role}: {preview[:40]}"

    @property
    def is_user(self) -> bool:
        return self.role == self.ROLE_USER

    @property
    def is_assistant(self) -> bool:
        return self.role == self.ROLE_ASSISTANT