// lib/admin-api.ts
import { request, uploadRequest } from './api';
import type {
    AdminBrand,
    AdminBrandRef,
    AdminBrandWrite,
    AdminCategory,
    AdminCategoryRef,
    AdminCategoryWrite,
    AdminProduct,
    AdminProductWrite,
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
    // ── Customers ──────────────────────────────────────────────────────
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
    // ── Orders ─────────────────────────────────────────────────────────
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
    // ── Suppliers ──────────────────────────────────────────────────────
    AdminSupplier,
    AdminSupplierWrite,
    AdminSupplierProductInput,
    AdminPurchaseInput,
    // ── Inventory ──────────────────────────────────────────────────────
    AdminInventoryItem,
    AdminStockMovement,
    AdminInventoryAdjustInput,
    // ── Reviews ────────────────────────────────────────────────────────
    AdminReview,
    AdminReviewReply,
    AdminReviewStats,
    AdminReviewFilters,
    AdminBulkReviewWrite,
    AdminRejectReviewWrite,
    AdminFlagReviewWrite,
    AdminReplyReviewWrite,
    // ── Discounts ──────────────────────────────────────────────────────
    AdminDiscount,
    AdminDiscountWrite,
    AdminDiscountFilters,
    AdminDiscountSlowMover,
    AdminBulkClearanceWrite,
    AdminDiscountAnalytics,
    AdminDiscountAnalyticsSummary,
    AdminDiscountRules,
    // ── Transactions ledger ────────────────────────────────────────────
    AdminTransaction,
    AdminTransactionSummary,
    AdminTransactionFilters,
    AdminReconcileWrite,
    AdminRetryWrite,
    AdminBulkExportWrite,
    // ── Shipping ───────────────────────────────────────────────────────
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
    // ── WhatsApp admin ─────────────────────────────────────────────────
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
    // ── Social media hub ───────────────────────────────────────────────
    AdminSocialAccount,
    AdminSocialPlatform,
    AdminSocialScheduledPost,
    AdminSocialPublishedPost,
    AdminSocialMedia,
    AdminSocialPostWrite,
    AdminSocialPostCreated,
    AdminSocialFollowerPoint,
    AdminSocialEngagementPoint,
    // ── Direct orders (social commerce back-office) ────────────────────
    AdminDirectOrder,
    AdminDirectOrderStatus,
    AdminDirectOrderAdvanceWrite,
    AdminDirectCreator,
    AdminDirectCreatorWrite,
    AdminDirectContent,
    AdminDirectContentWrite,
    AdminDirectLive,
    AdminDirectLiveWrite,
    AdminDirectProduct,
    AdminDirectProductWrite,
    AdminDirectCreateOrderWrite,
    AdminDirectSendCheckoutLinkWrite,
    // ── AI & Automations ───────────────────────────────────────────────
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
    AdminAIContentDraft,
    AdminAIContentDraftWrite,
    AdminAIAutomation,
    AdminAIAutomationWrite,
    AdminAIAutomationTemplate,
    AdminAIAutomationStatusWrite,
    AdminAIInsight,
    AdminAIInsightExecuteResponse,
    AdminAISettings,
    AdminAISettingsWrite,
    AdminAIUsage,
    // ── Settings ───────────────────────────────────────────────────────
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
    AdminMpesaStatus,
    AdminMpesaTransaction,
    AdminMpesaTransactionFilters,
    AdminShippingSettings,
    AdminShippingSettingsWrite,
    AdminShippingProvider,
    AdminShippingProviderWrite,
    AdminShippingProviderKey,
    AdminDeliveryZone,
    AdminDeliveryZoneWrite,
    AdminNotificationSettings,
    AdminNotificationSettingsWrite,
    AdminWhatsAppStatus,
    AdminNotificationLog,
    AdminNotificationLogFilters,
    AdminSecuritySettings,
    AdminSecuritySettingsWrite,
    AdminLoginEvent,
    AdminActiveSession,
    AdminChangePasswordInput,
    AdminTwoFASetup,
    AdminTwoFAVerifyInput,
    AdminIntegrationStatus,
    AdminIntegrationFilters,
    AdminTaxSettings,
    AdminTaxSettingsWrite,
    AdminEtimsSubmission,
    AdminEtimsSubmissionFilters,
    AdminEtimsStatus,
    AdminSettingsAuditLog,
    AdminSettingsAuditLogFilters,
    // ── Users & Roles ──────────────────────────────────────────────────
    AdminStaffUser,
    AdminStaffUserWrite,
    AdminStaffUserStatus,
    AdminStaffUserInviteWrite,
    AdminStaffInvite,
    AdminStaffFilters,
    AdminStaffRole,
    AdminPermissionRow,
    AdminPermissionMatrixWrite,
    AdminInviteLookup,
    AdminInviteAcceptWrite,
    // ── Reports & Analytics ────────────────────────────────────────────
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
    // ── Analytics (dashboard.analytics) ────────────────────────────────
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
    // ── Overview (dashboard.overview) ──────────────────────────────────
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
} from './admin-types';

// ── Banners (re-exported from lib/api.ts — no duplication) ────────────────
import type {
    Banner,
    BannerWriteInput,
    BannerListQuery,
    BannerStats,
} from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Inline response shapes for the staff-invite flow.
//
// These shadow the types that used to live in `admin-types.ts`. Once
// you update that file to match the backend (see the notes at the end
// of this message), delete the three interfaces below and re-add
// `AdminInviteLookup` and `AdminInviteAcceptResult` to the big import
// block above. Until then, these local types keep the file
// type-checking against the actual server responses.
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Paginated-response unwrapper
// ─────────────────────────────────────────────────────────────────────────────
function unwrapList<T>(res: T[] | { results: T[] }): T[] {
    return Array.isArray(res) ? res : res.results;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRF helper
// ─────────────────────────────────────────────────────────────────────────────
function readCsrfToken(): string {
    return (
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('csrftoken='))
            ?.split('=')[1] ?? ''
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// File download helper
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Direct-orders upload helper
// ─────────────────────────────────────────────────────────────────────────────
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
            /* not JSON — keep the default */
        }
        throw new Error(detail);
    }

    return (await res.json()) as { url: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Assistant streaming helper
// ─────────────────────────────────────────────────────────────────────────────
async function streamAssistantReply(
    conversationId: string,
    content: string,
    {
        onChunk,
        onDone,
        onError,
        signal,
    }: {
        onChunk: (text: string) => void;
        onDone: (message: AdminAIMessage) => void;
        onError?: (err: Error) => void;
        signal?: AbortSignal;
    },
): Promise<void> {
    let res: Response;
    try {
        res = await fetch(
            `/api/admin/ai/conversations/${encodeURIComponent(conversationId)}/messages/stream/`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': readCsrfToken(),
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({ content }),
                signal,
            },
        );
    } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
        return;
    }

    if (!res.ok || !res.body) {
        onError?.(new Error(`Stream failed: ${res.status} ${res.statusText}`));
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
                    | { type: 'chunk'; text: string }
                    | { type: 'done'; message: AdminAIMessage }
                    | { type: 'error'; error: string };

                try {
                    payload = JSON.parse(json);
                } catch {
                    continue;
                }

                if (payload.type === 'chunk') onChunk(payload.text);
                else if (payload.type === 'done') onDone(payload.message);
                else if (payload.type === 'error') {
                    onError?.(new Error(payload.error));
                }
            }
        }
    } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
            onError?.(err instanceof Error ? err : new Error(String(err)));
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build query string from a flat filters object, skipping empty values.
// ─────────────────────────────────────────────────────────────────────────────
function qsOf(filters: Record<string, unknown> | undefined): string {
    if (!filters) return '';
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports helper — turns a ReportQuery into the ?range=&start=&end= form
// the Django views expect.
// ─────────────────────────────────────────────────────────────────────────────
function reportQs(query: ReportQuery = {}): string {
    const sp = new URLSearchParams();
    sp.set('range', query.range ?? '7days');
    if (query.range === 'custom') {
        if (query.start) sp.set('start', query.start);
        if (query.end) sp.set('end', query.end);
    }
    return `?${sp.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics helper — turns an AnalyticsQuery into ?range=
// ─────────────────────────────────────────────────────────────────────────────
function analyticsQs(query: AnalyticsQuery = {}): string {
    const sp = new URLSearchParams();
    sp.set('range', query.range ?? '7days');
    return `?${sp.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview helper — turns an OverviewQuery into ?range=&start=&end=
// ─────────────────────────────────────────────────────────────────────────────
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
    // ═══════════════════════════════════════════════════════════════════════
    // Products
    // ═══════════════════════════════════════════════════════════════════════
    products: {
        list: async (signal?: AbortSignal): Promise<AdminProduct[]> => {
            const res = await request<
                AdminProduct[] | { results: AdminProduct[] }
            >('/api/v1/admin/products/', { signal });
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

    // ═══════════════════════════════════════════════════════════════════════
    // Categories
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Brands
    // ═══════════════════════════════════════════════════════════════════════
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

        create: (payload: AdminBrandWrite) =>
            request<AdminBrand>('/api/v1/admin/brands/', {
                method: 'POST',
                body: payload,
            }),

        update: (id: string, payload: Partial<AdminBrandWrite>) =>
            request<AdminBrand>(
                `/api/v1/admin/brands/${encodeURIComponent(id)}/`,
                { method: 'PATCH', body: payload },
            ),

        remove: (id: string) =>
            request<void>(
                `/api/v1/admin/brands/${encodeURIComponent(id)}/`,
                { method: 'DELETE' },
            ),
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Banners & Hero (admin)
    // ═══════════════════════════════════════════════════════════════════════
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

        reset: () =>
            request<{ ok: boolean; count: number }>(
                '/api/v1/admin/banners/reset/',
                { method: 'POST' },
            ),
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Newsletter
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Customers (mini-CRM)
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Suppliers
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Inventory
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Orders (admin fulfillment view)
    // ═══════════════════════════════════════════════════════════════════════
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
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Reviews (moderation)
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Discounts (dashboard promotions)
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Transactions (financial ledger)
    // ═══════════════════════════════════════════════════════════════════════
    transactions: {
        list: async (
            filters: AdminTransactionFilters = {},
            signal?: AbortSignal,
        ): Promise<AdminTransaction[]> => {
            const sp = new URLSearchParams();
            if (filters.q) sp.set('q', filters.q);
            if (filters.status) sp.set('status', filters.status);
            if (filters.method) sp.set('method', filters.method);
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

    // ═══════════════════════════════════════════════════════════════════════
    // Shipping (admin configuration + tracking)
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // WhatsApp (business messaging)
    // ═══════════════════════════════════════════════════════════════════════
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
                    { method: 'POST', body: { isActive } },
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
                    variables?: Record<string, string>;
                    buttonUrlParam?: string;
                },
            ) =>
                request<AdminWhatsAppMessage>(
                    `/api/v1/whatsapp/conversations/${conversationId}/send-template/`,
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

            unsubscribe: (id: number, note = '') =>
                request<AdminWhatsAppContact>(
                    `/api/v1/whatsapp/contacts/${id}/unsubscribe/`,
                    { method: 'POST', body: { note } },
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
        },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Social media hub
    // ═══════════════════════════════════════════════════════════════════════
    social: {
        accounts: {
            list: (signal?: AbortSignal) =>
                request<AdminSocialAccount[]>(
                    '/api/v1/admin/social/accounts/',
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

        posts: {
            listScheduled: (signal?: AbortSignal) =>
                request<AdminSocialScheduledPost[]>(
                    '/api/v1/admin/social/posts/?status=SCHEDULED',
                    { signal },
                ),

            listPublished: (signal?: AbortSignal) =>
                request<AdminSocialPublishedPost[]>(
                    '/api/v1/admin/social/posts/?status=PUBLISHED',
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
                                product_tag: payload.productTag,
                            }),
                            ...(payload.mediaIds !== undefined && {
                                media_ids: payload.mediaIds,
                            }),
                            ...(payload.scheduleAt !== undefined && {
                                schedule_at: payload.scheduleAt,
                            }),
                        },
                    },
                ),

            publishNow: (id: string | number) =>
                request<AdminSocialPostCreated>(
                    `/api/v1/admin/social/posts/${encodeURIComponent(String(id))}/publish/`,
                    { method: 'POST' },
                ),

            remove: (id: string | number) =>
                request<void>(
                    `/api/v1/admin/social/posts/${encodeURIComponent(String(id))}/`,
                    { method: 'DELETE' },
                ),
        },

        media: {
            upload: (file: File, signal?: AbortSignal) =>
                uploadRequest<AdminSocialMedia>(
                    '/api/v1/admin/social/media/upload/',
                    file,
                    'file',
                    signal,
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
        },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Direct Orders (social commerce back-office)
    // ═══════════════════════════════════════════════════════════════════════
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
                    source?: 'whatsapp' | 'admin' | 'phone';
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

            advance: (
                reference: string,
                payload: AdminDirectOrderAdvanceWrite,
            ) =>
                request<AdminDirectOrder>(
                    `/api/v1/dashboard/direct-orders/orders/${encodeURIComponent(reference)}/advance/`,
                    { method: 'POST', body: payload },
                ),
        },

        creators: {
            list: (signal?: AbortSignal) =>
                request<AdminDirectCreator[]>(
                    '/api/v1/dashboard/direct-orders/creators/',
                    { signal },
                ),

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

        content: {
            list: (signal?: AbortSignal) =>
                request<AdminDirectContent[]>(
                    '/api/v1/dashboard/direct-orders/content/',
                    { signal },
                ),

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
            list: (signal?: AbortSignal) =>
                request<AdminDirectLive[]>(
                    '/api/v1/dashboard/direct-orders/lives/',
                    { signal },
                ),

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
            list: (signal?: AbortSignal) =>
                request<AdminDirectProduct[]>(
                    '/api/v1/dashboard/direct-orders/products/',
                    { signal },
                ),

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
    },

    // ═══════════════════════════════════════════════════════════════════════
    // AI & Automations
    // ═══════════════════════════════════════════════════════════════════════
    ai: {
        overview: (signal?: AbortSignal) =>
            request<AdminAIOverview>('/api/admin/ai/overview/', { signal }),

        assistant: {
            conversations: {
                list: async (signal?: AbortSignal): Promise<AdminAIConversation[]> => {
                    const res = await request<
                        AdminAIConversation[] | { results: AdminAIConversation[] }
                    >('/api/admin/ai/conversations/', { signal });
                    return unwrapList(res);
                },

                create: () =>
                    request<AdminAIConversation>(
                        '/api/admin/ai/conversations/',
                        { method: 'POST' },
                    ),

                remove: (id: string) =>
                    request<void>(
                        `/api/admin/ai/conversations/${encodeURIComponent(id)}/`,
                        { method: 'DELETE' },
                    ),
            },

            messages: {
                list: async (
                    conversationId: string,
                    signal?: AbortSignal,
                ): Promise<AdminAIMessage[]> => {
                    const res = await request<
                        AdminAIMessage[] | { results: AdminAIMessage[] }
                    >(
                        `/api/admin/ai/conversations/${encodeURIComponent(conversationId)}/messages/`,
                        { signal },
                    );
                    return unwrapList(res);
                },

                create: (conversationId: string, payload: AdminAIMessageWrite) =>
                    request<AdminAIMessage>(
                        `/api/admin/ai/conversations/${encodeURIComponent(conversationId)}/messages/`,
                        { method: 'POST', body: payload },
                    ),

                stream: streamAssistantReply,
            },
        },

        search: {
            getConfig: (signal?: AbortSignal) =>
                request<AdminAISearchConfig>(
                    '/api/admin/ai/search/config/',
                    { signal },
                ),

            updateConfig: (payload: Partial<AdminAISearchConfigWrite>) =>
                request<AdminAISearchConfig>(
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

            drafts: {
                list: async (
                    filters: { product_id?: string } = {},
                    signal?: AbortSignal,
                ): Promise<AdminAIContentDraft[]> => {
                    const sp = new URLSearchParams();
                    if (filters.product_id) sp.set('product_id', filters.product_id);
                    const qs = sp.toString();
                    const res = await request<
                        AdminAIContentDraft[] | { results: AdminAIContentDraft[] }
                    >(
                        `/api/admin/ai/content/drafts/${qs ? `?${qs}` : ''}`,
                        { signal },
                    );
                    return unwrapList(res);
                },

                create: (payload: AdminAIContentDraftWrite) =>
                    request<AdminAIContentDraft>(
                        '/api/admin/ai/content/drafts/',
                        { method: 'POST', body: payload },
                    ),

                remove: (id: string) =>
                    request<void>(
                        `/api/admin/ai/content/drafts/${encodeURIComponent(id)}/`,
                        { method: 'DELETE' },
                    ),
            },
        },

        automations: {
            list: async (signal?: AbortSignal): Promise<AdminAIAutomation[]> => {
                const res = await request<
                    AdminAIAutomation[] | { results: AdminAIAutomation[] }
                >('/api/admin/ai/automations/', { signal });
                return unwrapList(res);
            },

            detail: (id: string, signal?: AbortSignal) =>
                request<AdminAIAutomation>(
                    `/api/admin/ai/automations/${encodeURIComponent(id)}/`,
                    { signal },
                ),

            create: (payload: AdminAIAutomationWrite) =>
                request<AdminAIAutomation>(
                    '/api/admin/ai/automations/',
                    { method: 'POST', body: payload },
                ),

            update: (id: string, payload: Partial<AdminAIAutomationWrite>) =>
                request<AdminAIAutomation>(
                    `/api/admin/ai/automations/${encodeURIComponent(id)}/`,
                    { method: 'PATCH', body: payload },
                ),

            remove: (id: string) =>
                request<void>(
                    `/api/admin/ai/automations/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),

            setStatus: (id: string, payload: AdminAIAutomationStatusWrite) =>
                request<AdminAIAutomation>(
                    `/api/admin/ai/automations/${encodeURIComponent(id)}/status/`,
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

            dismiss: (id: string) =>
                request<void>(
                    `/api/admin/ai/insights/${encodeURIComponent(id)}/dismiss/`,
                    { method: 'POST' },
                ),

            execute: (id: string) =>
                request<AdminAIInsightExecuteResponse>(
                    `/api/admin/ai/insights/${encodeURIComponent(id)}/execute/`,
                    { method: 'POST' },
                ),
        },

        settings: {
            get: (signal?: AbortSignal) =>
                request<AdminAISettings>(
                    '/api/admin/ai/settings/',
                    { signal },
                ),

            update: (payload: Partial<AdminAISettingsWrite>) =>
                request<AdminAISettings>(
                    '/api/admin/ai/settings/',
                    { method: 'PATCH', body: payload },
                ),

            disable: () =>
                request<{ enabled: boolean }>(
                    '/api/admin/ai/disable/',
                    { method: 'POST' },
                ),
        },

        usage: (signal?: AbortSignal) =>
            request<AdminAIUsage>('/api/admin/ai/usage/', { signal }),
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Users & Roles (staff accounts, roles, permission matrix, invites)
    // ═══════════════════════════════════════════════════════════════════════
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

        /**
         * GET /api/v1/admin/users/me/permissions/
         *
         * Effective module list for the currently authenticated staff
         * member. The sidebar filters its nav items against `modules`
         * to hide pages the caller can't access.
         */
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
            /**
             * GET /api/v1/admin/invites/
             *
             * Admin list of pending invites. The URL intentionally
             * lives at `/admin/invites/` (not nested under `/users/`)
             * so it can grow sibling actions — resend, cancel,
             * duplicate — without colliding with the user resource.
             */
            list: async (signal?: AbortSignal): Promise<AdminStaffInvite[]> => {
                const res = await request<
                    AdminStaffInvite[] | { results: AdminStaffInvite[] }
                >('/api/v1/admin/invites/', { signal });
                return unwrapList(res);
            },

            /**
             * POST /api/v1/admin/invites/
             *
             * Creates the invite and dispatches the email via Celery.
             * Response shape is the created invite — {id, email,
             * name, role, department, status, expires_at} — not a
             * generic `{detail, invite_id}` envelope.
             */
            create: (payload: AdminStaffUserInviteWrite) =>
                request<StaffInviteCreateResponse>(
                    '/api/v1/admin/invites/',
                    { method: 'POST', body: payload },
                ),

            /**
             * DELETE /api/v1/admin/invites/<uuid>/
             *
             * Soft-cancels the invite — the row stays for the audit
             * trail. Id is a UUID, not an integer.
             */
            revoke: (id: string) =>
                request<void>(
                    `/api/v1/admin/invites/${encodeURIComponent(id)}/`,
                    { method: 'DELETE' },
                ),
        },

        publicInvite: {
            /**
             * GET /api/v1/staff-invites/<uuid>/
             *
             * Public — prefills the register page for the invitee.
             * Returns 410 Gone if the invite is expired / cancelled /
             * accepted. Response includes `valid: true` as a sanity
             * flag the frontend can check before showing the form.
             */
            lookup: (token: string, signal?: AbortSignal) =>
                request<StaffInviteLookupResponse>(
                    `/api/v1/staff-invites/${encodeURIComponent(token)}/`,
                    { signal },
                ),

            /**
             * POST /api/v1/staff-invites/<uuid>/accept/
             *
             * Public — creates the User + StaffProfile, logs the new
             * staff member in via session cookie, and returns the
             * redirect target computed from their role.
             *
             * Body: { password, password_confirm } — the token is in
             * the URL, not the payload.
             */
            accept: (token: string, payload: AdminInviteAcceptWrite) =>
                request<StaffInviteAcceptResponse>(
                    `/api/v1/staff-invites/${encodeURIComponent(token)}/accept/`,
                    { method: 'POST', body: payload },
                ),
        },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Settings (store-wide configuration)
    // ═══════════════════════════════════════════════════════════════════════
    settings: {
        /**
         * Flat snapshot of every settings value any admin page might gate
         * on. Backend caches for 5 minutes and auto-invalidates on save.
         *
         * Use this instead of calling each `settings.<section>.get()` on
         * mount — one request, one cache, one source of truth.
         *
         * After a successful write to any settings section, call
         * `adminApi.settings.runtime()` again (or the frontend context's
         * `refresh()`) so every other mounted page picks up the new value.
         */
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

            /**
             * Force-rerun every health check and return the refreshed
             * status rows. Backs the "Refresh status" button on the
             * Integrations tab.
             */
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

            /**
             * Read-only view of eTIMS configuration. Exposes KRA PIN,
             * control unit id, and device serial — never API credentials.
             */
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

    // ═══════════════════════════════════════════════════════════════════════
    // Reports & Analytics
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Analytics (dashboard.analytics)
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // Overview (dashboard.overview)
    // ═══════════════════════════════════════════════════════════════════════
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
};