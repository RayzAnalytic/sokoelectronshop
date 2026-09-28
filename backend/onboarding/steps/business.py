# apps/onboarding/steps/business.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry
from ..validators import validate_kra_pin


VALID_BUSINESS_TYPES = {"sole", "ltd", "partner", "none"}
VALID_ETIMS_ENVS = {"sandbox", "production"}


@StepRegistry.register
class BusinessStep(BaseStep):
    key = "step3"
    optional = True

    def validate(self, session, payload):
        btype = (payload.get("type") or "none").strip()

        if btype not in VALID_BUSINESS_TYPES:
            raise ValidationError({
                "type": f"Business type must be one of: {', '.join(sorted(VALID_BUSINESS_TYPES))}."
            })

        # Skip path — nothing further to check
        if btype == "none":
            return

        errors = {}

        # ── KRA PIN (required for all registered types) ──
        kra_pin = (payload.get("kra_pin") or "").strip()
        if not kra_pin:
            errors["kra_pin"] = "KRA PIN is required."
        else:
            try:
                validate_kra_pin(kra_pin)
            except ValidationError as exc:
                errors["kra_pin"] = exc.messages[0]

        # ── Registration number (required for ltd / partner) ──
        reg_number = (payload.get("reg_number") or "").strip()
        if btype in ("ltd", "partner") and not reg_number:
            errors["reg_number"] = "Business registration number is required."

        # ── VAT ──
        vat_registered = bool(payload.get("vat_registered"))
        vat_number = (payload.get("vat_number") or "").strip()
        if vat_registered and not vat_number:
            errors["vat_number"] = "VAT number is required when VAT registered."

        # ── eTIMS ──
        etims_enabled = bool(payload.get("etims_enabled"))
        if etims_enabled:
            if not (payload.get("etims_device_id") or "").strip():
                errors["etims_device_id"] = "eTIMS device ID is required."
            if not (payload.get("etims_pin") or "").strip():
                errors["etims_pin"] = "eTIMS PIN is required."
            # api_key is optional on submit if previously saved — see apply()
            env = (payload.get("etims_env") or "sandbox").strip()
            if env not in VALID_ETIMS_ENVS:
                errors["etims_env"] = f"eTIMS environment must be one of: {', '.join(VALID_ETIMS_ENVS)}."

        # ── Invoice footer (soft limit) ──
        footer = (payload.get("invoice_footer") or "").strip()
        if len(footer) > 200:
            errors["invoice_footer"] = "Invoice footer must be 200 characters or fewer."

        if errors:
            raise ValidationError(errors)

    def apply(self, session, payload):
        btype = (payload.get("type") or "none").strip()

        # Skip path
        if btype == "none":
            return {
                "type": "none",
                "invoice_footer": (payload.get("invoice_footer") or "").strip(),
                "skipped": True,
            }

        # Preserve a previously saved api_key if the client didn't resend one
        previous = session.step_data.filter(step=self.key).first()
        prev_data = previous.data if previous else {}
        api_key_in = (payload.get("etims_api_key") or "").strip()
        api_key_stored = api_key_in or prev_data.get("etims_api_key_stored", "")

        return {
            "type": btype,
            "kra_pin": (payload.get("kra_pin") or "").strip().upper(),
            "reg_number": (payload.get("reg_number") or "").strip(),
            "vat_registered": bool(payload.get("vat_registered")),
            "vat_number": (payload.get("vat_number") or "").strip(),
            "etims_enabled": bool(payload.get("etims_enabled")),
            "etims_device_id": (payload.get("etims_device_id") or "").strip(),
            "etims_pin": (payload.get("etims_pin") or "").strip(),
            "etims_env": (payload.get("etims_env") or "sandbox").strip(),
            "etims_api_key_stored": api_key_stored,
            "etims_api_key_set": bool(api_key_stored),
            "invoice_footer": (payload.get("invoice_footer") or "").strip(),
        }

    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}
        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {
                "type": stored.get("type", "sole"),
                "kra_pin": stored.get("kra_pin", ""),
                "reg_number": stored.get("reg_number", ""),
                "vat_registered": stored.get("vat_registered", False),
                "vat_number": stored.get("vat_number", ""),
                "etims_enabled": stored.get("etims_enabled", False),
                "etims_device_id": stored.get("etims_device_id", ""),
                "etims_pin": stored.get("etims_pin", ""),
                "etims_env": stored.get("etims_env", "sandbox"),
                "etims_api_key_set": stored.get("etims_api_key_set", False),
                "invoice_footer": stored.get("invoice_footer", "Thank you for shopping with us!"),
            },
        }