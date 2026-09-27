from django.conf import settings
from .base import BaseGateway, GatewayError


class DusupayGateway(BaseGateway):
    """
    Dusupay Collections API.
    Docs: https://developer.dusupay.com/funds-collection/getting-started
    """
    base_url = settings.DUSUPAY_BASE_URL
    timeout = 30

    def _headers(self):
        return {
            "Content-Type": "application/json",
            "x-api-version": "1",
            "public-key": settings.DUSUPAY_PUBLIC_KEY,
            "secret-key": settings.DUSUPAY_SECRET_KEY,
        }

    def initiate_collection(self, payload):
        """
        POST /collections/initialize
        Returns: dict with internal_reference, payment_url (optional), etc.
        """
        return self._request("POST", "/collections/initialize", json=payload)

    def verify_transaction(self, merchant_reference):
        """GET /data/transaction/verify/{reference}"""
        return self._request("GET", f"/data/transaction/verify/{merchant_reference}")

    def get_payment_options(self, currency, transaction_type="COLLECTION"):
        """GET /data/payment-providers"""
        return self._request(
            "GET",
            f"/data/payment-providers?currency={currency}&transaction_type={transaction_type}",
        )