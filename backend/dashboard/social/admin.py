from __future__ import annotations

from datetime import timedelta

from django.contrib import admin, messages
from django.utils import timezone

from .models import (
    AccountConnectionStatus,
    AccountSyncStatus,
    CampaignStatus,
    ContentStatus,
    ConversationStatus,
    PublishStatus,
    SocialAccount,
    SocialAccountShare,
    SocialAccountSyncLog,
    SocialActivityLog,
    SocialAnalyticsConfig,
    SocialAttributionEvent,
    SocialAuditLog,
    SocialBestTimePost,
    SocialCampaign,
    SocialCampaignAlert,
    SocialCampaignContent,
    SocialCampaignProduct,
    SocialContent,
    SocialContentApprovalLog,
    SocialContentCategory,
    SocialContentMedia,
    SocialContentProduct,
    SocialDemographicSnapshot,
    SocialEngagementSnapshot,
    SocialEvergreenPost,
    SocialFollowerSnapshot,
    SocialInboxConversation,
    SocialInboxMessage,
    SocialInboxTemplate,
    SocialLink,
    SocialMedia,
    SocialMediaFolder,
    SocialNotification,
    SocialOAuthState,
    SocialPlatformDailyMetric,
    SocialQueueSlot,
    SocialReport,
    SocialScheduledPost,
    SocialScheduledPostHistory,
    SocialTeamMember,
)


@admin.display(description="Caption")
def short_caption(obj) -> str:
    text = getattr(obj, "caption", "") or ""
    return (text[:60] + "…") if len(text) > 60 else text


@admin.register(SocialAnalyticsConfig)
class SocialAnalyticsConfigAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "attribution_model",
        "reporting_window_days",
        "currency",
        "default_timezone",
        "updated_at",
    )
    readonly_fields = ("updated_at",)


class SocialAccountSyncLogInline(admin.TabularInline):
    model = SocialAccountSyncLog
    extra = 0
    can_delete = False
    fields = ("status", "message", "missing_metrics", "coverage_start", "coverage_end", "created_at")
    readonly_fields = fields
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None):
        return False


class SocialAccountShareInline(admin.TabularInline):
    model = SocialAccountShare
    extra = 0
    fields = ("staff", "permissions", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "platform_display",
        "display_name",
        "username",
        "status",
        "sync_status",
        "followers",
        "is_default_publishing",
        "enabled_for_distribution",
        "token_state",
        "last_synced_at",
    )
    list_filter = ("platform", "status", "sync_status", "is_default_publishing", "enabled_for_distribution")
    search_fields = ("display_name", "username", "account_id", "label")
    ordering = ("platform", "-is_default_publishing", "display_name")

    inlines = [SocialAccountSyncLogInline, SocialAccountShareInline]

    readonly_fields = (
        "created_at",
        "updated_at",
        "connected_at",
        "last_synced_at",
        "last_failed_sync_at",
        "last_auth_check_at",
        "is_token_expired",
        "is_token_expiring_soon",
        "has_access_token",
        "has_refresh_token",
    )

    fieldsets = (
        (
            "Identity",
            {
                "fields": (
                    "platform",
                    "status",
                    "display_name",
                    "username",
                    "account_id",
                    "account_type",
                    "label",
                    "profile_image_url",
                    "followers",
                ),
            },
        ),
        (
            "Authorization",
            {
                "fields": (
                    "connected_at",
                    "token_expires_at",
                    "last_auth_check_at",
                    "is_token_expired",
                    "is_token_expiring_soon",
                    "has_access_token",
                    "has_refresh_token",
                    "scopes",
                    "missing_scopes",
                ),
            },
        ),
        (
            "Publishing & Inbox Capabilities",
            {
                "fields": (
                    "is_default_publishing",
                    "enabled_for_distribution",
                    "publishing_formats",
                    "publishing_restrictions",
                    "supports_dm",
                    "supports_comments",
                    "supports_mentions",
                    "supports_reply",
                    "supports_react",
                    "supports_hide",
                    "supports_moderation",
                    "inbox_capability_note",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Synchronization",
            {
                "fields": (
                    "sync_status",
                    "coverage_start",
                    "coverage_end",
                    "missing_metrics",
                    "last_synced_at",
                    "last_failed_sync_at",
                    "next_sync_at",
                    "error",
                    "metadata",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ("action_sync_now", "mark_disconnected", "clear_error")

    @admin.display(description="Platform", ordering="platform")
    def platform_display(self, obj):
        return obj.get_platform_display()

    @admin.display(description="Token", ordering="token_expires_at")
    def token_state(self, obj) -> str:
        if obj.status != AccountConnectionStatus.CONNECTED:
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

    @admin.action(description="Sync selected accounts now")
    def action_sync_now(self, request, queryset):
        from .services import SocialServiceError, sync_social_account

        synced = 0
        failed = 0
        for acc in queryset:
            try:
                sync_social_account(str(acc.pk), actor=request.user)
                synced += 1
            except SocialServiceError:
                failed += 1
        self.message_user(
            request,
            f"Synced {synced} account(s); {failed} failed.",
            messages.SUCCESS if synced else messages.WARNING,
        )

    @admin.action(description="Mark selected accounts as disconnected")
    def mark_disconnected(self, request, queryset):
        updated = queryset.update(
            status=AccountConnectionStatus.NOT_CONNECTED,
            sync_status=AccountSyncStatus.NEVER,
            access_token="",
            refresh_token="",
            token_expires_at=None,
            is_default_publishing=False,
            enabled_for_distribution=False,
            error="",
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} account(s) disconnected.", messages.SUCCESS)

    @admin.action(description="Clear error on selected accounts")
    def clear_error(self, request, queryset):
        updated = queryset.update(error="", updated_at=timezone.now())
        self.message_user(request, f"{updated} account(s) cleared.", messages.SUCCESS)


@admin.register(SocialOAuthState)
class SocialOAuthStateAdmin(admin.ModelAdmin):
    list_display = ("id", "platform", "state", "reauthorize_account", "initiated_by", "expires_at", "created_at")
    list_filter = ("platform",)
    search_fields = ("state",)
    readonly_fields = ("created_at",)


@admin.register(SocialAccountSyncLog)
class SocialAccountSyncLogAdmin(admin.ModelAdmin):
    list_display = ("id", "account", "status", "coverage_start", "coverage_end", "created_at")
    list_filter = ("status", "account__platform")
    search_fields = ("account__display_name", "message")
    readonly_fields = ("created_at",)


@admin.register(SocialAccountShare)
class SocialAccountShareAdmin(admin.ModelAdmin):
    list_display = ("id", "account", "staff", "permissions", "updated_at")
    search_fields = ("account__display_name", "staff__username", "staff__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialContentCategory)
class SocialContentCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "created_at")
    search_fields = ("name", "slug")
    ordering = ("name",)
    readonly_fields = ("created_at",)


@admin.register(SocialMediaFolder)
class SocialMediaFolderAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent", "created_at")
    search_fields = ("name", "slug")
    ordering = ("name",)
    readonly_fields = ("created_at",)


@admin.register(SocialMedia)
class SocialMediaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "kind",
        "source",
        "folder",
        "mime_type",
        "size_bytes",
        "dimensions",
        "created_at",
    )
    list_filter = ("kind", "source", "folder")
    search_fields = ("name", "mime_type", "url")
    ordering = ("-created_at",)
    readonly_fields = ("size_bytes", "created_at")

    @admin.display(description="Dimensions")
    def dimensions(self, obj):
        if obj.width and obj.height:
            return f"{obj.width}×{obj.height}"
        return "—"


class SocialCampaignProductInline(admin.TabularInline):
    model = SocialCampaignProduct
    extra = 0
    fields = ("product_id", "orders", "units_sold", "revenue", "created_at")
    readonly_fields = ("created_at",)


class SocialCampaignContentInline(admin.TabularInline):
    model = SocialCampaignContent
    extra = 0
    fields = ("content", "publication_status", "reach", "impressions", "views", "engagement", "clicks")


class SocialCampaignAlertInline(admin.TabularInline):
    model = SocialCampaignAlert
    extra = 0
    fields = ("type", "severity", "message", "is_resolved", "created_at")
    readonly_fields = ("created_at",)


@admin.register(SocialCampaign)
class SocialCampaignAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "type",
        "objective",
        "status",
        "start_date",
        "end_date",
        "owner",
        "planned_budget",
        "actual_spend",
        "attributed_revenue",
        "roas",
    )
    list_filter = ("status", "type", "objective")
    search_fields = ("name", "description", "utm_campaign", "discount_id")
    ordering = ("-created_at",)
    date_hierarchy = "start_date"

    inlines = [SocialCampaignProductInline, SocialCampaignContentInline, SocialCampaignAlertInline]

    readonly_fields = ("created_at", "updated_at", "last_synced_at")

    fieldsets = (
        (
            "General",
            {
                "fields": (
                    "name",
                    "description",
                    "objective",
                    "type",
                    "status",
                    "start_date",
                    "end_date",
                    "owner",
                    "internal_notes",
                ),
            },
        ),
        (
            "Platforms & Accounts",
            {
                "fields": ("platforms", "accounts"),
            },
        ),
        (
            "Promotion",
            {
                "fields": (
                    "discount_id",
                    "promotional_message",
                    "promotional_url",
                    "offer_start",
                    "offer_end",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Financials & Advertising",
            {
                "fields": (
                    "planned_budget",
                    "actual_spend",
                    "attributed_revenue",
                    "advertising_cost",
                    "creator_commission",
                    "currency",
                    "roas",
                    "profitability",
                    "profitability_valid",
                    "advertising_platform",
                    "advertising_account",
                    "advertising_external_id",
                    "advertising_metrics_available",
                    "advertising_note",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Tracking & Performance",
            {
                "fields": (
                    "utm_source",
                    "utm_medium",
                    "utm_campaign",
                    "tracking_link",
                    "conversion_attribution",
                    "reach",
                    "impressions",
                    "views",
                    "engagement",
                    "link_clicks",
                    "website_visits",
                    "add_to_cart",
                    "orders",
                    "attributed_orders",
                    "unattributed_orders",
                    "organic_metrics",
                    "paid_metrics",
                    "last_synced_at",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ("action_pause", "action_complete", "action_evaluate_alerts")

    @admin.action(description="Pause selected active campaigns")
    def action_pause(self, request, queryset):
        updated = queryset.filter(status=CampaignStatus.ACTIVE).update(
            status=CampaignStatus.PAUSED,
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} campaign(s) paused.", messages.SUCCESS)

    @admin.action(description="Mark selected campaigns completed")
    def action_complete(self, request, queryset):
        updated = queryset.exclude(status=CampaignStatus.CANCELLED).update(
            status=CampaignStatus.COMPLETED,
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} campaign(s) completed.", messages.SUCCESS)

    @admin.action(description="Re-evaluate alerts for selected campaigns")
    def action_evaluate_alerts(self, request, queryset):
        from .services import evaluate_campaign_alerts

        count = 0
        for campaign in queryset:
            evaluate_campaign_alerts(campaign)
            count += 1
        self.message_user(request, f"Evaluated alerts for {count} campaign(s).", messages.SUCCESS)


class SocialContentMediaInline(admin.TabularInline):
    model = SocialContentMedia
    extra = 0
    fields = ("media", "sort_order")
    ordering = ("sort_order", "id")


class SocialContentProductInline(admin.TabularInline):
    model = SocialContentProduct
    extra = 0
    fields = ("product_id", "sort_order", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("sort_order", "id")


class SocialContentApprovalLogInline(admin.TabularInline):
    model = SocialContentApprovalLog
    extra = 0
    fields = ("action", "actor", "reason", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(SocialContent)
class SocialContentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "content_type",
        "status",
        "category",
        "campaign",
        "owner",
        "reviewer",
        "updated_at",
    )
    list_filter = ("status", "content_type", "category")
    search_fields = ("title", "caption", "description")
    ordering = ("-updated_at",)

    inlines = [SocialContentMediaInline, SocialContentProductInline, SocialContentApprovalLogInline]

    readonly_fields = ("created_at", "updated_at")

    actions = ("action_approve", "action_reject")

    @admin.action(description="Approve selected content")
    def action_approve(self, request, queryset):
        updated = queryset.update(
            status=ContentStatus.APPROVED,
            reviewer=request.user,
            rejection_reason="",
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} item(s) approved.", messages.SUCCESS)

    @admin.action(description="Reject selected content")
    def action_reject(self, request, queryset):
        updated = queryset.update(
            status=ContentStatus.REJECTED,
            reviewer=request.user,
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} item(s) rejected.", messages.SUCCESS)


@admin.register(SocialContentApprovalLog)
class SocialContentApprovalLogAdmin(admin.ModelAdmin):
    list_display = ("id", "content", "action", "actor", "created_at")
    list_filter = ("action",)
    search_fields = ("content__title", "reason")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


@admin.register(SocialCampaignAlert)
class SocialCampaignAlertAdmin(admin.ModelAdmin):
    list_display = ("id", "campaign", "type", "severity", "is_resolved", "created_at")
    list_filter = ("type", "severity", "is_resolved")
    search_fields = ("campaign__name", "message")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


class SocialScheduledPostHistoryInline(admin.TabularInline):
    model = SocialScheduledPostHistory
    extra = 0
    fields = ("status", "actor", "message", "published_url", "is_retry", "retry_success", "created_at")
    readonly_fields = fields
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(SocialScheduledPost)
class SocialScheduledPostAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "content_title",
        "platform",
        "account",
        "status",
        "scheduled_at",
        "published_at",
        "is_manual_reminder",
        "views",
        "reach",
        "likes",
        "attributed_orders",
    )
    list_filter = ("platform", "status", "is_manual_reminder")
    search_fields = ("content_title", "caption", "published_post_id", "account__display_name")
    ordering = ("-scheduled_at",)
    date_hierarchy = "scheduled_at"

    inlines = [SocialScheduledPostHistoryInline]

    readonly_fields = (
        "attempt_at",
        "published_at",
        "last_error_at",
        "metrics_synced_at",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "Content & Target",
            {
                "fields": (
                    "content",
                    "content_title",
                    "content_type",
                    "thumbnail_url",
                    "caption",
                    "platform",
                    "account",
                    "campaign",
                    "owner",
                    "approver",
                ),
            },
        ),
        (
            "Scheduling & Status",
            {
                "fields": (
                    "status",
                    "scheduled_at",
                    "timezone",
                    "is_manual_reminder",
                    "attempt_at",
                    "published_at",
                    "published_post_id",
                    "published_url",
                    "failure_reason",
                    "last_error_at",
                    "platform_response",
                ),
            },
        ),
        (
            "Metrics & Attribution",
            {
                "fields": (
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
                    "attributed_orders",
                    "attributed_revenue",
                    "metrics_synced_at",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    actions = ("action_publish_now", "action_cancel_posts", "action_reschedule_plus_day")

    @admin.action(description="Publish selected posts now")
    def action_publish_now(self, request, queryset):
        from .tasks import publish_post

        enqueued = 0
        for post in queryset.exclude(status__in=[PublishStatus.PUBLISHED, PublishStatus.CANCELLED]):
            try:
                publish_post.delay(post.pk)
                enqueued += 1
            except Exception:
                self.message_user(request, f"Failed to enqueue post #{post.pk}.", messages.ERROR)
        if enqueued:
            self.message_user(request, f"{enqueued} post(s) queued for publishing.", messages.SUCCESS)

    @admin.action(description="Cancel selected scheduled posts")
    def action_cancel_posts(self, request, queryset):
        updated = queryset.filter(
            status__in=[
                PublishStatus.DRAFT,
                PublishStatus.PENDING_APPROVAL,
                PublishStatus.APPROVED,
                PublishStatus.SCHEDULED,
                PublishStatus.QUEUED,
            ]
        ).update(status=PublishStatus.CANCELLED, updated_at=timezone.now())
        self.message_user(request, f"{updated} post(s) cancelled.", messages.SUCCESS)

    @admin.action(description="Move scheduled_at +1 day on selected posts")
    def action_reschedule_plus_day(self, request, queryset):
        updated = 0
        for post in queryset.filter(status=PublishStatus.SCHEDULED):
            post.scheduled_at = post.scheduled_at + timedelta(days=1)
            post.save(update_fields=["scheduled_at", "updated_at"])
            updated += 1
        self.message_user(request, f"{updated} post(s) rescheduled +1 day.", messages.SUCCESS)


@admin.register(SocialScheduledPostHistory)
class SocialScheduledPostHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "scheduled_post", "status", "actor", "is_retry", "retry_success", "created_at")
    list_filter = ("status", "is_retry", "retry_success")
    search_fields = ("scheduled_post__content_title", "message")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


@admin.register(SocialQueueSlot)
class SocialQueueSlotAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kind", "time_of_day", "timezone", "is_active", "created_at")
    list_filter = ("kind", "is_active")
    search_fields = ("name",)
    ordering = ("time_of_day",)
    readonly_fields = ("created_at",)


@admin.register(SocialEvergreenPost)
class SocialEvergreenPostAdmin(admin.ModelAdmin):
    list_display = ("id", "short_caption", "use_count", "last_used_at", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("caption", "product_id")
    ordering = ("last_used_at", "created_at")
    readonly_fields = ("last_used_at", "use_count", "created_at")

    @admin.display(description="Caption")
    def short_caption(self, obj):
        return short_caption(obj)


class SocialInboxMessageInline(admin.TabularInline):
    model = SocialInboxMessage
    extra = 0
    fields = ("direction", "author", "author_name", "body", "reaction", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("created_at",)


@admin.register(SocialInboxConversation)
class SocialInboxConversationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "platform",
        "type",
        "customer_display_name",
        "customer_username",
        "status",
        "sentiment",
        "unread",
        "assigned_to",
        "last_interaction_at",
    )
    list_filter = ("platform", "type", "status", "sentiment", "unread")
    search_fields = ("customer_display_name", "customer_username", "preview", "related_post_title")
    ordering = ("-last_interaction_at",)
    date_hierarchy = "last_interaction_at"

    inlines = [SocialInboxMessageInline]

    readonly_fields = ("first_response_at", "resolved_at", "archived_at", "created_at", "updated_at")

    actions = ("action_resolve", "action_archive", "action_assign_to_me")

    @admin.action(description="Mark selected conversations resolved")
    def action_resolve(self, request, queryset):
        updated = queryset.update(
            status=ConversationStatus.RESOLVED,
            unread=False,
            resolved_at=timezone.now(),
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} conversation(s) resolved.", messages.SUCCESS)

    @admin.action(description="Archive selected conversations")
    def action_archive(self, request, queryset):
        updated = queryset.update(
            status=ConversationStatus.ARCHIVED,
            unread=False,
            archived_at=timezone.now(),
            updated_at=timezone.now(),
        )
        self.message_user(request, f"{updated} conversation(s) archived.", messages.SUCCESS)

    @admin.action(description="Assign selected conversations to me")
    def action_assign_to_me(self, request, queryset):
        updated = queryset.update(assigned_to=request.user, updated_at=timezone.now())
        self.message_user(request, f"{updated} conversation(s) assigned to you.", messages.SUCCESS)


@admin.register(SocialInboxMessage)
class SocialInboxMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "direction", "author_name", "reaction", "created_at")
    list_filter = ("direction",)
    search_fields = ("body", "author_name")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


@admin.register(SocialInboxTemplate)
class SocialInboxTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "key", "label", "is_active", "created_by", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("key", "label", "body")
    ordering = ("label",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "short_code", "destination", "campaign", "clicks", "created_by", "created_at")
    search_fields = ("short_code", "destination")
    ordering = ("-created_at",)
    readonly_fields = ("short_code", "clicks", "created_at", "updated_at")


@admin.register(SocialAttributionEvent)
class SocialAttributionEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "event_type",
        "platform",
        "campaign",
        "product_id",
        "order_id",
        "units",
        "revenue",
        "is_verified_paid",
        "occurred_at",
    )
    list_filter = ("event_type", "platform", "is_verified_paid", "is_assisted", "is_direct")
    search_fields = ("session_id", "product_id", "order_id", "utm_campaign")
    ordering = ("-occurred_at",)
    date_hierarchy = "occurred_at"


@admin.register(SocialPlatformDailyMetric)
class SocialPlatformDailyMetricAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "platform",
        "account",
        "date",
        "followers",
        "follower_growth",
        "reach",
        "impressions",
        "views",
        "engagement",
        "link_clicks",
    )
    list_filter = ("platform",)
    search_fields = ("account__display_name", "account__username")
    ordering = ("-date", "platform")
    date_hierarchy = "date"
    readonly_fields = ("updated_at",)


@admin.register(SocialFollowerSnapshot)
class SocialFollowerSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "platform", "account", "date", "followers")
    list_filter = ("platform",)
    search_fields = ("account__username", "account__display_name")
    ordering = ("-date", "platform")
    date_hierarchy = "date"
    readonly_fields = ("account", "platform", "date", "followers")

    actions = ("action_snapshot_now",)

    @admin.action(description="Run follower snapshot now")
    def action_snapshot_now(self, request, queryset):
        from .tasks import snapshot_followers

        try:
            written = snapshot_followers()
            self.message_user(request, f"Follower snapshot complete — {written} row(s) written.", messages.SUCCESS)
        except Exception as exc:
            self.message_user(request, f"Snapshot failed: {exc}", messages.ERROR)


@admin.register(SocialEngagementSnapshot)
class SocialEngagementSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "platform", "reach", "engagement", "engagement_rate_display", "updated_at")
    list_filter = ("platform",)
    ordering = ("platform",)
    readonly_fields = ("updated_at", "engagement_rate_display")

    actions = ("action_snapshot_now",)

    @admin.display(description="Engagement rate")
    def engagement_rate_display(self, obj):
        return f"{obj.engagement_rate:.2f}%"

    @admin.action(description="Rebuild engagement rollup now")
    def action_snapshot_now(self, request, queryset):
        from .tasks import snapshot_engagement

        try:
            written = snapshot_engagement()
            self.message_user(request, f"Engagement rollup complete — {written} row(s) written.", messages.SUCCESS)
        except Exception as exc:
            self.message_user(request, f"Rollup failed: {exc}", messages.ERROR)


@admin.register(SocialDemographicSnapshot)
class SocialDemographicSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "platform", "date", "updated_at")
    list_filter = ("platform",)
    ordering = ("-date",)
    date_hierarchy = "date"
    readonly_fields = ("updated_at",)


@admin.register(SocialBestTimePost)
class SocialBestTimePostAdmin(admin.ModelAdmin):
    list_display = ("id", "platform", "day_of_week", "hour", "score", "sample_size", "updated_at")
    list_filter = ("platform", "day_of_week")
    ordering = ("platform", "day_of_week", "hour")
    readonly_fields = ("updated_at",)


@admin.register(SocialNotification)
class SocialNotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "notification_type",
        "severity",
        "title",
        "is_read",
        "is_resolved",
        "recipient",
        "created_at",
    )
    list_filter = ("notification_type", "severity", "is_read", "is_resolved")
    search_fields = ("title", "message")
    ordering = ("-created_at",)
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


@admin.register(SocialActivityLog)
class SocialActivityLogAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "title", "platform", "status", "occurred_at")
    list_filter = ("kind", "platform")
    search_fields = ("title",)
    ordering = ("-occurred_at",)
    date_hierarchy = "occurred_at"


@admin.register(SocialAuditLog)
class SocialAuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "actor", "target_type", "target_id", "created_at")
    list_filter = ("action", "target_type")
    search_fields = ("action", "target_id", "actor__username")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("actor", "action", "target_type", "target_id", "details", "created_at")


@admin.register(SocialTeamMember)
class SocialTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role", "is_active", "invited_at", "joined_at")
    list_filter = ("role", "is_active")
    search_fields = ("user__username", "user__email")
    ordering = ("role", "user__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialReport)
class SocialReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "report_type",
        "format",
        "date_from",
        "date_to",
        "created_by",
        "generated_at",
        "created_at",
    )
    list_filter = ("format", "report_type")
    search_fields = ("name", "report_type")
    ordering = ("-created_at",)
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
                self.message_user(request, f"Failed to enqueue report #{report.pk}.", messages.ERROR)
        if enqueued:
            self.message_user(request, f"{enqueued} report(s) queued for regeneration.", messages.SUCCESS)


admin.site.site_header = "SokoFlow Admin"
admin.site.site_title = "SokoFlow Admin"
admin.site.index_title = "Dashboard"