# apps/onboarding/validators.py

import re

from django.core.exceptions import ValidationError

# ── Patterns ───────────────────────────────────────────────
PHONE_RE = re.compile(r"^\+?[0-9\s\-()]{7,20}$")
KRA_PIN_RE = re.compile(r"^[A-Z][0-9]{9}[A-Z]$")
HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

VALID_COUNTIES = {
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu",
    "Machakos", "Kajiado", "Uasin Gishu", "Kakamega", "Nyeri",
}


# ── Field validators (return the normalized value) ─────────
def validate_phone(value: str) -> str:
    v = (value or "").strip()
    if not PHONE_RE.match(v):
        raise ValidationError("Enter a valid phone number.")
    return v


def validate_email(value: str) -> str:
    v = (value or "").strip().lower()
    if not EMAIL_RE.match(v):
        raise ValidationError("Enter a valid email address.")
    return v


def validate_kra_pin(value: str) -> str:
    v = (value or "").strip().upper()
    if not KRA_PIN_RE.match(v):
        raise ValidationError("KRA PIN must look like A123456789Z.")
    return v


def validate_hex_color(value: str) -> str:
    v = (value or "").strip()
    if not HEX_COLOR_RE.match(v):
        raise ValidationError("Enter a valid hex colour (#RRGGBB).")
    return v


def validate_county(value: str) -> str:
    v = (value or "").strip()
    if v and v not in VALID_COUNTIES:
        raise ValidationError(f"'{v}' is not a recognized Kenyan county.")
    return v


def validate_max_length(value: str, limit: int, label: str = "Field") -> str:
    v = (value or "").strip()
    if len(v) > limit:
        raise ValidationError(f"{label} must be {limit} characters or fewer.")
    return v


import re
from django.core.exceptions import ValidationError

KRA_PIN_RE = re.compile(r"^[A-Z][0-9]{9}[A-Z]$")


def validate_kra_pin(value: str) -> str:
    v = (value or "").strip().upper()
    if not KRA_PIN_RE.match(v):
        raise ValidationError("KRA PIN must look like A123456789Z.")
    return v