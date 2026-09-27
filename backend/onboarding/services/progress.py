# onboarding/services/progress.py

from django.utils import timezone

from onboarding.constants import TOTAL_STEPS
from onboarding.models import OnboardingProgress


def get_or_create_progress(user):
    """
    Fetch the user's onboarding row, creating it on first access.
    Sets `started_at` on creation.
    """
    progress, created = OnboardingProgress.objects.get_or_create(
        user=user,
        defaults={
            "current_step": 1,
            "status": OnboardingProgress.Status.NOT_STARTED,
        },
    )
    if created:
        progress.started_at = timezone.now()
        progress.save(update_fields=["started_at"])
    return progress


def mark_step_complete(progress, step_number, data):
    """
    Record that a step is complete and store its data.
    Advances `current_step` to the next uncompleted step.

    Args:
        progress: OnboardingProgress instance
        step_number: int (1..12)
        data: dict — stored under step_data[str(step_number)]
    """
    completed = set(progress.completed_steps or [])
    completed.add(step_number)
    progress.completed_steps = sorted(completed)

    # Store step's data (keyed by string for JSON serialization)
    step_data = progress.step_data or {}
    step_data[str(step_number)] = data
    progress.step_data = step_data

    # Advance to the next uncompleted step, or stay on the last one
    next_step = TOTAL_STEPS
    for n in range(1, TOTAL_STEPS + 1):
        if n not in completed:
            next_step = n
            break

    progress.current_step = next_step

    # Auto-promote status from NOT_STARTED to IN_PROGRESS
    if progress.status == OnboardingProgress.Status.NOT_STARTED:
        progress.status = OnboardingProgress.Status.IN_PROGRESS

    # Auto-submit when all steps are complete
    if progress.completed_count >= TOTAL_STEPS:
        progress.status = OnboardingProgress.Status.SUBMITTED
        progress.submitted_at = timezone.now()

    progress.save()
    return progress