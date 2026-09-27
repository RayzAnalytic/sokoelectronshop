import requests
from django.conf import settings


class WhatsAppClient:
    """Minimal client for Meta WhatsApp Cloud API."""

    def __init__(self):
        self.base_url = settings.WHATSAPP_BASE_URL
        self.version = settings.WHATSAPP_API_VERSION
        self.phone_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.token = settings.WHATSAPP_ACCESS_TOKEN

    def _url(self, path):
        return f"{self.base_url}/{self.version}/{self.phone_id}/{path}"

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def send_text(self, to_number, text):
        """Send a free-form text message (only valid inside 24-hour window)."""
        resp = requests.post(
            self._url("messages"),
            headers=self._headers(),
            json={
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "text",
                "text": {"body": text},
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def send_template(self, to_number, template_name, language="en_US", components=None):
        """Send a pre-approved template message (required outside 24-hour window)."""
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
            },
        }
        if components:
            payload["template"]["components"] = components

        resp = requests.post(
            self._url("messages"),
            headers=self._headers(),
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()