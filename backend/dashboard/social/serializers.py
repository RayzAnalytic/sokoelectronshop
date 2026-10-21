from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from .models import (
    PLATFORM_FROM_FRONTEND,
    ApprovalDecision,
    DraftStatus,
    InboxItemStatus,
    InboxItemType,
    MediaType,
    NotificationType,
    QueueSlotKind,
    ReportFormat,
    Sentiment,
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
    TeamRole,
)


PLATFORM_TO_WIRE: dict[str, str] = {
    SocialPlatform.FACEBOOK.value:  "Facebook",
    SocialPlatform.INSTAGRAM.value: "Instagram",
    SocialPlatform.TIKTOK.value:    "TikTok",
    SocialPlatform.YOUTUBE.value:   "YouTube",
}


def to_wire(platform_db: str) -> str:
    return PLATFORM_TO_WIRE.get(platform_db, platform_db)


def to_db(platform_wire: str) -> str:
    if not platform_wire:
        return ""
    if platform_wire in PLATFORM_TO_WIRE:
        return platform_wire
    return PLATFORM_FROM_FRONTEND.get(platform_wire.lower(), platform_wire.upper())


def _abs_url(obj, request) -> str | None:
    if not obj or not getattr(obj, "file", None):
        return None
    url = obj.file.url
    return request.build_absolute_uri(url) if request is not None else url


class SocialAccountSerializer(serializers.ModelSerializer):
    id         = serializers.SerializerMethodField()
    name       = serializers.CharField(source="display_name", read_only=True)
    handle     = serializers.CharField(read_only=True)
    connected  = serializers.BooleanField(source="is_connected", read_only=True)
    avatarBg   = serializers.CharField(source="avatar_bg", read_only=True)
    avatarUrl  = serializers.URLField(source="avatar_url", read_only=True)
    followers  = serializers.IntegerField(read_only=True)

    class Meta:
        model  = SocialAccount
        fields = [
            "id", "name", "handle", "connected", "avatarBg",
            "avatarUrl", "followers",
        ]
        read_only_fields = fields

    def get_id(self, obj) -> str:
        return to_wire(obj.platform)


class SocialAccountDetailSerializer(serializers.ModelSerializer):
    id               = serializers.SerializerMethodField()
    platform         = serializers.SerializerMethodField()
    display_name     = serializers.CharField(read_only=True)
    is_connected     = serializers.BooleanField(read_only=True)
    is_token_expired = serializers.BooleanField(read_only=True)
    is_token_expiring_soon = serializers.BooleanField(read_only=True)
    scopes           = serializers.JSONField(read_only=True)
    followers        = serializers.IntegerField(read_only=True)

    class Meta:
        model  = SocialAccount
        fields = [
            "id", "platform", "handle", "display_name", "platform_user_id",
            "is_connected", "is_token_expired", "is_token_expiring_soon",
            "connected_at", "token_expires_at", "last_synced_at",
            "scopes", "followers", "avatar_url", "last_error",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_id(self, obj) -> str:
        return to_wire(obj.platform)

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class SocialMediaFolderSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(source="parent.id", read_only=True)

    class Meta:
        model  = SocialMediaFolder
        fields = ["id", "name", "slug", "parent_id", "created_at"]
        read_only_fields = ["id", "created_at"]


class SocialMediaSerializer(serializers.ModelSerializer):
    url              = serializers.SerializerMethodField()
    name             = serializers.CharField(source="filename", read_only=True)
    size             = serializers.IntegerField(source="size_bytes", read_only=True)
    type             = serializers.SerializerMethodField()
    tags             = serializers.JSONField(read_only=True)
    folder_id        = serializers.IntegerField(source="folder.id", read_only=True)
    durationSeconds  = serializers.FloatField(source="duration_seconds", read_only=True)
    usedIn           = serializers.SerializerMethodField()

    class Meta:
        model  = SocialMedia
        fields = [
            "id", "url", "type", "name", "size", "media_type", "sort_order",
            "title", "tags", "folder_id", "width", "height",
            "durationSeconds", "usedIn", "created_at",
        ]
        read_only_fields = fields

    def get_url(self, obj) -> str:
        return _abs_url(obj, self.context.get("request")) or ""

    def get_type(self, obj) -> str:
        return "video" if obj.media_type == MediaType.VIDEO else "image"

    def get_usedIn(self, obj) -> list[int]:
        return list(
            obj.post_id and [obj.post_id] or []
        )


class MediaUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError("File exceeds 25 MB limit.")
        content_type = (getattr(value, "content_type", "") or "").lower()
        if not (content_type.startswith("image/") or content_type.startswith("video/")):
            raise serializers.ValidationError(
                "Only image/* and video/* uploads are accepted."
            )
        return value


class SocialPostTargetSerializer(serializers.ModelSerializer):
    platform        = serializers.SerializerMethodField()
    totalEngagement = serializers.IntegerField(source="total_engagement", read_only=True)
    engagementRate  = serializers.FloatField(source="engagement_rate", read_only=True)

    class Meta:
        model  = SocialPostTarget
        fields = [
            "id", "platform", "status",
            "platform_post_id", "platform_url", "error_message",
            "likes", "comments", "shares", "reach", "impressions",
            "saves", "video_views", "watch_time_sec",
            "link_clicks", "profile_visits", "follower_delta",
            "totalEngagement", "engagementRate",
            "metrics_synced_at", "published_at",
        ]
        read_only_fields = fields

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class ScheduledPostSerializer(serializers.ModelSerializer):
    id            = serializers.CharField(read_only=True)
    platforms     = serializers.SerializerMethodField()
    scheduledTime = serializers.DateTimeField(source="scheduled_for", read_only=True)
    mediaUrl      = serializers.SerializerMethodField()
    productTag    = serializers.CharField(source="product_tag", read_only=True)
    campaign      = serializers.CharField(read_only=True)
    status        = serializers.CharField(read_only=True)

    class Meta:
        model  = SocialPost
        fields = [
            "id", "platforms", "caption", "scheduledTime",
            "mediaUrl", "productTag", "campaign", "status",
        ]
        read_only_fields = fields

    def get_platforms(self, obj) -> list[str]:
        return [to_wire(t.platform) for t in obj.targets.all()]

    def get_mediaUrl(self, obj) -> str | None:
        first = obj.media.first()
        return _abs_url(first, self.context.get("request")) if first else None


class PublishedPostSerializer(serializers.ModelSerializer):
    id          = serializers.CharField(source="post.id", read_only=True)
    platform    = serializers.SerializerMethodField()
    caption     = serializers.CharField(source="post.caption", read_only=True)
    publishedAt = serializers.DateTimeField(source="published_at", read_only=True)
    status      = serializers.CharField(read_only=True)
    errorMessage = serializers.CharField(source="error_message", read_only=True)
    likes       = serializers.IntegerField(read_only=True)
    comments    = serializers.IntegerField(read_only=True)
    shares      = serializers.IntegerField(read_only=True)
    reach       = serializers.IntegerField(read_only=True)
    impressions = serializers.IntegerField(read_only=True)
    saves       = serializers.IntegerField(read_only=True)
    videoViews  = serializers.IntegerField(source="video_views", read_only=True)
    watchTimeSec = serializers.IntegerField(source="watch_time_sec", read_only=True)
    linkClicks  = serializers.IntegerField(source="link_clicks", read_only=True)
    profileVisits = serializers.IntegerField(source="profile_visits", read_only=True)
    followerDelta = serializers.IntegerField(source="follower_delta", read_only=True)
    engagementRate = serializers.FloatField(source="engagement_rate", read_only=True)
    platformUrl = serializers.URLField(source="platform_url", read_only=True)
    platformPostId = serializers.CharField(source="platform_post_id", read_only=True)

    class Meta:
        model  = SocialPostTarget
        fields = [
            "id", "platform", "caption", "publishedAt", "status",
            "errorMessage", "platformUrl", "platformPostId",
            "likes", "comments", "shares", "reach", "impressions",
            "saves", "videoViews", "watchTimeSec",
            "linkClicks", "profileVisits", "followerDelta",
            "engagementRate",
        ]
        read_only_fields = fields

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class SocialPostSerializer(serializers.ModelSerializer):
    targets       = SocialPostTargetSerializer(many=True, read_only=True)
    media         = SocialMediaSerializer(many=True, read_only=True)
    platforms     = serializers.SerializerMethodField()
    productTag    = serializers.CharField(source="product_tag", read_only=True)
    scheduledTime = serializers.DateTimeField(source="scheduled_for", read_only=True)
    publishedAt   = serializers.DateTimeField(source="published_at", read_only=True)
    firstComment  = serializers.CharField(source="first_comment", read_only=True)
    linkUrl       = serializers.URLField(source="link_url", read_only=True)
    linkUtm       = serializers.JSONField(source="link_utm", read_only=True)

    class Meta:
        model  = SocialPost
        fields = [
            "id", "status", "caption", "firstComment", "productTag",
            "campaign", "linkUrl", "linkUtm",
            "scheduledTime", "publishedAt",
            "created_at", "updated_at",
            "platforms", "targets", "media",
        ]
        read_only_fields = fields

    def get_platforms(self, obj) -> list[str]:
        return [to_wire(t.platform) for t in obj.targets.all()]


class PostCreateSerializer(serializers.Serializer):
    caption     = serializers.CharField(allow_blank=False, max_length=5000)
    platforms   = serializers.ListField(
        child=serializers.CharField(), allow_empty=False,
    )
    productTag  = serializers.CharField(
        source="product_tag", required=False, allow_blank=True, max_length=255,
    )
    firstComment = serializers.CharField(
        source="first_comment", required=False, allow_blank=True, max_length=5000,
    )
    campaign    = serializers.CharField(
        required=False, allow_blank=True, max_length=128,
    )
    linkUrl     = serializers.URLField(
        source="link_url", required=False, allow_blank=True,
    )
    linkUtm     = serializers.JSONField(source="link_utm", required=False)
    mediaIds    = serializers.ListField(
        source="media_ids",
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )
    scheduleAt  = serializers.DateTimeField(
        source="schedule_at", required=False, allow_null=True,
    )

    def to_internal_value(self, data):
        data = dict(data)
        for camel, snake in (
            ("productTag", "product_tag"),
            ("firstComment", "first_comment"),
            ("linkUrl", "link_url"),
            ("linkUtm", "link_utm"),
            ("mediaIds", "media_ids"),
            ("scheduleAt", "schedule_at"),
        ):
            if camel in data and snake not in data:
                data[snake] = data[camel]
        return super().to_internal_value(data)

    def validate_platforms(self, value):
        valid = {c for c, _ in SocialPlatform.choices}
        upper = [to_db(p) for p in value]
        bad = [p for p in upper if p not in valid]
        if bad:
            raise serializers.ValidationError(
                f"Unknown platform(s): {', '.join(bad)}. "
                f"Valid: {', '.join(sorted(valid))}."
            )
        seen, out = set(), []
        for p in upper:
            if p not in seen:
                seen.add(p)
                out.append(p)
        return out

    def validate_media_ids(self, value):
        if not value:
            return []
        qs = SocialMedia.objects.filter(id__in=value)
        found = {m.id for m in qs}
        missing = [i for i in value if i not in found]
        if missing:
            raise serializers.ValidationError(
                f"Unknown media id(s): {', '.join(map(str, missing))}."
            )
        return value

    def validate(self, data):
        schedule_at = data.get("schedule_at")
        if schedule_at is not None and schedule_at <= timezone.now():
            raise serializers.ValidationError(
                {"scheduleAt": "Scheduled time must be in the future."}
            )
        return data


class SocialDraftCommentSerializer(serializers.ModelSerializer):
    authorName = serializers.SerializerMethodField()
    authorId   = serializers.IntegerField(source="author.id", read_only=True)

    class Meta:
        model  = SocialDraftComment
        fields = ["id", "authorId", "authorName", "body", "decision", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_authorName(self, obj) -> str:
        if not obj.author_id:
            return ""
        user = obj.author
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")


class SocialDraftSerializer(serializers.ModelSerializer):
    authorId     = serializers.IntegerField(source="author.id", read_only=True)
    authorName   = serializers.SerializerMethodField()
    reviewerId   = serializers.IntegerField(source="reviewer.id", read_only=True)
    reviewerName = serializers.SerializerMethodField()
    comments     = SocialDraftCommentSerializer(many=True, read_only=True)
    platforms    = serializers.JSONField(read_only=True)
    fields       = serializers.JSONField(read_only=True)

    class Meta:
        model  = SocialDraft
        fields = [
            "id", "title", "caption", "platforms", "fields", "status",
            "authorId", "authorName", "reviewerId", "reviewerName",
            "source_post_id", "comments", "last_edited_at", "created_at",
        ]
        read_only_fields = ["id", "last_edited_at", "created_at"]

    def get_authorName(self, obj) -> str:
        if not obj.author_id:
            return ""
        user = obj.author
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")

    def get_reviewerName(self, obj) -> str:
        if not obj.reviewer_id:
            return ""
        user = obj.reviewer
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")


class SocialInboxReplySerializer(serializers.ModelSerializer):
    authorId   = serializers.IntegerField(source="author.id", read_only=True)
    authorName = serializers.SerializerMethodField()
    isOutbound = serializers.BooleanField(source="is_outbound", read_only=True)

    class Meta:
        model  = SocialInboxReply
        fields = ["id", "authorId", "authorName", "body", "isOutbound", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_authorName(self, obj) -> str:
        if not obj.author_id:
            return ""
        user = obj.author
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")


class SocialInboxItemSerializer(serializers.ModelSerializer):
    itemType     = serializers.CharField(source="item_type", read_only=True)
    platform     = serializers.SerializerMethodField()
    authorName   = serializers.CharField(source="author_name", read_only=True)
    authorHandle = serializers.CharField(source="author_handle", read_only=True)
    authorAvatar = serializers.URLField(source="author_avatar", read_only=True)
    assignedTo   = serializers.IntegerField(source="assigned_to.id", read_only=True)
    assignedName = serializers.SerializerMethodField()
    targetId     = serializers.IntegerField(source="target.id", read_only=True)
    postCaption  = serializers.SerializerMethodField()
    replies      = SocialInboxReplySerializer(many=True, read_only=True)
    receivedAt   = serializers.DateTimeField(source="received_at", read_only=True)

    class Meta:
        model  = SocialInboxItem
        fields = [
            "id", "itemType", "status", "sentiment", "platform",
            "authorName", "authorHandle", "authorAvatar",
            "body", "permalink",
            "assignedTo", "assignedName", "targetId", "postCaption",
            "replies", "receivedAt", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)

    def get_assignedName(self, obj) -> str:
        if not obj.assigned_to_id:
            return ""
        user = obj.assigned_to
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")

    def get_postCaption(self, obj) -> str:
        if obj.target_id and obj.target and obj.target.post_id:
            return obj.target.post.caption or ""
        return ""


class SocialTemplateSerializer(serializers.ModelSerializer):
    createdById = serializers.IntegerField(source="created_by.id", read_only=True)
    isShared    = serializers.BooleanField(source="is_shared", read_only=True)

    class Meta:
        model  = SocialTemplate
        fields = [
            "id", "name", "category", "caption", "platforms", "fields",
            "isShared", "createdById", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SocialQueueSlotSerializer(serializers.ModelSerializer):
    timeOfDay = serializers.TimeField(source="time_of_day")
    isActive  = serializers.BooleanField(source="is_active", required=False)
    kind      = serializers.ChoiceField(choices=QueueSlotKind.choices, required=False)

    class Meta:
        model  = SocialQueueSlot
        fields = [
            "id", "name", "kind", "days", "timeOfDay", "timezone",
            "platforms", "isActive", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SocialEvergreenPostSerializer(serializers.ModelSerializer):
    productTag  = serializers.CharField(source="product_tag", required=False, allow_blank=True)
    lastUsedAt  = serializers.DateTimeField(source="last_used_at", read_only=True)
    useCount    = serializers.IntegerField(source="use_count", read_only=True)
    isActive    = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model  = SocialEvergreenPost
        fields = [
            "id", "caption", "platforms", "productTag",
            "lastUsedAt", "useCount", "isActive", "created_at",
        ]
        read_only_fields = ["id", "lastUsedAt", "useCount", "created_at"]


class SocialLinkSerializer(serializers.ModelSerializer):
    shortCode   = serializers.CharField(source="short_code", read_only=True)
    createdById = serializers.IntegerField(source="created_by.id", read_only=True)

    class Meta:
        model  = SocialLink
        fields = [
            "id", "shortCode", "destination", "utm", "clicks",
            "createdById", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "shortCode", "clicks", "created_at", "updated_at"]


class SocialNotificationSerializer(serializers.ModelSerializer):
    notificationType = serializers.CharField(source="notification_type", read_only=True)
    isRead           = serializers.BooleanField(source="is_read", read_only=True)
    createdAt        = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model  = SocialNotification
        fields = [
            "id", "notificationType", "title", "message", "link",
            "isRead", "createdAt",
        ]
        read_only_fields = fields


class SocialAuditLogSerializer(serializers.ModelSerializer):
    actorId     = serializers.IntegerField(source="actor.id", read_only=True)
    actorName   = serializers.SerializerMethodField()
    targetType  = serializers.CharField(source="target_type", read_only=True)
    targetId    = serializers.CharField(source="target_id", read_only=True)
    createdAt   = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model  = SocialAuditLog
        fields = [
            "id", "actorId", "actorName", "action",
            "targetType", "targetId", "details", "createdAt",
        ]
        read_only_fields = fields

    def get_actorName(self, obj) -> str:
        if not obj.actor_id:
            return ""
        user = obj.actor
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")


class SocialTeamMemberSerializer(serializers.ModelSerializer):
    userId     = serializers.IntegerField(source="user.id", read_only=True)
    username   = serializers.CharField(source="user.username", read_only=True)
    email      = serializers.EmailField(source="user.email", read_only=True)
    fullName   = serializers.SerializerMethodField()
    isActive   = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model  = SocialTeamMember
        fields = [
            "id", "userId", "username", "email", "fullName", "role",
            "isActive", "invited_at", "joined_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_fullName(self, obj) -> str:
        user = obj.user
        return getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "")


class SocialReportSerializer(serializers.ModelSerializer):
    dateFrom    = serializers.DateField(source="date_from", read_only=True)
    dateTo      = serializers.DateField(source="date_to", read_only=True)
    fileUrl     = serializers.SerializerMethodField()
    createdById = serializers.IntegerField(source="created_by.id", read_only=True)
    generatedAt = serializers.DateTimeField(source="generated_at", read_only=True)

    class Meta:
        model  = SocialReport
        fields = [
            "id", "name", "dateFrom", "dateTo", "platforms", "metrics",
            "branding", "format", "fileUrl",
            "createdById", "generatedAt", "created_at",
        ]
        read_only_fields = ["id", "fileUrl", "generatedAt", "created_at"]

    def get_fileUrl(self, obj) -> str | None:
        if not obj.file:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class SocialBestTimePostSerializer(serializers.ModelSerializer):
    platform    = serializers.SerializerMethodField()
    dayOfWeek   = serializers.IntegerField(source="day_of_week", read_only=True)
    sampleSize  = serializers.IntegerField(source="sample_size", read_only=True)

    class Meta:
        model  = SocialBestTimePost
        fields = ["id", "platform", "dayOfWeek", "hour", "score", "sampleSize", "updated_at"]
        read_only_fields = fields

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class SocialDemographicSnapshotSerializer(serializers.ModelSerializer):
    platform      = serializers.SerializerMethodField()
    ageBuckets    = serializers.JSONField(source="age_buckets", read_only=True)
    topCities     = serializers.JSONField(source="top_cities", read_only=True)
    topCountries  = serializers.JSONField(source="top_countries", read_only=True)

    class Meta:
        model  = SocialDemographicSnapshot
        fields = [
            "id", "platform", "date", "ageBuckets", "gender",
            "topCities", "topCountries", "updated_at",
        ]
        read_only_fields = fields

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class FollowerSnapshotSerializer(serializers.ModelSerializer):
    platform = serializers.SerializerMethodField()

    class Meta:
        model  = SocialFollowerSnapshot
        fields = ["platform", "date", "followers"]
        read_only_fields = fields

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class FollowerGrowthPointSerializer(serializers.Serializer):
    month     = serializers.CharField()
    Facebook  = serializers.IntegerField()
    Instagram = serializers.IntegerField()
    TikTok    = serializers.IntegerField()
    YouTube   = serializers.IntegerField()


class EngagementPointSerializer(serializers.ModelSerializer):
    platform   = serializers.SerializerMethodField()
    reach      = serializers.IntegerField(read_only=True)
    engagement = serializers.IntegerField(read_only=True)

    class Meta:
        model  = SocialEngagementSnapshot
        fields = ["platform", "reach", "engagement"]
        read_only_fields = fields

    def get_platform(self, obj) -> str:
        return to_wire(obj.platform)


class PostCreatedSerializer(serializers.Serializer):
    id     = serializers.IntegerField()
    status = serializers.CharField()


class PublishNowSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


class SimpleDetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class BulkIdsSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class BulkRescheduleSerializer(serializers.Serializer):
    ids        = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    scheduleAt = serializers.DateTimeField()

    def validate_scheduleAt(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Scheduled time must be in the future.")
        return value


class ConnectResultSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    handle    = serializers.CharField(allow_blank=True)
    authUrl   = serializers.URLField(required=False)


class DisconnectResultSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    handle    = serializers.CharField(allow_blank=True)


class InboxReplyCreateSerializer(serializers.Serializer):
    body = serializers.CharField(allow_blank=False, max_length=5000)


class DraftCreateSerializer(serializers.Serializer):
    title     = serializers.CharField(required=False, allow_blank=True, max_length=255)
    caption   = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    platforms = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True,
    )
    fields    = serializers.JSONField(required=False)

    def validate_platforms(self, value):
        if not value:
            return []
        valid = {c for c, _ in SocialPlatform.choices}
        upper = [to_db(p) for p in value]
        bad = [p for p in upper if p not in valid]
        if bad:
            raise serializers.ValidationError(
                f"Unknown platform(s): {', '.join(bad)}."
            )
        return upper


class DraftCommentCreateSerializer(serializers.Serializer):
    body     = serializers.CharField(allow_blank=False, max_length=5000)
    decision = serializers.ChoiceField(
        choices=ApprovalDecision.choices, required=False, allow_blank=True,
    )