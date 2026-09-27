import base64
from datetime import datetime
import requests
from django.conf import settings
from .base import BaseGateway


class MpesaGateway(BaseGateway):
    """
    Safaricom Daraja 3.0 — STK Push (Lipa Na M-Pesa Online).
    Docs: https://developer.safaricom.co.ke
    """
    base_url = settings.MPESA_BASE_URL
    timeout = 30

    def _get_token(self):
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        resp = requests.get(
            url,
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    def _headers(self):
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
        }

    def _timestamp(self):
        return datetime.now().strftime("%Y%m%d%H%M%S")

    def _password(self, timestamp):
        raw = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
        return base64.b64encode(raw.encode()).decode()

    @staticmethod
    def normalize_phone(phone):
        """Convert 0712..., 254712..., +254712... to 2547XXXXXXXX."""
        p = phone.replace("+", "").replace(" ", "").strip()
        if p.startswith("0"):
            p = "254" + p[1:]
        elif p.startswith("7") and len(p) == 9:
            p = "254" + p
        return p

    def stk_push(self, phone_number, amount, order_reference, description):
        """POST /mpesa/stkpush/v1/processrequest"""
        timestamp = self._timestamp()
        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": self._password(timestamp),
            "Timestamp": timestamp,
            "TransactionType": settings.MPESA_TRANSACTION_TYPE,
            "Amount": int(amount),
            "PartyA": self.normalize_phone(phone_number),
            "PartyB": settings.MPESA_SHORTCODE,
            "PhoneNumber": self.normalize_phone(phone_number),
            "CallBackURL": settings.MPESA_CALLBACK_URL,
            "AccountReference": order_reference[:12],
            "TransactionDesc": description[:13],
        }
        return self._request("POST", "/mpesa/stkpush/v1/processrequest", json=payload)

    def stk_query(self, checkout_request_id):
        """POST /mpesa/stkpushquery/v1/query"""
        timestamp = self._timestamp()
        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": self._password(timestamp),
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id,
        }
        return self._request("POST", "/mpesa/stkpushquery/v1/query", json=payload)