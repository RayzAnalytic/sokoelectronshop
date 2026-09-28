# apps/onboarding/steps/whatsapp.py

import re

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


PHONE_RE = re.compile(r"^\+?[0-9\s\-()]{7,20}$")
OTP_RE = re.compile(r"^[0-9]{6}$")

VALID_PLACEHOLDERS = {
    "{store_name}",
    "{items}",
    "{total}",
    "{address}",
    "{customer_name}",
}


@StepRegistry.register
class WhatsAppStep(BaseStep):
    key = "step5"
    optional = False

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        errors = {}

        number = (payload.get("number") or "").strip()
        if not number:
            errors["number"] = "WhatsApp business number is required."
        elif not PHONE_RE.match(number):
            errors["number"] = "Enter a valid phone number, e.g. +254 7XX XXX XXX."

        template = (payload.get("template") or "").strip()
        if not template:
            errors["template"] = "Cart message template is required."
        elif len(template) > 1024:
            errors["template"] = "Template must be 1024 characters or fewer."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        number = (payload.get("number") or "").strip()

        # Was this number already verified in a previous submit?
        previous = session.step_data.filter(step=self.key).first()
        prev_data = previous.data if previous else {}
        prev_verified = bool(prev_data.get("verified"))
        prev_verified_at = prev_data.get("verified_at")

        # Verified state carries over only if the number hasn't changed.
        same_number = prev_data.get("number") == number
        verified = prev_verified and same_number
        verified_at = prev_verified_at if verified else None

        return {
            "number": number,
            "verified": verified,
            "verified_at": verified_at,
            "template": (payload.get("template") or "").strip(),
            "new_order_alert": bool(payload.get("new_order_alert", True)),
            "auto_reply": bool(payload.get("auto_reply", False)),
        }

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}
        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {
                "number": stored.get("number", ""),
                "verified": stored.get("verified", False),
                "verified_at": stored.get("verified_at"),
                "template": stored.get(
                    "template",
                    "Hello {store_name}, I'd like to order:\n{items}\nTotal: {total}\nMy delivery address: {address}",
                ),
                "new_order_alert": stored.get("new_order_alert", True),
                "auto_reply": stored.get("auto_reply", False),
            },
        }

    # ── shared helpers used by views ────────────────────────
    @staticmethod
    def validate_otp(otp: str) -> str:
        otp = (otp or "").strip()
        if not OTP_RE.match(otp):
            raise ValidationError("Enter the 6-digit code.")
        return otp