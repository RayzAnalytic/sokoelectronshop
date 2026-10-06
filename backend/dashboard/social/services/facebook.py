"""
Facebook Pages Graph API client.

Docs:
    Publish:  https://developers.facebook.com/docs/pages/publishing
    Metrics:  https://developers.facebook.com/docs/graph-api/reference/page-post/
"""
from __future__ import annotations

import logging

import requests
from django.conf import settings

from .base import (
    MetricsResult,
    PlatformClient,
    PlatformError,
    PublishResult,
    QuotaExceededError,
)

logger = logging.getLogger("social.publish")


GRAPH_VERSION = None  # lazily read from settings


def _graph_base() -> str:
    version = getattr(settings, "META_GRAPH_API_VERSION", "v21.0")
    return f"https://graph.facebook.com/{version}"


class FacebookClient(PlatformClient):
    platform = "FACEBOOK"

    # ── Publish ─────────────────────────────────────────────────────────

    def publish(self, caption: str, media_paths: list[str], product_tag: str = "") -> PublishResult:
        if self.dry_run:
            self._log_dry_run("publish", caption=caption[:60], media=len(media_paths))
            return PublishResult(
                platform_post_id=f"dryrun-fb-{self.account.pk}",
                platform_url="https://facebook.com/",
            )

        self._require_connected()
        page_id = self.account.metadata.get("page_id") or getattr(settings, "FACEBOOK_PAGE_ID", "")
        token = self.account.access_token
        if not page_id:
            raise PlatformError("Facebook page_id missing from account metadata.")

        url = f"{_graph_base()}/{page_id}/feed"
        body = {"message": caption, "access_token": token}

        # Photo posts: /photos with a single image. Multi-photo posts require
        # the /photos + attached_media workflow which we can add later.
        if media_paths:
            url = f"{_graph_base()}/{page_id}/photos"
            with open(media_paths[0], "rb") as fh:
                resp = requests.post(
                    url,
                    data={"caption": caption, "access_token": token},
                    files={"source": fh},
                    timeout=60,
                )
        else:
            resp = requests.post(url, data=body, timeout=30)

        return self._handle_publish_response(resp)

    def _handle_publish_response(self, resp: requests.Response) -> PublishResult:
        if resp.status_code == 429 or "rate limit" in resp.text.lower():
            raise QuotaExceededError("Facebook rate limit reached.")
        if resp.status_code >= 400:
            raise PlatformError(f"Facebook publish failed ({resp.status_code}): {resp.text[:300]}")
        data = resp.json()
        post_id = data.get("id") or data.get("post_id") or ""
        return PublishResult(
            platform_post_id=post_id,
            platform_url=f"https://facebook.com/{post_id}" if post_id else "",
            raw=data,
        )

    # ── Metrics ─────────────────────────────────────────────────────────

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return MetricsResult()
        self._require_connected()

        url = f"{_graph_base()}/{platform_post_id}"
        params = {
            "fields": "shares,comments.summary(true),reactions.summary(true),insights.metric(post_impressions_unique)",
            "access_token": self.account.access_token,
        }
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code >= 400:
            raise PlatformError(f"Facebook metrics failed ({resp.status_code}): {resp.text[:200]}")

        data = resp.json()
        likes = (data.get("reactions", {}).get("summary", {}) or {}).get("total_count", 0)
        comments = (data.get("comments", {}).get("summary", {}) or {}).get("total_count", 0)
        shares = (data.get("shares", {}) or {}).get("count", 0)

        reach = 0
        for insight in (data.get("insights", {}) or {}).get("data", []):
            for v in insight.get("values", []):
                if isinstance(v.get("value"), int):
                    reach = max(reach, v["value"])

        return MetricsResult(likes=likes, comments=comments, shares=shares, reach=reach)

    # ── Followers ───────────────────────────────────────────────────────

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        page_id = self.account.metadata.get("page_id") or getattr(settings, "FACEBOOK_PAGE_ID", "")
        if not page_id:
            return 0
        resp = requests.get(
            f"{_graph_base()}/{page_id}",
            params={"fields": "followers_count", "access_token": self.account.access_token},
            timeout=30,
        )
        if resp.status_code >= 400:
            return 0
        return int(resp.json().get("followers_count", 0) or 0)