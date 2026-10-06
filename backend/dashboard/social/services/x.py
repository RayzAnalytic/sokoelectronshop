"""
X (Twitter) API v2 client.

Posting uses OAuth 1.0a user context; metrics reads use OAuth 2.0 bearer.
We require both to be configured (`X_API_KEY`, `X_API_SECRET`,
`X_BEARER_TOKEN`) and store the per-account user tokens on `SocialAccount`.

Media upload (images/videos) uses the v1.1 media endpoint, which is still
the only supported path for uploading media as of API v2.
"""
from __future__ import annotations

import logging
import os

import requests
from requests_oauthlib import OAuth1

from django.conf import settings

from .base import (
    MetricsResult,
    PlatformClient,
    PlatformError,
    PublishResult,
    QuotaExceededError,
)

logger = logging.getLogger("social.publish")


X_API_V2 = "https://api.twitter.com/2"
X_API_V1_MEDIA = "https://upload.twitter.com/1.1/media/upload.json"


class XClient(PlatformClient):
    platform = "X"

    def _oauth1(self) -> OAuth1:
        return OAuth1(
            settings.X_API_KEY,
            settings.X_API_SECRET,
            self.account.metadata.get("oauth_token") or self.account.access_token,
            self.account.metadata.get("oauth_token_secret") or self.account.refresh_token,
        )

    # ── Publish ─────────────────────────────────────────────────────────

    def publish(self, caption: str, media_paths: list[str], product_tag: str = "") -> PublishResult:
        if self.dry_run:
            self._log_dry_run("publish", caption=caption[:60], media=len(media_paths))
            return PublishResult(
                platform_post_id=f"dryrun-x-{self.account.pk}",
                platform_url="https://x.com/",
            )

        self._require_connected()
        auth = self._oauth1()
        media_ids: list[str] = []

        # 1. Upload media (images only for now — video needs chunked upload)
        for path in media_paths[:4]:  # X allows 4 images per tweet
            if path.lower().endswith((".mp4", ".mov")):
                logger.warning("X: video upload not implemented; skipping %s", path)
                continue
            with open(path, "rb") as fh:
                resp = requests.post(
                    X_API_V1_MEDIA,
                    auth=auth,
                    files={"media": fh},
                    timeout=60,
                )
            if resp.status_code == 429:
                raise QuotaExceededError("X media upload rate limit reached.")
            if resp.status_code >= 400:
                raise PlatformError(f"X media upload failed ({resp.status_code}): {resp.text[:200]}")
            media_ids.append(str(resp.json()["media_id_string"]))

        # 2. Create the tweet
        payload = {"text": caption[:280]}
        if media_ids:
            payload["media"] = {"media_ids": media_ids}

        resp = requests.post(
            f"{X_API_V2}/tweets",
            auth=auth,
            json=payload,
            timeout=30,
        )
        if resp.status_code == 429:
            raise QuotaExceededError("X tweet rate limit reached.")
        if resp.status_code >= 400:
            raise PlatformError(f"X publish failed ({resp.status_code}): {resp.text[:300]}")

        data = resp.json().get("data", {})
        tweet_id = data.get("id", "")
        return PublishResult(
            platform_post_id=tweet_id,
            platform_url=f"https://x.com/i/web/status/{tweet_id}" if tweet_id else "",
            raw=data,
        )

    # ── Metrics ─────────────────────────────────────────────────────────

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return MetricsResult()
        if not settings.X_BEARER_TOKEN:
            return MetricsResult()

        resp = requests.get(
            f"{X_API_V2}/tweets/{platform_post_id}",
            params={"tweet.fields": "public_metrics"},
            headers={"Authorization": f"Bearer {settings.X_BEARER_TOKEN}"},
            timeout=30,
        )
        if resp.status_code >= 400:
            return MetricsResult()

        m = (resp.json().get("data", {}) or {}).get("public_metrics", {})
        return MetricsResult(
            likes=int(m.get("like_count", 0) or 0),
            comments=int(m.get("reply_count", 0) or 0),
            shares=int(m.get("retweet_count", 0) or 0) + int(m.get("quote_count", 0) or 0),
            reach=int(m.get("impression_count", 0) or 0),
        )

    # ── Followers ───────────────────────────────────────────────────────

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        user_id = self.account.platform_user_id
        if not user_id or not settings.X_BEARER_TOKEN:
            return 0
        resp = requests.get(
            f"{X_API_V2}/users/{user_id}",
            params={"user.fields": "public_metrics"},
            headers={"Authorization": f"Bearer {settings.X_BEARER_TOKEN}"},
            timeout=30,
        )
        if resp.status_code >= 400:
            return 0
        m = (resp.json().get("data", {}) or {}).get("public_metrics", {})
        return int(m.get("followers_count", 0) or 0)