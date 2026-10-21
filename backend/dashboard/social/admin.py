from __future__ import annotations

from django.contrib import admin, messages
from django.utils import timezone

from .models import (
    MediaType,
    PostStatus,
    SocialAccount,
    SocialAuditLog,
    SocialBestTimePost,
    SocialDemographicSnapshot,
    SocialDraft,
    SocialDraftComment,
    SocialEngagementSnapshot,
    SocialEvergreenPost,
    SocialFollowerSnapshot,
    SocialInboxItem,
    SocialInboxReply,
    SocialLink,
    SocialMedia,
    SocialMediaFolder,
    SocialNotification,
    SocialPlatform,
    SocialPost,
    SocialPostTarget,
    SocialQueueSlot,
    SocialReport,
    SocialTeamMember,
    SocialTemplate,
    TargetStatus,
)


@admin.display(description="Caption")
def short_caption(obj) -> str:
    text = obj.caption or ""
    return (text[:60] + "…") if len(text) > 60 else text


@admin.display(description="Platform", ordering="platform")
def platform_display(obj) -> str:
    return obj.get_platform_display() if hasattr(obj, "get_platform_display") else obj.platform


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = (
        "platform_display", "handle", "display_name",
        "is_connected", "token_state", "followers",
        "is_token_expiring_soon", "updated_at",
    )
    list_filter  = ("platform", "is_connected")
    search_fields = ("handle", "display_name", "platform_user_id")
    ordering      = ("platform",)

    readonly_fields = (
        "created_at", "updated_at", "connected_at", "last_synced_at",
        "is_token_expired", "is_token_expiring_soon",
        "has_access_token", "has_refresh_token",
    )

    fieldsets = (
        ("Identity", {
            "fields": (
                "platform", "handle", "display_name", "platform_user_id",
                "avatar_url", "followers",
            ),
        }),
        ("Connection", {
            "fields": (
                "is_connected", "connected_at", "last_synced_at",
                "token_expires_at", "is_token_expired", "is_token_expiring_soon",
                "has_access_token", "has_refresh_token",
            ),
        }),
        ("Permissions", {
            "fields": ("scopes",),
            "classes": ("collapse",),
        }),
        ("Metadata", {
            "fields": ("metadata", "last_error"),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    actions = ("mark_disconnected", "clear_last_error", "touch_last_synced")

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()

    @admin.display(description="Token", ordering="token_expires_at")
    def token_state(self, obj) -> str:
        if not obj.is_connected:
            return "—"
        if obj.is_token_expired:
            return "Expired"
        if obj.is_token_expiring_soon:
            return "Expiring soon"
        if obj.token_expires_at:
            return "Valid"
        return "No expiry"

    @admin.display(boolean=True, description="Token expired?")
    def is_token_expired(self, obj) -> bool:
        return obj.is_token_expired

    @admin.display(boolean=True, description="Token expiring soon?")
    def is_token_expiring_soon(self, obj) -> bool:
        return obj.is_token_expiring_soon

    @admin.display(boolean=True, description="Access token stored?")
    def has_access_token(self, obj) -> bool:
        return bool(obj.access_token)

    @admin.display(boolean=True, description="Refresh token stored?")
    def has_refresh_token(self, obj) -> bool:
        return bool(obj.refresh_token)

    @admin.action(description="Mark selected accounts as disconnected")
    def mark_disconnected(self, request, queryset):
        updated = queryset.update(
            is_connected=False,
            access_token="",
            refresh_token="",
            token_expires_at=None,
            scopes=[],
            avatar_url="",
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} account(s) disconnected.", messages.SUCCESS)

    @admin.action(description="Clear last_error on selected accounts")
    def clear_last_error(self, request, queryset):
        updated = queryset.update(last_error="", updated_at=timezone.now())
        self.message_user(request, f"{updated} account(s) cleared.", messages.SUCCESS)

    @admin.action(description="Stamp last_synced_at now")
    def touch_last_synced(self, request, queryset):
        updated = queryset.update(last_synced_at=timezone.now(), updated_at=timezone.now())
        self.message_user(request, f"{updated} account(s) stamped.", messages.SUCCESS)


@admin.register(SocialMediaFolder)
class SocialMediaFolderAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent", "created_at")
    search_fields = ("name", "slug")
    ordering      = ("name",)
    readonly_fields = ("created_at",)


@admin.register(SocialMedia)
class SocialMediaAdmin(admin.ModelAdmin):
    list_display = (
        "id", "filename", "media_type",
        "folder", "size_bytes", "dimensions",
        "post_link", "sort_order", "created_at",
    )
    list_filter   = ("media_type", "folder")
    search_fields = ("filename", "title", "post__caption")
    ordering      = ("-created_at",)

    readonly_fields = ("filename", "size_bytes", "created_at")

    @admin.display(description="Post", ordering="post__id")
    def post_link(self, obj):
        return f"#{obj.post_id}" if obj.post_id else "— (unattached)"

    @admin.display(description="Dimensions")
    def dimensions(self, obj):
        if obj.width and obj.height:
            return f"{obj.width}×{obj.height}"
        return "—"


class SocialPostTargetInline(admin.TabularInline):
    model          = SocialPostTarget
    extra          = 0
    can_delete     = False
    show_change_link = True

    fields = (
        "platform", "status",
        "platform_post_id", "platform_url",
        "likes", "comments", "shares",
        "reach", "impressions", "saves", "video_views",
        "published_at", "metrics_synced_at",
        "error_message",
    )
    readonly_fields = (
        "platform_post_id", "platform_url",
        "published_at", "metrics_synced_at",
        "error_message",
    )

    def has_add_permission(self, request, obj=None):
        return False


class SocialMediaInline(admin.TabularInline):
    model          = SocialMedia
    extra          = 0
    fields         = ("file", "media_type", "filename", "size_bytes", "sort_order")
    readonly_fields = ("filename", "size_bytes")
    ordering       = ("sort_order", "id")


@admin.register(SocialPost)
class SocialPostAdmin(admin.ModelAdmin):
    list_display = (
        "id", "status_badge", "short_caption",
        "platform_list", "campaign",
        "scheduled_for", "published_at", "created_at",
    )
    list_filter   = ("status", "targets__platform", "campaign")
    search_fields = ("caption", "product_tag", "campaign", "id")
    ordering      = ("-created_at",)
    date_hierarchy = "created_at"

    inlines = [SocialPostTargetInline, SocialMediaInline]

    readonly_fields = (
        "created_at", "updated_at", "published_at",
        "platform_list",
    )

    fieldsets = (
        ("Content", {
            "fields": ("caption", "first_comment", "product_tag", "campaign"),
        }),
        ("Links", {
            "fields": ("link_url", "link_utm"),
            "classes": ("collapse",),
        }),
        ("Scheduling", {
            "fields": ("status", "scheduled_for", "published_at", "platform_list"),
        }),
        ("Audit", {
            "fields": ("created_by", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    actions = (
        "action_publish_now",
        "action_delete_and_cleanup",
        "action_reschedule",
    )

    @admin.display(description="Caption", ordering="caption")
    def short_caption(self, obj):
        return short_caption(obj)

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return obj.get_status_display()

    @admin.display(description="Platforms")
    def platform_list(self, obj):
        return ", ".join(
            t.get_platform_display() for t in obj.targets.all()
        ) or "—"

    @admin.action(description="Publish selected posts now")
    def action_publish_now(self, request, queryset):
        from .tasks import publish_post

        enqueued = 0
        for post in queryset.exclude(
            status__in=[PostStatus.PUBLISHED, PostStatus.PARTIAL]
        ):
            post.status = PostStatus.DRAFT
            post.scheduled_for = None
            post.save(update_fields=["status", "scheduled_for", "updated_at"])
            try:
                publish_post.delay(post.pk)
                enqueued += 1
            except Exception:
                self.message_user(
                    request,
                    f"Failed to enqueue post #{post.pk}.",
                    messages.ERROR,
                )
        if enqueued:
            self.message_user(
                request,
                f"{enqueued} post(s) queued for publishing.",
                messages.SUCCESS,
            )

    @admin.action(description="Delete selected posts and their files")
    def action_delete_and_cleanup(self, request, queryset):
        deleted = 0
        for post in queryset:
            for m in post.media.all():
                try:
                    m.file.delete(save=False)
                except Exception:
                    pass
            post.delete()
            deleted += 1
        self.message_user(
            request,
            f"{deleted} post(s) deleted (media files cleaned up).",
            messages.SUCCESS,
        )

    @admin.action(description="Move scheduled_for +1 day on selected posts")
    def action_reschedule(self, request, queryset):
        from datetime import timedelta
        updated = 0
        for post in queryset.filter(status=PostStatus.SCHEDULED):
            if post.scheduled_for:
                post.scheduled_for = post.scheduled_for + timedelta(days=1)
                post.save(update_fields=["scheduled_for", "updated_at"])
                updated += 1
        self.message_user(
            request,
            f"{updated} post(s) rescheduled +1 day.",
            messages.SUCCESS,
        )


@admin.register(SocialPostTarget)
class SocialPostTargetAdmin(admin.ModelAdmin):
    list_display = (
        "id", "post_link", "platform_display", "status",
        "likes", "comments", "shares",
        "reach", "impressions", "saves", "video_views",
        "published_at", "metrics_synced_at",
    )
    list_filter   = ("platform", "status")
    search_fields = ("post__caption", "platform_post_id")
    ordering      = ("-published_at",)
    date_hierarchy = "published_at"

    readonly_fields = (
        "post", "platform",
        "platform_post_id", "platform_url",
        "published_at", "metrics_synced_at",
        "created_at",
    )

    fieldsets = (
        ("Post", {
            "fields": ("post", "platform", "status"),
        }),
        ("Platform result", {
            "fields": (
                "platform_post_id", "platform_url",
                "published_at", "error_message",
            ),
        }),
        ("Metrics", {
            "fields": (
                "likes", "comments", "shares",
                "reach", "impressions",
                "saves", "video_views", "watch_time_sec",
                "link_clicks", "profile_visits", "follower_delta",
                "metrics_synced_at",
            ),
        }),
        ("Audit", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    actions = ("action_sync_metrics",)

    @admin.display(description="Post", ordering="post__id")
    def post_link(self, obj):
        return f"#{obj.post_id}"

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()

    @admin.action(description="Sync metrics for selected targets")
    def action_sync_metrics(self, request, queryset):
        from .services import get_client
        from .services.base import PlatformError

        synced = 0
        failed = 0
        for target in queryset.filter(status=TargetStatus.PUBLISHED):
            if not target.platform_post_id:
                failed += 1
                continue
            account = SocialAccount.objects.filter(
                platform=target.platform, is_connected=True,
            ).first()
            if not account:
                failed += 1
                continue
            try:
                client = get_client(account)
                m = client.fetch_metrics(target.platform_post_id)
            except PlatformError:
                failed += 1
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
            synced += 1

        self.message_user(
            request,
            f"Synced {synced} target(s); {failed} skipped or failed.",
            messages.SUCCESS if synced else messages.WARNING,
        )


class SocialDraftCommentInline(admin.TabularInline):
    model = SocialDraftComment
    extra = 0
    fields = ("author", "body", "decision", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("created_at",)


@admin.register(SocialDraft)
class SocialDraftAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "status", "author_link",
        "platforms_display", "last_edited_at",
    )
    list_filter   = ("status",)
    search_fields = ("title", "caption")
    ordering      = ("-last_edited_at",)

    inlines = [SocialDraftCommentInline]

    readonly_fields = ("last_edited_at", "created_at")

    @admin.display(description="Author", ordering="author__username")
    def author_link(self, obj):
        if not obj.author_id:
            return "—"
        return getattr(obj.author, "get_full_name", lambda: "")() or getattr(obj.author, "username", "")

    @admin.display(description="Platforms")
    def platforms_display(self, obj):
        return ", ".join(obj.platforms or []) or "—"

    actions = ("action_approve", "action_reject")

    @admin.action(description="Approve selected drafts")
    def action_approve(self, request, queryset):
        updated = queryset.update(status="APPROVED", last_edited_at=timezone.now())
        self.message_user(request, f"{updated} draft(s) approved.", messages.SUCCESS)

    @admin.action(description="Reject selected drafts")
    def action_reject(self, request, queryset):
        updated = queryset.update(status="REJECTED", last_edited_at=timezone.now())
        self.message_user(request, f"{updated} draft(s) rejected.", messages.SUCCESS)


@admin.register(SocialDraftComment)
class SocialDraftCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "draft", "author", "decision", "created_at")
    list_filter   = ("decision",)
    search_fields = ("body",)
    ordering      = ("-created_at",)


class SocialInboxReplyInline(admin.TabularInline):
    model = SocialInboxReply
    extra = 0
    fields = ("author", "body", "is_outbound", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("created_at",)


@admin.register(SocialInboxItem)
class SocialInboxItemAdmin(admin.ModelAdmin):
    list_display = (
        "id", "item_type", "platform_display", "author_handle",
        "status", "sentiment", "assigned_to",
        "received_at",
    )
    list_filter   = ("item_type", "platform", "status", "sentiment")
    search_fields = ("author_name", "author_handle", "body")
    ordering      = ("-received_at",)
    date_hierarchy = "received_at"

    inlines = [SocialInboxReplyInline]

    readonly_fields = ("received_at", "created_at", "updated_at")

    actions = ("action_resolve", "action_spam", "action_assign_to_me")

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()

    @admin.action(description="Mark selected items resolved")
    def action_resolve(self, request, queryset):
        updated = queryset.update(
            status="RESOLVED",
            resolved_at=timezone.now(),
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} item(s) resolved.", messages.SUCCESS)

    @admin.action(description="Mark selected items as spam")
    def action_spam(self, request, queryset):
        updated = queryset.update(
            status="SPAM",
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} item(s) marked spam.", messages.SUCCESS)

    @admin.action(description="Assign selected items to me")
    def action_assign_to_me(self, request, queryset):
        updated = queryset.update(
            assigned_to=request.user,
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} item(s) assigned to you.", messages.SUCCESS)


@admin.register(SocialInboxReply)
class SocialInboxReplyAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "author", "is_outbound", "created_at")
    list_filter   = ("is_outbound",)
    search_fields = ("body",)
    ordering      = ("-created_at",)


@admin.register(SocialTemplate)
class SocialTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "is_shared", "created_by", "updated_at")
    list_filter   = ("category", "is_shared")
    search_fields = ("name", "caption")
    ordering      = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialQueueSlot)
class SocialQueueSlotAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kind", "time_of_day", "timezone", "is_active", "created_at")
    list_filter   = ("kind", "is_active")
    search_fields = ("name",)
    ordering      = ("time_of_day",)
    readonly_fields = ("created_at",)


@admin.register(SocialEvergreenPost)
class SocialEvergreenPostAdmin(admin.ModelAdmin):
    list_display = ("id", "short_caption", "platforms_display", "use_count", "last_used_at", "is_active")
    list_filter   = ("is_active",)
    search_fields = ("caption", "product_tag")
    ordering      = ("last_used_at", "created_at")
    readonly_fields = ("last_used_at", "use_count", "created_at")

    @admin.display(description="Caption")
    def short_caption(self, obj):
        return short_caption(obj)

    @admin.display(description="Platforms")
    def platforms_display(self, obj):
        return ", ".join(obj.platforms or []) or "—"


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "short_code", "destination", "clicks", "created_by", "created_at")
    search_fields = ("short_code", "destination")
    ordering      = ("-created_at",)
    readonly_fields = ("short_code", "clicks", "created_at", "updated_at")


@admin.register(SocialNotification)
class SocialNotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "notification_type", "title", "is_read", "recipient", "created_at")
    list_filter   = ("notification_type", "is_read")
    search_fields = ("title", "message")
    ordering      = ("-created_at",)
    readonly_fields = ("created_at",)

    actions = ("action_mark_read", "action_mark_unread")

    @admin.action(description="Mark selected as read")
    def action_mark_read(self, request, queryset):
        updated = queryset.update(is_read=True)
        self.message_user(request, f"{updated} notification(s) marked read.", messages.SUCCESS)

    @admin.action(description="Mark selected as unread")
    def action_mark_unread(self, request, queryset):
        updated = queryset.update(is_read=False)
        self.message_user(request, f"{updated} notification(s) marked unread.", messages.SUCCESS)


@admin.register(SocialAuditLog)
class SocialAuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "actor", "target_type", "target_id", "created_at")
    list_filter   = ("action", "target_type")
    search_fields = ("action", "target_id", "actor__username")
    ordering      = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("actor", "action", "target_type", "target_id", "details", "created_at")


@admin.register(SocialTeamMember)
class SocialTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role", "is_active", "invited_at", "joined_at")
    list_filter   = ("role", "is_active")
    search_fields = ("user__username", "user__email")
    ordering      = ("role", "user__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialReport)
class SocialReportAdmin(admin.ModelAdmin):
    list_display = (
        "id", "name", "format",
        "date_from", "date_to",
        "created_by", "generated_at", "created_at",
    )
    list_filter   = ("format",)
    search_fields = ("name",)
    ordering      = ("-created_at",)
    readonly_fields = ("generated_at", "created_at")

    actions = ("action_regenerate",)

    @admin.action(description="Regenerate selected reports")
    def action_regenerate(self, request, queryset):
        from .tasks import generate_report

        enqueued = 0
        for report in queryset:
            try:
                generate_report.delay(report.pk)
                enqueued += 1
            except Exception:
                self.message_user(
                    request,
                    f"Failed to enqueue report #{report.pk}.",
                    messages.ERROR,
                )
        if enqueued:
            self.message_user(
                request,
                f"{enqueued} report(s) queued for regeneration.",
                messages.SUCCESS,
            )


@admin.register(SocialBestTimePost)
class SocialBestTimePostAdmin(admin.ModelAdmin):
    list_display = ("id", "platform_display", "day_of_week", "hour", "score", "sample_size", "updated_at")
    list_filter   = ("platform", "day_of_week")
    ordering      = ("platform", "day_of_week", "hour")
    readonly_fields = ("updated_at",)

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()


@admin.register(SocialDemographicSnapshot)
class SocialDemographicSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "platform_display", "date", "updated_at")
    list_filter   = ("platform",)
    ordering      = ("-date",)
    date_hierarchy = "date"
    readonly_fields = ("updated_at",)

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()


@admin.register(SocialFollowerSnapshot)
class SocialFollowerSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "id", "platform_display", "account_link",
        "date", "followers",
    )
    list_filter   = ("platform",)
    search_fields = ("account__handle", "account__display_name")
    ordering      = ("-date", "platform")
    date_hierarchy = "date"

    readonly_fields = ("account", "platform", "date", "followers")

    actions = ("action_snapshot_now",)

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()

    @admin.display(description="Account", ordering="account__handle")
    def account_link(self, obj):
        return obj.account.handle or obj.account.display_name or f"#{obj.account_id}"

    @admin.action(description="Run follower snapshot now")
    def action_snapshot_now(self, request, queryset):
        from .tasks import snapshot_followers
        try:
            written = snapshot_followers()
            self.message_user(
                request,
                f"Follower snapshot complete — {written} row(s) written.",
                messages.SUCCESS,
            )
        except Exception as exc:
            self.message_user(
                request,
                f"Snapshot failed: {exc}",
                messages.ERROR,
            )


@admin.register(SocialEngagementSnapshot)
class SocialEngagementSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "id", "platform_display",
        "reach", "engagement", "engagement_rate_display",
        "updated_at",
    )
    list_filter   = ("platform",)
    ordering      = ("platform",)

    readonly_fields = ("updated_at", "engagement_rate_display")

    actions = ("action_snapshot_now",)

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()

    @admin.display(description="Engagement rate")
    def engagement_rate_display(self, obj):
        return f"{obj.engagement_rate:.2f}%"

    @admin.action(description="Rebuild engagement rollup now")
    def action_snapshot_now(self, request, queryset):
        from .tasks import snapshot_engagement
        try:
            written = snapshot_engagement()
            self.message_user(
                request,
                f"Engagement rollup complete — {written} row(s) written.",
                messages.SUCCESS,
            )
        except Exception as exc:
            self.message_user(
                request,
                f"Rollup failed: {exc}",
                messages.ERROR,
            )


admin.site.site_header = "SokoFlow Admin"
admin.site.site_title  = "SokoFlow Admin"
admin.site.index_title = "Dashboard"