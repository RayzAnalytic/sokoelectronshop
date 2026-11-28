
from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from .models import (
    AccountConnectionStatus,
    AccountSyncStatus,
    ActivityKind,
    AlertSeverity,
    ApprovalAction,
    AttributionEventType,
    AttributionStatus,
    CampaignAlertType,
    CampaignStatus,
    CampaignType,
    ContentStatus,
    ContentType,
    ConversationStatus,
    InteractionType,
    MediaKind,
    MediaSource,
    MessageDirection,
    NotificationType,
    PublishStatus,
    SocialAccount,
    SocialAccountShare,
    SocialAccountSyncLog,
    SocialActivityLog,
    SocialAnalyticsConfig,
    SocialAttributionEvent,
    SocialAuditLog,
    SocialCampaign,
    SocialCampaignAlert,
    SocialCampaignContent,
    SocialCampaignProduct,
    SocialContent,
    SocialContentApprovalLog,
    SocialContentCategory,
    SocialContentMedia,
    SocialContentProduct,
    SocialFollowerSnapshot,
    SocialInboxConversation,
    SocialInboxMessage,
    SocialMedia,
    SocialMediaFolder,
    SocialMetaAuthorization,
    SocialNotification,
    SocialOAuthSelection,
    SocialOAuthState,
    SocialPlatform,
    SocialPlatformDailyMetric,
    SocialScheduledPost,
    SocialScheduledPostHistory,
    SyncLogStatus,
)

User = get_user_model()

PLATFORM_ORDER = [
    SocialPlatform.YOUTUBE.value,
    SocialPlatform.FACEBOOK.value,
    SocialPlatform.INSTAGRAM.value,
    SocialPlatform.TIKTOK.value,
]

PLATFORM_UNAVAILABLE_DEFAULTS: dict[str, list[str]] = {
    SocialPlatform.YOUTUBE.value: ["reach", "profile_visits"],
    SocialPlatform.FACEBOOK.value: [],
    SocialPlatform.INSTAGRAM.value: [],
    SocialPlatform.TIKTOK.value: ["impressions"],
}

OAUTH_ENDPOINTS: dict[str, dict[str, str]] = {
    SocialPlatform.YOUTUBE.value: {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scope": "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly",
    },
    SocialPlatform.FACEBOOK.value: {
        "auth_url": "https://www.facebook.com/v20.0/dialog/oauth",
        "token_url": "https://graph.facebook.com/v20.0/oauth/access_token",
        "scope": "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,pages_manage_metadata,pages_read_user_content,read_insights,pages_messaging,business_management",
    },
    SocialPlatform.INSTAGRAM.value: {
        "auth_url": "https://www.facebook.com/v20.0/dialog/oauth",
        "token_url": "https://graph.facebook.com/v20.0/oauth/access_token",
        "scope": "pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_contents,instagram_manage_insights,instagram_manage_messages,instagram_shopping_tag_products",
    },
    SocialPlatform.TIKTOK.value: {
        "auth_url": "https://www.tiktok.com/v2/auth/authorize/",
        "token_url": "https://open.tiktokapis.com/v2/oauth/token/",
        "scope": "user.info.basic,user.info.profile,user.info.stats,video.list,video.upload",
    },
}


META_FACEBOOK_DEFAULT_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_manage_engagement",
    "pages_manage_metadata",
    "pages_read_user_content",
    "read_insights",
    "pages_messaging",
    "business_management",
]

META_INSTAGRAM_DEFAULT_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_contents",
    "instagram_manage_insights",
    "instagram_manage_messages",
    "instagram_shopping_tag_products",
]


def _meta_graph_version() -> str:
    return (getattr(settings, "META_GRAPH_API_VERSION", "") or "v20.0").strip()


def _meta_graph_url(path: str) -> str:
    return f"https://graph.facebook.com/{_meta_graph_version()}/{path.lstrip('/')}"


def _meta_scopes_for_platform(platform: str) -> str:
    configured = [str(x).strip() for x in (getattr(settings, "META_SOCIAL_SCOPES", None) or []) if str(x).strip()]
    if platform == SocialPlatform.FACEBOOK.value:
        allowed = set(META_FACEBOOK_DEFAULT_SCOPES)
        chosen = [x for x in configured if x in allowed] if configured else list(META_FACEBOOK_DEFAULT_SCOPES)
        for req in ("pages_show_list", "pages_read_engagement"):
            if req not in chosen:
                chosen.append(req)
        return ",".join(dict.fromkeys(chosen))
    allowed = set(META_INSTAGRAM_DEFAULT_SCOPES)
    chosen = [x for x in configured if x in allowed] if configured else list(META_INSTAGRAM_DEFAULT_SCOPES)
    for req in ("pages_show_list", "pages_read_engagement", "business_management", "instagram_basic"):
        if req not in chosen:
            chosen.append(req)
    return ",".join(dict.fromkeys(chosen))


class SocialServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_analytics_config() -> SocialAnalyticsConfig:
    cfg = SocialAnalyticsConfig.objects.order_by("id").first()
    if cfg:
        return cfg
    return SocialAnalyticsConfig.objects.create()


def log_audit(
    actor: Any,
    action: str,
    target_type: str = "",
    target_id: str = "",
    details: dict[str, Any] | None = None,
) -> SocialAuditLog:
    return SocialAuditLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id or ""),
        details=details or {},
    )


def record_activity(
    kind: str,
    title: str,
    platform: str = "",
    href: str = "",
    status: str = "",
    occurred_at: datetime | None = None,
) -> SocialActivityLog:
    return SocialActivityLog.objects.create(
        kind=kind,
        title=title[:255],
        platform=platform,
        href=href[:512],
        status=status[:32],
        occurred_at=occurred_at or timezone.now(),
    )


def create_notification(
    notification_type: str,
    title: str,
    message: str = "",
    severity: str = AlertSeverity.INFO.value,
    link: str = "",
    action_label: str = "",
    recipient: Any = None,
) -> SocialNotification:
    return SocialNotification.objects.create(
        notification_type=notification_type,
        severity=severity,
        title=title[:255],
        message=message,
        link=link[:512],
        action_label=action_label[:64],
        recipient=recipient,
    )


def resolve_date_range(
    range_key: str | None = "last_30_days",
    start_str: str | None = None,
    end_str: str | None = None,
) -> tuple[datetime, datetime, datetime, datetime, date, date, date, date]:
    now = timezone.now()
    today = timezone.localdate(now)
    key = (range_key or "last_30_days").strip().lower()

    if key == "today":
        start_d, end_d = today, today
    elif key == "yesterday":
        start_d = end_d = today - timedelta(days=1)
    elif key in ("7d", "last_7_days"):
        end_d = today
        start_d = today - timedelta(days=6)
    elif key in ("30d", "last_30_days"):
        end_d = today
        start_d = today - timedelta(days=29)
    elif key in ("90d", "last_90_days"):
        end_d = today
        start_d = today - timedelta(days=89)
    elif key == "this_month":
        start_d = today.replace(day=1)
        end_d = today
    elif key == "previous_month":
        first_this = today.replace(day=1)
        end_d = first_this - timedelta(days=1)
        start_d = end_d.replace(day=1)
    elif key == "custom":
        parsed_start = parse_date(start_str) if start_str else None
        parsed_end = parse_date(end_str) if end_str else None
        start_d = parsed_start or (today - timedelta(days=29))
        end_d = parsed_end or today
        if end_d < start_d:
            start_d, end_d = end_d, start_d
    else:
        end_d = today
        start_d = today - timedelta(days=29)

    span_days = max(1, (end_d - start_d).days + 1)
    prev_end_d = start_d - timedelta(days=1)
    prev_start_d = prev_end_d - timedelta(days=span_days - 1)

    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(start_d, time.min), tz)
    end_dt = timezone.make_aware(datetime.combine(end_d, time.max), tz)
    prev_start_dt = timezone.make_aware(datetime.combine(prev_start_d, time.min), tz)
    prev_end_dt = timezone.make_aware(datetime.combine(prev_end_d, time.max), tz)

    return start_dt, end_dt, prev_start_dt, prev_end_dt, start_d, end_d, prev_start_d, prev_end_d


def _oauth_credentials(platform: str) -> dict[str, str]:
    oauth_cfg = getattr(settings, "SOCIAL_OAUTH_CONFIG", {}) or {}
    entry = oauth_cfg.get(platform, {}) if isinstance(oauth_cfg, dict) else {}
    if platform == SocialPlatform.YOUTUBE.value:
        client_id = entry.get("client_id") or getattr(settings, "YOUTUBE_CLIENT_ID", "")
        client_secret = entry.get("client_secret") or getattr(settings, "YOUTUBE_CLIENT_SECRET", "")
        redirect_uri = entry.get("redirect_uri") or getattr(settings, "YOUTUBE_REDIRECT_URI", "")
    elif platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value):
        client_id = entry.get("client_id") or getattr(settings, "META_APP_ID", "")
        client_secret = entry.get("client_secret") or getattr(settings, "META_APP_SECRET", "")
        redirect_uri = entry.get("redirect_uri") or getattr(settings, "META_REDIRECT_URI", "")
    else:
        client_id = entry.get("client_id") or getattr(settings, "TIKTOK_CLIENT_KEY", "")
        client_secret = entry.get("client_secret") or getattr(settings, "TIKTOK_CLIENT_SECRET", "")
        redirect_uri = entry.get("redirect_uri") or getattr(settings, "TIKTOK_REDIRECT_URI", "")

    if not client_id or not client_secret:
        raise SocialServiceError(
            f"{platform.capitalize()} OAuth credentials are not configured on the server.",
            status_code=400,
        )
    return {
        "client_id": str(client_id),
        "client_secret": str(client_secret),
        "redirect_uri": str(redirect_uri or ""),
    }


def list_social_accounts() -> list[SocialAccount]:
    return list(
        SocialAccount.objects.prefetch_related("sync_logs", "shares__staff").order_by(
            "platform", "-is_default_publishing", "display_name"
        )
    )


def start_oauth_connect(
    platform: str,
    user: Any,
    redirect_uri: str = "",
    reauthorize_account_id: str | None = None,
) -> str:
    if platform not in OAUTH_ENDPOINTS:
        raise SocialServiceError(f"Unsupported platform: {platform}", status_code=400)

    creds = _oauth_credentials(platform)
    callback_uri = redirect_uri or creds["redirect_uri"]
    if not callback_uri:
        raise SocialServiceError(
            f"OAuth redirect URI is missing for {platform}.",
            status_code=400,
        )

    reauth_acc = None
    if reauthorize_account_id:
        reauth_acc = SocialAccount.objects.filter(pk=reauthorize_account_id).first()
        if not reauth_acc:
            raise SocialServiceError("Account not found.", status_code=404)
        platform = reauth_acc.platform

    state_token = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")

    SocialOAuthState.objects.create(
        state=state_token,
        platform=platform,
        reauthorize_account=reauth_acc,
        initiated_by=user if getattr(user, "is_authenticated", False) else None,
        redirect_uri=callback_uri,
        code_verifier=verifier,
        expires_at=timezone.now() + timedelta(minutes=15),
    )

    ep = OAUTH_ENDPOINTS[platform]
    if platform == SocialPlatform.YOUTUBE.value:
        params = {
            "client_id": creds["client_id"],
            "redirect_uri": callback_uri,
            "response_type": "code",
            "scope": ep["scope"],
            "access_type": "offline",
            "prompt": "consent",
            "state": state_token,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    elif platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value):
        params = {
            "client_id": creds["client_id"],
            "redirect_uri": callback_uri,
            "response_type": "code",
            "scope": _meta_scopes_for_platform(platform),
            "state": state_token,
            "auth_type": "rerequest",
        }
        return f"https://www.facebook.com/{_meta_graph_version()}/dialog/oauth?{urlencode(params)}"
    else:
        params = {
            "client_key": creds["client_id"],
            "redirect_uri": callback_uri,
            "response_type": "code",
            "scope": ep["scope"],
            "state": state_token,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }

    return f"{ep['auth_url']}?{urlencode(params)}"


@transaction.atomic
def complete_oauth_callback(platform: str, code: str, state: str) -> SocialAccount | SocialOAuthSelection:
    oauth_state = (
        SocialOAuthState.objects.select_for_update()
        .filter(state=state, platform=platform)
        .first()
    )
    if not oauth_state:
        raise SocialServiceError("Invalid OAuth state.", status_code=400)
    if oauth_state.expires_at <= timezone.now():
        oauth_state.delete()
        raise SocialServiceError("OAuth session expired. Please try connecting again.", status_code=400)

    creds = _oauth_credentials(platform)
    ep = OAUTH_ENDPOINTS[platform]
    callback_uri = oauth_state.redirect_uri or creds["redirect_uri"]

    try:
        if platform == SocialPlatform.YOUTUBE.value:
            token_res = requests.post(
                ep["token_url"],
                data={
                    "client_id": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "code": code,
                    "code_verifier": oauth_state.code_verifier,
                    "grant_type": "authorization_code",
                    "redirect_uri": callback_uri,
                },
                timeout=20,
            )
        elif platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value):
            token_res = requests.get(
                _meta_graph_url("oauth/access_token"),
                params={
                    "client_id": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "code": code,
                    "redirect_uri": callback_uri,
                },
                timeout=20,
            )
        else:
            token_res = requests.post(
                ep["token_url"],
                data={
                    "client_key": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": callback_uri,
                    "code_verifier": oauth_state.code_verifier,
                },
                timeout=20,
            )
        token_res.raise_for_status()
        token_data = token_res.json()
    except requests.RequestException as exc:
        detail = _extract_meta_error(exc.response) if getattr(exc, "response", None) is not None else str(exc)
        raise SocialServiceError(f"Token exchange failed: {detail}", status_code=502)

    access_token = token_data.get("access_token") or ""
    if not access_token:
        raise SocialServiceError("Platform did not return an access token.", status_code=502)

    refresh_token = token_data.get("refresh_token") or ""
    expires_in = token_data.get("expires_in")
    expires_at = (
        timezone.now() + timedelta(seconds=int(expires_in))
        if isinstance(expires_in, (int, float)) or (isinstance(expires_in, str) and expires_in.isdigit())
        else None
    )

    if platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value):
        meta_auth, candidates, tokens_by_id = _discover_meta_candidates(
            platform, access_token, creds, expires_at, oauth_state.initiated_by
        )
        reauth = oauth_state.reauthorize_account
        if reauth and reauth.platform == platform:
            matched = next((c for c in candidates if c["account_id"] == reauth.account_id), None)
            if not matched:
                raise SocialServiceError(
                    f"The authorized Meta user does not have access to {reauth.display_name or reauth.account_id}.",
                    status_code=400,
                )
            tok = tokens_by_id.get(matched["account_id"], meta_auth.user_access_token)
            prof = _build_meta_profile_from_candidate(platform, matched, meta_auth.scopes or [])
            account = _save_connected_social_account(
                platform,
                prof,
                tok,
                "",
                None,
                oauth_state.initiated_by,
                reauth_account=reauth,
                meta_authorization=meta_auth,
            )
            oauth_state.delete()
            return account

        selection = SocialOAuthSelection.objects.create(
            token=secrets.token_urlsafe(32),
            platform=platform,
            meta_authorization=meta_auth,
            reauthorize_account=reauth,
            initiated_by=oauth_state.initiated_by,
            candidates=candidates,
            encrypted_tokens=json.dumps(tokens_by_id),
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        oauth_state.delete()
        return selection

    profile = _fetch_platform_profile(platform, access_token)
    account = _save_connected_social_account(
        platform,
        profile,
        access_token,
        refresh_token,
        expires_at,
        oauth_state.initiated_by,
        reauth_account=oauth_state.reauthorize_account,
    )
    oauth_state.delete()
    return account


def _save_connected_social_account(
    platform: str,
    profile: dict[str, Any],
    access_token: str,
    refresh_token: str,
    expires_at: Any,
    initiated_by: Any,
    reauth_account: SocialAccount | None = None,
    meta_authorization: SocialMetaAuthorization | None = None,
) -> SocialAccount:
    ext_id = str(profile.get("account_id") or "").strip()
    if not ext_id and not reauth_account:
        raise SocialServiceError(f"Cannot save {platform} account without a valid platform account ID.", status_code=400)
    account = reauth_account
    if not account and ext_id:
        account = SocialAccount.objects.filter(platform=platform, account_id=ext_id).first()
    if not account:
        account = SocialAccount(platform=platform, account_id=ext_id)
    if ext_id:
        SocialAccount.objects.filter(platform=platform, account_id="").exclude(pk=account.pk).delete()

    has_default = SocialAccount.objects.filter(
        platform=platform,
        is_default_publishing=True,
    ).exclude(pk=account.pk).exists()

    account.status = AccountConnectionStatus.CONNECTED
    account.display_name = profile.get("display_name") or account.display_name or platform.capitalize()
    account.username = profile.get("username") or account.username
    account.profile_image_url = profile.get("profile_image_url") or account.profile_image_url
    account.account_type = profile.get("account_type") or account.account_type
    account.followers = profile.get("followers") if profile.get("followers") is not None else account.followers
    account.access_token = access_token
    if refresh_token:
        account.refresh_token = refresh_token
    account.token_expires_at = expires_at
    account.last_auth_check_at = timezone.now()
    now = timezone.now()
    account.connected_at = account.connected_at or now
    account.last_synced_at = account.last_synced_at or now
    account.sync_status = AccountSyncStatus.OK
    account.error = ""
    account.scopes = profile.get("scopes") or account.scopes
    account.missing_scopes = profile.get("missing_scopes") or []
    if profile.get("metadata"):
        existing_meta = account.metadata if isinstance(account.metadata, dict) else {}
        account.metadata = {**existing_meta, **profile["metadata"]}
    account.publishing_formats = profile.get("publishing_formats") or account.publishing_formats
    account.publishing_restrictions = profile.get("publishing_restrictions") or account.publishing_restrictions
    account.supports_dm = profile.get("supports_dm", platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value))
    account.supports_comments = True
    account.supports_mentions = profile.get("supports_mentions", platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value))
    account.supports_reply = True
    account.supports_react = platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value)
    account.supports_hide = platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value, SocialPlatform.YOUTUBE.value)
    account.supports_moderation = platform == SocialPlatform.YOUTUBE.value
    if not has_default:
        account.is_default_publishing = True
    if meta_authorization is not None:
        account.meta_authorization = meta_authorization
    account.enabled_for_distribution = True
    account.save()

    log_audit(
        initiated_by,
        "social_account_connected",
        "SocialAccount",
        str(account.id),
        {"platform": platform, "account_id": account.account_id},
    )
    record_activity(
        ActivityKind.ACCOUNT,
        f"Connected {account.get_platform_display()} ({account.display_name})",
        platform=platform,
        href=f"/social/accounts?account={account.id}",
        status=AccountConnectionStatus.CONNECTED,
    )
    return account


def _extract_meta_error(res: requests.Response) -> str:
    try:
        err = (res.json() or {}).get("error") or {}
        if isinstance(err, dict) and err.get("message"):
            return f"{err.get('message')} (code {err.get('code')})"
    except Exception:
        pass
    return res.text[:300]


def _inspect_meta_permissions(user_token: str) -> tuple[set[str], set[str]]:
    granted: set[str] = set()
    declined: set[str] = set()
    try:
        res = requests.get(_meta_graph_url("me/permissions"), params={"access_token": user_token}, timeout=15)
        if res.ok:
            for row in (res.json() or {}).get("data") or []:
                perm = row.get("permission")
                if not perm:
                    continue
                if row.get("status") == "granted":
                    granted.add(perm)
                elif row.get("status") == "declined":
                    declined.add(perm)
    except requests.RequestException:
        pass
    return granted, declined


def _fetch_all_meta_pages(user_token: str) -> list[dict[str, Any]]:
    url = _meta_graph_url("me/accounts")
    params: dict[str, Any] | None = {
        "fields": (
            "id,name,username,access_token,fan_count,followers_count,tasks,"
            "picture{url},"
            "instagram_business_account{id,name,username,followers_count,profile_picture_url},"
            "connected_instagram_account{id,name,username,followers_count,profile_picture_url}"
        ),
        "limit": 100,
        "access_token": user_token,
    }
    pages: list[dict[str, Any]] = []
    for _ in range(20):
        res = requests.get(url, params=params, timeout=20)
        if not res.ok:
            raise SocialServiceError(f"Meta pages lookup failed: {_extract_meta_error(res)}", status_code=502)
        payload = res.json() or {}
        pages.extend(payload.get("data") or [])
        next_url = (payload.get("paging") or {}).get("next")
        if not next_url:
            break
        url = next_url
        params = None
    return pages


def _discover_meta_candidates(
    platform: str,
    short_user_token: str,
    creds: dict[str, str],
    expires_at: Any,
    initiated_by: Any,
) -> tuple[SocialMetaAuthorization, list[dict[str, Any]], dict[str, str]]:
    user_token = short_user_token
    long_expires = expires_at
    try:
        ll_res = requests.get(
            _meta_graph_url("oauth/access_token"),
            params={
                "grant_type": "fb_exchange_token",
                "client_id": creds["client_id"],
                "client_secret": creds["client_secret"],
                "fb_exchange_token": short_user_token,
            },
            timeout=15,
        )
        if ll_res.ok:
            ll_data = ll_res.json() or {}
            if ll_data.get("access_token"):
                user_token = ll_data["access_token"]
            ll_exp = ll_data.get("expires_in")
            if isinstance(ll_exp, (int, float)) or (isinstance(ll_exp, str) and ll_exp.isdigit()):
                long_expires = timezone.now() + timedelta(seconds=int(ll_exp))
    except requests.RequestException:
        pass

    meta_user_id = ""
    try:
        me_res = requests.get(_meta_graph_url("me"), params={"fields": "id,name", "access_token": user_token}, timeout=15)
        if me_res.ok:
            meta_user_id = str((me_res.json() or {}).get("id") or "")
    except requests.RequestException:
        pass

    granted_scopes, declined_scopes = _inspect_meta_permissions(user_token)
    if platform == SocialPlatform.FACEBOOK.value and "pages_show_list" in declined_scopes:
        raise SocialServiceError(
            "Facebook Page discovery permission (pages_show_list) was declined. Please approve Page access and try again.",
            status_code=400,
        )
    if platform == SocialPlatform.INSTAGRAM.value:
        declined_req = [x for x in ("instagram_basic", "pages_show_list") if x in declined_scopes]
        if declined_req:
            raise SocialServiceError(
                f"Required Instagram permissions were declined ({', '.join(declined_req)}). Please approve them and try again.",
                status_code=400,
            )

    init_user = initiated_by if getattr(initiated_by, "is_authenticated", False) else None
    if meta_user_id:
        meta_auth, _ = SocialMetaAuthorization.objects.update_or_create(
            meta_user_id=meta_user_id,
            initiated_by=init_user,
            defaults={
                "user_access_token": user_token,
                "token_expires_at": long_expires,
                "scopes": sorted(granted_scopes),
            },
        )
    else:
        meta_auth = SocialMetaAuthorization.objects.create(
            meta_user_id="",
            initiated_by=init_user,
            user_access_token=user_token,
            token_expires_at=long_expires,
            scopes=sorted(granted_scopes),
        )

    pages = _fetch_all_meta_pages(user_token)
    candidates: list[dict[str, Any]] = []
    tokens_by_id: dict[str, str] = {}

    if platform == SocialPlatform.FACEBOOK.value:
        for pg in pages:
            pid = str(pg.get("id") or "")
            if not pid:
                continue
            tokens_by_id[pid] = pg.get("access_token") or user_token
            candidates.append(
                {
                    "account_id": pid,
                    "display_name": pg.get("name") or f"Facebook Page {pid}",
                    "username": pg.get("username") or "",
                    "profile_image_url": ((pg.get("picture") or {}).get("data") or {}).get("url", ""),
                    "account_type": "Facebook Page",
                    "followers": pg.get("followers_count") or pg.get("fan_count"),
                    "linked_page_id": pid,
                    "linked_page_name": pg.get("name") or "",
                    "meta_user_id": meta_user_id,
                    "granted_scopes": sorted(granted_scopes),
                }
            )
        if not candidates:
            raise SocialServiceError(
                "No Facebook Pages were returned for this Meta user. Confirm you manage a Facebook Page and selected it in the Meta consent screen.",
                status_code=400,
            )
        return meta_auth, candidates, tokens_by_id

    seen_ig_ids: set[str] = set()
    page_names: list[str] = []
    for pg in pages:
        pid = str(pg.get("id") or "")
        pname = pg.get("name") or pid or "Unnamed Page"
        page_names.append(f"{pname} ({pid})")
        pg_tok = pg.get("access_token") or user_token
        ig = pg.get("instagram_business_account") or pg.get("connected_instagram_account")
        if not ig and pid and pg_tok:
            try:
                pg_res = requests.get(
                    _meta_graph_url(pid),
                    params={
                        "fields": (
                            "instagram_business_account{id,name,username,followers_count,profile_picture_url},"
                            "connected_instagram_account{id,name,username,followers_count,profile_picture_url}"
                        ),
                        "access_token": pg_tok,
                    },
                    timeout=15,
                )
                if pg_res.ok:
                    pg_data = pg_res.json() or {}
                    ig = pg_data.get("instagram_business_account") or pg_data.get("connected_instagram_account")
            except requests.RequestException:
                pass
        if ig and ig.get("id"):
            ig_id = str(ig["id"])
            if ig_id in seen_ig_ids:
                continue
            seen_ig_ids.add(ig_id)
            tokens_by_id[ig_id] = pg_tok
            candidates.append(
                {
                    "account_id": ig_id,
                    "display_name": ig.get("name") or ig.get("username") or f"Instagram {ig_id}",
                    "username": ig.get("username") or "",
                    "profile_image_url": ig.get("profile_picture_url") or "",
                    "account_type": "Business",
                    "followers": ig.get("followers_count"),
                    "linked_page_id": pid,
                    "linked_page_name": pname,
                    "meta_user_id": meta_user_id,
                    "granted_scopes": sorted(granted_scopes),
                }
            )

    if not candidates:
        diag = [f"Pages visible to Meta authorization: {', '.join(page_names) or 'none'}."]
        if "instagram_basic" not in granted_scopes:
            diag.append("Missing granted permission: instagram_basic.")
        if "pages_read_engagement" not in granted_scopes:
            diag.append("Missing granted permission: pages_read_engagement.")
        if "business_management" not in granted_scopes:
            diag.append("Missing granted permission: business_management.")
        diag.append(
            "Ensure the Instagram account is Business or Creator (not Personal), linked to that Facebook Page in Page Settings -> Linked Accounts, and selected in Meta's consent screen."
        )
        raise SocialServiceError(
            "No Instagram Business or Creator account linked to this Meta authorization. " + " ".join(diag),
            status_code=400,
        )
    return meta_auth, candidates, tokens_by_id


def _build_meta_profile_from_candidate(platform: str, cand: dict[str, Any], granted_scopes: list[str]) -> dict[str, Any]:
    if platform == SocialPlatform.FACEBOOK.value:
        scope_defs = [
            ("pages_show_list", "List managed Pages"),
            ("pages_read_engagement", "Read Page engagement"),
            ("pages_manage_posts", "Publish to Page"),
            ("pages_manage_engagement", "Manage Page comments"),
            ("pages_manage_metadata", "Manage Page metadata"),
            ("pages_read_user_content", "Read user content"),
            ("read_insights", "Read Page insights"),
        ]
        if "pages_messaging" in granted_scopes or "pages_messaging" in (getattr(settings, "META_SOCIAL_SCOPES", None) or []):
            scope_defs.append(("pages_messaging", "Manage Page messages"))
        return {
            "account_id": cand["account_id"],
            "display_name": cand["display_name"],
            "username": cand.get("username", ""),
            "profile_image_url": cand.get("profile_image_url", ""),
            "account_type": "Facebook Page",
            "followers": cand.get("followers"),
            "metadata": {"meta_user_id": cand.get("meta_user_id", ""), "page_id": cand["account_id"]},
            "publishing_formats": ["image", "video", "text", "reel"],
            "supports_dm": True,
            "supports_mentions": True,
            "scopes": [
                {"key": k, "label": lbl, "granted": (not granted_scopes) or (k in granted_scopes)}
                for k, lbl in scope_defs
            ],
        }
    scope_defs = [
        ("instagram_basic", "Read profile & media"),
        ("instagram_content_publish", "Publish content"),
        ("instagram_manage_comments", "Manage comments"),
        ("instagram_manage_messages", "Manage direct messages"),
        ("instagram_manage_insights", "Read Instagram insights"),
    ]
    return {
        "account_id": cand["account_id"],
        "display_name": cand["display_name"],
        "username": cand.get("username", ""),
        "profile_image_url": cand.get("profile_image_url", ""),
        "account_type": cand.get("account_type") or "Business",
        "followers": cand.get("followers"),
        "metadata": {
            "meta_user_id": cand.get("meta_user_id", ""),
            "page_id": cand.get("linked_page_id", ""),
            "linked_page_name": cand.get("linked_page_name", ""),
        },
        "publishing_formats": ["image", "video", "reel", "story"],
        "supports_dm": True,
        "supports_mentions": True,
        "scopes": [
            {"key": k, "label": lbl, "granted": (not granted_scopes) or (k in granted_scopes)}
            for k, lbl in scope_defs
        ],
    }


def _fetch_meta_account_profile(account: SocialAccount) -> dict[str, Any]:
    if not account.account_id:
        raise SocialServiceError(f"Missing {account.platform} account_id for sync.", status_code=400)
    if account.platform == SocialPlatform.FACEBOOK.value:
        res = requests.get(
            _meta_graph_url(account.account_id),
            params={
                "fields": "id,name,username,fan_count,followers_count,picture{url}",
                "access_token": account.access_token,
            },
            timeout=20,
        )
        if not res.ok:
            raise SocialServiceError(f"Facebook sync failed: {_extract_meta_error(res)}", status_code=502)
        pg = res.json() or {}
        return {
            "display_name": pg.get("name", ""),
            "username": pg.get("username", ""),
            "profile_image_url": ((pg.get("picture") or {}).get("data") or {}).get("url", ""),
            "followers": pg.get("followers_count") or pg.get("fan_count"),
        }
    res = requests.get(
        _meta_graph_url(account.account_id),
        params={
            "fields": "id,name,username,followers_count,profile_picture_url",
            "access_token": account.access_token,
        },
        timeout=20,
    )
    if not res.ok:
        raise SocialServiceError(f"Instagram sync failed: {_extract_meta_error(res)}", status_code=502)
    ig = res.json() or {}
    return {
        "display_name": ig.get("name") or ig.get("username") or "",
        "username": ig.get("username", ""),
        "profile_image_url": ig.get("profile_picture_url", ""),
        "followers": ig.get("followers_count"),
    }


def get_oauth_selection(token: str, user: Any) -> SocialOAuthSelection:
    sel = SocialOAuthSelection.objects.select_related("meta_authorization").filter(token=token).first()
    if not sel:
        raise SocialServiceError("OAuth selection session not found.", status_code=404)
    if sel.expires_at <= timezone.now():
        sel.delete()
        raise SocialServiceError("OAuth selection session expired. Please reconnect.", status_code=400)
    if sel.initiated_by_id and getattr(user, "id", None) != sel.initiated_by_id:
        raise SocialServiceError("This authorization session belongs to another user.", status_code=403)
    return sel


@transaction.atomic
def confirm_oauth_selection(token: str, account_id: str, user: Any) -> SocialAccount:
    sel = (
        SocialOAuthSelection.objects.select_for_update()
        .filter(token=token)
        .first()
    )
    if not sel:
        raise SocialServiceError("OAuth selection session not found.", status_code=404)
    if sel.expires_at <= timezone.now():
        sel.delete()
        raise SocialServiceError("OAuth selection session expired. Please reconnect.", status_code=400)
    if sel.initiated_by_id and getattr(user, "id", None) != sel.initiated_by_id:
        raise SocialServiceError("This authorization session belongs to another user.", status_code=403)

    matched = next((c for c in (sel.candidates or []) if str(c.get("account_id")) == str(account_id)), None)
    if not matched:
        raise SocialServiceError("Selected account was not part of this Meta authorization.", status_code=400)

    tokens_by_id = json.loads(sel.encrypted_tokens or "{}")
    tok = tokens_by_id.get(str(account_id)) or (sel.meta_authorization.user_access_token if sel.meta_authorization else "")
    if not tok:
        raise SocialServiceError("Access token missing for selected account.", status_code=400)

    granted = (sel.meta_authorization.scopes if sel.meta_authorization else None) or matched.get("granted_scopes") or []
    prof = _build_meta_profile_from_candidate(sel.platform, matched, granted)
    account = _save_connected_social_account(
        sel.platform,
        prof,
        tok,
        "",
        None,
        user,
        reauth_account=sel.reauthorize_account,
        meta_authorization=sel.meta_authorization,
    )
    sel.delete()
    return account


def _fetch_platform_profile(platform: str, access_token: str) -> dict[str, Any]:
    if platform == SocialPlatform.YOUTUBE.value:
        try:
            res = requests.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet,statistics", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=20,
            )
            res.raise_for_status()
        except requests.RequestException as exc:
            detail = exc.response.text[:300] if getattr(exc, "response", None) is not None else str(exc)
            raise SocialServiceError(f"YouTube profile lookup failed: {detail}", status_code=502)
        items = res.json().get("items") or []
        if not items:
            return {"account_type": "channel", "publishing_formats": ["video", "short"]}
        ch = items[0]
        snippet = ch.get("snippet") or {}
        stats = ch.get("statistics") or {}
        thumbs = snippet.get("thumbnails") or {}
        thumb = (thumbs.get("high") or thumbs.get("default") or {}).get("url", "")
        sub_count = stats.get("subscriberCount")
        return {
            "account_id": ch.get("id", ""),
            "display_name": snippet.get("title", ""),
            "username": snippet.get("customUrl", "").lstrip("@"),
            "profile_image_url": thumb,
            "account_type": "Channel",
            "followers": int(sub_count) if sub_count is not None else None,
            "publishing_formats": ["video", "short"],
            "scopes": [
                {"key": "youtube.readonly", "label": "Read channel & analytics", "granted": True},
                {"key": "youtube.upload", "label": "Upload videos", "granted": True},
            ],
        }

    if platform == SocialPlatform.FACEBOOK.value:
        res = requests.get(
            "https://graph.facebook.com/v20.0/me/accounts",
            params={"fields": "id,name,username,fan_count,followers_count,picture{url}", "access_token": access_token},
            timeout=20,
        )
        res.raise_for_status()
        pages = res.json().get("data") or []
        if not pages:
            return {"account_type": "Page", "publishing_formats": ["image", "video", "text", "reel"]}
        pg = pages[0]
        return {
            "account_id": pg.get("id", ""),
            "display_name": pg.get("name", ""),
            "username": pg.get("username", ""),
            "profile_image_url": ((pg.get("picture") or {}).get("data") or {}).get("url", ""),
            "account_type": "Facebook Page",
            "followers": pg.get("followers_count") or pg.get("fan_count"),
            "publishing_formats": ["image", "video", "text", "reel"],
            "supports_dm": True,
            "supports_mentions": True,
            "scopes": [
                {"key": "pages_manage_posts", "label": "Publish to Page", "granted": True},
                {"key": "pages_read_engagement", "label": "Read Page engagement", "granted": True},
                {"key": "pages_messaging", "label": "Manage Page messages", "granted": True},
            ],
        }

    if platform == SocialPlatform.INSTAGRAM.value:
        res = requests.get(
            "https://graph.facebook.com/v20.0/me/accounts",
            params={"fields": "instagram_business_account{id,name,username,followers_count,profile_picture_url}", "access_token": access_token},
            timeout=20,
        )
        res.raise_for_status()
        for pg in res.json().get("data") or []:
            ig = pg.get("instagram_business_account")
            if ig:
                return {
                    "account_id": ig.get("id", ""),
                    "display_name": ig.get("name") or ig.get("username") or "",
                    "username": ig.get("username", ""),
                    "profile_image_url": ig.get("profile_picture_url", ""),
                    "account_type": "Business",
                    "followers": ig.get("followers_count"),
                    "publishing_formats": ["image", "video", "reel", "story"],
                    "supports_dm": True,
                    "supports_mentions": True,
                    "scopes": [
                        {"key": "instagram_basic", "label": "Read profile & media", "granted": True},
                        {"key": "instagram_content_publish", "label": "Publish content", "granted": True},
                        {"key": "instagram_manage_comments", "label": "Manage comments", "granted": True},
                    ],
                }
        raise SocialServiceError(
            "No Instagram Business or Creator account linked to this Meta authorization.",
            status_code=400,
        )

    res = requests.get(
        "https://open.tiktokapis.com/v2/user/info/",
        params={"fields": "open_id,display_name,username,avatar_url,follower_count"},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    res.raise_for_status()
    user_info = (res.json().get("data") or {}).get("user") or {}
    return {
        "account_id": user_info.get("open_id", ""),
        "display_name": user_info.get("display_name", ""),
        "username": user_info.get("username", ""),
        "profile_image_url": user_info.get("avatar_url", ""),
        "account_type": "Business",
        "followers": user_info.get("follower_count"),
        "publishing_formats": ["video"],
        "supports_dm": False,
        "supports_mentions": False,
        "scopes": [
            {"key": "user.info.basic", "label": "Read profile", "granted": True},
            {"key": "video.publish", "label": "Publish videos", "granted": True},
        ],
    }


def _refresh_account_token(account: SocialAccount) -> None:
    if account.platform in (SocialPlatform.YOUTUBE.value, SocialPlatform.TIKTOK.value) and not account.refresh_token:
        account.status = AccountConnectionStatus.AUTHORIZATION_EXPIRED
        account.error = "Authorization expired. Please reauthorize this account."
        account.save(update_fields=["status", "error", "updated_at"])
        raise SocialServiceError(account.error, status_code=401)
    if account.platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value) and not (
        account.access_token or (account.meta_authorization and account.meta_authorization.user_access_token)
    ):
        account.status = AccountConnectionStatus.AUTHORIZATION_EXPIRED
        account.error = "Authorization expired. Please reauthorize this account."
        account.save(update_fields=["status", "error", "updated_at"])
        raise SocialServiceError(account.error, status_code=401)

    creds = _oauth_credentials(account.platform)
    ep = OAUTH_ENDPOINTS[account.platform]
    try:
        if account.platform == SocialPlatform.YOUTUBE.value:
            res = requests.post(
                ep["token_url"],
                data={
                    "client_id": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "refresh_token": account.refresh_token,
                    "grant_type": "refresh_token",
                },
                timeout=20,
            )
        elif account.platform == SocialPlatform.TIKTOK.value:
            res = requests.post(
                ep["token_url"],
                data={
                    "client_key": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "refresh_token": account.refresh_token,
                    "grant_type": "refresh_token",
                },
                timeout=20,
            )
        else:
            res = requests.get(
                _meta_graph_url("oauth/access_token"),
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": creds["client_id"],
                    "client_secret": creds["client_secret"],
                    "fb_exchange_token": (account.meta_authorization.user_access_token if account.meta_authorization and account.meta_authorization.user_access_token else account.access_token),
                },
                timeout=20,
            )
        res.raise_for_status()
        data = res.json()
    except requests.RequestException as exc:
        account.status = AccountConnectionStatus.AUTHORIZATION_EXPIRED
        account.error = f"Token refresh failed: {exc}"
        account.save(update_fields=["status", "error", "updated_at"])
        raise SocialServiceError(account.error, status_code=401)

    account.access_token = data.get("access_token") or account.access_token
    if data.get("refresh_token"):
        account.refresh_token = data["refresh_token"]
    expires_in = data.get("expires_in")
    if expires_in:
        account.token_expires_at = timezone.now() + timedelta(seconds=int(expires_in))
    account.last_auth_check_at = timezone.now()
    account.status = AccountConnectionStatus.CONNECTED
    account.error = ""
    account.save(
        update_fields=[
            "access_token",
            "refresh_token",
            "token_expires_at",
            "last_auth_check_at",
            "status",
            "error",
            "updated_at",
        ]
    )


def sync_social_account(account_id: str, actor: Any = None) -> SocialAccount:
    account = SocialAccount.objects.filter(pk=account_id).first()
    if not account:
        raise SocialServiceError("Account not found.", status_code=404)
    if account.status in (AccountConnectionStatus.NOT_CONNECTED, AccountConnectionStatus.CONNECTING):
        raise SocialServiceError("Account is not connected.", status_code=400)

    if account.is_token_expired:
        _refresh_account_token(account)

    now = timezone.now()
    today = timezone.localdate(now)

    try:
        if account.platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value):
            profile = _fetch_meta_account_profile(account)
        else:
            profile = _fetch_platform_profile(account.platform, account.access_token)
        if profile.get("display_name"):
            account.display_name = profile["display_name"]
        if profile.get("username"):
            account.username = profile["username"]
        if profile.get("profile_image_url"):
            account.profile_image_url = profile["profile_image_url"]
        prev_followers = account.followers
        new_followers = profile.get("followers")
        if new_followers is not None:
            account.followers = new_followers

        missing = list(PLATFORM_UNAVAILABLE_DEFAULTS.get(account.platform, []))
        account.missing_metrics = missing
        account.sync_status = AccountSyncStatus.OK
        account.status = AccountConnectionStatus.CONNECTED
        account.last_synced_at = now
        account.next_sync_at = now + timedelta(hours=1)
        account.coverage_start = account.coverage_start or today
        account.coverage_end = today
        account.error = ""
        account.save()

        if account.followers is not None:
            SocialFollowerSnapshot.objects.update_or_create(
                account=account,
                date=today,
                defaults={"platform": account.platform, "followers": account.followers},
            )
            growth = (account.followers - prev_followers) if prev_followers is not None else 0
            SocialPlatformDailyMetric.objects.update_or_create(
                account=account,
                date=today,
                defaults={
                    "platform": account.platform,
                    "followers": account.followers,
                    "follower_growth": growth,
                    "unavailable_metrics": missing,
                },
            )

        SocialAccountSyncLog.objects.create(
            account=account,
            status=SyncLogStatus.SUCCESS,
            message="Account synced.",
            missing_metrics=missing,
            coverage_start=account.coverage_start,
            coverage_end=account.coverage_end,
        )
        log_audit(actor, "social_account_synced", "SocialAccount", str(account.id))
    except Exception as exc:
        msg = str(exc)
        account.sync_status = AccountSyncStatus.FAILED
        account.status = AccountConnectionStatus.SYNC_FAILED
        account.last_failed_sync_at = now
        account.error = msg
        account.save(update_fields=["sync_status", "status", "last_failed_sync_at", "error", "updated_at"])
        SocialAccountSyncLog.objects.create(
            account=account,
            status=SyncLogStatus.FAILURE,
            message=msg,
        )
        create_notification(
            NotificationType.TOKEN_EXPIRED if "401" in msg else NotificationType.POST_FAILED,
            f"Sync failed for {account.display_name or account.platform}",
            message=msg,
            severity=AlertSeverity.ERROR,
            link=f"/social/accounts?account={account.id}",
            action_label="Check account",
        )
        raise SocialServiceError(f"Sync failed: {msg}", status_code=502)

    return account


@transaction.atomic
def disconnect_social_account(account_id: str, actor: Any = None) -> SocialAccount:
    account = SocialAccount.objects.filter(pk=account_id).first()
    if not account:
        raise SocialServiceError("Account not found.", status_code=404)

    account.access_token = ""
    account.refresh_token = ""
    account.token_expires_at = None
    account.status = AccountConnectionStatus.NOT_CONNECTED
    account.is_default_publishing = False
    account.meta_authorization = None
    account.enabled_for_distribution = False
    account.error = ""
    account.save()

    log_audit(actor, "social_account_disconnected", "SocialAccount", str(account.id))
    record_activity(
        ActivityKind.ACCOUNT,
        f"Disconnected {account.get_platform_display()} ({account.display_name or account.username})",
        platform=account.platform,
        href="/social/accounts",
        status=AccountConnectionStatus.NOT_CONNECTED,
    )
    return account


@transaction.atomic
def update_social_account(account_id: str, data: dict[str, Any], actor: Any = None) -> SocialAccount:
    account = SocialAccount.objects.select_for_update().filter(pk=account_id).first()
    if not account:
        raise SocialServiceError("Account not found.", status_code=404)

    if "label" in data:
        account.label = data["label"] or ""
    if "enabled_for_distribution" in data:
        account.enabled_for_distribution = bool(data["enabled_for_distribution"])
    if data.get("is_default_publishing") is True:
        SocialAccount.objects.filter(platform=account.platform).exclude(pk=account.pk).update(
            is_default_publishing=False
        )
        account.is_default_publishing = True
    elif "is_default_publishing" in data:
        account.is_default_publishing = bool(data["is_default_publishing"])

    account.save()
    log_audit(actor, "social_account_updated", "SocialAccount", str(account.id), data)
    return account


@transaction.atomic
def update_account_share(
    account_id: str,
    staff_id: str,
    permissions: list[str],
    actor: Any = None,
) -> SocialAccountShare:
    account = SocialAccount.objects.filter(pk=account_id).first()
    if not account:
        raise SocialServiceError("Account not found.", status_code=404)
    staff = User.objects.filter(pk=staff_id).first()
    if not staff:
        raise SocialServiceError("Staff member not found.", status_code=404)
    share, _ = SocialAccountShare.objects.update_or_create(
        account=account,
        staff=staff,
        defaults={"permissions": permissions},
    )
    log_audit(actor, "social_account_share_updated", "SocialAccount", str(account.id), {"staff_id": staff_id})
    return share


def list_content(filters: dict[str, Any]) -> list[SocialContent]:
    qs = SocialContent.objects.select_related("category", "campaign", "owner", "reviewer").prefetch_related(
        "content_media_links__media",
        "linked_products",
        "approval_history__actor",
    )
    q = (filters.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(title__icontains=q)
            | Q(caption__icontains=q)
            | Q(description__icontains=q)
            | Q(owner__email__icontains=q)
            | Q(owner__first_name__icontains=q)
            | Q(owner__last_name__icontains=q)
        )
    platform = filters.get("platform")
    if platform and platform != "all":
        qs = qs.filter(platforms__contains=[platform])
    content_type = filters.get("content_type")
    if content_type and content_type != "all":
        qs = qs.filter(content_type=content_type)
    status = filters.get("status")
    if status and status != "all":
        qs = qs.filter(status=status)
    campaign_id = filters.get("campaign_id")
    if campaign_id and campaign_id != "all":
        qs = qs.filter(campaign_id=campaign_id)
    owner_id = filters.get("owner_id")
    if owner_id and owner_id != "all":
        qs = qs.filter(owner_id=owner_id)
    return list(qs.order_by("-updated_at"))


def get_content_detail(content_id: str) -> SocialContent:
    obj = (
        SocialContent.objects.select_related("category", "campaign", "owner", "reviewer")
        .prefetch_related("content_media_links__media", "linked_products", "approval_history__actor")
        .filter(pk=content_id)
        .first()
    )
    if not obj:
        raise SocialServiceError("Content draft not found.", status_code=404)
    return obj


@transaction.atomic
def save_content(data: dict[str, Any], user: Any = None) -> SocialContent:
    content_id = data.get("id")
    if content_id:
        obj = SocialContent.objects.select_for_update().filter(pk=content_id).first()
        if not obj:
            raise SocialServiceError("Content draft not found.", status_code=404)
    else:
        obj = SocialContent(
            owner=user if getattr(user, "is_authenticated", False) else None,
            status=ContentStatus.DRAFT,
        )

    obj.title = data.get("title") or obj.title
    if "caption" in data:
        obj.caption = data["caption"] or ""
    if "description" in data:
        obj.description = data["description"] or ""
    if "internal_notes" in data:
        obj.internal_notes = data["internal_notes"] or ""
    if "content_type" in data:
        obj.content_type = data["content_type"]

    if "category" in data:
        cat_id = data["category"]
        obj.category = SocialContentCategory.objects.filter(pk=cat_id).first() if cat_id else None
    if "campaign_id" in data:
        camp_id = data["campaign_id"]
        obj.campaign = SocialCampaign.objects.filter(pk=camp_id).first() if camp_id else None
    if "owner_id" in data and data["owner_id"]:
        obj.owner = User.objects.filter(pk=data["owner_id"]).first() or obj.owner

    if "platforms" in data:
        obj.platforms = data["platforms"]
    if "platform_configs" in data:
        obj.platform_configs = data["platform_configs"]

    obj.save()

    if "media" in data:
        SocialContentMedia.objects.filter(content=obj).delete()
        for idx, m in enumerate(data["media"] or []):
            mid = m.get("id")
            if not mid:
                continue
            asset = SocialMedia.objects.filter(pk=mid).first()
            if asset:
                SocialContentMedia.objects.create(content=obj, media=asset, sort_order=idx)

    if "products" in data:
        SocialContentProduct.objects.filter(content=obj).delete()
        seen_pids = set()
        for idx, p in enumerate(data["products"] or []):
            pid = str(p.get("id") or "")
            if pid and pid not in seen_pids:
                seen_pids.add(pid)
                SocialContentProduct.objects.create(content=obj, product_id=pid, sort_order=idx)

    if obj.campaign_id:
        SocialCampaignContent.objects.get_or_create(campaign=obj.campaign, content=obj)

    log_audit(user, "social_content_saved", "SocialContent", str(obj.id))
    return get_content_detail(str(obj.id))


@transaction.atomic
def delete_content(content_id: str, user: Any = None) -> None:
    obj = SocialContent.objects.filter(pk=content_id).first()
    if not obj:
        raise SocialServiceError("Content draft not found.", status_code=404)
    obj.delete()
    log_audit(user, "social_content_deleted", "SocialContent", str(content_id))


@transaction.atomic
def duplicate_content(content_id: str, user: Any = None) -> SocialContent:
    src = get_content_detail(content_id)
    copy_title = f"{src.title} (Copy)" if src.title else "Untitled (Copy)"
    dup = SocialContent.objects.create(
        title=copy_title[:255],
        caption=src.caption,
        description=src.description,
        internal_notes=src.internal_notes,
        content_type=src.content_type,
        category=src.category,
        campaign=src.campaign,
        owner=user if getattr(user, "is_authenticated", False) else src.owner,
        platforms=list(src.platforms or []),
        platform_configs=dict(src.platform_configs or {}),
        status=ContentStatus.DRAFT,
    )
    for link in src.content_media_links.all():
        SocialContentMedia.objects.create(content=dup, media=link.media, sort_order=link.sort_order)
    for prod in src.linked_products.all():
        SocialContentProduct.objects.create(content=dup, product_id=prod.product_id, sort_order=prod.sort_order)
    log_audit(user, "social_content_duplicated", "SocialContent", str(dup.id), {"source_id": str(src.id)})
    return get_content_detail(str(dup.id))


@transaction.atomic
def submit_content_for_approval(content_id: str, user: Any = None) -> SocialContent:
    obj = SocialContent.objects.select_for_update().filter(pk=content_id).first()
    if not obj:
        raise SocialServiceError("Content draft not found.", status_code=404)
    if obj.status not in (ContentStatus.DRAFT, ContentStatus.CHANGES_REQUESTED):
        raise SocialServiceError("Only drafts or items with requested changes can be submitted.", status_code=400)
    obj.status = ContentStatus.IN_REVIEW
    obj.save(update_fields=["status", "updated_at"])
    SocialContentApprovalLog.objects.create(
        content=obj,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=ApprovalAction.SUBMITTED,
    )
    create_notification(
        NotificationType.APPROVAL_NEEDED,
        f"Approval requested: {obj.title or 'Untitled'}",
        link=f"/social/content-studio?id={obj.id}",
        action_label="Review",
    )
    return get_content_detail(str(obj.id))


@transaction.atomic
def approve_content(content_id: str, user: Any = None) -> SocialContent:
    obj = SocialContent.objects.select_for_update().filter(pk=content_id).first()
    if not obj:
        raise SocialServiceError("Content draft not found.", status_code=404)
    if obj.status != ContentStatus.IN_REVIEW:
        raise SocialServiceError("Content must be in review to approve.", status_code=400)
    obj.status = ContentStatus.APPROVED
    obj.reviewer = user if getattr(user, "is_authenticated", False) else None
    obj.rejection_reason = ""
    obj.save(update_fields=["status", "reviewer", "rejection_reason", "updated_at"])
    SocialContentApprovalLog.objects.create(
        content=obj,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=ApprovalAction.APPROVED,
    )
    create_notification(
        NotificationType.APPROVAL_GIVEN,
        f"Content approved: {obj.title or 'Untitled'}",
        link=f"/social/content-studio?id={obj.id}",
        recipient=obj.owner,
    )
    return get_content_detail(str(obj.id))


@transaction.atomic
def reject_content(content_id: str, reason: str, user: Any = None) -> SocialContent:
    obj = SocialContent.objects.select_for_update().filter(pk=content_id).first()
    if not obj:
        raise SocialServiceError("Content draft not found.", status_code=404)
    if obj.status != ContentStatus.IN_REVIEW:
        raise SocialServiceError("Content must be in review to reject.", status_code=400)
    obj.status = ContentStatus.REJECTED
    obj.reviewer = user if getattr(user, "is_authenticated", False) else None
    obj.rejection_reason = reason
    obj.save(update_fields=["status", "reviewer", "rejection_reason", "updated_at"])
    SocialContentApprovalLog.objects.create(
        content=obj,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=ApprovalAction.REJECTED,
        reason=reason,
    )
    return get_content_detail(str(obj.id))


@transaction.atomic
def request_content_changes(content_id: str, reason: str, user: Any = None) -> SocialContent:
    obj = SocialContent.objects.select_for_update().filter(pk=content_id).first()
    if not obj:
        raise SocialServiceError("Content draft not found.", status_code=404)
    if obj.status != ContentStatus.IN_REVIEW:
        raise SocialServiceError("Content must be in review to request changes.", status_code=400)
    obj.status = ContentStatus.CHANGES_REQUESTED
    obj.reviewer = user if getattr(user, "is_authenticated", False) else None
    obj.rejection_reason = reason
    obj.save(update_fields=["status", "reviewer", "rejection_reason", "updated_at"])
    SocialContentApprovalLog.objects.create(
        content=obj,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=ApprovalAction.CHANGES_REQUESTED,
        reason=reason,
    )
    return get_content_detail(str(obj.id))


def _default_account_for_platform(platform: str) -> SocialAccount | None:
    acc = SocialAccount.objects.filter(
        platform=platform,
        status=AccountConnectionStatus.CONNECTED,
        enabled_for_distribution=True,
        is_default_publishing=True,
    ).first()
    if acc:
        return acc
    return SocialAccount.objects.filter(
        platform=platform,
        status=AccountConnectionStatus.CONNECTED,
        enabled_for_distribution=True,
    ).first()


def _content_thumbnail(content: SocialContent) -> str:
    link = content.content_media_links.select_related("media").order_by("sort_order", "id").first()
    if not link:
        return ""
    if link.media.thumbnail_url:
        return link.media.thumbnail_url
    if link.media.url:
        return link.media.url
    if link.media.thumbnail:
        return link.media.thumbnail.url
    if link.media.file:
        return link.media.file.url
    return ""


@transaction.atomic
def schedule_content_from_studio(content_id: str, scheduled_at: datetime, user: Any = None) -> SocialContent:
    obj = get_content_detail(content_id)
    if obj.status not in (ContentStatus.APPROVED, ContentStatus.READY_TO_SCHEDULE):
        raise SocialServiceError("Content must be approved before scheduling.", status_code=400)
    if not obj.platforms:
        raise SocialServiceError("Select at least one platform before scheduling.", status_code=400)
    if scheduled_at <= timezone.now():
        raise SocialServiceError("Scheduled time must be in the future.", status_code=400)

    cfg = get_analytics_config()
    thumb = _content_thumbnail(obj)
    for platform in obj.platforms:
        acc = _default_account_for_platform(platform)
        if not acc:
            raise SocialServiceError(
                f"No connected publishing account found for {platform}.",
                status_code=400,
            )
        sp = SocialScheduledPost.objects.create(
            content=obj,
            content_title=obj.title or "Untitled",
            thumbnail_url=thumb,
            caption=obj.caption,
            content_type=obj.content_type,
            platform=platform,
            account=acc,
            campaign=obj.campaign,
            owner=obj.owner or (user if getattr(user, "is_authenticated", False) else None),
            approver=obj.reviewer,
            scheduled_at=scheduled_at,
            timezone=cfg.default_timezone,
            status=PublishStatus.SCHEDULED,
        )
        SocialScheduledPostHistory.objects.create(
            scheduled_post=sp,
            status=PublishStatus.SCHEDULED,
            actor=user if getattr(user, "is_authenticated", False) else None,
            message="Scheduled from Content Studio.",
        )

    obj.status = ContentStatus.SCHEDULED
    obj.save(update_fields=["status", "updated_at"])
    SocialContentApprovalLog.objects.create(
        content=obj,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=ApprovalAction.SCHEDULED,
    )
    record_activity(
        ActivityKind.SCHEDULED,
        f"Scheduled {obj.title or 'Untitled'} across {len(obj.platforms)} platform(s)",
        platform=obj.platforms[0] if len(obj.platforms) == 1 else "",
        href="/social/publishing-calendar",
        status=PublishStatus.SCHEDULED,
    )
    return get_content_detail(str(obj.id))


@transaction.atomic
def publish_content_now_from_studio(content_id: str, user: Any = None) -> SocialContent:
    obj = get_content_detail(content_id)
    if obj.status not in (ContentStatus.APPROVED, ContentStatus.READY_TO_SCHEDULE):
        raise SocialServiceError("Content must be approved before publishing.", status_code=400)
    if not obj.platforms:
        raise SocialServiceError("Select at least one platform before publishing.", status_code=400)

    cfg = get_analytics_config()
    thumb = _content_thumbnail(obj)
    now = timezone.now()
    created_posts: list[SocialScheduledPost] = []
    for platform in obj.platforms:
        acc = _default_account_for_platform(platform)
        if not acc:
            raise SocialServiceError(
                f"No connected publishing account found for {platform}.",
                status_code=400,
            )
        sp = SocialScheduledPost.objects.create(
            content=obj,
            content_title=obj.title or "Untitled",
            thumbnail_url=thumb,
            caption=obj.caption,
            content_type=obj.content_type,
            platform=platform,
            account=acc,
            campaign=obj.campaign,
            owner=obj.owner or (user if getattr(user, "is_authenticated", False) else None),
            approver=obj.reviewer,
            scheduled_at=now,
            timezone=cfg.default_timezone,
            status=PublishStatus.QUEUED,
        )
        created_posts.append(sp)

    all_ok = True
    for sp in created_posts:
        result = publish_scheduled_post_now(str(sp.id), user=user)
        if result.status != PublishStatus.PUBLISHED:
            all_ok = False

    obj.status = ContentStatus.PUBLISHED if all_ok else ContentStatus.FAILED
    obj.save(update_fields=["status", "updated_at"])
    if all_ok:
        SocialContentApprovalLog.objects.create(
            content=obj,
            actor=user if getattr(user, "is_authenticated", False) else None,
            action=ApprovalAction.PUBLISHED,
        )
    return get_content_detail(str(obj.id))


def list_media_library(q: str = "", kind: str = "", folder_id: str | None = None) -> list[SocialMedia]:
    qs = SocialMedia.objects.all()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(tags__icontains=q))
    if kind in (MediaKind.IMAGE.value, MediaKind.VIDEO.value):
        qs = qs.filter(kind=kind)
    if folder_id:
        qs = qs.filter(folder_id=folder_id)
    return list(qs.order_by("-created_at"))


def upload_media_asset(file: Any, folder_id: str | None = None, tags: list[str] | None = None) -> SocialMedia:
    ctype = (getattr(file, "content_type", "") or "").lower()
    kind = MediaKind.VIDEO if ctype.startswith("video/") else MediaKind.IMAGE
    folder = SocialMediaFolder.objects.filter(pk=folder_id).first() if folder_id else None
    return SocialMedia.objects.create(
        folder=folder,
        kind=kind,
        file=file,
        name=getattr(file, "name", "")[:255],
        mime_type=ctype[:128],
        size_bytes=getattr(file, "size", None),
        tags=tags or [],
        source=MediaSource.UPLOAD,
    )


def suggest_content_copy(field: str, context: str, platform: str | None = None) -> list[str]:
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        raise SocialServiceError("AI suggestion service is not configured.", status_code=503)

    prompt = (
        f"Provide 3 concise {field} suggestions for a {platform or 'social media'} post. "
        f"Context: {context or 'ecommerce store promotion'}. Return each suggestion on its own line."
    )
    try:
        res = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
            },
            timeout=20,
        )
        res.raise_for_status()
        text = (((res.json().get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    except requests.RequestException as exc:
        raise SocialServiceError(f"AI suggestion request failed: {exc}", status_code=502)

    lines = [line.strip().lstrip("-•0123456789. ") for line in text.splitlines() if line.strip()]
    return lines[:3] if lines else []


def list_scheduled_posts(filters: dict[str, Any]) -> tuple[list[SocialScheduledPost], str, datetime]:
    cfg = get_analytics_config()
    qs = SocialScheduledPost.objects.select_related(
        "content", "account", "campaign", "owner", "approver"
    ).prefetch_related("history")

    date_from = parse_date(filters["from"]) if filters.get("from") else None
    date_to = parse_date(filters["to"]) if filters.get("to") else None
    tz = timezone.get_current_timezone()
    if date_from:
        qs = qs.filter(scheduled_at__gte=timezone.make_aware(datetime.combine(date_from, time.min), tz))
    if date_to:
        qs = qs.filter(scheduled_at__lte=timezone.make_aware(datetime.combine(date_to, time.max), tz))

    platform = filters.get("platform")
    if platform and platform != "all":
        qs = qs.filter(platform=platform)
    status = filters.get("status")
    if status and status != "all":
        qs = qs.filter(status=status)
    account_id = filters.get("account_id")
    if account_id and account_id != "all":
        qs = qs.filter(account_id=account_id)
    campaign_id = filters.get("campaign_id")
    if campaign_id and campaign_id != "all":
        qs = qs.filter(campaign_id=campaign_id)
    owner_id = filters.get("owner_id")
    if owner_id and owner_id != "all":
        qs = qs.filter(owner_id=owner_id)
    q = (filters.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(content_title__icontains=q)
            | Q(caption__icontains=q)
            | Q(account__display_name__icontains=q)
            | Q(account__username__icontains=q)
        )

    return list(qs.order_by("scheduled_at")), cfg.default_timezone, timezone.now()


@transaction.atomic
def schedule_post(
    content_id: str,
    platform: str,
    account_id: str,
    scheduled_at: datetime,
    as_reminder: bool = False,
    user: Any = None,
) -> SocialScheduledPost:
    content = get_content_detail(content_id)
    account = SocialAccount.objects.filter(pk=account_id, platform=platform).first()
    if not account:
        raise SocialServiceError("Selected account was not found for this platform.", status_code=404)
    if not account.can_publish and not as_reminder:
        raise SocialServiceError(
            "This account cannot auto-publish right now. Reauthorize or schedule as a manual reminder.",
            status_code=400,
        )
    if scheduled_at <= timezone.now():
        raise SocialServiceError("Scheduled time must be in the future.", status_code=400)

    cfg = get_analytics_config()
    sp = SocialScheduledPost.objects.create(
        content=content,
        content_title=content.title or "Untitled",
        thumbnail_url=_content_thumbnail(content),
        caption=content.caption,
        content_type=content.content_type,
        platform=platform,
        account=account,
        campaign=content.campaign,
        owner=content.owner or (user if getattr(user, "is_authenticated", False) else None),
        approver=content.reviewer,
        scheduled_at=scheduled_at,
        timezone=cfg.default_timezone,
        status=PublishStatus.SCHEDULED,
        is_manual_reminder=as_reminder,
    )
    SocialScheduledPostHistory.objects.create(
        scheduled_post=sp,
        status=PublishStatus.SCHEDULED,
        actor=user if getattr(user, "is_authenticated", False) else None,
        message="Scheduled as manual reminder." if as_reminder else "Scheduled for publishing.",
    )
    if content.status in (ContentStatus.APPROVED, ContentStatus.READY_TO_SCHEDULE):
        content.status = ContentStatus.SCHEDULED
        content.save(update_fields=["status", "updated_at"])
    record_activity(
        ActivityKind.SCHEDULED,
        f"Scheduled {sp.content_title} for {sp.get_platform_display()}",
        platform=platform,
        href=f"/social/publishing-calendar?id={sp.id}",
        status=sp.status,
    )
    return sp


@transaction.atomic
def reschedule_scheduled_post(post_id: str, scheduled_at: datetime, user: Any = None) -> SocialScheduledPost:
    sp = SocialScheduledPost.objects.select_for_update().filter(pk=post_id).first()
    if not sp:
        raise SocialServiceError("Scheduled post not found.", status_code=404)
    editable = {
        PublishStatus.DRAFT,
        PublishStatus.PENDING_APPROVAL,
        PublishStatus.APPROVED,
        PublishStatus.SCHEDULED,
        PublishStatus.QUEUED,
        PublishStatus.FAILED,
    }
    if sp.status not in editable:
        raise SocialServiceError("This post can no longer be rescheduled.", status_code=400)
    sp.scheduled_at = scheduled_at
    if sp.status == PublishStatus.FAILED:
        sp.status = PublishStatus.SCHEDULED
    sp.save(update_fields=["scheduled_at", "status", "updated_at"])
    SocialScheduledPostHistory.objects.create(
        scheduled_post=sp,
        status=sp.status,
        actor=user if getattr(user, "is_authenticated", False) else None,
        message=f"Rescheduled to {scheduled_at.isoformat()}.",
    )
    return sp


@transaction.atomic
def cancel_scheduled_post(post_id: str, reason: str = "", user: Any = None) -> SocialScheduledPost:
    sp = SocialScheduledPost.objects.select_for_update().filter(pk=post_id).first()
    if not sp:
        raise SocialServiceError("Scheduled post not found.", status_code=404)
    cancellable = {
        PublishStatus.DRAFT,
        PublishStatus.PENDING_APPROVAL,
        PublishStatus.APPROVED,
        PublishStatus.SCHEDULED,
        PublishStatus.QUEUED,
    }
    if sp.status not in cancellable:
        raise SocialServiceError("Only un-published scheduled posts can be cancelled.", status_code=400)
    sp.status = PublishStatus.CANCELLED
    sp.save(update_fields=["status", "updated_at"])
    SocialScheduledPostHistory.objects.create(
        scheduled_post=sp,
        status=PublishStatus.CANCELLED,
        actor=user if getattr(user, "is_authenticated", False) else None,
        message=reason or "Cancelled.",
    )
    return sp


@transaction.atomic
def duplicate_scheduled_post(post_id: str, scheduled_at: datetime, user: Any = None) -> SocialScheduledPost:
    src = SocialScheduledPost.objects.filter(pk=post_id).first()
    if not src:
        raise SocialServiceError("Scheduled post not found.", status_code=404)
    dup = SocialScheduledPost.objects.create(
        content=src.content,
        content_title=src.content_title,
        thumbnail_url=src.thumbnail_url,
        caption=src.caption,
        content_type=src.content_type,
        platform=src.platform,
        account=src.account,
        campaign=src.campaign,
        owner=user if getattr(user, "is_authenticated", False) else src.owner,
        scheduled_at=scheduled_at,
        timezone=src.timezone,
        status=PublishStatus.SCHEDULED,
        is_manual_reminder=src.is_manual_reminder,
    )
    SocialScheduledPostHistory.objects.create(
        scheduled_post=dup,
        status=PublishStatus.SCHEDULED,
        actor=user if getattr(user, "is_authenticated", False) else None,
        message=f"Duplicated from post #{src.id}.",
    )
    return dup


def _publish_to_platform(sp: SocialScheduledPost) -> dict[str, str]:
    account = sp.account
    if not account or not account.access_token:
        raise SocialServiceError("Connected account access token is missing.", status_code=400)
    if account.is_token_expired:
        _refresh_account_token(account)

    if sp.is_manual_reminder:
        raise SocialServiceError("Manual reminders cannot be auto-published.", status_code=400)

    platform = sp.platform
    caption = sp.caption or sp.content_title or ""

    if platform == SocialPlatform.FACEBOOK.value:
        page_id = account.account_id
        if not page_id:
            raise SocialServiceError("Facebook Page ID is missing.", status_code=400)
        res = requests.post(
            f"https://graph.facebook.com/v20.0/{page_id}/feed",
            data={"message": caption, "access_token": account.access_token},
            timeout=25,
        )
        res.raise_for_status()
        post_id = res.json().get("id", "")
        return {
            "platform_post_id": post_id,
            "published_url": f"https://www.facebook.com/{post_id}" if post_id else "",
            "response": res.text[:1000],
        }

    if platform == SocialPlatform.INSTAGRAM.value:
        ig_id = account.account_id
        if not ig_id:
            raise SocialServiceError("Instagram business account ID is missing.", status_code=400)
        if not sp.thumbnail_url:
            raise SocialServiceError("Instagram requires an image or video URL to publish.", status_code=400)
        create_res = requests.post(
            f"https://graph.facebook.com/v20.0/{ig_id}/media",
            data={"image_url": sp.thumbnail_url, "caption": caption, "access_token": account.access_token},
            timeout=25,
        )
        create_res.raise_for_status()
        creation_id = create_res.json().get("id")
        pub_res = requests.post(
            f"https://graph.facebook.com/v20.0/{ig_id}/media_publish",
            data={"creation_id": creation_id, "access_token": account.access_token},
            timeout=25,
        )
        pub_res.raise_for_status()
        post_id = pub_res.json().get("id", "")
        return {
            "platform_post_id": post_id,
            "published_url": "",
            "response": pub_res.text[:1000],
        }

    if platform == SocialPlatform.YOUTUBE.value:
        raise SocialServiceError(
            "YouTube video binary upload requires a scheduled background media worker.",
            status_code=501,
        )

    raise SocialServiceError(
        "TikTok video publishing requires a background video transfer worker.",
        status_code=501,
    )


def publish_scheduled_post_now(
    post_id: str,
    user: Any = None,
    is_retry: bool = False,
) -> SocialScheduledPost:
    with transaction.atomic():
        sp = (
            SocialScheduledPost.objects.select_for_update()
            .select_related("account", "content")
            .filter(pk=post_id)
            .first()
        )
        if not sp:
            raise SocialServiceError("Scheduled post not found.", status_code=404)
        if is_retry and sp.status != PublishStatus.FAILED:
            raise SocialServiceError("Only failed posts can be retried.", status_code=400)
        if not is_retry and sp.status not in (
            PublishStatus.APPROVED,
            PublishStatus.SCHEDULED,
            PublishStatus.QUEUED,
            PublishStatus.FAILED,
        ):
            raise SocialServiceError("Post is not in a publishable state.", status_code=400)
        sp.status = PublishStatus.PUBLISHING
        sp.attempt_at = timezone.now()
        sp.save(update_fields=["status", "attempt_at", "updated_at"])

    try:
        result = _publish_to_platform(sp)
        now = timezone.now()
        sp.status = PublishStatus.PUBLISHED
        sp.published_at = now
        sp.published_post_id = result.get("platform_post_id", "")
        sp.published_url = result.get("published_url", "")
        sp.platform_response = result.get("response", "")
        sp.failure_reason = ""
        sp.save(
            update_fields=[
                "status",
                "published_at",
                "published_post_id",
                "published_url",
                "platform_response",
                "failure_reason",
                "updated_at",
            ]
        )
        SocialScheduledPostHistory.objects.create(
            scheduled_post=sp,
            status=PublishStatus.PUBLISHED,
            actor=user if getattr(user, "is_authenticated", False) else None,
            message="Published successfully.",
            published_url=sp.published_url,
            is_retry=is_retry,
            retry_success=True if is_retry else None,
        )
        record_activity(
            ActivityKind.PUBLISHED,
            f"Published {sp.content_title or 'post'} on {sp.get_platform_display()}",
            platform=sp.platform,
            href=f"/social/publishing-calendar?id={sp.id}",
            status=PublishStatus.PUBLISHED,
        )
        create_notification(
            NotificationType.POST_PUBLISHED,
            f"Published on {sp.get_platform_display()}: {sp.content_title}",
            link=f"/social/publishing-calendar?id={sp.id}",
            recipient=sp.owner,
        )
    except Exception as exc:
        now = timezone.now()
        sp.status = PublishStatus.FAILED
        sp.failure_reason = str(exc)
        sp.last_error_at = now
        sp.save(update_fields=["status", "failure_reason", "last_error_at", "updated_at"])
        SocialScheduledPostHistory.objects.create(
            scheduled_post=sp,
            status=PublishStatus.FAILED,
            actor=user if getattr(user, "is_authenticated", False) else None,
            message=sp.failure_reason,
            is_retry=is_retry,
            retry_success=False if is_retry else None,
        )
        record_activity(
            ActivityKind.FAILED,
            f"Failed publishing {sp.content_title or 'post'} on {sp.get_platform_display()}",
            platform=sp.platform,
            href=f"/social/publishing-calendar?id={sp.id}",
            status=PublishStatus.FAILED,
        )
        create_notification(
            NotificationType.POST_FAILED,
            f"Publishing failed on {sp.get_platform_display()}: {sp.content_title}",
            message=sp.failure_reason,
            severity=AlertSeverity.ERROR,
            link=f"/social/publishing-calendar?id={sp.id}",
            action_label="Retry",
            recipient=sp.owner,
        )

    return sp


def _campaign_queryset(filters: dict[str, Any]):
    qs = SocialCampaign.objects.select_related("owner").prefetch_related(
        "accounts",
        "campaign_products",
        "campaign_contents__content__content_media_links__media",
        "campaign_contents__content__scheduled_posts",
        "alerts",
    )
    status = filters.get("status")
    if status and status != "all":
        qs = qs.filter(status=status)
    platform = filters.get("platform")
    if platform and platform != "all":
        qs = qs.filter(platforms__contains=[platform])
    ctype = filters.get("type")
    if ctype and ctype != "all":
        qs = qs.filter(type=ctype)
    owner_id = filters.get("owner_id")
    if owner_id and owner_id != "all":
        qs = qs.filter(owner_id=owner_id)
    date_from = parse_date(filters["date_from"]) if filters.get("date_from") else None
    date_to = parse_date(filters["date_to"]) if filters.get("date_to") else None
    if date_from:
        qs = qs.filter(end_date__gte=date_from)
    if date_to:
        qs = qs.filter(start_date__lte=date_to)
    q = (filters.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
    return qs


def list_campaigns(filters: dict[str, Any]) -> list[SocialCampaign]:
    return list(_campaign_queryset(filters).order_by("-created_at"))


def get_campaign_detail(campaign_id: str) -> SocialCampaign:
    obj = _campaign_queryset({}).filter(pk=campaign_id).first()
    if not obj:
        raise SocialServiceError("Campaign not found.", status_code=404)
    return obj


def get_campaign_kpis(filters: dict[str, Any]) -> dict[str, Any]:
    cfg = get_analytics_config()
    qs = _campaign_queryset(filters)
    total = qs.count()
    active = qs.filter(status=CampaignStatus.ACTIVE).count()
    scheduled = qs.filter(status=CampaignStatus.SCHEDULED).count()
    completed = qs.filter(status=CampaignStatus.COMPLETED).count()
    requiring_attention = qs.filter(alerts__is_resolved=False).distinct().count()

    agg = qs.aggregate(
        spend=Sum("actual_spend"),
        revenue=Sum("attributed_revenue"),
        orders=Sum("attributed_orders"),
    )
    total_spend = float(agg["spend"] or 0)
    attributed_revenue = float(agg["revenue"] or 0)
    attributed_orders = int(agg["orders"] or 0)
    roas = round(attributed_revenue / total_spend, 2) if total_spend > 0 and agg["revenue"] is not None else None

    organic_qs = qs.exclude(type=CampaignType.PAID_ADVERTISING)
    paid_qs = qs.filter(type=CampaignType.PAID_ADVERTISING)
    org_agg = organic_qs.aggregate(
        reach=Sum("reach"),
        engagement=Sum("engagement"),
        clicks=Sum("link_clicks"),
        orders=Sum("attributed_orders"),
        revenue=Sum("attributed_revenue"),
    )
    paid_agg = paid_qs.aggregate(
        spend=Sum("actual_spend"),
        impressions=Sum("impressions"),
        clicks=Sum("link_clicks"),
        orders=Sum("attributed_orders"),
        revenue=Sum("attributed_revenue"),
    )
    paid_spend = float(paid_agg["spend"] or 0)
    paid_rev = float(paid_agg["revenue"] or 0)

    return {
        "total": total,
        "active": active,
        "scheduled": scheduled,
        "completed": completed,
        "requiring_attention": requiring_attention,
        "total_spend": total_spend,
        "attributed_revenue": attributed_revenue,
        "attributed_orders": attributed_orders,
        "roas": roas,
        "currency": cfg.currency,
        "organic": {
            "reach": org_agg["reach"],
            "engagement": org_agg["engagement"],
            "clicks": org_agg["clicks"],
            "orders": org_agg["orders"],
            "attributed_revenue": float(org_agg["revenue"]) if org_agg["revenue"] is not None else None,
        },
        "paid": {
            "spend": paid_spend if paid_agg["spend"] is not None else None,
            "impressions": paid_agg["impressions"],
            "clicks": paid_agg["clicks"],
            "orders": paid_agg["orders"],
            "attributed_revenue": float(paid_agg["revenue"]) if paid_agg["revenue"] is not None else None,
            "roas": round(paid_rev / paid_spend, 2) if paid_spend > 0 and paid_agg["revenue"] is not None else None,
        },
    }


def evaluate_campaign_alerts(campaign: SocialCampaign) -> None:
    SocialCampaignAlert.objects.filter(campaign=campaign, is_resolved=False).delete()
    today = timezone.localdate()

    if not campaign.utm_campaign and not campaign.tracking_link:
        SocialCampaignAlert.objects.create(
            campaign=campaign,
            type=CampaignAlertType.MISSING_TRACKING,
            message="Campaign has no tracking link or UTM campaign code configured.",
            severity=AlertSeverity.INFO,
        )

    if (
        campaign.planned_budget is not None
        and campaign.actual_spend is not None
        and campaign.actual_spend > campaign.planned_budget
    ):
        SocialCampaignAlert.objects.create(
            campaign=campaign,
            type=CampaignAlertType.BUDGET_WARNING,
            message="Actual spend has exceeded planned budget.",
            severity=AlertSeverity.WARNING,
        )

    if campaign.status == CampaignStatus.ACTIVE and 0 <= (campaign.end_date - today).days <= 3:
        SocialCampaignAlert.objects.create(
            campaign=campaign,
            type=CampaignAlertType.ENDING_SOON,
            message="Campaign is ending within 3 days.",
            severity=AlertSeverity.INFO,
        )

    if campaign.status == CampaignStatus.SCHEDULED and 0 <= (campaign.start_date - today).days <= 2:
        SocialCampaignAlert.objects.create(
            campaign=campaign,
            type=CampaignAlertType.STARTING_SOON,
            message="Campaign starts within 2 days.",
            severity=AlertSeverity.INFO,
        )

    unhealthy = SocialAccount.objects.filter(
        platform__in=campaign.platforms or []
    ).exclude(status=AccountConnectionStatus.CONNECTED)
    if unhealthy.exists():
        SocialCampaignAlert.objects.create(
            campaign=campaign,
            type=CampaignAlertType.INTEGRATION_FAILURE,
            message="One or more selected platforms do not have a healthy connected account.",
            severity=AlertSeverity.WARNING,
        )


@transaction.atomic
def create_campaign(data: dict[str, Any], user: Any = None) -> SocialCampaign:
    budget = data.get("budget") or {}
    adv = data.get("advertising") or {}
    owner = User.objects.filter(pk=data["owner_id"]).first() if data.get("owner_id") else None

    slug_part = "".join(c if c.isalnum() else "-" for c in data["name"].lower()).strip("-")[:48] or "campaign"
    promo_url = data.get("promotional_url") or ""
    tracking_link = ""
    if promo_url:
        sep = "&" if "?" in promo_url else "?"
        tracking_link = f"{promo_url}{sep}utm_source=social&utm_medium={data['type']}&utm_campaign={slug_part}"

    campaign = SocialCampaign.objects.create(
        name=data["name"],
        description=data.get("description") or "",
        objective=data["objective"],
        type=data["type"],
        status=data["status"],
        start_date=data["start_date"],
        end_date=data["end_date"],
        owner=owner or (user if getattr(user, "is_authenticated", False) else None),
        internal_notes=data.get("internal_notes") or "",
        platforms=data["platforms"],
        discount_id=data.get("discount_id") or "",
        promotional_message=data.get("promotional_message") or "",
        promotional_url=promo_url,
        offer_start=data.get("offer_start"),
        offer_end=data.get("offer_end"),
        planned_budget=budget.get("planned_budget"),
        actual_spend=budget.get("actual_spend"),
        advertising_cost=budget.get("advertising_cost"),
        creator_commission=budget.get("creator_commission"),
        currency=budget.get("currency") or "KES",
        advertising_platform=adv.get("platform") or "",
        advertising_account=adv.get("account") or "",
        advertising_external_id=adv.get("external_id") or "",
        utm_source="social",
        utm_medium=data["type"],
        utm_campaign=slug_part,
        tracking_link=tracking_link,
        conversion_attribution=AttributionStatus.PARTIAL if promo_url else AttributionStatus.UNAVAILABLE,
    )

    acc_ids = [a.get("account_id") for a in data.get("accounts") or [] if a.get("account_id")]
    if acc_ids:
        campaign.accounts.set(SocialAccount.objects.filter(pk__in=acc_ids))
    else:
        campaign.accounts.set(
            SocialAccount.objects.filter(
                platform__in=data["platforms"],
                status=AccountConnectionStatus.CONNECTED,
            )
        )

    for pid in dict.fromkeys(data.get("product_ids") or []):
        SocialCampaignProduct.objects.create(campaign=campaign, product_id=str(pid))

    for cid in dict.fromkeys(data.get("content_ids") or []):
        c = SocialContent.objects.filter(pk=cid).first()
        if c:
            SocialCampaignContent.objects.create(campaign=campaign, content=c, publication_status=c.status)
            if not c.campaign_id:
                c.campaign = campaign
                c.save(update_fields=["campaign", "updated_at"])

    evaluate_campaign_alerts(campaign)
    log_audit(user, "social_campaign_created", "SocialCampaign", str(campaign.id))
    record_activity(
        ActivityKind.CAMPAIGN,
        f"Created campaign: {campaign.name}",
        href=f"/social/campaigns?id={campaign.id}",
        status=campaign.status,
    )
    return get_campaign_detail(str(campaign.id))


@transaction.atomic
def transition_campaign_status(campaign_id: str, action: str, user: Any = None) -> SocialCampaign:
    campaign = SocialCampaign.objects.select_for_update().filter(pk=campaign_id).first()
    if not campaign:
        raise SocialServiceError("Campaign not found.", status_code=404)

    transitions = {
        "pause": ({CampaignStatus.ACTIVE}, CampaignStatus.PAUSED),
        "resume": ({CampaignStatus.PAUSED}, CampaignStatus.ACTIVE),
        "complete": (
            {
                CampaignStatus.DRAFT,
                CampaignStatus.PENDING_APPROVAL,
                CampaignStatus.SCHEDULED,
                CampaignStatus.ACTIVE,
                CampaignStatus.PAUSED,
            },
            CampaignStatus.COMPLETED,
        ),
        "cancel": (
            {
                CampaignStatus.DRAFT,
                CampaignStatus.PENDING_APPROVAL,
                CampaignStatus.SCHEDULED,
                CampaignStatus.ACTIVE,
                CampaignStatus.PAUSED,
            },
            CampaignStatus.CANCELLED,
        ),
    }
    if action not in transitions:
        raise SocialServiceError("Unsupported campaign action.", status_code=400)

    allowed_from, next_status = transitions[action]
    if campaign.status not in allowed_from:
        raise SocialServiceError(f"Cannot {action} a campaign in status '{campaign.status}'.", status_code=400)

    campaign.status = next_status
    campaign.save(update_fields=["status", "updated_at"])
    log_audit(user, f"social_campaign_{action}", "SocialCampaign", str(campaign.id))
    return get_campaign_detail(str(campaign.id))


def get_inbox_capabilities() -> dict[str, dict[str, Any]]:
    accounts = list(SocialAccount.objects.all())
    by_plat: dict[str, list[SocialAccount]] = {p: [] for p in PLATFORM_ORDER}
    for acc in accounts:
        by_plat.setdefault(acc.platform, []).append(acc)

    result: dict[str, dict[str, Any]] = {}
    for p in PLATFORM_ORDER:
        connected_accs = [a for a in by_plat[p] if a.status == AccountConnectionStatus.CONNECTED]
        if not connected_accs:
            result[p] = {
                "connected": False,
                "supports_dm": False,
                "supports_comments": False,
                "supports_mentions": False,
                "supports_reply": False,
                "supports_react": False,
                "supports_hide": False,
                "supports_moderation": False,
                "note": "No connected account for this platform.",
            }
            continue
        notes = [a.inbox_capability_note for a in connected_accs if a.inbox_capability_note]
        result[p] = {
            "connected": True,
            "supports_dm": any(a.supports_dm for a in connected_accs),
            "supports_comments": any(a.supports_comments for a in connected_accs),
            "supports_mentions": any(a.supports_mentions for a in connected_accs),
            "supports_reply": any(a.supports_reply for a in connected_accs),
            "supports_react": any(a.supports_react for a in connected_accs),
            "supports_hide": any(a.supports_hide for a in connected_accs),
            "supports_moderation": any(a.supports_moderation for a in connected_accs),
            "note": notes[0] if notes else None,
        }
    return result


def list_inbox_conversations(filters: dict[str, Any], user: Any = None) -> list[SocialInboxConversation]:
    qs = SocialInboxConversation.objects.select_related("account", "assigned_to").prefetch_related("messages__author")
    folder = filters.get("folder") or "all"
    if folder == "dm":
        qs = qs.filter(type=InteractionType.DM)
    elif folder == "comment":
        qs = qs.filter(type=InteractionType.COMMENT)
    elif folder == "mention":
        qs = qs.filter(type=InteractionType.MENTION)
    elif folder == "unread":
        qs = qs.filter(unread=True)
    elif folder == "assigned_me":
        if getattr(user, "is_authenticated", False):
            qs = qs.filter(assigned_to=user)
        else:
            qs = qs.none()
    elif folder == "unassigned":
        qs = qs.filter(assigned_to__isnull=True)
    elif folder == "resolved":
        qs = qs.filter(status=ConversationStatus.RESOLVED)
    elif folder == "archived":
        qs = qs.filter(status=ConversationStatus.ARCHIVED)
    else:
        qs = qs.exclude(status=ConversationStatus.ARCHIVED)

    platform = filters.get("platform")
    if platform and platform != "all":
        qs = qs.filter(platform=platform)
    q = (filters.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(customer_display_name__icontains=q)
            | Q(customer_username__icontains=q)
            | Q(preview__icontains=q)
            | Q(related_post_title__icontains=q)
        )
    return list(qs.order_by("-last_interaction_at"))


@transaction.atomic
def get_inbox_conversation(conversation_id: str) -> SocialInboxConversation:
    conv = (
        SocialInboxConversation.objects.select_related("account", "assigned_to")
        .prefetch_related("messages__author")
        .filter(pk=conversation_id)
        .first()
    )
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    if conv.unread or conv.status == ConversationStatus.UNREAD:
        conv.unread = False
        if conv.status == ConversationStatus.UNREAD:
            conv.status = ConversationStatus.READ
        conv.save(update_fields=["unread", "status", "updated_at"])
    return conv


def get_inbox_metrics() -> dict[str, Any]:
    active_qs = SocialInboxConversation.objects.exclude(status=ConversationStatus.ARCHIVED)
    total_incoming = active_qs.count()
    unread = active_qs.filter(unread=True).count()
    resolved = active_qs.filter(status=ConversationStatus.RESOLVED).count()
    unanswered = (
        active_qs.exclude(status=ConversationStatus.RESOLVED)
        .filter(first_response_at__isnull=True)
        .count()
    )

    resp_diffs: list[float] = []
    for c in active_qs.filter(first_response_at__isnull=False).only("first_response_at", "created_at"):
        diff = (c.first_response_at - c.created_at).total_seconds()
        if diff >= 0:
            resp_diffs.append(diff)
    avg_response_seconds = (sum(resp_diffs) / len(resp_diffs)) if resp_diffs else None

    by_platform = {p: 0 for p in PLATFORM_ORDER}
    for row in active_qs.values("platform").annotate(c=Count("id")):
        by_platform[row["platform"]] = row["c"]

    workload_rows = (
        active_qs.filter(assigned_to__isnull=False)
        .exclude(status=ConversationStatus.RESOLVED)
        .values("assigned_to_id", "assigned_to__first_name", "assigned_to__last_name", "assigned_to__email")
        .annotate(assigned_count=Count("id"))
        .order_by("-assigned_count")
    )
    staff_workload = []
    for w in workload_rows:
        full = f"{w['assigned_to__first_name'] or ''} {w['assigned_to__last_name'] or ''}".strip()
        staff_workload.append(
            {
                "staff_id": str(w["assigned_to_id"]),
                "staff_name": full or w["assigned_to__email"] or "Staff",
                "assigned_count": w["assigned_count"],
            }
        )

    return {
        "total_incoming": total_incoming,
        "unread": unread,
        "resolved": resolved,
        "unanswered": unanswered,
        "avg_response_seconds": avg_response_seconds,
        "by_platform": by_platform,
        "staff_workload": staff_workload,
    }


def _deliver_platform_reply(conv: SocialInboxConversation, body: str) -> str:
    acc = conv.account
    if not acc or acc.status != AccountConnectionStatus.CONNECTED or not acc.access_token:
        raise SocialServiceError("Connected account is unavailable to send replies.", status_code=400)
    if acc.is_token_expired:
        _refresh_account_token(acc)

    if conv.platform in (SocialPlatform.FACEBOOK.value, SocialPlatform.INSTAGRAM.value):
        if conv.type == InteractionType.COMMENT and conv.platform_conversation_id:
            res = requests.post(
                f"https://graph.facebook.com/v20.0/{conv.platform_conversation_id}/replies",
                data={"message": body, "access_token": acc.access_token},
                timeout=20,
            )
            res.raise_for_status()
            return str(res.json().get("id", ""))
        if conv.type == InteractionType.DM and conv.platform_conversation_id:
            res = requests.post(
                f"https://graph.facebook.com/v20.0/me/messages",
                json={"recipient": {"id": conv.platform_conversation_id}, "message": {"text": body}},
                params={"access_token": acc.access_token},
                timeout=20,
            )
            res.raise_for_status()
            return str(res.json().get("message_id", ""))

    if conv.platform == SocialPlatform.YOUTUBE.value and conv.type == InteractionType.COMMENT:
        res = requests.post(
            "https://www.googleapis.com/youtube/v3/comments",
            params={"part": "snippet"},
            headers={"Authorization": f"Bearer {acc.access_token}", "Content-Type": "application/json"},
            json={"snippet": {"parentId": conv.platform_conversation_id, "textOriginal": body}},
            timeout=20,
        )
        res.raise_for_status()
        return str(res.json().get("id", ""))

    raise SocialServiceError(
        f"Sending replies for {conv.type} on {conv.platform} is not supported by the current platform API.",
        status_code=400,
    )


@transaction.atomic
def reply_to_conversation(conversation_id: str, body: str, user: Any = None) -> SocialInboxConversation:
    conv = SocialInboxConversation.objects.select_for_update().select_related("account").filter(pk=conversation_id).first()
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    if not conv.can_reply:
        raise SocialServiceError("Replies are not supported for this conversation.", status_code=400)

    platform_msg_id = _deliver_platform_reply(conv, body)
    now = timezone.now()
    SocialInboxMessage.objects.create(
        conversation=conv,
        direction=MessageDirection.OUTBOUND,
        body=body,
        author=user if getattr(user, "is_authenticated", False) else None,
        platform_message_id=platform_msg_id,
        created_at=now,
    )
    conv.preview = body[:500]
    conv.last_interaction_at = now
    conv.unread = False
    conv.status = ConversationStatus.READ
    if not conv.first_response_at:
        conv.first_response_at = now
    conv.save()
    return get_inbox_conversation(str(conv.id))


@transaction.atomic
def add_internal_note(conversation_id: str, body: str, user: Any = None) -> SocialInboxConversation:
    conv = SocialInboxConversation.objects.filter(pk=conversation_id).first()
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    SocialInboxMessage.objects.create(
        conversation=conv,
        direction=MessageDirection.NOTE,
        body=body,
        author=user if getattr(user, "is_authenticated", False) else None,
    )
    return get_inbox_conversation(str(conv.id))


@transaction.atomic
def assign_conversation(conversation_id: str, staff_id: str | None, user: Any = None) -> SocialInboxConversation:
    conv = SocialInboxConversation.objects.select_for_update().filter(pk=conversation_id).first()
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    if not conv.can_assign:
        raise SocialServiceError("Assignment is disabled for this conversation.", status_code=400)
    conv.assigned_to = User.objects.filter(pk=staff_id).first() if staff_id else None
    conv.save(update_fields=["assigned_to", "updated_at"])
    log_audit(user, "social_inbox_assigned", "SocialInboxConversation", str(conv.id), {"staff_id": staff_id})
    return get_inbox_conversation(str(conv.id))


@transaction.atomic
def perform_conversation_action(
    conversation_id: str,
    action: str,
    payload: dict[str, Any] | None = None,
    user: Any = None,
) -> SocialInboxConversation:
    conv = SocialInboxConversation.objects.select_for_update().filter(pk=conversation_id).first()
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    payload = payload or {}

    if action == "react":
        if not conv.can_react:
            raise SocialServiceError("Reactions are not supported for this item.", status_code=400)
        last_msg = conv.messages.filter(direction=MessageDirection.INBOUND).last()
        if last_msg:
            last_msg.reaction = str(payload.get("reaction") or "like")
            last_msg.save(update_fields=["reaction"])
    elif action == "hide":
        if not conv.can_hide:
            raise SocialServiceError("Hiding is not supported for this item.", status_code=400)
        conv.is_hidden = True
        conv.save(update_fields=["is_hidden", "updated_at"])
    elif action == "moderate":
        if not conv.can_moderate:
            raise SocialServiceError("Moderation is not supported for this item.", status_code=400)
        conv.is_moderated = True
        conv.save(update_fields=["is_moderated", "updated_at"])
    elif action == "mark-unread":
        conv.unread = True
        conv.status = ConversationStatus.UNREAD
        conv.save(update_fields=["unread", "status", "updated_at"])
    elif action == "resolve":
        conv.status = ConversationStatus.RESOLVED
        conv.unread = False
        conv.resolved_at = timezone.now()
        conv.save(update_fields=["status", "unread", "resolved_at", "updated_at"])
    elif action == "archive":
        if not conv.can_archive:
            raise SocialServiceError("Archiving is not allowed for this item.", status_code=400)
        conv.status = ConversationStatus.ARCHIVED
        conv.unread = False
        conv.archived_at = timezone.now()
        conv.save(update_fields=["status", "unread", "archived_at", "updated_at"])
    else:
        raise SocialServiceError(f"Unsupported inbox action: {action}", status_code=400)

    log_audit(user, f"social_inbox_{action}", "SocialInboxConversation", str(conv.id))
    return get_inbox_conversation(str(conv.id))


@transaction.atomic
def link_conversation_product(conversation_id: str, product_id: str, user: Any = None) -> SocialInboxConversation:
    conv = SocialInboxConversation.objects.select_for_update().filter(pk=conversation_id).first()
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    conv.linked_product_id = str(product_id)
    conv.save(update_fields=["linked_product_id", "updated_at"])
    log_audit(user, "social_inbox_link_product", "SocialInboxConversation", str(conv.id), {"product_id": product_id})
    return get_inbox_conversation(str(conv.id))


@transaction.atomic
def link_conversation_customer(conversation_id: str, customer_id: str, user: Any = None) -> SocialInboxConversation:
    conv = SocialInboxConversation.objects.select_for_update().filter(pk=conversation_id).first()
    if not conv:
        raise SocialServiceError("Conversation not found.", status_code=404)
    conv.linked_customer_id = str(customer_id)
    conv.save(update_fields=["linked_customer_id", "updated_at"])
    log_audit(user, "social_inbox_link_customer", "SocialInboxConversation", str(conv.id), {"customer_id": customer_id})
    return get_inbox_conversation(str(conv.id))


def _metric(value: float | int | None, previous: float | int | None = None, available: bool = True) -> dict[str, Any]:
    if not available:
        return {"value": None, "previous": None, "available": False}
    return {
        "value": float(value) if value is not None else None,
        "previous": float(previous) if previous is not None else None,
        "available": True,
    }


def _pct_delta(cur: float | int | None, prev: float | int | None) -> float | None:
    if cur is None or prev is None or float(prev) == 0:
        return None
    return round(((float(cur) - float(prev)) / float(prev)) * 100.0, 2)


def _metric_available(platform: str, metric_name: str, accounts: list[SocialAccount]) -> bool:
    for a in accounts:
        if metric_name in (a.missing_metrics or []):
            return False
    if metric_name in PLATFORM_UNAVAILABLE_DEFAULTS.get(platform, []):
        return False
    return True


def build_analytics_report(filters: dict[str, Any], product_map: dict[str, dict] | None = None) -> dict[str, Any]:
    cfg = get_analytics_config()
    product_map = product_map or {}
    (
        start_dt,
        end_dt,
        prev_start_dt,
        prev_end_dt,
        start_d,
        end_d,
        prev_start_d,
        prev_end_d,
    ) = resolve_date_range(filters.get("range"), filters.get("start"), filters.get("end"))

    platform_filter = filters.get("platform")
    account_filter = filters.get("account")
    campaign_filter = filters.get("campaign")
    content_type_filter = filters.get("content_type")
    compare = str(filters.get("compare", "true")).lower() != "false"

    accounts_qs = SocialAccount.objects.all()
    if platform_filter:
        accounts_qs = accounts_qs.filter(platform=platform_filter)
    if account_filter:
        accounts_qs = accounts_qs.filter(pk=account_filter)
    accounts = list(accounts_qs.order_by("platform", "display_name"))

    account_rows = [
        {
            "id": str(a.id),
            "platform": a.platform,
            "handle": a.username or a.display_name or a.account_id or "",
            "name": a.display_name or a.username or a.get_platform_display(),
            "last_synced_at": a.last_synced_at,
            "coverage_start": a.coverage_start,
            "coverage_end": a.coverage_end,
            "sync_status": a.sync_status,
            "missing_metrics": a.missing_metrics or [],
        }
        for a in accounts
    ]

    target_platforms = [platform_filter] if platform_filter else PLATFORM_ORDER
    cur_metrics_qs = SocialPlatformDailyMetric.objects.filter(date__gte=start_d, date__lte=end_d)
    prev_metrics_qs = SocialPlatformDailyMetric.objects.filter(date__gte=prev_start_d, date__lte=prev_end_d)
    if account_filter:
        cur_metrics_qs = cur_metrics_qs.filter(account_id=account_filter)
        prev_metrics_qs = prev_metrics_qs.filter(account_id=account_filter)

    platform_summaries = []
    for p in target_platforms:
        p_accs = [a for a in accounts if a.platform == p]
        p_acc_rows = [r for r in account_rows if r["platform"] == p]
        cur_agg = cur_metrics_qs.filter(platform=p).aggregate(
            follower_growth=Sum("follower_growth"),
            reach=Sum("reach"),
            impressions=Sum("impressions"),
            views=Sum("views"),
            engagement=Sum("engagement"),
            link_clicks=Sum("link_clicks"),
            profile_visits=Sum("profile_visits"),
            published_content=Sum("published_content"),
        )
        prev_agg = prev_metrics_qs.filter(platform=p).aggregate(
            follower_growth=Sum("follower_growth"),
            reach=Sum("reach"),
            impressions=Sum("impressions"),
            views=Sum("views"),
            engagement=Sum("engagement"),
            link_clicks=Sum("link_clicks"),
            profile_visits=Sum("profile_visits"),
            published_content=Sum("published_content"),
        )

        cur_followers = sum(a.followers for a in p_accs if a.followers is not None) if any(a.followers is not None for a in p_accs) else None
        prev_snap = (
            SocialFollowerSnapshot.objects.filter(platform=p, date__lte=prev_end_d)
            .order_by("-date")
            .values("account_id", "followers")
        )
        seen_prev = {}
        for row in prev_snap:
            if row["account_id"] not in seen_prev:
                seen_prev[row["account_id"]] = row["followers"]
        prev_followers = sum(seen_prev.values()) if seen_prev else None

        unavailable = []
        for m_name in ("reach", "impressions", "views", "profile_visits", "link_clicks"):
            if not _metric_available(p, m_name, p_accs):
                unavailable.append(m_name)

        cur_reach = cur_agg["reach"]
        cur_eng = cur_agg["engagement"]
        prev_reach = prev_agg["reach"]
        prev_eng = prev_agg["engagement"]
        cur_eng_rate = round((cur_eng / cur_reach) * 100, 2) if cur_eng is not None and cur_reach else None
        prev_eng_rate = round((prev_eng / prev_reach) * 100, 2) if prev_eng is not None and prev_reach else None

        platform_summaries.append(
            {
                "platform": p,
                "accounts": p_acc_rows,
                "followers": _metric(cur_followers, prev_followers if compare else None, True),
                "follower_growth": _metric(cur_agg["follower_growth"], prev_agg["follower_growth"] if compare else None, True),
                "reach": _metric(cur_reach, prev_agg["reach"] if compare else None, "reach" not in unavailable),
                "impressions": _metric(cur_agg["impressions"], prev_agg["impressions"] if compare else None, "impressions" not in unavailable),
                "views": _metric(cur_agg["views"], prev_agg["views"] if compare else None, "views" not in unavailable),
                "engagement": _metric(cur_eng, prev_eng if compare else None, True),
                "engagement_rate": _metric(cur_eng_rate, prev_eng_rate if compare else None, "reach" not in unavailable),
                "link_clicks": _metric(cur_agg["link_clicks"], prev_agg["link_clicks"] if compare else None, "link_clicks" not in unavailable),
                "profile_visits": _metric(cur_agg["profile_visits"], prev_agg["profile_visits"] if compare else None, "profile_visits" not in unavailable),
                "published_content": _metric(cur_agg["published_content"], prev_agg["published_content"] if compare else None, True),
                "unavailable": unavailable,
            }
        )

    camp_qs = SocialCampaign.objects.all()
    if platform_filter:
        camp_qs = camp_qs.filter(platforms__contains=[platform_filter])
    if campaign_filter:
        camp_qs = camp_qs.filter(pk=campaign_filter)
    campaigns_data = []
    for c in camp_qs.order_by("-created_at"):
        p = platform_filter or (c.platforms[0] if c.platforms else SocialPlatform.INSTAGRAM.value)
        spend = float(c.actual_spend) if c.actual_spend is not None else None
        rev = float(c.attributed_revenue) if c.attributed_revenue is not None else None
        roas = round(rev / spend, 2) if spend and spend > 0 and rev is not None else None
        campaigns_data.append(
            {
                "id": str(c.id),
                "name": c.name,
                "platform": p,
                "type": "paid" if c.type == CampaignType.PAID_ADVERTISING else "organic",
                "spend": spend,
                "reach": _metric(c.reach, None, _metric_available(p, "reach", [])),
                "impressions": _metric(c.impressions, None, _metric_available(p, "impressions", [])),
                "views": _metric(c.views, None, True),
                "engagement": _metric(c.engagement, None, True),
                "clicks": _metric(c.link_clicks, None, True),
                "website_visits": _metric(c.website_visits, None, True),
                "orders": _metric(c.attributed_orders if c.attributed_orders is not None else c.orders, None, True),
                "attributed_revenue": _metric(rev, None, True),
                "roas": roas,
            }
        )

    posts_qs = SocialScheduledPost.objects.select_related("account", "content").filter(
        status=PublishStatus.PUBLISHED,
        published_at__gte=start_dt,
        published_at__lte=end_dt,
    )
    if platform_filter:
        posts_qs = posts_qs.filter(platform=platform_filter)
    if account_filter:
        posts_qs = posts_qs.filter(account_id=account_filter)
    if campaign_filter:
        posts_qs = posts_qs.filter(campaign_id=campaign_filter)
    if content_type_filter:
        posts_qs = posts_qs.filter(content_type=content_type_filter)

    content_rows = []
    for post in posts_qs.order_by("-published_at"):
        eng = post.total_engagement
        er = post.engagement_rate
        content_rows.append(
            {
                "id": str(post.id),
                "thumbnail_url": post.thumbnail_url or None,
                "title": post.content_title or (post.caption[:80] if post.caption else "Untitled"),
                "platform": post.platform,
                "account_handle": post.account.username or post.account.display_name or "",
                "content_type": post.content_type or "post",
                "published_at": post.published_at,
                "views": _metric(post.views, None, _metric_available(post.platform, "views", [post.account])),
                "reach": _metric(post.reach, None, _metric_available(post.platform, "reach", [post.account])),
                "impressions": _metric(post.impressions, None, _metric_available(post.platform, "impressions", [post.account])),
                "likes": _metric(post.likes, None, True),
                "comments": _metric(post.comments, None, True),
                "shares": _metric(post.shares, None, True),
                "saves": _metric(post.saves, None, post.platform != SocialPlatform.YOUTUBE.value),
                "engagement_rate": _metric(er, None, er is not None),
                "link_clicks": _metric(post.link_clicks, None, True),
                "attributed_orders": _metric(post.attributed_orders, None, True),
                "attributed_revenue": _metric(
                    float(post.attributed_revenue) if post.attributed_revenue is not None else None,
                    None,
                    True,
                ),
            }
        )

    attr_qs = SocialAttributionEvent.objects.filter(occurred_at__gte=start_dt, occurred_at__lte=end_dt)
    if platform_filter:
        attr_qs = attr_qs.filter(platform=platform_filter)
    if account_filter:
        attr_qs = attr_qs.filter(account_id=account_filter)
    if campaign_filter:
        attr_qs = attr_qs.filter(campaign_id=campaign_filter)

    prod_stats: dict[str, dict[str, Any]] = {}
    for ev in attr_qs.exclude(product_id="").values("product_id", "event_type").annotate(
        cnt=Count("id"),
        units=Sum("units"),
        rev=Sum("revenue"),
        paid_orders=Count("order_id", filter=Q(event_type=AttributionEventType.ORDER, is_verified_paid=True), distinct=True),
        paid_rev=Sum("revenue", filter=Q(event_type=AttributionEventType.ORDER, is_verified_paid=True)),
    ):
        pid = str(ev["product_id"])
        bucket = prod_stats.setdefault(
            pid,
            {
                "product_views": 0,
                "clicks": 0,
                "add_to_cart": 0,
                "orders": 0,
                "units_sold": 0,
                "attributed_revenue": 0.0,
            },
        )
        et = ev["event_type"]
        if et == AttributionEventType.VISIT:
            bucket["clicks"] += ev["cnt"] or 0
        elif et == AttributionEventType.PRODUCT_VIEW:
            bucket["product_views"] += ev["cnt"] or 0
        elif et == AttributionEventType.ADD_TO_CART:
            bucket["add_to_cart"] += ev["cnt"] or 0
        elif et == AttributionEventType.ORDER:
            bucket["orders"] += ev["paid_orders"] or 0
            bucket["units_sold"] += ev["units"] or 0
            bucket["attributed_revenue"] += float(ev["paid_rev"] or 0)

    products_data = []
    for pid, st in prod_stats.items():
        info = product_map.get(pid, {})
        views_n = st["product_views"]
        conv = round((st["orders"] / views_n) * 100, 2) if views_n > 0 else 0.0
        products_data.append(
            {
                "id": pid,
                "name": info.get("name") or f"Product #{pid}",
                "sku": info.get("sku") or "",
                "image_url": info.get("image_url"),
                "product_views": st["product_views"],
                "clicks": st["clicks"],
                "add_to_cart": st["add_to_cart"],
                "orders": st["orders"],
                "units_sold": st["units_sold"],
                "attributed_revenue": round(st["attributed_revenue"], 2),
                "conversion_rate": conv,
            }
        )

    funnel_counts = {
        AttributionEventType.VISIT.value: attr_qs.filter(event_type=AttributionEventType.VISIT).count(),
        AttributionEventType.PRODUCT_VIEW.value: attr_qs.filter(event_type=AttributionEventType.PRODUCT_VIEW).count(),
        AttributionEventType.ADD_TO_CART.value: attr_qs.filter(event_type=AttributionEventType.ADD_TO_CART).count(),
        AttributionEventType.CHECKOUT.value: attr_qs.filter(event_type=AttributionEventType.CHECKOUT).count(),
        AttributionEventType.ORDER.value: attr_qs.filter(
            event_type=AttributionEventType.ORDER, is_verified_paid=True
        ).values("order_id").distinct().count(),
    }
    funnel = [
        {"key": "visit", "label": "Website visits", "value": funnel_counts[AttributionEventType.VISIT.value], "definition": "Tracked website sessions with a social referral or UTM."},
        {"key": "product_view", "label": "Product views", "value": funnel_counts[AttributionEventType.PRODUCT_VIEW.value], "definition": "Product detail views within social-referred sessions."},
        {"key": "add_to_cart", "label": "Add to cart", "value": funnel_counts[AttributionEventType.ADD_TO_CART.value], "definition": "Add-to-cart events triggered by social-referred visitors."},
        {"key": "checkout", "label": "Checkout starts", "value": funnel_counts[AttributionEventType.CHECKOUT.value], "definition": "Checkout sessions started after a social touch."},
        {"key": "order", "label": "Completed orders", "value": funnel_counts[AttributionEventType.ORDER.value], "definition": "Verified paid orders attributed within the reporting window."},
    ]

    revenue_breakdown = []
    for p in target_platforms:
        p_qs = attr_qs.filter(platform=p)
        visits = p_qs.filter(event_type=AttributionEventType.VISIT).count()
        paid_orders_qs = p_qs.filter(event_type=AttributionEventType.ORDER, is_verified_paid=True)
        attributed_orders = paid_orders_qs.filter(is_direct=False).values("order_id").distinct().count() + paid_orders_qs.filter(is_direct=True).values("order_id").distinct().count()
        assisted_orders = paid_orders_qs.filter(is_assisted=True).values("order_id").distinct().count()
        direct_orders = paid_orders_qs.filter(is_direct=True).values("order_id").distinct().count()
        rev_sum = paid_orders_qs.aggregate(r=Sum("revenue"))["r"] or Decimal("0")
        revenue_breakdown.append(
            {
                "key": p,
                "label": dict(SocialPlatform.choices).get(p, p),
                "visits": visits,
                "assisted_orders": assisted_orders,
                "attributed_orders": attributed_orders,
                "attributed_revenue": float(rev_sum),
                "direct_orders": direct_orders,
                "unattributed_orders": 0,
            }
        )

    snaps = (
        SocialFollowerSnapshot.objects.filter(date__gte=start_d, date__lte=end_d)
        .values("date", "platform")
        .annotate(total=Sum("followers"))
        .order_by("date")
    )
    by_date: dict[str, dict[str, Any]] = {}
    for row in snaps:
        d_str = row["date"].isoformat()
        pt = by_date.setdefault(d_str, {"date": d_str})
        pt[row["platform"]] = row["total"]
    audience_growth = list(by_date.values())

    return {
        "accounts": account_rows,
        "platform_summaries": platform_summaries,
        "campaigns": campaigns_data,
        "content": content_rows,
        "products": products_data,
        "funnel": funnel,
        "revenue_breakdown": revenue_breakdown,
        "audience_growth": audience_growth,
        "audit": {
            "attribution_model": cfg.attribution_model,
            "reporting_window_days": cfg.reporting_window_days,
            "generated_at": timezone.now(),
            "currency": cfg.currency,
        },
    }


def build_social_overview(
    range_key: str = "7d",
    platform_filter: str = "all",
    custom_from: str | None = None,
    custom_to: str | None = None,
    store_revenue_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cfg = get_analytics_config()
    (
        start_dt,
        end_dt,
        prev_start_dt,
        prev_end_dt,
        start_d,
        end_d,
        prev_start_d,
        prev_end_d,
    ) = resolve_date_range(range_key, custom_from, custom_to)

    all_accounts = list(SocialAccount.objects.all())
    acc_by_plat: dict[str, list[SocialAccount]] = {p: [] for p in PLATFORM_ORDER}
    for a in all_accounts:
        acc_by_plat.setdefault(a.platform, []).append(a)

    target_platforms = [platform_filter] if platform_filter and platform_filter != "all" else PLATFORM_ORDER

    account_summaries = []
    for p in PLATFORM_ORDER:
        accs = acc_by_plat.get(p, [])
        if not accs:
            account_summaries.append(
                {
                    "platform": p,
                    "status": AccountConnectionStatus.NOT_CONNECTED,
                    "account_name": None,
                    "username": None,
                    "followers": None,
                    "last_synced_at": None,
                    "error": None,
                }
            )
            continue
        primary = next((a for a in accs if a.is_default_publishing), accs[0])
        followers_total = sum(a.followers for a in accs if a.followers is not None) if any(a.followers is not None for a in accs) else None
        account_summaries.append(
            {
                "platform": p,
                "status": primary.status,
                "account_name": primary.display_name or None,
                "username": primary.username or None,
                "followers": followers_total,
                "last_synced_at": primary.last_synced_at,
                "error": primary.error or None,
            }
        )

    cur_m = SocialPlatformDailyMetric.objects.filter(
        date__gte=start_d, date__lte=end_d, platform__in=target_platforms
    )
    prev_m = SocialPlatformDailyMetric.objects.filter(
        date__gte=prev_start_d, date__lte=prev_end_d, platform__in=target_platforms
    )

    cur_agg = cur_m.aggregate(
        follower_growth=Sum("follower_growth"),
        reach=Sum("reach"),
        impressions=Sum("impressions"),
        views=Sum("views"),
        engagement=Sum("engagement"),
    )
    prev_agg = prev_m.aggregate(
        follower_growth=Sum("follower_growth"),
        reach=Sum("reach"),
        impressions=Sum("impressions"),
        views=Sum("views"),
        engagement=Sum("engagement"),
    )

    scoped_accs = [a for a in all_accounts if a.platform in target_platforms]
    total_followers = (
        sum(a.followers for a in scoped_accs if a.followers is not None)
        if any(a.followers is not None for a in scoped_accs)
        else None
    )

    pub_cur = SocialScheduledPost.objects.filter(
        platform__in=target_platforms,
        status=PublishStatus.PUBLISHED,
        published_at__gte=start_dt,
        published_at__lte=end_dt,
    ).count()
    pub_prev = SocialScheduledPost.objects.filter(
        platform__in=target_platforms,
        status=PublishStatus.PUBLISHED,
        published_at__gte=prev_start_dt,
        published_at__lte=prev_end_dt,
    ).count()
    sched_cur = SocialScheduledPost.objects.filter(
        platform__in=target_platforms,
        status__in=[PublishStatus.APPROVED, PublishStatus.SCHEDULED, PublishStatus.QUEUED],
    ).count()
    unanswered_cur = (
        SocialInboxConversation.objects.filter(platform__in=target_platforms)
        .exclude(status__in=[ConversationStatus.RESOLVED, ConversationStatus.ARCHIVED])
        .filter(first_response_at__isnull=True)
        .count()
    )

    kpis = {
        "total_followers": total_followers,
        "follower_growth": cur_agg["follower_growth"],
        "reach": cur_agg["reach"],
        "impressions": cur_agg["impressions"],
        "views": cur_agg["views"],
        "engagement": cur_agg["engagement"],
        "published_posts": pub_cur,
        "scheduled_posts": sched_cur,
        "unanswered": unanswered_cur,
    }
    kpi_deltas = {
        "total_followers": None,
        "follower_growth": _pct_delta(cur_agg["follower_growth"], prev_agg["follower_growth"]),
        "reach": _pct_delta(cur_agg["reach"], prev_agg["reach"]),
        "impressions": _pct_delta(cur_agg["impressions"], prev_agg["impressions"]),
        "views": _pct_delta(cur_agg["views"], prev_agg["views"]),
        "engagement": _pct_delta(cur_agg["engagement"], prev_agg["engagement"]),
        "published_posts": _pct_delta(pub_cur, pub_prev),
        "scheduled_posts": None,
        "unanswered": None,
    }

    attr_qs = SocialAttributionEvent.objects.filter(
        occurred_at__gte=start_dt,
        occurred_at__lte=end_dt,
        platform__in=target_platforms,
    )
    visitors = attr_qs.filter(event_type=AttributionEventType.VISIT).count()
    product_views = attr_qs.filter(event_type=AttributionEventType.PRODUCT_VIEW).count()
    add_to_cart = attr_qs.filter(event_type=AttributionEventType.ADD_TO_CART).count()
    checkouts = attr_qs.filter(event_type=AttributionEventType.CHECKOUT).count()
    paid_orders_qs = attr_qs.filter(event_type=AttributionEventType.ORDER, is_verified_paid=True)
    orders_count = paid_orders_qs.values("order_id").distinct().count()
    rev_decimal = paid_orders_qs.aggregate(r=Sum("revenue"))["r"] or Decimal("0")
    revenue_val = float(rev_decimal)
    conv_rate = round((orders_count / visitors) * 100, 2) if visitors > 0 else None
    aov = round(revenue_val / orders_count, 2) if orders_count > 0 else None

    total_store_rev = (store_revenue_summary or {}).get("total_store_revenue")
    unattributed_orders = (store_revenue_summary or {}).get("unattributed_orders")
    unattributed_revenue = (
        max(0.0, float(total_store_rev) - revenue_val) if total_store_rev is not None else None
    )

    ecommerce = {
        "visitors": visitors,
        "product_views": product_views,
        "add_to_cart": add_to_cart,
        "checkouts": checkouts,
        "orders": orders_count,
        "revenue": revenue_val,
        "conversion_rate": conv_rate,
        "aov": aov,
        "currency": cfg.currency,
        "total_store_revenue": total_store_rev,
        "unattributed_orders": unattributed_orders,
        "unattributed_revenue": unattributed_revenue,
    }

    def _build_metric_series(field_name: str) -> list[dict[str, Any]]:
        out = []
        for p in target_platforms:
            rows = (
                cur_m.filter(platform=p)
                .values("date")
                .annotate(val=Sum(field_name))
                .order_by("date")
            )
            pts = [{"date": r["date"].isoformat(), "value": float(r["val"])} for r in rows if r["val"] is not None]
            if pts:
                out.append({"platform": p, "points": pts})
        return out

    revenue_series = []
    for p in target_platforms:
        rev_rows = (
            paid_orders_qs.filter(platform=p)
            .extra(select={"day": "DATE(occurred_at)"})
            .values("day")
            .annotate(val=Sum("revenue"))
            .order_by("day")
        )
        pts = [{"date": str(r["day"]), "value": float(r["val"] or 0)} for r in rev_rows]
        if pts:
            revenue_series.append({"platform": p, "points": pts})

    series = {
        "followers": _build_metric_series("followers"),
        "reach": _build_metric_series("reach"),
        "views": _build_metric_series("views"),
        "impressions": _build_metric_series("impressions"),
        "engagement": _build_metric_series("engagement"),
        "revenue": revenue_series,
        "funnel": {
            "visitors": visitors,
            "product_views": product_views,
            "add_to_cart": add_to_cart,
            "checkouts": checkouts,
            "orders": orders_count,
        },
    }

    comparison = []
    for p in target_platforms:
        p_accs = acc_by_plat.get(p, [])
        primary = next((a for a in p_accs if a.is_default_publishing), p_accs[0] if p_accs else None)
        p_agg = cur_m.filter(platform=p).aggregate(
            growth=Sum("follower_growth"),
            reach=Sum("reach"),
            views=Sum("views"),
            engagement=Sum("engagement"),
            link_clicks=Sum("link_clicks"),
        )
        p_visits = attr_qs.filter(platform=p, event_type=AttributionEventType.VISIT).count()
        p_orders = paid_orders_qs.filter(platform=p).values("order_id").distinct().count()
        p_rev = paid_orders_qs.filter(platform=p).aggregate(r=Sum("revenue"))["r"]
        comparison.append(
            {
                "platform": p,
                "account_name": (primary.display_name or primary.username) if primary else None,
                "followers": sum(a.followers for a in p_accs if a.followers is not None) if any(a.followers is not None for a in p_accs) else None,
                "growth": p_agg["growth"],
                "reach": p_agg["reach"] if _metric_available(p, "reach", p_accs) else None,
                "views": p_agg["views"],
                "engagement": p_agg["engagement"],
                "link_clicks": p_agg["link_clicks"],
                "website_visitors": p_visits,
                "attributed_orders": p_orders,
                "attributed_revenue": float(p_rev) if p_rev is not None else 0.0,
            }
        )

    top_posts = SocialScheduledPost.objects.filter(
        platform__in=target_platforms,
        status=PublishStatus.PUBLISHED,
        published_at__gte=start_dt,
        published_at__lte=end_dt,
    ).order_by("-views", "-published_at")[:12]

    top_content = [
        {
            "id": str(sp.id),
            "platform": sp.platform,
            "content_type": sp.content_type or None,
            "title": sp.content_title or (sp.caption[:80] if sp.caption else "Untitled"),
            "thumbnail_url": sp.thumbnail_url or None,
            "published_at": sp.published_at,
            "permalink": sp.published_url or None,
            "views": sp.views,
            "reach": sp.reach,
            "engagement": sp.total_engagement,
            "link_clicks": sp.link_clicks,
            "attributed_orders": sp.attributed_orders,
            "attributed_revenue": float(sp.attributed_revenue) if sp.attributed_revenue is not None else None,
        }
        for sp in top_posts
    ]

    activity = [
        {
            "id": str(act.id),
            "kind": act.kind,
            "title": act.title,
            "platform": act.platform or None,
            "at": act.occurred_at,
            "href": act.href or None,
            "status": act.status or None,
        }
        for act in SocialActivityLog.objects.order_by("-occurred_at")[:15]
    ]

    alerts: list[dict[str, Any]] = []
    for acc in all_accounts:
        if acc.status in (
            AccountConnectionStatus.AUTHORIZATION_EXPIRED,
            AccountConnectionStatus.PERMISSION_REQUIRED,
            AccountConnectionStatus.SYNC_FAILED,
        ):
            alerts.append(
                {
                    "id": f"acc-{acc.id}",
                    "severity": AlertSeverity.ERROR if acc.status == AccountConnectionStatus.SYNC_FAILED else AlertSeverity.WARNING,
                    "title": f"{acc.get_platform_display()} ({acc.display_name or acc.username}) needs attention",
                    "description": acc.error or f"Status: {acc.get_status_display()}",
                    "href": f"/social/accounts?account={acc.id}",
                    "action_label": "Resolve",
                }
            )
    for sp in SocialScheduledPost.objects.filter(status=PublishStatus.FAILED).order_by("-last_error_at")[:5]:
        alerts.append(
            {
                "id": f"post-{sp.id}",
                "severity": AlertSeverity.ERROR,
                "title": f"Failed post on {sp.get_platform_display()}: {sp.content_title}",
                "description": sp.failure_reason or None,
                "href": f"/social/publishing-calendar?id={sp.id}",
                "action_label": "Retry",
            }
        )
    for ca in SocialCampaignAlert.objects.filter(is_resolved=False).select_related("campaign")[:5]:
        alerts.append(
            {
                "id": f"camp-{ca.id}",
                "severity": ca.severity,
                "title": f"{ca.campaign.name}",
                "description": ca.message,
                "href": f"/social/campaigns?id={ca.campaign_id}",
                "action_label": "View campaign",
            }
        )

    synced_dates = [a.last_synced_at for a in all_accounts if a.last_synced_at]
    last_synced_at = max(synced_dates) if synced_dates else None

    return {
        "accounts": account_summaries,
        "kpis": kpis,
        "kpi_deltas": kpi_deltas,
        "ecommerce": ecommerce,
        "series": series,
        "comparison": comparison,
        "top_content": top_content,
        "activity": activity,
        "alerts": alerts,
        "last_synced_at": last_synced_at,
        "currency": cfg.currency,
    }