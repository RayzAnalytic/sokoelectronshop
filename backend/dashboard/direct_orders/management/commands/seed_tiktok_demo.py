from __future__ import annotations

import random
from datetime import timedelta
from decimal import Decimal

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from dashboard.direct_orders.models import (
    AttributionLink,
    AuditLog,
    Automation,
    Campaign,
    ContentPost,
    Coupon,
    Creator,
    CreatorSale,
    Customer,
    DeliveryZone,
    DirectOrder,
    DirectOrderItem,
    DirectProduct,
    Expense,
    InboxConversation,
    InboxMessage,
    InventoryMovement,
    LiveSession,
    Location,
    Notification,
    PayoutBatch,
    ProductVariant,
    PurchaseOrder,
    PurchaseOrderItem,
    ReturnRequest,
    Review,
    Supplier,
    TeamMember,
)

BRANDS = ["SokoFlow", "Nia Naturals", "Trendy KE", "Amina's Kitchen"]

CATEGORIES = [
    "Bags", "Skincare", "Apparel", "Accessories",
    "Electronics", "Home", "Beauty", "Footwear",
]

# Names that older versions of this seed inserted into catalog.Product.
# Removed automatically so the catalog only contains the products
# created by `seed_catalog`.
FAKE_PRODUCT_NAMES = [
    "Ankara Tote Bag", "Kente Scarf", "Nia Shea Butter 250ml",
    "Wireless Earbuds Pro", "Beaded Maasai Bracelet", "Handwoven Kiondo Basket",
    "Kitenge Head Wrap", "Nia Lip Balm Duo", "Beaded Sandals — Sunset",
    "Amina's Chai Spice Blend", "Leather Card Wallet", "Silk Hair Bonnet",
]

CREATORS = [
    ("Amina Wanjiku", "amina.styles", 45200, "Fashion", Decimal("15.00"), "TikTok", "Active", "0712345678", "amina@example.com"),
    ("Brian Otieno", "brian.ke", 12800, "Tech", Decimal("12.00"), "TikTok", "Active", "0723456789", "brian@example.com"),
    ("Cynthia Njeri", "cynthia.beauty", 120500, "Beauty", Decimal("18.00"), "TikTok", "Active", "0734567890", "cynthia@example.com"),
    ("David Kimani", "dave.unbox", 8400, "Unboxing", Decimal("10.00"), "Instagram", "Active", "0745678901", "dave@example.com"),
    ("Faith Achieng", "faith.lives", 67900, "Lifestyle", Decimal("15.00"), "TikTok", "Inactive", "0756789012", "faith@example.com"),
]

SAMPLE_VIDEOS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
]

CONTENT_POSTS = [
    ("Unboxing — Ankara Tote Bag", "Video", "Posted", "TikTok", True, -5, 45200, 3120, 148, 220, 90),
    ("GRWM feat. Nia Shea Butter", "Video", "Posted", "TikTok", True, -3, 28700, 1980, 92, 140, 62),
    ("Quick review — Wireless Earbuds", "Video", "Scheduled", "TikTok", True, 2, 0, 0, 0, 0, 0),
    ("3 ways to style the Kente Scarf", "Photo Carousel", "Posted", "TikTok", False, -7, 12400, 890, 41, 55, 22),
    ("Behind the scenes — photoshoot", "Video", "Posted", "TikTok", True, -2, 18900, 1240, 67, 95, 40),
    ("TikTok LIVE tomorrow at 8pm!", "LIVE Promo", "Scheduled", "TikTok", False, 1, 0, 0, 0, 0, 0),
    ("Customer testimonial — Grace", "Video", "Draft", "TikTok", True, 0, 0, 0, 0, 0, 0),
    ("Flash sale teaser", "Video", "Draft", "Instagram", False, 0, 0, 0, 0, 0, 0),
    ("Beaded Sandals walkthrough", "Video", "Posted", "TikTok", True, -10, 32100, 2410, 118, 180, 75),
    ("Chai recipe with our blend", "Video", "Posted", "TikTok", True, -14, 87600, 6420, 289, 420, 168),
]

LIVE_SESSIONS = [
    ("Friday Flash Sale — Beauty", "Ended", -5, "Cynthia Njeri", "Cynthia Njeri", 2340, 4800, 47, Decimal("168300.00"), "Nia Shea Butter 250ml", "FLASH15"),
    ("Weekend Deals — Bags & Accessories", "Ended", -2, "Amina Wanjiku", "Amina Wanjiku", 1890, 3600, 32, Decimal("96450.00"), "Ankara Tote Bag", "WEEKEND10"),
    ("LIVE now — Unboxing session", "Live", 0, "Brian Otieno", "Brian Otieno", 340, 890, 6, Decimal("12750.00"), "Wireless Earbuds Pro", "LIVE5"),
    ("Midweek Madness — Skincare", "Scheduled", 3, "Cynthia Njeri", "", 0, 0, 0, Decimal("0.00"), "", "MIDWEEK20"),
    ("Payday Special — Footwear", "Scheduled", 7, "Amina Wanjiku", "", 0, 0, 0, Decimal("0.00"), "", "PAYDAY15"),
]

CUSTOMER_NAMES = [
    "Grace Mwangi", "Peter Kamau", "Mercy Wanjiru", "James Odhiambo",
    "Esther Njoki", "Samuel Kipchoge", "Lucy Akinyi", "Michael Onyango",
    "Sarah Chebet", "Daniel Mutua", "Winnie Achieng", "Kevin Njoroge",
    "Diana Wairimu", "Felix Barasa", "Irene Nekesa", "George Mbugua",
    "Pauline Wambui", "Dennis Omondi", "Nancy Wanjiku", "Eric Kariuki",
    "Priscilla Adhiambo", "Anthony Maina", "Beatrice Atieno", "Stephen Kilonzo",
    "Rose Achieng", "Patrick Njoroge", "Susan Wanjiru", "Joseph Kamau",
]

COUNTIES = [
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret",
    "Thika", "Nyeri", "Machakos", "Kajiado", "Kiambu",
]

ESTATES = [
    "Westlands", "Kilimani", "Kasarani", "Embakasi", "Runda",
    "Karen", "Nyali", "Milimani", "Section 58", "Ruaka",
]

ORDER_SOURCES = ["whatsapp", "whatsapp", "whatsapp", "admin", "phone", "live", "video_dm", "bio_link"]

ORDER_STATUS_WEIGHTS = [
    ("New", 3),
    ("Awaiting Payment", 2),
    ("Paid", 4),
    ("Awaiting Shipment", 4),
    ("Shipped", 4),
    ("Delivered", 5),
    ("Cancelled", 1),
    ("Returned", 1),
]

NOTES_SNIPPETS = [
    "Customer prefers delivery after 6pm.",
    "Called after LIVE — requested gift wrap.",
    "Repeat customer — apply loyalty discount next time.",
    "Confirmed M-Pesa code over WhatsApp.",
    "Wants to add another item to the order.",
    "Confirmed delivery to Kilimani office.",
    "",
    "",
    "",
]

COURIERS = ["pickup_mtaani", "sendy", "g4s", "boda", "rider"]

SHIPPING_ZONES = ["nairobi", "mombasa", "kisumu", "nakuru", "eldoret"]

SUPPLIERS = [
    ("Nairobi Textiles Ltd", "0722111222", "supply@nairobitextiles.co.ke", "Industrial Area, Nairobi", "Jane Kamau", "30 days", "P051234567A"),
    ("Kariobangi Leather Works", "0733222333", "info@kariobangleather.co.ke", "Kariobangi, Nairobi", "Peter Mwangi", "15 days", "P051234568B"),
    ("Nia Naturals HQ", "0744333444", "orders@nianaturals.co.ke", "Karen, Nairobi", "Grace Njeri", "Cash on delivery", "P051234569C"),
    ("Coastal Crafts", "0755444555", "hello@coastalcrafts.co.ke", "Old Town, Mombasa", "Ahmed Salim", "45 days", "P051234570D"),
]

LOCATIONS = [
    ("Main Warehouse", "warehouse", "Industrial Area, Nairobi", "Nairobi", True),
    ("Westlands Shop", "shop", "Sarit Centre, Westlands", "Nairobi", False),
    ("Mombasa Pickup", "pickup", "Nyali Centre, Mombasa", "Mombasa", False),
]

DELIVERY_ZONES = [
    ("Nairobi CBD", "nairobi", ["Nairobi"], Decimal("250.00"), Decimal("5000.00"), 1, 1),
    ("Nairobi Suburbs", "nairobi", ["Nairobi"], Decimal("350.00"), Decimal("7000.00"), 1, 2),
    ("Mombasa Metro", "mombasa", ["Mombasa"], Decimal("400.00"), Decimal("8000.00"), 2, 3),
    ("Kisumu Metro", "kisumu", ["Kisumu"], Decimal("450.00"), Decimal("10000.00"), 2, 3),
    ("Nakuru Metro", "nakuru", ["Nakuru"], Decimal("400.00"), Decimal("8000.00"), 2, 3),
    ("Upcountry Towns", "upcountry", ["Nyeri", "Machakos", "Kiambu", "Kajiado"], Decimal("500.00"), Decimal("12000.00"), 3, 5),
]

COUPONS = [
    ("WELCOME10", "10% off first order", Decimal("10.00"), Decimal("0.00"), Decimal("1000.00"), 100),
    ("FLASH15", "15% off flash sale", Decimal("15.00"), Decimal("0.00"), Decimal("2000.00"), 50),
    ("WEEKEND10", "Weekend special", Decimal("10.00"), Decimal("0.00"), Decimal("0.00"), 0),
    ("MIDWEEK20", "Midweek madness", Decimal("20.00"), Decimal("0.00"), Decimal("3000.00"), 30),
    ("PAYDAY500", "KES 500 off payday orders", Decimal("0.00"), Decimal("500.00"), Decimal("5000.00"), 40),
]

CAMPAIGNS = [
    ("Back to School — Bags", "back-to-school-bags", "Active", 30, Decimal("50000.00")),
    ("Valentine's Day Special", "valentines-day", "Ended", -60, Decimal("30000.00")),
    ("Payday Weekend Sale", "payday-weekend", "Active", 15, Decimal("80000.00")),
    ("Customer Appreciation Week", "customer-appreciation", "Draft", 45, Decimal("25000.00")),
]

TEAM_MEMBERS = [
    ("Faith Mwikali", "faith@sokoflow.co.ke", "0711001001", "Owner", "Active"),
    ("Brian Otieno", "brian@sokoflow.co.ke", "0722002002", "Operations", "Active"),
    ("Amina Yusuf", "amina@sokoflow.co.ke", "0733003003", "Content", "Active"),
    ("Kevin Kariuki", "kevin@sokoflow.co.ke", "0744004004", "Finance", "Active"),
    ("Wanjiru Kamau", "wanjiru@sokoflow.co.ke", "0755005005", "Support", "Invited"),
]

INBOX_SEEDS = [
    ("whatsapp", "open", "Amina Wanjiku", "+254712481220", "Hi, is the Ankara tote still available? I want 2.", 2, [
        ("in", "Hi, is the Ankara tote still available? I want 2."),
    ]),
    ("tiktok_dm", "open", "@brian.kim", "@brian.kim", "Saw the video — how much for the leather wallet?", 1, [
        ("in", "Saw the video — how much for the leather wallet?"),
    ]),
    ("tiktok_comment", "pending", "@faith.mueni", "@faith.mueni", "Do you deliver to Nakuru? Interested in the lip kit.", 0, [
        ("in", "Do you deliver to Nakuru? Interested in the lip kit."),
        ("out", "Yes! We deliver to Nakuru in 2-3 days. Would you like me to reserve one?"),
    ]),
    ("whatsapp", "converted", "Otieno Mark", "+254733908114", "Payment sent — M-Pesa code QK73X92LM. Please confirm.", 0, [
        ("in", "Payment sent — M-Pesa code QK73X92LM. Please confirm."),
        ("out", "Confirmed! Your order will ship tomorrow."),
    ]),
    ("tiktok_dm", "open", "@soko.lover", "@soko.lover", "Can I get a bundle discount for 3 units?", 0, [
        ("in", "Can I get a bundle discount for 3 units?"),
    ]),
    ("instagram_dm", "open", "@nairobi_styles", "@nairobi_styles", "Do you have this in size 38?", 0, [
        ("in", "Do you have this in size 38?"),
    ]),
]

RETURN_SEEDS = [
    ("damaged", "Item arrived with a broken strap", Decimal("1500.00"), True, "Received"),
    ("wrong_item", "Received wrong color variant", Decimal("1200.00"), True, "Refunded"),
    ("not_as_described", "Fabric feels different from photos", Decimal("2200.00"), False, "Approved"),
    ("changed_mind", "Customer changed their mind", Decimal("850.00"), False, "Rejected"),
]

EXPENSE_SEEDS = [
    ("Restock — Ankara bags", "inventory", Decimal("45000.00"), "M-Pesa"),
    ("Courier — Weekly settlement", "shipping", Decimal("12500.00"), "M-Pesa"),
    ("TikTok ads top-up", "marketing", Decimal("20000.00"), "Card"),
    ("Shopify subscription", "software", Decimal("3200.00"), "Card"),
    ("Warehouse rent — March", "rent", Decimal("35000.00"), "Bank Transfer"),
    ("Electricity bill", "utilities", Decimal("8400.00"), "M-Pesa"),
    ("Staff salary — Amina", "salaries", Decimal("45000.00"), "Bank Transfer"),
    ("KRA withholding tax", "tax", Decimal("12500.00"), "Bank Transfer"),
]

AUTOMATION_SEEDS = [
    ("Welcome new order", "order_created", "whatsapp", "Active", 0, "Hi {{name}}, thanks for your order {{ref}}! We'll confirm shortly."),
    ("Payment reminder", "order_created", "whatsapp", "Active", 60, "Hi {{name}}, just a reminder to complete payment for {{ref}}."),
    ("Shipping notification", "order_shipped", "whatsapp", "Active", 0, "Your order {{ref}} has shipped! Track it here: {{tracking}}"),
    ("Delivery confirmation", "order_delivered", "whatsapp", "Active", 0, "Order {{ref}} delivered. Leave us a review!"),
    ("Low stock alert", "low_stock", "notify_team", "Active", 0, ""),
    ("LIVE reminder", "live_scheduled", "whatsapp", "Active", 60, "Going live in 1 hour! Join us at 8pm for exclusive deals."),
    ("Customer birthday", "customer_birthday", "whatsapp", "Draft", 0, "Happy birthday {{name}}! Enjoy 15% off your next order."),
]

REVIEW_SEEDS = [
    (5, "Love the Ankara tote!", "Perfect size, beautiful colors. Will order again.", "Approved", True, True),
    (5, "Shea butter is amazing", "Skin feels so soft after a week. Highly recommend.", "Approved", True, False),
    (4, "Earbuds sound great", "Battery could last longer but sound is excellent.", "Approved", False, False),
    (5, "Kente scarf is perfect", "Got so many compliments. Beautiful quality.", "Approved", True, True),
    (3, "Bracelet smaller than expected", "Pretty but smaller than the photo suggested.", "Pending", False, False),
    (5, "Excellent service", "Fast delivery, well packaged. Five stars.", "Approved", False, False),
]

PAYOUT_SEEDS = [
    ("Payout — Week 12", "Paid"),
    ("Payout — Week 13", "Paid"),
    ("Payout — Week 14", "Approved"),
    ("Payout — Week 15", "Pending"),
    ("Payout — Week 16", "Draft"),
]


def _weighted_statuses():
    out = []
    for status, count in ORDER_STATUS_WEIGHTS:
        out.extend([status] * count)
    return out


def _pick_phone(i: int) -> str:
    prefix = ["0712", "0722", "0733", "0745", "0757", "0790", "0740", "0768"][i % 8]
    body = f"{100000 + (i * 7919) % 900000:06d}"
    return f"+254{prefix[1:]}{body}"


def _pick_email(name: str, i: int) -> str:
    slug = name.lower().replace(" ", ".").replace("'", "")
    domain = ["gmail.com", "yahoo.com", "outlook.com"][i % 3]
    return f"{slug}{i}@{domain}"


def _pick_product_image(seed: str) -> str:
    return f"https://picsum.photos/seed/{seed}/600/800"


def _pick_avatar(seed: str) -> str:
    return f"https://picsum.photos/seed/{seed}/200/200"


def _get_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError as exc:
        raise CommandError(
            f"Model {app_label}.{model_name} not found. Check INSTALLED_APPS and app labels."
        ) from exc


class Command(BaseCommand):
    help = "Seed realistic demo data for the TikTok Business dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true")
        parser.add_argument("--with-checkout-orders", action="store_true")
        parser.add_argument("--quiet", action="store_true")

    def handle(self, *args, **options):
        self.quiet = options["quiet"]
        self.flush = options["flush"]
        self.with_checkout = options["with_checkout_orders"]

        self._check_prerequisites()

        if self.flush:
            self._flush()

        with transaction.atomic():
            brands = self._seed_brands()
            categories = self._seed_categories()
            suppliers = self._seed_suppliers()
            locations = self._seed_locations()
            delivery_zones = self._seed_delivery_zones()
            products = self._seed_products(brands, categories, suppliers)
            variants = self._seed_variants(products)
            creators = self._seed_creators()
            campaigns = self._seed_campaigns()
            attribution = self._seed_attribution(creators, campaigns, products)
            content = self._seed_content(products, creators, campaigns)
            lives = self._seed_lives(products, creators, campaigns)
            coupons = self._seed_coupons()
            self._seed_delivery_zones_attach(delivery_zones)
            customers = self._seed_customers()
            team = self._seed_team(locations)
            checkout_orders = self._ensure_checkout_orders()
            self._seed_creator_sales(creators, checkout_orders)
            direct_orders = self._seed_direct_orders(
                products, customers, creators, attribution, campaigns, coupons,
            )
            self._seed_inventory_movements(products, variants, locations)
            self._seed_purchase_orders(suppliers, products)
            self._seed_payouts(creators, checkout_orders)
            self._seed_inbox(customers)
            self._seed_returns(direct_orders)
            self._seed_expenses()
            self._seed_automations()
            self._seed_reviews(direct_orders, products)
            self._seed_notifications(team)
            self._seed_audit()
            self._recompute_rollups()

        self._print_summary()

    def _check_prerequisites(self):
        installed = {a.label for a in apps.get_app_configs()}
        required_apps = {"catalog", "checkout", "direct_orders"}
        missing = required_apps - installed
        if missing:
            raise CommandError(
                f"Missing required app(s): {', '.join(sorted(missing))}. "
                f"Installed labels: {', '.join(sorted(installed))}"
            )
        for app_label, model_name in [
            ("catalog", "Product"),
            ("catalog", "Brand"),
            ("catalog", "Category"),
            ("checkout", "Order"),
            ("checkout", "OrderItem"),
        ]:
            _get_model(app_label, model_name)

    def _flush(self):
        self._log("Flushing seeded rows…")
        InboxMessage.objects.all().delete()
        InboxConversation.objects.all().delete()
        AuditLog.objects.all().delete()
        Notification.objects.all().delete()
        Automation.objects.all().delete()
        Expense.objects.all().delete()
        ReturnRequest.objects.all().delete()
        Review.objects.all().delete()
        CreatorSale.objects.all().delete()
        PayoutBatch.objects.all().delete()
        DirectOrderItem.objects.all().delete()
        DirectOrder.objects.all().delete()
        PurchaseOrderItem.objects.all().delete()
        PurchaseOrder.objects.all().delete()
        InventoryMovement.objects.all().delete()
        ProductVariant.objects.all().delete()
        ContentPost.objects.all().delete()
        LiveSession.objects.all().delete()
        DirectProduct.objects.all().delete()
        Creator.objects.all().delete()
        Customer.objects.all().delete()
        Supplier.objects.all().delete()
        Location.objects.all().delete()
        TeamMember.objects.all().delete()
        AttributionLink.objects.all().delete()
        Coupon.objects.all().delete()
        DeliveryZone.objects.all().delete()
        Campaign.objects.all().delete()

    def _seed_brands(self):
        Brand = _get_model("catalog", "Brand")
        out = {}
        for name in BRANDS:
            obj, _ = Brand.objects.get_or_create(name=name)
            out[name] = obj
        self._log(f"Brands: {len(out)}")
        return out

    def _seed_categories(self):
        Category = _get_model("catalog", "Category")
        out = {}
        for name in CATEGORIES:
            obj, _ = Category.objects.get_or_create(name=name)
            out[name] = obj
        self._log(f"Categories: {len(out)}")
        return out

    def _seed_suppliers(self):
        out = []
        for name, phone, email, address, contact, terms, pin in SUPPLIERS:
            obj, _ = Supplier.objects.get_or_create(
                name=name,
                defaults={
                    "phone": phone, "email": email, "address": address,
                    "contact_person": contact, "payment_terms": terms,
                    "tax_pin": pin, "is_active": True,
                },
            )
            out.append(obj)
        self._log(f"Suppliers: {len(out)}")
        return out

    def _seed_locations(self):
        out = []
        for name, kind, address, county, is_default in LOCATIONS:
            obj, _ = Location.objects.get_or_create(
                name=name,
                defaults={
                    "kind": kind, "address": address,
                    "county": county, "is_default": is_default,
                },
            )
            out.append(obj)
        self._log(f"Locations: {len(out)}")
        return out

    def _seed_delivery_zones(self):
        out = []
        for name, zone, counties, fee, free_over, min_d, max_d in DELIVERY_ZONES:
            obj, _ = DeliveryZone.objects.get_or_create(
                name=name,
                defaults={
                    "zone": zone, "counties": counties,
                    "base_fee": fee, "free_over": free_over,
                    "eta_days_min": min_d, "eta_days_max": max_d,
                    "is_active": True,
                },
            )
            out.append(obj)
        self._log(f"DeliveryZones: {len(out)}")
        return out

    def _seed_delivery_zones_attach(self, zones):
        pass

    def _seed_products(self, brands, categories, suppliers):
        """Wrap real catalog.Product rows in DirectProduct.

        Never inserts into catalog.Product — that table is managed
        exclusively by ``python manage.py seed_catalog``.
        """
        Product = _get_model("catalog", "Product")

        cleaned = Product.objects.filter(name__in=FAKE_PRODUCT_NAMES).delete()[0]
        if cleaned:
            self._log(
                f"Cleaned up {cleaned} leftover fake product(s) from earlier seed runs"
            )

        real_products = list(Product.objects.all().order_by("id"))
        if not real_products:
            self._log(
                "DirectProducts: 0 — catalog.Product is empty. "
                "Run `python manage.py seed_catalog` first."
            )
            return []

        wrappers = []
        for idx, product in enumerate(real_products):
            is_viral = idx < 3
            has_video = idx < 5
            price = getattr(product, "price", None)
            cost = (
                (price * Decimal("0.5")).quantize(Decimal("0.01"))
                if price else Decimal("100.00")
            )

            wrapper, _ = DirectProduct.objects.get_or_create(
                product=product,
                defaults={
                    "status": "Active",
                    "viral": is_viral,
                    "video_link": SAMPLE_VIDEOS[idx % len(SAMPLE_VIDEOS)] if has_video else "",
                    "low_stock_threshold": 5,
                    "linked_to_website": True,
                    "cost_price": cost,
                    "reorder_point": 10,
                    "reorder_quantity": 20,
                    "commission_rate": Decimal("10.00"),
                    "supplier": suppliers[idx % len(suppliers)] if suppliers else None,
                },
            )
            wrappers.append(wrapper)

        self._log(f"DirectProducts: {len(wrappers)} (wrapped from real catalog.Product)")
        return wrappers

    def _seed_variants(self, products):
        if not products:
            self._log("ProductVariants: 0 (no products)")
            return
        VariantSpecs = [
            [("Small", "S", "", Decimal("0.00"), 15), ("Medium", "M", "", Decimal("0.00"), 20), ("Large", "L", "", Decimal("100.00"), 7)],
            [("Red", "", "Red", Decimal("0.00"), 8), ("Blue", "", "Blue", Decimal("0.00"), 12), ("Green", "", "Green", Decimal("0.00"), 8)],
            [("250ml", "", "", Decimal("0.00"), 25), ("500ml", "", "", Decimal("600.00"), 12)],
            [("Black", "", "Black", Decimal("0.00"), 10), ("White", "", "White", Decimal("0.00"), 5)],
            [("Standard", "", "", Decimal("0.00"), 64)],
        ]
        count = 0
        for i, wrapper in enumerate(products[:5]):
            specs = VariantSpecs[i % len(VariantSpecs)]
            for name, size, color, delta, stock in specs:
                _, created = ProductVariant.objects.get_or_create(
                    product=wrapper, name=name,
                    defaults={
                        "sku": f"{wrapper.pk}-{name.upper()[:3]}",
                        "size": size, "color": color,
                        "price_delta": delta, "stock_quantity": stock,
                    },
                )
                if created:
                    count += 1
        self._log(f"ProductVariants: {count}")

    def _seed_creators(self):
        out = []
        for name, handle, followers, niche, rate, platform, status, phone, email in CREATORS:
            obj, _ = Creator.objects.get_or_create(
                handle=handle,
                defaults={
                    "name": name, "followers": followers, "niche": niche,
                    "commission_rate": rate, "platform": platform,
                    "status": status, "avatar_url": _pick_avatar(handle),
                    "start_date": (timezone.now() - timedelta(days=90)).date(),
                    "phone": phone, "email": email,
                    "payout_method": "M-Pesa", "payout_phone": phone,
                    "engagement_rate": Decimal("4.50"),
                    "avg_views": followers * 2,
                },
            )
            out.append(obj)
        self._log(f"Creators: {len(out)}")
        return out

    def _seed_campaigns(self):
        out = []
        for name, slug, status, offset, budget in CAMPAIGNS:
            obj, _ = Campaign.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name, "status": status,
                    "budget": budget,
                    "starts_at": timezone.now() + timedelta(days=offset - 15),
                    "ends_at": timezone.now() + timedelta(days=offset + 15),
                    "objective": "Drive TikTok sales",
                },
            )
            out.append(obj)
        self._log(f"Campaigns: {len(out)}")
        return out

    def _seed_attribution(self, creators, campaigns, products):
        count = 0
        for c in creators:
            code = f"CRT-{c.handle.upper().replace('.', '_').replace(' ', '_')[:20]}"
            _, created = AttributionLink.objects.get_or_create(
                code=code,
                defaults={
                    "kind": "code",
                    "label": f"{c.name} referral",
                    "creator": c,
                    "is_active": c.status == "Active",
                },
            )
            if created:
                count += 1
        for camp in campaigns:
            code = f"CMP-{camp.slug.upper()[:16]}"
            _, created = AttributionLink.objects.get_or_create(
                code=code,
                defaults={
                    "kind": "utm",
                    "label": camp.name,
                    "utm_source": "tiktok",
                    "utm_medium": "campaign",
                    "utm_campaign": camp.slug,
                    "campaign": camp,
                    "is_active": camp.status == "Active",
                },
            )
            if created:
                count += 1
        self._log(f"AttributionLinks: {count}")

    def _seed_content(self, products, creators, campaigns):
        if not products:
            self._log("ContentPosts: skipped (no catalog products)")
            return
        product_names = [w.product.name for w in products]
        count = 0
        for i, (
            title, ctype, status, platform, has_video,
            days_offset, views, likes, comments, shares, saves,
        ) in enumerate(CONTENT_POSTS):
            scheduled_at = None
            if days_offset != 0 or status in ("Posted", "Scheduled"):
                scheduled_at = timezone.now() + timedelta(days=days_offset)

            featured = [product_names[i % len(product_names)]]
            defaults = {
                "content_type": ctype, "status": status, "platform": platform,
                "scheduled_at": scheduled_at,
                "hook": "Wait for it…" if has_video else "",
                "caption": f"Check out {featured[0]} — link in bio! #kenya #tiktokshop",
                "hashtags": "#kenya #tiktokshop #nairobi",
                "sound": "original sound — sokoflow",
                "products": featured,
                "views": views, "likes": likes, "comments": comments,
                "shares": shares, "saves": saves,
                "video_url": SAMPLE_VIDEOS[i % len(SAMPLE_VIDEOS)] if has_video else "",
                "thumbnail_url": _pick_product_image(f"thumb-{i}"),
                "posted_url": f"https://www.tiktok.com/@demo/video/{1000000000 + i}" if status == "Posted" else "",
                "creator": creators[i % len(creators)] if creators else None,
                "campaign": campaigns[i % len(campaigns)] if campaigns else None,
            }

            ContentPost.objects.get_or_create(title=title, defaults=defaults)
            count += 1
        self._log(f"ContentPosts: {count}")

    def _seed_lives(self, products, creators, campaigns):
        if not products:
            self._log("LiveSessions: skipped (no catalog products)")
            return
        product_names = [w.product.name for w in products]
        count = 0
        for i, (
            title, status, days_offset, host, cohost, peak, total,
            orders_count, revenue, top_product, coupon,
        ) in enumerate(LIVE_SESSIONS):
            scheduled_start = timezone.now() + timedelta(days=days_offset, hours=20)
            defaults = {
                "scheduled_start": scheduled_start,
                "scheduled_end": scheduled_start + timedelta(minutes=90),
                "duration_min": 90,
                "status": status, "host_name": host, "cohost_name": cohost,
                "products": product_names[:4],
                "peak_viewers": peak, "total_viewers": total,
                "orders_generated": orders_count, "revenue": revenue,
                "top_product": top_product, "coupon_code": coupon,
                "run_sheet": "1. Intro (5 min)\n2. Product showcase (20 min)\n3. Flash deals (30 min)\n4. Giveaways (15 min)\n5. Closing (5 min)",
                "creator": creators[i % len(creators)] if creators else None,
                "campaign": campaigns[i % len(campaigns)] if campaigns else None,
            }
            LiveSession.objects.get_or_create(title=title, defaults=defaults)
            count += 1
        self._log(f"LiveSessions: {count}")

    def _seed_coupons(self):
        out = []
        for code, desc, pct, amt, minv, maxu in COUPONS:
            obj, _ = Coupon.objects.get_or_create(
                code=code,
                defaults={
                    "description": desc, "percent_off": pct, "amount_off": amt,
                    "min_order_value": minv, "max_uses": maxu, "is_active": True,
                },
            )
            out.append(obj)
        self._log(f"Coupons: {len(out)}")
        return out

    def _seed_customers(self):
        out = []
        for i, name in enumerate(CUSTOMER_NAMES):
            obj, _ = Customer.objects.get_or_create(
                phone=_pick_phone(i),
                defaults={
                    "name": name,
                    "email": _pick_email(name, i),
                    "county": COUNTIES[i % len(COUNTIES)],
                    "estate": ESTATES[i % len(ESTATES)],
                    "segment": "New",
                    "whatsapp_opt_in": True,
                },
            )
            out.append(obj)
        self._log(f"Customers: {len(out)}")
        return out

    def _seed_team(self, locations):
        out = []
        for name, email, phone, role, status in TEAM_MEMBERS:
            obj, _ = TeamMember.objects.get_or_create(
                email=email,
                defaults={
                    "name": name, "phone": phone, "role": role,
                    "status": status, "permissions": {},
                    "location": locations[0] if locations else None,
                },
            )
            out.append(obj)
        self._log(f"TeamMembers: {len(out)}")
        return out

    def _ensure_checkout_orders(self):
        Order = _get_model("checkout", "Order")
        existing = list(Order.objects.all()[:30])
        if existing:
            self._log(f"Checkout orders found: {len(existing)}")
            return existing

        if not self.with_checkout:
            self._log("No checkout.Order rows — skipping CreatorSale seed.")
            return []

        created = []
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            admin_user = User.objects.filter(is_staff=True).first()
        except Exception:
            admin_user = None

        for i in range(10):
            ref = f"ORD-{timezone.now():%Y%m%d}-SEED{i:02d}"
            try:
                order, _ = Order.objects.get_or_create(
                    reference=ref,
                    defaults={
                        "user": admin_user, "source": "whatsapp",
                        "status": "delivered", "payment_status": "paid",
                        "payment_method": "MPESA",
                        "contact_email": f"customer{i}@example.com",
                        "contact_phone": _pick_phone(i),
                        "total": Decimal(str(random.randint(2000, 15000))),
                        "snapshot": {"full_name": CUSTOMER_NAMES[i % len(CUSTOMER_NAMES)]},
                        "channel_meta": {"origin": "tiktok_video"},
                    },
                )
                created.append(order)
            except Exception as exc:
                self._log(f"  Skipped {ref}: {exc}")

        self._log(f"Fallback checkout orders: {len(created)}")
        return created

    def _seed_creator_sales(self, creators, checkout_orders):
        if not checkout_orders:
            self._log("CreatorSales: skipped")
            return
        count = 0
        for i, order in enumerate(checkout_orders):
            creator = creators[i % len(creators)]
            rate = creator.commission_rate
            try:
                total = Decimal(str(getattr(order, "total", 0) or 0))
            except Exception:
                total = Decimal("5000.00")
            commission = (total * rate / Decimal("100")).quantize(Decimal("0.01"))
            paid = i % 3 != 0
            _, created = CreatorSale.objects.get_or_create(
                creator=creator, order=order,
                defaults={
                    "commission_rate": rate,
                    "commission_amount": commission,
                    "paid": paid,
                    "paid_at": timezone.now() if paid else None,
                    "payout_reference": f"PAY-{i:04d}" if paid else "",
                },
            )
            if created:
                count += 1
        self._log(f"CreatorSales: {count}")

    def _seed_payouts(self, creators, checkout_orders):
        count = 0
        for i, (ref, status) in enumerate(PAYOUT_SEEDS):
            obj, created = PayoutBatch.objects.get_or_create(
                reference=f"PB-{i:04d}",
                defaults={
                    "status": status,
                    "payout_method": "M-Pesa",
                    "notes": ref,
                    "approved_at": timezone.now() if status in ("Approved", "Paid") else None,
                    "paid_at": timezone.now() if status == "Paid" else None,
                },
            )
            if created:
                count += 1
            if created and status == "Paid":
                unpaid = CreatorSale.objects.filter(paid=False)[:3]
                for sale in unpaid:
                    sale.paid = True
                    sale.paid_at = timezone.now()
                    sale.payout = obj
                    sale.payout_reference = obj.reference
                    sale.save()
                obj.recompute_totals()
        self._log(f"PayoutBatches: {count}")

    def _seed_direct_orders(self, products, customers, creators, attribution, campaigns, coupons):
        if not products:
            self._log("DirectOrders: skipped (no catalog products)")
            return []

        statuses = _weighted_statuses()
        random.shuffle(statuses)

        count = 0
        collected_orders = []

        for i, status in enumerate(statuses):
            ref = f"#TT-{10000 + i * 137}"
            name = CUSTOMER_NAMES[i % len(CUSTOMER_NAMES)]

            n_items = random.randint(1, min(3, len(products)))
            chosen = random.sample(products, k=n_items)

            payment_status = (
                "paid" if status in ("Paid", "Awaiting Shipment", "Shipped", "Delivered")
                else "refunded" if status in ("Cancelled", "Returned")
                else "unpaid"
            )
            delivered_at = (
                timezone.now() - timedelta(days=random.randint(1, 10))
                if status == "Delivered" else None
            )
            created_at = timezone.now() - timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
            )

            customer = customers[i % len(customers)] if customers else None
            creator = creators[i % len(creators)] if (creators and i % 3 == 0) else None
            attr = attribution[i % len(attribution)] if attribution else None
            camp = campaigns[i % len(campaigns)] if campaigns else None

            defaults = {
                "customer_name": name,
                "customer_phone": _pick_phone(i),
                "customer_email": _pick_email(name, i),
                "customer": customer,
                "source": ORDER_SOURCES[i % len(ORDER_SOURCES)],
                "status": status,
                "payment_method": "M-Pesa" if i % 4 != 0 else "Cash on Delivery",
                "payment_status": payment_status,
                "notes": NOTES_SNIPPETS[i % len(NOTES_SNIPPETS)],
                "delivered_at": delivered_at,
                "courier": COURIERS[i % len(COURIERS)] if status in ("Shipped", "Delivered") else "",
                "tracking_number": f"TRK{10000 + i * 73}" if status in ("Shipped", "Delivered") else "",
                "shipping_zone": SHIPPING_ZONES[i % len(SHIPPING_ZONES)],
                "creator": creator,
                "commission": Decimal("0.00"),
                "campaign": camp,
                "attribution": attr,
            }

            order, created = DirectOrder.objects.get_or_create(
                reference=ref, defaults=defaults,
            )
            collected_orders.append(order)

            if created:
                DirectOrder.objects.filter(pk=order.pk).update(created_at=created_at)
                order.refresh_from_db()

                for w in chosen:
                    p = w.product
                    qty = random.randint(1, 2)
                    price = Decimal(str(p.price))
                    DirectOrderItem.objects.create(
                        order=order,
                        product=w,
                        product_name=p.name,
                        sku=getattr(p, "sku", "") or "",
                        image=_pick_product_image(p.name.lower().replace(" ", "-")),
                        quantity=qty,
                        price=price,
                        subtotal=price * qty,
                        cost_price=w.cost_price,
                    )

                if creator:
                    sale_total = sum(
                        Decimal(str(it.subtotal)) for it in order.items.all()
                    )
                    rate = creator.commission_rate
                    commission = (sale_total * rate / Decimal("100")).quantize(Decimal("0.01"))
                    order.commission = commission
                    order.save(update_fields=["commission"])

                order.recompute_totals()
                count += 1

        self._log(f"DirectOrders: {count}")

        for customer in customers:
            customer.recompute_stats(save=True)

        return collected_orders

    def _seed_inventory_movements(self, products, variants, locations):
        if not products:
            self._log("InventoryMovements: skipped (no catalog products)")
            return
        count = 0
        for i, w in enumerate(products):
            for kind, qty in [("in", 20), ("out", -3), ("adjustment", 1)]:
                _, created = InventoryMovement.objects.get_or_create(
                    product=w,
                    reference=f"SEED-{w.pk}-{kind}",
                    kind=kind,
                    defaults={
                        "quantity": qty,
                        "location": locations[i % len(locations)] if locations else None,
                        "notes": "Seeded movement",
                    },
                )
                if created:
                    count += 1
        self._log(f"InventoryMovements: {count}")

    def _seed_purchase_orders(self, suppliers, products):
        if not products:
            self._log("PurchaseOrders: skipped (no catalog products)")
            return
        count = 0
        for i, supplier in enumerate(suppliers):
            po, created = PurchaseOrder.objects.get_or_create(
                reference=f"PO-{10000 + i * 7}",
                defaults={
                    "supplier": supplier,
                    "status": ["Draft", "Ordered", "Received", "Partially Received"][i % 4],
                    "expected_at": (timezone.now() + timedelta(days=i * 3)).date(),
                    "shipping": Decimal("500.00"),
                },
            )
            if created:
                for j in range(2):
                    p = products[(i + j) % len(products)]
                    qty = random.randint(5, 20)
                    cost = p.cost_price or Decimal("100.00")
                    PurchaseOrderItem.objects.create(
                        purchase_order=po, product=p,
                        product_name=p.product.name,
                        quantity=qty, unit_cost=cost,
                        subtotal=cost * qty,
                    )
                po.recompute_totals()
                count += 1
        self._log(f"PurchaseOrders: {count}")

    def _seed_inbox(self, customers):
        count = 0
        for i, (channel, status, name, handle, preview, unread, msgs) in enumerate(INBOX_SEEDS):
            convo, created = InboxConversation.objects.get_or_create(
                channel=channel, contact_handle=handle,
                defaults={
                    "status": status, "subject": preview[:80],
                    "contact_name": name,
                    "customer": customers[i % len(customers)] if customers else None,
                    "unread_count": unread,
                    "last_message_at": timezone.now() - timedelta(minutes=i * 15),
                    "tags": ["tiktok", "hot-lead"] if i < 3 else [],
                },
            )
            if created:
                count += 1
                for direction, body in msgs:
                    InboxMessage.objects.create(
                        conversation=convo, direction=direction, body=body,
                    )
        self._log(f"InboxConversations: {count}")

    def _seed_returns(self, direct_orders):
        if not direct_orders:
            self._log("ReturnRequests: skipped (no direct orders)")
            return
        candidates = [o for o in direct_orders if o.status in ("Delivered", "Shipped", "Paid")][:4]
        if not candidates:
            self._log("ReturnRequests: skipped (no eligible orders)")
            return
        count = 0
        for i, order in enumerate(candidates):
            reason, detail, refund, restock, status = RETURN_SEEDS[i % len(RETURN_SEEDS)]
            _, created = ReturnRequest.objects.get_or_create(
                reference=f"RT-{10000 + i * 11}",
                defaults={
                    "order": order, "status": status, "reason": reason,
                    "reason_detail": detail, "refund_amount": refund,
                    "restock": restock,
                    "resolved_at": timezone.now() if status in ("Refunded", "Received") else None,
                },
            )
            if created:
                count += 1
        self._log(f"ReturnRequests: {count}")

    def _seed_expenses(self):
        count = 0
        for i, (title, category, amount, method) in enumerate(EXPENSE_SEEDS):
            _, created = Expense.objects.get_or_create(
                title=title,
                defaults={
                    "category": category, "amount": amount,
                    "paid_on": (timezone.now() - timedelta(days=i * 3)).date(),
                    "payment_method": method,
                    "reference": f"EXP-{i:04d}",
                },
            )
            if created:
                count += 1
        self._log(f"Expenses: {count}")

    def _seed_automations(self):
        count = 0
        for name, trigger, action, status, delay, template in AUTOMATION_SEEDS:
            _, created = Automation.objects.get_or_create(
                name=name,
                defaults={
                    "trigger": trigger, "action": action, "status": status,
                    "delay_minutes": delay, "template": template,
                    "channel": "whatsapp" if action == "whatsapp" else "",
                },
            )
            if created:
                count += 1
        self._log(f"Automations: {count}")

    def _seed_reviews(self, direct_orders, products):
        count = 0
        for i, (rating, title, body, status, is_ugc, rights) in enumerate(REVIEW_SEEDS):
            order = direct_orders[i % len(direct_orders)] if direct_orders else None
            product = products[i % len(products)] if products else None
            _, created = Review.objects.get_or_create(
                title=title,
                defaults={
                    "product": product, "order": order,
                    "rating": rating, "body": body, "status": status,
                    "is_ugc": is_ugc, "rights_granted": rights,
                    "media_url": _pick_product_image(f"review-{i}") if is_ugc else "",
                },
            )
            if created:
                count += 1
        self._log(f"Reviews: {count}")

    def _seed_notifications(self, team):
        count = 0
        notes = [
            ("Low stock alert: Nia Shea Butter", "Only 3 left — reorder now.", "warning"),
            ("New order #TT-90001", "Grace Mwangi — KES 3,000", "success"),
            ("LIVE starting in 30 min", "Friday Flash Sale — Beauty", "info"),
            ("Creator payout due", "Cynthia Njeri — KES 12,500", "warning"),
            ("Return request #RT-10001", "Damaged item — refund requested", "danger"),
        ]
        for i, (title, body, kind) in enumerate(notes):
            _, created = Notification.objects.get_or_create(
                title=title,
                defaults={
                    "body": body, "kind": kind,
                    "link": "/tiktok-business",
                    "read_at": None if i < 2 else timezone.now(),
                },
            )
            if created:
                count += 1
        self._log(f"Notifications: {count}")

    def _seed_audit(self):
        count = 0
        entries = [
            ("create", "DirectOrder", "New order logged"),
            ("status_change", "DirectOrder", "Order moved to Paid"),
            ("payout", "PayoutBatch", "Payout batch approved"),
            ("update", "DirectProduct", "Product price updated"),
            ("create", "Creator", "New creator added"),
        ]
        for action, entity, summary in entries:
            _, created = AuditLog.objects.get_or_create(
                action=action, entity=entity, summary=summary,
            )
            if created:
                count += 1
        self._log(f"AuditLogs: {count}")

    def _recompute_rollups(self):
        for wrapper in DirectProduct.objects.all():
            wrapper.recompute_sales_stats(save=True)
        for batch in PayoutBatch.objects.all():
            batch.recompute_totals(save=True)
        self._log("Recomputed rollups")

    def _log(self, msg: str):
        if not self.quiet:
            self.stdout.write(f"  {msg}")

    def _print_summary(self):
        if self.quiet:
            return
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("✔ Seed complete"))
        self.stdout.write("")
        counts = [
            ("DirectProducts", DirectProduct.objects.count()),
            ("ProductVariants", ProductVariant.objects.count()),
            ("Suppliers", Supplier.objects.count()),
            ("PurchaseOrders", PurchaseOrder.objects.count()),
            ("Locations", Location.objects.count()),
            ("InventoryMovements", InventoryMovement.objects.count()),
            ("Customers", Customer.objects.count()),
            ("Creators", Creator.objects.count()),
            ("CreatorSales", CreatorSale.objects.count()),
            ("PayoutBatches", PayoutBatch.objects.count()),
            ("DirectOrders", DirectOrder.objects.count()),
            ("DirectOrderItems", DirectOrderItem.objects.count()),
            ("Campaigns", Campaign.objects.count()),
            ("AttributionLinks", AttributionLink.objects.count()),
            ("ContentPosts", ContentPost.objects.count()),
            ("LiveSessions", LiveSession.objects.count()),
            ("InboxConversations", InboxConversation.objects.count()),
            ("InboxMessages", InboxMessage.objects.count()),
            ("TeamMembers", TeamMember.objects.count()),
            ("ReturnRequests", ReturnRequest.objects.count()),
            ("Expenses", Expense.objects.count()),
            ("Automations", Automation.objects.count()),
            ("Notifications", Notification.objects.count()),
            ("AuditLogs", AuditLog.objects.count()),
            ("Reviews", Review.objects.count()),
            ("DeliveryZones", DeliveryZone.objects.count()),
            ("Coupons", Coupon.objects.count()),
        ]
        for label, value in counts:
            self.stdout.write(f"    {label:<22} {value:>5}")
        self.stdout.write("")