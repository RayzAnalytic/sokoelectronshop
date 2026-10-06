# discounts/tests.py

"""
Tests for the dashboard discounts API.

Covers the four things most likely to break:
  1. Enum normalization (React 'BOGO' → Django 'Buy X Get Y')
  2. Status → status_override translation
  3. Name → PK resolution for linked categories / products
  4. Custom actions (duplicate, pause, resume)
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Category, Discount, DiscountType, Product
from discounts import services


User = get_user_model()


class DiscountTestBase(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            email="staff@example.com",
            password="pw",
            is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

        self.category = Category.objects.create(name="TVs", slug="tvs")
        self.product = Product.objects.create(
            name="Test TV",
            category=self.category,
            brand=...,
            price=10000,
        )

    def _base_payload(self, **overrides):
        payload = {
            "code": "TEST10",
            "description": "Test discount",
            "type": "Percentage",
            "value": "10%",
            "appliesTo": "Entire Order",
            "status": "Active",
        }
        payload.update(overrides)
        return payload


class EnumNormalizationTests(DiscountTestBase):
    def test_bogo_maps_to_buy_x_get_y(self):
        res = self.client.post(
            "/api/dashboard/discounts/",
            self._base_payload(type="BOGO"),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(
            Discount.objects.get(code="TEST10").type,
            DiscountType.BUY_X_GET_Y,
        )

    def test_entire_order_maps_to_all_products(self):
        res = self.client.post(
            "/api/dashboard/discounts/",
            self._base_payload(appliesTo="Entire Order"),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(
            Discount.objects.get(code="TEST10").applies_to,
            "All Products",
        )

    def test_status_draft_sets_override(self):
        self.client.post(
            "/api/dashboard/discounts/",
            self._base_payload(status="Draft"),
            format="json",
        )
        self.assertEqual(
            Discount.objects.get(code="TEST10").status_override,
            "Draft",
        )

    def test_status_active_clears_override(self):
        self.client.post(
            "/api/dashboard/discounts/",
            self._base_payload(status="Active"),
            format="json",
        )
        self.assertEqual(
            Discount.objects.get(code="TEST10").status_override,
            "",
        )


class LinkedTargetingTests(DiscountTestBase):
    def test_category_name_resolves_to_pk(self):
        res = self.client.post(
            "/api/dashboard/discounts/",
            self._base_payload(
                appliesTo="Specific Categories",
                linkedCategories=["TVs"],
            ),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        d = Discount.objects.get(code="TEST10")
        self.assertIn(self.category, d.linked_categories.all())

    def test_product_name_resolves_to_id(self):
        res = self.client.post(
            "/api/dashboard/discounts/",
            self._base_payload(
                appliesTo="Specific Products",
                linkedProductIds=["Test TV"],
            ),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        d = Discount.objects.get(code="TEST10")
        self.assertIn(self.product, d.linked_products.all())


class CustomActionTests(DiscountTestBase):
    def setUp(self):
        super().setUp()
        self.discount = Discount.objects.create(
            code="ORIG",
            description="Original",
            type=DiscountType.PERCENTAGE,
            value="15%",
            applies_to="All Products",
            start_date="2026-01-01T00:00:00Z",
            end_date="2026-12-31T23:59:59Z",
        )

    def test_duplicate_creates_copy(self):
        res = self.client.post(f"/api/dashboard/discounts/{self.discount.id}/duplicate/")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(Discount.objects.filter(code="ORIG-COPY").exists())

    def test_pause_sets_override(self):
        self.client.post(f"/api/dashboard/discounts/{self.discount.id}/pause/")
        self.discount.refresh_from_db()
        self.assertEqual(self.discount.status_override, "Paused")

    def test_resume_clears_override(self):
        self.discount.status_override = "Paused"
        self.discount.save()
        self.client.post(f"/api/dashboard/discounts/{self.discount.id}/resume/")
        self.discount.refresh_from_db()
        self.assertEqual(self.discount.status_override, "")


class ClearanceServiceTests(DiscountTestBase):
    def test_bulk_clearance_creates_discount(self):
        d = services.apply_bulk_clearance(
            product_ids=[self.product.id],
            percent_off=20,
            user=self.staff,
        )
        self.assertTrue(d.is_automatic)
        self.assertTrue(d.is_clearance)
        self.assertTrue(d.expires_when_sold_out)
        self.assertIsNone(d.end_date)
        self.assertEqual(d.value, "20%")
        self.assertIn(self.product, d.linked_products.all())