# apps/onboarding/steps/shipping.py

from django.core.exceptions import ValidationError

from .base import BaseStep, StepRegistry


VALID_PRESETS = {"national", "nairobi", "custom"}


@StepRegistry.register
class ShippingStep(BaseStep):
    key = "step6"
    optional = False

    # ── validation ──────────────────────────────────────────
    def validate(self, session, payload):
        errors = {}

        preset = (payload.get("preset") or "national").strip()
        if preset not in VALID_PRESETS:
            errors["preset"] = f"Preset must be one of: {', '.join(sorted(VALID_PRESETS))}."

        zones = payload.get("zones")
        if not isinstance(zones, list) or len(zones) == 0:
            errors["zones"] = "Add at least one shipping zone."
        else:
            for i, z in enumerate(zones):
                if not isinstance(z, dict):
                    errors[f"zones[{i}]"] = "Invalid zone."
                    continue
                name = (z.get("name") or "").strip()
                if not name:
                    errors[f"zones[{i}].name"] = "Zone name is required."

                rates = z.get("rates")
                if not isinstance(rates, list) or len(rates) == 0:
                    errors[f"zones[{i}].rates"] = f'Zone "{name or i+1}" needs at least one rate.'
                    continue

                for j, r in enumerate(rates):
                    if not isinstance(r, dict):
                        errors[f"zones[{i}].rates[{j}]"] = "Invalid rate."
                        continue
                    price = (r.get("price") or "").strip()
                    if not price:
                        errors[f"zones[{i}].rates[{j}].price"] = "Price is required."
                    else:
                        try:
                            float(price)
                        except (TypeError, ValueError):
                            errors[f"zones[{i}].rates[{j}].price"] = "Price must be a number."

        free_enabled = bool(payload.get("free_shipping_enabled"))
        if free_enabled:
            threshold = (payload.get("free_shipping_threshold") or "").strip()
            if not threshold:
                errors["free_shipping_threshold"] = "Enter a free-shipping threshold."
            else:
                try:
                    float(threshold)
                except (TypeError, ValueError):
                    errors["free_shipping_threshold"] = "Threshold must be a number."

        if errors:
            raise ValidationError(errors)

    # ── apply ───────────────────────────────────────────────
    def apply(self, session, payload):
        preset = (payload.get("preset") or "national").strip()
        free_enabled = bool(payload.get("free_shipping_enabled"))
        threshold = (
            (payload.get("free_shipping_threshold") or "").strip()
            if free_enabled
            else None
        )

        zones_clean = []
        for z in payload.get("zones", []):
            counties = z.get("counties") or []
            if isinstance(counties, str):
                counties = [c.strip() for c in counties.split(",") if c.strip()]
            else:
                counties = [str(c).strip() for c in counties if str(c).strip()]

            rates_clean = []
            for r in z.get("rates", []):
                rates_clean.append({
                    "method": (r.get("method") or "Standard").strip(),
                    "price": str(r.get("price") or "0").strip(),
                    "eta": (r.get("eta") or "").strip(),
                })

            zones_clean.append({
                "name": (z.get("name") or "").strip(),
                "counties": counties,
                "rates": rates_clean,
            })

        return {
            "preset": preset,
            "zones": zones_clean,
            "free_shipping_enabled": free_enabled,
            "free_shipping_threshold": threshold,
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
                "preset": stored.get("preset", "national"),
                "zones": stored.get(
                    "zones",
                    [
                        {
                            "name": "Nairobi",
                            "counties": ["Nairobi"],
                            "rates": [
                                {"method": "Standard", "price": "300", "eta": "1-2 days"},
                            ],
                        }
                    ],
                ),
                "free_shipping_enabled": stored.get("free_shipping_enabled", False),
                "free_shipping_threshold": stored.get("free_shipping_threshold"),
            },
        }