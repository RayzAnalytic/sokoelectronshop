from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Category, Brand, Product, Review


class BestSellingListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat_tv = Category.objects.create(name="TVs")
        self.cat_audio = Category.objects.create(name="Audio")
        self.samsung = Brand.objects.create(name="Samsung")
        self.sony = Brand.objects.create(name="Sony")

        # 3 products with descending sales_count
        self.p_top = Product.objects.create(
            name="Samsung TV", brand=self.samsung, category=self.cat_tv,
            price=Decimal("89999"), compare_at_price=Decimal("104999"),
            stock_quantity=12, sales_count=500, review_count=32,
            rating_avg=Decimal("4.70"),
        )
        self.p_mid = Product.objects.create(
            name="Sony Headphones", brand=self.sony, category=self.cat_audio,
            price=Decimal("34500"), stock_quantity=2,   # low stock
            sales_count=300, review_count=112, rating_avg=Decimal("4.90"),
        )
        self.p_low = Product.objects.create(
            name="Sony Speaker", brand=self.sony, category=self.cat_audio,
            price=Decimal("19500"), stock_quantity=0,   # out
            sales_count=100, review_count=64, rating_avg=Decimal("4.60"),
        )
        # Not a best seller by convention but still listed in our ranking
        Product.objects.create(
            name="Inactive", brand=self.sony, category=self.cat_audio,
            price=Decimal("1"), is_active=False,
        )

    def test_list_default_ordering_by_sales_count(self):
        r = self.client.get("/api/catalog/best-selling/")
        self.assertEqual(r.status_code, 200)
        names = [p["name"] for p in r.data]
        self.assertEqual(
            names,
            ["Samsung TV", "Sony Headphones", "Sony Speaker"],
        )

    def test_response_shape_matches_frontend(self):
        r = self.client.get("/api/catalog/best-selling/")
        p = r.data[0]
        for key in (
            "id", "bestSeller", "brand", "name", "description",
            "price", "previousPrice", "rating", "reviewCount",
            "stockStatus", "images", "category",
        ):
            self.assertIn(key, p)

    def test_brand_filter(self):
        r = self.client.get("/api/catalog/best-selling/?brand=Sony")
        names = sorted(p["name"] for p in r.data)
        self.assertEqual(names, ["Sony Headphones", "Sony Speaker"])

    def test_category_filter(self):
        r = self.client.get("/api/catalog/best-selling/?category=Audio")
        self.assertEqual(len(r.data), 2)

    def test_search_filter(self):
        r = self.client.get("/api/catalog/best-selling/?search=headphone")
        self.assertEqual([p["name"] for p in r.data], ["Sony Headphones"])

    def test_price_range_under_5000(self):
        r = self.client.get("/api/catalog/best-selling/?price_range=under-5000")
        self.assertEqual(r.data, [])

    def test_price_range_20000_50000(self):
        r = self.client.get("/api/catalog/best-selling/?price_range=20000-50000")
        self.assertEqual([p["name"] for p in r.data], ["Sony Headphones"])

    def test_stock_in_stock(self):
        r = self.client.get("/api/catalog/best-selling/?stock=In Stock")
        self.assertEqual([p["name"] for p in r.data], ["Samsung TV"])

    def test_stock_low_stock(self):
        r = self.client.get("/api/catalog/best-selling/?stock=Low Stock")
        self.assertEqual([p["name"] for p in r.data], ["Sony Headphones"])

    def test_stock_out_of_stock(self):
        r = self.client.get("/api/catalog/best-selling/?stock=Out of Stock")
        self.assertEqual([p["name"] for p in r.data], ["Sony Speaker"])

    def test_sort_price_low_high(self):
        r = self.client.get("/api/catalog/best-selling/?sort_by=price-low-high")
        prices = [Decimal(p["price"]) for p in r.data]
        self.assertEqual(prices, sorted(prices))

    def test_sort_price_high_low(self):
        r = self.client.get("/api/catalog/best-selling/?sort_by=price-high-low")
        prices = [Decimal(p["price"]) for p in r.data]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_sort_rating(self):
        r = self.client.get("/api/catalog/best-selling/?sort_by=rating")
        ratings = [Decimal(p["rating"]) for p in r.data]
        self.assertEqual(ratings, sorted(ratings, reverse=True))

    def test_limit_default_8(self):
        r = self.client.get("/api/catalog/best-selling/")
        self.assertLessEqual(len(r.data), 8)

    def test_limit_param(self):
        r = self.client.get("/api/catalog/best-selling/?limit=2")
        self.assertEqual(len(r.data), 2)

    def test_inactive_products_hidden(self):
        r = self.client.get("/api/catalog/best-selling/")
        names = [p["name"] for p in r.data]
        self.assertNotIn("Inactive", names)


class BestSellingDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat = Category.objects.create(name="Audio")
        self.brand = Brand.objects.create(name="Sony")
        self.p = Product.objects.create(
            name="Sony WH-1000XM5",
            brand=self.brand, category=self.cat,
            price=Decimal("48999"), stock_quantity=10,
            sales_count=200, review_count=42, rating_avg=Decimal("4.90"),
            description="Paragraph one.\n\nParagraph two.",
        )
        self.related = Product.objects.create(
            name="Sony WH-1000XM4",
            brand=self.brand, category=self.cat,
            price=Decimal("34500"), stock_quantity=8, sales_count=100,
        )
        Product.objects.create(
            name="JBL Charge",
            brand=Brand.objects.create(name="JBL"),
            category=self.cat,
            price=Decimal("19500"), stock_quantity=5,
        )

    def test_detail_returns_product_and_related(self):
        r = self.client.get(f"/api/catalog/best-selling/{self.p.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("product", r.data)
        self.assertIn("related", r.data)
        self.assertEqual(r.data["product"]["name"], "Sony WH-1000XM5")
        # Related = same category OR brand, excluding self
        related_names = sorted(x["name"] for x in r.data["related"])
        self.assertEqual(
            related_names,
            ["JBL Charge", "Sony WH-1000XM4"],
        )

    def test_detail_404(self):
        r = self.client.get("/api/catalog/best-selling/prod_missing/")
        self.assertEqual(r.status_code, 404)

    def test_related_endpoint(self):
        r = self.client.get(f"/api/catalog/best-selling/{self.p.id}/related/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)


class BestSellingReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cat = Category.objects.create(name="Audio")
        brand = Brand.objects.create(name="Sony")
        self.p = Product.objects.create(
            name="Sony Headphones", brand=brand, category=cat,
            price=Decimal("34500"), stock_quantity=5,
        )

    def test_list_empty(self):
        r = self.client.get(f"/api/catalog/best-selling/{self.p.id}/reviews/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, [])

    def test_create_review_updates_aggregates(self):
        payload = {
            "author": "Jane W.",
            "rating": 5,
            "title": "Excellent",
            "body": "Great sound, worth every shilling.",
        }
        r = self.client.post(
            f"/api/catalog/best-selling/{self.p.id}/reviews/",
            payload, format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["author"], "Jane W.")
        self.assertEqual(r.data["rating"], 5)
        self.assertFalse(r.data["verified"])

        self.p.refresh_from_db()
        self.assertEqual(self.p.review_count, 1)
        self.assertEqual(float(self.p.rating_avg), 5.0)

    def test_create_review_rejects_bad_rating(self):
        r = self.client.post(
            f"/api/catalog/best-selling/{self.p.id}/reviews/",
            {"author": "X", "rating": 9, "body": "hi"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_review_rejects_empty_fields(self):
        r = self.client.post(
            f"/api/catalog/best-selling/{self.p.id}/reviews/",
            {"author": "  ", "rating": 4, "body": "  "},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_review_404_for_unknown_product(self):
        r = self.client.post(
            "/api/catalog/best-selling/prod_nope/reviews/",
            {"author": "A", "rating": 4, "body": "ok"},
            format="json",
        )
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