"""Server-side constants for checkout. The single source of truth for
pricing and location data — the frontend values are previews only."""

from decimal import Decimal

# ── Pricing ──────────────────────────────────────────────────────────────────
TAX_RATE = Decimal("0.16")
FREE_DELIVERY_THRESHOLD = Decimal("5000")

DELIVERY_FEES = {
    "express": Decimal("500"),
    "standard": Decimal("300"),
    "pickup": Decimal("0"),
}

DELIVERY_METHODS = ("express", "standard", "pickup")

# ── Kenya ────────────────────────────────────────────────────────────────────
KENYAN_COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
    "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
    "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
    "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
    "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi",
    "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
    "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana",
    "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
]

# ── Payment ──────────────────────────────────────────────────────────────────
DEFAULT_CURRENCY = "KES"