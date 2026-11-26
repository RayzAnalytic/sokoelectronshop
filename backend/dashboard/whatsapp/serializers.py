from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import (
    WhatsAppAccount,
    WhatsAppAlert,
    WhatsAppAttributionEvent,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppConsentLog,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppIntegrationError,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppMessageAttachment,
    WhatsAppMessageLog,
    WhatsAppMessagingCost,
    WhatsAppNotification,
    WhatsAppNotificationConfig,
    WhatsAppOrder,
    WhatsAppProductShare,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
    WhatsAppWorkflowRun,
)


# ---------------------------------------------------------------------------
# Field Helpers
# ---------------------------------------------------------------------------

class SafeIntegerField(serializers.IntegerField):
    def __init__(self, default=0, max_value=None, **kwargs):
        self._safe_default = default
        self._safe_max = max_value
        super().__init__(**kwargs)

    def to_representation(self, value):
        if value is None or value == "":
            return self._safe_default
        try:
            n = int(value)
        except (TypeError, ValueError):
            return self._safe_default
        if n < 0 and self._safe_default is not None and self._safe_default >= 0:
            return self._safe_default
        if self._safe_max is not None and n > self._safe_max:
            return self._safe_default
        return n


class StringIdField(serializers.Field):
    def to_representation(self, value):
        return str(value) if value is not None else None

    def to_internal_value(self, data):
        return str(data) if data is not None else None


# ---------------------------------------------------------------------------
# Topbar, Connection, Health & Overview Alerts
# ---------------------------------------------------------------------------

class TopbarNotificationSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    detail = serializers.CharField(source="body")
    at = serializers.DateTimeField(source="timestamp")
    unread = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppNotification
        fields = ["id", "type", "title", "detail", "at", "unread"]

    def get_unread(self, obj):
        return not obj.read


class ConnectionSerializer(serializers.ModelSerializer):
    """
    Powers /api/whatsapp/connection for both WhatsAppTopbar and
    WhatsAppAnalyticsPage (ConnectionTabContent).
    """

    state = serializers.CharField(source="connection_state")
    metaBusinessPortfolio = serializers.CharField(
        source="meta_business_portfolio", allow_null=True
    )
    wabaId = serializers.CharField(source="waba_id", allow_null=True)
    wabaName = serializers.CharField(source="waba_name", allow_null=True)
    phoneNumberId = serializers.CharField(source="phone_number_id", allow_null=True)
    displayName = serializers.CharField(source="display_name", allow_null=True)
    phoneNumber = serializers.CharField(source="display_phone", allow_null=True)
    phoneVerified = serializers.BooleanField(source="phone_verified")
    businessProfile = serializers.SerializerMethodField()
    catalogueName = serializers.SerializerMethodField()
    catalogueId = serializers.SerializerMethodField()
    permissions = serializers.JSONField()
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    requiredAction = serializers.CharField(source="required_action", allow_null=True)

    # Fields specifically expected by WhatsAppTopbar
    account = serializers.SerializerMethodField()
    notifications = serializers.SerializerMethodField()
    unreadCount = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppAccount
        fields = [
            "state",
            "metaBusinessPortfolio",
            "wabaId",
            "wabaName",
            "phoneNumberId",
            "displayName",
            "phoneNumber",
            "phoneVerified",
            "businessProfile",
            "catalogueName",
            "catalogueId",
            "permissions",
            "lastSyncedAt",
            "requiredAction",
            "account",
            "notifications",
            "unreadCount",
        ]

    def _null_if_blank(self, val):
        return val if val else None

    def get_businessProfile(self, obj):
        if not any([obj.about, obj.address, obj.website, obj.vertical]):
            return None
        return {
            "about": self._null_if_blank(obj.about),
            "address": self._null_if_blank(obj.address),
            "website": self._null_if_blank(obj.website),
            "vertical": self._null_if_blank(obj.vertical),
        }

    def get_catalogueName(self, obj):
        catalog = WhatsAppCatalog.objects.filter(connected=True).first()
        return catalog.name if catalog else None

    def get_catalogueId(self, obj):
        catalog = WhatsAppCatalog.objects.filter(connected=True).first()
        return self._null_if_blank(catalog.meta_catalog_id) if catalog else None

    def get_account(self, obj):
        if obj.connection_state != "connected":
            return None
        return {
            "displayName": obj.display_name or obj.business_name or "WhatsApp Business",
            "phoneNumber": obj.display_phone or "",
            "accountId": obj.waba_id or str(obj.pk),
        }

    def get_notifications(self, obj):
        qs = WhatsAppNotification.objects.all()[:15]
        return TopbarNotificationSerializer(qs, many=True).data

    def get_unreadCount(self, obj):
        return WhatsAppNotification.objects.filter(read=False).count()


class ConnectionSummarySerializer(serializers.ModelSerializer):
    """
    Compact connection summary inside /api/whatsapp/overview.
    """

    state = serializers.CharField(source="connection_state")
    displayName = serializers.CharField(source="display_name", allow_null=True)
    phoneNumber = serializers.CharField(source="display_phone", allow_null=True)
    phoneVerified = serializers.BooleanField(source="phone_verified")
    apiStatus = serializers.CharField(source="api_status", allow_null=True)
    webhookStatus = serializers.CharField(source="webhook_status", allow_null=True)
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    requiredAction = serializers.CharField(source="required_action", allow_null=True)

    class Meta:
        model = WhatsAppAccount
        fields = [
            "state",
            "displayName",
            "phoneNumber",
            "phoneVerified",
            "apiStatus",
            "webhookStatus",
            "lastSyncedAt",
            "requiredAction",
        ]


class IntegrationErrorSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    at = serializers.DateTimeField(source="created_at")

    class Meta:
        model = WhatsAppIntegrationError
        fields = ["id", "kind", "message", "at"]


class HealthInfoSerializer(serializers.Serializer):
    """
    Powers /api/whatsapp/health for WhatsAppAnalyticsPage (HealthTabContent).
    """

    api = serializers.DictField()
    webhook = serializers.DictField()
    token = serializers.DictField()
    errors = IntegrationErrorSerializer(many=True)


class AlertItemSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    resolveHref = serializers.CharField(source="resolve_href")
    resolveLabel = serializers.CharField(source="resolve_label")

    class Meta:
        model = WhatsAppAlert
        fields = ["id", "severity", "title", "description", "resolveHref", "resolveLabel"]


class HealthCheckSerializer(serializers.ModelSerializer):
    latencyMs = SafeIntegerField(source="latency_ms")
    at = serializers.DateTimeField(source="created_at")

    class Meta:
        model = WhatsAppHealthCheck
        fields = ["id", "check_type", "status", "ok", "latencyMs", "error", "at"]


class AccountSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source="is_active")
    connectionState = serializers.CharField(source="connection_state")
    displayPhone = serializers.CharField(source="display_phone")
    displayName = serializers.CharField(source="display_name")
    businessName = serializers.CharField(source="business_name")
    profilePictureUrl = serializers.CharField(source="profile_picture_url")
    phoneNumberId = serializers.CharField(source="phone_number_id")
    wabaId = serializers.CharField(source="waba_id")
    wabaName = serializers.CharField(source="waba_name")
    businessId = serializers.CharField(source="business_id")
    phoneVerified = serializers.BooleanField(source="phone_verified")
    qualityScore = serializers.CharField(source="quality_score")
    messagingLimit = serializers.CharField(source="messaging_limit")
    messagingLimitTier = serializers.CharField(source="messaging_limit_tier")
    verificationStatus = serializers.CharField(source="verification_status")
    reviewStatus = serializers.CharField(source="review_status")
    twoStepPin = serializers.BooleanField(source="two_step_pin")
    officialBusinessAccount = serializers.BooleanField(source="official_business_account")
    tokenExpiresAt = serializers.DateTimeField(source="token_expires_at", allow_null=True)
    tokenDaysLeft = SafeIntegerField(source="token_days_left", default=None, allow_null=True)
    webhookUrl = serializers.CharField(source="webhook_url")
    webhookVerifyToken = serializers.CharField(source="webhook_verify_token")
    webhookFields = serializers.JSONField(source="webhook_fields")
    webhookVerified = serializers.BooleanField(source="webhook_verified")
    apiStatus = serializers.CharField(source="api_status")
    webhookStatus = serializers.CharField(source="webhook_status")
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    lastError = serializers.CharField(source="last_error")
    requiredAction = serializers.CharField(source="required_action")
    hasCatalog = serializers.BooleanField(source="has_catalog")
    qualityHistory = serializers.JSONField(source="quality_history")
    healthChecks = serializers.SerializerMethodField()
    healthCheckOk = serializers.SerializerMethodField()
    healthCheckError = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppAccount
        fields = [
            "id", "isActive", "connectionState", "displayPhone", "displayName",
            "businessName", "about", "address", "email", "website", "vertical",
            "profilePictureUrl", "phoneNumberId", "wabaId", "wabaName", "businessId",
            "phoneVerified", "qualityScore", "messagingLimit", "messagingLimitTier",
            "verificationStatus", "reviewStatus", "twoStepPin",
            "officialBusinessAccount", "tokenExpiresAt", "tokenDaysLeft",
            "webhookUrl", "webhookVerifyToken", "webhookFields", "webhookVerified",
            "apiStatus", "webhookStatus", "lastSyncedAt", "lastError",
            "requiredAction", "hasCatalog", "qualityHistory", "permissions",
            "healthChecks", "healthCheckOk", "healthCheckError",
        ]

    def get_healthChecks(self, obj):
        return HealthCheckSerializer(obj.health_checks.all()[:20], many=True).data

    def get_healthCheckOk(self, obj):
        latest = obj.latest_health_check
        return latest.ok if latest else None

    def get_healthCheckError(self, obj):
        latest = obj.latest_health_check
        return latest.error if latest else ""


# ---------------------------------------------------------------------------
# Commerce, Catalogue, Products & Campaigns
# ---------------------------------------------------------------------------

class CatalogueInfoSerializer(serializers.ModelSerializer):
    """
    Powers /api/whatsapp/commerce/catalogue for WhatsAppCommercePage.
    """

    catalogueId = serializers.SerializerMethodField()
    catalogueName = serializers.CharField(source="name", allow_null=True)
    lastSyncAt = serializers.DateTimeField(source="last_full_sync_at", allow_null=True)
    syncEnabled = serializers.BooleanField(source="auto_sync")
    requiredAction = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppCatalog
        fields = [
            "connected",
            "catalogueId",
            "catalogueName",
            "lastSyncAt",
            "syncEnabled",
            "requiredAction",
        ]

    def get_catalogueId(self, obj):
        return obj.meta_catalog_id or None

    def get_requiredAction(self, obj):
        return obj.required_action or None


class CommerceProductSerializer(serializers.ModelSerializer):
    """
    Powers /api/whatsapp/commerce/products for WhatsAppCommercePage.
    """

    id = StringIdField(source="pk", read_only=True)
    sku = serializers.CharField(source="effective_sku", read_only=True)
    imageUrl = serializers.SerializerMethodField()
    price = serializers.FloatField()
    salePrice = serializers.FloatField(source="sale_price", allow_null=True)
    category = serializers.SerializerMethodField()
    variations = SafeIntegerField(source="variations_count")
    stock = SafeIntegerField(source="stock_quantity")
    productStatus = serializers.CharField(source="product_status")
    productUrl = serializers.CharField(source="product_url")
    syncStatus = serializers.CharField(source="sync_status")
    metaItemId = serializers.SerializerMethodField()
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    syncError = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppCatalogItem
        fields = [
            "id",
            "name",
            "sku",
            "imageUrl",
            "price",
            "salePrice",
            "currency",
            "category",
            "variations",
            "stock",
            "productStatus",
            "productUrl",
            "syncStatus",
            "metaItemId",
            "lastSyncedAt",
            "syncError",
        ]

    def get_imageUrl(self, obj):
        return obj.display_image_url or None

    def get_category(self, obj):
        return obj.category or None

    def get_metaItemId(self, obj):
        return obj.meta_product_id or None

    def get_syncError(self, obj):
        return obj.last_error or obj.rejection_reason or None


class ProductSearchResultSerializer(serializers.ModelSerializer):
    """
    Powers ProductPicker inside WhatsAppInboxPage.
    """

    id = StringIdField(source="pk", read_only=True)
    sku = serializers.CharField(source="effective_sku", read_only=True)
    price = serializers.FloatField(source="effective_price")
    imageUrl = serializers.SerializerMethodField()
    inStock = serializers.BooleanField(source="in_stock")
    productUrl = serializers.CharField(source="product_url")

    class Meta:
        model = WhatsAppCatalogItem
        fields = ["id", "name", "sku", "price", "currency", "imageUrl", "inStock", "productUrl"]

    def get_imageUrl(self, obj):
        return obj.display_image_url or None


class ProductShareSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    productId = serializers.SerializerMethodField()
    name = serializers.CharField(source="product_name")
    sharedAt = serializers.DateTimeField(source="shared_at")

    class Meta:
        model = WhatsAppProductShare
        fields = ["id", "productId", "name", "mode", "status", "sharedAt"]

    def get_productId(self, obj):
        return str(obj.store_product_id or obj.catalog_item_id or obj.pk)


class CampaignSerializer(serializers.ModelSerializer):
    """
    Powers /api/whatsapp/campaigns for WhatsAppCommercePage.
    """

    id = StringIdField(source="pk", read_only=True)
    name = serializers.CharField(source="campaign_name")
    templateName = serializers.SerializerMethodField()
    audienceLabel = serializers.SerializerMethodField()
    productCount = serializers.SerializerMethodField()
    discountCode = serializers.SerializerMethodField()
    startAt = serializers.DateTimeField(source="start_at", allow_null=True)
    endAt = serializers.DateTimeField(source="end_at", allow_null=True)
    status = serializers.SerializerMethodField()
    estimatedRecipients = SafeIntegerField(source="audience_count")
    metrics = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppBroadcast
        fields = [
            "id",
            "name",
            "objective",
            "templateName",
            "audienceLabel",
            "productCount",
            "discountCode",
            "startAt",
            "endAt",
            "status",
            "estimatedRecipients",
            "metrics",
        ]

    def get_templateName(self, obj):
        return obj.template.name if obj.template else "—"

    def get_audienceLabel(self, obj):
        if obj.audience_label:
            return obj.audience_label
        if obj.segment:
            return obj.segment.name
        return obj.audience or "All opted-in"

    def get_productCount(self, obj):
        m2m_count = obj.products.count()
        if m2m_count:
            return m2m_count
        return len(obj.attached_catalog_item_ids or [])

    def get_discountCode(self, obj):
        return obj.discount_code or None

    def get_status(self, obj):
        s = (obj.status or "DRAFT").lower()
        if s == "sending":
            return "running"
        return s

    def get_metrics(self, obj):
        if obj.status in ("DRAFT", "SCHEDULED") and obj.submitted == 0 and obj.recipients == 0:
            return None
        return {
            "submitted": obj.submitted or obj.recipients,
            "delivered": obj.delivered,
            "read": obj.read,
            "failed": obj.failed,
            "clicks": obj.clicks,
            "visits": obj.visits,
            "orders": obj.orders_count,
            "revenue": float(obj.revenue or 0),
            "cost": float(obj.actual_cost_kes or obj.estimated_cost_kes or 0),
            "currency": obj.currency or "KES",
        }


class CatalogSerializer(serializers.ModelSerializer):
    metaCatalogId = serializers.CharField(source="meta_catalog_id")
    autoSync = serializers.BooleanField(source="auto_sync")
    eligibilityRule = serializers.CharField(source="eligibility_rule")
    syncFrequencyMinutes = SafeIntegerField(source="sync_frequency_minutes")
    hidePrice = serializers.BooleanField(source="hide_price")
    defaultSort = serializers.CharField(source="default_sort")
    excludeOutOfStock = serializers.BooleanField(source="exclude_out_of_stock")
    requiredAction = serializers.CharField(source="required_action")
    lastFullSyncAt = serializers.DateTimeField(source="last_full_sync_at", allow_null=True)
    lastSyncAdded = SafeIntegerField(source="last_sync_added")
    lastSyncUpdated = SafeIntegerField(source="last_sync_updated")
    lastSyncFailed = SafeIntegerField(source="last_sync_failed")
    lastError = serializers.CharField(source="last_error")
    itemCounts = serializers.DictField(source="item_counts", read_only=True)

    class Meta:
        model = WhatsAppCatalog
        fields = [
            "id", "name", "metaCatalogId", "connected", "autoSync", "eligibilityRule",
            "syncFrequencyMinutes", "hidePrice", "defaultSort", "excludeOutOfStock",
            "requiredAction", "lastFullSyncAt", "lastSyncAdded", "lastSyncUpdated",
            "lastSyncFailed", "lastError", "itemCounts",
        ]


class CatalogItemSerializer(serializers.ModelSerializer):
    catalogId = SafeIntegerField(source="catalog_id", default=None, allow_null=True)
    retailerId = serializers.CharField(source="retailer_id")
    sku = serializers.CharField(source="effective_sku", read_only=True)
    metaProductId = serializers.CharField(source="meta_product_id")
    storeProductId = SafeIntegerField(source="store_product_id", default=None, allow_null=True)
    storeCategoryId = SafeIntegerField(source="store_category_id", default=None, allow_null=True)
    storeProductName = serializers.CharField(source="store_product_name")
    storeProductSlug = serializers.CharField(source="store_product_slug")
    isLinked = serializers.BooleanField(source="is_linked")
    isRemoved = serializers.BooleanField(source="is_removed")
    isBrowsable = serializers.BooleanField(source="is_browsable")
    displayTitle = serializers.CharField(source="resolved_display_title", read_only=True)
    displayDescription = serializers.CharField(source="resolved_display_description", read_only=True)
    effectivePrice = serializers.DecimalField(
        source="effective_price", max_digits=12, decimal_places=2, read_only=True
    )
    salePrice = serializers.DecimalField(
        source="sale_price", max_digits=12, decimal_places=2, allow_null=True
    )
    imageUrl = serializers.CharField(source="image_url")
    customImageUrl = serializers.CharField(source="custom_image_url")
    displayImageUrl = serializers.CharField(source="display_image_url", read_only=True)
    productUrl = serializers.CharField(source="product_url")
    variationsCount = SafeIntegerField(source="variations_count")
    inStock = serializers.BooleanField(source="in_stock")
    stockQuantity = SafeIntegerField(source="stock_quantity")
    productStatus = serializers.CharField(source="product_status")
    sortOrder = SafeIntegerField(source="sort_order")
    hidePrice = serializers.BooleanField(source="hide_price")
    isPriceHidden = serializers.BooleanField(source="is_price_hidden", read_only=True)
    customTitle = serializers.CharField(source="custom_title")
    customDescription = serializers.CharField(source="custom_description")
    viewCount = SafeIntegerField(source="view_count")
    addToCartCount = SafeIntegerField(source="add_to_cart_count")
    removedAt = serializers.DateTimeField(source="removed_at", allow_null=True)
    syncStatus = serializers.CharField(source="sync_status")
    reviewStatus = serializers.CharField(source="review_status", allow_null=True)
    rejectionReason = serializers.CharField(source="rejection_reason")
    lastError = serializers.CharField(source="last_error")
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppCatalogItem
        fields = [
            "id", "catalogId", "retailerId", "sku", "metaProductId", "storeProductId",
            "storeCategoryId", "storeProductName", "storeProductSlug", "isLinked",
            "isRemoved", "isBrowsable", "name", "displayTitle", "description",
            "displayDescription", "price", "salePrice", "effectivePrice", "currency",
            "imageUrl", "customImageUrl", "displayImageUrl", "productUrl", "category",
            "tags", "brand", "variationsCount", "inStock", "stockQuantity",
            "productStatus", "eligible", "pinned", "sortOrder", "hidePrice",
            "isPriceHidden", "customTitle", "customDescription", "viewCount",
            "addToCartCount", "removedAt", "syncStatus", "reviewStatus",
            "rejectionReason", "lastError", "lastSyncedAt", "updatedAt",
        ]


# ---------------------------------------------------------------------------
# Inbox: Conversations, Messages, Attachments & Customer Detail
# ---------------------------------------------------------------------------

class MessageAttachmentSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    mimeType = serializers.CharField(source="mime_type")
    sizeBytes = SafeIntegerField(source="size_bytes")

    class Meta:
        model = WhatsAppMessageAttachment
        fields = ["id", "kind", "url", "filename", "mimeType", "sizeBytes"]


class InboxMessageSerializer(serializers.ModelSerializer):
    """
    Matches `Message` type in WhatsAppInboxPage.
    """

    id = StringIdField(source="pk", read_only=True)
    conversationId = StringIdField(source="conversation_id", read_only=True)
    direction = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="timestamp")
    status = serializers.SerializerMethodField()
    errorReason = serializers.SerializerMethodField()
    isInternalNote = serializers.BooleanField(source="is_internal_note")
    sentById = StringIdField(source="author_id", read_only=True)
    sentByName = serializers.CharField(source="author_name", allow_null=True)
    templateName = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppMessage
        fields = [
            "id",
            "conversationId",
            "direction",
            "body",
            "attachments",
            "createdAt",
            "status",
            "errorReason",
            "isInternalNote",
            "sentById",
            "sentByName",
            "templateName",
        ]

    def get_direction(self, obj):
        return "inbound" if obj.direction == "IN" else "outbound"

    def get_body(self, obj):
        return obj.body or None

    def get_attachments(self, obj):
        items = MessageAttachmentSerializer(obj.attachments.all(), many=True).data
        if not items and obj.media_url:
            kind = obj.type if obj.type in ("image", "document", "video", "audio") else "document"
            items = [
                {
                    "id": f"legacy-{obj.pk}",
                    "kind": kind,
                    "url": obj.media_url,
                    "filename": obj.filename or "attachment",
                    "mimeType": obj.mime_type or "application/octet-stream",
                    "sizeBytes": 0,
                }
            ]
        return items

    def get_status(self, obj):
        s = (obj.status or "SENT").lower()
        if s == "queued":
            return "sending"
        return s

    def get_errorReason(self, obj):
        return obj.error_message or None

    def get_templateName(self, obj):
        if obj.template_name:
            return obj.template_name
        return obj.template.name if obj.template else None


class InboxConversationSerializer(serializers.ModelSerializer):
    """
    Matches `Conversation` type in WhatsAppInboxPage.
    """

    id = StringIdField(source="pk", read_only=True)
    customerId = serializers.SerializerMethodField()
    customerName = serializers.SerializerMethodField()
    phoneNumber = serializers.CharField(source="contact.wa_id")
    lastMessagePreview = serializers.CharField(source="last_message_preview")
    lastMessageAt = serializers.DateTimeField(source="last_message_at", allow_null=True)
    unreadCount = SafeIntegerField(source="unread_count", max_value=100000)
    assignedToId = StringIdField(source="assigned_to_id", read_only=True)
    assignedToName = serializers.CharField(source="assigned_to_name", allow_null=True)
    status = serializers.SerializerMethodField()
    labels = serializers.JSONField(source="tags")
    priority = serializers.SerializerMethodField()
    customerIdentified = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppConversation
        fields = [
            "id",
            "customerId",
            "customerName",
            "phoneNumber",
            "lastMessagePreview",
            "lastMessageAt",
            "unreadCount",
            "assignedToId",
            "assignedToName",
            "status",
            "labels",
            "priority",
            "customerIdentified",
        ]

    def get_customerId(self, obj):
        if obj.contact.user_id:
            return str(obj.contact.user_id)
        return str(obj.contact_id) if obj.contact.is_verified else None

    def get_customerName(self, obj):
        if obj.contact.user:
            full = obj.contact.user.get_full_name()
            if full:
                return full
        return obj.contact.profile_name or None

    def get_status(self, obj):
        return (obj.status or "OPEN").lower()

    def get_priority(self, obj):
        return (obj.priority or "NORMAL").lower()

    def get_customerIdentified(self, obj):
        return bool(obj.contact.user_id or obj.contact.is_verified)


class InboxCustomerDetailSerializer(serializers.ModelSerializer):
    """
    Matches `CustomerDetail` type in WhatsAppInboxPage.
    """

    id = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    phoneNumber = serializers.CharField(source="wa_id")
    email = serializers.SerializerMethodField()
    registeredAt = serializers.DateTimeField(source="created_at", allow_null=True)
    ordersCount = SafeIntegerField(source="order_count")
    totalSpent = serializers.FloatField(source="total_spent")
    lastPaymentStatus = serializers.SerializerMethodField()
    lastDeliveryStatus = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    marketingOptIn = serializers.BooleanField(source="marketing_opt_in", read_only=True)
    consentSource = serializers.SerializerMethodField()
    consentAt = serializers.DateTimeField(source="opt_in_at", allow_null=True)
    optOutAt = serializers.DateTimeField(source="opt_out_at", allow_null=True)

    class Meta:
        model = WhatsAppContact
        fields = [
            "id",
            "name",
            "phoneNumber",
            "email",
            "registeredAt",
            "ordersCount",
            "totalSpent",
            "lastPaymentStatus",
            "lastDeliveryStatus",
            "notes",
            "marketingOptIn",
            "consentSource",
            "consentAt",
            "optOutAt",
        ]

    def get_id(self, obj):
        return str(obj.user_id or obj.pk)

    def get_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.get_username()
        return obj.profile_name or obj.wa_id

    def get_email(self, obj):
        if obj.email:
            return obj.email
        if obj.user and obj.user.email:
            return obj.user.email
        return None

    def get_lastPaymentStatus(self, obj):
        return obj.last_payment_status or None

    def get_lastDeliveryStatus(self, obj):
        return obj.last_delivery_status or None

    def get_notes(self, obj):
        return obj.notes or None

    def get_consentSource(self, obj):
        return obj.opt_in_source or None


class InboxConversationContextSerializer(serializers.Serializer):
    """
    Powers /api/whatsapp/conversations/<id> for WhatsAppInboxPage.
    """

    conversation = InboxConversationSerializer()
    messages = InboxMessageSerializer(many=True)
    customer = InboxCustomerDetailSerializer(allow_null=True)
    window = serializers.DictField()


class InboxCustomerOrderSerializer(serializers.ModelSerializer):
    """
    Matches `CustomerOrder` type in WhatsAppInboxPage.
    """

    id = StringIdField(source="pk", read_only=True)
    reference = serializers.CharField(source="order_number")
    date = serializers.DateTimeField(source="created_at")
    status = serializers.SerializerMethodField()
    paymentStatus = serializers.SerializerMethodField()
    deliveryStatus = serializers.SerializerMethodField()
    total = serializers.FloatField()
    trackingUrl = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppOrder
        fields = [
            "id",
            "reference",
            "date",
            "status",
            "paymentStatus",
            "deliveryStatus",
            "total",
            "currency",
            "trackingUrl",
        ]

    def get_status(self, obj):
        return (obj.status or "PENDING").lower()

    def get_paymentStatus(self, obj):
        if obj.status in ("PAID", "SHIPPED", "DELIVERED"):
            return "paid"
        if obj.status == "CANCELLED":
            return "cancelled"
        return "pending"

    def get_deliveryStatus(self, obj):
        if obj.status == "DELIVERED":
            return "delivered"
        if obj.status == "SHIPPED":
            return "dispatched"
        return "pending"

    def get_trackingUrl(self, obj):
        return None


class InboxRecentConversationSerializer(serializers.ModelSerializer):
    """
    Matches `RecentConversation` type on WhatsAppOverviewPage.
    """

    id = StringIdField(source="pk", read_only=True)
    customerName = serializers.SerializerMethodField()
    phoneNumber = serializers.CharField(source="contact.wa_id")
    lastMessagePreview = serializers.CharField(source="last_message_preview")
    lastMessageAt = serializers.DateTimeField(source="last_message_at", allow_null=True)
    assignedTo = serializers.CharField(source="assigned_to_name", allow_null=True)
    unread = serializers.SerializerMethodField()
    orderId = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppConversation
        fields = [
            "id",
            "customerName",
            "phoneNumber",
            "lastMessagePreview",
            "lastMessageAt",
            "assignedTo",
            "unread",
            "orderId",
        ]

    def get_customerName(self, obj):
        if obj.contact.user:
            full = obj.contact.user.get_full_name()
            if full:
                return full
        return obj.contact.profile_name or None

    def get_unread(self, obj):
        return (obj.unread_count or 0) > 0

    def get_orderId(self, obj):
        latest_order = obj.orders.order_by("-created_at").first()
        if latest_order:
            return str(latest_order.checkout_order_id or latest_order.pk)
        return None


# Legacy-compatible Inbox serializers
class ContactSerializer(serializers.ModelSerializer):
    waId = serializers.CharField(source="wa_id")
    profileName = serializers.CharField(source="profile_name", allow_null=True)
    userId = SafeIntegerField(source="user_id", default=None, allow_null=True)
    isVerified = serializers.BooleanField(source="is_verified")
    isBlocked = serializers.BooleanField(source="is_blocked")
    optInStatus = serializers.CharField(source="opt_in_status")
    optInSource = serializers.CharField(source="opt_in_source")
    optInAt = serializers.DateTimeField(source="opt_in_at", allow_null=True)
    optOutAt = serializers.DateTimeField(source="opt_out_at", allow_null=True)
    lastInboundAt = serializers.DateTimeField(source="last_inbound_at", allow_null=True)
    orderCount = SafeIntegerField(source="order_count")
    totalSpent = serializers.DecimalField(source="total_spent", max_digits=14, decimal_places=2)
    lastPaymentStatus = serializers.CharField(source="last_payment_status")
    lastDeliveryStatus = serializers.CharField(source="last_delivery_status")
    productAffinity = serializers.JSONField(source="product_affinity")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)

    class Meta:
        model = WhatsAppContact
        fields = [
            "id", "waId", "profileName", "email", "userId", "isVerified", "isBlocked",
            "tags", "attributes", "notes", "optInStatus", "optInSource", "optInAt",
            "optOutAt", "lastInboundAt", "orderCount", "totalSpent",
            "lastPaymentStatus", "lastDeliveryStatus", "productAffinity", "createdAt",
        ]


class MessageSerializer(serializers.ModelSerializer):
    waMessageId = serializers.CharField(source="wa_message_id")
    conversationId = SafeIntegerField(source="conversation_id", default=None, allow_null=True)
    errorMessage = serializers.CharField(source="error_message")
    mediaId = serializers.CharField(source="media_id")
    mediaUrl = serializers.CharField(source="media_url")
    mimeType = serializers.CharField(source="mime_type")
    templateName = serializers.CharField(source="template_name")
    templateParams = serializers.JSONField(source="template_params")
    productRefs = serializers.JSONField(source="product_refs")
    cartItems = serializers.JSONField(source="cart_items")
    interactiveButtons = serializers.JSONField(source="interactive_buttons")
    replyToId = SafeIntegerField(source="reply_to_id", default=None, allow_null=True)
    author = SafeIntegerField(source="author_id", default=None, allow_null=True)
    authorName = serializers.CharField(source="author_name", allow_null=True)
    isInternalNote = serializers.BooleanField(source="is_internal_note")
    attachments = MessageAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = WhatsAppMessage
        fields = [
            "id", "waMessageId", "conversationId", "direction", "type", "body",
            "status", "errorMessage", "timestamp", "mediaId", "mediaUrl", "mimeType",
            "filename", "templateName", "templateParams", "productRefs", "cartItems",
            "interactiveButtons", "replyToId", "reactions", "author", "authorName",
            "isInternalNote", "attachments",
        ]


class ConversationListSerializer(serializers.ModelSerializer):
    contact = ContactSerializer()
    assignedTo = SafeIntegerField(source="assigned_to_id", default=None, allow_null=True)
    assignedToName = serializers.CharField(source="assigned_to_name", allow_null=True)
    lastMessagePreview = serializers.CharField(source="last_message_preview")
    lastMessageAt = serializers.DateTimeField(source="last_message_at", allow_null=True)
    lastInboundAt = serializers.DateTimeField(source="last_inbound_at", allow_null=True)
    firstMessageAt = serializers.DateTimeField(source="first_message_at", allow_null=True)
    firstResponseAt = serializers.DateTimeField(source="first_response_at", allow_null=True)
    resolvedAt = serializers.DateTimeField(source="resolved_at", allow_null=True)
    windowOpen = serializers.BooleanField(source="window_open", read_only=True)
    serviceWindowExpiresAt = serializers.DateTimeField(
        source="service_window_expires_at", allow_null=True, read_only=True
    )
    botPaused = serializers.BooleanField(source="bot_paused")
    unreadCount = SafeIntegerField(source="unread_count", max_value=100000)
    slaFirstResponseDueAt = serializers.DateTimeField(
        source="sla_first_response_due_at", allow_null=True
    )
    slaResolutionDueAt = serializers.DateTimeField(
        source="sla_resolution_due_at", allow_null=True
    )
    slaBreached = serializers.BooleanField(source="sla_breached")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppConversation
        fields = [
            "id", "contact", "status", "priority", "assignedTo", "assignedToName",
            "lastMessagePreview", "lastMessageAt", "lastInboundAt", "firstMessageAt",
            "firstResponseAt", "resolvedAt", "windowOpen", "serviceWindowExpiresAt",
            "botPaused", "starred", "unreadCount", "tags", "slaFirstResponseDueAt",
            "slaResolutionDueAt", "slaBreached", "csat", "createdAt", "updatedAt",
            "notes",
        ]


class ConversationDetailSerializer(ConversationListSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ["messages"]


# ---------------------------------------------------------------------------
# Messages & Automation: Templates, Notifications, Workflows, Logs
# ---------------------------------------------------------------------------

class MessageTemplateSerializer(serializers.ModelSerializer):
    """
    Matches `Template` type in WhatsAppMessagesPage & `TemplateSummary` in WhatsAppInboxPage.
    """

    id = StringIdField(source="pk", read_only=True)
    category = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    bodyPreview = serializers.CharField(source="body_text")
    headerType = serializers.CharField(source="header_type")
    footer = serializers.SerializerMethodField()
    variableCount = SafeIntegerField(source="variable_count")
    buttonCount = SafeIntegerField(source="button_count")
    updatedAt = serializers.DateTimeField(source="updated_at")
    rejectionReason = serializers.SerializerMethodField()
    metaTemplateId = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppTemplate
        fields = [
            "id",
            "name",
            "category",
            "language",
            "status",
            "bodyPreview",
            "headerType",
            "footer",
            "variableCount",
            "buttonCount",
            "updatedAt",
            "rejectionReason",
            "metaTemplateId",
        ]

    def get_category(self, obj):
        return (obj.category or "UTILITY").lower()

    def get_status(self, obj):
        s = (obj.status or "DRAFT").lower()
        if s == "paused":
            return "disabled"
        return s

    def get_footer(self, obj):
        return obj.footer or None

    def get_rejectionReason(self, obj):
        return obj.rejection_reason or None

    def get_metaTemplateId(self, obj):
        return obj.meta_template_id or None


class NotificationConfigSerializer(serializers.ModelSerializer):
    """
    Matches `NotificationConfig` in WhatsAppMessagesPage.
    """

    id = StringIdField(source="pk", read_only=True)
    templateId = StringIdField(source="template_id", read_only=True)
    templateName = serializers.SerializerMethodField()
    lastExecutedAt = serializers.DateTimeField(source="last_executed_at", allow_null=True)
    lastResult = serializers.CharField(source="last_result", allow_null=True)
    failureDetail = serializers.SerializerMethodField()
    requiresConsent = serializers.BooleanField(source="requires_consent")
    requiresVerifiedState = serializers.BooleanField(source="requires_verified_state")

    class Meta:
        model = WhatsAppNotificationConfig
        fields = [
            "id",
            "event",
            "label",
            "description",
            "templateId",
            "templateName",
            "enabled",
            "lastExecutedAt",
            "lastResult",
            "failureDetail",
            "requiresConsent",
            "requiresVerifiedState",
        ]

    def get_templateName(self, obj):
        return obj.template.name if obj.template else None

    def get_failureDetail(self, obj):
        return obj.failure_detail or None


class WorkflowSerializer(serializers.ModelSerializer):
    """
    Matches `Workflow` in WhatsAppMessagesPage.
    """

    id = StringIdField(source="pk", read_only=True)
    enabled = serializers.BooleanField(read_only=True)
    triggerLabel = serializers.SerializerMethodField()
    conditions = serializers.SerializerMethodField()
    templateId = StringIdField(source="template_id", read_only=True)
    templateName = serializers.SerializerMethodField()
    delaySeconds = serializers.SerializerMethodField()
    lastRunAt = serializers.DateTimeField(source="last_triggered_at", allow_null=True)
    lastRunResult = serializers.CharField(source="last_run_result", allow_null=True)
    successCount = SafeIntegerField(source="success_count")
    failureCount = SafeIntegerField(source="failure_count")

    class Meta:
        model = WhatsAppAutomation
        fields = [
            "id",
            "name",
            "enabled",
            "trigger",
            "triggerLabel",
            "conditions",
            "action",
            "templateId",
            "templateName",
            "delaySeconds",
            "lastRunAt",
            "lastRunResult",
            "successCount",
            "failureCount",
        ]

    def get_triggerLabel(self, obj):
        return obj.trigger_label or obj.get_trigger_display()

    def get_conditions(self, obj):
        if isinstance(obj.conditions_list, list) and obj.conditions_list:
            return obj.conditions_list
        if obj.conditions:
            return [c.strip() for c in obj.conditions.split(",") if c.strip()]
        return []

    def get_templateName(self, obj):
        return obj.template.name if obj.template else None

    def get_delaySeconds(self, obj):
        if obj.delay_seconds:
            return obj.delay_seconds
        return (obj.delay_minutes or 0) * 60


class WorkflowRunSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    automationId = StringIdField(source="automation_id", read_only=True)
    contactId = StringIdField(source="contact_id", read_only=True)
    executedAt = serializers.DateTimeField(source="executed_at")

    class Meta:
        model = WhatsAppWorkflowRun
        fields = ["id", "automationId", "contactId", "result", "detail", "executedAt"]


class MessageLogSerializer(serializers.ModelSerializer):
    """
    Matches `MessageLog` in WhatsAppMessagesPage (History & logs tab).
    """

    id = StringIdField(source="pk", read_only=True)
    messageId = serializers.SerializerMethodField()
    customerName = serializers.SerializerMethodField()
    templateName = serializers.SerializerMethodField()
    orderReference = serializers.SerializerMethodField()
    sentAt = serializers.DateTimeField(source="sent_at")
    failureReason = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppMessageLog
        fields = [
            "id",
            "messageId",
            "recipient",
            "customerName",
            "templateName",
            "category",
            "orderReference",
            "sentAt",
            "status",
            "failureReason",
        ]

    def get_messageId(self, obj):
        return obj.wa_message_id or str(obj.message_id or obj.pk)

    def get_customerName(self, obj):
        if obj.customer_name:
            return obj.customer_name
        if obj.contact and obj.contact.profile_name:
            return obj.contact.profile_name
        return None

    def get_templateName(self, obj):
        if obj.template_name:
            return obj.template_name
        return obj.template.name if obj.template else None

    def get_orderReference(self, obj):
        return obj.order_reference or None

    def get_failureReason(self, obj):
        return obj.failure_reason or None


# Legacy-compatible Template, Automation, Broadcast serializers
class TemplateSerializer(serializers.ModelSerializer):
    bodyText = serializers.CharField(source="body_text")
    headerType = serializers.CharField(source="header_type")
    variableCount = SafeIntegerField(source="variable_count")
    buttonCount = SafeIntegerField(source="button_count")
    metaTemplateId = serializers.CharField(source="meta_template_id")
    rejectionReason = serializers.CharField(source="rejection_reason")
    attachedCatalogItemIds = serializers.JSONField(source="attached_catalog_item_ids")
    hasProductAttachment = serializers.BooleanField(source="has_product_attachment")
    isPaused = serializers.BooleanField(source="is_paused")
    sentCount = SafeIntegerField(source="sent_count")
    deliveredCount = SafeIntegerField(source="delivered_count")
    readCount = SafeIntegerField(source="read_count")
    repliedCount = SafeIntegerField(source="replied_count")
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppTemplate
        fields = [
            "id", "name", "language", "category", "status", "quality", "components",
            "headerType", "bodyText", "footer", "variableCount", "buttonCount",
            "metaTemplateId", "rejectionReason", "attachedCatalogItemIds",
            "hasProductAttachment", "isPaused", "sentCount", "deliveredCount",
            "readCount", "repliedCount", "version", "lastSyncedAt", "createdAt",
            "updatedAt",
        ]


class AutomationSerializer(serializers.ModelSerializer):
    triggerLabel = serializers.CharField(source="trigger_label")
    templateId = SafeIntegerField(source="template_id", default=None, allow_null=True)
    templateName = serializers.SerializerMethodField()
    delayMinutes = SafeIntegerField(source="delay_minutes")
    delaySeconds = SafeIntegerField(source="delay_seconds")
    messagesSent = SafeIntegerField(source="messages_sent")
    successCount = SafeIntegerField(source="success_count")
    failureCount = SafeIntegerField(source="failure_count")
    lastTriggeredAt = serializers.DateTimeField(source="last_triggered_at", allow_null=True)
    lastRunResult = serializers.CharField(source="last_run_result", allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppAutomation
        fields = [
            "id", "name", "trigger", "triggerLabel", "action", "templateId",
            "templateName", "delayMinutes", "delaySeconds", "recipients",
            "conditions", "conditions_list", "status", "steps", "messagesSent",
            "successCount", "failureCount", "lastTriggeredAt", "lastRunResult",
            "runs", "createdAt", "updatedAt",
        ]

    def get_templateName(self, obj):
        return obj.template.name if obj.template else ""


class BroadcastSerializer(serializers.ModelSerializer):
    campaignName = serializers.CharField(source="campaign_name")
    templateId = SafeIntegerField(source="template_id", default=None, allow_null=True)
    templateName = serializers.SerializerMethodField()
    audienceLabel = serializers.CharField(source="audience_label")
    audienceRuleRef = serializers.CharField(source="audience_rule_ref")
    segmentId = SafeIntegerField(source="segment_id", default=None, allow_null=True)
    audienceCount = SafeIntegerField(source="audience_count")
    attachedCatalogItemIds = serializers.JSONField(source="attached_catalog_item_ids")
    hasProductAttachment = serializers.BooleanField(source="has_product_attachment")
    discountCode = serializers.CharField(source="discount_code")
    variableMapping = serializers.JSONField(source="variable_mapping")
    abTest = serializers.BooleanField(source="ab_test")
    estimatedCostKes = serializers.DecimalField(
        source="estimated_cost_kes", max_digits=12, decimal_places=2
    )
    actualCostKes = serializers.DecimalField(
        source="actual_cost_kes", max_digits=12, decimal_places=2
    )
    startAt = serializers.DateTimeField(source="start_at", allow_null=True)
    endAt = serializers.DateTimeField(source="end_at", allow_null=True)
    sentAt = serializers.DateTimeField(source="sent_at", allow_null=True)
    scheduledAt = serializers.DateTimeField(source="scheduled_at", allow_null=True)
    completedAt = serializers.DateTimeField(source="completed_at", allow_null=True)
    lastError = serializers.CharField(source="last_error")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppBroadcast
        fields = [
            "id", "campaignName", "objective", "templateId", "templateName",
            "audience", "audienceLabel", "audienceRuleRef", "segmentId",
            "audienceCount", "attachedCatalogItemIds", "hasProductAttachment",
            "discountCode", "variableMapping", "abTest", "recipients", "submitted",
            "delivered", "read", "replied", "failed", "clicks", "visits",
            "orders_count", "revenue", "currency", "estimatedCostKes",
            "actualCostKes", "startAt", "endAt", "sentAt", "scheduledAt",
            "completedAt", "status", "lastError", "createdAt", "updatedAt",
        ]

    def get_templateName(self, obj):
        return obj.template.name if obj.template else ""


# ---------------------------------------------------------------------------
# Analytics & Overview Payloads
# ---------------------------------------------------------------------------

class MetricValueSerializer(serializers.Serializer):
    value = serializers.FloatField(allow_null=True)
    previous = serializers.FloatField(allow_null=True)
    available = serializers.BooleanField()


class OverviewDataSerializer(serializers.Serializer):
    """
    Powers /api/whatsapp/overview for WhatsAppOverviewPage.
    """

    connection = ConnectionSummarySerializer()
    period = serializers.ChoiceField(choices=["7d", "30d", "90d"])
    messaging = serializers.DictField(allow_null=True)
    customerCommerce = serializers.DictField(allow_null=True)
    chart = serializers.ListField(child=serializers.DictField())
    conversations = InboxRecentConversationSerializer(many=True)
    products = serializers.DictField(allow_null=True)
    automation = serializers.DictField(allow_null=True)
    alerts = AlertItemSerializer(many=True)


class AnalyticsDataSerializer(serializers.Serializer):
    """
    Powers /api/whatsapp/analytics for WhatsAppAnalyticsPage.
    """

    overview = serializers.DictField()
    messaging = serializers.DictField()
    customers = serializers.DictField()
    commerce = serializers.DictField()
    campaigns = serializers.ListField(child=serializers.DictField())
    costs = serializers.DictField()


class ConsentLogSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    contactId = StringIdField(source="contact_id", read_only=True)
    recordedAt = serializers.DateTimeField(source="recorded_at")

    class Meta:
        model = WhatsAppConsentLog
        fields = ["id", "contactId", "action", "source", "recordedAt"]


class AttributionEventSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    eventType = serializers.CharField(source="event_type")
    campaignId = StringIdField(source="campaign_id", read_only=True)
    conversationId = StringIdField(source="conversation_id", read_only=True)
    contactId = StringIdField(source="contact_id", read_only=True)
    catalogItemId = StringIdField(source="catalog_item_id", read_only=True)
    orderId = StringIdField(source="order_id", read_only=True)
    revenue = serializers.FloatField()
    targetUrl = serializers.CharField(source="target_url")
    occurredAt = serializers.DateTimeField(source="occurred_at")

    class Meta:
        model = WhatsAppAttributionEvent
        fields = [
            "id", "eventType", "campaignId", "conversationId", "contactId",
            "catalogItemId", "orderId", "revenue", "currency", "targetUrl",
            "occurredAt",
        ]


class MessagingCostSerializer(serializers.ModelSerializer):
    id = StringIdField(source="pk", read_only=True)
    campaignId = StringIdField(source="campaign_id", read_only=True)
    conversationCount = SafeIntegerField(source="conversation_count")
    cost = serializers.FloatField()

    class Meta:
        model = WhatsAppMessagingCost
        fields = ["id", "date", "category", "campaignId", "conversationCount", "cost", "currency"]


# ---------------------------------------------------------------------------
# Orders, Webhooks, Invoices, Settings, Team, Audit, Quick Replies, Bot
# ---------------------------------------------------------------------------

class OrderSerializer(serializers.ModelSerializer):
    orderNumber = serializers.CharField(source="order_number")
    contactId = SafeIntegerField(source="contact_id", default=None, allow_null=True)
    contactName = serializers.CharField(source="contact_name")
    phone = serializers.SerializerMethodField()
    contactWaId = serializers.CharField(source="contact_wa_id")
    conversationId = SafeIntegerField(source="conversation_id", default=None, allow_null=True)
    checkoutOrderId = SafeIntegerField(source="checkout_order_id", default=None, allow_null=True)
    paymentMethod = serializers.CharField(source="payment_method")
    paymentRef = serializers.CharField(source="payment_ref")
    deliveryAddress = serializers.CharField(source="delivery_address")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppOrder
        fields = [
            "id", "orderNumber", "contactId", "contactName", "phone", "contactWaId",
            "conversationId", "checkoutOrderId", "items", "subtotal", "total",
            "currency", "status", "paymentMethod", "paymentRef", "deliveryAddress",
            "createdAt", "updatedAt",
        ]

    def get_phone(self, obj):
        return obj.contact_wa_id or (obj.contact.wa_id if obj.contact else "")


class WebhookEventSerializer(serializers.ModelSerializer):
    eventType = serializers.CharField(source="event_type")
    signatureValid = serializers.BooleanField(source="signature_valid")
    latencyMs = SafeIntegerField(source="latency_ms")
    receivedAt = serializers.DateTimeField(source="received_at", allow_null=True)

    class Meta:
        model = WhatsAppWebhookEvent
        fields = [
            "id", "type", "eventType", "payload", "status", "attempts",
            "signatureValid", "latencyMs", "error", "receivedAt",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    periodStart = serializers.DateField(source="period_start")
    periodEnd = serializers.DateField(source="period_end")
    amountKes = serializers.DecimalField(
        source="amount_kes", max_digits=12, decimal_places=2
    )
    issuedAt = serializers.DateTimeField(source="issued_at")
    pdfUrl = serializers.CharField(source="pdf_url")

    class Meta:
        model = WhatsAppInvoice
        fields = [
            "id", "periodStart", "periodEnd", "amountKes", "currency",
            "status", "issuedAt", "pdfUrl",
        ]


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppSettings
        fields = [
            "id", "business_hours", "timezone", "notifications", "routing",
            "sla_first_response_min", "sla_resolution_min", "opt_out_keywords",
            "default_language", "csat_enabled", "data_retention_days",
            "welcome_message", "away_message",
        ]
        read_only_fields = ["id"]

    def to_representation(self, instance):
        return {
            "id": instance.id,
            "businessHours": instance.business_hours,
            "timezone": instance.timezone,
            "notifications": instance.notifications,
            "routing": instance.routing,
            "slaFirstResponseMin": instance.sla_first_response_min,
            "slaResolutionMin": instance.sla_resolution_min,
            "optOutKeywords": instance.opt_out_keywords,
            "defaultLanguage": instance.default_language,
            "csatEnabled": instance.csat_enabled,
            "dataRetentionDays": instance.data_retention_days,
            "welcomeMessage": instance.welcome_message,
            "awayMessage": instance.away_message,
        }


class TeamMemberSerializer(serializers.ModelSerializer):
    userId = SafeIntegerField(source="user_id", default=None, allow_null=True)
    name = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.email", read_only=True)
    online = serializers.SerializerMethodField()
    lastSeenAt = serializers.DateTimeField(source="last_seen_at", allow_null=True)
    activeConversations = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppTeamMember
        fields = [
            "id", "userId", "name", "email", "role", "online",
            "lastSeenAt", "activeConversations",
        ]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.get_username()

    def get_online(self, obj):
        if not obj.last_seen_at:
            return False
        return obj.last_seen_at > timezone.now() - timedelta(minutes=5)

    def get_activeConversations(self, obj):
        return WhatsAppConversation.objects.filter(
            assigned_to=obj.user, status="OPEN"
        ).count()


class AuditEntrySerializer(serializers.ModelSerializer):
    actorName = serializers.CharField(source="actor_name")

    class Meta:
        model = WhatsAppAuditEntry
        fields = ["id", "actor", "actorName", "action", "target", "payload", "timestamp"]


class SegmentSerializer(serializers.ModelSerializer):
    cachedCount = SafeIntegerField(source="cached_count")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)
    count = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppSegment
        fields = [
            "id", "name", "description", "rules", "count", "cachedCount",
            "createdAt", "updatedAt",
        ]

    def get_count(self, obj):
        return obj.cached_count


class QuickReplySerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppQuickReply
        fields = ["id", "shortcut", "title", "body", "category", "createdAt", "updatedAt"]


class NotificationSerializer(serializers.ModelSerializer):
    linkTab = serializers.CharField(source="link_tab")

    class Meta:
        model = WhatsAppNotification
        fields = ["id", "type", "title", "body", "linkTab", "read", "payload", "timestamp"]


class BotNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppBotNode
        fields = ["id", "key", "kind", "title", "body", "options", "config", "position"]


class BotFlowSerializer(serializers.ModelSerializer):
    nodes = BotNodeSerializer(many=True, read_only=True)

    class Meta:
        model = WhatsAppBotFlow
        fields = ["id", "name", "is_published", "entry_node_key", "nodes"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["isPublished"] = data.pop("is_published")
        data["entryNodeKey"] = data.pop("entry_node_key")
        return data


class BotFlowWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    entry_node_key = serializers.CharField(required=False, allow_blank=True)
    is_published = serializers.BooleanField(required=False)
    nodes = serializers.ListField(child=serializers.DictField(), required=False)