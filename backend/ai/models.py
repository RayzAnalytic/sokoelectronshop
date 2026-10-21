import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatSession(models.Model):
    """
    One browser conversation. Persists across page reloads if the frontend
    sends back the same session_id. Anonymous sessions have user=null.

    A session is the top-level container for all turns between a single
    user (or anonymous visitor) and the assistant. It carries lightweight
    metadata so that admins can list, search, and audit conversations
    without joining to the message table.
    """

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
        help_text="Null for anonymous visitors.",
    )

    # Optional human-friendly label, e.g. derived from the first user message.
    # Kept denormalized so the sessions list view doesn't need to join.
    title = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )

    # Free-form bag for IP, user agent, locale, experiment flags, etc.
    # Using JSONField (not a schema) so we can evolve without migrations.
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    # Soft-delete / archival flag. Lets users "clear" a conversation
    # without destroying the audit trail.
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
        """
        Bump updated_at explicitly. Useful when a turn adds a message but
        the session row wouldn't otherwise be written to.
        """
        self.updated_at = timezone.now()
        if save:
            self.save(update_fields=["updated_at"])

    @property
    def is_anonymous(self) -> bool:
        return self.user_id is None


class ChatMessage(models.Model):
    """
    Only user and final-assistant turns are persisted. Intermediate tool
    calls are ephemeral — they live only inside one `run_chat_turn()` call.

    Assistant rows may carry structured extras (product cards and quick
    reply chips) that the frontend renders directly from the API response.
    Those are stored here so that reloading a session reproduces the
    original UI instead of falling back to plain text.
    """

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

    # Structured suggestions rendered as product cards. Shape matches the
    # frontend `AIChatProduct` type:
    #   {id, name, brand, price, stock, url, images: [..]}
    products = models.JSONField(
        default=list,
        blank=True,
    )

    # Quick-reply chips shown under an assistant message.
    chips = models.JSONField(
        default=list,
        blank=True,
    )

    # Per-message telemetry: model name, token counts, latency_ms,
    # finish_reason, tool_call_count, etc. Never rendered to the customer.
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