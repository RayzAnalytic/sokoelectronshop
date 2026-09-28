# apps/onboarding/steps/team.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


VALID_ROLES = {"admin", "manager", "orders", "content"}


@StepRegistry.register
class TeamStep(BaseStep):
    key = "step11"
    optional = True

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        invites = payload.get("invites")

        # Empty list is fine — this step is optional
        if invites is None:
            invites = []
        if not isinstance(invites, list):
            raise ValidationError({
                "invites": "Invites must be a list."
            })

        errors = {}
        seen = set()
        for i, inv in enumerate(invites):
            if not isinstance(inv, dict):
                errors[f"invites[{i}]"] = "Invalid invite."
                continue

            email = (inv.get("email") or "").strip().lower()
            if not email or "@" not in email:
                errors[f"invites[{i}].email"] = "Valid email is required."
                continue

            if email in seen:
                errors[f"invites[{i}].email"] = "Duplicate email."
                continue
            seen.add(email)

            role = (inv.get("role") or "").strip().lower()
            if role not in VALID_ROLES:
                errors[f"invites[{i}].role"] = (
                    f"Role must be one of: {', '.join(sorted(VALID_ROLES))}."
                )

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        invites_in = payload.get("invites") or []

        # Preserve previously created invite IDs / statuses if the email
        # hasn't changed. This makes re-submits idempotent — a merchant who
        # comes back and adds one more invite doesn't blow away the old ones.
        previous = session.step_data.filter(step=self.key).first()
        prev_data = previous.data if previous else {}
        prev_by_email = {
            i["email"]: i for i in prev_data.get("invites", [])
            if isinstance(i, dict) and i.get("email")
        }

        invites_out = []
        for inv in invites_in:
            email = (inv.get("email") or "").strip().lower()
            role = (inv.get("role") or "").strip().lower()
            prev = prev_by_email.get(email)

            invites_out.append({
                "id": prev["id"] if prev and prev.get("id") else f"inv-{email.split('@')[0]}",
                "email": email,
                "role": role,
                "status": prev.get("status", "pending") if prev else "pending",
                "created_at": prev.get("created_at") if prev else None,
                "expires_at": prev.get("expires_at") if prev else None,
            })

        return {
            "invites": invites_out,
            "skipped": len(invites_out) == 0,
        }

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}

        invites = []
        for inv in stored.get("invites", []):
            invites.append({
                "id": inv.get("id", ""),
                "email": inv.get("email", ""),
                "role": inv.get("role", "orders"),
                "status": inv.get("status", "pending"),
                "created_at": inv.get("created_at"),
                "expires_at": inv.get("expires_at"),
            })

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {"invites": invites},
        }