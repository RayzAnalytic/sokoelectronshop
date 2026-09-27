import requests
from django.conf import settings


class YouTubeService:
    BASE = "https://www.googleapis.com/youtube/v3"

    @staticmethod
    def search_videos(query, max_results=10):
        """Public search — API key only."""
        resp = requests.get(
            f"{YouTubeService.BASE}/search",
            params={
                "part": "snippet",
                "q": query,
                "maxResults": max_results,
                "key": settings.YOUTUBE_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def get_channel_videos(channel_id, max_results=10):
        """Get videos from a specific channel."""
        resp = requests.get(
            f"{YouTubeService.BASE}/search",
            params={
                "part": "snippet",
                "channelId": channel_id,
                "order": "date",
                "maxResults": max_results,
                "key": settings.YOUTUBE_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()