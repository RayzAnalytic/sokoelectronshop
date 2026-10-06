from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Category, Brand, Product


class NewArrivalListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat_tv = Category.objects.create(name="TVs")
        self.cat_audio = Category.objects.create(name="Audio")
        self.samsung = Brand.objects.create(name="Samsung")
        self.sony = Brand.objects.create(name="Sony")

        # Fresh arrivals (created today)
        self.p_new = Product.objects.create(
            name="Samsung 65\" QLED", brand=self.samsung, category=self.cat_tv,
            price=Decimal("120000"), stock_quantity=10,
            description="Latest QLED panel.", rating_avg=Decimal("4.80"), review_count=12,
        )
        self.p_cheap = Product.objects.create(
            name="Sony Earbuds", brand=self.sony, category=self.cat_audio,
            price=Decimal("6500"), stock_quantity=2,   # low stock
            rating_avg=Decimal("4.50"), review_count=40,
        )
        self.p_out = Product.objects.create(
            name="Sony Speaker", brand=self.sony, category=self.cat_audio,
            price=Decimal("19500"), stock_quantity=0,   # out of stock
            rating_avg=Decimal("4.20"), review_count=8,
        )

        # Old product — outside the "new" window
        self.p_old = Product.objects.create(
            name="Legacy HP Laptop", brand=Brand.objects.create(name="HP"),
            category=Category.objects.create(name="Laptops"),
            price=Decimal("50000"), stock_quantity=5,
        )
        Product.objects.filter(id=self.p_old.id).update(
            created_at=timezone.now() - timedelta(days=200)
        )

    def test_default_returns_only_recent(self):
        r = self.client.get("/api/catalog/new-arrivals/")
        self.assertEqual(r.status_code, 200)
        names = [p["name"] for p in r.data]
        self.assertNotIn("Legacy HP Laptop", names)
        self.assertIn("Samsung 65\" QLED", names)

    def test_default_ordering_newest_first(self):
        r = self.client.get("/api/catalog/new-arrivals/")
        created = [p["createdAt"] for p in r.data]
        self.assertEqual(created, sorted(created, reverse=True))

    def test_default_limit_8(self):
        # Add extra recent products
        for i in range(10):
            Product.objects.create(
                name=f"New {i}", brand=self.samsung, category=self.cat_tv,
                price=Decimal("1000"), stock_quantity=5,
            )
        r = self.client.get("/api/catalog/new-arrivals/")
        self.assertEqual(len(r.data), 8)

    def test_limit_param(self):
        r = self.client.get("/api/catalog/new-arrivals/?limit=2")
        self.assertEqual(len(r.data), 2)

    def test_response_shape_matches_frontend(self):
        r = self.client.get("/api/catalog/new-arrivals/")
        p = r.data[0]
        for key in (
            "id", "name", "brand", "category", "price", "compareAtPrice",
            "stockStatus", "stockQuantity", "images", "description",
            "rating", "reviewCount", "createdAt",
        ):
            self.assertIn(key, p)

    def test_search_matches_name(self):
        r = self.client.get("/api/catalog/new-arrivals/?search=Samsung")
        names = [p["name"] for p in r.data]
        self.assertEqual(names, ["Samsung 65\" QLED"])

    def test_search_matches_description(self):
        r = self.client.get("/api/catalog/new-arrivals/?search=QLED")
        names = [p["name"] for p in r.data]
        self.assertEqual(names, ["Samsung 65\" QLED"])

    def test_category_filter(self):
        r = self.client.get("/api/catalog/new-arrivals/?category=Audio")
        self.assertEqual(sorted(p["name"] for p in r.data),
                         ["Sony Earbuds", "Sony Speaker"])

    def test_brand_filter(self):
        r = self.client.get("/api/catalog/new-arrivals/?brand=Samsung")
        names = [p["name"] for p in r.data]
        self.assertEqual(names, ["Samsung 65\" QLED"])

    def test_min_price_filter(self):
        r = self.client.get("/api/catalog/new-arrivals/?min_price=10000")
        names = sorted(p["name"] for p in r.data)
        self.assertNotIn("Sony Earbuds", names)
        self.assertIn("Samsung 65\" QLED", names)
        self.assertIn("Sony Speaker", names)

    def test_max_price_filter(self):
        r = self.client.get("/api/catalog/new-arrivals/?max_price=20000")
        names = sorted(p["name"] for p in r.data)
        self.assertIn("Sony Earbuds", names)
        self.assertIn("Sony Speaker", names)
        self.assertNotIn("Samsung 65\" QLED", names)

    def test_min_and_max_price(self):
        r = self.client.get(
            "/api/catalog/new-arrivals/?min_price=5000&max_price=20000"
        )
        names = sorted(p["name"] for p in r.data)
        self.assertEqual(names, ["Sony Earbuds", "Sony Speaker"])

    def test_stock_in_stock(self):
        r = self.client.get("/api/catalog/new-arrivals/?stock=In Stock")
        self.assertEqual([p["name"] for p in r.data], ["Samsung 65\" QLED"])

    def test_stock_low_stock(self):
        r = self.client.get("/api/catalog/new-arrivals/?stock=Low Stock")
        self.assertEqual([p["name"] for p in r.data], ["Sony Earbuds"])

    def test_stock_out_of_stock(self):
        r = self.client.get("/api/catalog/new-arrivals/?stock=Out of Stock")
        self.assertEqual([p["name"] for p in r.data], ["Sony Speaker"])

    def test_sort_price_low(self):
        r = self.client.get("/api/catalog/new-arrivals/?sort_by=price-low")
        prices = [Decimal(p["price"]) for p in r.data]
        self.assertEqual(prices, sorted(prices))

    def test_sort_price_high(self):
        r = self.client.get("/api/catalog/new-arrivals/?sort_by=price-high")
        prices = [Decimal(p["price"]) for p in r.data]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_sort_rating(self):
        r = self.client.get("/api/catalog/new-arrivals/?sort_by=rating")
        ratings = [Decimal(p["rating"]) for p in r.data]
        self.assertEqual(ratings, sorted(ratings, reverse=True))

    def test_window_days_param_includes_older(self):
        r = self.client.get("/api/catalog/new-arrivals/?window_days=365")
        names = [p["name"] for p in r.data]
        self.assertIn("Legacy HP Laptop", names)

    def test_inactive_products_hidden(self):
        Product.objects.filter(id=self.p_new.id).update(is_active=False)
        r = self.client.get("/api/catalog/new-arrivals/")
        names = [p["name"] for p in r.data]
        self.assertNotIn("Samsung 65\" QLED", names)


class NewArrivalDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cat = Category.objects.create(name="TVs")
        brand = Brand.objects.create(name="Samsung")
        self.p = Product.objects.create(
            name="Samsung QLED", brand=brand, category=cat,
            price=Decimal("120000"), stock_quantity=10,
            description="Para one.\n\nPara two.",
            rating_avg=Decimal("4.80"), review_count=12,
        )

    def test_detail_returns_full_payload(self):
        r = self.client.get(f"/api/catalog/new-arrivals/{self.p.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], self.p.id)
        self.assertEqual(r.data["name"], "Samsung QLED")
        for key in (
            "brand", "category", "price", "compareAtPrice",
            "stockStatus", "stockQuantity", "images",
            "description", "rating", "reviewCount", "createdAt",
        ):
            self.assertIn(key, r.data)

    def test_detail_404_for_unknown(self):
        r = self.client.get("/api/catalog/new-arrivals/prod_missing/")
        self.assertEqual(r.status_code, 404)

    def test_detail_404_for_inactive(self):
        Product.objects.filter(id=self.p.id).update(is_active=False)
        r = self.client.get(f"/api/catalog/new-arrivals/{self.p.id}/")
        self.assertEqual(r.status_code, 404)


class FilterDropdownTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Category.objects.create(name="Audio")
        Category.objects.create(name="Hidden", is_active=False)
        Brand.objects.create(name="Sony")
        Brand.objects.create(name="Dead", is_active=False)

    def test_categories_only_active(self):
        r = self.client.get("/api/catalog/categories/")
        self.assertEqual([c["name"] for c in r.data], ["Audio"])

    def test_brands_only_active(self):
        r = self.client.get("/api/catalog/brands/")
        self.assertEqual([b["name"] for b in r.data], ["Sony"])