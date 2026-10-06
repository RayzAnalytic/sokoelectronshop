# dashboard/settings/migrations/0002_seed.py
"""
Data migration: seed the two multi-row tables that must exist for the
Settings → Shipping and Settings → Integrations tabs to render.

Singleton models (GeneralSettings, StoreSettings, etc.) auto-create on
first `.load()` — no seeding needed. Only these two tables need rows
because the frontend iterates them.

Idempotent: uses `get_or_create` on the unique key, so re-running the
migration (or running it against a partially-seeded DB) is safe.

Reverse operation deletes exactly the rows it would have created. If
the shop owner has since edited any of them, the reverse still runs —
their edits are lost. That is intentional: a rollback is a rollback.
"""

from django.db import migrations


# ─────────────────────────────────────────────────────────────────────────────
# Seed data
# ─────────────────────────────────────────────────────────────────────────────
SHIPPING_PROVIDERS = [
    # (key, display name, enabled_by_default)
    ("g4s",    "G4S Kenya",         True),
    ("fargo",  "Fargo Courier",     True),
    ("sendy",  "Sendy",             False),
    ("riders", "SokoFlow Riders",   True),
]

INTEGRATIONS = [
    # (key, name, category, description, connected_by_default)
    #
    # Payments
    (
        "mpesa",
        "Safaricom M-Pesa Daraja",
        "Payments",
        "STK Push and C2B Paybill — the only payment gateway wired into "
        "this store.",
        True,
    ),
    (
        "cod",
        "Cash on Delivery",
        "Payments",
        "Not available on this shop. Every order must be prepaid via M-Pesa.",
        False,
    ),
    # Messaging
    (
        "whatsapp",
        "WhatsApp Cloud API",
        "Messaging",
        "Official Meta WhatsApp Business API. Sends order confirmations, "
        "shipping updates, and cart reminders.",
        True,
    ),
    # Social app — TikTok (Kenya-focused)
    (
        "tiktok-shop",
        "TikTok Shop (social app)",
        "Social app",
        "The dedicated app storefront. TikTok Shop is not available in "
        "Kenya; orders route to your storefront and settle via M-Pesa.",
        True,
    ),
    (
        "tiktok-biolink",
        "Bio link storefront",
        "Social app",
        "Lightweight catalog page hosted at sokoflow.co.ke/tiktok.",
        True,
    ),
    (
        "tiktok-pixel",
        "TikTok Pixel",
        "Social app",
        "Sends ViewContent, AddToCart, and Purchase events to TikTok Ads "
        "Manager for campaign attribution.",
        True,
    ),
    (
        "tiktok-live",
        "LIVE selling mode",
        "Social app",
        "Pin products during TikTok LIVE and capture comment-to-order "
        "intents straight into Orders.",
        True,
    ),
    # Social media management
    (
        "tiktok-social",
        "TikTok Business",
        "Social",
        "Bio-link storefront and in-video product tags.",
        True,
    ),
    (
        "instagram",
        "Instagram Business",
        "Social",
        "Product tagging in posts, stories, and reels.",
        True,
    ),
    (
        "facebook",
        "Facebook Page & Catalog",
        "Social",
        "Publish products to your Page and sync the shop catalog.",
        True,
    ),
    (
        "youtube",
        "YouTube Channel",
        "Social",
        "Product links in video descriptions and Shorts.",
        False,
    ),
    (
        "twitter",
        "X (Twitter)",
        "Social",
        "Product drops, restock alerts, and customer replies.",
        False,
    ),
    # Analytics
    (
        "ga",
        "Google Analytics 4",
        "Analytics",
        "Visitor behavioural tracking and conversion funnels.",
        True,
    ),
    (
        "meta-pixel",
        "Meta Pixel",
        "Analytics",
        "Facebook & Instagram ad conversion attribution.",
        True,
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# Forward
# ─────────────────────────────────────────────────────────────────────────────
def seed(apps, schema_editor):
    ShippingProvider = apps.get_model("settings", "ShippingProvider")
    IntegrationStatus = apps.get_model("settings", "IntegrationStatus")

    for key, name, enabled in SHIPPING_PROVIDERS:
        ShippingProvider.objects.get_or_create(
            key=key,
            defaults={"name": name, "enabled": enabled},
        )

    for key, name, category, description, connected in INTEGRATIONS:
        IntegrationStatus.objects.get_or_create(
            key=key,
            defaults={
                "name": name,
                "category": category,
                "description": description,
                "connected": connected,
            },
        )


# ─────────────────────────────────────────────────────────────────────────────
# Reverse
# ─────────────────────────────────────────────────────────────────────────────
def unseed(apps, schema_editor):
    ShippingProvider = apps.get_model("settings", "ShippingProvider")
    IntegrationStatus = apps.get_model("settings", "IntegrationStatus")

    ShippingProvider.objects.filter(
        key__in=[k for k, _, _ in SHIPPING_PROVIDERS]
    ).delete()
    IntegrationStatus.objects.filter(
        key__in=[k for k, _, _, _, _ in INTEGRATIONS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("settings", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]