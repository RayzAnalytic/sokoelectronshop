# team/models.py

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class TeamInvite(models.Model):
    """
    A pending, accepted, expired, or revoked invitation for a team
    member to join a store.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        MANAGER = "manager", "Manager"
        ORDERS = "orders", "Order Processor"
        CONTENT = "content", "Content Editor"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # The store owner who is inviting
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_invites",
    )

    email = models.EmailField(db_index=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    # The user who accepted (nullable until accepted)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accepted_invites",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)

    # Token for the invite link
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "team_invites"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["email", "status"]),
        ]
        constraints = [
            # Only one *pending* invite per (owner, email) at a time.
            # Historical invites (accepted / expired / revoked) are kept.
            models.UniqueConstraint(
                fields=["owner", "email"],
                condition=models.Q(status="pending"),
                name="unique_pending_invite_per_email",
            ),
        ]

    def __str__(self):
        return f"{self.email} → {self.role} ({self.status})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at