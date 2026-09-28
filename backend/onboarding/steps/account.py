# apps/onboarding/steps/account.py

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone

from .base import BaseStep, StepRegistry

User = get_user_model()

VALID_ROLES = {"Owner", "Manager", "Staff"}


@StepRegistry.register
class AccountStep(BaseStep):
    key = "step1"
    optional = False

    def validate(self, session, payload):
        errors = {}

        # ── Identity ──
        email = (payload.get("email") or "").strip().lower()
        if not email or "@" not in email:
            errors["email"] = "A valid email is required."
        elif User.objects.exclude(pk=session.user_id).filter(email__iexact=email).exists():
            errors["email"] = "This email is already in use."

        full_name = (payload.get("fullName") or payload.get("full_name") or "").strip()
        if len(full_name) < 2:
            errors["fullName"] = "Full name is required."

        phone = (payload.get("phone") or "").strip()
        if not phone:
            errors["phone"] = "Phone number is required."

        # ── Role ──
        role = payload.get("role") or "Owner"
        if role not in VALID_ROLES:
            errors["role"] = f"Role must be one of: {', '.join(sorted(VALID_ROLES))}."

        # ── Password (optional) ──
        password = (payload.get("password") or "").strip()
        confirm = (payload.get("confirm") or "").strip()
        if password or confirm:
            if password != confirm:
                errors["confirm"] = "Passwords do not match."
            elif not password:
                errors["password"] = "Enter a password."
            else:
                try:
                    validate_password(password, user=session.user)
                except ValidationError as exc:
                    errors["password"] = " ".join(exc.messages)

        # ── Terms ──
        if not payload.get("agreed"):
            errors["agreed"] = "You must accept the terms to continue."

        if errors:
            raise ValidationError(errors)

    def apply(self, session, payload):
        user = session.user

        user.email = (payload.get("email") or user.email).strip().lower()
        user.first_name = (
            payload.get("fullName") or payload.get("full_name") or ""
        ).strip()

        if hasattr(user, "phone"):
            user.phone = (payload.get("phone") or "").strip()

        password = (payload.get("password") or "").strip()
        if password:
            user.set_password(password)

        user.save()

        role = payload.get("role") or "Owner"

        return {
            "fullName": user.get_full_name(),
            "email": user.email,
            "phone": getattr(user, "phone", payload.get("phone", "")),
            "role": role,
            "password_changed": bool(password),
            "terms_accepted_at": timezone.now().isoformat(),
        }

    def summary(self, session):
        """
        Prefill — returns exactly {fullName, email, phone, role} because
        the frontend's `onboarding.getStep1()` reads those camelCase keys.
        """
        row = session.step_data.filter(step=self.key).first()
        user = session.user
        stored = row.data if row else {}

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {
                "fullName": stored.get("fullName") or user.get_full_name() or "",
                "email": stored.get("email") or user.email or "",
                "phone": stored.get("phone") or getattr(user, "phone", "") or "",
                "role": stored.get("role") or "Owner",
            },
        }