from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Product, Category, Brand


class ProductAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat = Category.objects.create(name="Laptops")
        self.brand = Brand.objects.create(name="HP")
        self.p1 = Product.objects.create(
            name="HP Pavilion 15",
            brand=self.brand, category=self.cat,
            price=Decimal("78500"), compare_at_price=Decimal("89000"),
            stock_quantity=8, featured=True, best_seller=True,
        )
        self.p2 = Product.objects.create(
            name="Sony Headphones",
            brand=Brand.objects.create(name="Sony"),
            category=Category.objects.create(name="Audio"),
            price=Decimal("34500"), stock_quantity=0,
        )

    def test_list_products(self):
        r = self.client.get("/api/catalog/products/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)

    def test_search_filter(self):
        r = self.client.get("/api/catalog/products/?search=hp")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["name"], "HP Pavilion 15")

    def test_category_filter(self):
        r = self.client.get("/api/catalog/products/?category=Audio")
        self.assertEqual(r.data["count"], 1)

    def test_price_range_filter(self):
        r = self.client.get("/api/catalog/products/?price_range=50000-100000")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["name"], "HP Pavilion 15")

    def test_stock_filter(self):
        r = self.client.get("/api/catalog/products/?stock=Out of Stock")
        self.assertEqual(r.data["count"], 1)

    def test_sort_price_low(self):
        r = self.client.get("/api/catalog/products/?sort_by=price-low")
        prices = [Decimal(x["price"]) for x in r.data["results"]]
        self.assertEqual(prices, sorted(prices))

    def test_detail_returns_full_payload(self):
        r = self.client.get(f"/api/catalog/products/{self.p1.id}/")
        self.assertEqual(r.status_code, 200)
        for key in ("description", "features", "specs", "relatedProducts", "images"):
            self.assertIn(key, r.data)

    def test_detail_404(self):
        r = self.client.get("/api/catalog/products/prod_missing/")
        self.assertEqual(r.status_code, 404)