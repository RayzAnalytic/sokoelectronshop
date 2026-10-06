"""
Seed catalog data from the frontend's data/products.ts.

Usage:
    python manage.py seed_catalog --public-dir ../frontend/public
    python manage.py seed_catalog --public-dir ../frontend/public --clear

Brand logos are read from `<public-dir>/brands/<slug>.png` — see
BRAND_LOGOS below. Missing logos are logged and skipped; the brand row
is still created.
"""
from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from catalog.models import (
    Category,
    Brand,
    Product,
    ProductImage,
    ProductFeature,
    ProductSpec,
)


# ─────────────────────────────────────────────────────────────────────────────
# 15 categories
# ─────────────────────────────────────────────────────────────────────────────
CATEGORY_ICONS = {
    "Smartphones":       "Smartphone",
    "Laptops":           "Laptop",
    "Tablets":           "Tablet",
    "TVs":               "Tv",
    "Audio":             "Headphones",
    "Gaming":            "Gamepad2",
    "Cameras":           "Camera",
    "Wearables":         "Watch",
    "Speakers":          "Speaker",
    "Networking":        "Router",
    "Accessories":       "Cable",
    "Storage":           "HardDrive",
    "Smart Home":        "Home",
    "Monitors":          "Monitor",
    "Streaming Devices": "Cast",
}


# ─────────────────────────────────────────────────────────────────────────────
# Category images (reusing existing files — swap later)
# ─────────────────────────────────────────────────────────────────────────────
CATEGORY_IMAGES = {
    "Smartphones":       "/smartphone2.jpeg",
    "Laptops":           "/laptop2.jpeg",
    "Tablets":           "/laptop3.jpeg",
    "TVs":               "/tvs.jpeg",
    "Audio":             "/Headphone.jpeg",
    "Gaming":            "/gamecontroller.jpeg",
    "Cameras":           "/cameras.jpeg",
    "Wearables":         "/xiaomiwatch.jpeg",
    "Speakers":          "/jbl.jpeg",
    "Networking":        "/Router.jpeg",
    "Accessories":       "/dellmonitor.jpeg",
    "Storage":           "/harddrives.jpeg",
    "Smart Home":        "/powerstation.jpeg",
    "Monitors":          "/dellmonitor.jpeg",
    "Streaming Devices": "/tvs.jpeg",
}


# ─────────────────────────────────────────────────────────────────────────────
# Brand → logo path inside the Next.js `public/` folder.
#
# Drop the corresponding files into `public/brands/` before seeding.
# Any path that isn't on disk is logged and skipped — the brand row
# still gets created, just without a logo. The frontend then falls
# back to the brand name as text.
#
# Suggested filenames (lowercase, slugified, PNG with transparent bg):
#     public/brands/apple.png
#     public/brands/samsung.png
#     public/brands/western-digital.png
#     ...
# ─────────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────
# Brand → logo path inside the Next.js `public/` folder.
#
# TEMPORARY: every brand points at an existing product image so the
# seeder can populate `Brand.logo` today without waiting for real brand
# assets. Swap each value for `/brands/<slug>.png` once you have proper
# logos, then re-run `seed_catalog --clear`.
# ─────────────────────────────────────────────────────────────────────────────
BRAND_LOGOS = {
    "Apple":            "/phone.jpeg",
    "Samsung":          "/smartphone2.jpeg",
    "Sony":             "/Headphone.jpeg",
    "JBL":              "/jbl.jpeg",
    "HP":               "/laptop2.jpeg",
    "Dell":             "/dellmonitor.jpeg",
    "Lenovo":           "/Lenovo.jpeg",
    "Asus":             "/laptop3.jpeg",
    "Acer":             "/laptop2.jpeg",
    "Xiaomi":           "/xiaomiwatch.jpeg",
    "Tecno":            "/phone.jpeg",
    "Infinix":          "/smartphone3.jpeg",
    "Oraimo":           "/Headphone.jpeg",
    "Anker":            "/powerstation.jpeg",
    "LG":               "/tvs.jpeg",
    "Canon":            "/cameras.jpeg",
    "Nikon":            "/cameras.jpeg",
    "GoPro":            "/cameras.jpeg",
    "Microsoft":        "/gamecontroller3.jpeg",
    "Logitech":         "/gamecontroller3.jpeg",
    "TP-Link":          "/Router.jpeg",
    "Google":           "/smartphone2.jpeg",
    "Beats":            "/Headphone3.jpeg",
    "Keychron":         "/slimkeyboard.jpeg",
    "Ring":             "/powerstation2.jpeg",
    "Amazon":           "/tvs3.jpeg",
    "Roku":             "/tvs1.jpeg",
    "TCL":              "/tvs3.jpeg",
    "SanDisk":          "/harddrives.jpeg",
    "Western Digital":  "/harddrives.jpeg",
}

# ─────────────────────────────────────────────────────────────────────────────
# 50 products
# ─────────────────────────────────────────────────────────────────────────────
PRODUCTS = [
    # ═══════════════ FEATURED / BEST SELLERS (16) ═══════════════════════════
    {
        "id": "prod_8f29s7",
        "name": 'Samsung 55" Crystal UHD 4K Smart TV',
        "brand": "Samsung", "category": "TVs",
        "featured": True, "best_seller": True,
        "sales_volume": "2.4k+ sold this month",
        "images": ["/tvs.jpeg", "/tvs1.jpeg", "/tvs2.jpeg"],
        "price": "89999.00", "compare_at_price": "104999.00",
        "stock_quantity": 12, "rating": "4.70", "review_count": 32,
        "description": "Crystal Processor 4K upscales everything to sharp 4K. HDR10+ and Motion Xcelerator 120Hz for vivid, blur-free viewing. Tizen OS with Netflix, YouTube, DSTV Now built in.",
        "created_at": "2025-08-12T00:00:00Z",
        "promo_end_date": "2026-12-31T23:59:59Z",
        "features": ["Crystal Processor 4K upscaling", "PurColor and HDR10+ support", "Motion Xcelerator 120Hz", "Smart TV powered by Tizen"],
        "specs": {"Screen Size": "55 inches", "Resolution": "3840 x 2160", "Refresh Rate": "120Hz", "Connectivity": "3x HDMI, 2x USB, Wi-Fi"},
    },
    {
        "id": "prod_39xka1",
        "name": "HP Pavilion 15 Core i5 12th Gen Laptop",
        "brand": "HP", "category": "Laptops",
        "featured": True, "best_seller": True,
        "sales_volume": "1.8k+ sold this month",
        "images": ["/laptop2.jpeg", "/laptop3.jpeg", "/Lenovo.jpeg"],
        "price": "78500.00", "compare_at_price": "89000.00",
        "stock_quantity": 8, "rating": "4.80", "review_count": 45,
        "description": "12th Gen Intel Core i5 with 16GB DDR4 and 512GB NVMe SSD. 15.6-inch Full HD IPS display, backlit keyboard, up to 8 hours battery.",
        "created_at": "2025-07-30T00:00:00Z",
        "promo_end_date": "2026-11-15T23:59:59Z",
        "features": ["Intel Core i5 12th Gen", "16GB DDR4 RAM, 512GB NVMe SSD", '15.6" Full HD IPS display', "Up to 8 hours battery life"],
        "specs": {"Processor": "Intel Core i5-1235U", "RAM": "16GB", "Storage": "512GB SSD", "OS": "Windows 11 Home"},
    },
    {
        "id": "prod_91klas",
        "name": "Apple iPhone 13 128GB - Midnight",
        "brand": "Apple", "category": "Smartphones",
        "featured": True, "best_seller": True,
        "sales_volume": "3.1k+ sold this month",
        "images": ["/phone.jpeg", "/smartphone2.jpeg", "/smartphone3.jpeg"],
        "price": "94999.00", "compare_at_price": "105000.00",
        "stock_quantity": 3, "rating": "4.90", "review_count": 88,
        "description": "A15 Bionic chip still benchmarks above most current Android flagships. Dual 12MP camera with Cinematic mode, 6.1-inch Super Retina XDR, up to 19 hours video playback.",
        "created_at": "2025-06-14T00:00:00Z",
        "promo_end_date": "2026-10-20T23:59:59Z",
        "features": ["A15 Bionic chip with 6-core CPU", "Dual 12MP camera with Cinematic mode", '6.1" Super Retina XDR display', "Up to 19 hours video playback"],
        "specs": {"Display": "6.1 inches", "Processor": "A15 Bionic", "Storage": "128GB", "Battery": "3240 mAh"},
    },
    {
        "id": "prod_72ndbc",
        "name": "Sony WH-1000XM4 Wireless Noise Canceling Headphones",
        "brand": "Sony", "category": "Audio",
        "featured": True, "best_seller": True,
        "sales_volume": "2.0k+ sold this month",
        "images": ["/Headphone.jpeg", "/Headphone2.jpeg", "/Headphone3.jpeg"],
        "price": "34500.00", "compare_at_price": "41000.00",
        "stock_quantity": 15, "rating": "4.90", "review_count": 112,
        "description": "Industry-leading noise cancellation with dual Noise Sensor mics. 30-hour battery, Speak-to-Chat, Quick Attention, LDAC hi-res audio.",
        "created_at": "2025-05-22T00:00:00Z",
        "promo_end_date": "2026-12-15T23:59:59Z",
        "features": ["Industry-leading noise cancellation", "Up to 30 hours battery life", "Touch sensor controls", "Speak-to-Chat and Quick Attention"],
        "specs": {"Battery": "30 hours", "Connectivity": "Bluetooth 5.0 / Aux", "Weight": "254g", "Charging": "USB-C"},
    },
    {
        "id": "prod_66plmw",
        "name": "JBL Charge 5 Portable Waterproof Bluetooth Speaker",
        "brand": "JBL", "category": "Speakers",
        "featured": True, "best_seller": True,
        "sales_volume": "1.5k+ sold this month",
        "images": ["/jbl.jpeg", "/jbl2.jpeg", "/jbl3.jpeg"],
        "price": "19500.00", "compare_at_price": "23000.00",
        "stock_quantity": 20, "rating": "4.60", "review_count": 64,
        "description": "Big JBL Pro Sound with dual passive radiators. IP67 waterproof, 20 hours playtime, built-in powerbank, PartyBoost stereo pairing.",
        "created_at": "2025-08-05T00:00:00Z",
        "promo_end_date": "2026-11-30T23:59:59Z",
        "features": ["JBL Original Pro Sound", "20 hours of playtime", "IP67 waterproof and dustproof", "Built-in powerbank"],
        "specs": {"Battery Life": "20 hours", "Water Resistance": "IP67", "Bluetooth": "5.1", "Charging": "USB-C"},
    },
    {
        "id": "prod_54gmrx",
        "name": "Sony PlayStation 5 DualSense Wireless Controller",
        "brand": "Sony", "category": "Gaming",
        "featured": True, "best_seller": True,
        "sales_volume": "1.2k+ sold this month",
        "images": ["/gamecontroller.jpeg", "/gamecontroller1.jpeg", "/gamecontroller3.jpeg"],
        "price": "11500.00", "compare_at_price": "13500.00",
        "stock_quantity": 25, "rating": "4.80", "review_count": 95,
        "description": "Haptic feedback and adaptive triggers. Built-in mic, Create button, USB-C. Works with PS5 and Windows PC.",
        "created_at": "2025-09-01T00:00:00Z",
        "promo_end_date": "2026-12-05T23:59:59Z",
        "features": ["Haptic feedback", "Adaptive triggers", "Built-in microphone", "Create button for sharing"],
        "specs": {"Connectivity": "Bluetooth 5.1 / USB-C", "Battery": "1560 mAh", "Weight": "280g", "Compatibility": "PlayStation 5, PC"},
    },
    {
        "id": "prod_21tpac",
        "name": "TP-Link Archer AX50 Wi-Fi 6 Gigabit Router",
        "brand": "TP-Link", "category": "Networking",
        "featured": True, "best_seller": True,
        "sales_volume": "950+ sold this month",
        "images": ["/Router.jpeg", "/router2.jpeg", "/router3.jpeg"],
        "price": "12500.00", "compare_at_price": "15000.00",
        "stock_quantity": 10, "rating": "4.50", "review_count": 38,
        "description": "Wi-Fi 6 with OFDMA and MU-MIMO for simultaneous device handling. Up to 3 Gbps dual-band, Intel chipset, TP-Link HomeShield parental controls.",
        "created_at": "2025-04-19T00:00:00Z",
        "promo_end_date": "2026-10-31T23:59:59Z",
        "features": ["Wi-Fi 6 (802.11ax) technology", "Up to 3 Gbps dual-band speeds", "Intel Home Wi-Fi Chipset", "Works with Alexa"],
        "specs": {"Standard": "Wi-Fi 6 (802.11ax)", "Speed": "3000 Mbps", "Antennas": "4 external", "Ports": "1x WAN, 4x LAN Gigabit"},
    },
    {
        "id": "prod_88smrt",
        "name": "Xiaomi Mi Smart Band 7 Fitness Tracker",
        "brand": "Xiaomi", "category": "Wearables",
        "featured": True, "best_seller": True,
        "sales_volume": "1.6k+ sold this month",
        "images": ["/xiaomiwatch.jpeg", "/xiaomiwatch2.jpeg", "/xiaomiwatch3.jpeg"],
        "price": "6200.00", "compare_at_price": "7500.00",
        "stock_quantity": 30, "rating": "4.70", "review_count": 79,
        "description": '1.62" AMOLED display, 120 workout modes, SpO2 and heart-rate monitoring. Up to 14 days battery. 5ATM water resistance.',
        "created_at": "2025-07-11T00:00:00Z",
        "promo_end_date": "2026-11-20T23:59:59Z",
        "features": ['1.62" AMOLED display', "120 workout modes", "SpO2 and heart rate monitoring", "Up to 14 days battery life"],
        "specs": {"Display": '1.62" AMOLED', "Battery": "180 mAh", "Water Resistance": "5 ATM", "Connectivity": "Bluetooth 5.2"},
    },
    {
        "id": "prd_new_01",
        "name": 'MacBook Pro 16" M3 Max 36GB RAM 1TB SSD',
        "brand": "Apple", "category": "Laptops",
        "featured": True, "best_seller": False,
        "sales_volume": "480+ sold this month",
        "images": ["/macbook.jpeg", "/Lenovo.jpeg", "/laptop3.jpeg"],
        "price": "349999.00", "compare_at_price": "379999.00",
        "stock_quantity": 5, "rating": "4.90", "review_count": 14,
        "description": "M3 Max with 16-core CPU and 40-core GPU. 36GB unified memory, 1TB SSD, 16.2-inch Liquid Retina XDR. Up to 22 hours battery.",
        "created_at": "2026-09-18T10:00:00Z",
        "promo_end_date": None,
        "features": ["Apple M3 Max chip (16-core CPU, 40-core GPU)", "36GB unified memory", "1TB SSD storage", '16.2" Liquid Retina XDR display'],
        "specs": {"Processor": "Apple M3 Max", "RAM": "36GB unified", "Storage": "1TB SSD", "Display": '16.2" Liquid Retina XDR'},
    },
    {
        "id": "prd_new_02",
        "name": "Samsung Galaxy S24 Ultra 5G 512GB",
        "brand": "Samsung", "category": "Smartphones",
        "featured": True, "best_seller": False,
        "sales_volume": "720+ sold this month",
        "images": ["/smartphone2.jpeg", "/smartphone3.jpeg", "/phone.jpeg"],
        "price": "154999.00", "compare_at_price": "169999.00",
        "stock_quantity": 8, "rating": "4.80", "review_count": 29,
        "description": "Titanium frame, 200MP camera, integrated S Pen, 6.8-inch Dynamic AMOLED 2X with 2600 nits. Snapdragon 8 Gen 3 for Galaxy, 5000mAh battery.",
        "created_at": "2026-09-15T14:30:00Z",
        "promo_end_date": None,
        "features": ["Snapdragon 8 Gen 3 for Galaxy", "200MP main camera with AI processing", "Integrated S Pen", '6.8" Dynamic AMOLED 2X 120Hz'],
        "specs": {"Display": "6.8 inches", "Processor": "Snapdragon 8 Gen 3", "Storage": "512GB", "Battery": "5000 mAh"},
    },
    {
        "id": "prd_new_03",
        "name": 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
        "brand": "Dell", "category": "Monitors",
        "featured": True, "best_seller": False,
        "sales_volume": "310+ sold this month",
        "images": ["/dellmonitor.jpeg", "/monitor2.jpeg", "/monitor3.jpeg"],
        "price": "68500.00", "compare_at_price": "75000.00",
        "stock_quantity": 3, "rating": "4.70", "review_count": 8,
        "description": "4K UHD IPS panel with 90W USB-C power delivery. Built-in KVM, ComfortView Plus. Factory-calibrated to 99% sRGB.",
        "created_at": "2026-09-12T09:15:00Z",
        "promo_end_date": None,
        "features": ["4K UHD 3840 x 2160 resolution", "USB-C with 90W power delivery", "ComfortView Plus low blue light", "InfinityEdge bezel-less design"],
        "specs": {"Screen Size": "27 inches", "Resolution": "3840 x 2160", "Panel": "IPS", "Connectivity": "USB-C, HDMI, DisplayPort"},
    },
    {
        "id": "prd_new_04",
        "name": "Anker PowerHouse 767 Portable Power Station",
        "brand": "Anker", "category": "Smart Home",
        "featured": True, "best_seller": False,
        "sales_volume": "120+ sold this month",
        "images": ["/powerstation.jpeg", "/powerstation2.jpeg", "/powerstation3.jpeg"],
        "price": "189999.00", "compare_at_price": "205000.00",
        "stock_quantity": 4, "rating": "4.90", "review_count": 19,
        "description": "2048Wh LiFePO4 battery with 2400W AC output (3600W surge). Recharges 0-80% in 1.5 hours. Solar input up to 1000W.",
        "created_at": "2026-09-10T16:45:00Z",
        "promo_end_date": None,
        "features": ["2048Wh capacity", "2400W AC output", "LFP batteries with 10-year lifespan", "Smart app control via Wi-Fi"],
        "specs": {"Capacity": "2048Wh", "Output": "2400W", "Battery Type": "LiFePO4 (LFP)", "Recharge Time": "1.5 hours"},
    },
    {
        "id": "prd_new_05",
        "name": "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
        "brand": "Sony", "category": "Audio",
        "featured": True, "best_seller": False,
        "sales_volume": "620+ sold this month",
        "images": ["/Headphone.jpeg", "/headphone2.jpeg", "/headphone3.jpeg"],
        "price": "48999.00", "compare_at_price": "55000.00",
        "stock_quantity": 12, "rating": "4.90", "review_count": 42,
        "description": "Eight microphones and two processors for class-leading ANC. 30-hour battery, 3-minute quick charge for 3 hours playback, multipoint Bluetooth.",
        "created_at": "2026-09-08T11:20:00Z",
        "promo_end_date": None,
        "features": ["Two processors, 8 microphones for ANC", "Up to 30 hours battery life", "Crystal clear hands-free calling", "Multipoint Bluetooth connection"],
        "specs": {"Battery": "30 hours", "Connectivity": "Bluetooth 5.2 / Aux", "Weight": "250g", "Charging": "USB-C fast charge"},
    },
    {
        "id": "prd_new_06",
        "name": 'LG C4 65" OLED evo 4K Smart TV',
        "brand": "LG", "category": "TVs",
        "featured": True, "best_seller": False,
        "sales_volume": "95+ sold this month",
        "images": ["/tvs.jpeg", "/tvs2.jpeg", "/tvs3.jpeg"],
        "price": "215000.00", "compare_at_price": "240000.00",
        "stock_quantity": 0, "rating": "4.80", "review_count": 11,
        "description": "OLED evo self-lit pixels with infinite contrast. α9 AI Processor Gen7, four HDMI 2.1 ports, 4K/120Hz VRR for gaming.",
        "created_at": "2026-09-05T08:00:00Z",
        "promo_end_date": None,
        "features": ["OLED evo self-lit pixels", "α9 AI Processor Gen7", "Dolby Vision and Dolby Atmos", "0.1ms response time for gaming"],
        "specs": {"Screen Size": "65 inches", "Resolution": "3840 x 2160", "Refresh Rate": "120Hz", "HDR": "Dolby Vision, HDR10, HLG"},
    },
    {
        "id": "prd_new_07",
        "name": "Keychron Q1 Pro Wireless Custom Mechanical Keyboard",
        "brand": "Keychron", "category": "Accessories",
        "featured": True, "best_seller": False,
        "sales_volume": "240+ sold this month",
        "images": ["/slimkeyboard.jpeg", "/slimkeyboard2.jpeg", "/slimkeyboard3.jpeg"],
        "price": "24500.00", "compare_at_price": "28000.00",
        "stock_quantity": 15, "rating": "4.60", "review_count": 31,
        "description": "CNC aluminum body, 75% layout, hot-swappable switches. QMK/VIA support, Bluetooth 5.1 to three devices, 4000mAh battery.",
        "created_at": "2026-09-02T13:10:00Z",
        "promo_end_date": None,
        "features": ["Full aluminum body", "75% compact layout", "Hot-swappable switches", "QMK/VIA support"],
        "specs": {"Layout": "75% (81 keys)", "Body": "CNC aluminum", "Connectivity": "Bluetooth 5.1 / USB-C", "Battery": "4000 mAh"},
    },
    {
        "id": "prd_new_08",
        "name": 'iPad Pro 13" M4 Wi-Fi 256GB',
        "brand": "Apple", "category": "Tablets",
        "featured": True, "best_seller": False,
        "sales_volume": "180+ sold this month",
        "images": ["/laptop2.jpeg", "/laptop3.jpeg", "/Lenovo.jpeg"],
        "price": "179999.00", "compare_at_price": "194999.00",
        "stock_quantity": 7, "rating": "4.90", "review_count": 23,
        "description": "M4 chip with Ultra Retina XDR Tandem OLED, 5.1mm thin. Works with Apple Pencil Pro and Magic Keyboard.",
        "created_at": "2026-08-30T15:00:00Z",
        "promo_end_date": None,
        "features": ["Apple M4 chip", "Ultra Retina XDR Tandem OLED", "5.1mm ultra-thin design", "All-day battery life"],
        "specs": {"Display": '13" Ultra Retina XDR', "Processor": "Apple M4", "Storage": "256GB", "Connectivity": "Wi-Fi 6E, USB-C Thunderbolt"},
    },

    # ═══════════════ SMARTPHONES (+3) ════════════════════════════════════════
    {
        "id": "prd_sp_01",
        "name": "Google Pixel 8 Pro 128GB - Obsidian",
        "brand": "Google", "category": "Smartphones",
        "featured": False, "best_seller": False,
        "sales_volume": "410+ sold this month",
        "images": ["/smartphone2.jpeg", "/phone.jpeg", "/smartphone3.jpeg"],
        "price": "129999.00", "compare_at_price": "144999.00",
        "stock_quantity": 9, "rating": "4.70", "review_count": 34,
        "description": "Tensor G3 chip with on-device AI. 50MP main camera with Best Take and Magic Editor. 6.7-inch LTPO OLED, 7 years of OS updates.",
        "created_at": "2026-05-20T00:00:00Z",
        "promo_end_date": None,
        "features": ["Google Tensor G3 chip", "50MP camera with Magic Editor", "7 years of OS updates", '6.7" LTPO OLED 120Hz'],
        "specs": {"Display": "6.7 inches", "Processor": "Tensor G3", "Storage": "128GB", "Battery": "5050 mAh"},
    },
    {
        "id": "prd_sp_02",
        "name": "Tecno Camon 20 Pro 5G 256GB",
        "brand": "Tecno", "category": "Smartphones",
        "featured": False, "best_seller": True,
        "sales_volume": "1.4k+ sold this month",
        "images": ["/phone.jpeg", "/smartphone2.jpeg", "/smartphone3.jpeg"],
        "price": "32999.00", "compare_at_price": "38999.00",
        "stock_quantity": 42, "rating": "4.50", "review_count": 87,
        "description": "Flagship-grade 50MP RGBW sensor with sensor-shift OIS. Dimensity 8050 5G, 6.67-inch AMOLED 120Hz, 5000mAh with 33W charge.",
        "created_at": "2026-04-10T00:00:00Z",
        "promo_end_date": None,
        "features": ["50MP RGBW main camera with OIS", "MediaTek Dimensity 8050 5G", '6.67" AMOLED 120Hz', "5000mAh with 33W fast charge"],
        "specs": {"Display": "6.67 inches", "Processor": "Dimensity 8050", "Storage": "256GB", "Battery": "5000 mAh"},
    },
    {
        "id": "prd_sp_03",
        "name": "Infinix Hot 40i 128GB - Palm Blue",
        "brand": "Infinix", "category": "Smartphones",
        "featured": False, "best_seller": True,
        "sales_volume": "2.1k+ sold this month",
        "images": ["/smartphone3.jpeg", "/phone.jpeg", "/smartphone2.jpeg"],
        "price": "15999.00", "compare_at_price": "19999.00",
        "stock_quantity": 68, "rating": "4.30", "review_count": 156,
        "description": "Entry-level 4G with a 6.6-inch 90Hz display and 50MP main camera. 5000mAh battery, 18W fast charge, side-mounted fingerprint.",
        "created_at": "2026-03-15T00:00:00Z",
        "promo_end_date": None,
        "features": ["50MP dual camera", '6.6" 90Hz display', "5000mAh battery", "18W fast charge"],
        "specs": {"Display": "6.6 inches", "Processor": "Unisoc T606", "Storage": "128GB", "Battery": "5000 mAh"},
    },

    # ═══════════════ LAPTOPS (+2) ════════════════════════════════════════════
    {
        "id": "prd_lp_01",
        "name": 'Dell XPS 15 Core i7 13th Gen 32GB 1TB',
        "brand": "Dell", "category": "Laptops",
        "featured": False, "best_seller": False,
        "sales_volume": "220+ sold this month",
        "images": ["/laptop3.jpeg", "/laptop2.jpeg", "/Lenovo.jpeg"],
        "price": "189999.00", "compare_at_price": "209999.00",
        "stock_quantity": 6, "rating": "4.70", "review_count": 21,
        "description": "13th Gen Intel Core i7 with RTX 4060 graphics. 15.6-inch 3.5K OLED touch, 32GB DDR5, 1TB NVMe SSD.",
        "created_at": "2026-06-05T00:00:00Z",
        "promo_end_date": None,
        "features": ["Intel Core i7-13700H", "NVIDIA RTX 4060 8GB", "32GB DDR5 RAM", '15.6" 3.5K OLED touch display'],
        "specs": {"Processor": "Intel Core i7-13700H", "RAM": "32GB DDR5", "Storage": "1TB SSD", "Display": '15.6" 3.5K OLED'},
    },
    {
        "id": "prd_lp_02",
        "name": "Lenovo ThinkPad X1 Carbon Gen 12",
        "brand": "Lenovo", "category": "Laptops",
        "featured": False, "best_seller": False,
        "sales_volume": "180+ sold this month",
        "images": ["/Lenovo.jpeg", "/laptop2.jpeg", "/laptop3.jpeg"],
        "price": "215000.00", "compare_at_price": "235000.00",
        "stock_quantity": 5, "rating": "4.80", "review_count": 17,
        "description": "Business ultrabook at 1.09kg. Intel Core Ultra 7, 32GB LPDDR5, 1TB SSD, 14-inch 2.8K OLED. Legendary ThinkPad keyboard.",
        "created_at": "2026-07-12T00:00:00Z",
        "promo_end_date": None,
        "features": ["Intel Core Ultra 7 155H", "32GB LPDDR5 RAM", "1.09kg lightweight chassis", '14" 2.8K OLED display'],
        "specs": {"Processor": "Intel Core Ultra 7", "RAM": "32GB", "Storage": "1TB SSD", "Weight": "1.09 kg"},
    },

    # ═══════════════ TABLETS (+1) ════════════════════════════════════════════
    {
        "id": "prd_tb_01",
        "name": "Samsung Galaxy Tab S9 FE 128GB Wi-Fi",
        "brand": "Samsung", "category": "Tablets",
        "featured": False, "best_seller": False,
        "sales_volume": "290+ sold this month",
        "images": ["/laptop3.jpeg", "/laptop2.jpeg", "/Lenovo.jpeg"],
        "price": "62999.00", "compare_at_price": "71999.00",
        "stock_quantity": 14, "rating": "4.60", "review_count": 26,
        "description": 'Exynos 1380 with 10.9" LCD 90Hz, S Pen included. IP68 water resistance, 8000mAh battery, dual speakers tuned by AKG.',
        "created_at": "2026-05-02T00:00:00Z",
        "promo_end_date": None,
        "features": ["S Pen included", "IP68 water and dust resistance", '10.9" 90Hz display', "8000mAh battery"],
        "specs": {"Display": '10.9" LCD', "Processor": "Exynos 1380", "Storage": "128GB", "Battery": "8000 mAh"},
    },

    # ═══════════════ TVs (+2) ════════════════════════════════════════════════
    {
        "id": "prd_tv_01",
        "name": 'Sony Bravia XR A80L 65" OLED 4K TV',
        "brand": "Sony", "category": "TVs",
        "featured": False, "best_seller": False,
        "sales_volume": "85+ sold this month",
        "images": ["/tvs2.jpeg", "/tvs.jpeg", "/tvs1.jpeg"],
        "price": "269999.00", "compare_at_price": "299999.00",
        "stock_quantity": 3, "rating": "4.90", "review_count": 15,
        "description": "Cognitive Processor XR with OLED panel. Acoustic Surface Audio+, XR Triluminos Pro, perfect for PS5 with two HDMI 2.1 ports.",
        "created_at": "2026-04-22T00:00:00Z",
        "promo_end_date": None,
        "features": ["Cognitive Processor XR", "Acoustic Surface Audio+", "Perfect for PlayStation 5", "Google TV with voice search"],
        "specs": {"Screen Size": "65 inches", "Resolution": "3840 x 2160", "Refresh Rate": "120Hz", "HDR": "Dolby Vision, HDR10, HLG"},
    },
    {
        "id": "prd_tv_02",
        "name": 'TCL 43" 4K HDR Google TV',
        "brand": "TCL", "category": "TVs",
        "featured": False, "best_seller": True,
        "sales_volume": "1.1k+ sold this month",
        "images": ["/tvs3.jpeg", "/tvs.jpeg", "/tvs1.jpeg"],
        "price": "34999.00", "compare_at_price": "42999.00",
        "stock_quantity": 22, "rating": "4.40", "review_count": 74,
        "description": "Budget 4K with HDR10, Dolby Audio, and Google TV. Three HDMI ports, voice remote, Google Assistant built in.",
        "created_at": "2026-02-18T00:00:00Z",
        "promo_end_date": None,
        "features": ["4K HDR picture", "Google TV with voice remote", "Dolby Audio", "3x HDMI inputs"],
        "specs": {"Screen Size": "43 inches", "Resolution": "3840 x 2160", "Refresh Rate": "60Hz", "HDR": "HDR10"},
    },

    # ═══════════════ AUDIO (+3) ══════════════════════════════════════════════
    {
        "id": "prd_au_01",
        "name": "Apple AirPods Pro (2nd Gen) USB-C",
        "brand": "Apple", "category": "Audio",
        "featured": False, "best_seller": True,
        "sales_volume": "980+ sold this month",
        "images": ["/Headphone2.jpeg", "/Headphone.jpeg", "/Headphone3.jpeg"],
        "price": "34999.00", "compare_at_price": "39999.00",
        "stock_quantity": 26, "rating": "4.80", "review_count": 102,
        "description": "Adaptive Audio with 2x stronger ANC. Personalized Spatial Audio, USB-C charging, up to 6 hours per charge, 30 hours total.",
        "created_at": "2026-06-10T00:00:00Z",
        "promo_end_date": None,
        "features": ["Active Noise Cancellation (2nd gen)", "Adaptive Audio", "Personalized Spatial Audio", "MagSafe USB-C charging case"],
        "specs": {"Battery": "6h (30h with case)", "Chip": "Apple H2", "Water Resistance": "IP54", "Charging": "USB-C / MagSafe"},
    },
    {
        "id": "prd_au_02",
        "name": "Beats Studio Pro Wireless Headphones",
        "brand": "Beats", "category": "Audio",
        "featured": False, "best_seller": False,
        "sales_volume": "340+ sold this month",
        "images": ["/Headphone3.jpeg", "/Headphone.jpeg", "/Headphone2.jpeg"],
        "price": "38999.00", "compare_at_price": "44999.00",
        "stock_quantity": 11, "rating": "4.60", "review_count": 48,
        "description": "40mm drivers with Active Noise Cancelling and Transparency. Up to 40 hours battery, USB-C lossless audio, Apple and Android compatible.",
        "created_at": "2026-05-25T00:00:00Z",
        "promo_end_date": None,
        "features": ["Active Noise Cancelling", "Up to 40 hours battery", "USB-C lossless audio", "Spatial Audio with head tracking"],
        "specs": {"Battery": "40 hours", "Drivers": "40mm", "Weight": "260g", "Charging": "USB-C"},
    },
    {
        "id": "prd_au_03",
        "name": "Oraimo FreePods 4 ENC Earbuds",
        "brand": "Oraimo", "category": "Audio",
        "featured": False, "best_seller": True,
        "sales_volume": "3.2k+ sold this month",
        "images": ["/Headphone.jpeg", "/headphone2.jpeg", "/headphone3.jpeg"],
        "price": "3499.00", "compare_at_price": "4999.00",
        "stock_quantity": 120, "rating": "4.40", "review_count": 218,
        "description": "Environmental noise cancelling with 4-mic ENC. 40 hours total playtime, IPX5 sweat-proof, low-latency gaming mode.",
        "created_at": "2026-03-08T00:00:00Z",
        "promo_end_date": None,
        "features": ["4-mic ENC for clear calls", "40 hours total playtime", "IPX5 sweat and splash resistant", "Low-latency gaming mode"],
        "specs": {"Battery": "40h (with case)", "Bluetooth": "5.3", "Water Resistance": "IPX5", "Charging": "USB-C"},
    },

    # ═══════════════ GAMING (+2) ═════════════════════════════════════════════
    {
        "id": "prd_gm_01",
        "name": "Sony PlayStation 5 Slim Disc Edition",
        "brand": "Sony", "category": "Gaming",
        "featured": False, "best_seller": True,
        "sales_volume": "560+ sold this month",
        "images": ["/gamecontroller1.jpeg", "/gamecontroller.jpeg", "/gamecontroller3.jpeg"],
        "price": "94999.00", "compare_at_price": "109999.00",
        "stock_quantity": 14, "rating": "4.90", "review_count": 76,
        "description": "1TB SSD, disc drive, DualSense controller included. 4K 120Hz gaming with ray tracing and 3D audio. Backwards compatible with PS4.",
        "created_at": "2026-06-18T00:00:00Z",
        "promo_end_date": None,
        "features": ["1TB NVMe SSD", "4K 120Hz with ray tracing", "DualSense controller included", "Backwards compatible with PS4"],
        "specs": {"Storage": "1TB SSD", "Resolution": "Up to 8K", "Refresh Rate": "120Hz", "Optical Drive": "Yes"},
    },
    {
        "id": "prd_gm_02",
        "name": "Logitech G Pro X Superlight 2 Wireless Mouse",
        "brand": "Logitech", "category": "Gaming",
        "featured": False, "best_seller": False,
        "sales_volume": "410+ sold this month",
        "images": ["/gamecontroller3.jpeg", "/gamecontroller.jpeg", "/gamecontroller1.jpeg"],
        "price": "17999.00", "compare_at_price": "20999.00",
        "stock_quantity": 30, "rating": "4.80", "review_count": 55,
        "description": "60g wireless esports mouse with HERO 2 sensor (32K DPI). LIGHTSPEED wireless, up to 95 hours battery, 5 programmable buttons.",
        "created_at": "2026-07-01T00:00:00Z",
        "promo_end_date": None,
        "features": ["60g ultralight design", "HERO 2 sensor with 32K DPI", "Up to 95 hours battery", "LIGHTSPEED wireless"],
        "specs": {"Sensor": "HERO 2", "DPI": "Up to 32,000", "Battery": "95 hours", "Weight": "60g"},
    },

    # ═══════════════ CAMERAS (+2) ════════════════════════════════════════════
    {
        "id": "prd_cm_01",
        "name": "Canon EOS R6 Mark II Mirrorless Body",
        "brand": "Canon", "category": "Cameras",
        "featured": False, "best_seller": False,
        "sales_volume": "45+ sold this month",
        "images": ["/cameras.jpeg", "/cameras.jpeg", "/cameras.jpeg"],
        "price": "329999.00", "compare_at_price": "359999.00",
        "stock_quantity": 3, "rating": "4.90", "review_count": 12,
        "description": "24.2MP full-frame CMOS with Dual Pixel AF II. 40fps electronic shutter, 6K oversampled 4K video, in-body 8-stop stabilization.",
        "created_at": "2026-05-12T00:00:00Z",
        "promo_end_date": None,
        "features": ["24.2MP full-frame sensor", "Up to 40fps continuous shooting", "6K oversampled 4K video", "8-stop in-body stabilization"],
        "specs": {"Sensor": "24.2MP Full-frame", "Video": "4K 60fps", "Burst": "40fps electronic", "Mount": "Canon RF"},
    },
    {
        "id": "prd_cm_02",
        "name": "GoPro HERO 12 Black Action Camera",
        "brand": "GoPro", "category": "Cameras",
        "featured": False, "best_seller": True,
        "sales_volume": "320+ sold this month",
        "images": ["/cameras.jpeg", "/cameras.jpeg", "/cameras.jpeg"],
        "price": "57999.00", "compare_at_price": "64999.00",
        "stock_quantity": 18, "rating": "4.70", "review_count": 44,
        "description": "5.3K video at 60fps, HyperSmooth 6.0 stabilization, waterproof to 10m without a housing. Includes Enduro battery and mounting hardware.",
        "created_at": "2026-06-22T00:00:00Z",
        "promo_end_date": None,
        "features": ["5.3K video at 60fps", "HyperSmooth 6.0 stabilization", "Waterproof to 33ft without housing", "Enduro battery included"],
        "specs": {"Video": "5.3K 60fps", "Photos": "27MP", "Waterproof": "33ft / 10m", "Battery": "1720mAh Enduro"},
    },

    # ═══════════════ WEARABLES (+2) ══════════════════════════════════════════
    {
        "id": "prd_wr_01",
        "name": "Apple Watch Series 9 GPS 45mm",
        "brand": "Apple", "category": "Wearables",
        "featured": False, "best_seller": True,
        "sales_volume": "640+ sold this month",
        "images": ["/xiaomiwatch2.jpeg", "/xiaomiwatch.jpeg", "/xiaomiwatch3.jpeg"],
        "price": "62999.00", "compare_at_price": "69999.00",
        "stock_quantity": 20, "rating": "4.80", "review_count": 68,
        "description": "S9 SiP with double-tap gesture. Always-on Retina display at 2000 nits, ECG, blood oxygen, crash and fall detection.",
        "created_at": "2026-07-18T00:00:00Z",
        "promo_end_date": None,
        "features": ["S9 SiP with double-tap", "Always-on Retina display", "ECG and blood oxygen apps", "Crash and fall detection"],
        "specs": {"Display": "45mm Always-on Retina", "Chip": "Apple S9", "Battery": "18 hours", "Water Resistance": "50m"},
    },
    {
        "id": "prd_wr_02",
        "name": "Samsung Galaxy Watch 6 Classic 47mm",
        "brand": "Samsung", "category": "Wearables",
        "featured": False, "best_seller": False,
        "sales_volume": "280+ sold this month",
        "images": ["/xiaomiwatch3.jpeg", "/xiaomiwatch.jpeg", "/xiaomiwatch2.jpeg"],
        "price": "49999.00", "compare_at_price": "56999.00",
        "stock_quantity": 15, "rating": "4.70", "review_count": 41,
        "description": "Rotating bezel, 1.5-inch Super AMOLED, advanced sleep coaching. Body composition analysis, ECG, Wear OS with Google apps.",
        "created_at": "2026-06-14T00:00:00Z",
        "promo_end_date": None,
        "features": ["Rotating physical bezel", "Advanced sleep coaching", "Body composition analysis", "Wear OS with Google apps"],
        "specs": {"Display": '1.5" Super AMOLED', "Chip": "Exynos W930", "Battery": "425 mAh", "Water Resistance": "5 ATM + IP68"},
    },

    # ═══════════════ SPEAKERS (+1) ═══════════════════════════════════════════
    {
        "id": "prd_sk_01",
        "name": "JBL Flip 6 Portable Bluetooth Speaker",
        "brand": "JBL", "category": "Speakers",
        "featured": False, "best_seller": True,
        "sales_volume": "1.7k+ sold this month",
        "images": ["/jbl2.jpeg", "/jbl.jpeg", "/jbl3.jpeg"],
        "price": "13500.00", "compare_at_price": "15999.00",
        "stock_quantity": 45, "rating": "4.70", "review_count": 128,
        "description": "Bold JBL Pro Sound with racetrack driver and dual passive radiators. IP67 waterproof, 12 hours playtime, PartyBoost pairing.",
        "created_at": "2026-04-08T00:00:00Z",
        "promo_end_date": None,
        "features": ["JBL Pro Sound with racetrack driver", "12 hours playtime", "IP67 waterproof and dustproof", "PartyBoost stereo pairing"],
        "specs": {"Battery Life": "12 hours", "Water Resistance": "IP67", "Bluetooth": "5.1", "Charging": "USB-C"},
    },

    # ═══════════════ NETWORKING (+1) ═════════════════════════════════════════
    {
        "id": "prd_nw_01",
        "name": "TP-Link Deco X60 AX3000 Mesh Wi-Fi System (3-pack)",
        "brand": "TP-Link", "category": "Networking",
        "featured": False, "best_seller": False,
        "sales_volume": "180+ sold this month",
        "images": ["/router2.jpeg", "/Router.jpeg", "/router3.jpeg"],
        "price": "39999.00", "compare_at_price": "45999.00",
        "stock_quantity": 8, "rating": "4.70", "review_count": 34,
        "description": "Covers up to 6500 sq ft with seamless roaming. Wi-Fi 6 AX3000, works with Alexa, TP-Link HomeShield security included.",
        "created_at": "2026-05-30T00:00:00Z",
        "promo_end_date": None,
        "features": ["Covers up to 6500 sq ft", "Wi-Fi 6 AX3000 speed", "Seamless roaming with AI mesh", "TP-Link HomeShield security"],
        "specs": {"Standard": "Wi-Fi 6 (802.11ax)", "Speed": "3000 Mbps", "Coverage": "6500 sq ft", "Units": "3-pack"},
    },

    # ═══════════════ ACCESSORIES (+2) ════════════════════════════════════════
    {
        "id": "prd_ac_01",
        "name": "Anker 737 Power Bank 24000mAh 140W",
        "brand": "Anker", "category": "Accessories",
        "featured": False, "best_seller": True,
        "sales_volume": "720+ sold this month",
        "images": ["/powerstation2.jpeg", "/powerstation.jpeg", "/powerstation3.jpeg"],
        "price": "18999.00", "compare_at_price": "22999.00",
        "stock_quantity": 32, "rating": "4.80", "review_count": 66,
        "description": "24000mAh with 140W two-way fast charging. Smart digital display, three ports (2x USB-C, 1x USB-A). Charges a MacBook Pro at full speed.",
        "created_at": "2026-06-08T00:00:00Z",
        "promo_end_date": None,
        "features": ["24000mAh capacity", "140W two-way fast charging", "Smart digital display", "Three ports (2x USB-C, 1x USB-A)"],
        "specs": {"Capacity": "24000 mAh", "Output": "140W", "Ports": "2x USB-C, 1x USB-A", "Weight": "630g"},
    },
    {
        "id": "prd_ac_02",
        "name": "Anker Nano II 65W GaN Charger",
        "brand": "Anker", "category": "Accessories",
        "featured": False, "best_seller": True,
        "sales_volume": "1.9k+ sold this month",
        "images": ["/powerstation3.jpeg", "/powerstation.jpeg", "/powerstation2.jpeg"],
        "price": "5999.00", "compare_at_price": "7999.00",
        "stock_quantity": 88, "rating": "4.70", "review_count": 194,
        "description": "65W GaN II charger with three ports. Charges a laptop, phone, and earbuds simultaneously. 58% smaller than a standard 61W charger.",
        "created_at": "2026-02-28T00:00:00Z",
        "promo_end_date": None,
        "features": ["65W GaN II technology", "Three ports (2x USB-C, 1x USB-A)", "58% smaller than stock chargers", "Foldable plug design"],
        "specs": {"Output": "65W total", "Ports": "2x USB-C, 1x USB-A", "Technology": "GaN II", "Weight": "112g"},
    },

    # ═══════════════ STORAGE (+3) ════════════════════════════════════════════
    {
        "id": "prd_st_01",
        "name": "Samsung T7 Shield 2TB Portable SSD",
        "brand": "Samsung", "category": "Storage",
        "featured": False, "best_seller": True,
        "sales_volume": "540+ sold this month",
        "images": ["/harddrives.jpeg", "/harddrives.jpeg", "/harddrives.jpeg"],
        "price": "27999.00", "compare_at_price": "32999.00",
        "stock_quantity": 24, "rating": "4.80", "review_count": 58,
        "description": "2TB portable SSD with 1,050 MB/s read and 1,000 MB/s write. IP65 water and dust resistance, drop-tested to 3m.",
        "created_at": "2026-05-15T00:00:00Z",
        "promo_end_date": None,
        "features": ["Up to 1,050 MB/s read speed", "IP65 water and dust resistant", "Drop-resistant to 3 meters", "USB 3.2 Gen 2 compatible"],
        "specs": {"Capacity": "2TB", "Read Speed": "1,050 MB/s", "Interface": "USB 3.2 Gen 2", "Weight": "98g"},
    },
    {
        "id": "prd_st_02",
        "name": "SanDisk Extreme Pro 128GB SDXC UHS-I Card",
        "brand": "SanDisk", "category": "Storage",
        "featured": False, "best_seller": False,
        "sales_volume": "620+ sold this month",
        "images": ["/harddrives.jpeg", "/harddrives.jpeg", "/harddrives.jpeg"],
        "price": "5999.00", "compare_at_price": "7499.00",
        "stock_quantity": 55, "rating": "4.80", "review_count": 82,
        "description": "128GB SD card with 200 MB/s read and 90 MB/s write. UHS Speed Class 3, V30, and U3 rated for 4K UHD video and burst photography.",
        "created_at": "2026-01-20T00:00:00Z",
        "promo_end_date": None,
        "features": ["Up to 200 MB/s read speed", "4K UHD and Full HD video ready", "UHS-I, U3, V30, Class 10", "Temperature, water, shock resistant"],
        "specs": {"Capacity": "128GB", "Read Speed": "200 MB/s", "Write Speed": "90 MB/s", "Speed Class": "V30 / U3 / C10"},
    },
    {
        "id": "prd_st_03",
        "name": "WD Elements 4TB Desktop External HDD",
        "brand": "Western Digital", "category": "Storage",
        "featured": False, "best_seller": False,
        "sales_volume": "310+ sold this month",
        "images": ["/harddrives.jpeg", "/harddrives.jpeg", "/harddrives.jpeg"],
        "price": "14999.00", "compare_at_price": "17999.00",
        "stock_quantity": 18, "rating": "4.60", "review_count": 42,
        "description": "4TB desktop HDD with USB 3.0 and plug-and-play setup. Works with Windows and macOS (reformat required for Mac). Includes power adapter.",
        "created_at": "2026-03-03T00:00:00Z",
        "promo_end_date": None,
        "features": ["4TB storage capacity", "USB 3.0 interface", "Plug-and-play with Windows", "Includes power adapter"],
        "specs": {"Capacity": "4TB", "Interface": "USB 3.0", "Form Factor": "Desktop 3.5-inch", "Warranty": "2 years"},
    },

    # ═══════════════ SMART HOME (+2) ═════════════════════════════════════════
    {
        "id": "prd_sh_01",
        "name": "Ring Video Doorbell Wired (2nd Gen)",
        "brand": "Ring", "category": "Smart Home",
        "featured": False, "best_seller": False,
        "sales_volume": "290+ sold this month",
        "images": ["/powerstation2.jpeg", "/powerstation.jpeg", "/powerstation3.jpeg"],
        "price": "12999.00", "compare_at_price": "15999.00",
        "stock_quantity": 22, "rating": "4.50", "review_count": 62,
        "description": "1080p HD video doorbell with two-way talk and advanced motion detection. Hardwired installation, works with Alexa and Ring app.",
        "created_at": "2026-06-02T00:00:00Z",
        "promo_end_date": None,
        "features": ["1080p HD video", "Two-way talk with noise cancellation", "Advanced motion detection", "Works with Alexa"],
        "specs": {"Video": "1080p HD", "Power": "Hardwired", "Connectivity": "Wi-Fi", "Field of View": "155°"},
    },
    {
        "id": "prd_sh_02",
        "name": "Anker eufy RoboVac 11S Robot Vacuum",
        "brand": "Anker", "category": "Smart Home",
        "featured": False, "best_seller": False,
        "sales_volume": "420+ sold this month",
        "images": ["/powerstation3.jpeg", "/powerstation.jpeg", "/powerstation2.jpeg"],
        "price": "32999.00", "compare_at_price": "38999.00",
        "stock_quantity": 12, "rating": "4.60", "review_count": 78,
        "description": "Slim 2.85-inch profile robot vacuum with 1300Pa suction. Up to 100 minutes runtime, self-charging, quiet operation under 55dB.",
        "created_at": "2026-04-14T00:00:00Z",
        "promo_end_date": None,
        "features": ["1300Pa suction power", "100 minutes runtime", "Slim 2.85-inch profile", "Quiet operation under 55dB"],
        "specs": {"Suction": "1300Pa", "Runtime": "100 minutes", "Height": "2.85 inches", "Noise Level": "<55dB"},
    },

    # ═══════════════ MONITORS (+2) ═══════════════════════════════════════════
    {
        "id": "prd_mn_01",
        "name": 'LG UltraGear 27" QHD 165Hz Gaming Monitor',
        "brand": "LG", "category": "Monitors",
        "featured": False, "best_seller": True,
        "sales_volume": "520+ sold this month",
        "images": ["/monitor2.jpeg", "/dellmonitor.jpeg", "/monitor3.jpeg"],
        "price": "44999.00", "compare_at_price": "52999.00",
        "stock_quantity": 14, "rating": "4.70", "review_count": 57,
        "description": '27" QHD IPS display with 165Hz refresh and 1ms response. NVIDIA G-SYNC compatible, AMD FreeSync Premium, HDR10.',
        "created_at": "2026-05-08T00:00:00Z",
        "promo_end_date": None,
        "features": ["QHD 2560 x 1440 resolution", "165Hz refresh rate", "1ms GtG response time", "NVIDIA G-SYNC compatible"],
        "specs": {"Screen Size": "27 inches", "Resolution": "2560 x 1440", "Refresh Rate": "165Hz", "Panel": "IPS"},
    },
    {
        "id": "prd_mn_02",
        "name": 'Samsung Odyssey G9 49" Ultrawide Curved',
        "brand": "Samsung", "category": "Monitors",
        "featured": False, "best_seller": False,
        "sales_volume": "95+ sold this month",
        "images": ["/monitor3.jpeg", "/dellmonitor.jpeg", "/monitor2.jpeg"],
        "price": "179999.00", "compare_at_price": "199999.00",
        "stock_quantity": 4, "rating": "4.80", "review_count": 19,
        "description": '49" super ultrawide at 5120x1440 with 240Hz refresh. 1000R curved VA panel, quantum dot, HDR1000, G-SYNC and FreeSync Premium Pro.',
        "created_at": "2026-06-25T00:00:00Z",
        "promo_end_date": None,
        "features": ["Super ultrawide 5120x1440", "240Hz refresh rate", "1000R curved VA panel", "HDR1000 certification"],
        "specs": {"Screen Size": "49 inches", "Resolution": "5120 x 1440", "Refresh Rate": "240Hz", "Curvature": "1000R"},
    },

    # ═══════════════ STREAMING DEVICES (+3) ══════════════════════════════════
    {
        "id": "prd_sd_01",
        "name": "Amazon Fire TV Stick 4K Max (2nd Gen)",
        "brand": "Amazon", "category": "Streaming Devices",
        "featured": False, "best_seller": True,
        "sales_volume": "980+ sold this month",
        "images": ["/tvs3.jpeg", "/tvs.jpeg", "/tvs2.jpeg"],
        "price": "8999.00", "compare_at_price": "10999.00",
        "stock_quantity": 42, "rating": "4.70", "review_count": 108,
        "description": "4K streaming with Wi-Fi 6E and 2GB RAM. Supports Dolby Vision, Atmos, HDR10+. Alexa voice remote included.",
        "created_at": "2026-04-30T00:00:00Z",
        "promo_end_date": None,
        "features": ["4K UHD streaming", "Wi-Fi 6E support", "Dolby Vision and Atmos", "Alexa voice remote included"],
        "specs": {"Resolution": "4K UHD", "RAM": "2GB", "Connectivity": "Wi-Fi 6E", "HDR": "Dolby Vision, HDR10+"},
    },
    {
        "id": "prd_sd_02",
        "name": "Google Chromecast with Google TV (4K)",
        "brand": "Google", "category": "Streaming Devices",
        "featured": False, "best_seller": True,
        "sales_volume": "760+ sold this month",
        "images": ["/tvs2.jpeg", "/tvs.jpeg", "/tvs3.jpeg"],
        "price": "9499.00", "compare_at_price": "11499.00",
        "stock_quantity": 36, "rating": "4.60", "review_count": 94,
        "description": "Streams in 4K HDR with Dolby Vision. Google TV recommends across apps, voice remote with Google Assistant built in.",
        "created_at": "2026-03-22T00:00:00Z",
        "promo_end_date": None,
        "features": ["4K HDR streaming", "Dolby Vision support", "Google TV interface", "Voice remote with Assistant"],
        "specs": {"Resolution": "4K HDR", "HDR": "Dolby Vision", "Connectivity": "Wi-Fi, HDMI", "Remote": "Voice with Assistant"},
    },
    {
        "id": "prd_sd_03",
        "name": "Roku Streaming Stick 4K",
        "brand": "Roku", "category": "Streaming Devices",
        "featured": False, "best_seller": False,
        "sales_volume": "410+ sold this month",
        "images": ["/tvs1.jpeg", "/tvs.jpeg", "/tvs3.jpeg"],
        "price": "7499.00", "compare_at_price": "9499.00",
        "stock_quantity": 28, "rating": "4.60", "review_count": 52,
        "description": "4K HDR streaming with Dolby Vision and Roku Voice Remote. Works with all major streaming apps and offers simple private listening through the mobile app.",
        "created_at": "2026-02-05T00:00:00Z",
        "promo_end_date": None,
        "features": ["4K HDR picture", "Dolby Vision and HDR10+", "Voice remote with TV controls", "Private listening via mobile app"],
        "specs": {"Resolution": "4K HDR", "HDR": "Dolby Vision, HDR10+", "Connectivity": "Wi-Fi, HDMI", "Remote": "Voice"},
    },
]


# ─────────────────────────────────────────────────────────────────────────────
def _parse_dt(value):
    if not value:
        return None
    s = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return dt


class Command(BaseCommand):
    help = "Seed the catalog with products from data/products.ts"

    def add_arguments(self, parser):
        parser.add_argument("--public-dir", default=None)
        parser.add_argument("--clear", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        public_dir = options["public_dir"]
        if public_dir:
            public_path = Path(public_dir).expanduser().resolve()
            if not public_path.is_dir():
                raise CommandError(f"--public-dir does not exist: {public_path}")
        else:
            public_path = None

        if options["clear"]:
            self.stdout.write("Clearing existing catalog rows…")
            self._delete_all_product_images()
            self._delete_all_category_images()
            self._delete_all_brand_logos()
            ProductSpec.objects.all().delete()
            ProductFeature.objects.all().delete()
            Product.objects.all().delete()
            Brand.objects.all().delete()
            Category.objects.all().delete()

        # ── Categories ────────────────────────────────────────────
        cat_stats = {"images": 0, "missing_images": []}
        for idx, (cat_name, icon_name) in enumerate(CATEGORY_ICONS.items(), start=1):
            cat, created = Category.objects.update_or_create(
                name=cat_name,
                defaults={
                    "slug": slugify(cat_name),
                    "icon_name": icon_name,
                    "sort_order": idx,
                    "is_active": True,
                },
            )
            if public_path:
                stored = self._attach_category_image(cat, cat_name, public_path)
                if stored:
                    cat_stats["images"] += 1
                else:
                    cat_stats["missing_images"].append(
                        CATEGORY_IMAGES.get(cat_name, "(no mapping)")
                    )
            verb = "created" if created else "kept"
            self.stdout.write(f"  Category {cat_name!r} — {verb}")

        # ── Brands ────────────────────────────────────────────────
        brand_stats = {"logos": 0, "missing_logos": []}
        for brand_name in sorted({p["brand"] for p in PRODUCTS}):
            brand, created = Brand.objects.update_or_create(
                name=brand_name,
                defaults={"slug": slugify(brand_name), "is_active": True},
            )
            if public_path:
                stored = self._attach_brand_logo(brand, brand_name, public_path)
                if stored:
                    brand_stats["logos"] += 1
                else:
                    brand_stats["missing_logos"].append(
                        BRAND_LOGOS.get(brand_name, "(no mapping)")
                    )
            verb = "created" if created else "kept"
            self.stdout.write(f"  Brand {brand_name!r} — {verb}")

        # ── Products ──────────────────────────────────────────────
        stats = {"products": 0, "images": 0, "features": 0, "specs": 0, "missing_images": []}

        for p in PRODUCTS:
            brand = Brand.objects.get(name=p["brand"])
            category = Category.objects.get(name=p["category"])

            product, _ = Product.objects.update_or_create(
                id=p["id"],
                defaults={
                    "name": p["name"],
                    "slug": slugify(p["name"])[:260],
                    "brand": brand,
                    "category": category,
                    "description": p["description"],
                    "price": Decimal(p["price"]),
                    "compare_at_price": (
                        Decimal(p["compare_at_price"]) if p["compare_at_price"] else None
                    ),
                    "stock_quantity": p["stock_quantity"],
                    "featured": p["featured"],
                    "best_seller": p["best_seller"],
                    "sales_volume": p.get("sales_volume", ""),
                    "sales_count": 0,
                    "rating_avg": Decimal(p["rating"]),
                    "review_count": p["review_count"],
                    "promo_end_date": _parse_dt(p.get("promo_end_date")),
                    "is_active": True,
                },
            )

            created_at = _parse_dt(p["created_at"])
            if created_at:
                Product.objects.filter(id=product.id).update(created_at=created_at)

            for img in product.images.all():
                if img.image:
                    img.image.delete(save=False)
                img.delete()

            for idx, img_path in enumerate(p["images"]):
                stored = self._attach_image(product, img_path, idx, public_path)
                if stored:
                    stats["images"] += 1
                elif public_path:
                    stats["missing_images"].append(img_path)

            product.features.all().delete()
            for idx, text in enumerate(p.get("features", [])):
                ProductFeature.objects.create(product=product, text=text, sort_order=idx)
                stats["features"] += 1

            product.specs.all().delete()
            for idx, (key, value) in enumerate(p.get("specs", {}).items()):
                ProductSpec.objects.create(product=product, key=key, value=value, sort_order=idx)
                stats["specs"] += 1

            stats["products"] += 1

        # ── Report ────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {stats['products']} products, "
            f"{stats['images']} images, "
            f"{stats['features']} features, "
            f"{stats['specs']} specs."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {cat_stats['images']} category image(s)."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {brand_stats['logos']} brand logo(s)."
        ))

        if stats["missing_images"]:
            self.stdout.write(self.style.WARNING(
                f"Skipped {len(stats['missing_images'])} product image(s):"
            ))
            for path in stats["missing_images"][:20]:
                self.stdout.write(f"  {path}")
            if len(stats["missing_images"]) > 20:
                self.stdout.write(f"  … and {len(stats['missing_images']) - 20} more")

        if cat_stats["missing_images"]:
            self.stdout.write(self.style.WARNING(
                f"Skipped {len(cat_stats['missing_images'])} category image(s):"
            ))
            for path in cat_stats["missing_images"]:
                self.stdout.write(f"  {path}")

        if brand_stats["missing_logos"]:
            self.stdout.write(self.style.WARNING(
                f"Skipped {len(brand_stats['missing_logos'])} brand logo(s):"
            ))
            for path in brand_stats["missing_logos"]:
                self.stdout.write(f"  {path}")

    # ── Helpers ───────────────────────────────────────────────────
    def _delete_all_product_images(self):
        for img in ProductImage.objects.all():
            if img.image:
                img.image.delete(save=False)
            img.delete()

    def _delete_all_category_images(self):
        for cat in Category.objects.exclude(image="").exclude(image__isnull=True):
            try:
                cat.image.delete(save=False)
            except Exception:
                pass

    def _delete_all_brand_logos(self):
        for brand in Brand.objects.exclude(logo="").exclude(logo__isnull=True):
            try:
                brand.logo.delete(save=False)
            except Exception:
                pass

    def _attach_category_image(self, category, cat_name, public_path):
        img_path = CATEGORY_IMAGES.get(cat_name)
        if not img_path:
            return False
        src = public_path / img_path.lstrip("/")
        if not src.is_file():
            return False
        if category.image:
            category.image.delete(save=False)
        with src.open("rb") as fh:
            category.image.save(src.name, File(fh), save=True)
        return True

    def _attach_brand_logo(self, brand, brand_name, public_path):
        """
        Copy the brand logo from the Next.js `public/` folder into the
        Brand's `logo` ImageField. Returns True on success, False if the
        mapping is missing or the file isn't on disk.
        """
        logo_path = BRAND_LOGOS.get(brand_name)
        if not logo_path:
            return False

        src = public_path / logo_path.lstrip("/")
        if not src.is_file():
            return False

        if brand.logo:
            brand.logo.delete(save=False)

        with src.open("rb") as fh:
            brand.logo.save(src.name, File(fh), save=True)

        return True

    def _attach_image(self, product, img_path, idx, public_path):
        if not public_path:
            return False
        rel = img_path.lstrip("/")
        src = public_path / rel
        if not src.is_file():
            return False
        with src.open("rb") as fh:
            instance = ProductImage(
                product=product,
                alt_text=product.name,
                sort_order=idx,
                is_primary=(idx == 0),
            )
            instance.image.save(src.name, File(fh), save=True)
        return True