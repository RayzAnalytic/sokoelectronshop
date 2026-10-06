"""
Social media hub — dashboard API + OAuth callbacks.

Admin endpoints:  /api/v1/admin/social/...      (staff only)
OAuth callbacks:  /api/v1/social/oauth/...      (AllowAny — the platform calls us)
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    PostStatus,
    SocialAccount,
    SocialFollowerSnapshot,
    SocialMedia,
    SocialPlatform,
    SocialPost,
    SocialPostTarget,
    TargetStatus,
)
from .permissions import IsStaff
from .serializers import (
    MediaUploadSerializer,
    PostCreateSerializer,
    SocialAccountSerializer,
    SocialMediaSerializer,
    SocialPostSerializer,
)
from .services.oauth import build_state, parse_state, redirect_uri, upsert_account
from .tasks import publish_post

logger = logging.getLogger("social.oauth")


# ═════════════════════════════════════════════════════════════════════════════
# Payload helpers — exactly matching lib/admin-types.ts
# ═════════════════════════════════════════════════════════════════════════════

PLATFORM_DISPLAY: dict[str, str] = {
    "FACEBOOK":  "Facebook",
    "INSTAGRAM": "Instagram",
    "TIKTOK":    "TikTok",
    "YOUTUBE":   "YouTube",
    "X":         "X",
}

PLATFORM_META: dict[str, dict] = {
    "FACEBOOK":  {"name": "Facebook Page",        "avatarBg": "bg-[#1877F2]"},
    "INSTAGRAM": {"name": "Instagram Business",   "avatarBg": "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]"},
    "TIKTOK":    {"name": "TikTok Creator",       "avatarBg": "bg-black"},
    "YOUTUBE":   {"name": "YouTube Channel",      "avatarBg": "bg-[#FF0000]"},
    "X":         {"name": "X (Twitter)",          "avatarBg": "bg-black"},
}


def _account_payload(account: SocialAccount | None, platform_code: str) -> dict:
    """Frontend `ConnectedAccount` shape — always returned, even when disconnected."""
    meta = PLATFORM_META.get(platform_code, {"name": platform_code, "avatarBg": "bg-slate-700"})
    return {
        "id":         PLATFORM_DISPLAY.get(platform_code, platform_code),
        "name":       meta["name"],
        "handle":     account.handle if account else "",
        "connected":  bool(account and account.is_connected),
        "avatarBg":   meta["avatarBg"],
    }


def _scheduled_payload(post: SocialPost) -> dict:
    """Frontend `ScheduledPost` shape."""
    return {
        "id":             str(post.pk),
        "platforms":      [PLATFORM_DISPLAY.get(t.platform, t.platform) for t in post.targets.all()],
        "caption":        post.caption,
        "scheduledTime":  post.scheduled_for.isoformat() if post.scheduled_for else "",
        "productTag":     post.product_tag or None,
        "mediaUrl":       post.media.first().file.url if post.media.exists() else None,
    }


def _published_payload(target: SocialPostTarget) -> dict:
    """Frontend `PublishedPost` shape — one row per published target."""
    return {
        "id":          str(target.pk),
        "platform":    PLATFORM_DISPLAY.get(target.platform, target.platform),
        "caption":     target.post.caption,
        "publishedAt": target.published_at.isoformat() if target.published_at else None,
        "likes":       target.likes,
        "comments":    target.comments,
        "shares":      target.shares,
        "reach":       target.reach,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Accounts
# ═════════════════════════════════════════════════════════════════════════════

class AccountListView(APIView):
    """
    GET /api/v1/admin/social/accounts/

    Always returns all five platforms — connected or not — because the UI
    renders a fixed grid and needs the disconnected ones to show "Connect".
    """
    permission_classes = [IsStaff]

    def get(self, request):
        existing = {a.platform: a for a in SocialAccount.objects.all()}
        return Response([
            _account_payload(existing.get(code), code)
            for code, _ in SocialPlatform.choices
        ])


class AccountConnectView(APIView):
    """
    POST /api/v1/admin/social/accounts/<platform>/connect/

    In dry-run mode: marks the account connected immediately.
    In production: returns `{ authUrl }` for the frontend to redirect to.
    """
    permission_classes = [IsStaff]

    def post(self, request, platform: str):
        code = platform.upper()
        if code not in {c for c, _ in SocialPlatform.choices}:
            return Response({"detail": f"Unknown platform {platform!r}."}, status=400)

        if getattr(settings, "SOCIAL_DRY_RUN", True):
            account, _ = SocialAccount.objects.get_or_create(platform=code)
            account.is_connected = True
            account.connected_at = timezone.now()
            account.handle = account.handle or f"@{code.lower()}_dry"
            account.display_name = account.display_name or PLATFORM_META[code]["name"]
            account.save()
            return Response(_account_payload(account, code))

        state = build_state(code, request.user.pk)
        auth_url = _build_auth_url(code, state)
        if not auth_url:
            return Response(
                {"detail": f"No OAuth URL configured for {code}. Check your .env."},
                status=500,
            )
        return Response({"authUrl": auth_url})


class AccountDisconnectView(APIView):
    """POST /api/v1/admin/social/accounts/<platform>/disconnect/"""
    permission_classes = [IsStaff]

    def post(self, request, platform: str):
        code = platform.upper()
        try:
            account = SocialAccount.objects.get(platform=code)
        except SocialAccount.DoesNotExist:
            return Response(_account_payload(None, code))

        account.is_connected = False
        account.access_token = ""
        account.refresh_token = ""
        account.token_expires_at = None
        account.save(update_fields=[
            "is_connected", "access_token", "refresh_token", "token_expires_at", "updated_at",
        ])
        return Response(_account_payload(account, code))


# ═════════════════════════════════════════════════════════════════════════════
# Posts
# ═════════════════════════════════════════════════════════════════════════════

class PostListCreateView(APIView):
    """
    GET  /api/v1/admin/social/posts/?status=SCHEDULED   → ScheduledPost[]
    GET  /api/v1/admin/social/posts/?status=PUBLISHED   → PublishedPost[]
    POST /api/v1/admin/social/posts/                    → create + (optionally) publish/schedule
    """
    permission_classes = [IsStaff]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "").upper()

        if status_filter == "PUBLISHED":
            qs = (
                SocialPostTarget.objects
                .filter(status=TargetStatus.PUBLISHED)
                .select_related("post")
                .order_by("-published_at")
            )
            return Response([_published_payload(t) for t in qs[:500]])

        if status_filter == "SCHEDULED":
            qs = (
                SocialPost.objects
                .filter(status=PostStatus.SCHEDULED)
                .prefetch_related("targets", "media")
                .order_by("scheduled_for")
            )
            return Response([_scheduled_payload(p) for p in qs[:500]])

        # No status → return everything (useful for debugging)
        qs = SocialPost.objects.prefetch_related("targets", "media").all()[:200]
        return Response(SocialPostSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        ser = PostCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        with transaction.atomic():
            post = SocialPost.objects.create(
                caption=data["caption"],
                product_tag=data.get("product_tag", "") or "",
                scheduled_for=data.get("schedule_at"),
                status=PostStatus.SCHEDULED if data.get("schedule_at") else PostStatus.DRAFT,
                created_by=request.user if request.user.is_authenticated else None,
            )

            # Attach media
            media_ids = data.get("media_ids") or []
            if media_ids:
                SocialMedia.objects.filter(id__in=media_ids, post__isnull=True).update(post=post)

            # Create one target per platform
            for platform_code in data["platforms"]:
                SocialPostTarget.objects.create(post=post, platform=platform_code)

        # Fire the publish task if this is an immediate post
        if not data.get("schedule_at"):
            publish_post.delay(post.pk)

        # Return a frontend-shaped response
        if data.get("schedule_at"):
            post.refresh_from_db()
            return Response(_scheduled_payload(post), status=201)

        # Immediate publish — response uses whatever the task will set shortly.
        # Return the post id; the UI refreshes the Published tab.
        return Response({"id": post.pk, "status": post.status}, status=202)


class PostPublishNowView(APIView):
    """POST /api/v1/admin/social/posts/<id>/publish/ — publish a SCHEDULED post immediately."""
    permission_classes = [IsStaff]

    def post(self, request, pk):
        try:
            post = SocialPost.objects.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if post.status == PostStatus.PUBLISHED:
            return Response({"detail": "Already published."}, status=400)

        post.status = PostStatus.DRAFT
        post.scheduled_for = None
        post.save(update_fields=["status", "scheduled_for", "updated_at"])
        publish_post.delay(post.pk)
        return Response({"id": post.pk, "status": post.status}, status=202)


class PostDeleteView(APIView):
    """DELETE /api/v1/admin/social/posts/<id>/"""
    permission_classes = [IsStaff]

    def delete(self, request, pk):
        try:
            post = SocialPost.objects.get(pk=pk)
        except SocialPost.DoesNotExist:
            return Response(status=204)

        # Revoke local file handles before deleting rows
        for m in post.media.all():
            try:
                m.file.delete(save=False)
            except Exception:
                pass
        post.delete()
        return Response(status=204)


# ═════════════════════════════════════════════════════════════════════════════
# Media
# ═════════════════════════════════════════════════════════════════════════════

class MediaUploadView(APIView):
    """
    POST /api/v1/admin/social/media/upload/

    Standalone upload — media is not attached to a post yet. Returns
    `{ id, url, mediaType, filename, sizeBytes }`; the composer echoes
    those ids back in `POST /posts/` as `media_ids`.
    """
    permission_classes = [IsStaff]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        ser = MediaUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        f = ser.validated_data["file"]

        max_mb = getattr(settings, "SOCIAL_MAX_MEDIA_SIZE_MB", 25)
        if f.size > max_mb * 1024 * 1024:
            return Response({"detail": f"File exceeds {max_mb} MB."}, status=400)

        ctype = (f.content_type or "").lower()
        if ctype.startswith("image/"):
            media_type = "IMAGE"
        elif ctype.startswith("video/"):
            media_type = "VIDEO"
        else:
            return Response({"detail": "Unsupported file type."}, status=400)

        # `post` is nullable in the composer flow — attach later.
        # If your model requires a post FK, create a placeholder post here.
        media = SocialMedia.objects.create(
            post=None if SocialMedia._meta.get_field("post").null else _placeholder_post(request),
            file=f,
            media_type=media_type,
            filename=getattr(f, "name", ""),
            size_bytes=f.size,
        )
        return Response(SocialMediaSerializer(media, context={"request": request}).data, status=201)


def _placeholder_post(request):
    """
    If `SocialMedia.post` is NOT nullable, create a draft post that the
    composer will attach media to on submit. In practice you should make
    `post` nullable — it's simpler.
    """
    return SocialPost.objects.create(
        caption="", status=PostStatus.DRAFT,
        created_by=request.user if request.user.is_authenticated else None,
    )


# ═════════════════════════════════════════════════════════════════════════════
# Analytics
# ═════════════════════════════════════════════════════════════════════════════

class FollowerAnalyticsView(APIView):
    """
    GET /api/v1/admin/social/analytics/followers/?months=5

    Returns `[{ month, Facebook, Instagram, TikTok, YouTube, X }, ...]`
    matching ANALYTICS_FOLLOWER_DATA in the frontend.
    """
    permission_classes = [IsStaff]

    def get(self, request):
        months_back = int(request.query_params.get("months", 5))
        since = timezone.now().date() - timedelta(days=months_back * 31)

        snaps = (
            SocialFollowerSnapshot.objects
            .filter(date__gte=since)
            .select_related("account")
            .order_by("date")
        )

        # Bucket per calendar month
        buckets: dict[str, dict] = {}
        for s in snaps:
            key = s.date.strftime("%b")     # 'May', 'Jun', …
            buckets.setdefault(key, {
                "month": key,
                **{PLATFORM_DISPLAY[c]: 0 for c, _ in SocialPlatform.choices},
            })
            buckets[key][PLATFORM_DISPLAY[s.account.platform]] = s.followers

        # Preserve chronological order
        ordered = sorted(buckets.values(), key=lambda b: _month_index(b["month"]))
        return Response(ordered)


def _month_index(short: str) -> int:
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    try:
        return months.index(short)
    except ValueError:
        return 0


class EngagementAnalyticsView(APIView):
    """
    GET /api/v1/admin/social/analytics/engagement/

    Returns `[{ platform, Reach, Engagement }, ...]` matching
    PLATFORM_ENGAGEMENT_COMPARISON.
    """
    permission_classes = [IsStaff]

    def get(self, request):
        out = []
        for code, _ in SocialPlatform.choices:
            qs = SocialPostTarget.objects.filter(
                platform=code, status=TargetStatus.PUBLISHED,
            )
            reach = sum(qs.values_list("reach", flat=True)) or 0
            eng = sum(
                (qs.values_list("likes", flat=True))
            ) + sum(qs.values_list("comments", flat=True)) + sum(qs.values_list("shares", flat=True))
            out.append({
                "platform": PLATFORM_DISPLAY[code],
                "Reach": reach,
                "Engagement": eng,
            })
        return Response(out)


# ═════════════════════════════════════════════════════════════════════════════
# OAuth callbacks (platform → us)
# ═════════════════════════════════════════════════════════════════════════════

def _build_auth_url(platform: str, state: str) -> str:
    """Return the platform's authorize URL for the given state, or ''."""
    from urllib.parse import urlencode

    if platform in ("FACEBOOK", "INSTAGRAM"):
        params = {
            "client_id": settings.META_APP_ID,
            "redirect_uri": redirect_uri(platform),
            "state": state,
            "scope": ",".join(getattr(settings, "META_SOCIAL_SCOPES", [])),
            "response_type": "code",
        }
        return f"https://www.facebook.com/v21.0/dialog/oauth?{urlencode(params)}"

    if platform == "TIKTOK":
        params = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "redirect_uri": redirect_uri(platform),
            "state": state,
            "scope": ",".join(getattr(settings, "TIKTOK_SCOPES", [])),
            "response_type": "code",
        }
        return f"https://www.tiktok.com/v2/auth/authorize/?{urlencode(params)}"

    if platform == "YOUTUBE":
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
            "state": state,
            "scope": " ".join(settings.YOUTUBE_SCOPES),
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    if platform == "X":
        # Real X OAuth 1.0a flow needs request-token dance — left as TODO.
        return ""

    return ""


class OAuthCallbackView(APIView):
    """
    GET /api/v1/social/oauth/<platform>/callback/?code=...&state=...

    Exchanges the auth code for tokens, upserts `SocialAccount`, and
    redirects back to the admin UI.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, platform: str):
        code = platform.upper()
        admin_ui = getattr(settings, "SOCIAL_ADMIN_UI_URL", "http://localhost:3000").rstrip("/")
        error_url = f"{admin_ui}/admin/social?error=oauth"

        raw_state = request.query_params.get("state", "")
        auth_code = request.query_params.get("code", "")
        if not auth_code:
            return redirect(error_url)

        try:
            state = parse_state(raw_state)
        except Exception:
            logger.warning("OAuth callback: bad state for %s", code)
            return redirect(error_url)

        if state.get("platform") != code:
            logger.warning("OAuth state/platform mismatch: %s != %s", state.get("platform"), code)
            return redirect(error_url)

        try:
            if code in ("FACEBOOK", "INSTAGRAM"):
                _handle_meta(code, auth_code)
            elif code == "TIKTOK":
                _handle_tiktok(auth_code)
            elif code == "YOUTUBE":
                _handle_youtube(auth_code)
            elif code == "X":
                _handle_x(auth_code)
            else:
                return redirect(error_url)
        except Exception as exc:
            logger.exception("OAuth callback for %s failed: %s", code, exc)
            return redirect(error_url)

        return redirect(f"{admin_ui}/admin/social?connected={code.lower()}")


# ── Platform-specific token exchange ────────────────────────────────────────

def _handle_meta(platform: str, code: str):
    import requests

    token_url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/oauth/access_token"
    resp = requests.get(token_url, params={
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "redirect_uri": redirect_uri(platform),
        "code": code,
    }, timeout=30)
    resp.raise_for_status()
    short_token = resp.json()["access_token"]

    # Exchange for long-lived (~60d) token
    ext = requests.get(token_url, params={
        "grant_type": "fb_exchange_token",
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "fb_exchange_token": short_token,
    }, timeout=30)
    ext.raise_for_status()
    long_token = ext.json()["access_token"]
    expires_in = ext.json().get("expires_in")

    expires_at = None
    if expires_in:
        expires_at = timezone.now() + timedelta(seconds=int(expires_in))

    # Look up the page (for FB) or the IG business account (for IG)
    meta = {}
    handle = ""
    display_name = ""
    platform_user_id = ""

    pages = requests.get(
        f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/me/accounts",
        params={"access_token": long_token},
        timeout=30,
    ).json().get("data", [])
    if pages:
        page = pages[0]
        meta["page_id"] = page["id"]
        handle = page.get("name", "")
        display_name = page.get("name", "")
        platform_user_id = page["id"]
        if platform == "INSTAGRAM":
            ig = requests.get(
                f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{page['id']}",
                params={"fields": "instagram_business_account", "access_token": long_token},
                timeout=30,
            ).json().get("instagram_business_account", {})
            if ig:
                meta["ig_user_id"] = ig["id"]
                platform_user_id = ig["id"]

    upsert_account(
        platform,
        handle=handle,
        display_name=display_name,
        platform_user_id=platform_user_id,
        access_token=long_token,
        expires_at=expires_at,
        metadata=meta,
    )


def _handle_tiktok(code: str):
    import requests

    resp = requests.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        data={
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "client_secret": settings.TIKTOK_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri("TIKTOK"),
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    expires_at = timezone.now() + timedelta(seconds=int(data.get("expires_in", 86400)))

    upsert_account(
        "TIKTOK",
        platform_user_id=data.get("open_id", ""),
        access_token=data.get("access_token", ""),
        refresh_token=data.get("refresh_token", ""),
        expires_at=expires_at,
    )


def _handle_youtube(code: str):
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.YOUTUBE_REDIRECT_URI],
            }
        },
        scopes=settings.YOUTUBE_SCOPES,
        redirect_uri=settings.YOUTUBE_REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials

    from googleapiclient.discovery import build
    yt = build("youtube", "v3", credentials=creds, cache_discovery=False)
    channels = yt.channels().list(part="snippet", mine=True).execute()
    items = channels.get("items") or []
    if not items:
        raise RuntimeError("No YouTube channel associated with this Google account.")

    ch = items[0]
    upsert_account(
        "YOUTUBE",
        handle=ch["snippet"].get("customUrl", ""),
        display_name=ch["snippet"].get("title", ""),
        platform_user_id=ch["id"],
        access_token=creds.token or "",
        refresh_token=creds.refresh_token or "",
        expires_at=creds.expiry,
        metadata={"channel_id": ch["id"]},
    )


def _handle_x(code: str):
    # X OAuth 1.0a callback handling left as a TODO. Wire tweepy or
    # requests-oauthlib once you've registered a callback with X.
    logger.warning("X OAuth callback not implemented; code=%s", code[:8])