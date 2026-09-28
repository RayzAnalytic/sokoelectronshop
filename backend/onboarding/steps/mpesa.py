# apps/onboarding/steps/mpesa.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


VALID_ENVS = {"sandbox", "production"}


@StepRegistry.register
class MpesaStep(BaseStep):
    key = "step4"
    optional = False

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def _d(value, key, default=""):
        if isinstance(value, dict):
            v = value.get(key)
            return v if v not in (None, "") else default
        return default

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        errors = {}

        mpesa_enabled = bool(payload.get("mpesa_enabled"))
        if not mpesa_enabled:
            raise ValidationError({
                "_error": "Enable M-Pesa to accept payments."
            })

        m = payload.get("mpesa") or {}

        if not self._d(m, "consumer_key").strip():
            errors["mpesa.consumer_key"] = "Consumer key is required."
        if not self._d(m, "consumer_secret").strip():
            errors["mpesa.consumer_secret"] = "Consumer secret is required."
        if not self._d(m, "passkey").strip():
            errors["mpesa.passkey"] = "Passkey is required."
        if not self._d(m, "shortcode").strip():
            errors["mpesa.shortcode"] = "Shortcode is required."

        env = self._d(m, "env", "sandbox").strip()
        if env not in VALID_ENVS:
            errors["mpesa.env"] = f"Environment must be one of: {', '.join(VALID_ENVS)}."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        m = payload.get("mpesa") or {}

        return {
            "mpesa_enabled": True,
            "mpesa": {
                "consumer_key": self._d(m, "consumer_key").strip(),
                "consumer_secret_set": bool(self._d(m, "consumer_secret").strip()),
                "passkey_set": bool(self._d(m, "passkey").strip()),
                "shortcode": self._d(m, "shortcode").strip(),
                "env": self._d(m, "env", "sandbox").strip(),
            },
        }

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}
        mpesa_stored = stored.get("mpesa") or {}

        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {
                "mpesa_enabled": stored.get("mpesa_enabled", True),
                "mpesa": {
                    "consumer_key": mpesa_stored.get("consumer_key", ""),
                    # Secrets are never returned — frontend treats empty string as "not set".
                    "consumer_secret": "",
                    "passkey": "",
                    "shortcode": mpesa_stored.get("shortcode", ""),
                    "env": mpesa_stored.get("env", "sandbox"),
                },
            },
        }