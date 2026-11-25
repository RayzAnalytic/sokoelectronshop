import { API_BASE, getAccessToken, request, uploadRequest } from './api';
import type {
    AdminBrand,
    AdminBrandRef,
    AdminBrandWrite,
    AdminCategory,
    AdminCategoryRef,
    AdminCategoryWrite,
    AdminProduct,
    AdminProductWrite,
    AdminProductVariant,
    AdminProductVariantWrite,
    AdminPoster,
    AdminPosterWrite,
    AdminPosterFilters,
    AdminPosterStatus,
    AdminHealthSummaryResponse,
    AdminSubscriber,
    AdminSubscriberStats,
    AdminSubscriberWrite,
    AdminSubscriberList,
    AdminSubscriberListWrite,
    AdminEmailTemplate,
    AdminEmailTemplateWrite,
    AdminCampaign,
    AdminCampaignWrite,
    AdminCampaignStatus,
    AdminCampaignRecipient,
    AdminSegment,
    AdminGrowthPoint,
    AdminCampaignPerformance,
    AdminAnalyticsSummary,
    AdminCampaignFull,
    AdminCampaignFullWrite,
    AdminCreatorApplication,
    AdminCreatorApplicationWrite,
    AdminPartnership,
    AdminPartnershipWrite,
    AdminCreatorSample,
    AdminCreatorSampleWrite,
    AdminCompleteOrderPayload,
    AdminCompleteOrderResult,
    AdminStickerData,
    AdminMetaCampaign,
    AdminMetaCampaignWrite,
    AdminMetaCampaignAnalytics,
    AdminOrderListResponse,
    AdminOrderStats,
    AdminOrderTabCounts,
    AdminOrderDetail,
    AdminOrderFilters,
    AdminOrderStatusWrite,
    AdminOrderTrackingWrite,
    AdminOrderRefundWrite,
    AdminOrderNoteWrite,
    AdminOrderWhatsAppWrite,
    AdminOrderExportWrite,
    AdminOrderExportResponse,
    AdminNotificationSetting,
    AdminCreatorSale,
    AdminCreatorSaleWrite,
    AdminCustomerSegmentWrite,
    AdminLead,
    AdminLeadWrite,
    AdminLeadConvertWrite,
    AdminFollowUp,
    AdminFollowUpWrite,
    AdminPermissionGroup,
    AdminPermissionGroupWrite,
    AdminAdCampaign,
    AdminAdCampaignWrite,
    AdminCustomerListResponse,
    AdminCustomerStats,
    AdminCustomerDetail,
    AdminCustomerNote,
    AdminCustomerAddress,
    AdminBlockWrite,
    AdminConsentWrite,
    AdminNoteWrite,
    AdminWhatsAppWrite,
    AdminEmailWrite,
    AdminAddressWrite,
    AdminCustomerFilters,
    AdminCustomerFull,
    AdminCustomerFullWrite,
    AdminCustomerStatsFull,
    AdminCustomerStatus,
    AdminCustomerSegment,
    AdminMarketingConsent,

    AdminSupplier,
    AdminSupplierWrite,
    AdminSupplierProductInput,
    AdminPurchaseInput,
    AdminInventoryItem,
    AdminStockMovement,
    AdminInventoryAdjustInput,
    AdminSupplierFull,
    AdminSupplierFullWrite,
    AdminPurchaseOrder,
    AdminPurchaseOrderWrite,
    AdminLocation,
    AdminLocationWrite,
    AdminInventoryMovement,
    AdminInventoryMovementWrite,
    AdminInventorySummary,

    AdminReview,
    AdminReviewReply,
    AdminReviewStats,
    AdminReviewFilters,
    AdminBulkReviewWrite,
    AdminRejectReviewWrite,
    AdminFlagReviewWrite,
    AdminReplyReviewWrite,
    AdminReviewFull,
    AdminReviewFullWrite,

    AdminDiscount,
    AdminDiscountWrite,
    AdminDiscountFilters,
    AdminDiscountSlowMover,
    AdminBulkClearanceWrite,
    AdminDiscountAnalytics,
    AdminDiscountAnalyticsSummary,
    AdminDiscountRules,
    AdminCoupon,
    AdminCouponWrite,

    AdminTransaction,
    AdminTransactionSummary,
    AdminTransactionFilters,
    AdminReconcileWrite,
    AdminRetryWrite,
    AdminBulkExportWrite,

    AdminKenyaRegions,
    AdminShippingZone,
    AdminShippingZoneWrite,
    AdminShippingRateWrite,
    AdminShippingMethod,
    AdminPickupLocation,
    AdminPickupLocationWrite,
    AdminShipment,
    AdminShipmentStatusWrite,
    AdminCourierConfig,
    AdminCourierTestResult,
    AdminDeliveryZone,
    AdminDeliveryZoneWrite,
    AdminDeliveryZoneFull,
    AdminDeliveryZoneFullWrite,

    AdminWhatsAppAccount,
    AdminWhatsAppAccountWrite,
    AdminWhatsAppContact,
    AdminWhatsAppContactDetail,
    AdminWhatsAppContactFilters,
    AdminWhatsAppContactWrite,
    AdminWhatsAppConversation,
    AdminWhatsAppConversationDetail,
    AdminWhatsAppConversationFilters,
    AdminWhatsAppMessage,
    AdminWhatsAppMessageWrite,
    AdminWhatsAppAssignWrite,
    AdminWhatsAppResolveWrite,
    AdminWhatsAppTagWrite,
    AdminWhatsAppNoteWrite,
    AdminWhatsAppTemplate,
    AdminWhatsAppTemplateWrite,
    AdminWhatsAppTemplateSyncResult,
    AdminWhatsAppAutomation,
    AdminWhatsAppAutomationWrite,
    AdminWhatsAppAutomationToggleWrite,
    AdminWhatsAppBroadcast,
    AdminWhatsAppBroadcastWrite,
    AdminWhatsAppBroadcastFilters,
    AdminWhatsAppBroadcastStats,
    AdminWhatsAppAnalyticsSummary,
    AdminWhatsAppAnalyticsSeries,
    AdminWhatsAppCostBreakdown,
    AdminWhatsAppBillingSummary,
    AdminWhatsAppOtpRequestWrite,
    AdminWhatsAppOtpConfirmWrite,
    AdminWhatsAppOtpConfirmResult,
    AdminWhatsAppSegment,
    AdminWhatsAppSegmentWrite,
    AdminWhatsAppQuickReply,
    AdminWhatsAppQuickReplyWrite,
    AdminWhatsAppOrder,
    AdminWhatsAppOrderUpdate,
    AdminWhatsAppStatus,

    AdminSocialPlatform,
    AdminSocialAccount,
    AdminSocialAccountDetail,
    AdminSocialAccountCapabilities,
    AdminSocialPaginated,
    AdminSocialScheduledPost,
    AdminSocialPublishedPost,
    AdminSocialMediaFolder,
    AdminSocialMedia,
    AdminSocialQueueSlot,
    AdminSocialQueueSlotWrite,
    AdminSocialEvergreenPost,
    AdminSocialEvergreenPostWrite,
    AdminSocialDraftStatus,
    AdminSocialDraftComment,
    AdminSocialDraft,
    AdminSocialDraftWrite,
    AdminSocialDraftCommentWrite,
    AdminSocialInboxItemType,
    AdminSocialInboxStatus,
    AdminSocialSentiment,
    AdminSocialInboxReply,
    AdminSocialInboxItem,
    AdminSocialInboxFilters,
    AdminSocialTemplate,
    AdminSocialTemplateWrite,
    AdminSocialLink,
    AdminSocialLinkWrite,
    AdminSocialNotificationType,
    AdminSocialNotification,
    AdminSocialNotificationList,
    AdminSocialTeamRole,
    AdminSocialTeamMember,
    AdminSocialTeamMemberWrite,
    AdminSocialTeamMemberPatch,
    AdminSocialAuditLog,
    AdminSocialReport,
    AdminSocialReportWrite,
    AdminSocialKpis,
    AdminSocialOverview,
    AdminSocialDemographicSnapshot,
    AdminSocialBestTimeRow,
    AdminSocialKpiAnalytics,
    AdminSocialPostWrite,
    AdminSocialPostCreated,
    AdminSocialPostPatch,
    AdminSocialBulkIds,
    AdminSocialBulkReschedule,
    AdminSocialBoostWrite,
    AdminSocialBoostResult,
    AdminSocialEditCaptionWrite,
    AdminSocialFollowerPoint,
    AdminSocialEngagementPoint,
    InboxReplyCreateBody,

    AdminDirectOrder,
    AdminDirectOrderStatus,
    AdminDirectOrderSource,
    AdminDirectOrderAdvanceWrite,
    AdminDirectOrderWrite,
    AdminDirectCreator,
    AdminDirectCreatorWrite,
    AdminDirectContent,
    AdminDirectContentWrite,
    AdminDirectContentPlatform,
    AdminDirectLive,
    AdminDirectLiveWrite,
    AdminDirectProduct,
    AdminDirectProductWrite,
    AdminDirectProductStatus,
    AdminDirectCreateOrderWrite,
    AdminDirectSendCheckoutLinkWrite,
    AdminDirectReturnRequest,
    AdminDirectReturnRequestWrite,

    AdminAIOverview,
    AdminAIConversation,
    AdminAIMessage,
    AdminAIMessageWrite,
    AdminAISearchConfig,
    AdminAISearchConfigWrite,
    AdminAISearchAnalytics,
    AdminAISearchDataQuality,
    AdminAIContentRequest,
    AdminAIContentResponse,
    AdminAIContentBulkRequest,
    AdminAIContentBulkResponse,
    AdminAIAutomation,
    AdminAIAutomationWrite,
    AdminAIAutomationTemplate,
    AdminAIAutomationStatusWrite,
    AdminAIInsight,
    AdminAIInsightExecuteResponse,
    AdminAISettings,
    AdminAISettingsWrite,
    AdminAIUsage,
    AdminAIChartSpec,
    AdminAIAlert,

    AdminRuntimeSettings,
    AdminGeneralSettings,
    AdminGeneralSettingsWrite,
    AdminStoreSettings,
    AdminStoreSettingsWrite,
    AdminCheckoutSettings,
    AdminCheckoutSettingsWrite,
    AdminInventorySettings,
    AdminInventorySettingsWrite,
    AdminReviewSettings,
    AdminReviewSettingsWrite,

    AdminPaymentSettings,
    AdminPaymentSettingsWrite,
    AdminPaymentConfig,
    AdminPaymentConfigWrite,
    AdminPaymentTestResult,
    AdminPaymentSummary,
    AdminPaymentTransactionFilters,
    AdminMpesaStatus,
    AdminMpesaTransaction,
    AdminMpesaTransactionFilters,

    AdminShippingSettings,
    AdminShippingSettingsWrite,
    AdminShippingProvider,
    AdminShippingProviderWrite,
    AdminShippingProviderKey,

    AdminNotificationSettings,
    AdminNotificationSettingsWrite,
    AdminNotificationLog,
    AdminNotificationLogFilters,
    AdminNotification,

    AdminSecuritySettings,
    AdminSecuritySettingsWrite,
    AdminLoginEvent,
    AdminActiveSession,
    AdminChangePasswordInput,
    AdminTwoFASetup,
    AdminTwoFAVerifyInput,

    AdminIntegration,
    AdminIntegrationWrite,
    AdminIntegrationStatus,
    AdminIntegrationFilters,
    AdminTaxSettings,
    AdminTaxSettingsWrite,
    AdminEtimsSubmission,
    AdminEtimsSubmissionFilters,
    AdminEtimsStatus,
    AdminSettingsAuditLog,
    AdminSettingsAuditLogFilters,

    AdminStaffUser,
    AdminStaffUserWrite,
    AdminStaffUserStatus,
    AdminStaffUserInviteWrite,
    AdminStaffInvite,
    AdminStaffFilters,
    AdminStaffRole,
    AdminPermissionRow,
    AdminPermissionMatrixWrite,
    AdminInviteAcceptWrite,

    ReportRange,
    ReportQuery,
    ReportSalesResponse,
    ReportOrdersResponse,
    ReportCustomersResponse,
    ReportProductsResponse,
    ReportInventoryResponse,
    ReportPaymentsResponse,
    ReportTaxesResponse,
    ReportShippingResponse,
    ReportDiscountsResponse,
    ReportSocialResponse,
    ReportExportWrite,
    ReportExportResponse,
    ReportRefreshWrite,
    ReportRefreshResponse,

    AnalyticsRange,
    AnalyticsTab,
    AnalyticsQuery,
    AnalyticsTrafficResponse,
    AnalyticsSalesResponse,
    AnalyticsCustomersResponse,
    AnalyticsProductsResponse,
    AnalyticsChannelsResponse,
    AnalyticsRefreshWrite,
    AnalyticsRefreshResponse,

    OverviewRange,
    OverviewQuery,
    OverviewKpi,
    OverviewRevenuePoint,
    OverviewOrderStatusRow,
    OverviewSalesPeriodRow,
    OverviewTopCategory,
    OverviewTopProduct,
    OverviewRecentOrder,
    OverviewRecentCustomer,
    OverviewRecentTransaction,
    OverviewLowStockRow,
    OverviewPaymentMethodRow,
    OverviewResponse,
    OverviewRefreshWrite,
    OverviewRefreshResponse,

    AdminInboxConversation,
    AdminInboxConversationWrite,
    AdminInboxMessage,
    AdminInboxMessageWrite,
    AdminInboxConvertWrite,
    AdminTeamMember,
    AdminTeamMemberWrite,

    AdminReturnRequest,
    AdminReturnRequestWrite,
    AdminReturnFilters,
    AdminReturnCreateWrite,
    AdminReturnPatchWrite,
    AdminReturnRejectWrite,
    AdminReturnRefundWrite,
    AdminRefundMethod,
    AdminReturnRefundMethodWrite,
    AdminReturnStats,
    AdminReturnHistoryPoint,
    AdminRefundRecord,
    AdminReturnReason,
    AdminReturnReasonWrite,
    AdminReturnSettings,
    AdminReturnSettingsWrite,
    AdminReturnStatus,
    AdminRefundStatus,

    AdminSupportTicket,
    AdminSupportTicketWrite,

    AdminExpense,
    AdminExpenseWrite,
    AdminAutomation,
    AdminAutomationWrite,
    AdminAuditLog,
    AdminAuditLogFilters,
    AdminAttributionLink,
    AdminAttributionLinkWrite,
    AdminPayoutBatch,
    AdminPayoutBatchWrite,
    AdminAnalyticsSummaryResponse,
    AdminFinanceSummaryResponse,
} from './admin-types';
import type {
    Banner,
    BannerWriteInput,
    BannerListQuery,
    BannerStats,
} from './api';

interface StaffInviteCreateResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    department: string;
    status: string;
    expires_at: string;
}

interface StaffInviteLookupResponse {
    valid: boolean;
    email: string;
    name: string;
    role: string;
    department: string;
    invited_by: string | null;
    expires_at: string;
}

interface StaffInviteAcceptResponse {
    user: AdminStaffUser;
    role: string;
    redirect_to: string;
}

interface MyPermissionsResponse {
    modules: string[];
    role: string;
    dashboard_url: string;
}

export type WhatsAppCatalogSyncStatus =
    | 'NOT_SYNCED'
    | 'SYNCING'
    | 'SYNCED'
    | 'OUT_OF_DATE'
    | 'FAILED'
    | 'REJECTED';

export type WhatsAppCatalogReviewStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED';

export type WhatsAppCatalogEligibilityRule =
    | 'ALL_ACTIVE'
    | 'IN_STOCK_ONLY'
    | 'HAS_IMAGE'
    | 'TAGGED_WHATSAPP'
    | 'MANUAL';

export type WhatsAppCatalogDefaultSort =
    | 'PINNED_FIRST'
    | 'POPULAR'
    | 'PRICE_ASC'
    | 'PRICE_DESC'
    | 'NEWEST';

export interface AdminWhatsAppCatalogCounts {
    total: number;
    eligible: number;
    synced: number;
    syncing: number;
    outOfDate: number;
    failed: number;
    linked: number;
    unlinked: number;
    inStock: number;
    pinned: number;
    removed: number;
}

export interface AdminWhatsAppCatalog {
    id: number | null;
    name: string;
    metaCatalogId: string;
    connected: boolean;
    autoSync: boolean;
    eligibilityRule: WhatsAppCatalogEligibilityRule;
    syncFrequencyMinutes: number;
    hidePrice: boolean;
    defaultSort: WhatsAppCatalogDefaultSort;
    excludeOutOfStock: boolean;
    lastFullSyncAt: string | null;
    lastSyncAdded: number;
    lastSyncUpdated: number;
    lastSyncFailed: number;
    lastError: string;
    itemCounts: AdminWhatsAppCatalogCounts;
    updatedAt: string | null;
}

export interface AdminWhatsAppCatalogItem {
    id: number;
    catalogId: number;
    retailerId: string;
    metaProductId: string;
    storeProductId: string | null;
    storeCategoryId: number | null;
    storeProductName: string | null;
    storeProductSlug: string | null;
    isLinked: boolean;
    isRemoved: boolean;
    isBrowsable: boolean;
    name: string;
    displayTitle: string;
    description: string;
    displayDescription: string;
    price: string;
    salePrice: string | null;
    effectivePrice: string;
    currency: string;
    imageUrl: string;
    customImageUrl: string;
    displayImageUrl: string;
    productUrl: string;
    category: string;
    brand: string;
    tags: string[];
    inStock: boolean;
    stockQuantity: number;
    eligible: boolean;
    pinned: boolean;
    sortOrder: number;
    hidePrice: boolean;
    isPriceHidden: boolean;
    customTitle: string;
    customDescription: string;
    viewCount: number;
    addToCartCount: number;
    removedAt: string | null;
    syncStatus: WhatsAppCatalogSyncStatus;
    reviewStatus: WhatsAppCatalogReviewStatus | null;
    rejectionReason: string;
    lastError: string;
    lastSyncedAt: string | null;
    updatedAt: string;
}

export interface AdminWhatsAppCatalogItemFilters {
    search?: string;
    syncStatus?: WhatsAppCatalogSyncStatus | '';
    category?: string;
    eligibleOnly?: boolean;
    linkedOnly?: boolean;
    unlinkedOnly?: boolean;
}

export interface AdminWhatsAppCatalogItemUpdate {
    eligible?: boolean;
    pinned?: boolean;
    sortOrder?: number;
    hidePrice?: boolean;
    customTitle?: string;
    customDescription?: string;
    customImageUrl?: string;
}

export interface AdminWhatsAppCatalogItemLinkWrite {
    store_product_id?: number;
    store_category_id?: number;
    retailer_id?: string;
    auto_sync_now?: boolean;
}

export interface AdminWhatsAppCatalogItemUnlinkWrite {
    ids: number[];
    remove_item?: boolean;
}

export interface AdminWhatsAppCatalogUpdate {
    name?: string;
    autoSync?: boolean;
    eligibilityRule?: WhatsAppCatalogEligibilityRule;
    syncFrequencyMinutes?: number;
    hidePrice?: boolean;
    defaultSort?: WhatsAppCatalogDefaultSort;
    excludeOutOfStock?: boolean;
    connected?: boolean;
}

export interface AdminWhatsAppCatalogBulkWrite {
    ids: number[];
    patch: AdminWhatsAppCatalogItemUpdate;
}

export interface AdminWhatsAppCatalogSyncSummary {
    added: number;
    updated: number;
    failed: number;
}

export interface AdminWhatsAppCatalogCreateWrite {
    name?: string;
}

export interface AdminWhatsAppTopProduct {
    id: string;
    name: string;
    units: number;
    revenueKes: number;
}

export interface AdminWhatsAppRecoveryByProduct {
    name: string;
    recovered: number;
}

export interface AdminWhatsAppCommerceStats {
    messagesSentToday: number;
    abandonedCartsRecovered: number;
    ordersFromWhatsApp: number;
    ordersRevenueKes: number;
    averageResponseMin: number;
    productViews: number;
    addToCartRate: number;
    topProducts: AdminWhatsAppTopProduct[];
    recoveryByProduct: AdminWhatsAppRecoveryByProduct[];
}

export interface AdminWhatsAppSendProductsWrite {
    retailerIds: string[];
    headerText?: string;
    body?: string;
}

export interface AdminWhatsAppSendCartWrite {
    items: {
        retailer_id: string;
        name: string;
        qty: number;
        price: string;
    }[];
    checkoutUrl?: string;
}

export type AdminWhatsAppSendMediaWrite =
    | { kind: 'image' | 'video' | 'document'; file: File; caption?: string }
    | { kind: 'image' | 'video' | 'document'; url: string; caption?: string };

export type AdminWhatsAppSendImageWrite = AdminWhatsAppSendMediaWrite;

export interface AdminWhatsAppSendInteractiveWrite {
    body: string;
    buttons: { text: string }[];
}

export interface AdminWhatsAppReactWrite {
    emoji: string;
}

export interface AdminWhatsAppCatalogManualAddWrite {
    product_ids: number[];
}

export interface AdminWhatsAppCatalogReorderWrite {
    ordered_ids: number[];
}

export interface AdminWhatsAppCatalogManualAddResponse {
    added: number;
    skipped: number;
    item_ids: number[];
}

export interface AdminWhatsAppCatalogReorderResponse {
    updated: number;
}

export interface AdminWhatsAppSettings {
    id?: number;
    businessHours: Record<string, unknown>;
    timezone: string;
    notifications: Record<string, unknown>;
    routing: 'ROUND_ROBIN' | 'LOAD_BASED' | 'MANUAL';
    slaFirstResponseMin: number;
    slaResolutionMin: number;
    optOutKeywords: string[];
    defaultLanguage: string;
    csatEnabled: boolean;
    dataRetentionDays: number;
    welcomeMessage: string;
    awayMessage: string;
}

export interface AdminWhatsAppSettingsUpdate {
    business_hours?: Record<string, unknown>;
    timezone?: string;
    notifications?: Record<string, unknown>;
    routing?: 'ROUND_ROBIN' | 'LOAD_BASED' | 'MANUAL';
    sla_first_response_min?: number;
    sla_resolution_min?: number;
    opt_out_keywords?: string[];
    default_language?: string;
    csat_enabled?: boolean;
    data_retention_days?: number;
    welcome_message?: string;
    away_message?: string;
}

export interface AdminWhatsAppTeamMember {
    id: number;
    userId: number;
    name: string;
    email: string;
    role: 'ADMIN' | 'AGENT' | 'VIEWER';
    online: boolean;
    lastSeenAt: string | null;
    activeConversations: number;
}

export interface AdminWhatsAppTeamMemberWrite {
    userId: number;
    role?: 'ADMIN' | 'AGENT' | 'VIEWER';
}

export interface AdminWhatsAppTeamMemberUpdate {
    role?: 'ADMIN' | 'AGENT' | 'VIEWER';
    online?: boolean;
}

export interface AdminWhatsAppAuditEntry {
    id: number;
    actor: number | null;
    actorName: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
    timestamp: string | null;
}

export interface AdminWhatsAppNotification {
    id: number;
    type: 'message' | 'template' | 'order' | 'broadcast' | 'system' | 'quality';
    title: string;
    body: string;
    linkTab: string;
    read: boolean;
    payload: Record<string, unknown>;
    timestamp: string | null;
}

export interface AdminQRVerifyItem {
    id: number | string;
    product_id?: string;
    name: string;
    brand?: string;
    price: string | number;
    quantity: number;
    subtotal: string | number;
    image?: string;
    serial_number?: string;
    imei?: string;
    warranty_months?: number;
}

export interface AdminQRVerifyResponse {
    reference: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    status: string;
    status_label: string;
    payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed';
    payment_status_label: string;
    payment_method: string;
    mpesa_receipt_number: string | null;
    total: string | number;
    created_at: string;
    items: AdminQRVerifyItem[];
    fulfilled: boolean;
}

export type AdminAIAutomationRunStatus =
    | 'queued'
    | 'running'
    | 'success'
    | 'failed'
    | 'skipped'
    | 'cancelled';

export type AdminAIAutomationTriggeredBy =
    | 'schedule'
    | 'manual'
    | 'event'
    | 'api';

export interface AdminAIAutomationRun {
    id: number;
    automation: number;
    status: AdminAIAutomationRunStatus;
    triggeredBy: AdminAIAutomationTriggeredBy;
    triggeredByUser: number | null;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number;
    summary: string;
    output: Record<string, unknown>;
    itemsAffected: number;
    errorMessage: string;
    errorTrace: string;
    requestId: string;
    tokensIn: number;
    tokensOut: number;
    costKes: number;
    createdAt: string;
    startedRelative: string;
}

export type AdminAIToolCallStatus = 'ok' | 'error' | 'timeout';

export interface AdminAIToolCall {
    id: number;
    tool_name: string;
    arguments: Record<string, unknown> | null;
    result_summary: string;
    row_count: number;
    duration_ms: number;
    status: AdminAIToolCallStatus;
    error_message: string;
    created_at: string;
}

export type AdminAIAuditAction =
    | 'chat'
    | 'query'
    | 'tool_call'
    | 'write'
    | 'destructive'
    | 'automation_run'
    | 'automation_toggle'
    | 'settings_update'
    | 'alert_dismiss'
    | 'insight_execute'
    | 'conversation_clear'
    | 'export';

export interface AdminAIAuditLog {
    id: number;
    user: number | null;
    userDisplay: string;
    action: AdminAIAuditAction;
    tool: string;
    args: Record<string, unknown> | null;
    resultSize: number;
    requestId: string;
    ipAddress: string | null;
    userAgent: string;
    path: string;
    permissionSnapshot: Record<string, unknown>;
    wasConfirmed: boolean;
    isVerified: boolean;
    createdAt: string;
    timestamp: string;
}

export interface AdminAIAuditLogFilters {
    action?: AdminAIAuditAction | 'all';
    user?: number;
    limit?: number;
}

export type AdminAIAutomationKind =
    | 'low_stock'
    | 'abandoned_cart'
    | 'pending_order'
    | 'failed_payment'
    | 'return_refund'
    | 'sales_summary'
    | 'newsletter_perf'
    | 'unusual_change'
    | 'custom';

export type AdminAIAutomationScheduleKind =
    | 'interval'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'event'
    | 'manual';

export interface AdminAIAutomationExtended {
    id: number;
    name: string;
    kind: AdminAIAutomationKind;
    description: string;
    trigger: string;
    action: string;
    triggerConfig: Record<string, unknown>;
    actionConfig: Record<string, unknown>;
    status: 'Active' | 'Paused' | 'Draft';
    isEnabled: boolean;
    scheduleKind: AdminAIAutomationScheduleKind;
    scheduleIntervalMinutes: number;
    scheduleCron: string;
    timezone: string;
    nextRunAt: string | null;
    cooldownMinutes: number;
    maxRunsPerDay: number;
    requiresApproval: boolean;
    createdBy: number | null;
    owner: number | null;
    runs: number;
    runsFailed: number;
    successRate: number;
    lastRunAt: string | null;
    lastRunStatus: string;
    lastError: string;
    lastRun: string;
    recentRuns: AdminAIAutomationRun[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminAIAutomationRunRequest {
    confirm?: boolean;
    dryRun?: boolean;
    params?: Record<string, unknown>;
}

export type AdminAIAlertSeverity = 'high' | 'medium' | 'low';
export type AdminAIAlertCategory =
    | 'inventory'
    | 'orders'
    | 'payments'
    | 'customers'
    | 'returns'
    | 'messages';

export interface AdminAIAlertFilters {
    severity?: AdminAIAlertSeverity | 'all';
    category?: AdminAIAlertCategory | 'all';
}

export interface AdminAIAlertSnoozeWrite {
    minutes: number;
}

export interface AdminAIAlertDismissWrite {
    reason?: string;
}

export interface AdminAIInsightExecuteWrite {
    confirm?: boolean;
    params?: Record<string, unknown>;
}

export interface AdminAIToolSchema {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface AdminAIToolPreviewWrite {
    name: string;
    args?: Record<string, unknown>;
}

export interface AdminAIToolPreviewResponse {
    items: unknown[];
    summary?: string;
    note?: string;
    chart?: AdminAIChartSpec;
    table?: { headers: string[]; rows: string[][] };
    link?: { label: string; href: string };
    [key: string]: unknown;
}

export interface AdminAIConversationDetail extends AdminAIConversation {
    messages: AdminAIMessage[];
}

export interface AdminAIConversationCreateWrite {
    title?: string;
    origin_path?: string;
    origin_module?: string;
    model?: string;
}

export interface AdminAIConversationUpdateWrite {
    title?: string;
    status?: 'active' | 'archived';
    is_pinned?: boolean;
}

export interface AdminAIUsageLogRow {
    id: number;
    feature: string;
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costKes: number;
    user: number | null;
    conversation: number | null;
    requestId: string;
    latencyMs: number;
    cacheHit: boolean;
    createdAt: string;
    timestamp: string;
}

export interface AdminWhatsAppWebhookEvent {
    id: number;
    type: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: 'DELIVERED' | 'FAILED' | 'RETRYING';
    attempts: number;
    signatureValid: boolean;
    latencyMs: number;
    error: string;
    receivedAt: string | null;
}

export interface AdminWhatsAppAnalyticsFunnelStage {
    stage: string;
    count: number;
}

export interface AdminWhatsAppAgentLeaderboardRow {
    id: number;
    userId: number;
    name: string;
    messages: number;
    avgResponseMin: number;
    csat: number;
    slaRate: number;
    resolved: number;
}

export interface AdminWhatsAppInvoice {
    id: number;
    periodStart: string;
    periodEnd: string;
    amountKes: string;
    currency: string;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
    issuedAt: string;
    pdfUrl: string;
}

export interface AdminWhatsAppBotNodeWrite {
    key: string;
    kind: string;
    title: string;
    body?: string;
    options?: Array<{ id: string; label: string; next_id?: string }>;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
}

export interface AdminWhatsAppBotFlowWrite {
    name?: string;
    entry_node_key?: string;
    is_published?: boolean;
    nodes?: AdminWhatsAppBotNodeWrite[];
}

export interface AdminWhatsAppBotNode {
    id: number;
    flowId: number;
    key: string;
    kind: string;
    title: string;
    body: string;
    options: Array<{ id: string; label: string; next_id?: string }>;
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
    createdAt: string;
    updatedAt: string;
}

export interface AdminWhatsAppBotFlow {
    id: number | null;
    name: string;
    isPublished: boolean;
    entryNodeKey: string;
    nodes: AdminWhatsAppBotNode[];
}

export interface AdminWhatsAppContactImportWrite {
    rows: Array<Record<string, unknown>>;
}

export interface AdminWhatsAppContactImportResult {
    added: number;
    skipped: number;
}

export interface AdminWhatsAppContactBulkWrite {
    ids: number[];
    patch: Partial<AdminWhatsAppContactWrite>;
}

export interface AdminAIAttachmentInput {
    id?: string;
    name: string;
    size: number;
    type: string;
    preview?: string;
}

export interface AdminAIProvenanceItem {
    label: string;
    detail?: string;
    href?: string;
    count?: number;
}

export interface AdminAIMessageAction {
    id: string;
    label: string;
    tone?: 'default' | 'danger' | 'primary';
    href?: string;
    prompt?: string;
    requiresConfirmation?: boolean;
    params?: Record<string, unknown>;
}

export interface AdminAIToolCallInline {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    params?: Record<string, unknown>;
    resultSummary?: string;
    durationMs?: number;
}

export interface AdminAIPendingAction {
    id: string;
    tool: string;
    title: string;
    description: string;
    params: Record<string, unknown>;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    preview?: Array<{ label: string; value: string }>;
}

export interface AdminAIActionExecuteWrite {
    tool: string;
    params?: Record<string, unknown>;
    confirm?: boolean;
    confirmation_token?: string;
}

export interface AdminAIActionExecuteResponse {
    success: boolean;
    message: string;
    result: Record<string, unknown>;
}

export interface AdminAIDigestItem {
    label: string;
    value: string;
    delta?: number;
    tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
    href?: string;
}

export interface AdminAIDigestResponse {
    items: AdminAIDigestItem[];
    generatedAt: string;
}

export interface AdminAIConversationExportResponse {
    content: string;
    filename: string;
    mimeType: string;
}

export interface AdminAIMessageFeedbackWrite {
    feedback: 'up' | 'down';
}

export interface AdminAIMessageFeedbackResponse {
    messageId: number | string;
    feedback: 'up' | 'down';
}

function unwrapList<T>(res: T[] | { results: T[] }): T[] {
    return Array.isArray(res) ? res : res.results;
}

function readCsrfToken(): string {
    return (
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('csrftoken='))
            ?.split('=')[1] ?? ''
    );
}

export function resolveMediaUrl(
    mediaUrl: string | null | undefined,
    apiBase: string =
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        'http://localhost:8000',
): string {
    if (!mediaUrl) return '';
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
        return mediaUrl;
    }
    const trimmedBase = apiBase.replace(/\/+$/, '');
    const trimmedPath = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
    return `${trimmedBase}${trimmedPath}`;
}

async function downloadCsv(
    url: string,
    { method = 'GET', body, filename }: {
        method?: 'GET' | 'POST';
        body?: unknown;
        filename: string;
    },
): Promise<void> {
    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: body
            ? {
                'Content-Type': 'application/json',
                'X-CSRFToken': readCsrfToken(),
            }
            : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        throw new Error(`Export failed: ${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

async function uploadDirectOrderFile(
    file: File,
    kind: 'image' | 'video',
    signal?: AbortSignal,
): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);

    const res = await fetch(
        '/api/v1/dashboard/direct-orders/uploads/',
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-CSRFToken': readCsrfToken(),
            },
            body: form,
            signal,
        },
    );

    if (!res.ok) {
        let detail = `Upload failed: ${res.status} ${res.statusText}`;
        try {
            const data = (await res.json()) as { detail?: string };
            if (data?.detail) detail = data.detail;
        } catch {
        }
        throw new Error(detail);
    }

    return (await res.json()) as { url: string };
}

async function streamAssistantReply(
    conversationId: string,
    content: string,
    {
        onChunk,
        onDone,
        onError,
        onMeta,
        onAction,
        signal,
        context,
        attachments,
    }: {
        onChunk: (text: string) => void;
        onDone: (message: AdminAIMessage) => void;
        onError?: (err: Error) => void;
        onMeta?: (meta: {
            chart?: AdminAIMessage['chart'];
            table?: AdminAIMessage['table'];
            link?: AdminAIMessage['link'];
            quickReplies?: AdminAIMessage['quickReplies'];
            provenance?: AdminAIProvenanceItem[];
            actions?: AdminAIMessageAction[];
            toolCalls?: AdminAIToolCallInline[];
        }) => void;
        onAction?: (action: AdminAIPendingAction) => void;
        signal?: AbortSignal;
        context?: { path?: string; module?: string; label?: string; description?: string };
        attachments?: AdminAIAttachmentInput[];
    },
): Promise<void> {
    let res: Response;
    try {
        const access = getAccessToken();
        const csrf = readCsrfToken();
        res = await fetch(
            `${API_BASE}/api/admin/ai/assistant/conversations/${encodeURIComponent(conversationId)}/stream/`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(access ? { Authorization: `Bearer ${access}` } : {}),
                    ...(csrf ? { 'X-CSRFToken': csrf } : {}),
                },
                body: JSON.stringify({
                    content,
                    context,
                    ...(attachments && attachments.length > 0 ? { attachments } : {}),
                }),
                signal,
            },
        );
    } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
        return;
    }

    if (!res.ok || !res.body) {
        let detail = `Stream failed: ${res.status} ${res.statusText}`;
        try {
            const data = (await res.clone().json()) as { detail?: string };
            if (data?.detail) detail = data.detail;
        } catch {
        }
        onError?.(new Error(detail));
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let accumulated = '';
    let meta: {
        chart?: AdminAIMessage['chart'];
        table?: AdminAIMessage['table'];
        link?: AdminAIMessage['link'];
        quickReplies?: AdminAIMessage['quickReplies'];
        provenance?: AdminAIProvenanceItem[];
        actions?: AdminAIMessageAction[];
        toolCalls?: AdminAIToolCallInline[];
    } = {};

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
                const line = frame.trim();
                if (!line.startsWith('data:')) continue;
                const json = line.slice(5).trim();
                if (!json) continue;

                let payload:
                    | { type: 'token'; text: string }
                    | { type: 'delta'; content: string }
                    | {
                        type: 'meta';
                        chart?: AdminAIMessage['chart'];
                        table?: AdminAIMessage['table'];
                        link?: AdminAIMessage['link'];
                        quickReplies?: AdminAIMessage['quickReplies'];
                        provenance?: AdminAIProvenanceItem[];
                        actions?: AdminAIMessageAction[];
                        toolCalls?: AdminAIToolCallInline[];
                    }
                    | { type: 'action'; action: AdminAIPendingAction }
                    | { type: 'done'; messageId: number | string; timestamp: string }
                    | { type: 'error'; message: string };

                try {
                    payload = JSON.parse(json);
                } catch {
                    continue;
                }

                if (payload.type === 'token') {
                    accumulated += payload.text;
                    onChunk(payload.text);
                } else if (payload.type === 'delta') {
                    accumulated += payload.content;
                    onChunk(payload.content);
                } else if (payload.type === 'meta') {
                    meta = {
                        chart: payload.chart ?? meta.chart,
                        table: payload.table ?? meta.table,
                        link: payload.link ?? meta.link,
                        quickReplies: payload.quickReplies ?? meta.quickReplies,
                        provenance: payload.provenance ?? meta.provenance,
                        actions: payload.actions ?? meta.actions,
                        toolCalls: payload.toolCalls ?? meta.toolCalls,
                    };
                    onMeta?.(meta);
                } else if (payload.type === 'action') {
                    onAction?.(payload.action);
                } else if (payload.type === 'done') {
                    const finalMessage: AdminAIMessage = {
                        id: String(payload.messageId),
                        role: 'assistant',
                        content: accumulated,
                        timestamp: payload.timestamp,
                        chart: meta.chart,
                        table: meta.table,
                        link: meta.link,
                        quickReplies: meta.quickReplies,
                        provenance: meta.provenance,
                        actions: meta.actions,
                        toolCalls: meta.toolCalls,
                    } as AdminAIMessage;
                    onDone(finalMessage);
                } else if (payload.type === 'error') {
                    onError?.(new Error(payload.message));
                }
            }
        }
    } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
            onError?.(err instanceof Error ? err : new Error(String(err)));
        }
    }
}

function qsOf(filters: object | undefined): string {
    if (!filters) return '';
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

function reportQs(query: ReportQuery = {}): string {
    const sp = new URLSearchParams();
    sp.set('range', query.range ?? '7days');
    if (query.range === 'custom') {
        if (query.start) sp.set('start', query.start);
        if (query.end) sp.set('end', query.end);
    }
    return `?${sp.toString()}`;
}

function analyticsQs(query: AnalyticsQuery = {}): string {
    const sp = new URLSearchParams();
    sp.set('range', query.range ?? '7days');
    return `?${sp.toString()}`;
}

function overviewQs(query: OverviewQuery = {}): string {
    const sp = new URLSearchParams();
    sp.set('range', query.range ?? '7d');
    if (query.range === 'custom') {
        if (query.start) sp.set('start', query.start);
        if (query.end) sp.set('end', query.end);
    }
    return `?${sp.toString()}`;
}

export const adminApi = {
    products: {
        list: async (
            queryOrSignal?: Record<string, string | number | boolean> | AbortSignal,
            signal?: AbortSignal,
        ): Promise<AdminProduct[]> => {
            let query: Record<string, string | number | boolean> = {};
            let actualSignal: AbortSignal | undefined = signal;

            if (queryOrSignal && typeof queryOrSignal === 'object') {
                const looksLikeSignal =
                    'aborted' in queryOrSignal || 'addEventListener' in queryOrSignal;
                if (looksLikeSignal) {
                    actualSignal = queryOrSignal as AbortSignal;
                } else {
                    query = queryOrSignal as Record<string, string | number | boolean>;
                }
            }

            const params = new URLSearchParams();
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.set(key, String(value));
                }
            });
            const suffix = params.toString() ? `?${params.toString()}` : '';

            const res = await request<
                AdminProduct[] | { results: AdminProduct[] }
            >(`/api/v1/admin/products/${suffix}`, { signal: actualSignal });
            return unwrapList(res);
        },

        detail: (id: string, signal?: AbortSignal) =>
            request<AdminProduct>(
                `/api/v1/admin/products/${encodeURIComponent(id)}/`,
                { signal },
            ),

        create: (payload: AdminProductWrite) =>
            request<AdminProduct>('/api/v1/admin/products/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: string, payload: Partial<AdminProductWrite>) =>
            request<AdminProduct>(
                `/api/v1/admin/products/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: payload },
            ),

        remove: (id: string) =>
            request<void>(
                `/api/v1/admin/products/${encodeURIComponent(id)}/`,
                { method: 'DELETE' },
            ),

        bulk: (rows: AdminProductWrite[]) =>
            request<{ created: AdminProduct[]; errors: unknown[] }>(
                '/api/v1/admin/products/bulk/',
                { method: 'POST', body: { rows } },
            ),

        toggleFeatured: (id: string) =>
            request<AdminProduct>(
                `/api/v1/admin/products/${encodeURIComponent(id)}/toggle-featured/`,
                { method: 'POST' },
            ),

        toggleBestSeller: (id: string) =>
            request<AdminProduct>(
                `/api/v1/admin/products/${encodeURIComponent(id)}/toggle-best-seller/`,
                { method: 'POST' },
            ),
    },
    categories: {
        list: async (signal?: AbortSignal): Promise<AdminCategory[]> => {
            const res = await request<
                AdminCategory[] | { results: AdminCategory[] }
            >('/api/v1/admin/categories/', { signal });
            return unwrapList(res);
        },

        refs: (signal?: AbortSignal) =>
            request<AdminCategoryRef[]>(
                '/api/catalog/categories/?all=1',
                { signal },
            ),

        detail: (id: string, signal?: AbortSignal) =>
            request<AdminCategory>(
                `/api/v1/admin/categories/${encodeURIComponent(id)}/`,
                { signal },
            ),

        create: (payload: AdminCategoryWrite) =>
            request<AdminCategory>('/api/v1/admin/categories/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: string, payload: Partial<AdminCategoryWrite>) =>
            request<AdminCategory>(
                `/api/v1/admin/categories/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: payload },
            ),

        remove: (id: string) =>
            request<void>(
                `/api/v1/admin/categories/${encodeURIComponent(id)}/`,
                { method: 'DELETE' },
            ),
    },

    brands: {
        list: async (signal?: AbortSignal): Promise<AdminBrand[]> => {
            const res = await request<
                AdminBrand[] | { results: AdminBrand[] }
            >('/api/v1/admin/brands/', { signal });
            return unwrapList(res);
        },

        refs: (signal?: AbortSignal) =>
            request<AdminBrandRef[]>('/api/catalog/brands/', { signal }),

        detail: (id: string, signal?: AbortSignal) =>
            request<AdminBrand>(
                `/api/v1/admin/brands/${encodeURIComponent(id)}/`,
                { signal },
            ),

        create: (payload: AdminBrandWrite | FormData) =>
            request<AdminBrand>('/api/v1/admin/brands/', {
                method: 'POST',
                body: payload as any,
            }),

        update: (id: string, payload: Partial<AdminBrandWrite> | FormData) =>
            request<AdminBrand>(
                `/api/v1/admin/brands/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: payload as any },
            ),

        remove: (id: string) =>
            request<void>(
                `/api/v1/admin/brands/${encodeURIComponent(id)}/`,
                { method: 'DELETE' },
            ),
    },

    banners: {
        list: async (
            query: BannerListQuery = {},
            signal?: AbortSignal,
        ): Promise<Banner[]> => {
            const sp = new URLSearchParams();
            if (query.q) sp.set('q', query.q);
            if (query.placement && query.placement !== 'ALL') {
                sp.set('placement', query.placement);
            }
            if (query.status && query.status !== 'ALL') {
                sp.set('status', query.status);
            }
            if (query.sort) sp.set('sort', query.sort);
            const qs = sp.toString();
            const res = await request<Banner[] | { results: Banner[] }>(
                `/api/v1/admin/banners/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },

        detail: (id: number, signal?: AbortSignal) =>
            request<Banner>(`/api/v1/admin/banners/${id}/`, { signal }),

        create: (payload: BannerWriteInput) =>
            request<Banner>('/api/v1/admin/banners/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: number, payload: Partial<BannerWriteInput>) =>
            request<Banner>(`/api/v1/admin/banners/${id}/`, {
                method: 'PATCH',
                body: payload,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/admin/banners/${id}/`, {
                method: 'DELETE',
            }),

        duplicate: (id: number) =>
            request<Banner>(`/api/v1/admin/banners/${id}/duplicate/`, {
                method: 'POST',
            }),

        toggle: (id: number) =>
            request<Banner>(`/api/v1/admin/banners/${id}/toggle/`, {
                method: 'POST',
            }),

        stats: (signal?: AbortSignal) =>
            request<BannerStats>('/api/v1/admin/banners/stats/', { signal }),

        upload: (
            file: File,
            kind: 'desktop' | 'tablet' | 'mobile',
            signal?: AbortSignal,
        ) => {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', kind);
            return request<{ url: string; path?: string }>(
                '/api/v1/admin/banners/uploads/',
                { method: 'POST', body: form, signal },
            );
        },
    },
    newsletter: {
        subscribers: {
            list: async (
                params: {
                    status?: 'active' | 'unsubscribed';
                    source?: string;
                    list?: string;
                    search?: string;
                } = {},
                signal?: AbortSignal,
            ): Promise<AdminSubscriber[]> => {
                const sp = new URLSearchParams();
                if (params.status) sp.set('status', params.status);
                if (params.source) sp.set('source', params.source);
                if (params.list) sp.set('list', params.list);
                if (params.search) sp.set('search', params.search);
                const qs = sp.toString();
                const res = await request<
                    AdminSubscriber[] | { results: AdminSubscriber[] }
                >(
                    `/api/v1/admin/newsletter/subscribers/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            stats: (signal?: AbortSignal) =>
                request<AdminSubscriberStats>(
                    '/api/v1/admin/newsletter/subscribers/stats/',
                    { signal },
                ),

            create: (payload: AdminSubscriberWrite) =>
                request<AdminSubscriber>(
                    '/api/v1/admin/newsletter/subscribers/',
                    { method: 'POST', body: payload },
                ),

            update: (id: string, payload: Partial<AdminSubscriberWrite>) =>
                request<AdminSubscriber>(
                    `/api/v1/admin/newsletter/subscribers/${encodeURIComponent(id)}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: string) =>
                request<void>(
                    `/api/v1/admin/newsletter/subscribers/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),

            toggleActive: (id: string) =>
                request<AdminSubscriber>(
                    `/api/v1/admin/newsletter/subscribers/${encodeURIComponent(id)}/toggle-active/`,
                    { method: 'POST' },
                ),
        },

        lists: {
            list: async (signal?: AbortSignal): Promise<AdminSubscriberList[]> => {
                const res = await request<
                    AdminSubscriberList[] | { results: AdminSubscriberList[] }
                >('/api/v1/admin/newsletter/lists/', { signal });
                return unwrapList(res);
            },

            create: (payload: AdminSubscriberListWrite) =>
                request<AdminSubscriberList>(
                    '/api/v1/admin/newsletter/lists/',
                    { method: 'POST', body: payload },
                ),

            update: (id: string, payload: Partial<AdminSubscriberListWrite>) =>
                request<AdminSubscriberList>(
                    `/api/v1/admin/newsletter/lists/${encodeURIComponent(id)}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: string) =>
                request<void>(
                    `/api/v1/admin/newsletter/lists/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),
        },

        segments: {
            list: async (signal?: AbortSignal): Promise<AdminSegment[]> => {
                const res = await request<
                    AdminSegment[] | { results: AdminSegment[] }
                >('/api/v1/admin/newsletter/segments/', { signal });
                return unwrapList(res);
            },
        },

        templates: {
            list: async (signal?: AbortSignal): Promise<AdminEmailTemplate[]> => {
                const res = await request<
                    AdminEmailTemplate[] | { results: AdminEmailTemplate[] }
                >('/api/v1/admin/newsletter/templates/', { signal });
                return unwrapList(res);
            },

            create: (payload: AdminEmailTemplateWrite) =>
                request<AdminEmailTemplate>(
                    '/api/v1/admin/newsletter/templates/',
                    { method: 'POST', body: payload },
                ),

            update: (
                id: string,
                payload: Partial<AdminEmailTemplateWrite>,
            ) =>
                request<AdminEmailTemplate>(
                    `/api/v1/admin/newsletter/templates/${encodeURIComponent(id)}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: string) =>
                request<void>(
                    `/api/v1/admin/newsletter/templates/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),
        },

        campaigns: {
            list: async (signal?: AbortSignal): Promise<AdminCampaign[]> => {
                const res = await request<
                    AdminCampaign[] | { results: AdminCampaign[] }
                >('/api/v1/admin/newsletter/campaigns/', { signal });
                return unwrapList(res);
            },

            detail: (id: string, signal?: AbortSignal) =>
                request<AdminCampaign>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/`,
                    { signal },
                ),

            create: (payload: AdminCampaignWrite) =>
                request<AdminCampaign>(
                    '/api/v1/admin/newsletter/campaigns/',
                    { method: 'POST', body: payload },
                ),

            update: (id: string, payload: Partial<AdminCampaignWrite>) =>
                request<AdminCampaign>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: string) =>
                request<void>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),

            send: (id: string) =>
                request<AdminCampaign>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/send/`,
                    { method: 'POST' },
                ),

            pause: (id: string) =>
                request<AdminCampaign>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/pause/`,
                    { method: 'POST' },
                ),

            resume: (id: string) =>
                request<AdminCampaign>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/resume/`,
                    { method: 'POST' },
                ),

            recipients: (id: string, signal?: AbortSignal) =>
                request<AdminCampaignRecipient[]>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/recipients/`,
                    { signal },
                ),

            status: (id: string, signal?: AbortSignal) =>
                request<AdminCampaignStatus>(
                    `/api/v1/admin/newsletter/campaigns/${encodeURIComponent(id)}/status/`,
                    { signal },
                ),
        },

        analytics: {
            growth: (signal?: AbortSignal) =>
                request<AdminGrowthPoint[]>(
                    '/api/v1/admin/newsletter/analytics/growth/',
                    { signal },
                ),

            campaigns: (signal?: AbortSignal) =>
                request<AdminCampaignPerformance[]>(
                    '/api/v1/admin/newsletter/analytics/campaigns/',
                    { signal },
                ),

            summary: (signal?: AbortSignal) =>
                request<AdminAnalyticsSummary>(
                    '/api/v1/admin/newsletter/analytics/summary/',
                    { signal },
                ),
        },

        uploadImage: (file: File, signal?: AbortSignal) =>
            uploadRequest<{ url: string }>(
                '/api/v1/admin/newsletter/uploads/',
                file,
                'file',
                signal,
            ),
    },

    customers: {
        list: (filters: AdminCustomerFilters = {}, signal?: AbortSignal) => {
            const sp = new URLSearchParams();
            if (filters.search) sp.set('search', filters.search);
            if (filters.segment) sp.set('segment', filters.segment); 
            if (filters.orders) sp.set('orders', filters.orders);
            if (filters.spent) sp.set('spent', filters.spent);
            const qs = sp.toString();
            return request<AdminCustomerListResponse>(
                `/api/v1/admin/customers/${qs ? `?${qs}` : ''}`,
                { signal },
            );
        },

        stats: (signal?: AbortSignal) =>
            request<AdminCustomerStats>(
                '/api/v1/admin/customers/stats/',
                { signal },
            ),

        segments: (signal?: AbortSignal) =>
            request<Record<string, number>>(
                '/api/v1/admin/customers/segments/',
                { signal },
            ),

        detail: (userId: number, signal?: AbortSignal) =>
            request<AdminCustomerDetail>(
                `/api/v1/admin/customers/${userId}/`,
                { signal },
            ),

        setBlocked: (userId: number, blocked: boolean) =>
            request<{ status: string }>(
                `/api/v1/admin/customers/${userId}/block/`,
                { method: 'POST', body: { blocked } satisfies AdminBlockWrite },
            ),

        setConsent: (userId: number, consent: AdminConsentWrite['consent']) =>
            request<{ consent: string }>(
                `/api/v1/admin/customers/${userId}/consent/`,
                {
                    method: 'PATCH',
                    body: { consent } satisfies AdminConsentWrite,
                },
            ),

        notes: {
            create: (userId: number, text: string) =>
                request<AdminCustomerNote>(
                    `/api/v1/admin/customers/${userId}/notes/`,
                    {
                        method: 'POST',
                        body: { text } satisfies AdminNoteWrite,
                    },
                ),

            remove: (userId: number, noteId: number) =>
                request<void>(
                    `/api/v1/admin/customers/${userId}/notes/${noteId}/`,
                    { method: 'DELETE' },
                ),
        },

        whatsapp: (userId: number, message: string) =>
            request<{ id: number }>(
                `/api/v1/admin/customers/${userId}/whatsapp/`,
                {
                    method: 'POST',
                    body: { message } satisfies AdminWhatsAppWrite,
                },
            ),

        email: (userId: number, subject: string, body: string) =>
            request<{ id: number }>(
                `/api/v1/admin/customers/${userId}/email/`,
                {
                    method: 'POST',
                    body: { subject, body } satisfies AdminEmailWrite,
                },
            ),

        addresses: {
            create: (userId: number, payload: AdminAddressWrite) =>
                request<AdminCustomerAddress>(
                    `/api/v1/admin/customers/${userId}/addresses/`,
                    { method: 'POST', body: payload },
                ),

            remove: (userId: number, addressId: number) =>
                request<void>(
                    `/api/v1/admin/customers/${userId}/addresses/${addressId}/`,
                    { method: 'DELETE' },
                ),
        },

        export: (filters: AdminCustomerFilters = {}) =>
            request<{ csv: string }>(
                '/api/v1/admin/customers/export/',
                { method: 'POST', body: filters },
            ),
    },

    suppliers: {
        list: async (signal?: AbortSignal): Promise<AdminSupplier[]> => {
            const res = await request<
                AdminSupplier[] | { results: AdminSupplier[] }
            >('/api/v1/admin/suppliers/', { signal });
            return unwrapList(res);
        },

        detail: (id: number, signal?: AbortSignal) =>
            request<AdminSupplier>(`/api/v1/admin/suppliers/${id}/`, { signal }),

        create: (payload: AdminSupplierWrite) =>
            request<AdminSupplier>('/api/v1/admin/suppliers/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: number, payload: Partial<AdminSupplierWrite>) =>
            request<AdminSupplier>(`/api/v1/admin/suppliers/${id}/`, {
                method: 'PATCH',
                body: payload,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/admin/suppliers/${id}/`, {
                method: 'DELETE',
            }),

        toggleStatus: (id: number) =>
            request<AdminSupplier>(
                `/api/v1/admin/suppliers/${id}/toggle-status/`,
                { method: 'POST' },
            ),

        addProducts: (id: number, items: AdminSupplierProductInput[]) =>
            request<AdminSupplier>(
                `/api/v1/admin/suppliers/${id}/add-products/`,
                { method: 'POST', body: { items } },
            ),

        removeProduct: (id: number, spId: number) =>
            request<AdminSupplier>(
                `/api/v1/admin/suppliers/${id}/remove-product/${spId}/`,
                { method: 'POST' },
            ),

        recordPurchase: (id: number, payload: AdminPurchaseInput) =>
            request<AdminSupplier>(
                `/api/v1/admin/suppliers/${id}/purchases/`,
                { method: 'POST', body: payload },
            ),
    },

    inventory: {
        list: async (signal?: AbortSignal): Promise<AdminInventoryItem[]> => {
            const res = await request<
                AdminInventoryItem[] | { results: AdminInventoryItem[] }
            >('/api/v1/admin/inventory/', { signal });
            return unwrapList(res);
        },

        detail: (productId: string, signal?: AbortSignal) =>
            request<AdminInventoryItem>(
                `/api/v1/admin/inventory/${encodeURIComponent(productId)}/`,
                { signal },
            ),

        adjust: (payload: AdminInventoryAdjustInput) =>
            request<AdminInventoryItem>('/api/v1/admin/inventory/adjust/', {
                method: 'POST',
                body: payload,
            }),

        movements: async (signal?: AbortSignal): Promise<AdminStockMovement[]> => {
            const res = await request<
                AdminStockMovement[] | { results: AdminStockMovement[] }
            >('/api/v1/admin/inventory/movements/', { signal });
            return unwrapList(res);
        },
    },

    orders: {
        list: (filters: AdminOrderFilters = {}, signal?: AbortSignal) => {
            const sp = new URLSearchParams();
            if (filters.tab) sp.set('tab', filters.tab);
            if (filters.search) sp.set('search', filters.search);
            if (filters.payment_status) {
                sp.set('payment_status', filters.payment_status);
            }
            if (filters.date_from) sp.set('date_from', filters.date_from);
            if (filters.date_to) sp.set('date_to', filters.date_to);
            const qs = sp.toString();
            return request<AdminOrderListResponse>(
                `/api/v1/admin/orders/${qs ? `?${qs}` : ''}`,
                { signal },
            );
        },

        stats: (signal?: AbortSignal) =>
            request<AdminOrderStats>(
                '/api/v1/admin/orders/stats/',
                { signal },
            ),

        tabCounts: (signal?: AbortSignal) =>
            request<AdminOrderTabCounts>(
                '/api/v1/admin/orders/tab-counts/',
                { signal },
            ),

        detail: (reference: string, signal?: AbortSignal) =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/`,
                { signal },
            ),

        setStatus: (
            reference: string,
            status: AdminOrderStatusWrite['status'],
            note = '',
        ) =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/status/`,
                {
                    method: 'PATCH',
                    body: { status, note } satisfies AdminOrderStatusWrite,
                },
            ),

        setTracking: (
            reference: string,
            payload: { courier?: string; tracking_number?: string },
        ) =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/tracking/`,
                {
                    method: 'PATCH',
                    body: payload satisfies AdminOrderTrackingWrite,
                },
            ),

        refund: (
            reference: string,
            payload: AdminOrderRefundWrite = {},
        ) =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/refund/`,
                {
                    method: 'POST',
                    body: payload satisfies AdminOrderRefundWrite,
                },
            ),

        markReturned: (reference: string, reason = '') =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/returned/`,
                {
                    method: 'POST',
                    body: { reason },
                },
            ),

        addNote: (reference: string, text: string) =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/notes/`,
                {
                    method: 'POST',
                    body: { text } satisfies AdminOrderNoteWrite,
                },
            ),

        whatsapp: (reference: string, message: string) =>
            request<AdminOrderDetail>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/whatsapp/`,
                {
                    method: 'POST',
                    body: { message } satisfies AdminOrderWhatsAppWrite,
                },
            ),

        export: (filters: AdminOrderFilters = {}) =>
            request<AdminOrderExportResponse>(
                '/api/v1/admin/orders/export/',
                {
                    method: 'POST',
                    body: filters satisfies AdminOrderExportWrite,
                },
            ),

        downloadPdf: async (
            reference: string,
            signal?: AbortSignal,
        ): Promise<Blob> => {
            const res = await fetch(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/pdf/`,
                {
                    credentials: 'include',
                    headers: {
                        'X-CSRFToken': readCsrfToken(),
                    },
                    signal,
                },
            );
            if (!res.ok) {
                let detail = `Could not download receipt: ${res.status} ${res.statusText}`;
                try {
                    const data = (await res.json()) as { detail?: string };
                    if (data?.detail) detail = data.detail;
                } catch {
                }
                throw new Error(detail);
            }
            return res.blob();
        },

        verifyQr: (token: string, signal?: AbortSignal) =>
            request<AdminQRVerifyResponse>(
                '/api/v1/admin/orders/verify-qr/',
                {
                    method: 'POST',
                    body: { token },
                    signal,
                },
            ),

        fulfillQr: (reference: string, signal?: AbortSignal) =>
            request<AdminQRVerifyResponse>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/fulfill-qr/`,
                {
                    method: 'POST',
                    signal,
                },
            ),

        sticker: (reference: string, itemId: number, signal?: AbortSignal) =>
            request<AdminStickerData>(
                `/api/v1/admin/orders/${encodeURIComponent(reference)}/sticker/${itemId}/`,
                { signal },
            ),
    },

    reviews: {
        list: async (
            filters: AdminReviewFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminReview[]> => {
            const sp = new URLSearchParams();
            if (filters.status && filters.status !== 'all') {
                sp.set('status', filters.status);
            }
            if (filters.rating !== undefined) {
                sp.set('rating', String(filters.rating));
            }
            if (filters.verified !== undefined) {
                sp.set('verified', String(filters.verified));
            }
            if (filters.flagged !== undefined) {
                sp.set('flagged', String(filters.flagged));
            }
            if (filters.search) sp.set('search', filters.search);
            const qs = sp.toString();
            const res = await request<
                AdminReview[] | { results: AdminReview[] }
            >(
                `/api/v1/admin/reviews/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },

        detail: (id: number, signal?: AbortSignal) =>
            request<AdminReview>(`/api/v1/admin/reviews/${id}/`, { signal }),

        stats: (signal?: AbortSignal) =>
            request<AdminReviewStats>(
                '/api/v1/admin/reviews/stats/',
                { signal },
            ),

        approve: (id: number) =>
            request<AdminReview>(
                `/api/v1/admin/reviews/${id}/approve/`,
                { method: 'POST' },
            ),

        reject: (id: number, payload: AdminRejectReviewWrite = {}) =>
            request<AdminReview>(
                `/api/v1/admin/reviews/${id}/reject/`,
                { method: 'POST', body: payload satisfies AdminRejectReviewWrite },
            ),

        flag: (id: number, payload: AdminFlagReviewWrite = {}) =>
            request<AdminReview>(
                `/api/v1/admin/reviews/${id}/flag/`,
                { method: 'POST', body: payload satisfies AdminFlagReviewWrite },
            ),

        resolveFlag: (id: number) =>
            request<AdminReview>(
                `/api/v1/admin/reviews/${id}/resolve-flag/`,
                { method: 'POST' },
            ),

        createReply: (id: number, payload: AdminReplyReviewWrite) =>
            request<AdminReviewReply>(
                `/api/v1/admin/reviews/${id}/replies/`,
                { method: 'POST', body: payload satisfies AdminReplyReviewWrite },
            ),

        markHelpful: (id: number) =>
            request<AdminReview>(
                `/api/v1/admin/reviews/${id}/helpful/`,
                { method: 'POST' },
            ),

        remove: (id: number) =>
            request<void>(`/api/v1/admin/reviews/${id}/`, {
                method: 'DELETE',
            }),

        bulk: (payload: AdminBulkReviewWrite) =>
            request<{ action: string; requested: number; affected: number }>(
                '/api/v1/admin/reviews/bulk/',
                { method: 'POST', body: payload satisfies AdminBulkReviewWrite },
            ),
    },

    discounts: {
        list: async (
            filters: AdminDiscountFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminDiscount[]> => {
            const sp = new URLSearchParams();
            if (filters.status) sp.set('status', filters.status);
            if (filters.type) sp.set('type', filters.type);
            if (filters.channel) sp.set('channel', filters.channel);
            if (filters.search) sp.set('search', filters.search);
            const qs = sp.toString();
            const res = await request<
                AdminDiscount[] | { results: AdminDiscount[] }
            >(
                `/api/v1/admin/discounts/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },

        detail: (id: number, signal?: AbortSignal) =>
            request<AdminDiscount>(
                `/api/v1/admin/discounts/${id}/`,
                { signal },
            ),

        create: (payload: AdminDiscountWrite) =>
            request<AdminDiscount>('/api/v1/admin/discounts/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: number, payload: Partial<AdminDiscountWrite>) =>
            request<AdminDiscount>(
                `/api/v1/admin/discounts/${id}/`,
                { method: 'PATCH', body: payload },
            ),

        remove: (id: number) =>
            request<void>(
                `/api/v1/admin/discounts/${id}/`,
                { method: 'DELETE' },
            ),

        duplicate: (id: number) =>
            request<AdminDiscount>(
                `/api/v1/admin/discounts/${id}/duplicate/`,
                { method: 'POST' },
            ),

        pause: (id: number) =>
            request<AdminDiscount>(
                `/api/v1/admin/discounts/${id}/pause/`,
                { method: 'POST' },
            ),

        resume: (id: number) =>
            request<AdminDiscount>(
                `/api/v1/admin/discounts/${id}/resume/`,
                { method: 'POST' },
            ),

        slowMoving: async (
            params: {
                min_days?: number;
                max_sales?: number;
                min_stock?: number;
            } = {},
            signal?: AbortSignal,
        ): Promise<AdminDiscountSlowMover[]> => {
            const sp = new URLSearchParams();
            if (params.min_days !== undefined) {
                sp.set('min_days', String(params.min_days));
            }
            if (params.max_sales !== undefined) {
                sp.set('max_sales', String(params.max_sales));
            }
            if (params.min_stock !== undefined) {
                sp.set('min_stock', String(params.min_stock));
            }
            const qs = sp.toString();
            const res = await request<
                AdminDiscountSlowMover[] | { results: AdminDiscountSlowMover[] }
            >(
                `/api/v1/admin/discounts/slow_moving/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },

        bulkClearance: (payload: AdminBulkClearanceWrite) =>
            request<AdminDiscount>('/api/v1/admin/discounts/bulk_clearance/', {
                method: 'POST',
                body: payload,
            }),

        uploadMedia: (file: File, signal?: AbortSignal) =>
            uploadRequest<{ url: string }>(
                '/api/v1/admin/discounts/upload_media/',
                file,
                'file',
                signal,
            ),

        analytics: (signal?: AbortSignal) =>
            request<AdminDiscountAnalytics>(
                '/api/v1/admin/discounts/analytics/',
                { signal },
            ),

        analyticsSummary: (signal?: AbortSignal) =>
            request<AdminDiscountAnalyticsSummary>(
                '/api/v1/admin/discounts/analytics/summary/',
                { signal },
            ),

        rules: (signal?: AbortSignal) =>
            request<AdminDiscountRules>(
                '/api/v1/admin/discounts/rules/',
                { signal },
            ),
    },

    transactions: {
        list: async (
            filters: AdminTransactionFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminTransaction[]> => {
            const sp = new URLSearchParams();
            if (filters.q) sp.set('q', filters.q);
            if (filters.status) sp.set('status', filters.status);
            if (filters.method) sp.set('method', filters.method);
            if (filters.source) sp.set('source', filters.source);
            if (filters.dateRange) sp.set('dateRange', filters.dateRange);
            if (filters.minAmount) sp.set('minAmount', filters.minAmount);
            if (filters.maxAmount) sp.set('maxAmount', filters.maxAmount);
            const qs = sp.toString();
            const res = await request<
                AdminTransaction[] | { results: AdminTransaction[] }
            >(
                `/api/v1/dashboard/transactions/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },

        summary: (
            filters: AdminTransactionFilters = {},
            signal?: AbortSignal,
        ) => {
            const sp = new URLSearchParams();
            if (filters.q) sp.set('q', filters.q);
            if (filters.status) sp.set('status', filters.status);
            if (filters.method) sp.set('method', filters.method);
            if (filters.source) sp.set('source', filters.source);
            if (filters.dateRange) sp.set('dateRange', filters.dateRange);
            if (filters.minAmount) sp.set('minAmount', filters.minAmount);
            if (filters.maxAmount) sp.set('maxAmount', filters.maxAmount);
            const qs = sp.toString();
            return request<AdminTransactionSummary>(
                `/api/v1/dashboard/transactions/summary/${qs ? `?${qs}` : ''}`,
                { signal },
            );
        },

        detail: (id: string, signal?: AbortSignal) =>
            request<AdminTransaction>(
                `/api/v1/dashboard/transactions/${encodeURIComponent(id)}/`,
                { signal },
            ),

        exportFiltered: (
            filters: AdminTransactionFilters = {},
            filename = 'transactions.csv',
        ): Promise<void> => {
            const sp = new URLSearchParams();
            if (filters.q) sp.set('q', filters.q);
            if (filters.status) sp.set('status', filters.status);
            if (filters.method) sp.set('method', filters.method);
            if (filters.source) sp.set('source', filters.source);
            if (filters.dateRange) sp.set('dateRange', filters.dateRange);
            if (filters.minAmount) sp.set('minAmount', filters.minAmount);
            if (filters.maxAmount) sp.set('maxAmount', filters.maxAmount);
            const qs = sp.toString();
            return downloadCsv(
                `/api/v1/dashboard/transactions/export/${qs ? `?${qs}` : ''}`,
                { method: 'GET', filename },
            );
        },

        exportBulk: (
            payload: AdminBulkExportWrite,
            filename = 'transactions-selected.csv',
        ): Promise<void> =>
            downloadCsv('/api/v1/dashboard/transactions/export/', {
                method: 'POST',
                body: payload,
                filename,
            }),

        retry: (id: string, payload: AdminRetryWrite = {}) =>
            request<AdminTransaction>(
                `/api/v1/dashboard/transactions/${encodeURIComponent(id)}/retry/`,
                { method: 'POST', body: payload satisfies AdminRetryWrite },
            ),

        reconcile: (id: string, payload: AdminReconcileWrite) =>
            request<AdminTransaction>(
                `/api/v1/dashboard/transactions/${encodeURIComponent(id)}/reconcile/`,
                {
                    method: 'POST',
                    body: payload satisfies AdminReconcileWrite,
                },
            ),
    },

    payments: {
        config: {
            get: (signal?: AbortSignal) =>
                request<AdminPaymentConfig>(
                    '/api/v1/dashboard/payments/config/',
                    { signal },
                ),

            update: (payload: AdminPaymentConfigWrite) =>
                request<AdminPaymentConfig>(
                    '/api/v1/dashboard/payments/config/',
                    { method: 'PATCH', body: payload },
                ),

            test: (signal?: AbortSignal) =>
                request<AdminPaymentTestResult>(
                    '/api/v1/dashboard/payments/config/test-connection/',
                    { method: 'POST', signal },
                ),
        },

        summary: (signal?: AbortSignal) =>
            request<AdminPaymentSummary>(
                '/api/v1/dashboard/payments/summary/',
                { signal },
            ),

        transactions: {
            list: async (
                filters: AdminPaymentTransactionFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminTransaction[]> => {
                const sp = new URLSearchParams();
                if (filters.q) sp.set('q', filters.q);
                if (filters.status && filters.status !== 'ALL') {
                    sp.set('status', filters.status);
                }
                if (filters.method && filters.method !== 'ALL') {
                    sp.set('method', filters.method);
                }
                if (filters.limit) sp.set('limit', String(filters.limit));
                const qs = sp.toString();
                const res = await request<
                    AdminTransaction[] | { results: AdminTransaction[] }
                >(
                    `/api/v1/dashboard/payments/transactions/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (id: string, signal?: AbortSignal) =>
                request<AdminTransaction>(
                    `/api/v1/dashboard/payments/transactions/${encodeURIComponent(id)}/`,
                    { signal },
                ),

            summary: (
                filters: AdminPaymentTransactionFilters = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (filters.q) sp.set('q', filters.q);
                if (filters.status && filters.status !== 'ALL') {
                    sp.set('status', filters.status);
                }
                if (filters.method && filters.method !== 'ALL') {
                    sp.set('method', filters.method);
                }
                const qs = sp.toString();
                return request<AdminTransactionSummary>(
                    `/api/v1/dashboard/payments/transactions/summary/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            retry: (id: string, payload: AdminRetryWrite = {}) =>
                request<AdminTransaction>(
                    `/api/v1/dashboard/payments/transactions/${encodeURIComponent(id)}/retry/`,
                    { method: 'POST', body: payload satisfies AdminRetryWrite },
                ),

            reconcile: (id: string, payload: AdminReconcileWrite) =>
                request<AdminTransaction>(
                    `/api/v1/dashboard/payments/transactions/${encodeURIComponent(id)}/reconcile/`,
                    {
                        method: 'POST',
                        body: payload satisfies AdminReconcileWrite,
                    },
                ),

            completeOrder: (
                id: string,
                payload: AdminCompleteOrderPayload,
            ) =>
                request<AdminCompleteOrderResult>(
                    `/api/v1/dashboard/payments/transactions/${encodeURIComponent(id)}/complete-order/`,
                    { method: 'POST', body: payload },
                ),
        },
    },

    shipping: {
        regions: (signal?: AbortSignal) =>
            request<AdminKenyaRegions>(
                '/api/v1/dashboard/shipping/regions/',
                { signal },
            ),

        zones: {
            list: (signal?: AbortSignal) =>
                request<AdminShippingZone[]>(
                    '/api/v1/dashboard/shipping/zones/',
                    { signal },
                ),

            create: (payload: AdminShippingZoneWrite) =>
                request<AdminShippingZone>(
                    '/api/v1/dashboard/shipping/zones/',
                    { method: 'POST', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/shipping/zones/${id}/`,
                    { method: 'DELETE' },
                ),

            addRate: (zoneId: number, payload: AdminShippingRateWrite) =>
                request<AdminShippingZone>(
                    `/api/v1/dashboard/shipping/zones/${zoneId}/rates/`,
                    { method: 'POST', body: payload },
                ),

            removeRate: (zoneId: number, rateId: number) =>
                request<void>(
                    `/api/v1/dashboard/shipping/zones/${zoneId}/rates/${rateId}/`,
                    { method: 'DELETE' },
                ),
        },

        methods: {
            list: (signal?: AbortSignal) =>
                request<AdminShippingMethod[]>(
                    '/api/v1/dashboard/shipping/methods/',
                    { signal },
                ),

            create: (payload: {
                name: string;
                description?: string;
                defaultPrice: number;
                eta?: string;
            }) =>
                request<AdminShippingMethod>(
                    '/api/v1/dashboard/shipping/methods/',
                    { method: 'POST', body: payload },
                ),

            toggle: (id: number) =>
                request<AdminShippingMethod>(
                    `/api/v1/dashboard/shipping/methods/${id}/toggle/`,
                    { method: 'POST' },
                ),
        },

        pickups: {
            list: (signal?: AbortSignal) =>
                request<AdminPickupLocation[]>(
                    '/api/v1/dashboard/shipping/pickups/',
                    { signal },
                ),

            create: (payload: AdminPickupLocationWrite) =>
                request<AdminPickupLocation>(
                    '/api/v1/dashboard/shipping/pickups/',
                    { method: 'POST', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/shipping/pickups/${id}/`,
                    { method: 'DELETE' },
                ),

            toggle: (id: number) =>
                request<AdminPickupLocation>(
                    `/api/v1/dashboard/shipping/pickups/${id}/toggle/`,
                    { method: 'POST' },
                ),
        },

        shipments: {
            list: (q: string = '', signal?: AbortSignal) => {
                const qs = q ? `?q=${encodeURIComponent(q)}` : '';
                return request<AdminShipment[]>(
                    `/api/v1/dashboard/shipping/shipments/${qs}`,
                    { signal },
                );
            },

            setStatus: (
                id: number,
                status: AdminShipment['status'],
                note: string = '',
            ) =>
                request<AdminShipment>(
                    `/api/v1/dashboard/shipping/shipments/${id}/status/`,
                    {
                        method: 'PATCH',
                        body: { status, note } satisfies AdminShipmentStatusWrite,
                    },
                ),
        },

        couriers: {
            list: (signal?: AbortSignal) =>
                request<AdminCourierConfig[]>(
                    '/api/v1/dashboard/shipping/couriers/',
                    { signal },
                ),

            toggle: (id: string) =>
                request<AdminCourierConfig>(
                    `/api/v1/dashboard/shipping/couriers/${encodeURIComponent(id)}/toggle/`,
                    { method: 'POST' },
                ),

            test: (id: string) =>
                request<AdminCourierTestResult>(
                    `/api/v1/dashboard/shipping/couriers/${encodeURIComponent(id)}/test/`,
                    { method: 'POST' },
                ),
        },
    },

    returns: {
        list: (filters: AdminReturnFilters = {}, signal?: AbortSignal) => {
            const sp = new URLSearchParams();
            if (filters.q) sp.set('q', filters.q);
            if (filters.status && filters.status !== 'ALL') {
                sp.set('status', filters.status);
            }
            if (filters.refund_status && filters.refund_status !== 'ALL') {
                sp.set('refund_status', filters.refund_status);
            }
            if (filters.sort) sp.set('sort', filters.sort);
            const qs = sp.toString();
            return request<AdminReturnRequest[]>(
                `/api/v1/dashboard/returns/${qs ? `?${qs}` : ''}`,
                { signal },
            );
        },

        detail: (id: number, signal?: AbortSignal) =>
            request<AdminReturnRequest>(
                `/api/v1/dashboard/returns/${id}/`,
                { signal },
            ),

        create: (payload: AdminReturnCreateWrite) =>
            request<AdminReturnRequest>(
                '/api/v1/dashboard/returns/',
                { method: 'POST', body: payload },
            ),

        patch: (id: number, payload: AdminReturnPatchWrite) =>
            request<AdminReturnRequest>(
                `/api/v1/dashboard/returns/${id}/`,
                { method: 'PATCH', body: payload },
            ),

        approve: (id: number) =>
            request<AdminReturnRequest>(
                `/api/v1/dashboard/returns/${id}/approve/`,
                { method: 'POST' },
            ),

        reject: (id: number, note = '') =>
            request<AdminReturnRequest>(
                `/api/v1/dashboard/returns/${id}/reject/`,
                {
                    method: 'POST',
                    body: { note } satisfies AdminReturnRejectWrite,
                },
            ),

        refund: (id: number, payload: AdminReturnRefundWrite = {}) =>
            request<AdminReturnRequest>(
                `/api/v1/dashboard/returns/${id}/refund/`,
                { method: 'POST', body: payload },
            ),

        setRefundMethod: (id: number, method: AdminRefundMethod) =>
            request<AdminReturnRequest>(
                `/api/v1/dashboard/returns/${id}/refund-method/`,
                {
                    method: 'PATCH',
                    body: { refund_method: method } satisfies AdminReturnRefundMethodWrite,
                },
            ),

        stats: (signal?: AbortSignal) =>
            request<AdminReturnStats>(
                '/api/v1/dashboard/returns/stats/',
                { signal },
            ),

        history: (signal?: AbortSignal) =>
            request<AdminReturnHistoryPoint[]>(
                '/api/v1/dashboard/returns/history/',
                { signal },
            ),

        refunds: (q: string = '', signal?: AbortSignal) => {
            const qs = q ? `?q=${encodeURIComponent(q)}` : '';
            return request<AdminRefundRecord[]>(
                `/api/v1/dashboard/returns/refunds/${qs}`,
                { signal },
            );
        },

        reasons: {
            list: (signal?: AbortSignal) =>
                request<AdminReturnReason[]>(
                    '/api/v1/dashboard/returns/reasons/',
                    { signal },
                ),

            create: (payload: AdminReturnReasonWrite) =>
                request<AdminReturnReason>(
                    '/api/v1/dashboard/returns/reasons/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminReturnReasonWrite>) =>
                request<AdminReturnReason>(
                    `/api/v1/dashboard/returns/reasons/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/returns/reasons/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        settings: {
            get: (signal?: AbortSignal) =>
                request<AdminReturnSettings>(
                    '/api/v1/dashboard/returns/settings/',
                    { signal },
                ),

            update: (payload: AdminReturnSettingsWrite) =>
                request<AdminReturnSettings>(
                    '/api/v1/dashboard/returns/settings/',
                    { method: 'PATCH', body: payload },
                ),
        },
    },

    whatsapp: {
        connection: {
            get: (signal?: AbortSignal) =>
                request<AdminWhatsAppAccount>(
                    '/api/v1/whatsapp/account/',
                    { signal },
                ),

            upsert: (payload: AdminWhatsAppAccountWrite) =>
                request<AdminWhatsAppAccount>(
                    '/api/v1/whatsapp/account/',
                    { method: 'PUT', body: payload },
                ),

            setActive: (isActive: boolean) =>
                request<AdminWhatsAppAccount>(
                    '/api/v1/whatsapp/account/set-active/',
                    { method: 'POST', body: { is_active: isActive } },
                ),

            refresh: (signal?: AbortSignal) =>
                request<AdminWhatsAppAccount>(
                    '/api/v1/whatsapp/account/refresh/',
                    { method: 'POST', signal },
                ),

            updateProfile: (payload: Partial<AdminWhatsAppAccountWrite>) =>
                request<AdminWhatsAppAccount>(
                    '/api/v1/whatsapp/account/profile/',
                    { method: 'PATCH', body: payload },
                ),
        },

        settings: {
            get: (signal?: AbortSignal) =>
                request<AdminWhatsAppSettings>(
                    '/api/v1/whatsapp/account/settings/',
                    { signal },
                ),

            update: (payload: AdminWhatsAppSettingsUpdate) =>
                request<AdminWhatsAppSettings>(
                    '/api/v1/whatsapp/account/settings/',
                    { method: 'PATCH', body: payload },
                ),
        },

        team: {
            list: async (signal?: AbortSignal): Promise<AdminWhatsAppTeamMember[]> => {
                const res = await request<
                    | AdminWhatsAppTeamMember[]
                    | { results: AdminWhatsAppTeamMember[] }
                >('/api/v1/whatsapp/account/team/', { signal });
                return unwrapList(res);
            },

            create: (payload: AdminWhatsAppTeamMemberWrite) =>
                request<AdminWhatsAppTeamMember>(
                    '/api/v1/whatsapp/account/team/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: AdminWhatsAppTeamMemberUpdate) =>
                request<AdminWhatsAppTeamMember>(
                    `/api/v1/whatsapp/account/team/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/account/team/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        auditLog: {
            list: async (signal?: AbortSignal): Promise<AdminWhatsAppAuditEntry[]> => {
                const res = await request<
                    | AdminWhatsAppAuditEntry[]
                    | { results: AdminWhatsAppAuditEntry[] }
                >('/api/v1/whatsapp/account/audit/', { signal });
                return unwrapList(res);
            },
        },

        notifications: {
            list: async (signal?: AbortSignal): Promise<AdminWhatsAppNotification[]> => {
                const res = await request<
                    | AdminWhatsAppNotification[]
                    | { results: AdminWhatsAppNotification[] }
                >('/api/v1/whatsapp/account/notifications/', { signal });
                return unwrapList(res);
            },

            markRead: (id: number) =>
                request<AdminWhatsAppNotification>(
                    `/api/v1/whatsapp/account/notifications/${id}/read/`,
                    { method: 'POST' },
                ),

            markAllRead: () =>
                request<{ updated: number }>(
                    '/api/v1/whatsapp/account/notifications/mark-all-read/',
                    { method: 'POST' },
                ),
        },

        catalog: {
            get: (signal?: AbortSignal) =>
                request<AdminWhatsAppCatalog>(
                    '/api/v1/whatsapp/catalog/',
                    { signal },
                ),

            create: (payload: AdminWhatsAppCatalogCreateWrite = {}) =>
                request<AdminWhatsAppCatalog>(
                    '/api/v1/whatsapp/catalog/create/',
                    { method: 'POST', body: payload },
                ),

            update: (payload: AdminWhatsAppCatalogUpdate) =>
                request<AdminWhatsAppCatalog>(
                    '/api/v1/whatsapp/catalog/',
                    { method: 'PATCH', body: payload },
                ),

            sync: (signal?: AbortSignal) =>
                request<{ status: 'queued' }>(
                    '/api/v1/whatsapp/catalog/sync/',
                    { method: 'POST', signal },
                ),

            items: {
                list: async (
                    filters: AdminWhatsAppCatalogItemFilters = {},
                    signal?: AbortSignal,
                ): Promise<AdminWhatsAppCatalogItem[]> => {
                    const sp = new URLSearchParams();
                    if (filters.search) sp.set('search', filters.search);
                    if (filters.syncStatus) sp.set('syncStatus', filters.syncStatus);
                    if (filters.category) sp.set('category', filters.category);
                    if (filters.eligibleOnly) sp.set('eligibleOnly', '1');
                    if (filters.linkedOnly) sp.set('linkedOnly', '1');
                    if (filters.unlinkedOnly) sp.set('unlinkedOnly', '1');
                    const qs = sp.toString();
                    const res = await request<
                        | AdminWhatsAppCatalogItem[]
                        | { results: AdminWhatsAppCatalogItem[] }
                    >(
                        `/api/v1/whatsapp/catalog/items/${qs ? `?${qs}` : ''}`,
                        { signal },
                    );
                    return unwrapList(res);
                },

                detail: (id: number, signal?: AbortSignal) =>
                    request<AdminWhatsAppCatalogItem>(
                        `/api/v1/whatsapp/catalog/items/${id}/`,
                        { signal },
                    ),

                update: (
                    id: number,
                    payload: AdminWhatsAppCatalogItemUpdate,
                ) =>
                    request<AdminWhatsAppCatalogItem>(
                        `/api/v1/whatsapp/catalog/items/${id}/`,
                        { method: 'PATCH', body: payload },
                    ),

                bulkUpdate: (payload: AdminWhatsAppCatalogBulkWrite) =>
                    request<{ updated: number }>(
                        '/api/v1/whatsapp/catalog/items/bulk/',
                        { method: 'POST', body: payload },
                    ),

                link: (id: number, payload: AdminWhatsAppCatalogItemLinkWrite) =>
                    request<AdminWhatsAppCatalogItem>(
                        `/api/v1/whatsapp/catalog/items/${id}/link/`,
                        { method: 'POST', body: payload },
                    ),

                unlink: (payload: AdminWhatsAppCatalogItemUnlinkWrite) =>
                    request<{ removed?: number; unlinked?: number }>(
                        '/api/v1/whatsapp/catalog/items/unlink/',
                        { method: 'POST', body: payload },
                    ),

                syncItems: (ids: number[]) =>
                    request<{ queued: number; skipped: number }>(
                        '/api/v1/whatsapp/catalog/items/sync/',
                        { method: 'POST', body: { ids } },
                    ),

                manualAdd: (payload: AdminWhatsAppCatalogManualAddWrite) =>
                    request<AdminWhatsAppCatalogManualAddResponse>(
                        '/api/v1/whatsapp/catalog/items/manual-add/',
                        { method: 'POST', body: payload },
                    ),

                reorder: (payload: AdminWhatsAppCatalogReorderWrite) =>
                    request<AdminWhatsAppCatalogReorderResponse>(
                        '/api/v1/whatsapp/catalog/items/reorder/',
                        { method: 'POST', body: payload },
                    ),
            },
        },

        inbox: {
            listConversations: (
                filters: AdminWhatsAppConversationFilters = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (filters.tab) sp.set('tab', filters.tab);
                if (filters.search) sp.set('search', filters.search);
                if (filters.assignedTo) sp.set('assigned_to', String(filters.assignedTo));
                if (filters.tag) sp.set('tag', filters.tag);
                const qs = sp.toString();
                return request<AdminWhatsAppConversation[]>(
                    `/api/v1/whatsapp/conversations/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            conversationDetail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppConversationDetail>(
                    `/api/v1/whatsapp/conversations/${id}/`,
                    { signal },
                ),

            sendMessage: (conversationId: number, payload: AdminWhatsAppMessageWrite) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/conversations/${conversationId}/messages/`,
                    { method: 'POST', body: payload },
                ),

            sendTemplate: (
                conversationId: number,
                payload: {
                    templateName: string;
                    language?: string;
                    bodyParams?: string[];
                    headerParams?: string[];
                    buttonUrlParam?: string;
                },
            ) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/conversations/${conversationId}/send-template/`,
                    { method: 'POST', body: payload },
                ),

            sendProduct: (
                conversationId: number,
                productId: string,
            ) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/conversations/${conversationId}/send-product/`,
                    { method: 'POST', body: { productId } },
                ),

            sendMedia: (
                conversationId: number,
                input: AdminWhatsAppSendMediaWrite,
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppMessage> => {
                const url = `/api/v1/whatsapp/conversations/${conversationId}/send-media/`;

                if ('file' in input) {
                    const form = new FormData();
                    form.append('kind', input.kind);
                    form.append('file', input.file);
                    if (input.caption) form.append('caption', input.caption);

                    return fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'X-CSRFToken': readCsrfToken() },
                        body: form,
                        signal,
                    }).then(async (res) => {
                        if (!res.ok) {
                            let detail = `Media send failed: ${res.status}`;
                            try {
                                const data = (await res.json()) as { detail?: string };
                                if (data?.detail) detail = data.detail;
                            } catch { }
                            throw new Error(detail);
                        }
                        return (await res.json()) as AdminWhatsAppMessage;
                    });
                }

                return request<AdminWhatsAppMessage>(url, {
                    method: 'POST',
                    body: {
                        kind: input.kind,
                        url: input.url,
                        ...(input.caption ? { caption: input.caption } : {}),
                    },
                    signal,
                });
            },

            sendImage: (
                conversationId: number,
                input:
                    | { file: File; caption?: string }
                    | { imageUrl: string; caption?: string },
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppMessage> => {
                if ('file' in input) {
                    return adminApi.whatsapp.inbox.sendMedia(
                        conversationId,
                        { kind: 'image', file: input.file, caption: input.caption },
                        signal,
                    );
                }
                return adminApi.whatsapp.inbox.sendMedia(
                    conversationId,
                    { kind: 'image', url: input.imageUrl, caption: input.caption },
                    signal,
                );
            },

            sendCart: (
                conversationId: number,
                payload: AdminWhatsAppSendCartWrite,
            ) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/conversations/${conversationId}/send-cart/`,
                    { method: 'POST', body: payload },
                ),

            sendInteractive: (
                conversationId: number,
                payload: AdminWhatsAppSendInteractiveWrite,
            ) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/conversations/${conversationId}/send-interactive/`,
                    { method: 'POST', body: payload },
                ),

            reactToMessage: (messageId: number, payload: AdminWhatsAppReactWrite) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/messages/${messageId}/react/`,
                    { method: 'POST', body: payload },
                ),

            assign: (conversationId: number, payload: AdminWhatsAppAssignWrite) =>
                request<AdminWhatsAppConversation>(
                    `/api/v1/whatsapp/conversations/${conversationId}/assign/`,
                    { method: 'POST', body: payload },
                ),

            resolve: (
                conversationId: number,
                payload: AdminWhatsAppResolveWrite = {},
            ) =>
                request<AdminWhatsAppConversation>(
                    `/api/v1/whatsapp/conversations/${conversationId}/resolve/`,
                    { method: 'POST', body: payload },
                ),

            reopen: (conversationId: number) =>
                request<AdminWhatsAppConversation>(
                    `/api/v1/whatsapp/conversations/${conversationId}/reopen/`,
                    { method: 'POST' },
                ),

            tag: (conversationId: number, payload: AdminWhatsAppTagWrite) =>
                request<AdminWhatsAppConversation>(
                    `/api/v1/whatsapp/conversations/${conversationId}/tag/`,
                    { method: 'POST', body: payload },
                ),

            addNote: (conversationId: number, payload: AdminWhatsAppNoteWrite) =>
                request<AdminWhatsAppConversation>(
                    `/api/v1/whatsapp/conversations/${conversationId}/notes/`,
                    { method: 'POST', body: payload },
                ),

            createOrder: (
                conversationId: number,
                payload: AdminDirectCreateOrderWrite,
            ) =>
                request<{
                    order_reference: string;
                    status: string;
                    payment_status: string;
                    total: string;
                    checkout_url: string;
                }>(
                    `/api/v1/whatsapp/conversations/${conversationId}/create-order/`,
                    { method: 'POST', body: payload },
                ),

            sendCheckoutLink: (
                conversationId: number,
                payload: AdminDirectSendCheckoutLinkWrite = {},
            ) =>
                request<{
                    status: string;
                    session_token: string;
                    checkout_url: string;
                    message: string;
                }>(
                    `/api/v1/whatsapp/conversations/${conversationId}/send-checkout-link/`,
                    { method: 'POST', body: payload },
                ),

            poll: (since: string | null, signal?: AbortSignal) => {
                const qs = since ? `?since=${encodeURIComponent(since)}` : '';
                return request<AdminWhatsAppMessage[]>(
                    `/api/v1/whatsapp/messages/poll/${qs}`,
                    { signal },
                );
            },
        },

        templates: {
            list: async (
                filters: { status?: string; category?: string; search?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppTemplate[]> => {
                const sp = new URLSearchParams();
                if (filters.status) sp.set('status', filters.status);
                if (filters.category) sp.set('category', filters.category);
                if (filters.search) sp.set('search', filters.search);
                const qs = sp.toString();
                const res = await request<
                    AdminWhatsAppTemplate[] | { results: AdminWhatsAppTemplate[] }
                >(
                    `/api/v1/whatsapp/templates/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppTemplate>(
                    `/api/v1/whatsapp/templates/${id}/`,
                    { signal },
                ),

            create: (payload: AdminWhatsAppTemplateWrite) =>
                request<AdminWhatsAppTemplate>(
                    '/api/v1/whatsapp/templates/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminWhatsAppTemplateWrite>) =>
                request<AdminWhatsAppTemplate>(
                    `/api/v1/whatsapp/templates/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/templates/${id}/`,
                    { method: 'DELETE' },
                ),

            submit: (id: number) =>
                request<AdminWhatsAppTemplate>(
                    `/api/v1/whatsapp/templates/${id}/submit/`,
                    { method: 'POST' },
                ),

            pause: (id: number) =>
                request<AdminWhatsAppTemplate>(
                    `/api/v1/whatsapp/templates/${id}/pause/`,
                    { method: 'POST' },
                ),

            duplicate: (id: number) =>
                request<AdminWhatsAppTemplate>(
                    `/api/v1/whatsapp/templates/${id}/duplicate/`,
                    { method: 'POST' },
                ),

            sync: (signal?: AbortSignal) =>
                request<AdminWhatsAppTemplateSyncResult>(
                    '/api/v1/whatsapp/templates/sync/',
                    { method: 'POST', signal },
                ),
        },

        automations: {
            list: async (
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppAutomation[]> => {
                const res = await request<
                    AdminWhatsAppAutomation[] | { results: AdminWhatsAppAutomation[] }
                >('/api/v1/whatsapp/automations/', { signal });
                return unwrapList(res);
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppAutomation>(
                    `/api/v1/whatsapp/automations/${id}/`,
                    { signal },
                ),

            create: (payload: AdminWhatsAppAutomationWrite) =>
                request<AdminWhatsAppAutomation>(
                    '/api/v1/whatsapp/automations/',
                    { method: 'POST', body: payload },
                ),

            update: (
                id: number,
                payload: Partial<AdminWhatsAppAutomationWrite>,
            ) =>
                request<AdminWhatsAppAutomation>(
                    `/api/v1/whatsapp/automations/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/automations/${id}/`,
                    { method: 'DELETE' },
                ),

            toggle: (id: number, payload: AdminWhatsAppAutomationToggleWrite = {}) =>
                request<AdminWhatsAppAutomation>(
                    `/api/v1/whatsapp/automations/${id}/toggle/`,
                    { method: 'POST', body: payload },
                ),

            runOnce: (id: number) =>
                request<{ status: string; automation_id: number }>(
                    `/api/v1/whatsapp/automations/${id}/run/`,
                    { method: 'POST' },
                ),
        },

        broadcasts: {
            list: async (
                filters: AdminWhatsAppBroadcastFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppBroadcast[]> => {
                const sp = new URLSearchParams();
                if (filters.status) sp.set('status', filters.status);
                if (filters.search) sp.set('search', filters.search);
                const qs = sp.toString();
                const res = await request<
                    AdminWhatsAppBroadcast[] | { results: AdminWhatsAppBroadcast[] }
                >(
                    `/api/v1/whatsapp/broadcasts/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppBroadcast>(
                    `/api/v1/whatsapp/broadcasts/${id}/`,
                    { signal },
                ),

            create: (payload: AdminWhatsAppBroadcastWrite) =>
                request<AdminWhatsAppBroadcast>(
                    '/api/v1/whatsapp/broadcasts/',
                    { method: 'POST', body: payload },
                ),

            update: (
                id: number,
                payload: Partial<AdminWhatsAppBroadcastWrite>,
            ) =>
                request<AdminWhatsAppBroadcast>(
                    `/api/v1/whatsapp/broadcasts/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/broadcasts/${id}/`,
                    { method: 'DELETE' },
                ),

            send: (id: number) =>
                request<AdminWhatsAppBroadcast>(
                    `/api/v1/whatsapp/broadcasts/${id}/send/`,
                    { method: 'POST' },
                ),

            pause: (id: number) =>
                request<AdminWhatsAppBroadcast>(
                    `/api/v1/whatsapp/broadcasts/${id}/pause/`,
                    { method: 'POST' },
                ),

            stats: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppBroadcastStats>(
                    `/api/v1/whatsapp/broadcasts/${id}/stats/`,
                    { signal },
                ),
        },

        contacts: {
            list: async (
                filters: AdminWhatsAppContactFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppContact[]> => {
                const sp = new URLSearchParams();
                if (filters.search) sp.set('search', filters.search);
                if (filters.optInStatus) sp.set('opt_in_status', filters.optInStatus);
                if (filters.verified !== undefined) {
                    sp.set('verified', String(filters.verified));
                }
                if (filters.tag) sp.set('tag', filters.tag);
                const qs = sp.toString();
                const res = await request<
                    AdminWhatsAppContact[] | { results: AdminWhatsAppContact[] }
                >(
                    `/api/v1/whatsapp/contacts/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            create: (payload: Partial<AdminWhatsAppContactWrite>) =>
                request<AdminWhatsAppContact>(
                    '/api/v1/whatsapp/contacts/',
                    { method: 'POST', body: payload },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppContactDetail>(
                    `/api/v1/whatsapp/contacts/${id}/`,
                    { signal },
                ),

            update: (id: number, payload: Partial<AdminWhatsAppContactWrite>) =>
                request<AdminWhatsAppContact>(
                    `/api/v1/whatsapp/contacts/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/contacts/${id}/`,
                    { method: 'DELETE' },
                ),

            unsubscribe: (id: number, note = '') =>
                request<AdminWhatsAppContact>(
                    `/api/v1/whatsapp/contacts/${id}/unsubscribe/`,
                    { method: 'POST', body: { note } },
                ),

            bulkUpdate: (payload: AdminWhatsAppContactBulkWrite) =>
                request<{ updated: number }>(
                    '/api/v1/whatsapp/contacts/bulk/',
                    { method: 'POST', body: payload },
                ),

            importRows: (payload: AdminWhatsAppContactImportWrite) =>
                request<AdminWhatsAppContactImportResult>(
                    '/api/v1/whatsapp/contacts/import/',
                    { method: 'POST', body: payload },
                ),

            exportCsv: (): Promise<void> =>
                downloadCsv(
                    '/api/v1/whatsapp/contacts/export/',
                    { method: 'GET', filename: 'contacts.csv' },
                ),

            requestVerification: (payload: AdminWhatsAppOtpRequestWrite) =>
                request<{ sent: boolean; expiresInMinutes: number }>(
                    '/api/v1/whatsapp/verify-number/',
                    { method: 'POST', body: payload },
                ),

            confirmVerification: (payload: AdminWhatsAppOtpConfirmWrite) =>
                request<AdminWhatsAppOtpConfirmResult>(
                    '/api/v1/whatsapp/verify-number/confirm/',
                    { method: 'POST', body: payload },
                ),
        },

        segments: {
            list: (signal?: AbortSignal) =>
                request<AdminWhatsAppSegment[]>(
                    '/api/v1/whatsapp/segments/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppSegment>(
                    `/api/v1/whatsapp/segments/${id}/`,
                    { signal },
                ),

            create: (payload: AdminWhatsAppSegmentWrite) =>
                request<AdminWhatsAppSegment>(
                    '/api/v1/whatsapp/segments/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminWhatsAppSegmentWrite>) =>
                request<AdminWhatsAppSegment>(
                    `/api/v1/whatsapp/segments/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/segments/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        quickReplies: {
            list: (signal?: AbortSignal) =>
                request<AdminWhatsAppQuickReply[]>(
                    '/api/v1/whatsapp/quick-replies/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppQuickReply>(
                    `/api/v1/whatsapp/quick-replies/${id}/`,
                    { signal },
                ),

            create: (payload: AdminWhatsAppQuickReplyWrite) =>
                request<AdminWhatsAppQuickReply>(
                    '/api/v1/whatsapp/quick-replies/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminWhatsAppQuickReplyWrite>) =>
                request<AdminWhatsAppQuickReply>(
                    `/api/v1/whatsapp/quick-replies/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/whatsapp/quick-replies/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        orders: {
            list: async (
                filters: { status?: string; search?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminWhatsAppOrder[]> => {
                const sp = new URLSearchParams();
                if (filters.status) sp.set('status', filters.status);
                if (filters.search) sp.set('search', filters.search);
                const qs = sp.toString();
                const res = await request<
                    AdminWhatsAppOrder[] | { results: AdminWhatsAppOrder[] }
                >(
                    `/api/v1/whatsapp/orders/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminWhatsAppOrder>(
                    `/api/v1/whatsapp/orders/${id}/`,
                    { signal },
                ),

            update: (id: number, payload: Partial<AdminWhatsAppOrderUpdate>) =>
                request<AdminWhatsAppOrder>(
                    `/api/v1/whatsapp/orders/${id}/`,
                    { method: 'PATCH', body: payload },
                ),
        },

        webhooks: {
            events: {
                list: async (
                    filters: { type?: string; status?: string } = {},
                    signal?: AbortSignal,
                ): Promise<AdminWhatsAppWebhookEvent[]> => {
                    const sp = new URLSearchParams();
                    if (filters.type) sp.set('type', filters.type);
                    if (filters.status) sp.set('status', filters.status);
                    const qs = sp.toString();
                    const res = await request<
                        | AdminWhatsAppWebhookEvent[]
                        | { results: AdminWhatsAppWebhookEvent[] }
                    >(
                        `/api/v1/whatsapp/webhooks/events/${qs ? `?${qs}` : ''}`,
                        { signal },
                    );
                    return unwrapList(res);
                },

                replay: (id: number) =>
                    request<AdminWhatsAppWebhookEvent>(
                        `/api/v1/whatsapp/webhooks/events/${id}/replay/`,
                        { method: 'POST' },
                    ),

                bulkReplay: (ids: number[]) =>
                    request<{ replayed: number }>(
                        '/api/v1/whatsapp/webhooks/events/bulk-replay/',
                        { method: 'POST', body: { ids } },
                    ),
            },
        },

        analytics: {
            summary: (
                params: { from?: string; to?: string } = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (params.from) sp.set('from', params.from);
                if (params.to) sp.set('to', params.to);
                const qs = sp.toString();
                return request<AdminWhatsAppAnalyticsSummary>(
                    `/api/v1/whatsapp/analytics/summary/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            series: (
                params: { from?: string; to?: string } = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (params.from) sp.set('from', params.from);
                if (params.to) sp.set('to', params.to);
                const qs = sp.toString();
                return request<AdminWhatsAppAnalyticsSeries>(
                    `/api/v1/whatsapp/analytics/series/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            costBreakdown: (
                params: { from?: string; to?: string } = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (params.from) sp.set('from', params.from);
                if (params.to) sp.set('to', params.to);
                const qs = sp.toString();
                return request<AdminWhatsAppCostBreakdown>(
                    `/api/v1/whatsapp/analytics/cost-breakdown/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            funnel: (signal?: AbortSignal) =>
                request<AdminWhatsAppAnalyticsFunnelStage[]>(
                    '/api/v1/whatsapp/analytics/funnel/',
                    { signal },
                ),

            agents: (signal?: AbortSignal) =>
                request<AdminWhatsAppAgentLeaderboardRow[]>(
                    '/api/v1/whatsapp/analytics/agents/',
                    { signal },
                ),

            commerce: (signal?: AbortSignal) =>
                request<AdminWhatsAppCommerceStats>(
                    '/api/v1/whatsapp/analytics/commerce/',
                    { signal },
                ),
        },

        billing: {
            summary: (
                params: { month?: string } = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (params.month) sp.set('month', params.month);
                const qs = sp.toString();
                return request<AdminWhatsAppBillingSummary>(
                    `/api/v1/whatsapp/billing/summary/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            refresh: (signal?: AbortSignal) =>
                request<AdminWhatsAppBillingSummary>(
                    '/api/v1/whatsapp/billing/refresh/',
                    { method: 'POST', signal },
                ),

            invoices: (signal?: AbortSignal) =>
                request<AdminWhatsAppInvoice[]>(
                    '/api/v1/whatsapp/billing/invoices/',
                    { signal },
                ),
        },

        botFlow: {
            get: (signal?: AbortSignal) =>
                request<AdminWhatsAppBotFlow>(
                    '/api/v1/whatsapp/bot/flow/',
                    { signal },
                ),

            save: (payload: AdminWhatsAppBotFlowWrite) =>
                request<AdminWhatsAppBotFlow>(
                    '/api/v1/whatsapp/bot/flow/',
                    { method: 'PUT', body: payload },
                ),

            publish: () =>
                request<AdminWhatsAppBotFlow>(
                    '/api/v1/whatsapp/bot/flow/publish/',
                    { method: 'POST' },
                ),
        },
    },
    social: {
        accounts: {
            list: (signal?: AbortSignal) =>
                request<AdminSocialAccount[]>(
                    '/api/v1/admin/social/accounts/',
                    { signal },
                ),

            detail: (platform: AdminSocialPlatform, signal?: AbortSignal) =>
                request<AdminSocialAccountDetail>(
                    `/api/v1/admin/social/accounts/${encodeURIComponent(platform)}/`,
                    { signal },
                ),

            capabilities: (signal?: AbortSignal) =>
                request<Record<AdminSocialPlatform, AdminSocialAccountCapabilities>>(
                    '/api/v1/admin/social/accounts/capabilities/',
                    { signal },
                ),

            connect: (platform: AdminSocialPlatform) =>
                request<AdminSocialAccount | { authUrl: string }>(
                    `/api/v1/admin/social/accounts/${encodeURIComponent(platform)}/connect/`,
                    { method: 'POST' },
                ),

            disconnect: (platform: AdminSocialPlatform) =>
                request<AdminSocialAccount>(
                    `/api/v1/admin/social/accounts/${encodeURIComponent(platform)}/disconnect/`,
                    { method: 'POST' },
                ),
        },

        media: {
            upload: (
                file: File,
                extras?: { folderId?: number; title?: string; tags?: string[] },
                signal?: AbortSignal,
            ) => {
                const form = new FormData();
                form.append('file', file);
                if (extras?.folderId !== undefined) {
                    form.append('folder_id', String(extras.folderId));
                }
                if (extras?.title) form.append('title', extras.title);
                for (const tag of extras?.tags ?? []) {
                    form.append('tags', tag);
                }
                return fetch(
                    '/api/v1/admin/social/media/upload/',
                    {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'X-CSRFToken': readCsrfToken() },
                        body: form,
                        signal,
                    },
                ).then(async (res) => {
                    if (!res.ok) {
                        let detail = `Upload failed: ${res.status} ${res.statusText}`;
                        try {
                            const data = (await res.json()) as { detail?: string };
                            if (data?.detail) detail = data.detail;
                        } catch {
                        }
                        throw new Error(detail);
                    }
                    return (await res.json()) as AdminSocialMedia;
                });
            },

            library: (
                filters: {
                    folder_id?: number;
                    media_type?: 'IMAGE' | 'VIDEO';
                    search?: string;
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialMedia>>(
                    `/api/v1/admin/social/media/library/${qsOf(filters)}`,
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialMedia>(
                    `/api/v1/admin/social/media/library/${id}/`,
                    { signal },
                ),

            update: (
                id: number,
                payload: { title?: string; tags?: string[]; folder_id?: number | null },
            ) =>
                request<AdminSocialMedia>(
                    `/api/v1/admin/social/media/library/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/admin/social/media/library/${id}/`,
                    { method: 'DELETE' },
                ),

            folders: {
                list: (signal?: AbortSignal) =>
                    request<AdminSocialMediaFolder[]>(
                        '/api/v1/admin/social/media/folders/',
                        { signal },
                    ),

                create: (name: string) =>
                    request<AdminSocialMediaFolder>(
                        '/api/v1/admin/social/media/folders/',
                        { method: 'POST', body: { name } },
                    ),
            },
        },

        posts: {
            listScheduled: (
                filters: {
                    status?: string;
                    platform?: AdminSocialPlatform;
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialScheduledPost>>(
                    `/api/v1/admin/social/posts/scheduled/${qsOf(filters)}`,
                    { signal },
                ),

            listPublished: (
                filters: {
                    status?: string;
                    platform?: AdminSocialPlatform;
                    search?: string;
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialPublishedPost>>(
                    `/api/v1/admin/social/posts/published/${qsOf(filters)}`,
                    { signal },
                ),

            publishedDetail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialPublishedPost>(
                    `/api/v1/admin/social/posts/published/${id}/`,
                    { signal },
                ),

            boost: (id: number, payload: AdminSocialBoostWrite) =>
                request<AdminSocialBoostResult>(
                    `/api/v1/admin/social/posts/published/${id}/boost/`,
                    { method: 'POST', body: payload },
                ),

            deleteFromPlatform: (id: number) =>
                request<{ ok: boolean }>(
                    `/api/v1/admin/social/posts/published/${id}/delete-from-platform/`,
                    { method: 'POST' },
                ),

            editCaption: (id: number, caption: string) =>
                request<{ ok: boolean }>(
                    `/api/v1/admin/social/posts/published/${id}/edit-caption/`,
                    { method: 'POST', body: { caption } satisfies AdminSocialEditCaptionWrite },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialScheduledPost>(
                    `/api/v1/admin/social/posts/${id}/`,
                    { signal },
                ),

            create: (payload: AdminSocialPostWrite) =>
                request<AdminSocialPostCreated>(
                    '/api/v1/admin/social/posts/',
                    {
                        method: 'POST',
                        body: {
                            caption: payload.caption,
                            platforms: payload.platforms,
                            ...(payload.productTag !== undefined && {
                                productTag: payload.productTag,
                            }),
                            ...(payload.mediaIds !== undefined && {
                                mediaIds: payload.mediaIds,
                            }),
                            ...(payload.scheduleAt !== undefined && {
                                scheduleAt: payload.scheduleAt,
                            }),
                        },
                    },
                ),

            update: (id: number, payload: AdminSocialPostPatch) =>
                request<AdminSocialScheduledPost>(
                    `/api/v1/admin/social/posts/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            publishNow: (id: string | number) =>
                request<{ ok: boolean }>(
                    `/api/v1/admin/social/posts/${encodeURIComponent(String(id))}/publish-now/`,
                    { method: 'POST' },
                ),

            remove: (id: string | number) =>
                request<void>(
                    `/api/v1/admin/social/posts/${encodeURIComponent(String(id))}/delete/`,
                    { method: 'DELETE' },
                ),

            bulkDelete: (ids: (number | string)[]) =>
                request<{ deleted: number }>(
                    '/api/v1/admin/social/posts/bulk-delete/',
                    { method: 'POST', body: { ids } satisfies AdminSocialBulkIds },
                ),

            bulkReschedule: (payload: AdminSocialBulkReschedule) =>
                request<{ updated: number }>(
                    '/api/v1/admin/social/posts/bulk-reschedule/',
                    { method: 'POST', body: payload },
                ),
        },

        calendar: {
            list: (
                params: {
                    start?: string;
                    end?: string;
                    platform?: AdminSocialPlatform;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialScheduledPost[]>(
                    `/api/v1/admin/social/calendar/${qsOf(params)}`,
                    { signal },
                ),
        },

        queue: {
            slots: {
                list: (signal?: AbortSignal) =>
                    request<AdminSocialQueueSlot[]>(
                        '/api/v1/admin/social/queue/slots/',
                        { signal },
                    ),

                create: (payload: AdminSocialQueueSlotWrite) =>
                    request<AdminSocialQueueSlot>(
                        '/api/v1/admin/social/queue/slots/',
                        { method: 'POST', body: payload },
                    ),

                update: (id: number, payload: Partial<AdminSocialQueueSlotWrite>) =>
                    request<AdminSocialQueueSlot>(
                        `/api/v1/admin/social/queue/slots/${id}/`,
                        { method: 'PATCH', body: payload },
                    ),

                remove: (id: number) =>
                    request<void>(
                        `/api/v1/admin/social/queue/slots/${id}/`,
                        { method: 'DELETE' },
                    ),
            },

            evergreen: {
                list: (
                    filters: { page?: number; page_size?: number } = {},
                    signal?: AbortSignal,
                ) =>
                    request<AdminSocialPaginated<AdminSocialEvergreenPost>>(
                        `/api/v1/admin/social/queue/evergreen/${qsOf(filters)}`,
                        { signal },
                    ),

                create: (payload: AdminSocialEvergreenPostWrite) =>
                    request<AdminSocialEvergreenPost>(
                        '/api/v1/admin/social/queue/evergreen/',
                        { method: 'POST', body: payload },
                    ),

                update: (id: number, payload: Partial<AdminSocialEvergreenPostWrite>) =>
                    request<AdminSocialEvergreenPost>(
                        `/api/v1/admin/social/queue/evergreen/${id}/`,
                        { method: 'PATCH', body: payload },
                    ),

                remove: (id: number) =>
                    request<void>(
                        `/api/v1/admin/social/queue/evergreen/${id}/`,
                        { method: 'DELETE' },
                    ),
            },
        },

        drafts: {
            list: (
                filters: {
                    status?: AdminSocialDraftStatus;
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialDraft>>(
                    `/api/v1/admin/social/drafts/${qsOf(filters)}`,
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialDraft>(
                    `/api/v1/admin/social/drafts/${id}/`,
                    { signal },
                ),

            create: (payload: AdminSocialDraftWrite) =>
                request<AdminSocialDraft>(
                    '/api/v1/admin/social/drafts/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminSocialDraftWrite>) =>
                request<AdminSocialDraft>(
                    `/api/v1/admin/social/drafts/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/admin/social/drafts/${id}/`,
                    { method: 'DELETE' },
                ),

            comment: (id: number, payload: AdminSocialDraftCommentWrite) =>
                request<AdminSocialDraftComment>(
                    `/api/v1/admin/social/drafts/${id}/comments/`,
                    { method: 'POST', body: payload },
                ),

            approve: (id: number) =>
                request<AdminSocialDraft>(
                    `/api/v1/admin/social/drafts/${id}/approve/`,
                    { method: 'POST' },
                ),

            reject: (id: number) =>
                request<AdminSocialDraft>(
                    `/api/v1/admin/social/drafts/${id}/reject/`,
                    { method: 'POST' },
                ),
        },

        inbox: {
            list: (
                filters: AdminSocialInboxFilters = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialInboxItem>>(
                    `/api/v1/admin/social/inbox/${qsOf(filters)}`,
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialInboxItem>(
                    `/api/v1/admin/social/inbox/${id}/`,
                    { signal },
                ),

            reply: (id: number, body: string) =>
                request<AdminSocialInboxReply>(
                    `/api/v1/admin/social/inbox/${id}/reply/`,
                    { method: 'POST', body: { body } satisfies InboxReplyCreateBody },
                ),

            setStatus: (
                id: number,
                status: AdminSocialInboxStatus,
                snoozed_until?: string,
            ) =>
                request<AdminSocialInboxItem>(
                    `/api/v1/admin/social/inbox/${id}/status/`,
                    { method: 'POST', body: { status, snoozed_until } },
                ),

            assign: (id: number, user_id: number | null) =>
                request<AdminSocialInboxItem>(
                    `/api/v1/admin/social/inbox/${id}/assign/`,
                    { method: 'POST', body: { user_id } },
                ),

            sync: () =>
                request<{ ok: boolean }>(
                    '/api/v1/admin/social/inbox/sync/',
                    { method: 'POST' },
                ),
        },

        templates: {
            list: (
                filters: {
                    category?: string;
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialTemplate>>(
                    `/api/v1/admin/social/templates/${qsOf(filters)}`,
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialTemplate>(
                    `/api/v1/admin/social/templates/${id}/`,
                    { signal },
                ),

            create: (payload: AdminSocialTemplateWrite) =>
                request<AdminSocialTemplate>(
                    '/api/v1/admin/social/templates/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminSocialTemplateWrite>) =>
                request<AdminSocialTemplate>(
                    `/api/v1/admin/social/templates/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/admin/social/templates/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        links: {
            list: (
                filters: { page?: number; page_size?: number } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialLink>>(
                    `/api/v1/admin/social/links/${qsOf(filters)}`,
                    { signal },
                ),

            create: (payload: AdminSocialLinkWrite) =>
                request<AdminSocialLink>(
                    '/api/v1/admin/social/links/',
                    { method: 'POST', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/admin/social/links/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        notifications: {
            list: (
                filters: {
                    unread?: '1';
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialNotificationList>(
                    `/api/v1/admin/social/notifications/${qsOf(filters)}`,
                    { signal },
                ),

            read: (id: number) =>
                request<{ ok: boolean }>(
                    `/api/v1/admin/social/notifications/${id}/read/`,
                    { method: 'POST' },
                ),

            readAll: () =>
                request<{ marked_read: number }>(
                    '/api/v1/admin/social/notifications/read-all/',
                    { method: 'POST' },
                ),
        },

        team: {
            list: (signal?: AbortSignal) =>
                request<AdminSocialTeamMember[]>(
                    '/api/v1/admin/social/team/',
                    { signal },
                ),

            create: (payload: AdminSocialTeamMemberWrite) =>
                request<AdminSocialTeamMember>(
                    '/api/v1/admin/social/team/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: AdminSocialTeamMemberPatch) =>
                request<AdminSocialTeamMember>(
                    `/api/v1/admin/social/team/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/admin/social/team/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        auditLog: {
            list: (
                filters: {
                    action?: string;
                    actor?: number;
                    page?: number;
                    page_size?: number;
                } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialAuditLog>>(
                    `/api/v1/admin/social/audit-log/${qsOf(filters)}`,
                    { signal },
                ),
        },

        reports: {
            list: (
                filters: { page?: number; page_size?: number } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPaginated<AdminSocialReport>>(
                    `/api/v1/admin/social/reports/${qsOf(filters)}`,
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSocialReport>(
                    `/api/v1/admin/social/reports/${id}/`,
                    { signal },
                ),

            create: (payload: AdminSocialReportWrite) =>
                request<AdminSocialReport>(
                    '/api/v1/admin/social/reports/',
                    { method: 'POST', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/admin/social/reports/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        overview: {
            get: (signal?: AbortSignal) =>
                request<AdminSocialOverview>(
                    '/api/v1/admin/social/overview/',
                    { signal },
                ),
        },

        analytics: {
            followers: (months = 5, signal?: AbortSignal) =>
                request<AdminSocialFollowerPoint[]>(
                    `/api/v1/admin/social/analytics/followers/?months=${months}`,
                    { signal },
                ),

            engagement: (signal?: AbortSignal) =>
                request<AdminSocialEngagementPoint[]>(
                    '/api/v1/admin/social/analytics/engagement/',
                    { signal },
                ),

            demographics: (platform?: AdminSocialPlatform, signal?: AbortSignal) =>
                request<AdminSocialDemographicSnapshot[]>(
                    `/api/v1/admin/social/analytics/demographics/${qsOf({ platform })}`,
                    { signal },
                ),

            bestTimes: (platform?: AdminSocialPlatform, signal?: AbortSignal) =>
                request<AdminSocialBestTimeRow[]>(
                    `/api/v1/admin/social/analytics/best-times/${qsOf({ platform })}`,
                    { signal },
                ),

            kpis: (days = 30, signal?: AbortSignal) =>
                request<AdminSocialKpiAnalytics>(
                    `/api/v1/admin/social/analytics/kpis/?days=${days}`,
                    { signal },
                ),

            topPosts: (
                params: { metric?: string; limit?: number; platform?: AdminSocialPlatform } = {},
                signal?: AbortSignal,
            ) =>
                request<AdminSocialPublishedPost[]>(
                    `/api/v1/admin/social/analytics/top-posts/${qsOf(params)}`,
                    { signal },
                ),
        },
    },

    directOrders: {
        uploads: {
            image: (file: File, signal?: AbortSignal) =>
                uploadDirectOrderFile(file, 'image', signal),

            video: (file: File, signal?: AbortSignal) =>
                uploadDirectOrderFile(file, 'video', signal),
        },

        orders: {
            list: async (
                filters: {
                    q?: string;
                    source?: AdminDirectOrderSource;
                    status?: AdminDirectOrderStatus;
                    dateRange?: 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days';
                } = {},
                signal?: AbortSignal,
            ): Promise<AdminDirectOrder[]> => {
                const sp = new URLSearchParams();
                if (filters.q) sp.set('q', filters.q);
                if (filters.source) sp.set('source', filters.source);
                if (filters.status) sp.set('status', filters.status);
                if (filters.dateRange) sp.set('dateRange', filters.dateRange);
                const qs = sp.toString();
                const res = await request<
                    AdminDirectOrder[] | { results: AdminDirectOrder[] }
                >(
                    `/api/v1/dashboard/direct-orders/orders/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (reference: string, signal?: AbortSignal) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/orders/${encodeURIComponent(reference)}/`,
                    { signal },
                ),

            create: (payload: AdminDirectOrderWrite) =>
                request<AdminDirectOrder>(
                    '/api/v1/dashboard/direct-orders/orders/',
                    { method: 'POST', body: payload },
                ),

            advance: (
                reference: string,
                payload: AdminDirectOrderAdvanceWrite,
            ) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/orders/${encodeURIComponent(reference)}/advance/`,
                    { method: 'POST', body: payload },
                ),
        },

        logged: {
            list: async (
                filters: {
                    q?: string;
                    source?: AdminDirectOrderSource;
                    status?: AdminDirectOrderStatus;
                    verification?: 'unverified' | 'verified' | 'failed';
                    dateRange?: 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days';
                } = {},
                signal?: AbortSignal,
            ): Promise<AdminDirectOrder[]> => {
                const sp = new URLSearchParams();
                if (filters.q) sp.set('q', filters.q);
                if (filters.source) sp.set('source', filters.source);
                if (filters.status) sp.set('status', filters.status);
                if (filters.verification) sp.set('verification', filters.verification);
                if (filters.dateRange) sp.set('dateRange', filters.dateRange);
                const qs = sp.toString();
                const res = await request<
                    AdminDirectOrder[] | { results: AdminDirectOrder[] }
                >(
                    `/api/v1/dashboard/direct-orders/logged/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (reference: string, signal?: AbortSignal) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/logged/${encodeURIComponent(reference)}/`,
                    { signal },
                ),

            create: (payload: AdminDirectOrderWrite) =>
                request<AdminDirectOrder>(
                    '/api/v1/dashboard/direct-orders/logged/',
                    { method: 'POST', body: payload },
                ),

            update: (
                reference: string,
                payload: Partial<AdminDirectOrderWrite>,
            ) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/logged/${encodeURIComponent(reference)}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (reference: string) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/logged/${encodeURIComponent(reference)}/`,
                    { method: 'DELETE' },
                ),

            advance: (
                reference: string,
                payload: AdminDirectOrderAdvanceWrite,
            ) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/logged/${encodeURIComponent(reference)}/advance/`,
                    { method: 'POST', body: payload },
                ),

            reconcile: (
                reference: string,
                verificationStatus: 'unverified' | 'verified' | 'failed',
            ) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/logged/${encodeURIComponent(reference)}/reconcile/`,
                    { method: 'POST', body: { verificationStatus } },
                ),
        },

        creators: {
            list: async (
                filters: { status?: string; q?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminDirectCreator[]> => {
                const qs = qsOf(filters);
                return request<AdminDirectCreator[]>(
                    `/api/v1/dashboard/direct-orders/creators/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminDirectCreator>(
                    `/api/v1/dashboard/direct-orders/creators/${id}/`,
                    { signal },
                ),

            create: (payload: AdminDirectCreatorWrite) =>
                request<AdminDirectCreator>(
                    '/api/v1/dashboard/direct-orders/creators/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminDirectCreatorWrite>) =>
                request<AdminDirectCreator>(
                    `/api/v1/dashboard/direct-orders/creators/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/creators/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        creatorSales: {
            list: async (
                filters: { creator?: number; paid?: boolean; status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminCreatorSale[]> => {
                const qs = qsOf(filters);
                return request<AdminCreatorSale[]>(
                    `/api/v1/dashboard/direct-orders/creator-sales/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCreatorSale>(
                    `/api/v1/dashboard/direct-orders/creator-sales/${id}/`,
                    { signal },
                ),

            update: (id: number, payload: Partial<AdminCreatorSaleWrite>) =>
                request<AdminCreatorSale>(
                    `/api/v1/dashboard/direct-orders/creator-sales/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/creator-sales/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        creatorApplications: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminCreatorApplication[]> => {
                const qs = qsOf(filters);
                return request<AdminCreatorApplication[]>(
                    `/api/v1/dashboard/direct-orders/creator-applications/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCreatorApplication>(
                    `/api/v1/dashboard/direct-orders/creator-applications/${id}/`,
                    { signal },
                ),

            create: (payload: AdminCreatorApplicationWrite) =>
                request<AdminCreatorApplication>(
                    '/api/v1/dashboard/direct-orders/creator-applications/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminCreatorApplicationWrite>) =>
                request<AdminCreatorApplication>(
                    `/api/v1/dashboard/direct-orders/creator-applications/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/creator-applications/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        partnerships: {
            list: async (
                filters: { creator?: number; status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminPartnership[]> => {
                const qs = qsOf(filters);
                return request<AdminPartnership[]>(
                    `/api/v1/dashboard/direct-orders/partnerships/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminPartnership>(
                    `/api/v1/dashboard/direct-orders/partnerships/${id}/`,
                    { signal },
                ),

            create: (payload: AdminPartnershipWrite) =>
                request<AdminPartnership>(
                    '/api/v1/dashboard/direct-orders/partnerships/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminPartnershipWrite>) =>
                request<AdminPartnership>(
                    `/api/v1/dashboard/direct-orders/partnerships/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/partnerships/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        creatorSamples: {
            list: async (
                filters: { creator?: number; status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminCreatorSample[]> => {
                const qs = qsOf(filters);
                return request<AdminCreatorSample[]>(
                    `/api/v1/dashboard/direct-orders/creator-samples/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCreatorSample>(
                    `/api/v1/dashboard/direct-orders/creator-samples/${id}/`,
                    { signal },
                ),

            create: (payload: AdminCreatorSampleWrite) =>
                request<AdminCreatorSample>(
                    '/api/v1/dashboard/direct-orders/creator-samples/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminCreatorSampleWrite>) =>
                request<AdminCreatorSample>(
                    `/api/v1/dashboard/direct-orders/creator-samples/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/creator-samples/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        content: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminDirectContent[]> => {
                const qs = qsOf(filters);
                return request<AdminDirectContent[]>(
                    `/api/v1/dashboard/direct-orders/content/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminDirectContent>(
                    `/api/v1/dashboard/direct-orders/content/${id}/`,
                    { signal },
                ),

            create: (payload: AdminDirectContentWrite) =>
                request<AdminDirectContent>(
                    '/api/v1/dashboard/direct-orders/content/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminDirectContentWrite>) =>
                request<AdminDirectContent>(
                    `/api/v1/dashboard/direct-orders/content/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/content/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        lives: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminDirectLive[]> => {
                const qs = qsOf(filters);
                return request<AdminDirectLive[]>(
                    `/api/v1/dashboard/direct-orders/lives/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminDirectLive>(
                    `/api/v1/dashboard/direct-orders/lives/${id}/`,
                    { signal },
                ),

            create: (payload: AdminDirectLiveWrite) =>
                request<AdminDirectLive>(
                    '/api/v1/dashboard/direct-orders/lives/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminDirectLiveWrite>) =>
                request<AdminDirectLive>(
                    `/api/v1/dashboard/direct-orders/lives/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/lives/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        products: {
            list: async (
                filters: { status?: AdminDirectProductStatus; q?: string; lowStock?: boolean } = {},
                signal?: AbortSignal,
            ): Promise<AdminDirectProduct[]> => {
                const sp = new URLSearchParams();
                if (filters.status) sp.set('status', filters.status);
                if (filters.q) sp.set('q', filters.q);
                if (filters.lowStock) sp.set('lowStock', 'true');
                const qs = sp.toString();
                const res = await request<
                    AdminDirectProduct[] | { results: AdminDirectProduct[] }
                >(
                    `/api/v1/dashboard/direct-orders/products/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminDirectProduct>(
                    `/api/v1/dashboard/direct-orders/products/${id}/`,
                    { signal },
                ),

            create: (payload: AdminDirectProductWrite) =>
                request<AdminDirectProduct>(
                    '/api/v1/dashboard/direct-orders/products/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminDirectProductWrite>) =>
                request<AdminDirectProduct>(
                    `/api/v1/dashboard/direct-orders/products/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/products/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        variants: {
            list: async (
                filters: { product?: number } = {},
                signal?: AbortSignal,
            ): Promise<AdminProductVariant[]> => {
                const qs = qsOf(filters);
                return request<AdminProductVariant[]>(
                    `/api/v1/dashboard/direct-orders/variants/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminProductVariant>(
                    `/api/v1/dashboard/direct-orders/variants/${id}/`,
                    { signal },
                ),

            create: (payload: AdminProductVariantWrite & { productId: number }) =>
                request<AdminProductVariant>(
                    '/api/v1/dashboard/direct-orders/variants/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminProductVariantWrite>) =>
                request<AdminProductVariant>(
                    `/api/v1/dashboard/direct-orders/variants/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/variants/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        suppliers: {
            list: async (
                filters: { q?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminSupplierFull[]> => {
                const qs = qsOf(filters);
                return request<AdminSupplierFull[]>(
                    `/api/v1/dashboard/direct-orders/suppliers/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSupplierFull>(
                    `/api/v1/dashboard/direct-orders/suppliers/${id}/`,
                    { signal },
                ),

            create: (payload: AdminSupplierFullWrite) =>
                request<AdminSupplierFull>(
                    '/api/v1/dashboard/direct-orders/suppliers/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminSupplierFullWrite>) =>
                request<AdminSupplierFull>(
                    `/api/v1/dashboard/direct-orders/suppliers/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/suppliers/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        purchaseOrders: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminPurchaseOrder[]> => {
                const qs = qsOf(filters);
                return request<AdminPurchaseOrder[]>(
                    `/api/v1/dashboard/direct-orders/purchase-orders/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminPurchaseOrder>(
                    `/api/v1/dashboard/direct-orders/purchase-orders/${id}/`,
                    { signal },
                ),

            create: (payload: AdminPurchaseOrderWrite) =>
                request<AdminPurchaseOrder>(
                    '/api/v1/dashboard/direct-orders/purchase-orders/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminPurchaseOrderWrite>) =>
                request<AdminPurchaseOrder>(
                    `/api/v1/dashboard/direct-orders/purchase-orders/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/purchase-orders/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        locations: {
            list: (signal?: AbortSignal) =>
                request<AdminLocation[]>(
                    '/api/v1/dashboard/direct-orders/locations/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminLocation>(
                    `/api/v1/dashboard/direct-orders/locations/${id}/`,
                    { signal },
                ),

            create: (payload: AdminLocationWrite) =>
                request<AdminLocation>(
                    '/api/v1/dashboard/direct-orders/locations/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminLocationWrite>) =>
                request<AdminLocation>(
                    `/api/v1/dashboard/direct-orders/locations/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/locations/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        inventory: {
            movements: {
                list: async (
                    filters: { product?: number; kind?: string } = {},
                    signal?: AbortSignal,
                ): Promise<AdminInventoryMovement[]> => {
                    const qs = qsOf(filters);
                    return request<AdminInventoryMovement[]>(
                        `/api/v1/dashboard/direct-orders/inventory/movements/${qs}`,
                        { signal },
                    );
                },

                detail: (id: number, signal?: AbortSignal) =>
                    request<AdminInventoryMovement>(
                        `/api/v1/dashboard/direct-orders/inventory/movements/${id}/`,
                        { signal },
                    ),

                create: (payload: AdminInventoryMovementWrite) =>
                    request<AdminInventoryMovement>(
                        '/api/v1/dashboard/direct-orders/inventory/movements/',
                        { method: 'POST', body: payload },
                    ),
            },

            summary: (signal?: AbortSignal) =>
                request<AdminInventorySummary>(
                    '/api/v1/dashboard/direct-orders/inventory/summary/',
                    { signal },
                ),
        },

        customers: {
            list: async (
                filters: { segment?: string; q?: string; limit?: number; offset?: number } = {},
                signal?: AbortSignal,
            ): Promise<AdminCustomerFull[] | { results: AdminCustomerFull[] }> => {
                const qs = qsOf(filters);
                return request<AdminCustomerFull[] | { results: AdminCustomerFull[] }>(
                    `/api/v1/dashboard/direct-orders/customers/${qs}`,
                    { signal },
                );
            },

            stats: (signal?: AbortSignal) =>
                request<AdminCustomerStatsFull>(
                    '/api/v1/dashboard/direct-orders/customers/stats/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCustomerFull>(
                    `/api/v1/dashboard/direct-orders/customers/${id}/`,
                    { signal },
                ),

            create: (payload: AdminCustomerFullWrite) =>
                request<AdminCustomerFull>(
                    '/api/v1/dashboard/direct-orders/customers/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminCustomerFullWrite>) =>
                request<AdminCustomerFull>(
                    `/api/v1/dashboard/direct-orders/customers/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/customers/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        segments: {
            list: (signal?: AbortSignal) =>
                request<AdminCustomerSegment[]>(
                    '/api/v1/dashboard/direct-orders/segments/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCustomerSegment>(
                    `/api/v1/dashboard/direct-orders/segments/${id}/`,
                    { signal },
                ),

            create: (payload: AdminCustomerSegmentWrite) =>
                request<AdminCustomerSegment>(
                    '/api/v1/dashboard/direct-orders/segments/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminCustomerSegmentWrite>) =>
                request<AdminCustomerSegment>(
                    `/api/v1/dashboard/direct-orders/segments/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/segments/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        inbox: {
            list: async (
                filters: { channel?: string; status?: string; q?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminInboxConversation[]> => {
                const qs = qsOf(filters);
                return request<AdminInboxConversation[]>(
                    `/api/v1/dashboard/direct-orders/inbox/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminInboxConversation>(
                    `/api/v1/dashboard/direct-orders/inbox/${id}/`,
                    { signal },
                ),

            create: (payload: AdminInboxConversationWrite) =>
                request<AdminInboxConversation>(
                    '/api/v1/dashboard/direct-orders/inbox/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminInboxConversationWrite>) =>
                request<AdminInboxConversation>(
                    `/api/v1/dashboard/direct-orders/inbox/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/inbox/${id}/`,
                    { method: 'DELETE' },
                ),

            convert: (id: number, payload: AdminInboxConvertWrite) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/inbox/${id}/convert/`,
                    { method: 'POST', body: payload },
                ),

            messages: {
                list: async (
                    filters: { conversation?: number } = {},
                    signal?: AbortSignal,
                ): Promise<AdminInboxMessage[]> => {
                    const qs = qsOf(filters);
                    return request<AdminInboxMessage[]>(
                        `/api/v1/dashboard/direct-orders/inbox/messages/${qs}`,
                        { signal },
                    );
                },

                create: (payload: AdminInboxMessageWrite) =>
                    request<AdminInboxMessage>(
                        '/api/v1/dashboard/direct-orders/inbox/messages/',
                        { method: 'POST', body: payload },
                    ),
            },
        },

        leads: {
            list: async (
                filters: { status?: string; source?: string; q?: string; limit?: number; offset?: number } = {},
                signal?: AbortSignal,
            ): Promise<AdminLead[] | { results: AdminLead[] }> => {
                const qs = qsOf(filters);
                return request<AdminLead[] | { results: AdminLead[] }>(
                    `/api/v1/dashboard/direct-orders/leads/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminLead>(
                    `/api/v1/dashboard/direct-orders/leads/${id}/`,
                    { signal },
                ),

            create: (payload: AdminLeadWrite) =>
                request<AdminLead>(
                    '/api/v1/dashboard/direct-orders/leads/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminLeadWrite>) =>
                request<AdminLead>(
                    `/api/v1/dashboard/direct-orders/leads/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/leads/${id}/`,
                    { method: 'DELETE' },
                ),

            convert: (id: number, payload: AdminLeadConvertWrite) =>
                request<{ lead: AdminLead; order: AdminDirectOrder }>(
                    `/api/v1/dashboard/direct-orders/leads/${id}/convert/`,
                    { method: 'POST', body: payload },
                ),
        },

        followups: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminFollowUp[]> => {
                const qs = qsOf(filters);
                return request<AdminFollowUp[]>(
                    `/api/v1/dashboard/direct-orders/followups/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminFollowUp>(
                    `/api/v1/dashboard/direct-orders/followups/${id}/`,
                    { signal },
                ),

            create: (payload: AdminFollowUpWrite) =>
                request<AdminFollowUp>(
                    '/api/v1/dashboard/direct-orders/followups/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminFollowUpWrite>) =>
                request<AdminFollowUp>(
                    `/api/v1/dashboard/direct-orders/followups/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/followups/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        tickets: {
            list: async (
                filters: { status?: string; priority?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminSupportTicket[]> => {
                const qs = qsOf(filters);
                return request<AdminSupportTicket[]>(
                    `/api/v1/dashboard/direct-orders/tickets/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminSupportTicket>(
                    `/api/v1/dashboard/direct-orders/tickets/${id}/`,
                    { signal },
                ),

            create: (payload: AdminSupportTicketWrite) =>
                request<AdminSupportTicket>(
                    '/api/v1/dashboard/direct-orders/tickets/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminSupportTicketWrite>) =>
                request<AdminSupportTicket>(
                    `/api/v1/dashboard/direct-orders/tickets/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/tickets/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        team: {
            list: async (
                filters: { role?: string; status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminTeamMember[]> => {
                const qs = qsOf(filters);
                return request<AdminTeamMember[]>(
                    `/api/v1/dashboard/direct-orders/team/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminTeamMember>(
                    `/api/v1/dashboard/direct-orders/team/${id}/`,
                    { signal },
                ),

            create: (payload: AdminTeamMemberWrite) =>
                request<AdminTeamMember>(
                    '/api/v1/dashboard/direct-orders/team/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminTeamMemberWrite>) =>
                request<AdminTeamMember>(
                    `/api/v1/dashboard/direct-orders/team/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/team/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        permissionGroups: {
            list: (signal?: AbortSignal) =>
                request<AdminPermissionGroup[]>(
                    '/api/v1/dashboard/direct-orders/permission-groups/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminPermissionGroup>(
                    `/api/v1/dashboard/direct-orders/permission-groups/${id}/`,
                    { signal },
                ),

            create: (payload: AdminPermissionGroupWrite) =>
                request<AdminPermissionGroup>(
                    '/api/v1/dashboard/direct-orders/permission-groups/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminPermissionGroupWrite>) =>
                request<AdminPermissionGroup>(
                    `/api/v1/dashboard/direct-orders/permission-groups/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/permission-groups/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        returns: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminReturnRequest[]> => {
                const qs = qsOf(filters);
                return request<AdminReturnRequest[]>(
                    `/api/v1/dashboard/direct-orders/returns/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminReturnRequest>(
                    `/api/v1/dashboard/direct-orders/returns/${id}/`,
                    { signal },
                ),

            create: (payload: AdminReturnRequestWrite) =>
                request<AdminReturnRequest>(
                    '/api/v1/dashboard/direct-orders/returns/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminReturnRequestWrite>) =>
                request<AdminReturnRequest>(
                    `/api/v1/dashboard/direct-orders/returns/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/returns/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        expenses: {
            list: async (
                filters: { category?: string; limit?: number; offset?: number } = {},
                signal?: AbortSignal,
            ): Promise<AdminExpense[] | { results: AdminExpense[] }> => {
                const qs = qsOf(filters);
                return request<AdminExpense[] | { results: AdminExpense[] }>(
                    `/api/v1/dashboard/direct-orders/expenses/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminExpense>(
                    `/api/v1/dashboard/direct-orders/expenses/${id}/`,
                    { signal },
                ),

            create: (payload: AdminExpenseWrite) =>
                request<AdminExpense>(
                    '/api/v1/dashboard/direct-orders/expenses/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminExpenseWrite>) =>
                request<AdminExpense>(
                    `/api/v1/dashboard/direct-orders/expenses/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/expenses/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        automations: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminAutomation[]> => {
                const qs = qsOf(filters);
                return request<AdminAutomation[]>(
                    `/api/v1/dashboard/direct-orders/automations/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminAutomation>(
                    `/api/v1/dashboard/direct-orders/automations/${id}/`,
                    { signal },
                ),

            create: (payload: AdminAutomationWrite) =>
                request<AdminAutomation>(
                    '/api/v1/dashboard/direct-orders/automations/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminAutomationWrite>) =>
                request<AdminAutomation>(
                    `/api/v1/dashboard/direct-orders/automations/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/automations/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        notifications: {
            list: async (
                filters: { unread?: boolean } = {},
                signal?: AbortSignal,
            ): Promise<AdminNotification[]> => {
                const qs = qsOf(filters);
                return request<AdminNotification[]>(
                    `/api/v1/dashboard/direct-orders/notifications/${qs}`,
                    { signal },
                );
            },

            markRead: (id: number) =>
                request<AdminNotification>(
                    `/api/v1/dashboard/direct-orders/notifications/${id}/read/`,
                    { method: 'POST' },
                ),

            markAllRead: () =>
                request<{ ok: boolean }>(
                    '/api/v1/dashboard/direct-orders/notifications/read-all/',
                    { method: 'POST' },
                ),

            settings: {
                list: (signal?: AbortSignal) =>
                    request<AdminNotificationSetting[]>(
                        '/api/v1/dashboard/direct-orders/notifications/settings/',
                        { signal },
                    ),

                update: (updates: Record<string, boolean>) =>
                    request<AdminNotificationSetting[]>(
                        '/api/v1/dashboard/direct-orders/notifications/settings/',
                        { method: 'PATCH', body: updates },
                    ),
            },
        },

        audit: {
            list: async (
                filters: AdminAuditLogFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminAuditLog[] | { results: AdminAuditLog[] }> => {
                const qs = qsOf(filters);
                return request<AdminAuditLog[] | { results: AdminAuditLog[] }>(
                    `/api/v1/dashboard/direct-orders/audit/${qs}`,
                    { signal },
                );
            },
        },

        reviews: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminReviewFull[]> => {
                const qs = qsOf(filters);
                return request<AdminReviewFull[]>(
                    `/api/v1/dashboard/direct-orders/reviews/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminReviewFull>(
                    `/api/v1/dashboard/direct-orders/reviews/${id}/`,
                    { signal },
                ),

            create: (payload: AdminReviewFullWrite) =>
                request<AdminReviewFull>(
                    '/api/v1/dashboard/direct-orders/reviews/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminReviewFullWrite>) =>
                request<AdminReviewFull>(
                    `/api/v1/dashboard/direct-orders/reviews/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/reviews/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        deliveryZones: {
            list: (signal?: AbortSignal) =>
                request<AdminDeliveryZoneFull[]>(
                    '/api/v1/dashboard/direct-orders/delivery-zones/',
                    { signal },
                ),

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminDeliveryZoneFull>(
                    `/api/v1/dashboard/direct-orders/delivery-zones/${id}/`,
                    { signal },
                ),

            create: (payload: AdminDeliveryZoneFullWrite) =>
                request<AdminDeliveryZoneFull>(
                    '/api/v1/dashboard/direct-orders/delivery-zones/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminDeliveryZoneFullWrite>) =>
                request<AdminDeliveryZoneFull>(
                    `/api/v1/dashboard/direct-orders/delivery-zones/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/delivery-zones/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        coupons: {
            list: async (
                filters: { active?: boolean } = {},
                signal?: AbortSignal,
            ): Promise<AdminCoupon[]> => {
                const qs = qsOf(filters);
                return request<AdminCoupon[]>(
                    `/api/v1/dashboard/direct-orders/coupons/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCoupon>(
                    `/api/v1/dashboard/direct-orders/coupons/${id}/`,
                    { signal },
                ),

            create: (payload: AdminCouponWrite) =>
                request<AdminCoupon>(
                    '/api/v1/dashboard/direct-orders/coupons/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminCouponWrite>) =>
                request<AdminCoupon>(
                    `/api/v1/dashboard/direct-orders/coupons/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/coupons/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        campaigns: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminCampaignFull[]> => {
                const qs = qsOf(filters);
                return request<AdminCampaignFull[]>(
                    `/api/v1/dashboard/direct-orders/campaigns/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminCampaignFull>(
                    `/api/v1/dashboard/direct-orders/campaigns/${id}/`,
                    { signal },
                ),

            create: (payload: AdminCampaignFullWrite) =>
                request<AdminCampaignFull>(
                    '/api/v1/dashboard/direct-orders/campaigns/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminCampaignFullWrite>) =>
                request<AdminCampaignFull>(
                    `/api/v1/dashboard/direct-orders/campaigns/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/campaigns/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        adCampaigns: {
            list: async (
                filters: { status?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminAdCampaign[]> => {
                const qs = qsOf(filters);
                return request<AdminAdCampaign[]>(
                    `/api/v1/dashboard/direct-orders/ad-campaigns/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminAdCampaign>(
                    `/api/v1/dashboard/direct-orders/ad-campaigns/${id}/`,
                    { signal },
                ),

            create: (payload: AdminAdCampaignWrite) =>
                request<AdminAdCampaign>(
                    '/api/v1/dashboard/direct-orders/ad-campaigns/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminAdCampaignWrite>) =>
                request<AdminAdCampaign>(
                    `/api/v1/dashboard/direct-orders/ad-campaigns/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/ad-campaigns/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        attribution: {
            list: async (
                filters: { creator?: number; campaign?: number } = {},
                signal?: AbortSignal,
            ): Promise<AdminAttributionLink[]> => {
                const qs = qsOf(filters);
                return request<AdminAttributionLink[]>(
                    `/api/v1/dashboard/direct-orders/attribution/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminAttributionLink>(
                    `/api/v1/dashboard/direct-orders/attribution/${id}/`,
                    { signal },
                ),

            create: (payload: AdminAttributionLinkWrite) =>
                request<AdminAttributionLink>(
                    '/api/v1/dashboard/direct-orders/attribution/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminAttributionLinkWrite>) =>
                request<AdminAttributionLink>(
                    `/api/v1/dashboard/direct-orders/attribution/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/attribution/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        payouts: {
            list: async (
                filters: { status?: string; creator?: number } = {},
                signal?: AbortSignal,
            ): Promise<AdminPayoutBatch[]> => {
                const qs = qsOf(filters);
                return request<AdminPayoutBatch[]>(
                    `/api/v1/dashboard/direct-orders/payouts/${qs}`,
                    { signal },
                );
            },

            detail: (id: number, signal?: AbortSignal) =>
                request<AdminPayoutBatch>(
                    `/api/v1/dashboard/direct-orders/payouts/${id}/`,
                    { signal },
                ),

            create: (payload: AdminPayoutBatchWrite & { saleIds?: number[] }) =>
                request<AdminPayoutBatch>(
                    '/api/v1/dashboard/direct-orders/payouts/',
                    { method: 'POST', body: payload },
                ),

            update: (id: number, payload: Partial<AdminPayoutBatchWrite>) =>
                request<AdminPayoutBatch>(
                    `/api/v1/dashboard/direct-orders/payouts/${id}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: number) =>
                request<void>(
                    `/api/v1/dashboard/direct-orders/payouts/${id}/`,
                    { method: 'DELETE' },
                ),
        },

        integrations: {
            list: (signal?: AbortSignal) =>
                request<AdminIntegration[]>(
                    '/api/v1/dashboard/direct-orders/integrations/',
                    { signal },
                ),

            detail: (key: string, signal?: AbortSignal) =>
                request<AdminIntegration>(
                    `/api/v1/dashboard/direct-orders/integrations/${encodeURIComponent(key)}/`,
                    { signal },
                ),

            create: (payload: AdminIntegrationWrite) =>
                request<AdminIntegration>(
                    '/api/v1/dashboard/direct-orders/integrations/',
                    { method: 'POST', body: payload },
                ),

            update: (key: string, payload: Partial<AdminIntegrationWrite>) =>
                request<AdminIntegration>(
                    `/api/v1/dashboard/direct-orders/integrations/${encodeURIComponent(key)}/`,
                    { method: 'PATCH', body: payload },
                ),

            action: (
                key: string,
                action: 'connect' | 'disconnect' | 'reconnect' | 'test',
            ) =>
                request<AdminIntegration>(
                    `/api/v1/dashboard/direct-orders/integrations/${encodeURIComponent(key)}/${action}/`,
                    { method: 'POST' },
                ),
        },

        analytics: {
            summary: (signal?: AbortSignal) =>
                request<AdminAnalyticsSummaryResponse>(
                    '/api/v1/dashboard/direct-orders/analytics/summary/',
                    { signal },
                ),
        },

        finance: {
            summary: (signal?: AbortSignal) =>
                request<AdminFinanceSummaryResponse>(
                    '/api/v1/dashboard/direct-orders/finance/summary/',
                    { signal },
                ),
        },

        health: {
            summary: (signal?: AbortSignal) =>
                request<AdminHealthSummaryResponse>(
                    '/api/v1/dashboard/direct-orders/health/summary/',
                    { signal },
                ),
        },
    },

    ai: {
        overview: (signal?: AbortSignal) =>
            request<AdminAIOverview>('/api/admin/ai/overview/', { signal }),

        digest: (signal?: AbortSignal) =>
            request<AdminAIDigestResponse>('/api/admin/ai/digest/', { signal }),

        assistant: {
            conversations: {
                list: async (
                    signal?: AbortSignal,
                ): Promise<AdminAIConversation[]> => {
                    const res = await request<
                        | AdminAIConversation[]
                        | { results: AdminAIConversation[] }
                    >('/api/admin/ai/assistant/conversations/', { signal });
                    return unwrapList(res);
                },

                create: (payload: AdminAIConversationCreateWrite = {}) =>
                    request<AdminAIConversation>(
                        '/api/admin/ai/assistant/conversations/',
                        { method: 'POST', body: payload },
                    ),

                detail: (id: string | number, signal?: AbortSignal) =>
                    request<AdminAIConversationDetail>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(id))}/`,
                        { signal },
                    ),

                update: (
                    id: string | number,
                    payload: AdminAIConversationUpdateWrite,
                ) =>
                    request<AdminAIConversation>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(id))}/`,
                        { method: 'PATCH', body: payload },
                    ),

                remove: (id: string | number) =>
                    request<void>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(id))}/`,
                        { method: 'DELETE' },
                    ),

                rename: (id: string | number, title: string) =>
                    request<AdminAIConversation>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(id))}/rename/`,
                        { method: 'POST', body: { title } },
                    ),

                togglePin: (id: string | number) =>
                    request<AdminAIConversation>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(id))}/pin/`,
                        { method: 'POST' },
                    ),

                export: (id: string | number, signal?: AbortSignal) =>
                    request<AdminAIConversationExportResponse>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(id))}/export/`,
                        { signal },
                    ),
            },

            messages: {
                list: async (
                    conversationId: string | number,
                    signal?: AbortSignal,
                ): Promise<AdminAIMessage[]> => {
                    const res = await request<
                        AdminAIMessage[] | { results: AdminAIMessage[] }
                    >(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(conversationId))}/messages/`,
                        { signal },
                    );
                    return unwrapList(res);
                },

                create: (
                    conversationId: string | number,
                    payload: AdminAIMessageWrite,
                ) =>
                    request<AdminAIMessage>(
                        `/api/admin/ai/assistant/conversations/${encodeURIComponent(String(conversationId))}/messages/`,
                        { method: 'POST', body: payload },
                    ),

                stream: streamAssistantReply,

                toolCalls: (
                    messageId: string | number,
                    signal?: AbortSignal,
                ) =>
                    request<AdminAIToolCall[]>(
                        `/api/admin/ai/assistant/messages/${encodeURIComponent(String(messageId))}/tool-calls/`,
                        { signal },
                    ),

                feedback: (
                    messageId: string | number,
                    feedback: 'up' | 'down',
                ) =>
                    request<AdminAIMessageFeedbackResponse>(
                        `/api/admin/ai/assistant/messages/${encodeURIComponent(String(messageId))}/feedback/`,
                        {
                            method: 'POST',
                            body: { feedback } satisfies AdminAIMessageFeedbackWrite,
                        },
                    ),
            },
        },

        tools: {
            schemas: (signal?: AbortSignal) =>
                request<{ tools: AdminAIToolSchema[]; count: number; names: string[] }>(
                    '/api/admin/ai/tools/',
                    { signal },
                ),

            preview: (payload: AdminAIToolPreviewWrite) =>
                request<AdminAIToolPreviewResponse>(
                    '/api/admin/ai/tools/preview/',
                    { method: 'POST', body: payload },
                ),
        },

        actions: {
            preview: (payload: {
                tool: string;
                title: string;
                description?: string;
                params?: Record<string, unknown>;
                confirmLabel?: string;
                cancelLabel?: string;
                destructive?: boolean;
                preview?: Array<{ label: string; value: string }>;
            }) =>
                request<AdminAIPendingAction>(
                    '/api/admin/ai/actions/preview/',
                    {
                        method: 'POST',
                        body: {
                            tool: payload.tool,
                            title: payload.title,
                            description: payload.description ?? '',
                            params: payload.params,
                            confirm_label: payload.confirmLabel,
                            cancel_label: payload.cancelLabel,
                            destructive: payload.destructive,
                            preview: payload.preview,
                        },
                    },
                ),

            execute: (payload: AdminAIActionExecuteWrite) =>
                request<AdminAIActionExecuteResponse>(
                    '/api/admin/ai/actions/execute/',
                    { method: 'POST', body: payload },
                ),
        },

        content: {
            generate: (payload: AdminAIContentRequest) =>
                request<AdminAIContentResponse>(
                    '/api/admin/ai/content/generate/',
                    { method: 'POST', body: payload },
                ),

            bulk: (payload: AdminAIContentBulkRequest) =>
                request<AdminAIContentBulkResponse>(
                    '/api/admin/ai/content/bulk/',
                    { method: 'POST', body: payload },
                ),
        },

        search: {
            getConfig: (signal?: AbortSignal) =>
                request<AdminAISearchConfig>(
                    '/api/admin/ai/search/config/',
                    { signal },
                ),

            updateConfig: (payload: Partial<AdminAISearchConfigWrite>) =>
                request<{ detail: string }>(
                    '/api/admin/ai/search/config/',
                    { method: 'PATCH', body: payload },
                ),

            analytics: (signal?: AbortSignal) =>
                request<AdminAISearchAnalytics>(
                    '/api/admin/ai/search/analytics/',
                    { signal },
                ),

            dataQuality: (signal?: AbortSignal) =>
                request<AdminAISearchDataQuality>(
                    '/api/admin/ai/search/data-quality/',
                    { signal },
                ),
        },

        automations: {
            list: async (
                filters: { status?: string; kind?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminAIAutomationExtended[]> => {
                const sp = new URLSearchParams();
                if (filters.status && filters.status !== 'all') {
                    sp.set('status', filters.status);
                }
                if (filters.kind && filters.kind !== 'all') {
                    sp.set('kind', filters.kind);
                }
                const qs = sp.toString();
                const res = await request<
                    | AdminAIAutomationExtended[]
                    | { results: AdminAIAutomationExtended[] }
                >(
                    `/api/admin/ai/automations/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (id: string | number, signal?: AbortSignal) =>
                request<AdminAIAutomationExtended>(
                    `/api/admin/ai/automations/${encodeURIComponent(String(id))}/`,
                    { signal },
                ),

            create: (payload: AdminAIAutomationWrite) =>
                request<AdminAIAutomationExtended>(
                    '/api/admin/ai/automations/',
                    { method: 'POST', body: payload },
                ),

            update: (
                id: string | number,
                payload: Partial<AdminAIAutomationWrite>,
            ) =>
                request<AdminAIAutomationExtended>(
                    `/api/admin/ai/automations/${encodeURIComponent(String(id))}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: string | number) =>
                request<void>(
                    `/api/admin/ai/automations/${encodeURIComponent(String(id))}/`,
                    { method: 'DELETE' },
                ),

            setStatus: (
                id: string | number,
                payload: AdminAIAutomationStatusWrite,
            ) =>
                request<AdminAIAutomationExtended>(
                    `/api/admin/ai/automations/${encodeURIComponent(String(id))}/status/`,
                    { method: 'POST', body: payload },
                ),

            runs: (
                id: string | number,
                filters: { status?: string; limit?: number } = {},
                signal?: AbortSignal,
            ) => {
                const sp = new URLSearchParams();
                if (filters.status && filters.status !== 'all') {
                    sp.set('status', filters.status);
                }
                if (filters.limit) sp.set('limit', String(filters.limit));
                const qs = sp.toString();
                return request<AdminAIAutomationRun[]>(
                    `/api/admin/ai/automations/${encodeURIComponent(String(id))}/runs/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
            },

            runNow: (
                id: string | number,
                payload: AdminAIAutomationRunRequest = {},
            ) =>
                request<AdminAIAutomationRun>(
                    `/api/admin/ai/automations/${encodeURIComponent(String(id))}/run/`,
                    { method: 'POST', body: payload },
                ),

            templates: {
                list: async (
                    signal?: AbortSignal,
                ): Promise<AdminAIAutomationTemplate[]> => {
                    const res = await request<
                        | AdminAIAutomationTemplate[]
                        | { results: AdminAIAutomationTemplate[] }
                    >('/api/admin/ai/automations/templates/', { signal });
                    return unwrapList(res);
                },
            },
        },

        alerts: {
            list: async (
                filters: AdminAIAlertFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminAIAlert[]> => {
                const sp = new URLSearchParams();
                if (filters.severity && filters.severity !== 'all') {
                    sp.set('severity', filters.severity);
                }
                if (filters.category && filters.category !== 'all') {
                    sp.set('category', filters.category);
                }
                const qs = sp.toString();
                const res = await request<
                    AdminAIAlert[] | { results: AdminAIAlert[] }
                >(
                    `/api/admin/ai/alerts/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            dismiss: (
                id: string | number,
                payload: AdminAIAlertDismissWrite = {},
            ) =>
                request<void>(
                    `/api/admin/ai/alerts/${encodeURIComponent(String(id))}/dismiss/`,
                    { method: 'POST', body: payload },
                ),

            acknowledge: (id: string | number) =>
                request<void>(
                    `/api/admin/ai/alerts/${encodeURIComponent(String(id))}/acknowledge/`,
                    { method: 'POST' },
                ),

            snooze: (id: string | number, minutes: number) =>
                request<{ snoozedUntil: string }>(
                    `/api/admin/ai/alerts/${encodeURIComponent(String(id))}/snooze/`,
                    {
                        method: 'POST',
                        body: { minutes } satisfies AdminAIAlertSnoozeWrite,
                    },
                ),
        },

        insights: {
            list: async (
                filters: { category?: string } = {},
                signal?: AbortSignal,
            ): Promise<AdminAIInsight[]> => {
                const sp = new URLSearchParams();
                if (filters.category && filters.category !== 'all') {
                    sp.set('category', filters.category);
                }
                const qs = sp.toString();
                const res = await request<
                    AdminAIInsight[] | { results: AdminAIInsight[] }
                >(
                    `/api/admin/ai/insights/${qs ? `?${qs}` : ''}`,
                    { signal },
                );
                return unwrapList(res);
            },

            dismiss: (id: string | number) =>
                request<void>(
                    `/api/admin/ai/insights/${encodeURIComponent(String(id))}/dismiss/`,
                    { method: 'POST' },
                ),

            execute: (
                id: string | number,
                payload: AdminAIInsightExecuteWrite = {},
            ) =>
                request<AdminAIInsightExecuteResponse>(
                    `/api/admin/ai/insights/${encodeURIComponent(String(id))}/execute/`,
                    { method: 'POST', body: payload },
                ),
        },

        settings: {
            get: (signal?: AbortSignal) =>
                request<AdminAISettings>('/api/admin/ai/settings/', { signal }),

            update: (payload: Partial<AdminAISettingsWrite>) =>
                request<AdminAISettings>('/api/admin/ai/settings/', {
                    method: 'PATCH',
                    body: payload,
                }),

            disable: () =>
                request<AdminAISettings>('/api/admin/ai/settings/disable/', {
                    method: 'POST',
                }),
        },

        usage: (signal?: AbortSignal) =>
            request<AdminAIUsage>('/api/admin/ai/usage/', { signal }),

        usageRecent: (signal?: AbortSignal) =>
            request<AdminAIUsageLogRow[]>('/api/admin/ai/usage/recent/', { signal }),

        auditLog: async (
            filters: AdminAIAuditLogFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminAIAuditLog[]> => {
            const sp = new URLSearchParams();
            if (filters.action && filters.action !== 'all') {
                sp.set('action', filters.action);
            }
            if (filters.user) sp.set('user', String(filters.user));
            if (filters.limit) sp.set('limit', String(filters.limit));
            const qs = sp.toString();
            const res = await request<
                AdminAIAuditLog[] | { results: AdminAIAuditLog[] }
            >(
                `/api/admin/ai/audit/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },
    },

    users: {
        list: async (
            filters: AdminStaffFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminStaffUser[]> => {
            const res = await request<
                AdminStaffUser[] | { results: AdminStaffUser[] }
            >(
                `/api/v1/admin/users/${qsOf(filters)}`,
                { signal },
            );
            return unwrapList(res);
        },

        detail: (id: string, signal?: AbortSignal) =>
            request<AdminStaffUser>(
                `/api/v1/admin/users/${encodeURIComponent(id)}/`,
                { signal },
            ),

        update: (id: string, payload: Partial<AdminStaffUserWrite>) =>
            request<AdminStaffUser>(
                `/api/v1/admin/users/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: payload },
            ),

        remove: (id: string) =>
            request<void>(
                `/api/v1/admin/users/${encodeURIComponent(id)}/`,
                { method: 'DELETE' },
            ),

        setStatus: (id: string, status: AdminStaffUserStatus) =>
            request<AdminStaffUser>(
                `/api/v1/admin/users/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: { status } },
            ),

        toggleSuspend: (id: string) =>
            request<{ status: AdminStaffUserStatus }>(
                `/api/v1/admin/users/${encodeURIComponent(id)}/suspend/`,
                { method: 'POST' },
            ),

        resetPassword: (id: string) =>
            request<{ detail: string }>(
                `/api/v1/admin/users/${encodeURIComponent(id)}/reset-password/`,
                { method: 'POST' },
            ),

        myPermissions: (signal?: AbortSignal) =>
            request<MyPermissionsResponse>(
                '/api/v1/admin/users/me/permissions/',
                { signal },
            ),

        roles: {
            list: async (signal?: AbortSignal): Promise<AdminStaffRole[]> => {
                const res = await request<
                    AdminStaffRole[] | { results: AdminStaffRole[] }
                >('/api/v1/admin/users/roles/', { signal });
                return unwrapList(res);
            },
        },

        permissions: {
            get: async (signal?: AbortSignal): Promise<AdminPermissionRow[]> => {
                const res = await request<
                    AdminPermissionRow[] | { results: AdminPermissionRow[] }
                >('/api/v1/admin/users/permissions/', { signal });
                return unwrapList(res);
            },

            save: (payload: AdminPermissionMatrixWrite) =>
                request<{ detail: string }>(
                    '/api/v1/admin/users/permissions/',
                    { method: 'PUT', body: payload },
                ),
        },

        invites: {
            list: async (signal?: AbortSignal): Promise<AdminStaffInvite[]> => {
                const res = await request<
                    AdminStaffInvite[] | { results: AdminStaffInvite[] }
                >('/api/v1/admin/invites/', { signal });
                return unwrapList(res);
            },

            create: (payload: AdminStaffUserInviteWrite) =>
                request<StaffInviteCreateResponse>(
                    '/api/v1/admin/invites/',
                    { method: 'POST', body: payload },
                ),

            revoke: (id: string) =>
                request<void>(
                    `/api/v1/admin/invites/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),
        },

        publicInvite: {
            lookup: (token: string, signal?: AbortSignal) =>
                request<StaffInviteLookupResponse>(
                    `/api/v1/staff-invites/${encodeURIComponent(token)}/`,
                    { signal },
                ),

            accept: (token: string, payload: AdminInviteAcceptWrite) =>
                request<StaffInviteAcceptResponse>(
                    `/api/v1/staff-invites/${encodeURIComponent(token)}/accept/`,
                    { method: 'POST', body: payload },
                ),
        },
    },

    settings: {
        runtime: (signal?: AbortSignal) =>
            request<AdminRuntimeSettings>(
                '/api/v1/admin/settings/runtime/',
                { signal },
            ),

        general: {
            get: (signal?: AbortSignal) =>
                request<AdminGeneralSettings>(
                    '/api/v1/admin/settings/general/',
                    { signal },
                ),

            update: (payload: AdminGeneralSettingsWrite) =>
                request<AdminGeneralSettings>(
                    '/api/v1/admin/settings/general/',
                    { method: 'PATCH', body: payload },
                ),
        },

        store: {
            get: (signal?: AbortSignal) =>
                request<AdminStoreSettings>(
                    '/api/v1/admin/settings/store/',
                    { signal },
                ),

            update: (payload: AdminStoreSettingsWrite) =>
                request<AdminStoreSettings>(
                    '/api/v1/admin/settings/store/',
                    { method: 'PATCH', body: payload },
                ),
        },

        checkout: {
            get: (signal?: AbortSignal) =>
                request<AdminCheckoutSettings>(
                    '/api/v1/admin/settings/checkout/',
                    { signal },
                ),

            update: (payload: AdminCheckoutSettingsWrite) =>
                request<AdminCheckoutSettings>(
                    '/api/v1/admin/settings/checkout/',
                    { method: 'PATCH', body: payload },
                ),
        },

        inventory: {
            get: (signal?: AbortSignal) =>
                request<AdminInventorySettings>(
                    '/api/v1/admin/settings/inventory/',
                    { signal },
                ),

            update: (payload: AdminInventorySettingsWrite) =>
                request<AdminInventorySettings>(
                    '/api/v1/admin/settings/inventory/',
                    { method: 'PATCH', body: payload },
                ),
        },

        reviews: {
            get: (signal?: AbortSignal) =>
                request<AdminReviewSettings>(
                    '/api/v1/admin/settings/reviews/',
                    { signal },
                ),

            update: (payload: AdminReviewSettingsWrite) =>
                request<AdminReviewSettings>(
                    '/api/v1/admin/settings/reviews/',
                    { method: 'PATCH', body: payload },
                ),
        },

        payments: {
            get: (signal?: AbortSignal) =>
                request<AdminPaymentSettings>(
                    '/api/v1/admin/settings/payments/',
                    { signal },
                ),

            update: (payload: AdminPaymentSettingsWrite) =>
                request<AdminPaymentSettings>(
                    '/api/v1/admin/settings/payments/',
                    { method: 'PATCH', body: payload },
                ),

            mpesaStatus: (signal?: AbortSignal) =>
                request<AdminMpesaStatus>(
                    '/api/v1/admin/settings/payments/mpesa-status/',
                    { signal },
                ),

            transactions: async (
                filters: AdminMpesaTransactionFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminMpesaTransaction[]> => {
                const res = await request<
                    | AdminMpesaTransaction[]
                    | { results: AdminMpesaTransaction[] }
                >(
                    `/api/v1/admin/settings/payments/transactions/${qsOf(filters)}`,
                    { signal },
                );
                return unwrapList(res);
            },
        },

        shipping: {
            get: (signal?: AbortSignal) =>
                request<AdminShippingSettings>(
                    '/api/v1/admin/settings/shipping/',
                    { signal },
                ),

            update: (payload: AdminShippingSettingsWrite) =>
                request<AdminShippingSettings>(
                    '/api/v1/admin/settings/shipping/',
                    { method: 'PATCH', body: payload },
                ),

            providers: {
                list: async (signal?: AbortSignal): Promise<AdminShippingProvider[]> => {
                    const res = await request<
                        | AdminShippingProvider[]
                        | { results: AdminShippingProvider[] }
                    >('/api/v1/admin/settings/shipping/providers/', { signal });
                    return unwrapList(res);
                },

                detail: (key: AdminShippingProviderKey, signal?: AbortSignal) =>
                    request<AdminShippingProvider>(
                        `/api/v1/admin/settings/shipping/providers/${encodeURIComponent(key)}/`,
                        { signal },
                    ),

                update: (
                    key: AdminShippingProviderKey,
                    payload: Partial<AdminShippingProviderWrite>,
                ) =>
                    request<AdminShippingProvider>(
                        `/api/v1/admin/settings/shipping/providers/${encodeURIComponent(key)}/`,
                        { method: 'PATCH', body: payload },
                    ),
            },

            zones: {
                list: async (signal?: AbortSignal): Promise<AdminDeliveryZone[]> => {
                    const res = await request<
                        AdminDeliveryZone[] | { results: AdminDeliveryZone[] }
                    >('/api/v1/admin/settings/shipping/zones/', { signal });
                    return unwrapList(res);
                },

                detail: (id: number, signal?: AbortSignal) =>
                    request<AdminDeliveryZone>(
                        `/api/v1/admin/settings/shipping/zones/${id}/`,
                        { signal },
                    ),

                create: (payload: AdminDeliveryZoneWrite) =>
                    request<AdminDeliveryZone>(
                        '/api/v1/admin/settings/shipping/zones/',
                        { method: 'POST', body: payload },
                    ),

                update: (id: number, payload: Partial<AdminDeliveryZoneWrite>) =>
                    request<AdminDeliveryZone>(
                        `/api/v1/admin/settings/shipping/zones/${id}/`,
                        { method: 'PATCH', body: payload },
                    ),

                remove: (id: number) =>
                    request<void>(
                        `/api/v1/admin/settings/shipping/zones/${id}/`,
                        { method: 'DELETE' },
                    ),
            },

            publicZones: async (signal?: AbortSignal): Promise<AdminDeliveryZone[]> => {
                const res = await request<
                    AdminDeliveryZone[] | { results: AdminDeliveryZone[] }
                >('/api/v1/zones/', { signal });
                return unwrapList(res);
            },
        },

        notifications: {
            get: (signal?: AbortSignal) =>
                request<AdminNotificationSettings>(
                    '/api/v1/admin/settings/notifications/',
                    { signal },
                ),

            update: (payload: AdminNotificationSettingsWrite) =>
                request<AdminNotificationSettings>(
                    '/api/v1/admin/settings/notifications/',
                    { method: 'PATCH', body: payload },
                ),

            whatsappStatus: (signal?: AbortSignal) =>
                request<AdminWhatsAppStatus>(
                    '/api/v1/admin/settings/notifications/whatsapp-status/',
                    { signal },
                ),

            log: async (
                filters: AdminNotificationLogFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminNotificationLog[]> => {
                const res = await request<
                    AdminNotificationLog[] | { results: AdminNotificationLog[] }
                >(
                    `/api/v1/admin/settings/notifications/log/${qsOf(filters)}`,
                    { signal },
                );
                return unwrapList(res);
            },
        },

        security: {
            get: (signal?: AbortSignal) =>
                request<AdminSecuritySettings>(
                    '/api/v1/admin/settings/security/',
                    { signal },
                ),

            update: (payload: AdminSecuritySettingsWrite) =>
                request<AdminSecuritySettings>(
                    '/api/v1/admin/settings/security/',
                    { method: 'PATCH', body: payload },
                ),

            changePassword: (payload: AdminChangePasswordInput) =>
                request<{ detail: string }>(
                    '/api/v1/admin/settings/security/password/',
                    { method: 'POST', body: payload },
                ),

            setup2FA: () =>
                request<AdminTwoFASetup>(
                    '/api/v1/admin/settings/security/2fa/setup/',
                    { method: 'POST' },
                ),

            verify2FA: (payload: AdminTwoFAVerifyInput) =>
                request<{ detail: string }>(
                    '/api/v1/admin/settings/security/2fa/verify/',
                    { method: 'POST', body: payload },
                ),

            sessions: {
                list: async (signal?: AbortSignal): Promise<AdminActiveSession[]> => {
                    const res = await request<
                        AdminActiveSession[] | { results: AdminActiveSession[] }
                    >('/api/v1/admin/settings/security/sessions/', { signal });
                    return unwrapList(res);
                },

                revoke: (sessionKey: string) =>
                    request<void>(
                        `/api/v1/admin/settings/security/sessions/${encodeURIComponent(sessionKey)}/`,
                        { method: 'DELETE' },
                    ),
            },

            loginHistory: async (
                signal?: AbortSignal,
            ): Promise<AdminLoginEvent[]> => {
                const res = await request<
                    AdminLoginEvent[] | { results: AdminLoginEvent[] }
                >('/api/v1/admin/settings/security/login-history/', { signal });
                return unwrapList(res);
            },
        },

        integrations: {
            list: async (
                filters: AdminIntegrationFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminIntegrationStatus[]> => {
                const res = await request<
                    | AdminIntegrationStatus[]
                    | { results: AdminIntegrationStatus[] }
                >(
                    `/api/v1/admin/settings/integrations/${qsOf(filters)}`,
                    { signal },
                );
                return unwrapList(res);
            },

            detail: (key: string, signal?: AbortSignal) =>
                request<AdminIntegrationStatus>(
                    `/api/v1/admin/settings/integrations/${encodeURIComponent(key)}/`,
                    { signal },
                ),

            refresh: (signal?: AbortSignal) =>
                request<AdminIntegrationStatus[]>(
                    '/api/v1/admin/settings/integrations/refresh/',
                    { method: 'POST', signal },
                ),
        },

        tax: {
            get: (signal?: AbortSignal) =>
                request<AdminTaxSettings>(
                    '/api/v1/admin/settings/tax/',
                    { signal },
                ),

            update: (payload: AdminTaxSettingsWrite) =>
                request<AdminTaxSettings>(
                    '/api/v1/admin/settings/tax/',
                    { method: 'PATCH', body: payload },
                ),

            etimsStatus: (signal?: AbortSignal) =>
                request<AdminEtimsStatus>(
                    '/api/v1/admin/settings/tax/etims-status/',
                    { signal },
                ),

            etimsSubmissions: async (
                filters: AdminEtimsSubmissionFilters = {},
                signal?: AbortSignal,
            ): Promise<AdminEtimsSubmission[]> => {
                const res = await request<
                    AdminEtimsSubmission[] | { results: AdminEtimsSubmission[] }
                >(
                    `/api/v1/admin/settings/tax/etims-submissions/${qsOf(filters)}`,
                    { signal },
                );
                return unwrapList(res);
            },
        },

        auditLog: async (
            filters: AdminSettingsAuditLogFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminSettingsAuditLog[]> => {
            const res = await request<
                AdminSettingsAuditLog[] | { results: AdminSettingsAuditLog[] }
            >(
                `/api/v1/admin/settings/audit-log/${qsOf(filters)}`,
                { signal },
            );
            return unwrapList(res);
        },
    },

    reports: {
        sales: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportSalesResponse>(
                `/api/v1/admin/reports/sales/${reportQs(query)}`,
                { signal },
            ),

        orders: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportOrdersResponse>(
                `/api/v1/admin/reports/orders/${reportQs(query)}`,
                { signal },
            ),

        customers: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportCustomersResponse>(
                `/api/v1/admin/reports/customers/${reportQs(query)}`,
                { signal },
            ),

        products: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportProductsResponse>(
                `/api/v1/admin/reports/products/${reportQs(query)}`,
                { signal },
            ),

        inventory: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportInventoryResponse>(
                `/api/v1/admin/reports/inventory/${reportQs(query)}`,
                { signal },
            ),

        payments: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportPaymentsResponse>(
                `/api/v1/admin/reports/payments/${reportQs(query)}`,
                { signal },
            ),

        taxes: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportTaxesResponse>(
                `/api/v1/admin/reports/taxes/${reportQs(query)}`,
                { signal },
            ),

        shipping: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportShippingResponse>(
                `/api/v1/admin/reports/shipping/${reportQs(query)}`,
                { signal },
            ),

        discounts: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportDiscountsResponse>(
                `/api/v1/admin/reports/discounts/${reportQs(query)}`,
                { signal },
            ),

        social: (query: ReportQuery = {}, signal?: AbortSignal) =>
            request<ReportSocialResponse>(
                `/api/v1/admin/reports/social/${reportQs(query)}`,
                { signal },
            ),

        logExport: (payload: ReportExportWrite) =>
            request<ReportExportResponse>(
                '/api/v1/admin/reports/export/',
                { method: 'POST', body: payload },
            ),

        refreshCache: (payload: ReportRefreshWrite = {}) =>
            request<ReportRefreshResponse>(
                '/api/v1/admin/reports/refresh/',
                { method: 'POST', body: payload },
            ),
    },

    analytics: {
        traffic: (query: AnalyticsQuery = {}, signal?: AbortSignal) =>
            request<AnalyticsTrafficResponse>(
                `/api/v1/admin/analytics/traffic/${analyticsQs(query)}`,
                { signal },
            ),

        sales: (query: AnalyticsQuery = {}, signal?: AbortSignal) =>
            request<AnalyticsSalesResponse>(
                `/api/v1/admin/analytics/sales/${analyticsQs(query)}`,
                { signal },
            ),

        customers: (query: AnalyticsQuery = {}, signal?: AbortSignal) =>
            request<AnalyticsCustomersResponse>(
                `/api/v1/admin/analytics/customers/${analyticsQs(query)}`,
                { signal },
            ),

        products: (query: AnalyticsQuery = {}, signal?: AbortSignal) =>
            request<AnalyticsProductsResponse>(
                `/api/v1/admin/analytics/products/${analyticsQs(query)}`,
                { signal },
            ),

        channels: (query: AnalyticsQuery = {}, signal?: AbortSignal) =>
            request<AnalyticsChannelsResponse>(
                `/api/v1/admin/analytics/channels/${analyticsQs(query)}`,
                { signal },
            ),

        refreshCache: (payload: AnalyticsRefreshWrite = {}) =>
            request<AnalyticsRefreshResponse>(
                '/api/v1/admin/analytics/refresh/',
                { method: 'POST', body: payload },
            ),
    },
    overview: {
        get: (query: OverviewQuery = {}, signal?: AbortSignal) =>
            request<OverviewResponse>(
                `/api/v1/admin/overview/${overviewQs(query)}`,
                { signal },
            ),

        refreshCache: (payload: OverviewRefreshWrite = {}) =>
            request<OverviewRefreshResponse>(
                '/api/v1/admin/overview/refresh/',
                { method: 'POST', body: payload },
            ),
    },
    posters: {
        list: async (
            query: AdminPosterFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminPoster[]> => {
            const sp = new URLSearchParams();
            if (query.placement) sp.set('placement', query.placement);
            if (query.status && query.status !== 'ALL') {
                sp.set('status', query.status);
            }
            if (query.search) sp.set('search', query.search);
            const qs = sp.toString();
            const res = await request<AdminPoster[] | { results: AdminPoster[] }>(
                `/api/v1/admin/posters/${qs ? `?${qs}` : ''}`,
                { signal },
            );
            return unwrapList(res);
        },

        detail: (id: number, signal?: AbortSignal) =>
            request<AdminPoster>(`/api/v1/admin/posters/${id}/`, { signal }),

        create: (payload: AdminPosterWrite | FormData) =>
            request<AdminPoster>('/api/v1/admin/posters/', {
                method: 'POST',
                body: payload as any,
            }),

        update: (id: number, payload: Partial<AdminPosterWrite> | FormData) =>
            request<AdminPoster>(`/api/v1/admin/posters/${id}/`, {
                method: 'PATCH',
                body: payload as any,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/admin/posters/${id}/`, {
                method: 'DELETE',
            }),

        reorder: (rows: { id: number; order: number }[]) =>
            Promise.all(
                rows.map((row) =>
                    request<AdminPoster>(`/api/v1/admin/posters/${row.id}/`, {
                        method: 'PATCH',
                        body: { order: row.order } as Partial<AdminPosterWrite>,
                    }),
                ),
            ),
    },
    campaigns: {
        list: async (signal?: AbortSignal): Promise<AdminMetaCampaign[]> => {
            const res = await request<
                AdminMetaCampaign[] | { results: AdminMetaCampaign[] }
            >('/api/v1/admin/campaigns/', { signal });
            return unwrapList(res);
        },

        detail: (id: string, signal?: AbortSignal) =>
            request<AdminMetaCampaign>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/`,
                { signal },
            ),

        create: (payload: AdminMetaCampaignWrite) =>
            request<AdminMetaCampaign>('/api/v1/admin/campaigns/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: string, payload: Partial<AdminMetaCampaignWrite>) =>
            request<AdminMetaCampaign>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: payload },
            ),

        remove: (id: string) =>
            request<void>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/`,
                { method: 'DELETE' },
            ),

        dispatch: (id: string) =>
            request<AdminMetaCampaign>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/dispatch/`,
                { method: 'POST' },
            ),

        pause: (id: string) =>
            request<AdminMetaCampaign>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/pause/`,
                { method: 'POST' },
            ),

        resume: (id: string) =>
            request<AdminMetaCampaign>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/resume/`,
                { method: 'POST' },
            ),

        analytics: (id: string, signal?: AbortSignal) =>
            request<AdminMetaCampaignAnalytics>(
                `/api/v1/admin/campaigns/${encodeURIComponent(id)}/analytics/`,
                { signal },
            ),
    },
};