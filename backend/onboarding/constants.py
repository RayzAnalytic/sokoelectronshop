# onboarding/constants.py

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

# Frontend route base — change if your Next.js routes differ
STEP_ROUTE_BASE = "/auth/onboarding/steps"
COMPLETE_ROUTE = "/auth/onboarding/complete"