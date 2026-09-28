# apps/onboarding/models.py

import uuid

from django.conf import settings
from django.db import models

from .constants import OnboardingStatus, STEP_ORDER


def _step_choices():
    return [(s, s) for s in STEP_ORDER]


class OnboardingSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="onboarding_session",
    )
    status = models.CharField(
        max_length=20,
        choices=OnboardingStatus.choices,
        default=OnboardingStatus.NOT_STARTED,
    )
    current_step = models.CharField(
        max_length=16,
        choices=_step_choices(),
        default="step1",
    )
    completion_percent = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "onboarding_onboardingsession"
        ordering = ["-started_at"]

    def __str__(self):
        return f"Onboarding<{self.user_id}> [{self.status}]"


class OnboardingStepData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        OnboardingSession,
        on_delete=models.CASCADE,
        related_name="step_data",
    )
    step = models.CharField(max_length=16, choices=_step_choices())
    data = models.JSONField(default=dict, blank=True)
    is_complete = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "onboarding_onboardingstepdata"
        unique_together = [("session", "step")]
        ordering = ["session", "step"]
        indexes = [models.Index(fields=["session", "step"])]

    def __str__(self):
        return f"{self.session_id}::{self.step}"