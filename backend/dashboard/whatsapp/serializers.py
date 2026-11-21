from rest_framework import serializers

from .models import (
    WhatsAppAccount,
    WhatsAppAuditEntry,
    WhatsAppAutomation,
    WhatsAppBotFlow,
    WhatsAppBotNode,
    WhatsAppBroadcast,
    WhatsAppCatalog,
    WhatsAppCatalogItem,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppHealthCheck,
    WhatsAppInvoice,
    WhatsAppMessage,
    WhatsAppNotification,
    WhatsAppOrder,
    WhatsAppQuickReply,
    WhatsAppSegment,
    WhatsAppSettings,
    WhatsAppTeamMember,
    WhatsAppTemplate,
    WhatsAppWebhookEvent,
)


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


class HealthCheckSerializer(serializers.ModelSerializer):
    latencyMs = SafeIntegerField(source="latency_ms")
    at = serializers.DateTimeField(source="created_at")

    class Meta:
        model = WhatsAppHealthCheck
        fields = ["id", "ok", "latencyMs", "error", "at"]


class AccountSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source="is_active")
    displayPhone = serializers.CharField(source="display_phone")
    displayName = serializers.CharField(source="display_name")
    businessName = serializers.CharField(source="business_name")
    profilePictureUrl = serializers.CharField(source="profile_picture_url")
    phoneNumberId = serializers.CharField(source="phone_number_id")
    wabaId = serializers.CharField(source="waba_id")
    businessId = serializers.CharField(source="business_id")
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
    lastSyncedAt = serializers.DateTimeField(source="last_synced_at", allow_null=True)
    lastError = serializers.CharField(source="last_error")
    hasCatalog = serializers.BooleanField(source="has_catalog")
    qualityHistory = serializers.JSONField(source="quality_history")
    healthChecks = serializers.SerializerMethodField()
    healthCheckOk = serializers.SerializerMethodField()
    healthCheckError = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppAccount
        fields = [
            "id", "isActive", "displayPhone", "displayName", "businessName", "about",
            "address", "email", "website", "vertical", "profilePictureUrl",
            "phoneNumberId", "wabaId", "businessId", "qualityScore", "messagingLimit",
            "messagingLimitTier", "verificationStatus", "reviewStatus", "twoStepPin",
            "officialBusinessAccount", "tokenExpiresAt", "tokenDaysLeft",
            "webhookUrl", "webhookVerifyToken", "webhookFields", "lastSyncedAt",
            "lastError", "hasCatalog", "qualityHistory", "healthChecks",
            "healthCheckOk", "healthCheckError",
        ]

    def get_healthChecks(self, obj):
        return HealthCheckSerializer(obj.health_checks.all()[:20], many=True).data

    def get_healthCheckOk(self, obj):
        latest = obj.latest_health_check
        return latest.ok if latest else None

    def get_healthCheckError(self, obj):
        latest = obj.latest_health_check
        return latest.error if latest else ""


class CatalogSerializer(serializers.ModelSerializer):
    metaCatalogId = serializers.CharField(source="meta_catalog_id")
    autoSync = serializers.BooleanField(source="auto_sync")
    eligibilityRule = serializers.CharField(source="eligibility_rule")
    syncFrequencyMinutes = SafeIntegerField(source="sync_frequency_minutes")
    hidePrice = serializers.BooleanField(source="hide_price")
    defaultSort = serializers.CharField(source="default_sort")
    excludeOutOfStock = serializers.BooleanField(source="exclude_out_of_stock")
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
            "lastFullSyncAt", "lastSyncAdded", "lastSyncUpdated", "lastSyncFailed",
            "lastError", "itemCounts",
        ]


class CatalogItemSerializer(serializers.ModelSerializer):
    catalogId = SafeIntegerField(source="catalog_id", default=None, allow_null=True)
    retailerId = serializers.CharField(source="retailer_id")
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
    inStock = serializers.BooleanField(source="in_stock")
    stockQuantity = SafeIntegerField(source="stock_quantity")
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
            "id", "catalogId", "retailerId", "metaProductId", "storeProductId",
            "storeCategoryId", "storeProductName", "storeProductSlug", "isLinked",
            "isRemoved", "isBrowsable", "name", "displayTitle", "description",
            "displayDescription", "price", "salePrice", "effectivePrice", "currency",
            "imageUrl", "customImageUrl", "displayImageUrl", "productUrl", "category",
            "tags", "brand", "inStock", "stockQuantity", "eligible", "pinned",
            "sortOrder", "hidePrice", "isPriceHidden", "customTitle",
            "customDescription", "viewCount", "addToCartCount", "removedAt",
            "syncStatus", "reviewStatus", "rejectionReason", "lastError",
            "lastSyncedAt", "updatedAt",
        ]


class ContactSerializer(serializers.ModelSerializer):
    waId = serializers.CharField(source="wa_id")
    profileName = serializers.CharField(source="profile_name", allow_null=True)
    userId = SafeIntegerField(source="user_id", default=None, allow_null=True)
    isVerified = serializers.BooleanField(source="is_verified")
    isBlocked = serializers.BooleanField(source="is_blocked")
    optInStatus = serializers.CharField(source="opt_in_status")
    optInSource = serializers.CharField(source="opt_in_source")
    optInAt = serializers.DateTimeField(source="opt_in_at", allow_null=True)
    lastInboundAt = serializers.DateTimeField(source="last_inbound_at", allow_null=True)
    orderCount = SafeIntegerField(source="order_count")
    totalSpent = serializers.DecimalField(source="total_spent", max_digits=14, decimal_places=2)
    productAffinity = serializers.JSONField(source="product_affinity")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)

    class Meta:
        model = WhatsAppContact
        fields = [
            "id", "waId", "profileName", "email", "userId", "isVerified", "isBlocked",
            "tags", "attributes", "notes", "optInStatus", "optInSource", "optInAt",
            "lastInboundAt", "orderCount", "totalSpent", "productAffinity", "createdAt",
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

    class Meta:
        model = WhatsAppMessage
        fields = [
            "id", "waMessageId", "conversationId", "direction", "type", "body",
            "status", "errorMessage", "timestamp", "mediaId", "mediaUrl", "mimeType",
            "filename", "templateName", "templateParams", "productRefs", "cartItems",
            "interactiveButtons", "replyToId", "reactions", "author", "authorName",
            "isInternalNote",
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


class TemplateSerializer(serializers.ModelSerializer):
    bodyText = serializers.CharField(source="body_text")
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
            "bodyText", "metaTemplateId", "rejectionReason", "attachedCatalogItemIds",
            "hasProductAttachment", "isPaused", "sentCount", "deliveredCount",
            "readCount", "repliedCount", "version", "lastSyncedAt", "createdAt",
            "updatedAt",
        ]


class AutomationSerializer(serializers.ModelSerializer):
    triggerLabel = serializers.CharField(source="trigger_label")
    templateId = SafeIntegerField(source="template_id", default=None, allow_null=True)
    templateName = serializers.SerializerMethodField()
    delayMinutes = SafeIntegerField(source="delay_minutes")
    messagesSent = SafeIntegerField(source="messages_sent")
    lastTriggeredAt = serializers.DateTimeField(source="last_triggered_at", allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppAutomation
        fields = [
            "id", "name", "trigger", "triggerLabel", "templateId", "templateName",
            "delayMinutes", "recipients", "conditions", "status", "steps",
            "messagesSent", "lastTriggeredAt", "runs", "createdAt", "updatedAt",
        ]

    def get_templateName(self, obj):
        return obj.template.name if obj.template else ""


class BroadcastSerializer(serializers.ModelSerializer):
    campaignName = serializers.CharField(source="campaign_name")
    templateId = SafeIntegerField(source="template_id", default=None, allow_null=True)
    templateName = serializers.SerializerMethodField()
    audienceRuleRef = serializers.CharField(source="audience_rule_ref")
    segmentId = SafeIntegerField(source="segment_id", default=None, allow_null=True)
    audienceCount = SafeIntegerField(source="audience_count")
    attachedCatalogItemIds = serializers.JSONField(source="attached_catalog_item_ids")
    hasProductAttachment = serializers.BooleanField(source="has_product_attachment")
    variableMapping = serializers.JSONField(source="variable_mapping")
    abTest = serializers.BooleanField(source="ab_test")
    estimatedCostKes = serializers.DecimalField(
        source="estimated_cost_kes", max_digits=12, decimal_places=2
    )
    actualCostKes = serializers.DecimalField(
        source="actual_cost_kes", max_digits=12, decimal_places=2
    )
    sentAt = serializers.DateTimeField(source="sent_at", allow_null=True)
    scheduledAt = serializers.DateTimeField(source="scheduled_at", allow_null=True)
    completedAt = serializers.DateTimeField(source="completed_at", allow_null=True)
    lastError = serializers.CharField(source="last_error")
    createdAt = serializers.DateTimeField(source="created_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at", allow_null=True)

    class Meta:
        model = WhatsAppBroadcast
        fields = [
            "id", "campaignName", "templateId", "templateName", "audience",
            "audienceRuleRef", "segmentId", "audienceCount", "attachedCatalogItemIds",
            "hasProductAttachment", "variableMapping", "abTest", "recipients",
            "delivered", "read", "replied", "failed", "estimatedCostKes",
            "actualCostKes", "sentAt", "scheduledAt", "completedAt", "status",
            "lastError", "createdAt", "updatedAt",
        ]

    def get_templateName(self, obj):
        return obj.template.name if obj.template else ""


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
        from datetime import timedelta
        from django.utils import timezone
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