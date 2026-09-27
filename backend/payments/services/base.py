import requests
from django.conf import settings


class GatewayError(Exception):
    """Base exception for gateway failures."""
    pass


class BaseGateway:
    """Shared HTTP helpers."""
    base_url = ""
    timeout = 20

    def _headers(self):
        raise NotImplementedError

    def _request(self, method, path, **kwargs):
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        try:
            resp = requests.request(
                method, url, headers=self._headers(), timeout=self.timeout, **kwargs
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            raise GatewayError(str(exc)) from exc