from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from checkout import constants
from checkout.exceptions import PricingError
from checkout.services import recompute_totals

User = get_user_model()


def _payload(**overrides):
    base = {
        "email": "buyer@example.com",
        "phone": "0712345678",
        "full_name": "Alex Johnson",
        "address": {
            "street": "1 Test Rd",
            "town": "Nairobi",
            "county": "Nairobi",
            "postal_code": "00100",
        },
        "delivery_method": "express",
        "estimated_delivery": "Fri, 3 Oct",
        "coupon": None,
        "notes": None,
        "items": [
            {
                "productId": "p1",
                "name": "Widget",
                "brand": "Acme",
                "price": "1000.00",
                "quantity": 2,
                "image": "https://example.com/x.png",
            },
        ],
        "totals": {
            "subtotal": "2000.00",
            "discount": "0.00",
            "shipping": "500.00",
            "tax": "320.00",
            "total": "2820.00",
        },
    }
    base.update(overrides)
    return base


class RecomputeTotalsTests(TestCase):
    def test_matching_totals_pass(self):
        payload = _payload()
        result = recompute_totals(payload)
        self.assertEqual(result["total"], Decimal("2820.00"))

    def test_mismatched_totals_raise(self):
        payload = _payload()
        payload["totals"]["total"] = "9999.00"
        with self.assertRaises(PricingError):
            recompute_totals(payload)

    def test_free_delivery_above_threshold(self):
        payload = _payload(
            items=[{
                "productId": "p1", "name": "Widget", "brand": "",
                "price": "3000.00", "quantity": 2, "image": "",
            }],
            totals={
                "subtotal": "6000.00",
                "discount": "0.00",
                "shipping": "0.00",
                "tax": "960.00",
                "total": "6960.00",
            },
        )
        result = recompute_totals(payload)
        self.assertEqual(result["shipping"], Decimal("0.00"))