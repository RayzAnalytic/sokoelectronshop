# apps/onboarding/selectors.py

from .constants import STEP_ORDER, get_step_meta
from .models import OnboardingSession, OnboardingStepData
from .steps.base import StepRegistry
from . import steps  # noqa: F401 — populate the registry


# ── Simple lookups ─────────────────────────────────────────
def get_session_for_user(user) -> OnboardingSession | None:
    return OnboardingSession.objects.filter(user=user).first()


def get_step_data(session, step_key: str) -> OnboardingStepData | None:
    return OnboardingStepData.objects.filter(session=session, step=step_key).first()


# ── Shaped reads for the frontend ──────────────────────────
def list_step_states(session) -> list[dict]:
    """
    Return one entry per step in STEP_ORDER. Missing step handlers
    are reported as incomplete placeholders so the frontend wizard
    can render before you've written all 12 step files.
    """
    states = []
    for key in STEP_ORDER:
        try:
            step = StepRegistry.get(key)
        except KeyError:
            meta = get_step_meta(key)
            states.append({
                "key": key,
                "optional": meta.get("optional", False),
                "complete": False,
                "data": {},
                "meta": meta,
            })
            continue

        summary = step.summary(session)
        summary["meta"] = get_step_meta(key)
        states.append(summary)
    return states


def get_completion(session) -> dict:
    """
    Delegates to services.compute_completion. Kept here so callers
    only ever import from selectors when they need a read.
    """
    from .services import compute_completion
    return compute_completion(session)


def serialize_session(session) -> dict:
    """
    The one dict the frontend's useOnboardingSession hook consumes.
    Everything the sidebar, header, and pages need lives in here.
    """
    return {
        "id": str(session.id),
        "status": session.status,
        "current_step": session.current_step,
        "completion_percent": session.completion_percent,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "steps": list_step_states(session),
        "completion": get_completion(session),
    }