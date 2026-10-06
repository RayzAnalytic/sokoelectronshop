"""
TikTok Content Posting API client.

Docs:
    https://developers.tiktok.com/doc/content-posting-api-get-started

Notes:
  • Requires the app to be approved for `video.publish`. Until approval,
    everything can only go to drafts (not implemented here yet).
  • Publish is a two-step process: init upload → upload file → publish.
    TikTok also requires chunked upload for files > 5 MB.
  • Rate limits are strict: ~6 posts/day per user in the default tier.
"""
from __future__ import annotations

import logging
import os

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


TIKTOK_API = "https://open.tiktokapis.com/v2"


class TikTokClient(PlatformClient):
    platform = "TIKTOK"

    def publish(self, caption: str, media_paths: list[str], product_tag: str = "") -> PublishResult:
        if self.dry_run:
            self._log_dry_run("publish", caption=caption[:60], media=len(media_paths))
            return PublishResult(
                platform_post_id=f"dryrun-tt-{self.account.pk}",
                platform_url="https://tiktok.com/",
            )

        self._require_connected()
        if not media_paths:
            raise PlatformError("TikTok requires a video file.")

        video_path = media_paths[0]
        file_size = os.path.getsize(video_path)
        token = self.account.access_token

        # Step 1 — init
        init_resp = requests.post(
            f"{TIKTOK_API}/post/publish/video/init/",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json={
                "post_info": {
                    "title": caption[:2200],
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": file_size,
                    "chunk_size": file_size,       # single-chunk upload
                    "total_chunk_count": 1,
                },
            },
            timeout=30,
        )
        if init_resp.status_code == 429:
            raise QuotaExceededError("TikTok rate limit reached.")
        if init_resp.status_code >= 400:
            raise PlatformError(f"TikTok init failed ({init_resp.status_code}): {init_resp.text[:300]}")

        data = init_resp.json().get("data", {})
        upload_url = data.get("upload_url")
        publish_id = data.get("publish_id")
        if not upload_url or not publish_id:
            raise PlatformError("TikTok did not return an upload URL / publish id.")

        # Step 2 — upload the bytes
        with open(video_path, "rb") as fh:
            upload_resp = requests.put(
                upload_url,
                data=fh,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                },
                timeout=600,
            )
        if upload_resp.status_code >= 400:
            raise PlatformError(f"TikTok upload failed ({upload_resp.status_code}).")

        return PublishResult(
            platform_post_id=publish_id,
            platform_url="",  # TikTok does not expose the URL until processing completes
            raw={"publish_id": publish_id},
        )

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        """
        TikTok's video list endpoint is scoped to the authorized user — there
        is no direct per-post metrics lookup by id in the public API yet.
        Best-effort: fetch the user's recent videos and pick the matching id.
        """
        if self.dry_run:
            return MetricsResult()
        self._require_connected()

        resp = requests.post(
            f"{TIKTOK_API}/video/list/",
            headers={
                "Authorization": f"Bearer {self.account.access_token}",
                "Content-Type": "application/json",
            },
            params={"fields": "id,like_count,comment_count,share_count,view_count"},
            json={},
            timeout=30,
        )
        if resp.status_code >= 400:
            return MetricsResult()

        for v in (resp.json().get("data", {}) or {}).get("videos", []):
            if v.get("id") == platform_post_id:
                return MetricsResult(
                    likes=int(v.get("like_count", 0) or 0),
                    comments=int(v.get("comment_count", 0) or 0),
                    shares=int(v.get("share_count", 0) or 0),
                    reach=int(v.get("view_count", 0) or 0),
                )
        return MetricsResult()

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        resp = requests.get(
            f"{TIKTOK_API}/user/info/",
            headers={"Authorization": f"Bearer {self.account.access_token}"},
            params={"fields": "follower_count"},
            timeout=30,
        )
        if resp.status_code >= 400:
            return 0
        return int((resp.json().get("data", {}) or {}).get("user", {}).get("follower_count", 0) or 0)