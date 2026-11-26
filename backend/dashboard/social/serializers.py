from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from .models import (
    AccountConnectionStatus,
    AccountSyncStatus,
    ActivityKind,
    AlertSeverity,
    ApprovalAction,
    AttributionEventType,
    AttributionStatus,
    CampaignAlertType,
    CampaignObjective,
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
    QueueSlotKind,
    ReportFormat,
    Sentiment,
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
    SocialPlatform,
    SocialPlatformDailyMetric,
    SocialQueueSlot,
    SocialReport,
    SocialScheduledPost,
    SocialScheduledPostHistory,
    SocialTeamMember,
    SyncLogStatus,
    TeamRole,
)


def _abs_url(field, request) -> str | None:
    if not field:
        return None
    try:
        url = field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request is not None else url


def _user_name(user) -> str:
    if not user:
        return ""
    full = getattr(user, "get_full_name", lambda: "")()
    return full or getattr(user, "username", "") or getattr(user, "email", "")


def _normalize_platform(value: str) -> str:
    v = (value or "").strip().lower()
    valid = {c for c, _ in SocialPlatform.choices}
    if v not in valid:
        raise serializers.ValidationError(f"Unsupported platform: {value}")
    return v


class StaffSummarySerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    def get_name(self, obj) -> str:
        return _user_name(obj)

    def get_avatar_url(self, obj) -> str | None:
        return getattr(obj, "avatar_url", None)


class SocialAnalyticsConfigSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialAnalyticsConfig
        fields = [
            "id",
            "attribution_model",
            "reporting_window_days",
            "currency",
            "default_timezone",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class AccountScopeSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    granted = serializers.BooleanField()


class SocialAccountSyncLogSerializer(serializers.ModelSerializer):
    at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = SocialAccountSyncLog
        fields = ["at", "status", "message", "missing_metrics", "coverage_start", "coverage_end"]
        read_only_fields = fields


class SocialAccountShareSerializer(serializers.ModelSerializer):
    staff_id = serializers.CharField(source="staff.id", read_only=True)
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialAccountShare
        fields = ["staff_id", "staff_name", "permissions"]
        read_only_fields = fields

    def get_staff_name(self, obj) -> str:
        return _user_name(obj.staff)


class SocialAccountSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    sync_history = SocialAccountSyncLogSerializer(source="sync_logs", many=True, read_only=True)
    shares = SocialAccountShareSerializer(many=True, read_only=True)

    class Meta:
        model = SocialAccount
        fields = [
            "id",
            "platform",
            "status",
            "display_name",
            "username",
            "profile_image_url",
            "account_type",
            "account_id",
            "followers",
            "connected_at",
            "last_synced_at",
            "last_failed_sync_at",
            "next_sync_at",
            "error",
            "scopes",
            "missing_scopes",
            "token_expires_at",
            "last_auth_check_at",
            "sync_history",
            "is_default_publishing",
            "enabled_for_distribution",
            "label",
            "shares",
            "publishing_formats",
            "publishing_restrictions",
            "sync_status",
            "coverage_start",
            "coverage_end",
            "missing_metrics",
        ]
        read_only_fields = fields


class SocialAccountListPayloadSerializer(serializers.Serializer):
    accounts = SocialAccountSerializer(many=True)


class SocialAccountStartConnectSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)


class SocialAccountAuthorizeUrlSerializer(serializers.Serializer):
    authorize_url = serializers.URLField()


class SocialAccountUpdateSerializer(serializers.ModelSerializer):
    label = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=128)
    is_default_publishing = serializers.BooleanField(required=False)
    enabled_for_distribution = serializers.BooleanField(required=False)

    class Meta:
        model = SocialAccount
        fields = ["label", "is_default_publishing", "enabled_for_distribution"]

    def validate_label(self, value):
        return value or ""


class SocialAccountShareWriteSerializer(serializers.Serializer):
    staff_id = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField(), allow_empty=True)


class AnalyticsPlatformAccountSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    handle = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = SocialAccount
        fields = [
            "id",
            "platform",
            "handle",
            "name",
            "last_synced_at",
            "coverage_start",
            "coverage_end",
            "sync_status",
            "missing_metrics",
        ]
        read_only_fields = fields

    def get_handle(self, obj) -> str:
        return obj.username or obj.display_name or obj.account_id or ""

    def get_name(self, obj) -> str:
        return obj.display_name or obj.username or obj.get_platform_display()


class OverviewAccountSummarySerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = SocialAccount
        fields = [
            "platform",
            "status",
            "account_name",
            "username",
            "followers",
            "last_synced_at",
            "error",
        ]
        read_only_fields = fields


class CalendarAccountCapabilitySerializer(serializers.ModelSerializer):
    account_id = serializers.CharField(source="id", read_only=True)
    account_name = serializers.SerializerMethodField()
    can_publish = serializers.BooleanField(read_only=True)

    class Meta:
        model = SocialAccount
        fields = [
            "account_id",
            "account_name",
            "platform",
            "status",
            "can_publish",
            "publishing_formats",
            "publishing_restrictions",
        ]
        read_only_fields = fields

    def get_account_name(self, obj) -> str:
        return obj.display_name or obj.username or obj.get_platform_display()


class SocialContentCategorySerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialContentCategory
        fields = ["id", "name", "slug", "created_at"]
        read_only_fields = ["id", "created_at"]


class SocialMediaFolderSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    parent_id = serializers.CharField(source="parent.id", read_only=True, allow_null=True)

    class Meta:
        model = SocialMediaFolder
        fields = ["id", "name", "slug", "parent_id", "created_at"]
        read_only_fields = ["id", "created_at"]


class MediaAssetSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = SocialMedia
        fields = [
            "id",
            "kind",
            "url",
            "thumbnail_url",
            "name",
            "mime_type",
            "width",
            "height",
            "duration_seconds",
            "size_bytes",
            "source",
        ]
        read_only_fields = fields

    def get_url(self, obj) -> str:
        request = self.context.get("request")
        return _abs_url(obj.file, request) or obj.url or ""

    def get_thumbnail_url(self, obj) -> str | None:
        request = self.context.get("request")
        return _abs_url(obj.thumbnail, request) or obj.thumbnail_url or None


class MediaUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    folder_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(), required=False)

    def validate_file(self, value):
        if value.size > 100 * 1024 * 1024:
            raise serializers.ValidationError("File exceeds 100 MB limit.")
        content_type = (getattr(value, "content_type", "") or "").lower()
        if not (content_type.startswith("image/") or content_type.startswith("video/")):
            raise serializers.ValidationError("Only image/* and video/* uploads are accepted.")
        return value


class LinkedProductSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    image_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    sku = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    price = serializers.FloatField(required=False, allow_null=True)
    currency = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    in_stock = serializers.BooleanField(required=False, allow_null=True)
    url = serializers.URLField(required=False, allow_null=True, allow_blank=True)


class PlatformConfigSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    youtube_title = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    youtube_description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    youtube_tags = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)
    youtube_visibility = serializers.ChoiceField(
        choices=[("public", "Public"), ("unlisted", "Unlisted"), ("private", "Private")],
        required=False,
        allow_null=True,
    )
    youtube_thumbnail_asset_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    facebook_post_text = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    facebook_link_url = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    facebook_reel = serializers.BooleanField(required=False, allow_null=True)
    instagram_caption = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    instagram_format = serializers.ChoiceField(
        choices=[("post", "Post"), ("reel", "Reel"), ("story", "Story")],
        required=False,
        allow_null=True,
    )
    instagram_cover_asset_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    instagram_hashtags = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)
    tiktok_caption = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    tiktok_photo_post = serializers.BooleanField(required=False, allow_null=True)
    tiktok_privacy = serializers.ChoiceField(
        choices=[("public", "Public"), ("friends", "Friends"), ("private", "Private")],
        required=False,
        allow_null=True,
    )
    tiktok_comments_enabled = serializers.BooleanField(required=False, allow_null=True)
    tiktok_duet_enabled = serializers.BooleanField(required=False, allow_null=True)
    tiktok_stitch_enabled = serializers.BooleanField(required=False, allow_null=True)
    tiktok_commercial_disclosure = serializers.BooleanField(required=False, allow_null=True)


class SocialContentApprovalLogSerializer(serializers.ModelSerializer):
    at = serializers.DateTimeField(source="created_at", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialContentApprovalLog
        fields = ["at", "actor_name", "action", "reason"]
        read_only_fields = fields

    def get_actor_name(self, obj) -> str:
        return _user_name(obj.actor) or "System"


class ContentDraftSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    category = serializers.CharField(source="category.id", read_only=True, allow_null=True)
    campaign_id = serializers.CharField(source="campaign.id", read_only=True, allow_null=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True, allow_null=True)
    owner_id = serializers.CharField(source="owner.id", read_only=True, allow_null=True)
    owner_name = serializers.SerializerMethodField()
    media = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()
    approval_history = SocialContentApprovalLogSerializer(many=True, read_only=True)

    class Meta:
        model = SocialContent
        fields = [
            "id",
            "title",
            "caption",
            "description",
            "internal_notes",
            "content_type",
            "category",
            "campaign_id",
            "campaign_name",
            "owner_id",
            "owner_name",
            "media",
            "platforms",
            "platform_configs",
            "products",
            "status",
            "created_at",
            "updated_at",
            "approval_history",
            "rejection_reason",
        ]
        read_only_fields = fields

    def get_owner_name(self, obj) -> str | None:
        return _user_name(obj.owner) or None

    def get_media(self, obj) -> list[dict]:
        links = obj.content_media_links.select_related("media").order_by("sort_order", "id")
        assets = [link.media for link in links]
        return MediaAssetSerializer(assets, many=True, context=self.context).data

    def get_products(self, obj) -> list[dict]:
        product_map = self.context.get("product_map", {})
        out = []
        for link in obj.linked_products.all().order_by("sort_order", "id"):
            info = product_map.get(str(link.product_id))
            if info:
                out.append(info)
            else:
                out.append({"id": str(link.product_id), "name": f"Product #{link.product_id}"})
        return out


class ContentDraftSaveSerializer(serializers.Serializer):
    id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    caption = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    content_type = serializers.ChoiceField(choices=ContentType.choices, default=ContentType.IMAGE)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    campaign_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    owner_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    platforms = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    platform_configs = serializers.DictField(required=False)
    media = serializers.ListField(child=serializers.DictField(), required=False, allow_empty=True)
    products = serializers.ListField(child=serializers.DictField(), required=False, allow_empty=True)

    def validate_platforms(self, value):
        seen, out = set(), []
        for item in value:
            p = _normalize_platform(item)
            if p not in seen:
                seen.add(p)
                out.append(p)
        return out

    def validate_platform_configs(self, value):
        cleaned = {}
        for k, v in (value or {}).items():
            p = _normalize_platform(k)
            ser = PlatformConfigSerializer(data={**(v or {}), "platform": p})
            ser.is_valid(raise_exception=True)
            cleaned[p] = ser.validated_data
        return cleaned


class ContentApprovalActionSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=False, max_length=2000)


class ContentScheduleActionSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()


class ContentSuggestRequestSerializer(serializers.Serializer):
    field = serializers.ChoiceField(
        choices=[
            ("caption", "Caption"),
            ("hashtags", "Hashtags"),
            ("description", "Description"),
            ("cta", "CTA"),
            ("ideas", "Ideas"),
            ("variation", "Variation"),
        ]
    )
    context = serializers.CharField(allow_blank=True, max_length=4000)
    platform = serializers.ChoiceField(choices=SocialPlatform.choices, required=False, allow_null=True)


class ContentSuggestResponseSerializer(serializers.Serializer):
    suggestions = serializers.ListField(child=serializers.CharField())


class ContentRefSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialContent
        fields = ["id", "title", "content_type", "platforms"]
        read_only_fields = fields


class CampaignAlertSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialCampaignAlert
        fields = ["id", "type", "message", "severity", "created_at"]
        read_only_fields = fields


class CampaignContentSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="content.id", read_only=True)
    title = serializers.CharField(source="content.title", read_only=True)
    type = serializers.SerializerMethodField()
    platform = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = SocialCampaignContent
        fields = [
            "id",
            "title",
            "type",
            "platform",
            "status",
            "thumbnail_url",
            "url",
            "publication_status",
            "reach",
            "impressions",
            "views",
            "engagement",
            "clicks",
        ]
        read_only_fields = fields

    def get_type(self, obj) -> str:
        ct = obj.content.content_type
        if ct in (ContentType.VIDEO, ContentType.REEL, ContentType.SHORT):
            return "video"
        if ct == ContentType.IMAGE:
            return "image"
        if obj.content.status == ContentStatus.DRAFT:
            return "draft"
        return "post"

    def get_platform(self, obj) -> str:
        platforms = obj.content.platforms or []
        if len(platforms) == 1:
            return platforms[0]
        return "multi"

    def get_status(self, obj) -> str:
        st = obj.content.status
        if st in (ContentStatus.PUBLISHED, ContentStatus.SCHEDULED, ContentStatus.DRAFT):
            return st
        return "draft"

    def get_thumbnail_url(self, obj) -> str | None:
        link = obj.content.content_media_links.select_related("media").order_by("sort_order", "id").first()
        if not link:
            return None
        request = self.context.get("request")
        return _abs_url(link.media.thumbnail, request) or _abs_url(link.media.file, request) or link.media.thumbnail_url or link.media.url or None

    def get_url(self, obj) -> str | None:
        post = obj.content.scheduled_posts.filter(status=PublishStatus.PUBLISHED).exclude(published_url="").first()
        return post.published_url if post else None


class CampaignProductSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="product_id", read_only=True)
    name = serializers.SerializerMethodField()
    sku = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    revenue = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False, read_only=True)

    class Meta:
        model = SocialCampaignProduct
        fields = [
            "id",
            "name",
            "sku",
            "price",
            "currency",
            "image_url",
            "in_stock",
            "stock_quantity",
            "category",
            "revenue",
            "orders",
            "units_sold",
        ]
        read_only_fields = fields

    def _info(self, obj) -> dict:
        return self.context.get("product_map", {}).get(str(obj.product_id), {})

    def get_name(self, obj) -> str:
        return self._info(obj).get("name") or f"Product #{obj.product_id}"

    def get_sku(self, obj) -> str:
        return self._info(obj).get("sku") or ""

    def get_price(self, obj) -> float:
        val = self._info(obj).get("price")
        return float(val) if val is not None else 0.0

    def get_currency(self, obj) -> str:
        return self._info(obj).get("currency") or "KES"

    def get_image_url(self, obj) -> str | None:
        return self._info(obj).get("image_url")

    def get_in_stock(self, obj) -> bool:
        return bool(self._info(obj).get("in_stock", True))

    def get_stock_quantity(self, obj) -> int | None:
        return self._info(obj).get("stock_quantity")

    def get_category(self, obj) -> str | None:
        return self._info(obj).get("category")


class CampaignSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    owner = StaffSummarySerializer(read_only=True)
    accounts = serializers.SerializerMethodField()
    products = CampaignProductSerializer(source="campaign_products", many=True, read_only=True)
    content = CampaignContentSerializer(source="campaign_contents", many=True, read_only=True)
    discount = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()
    advertising = serializers.SerializerMethodField()
    performance = serializers.SerializerMethodField()
    tracking = serializers.SerializerMethodField()
    alerts = CampaignAlertSerializer(many=True, read_only=True)

    class Meta:
        model = SocialCampaign
        fields = [
            "id",
            "name",
            "description",
            "objective",
            "type",
            "status",
            "start_date",
            "end_date",
            "owner",
            "internal_notes",
            "platforms",
            "accounts",
            "products",
            "content",
            "discount_id",
            "discount",
            "promotional_message",
            "promotional_url",
            "offer_start",
            "offer_end",
            "budget",
            "advertising",
            "performance",
            "tracking",
            "alerts",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_accounts(self, obj) -> list[dict]:
        return [
            {
                "platform": acc.platform,
                "account_name": acc.display_name or acc.username or acc.get_platform_display(),
                "account_id": str(acc.id),
            }
            for acc in obj.accounts.all()
        ]

    def get_discount(self, obj) -> dict | None:
        if not obj.discount_id:
            return None
        return self.context.get("discount_map", {}).get(str(obj.discount_id))

    def get_budget(self, obj) -> dict:
        return {
            "planned_budget": float(obj.planned_budget) if obj.planned_budget is not None else None,
            "actual_spend": float(obj.actual_spend) if obj.actual_spend is not None else None,
            "attributed_revenue": float(obj.attributed_revenue) if obj.attributed_revenue is not None else None,
            "advertising_cost": float(obj.advertising_cost) if obj.advertising_cost is not None else None,
            "creator_commission": float(obj.creator_commission) if obj.creator_commission is not None else None,
            "currency": obj.currency,
            "roas": obj.roas,
            "profitability": float(obj.profitability) if obj.profitability is not None else None,
            "profitability_valid": obj.profitability_valid,
        }

    def get_advertising(self, obj) -> dict | None:
        if not obj.advertising_platform and not obj.advertising_account and not obj.advertising_external_id:
            return None
        return {
            "platform": obj.advertising_platform or None,
            "account": obj.advertising_account or None,
            "external_id": obj.advertising_external_id or None,
            "metrics_available": obj.advertising_metrics_available,
            "note": obj.advertising_note or None,
        }

    def get_performance(self, obj) -> dict:
        return {
            "reach": obj.reach,
            "impressions": obj.impressions,
            "views": obj.views,
            "engagement": obj.engagement,
            "link_clicks": obj.link_clicks,
            "website_visits": obj.website_visits,
            "add_to_cart": obj.add_to_cart,
            "orders": obj.orders,
            "attributed_revenue": float(obj.attributed_revenue) if obj.attributed_revenue is not None else None,
            "unattributed_orders": obj.unattributed_orders,
            "attributed_orders": obj.attributed_orders,
            "organic": obj.organic_metrics or None,
            "paid": obj.paid_metrics or None,
            "last_synced_at": obj.last_synced_at,
        }

    def get_tracking(self, obj) -> dict:
        return {
            "utm_source": obj.utm_source or None,
            "utm_medium": obj.utm_medium or None,
            "utm_campaign": obj.utm_campaign or None,
            "tracking_link": obj.tracking_link or None,
            "conversion_attribution": obj.conversion_attribution,
        }


class CampaignBudgetInputSerializer(serializers.Serializer):
    planned_budget = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    actual_spend = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    advertising_cost = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    creator_commission = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    currency = serializers.CharField(max_length=8, default="KES")


class CampaignAdvertisingInputSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=SocialPlatform.choices, required=False, allow_null=True)
    account = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    external_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CampaignCreateUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    objective = serializers.ChoiceField(choices=CampaignObjective.choices, default=CampaignObjective.AWARENESS)
    type = serializers.ChoiceField(choices=CampaignType.choices, default=CampaignType.PRODUCT_PROMOTION)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    status = serializers.ChoiceField(choices=CampaignStatus.choices, default=CampaignStatus.DRAFT)
    owner_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True, default="")
    platforms = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    accounts = serializers.ListField(child=serializers.DictField(), required=False, allow_empty=True)
    product_ids = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    discount_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    promotional_message = serializers.CharField(required=False, allow_blank=True, default="")
    promotional_url = serializers.URLField(required=False, allow_blank=True, default="")
    offer_start = serializers.DateField(required=False, allow_null=True)
    offer_end = serializers.DateField(required=False, allow_null=True)
    content_ids = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    budget = CampaignBudgetInputSerializer(required=False, allow_null=True)
    advertising = CampaignAdvertisingInputSerializer(required=False, allow_null=True)

    def validate_platforms(self, value):
        seen, out = set(), []
        for item in value:
            p = _normalize_platform(item)
            if p not in seen:
                seen.add(p)
                out.append(p)
        return out

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})
        if attrs.get("type") == CampaignType.PAID_ADVERTISING:
            budget = attrs.get("budget") or {}
            if budget.get("planned_budget") is None:
                raise serializers.ValidationError({"budget": "Planned budget is required for paid campaigns."})
        return attrs


class CampaignKPISerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    scheduled = serializers.IntegerField()
    completed = serializers.IntegerField()
    requiring_attention = serializers.IntegerField()
    total_spend = serializers.FloatField()
    attributed_revenue = serializers.FloatField()
    attributed_orders = serializers.IntegerField()
    roas = serializers.FloatField(allow_null=True)
    currency = serializers.CharField()
    organic = serializers.DictField(allow_null=True)
    paid = serializers.DictField(allow_null=True)


class ScheduledPostHistorySerializer(serializers.ModelSerializer):
    at = serializers.DateTimeField(source="created_at", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialScheduledPostHistory
        fields = ["at", "status", "actor_name", "message", "published_url"]
        read_only_fields = fields

    def get_actor_name(self, obj) -> str | None:
        return _user_name(obj.actor) or None


class ScheduledPostSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    content_id = serializers.CharField(source="content.id", read_only=True, allow_null=True)
    account_id = serializers.CharField(source="account.id", read_only=True)
    account_name = serializers.SerializerMethodField()
    campaign_id = serializers.CharField(source="campaign.id", read_only=True, allow_null=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True, allow_null=True)
    owner_id = serializers.CharField(source="owner.id", read_only=True, allow_null=True)
    owner_name = serializers.SerializerMethodField()
    approver_id = serializers.CharField(source="approver.id", read_only=True, allow_null=True)
    approver_name = serializers.SerializerMethodField()
    retry_history = serializers.SerializerMethodField()

    class Meta:
        model = SocialScheduledPost
        fields = [
            "id",
            "content_id",
            "content_title",
            "thumbnail_url",
            "caption",
            "content_type",
            "platform",
            "account_id",
            "account_name",
            "scheduled_at",
            "status",
            "campaign_id",
            "campaign_name",
            "owner_id",
            "owner_name",
            "approver_id",
            "approver_name",
            "published_at",
            "published_url",
            "published_post_id",
            "attempt_at",
            "platform_response",
            "failure_reason",
            "retry_history",
            "last_error_at",
            "is_manual_reminder",
        ]
        read_only_fields = fields

    def get_account_name(self, obj) -> str:
        return obj.account.display_name or obj.account.username or obj.account.get_platform_display()

    def get_owner_name(self, obj) -> str | None:
        return _user_name(obj.owner) or None

    def get_approver_name(self, obj) -> str | None:
        return _user_name(obj.approver) or None

    def get_retry_history(self, obj) -> list[dict]:
        rows = obj.history.filter(is_retry=True).order_by("-created_at")
        return [
            {
                "at": r.created_at,
                "status": "success" if r.retry_success else "failure",
                "message": r.message or None,
            }
            for r in rows
        ]


class ScheduledPostCreateSerializer(serializers.Serializer):
    content_id = serializers.CharField()
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    account_id = serializers.CharField()
    scheduled_at = serializers.DateTimeField()
    content_version_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    as_reminder = serializers.BooleanField(required=False, default=False)

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Scheduled time must be in the future.")
        return value


class ScheduledPostRescheduleSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()


class ScheduledPostCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ScheduledPostDuplicateSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()


class SocialQueueSlotSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialQueueSlot
        fields = ["id", "name", "kind", "days", "time_of_day", "timezone", "platforms", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class SocialEvergreenPostSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    content_id = serializers.CharField(source="content.id", read_only=True, allow_null=True)

    class Meta:
        model = SocialEvergreenPost
        fields = [
            "id",
            "content_id",
            "caption",
            "platforms",
            "product_id",
            "last_used_at",
            "use_count",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "last_used_at", "use_count", "created_at"]


class ConversationMessageSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialInboxMessage
        fields = ["id", "direction", "body", "created_at", "author_name", "can_reply"]
        read_only_fields = fields

    def get_author_name(self, obj) -> str | None:
        return obj.author_name or _user_name(obj.author) or None


class ConversationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    assigned_to = StaffSummarySerializer(read_only=True)
    linked_customer = serializers.SerializerMethodField()
    linked_product = serializers.SerializerMethodField()
    messages = ConversationMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SocialInboxConversation
        fields = [
            "id",
            "platform",
            "type",
            "customer_display_name",
            "customer_username",
            "customer_avatar_url",
            "preview",
            "related_post_title",
            "related_post_url",
            "related_post_thumbnail",
            "last_interaction_at",
            "status",
            "assigned_to",
            "unread",
            "can_reply",
            "can_react",
            "can_hide",
            "can_moderate",
            "can_archive",
            "can_assign",
            "linked_customer",
            "linked_product",
            "messages",
            "platform_capability_note",
        ]
        read_only_fields = fields

    def get_linked_customer(self, obj) -> dict | None:
        if not obj.linked_customer_id:
            return None
        return self.context.get("customer_map", {}).get(str(obj.linked_customer_id))

    def get_linked_product(self, obj) -> dict | None:
        if not obj.linked_product_id:
            return None
        return self.context.get("product_map", {}).get(str(obj.linked_product_id))


class InboxReplyCreateSerializer(serializers.Serializer):
    body = serializers.CharField(allow_blank=False, max_length=5000)


class InboxNoteCreateSerializer(serializers.Serializer):
    body = serializers.CharField(allow_blank=False, max_length=5000)


class InboxAssignSerializer(serializers.Serializer):
    staff_id = serializers.CharField(allow_null=True, allow_blank=True)


class InboxReactSerializer(serializers.Serializer):
    reaction = serializers.CharField(default="like", max_length=32)


class InboxLinkProductSerializer(serializers.Serializer):
    product_id = serializers.CharField()


class InboxLinkCustomerSerializer(serializers.Serializer):
    customer_id = serializers.CharField()


class InboxPlatformCapabilitySerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    supports_dm = serializers.BooleanField()
    supports_comments = serializers.BooleanField()
    supports_mentions = serializers.BooleanField()
    supports_reply = serializers.BooleanField()
    supports_react = serializers.BooleanField()
    supports_hide = serializers.BooleanField()
    supports_moderation = serializers.BooleanField()
    note = serializers.CharField(allow_null=True, required=False)


class InboxStaffWorkloadSerializer(serializers.Serializer):
    staff_id = serializers.CharField()
    staff_name = serializers.CharField()
    assigned_count = serializers.IntegerField()


class InboxMetricsSerializer(serializers.Serializer):
    total_incoming = serializers.IntegerField()
    unread = serializers.IntegerField()
    resolved = serializers.IntegerField()
    unanswered = serializers.IntegerField()
    avg_response_seconds = serializers.FloatField(allow_null=True)
    by_platform = serializers.DictField(child=serializers.IntegerField())
    staff_workload = InboxStaffWorkloadSerializer(many=True)


class SocialInboxTemplateSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialInboxTemplate
        fields = ["id", "key", "label", "body", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MetricValueSerializer(serializers.Serializer):
    value = serializers.FloatField(allow_null=True)
    previous = serializers.FloatField(allow_null=True)
    available = serializers.BooleanField()


class AnalyticsCampaignRowSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    type = serializers.ChoiceField(choices=[("organic", "Organic"), ("paid", "Paid")])
    spend = serializers.FloatField(allow_null=True)
    reach = MetricValueSerializer()
    impressions = MetricValueSerializer()
    views = MetricValueSerializer()
    engagement = MetricValueSerializer()
    clicks = MetricValueSerializer()
    website_visits = MetricValueSerializer()
    orders = MetricValueSerializer()
    attributed_revenue = MetricValueSerializer()
    roas = serializers.FloatField(allow_null=True)


class AnalyticsContentRowSerializer(serializers.Serializer):
    id = serializers.CharField()
    thumbnail_url = serializers.URLField(allow_null=True)
    title = serializers.CharField()
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    account_handle = serializers.CharField()
    content_type = serializers.CharField()
    published_at = serializers.DateTimeField()
    views = MetricValueSerializer()
    reach = MetricValueSerializer()
    impressions = MetricValueSerializer()
    likes = MetricValueSerializer()
    comments = MetricValueSerializer()
    shares = MetricValueSerializer()
    saves = MetricValueSerializer()
    engagement_rate = MetricValueSerializer()
    link_clicks = MetricValueSerializer()
    attributed_orders = MetricValueSerializer()
    attributed_revenue = MetricValueSerializer()


class AnalyticsProductRowSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    sku = serializers.CharField()
    image_url = serializers.URLField(allow_null=True)
    product_views = serializers.IntegerField()
    clicks = serializers.IntegerField()
    add_to_cart = serializers.IntegerField()
    orders = serializers.IntegerField()
    units_sold = serializers.IntegerField()
    attributed_revenue = serializers.FloatField()
    conversion_rate = serializers.FloatField()


class AnalyticsFunnelStageSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    value = serializers.IntegerField()
    definition = serializers.CharField()


class AnalyticsRevenueBreakdownRowSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    visits = serializers.IntegerField()
    assisted_orders = serializers.IntegerField()
    attributed_orders = serializers.IntegerField()
    attributed_revenue = serializers.FloatField()
    direct_orders = serializers.IntegerField()
    unattributed_orders = serializers.IntegerField()


class AnalyticsPlatformSummarySerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    accounts = AnalyticsPlatformAccountSerializer(many=True)
    followers = MetricValueSerializer()
    follower_growth = MetricValueSerializer()
    reach = MetricValueSerializer()
    impressions = MetricValueSerializer()
    views = MetricValueSerializer()
    engagement = MetricValueSerializer()
    engagement_rate = MetricValueSerializer()
    link_clicks = MetricValueSerializer()
    profile_visits = MetricValueSerializer()
    published_content = MetricValueSerializer()
    unavailable = serializers.ListField(child=serializers.CharField())


class AnalyticsAuditMetaSerializer(serializers.Serializer):
    attribution_model = serializers.CharField()
    reporting_window_days = serializers.IntegerField()
    generated_at = serializers.DateTimeField()
    currency = serializers.CharField()


class AnalyticsPayloadSerializer(serializers.Serializer):
    accounts = AnalyticsPlatformAccountSerializer(many=True)
    platform_summaries = AnalyticsPlatformSummarySerializer(many=True)
    campaigns = AnalyticsCampaignRowSerializer(many=True)
    content = AnalyticsContentRowSerializer(many=True)
    products = AnalyticsProductRowSerializer(many=True)
    funnel = AnalyticsFunnelStageSerializer(many=True)
    revenue_breakdown = AnalyticsRevenueBreakdownRowSerializer(many=True)
    audience_growth = serializers.ListField(child=serializers.DictField())
    audit = AnalyticsAuditMetaSerializer()


class OverviewSeriesPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    value = serializers.FloatField()


class OverviewPlatformSeriesSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    points = OverviewSeriesPointSerializer(many=True)


class OverviewKpisSerializer(serializers.Serializer):
    total_followers = serializers.IntegerField(allow_null=True)
    follower_growth = serializers.IntegerField(allow_null=True)
    reach = serializers.IntegerField(allow_null=True)
    impressions = serializers.IntegerField(allow_null=True)
    views = serializers.IntegerField(allow_null=True)
    engagement = serializers.IntegerField(allow_null=True)
    published_posts = serializers.IntegerField(allow_null=True)
    scheduled_posts = serializers.IntegerField(allow_null=True)
    unanswered = serializers.IntegerField(allow_null=True)


class OverviewEcommerceSerializer(serializers.Serializer):
    visitors = serializers.IntegerField(allow_null=True)
    product_views = serializers.IntegerField(allow_null=True)
    add_to_cart = serializers.IntegerField(allow_null=True)
    checkouts = serializers.IntegerField(allow_null=True)
    orders = serializers.IntegerField(allow_null=True)
    revenue = serializers.FloatField(allow_null=True)
    conversion_rate = serializers.FloatField(allow_null=True)
    aov = serializers.FloatField(allow_null=True)
    currency = serializers.CharField(allow_null=True, required=False)
    total_store_revenue = serializers.FloatField(allow_null=True, required=False)
    unattributed_orders = serializers.IntegerField(allow_null=True, required=False)
    unattributed_revenue = serializers.FloatField(allow_null=True, required=False)


class OverviewPlatformRowSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    account_name = serializers.CharField(allow_null=True, required=False)
    followers = serializers.IntegerField(allow_null=True, required=False)
    growth = serializers.IntegerField(allow_null=True, required=False)
    reach = serializers.IntegerField(allow_null=True, required=False)
    views = serializers.IntegerField(allow_null=True, required=False)
    engagement = serializers.IntegerField(allow_null=True, required=False)
    link_clicks = serializers.IntegerField(allow_null=True, required=False)
    website_visitors = serializers.IntegerField(allow_null=True, required=False)
    attributed_orders = serializers.IntegerField(allow_null=True, required=False)
    attributed_revenue = serializers.FloatField(allow_null=True, required=False)


class OverviewTopContentSerializer(serializers.Serializer):
    id = serializers.CharField()
    platform = serializers.ChoiceField(choices=SocialPlatform.choices)
    content_type = serializers.CharField(allow_null=True, required=False)
    title = serializers.CharField()
    thumbnail_url = serializers.URLField(allow_null=True, required=False)
    published_at = serializers.DateTimeField(allow_null=True, required=False)
    permalink = serializers.URLField(allow_null=True, required=False)
    views = serializers.IntegerField(allow_null=True, required=False)
    reach = serializers.IntegerField(allow_null=True, required=False)
    engagement = serializers.IntegerField(allow_null=True, required=False)
    link_clicks = serializers.IntegerField(allow_null=True, required=False)
    attributed_orders = serializers.IntegerField(allow_null=True, required=False)
    attributed_revenue = serializers.FloatField(allow_null=True, required=False)


class OverviewActivityItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    kind = serializers.ChoiceField(choices=ActivityKind.choices)
    title = serializers.CharField()
    platform = serializers.ChoiceField(choices=SocialPlatform.choices, allow_null=True, required=False)
    at = serializers.DateTimeField(allow_null=True, required=False)
    href = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField(allow_null=True, required=False)


class OverviewAlertSerializer(serializers.Serializer):
    id = serializers.CharField()
    severity = serializers.ChoiceField(choices=AlertSeverity.choices)
    title = serializers.CharField()
    description = serializers.CharField(allow_null=True, required=False)
    href = serializers.CharField(allow_null=True, required=False)
    action_label = serializers.CharField(allow_null=True, required=False)


class OverviewFunnelSerializer(serializers.Serializer):
    visitors = serializers.IntegerField()
    product_views = serializers.IntegerField()
    add_to_cart = serializers.IntegerField()
    checkouts = serializers.IntegerField()
    orders = serializers.IntegerField()


class OverviewSeriesBundleSerializer(serializers.Serializer):
    followers = OverviewPlatformSeriesSerializer(many=True, required=False)
    reach = OverviewPlatformSeriesSerializer(many=True, required=False)
    views = OverviewPlatformSeriesSerializer(many=True, required=False)
    impressions = OverviewPlatformSeriesSerializer(many=True, required=False)
    engagement = OverviewPlatformSeriesSerializer(many=True, required=False)
    revenue = OverviewPlatformSeriesSerializer(many=True, required=False)
    funnel = OverviewFunnelSerializer(allow_null=True, required=False)


class OverviewPayloadSerializer(serializers.Serializer):
    accounts = OverviewAccountSummarySerializer(many=True)
    kpis = OverviewKpisSerializer()
    kpi_deltas = serializers.DictField(child=serializers.FloatField(allow_null=True), required=False)
    ecommerce = OverviewEcommerceSerializer(required=False)
    series = OverviewSeriesBundleSerializer(required=False)
    comparison = OverviewPlatformRowSerializer(many=True, required=False)
    top_content = OverviewTopContentSerializer(many=True, required=False)
    activity = OverviewActivityItemSerializer(many=True, required=False)
    alerts = OverviewAlertSerializer(many=True, required=False)
    last_synced_at = serializers.DateTimeField(allow_null=True, required=False)
    currency = serializers.CharField(allow_null=True, required=False)


class SocialLinkSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    campaign_id = serializers.CharField(source="campaign.id", read_only=True, allow_null=True)
    content_id = serializers.CharField(source="content.id", read_only=True, allow_null=True)
    created_by_id = serializers.CharField(source="created_by.id", read_only=True, allow_null=True)

    class Meta:
        model = SocialLink
        fields = [
            "id",
            "short_code",
            "destination",
            "utm",
            "campaign_id",
            "content_id",
            "clicks",
            "created_by_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "short_code", "clicks", "created_at", "updated_at"]


class SocialAttributionEventSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    revenue = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False, allow_null=True)

    class Meta:
        model = SocialAttributionEvent
        fields = [
            "id",
            "event_type",
            "platform",
            "account",
            "campaign",
            "content",
            "scheduled_post",
            "session_id",
            "product_id",
            "order_id",
            "units",
            "revenue",
            "currency",
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "is_assisted",
            "is_direct",
            "is_verified_paid",
            "occurred_at",
        ]
        read_only_fields = ["id"]


class SocialPlatformDailyMetricSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    account_id = serializers.CharField(source="account.id", read_only=True)

    class Meta:
        model = SocialPlatformDailyMetric
        fields = [
            "id",
            "account_id",
            "platform",
            "date",
            "followers",
            "follower_growth",
            "reach",
            "impressions",
            "views",
            "engagement",
            "engagement_rate",
            "link_clicks",
            "profile_visits",
            "published_content",
            "unavailable_metrics",
            "updated_at",
        ]
        read_only_fields = fields


class SocialFollowerSnapshotSerializer(serializers.ModelSerializer):
    account_id = serializers.CharField(source="account.id", read_only=True)

    class Meta:
        model = SocialFollowerSnapshot
        fields = ["account_id", "platform", "date", "followers"]
        read_only_fields = fields


class SocialEngagementSnapshotSerializer(serializers.ModelSerializer):
    engagement_rate = serializers.FloatField(read_only=True)

    class Meta:
        model = SocialEngagementSnapshot
        fields = ["platform", "reach", "engagement", "engagement_rate", "updated_at"]
        read_only_fields = fields


class SocialDemographicSnapshotSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialDemographicSnapshot
        fields = [
            "id",
            "platform",
            "date",
            "age_buckets",
            "gender",
            "top_cities",
            "top_countries",
            "updated_at",
        ]
        read_only_fields = fields


class SocialBestTimePostSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialBestTimePost
        fields = ["id", "platform", "day_of_week", "hour", "score", "sample_size", "updated_at"]
        read_only_fields = fields


class SocialNotificationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = SocialNotification
        fields = [
            "id",
            "notification_type",
            "severity",
            "title",
            "message",
            "link",
            "action_label",
            "is_read",
            "is_resolved",
            "created_at",
        ]
        read_only_fields = fields


class SocialActivityLogSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    at = serializers.DateTimeField(source="occurred_at", read_only=True)

    class Meta:
        model = SocialActivityLog
        fields = ["id", "kind", "title", "platform", "at", "href", "status"]
        read_only_fields = fields


class SocialAuditLogSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    actor_id = serializers.CharField(source="actor.id", read_only=True, allow_null=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialAuditLog
        fields = ["id", "actor_id", "actor_name", "action", "target_type", "target_id", "details", "created_at"]
        read_only_fields = fields

    def get_actor_name(self, obj) -> str:
        return _user_name(obj.actor)


class SocialTeamMemberSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    user_id = serializers.CharField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialTeamMember
        fields = [
            "id",
            "user_id",
            "username",
            "email",
            "full_name",
            "role",
            "is_active",
            "invited_at",
            "joined_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_full_name(self, obj) -> str:
        return _user_name(obj.user)


class SocialReportSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    file_url = serializers.SerializerMethodField()
    created_by_id = serializers.CharField(source="created_by.id", read_only=True, allow_null=True)

    class Meta:
        model = SocialReport
        fields = [
            "id",
            "report_type",
            "name",
            "date_from",
            "date_to",
            "platforms",
            "metrics",
            "branding",
            "format",
            "file_url",
            "created_by_id",
            "generated_at",
            "created_at",
        ]
        read_only_fields = ["id", "file_url", "generated_at", "created_at"]

    def get_file_url(self, obj) -> str | None:
        return _abs_url(obj.file, self.context.get("request"))


class SocialReportCreateSerializer(serializers.Serializer):
    report_type = serializers.CharField(required=False, allow_blank=True, default="")
    name = serializers.CharField(max_length=255)
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    platforms = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    metrics = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    branding = serializers.DictField(required=False)
    format = serializers.ChoiceField(choices=ReportFormat.choices, default=ReportFormat.CSV)

    def validate_platforms(self, value):
        return [_normalize_platform(p) for p in value]

    def validate(self, attrs):
        if attrs["date_to"] < attrs["date_from"]:
            raise serializers.ValidationError({"date_to": "End date cannot be before start date."})
        return attrs


class BulkIdsSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.CharField(), allow_empty=False)


class BulkRescheduleSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    scheduled_at = serializers.DateTimeField()

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Scheduled time must be in the future.")
        return value