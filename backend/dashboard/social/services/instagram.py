"""
Instagram Graph API client — for Instagram Business accounts linked to a
Facebook Page.

Docs:
    Publish:  https://developers.facebook.com/docs/instagram-api/guides/content-publishing
    Metrics:  https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights

Publishing is a two-step process:
    1. POST /{ig-user-id}/media      → returns a creation_id
    2. POST /{ig-user-id}/media_publish with that creation_id → returns ig_media_id

Instagram requires a publicly reachable image/video URL. Since we store
media on local disk in dev, this client expects `self.account.metadata` to
contain a `public_media_base` (e.g. an S3 domain or ngrok tunnel) or the
`MEDIA_URL_ABSOLUTE` setting to point at a public host.
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


def _graph_base() -> str:
    version = getattr(settings, "META_GRAPH_API_VERSION", "v21.0")
    return f"https://graph.facebook.com/{version}"


class InstagramClient(PlatformClient):
    platform = "INSTAGRAM"

    # ── Publish ─────────────────────────────────────────────────────────

    def publish(self, caption: str, media_paths: list[str], product_tag: str = "") -> PublishResult:
        if self.dry_run:
            self._log_dry_run("publish", caption=caption[:60], media=len(media_paths))
            return PublishResult(
                platform_post_id=f"dryrun-ig-{self.account.pk}",
                platform_url="https://instagram.com/",
            )

        self._require_connected()
        ig_user_id = self.account.metadata.get("ig_user_id") or getattr(
            settings, "INSTAGRAM_BUSINESS_ACCOUNT_ID", ""
        )
        if not ig_user_id:
            raise PlatformError("Instagram ig_user_id missing from account metadata.")
        if not media_paths:
            raise PlatformError("Instagram requires at least one image or video.")

        token = self.account.access_token
        # Step 1 — create the media container
        media_url = self._public_url(media_paths[0])
        is_video = media_paths[0].lower().endswith((".mp4", ".mov", ".m4v"))

        create_url = f"{_graph_base()}/{ig_user_id}/media"
        create_payload = {
            "caption": caption,
            "access_token": token,
        }
        if is_video:
            create_payload["media_type"] = "REELS"
            create_payload["video_url"] = media_url
        else:
            create_payload["image_url"] = media_url

        resp = requests.post(create_url, data=create_payload, timeout=60)
        if resp.status_code >= 400:
            if "rate limit" in resp.text.lower():
                raise QuotaExceededError("Instagram rate limit reached.")
            raise PlatformError(f"Instagram container create failed ({resp.status_code}): {resp.text[:300]}")
        creation_id = resp.json().get("id")
        if not creation_id:
            raise PlatformError("Instagram did not return a creation id.")

        # Step 2 — publish
        publish_url = f"{_graph_base()}/{ig_user_id}/media_publish"
        resp = requests.post(
            publish_url,
            data={"creation_id": creation_id, "access_token": token},
            timeout=60,
        )
        if resp.status_code >= 400:
            raise PlatformError(f"Instagram publish failed ({resp.status_code}): {resp.text[:300]}")

        ig_media_id = resp.json().get("id", "")
        return PublishResult(
            platform_post_id=ig_media_id,
            platform_url=f"https://www.instagram.com/p/{ig_media_id}/" if ig_media_id else "",
            raw=resp.json(),
        )

    def _public_url(self, path: str) -> str:
        """Turn a local media path into a URL Instagram can fetch."""
        # If the caller already provided an http(s) URL, pass it through.
        if path.startswith("http://") or path.startswith("https://"):
            return path

        base = (
            self.account.metadata.get("public_media_base")
            or getattr(settings, "MEDIA_URL_ABSOLUTE", "")
            or getattr(settings, "BACKEND_PUBLIC_URL", "")
        )
        if not base:
            raise PlatformError(
                "Instagram requires publicly reachable media, but neither "
                "MEDIA_URL_ABSOLUTE nor BACKEND_PUBLIC_URL is set."
            )
        # Strip MEDIA_ROOT to leave the relative part, then join.
        media_root = str(getattr(settings, "MEDIA_ROOT", ""))
        rel = path.replace(media_root, "", 1).lstrip("/")
        return f"{base.rstrip('/')}/{rel}"

    # ── Metrics ─────────────────────────────────────────────────────────

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return MetricsResult()
        self._require_connected()

        url = f"{_graph_base()}/{platform_post_id}"
        params = {
            "fields": "like_count,comments_count,insights.metric(impressions,reach,shares)",
            "access_token": self.account.access_token,
        }
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code >= 400:
            raise PlatformError(f"Instagram metrics failed ({resp.status_code}): {resp.text[:200]}")

        data = resp.json()
        likes = int(data.get("like_count", 0) or 0)
        comments = int(data.get("comments_count", 0) or 0)

        reach = shares = impressions = 0
        for insight in (data.get("insights", {}) or {}).get("data", []):
            name = insight.get("name")
            for v in insight.get("values", []):
                val = v.get("value", 0)
                if name == "reach":
                    reach = int(val or 0)
                elif name == "impressions":
                    impressions = int(val or 0)
                elif name == "shares":
                    shares = int(val or 0)

        return MetricsResult(
            likes=likes, comments=comments, shares=shares,
            reach=reach, impressions=impressions,
        )

    # ── Followers ───────────────────────────────────────────────────────

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        ig_user_id = self.account.metadata.get("ig_user_id") or getattr(
            settings, "INSTAGRAM_BUSINESS_ACCOUNT_ID", ""
        )
        if not ig_user_id:
            return 0
        resp = requests.get(
            f"{_graph_base()}/{ig_user_id}",
            params={"fields": "followers_count", "access_token": self.account.access_token},
            timeout=30,
        )
        if resp.status_code >= 400:
            return 0
        return int(resp.json().get("followers_count", 0) or 0)