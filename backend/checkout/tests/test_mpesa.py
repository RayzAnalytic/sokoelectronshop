from unittest.mock import patch

from django.test import TestCase

from checkout import mpesa
from checkout.exceptions import InvalidPhone, MpesaError


class NormalizePhoneTests(TestCase):
    def test_07_form(self):
        self.assertEqual(mpesa.normalize_phone("0712345678"), "254712345678")

    def test_plus254_form(self):
        self.assertEqual(mpesa.normalize_phone("+254712345678"), "254712345678")

    def test_bare_7_form(self):
        self.assertEqual(mpesa.normalize_phone("712345678"), "254712345678")

    def test_invalid(self):
        with self.assertRaises(InvalidPhone):
            mpesa.normalize_phone("12345")


class StkPushTests(TestCase):
    @patch("checkout.mpesa.get_access_token", return_value="tok")
    @patch("checkout.mpesa.requests.post")
    def test_success(self, mock_post, _tok):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "MerchantRequestID": "m-1",
            "CheckoutRequestID": "c-1",
            "ResponseCode": "0",
            "ResponseDescription": "Success",
        }
        result = mpesa.stk_push("0712345678", 100, "ORD-1")
        self.assertEqual(result["merchant_request_id"], "m-1")
        self.assertEqual(result["checkout_request_id"], "c-1")

    @patch("checkout.mpesa.get_access_token", return_value="tok")
    @patch("checkout.mpesa.requests.post")
    def test_daraja_error(self, mock_post, _tok):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "ResponseCode": "1",
            "errorMessage": "Bad request",
        }
        with self.assertRaises(MpesaError):
            mpesa.stk_push("0712345678", 100, "ORD-1")