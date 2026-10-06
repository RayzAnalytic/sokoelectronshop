"""
Celery tasks for the social app.

Queues (from settings.CELERY_TASK_ROUTES):
    social.publish  → publish_post, dispatch_scheduled_posts
    social.metrics  → sync_all_metrics, snapshot_followers, refresh_expiring_tokens

Every task is idempotent. `publish_post` in particular must be safe under
retry — a second run on an already-published target must be a no-op.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    PostStatus,
    SocialAccount,
    SocialFollowerSnapshot,
    SocialPlatform,
    SocialPost,
    SocialPostTarget,
    TargetStatus,
)
from .services import get_client
from .services.base import (
    PlatformError,
    QuotaExceededError,
    TokenExpiredError,
)

logger = logging.getLogger("social.publish")


# ─────────────────────────────────────────────────────────────────────────────
# Publishing
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(
    name="social.tasks.publish_post",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def publish_post(self, post_id: int):
    """
    Publish all PENDING targets for a post. Marks the parent PUBLISHED,
    PARTIAL, or FAILED based on the fan-out result.
    """
    try:
        post = SocialPost.objects.get(pk=post_id)
    except SocialPost.DoesNotExist:
        logger.warning("publish_post: post %s gone", post_id)
        return

    if post.status in (PostStatus.PUBLISHED, PostStatus.PARTIAL):
        logger.info("publish_post: post %s already %s", post_id, post.status)
        return

    post.status = PostStatus.PUBLISHING
    post.save(update_fields=["status", "updated_at"])

    media_paths = [m.file.path for m in post.media.all().order_by("sort_order")]
    any_success = False
    any_failure = False

    for target in post.targets.select_related().all():
        if target.status == TargetStatus.PUBLISHED:
            any_success = True
            continue

        # Lock the row so a concurrent worker can't double-publish.
        with transaction.atomic():
            t = SocialPostTarget.objects.select_for_update().get(pk=target.pk)
            if t.status == TargetStatus.PUBLISHED:
                any_success = True
                continue
            try:
                account = SocialAccount.objects.get(platform=t.platform, is_connected=True)
            except SocialAccount.DoesNotExist:
                t.status = TargetStatus.FAILED
                t.error_message = f"{t.platform} account is not connected."
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                continue

            client = get_client(account)
            try:
                result = client.publish(
                    caption=post.caption,
                    media_paths=media_paths,
                    product_tag=post.product_tag,
                )
            except QuotaExceededError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Quota: {exc}"
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                logger.warning("publish_post: %s quota on post %s: %s", t.platform, post_id, exc)
                continue
            except TokenExpiredError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = f"Token: {exc}"
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                continue
            except PlatformError as exc:
                t.status = TargetStatus.FAILED
                t.error_message = str(exc)[:1000]
                t.save(update_fields=["status", "error_message"])
                any_failure = True
                logger.error("publish_post: %s failed on post %s: %s", t.platform, post_id, exc)
                continue

            t.status = TargetStatus.PUBLISHED
            t.platform_post_id = result.platform_post_id or ""
            t.platform_url = result.platform_url or ""
            t.published_at = timezone.now()
            t.error_message = ""
            t.save(update_fields=[
                "status", "platform_post_id", "platform_url", "published_at", "error_message",
            ])
            any_success = True

    # Roll up parent status
    if any_success and any_failure:
        post.status = PostStatus.PARTIAL
    elif any_success:
        post.status = PostStatus.PUBLISHED
        post.published_at = timezone.now()
    else:
        post.status = PostStatus.FAILED
    post.save(update_fields=["status", "published_at", "updated_at"])


@shared_task(name="social.tasks.dispatch_scheduled_posts")
def dispatch_scheduled_posts():
    """
    Fires every 60s from beat. Finds SCHEDULED posts whose time has come
    and enqueues `publish_post` for each.
    """
    due = SocialPost.objects.filter(
        status=PostStatus.SCHEDULED,
        scheduled_for__lte=timezone.now(),
    ).values_list("pk", flat=True)

    count = 0
    for pk in due:
        publish_post.delay(pk)
        count += 1

    if count:
        logger.info("dispatch_scheduled_posts: enqueued %s post(s)", count)
    return count


# ─────────────────────────────────────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="social.tasks.sync_all_metrics")
def sync_all_metrics():
    """
    Re-poll metrics for every PUBLISHED target whose metrics are stale.
    Chunked by platform so one platform's outage doesn't stall the rest.
    """
    stale_before = timezone.now() - timezone.timedelta(minutes=55)
    targets = (
        SocialPostTarget.objects
        .filter(status=TargetStatus.PUBLISHED)
        .filter(Q(metrics_synced_at__isnull=True) | Q(metrics_synced_at__lt=stale_before))
        .order_by("platform", "metrics_synced_at")
    )

    by_platform: dict[str, list] = {}
    for t in targets[:500]:
        by_platform.setdefault(t.platform, []).append(t.pk)

    for platform, pks in by_platform.items():
        try:
            account = SocialAccount.objects.get(platform=platform, is_connected=True)
        except SocialAccount.DoesNotExist:
            continue
        client = get_client(account)

        for pk in pks:
            try:
                target = SocialPostTarget.objects.get(pk=pk)
                if not target.platform_post_id:
                    continue
                m = client.fetch_metrics(target.platform_post_id)
            except PlatformError as exc:
                logger.warning("sync_metrics: %s target %s failed: %s", platform, pk, exc)
                continue
            except SocialPostTarget.DoesNotExist:
                continue

            target.likes = m.likes
            target.comments = m.comments
            target.shares = m.shares
            target.reach = m.reach
            target.impressions = m.impressions
            target.metrics_synced_at = timezone.now()
            target.save(update_fields=[
                "likes", "comments", "shares", "reach", "impressions", "metrics_synced_at",
            ])


# ─────────────────────────────────────────────────────────────────────────────
# Followers
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="social.tasks.snapshot_followers")
def snapshot_followers():
    """Daily snapshot for the follower-growth line chart."""
    today = timezone.now().date()
    for account in SocialAccount.objects.filter(is_connected=True):
        try:
            client = get_client(account)
            count = client.fetch_followers()
        except PlatformError as exc:
            logger.warning("snapshot_followers: %s failed: %s", account.platform, exc)
            continue
        if count:
            SocialFollowerSnapshot.objects.update_or_create(
                account=account, date=today,
                defaults={"followers": count},
            )


# ─────────────────────────────────────────────────────────────────────────────
# Token maintenance
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="social.tasks.refresh_expiring_tokens")
def refresh_expiring_tokens():
    """Refresh OAuth tokens that expire within the next 24h."""
    soon = timezone.now() + timezone.timedelta(hours=24)
    qs = SocialAccount.objects.filter(
        is_connected=True,
        token_expires_at__isnull=False,
        token_expires_at__lte=soon,
    )
    for account in qs:
        try:
            get_client(account).refresh_access_token()
            logger.info("refresh_expiring_tokens: refreshed %s", account.platform)
        except PlatformError as exc:
            account.last_error = str(exc)[:500]
            account.save(update_fields=["last_error", "updated_at"])
            logger.warning("refresh_expiring_tokens: %s failed: %s", account.platform, exc)