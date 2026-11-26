from __future__ import annotations

import csv
import io
import logging
from datetime import timedelta
from decimal import Decimal

import requests
from celery import shared_task
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from .models import (
    AccountConnectionStatus,
    AlertSeverity,
    AttributionEventType,
    CampaignStatus,
    CampaignType,
    ConversationStatus,
    InteractionType,
    MessageDirection,
    NotificationType,
    PublishStatus,
    QueueSlotKind,
    ReportFormat,
    Sentiment,
    SocialAccount,
    SocialAttributionEvent,
    SocialBestTimePost,
    SocialCampaign,
    SocialCampaignContent,
    SocialCampaignProduct,
    SocialDemographicSnapshot,
    SocialEngagementSnapshot,
    SocialEvergreenPost,
    SocialFollowerSnapshot,
    SocialInboxConversation,
    SocialInboxMessage,
    SocialNotification,
    SocialOAuthState,
    SocialPlatform,
    SocialPlatformDailyMetric,
    SocialQueueSlot,
    SocialReport,
    SocialScheduledPost,
    SocialScheduledPostHistory,
)
from .services import (
    SocialServiceError,
    _default_account_for_platform,
    _refresh_account_token,
    build_analytics_report,
    create_notification,
    evaluate_campaign_alerts,
    log_audit,
    publish_scheduled_post_now,
    sync_social_account,
)

logger = logging.getLogger("social.tasks")

METRICS_STALE_MINUTES = 55
METRICS_BATCH_LIMIT = 500
TOKEN_REFRESH_WINDOW = timedelta(hours=24)
TOKEN_EXPIRY_WARN = timedelta(days=3)
INBOX_SYNC_LOOKBACK = timedelta(hours=6)

_POSITIVE_TOKENS = {"love", "great", "thanks", "thank", "awesome", "amazing", "best", "good", "nice"}
_NEGATIVE_TOKENS = {"bad", "terrible", "refund", "broken", "worst", "scam", "angry", "fake", "late"}


def _guess_sentiment(text: str) -> str:
    low = (text or "").lower()
    pos = any(tok in low for tok in _POSITIVE_TOKENS)
    neg = any(tok in low for tok in _NEGATIVE_TOKENS)
    if pos and not neg:
        return Sentiment.POSITIVE
    if neg and not pos:
        return Sentiment.NEGATIVE
    return Sentiment.NEUTRAL


@shared_task(
    name="social.tasks.publish_post",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def publish_post(self, post_id: int | str):
    post = SocialScheduledPost.objects.filter(pk=post_id).first()
    if not post:
        logger.warning("publish_post: scheduled post %s not found", post_id)
        return
    if post.status == PublishStatus.PUBLISHED:
        return

    if post.is_manual_reminder:
        create_notification(
            NotificationType.APPROVAL_NEEDED,
            f"Manual publishing reminder: {post.content_title or 'Post'}",
            message=f"Scheduled for {post.get_platform_display()} ({post.account.display_name or post.account.username}).",
            severity=AlertSeverity.INFO,
            link=f"/social/publishing-calendar?id={post.id}",
            action_label="Open",
            recipient=post.owner,
        )
        post.status = PublishStatus.EXPIRED
        post.save(update_fields=["status", "updated_at"])
        SocialScheduledPostHistory.objects.create(
            scheduled_post=post,
            status=PublishStatus.EXPIRED,
            message="Manual reminder triggered.",
        )
        return

    try:
        publish_scheduled_post_now(str(post_id), is_retry=False)
    except SocialServiceError as exc:
        logger.warning("publish_post: post %s service error: %s", post_id, exc.message)
    except Exception as exc:
        logger.exception("publish_post: unexpected error for post %s", post_id)
        raise self.retry(exc=exc, countdown=60)


@shared_task(name="social.tasks.dispatch_scheduled_posts")
def dispatch_scheduled_posts():
    now = timezone.now()

    due_ids = list(
        SocialScheduledPost.objects.filter(
            status__in=[PublishStatus.APPROVED, PublishStatus.SCHEDULED, PublishStatus.QUEUED],
            scheduled_at__lte=now,
        )
        .order_by("scheduled_at")
        .values_list("pk", flat=True)
    )
    for pk in due_ids:
        publish_post.delay(pk)

    stuck_before = now - timedelta(minutes=15)
    stuck_posts = SocialScheduledPost.objects.filter(
        status=PublishStatus.PUBLISHING,
        updated_at__lt=stuck_before,
    )
    stuck_ids = list(stuck_posts.values_list("pk", flat=True))
    if stuck_ids:
        stuck_posts.update(status=PublishStatus.QUEUED, updated_at=now)
        for pk in stuck_ids:
            logger.warning("dispatch_scheduled_posts: rescuing stuck post %s", pk)
            publish_post.delay(pk)

    return len(due_ids) + len(stuck_ids)


@shared_task(name="social.tasks.fill_evergreen_queue")
def fill_evergreen_queue():
    now = timezone.now()
    upcoming_window = now + timedelta(hours=24)

    slots = SocialQueueSlot.objects.filter(
        is_active=True,
        kind=QueueSlotKind.EVERGREEN,
    )
    if not slots.exists():
        return 0

    evergreen_pool = list(
        SocialEvergreenPost.objects.filter(is_active=True)
        .select_related("content")
        .order_by("last_used_at", "created_at")[:20]
    )
    if not evergreen_pool:
        return 0

    created = 0
    day_lookup = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}

    for slot in slots:
        slot_platforms = slot.platforms or []
        current = now
        while current <= upcoming_window:
            day_key = day_lookup.get(current.weekday(), "")
            if day_key not in (slot.days or []):
                current += timedelta(days=1)
                continue

            slot_time = slot.time_of_day
            candidate = current.replace(
                hour=slot_time.hour,
                minute=slot_time.minute,
                second=0,
                microsecond=0,
            )
            if candidate <= now:
                current += timedelta(days=1)
                continue

            already = SocialScheduledPost.objects.filter(
                status__in=[PublishStatus.SCHEDULED, PublishStatus.QUEUED, PublishStatus.APPROVED],
                scheduled_at__gte=candidate - timedelta(minutes=30),
                scheduled_at__lte=candidate + timedelta(minutes=30),
            ).exists()
            if already:
                current += timedelta(days=1)
                continue

            evergreen = evergreen_pool[created % len(evergreen_pool)]
            platforms = slot_platforms or evergreen.platforms or []
            if not platforms:
                current += timedelta(days=1)
                continue

            with transaction.atomic():
                created_any = False
                for p in platforms:
                    code = str(p).lower()
                    account = _default_account_for_platform(code)
                    if not account:
                        continue
                    sp = SocialScheduledPost.objects.create(
                        content=evergreen.content,
                        content_title=(evergreen.content.title if evergreen.content else evergreen.caption[:60]) or "Evergreen post",
                        caption=evergreen.caption,
                        content_type=(evergreen.content.content_type if evergreen.content else ""),
                        platform=code,
                        account=account,
                        scheduled_at=candidate,
                        timezone=slot.timezone,
                        status=PublishStatus.SCHEDULED,
                    )
                    SocialScheduledPostHistory.objects.create(
                        scheduled_post=sp,
                        status=PublishStatus.SCHEDULED,
                        message="Scheduled by evergreen queue.",
                    )
                    created_any = True

                if created_any:
                    evergreen.last_used_at = timezone.now()
                    evergreen.use_count = (evergreen.use_count or 0) + 1
                    evergreen.save(update_fields=["last_used_at", "use_count"])
                    created += 1

            current += timedelta(days=1)

    return created


def _fetch_post_metrics_from_platform(post: SocialScheduledPost) -> dict[str, int] | None:
    account = post.account
    if not account or not account.access_token or not post.published_post_id:
        return None
    if account.is_token_expired:
        _refresh_account_token(account)

    if post.platform == SocialPlatform.FACEBOOK.value:
        res = requests.get(
            f"https://graph.facebook.com/v20.0/{post.published_post_id}",
            params={
                "fields": "likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_impressions_unique,post_clicks)",
                "access_token": account.access_token,
            },
            timeout=20,
        )
        res.raise_for_status()
        data = res.json()
        likes = ((data.get("likes") or {}).get("summary") or {}).get("total_count", 0)
        comments = ((data.get("comments") or {}).get("summary") or {}).get("total_count", 0)
        shares = (data.get("shares") or {}).get("count", 0)
        reach = 0
        impressions = 0
        clicks = 0
        for ins in (data.get("insights") or {}).get("data") or []:
            name = ins.get("name")
            val = ((ins.get("values") or [{}])[0]).get("value") or 0
            if name == "post_impressions":
                impressions = int(val)
            elif name == "post_impressions_unique":
                reach = int(val)
            elif name == "post_clicks":
                clicks = int(val)
        return {
            "likes": int(likes),
            "comments": int(comments),
            "shares": int(shares),
            "reach": reach,
            "impressions": impressions,
            "link_clicks": clicks,
        }

    if post.platform == SocialPlatform.INSTAGRAM.value:
        res = requests.get(
            f"https://graph.facebook.com/v20.0/{post.published_post_id}",
            params={
                "fields": "like_count,comments_count,insights.metric(reach,impressions,saved,shares)",
                "access_token": account.access_token,
            },
            timeout=20,
        )
        res.raise_for_status()
        data = res.json()
        reach = 0
        impressions = 0
        saves = 0
        shares = 0
        for ins in (data.get("insights") or {}).get("data") or []:
            name = ins.get("name")
            val = ((ins.get("values") or [{}])[0]).get("value") or 0
            if name == "reach":
                reach = int(val)
            elif name == "impressions":
                impressions = int(val)
            elif name == "saved":
                saves = int(val)
            elif name == "shares":
                shares = int(val)
        return {
            "likes": int(data.get("like_count") or 0),
            "comments": int(data.get("comments_count") or 0),
            "shares": shares,
            "saves": saves,
            "reach": reach,
            "impressions": impressions,
        }

    if post.platform == SocialPlatform.YOUTUBE.value:
        res = requests.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "statistics", "id": post.published_post_id},
            headers={"Authorization": f"Bearer {account.access_token}"},
            timeout=20,
        )
        res.raise_for_status()
        items = res.json().get("items") or []
        if not items:
            return None
        stats = items[0].get("statistics") or {}
        return {
            "views": int(stats.get("viewCount") or 0),
            "likes": int(stats.get("likeCount") or 0),
            "comments": int(stats.get("commentCount") or 0),
        }

    if post.platform == SocialPlatform.TIKTOK.value:
        res = requests.post(
            "https://open.tiktokapis.com/v2/video/query/",
            params={"fields": "id,like_count,comment_count,share_count,view_count"},
            headers={"Authorization": f"Bearer {account.access_token}", "Content-Type": "application/json"},
            json={"filters": {"video_ids": [post.published_post_id]}},
            timeout=20,
        )
        res.raise_for_status()
        videos = (res.json().get("data") or {}).get("videos") or []
        if not videos:
            return None
        v = videos[0]
        return {
            "views": int(v.get("view_count") or 0),
            "likes": int(v.get("like_count") or 0),
            "comments": int(v.get("comment_count") or 0),
            "shares": int(v.get("share_count") or 0),
        }

    return None


@shared_task(name="social.tasks.sync_all_metrics")
def sync_all_metrics():
    now = timezone.now()
    stale_before = now - timedelta(minutes=METRICS_STALE_MINUTES)
    today = timezone.localdate(now)

    posts = (
        SocialScheduledPost.objects.select_related("account")
        .filter(
            status=PublishStatus.PUBLISHED,
            account__status=AccountConnectionStatus.CONNECTED,
        )
        .exclude(published_post_id="")
        .filter(Q(metrics_synced_at__isnull=True) | Q(metrics_synced_at__lt=stale_before))
        .order_by("metrics_synced_at")[:METRICS_BATCH_LIMIT]
    )

    total_synced = 0
    for post in posts:
        try:
            metrics = _fetch_post_metrics_from_platform(post)
        except Exception as exc:
            logger.warning("sync_all_metrics: post %s failed: %s", post.id, exc)
            continue
        if not metrics:
            continue

        update_fields = ["metrics_synced_at", "updated_at"]
        for field in (
            "likes",
            "comments",
            "shares",
            "saves",
            "reach",
            "impressions",
            "views",
            "watch_time_sec",
            "link_clicks",
            "profile_visits",
            "follower_delta",
        ):
            if field in metrics:
                setattr(post, field, metrics[field])
                update_fields.append(field)
        post.metrics_synced_at = now
        post.save(update_fields=update_fields)
        total_synced += 1

    for account in SocialAccount.objects.filter(status=AccountConnectionStatus.CONNECTED):
        day_posts = SocialScheduledPost.objects.filter(
            account=account,
            status=PublishStatus.PUBLISHED,
            published_at__date=today,
        )
        agg = day_posts.aggregate(
            reach=Sum("reach"),
            impressions=Sum("impressions"),
            views=Sum("views"),
            likes=Sum("likes"),
            comments=Sum("comments"),
            shares=Sum("shares"),
            saves=Sum("saves"),
            link_clicks=Sum("link_clicks"),
            profile_visits=Sum("profile_visits"),
            published_content=Count("id"),
        )
        eng = sum(
            v for v in (agg["likes"], agg["comments"], agg["shares"], agg["saves"]) if v is not None
        ) if any(agg[k] is not None for k in ("likes", "comments", "shares", "saves")) else None
        reach_v = agg["reach"]
        er = round((eng / reach_v) * 100, 2) if eng is not None and reach_v else None

        SocialPlatformDailyMetric.objects.update_or_create(
            account=account,
            date=today,
            defaults={
                "platform": account.platform,
                "followers": account.followers,
                "reach": reach_v,
                "impressions": agg["impressions"],
                "views": agg["views"],
                "engagement": eng,
                "engagement_rate": er,
                "link_clicks": agg["link_clicks"],
                "profile_visits": agg["profile_visits"],
                "published_content": agg["published_content"],
            },
        )

    return total_synced


@shared_task(name="social.tasks.sync_all_accounts")
def sync_all_accounts():
    synced = 0
    for account in SocialAccount.objects.filter(
        status__in=[AccountConnectionStatus.CONNECTED, AccountConnectionStatus.SYNC_FAILED]
    ):
        try:
            sync_social_account(str(account.id))
            synced += 1
        except SocialServiceError as exc:
            logger.warning("sync_all_accounts: account %s failed: %s", account.id, exc.message)
        except Exception:
            logger.exception("sync_all_accounts: unexpected error for %s", account.id)
    return synced


@shared_task(name="social.tasks.sync_all_campaigns")
def sync_all_campaigns():
    today = timezone.localdate()
    updated = 0

    for campaign in SocialCampaign.objects.prefetch_related("campaign_contents", "campaign_products").all():
        changed_status = False
        if campaign.status == CampaignStatus.SCHEDULED and campaign.start_date <= today <= campaign.end_date:
            campaign.status = CampaignStatus.ACTIVE
            changed_status = True
        elif campaign.status == CampaignStatus.ACTIVE and campaign.end_date < today:
            campaign.status = CampaignStatus.COMPLETED
            changed_status = True

        posts_qs = SocialScheduledPost.objects.filter(campaign=campaign, status=PublishStatus.PUBLISHED)
        post_agg = posts_qs.aggregate(
            reach=Sum("reach"),
            impressions=Sum("impressions"),
            views=Sum("views"),
            likes=Sum("likes"),
            comments=Sum("comments"),
            shares=Sum("shares"),
            saves=Sum("saves"),
            link_clicks=Sum("link_clicks"),
        )
        eng_parts = [post_agg["likes"], post_agg["comments"], post_agg["shares"], post_agg["saves"]]
        engagement = sum(v for v in eng_parts if v is not None) if any(v is not None for v in eng_parts) else None

        attr_qs = SocialAttributionEvent.objects.filter(campaign=campaign)
        visits = attr_qs.filter(event_type=AttributionEventType.VISIT).count()
        add_to_cart = attr_qs.filter(event_type=AttributionEventType.ADD_TO_CART).count()
        paid_orders_qs = attr_qs.filter(event_type=AttributionEventType.ORDER, is_verified_paid=True)
        orders_cnt = paid_orders_qs.values("order_id").distinct().count()
        rev_dec = paid_orders_qs.aggregate(r=Sum("revenue"))["r"]

        campaign.reach = post_agg["reach"]
        campaign.impressions = post_agg["impressions"]
        campaign.views = post_agg["views"]
        campaign.engagement = engagement
        campaign.link_clicks = post_agg["link_clicks"]
        campaign.website_visits = visits if attr_qs.exists() else campaign.website_visits
        campaign.add_to_cart = add_to_cart if attr_qs.exists() else campaign.add_to_cart
        if attr_qs.exists():
            campaign.orders = orders_cnt
            campaign.attributed_orders = orders_cnt
            campaign.attributed_revenue = rev_dec if rev_dec is not None else Decimal("0.00")

        spend = campaign.actual_spend
        rev = campaign.attributed_revenue
        if spend is not None and spend > 0 and rev is not None:
            campaign.roas = round(float(rev) / float(spend), 2)
        else:
            campaign.roas = None

        total_costs = sum(
            float(x) for x in (campaign.actual_spend, campaign.advertising_cost, campaign.creator_commission) if x is not None
        )
        if rev is not None and (
            campaign.actual_spend is not None
            or campaign.advertising_cost is not None
            or campaign.creator_commission is not None
        ):
            campaign.profitability = Decimal(str(round(float(rev) - total_costs, 2)))
            campaign.profitability_valid = True
        else:
            campaign.profitability = None
            campaign.profitability_valid = False

        campaign.last_synced_at = timezone.now()
        campaign.save()

        for cc in campaign.campaign_contents.select_related("content"):
            c_posts = SocialScheduledPost.objects.filter(content=cc.content, campaign=campaign)
            c_agg = c_posts.aggregate(
                reach=Sum("reach"),
                impressions=Sum("impressions"),
                views=Sum("views"),
                likes=Sum("likes"),
                comments=Sum("comments"),
                shares=Sum("shares"),
                saves=Sum("saves"),
                clicks=Sum("link_clicks"),
            )
            c_eng_parts = [c_agg["likes"], c_agg["comments"], c_agg["shares"], c_agg["saves"]]
            cc.reach = c_agg["reach"]
            cc.impressions = c_agg["impressions"]
            cc.views = c_agg["views"]
            cc.engagement = sum(v for v in c_eng_parts if v is not None) if any(v is not None for v in c_eng_parts) else None
            cc.clicks = c_agg["clicks"]
            latest_post = c_posts.order_by("-scheduled_at").first()
            cc.publication_status = latest_post.status if latest_post else cc.content.status
            cc.save()

        for cp in campaign.campaign_products.all():
            p_orders = paid_orders_qs.filter(product_id=cp.product_id)
            if p_orders.exists():
                p_agg = p_orders.aggregate(
                    orders=Count("order_id", distinct=True),
                    units=Sum("units"),
                    rev=Sum("revenue"),
                )
                cp.orders = p_agg["orders"] or 0
                cp.units_sold = p_agg["units"] or 0
                cp.revenue = p_agg["rev"] or Decimal("0.00")
                cp.save()

        evaluate_campaign_alerts(campaign)
        if changed_status:
            log_audit(None, f"campaign_auto_{campaign.status}", "SocialCampaign", str(campaign.id))
        updated += 1

    return updated


def _upsert_inbox_message(
    *,
    account: SocialAccount,
    interaction_type: str,
    platform_conversation_id: str,
    platform_message_id: str,
    customer_name: str,
    customer_username: str,
    customer_avatar: str,
    body: str,
    related_title: str = "",
    related_url: str = "",
    occurred_at=None,
) -> bool:
    if not platform_conversation_id:
        return False

    occurred_at = occurred_at or timezone.now()
    conv, created = SocialInboxConversation.objects.get_or_create(
        platform=account.platform,
        type=interaction_type,
        platform_conversation_id=platform_conversation_id,
        defaults={
            "account": account,
            "status": ConversationStatus.UNREAD,
            "sentiment": _guess_sentiment(body),
            "customer_display_name": customer_name or customer_username or "Unknown",
            "customer_username": customer_username or "",
            "customer_avatar_url": customer_avatar or "",
            "preview": body[:500],
            "related_post_title": related_title[:255],
            "related_post_url": related_url[:500],
            "last_interaction_at": occurred_at,
            "unread": True,
            "can_reply": account.supports_reply,
            "can_react": account.supports_react,
            "can_hide": account.supports_hide,
            "can_moderate": account.supports_moderation,
            "can_archive": True,
            "can_assign": True,
            "platform_capability_note": account.inbox_capability_note,
        },
    )

    if platform_message_id and SocialInboxMessage.objects.filter(
        conversation=conv, platform_message_id=platform_message_id
    ).exists():
        return False

    SocialInboxMessage.objects.create(
        conversation=conv,
        direction=MessageDirection.INBOUND,
        body=body,
        author_name=customer_name or customer_username,
        platform_message_id=platform_message_id,
        created_at=occurred_at,
    )

    if not created:
        conv.preview = body[:500]
        conv.last_interaction_at = occurred_at
        conv.unread = True
        if conv.status in (ConversationStatus.READ, ConversationStatus.RESOLVED):
            conv.status = ConversationStatus.UNREAD
        conv.sentiment = _guess_sentiment(body)
        conv.save(update_fields=["preview", "last_interaction_at", "unread", "status", "sentiment", "updated_at"])

    ntype = (
        NotificationType.NEW_DM
        if interaction_type == InteractionType.DM
        else NotificationType.NEW_MENTION
        if interaction_type == InteractionType.MENTION
        else NotificationType.NEW_COMMENT
    )
    create_notification(
        ntype,
        f"New {interaction_type} on {account.get_platform_display()}",
        message=body[:200],
        link=f"/social/inbox-community",
        action_label="Reply",
    )
    return True


@shared_task(name="social.tasks.sync_inbox")
def sync_inbox():
    ingested = 0
    for account in SocialAccount.objects.filter(status=AccountConnectionStatus.CONNECTED):
        if not account.access_token:
            continue
        if account.is_token_expired:
            try:
                _refresh_account_token(account)
            except SocialServiceError:
                continue

        try:
            if account.platform == SocialPlatform.YOUTUBE.value and account.account_id:
                res = requests.get(
                    "https://www.googleapis.com/youtube/v3/commentThreads",
                    params={
                        "part": "snippet",
                        "allThreadsRelatedToChannelId": account.account_id,
                        "maxResults": 25,
                    },
                    headers={"Authorization": f"Bearer {account.access_token}"},
                    timeout=20,
                )
                res.raise_for_status()
                for item in res.json().get("items") or []:
                    top = ((item.get("snippet") or {}).get("topLevelComment") or {})
                    sn = top.get("snippet") or {}
                    added = _upsert_inbox_message(
                        account=account,
                        interaction_type=InteractionType.COMMENT,
                        platform_conversation_id=str(item.get("id") or top.get("id") or ""),
                        platform_message_id=str(top.get("id") or ""),
                        customer_name=sn.get("authorDisplayName", ""),
                        customer_username="",
                        customer_avatar=sn.get("authorProfileImageUrl", ""),
                        body=sn.get("textDisplay", "") or sn.get("textOriginal", ""),
                    )
                    if added:
                        ingested += 1

            elif account.platform == SocialPlatform.FACEBOOK.value and account.account_id:
                res = requests.get(
                    f"https://graph.facebook.com/v20.0/{account.account_id}/conversations",
                    params={
                        "fields": "id,updated_time,messages.limit(5){id,message,from,created_time}",
                        "access_token": account.access_token,
                    },
                    timeout=20,
                )
                res.raise_for_status()
                for conv_data in res.json().get("data") or []:
                    msgs = (conv_data.get("messages") or {}).get("data") or []
                    for msg in reversed(msgs):
                        sender = msg.get("from") or {}
                        if str(sender.get("id") or "") == str(account.account_id):
                            continue
                        added = _upsert_inbox_message(
                            account=account,
                            interaction_type=InteractionType.DM,
                            platform_conversation_id=str(sender.get("id") or conv_data.get("id") or ""),
                            platform_message_id=str(msg.get("id") or ""),
                            customer_name=sender.get("name", ""),
                            customer_username="",
                            customer_avatar="",
                            body=msg.get("message", ""),
                        )
                        if added:
                            ingested += 1

            elif account.platform == SocialPlatform.INSTAGRAM.value and account.account_id:
                res = requests.get(
                    f"https://graph.facebook.com/v20.0/{account.account_id}/media",
                    params={
                        "fields": "id,caption,permalink,comments.limit(10){id,text,username,timestamp}",
                        "access_token": account.access_token,
                    },
                    timeout=20,
                )
                res.raise_for_status()
                for media_item in res.json().get("data") or []:
                    for c in (media_item.get("comments") or {}).get("data") or []:
                        added = _upsert_inbox_message(
                            account=account,
                            interaction_type=InteractionType.COMMENT,
                            platform_conversation_id=str(c.get("id") or ""),
                            platform_message_id=str(c.get("id") or ""),
                            customer_name=c.get("username", ""),
                            customer_username=c.get("username", ""),
                            customer_avatar="",
                            body=c.get("text", ""),
                            related_title=(media_item.get("caption") or "")[:120],
                            related_url=media_item.get("permalink", ""),
                        )
                        if added:
                            ingested += 1
        except Exception as exc:
            logger.warning("sync_inbox: %s (%s) failed: %s", account.platform, account.id, exc)
            continue

    return ingested


@shared_task(name="social.tasks.snapshot_followers")
def snapshot_followers():
    today = timezone.localdate()
    written = 0
    for account in SocialAccount.objects.filter(status=AccountConnectionStatus.CONNECTED):
        try:
            sync_social_account(str(account.id))
            if SocialFollowerSnapshot.objects.filter(account=account, date=today).exists():
                written += 1
        except Exception as exc:
            logger.warning("snapshot_followers: account %s failed: %s", account.id, exc)
    return written


@shared_task(name="social.tasks.snapshot_engagement")
def snapshot_engagement():
    totals = (
        SocialScheduledPost.objects.filter(status=PublishStatus.PUBLISHED)
        .values("platform")
        .annotate(
            total_reach=Sum("reach"),
            total_likes=Sum("likes"),
            total_comments=Sum("comments"),
            total_shares=Sum("shares"),
            total_saves=Sum("saves"),
        )
    )
    written = 0
    for row in totals:
        engagement = (
            (row["total_likes"] or 0)
            + (row["total_comments"] or 0)
            + (row["total_shares"] or 0)
            + (row["total_saves"] or 0)
        )
        SocialEngagementSnapshot.objects.update_or_create(
            platform=row["platform"],
            defaults={
                "reach": row["total_reach"] or 0,
                "engagement": engagement,
            },
        )
        written += 1
    return written


@shared_task(name="social.tasks.snapshot_demographics")
def snapshot_demographics():
    today = timezone.localdate()
    written = 0
    for account in SocialAccount.objects.filter(
        status=AccountConnectionStatus.CONNECTED,
        platform=SocialPlatform.INSTAGRAM.value,
    ):
        if not account.access_token or not account.account_id:
            continue
        if account.is_token_expired:
            try:
                _refresh_account_token(account)
            except SocialServiceError:
                continue
        try:
            res = requests.get(
                f"https://graph.facebook.com/v20.0/{account.account_id}/insights",
                params={
                    "metric": "follower_demographics",
                    "period": "lifetime",
                    "metric_type": "total_value",
                    "breakdown": "age,gender,country,city",
                    "access_token": account.access_token,
                },
                timeout=20,
            )
            if not res.ok:
                continue
            payload = res.json()
            SocialDemographicSnapshot.objects.update_or_create(
                platform=account.platform,
                date=today,
                defaults={"age_buckets": {"raw": payload.get("data") or []}},
            )
            written += 1
        except Exception as exc:
            logger.warning("snapshot_demographics: %s failed: %s", account.id, exc)
    return written


@shared_task(name="social.tasks.snapshot_best_times")
def snapshot_best_times():
    buckets: dict[tuple[str, int, int], list[float]] = {}
    posts = SocialScheduledPost.objects.filter(
        status=PublishStatus.PUBLISHED,
        published_at__isnull=False,
    ).only("platform", "published_at", "likes", "comments", "shares", "saves", "reach", "views")

    for post in posts:
        eng = post.total_engagement or 0
        denom = post.reach or post.views or 1
        score = round((eng / max(1, denom)) * 100.0, 2)
        local_dt = timezone.localtime(post.published_at)
        key = (post.platform, local_dt.weekday(), local_dt.hour)
        buckets.setdefault(key, []).append(score)

    written = 0
    for (platform, dow, hour), scores in buckets.items():
        SocialBestTimePost.objects.update_or_create(
            platform=platform,
            day_of_week=dow,
            hour=hour,
            defaults={
                "score": round(sum(scores) / len(scores), 2),
                "sample_size": len(scores),
            },
        )
        written += 1
    return written


@shared_task(name="social.tasks.refresh_expiring_tokens")
def refresh_expiring_tokens():
    now = timezone.now()
    soon = now + TOKEN_REFRESH_WINDOW
    accounts = SocialAccount.objects.filter(
        status=AccountConnectionStatus.CONNECTED,
        token_expires_at__isnull=False,
        token_expires_at__lte=soon,
    )
    refreshed = 0
    failed = 0
    for account in accounts:
        try:
            _refresh_account_token(account)
            refreshed += 1
        except SocialServiceError as exc:
            failed += 1
            create_notification(
                NotificationType.TOKEN_EXPIRED,
                f"{account.get_platform_display()} token expired",
                message=exc.message,
                severity=AlertSeverity.ERROR,
                link=f"/social/accounts?account={account.id}",
                action_label="Reauthorize",
            )
    return {"refreshed": refreshed, "failed": failed}


@shared_task(name="social.tasks.check_token_expiry")
def check_token_expiry():
    now = timezone.now()
    warn_before = now + TOKEN_EXPIRY_WARN
    warned = 0
    for account in SocialAccount.objects.filter(
        status=AccountConnectionStatus.CONNECTED,
        token_expires_at__isnull=False,
        token_expires_at__lte=warn_before,
    ):
        link = f"/social/accounts?account={account.id}"
        recent = SocialNotification.objects.filter(
            notification_type=NotificationType.TOKEN_EXPIRING,
            link=link,
            created_at__gte=now - timedelta(hours=24),
        ).exists()
        if recent:
            continue
        create_notification(
            NotificationType.TOKEN_EXPIRING,
            f"{account.get_platform_display()} authorization expiring soon",
            message=f"Expires at {account.token_expires_at.isoformat()}.",
            severity=AlertSeverity.WARNING,
            link=link,
            action_label="Reauthorize",
        )
        warned += 1
    return warned


@shared_task(name="social.tasks.generate_report", bind=True, max_retries=2)
def generate_report(self, report_id: int):
    report = SocialReport.objects.filter(pk=report_id).first()
    if not report:
        return None

    try:
        payload = build_analytics_report(
            {
                "range": "custom",
                "start": report.date_from.isoformat(),
                "end": report.date_to.isoformat(),
                "platform": report.platforms[0] if len(report.platforms or []) == 1 else None,
            }
        )
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Platform", "Followers", "Reach", "Impressions", "Views", "Engagement", "Link clicks", "Published"])
        for row in payload.get("platform_summaries", []):
            writer.writerow(
                [
                    row["platform"],
                    row["followers"]["value"],
                    row["reach"]["value"],
                    row["impressions"]["value"],
                    row["views"]["value"],
                    row["engagement"]["value"],
                    row["link_clicks"]["value"],
                    row["published_content"]["value"],
                ]
            )
        ext = "csv" if report.format == ReportFormat.CSV else report.format
        filename = f"social-report-{report.id}.{ext}"
        report.file.save(filename, ContentFile(buf.getvalue().encode("utf-8")), save=False)
        report.generated_at = timezone.now()
        report.save(update_fields=["file", "generated_at"])
    except Exception as exc:
        logger.exception("generate_report: failed for report %s", report_id)
        raise self.retry(exc=exc, countdown=60)

    create_notification(
        NotificationType.REPORT_READY,
        f"Report ready: {report.name}",
        link="/social/analytics",
        recipient=report.created_by,
    )
    log_audit(report.created_by, "report_generated", "SocialReport", str(report.id))
    return report.id


@shared_task(name="social.tasks.cleanup_stale_inbox_items")
def cleanup_stale_inbox_items():
    cutoff = timezone.now() - timedelta(days=30)
    resolved_count = SocialInboxConversation.objects.filter(
        status__in=[ConversationStatus.UNREAD, ConversationStatus.READ, ConversationStatus.PENDING],
        last_interaction_at__lt=cutoff,
    ).update(status=ConversationStatus.RESOLVED, unread=False, resolved_at=timezone.now())

    deleted_oauth, _ = SocialOAuthState.objects.filter(expires_at__lt=timezone.now()).delete()
    return {"resolved_conversations": resolved_count, "deleted_oauth_states": deleted_oauth}