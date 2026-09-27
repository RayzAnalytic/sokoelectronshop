import requests
from django.conf import settings


class FacebookService:
    BASE = "https://graph.facebook.com/v18.0"

    @staticmethod
    def post_to_page(message, link=None):
        """Publish a post to the configured Facebook Page."""
        payload = {
            "message": message,
            "access_token": settings.FACEBOOK_PAGE_ACCESS_TOKEN,
        }
        if link:
            payload["link"] = link

        resp = requests.post(
            f"{FacebookService.BASE}/me/feed",
            data=payload,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def get_page_insights():
        """Fetch basic page insights."""
        resp = requests.get(
            f"{FacebookService.BASE}/me/insights",
            params={
                "metric": "page_impressions,page_engaged_users",
                "access_token": settings.FACEBOOK_PAGE_ACCESS_TOKEN,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()