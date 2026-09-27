# onboarding/models.py

import uuid

from django.conf import settings
from django.db import models


class OnboardingProgress(models.Model):
    """
    Tracks a single user's progress through the 12-step onboarding flow.
    One row per user.
    """

    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not started"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        SUBMITTED = "SUBMITTED", "Submitted for review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="onboarding",
    )

    # ── Progress tracking ──
    current_step = models.PositiveSmallIntegerField(default=1)
    completed_steps = models.JSONField(default=list, blank=True)
    step_data = models.JSONField(default=dict, blank=True)

    # ── Lifecycle ──
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED,
        db_index=True,
    )

    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "onboarding_progress"
        verbose_name = "Onboarding progress"
        verbose_name_plural = "Onboarding progress"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.user.email} — step {self.current_step} ({self.status})"

    # ── Convenience properties ──
    @property
    def completed_count(self):
        """Number of completed steps."""
        return len(self.completed_steps or [])

    @property
    def is_complete(self):
        """True when all 12 steps are marked complete."""
        return self.completed_count >= 12

    @property
    def percent_complete(self):
        """Integer percentage 0–100."""
        return round((self.completed_count / 12) * 100)