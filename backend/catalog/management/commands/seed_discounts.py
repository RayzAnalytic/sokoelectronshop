"""
Seed the Discount table from the frontend's data/discounts.ts.

Usage:
    python manage.py seed_discounts
    python manage.py seed_discounts --clear

Depends on:
    * Categories seeded by `seed_catalog`
    * Products seeded by `seed_catalog`

Missing linked products or categories are logged and skipped — the
discount is still created, just without that link.
"""
from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import (
    Category,
    Product,
    Discount,
    DiscountType,
    DiscountSource,
    PromotionType,
    AppliesTo,
)


# Default source for every seed row. Real "campaign" or "clearance"
# rows are tagged explicitly in the entry below.
DEFAULT_SOURCE = DiscountSource.CAMPAIGN


DISCOUNTS = [
    # ═══════════════════════════════════════════════════════════════════════
    # 1 – 11  (existing)
    # ═══════════════════════════════════════════════════════════════════════

    # ── 1. TV & Home Entertainment Week ──────────────────────────────
    {
        "code": "TVWEEK15",
        "description": "15% off all Smart TVs and home entertainment displays",
        "type": DiscountType.PERCENTAGE,
        "value": "15%",
        "min_order": "30000.00",
        "max_cap": "0.00",
        "usage_limit": 300,
        "per_customer": 1,
        "usage_count": 47,
        "start_date": "2026-09-20 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/tvs.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "TV & Home Entertainment Week",
        "badge_text": "15% OFF",
        "priority": 10,
        "linked_product_ids": [],
        "linked_categories": ["TVs"],
    },

    # ── 2. Laptop Power Days ─────────────────────────────────────────
    {
        "code": "LAPTOP20",
        "description": "20% off premium workstations and ultrabooks",
        "type": DiscountType.PERCENTAGE,
        "value": "20%",
        "min_order": "50000.00",
        "max_cap": "0.00",
        "usage_limit": 150,
        "per_customer": 1,
        "usage_count": 23,
        "start_date": "2026-09-25 00:00",
        "end_date": "2026-11-15 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/macbook.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Laptop Power Days",
        "badge_text": "20% OFF",
        "priority": 9,
        "linked_product_ids": ["prod_39xka1", "prd_new_01", "prd_new_08"],
        "linked_categories": [],
    },

    # ── 3. Audio Blowout ─────────────────────────────────────────────
    {
        "code": "AUDIO25",
        "description": "25% off premium headphones and portable speakers",
        "type": DiscountType.PERCENTAGE,
        "value": "25%",
        "min_order": "15000.00",
        "max_cap": "0.00",
        "usage_limit": 200,
        "per_customer": 2,
        "usage_count": 68,
        "start_date": "2026-09-15 00:00",
        "end_date": "2026-12-15 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/Headphone.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Audio Blowout",
        "badge_text": "25% OFF",
        "priority": 8,
        "linked_product_ids": ["prod_72ndbc", "prod_66plmw", "prd_new_05"],
        "linked_categories": [],
    },

    # ── 4. Phone & Mobile Deals ──────────────────────────────────────
    {
        "code": "PHONE10",
        "description": "10% off flagship smartphones and mobile accessories",
        "type": DiscountType.PERCENTAGE,
        "value": "10%",
        "min_order": "30000.00",
        "max_cap": "0.00",
        "usage_limit": 400,
        "per_customer": 1,
        "usage_count": 91,
        "start_date": "2026-09-10 00:00",
        "end_date": "2026-10-20 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/phone.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Phone & Mobile Deals",
        "badge_text": "10% OFF",
        "priority": 7,
        "linked_product_ids": ["prod_91klas", "prd_new_02"],
        "linked_categories": [],
    },

    # ── 5. Gaming Accessories Deal ───────────────────────────────────
    {
        "code": "GAME15",
        "description": "15% off gaming controllers and accessories",
        "type": DiscountType.PERCENTAGE,
        "value": "15%",
        "min_order": "8000.00",
        "max_cap": "0.00",
        "usage_limit": 250,
        "per_customer": 2,
        "usage_count": 34,
        "start_date": "2026-09-22 00:00",
        "end_date": "2026-12-05 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/gamecontroller.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Gaming Gear Savings",
        "badge_text": "15% OFF",
        "priority": 6,
        "linked_product_ids": ["prod_54gmrx"],
        "linked_categories": [],
    },

    # ── 6. Welcome Voucher ───────────────────────────────────────────
    {
        "code": "WELCOME500",
        "description": "New buyer welcome voucher — KES 500 off your first order",
        "type": DiscountType.FIXED_AMOUNT,
        "value": "KES 500",
        "min_order": "2000.00",
        "max_cap": "500.00",
        "usage_limit": 1000,
        "per_customer": 1,
        "usage_count": 89,
        "start_date": "2026-01-01 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "First-time Buyers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/Router.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.FIXED_AMOUNT_DISCOUNT,
        "deal_title": "Welcome Offer",
        "badge_text": "KES 500 OFF",
        "priority": 5,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 7. Networking Essentials ─────────────────────────────────────
    {
        "code": "NETGEAR12",
        "description": "12% off routers and networking equipment",
        "type": DiscountType.PERCENTAGE,
        "value": "12%",
        "min_order": "8000.00",
        "max_cap": "0.00",
        "usage_limit": 180,
        "per_customer": 1,
        "usage_count": 15,
        "start_date": "2026-09-18 00:00",
        "end_date": "2026-11-30 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/Router.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Networking Essentials",
        "badge_text": "12% OFF",
        "priority": 4,
        "linked_product_ids": ["prod_21tpac"],
        "linked_categories": [],
    },

    # ── 8. Wearables Week ────────────────────────────────────────────
    {
        "code": "WEAR20",
        "description": "20% off fitness trackers and wearable tech",
        "type": DiscountType.PERCENTAGE,
        "value": "20%",
        "min_order": "4000.00",
        "max_cap": "0.00",
        "usage_limit": 300,
        "per_customer": 2,
        "usage_count": 52,
        "start_date": "2026-09-12 00:00",
        "end_date": "2026-11-20 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/xiaomiwatch.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Wearables Week",
        "badge_text": "20% OFF",
        "priority": 3,
        "linked_product_ids": ["prod_88smrt"],
        "linked_categories": [],
    },

    # ── 9. Heritage Day Sale (scheduled) ─────────────────────────────
    {
        "code": "HERITAGEDAY2026",
        "description": "Scheduled national holiday promotion across select categories",
        "type": DiscountType.PERCENTAGE,
        "value": "20%",
        "min_order": "10000.00",
        "max_cap": "0.00",
        "usage_limit": 200,
        "per_customer": 1,
        "usage_count": 0,
        "start_date": "2026-10-20 00:00",
        "end_date": "2026-10-22 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/smartphone2.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Heritage Day Sale",
        "badge_text": "20% OFF",
        "priority": 2,
        "linked_product_ids": [],
        "linked_categories": ["Smartphones", "Audio"],
    },

    # ── 10. Free shipping (hidden) ───────────────────────────────────
    {
        "code": "FREESHIPNAIROBI",
        "description": "Free doorstep delivery for regional orders over KES 3,500",
        "type": DiscountType.FREE_SHIPPING,
        "value": "100% Off",
        "min_order": "3500.00",
        "max_cap": "0.00",
        "usage_limit": 500,
        "per_customer": 1,
        "usage_count": 310,
        "start_date": "2026-09-01 00:00",
        "end_date": "2026-12-30 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/powerstation.jpeg",
        "display_on_deals_page": False,
        "promotion_type": PromotionType.CAMPAIGN,
        "deal_title": "",
        "badge_text": "FREE SHIP",
        "priority": 1,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 11. Summer clearance (expired) ───────────────────────────────
    {
        "code": "SUMMERBLOWOUT",
        "description": "Expired seasonal clearance on portable audio",
        "type": DiscountType.PERCENTAGE,
        "value": "30%",
        "min_order": "15000.00",
        "max_cap": "0.00",
        "usage_limit": 450,
        "per_customer": 1,
        "usage_count": 450,
        "start_date": "2026-06-01 00:00",
        "end_date": "2026-08-31 23:59",
        "applies_to": AppliesTo.SPECIFIC_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/jbl.jpeg",
        "display_on_deals_page": False,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "",
        "badge_text": "30% OFF",
        "priority": 0,
        "linked_product_ids": ["prod_66plmw"],
        "linked_categories": [],
    },

    # ═══════════════════════════════════════════════════════════════════════
    # 12 – 30  (new)
    # ═══════════════════════════════════════════════════════════════════════

    # ── 12. Smart Home Sale ──────────────────────────────────────────
    {
        "code": "SMARTHOME18",
        "description": "18% off smart home devices, hubs, and sensors",
        "type": DiscountType.PERCENTAGE,
        "value": "18%",
        "min_order": "5000.00",
        "max_cap": "0.00",
        "usage_limit": 250,
        "per_customer": 2,
        "usage_count": 41,
        "start_date": "2026-10-01 00:00",
        "end_date": "2026-12-15 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/Router.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Smart Home Sale",
        "badge_text": "18% OFF",
        "priority": 6,
        "linked_product_ids": [],
        "linked_categories": ["Networking", "Accessories"],
    },

    # ── 13. Accessories Bundle ──────────────────────────────────────
    {
        "code": "BUNDLEACCESS30",
        "description": "Buy 2 accessories, get 30% off the cheaper one",
        "type": DiscountType.BUY_X_GET_Y,
        "value": "30%",
        "min_order": "3000.00",
        "max_cap": "2000.00",
        "usage_limit": 300,
        "per_customer": 2,
        "usage_count": 76,
        "start_date": "2026-10-05 00:00",
        "end_date": "2026-11-30 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/gamecontroller.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.CAMPAIGN,
        "deal_title": "Accessory Bundle Deals",
        "badge_text": "30% OFF 2ND",
        "priority": 7,
        "linked_product_ids": [],
        "linked_categories": ["Accessories", "Gaming"],
    },

    # ── 14. Speaker Flash Sale ──────────────────────────────────────
    {
        "code": "SPEAKERFLASH",
        "description": "Flash sale — 35% off all Bluetooth and portable speakers",
        "type": DiscountType.PERCENTAGE,
        "value": "35%",
        "min_order": "5000.00",
        "max_cap": "6000.00",
        "usage_limit": 100,
        "per_customer": 1,
        "usage_count": 88,
        "start_date": "2026-10-10 00:00",
        "end_date": "2026-10-12 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/Headphone.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.SALE_PRICE,
        "deal_title": "48-Hour Speaker Flash",
        "badge_text": "35% OFF",
        "priority": 9,
        "linked_product_ids": [],
        "linked_categories": ["Speakers"],
    },

    # ── 15. BOGO Gaming ─────────────────────────────────────────────
    {
        "code": "BOGOGAME",
        "description": "Buy one gaming controller, get the second free",
        "type": DiscountType.BUY_X_GET_Y,
        "value": "100%",
        "min_order": "5000.00",
        "max_cap": "8000.00",
        "usage_limit": 150,
        "per_customer": 1,
        "usage_count": 39,
        "start_date": "2026-10-15 00:00",
        "end_date": "2026-11-15 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/gamecontroller.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.CAMPAIGN,
        "deal_title": "Buy 1 Get 1 — Gaming",
        "badge_text": "BOGO",
        "priority": 8,
        "linked_product_ids": [],
        "linked_categories": ["Gaming"],
    },

    # ── 16. Tiered Electronics ──────────────────────────────────────
    {
        "code": "TIEREDELECTRO",
        "description": "Spend KES 100K get 10%, KES 200K get 15%, KES 300K get 20%",
        "type": DiscountType.PERCENTAGE,
        "value": "20%",
        "min_order": "100000.00",
        "max_cap": "60000.00",
        "usage_limit": 100,
        "per_customer": 1,
        "usage_count": 12,
        "start_date": "2026-10-01 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "High-value Customers",
        "is_most_deal": False,
        "image": "/tvs.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Tiered Electronics Savings",
        "badge_text": "UP TO 20% OFF",
        "priority": 5,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 17. Midnight Madness ────────────────────────────────────────
    {
        "code": "MIDNIGHT25",
        "description": "Midnight madness — 25% off during 10 PM – 2 AM only",
        "type": DiscountType.PERCENTAGE,
        "value": "25%",
        "min_order": "2000.00",
        "max_cap": "5000.00",
        "usage_limit": 200,
        "per_customer": 1,
        "usage_count": 55,
        "start_date": "2026-10-18 22:00",
        "end_date": "2026-10-19 02:00",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "Night Shoppers",
        "is_most_deal": True,
        "image": "/smartphone2.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.SALE_PRICE,
        "deal_title": "Midnight Madness",
        "badge_text": "25% OFF",
        "priority": 8,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 18. New Customer Welcome ────────────────────────────────────
    {
        "code": "NEWCUST15",
        "description": "15% off first purchase for new customers",
        "type": DiscountType.PERCENTAGE,
        "value": "15%",
        "min_order": "3000.00",
        "max_cap": "3000.00",
        "usage_limit": 2000,
        "per_customer": 1,
        "usage_count": 134,
        "start_date": "2026-01-01 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "New Customers Only",
        "target_audience": "New Customers",
        "is_most_deal": True,
        "image": "/smartphone2.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Welcome — 15% Off",
        "badge_text": "15% OFF",
        "priority": 6,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 19. VIP Loyalty Reward ──────────────────────────────────────
    {
        "code": "VIPLOYAL20",
        "description": "20% off for repeat customers with 3+ orders",
        "type": DiscountType.PERCENTAGE,
        "value": "20%",
        "min_order": "10000.00",
        "max_cap": "8000.00",
        "usage_limit": 500,
        "per_customer": 3,
        "usage_count": 67,
        "start_date": "2026-09-01 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "Repeat Customers Only",
        "target_audience": "Loyal Customers",
        "is_most_deal": False,
        "image": "/macbook.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "VIP Loyalty Reward",
        "badge_text": "20% OFF",
        "priority": 4,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 20. TikTok Launch Promo ────────────────────────────────────
    {
        "code": "TIKTOKLAUNCH",
        "description": "TikTok launch exclusive — 22% off selected audio gear",
        "type": DiscountType.PERCENTAGE,
        "value": "22%",
        "min_order": "5000.00",
        "max_cap": "5000.00",
        "usage_limit": 500,
        "per_customer": 1,
        "usage_count": 156,
        "start_date": "2026-10-01 00:00",
        "end_date": "2026-11-30 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "TikTok Audience",
        "is_most_deal": True,
        "image": "/Headphone.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.CAMPAIGN,
        "deal_title": "TikTok Launch Deal",
        "badge_text": "22% OFF",
        "priority": 7,
        "linked_product_ids": [],
        "linked_categories": ["Audio"],
        "channels": ["TikTok"],
    },

    # ── 21. WhatsApp Exclusive ─────────────────────────────────────
    {
        "code": "WAEXCLUSIVE10",
        "description": "WhatsApp subscriber exclusive — 10% off any order",
        "type": DiscountType.PERCENTAGE,
        "value": "10%",
        "min_order": "2000.00",
        "max_cap": "2000.00",
        "usage_limit": 800,
        "per_customer": 2,
        "usage_count": 201,
        "start_date": "2026-09-15 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "WhatsApp Subscribers",
        "is_most_deal": False,
        "image": "/phone.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "WhatsApp Exclusive",
        "badge_text": "10% OFF",
        "priority": 5,
        "linked_product_ids": [],
        "linked_categories": [],
        "channels": ["WhatsApp"],
    },

    # ── 22. Back to School ─────────────────────────────────────────
    {
        "code": "BACKTOSCHOOL",
        "description": "Back-to-school savings — 12% off laptops and accessories",
        "type": DiscountType.PERCENTAGE,
        "value": "12%",
        "min_order": "15000.00",
        "max_cap": "12000.00",
        "usage_limit": 400,
        "per_customer": 2,
        "usage_count": 82,
        "start_date": "2026-08-15 00:00",
        "end_date": "2026-09-30 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "Students & Parents",
        "is_most_deal": False,
        "image": "/macbook.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.CAMPAIGN,
        "deal_title": "Back to School",
        "badge_text": "12% OFF",
        "priority": 3,
        "linked_product_ids": [],
        "linked_categories": ["Laptops", "Accessories"],
    },

    # ── 23. Weekend Special ────────────────────────────────────────
    {
        "code": "WEEKEND10",
        "description": "Weekend-only — 10% off every Saturday and Sunday",
        "type": DiscountType.PERCENTAGE,
        "value": "10%",
        "min_order": "1500.00",
        "max_cap": "3000.00",
        "usage_limit": 0,
        "per_customer": 1,
        "usage_count": 189,
        "start_date": "2026-10-04 00:00",
        "end_date": "2026-11-29 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "Weekend Shoppers",
        "is_most_deal": False,
        "image": "/gamecontroller.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Weekend Special",
        "badge_text": "10% OFF",
        "priority": 4,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 24. Clearance — Old Monitors ───────────────────────────────
    {
        "code": "CLEAR-MONITORS",
        "description": "Clearance — 40% off slow-moving display inventory",
        "type": DiscountType.PERCENTAGE,
        "value": "40%",
        "min_order": "0.00",
        "max_cap": "0.00",
        "usage_limit": 0,
        "per_customer": 0,
        "usage_count": 24,
        "start_date": "2026-09-01 00:00",
        "end_date": None,
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/tvs.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.SALE_PRICE,
        "deal_title": "Monitor Clearance",
        "badge_text": "40% OFF",
        "priority": 2,
        "linked_product_ids": [],
        "linked_categories": ["TVs", "Accessories"],
        "source": DiscountSource.CLEARANCE,
        "is_automatic": True,
        "is_clearance": True,
        "expires_when_sold_out": True,
    },

    # ── 25. Bulk Buy Savings ───────────────────────────────────────
    {
        "code": "BULKBUY15",
        "description": "Buy 5+ items, save 15% on the order",
        "type": DiscountType.PERCENTAGE,
        "value": "15%",
        "min_order": "10000.00",
        "max_cap": "15000.00",
        "usage_limit": 250,
        "per_customer": 2,
        "usage_count": 43,
        "start_date": "2026-10-01 00:00",
        "end_date": "2026-12-15 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "Bulk Buyers",
        "is_most_deal": False,
        "image": "/gamecontroller.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Bulk Buy Savings",
        "badge_text": "15% OFF",
        "priority": 5,
        "linked_product_ids": [],
        "linked_categories": [],
    },

    # ── 26. Premium Headphones ─────────────────────────────────────
    {
        "code": "PREMIUMAUDIO1500",
        "description": "KES 1,500 off premium headphones over KES 20,000",
        "type": DiscountType.FIXED_AMOUNT,
        "value": "KES 1500",
        "min_order": "20000.00",
        "max_cap": "1500.00",
        "usage_limit": 200,
        "per_customer": 1,
        "usage_count": 31,
        "start_date": "2026-10-01 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "Premium Audio Buyers",
        "is_most_deal": False,
        "image": "/Headphone.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.FIXED_AMOUNT_DISCOUNT,
        "deal_title": "Premium Audio Deal",
        "badge_text": "KES 1,500 OFF",
        "priority": 4,
        "linked_product_ids": [],
        "linked_categories": ["Audio"],
    },

    # ── 27. Smartphone Upgrade ─────────────────────────────────────
    {
        "code": "UPGRADE18",
        "description": "18% off smartphones when you trade in your old device",
        "type": DiscountType.PERCENTAGE,
        "value": "18%",
        "min_order": "40000.00",
        "max_cap": "20000.00",
        "usage_limit": 150,
        "per_customer": 1,
        "usage_count": 27,
        "start_date": "2026-10-15 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "Smartphone Upgraders",
        "is_most_deal": True,
        "image": "/smartphone2.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.PERCENTAGE_DISCOUNT,
        "deal_title": "Smartphone Upgrade",
        "badge_text": "18% OFF",
        "priority": 7,
        "linked_product_ids": [],
        "linked_categories": ["Smartphones"],
    },

    # ── 28. Gaming Bundle ─────────────────────────────────────────
    {
        "code": "GAMINGBUNDLE",
        "description": "Buy a gaming monitor + controller, save KES 3,000",
        "type": DiscountType.FIXED_AMOUNT,
        "value": "KES 3000",
        "min_order": "45000.00",
        "max_cap": "3000.00",
        "usage_limit": 100,
        "per_customer": 1,
        "usage_count": 18,
        "start_date": "2026-10-05 00:00",
        "end_date": "2026-12-05 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "Gamers",
        "is_most_deal": False,
        "image": "/gamecontroller.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.FIXED_AMOUNT_DISCOUNT,
        "deal_title": "Gaming Bundle",
        "badge_text": "KES 3,000 OFF",
        "priority": 6,
        "linked_product_ids": [],
        "linked_categories": ["Gaming", "TVs"],
    },

    # ── 29. Free Shipping over 10K ─────────────────────────────────
    {
        "code": "FREESHIP10K",
        "description": "Free nationwide delivery on orders above KES 10,000",
        "type": DiscountType.FREE_SHIPPING,
        "value": "100% Off",
        "min_order": "10000.00",
        "max_cap": "0.00",
        "usage_limit": 0,
        "per_customer": 0,
        "usage_count": 245,
        "start_date": "2026-09-01 00:00",
        "end_date": "2026-12-31 23:59",
        "applies_to": AppliesTo.ALL_PRODUCTS,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": False,
        "image": "/powerstation.jpeg",
        "display_on_deals_page": False,
        "promotion_type": PromotionType.FREE_SHIPPING,
        "deal_title": "",
        "badge_text": "FREE SHIP",
        "priority": 3,
        "linked_product_ids": [],
        "linked_categories": [],
        "channels": ["Website", "WhatsApp"],
    },

    # ── 30. End-of-Month Blowout ───────────────────────────────────
    {
        "code": "EOMBLOWOUT",
        "description": "End-of-month blowout — 28% off selected electronics",
        "type": DiscountType.PERCENTAGE,
        "value": "28%",
        "min_order": "5000.00",
        "max_cap": "25000.00",
        "usage_limit": 300,
        "per_customer": 2,
        "usage_count": 118,
        "start_date": "2026-10-25 00:00",
        "end_date": "2026-10-31 23:59",
        "applies_to": AppliesTo.SPECIFIC_CATEGORIES,
        "eligibility": "All Customers",
        "target_audience": "All People & Customers",
        "is_most_deal": True,
        "image": "/tvs.jpeg",
        "display_on_deals_page": True,
        "promotion_type": PromotionType.SALE_PRICE,
        "deal_title": "End-of-Month Blowout",
        "badge_text": "28% OFF",
        "priority": 9,
        "linked_product_ids": [],
        "linked_categories": ["TVs", "Smartphones", "Audio"],
    },
]


def _parse_dt(value):
    """Parse 'YYYY-MM-DD HH:MM' or ISO-8601 into an aware datetime."""
    if not value:
        return None
    s = value.replace(" ", "T").replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return dt


class Command(BaseCommand):
    help = "Seed the Discount table from data/discounts.ts"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing Discount rows before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["clear"]:
            count = Discount.objects.count()
            Discount.objects.all().delete()
            self.stdout.write(f"Cleared {count} existing discount(s).")

        stats = {
            "created": 0,
            "updated": 0,
            "missing_products": [],
            "missing_categories": [],
        }

        for entry in DISCOUNTS:
            defaults = {
                "description": entry["description"],
                "type": entry["type"],
                "value": entry["value"],
                "min_order": Decimal(entry["min_order"]),
                "max_cap": Decimal(entry["max_cap"]),
                "usage_limit": entry["usage_limit"],
                "per_customer": entry["per_customer"],
                "usage_count": entry["usage_count"],
                "start_date": _parse_dt(entry["start_date"]),
                "end_date": _parse_dt(entry["end_date"]) if entry.get("end_date") else None,
                "applies_to": entry["applies_to"],
                "eligibility": entry["eligibility"],
                "target_audience": entry["target_audience"],
                "is_most_deal": entry["is_most_deal"],
                "image": entry["image"],
                "display_on_deals_page": entry["display_on_deals_page"],
                "promotion_type": entry["promotion_type"],
                "deal_title": entry["deal_title"],
                "badge_text": entry["badge_text"],
                "priority": entry["priority"],

                # ── Extended model fields (defaults per row, overridable) ──
                "source": entry.get("source", DEFAULT_SOURCE),
                "is_automatic": entry.get("is_automatic", False),
                "is_clearance": entry.get("is_clearance", False),
                "expires_when_sold_out": entry.get("expires_when_sold_out", False),
                "channels": entry.get("channels", ["Website"]),
                "tiktok_video": entry.get("tiktok_video", ""),
                "status_override": entry.get("status_override", ""),
            }

            discount, created = Discount.objects.update_or_create(
                code=entry["code"],
                defaults=defaults,
            )

            discount.linked_products.clear()
            for product_id in entry["linked_product_ids"]:
                try:
                    product = Product.objects.get(id=product_id)
                    discount.linked_products.add(product)
                except Product.DoesNotExist:
                    stats["missing_products"].append(
                        f"{entry['code']} → {product_id}"
                    )

            discount.linked_categories.clear()
            for cat_name in entry["linked_categories"]:
                try:
                    category = Category.objects.get(name=cat_name)
                    discount.linked_categories.add(category)
                except Category.DoesNotExist:
                    stats["missing_categories"].append(
                        f"{entry['code']} → {cat_name}"
                    )

            if created:
                stats["created"] += 1
            else:
                stats["updated"] += 1

            verb = "created" if created else "updated"
            self.stdout.write(
                f"  Discount {entry['code']!r} — {verb} "
                f"({entry['value']}, priority {entry['priority']})"
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {stats['created']} new + {stats['updated']} updated discounts."
        ))

        if stats["missing_products"]:
            self.stdout.write(self.style.WARNING(
                f"Could not link {len(stats['missing_products'])} product(s):"
            ))
            for row in stats["missing_products"]:
                self.stdout.write(f"  {row}")

        if stats["missing_categories"]:
            self.stdout.write(self.style.WARNING(
                f"Could not link {len(stats['missing_categories'])} categor"
                f"{'y' if len(stats['missing_categories']) == 1 else 'ies'}:"
            ))
            for row in stats["missing_categories"]:
                self.stdout.write(f"  {row}")