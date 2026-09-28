# apps/onboarding/steps/finish.py

from django.core.exceptions import ValidationError
from django.utils import timezone

from .base import BaseStep, StepRegistry
from ..constants import STEP_META, OnboardingStatus


@StepRegistry.register
class FinishStep(BaseStep):
    key = "step12"
    optional = False

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        if not payload.get("confirm"):
            raise ValidationError({
                "confirm": "You must confirm before going live."
            })

        from ..services import compute_completion
        stats = compute_completion(session)
        if stats["required_remaining"]:
            raise ValidationError({
                "missing_steps": stats["required_remaining"],
                "_error": "Complete all required steps before going live.",
            })

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        session.status = OnboardingStatus.SUBMITTED
        session.completed_at = timezone.now()
        session.completion_percent = 100
        session.save(update_fields=[
            "status", "completed_at", "completion_percent", "updated_at",
        ])
        return {
            "submitted": True,
            "submitted_at": session.completed_at.isoformat(),
        }

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        from ..services import compute_completion
        completion = compute_completion(session)

        stored_by_step = {
            row.step: row for row in session.step_data.all()
        }

        # ── Steps checklist ──
        steps = []
        for number, meta in STEP_META.items():
            row = stored_by_step.get(meta["key"])
            is_done = bool(row and row.is_complete)
            steps.append({
                "number": number,
                "slug": meta["key"],
                "title": meta["title"],
                "description": meta["description"],
                "optional": meta["optional"],
                "state": "done" if is_done else "skipped",
            })

        completed_count = sum(1 for s in steps if s["state"] == "done")
        total_count = len(steps)
        missing_steps = [
            s["number"] for s in steps
            if not s["optional"] and s["state"] != "done"
        ]

        # ── Stats from step data ──
        def _stored(step_key):
            row = stored_by_step.get(step_key)
            return row.data if row and isinstance(row.data, dict) else {}

        categories = _stored("step7").get("categories", [])
        products = _stored("step8").get("products", [])
        step4_data = _stored("step4")
        invites = _stored("step11").get("invites", [])

        mpesa_enabled = bool(step4_data.get("mpesa_enabled"))
        mpesa_data = step4_data.get("mpesa") or {}
        payment_methods = 1 if (mpesa_enabled and mpesa_data) else 0

        stats = {
            "categories_added": len(categories) if isinstance(categories, list) else 0,
            "products_added": len(products) if isinstance(products, list) else 0,
            "payment_methods": payment_methods,
            "team_members": len(invites) if isinstance(invites, list) else 0,
        }

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": session.status in (
                OnboardingStatus.SUBMITTED, OnboardingStatus.APPROVED
            ),
            "data": {
                "steps": steps,
                "stats": stats,
                "completed_count": completed_count,
                "total_count": total_count,
                "ready_to_go_live": len(missing_steps) == 0,
                "missing_steps": missing_steps,
                "status": session.status,
                "submitted_at": (
                    session.completed_at.isoformat()
                    if session.completed_at else None
                ),
            },
        }