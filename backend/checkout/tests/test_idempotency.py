from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from checkout.models import Order, Payment


def _payload(ref="ORD-1"):
    return {
        "order_reference": ref,
        "amount": 2820,
        "phone_number": "0712345678",
        "checkout": {
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
                    "image": "",
                }
            ],
            "totals": {
                "subtotal": "2000.00",
                "discount": "0.00",
                "shipping": "500.00",
                "tax": "320.00",
                "total": "2820.00",
            },
        },
    }


class IdempotencyTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("checkout.mpesa.get_access_token", return_value="tok")
    @patch("checkout.mpesa.requests.post")
    def test_same_key_creates_one_payment(self, mock_post, _tok):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "MerchantRequestID": "m-1",
            "CheckoutRequestID": "c-1",
            "ResponseCode": "0",
            "ResponseDescription": "Success",
        }

        r1 = self.client.post(
            "/api/v1/checkout/payments/stk-push/",
            _payload("ORD-1"),
            format="json",
            HTTP_IDEMPOTENCY_KEY="key-abc",
        )
        self.assertEqual(r1.status_code, 200)

        r2 = self.client.post(
            "/api/v1/checkout/payments/stk-push/",
            _payload("ORD-1"),
            format="json",
            HTTP_IDEMPOTENCY_KEY="key-abc",
        )
        self.assertEqual(r2.status_code, 200)

        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)