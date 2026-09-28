# onboarding/constants.py

from django.db import models


TOTAL_STEPS = 12

STEP_META = {
    1:  {"key": "step1",  "title": "Account",        "description": "Confirm your details",         "optional": False},
    2:  {"key": "step2",  "title": "Store Profile",  "description": "Name, logo, contact",          "optional": False},
    3:  {"key": "step3",  "title": "Business",       "description": "KRA PIN & eTIMS",              "optional": True},
    4:  {"key": "step4",  "title": "Payments",       "description": "M-Pesa, Airtel, Bank, Stripe", "optional": False},
    5:  {"key": "step5",  "title": "WhatsApp",       "description": "Cart & order messaging",       "optional": False},
    6:  {"key": "step6",  "title": "Shipping",       "description": "Zones & delivery rates",       "optional": False},
    7:  {"key": "step7",  "title": "First Category", "description": "Organize your catalog",        "optional": False},
    8:  {"key": "step8",  "title": "First Product",  "description": "Add something to sell",        "optional": False},
    9:  {"key": "step9",  "title": "Social Media",   "description": "TikTok, Instagram, Facebook",  "optional": True},
    10: {"key": "step10", "title": "Theme",          "description": "Colors, fonts, layout",        "optional": True},
    11: {"key": "step11", "title": "Invite Team",    "description": "Staff & roles",                "optional": True},
    12: {"key": "step12", "title": "Finish",         "description": "Review & go live",             "optional": False},
}

# Ordered list of step keys for iteration
STEP_ORDER = [STEP_META[n]["key"] for n in range(1, TOTAL_STEPS + 1)]

# Frontend route base
STEP_ROUTE_BASE = "/auth/onboarding/steps"
COMPLETE_ROUTE = "/auth/onboarding/complete"


def get_step_meta(key: str) -> dict:
    """Return meta for a step key (step1..step12). Empty dict if unknown."""
    for n, meta in STEP_META.items():
        if meta["key"] == key:
            return {**meta, "order": n}
    return {}


def get_step_number(key: str) -> int:
    """1..12 or 0 if unknown."""
    for n, meta in STEP_META.items():
        if meta["key"] == key:
            return n
    return 0


def get_step_key(number: int) -> str | None:
    """Reverse lookup: 1 -> 'step1'."""
    meta = STEP_META.get(number)
    return meta["key"] if meta else None


def is_optional(key: str) -> bool:
    meta = get_step_meta(key)
    return bool(meta.get("optional", False))


class OnboardingStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    ABANDONED = "abandoned", "Abandoned"


class MpesaEnvironment(models.TextChoices):
    SANDBOX = "sandbox", "Sandbox"
    PRODUCTION = "production", "Production"


class ShippingProvider(models.TextChoices):
    G4S = "g4s", "G4S"
    FARGO = "fargo", "Fargo Courier"
    SENDY = "sendy", "Sendy"
    RIDERS = "riders", "SokoFlow Riders"
    PICKUP = "pickup", "Local pickup"

# apps/onboarding/constants.py — update OnboardingStatus

class OnboardingStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "Not started"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
