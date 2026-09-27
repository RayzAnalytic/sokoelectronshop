import requests
from requests_oauthlib import OAuth1
from django.conf import settings


class TwitterService:
    BASE = "https://api.twitter.com/2"

    @staticmethod
    def _oauth1():
        return OAuth1(
            settings.X_API_KEY,
            settings.X_API_SECRET,
            settings.X_ACCESS_TOKEN,
            settings.X_ACCESS_TOKEN_SECRET,
        )

    @staticmethod
    def post_tweet(text):
        """Post a tweet (OAuth 1.0a User Context)."""
        resp = requests.post(
            f"{TwitterService.BASE}/tweets",
            json={"text": text},
            auth=TwitterService._oauth1(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def get_user_tweets(user_id, max_results=10):
        """Fetch recent tweets (Bearer Token — App-only)."""
        resp = requests.get(
            f"{TwitterService.BASE}/users/{user_id}/tweets",
            params={"max_results": max_results},
            headers={"Authorization": f"Bearer {settings.X_BEARER_TOKEN}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()