from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import (
    Category, Brand, Product, Discount,
    AppliesTo, DiscountType, PromotionType,
)


def make_product(name, brand, category, price, stock=10, **kw):
    return Product.objects.create(
        name=name, brand=brand, category=category,
        price=Decimal(str(price)), stock_quantity=stock,
        description=f"{name} description", **kw,
    )


def active_discount(**kw):
    now = timezone.now()
    defaults = dict(
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=7),
        display_on_deals_page=True,
        promotion_type=PromotionType.PERCENTAGE_DISCOUNT,
    )
    defaults.update(kw)
    return Discount.objects.create(**defaults)


class SpecialDealsListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tv = Category.objects.create(name="TVs")
        self.audio = Category.objects.create(name="Audio")
        self.samsung = Brand.objects.create(name="Samsung")
        self.sony = Brand.objects.create(name="Sony")

        self.p_tv = make_product("Samsung TV", self.samsung, self.tv, "100000", stock=10)
        self.p_hp = make_product("Sony Headphones", self.sony, self.audio, "40000", stock=3)
        self.p_speaker = make_product("Sony Speaker", self.sony, self.audio, "20000", stock=0)

        # Category-wide 15% off TVs
        self.d_tv = active_discount(
            code="TVWEEK15", type=DiscountType.PERCENTAGE, value="15%",
            applies_to=AppliesTo.SPECIFIC_CATEGORIES, priority=10,
            deal_title="TV Week",
        )
        self.d_tv.linked_categories.add(self.tv)

        # Specific products 25% off
        self.d_audio = active_discount(
            code="AUDIO25", type=DiscountType.PERCENTAGE, value="25%",
            applies_to=AppliesTo.SPECIFIC_PRODUCTS, priority=8,
            deal_title="Audio Blowout",
        )
        self.d_audio.linked_products.add(self.p_hp, self.p_speaker)

        # Expired discount — must be ignored
        now = timezone.now()
        expired = Discount.objects.create(
            code="OLD", type=DiscountType.PERCENTAGE, value="50%",
            applies_to=AppliesTo.ALL_PRODUCTS, priority=100,
            start_date=now - timedelta(days=30),
            end_date=now - timedelta(days=1),
            display_on_deals_page=True,
        )

        # Scheduled discount — must be ignored
        Discount.objects.create(
            code="FUTURE", type=DiscountType.PERCENTAGE, value="40%",
            applies_to=AppliesTo.ALL_PRODUCTS, priority=100,
            start_date=now + timedelta(days=5),
            end_date=now + timedelta(days=10),
            display_on_deals_page=True,
        )

        # Hidden discount — must be ignored
        active_discount(
            code="HIDDEN", type=DiscountType.PERCENTAGE, value="30%",
            applies_to=AppliesTo.ALL_PRODUCTS,
            display_on_deals_page=False,
        )

    def test_list_returns_all_visible_active_deals(self):
        r = self.client.get("/api/catalog/special-deals/")
        self.assertEqual(r.status_code, 200)
        product_ids = {c["productId"] for c in r.data}
        self.assertEqual(product_ids, {self.p_tv.id, self.p_hp.id, self.p_speaker.id})

    def test_shape_matches_frontend(self):
        r = self.client.get("/api/catalog/special-deals/")
        card = r.data[0]
        for key in (
            "id", "productId", "discountCode", "name", "brand", "category",
            "price", "originalPrice", "discountPct", "inStock", "stockCount",
            "image", "description", "features", "specs",
            "startDate", "endDate", "promotionType", "rating", "reviewCount",
        ):
            self.assertIn(key, card)

    def test_discount_math(self):
        r = self.client.get("/api/catalog/special-deals/")
        tv = next(c for c in r.data if c["productId"] == self.p_tv.id)
        self.assertEqual(tv["originalPrice"], "100000.00")
        self.assertEqual(tv["price"], "85000.00")
        self.assertEqual(tv["discountPct"], 15)

    def test_category_filter(self):
        r = self.client.get("/api/catalog/special-deals/?category=TVs")
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["productId"], self.p_tv.id)

    def test_brand_filter(self):
        r = self.client.get("/api/catalog/special-deals/?brand=Sony")
        ids = {c["productId"] for c in r.data}
        self.assertEqual(ids, {self.p_hp.id, self.p_speaker.id})

    def test_search_filter(self):
        r = self.client.get("/api/catalog/special-deals/?search=headphone")
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["name"], "Sony Headphones")

    def test_min_price_uses_discounted_price(self):
        # Headphones: 40000 → 30000 discounted
        r = self.client.get("/api/catalog/special-deals/?min_price=35000")
        self.assertEqual([c["productId"] for c in r.data], [self.p_tv.id])

    def test_max_price_uses_discounted_price(self):
        r = self.client.get("/api/catalog/special-deals/?max_price=35000")
        ids = sorted(c["productId"] for c in r.data)
        self.assertEqual(ids, sorted([self.p_hp.id, self.p_speaker.id]))

    def test_availability_in_stock(self):
        r = self.client.get("/api/catalog/special-deals/?availability=In Stock")
        ids = {c["productId"] for c in r.data}
        self.assertNotIn(self.p_speaker.id, ids)

    def test_availability_out_of_stock(self):
        r = self.client.get("/api/catalog/special-deals/?availability=Out of Stock")
        self.assertEqual([c["productId"] for c in r.data], [self.p_speaker.id])

    def test_discount_level_filter(self):
        r = self.client.get("/api/catalog/special-deals/?discount_level=20")
        ids = {c["productId"] for c in r.data}
        self.assertNotIn(self.p_tv.id, ids)       # only 15%
        self.assertIn(self.p_hp.id, ids)          # 25%

    def test_sort_biggest_discount(self):
        r = self.client.get("/api/catalog/special-deals/?sort_by=Biggest Discount")
        pcts = [c["discountPct"] for c in r.data]
        self.assertEqual(pcts, sorted(pcts, reverse=True))

    def test_sort_price_low_high(self):
        r = self.client.get("/api/catalog/special-deals/?sort_by=Price: Low to High")
        prices = [Decimal(c["price"]) for c in r.data]
        self.assertEqual(prices, sorted(prices))

    def test_sort_price_high_low(self):
        r = self.client.get("/api/catalog/special-deals/?sort_by=Price: High to Low")
        prices = [Decimal(c["price"]) for c in r.data]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_sort_ending_soon(self):
        r = self.client.get("/api/catalog/special-deals/?sort_by=Ending Soon")
        ends = [c["endDate"] for c in r.data]
        self.assertEqual(ends, sorted(ends))

    def test_featured_sort_uses_priority(self):
        r = self.client.get("/api/catalog/special-deals/?sort_by=Featured Deals")
        # TV discount priority=10, audio=8
        self.assertEqual(r.data[0]["discountCode"], "TVWEEK15")

    def test_dedupe_keeps_highest_discount_per_product(self):
        # Add a second, worse discount for the same product
        cheap = active_discount(
            code="CHEAP5", type=DiscountType.PERCENTAGE, value="5%",
            applies_to=AppliesTo.SPECIFIC_PRODUCTS, priority=1,
        )
        cheap.linked_products.add(self.p_tv)

        r = self.client.get("/api/catalog/special-deals/")
        tv_cards = [c for c in r.data if c["productId"] == self.p_tv.id]
        self.assertEqual(len(tv_cards), 1)
        self.assertEqual(tv_cards[0]["discountCode"], "TVWEEK15")
        self.assertEqual(tv_cards[0]["discountPct"], 15)

    def test_inactive_products_hidden(self):
        Product.objects.filter(id=self.p_tv.id).update(is_active=False)
        r = self.client.get("/api/catalog/special-deals/")
        ids = {c["productId"] for c in r.data}
        self.assertNotIn(self.p_tv.id, ids)


class SpecialDealDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cat = Category.objects.create(name="Audio")
        brand = Brand.objects.create(name="Sony")
        self.p = make_product("Sony Headphones", brand, cat, "40000", stock=5)

        # Add feature + spec
        from catalog.models import ProductFeature, ProductSpec
        ProductFeature.objects.create(product=self.p, text="Noise cancelling", sort_order=0)
        ProductFeature.objects.create(product=self.p, text="30h battery", sort_order=1)
        ProductSpec.objects.create(product=self.p, key="Battery", value="30 hours")

        self.d = active_discount(
            code="AUDIO25", type=DiscountType.PERCENTAGE, value="25%",
            applies_to=AppliesTo.SPECIFIC_PRODUCTS, priority=8,
        )
        self.d.linked_products.add(self.p)

    def test_detail_returns_card(self):
        r = self.client.get(f"/api/catalog/special-deals/{self.p.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["productId"], self.p.id)
        self.assertEqual(r.data["price"], "30000.00")
        self.assertEqual(r.data["discountPct"], 25)
        self.assertEqual(r.data["features"], ["Noise cancelling", "30h battery"])
        self.assertEqual(r.data["specs"], {"Battery": "30 hours"})

    def test_detail_404_when_no_deal(self):
        orphan = make_product(
            "Orphan", Brand.objects.create(name="X"),
            Category.objects.create(name="Y"), "9999",
        )
        r = self.client.get(f"/api/catalog/special-deals/{orphan.id}/")
        self.assertEqual(r.status_code, 404)

    def test_detail_404_unknown_product(self):
        r = self.client.get("/api/catalog/special-deals/prod_missing/")
        self.assertEqual(r.status_code, 404)


class DealFilterDropdownTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tv = Category.objects.create(name="TVs")
        self.audio = Category.objects.create(name="Audio")
        self.empty = Category.objects.create(name="Empty")
        self.samsung = Brand.objects.create(name="Samsung")
        self.sony = Brand.objects.create(name="Sony")

        make_product("Samsung TV", self.samsung, self.tv, "100000")
        make_product("Sony Headphones", self.sony, self.audio, "40000")

        d = active_discount(
            code="ALL10", type=DiscountType.PERCENTAGE, value="10%",
            applies_to=AppliesTo.ALL_PRODUCTS,
        )

    def test_category_dropdown_only_includes_with_deals(self):
        r = self.client.get("/api/catalog/special-deals/categories/")
        names = {c["name"] for c in r.data}
        self.assertEqual(names, {"TVs", "Audio"})
        self.assertNotIn("Empty", names)

    def test_brand_dropdown_only_includes_with_deals(self):
        r = self.client.get("/api/catalog/special-deals/brands/")
        names = {b["name"] for b in r.data}
        self.assertEqual(names, {"Samsung", "Sony"})


class DiscountModelTests(TestCase):
    def test_status_derived_from_dates(self):
        now = timezone.now()
        scheduled = Discount.objects.create(
            code="S", type=DiscountType.PERCENTAGE, value="10%",
            applies_to=AppliesTo.ALL_PRODUCTS,
            start_date=now + timedelta(days=1),
            end_date=now + timedelta(days=5),
        )
        active = Discount.objects.create(
            code="A", type=DiscountType.PERCENTAGE, value="10%",
            applies_to=AppliesTo.ALL_PRODUCTS,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
        )
        expired = Discount.objects.create(
            code="E", type=DiscountType.PERCENTAGE, value="10%",
            applies_to=AppliesTo.ALL_PRODUCTS,
            start_date=now - timedelta(days=5),
            end_date=now - timedelta(days=1),
        )
        self.assertEqual(scheduled.status, "Scheduled")
        self.assertEqual(active.status, "Active")
        self.assertEqual(expired.status, "Expired")

    def test_percentage_price(self):
        now = timezone.now()
        d = Discount.objects.create(
            code="P", type=DiscountType.PERCENTAGE, value="15%",
            applies_to=AppliesTo.ALL_PRODUCTS,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=1),
        )
        self.assertEqual(d.price_for(Decimal("100000")), Decimal("85000.00"))
        self.assertEqual(d.percent_off_for(Decimal("100000")), 15)

    def test_fixed_amount_price(self):
        now = timezone.now()
        d = Discount.objects.create(
            code="F", type=DiscountType.FIXED_AMOUNT, value="KES 500",
            applies_to=AppliesTo.ALL_PRODUCTS,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=1),
        )
        self.assertEqual(d.price_for(Decimal("2000")), Decimal("1500.00"))
        self.assertEqual(d.percent_off_for(Decimal("2000")), 25)

    def test_fixed_amount_cannot_go_negative(self):
        now = timezone.now()
        d = Discount.objects.create(
            code="FN", type=DiscountType.FIXED_AMOUNT, value="KES 500",
            applies_to=AppliesTo.ALL_PRODUCTS,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=1),
        )
        self.assertEqual(d.price_for(Decimal("300")), Decimal("0.00"))