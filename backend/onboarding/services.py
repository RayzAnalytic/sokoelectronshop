# apps/onboarding/services.py

from typing import Any

from django.db import transaction
from django.utils import timezone

from .constants import STEP_ORDER, OnboardingStatus, is_optional
from .models import OnboardingSession, OnboardingStepData
from .steps.base import StepRegistry
from . import steps  # noqa: F401 — populate the registry


# ============================================================
# SESSION LOOKUP
# ============================================================

def get_or_create_session(user) -> OnboardingSession:
    session, _ = OnboardingSession.objects.get_or_create(user=user)
    return session


# ============================================================
# COMPLETION
# ============================================================

def compute_completion(session: OnboardingSession) -> dict[str, Any]:
    """
    Return completion stats:
      {
        "percent": int,               # 0..100
        "required_remaining": [step], # required steps not yet done
        "completed_steps": [step],    # sorted by STEP_ORDER
      }
    """
    completed = set(
        session.step_data.filter(is_complete=True).values_list("step", flat=True)
    )

    required_keys = [k for k in STEP_ORDER if not is_optional(k)]
    required_remaining = [k for k in required_keys if k not in completed]

    total = len(STEP_ORDER)
    percent = int(round((len(completed) / total) * 100)) if total else 0

    return {
        "percent": percent,
        "required_remaining": required_remaining,
        "completed_steps": sorted(
            completed,
            key=lambda k: STEP_ORDER.index(k) if k in STEP_ORDER else 999,
        ),
    }


# ============================================================
# STEP APPLICATION
# ============================================================

@transaction.atomic
def apply_step(session: OnboardingSession, step_key: str, payload: dict) -> dict:
    """
    Validate + persist one step's payload.

    Payload may be a dict (JSON) or QueryDict (multipart) — both support
    .get(), so the step's validate()/apply() can read fields uniformly.
    """
    if step_key not in STEP_ORDER:
        raise KeyError(f"Unknown step '{step_key}'")

    step = StepRegistry.get(step_key)
    step.validate(session, payload)
    stored = step.apply(session, payload)

    row, created = OnboardingStepData.objects.update_or_create(
        session=session,
        step=step_key,
        defaults={"data": stored, "is_complete": True},
    )
    if created or not row.completed_at:
        row.completed_at = timezone.now()
        row.save(update_fields=["completed_at"])

    _advance_cursor(session)
    stats = compute_completion(session)

    session.completion_percent = stats["percent"]
    if session.status == OnboardingStatus.NOT_STARTED:
        session.status = OnboardingStatus.IN_PROGRESS
    session.save(update_fields=[
        "current_step",
        "completion_percent",
        "status",
        "updated_at",
    ])

    return {"step": step_key, "data": stored, "completion": stats}


def _advance_cursor(session: OnboardingSession) -> None:
    """
    Move `current_step` to the first step that isn't complete.
    Falls back to `step12` when every step is done.
    """
    completed = set(
        session.step_data.filter(is_complete=True).values_list("step", flat=True)
    )
    for key in STEP_ORDER:
        if key not in completed:
            session.current_step = key
            return
    session.current_step = "step12"


# ============================================================
# RESET
# ============================================================

@transaction.atomic
def reset_session(session: OnboardingSession) -> OnboardingSession:
    session.step_data.all().delete()
    session.status = OnboardingStatus.NOT_STARTED
    session.current_step = "step1"
    session.completion_percent = 0
    session.completed_at = None
    session.save()
    return session