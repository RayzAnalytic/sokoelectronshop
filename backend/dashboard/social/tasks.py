from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from .models import (
    DraftStatus,
    InboxItemStatus,
    InboxItemType,
    NotificationType,
    PostStatus,
    QueueSlotKind,
    Sentiment,
    SocialAccount,
    SocialAuditLog,
    SocialBestTimePost,
    SocialDemographicSnapshot,
    SocialEngagementSnapshot,
    SocialEvergreenPost,
    SocialFollowerSnapshot,
    SocialInboxItem,
    SocialNotification,
    SocialPost,
    SocialPostTarget,
    SocialQueueSlot,
    SocialReport,
    TargetStatus,
)
from .services import get_client
from .services.base import (
    PlatformError,
    QuotaExceededError,
    RateLimitError,
    TokenExpiredError,
    UnsupportedOperationError,
)

logger = logging.getLogger("social.tasks")


METRICS_STALE_MINUTES = 55
METRICS_BATCH_LIMIT   = 500
TOKEN_REFRESH_WINDOW  = timedelta(hours=24)
TOKEN_EXPIRY_WARN     = timedelta(days=3)
ERROR_TRUNCATE        = 1_000
INBOX_SYNC_LOOKBACK   = timedelta(hours=6)
INBOX_BATCH_LIMIT     = 300


def _resolve_connected_account(platform: str) -> SocialAccount | None:
    platform_db = platform.upper()
    try:
        return SocialAccount.objects.get(platform=platform_db, is_connected=True)
    except SocialAccount.DoesNotExist:
        return None


def _notify(
    notification_type: str,
    title: str,
    message: str = "",
    link: str = "",
    recipient=None,
):
    try:
        SocialNotification.objects.create(
            notification_type=notification_type,
            title=title[:255],
            message=message[:2000],
            link=link[:512],
            recipient=recipient,
        )
    except Exception:
        logger.exception("failed to create notification: %s", title)


def _audit(actor, action: str, target_type: str = "", target_id: str = "", details: dict | None = None):
    try:
        SocialAuditLog.objects.create(
            actor=actor,
            action=action[:64],
            target_type=target_type[:64],
            target_id=str(target_id)[:64],
            details=details or {},
        )
    except Exception:
        logger.exception("failed to write audit log: %s", action)


@shared_task(
    name="social.tasks.publish_post",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def publish_post(self, post_id: int):
    try:
        post = (
            SocialPost.objects
            .prefetch_related("media", "targets")
            .get(pk=post_id)
        )
    except SocialPost.DoesNotExist:
        logger.warning("publish_post: post %s no longer exists", post_id)
        return

    if post.status in (PostStatus.PUBLISHED, PostStatus.PARTIAL):
        logger.info("publish_post: post %s already %s — skipping", post_id, post.status)
        return

    updated = (
        SocialPost.objects
        .filter(pk=post_id)
        .exclude(status__in=[PostStatus.PUBLISHING, PostStatus.PUBLISHED, PostStatus.PARTIAL])
        .update(status=PostStatus.PUBLISHING, updated_at=timezone.now())
    )
    if not updated:
        logger.info("publish_post: post %s is already being published", post_id)
        return

    media_paths = [
        m.file.path
        for m in post.media.all().order_by("sort_order", "id")
        if m.file
    ]

    any_success = False
    any_failure = False
    failed_platforms: list[str] = []
    succeeded_platforms: list[str] = []

    for target in post.targets.all():
        if target.status == TargetStatus.PUBLISHED:
            any_success = True
            succeeded_platforms.append(target.platform)
            continue

        with transaction.atomic():
            t = (
                SocialPostTarget.objects
                .select_for_update()
                .get(pk=target.pk)
            )
            if t.status == TargetStatus.PUBLISHED:
                any_success = True
                succeeded_platforms.append(t.platform)
                continue

            account = _resolve_connected_account(t.platform)
            if account is None:
                t.status = TargetStatus.FAILED
                t.error_message = f"{t.platform} account is not connected."
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                failed_platforms.append(t.platform)
                continue

            try:
                client = get_client(account)
                result = client.publish(
                    caption=post.caption,
                    media_paths=media_paths,
                    product_tag=post.product_tag,
                    first_comment=post.first_comment or "",
                    options=(post.metadata or {}).get("platform_options", {}).get(t.platform, {}) if hasattr(post, "metadata") else {},
                )
            except QuotaExceededError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Quota: {exc}"[:ERROR_TRUNCATE]
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                failed_platforms.append(t.platform)
                _notify(
                    NotificationType.POST_FAILED,
                    f"{t.platform} publish failed — quota exceeded",
                    f"Post #{post_id}: {exc}",
                    link=f"/social/published?post={post_id}",
                )
                continue
            except TokenExpiredError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Token: {exc}"[:ERROR_TRUNCATE]
                t.save(update_fields=["status", "error_message"])
                account.last_error = f"Token expired during publish: {exc}"[:ERROR_TRUNCATE]
                account.save(update_fields=["last_error", "updated_at"])
                any_failure = True
                failed_platforms.append(t.platform)
                _notify(
                    NotificationType.TOKEN_EXPIRED,
                    f"{t.platform} token expired",
                    f"Reconnect the {t.platform} account to continue publishing.",
                    link=f"/social/accounts?platform={t.platform}",
                )
                continue
            except RateLimitError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Rate limit: {exc}"[:ERROR_TRUNCATE]
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                failed_platforms.append(t.platform)
                continue
            except UnsupportedOperationError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Unsupported: {exc}"[:ERROR_TRUNCATE]
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                failed_platforms.append(t.platform)
                continue
            except PlatformError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = str(exc)[:ERROR_TRUNCATE]
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                failed_platforms.append(t.platform)
                _notify(
                    NotificationType.POST_FAILED,
                    f"{t.platform} publish failed",
                    f"Post #{post_id}: {exc}"[:2000],
                    link=f"/social/published?post={post_id}",
                )
                continue
            except Exception as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Unexpected: {exc}"[:ERROR_TRUNCATE]
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                failed_platforms.append(t.platform)
                logger.exception(
                    "publish_post: unexpected error on %s for post %s",
                    t.platform, post_id,
                )
                continue

            t.status = TargetStatus.PUBLISHED
            t.platform_post_id = result.platform_post_id or ""
            t.platform_url = result.platform_url or ""
            t.published_at = timezone.now()
            t.error_message = ""
            t.save(update_fields=[
                "status", "platform_post_id", "platform_url",
                "published_at", "error_message",
            ])
            any_success = True
            succeeded_platforms.append(t.platform)

    if any_success and any_failure:
        final_status = PostStatus.PARTIAL
        published_at = post.published_at
    elif any_success:
        final_status = PostStatus.PUBLISHED
        published_at = timezone.now()
    else:
        final_status = PostStatus.FAILED
        published_at = None

    SocialPost.objects.filter(pk=post_id).update(
        status=final_status,
        published_at=published_at,
        updated_at=timezone.now(),
    )

    if final_status == PostStatus.PUBLISHED:
        _notify(
            NotificationType.POST_PUBLISHED,
            "Post published",
            f"Post #{post_id} published to {', '.join(succeeded_platforms)}.",
            link=f"/social/published?post={post_id}",
        )
    elif final_status == PostStatus.PARTIAL:
        _notify(
            NotificationType.POST_FAILED,
            "Post partially published",
            f"Succeeded: {', '.join(succeeded_platforms)}. Failed: {', '.join(failed_platforms)}.",
            link=f"/social/published?post={post_id}",
        )
    elif final_status == PostStatus.FAILED:
        _notify(
            NotificationType.POST_FAILED,
            "Post failed",
            f"Post #{post_id} failed on all channels: {', '.join(failed_platforms)}.",
            link=f"/social/published?post={post_id}",
        )

    _audit(
        actor=post.created_by,
        action="post.publish",
        target_type="SocialPost",
        target_id=str(post_id),
        details={
            "status": final_status,
            "succeeded": succeeded_platforms,
            "failed": failed_platforms,
        },
    )

    logger.info(
        "publish_post: post %s → %s (success=%s, failure=%s)",
        post_id, final_status, any_success, any_failure,
    )


@shared_task(name="social.tasks.dispatch_scheduled_posts")
def dispatch_scheduled_posts():
    now = timezone.now()

    due_ids = list(
        SocialPost.objects
        .filter(
            status=PostStatus.SCHEDULED,
            scheduled_for__lte=now,
        )
        .order_by("scheduled_for")
        .values_list("pk", flat=True)
    )

    for pk in due_ids:
        publish_post.delay(pk)

    stuck_before = now - timedelta(minutes=15)
    stuck_ids = list(
        SocialPost.objects
        .filter(
            status=PostStatus.PUBLISHING,
            updated_at__lt=stuck_before,
        )
        .values_list("pk", flat=True)
    )

    for pk in stuck_ids:
        logger.warning("dispatch_scheduled_posts: rescuing stuck post %s", pk)
        publish_post.delay(pk)

    total = len(due_ids) + len(stuck_ids)
    if total:
        logger.info(
            "dispatch_scheduled_posts: enqueued %s due + %s stuck = %s",
            len(due_ids), len(stuck_ids), total,
        )
    return total


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
        SocialEvergreenPost.objects
        .filter(is_active=True)
        .order_by("last_used_at", "created_at")[:20]
    )
    if not evergreen_pool:
        return 0

    created = 0
    day_lookup = {
        0: "mon", 1: "tue", 2: "wed", 3: "thu",
        4: "fri", 5: "sat", 6: "sun",
    }

    for slot in slots:
        try:
            slot_platforms = slot.platforms or []
        except Exception:
            slot_platforms = []

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

            already = SocialPost.objects.filter(
                status=PostStatus.SCHEDULED,
                scheduled_for__gte=candidate - timedelta(minutes=30),
                scheduled_for__lte=candidate + timedelta(minutes=30),
            ).exists()
            if already:
                current += timedelta(days=1)
                continue

            evergreen = evergreen_pool[created % len(evergreen_pool)] if evergreen_pool else None
            if not evergreen:
                break

            platforms = slot_platforms or evergreen.platforms or []
            if not platforms:
                current += timedelta(days=1)
                continue

            with transaction.atomic():
                post = SocialPost.objects.create(
                    status=PostStatus.SCHEDULED,
                    caption=evergreen.caption,
                    product_tag=evergreen.product_tag,
                    scheduled_for=candidate,
                )
                from .models import SocialPlatform
                valid_codes = {c for c, _ in SocialPlatform.choices}
                for p in platforms:
                    code = str(p).upper()
                    if code in valid_codes:
                        SocialPostTarget.objects.create(
                            post=post, platform=code, status=TargetStatus.PENDING,
                        )

                evergreen.last_used_at = timezone.now()
                evergreen.use_count = (evergreen.use_count or 0) + 1
                evergreen.save(update_fields=["last_used_at", "use_count"])

            created += 1
            current += timedelta(days=1)

    if created:
        logger.info("fill_evergreen_queue: created %s post(s)", created)
    return created


@shared_task(name="social.tasks.sync_all_metrics")
def sync_all_metrics():
    stale_before = timezone.now() - timedelta(minutes=METRICS_STALE_MINUTES)

    stale_targets = (
        SocialPostTarget.objects
        .filter(status=TargetStatus.PUBLISHED)
        .filter(
            Q(metrics_synced_at__isnull=True)
            | Q(metrics_synced_at__lt=stale_before)
        )
        .order_by("platform", "metrics_synced_at")
        .values_list("pk", "platform")[:METRICS_BATCH_LIMIT]
    )

    by_platform: dict[str, list[int]] = {}
    for pk, platform in stale_targets:
        by_platform.setdefault(platform, []).append(pk)

    total_synced = 0

    for platform, pks in by_platform.items():
        account = _resolve_connected_account(platform)
        if account is None:
            logger.info("sync_all_metrics: skipping %s (not connected)", platform)
            continue

        try:
            client = get_client(account)
        except PlatformError as exc:
            logger.warning("sync_all_metrics: cannot build client for %s — %s", platform, exc)
            continue

        for pk in pks:
            try:
                target = (
                    SocialPostTarget.objects
                    .select_related("post")
                    .get(pk=pk)
                )
            except SocialPostTarget.DoesNotExist:
                continue

            if not target.platform_post_id:
                continue

            try:
                m = client.fetch_metrics(target.platform_post_id)
            except TokenExpiredError as exc:
                logger.warning(
                    "sync_all_metrics: token expired for %s — %s", platform, exc,
                )
                account.last_error = str(exc)[:ERROR_TRUNCATE]
                account.save(update_fields=["last_error", "updated_at"])
                break
            except (RateLimitError, QuotaExceededError) as exc:
                logger.warning(
                    "sync_all_metrics: backing off %s — %s", platform, exc,
                )
                break
            except PlatformError as exc:
                logger.warning(
                    "sync_all_metrics: %s target %s failed — %s",
                    platform, pk, exc,
                )
                continue

            target.likes = m.likes
            target.comments = m.comments
            target.shares = m.shares
            target.reach = m.reach
            target.impressions = m.impressions
            target.saves = m.saves
            target.video_views = m.video_views
            target.watch_time_sec = m.watch_time_sec
            target.link_clicks = m.link_clicks
            target.profile_visits = m.profile_visits
            target.follower_delta = m.follower_delta
            target.metrics_synced_at = timezone.now()
            target.save(update_fields=[
                "likes", "comments", "shares", "reach", "impressions",
                "saves", "video_views", "watch_time_sec",
                "link_clicks", "profile_visits", "follower_delta",
                "metrics_synced_at",
            ])
            total_synced += 1

    logger.info("sync_all_metrics: synced %s target(s)", total_synced)
    return total_synced


@shared_task(name="social.tasks.sync_inbox")
def sync_inbox():
    since = timezone.now() - INBOX_SYNC_LOOKBACK
    total_new = 0

    for account in SocialAccount.objects.filter(is_connected=True):
        platform = account.platform
        try:
            client = get_client(account)
        except PlatformError as exc:
            logger.warning("sync_inbox: cannot build client for %s — %s", platform, exc)
            continue

        try:
            comments = client.fetch_comments.__func__ and _safe_fetch(
                client, "fetch_comments", since,
            )
        except UnsupportedOperationError:
            comments = []
        except TokenExpiredError as exc:
            account.last_error = str(exc)[:ERROR_TRUNCATE]
            account.save(update_fields=["last_error", "updated_at"])
            _notify(
                NotificationType.TOKEN_EXPIRED,
                f"{platform} token expired",
                "Reconnect the account to resume inbox sync.",
                link=f"/social/accounts?platform={platform}",
            )
            continue
        except PlatformError as exc:
            logger.warning("sync_inbox: %s comments failed — %s", platform, exc)
            comments = []

        try:
            dms = _safe_fetch(client, "fetch_direct_messages", since)
        except UnsupportedOperationError:
            dms = []
        except PlatformError as exc:
            logger.debug("sync_inbox: %s DMs not available — %s", platform, exc)
            dms = []

        try:
            mentions = _safe_fetch(client, "fetch_mentions", since)
        except UnsupportedOperationError:
            mentions = []
        except PlatformError as exc:
            logger.debug("sync_inbox: %s mentions not available — %s", platform, exc)
            mentions = []

        for c in comments or []:
            created = _upsert_inbox_item(
                account=account,
                platform=platform,
                item_type=InboxItemType.COMMENT,
                platform_item_id=c.platform_comment_id,
                author_name=c.author_name,
                author_handle=c.author_handle,
                author_avatar=c.author_avatar,
                body=c.body,
                permalink=c.permalink,
                parent_item_id=c.parent_id,
                received_at=c.received_at or timezone.now(),
            )
            total_new += 1 if created else 0

        for d in dms or []:
            created = _upsert_inbox_item(
                account=account,
                platform=platform,
                item_type=InboxItemType.DM,
                platform_item_id=d.platform_message_id,
                author_name=d.author_name,
                author_handle=d.author_handle,
                author_avatar=d.author_avatar,
                body=d.body,
                permalink="",
                parent_item_id="",
                received_at=d.received_at or timezone.now(),
            )
            total_new += 1 if created else 0

        for m in mentions or []:
            created = _upsert_inbox_item(
                account=account,
                platform=platform,
                item_type=InboxItemType.MENTION,
                platform_item_id=m.platform_mention_id,
                author_name=m.author_name,
                author_handle=m.author_handle,
                author_avatar=m.author_avatar,
                body=m.body,
                permalink=m.permalink,
                parent_item_id="",
                received_at=m.received_at or timezone.now(),
            )
            total_new += 1 if created else 0

    logger.info("sync_inbox: ingested %s new item(s)", total_new)
    return total_new


def _safe_fetch(client, method_name: str, since):
    method = getattr(client, method_name, None)
    if method is None:
        return []
    return method(since=since)


def _upsert_inbox_item(
    *,
    account: SocialAccount,
    platform: str,
    item_type: str,
    platform_item_id: str,
    author_name: str,
    author_handle: str,
    author_avatar: str,
    body: str,
    permalink: str,
    parent_item_id: str,
    received_at,
) -> bool:
    if not platform_item_id:
        return False

    exists = SocialInboxItem.objects.filter(
        platform=platform,
        platform_item_id=platform_item_id,
        item_type=item_type,
    ).exists()
    if exists:
        return False

    sentiment = _guess_sentiment(body or "")

    item = SocialInboxItem.objects.create(
        item_type=item_type,
        status=InboxItemStatus.OPEN,
        sentiment=sentiment,
        platform=platform,
        account=account,
        platform_item_id=platform_item_id,
        parent_item_id=parent_item_id or "",
        author_name=author_name or "",
        author_handle=author_handle or "",
        author_avatar=author_avatar or "",
        body=body or "",
        permalink=permalink or "",
        received_at=received_at or timezone.now(),
    )

    if item_type == InboxItemType.COMMENT:
        _notify(
            NotificationType.NEW_COMMENT,
            f"New comment on {platform}",
            (body or "")[:200],
            link=f"/social/inbox?item={item.pk}",
        )
    elif item_type == InboxItemType.DM:
        _notify(
            NotificationType.NEW_DM,
            f"New message on {platform}",
            (body or "")[:200],
            link=f"/social/inbox?item={item.pk}",
        )
    elif item_type == InboxItemType.MENTION:
        _notify(
            NotificationType.NEW_MENTION,
            f"New mention on {platform}",
            (body or "")[:200],
            link=f"/social/mentions?item={item.pk}",
        )

    return True


_POSITIVE_TOKENS = {"love", "great", "thanks", "awesome", "amazing", "best", "❤️", "🔥"}
_NEGATIVE_TOKENS = {"bad", "terrible", "refund", "broken", "worst", "scam", "angry"}


def _guess_sentiment(text: str) -> str:
    low = text.lower()
    pos = any(t in low for t in _POSITIVE_TOKENS)
    neg = any(t in low for t in _NEGATIVE_TOKENS)
    if pos and not neg:
        return Sentiment.POSITIVE
    if neg and not pos:
        return Sentiment.NEGATIVE
    return Sentiment.NEUTRAL


@shared_task(name="social.tasks.snapshot_followers")
def snapshot_followers():
    today = timezone.now().date()
    written = 0

    for account in SocialAccount.objects.filter(is_connected=True):
        try:
            client = get_client(account)
            count = client.fetch_followers()
        except TokenExpiredError as exc:
            account.last_error = str(exc)[:ERROR_TRUNCATE]
            account.save(update_fields=["last_error", "updated_at"])
            _notify(
                NotificationType.TOKEN_EXPIRED,
                f"{account.platform} token expired",
                "Reconnect to resume follower snapshots.",
                link=f"/social/accounts?platform={account.platform}",
            )
            continue
        except PlatformError as exc:
            logger.warning(
                "snapshot_followers: %s failed — %s", account.platform, exc,
            )
            continue
        except Exception:
            logger.exception(
                "snapshot_followers: unexpected error for %s", account.platform,
            )
            continue

        if count is None:
            continue

        SocialFollowerSnapshot.objects.update_or_create(
            account=account, date=today,
            defaults={
                "platform": account.platform,
                "followers": count,
            },
        )
        if count != account.followers:
            account.followers = count
            account.last_synced_at = timezone.now()
            account.save(update_fields=["followers", "last_synced_at", "updated_at"])
        written += 1

    logger.info("snapshot_followers: wrote %s snapshot(s)", written)
    return written


@shared_task(name="social.tasks.snapshot_engagement")
def snapshot_engagement():
    totals = (
        SocialPostTarget.objects
        .filter(status=TargetStatus.PUBLISHED)
        .values("platform")
        .annotate(
            total_reach=Sum("reach"),
            total_likes=Sum("likes"),
            total_comments=Sum("comments"),
            total_shares=Sum("shares"),
            total_saves=Sum("saves"),
            total_views=Sum("video_views"),
        )
    )

    written = 0
    for row in totals:
        engagement = (
            (row["total_likes"] or 0)
            + (row["total_comments"] or 0)
            + (row["total_shares"] or 0)
        )
        SocialEngagementSnapshot.objects.update_or_create(
            platform=row["platform"],
            defaults={
                "reach": row["total_reach"] or 0,
                "engagement": engagement,
            },
        )
        written += 1

    logger.info("snapshot_engagement: wrote %s row(s)", written)
    return written


@shared_task(name="social.tasks.snapshot_demographics")
def snapshot_demographics():
    today = timezone.now().date()
    written = 0

    for account in SocialAccount.objects.filter(is_connected=True):
        try:
            client = get_client(account)
            d = client.fetch_demographics()
        except UnsupportedOperationError:
            continue
        except TokenExpiredError as exc:
            account.last_error = str(exc)[:ERROR_TRUNCATE]
            account.save(update_fields=["last_error", "updated_at"])
            continue
        except PlatformError as exc:
            logger.warning(
                "snapshot_demographics: %s failed — %s", account.platform, exc,
            )
            continue
        except Exception:
            logger.exception(
                "snapshot_demographics: unexpected error for %s", account.platform,
            )
            continue

        SocialDemographicSnapshot.objects.update_or_create(
            platform=account.platform,
            date=today,
            defaults={
                "age_buckets": d.age_buckets,
                "gender": d.gender,
                "top_cities": d.top_cities,
                "top_countries": d.top_countries,
            },
        )
        written += 1

    logger.info("snapshot_demographics: wrote %s row(s)", written)
    return written


@shared_task(name="social.tasks.snapshot_best_times")
def snapshot_best_times():
    written = 0

    for account in SocialAccount.objects.filter(is_connected=True):
        try:
            client = get_client(account)
            rows = client.fetch_best_times()
        except UnsupportedOperationError:
            continue
        except TokenExpiredError as exc:
            account.last_error = str(exc)[:ERROR_TRUNCATE]
            account.save(update_fields=["last_error", "updated_at"])
            continue
        except PlatformError as exc:
            logger.warning(
                "snapshot_best_times: %s failed — %s", account.platform, exc,
            )
            continue
        except Exception:
            logger.exception(
                "snapshot_best_times: unexpected error for %s", account.platform,
            )
            continue

        for row in rows or []:
            SocialBestTimePost.objects.update_or_create(
                platform=account.platform,
                day_of_week=row.day_of_week,
                hour=row.hour,
                defaults={
                    "score": row.score,
                    "sample_size": row.sample_size,
                },
            )
            written += 1

    logger.info("snapshot_best_times: wrote %s row(s)", written)
    return written


@shared_task(name="social.tasks.refresh_expiring_tokens")
def refresh_expiring_tokens():
    now = timezone.now()
    soon = now + TOKEN_REFRESH_WINDOW

    accounts = (
        SocialAccount.objects
        .filter(is_connected=True)
        .filter(
            Q(token_expires_at__isnull=False, token_expires_at__lte=soon)
            | Q(token_expires_at__isnull=True)
        )
    )

    refreshed = 0
    failed = 0

    for account in accounts:
        try:
            client = get_client(account)
            new_expiry = client.refresh_access_token()
        except TokenExpiredError as exc:
            account.last_error = f"Refresh failed: {exc}"[:ERROR_TRUNCATE]
            account.save(update_fields=["last_error", "updated_at"])
            failed += 1
            _notify(
                NotificationType.TOKEN_EXPIRED,
                f"{account.platform} token refresh failed",
                str(exc)[:2000],
                link=f"/social/accounts?platform={account.platform}",
            )
            continue
        except PlatformError as exc:
            account.last_error = f"Refresh failed: {exc}"[:ERROR_TRUNCATE]
            account.save(update_fields=["last_error", "updated_at"])
            failed += 1
            logger.warning(
                "refresh_expiring_tokens: %s failed — %s", account.platform, exc,
            )
            continue
        except Exception:
            account.last_error = "Refresh failed: unexpected error."
            account.save(update_fields=["last_error", "updated_at"])
            failed += 1
            logger.exception(
                "refresh_expiring_tokens: unexpected error for %s", account.platform,
            )
            continue

        update_fields = ["updated_at", "last_error"]
        account.last_error = ""

        if new_expiry is not None:
            account.token_expires_at = new_expiry
            update_fields.append("token_expires_at")

        account.save(update_fields=update_fields)
        refreshed += 1

    logger.info(
        "refresh_expiring_tokens: refreshed=%s failed=%s", refreshed, failed,
    )
    return {"refreshed": refreshed, "failed": failed}


@shared_task(name="social.tasks.check_token_expiry")
def check_token_expiry():
    now = timezone.now()
    warn_before = now + TOKEN_EXPIRY_WARN
    warned = 0

    for account in SocialAccount.objects.filter(is_connected=True):
        if not account.token_expires_at:
            continue
        if account.token_expires_at > warn_before:
            continue

        existing = SocialNotification.objects.filter(
            notification_type=NotificationType.TOKEN_EXPIRING,
            link=f"/social/accounts?platform={account.platform}",
            created_at__gte=now - timedelta(hours=24),
        ).exists()
        if existing:
            continue

        _notify(
            NotificationType.TOKEN_EXPIRING,
            f"{account.platform} token expiring soon",
            f"Token expires at {account.token_expires_at.isoformat()}.",
            link=f"/social/accounts?platform={account.platform}",
        )
        warned += 1

    logger.info("check_token_expiry: warned %s account(s)", warned)
    return warned


@shared_task(name="social.tasks.generate_report", bind=True, max_retries=2)
def generate_report(self, report_id: int):
    try:
        report = SocialReport.objects.get(pk=report_id)
    except SocialReport.DoesNotExist:
        logger.warning("generate_report: report %s not found", report_id)
        return

    try:
        from .services.reports import build_report_file

        with transaction.atomic():
            path = build_report_file(report)
            report.file = path
            report.generated_at = timezone.now()
            report.save(update_fields=["file", "generated_at"])
    except Exception as exc:
        logger.exception("generate_report: failed for %s", report_id)
        _notify(
            NotificationType.REPORT_READY,
            "Report generation failed",
            str(exc)[:2000],
            link=f"/social/reports?id={report_id}",
        )
        raise self.retry(exc=exc, countdown=60)

    _notify(
        NotificationType.REPORT_READY,
        "Report ready",
        f"{report.name} is ready for download.",
        link=f"/social/reports?id={report_id}",
        recipient=report.created_by,
    )
    _audit(
        actor=report.created_by,
        action="report.generate",
        target_type="SocialReport",
        target_id=str(report_id),
    )
    return report.pk


@shared_task(name="social.tasks.refresh_published_links_metrics")
def refresh_published_links_metrics():
    total = 0
    for target in (
        SocialPostTarget.objects
        .filter(status=TargetStatus.PUBLISHED, link_clicks__gt=0)
        .select_related("post")
        .iterator(chunk_size=200)
    ):
        clicks = target.link_clicks or 0
        if clicks == 0:
            continue
        total += clicks
    logger.info("refresh_published_links_metrics: %s total tracked clicks", total)
    return total


@shared_task(name="social.tasks.cleanup_stale_inbox_items")
def cleanup_stale_inbox_items():
    cutoff = timezone.now() - timedelta(days=30)
    qs = SocialInboxItem.objects.filter(
        status=InboxItemStatus.OPEN,
        received_at__lt=cutoff,
    )
    count = qs.update(status=InboxItemStatus.RESOLVED, resolved_at=timezone.now())
    logger.info("cleanup_stale_inbox_items: resolved %s stale item(s)", count)
    return count


@shared_task(name="social.tasks.auto_approve_scheduled_drafts")
def auto_approve_scheduled_drafts():
    from .models import SocialDraft

    qs = SocialDraft.objects.filter(status=DraftStatus.APPROVED)
    moved = 0
    for draft in qs.iterator(chunk_size=100):
        if not draft.platforms or not draft.caption:
            continue
        moved += 1
    logger.info("auto_approve_scheduled_drafts: %s approved draft(s) pending", moved)
    return moved