# social_media/services/tiktok_shop.py

import hashlib
import hmac
import time
import requests
from urllib.parse import urlencode
from django.conf import settings


class TikTokShopService:
    """
    Client for TikTok Shop Open API.
    Docs: https://partner.tiktokshop.com/docv2/page/main
    """
    BASE_URL = settings.TIKTOK_SHOP_BASE_URL
    AUTH_URL = settings.TIKTOK_SHOP_AUTH_BASE_URL

    def __init__(self, access_token=None, shop_cipher=None):
        self.access_token = access_token or settings.TIKTOK_SHOP_ACCESS_TOKEN
        self.shop_cipher = shop_cipher
        self.app_key = settings.TIKTOK_SHOP_APP_KEY
        self.app_secret = settings.TIKTOK_SHOP_APP_SECRET

    # ── OAuth ──────────────────────────────────────────────
    def get_authorization_url(self, state=""):
        """Build the URL the seller visits to authorize your app."""
        params = {
            "service_id": settings.TIKTOK_SHOP_SERVICE_ID,
            "state": state,
        }
        return f"{self.AUTH_URL}/open/authorize?{urlencode(params)}"

    def exchange_code_for_token(self, auth_code):
        """Exchange the authorization code for access/refresh tokens."""
        path = "/api/v2/token/get"
        timestamp = int(time.time())
        params = {
            "app_key": self.app_key,
            "auth_code": auth_code,
            "timestamp": timestamp,
            "app_secret": self.app_secret,  # some flows include it in body
        }
        # TikTok Shop token endpoint uses app_key + app_secret + auth_code
        resp = requests.post(
            f"{self.BASE_URL}{path}",
            params={
                "app_key": self.app_key,
                "auth_code": auth_code,
                "timestamp": timestamp,
                "sign": self._sign(path, {"app_key": self.app_key, "auth_code": auth_code, "timestamp": timestamp}),
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Request Signing ────────────────────────────────────
    def _sign(self, path, params, body=""):
        """
        HMAC-SHA256 signature over sorted params + body.
        Canonical string: app_secret + path + sorted_key_value_pairs + body + app_secret
        """
        # Sort params alphabetically by key
        sorted_params = sorted(params.items())
        param_str = "".join(f"{k}{v}" for k, v in sorted_params)

        base = f"{self.app_secret}{path}{param_str}{body}{self.app_secret}"
        digest = hmac.new(
            self.app_secret.encode("utf-8"),
            base.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return digest

    # ── Shop Info ──────────────────────────────────────────
    def get_authorized_shops(self):
        """Enumerate shops this token can act for (returns shop_cipher values)."""
        path = "/authorization/202309/shops"
        timestamp = int(time.time())
        params = {
            "app_key": self.app_key,
            "timestamp": timestamp,
        }
        params["sign"] = self._sign(path, params)

        resp = requests.get(
            f"{self.BASE_URL}{path}",
            params=params,
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def _headers(self):
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["x-tts-access-token"] = self.access_token
        return headers

    # ── Products ───────────────────────────────────────────
    def list_products(self, page_size=20, page_token=""):
        """Retrieve a list of products."""
        path = "/product/202309/products/search"
        timestamp = int(time.time())
        params = {
            "app_key": self.app_key,
            "timestamp": timestamp,
            "page_size": page_size,
        }
        if page_token:
            params["page_token"] = page_token
        if self.shop_cipher:
            params["shop_cipher"] = self.shop_cipher
        params["sign"] = self._sign(path, params)

        resp = requests.post(
            f"{self.BASE_URL}{path}",
            params=params,
            headers=self._headers(),
            json={},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_product(self, product_id):
        """Get details for a specific product."""
        path = f"/product/202309/products/{product_id}"
        timestamp = int(time.time())
        params = {"app_key": self.app_key, "timestamp": timestamp}
        if self.shop_cipher:
            params["shop_cipher"] = self.shop_cipher
        params["sign"] = self._sign(path, params)

        resp = requests.get(
            f"{self.BASE_URL}{path}",
            params=params,
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Orders ─────────────────────────────────────────────
    def list_orders(self, page_size=20, order_status="", page_token=""):
        """Retrieve orders for the authorized shop."""
        path = "/order/202309/orders/search"
        timestamp = int(time.time())
        params = {
            "app_key": self.app_key,
            "timestamp": timestamp,
            "page_size": page_size,
        }
        if order_status:
            params["order_status"] = order_status
        if page_token:
            params["page_token"] = page_token
        if self.shop_cipher:
            params["shop_cipher"] = self.shop_cipher
        params["sign"] = self._sign(path, params)

        resp = requests.post(
            f"{self.BASE_URL}{path}",
            params=params,
            headers=self._headers(),
            json={},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()