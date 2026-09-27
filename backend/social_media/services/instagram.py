import requests
from django.conf import settings


class InstagramService:
    BASE = "https://graph.facebook.com/v18.0"

    @staticmethod
    def get_media(limit=10):
        """Get recent media from the Instagram Business Account."""
        resp = requests.get(
            f"{InstagramService.BASE}/{settings.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media",
            params={
                "fields": "id,caption,media_type,media_url,permalink,timestamp",
                "limit": limit,
                "access_token": settings.INSTAGRAM_ACCESS_TOKEN,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def publish_photo(image_url, caption):
        """
        Publish a photo to Instagram.
        Note: Requires a public image URL and the media container flow.
        """
        # Step 1: Create media container
        container = requests.post(
            f"{InstagramService.BASE}/{settings.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media",
            data={
                "image_url": image_url,
                "caption": caption,
                "access_token": settings.INSTAGRAM_ACCESS_TOKEN,
            },
            timeout=15,
        )
        container.raise_for_status()
        creation_id = container.json()["id"]

        # Step 2: Publish
        publish = requests.post(
            f"{InstagramService.BASE}/{settings.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish",
            data={
                "creation_id": creation_id,
                "access_token": settings.INSTAGRAM_ACCESS_TOKEN,
            },
            timeout=15,
        )
        publish.raise_for_status()
        return publish.json()