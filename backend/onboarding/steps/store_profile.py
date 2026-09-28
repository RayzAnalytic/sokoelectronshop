# apps/onboarding/steps/store_profile.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry

VALID_COUNTIES = {
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu",
    "Machakos", "Kajiado", "Uasin Gishu", "Kakamega", "Nyeri",
    # add more as your product grows
}

MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2MB
ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/svg+xml"}


@StepRegistry.register
class StoreProfileStep(BaseStep):
    key = "step2"
    optional = False

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def _get(payload, *names, default=""):
        """Return the first non-empty value among the given keys."""
        for n in names:
            v = payload.get(n)
            if v not in (None, ""):
                return v
        return default

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        errors = {}

        name = (self._get(payload, "name", "store_name") or "").strip()
        if len(name) < 2:
            errors["name"] = "Store name is required."

        tagline = (self._get(payload, "tagline") or "").strip()
        if len(tagline) > 120:
            errors["tagline"] = "Tagline must be 120 characters or fewer."

        description = (self._get(payload, "description") or "").strip()
        if len(description) > 200:
            errors["description"] = "Description must be 200 characters or fewer."

        county = (self._get(payload, "county") or "").strip()
        if county and county not in VALID_COUNTIES:
            errors["county"] = "Choose a valid county."

        support_email = (self._get(payload, "supportEmail", "support_email") or "").strip()
        if support_email and "@" not in support_email:
            errors["support_email"] = "Enter a valid support email."

        # ── Logo (optional but if present, must be valid) ──
        logo = payload.get("logo")
        if logo is not None and hasattr(logo, "size"):
            if logo.size > MAX_LOGO_BYTES:
                errors["logo"] = "Logo must be 2MB or smaller."
            elif getattr(logo, "content_type", "") not in ALLOWED_LOGO_TYPES:
                errors["logo"] = "Logo must be PNG, JPG, or SVG."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        name = (self._get(payload, "name", "store_name") or "").strip()
        tagline = (self._get(payload, "tagline") or "").strip()
        description = (self._get(payload, "description") or "").strip()
        street = (self._get(payload, "street") or "").strip()
        town = (self._get(payload, "town") or "").strip()
        county = (self._get(payload, "county") or "").strip()
        postal_code = (self._get(payload, "postalCode", "postal_code") or "").strip()
        support_email = (self._get(payload, "supportEmail", "support_email") or "").strip()
        support_phone = (self._get(payload, "supportPhone", "support_phone") or "").strip()

        # If you have a Store model, upsert it here. For now we persist the
        # full payload into OnboardingStepData.data so no DB schema change is
        # needed until you wire a real Store.
        logo_url = self._store_logo(session, payload.get("logo"))

        return {
            "name": name,
            "tagline": tagline,
            "description": description,
            "street": street,
            "town": town,
            "county": county,
            "postalCode": postal_code,
            "supportEmail": support_email,
            "supportPhone": support_phone,
            "logoUrl": logo_url,
        }

    @staticmethod
    def _store_logo(session, logo):
        """Persist the uploaded logo to MEDIA_ROOT and return its URL."""
        if logo is None or not hasattr(logo, "read"):
            return ""
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import os

        ext = os.path.splitext(getattr(logo, "name", "logo"))[1] or ".png"
        path = f"onboarding/{session.user_id}/store_logo{ext}"
        # Delete any previous file at the same key so we don't leak files.
        if default_storage.exists(path):
            default_storage.delete(path)
        saved_path = default_storage.save(path, ContentFile(logo.read()))
        try:
            return default_storage.url(saved_path)
        except Exception:
            return saved_path

    # ── prefill ─────────────────────────────────────────────
    def summary(self, session):
        row = session.step_data.filter(step=self.key).first()
        stored = row.data if row else {}
        return {
            "key": self.key,
            "optional": self.optional,
            "complete": bool(row and row.is_complete),
            "data": {
                "name": stored.get("name", ""),
                "tagline": stored.get("tagline", ""),
                "description": stored.get("description", ""),
                "logo": stored.get("logoUrl", ""),
                "street": stored.get("street", ""),
                "town": stored.get("town", ""),
                "county": stored.get("county", "Nairobi"),
                "postal_code": stored.get("postalCode", ""),
                "support_email": stored.get("supportEmail", ""),
                "support_phone": stored.get("supportPhone", ""),
            },
        }