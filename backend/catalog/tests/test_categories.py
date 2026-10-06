from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Category, Brand, Product


# ═════════════════════════════════════════════════════════════════════════════
# GET /api/catalog/categories/   — sidebar list
# ═════════════════════════════════════════════════════════════════════════════
class CategoryListTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.smartphones = Category.objects.create(
            name="Smartphones", icon_name="Smartphone", sort_order=1,
        )
        self.laptops = Category.objects.create(
            name="Laptops", icon_name="Laptop", sort_order=2,
        )
        self.empty = Category.objects.create(
            name="Empty", icon_name="Archive", sort_order=3,
        )
        self.hidden = Category.objects.create(
            name="Hidden", icon_name="Eye", sort_order=4, is_active=False,
        )

        apple = Brand.objects.create(name="Apple")
        hp = Brand.objects.create(name="HP")

        Product.objects.create(
            name="iPhone 15", brand=apple, category=self.smartphones,
            price=Decimal("120000"), stock_quantity=5,
        )
        Product.objects.create(
            name="iPhone 14", brand=apple, category=self.smartphones,
            price=Decimal("90000"), stock_quantity=3,
        )
        # Inactive — must NOT be counted
        Product.objects.create(
            name="Dead iPhone", brand=apple, category=self.smartphones,
            price=Decimal("1"), stock_quantity=1, is_active=False,
        )
        Product.objects.create(
            name="HP Pavilion", brand=hp, category=self.laptops,
            price=Decimal("78500"), stock_quantity=4,
        )

    # ── Visibility ─────────────────────────────────────────────────
    def test_only_active_categories_returned(self):
        r = self.client.get("/api/catalog/categories/")
        self.assertEqual(r.status_code, 200)
        names = [c["name"] for c in r.data]
        self.assertNotIn("Hidden", names)
        self.assertIn("Smartphones", names)
        self.assertIn("Laptops", names)
        self.assertIn("Empty", names)

    # ── Ordering ───────────────────────────────────────────────────
    def test_ordering_by_sort_order(self):
        r = self.client.get("/api/catalog/categories/")
        names = [c["name"] for c in r.data]
        self.assertEqual(names, ["Smartphones", "Laptops", "Empty"])

    # ── Product counts ─────────────────────────────────────────────
    def test_product_count_excludes_inactive(self):
        r = self.client.get("/api/catalog/categories/")
        by_slug = {c["slug"]: c for c in r.data}
        self.assertEqual(by_slug["smartphones"]["productCount"], 2)
        self.assertEqual(by_slug["laptops"]["productCount"], 1)
        self.assertEqual(by_slug["empty"]["productCount"], 0)

    def test_item_count_is_pluralised(self):
        r = self.client.get("/api/catalog/categories/")
        by_slug = {c["slug"]: c for c in r.data}
        self.assertEqual(by_slug["smartphones"]["itemCount"], "2 items")
        self.assertEqual(by_slug["laptops"]["itemCount"], "1 item")
        self.assertEqual(by_slug["empty"]["itemCount"], "0 items")

    # ── Presentation fields ────────────────────────────────────────
    def test_href_shape(self):
        r = self.client.get("/api/catalog/categories/")
        by_slug = {c["slug"]: c for c in r.data}
        self.assertEqual(
            by_slug["smartphones"]["href"],
            "/pages/categories/smartphones",
        )

    def test_icon_name_passthrough(self):
        r = self.client.get("/api/catalog/categories/")
        by_slug = {c["slug"]: c for c in r.data}
        self.assertEqual(by_slug["smartphones"]["icon"], "Smartphone")
        self.assertEqual(by_slug["laptops"]["icon"], "Laptop")

    def test_response_shape_matches_frontend(self):
        r = self.client.get("/api/catalog/categories/")
        c = r.data[0]
        for key in (
            "name", "slug", "href", "icon",
            "productCount", "itemCount", "image",
        ):
            self.assertIn(key, c)

    # ── Slug behaviour ─────────────────────────────────────────────
    def test_slug_auto_generated(self):
        c = Category.objects.create(name="Smart Watches")
        self.assertEqual(c.slug, "smart-watches")


# ═════════════════════════════════════════════════════════════════════════════
# GET /api/catalog/categories/<slug>/   — category page
# ═════════════════════════════════════════════════════════════════════════════
class CategoryDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat = Category.objects.create(name="Laptops")
        brand_hp = Brand.objects.create(name="HP")
        brand_apple = Brand.objects.create(name="Apple")

        self.cheap = Product.objects.create(
            name="HP Pavilion", brand=brand_hp, category=self.cat,
            price=Decimal("50000"), stock_quantity=10,   # In Stock
        )
        self.mid = Product.objects.create(
            name="HP Envy", brand=brand_hp, category=self.cat,
            price=Decimal("90000"), stock_quantity=2,    # Low Stock
        )
        self.pricey = Product.objects.create(
            name="MacBook Pro", brand=brand_apple, category=self.cat,
            price=Decimal("250000"), stock_quantity=0,   # Out of Stock
        )

    # ── Happy path ─────────────────────────────────────────────────
    def test_returns_category_and_products(self):
        r = self.client.get("/api/catalog/categories/laptops/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["category"]["name"], "Laptops")
        self.assertEqual(len(r.data["products"]), 3)

    def test_unknown_slug_404(self):
        r = self.client.get("/api/catalog/categories/nope/")
        self.assertEqual(r.status_code, 404)

    def test_inactive_category_404(self):
        Category.objects.create(name="Hidden", is_active=False)
        r = self.client.get("/api/catalog/categories/hidden/")
        self.assertEqual(r.status_code, 404)

    # ── Search ─────────────────────────────────────────────────────
    def test_search_q_param(self):
        r = self.client.get("/api/catalog/categories/laptops/?q=macbook")
        self.assertEqual(len(r.data["products"]), 1)
        self.assertEqual(r.data["products"][0]["name"], "MacBook Pro")

    def test_search_q_matches_brand(self):
        r = self.client.get("/api/catalog/categories/laptops/?q=hp")
        names = sorted(p["name"] for p in r.data["products"])
        self.assertEqual(names, ["HP Envy", "HP Pavilion"])

    # ── Stock filter ───────────────────────────────────────────────
    def test_stock_in_stock_filter(self):
        r = self.client.get("/api/catalog/categories/laptops/?stock=in-stock")
        names = [p["name"] for p in r.data["products"]]
        self.assertEqual(names, ["HP Pavilion"])

    def test_stock_low_stock_filter(self):
        r = self.client.get("/api/catalog/categories/laptops/?stock=low-stock")
        names = [p["name"] for p in r.data["products"]]
        self.assertEqual(names, ["HP Envy"])

    def test_stock_all_returns_everything(self):
        r = self.client.get("/api/catalog/categories/laptops/?stock=all")
        self.assertEqual(len(r.data["products"]), 3)

    # ── Sorting ────────────────────────────────────────────────────
    def test_sort_price_low(self):
        r = self.client.get("/api/catalog/categories/laptops/?sort=price-low")
        prices = [Decimal(p["price"]) for p in r.data["products"]]
        self.assertEqual(prices, sorted(prices))

    def test_sort_price_high(self):
        r = self.client.get("/api/catalog/categories/laptops/?sort=price-high")
        prices = [Decimal(p["price"]) for p in r.data["products"]]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_sort_newest(self):
        r = self.client.get("/api/catalog/categories/laptops/?sort=newest")
        created = [p["createdAt"] for p in r.data["products"]]
        self.assertEqual(created, sorted(created, reverse=True))

    # ── Response shape ─────────────────────────────────────────────
    def test_product_shape_matches_frontend(self):
        r = self.client.get("/api/catalog/categories/laptops/")
        p = r.data["products"][0]
        for key in (
            "id", "name", "brand", "category", "images",
            "price", "compareAtPrice", "stock", "stockQuantity",
            "rating", "reviewCount",
        ):
            self.assertIn(key, p)