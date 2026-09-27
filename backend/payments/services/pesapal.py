from django.conf import settings
from .base import BaseGateway


class PesapalGateway(BaseGateway):
    """
    Pesapal API 3.0.
    Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json
    """
    base_url = settings.PESAPAL_BASE_URL
    timeout = 30

    def _get_token(self):
        url = f"{self.base_url}/api/Auth/RequestToken"
        resp = requests.post(
            url,
            json={
                "consumer_key": settings.PESAPAL_CONSUMER_KEY,
                "consumer_secret": settings.PESAPAL_CONSUMER_SECRET,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["token"]

    def _headers(self):
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self._get_token()}",
        }

    def register_ipn(self, ipn_url):
        """POST /api/URLSetup/RegisterIPN"""
        return self._request("POST", "/api/URLSetup/RegisterIPN", json={
            "url": ipn_url,
            "ipn_notification_type": "POST",
        })

    def submit_order(self, payload):
        """POST /api/Transactions/SubmitOrderRequest"""
        return self._request("POST", "/api/Transactions/SubmitOrderRequest", json=payload)

    def get_transaction_status(self, order_tracking_id):
        """GET /api/Transactions/GetTransactionStatus?orderTrackingId=..."""
        return self._request(
            "GET",
            f"/api/Transactions/GetTransactionStatus?orderTrackingId={order_tracking_id}",
        )