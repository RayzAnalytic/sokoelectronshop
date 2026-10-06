"""
YouTube Data API v3 client.

Docs: https://developers.google.com/youtube/v3/docs/videos/insert

Quota:
  Default daily quota is 10,000 units. One `videos.insert` costs 1,600 units,
  so you get ~6 uploads/day before quotaExceeded. A read (`videos.list`) is
  1 unit. We surface quota failures as `QuotaExceededError` so the caller
  can mark the target FAILED without retrying.
"""
from __future__ import annotations

import logging

from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from .base import (
    MetricsResult,
    PlatformClient,
    PlatformError,
    PublishResult,
    QuotaExceededError,
)

logger = logging.getLogger("social.publish")


class YouTubeClient(PlatformClient):
    platform = "YOUTUBE"

    def _credentials(self) -> Credentials:
        creds = Credentials(
            token=self.account.access_token or None,
            refresh_token=self.account.refresh_token or None,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=settings.YOUTUBE_SCOPES,
        )
        if not creds.valid:
            try:
                creds.refresh(Request())
                # Persist the new access token; keep the refresh token if the
                # library didn't return one (Google only issues it once).
                self.account.access_token = creds.token or ""
                if creds.refresh_token:
                    self.account.refresh_token = creds.refresh_token
                if creds.expiry:
                    self.account.token_expires_at = creds.expiry
                self.account.save(update_fields=[
                    "access_token", "refresh_token", "token_expires_at", "updated_at",
                ])
            except Exception as exc:
                raise PlatformError(f"YouTube token refresh failed: {exc}") from exc
        return creds

    def _service(self):
        return build("youtube", "v3", credentials=self._credentials(), cache_discovery=False)

    # ── Publish ─────────────────────────────────────────────────────────

    def publish(self, caption: str, media_paths: list[str], product_tag: str = "") -> PublishResult:
        if self.dry_run:
            self._log_dry_run("publish", caption=caption[:60], media=len(media_paths))
            return PublishResult(
                platform_post_id=f"dryrun-yt-{self.account.pk}",
                platform_url="https://youtube.com/",
            )

        self._require_connected()
        if not media_paths:
            raise PlatformError("YouTube requires a video file.")

        lines = (caption or "").strip().split("\n", 1)
        title = lines[0][:100] or "Untitled"
        description = lines[1] if len(lines) > 1 else caption

        body = {
            "snippet": {
                "title": title,
                "description": description,
                "categoryId": self.account.metadata.get("category_id", "22"),
            },
            "status": {
                "privacyStatus": self.account.metadata.get("privacy_status", "public"),
                "selfDeclaredMadeForKids": False,
            },
        }

        media = MediaFileUpload(media_paths[0], chunksize=-1, resumable=True)
        try:
            request = self._service().videos().insert(
                part="snippet,status", body=body, media_body=media,
            )
            response = request.execute()
        except HttpError as exc:
            msg = str(exc)
            if "quotaExceeded" in msg or exc.resp.status == 403:
                raise QuotaExceededError(
                    "YouTube daily quota exceeded — 1,600 units per upload, "
                    "10,000 units/day limit."
                ) from exc
            raise PlatformError(f"YouTube publish failed: {msg[:300]}") from exc

        vid = response.get("id", "")
        return PublishResult(
            platform_post_id=vid,
            platform_url=f"https://youtu.be/{vid}" if vid else "",
            raw=response,
        )

    # ── Metrics ─────────────────────────────────────────────────────────

    def fetch_metrics(self, platform_post_id: str) -> MetricsResult:
        if self.dry_run:
            return MetricsResult()
        try:
            resp = self._service().videos().list(
                part="statistics", id=platform_post_id,
            ).execute()
        except HttpError as exc:
            raise PlatformError(f"YouTube metrics failed: {exc}") from exc

        items = resp.get("items") or []
        if not items:
            return MetricsResult()
        stats = items[0].get("statistics", {})
        return MetricsResult(
            likes=int(stats.get("likeCount", 0) or 0),
            comments=int(stats.get("commentCount", 0) or 0),
            shares=0,   # not exposed
            reach=int(stats.get("viewCount", 0) or 0),
            impressions=0,
        )

    # ── Followers ───────────────────────────────────────────────────────

    def fetch_followers(self) -> int:
        if self.dry_run:
            return 0
        try:
            resp = self._service().channels().list(
                part="statistics", mine=True,
            ).execute()
        except HttpError:
            return 0
        items = resp.get("items") or []
        if not items:
            return 0
        return int(items[0].get("statistics", {}).get("subscriberCount", 0) or 0)