# apps/onboarding/steps/theme.py

import re

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


VALID_PRESETS = {"blue", "dark", "white", "orange", "green", "red", "custom"}
VALID_FONTS = {"Inter", "Poppins", "Roboto"}

HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


@StepRegistry.register
class ThemeStep(BaseStep):
    key = "step10"
    optional = True

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        # Empty payload is a valid "skip" — the frontend's Skip sends
        # the current form state which always has defaults.
        errors = {}

        preset = (payload.get("preset") or "blue").strip()
        if preset not in VALID_PRESETS:
            errors["preset"] = f"Preset must be one of: {', '.join(sorted(VALID_PRESETS))}."

        primary = (payload.get("primary") or "").strip()
        if primary and not HEX_RE.match(primary):
            errors["primary"] = "Primary color must be a hex value like #1e3a8a."

        accent = (payload.get("accent") or "").strip()
        if accent and not HEX_RE.match(accent):
            errors["accent"] = "Accent color must be a hex value like #3b82f6."

        font = (payload.get("font") or "Inter").strip()
        if font not in VALID_FONTS:
            errors["font"] = f"Font must be one of: {', '.join(sorted(VALID_FONTS))}."

        radius = payload.get("radius", 4)
        try:
            radius_int = int(radius)
            if radius_int < 0 or radius_int > 24:
                errors["radius"] = "Radius must be between 0 and 24."
        except (TypeError, ValueError):
            errors["radius"] = "Radius must be a number."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        preset = (payload.get("preset") or "blue").strip()
        primary = (payload.get("primary") or "#1e3a8a").strip()
        accent = (payload.get("accent") or "#3b82f6").strip()
        font = (payload.get("font") or "Inter").strip()
        radius = int(payload.get("radius", 4))
        dark_store = bool(payload.get("dark_store", False))

        return {
            "preset": preset,
            "primary": primary,
            "accent": accent,
            "font": font,
            "radius": radius,
            "dark_store": dark_store,
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
                "preset": stored.get("preset", "blue"),
                "primary": stored.get("primary", "#1e3a8a"),
                "accent": stored.get("accent", "#3b82f6"),
                "font": stored.get("font", "Inter"),
                "radius": int(stored.get("radius", 4)),
                "dark_store": bool(stored.get("dark_store", False)),
            },
        }