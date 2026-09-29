// lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────────────────────────────────────
export type Role = 'OWNER' | 'STAFF' | 'CUSTOMER';
export type Status = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface Me {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: Role;
    status: Status;
    is_email_verified: boolean;
    redirect_to: string;
    joined_at?: string;
    default_address?: Address | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout payload — mirrors checkout/serializers.py CheckoutPayloadSerializer
// ─────────────────────────────────────────────────────────────────────────────
export type DeliveryMethod = 'express' | 'standard' | 'pickup';

export interface CheckoutAddressPayload {
    street: string;
    town: string;
    county: string;
    postal_code?: string;
}

/** Item shape AS SENT by the frontend during checkout. `price` is a number. */
export interface CheckoutItemPayload {
    productId?: string;
    name: string;
    brand?: string;
    price: number;
    quantity: number;
    image?: string;
}

export interface CheckoutTotalsPayload {
    subtotal: number;
    discount?: number;
    shipping?: number;
    tax?: number;
    total: number;
}

export interface CheckoutPayload {
    email: string;
    phone: string;
    full_name: string;
    address: CheckoutAddressPayload;
    delivery_method: DeliveryMethod;
    estimated_delivery?: string;
    coupon?: string | null;
    notes?: string | null;
    items: CheckoutItemPayload[];
    totals: CheckoutTotalsPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────────────────────────────────────
export interface Address {
    id: number;
    label: string;
    full_name: string;
    phone: string;
    street: string;
    town: string;
    county: string;
    postal_code: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface AddressInput {
    label: string;
    full_name: string;
    phone: string;
    street: string;
    town: string;
    county: string;
    postal_code?: string;
    is_default?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders (read from checkout.Order via /api/v1/account/orders/)
// ─────────────────────────────────────────────────────────────────────────────
export type OrderStatus =
    | 'pending'
    | 'processing'
    | 'packed'
    | 'shipped'
    | 'delivered'
    | 'cancelled';

export type OrderPaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type OrderPaymentMethod = 'MPESA' | 'COD';

export interface OrderItem {
    id: number;
    product_id: string;
    name: string;
    brand: string;
    price: string;
    quantity: number;
    image: string;
    line_total: string;
}

export interface OrderStatusEvent {
    status: string;
    note: string;
    created_at: string;
}

export interface OrderListRow {
    id: string;
    reference: string;
    status: OrderStatus;
    payment_status: OrderPaymentStatus;
    total: string;
    item_count: number;
    created_at: string;
}

export interface OrderDetail {
    id: string;
    reference: string;
    status: OrderStatus;
    payment_status: OrderPaymentStatus;
    payment_method: OrderPaymentMethod;
    payment_reference: string;
    mpesa_receipt: string;
    email: string;
    phone: string;
    full_name: string;
    address_street: string;
    address_town: string;
    address_county: string;
    address_postal_code: string;
    delivery_method: DeliveryMethod;
    estimated_delivery: string;
    courier: string;
    tracking_number: string;
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;
    coupon: string;
    notes: string;
    items: OrderItem[];
    timeline: OrderStatusEvent[];
    created_at: string;
    updated_at: string;
    paid_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────
export type NotificationType =
    | 'order'
    | 'shipping'
    | 'promo'
    | 'security'
    | 'system';

export interface NotificationRow {
    id: number;
    type: NotificationType;
    title: string;
    body: string;
    href: string;
    metadata: Record<string, unknown>;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile / preferences (settings page)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    whatsapp_updates: boolean;
    email_promotions: boolean;
    sms_promotions: boolean;
    newsletter: boolean;
    deletion_requested_at: string | null;
    joined_at: string;
}

export interface ProfileUpdateInput {
    first_name?: string;
    last_name?: string;
    phone?: string;
}

export interface PreferencesInput {
    whatsapp_updates?: boolean;
    email_promotions?: boolean;
    sms_promotions?: boolean;
    newsletter?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────
export type ReviewStatus = 'published' | 'pending' | 'rejected';

export interface ReviewProductSnapshot {
    id: string;
    name: string;
    slug: string;
    image: string;
    brand: string;
}

export interface ReviewRow {
    id: number;
    product: ReviewProductSnapshot;
    variant_label: string;
    rating: number;
    title: string;
    body: string;
    images: string[];
    status: ReviewStatus;
    rejection_reason: string;
    is_verified_purchase: boolean;
    created_at: string;
    updated_at: string;
    moderated_at: string | null;
}

export interface ReviewWriteInput {
    product_id?: string;
    product_name?: string;
    product_slug?: string;
    product_image?: string;
    product_brand?: string;
    variant_label?: string;
    rating: number;
    title?: string;
    body: string;
    images?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist
// ─────────────────────────────────────────────────────────────────────────────
export type WishlistStock = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface WishlistProductSnapshot {
    id: string;
    name: string;
    slug: string;
    brand: string;
    image: string;
    rating: string;
    review_count: number;
}

export interface WishlistRow {
    id: number;
    added_at: string;
    variant_id: string;
    variant_name: string;
    variant_image: string;
    unit_price: string;
    compare_at_price: string | null;
    stock: WishlistStock;
    stock_count: number;
    discount_percent: number;
    product: WishlistProductSnapshot;
}

export interface WishlistAddInput {
    product_id: string;
    variant_id: string;
    product_name: string;
    product_slug?: string;
    product_brand?: string;
    product_image?: string;
    variant_name?: string;
    variant_image?: string;
    unit_price: number;
    compare_at_price?: number | null;
}

export interface WishlistCheckResult {
    in_wishlist: boolean;
    wishlist_item_id: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment — mirrors checkout/serializers.py PaymentSerializer
// ─────────────────────────────────────────────────────────────────────────────
export type PaymentStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'SUCCESS'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMEOUT';

/**
 * Item shape AS STORED in a snapshot. DRF serializes `DecimalField` as a
 * string, so `price` here is a string — unlike `CheckoutItemPayload` where
 * the frontend sends it as a number.
 */
export interface PaymentSnapshotItem {
    productId?: string;
    name: string;
    brand?: string;
    price: string;
    quantity: number;
    image?: string;
}

export interface PaymentSnapshot {
    email: string;
    phone: string;
    full_name: string;
    address_street: string;
    address_town: string;
    address_county: string;
    address_postal_code: string;
    delivery_method: DeliveryMethod;
    estimated_delivery: string;
    coupon: string | null;
    notes: string | null;
    items: PaymentSnapshotItem[];
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;
}

export interface Payment {
    id: string;
    status: PaymentStatus;
    amount: string;
    phone_number: string;
    order_reference: string;
    user: number | null;
    snapshot: PaymentSnapshot | null;
    result_code: number | null;
    result_description: string;
    mpesa_receipt_number: string;
    created_at: string;
    updated_at: string;

    currency?: string;
    checkout_request_id?: string | null;
    merchant_request_id?: string | null;
    paid_at?: string | null;
}

export interface StkPushPayload {
    order_reference: string;
    amount: number;
    phone_number: string;
    metadata?: Record<string, string>;
    checkout: CheckoutPayload;
    password?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout config / coupon
// ─────────────────────────────────────────────────────────────────────────────
export interface CheckoutConfig {
    counties: string[];
    delivery_fees: Record<DeliveryMethod, string>;
    free_delivery_threshold: string;
    tax_rate: string;
}

export interface CouponValidateResult {
    valid: boolean;
    code?: string;
    percent_off?: string;
    message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────
export class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(status: number, data: unknown) {
        super(
            typeof data === 'object' &&
                data &&
                'detail' in (data as Record<string, unknown>)
                ? String((data as { detail: unknown }).detail)
                : `Request failed with status ${status}`,
        );
        this.status = status;
        this.data = data;
        this.name = 'ApiError';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRF
// ─────────────────────────────────────────────────────────────────────────────
function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

let csrfReady: Promise<void> | null = null;

export async function ensureCsrf(): Promise<void> {
    if (csrfReady) return csrfReady;
    csrfReady = (async () => {
        await fetch(`${API_BASE}/api/v1/auth/csrf/`, {
            method: 'GET',
            credentials: 'include',
        });
    })();
    return csrfReady;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core request helper
// ─────────────────────────────────────────────────────────────────────────────
export type HttpMethod =
    | 'GET'
    | 'HEAD'
    | 'OPTIONS'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE';

export type RequestOptions = {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
};

const SAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function request<T>(
    path: string,
    opts: RequestOptions = {},
): Promise<T> {
    const method: HttpMethod = opts.method ?? 'GET';
    const isUnsafe = !SAFE_METHODS.has(method);

    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(opts.headers ?? {}),
    };

    let body: BodyInit | undefined;

    if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(opts.body);
    }

    if (isUnsafe) {
        await ensureCsrf();
        const token = readCookie('csrftoken');
        if (token) headers['X-CSRFToken'] = token;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body,
        credentials: 'include',
        signal: opts.signal,
    });

    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : await res.text();

    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth endpoints — /api/v1/auth/*
// ─────────────────────────────────────────────────────────────────────────────
export const api = {
    me: async (): Promise<Me | null> => {
        try {
            return await request<Me>('/api/v1/auth/me/');
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                return null;
            }
            throw err;
        }
    },

    login: (email: string, password: string, remember = false) =>
        request<{ user: Me; redirect_to: string }>('/api/v1/auth/login/', {
            method: 'POST',
            body: { email, password, remember },
        }),

    logout: () =>
        request<void>('/api/v1/auth/logout/', { method: 'POST' }),

    changePassword: (currentPassword: string, newPassword: string) =>
        request<{ detail: string }>('/api/v1/auth/change-password/', {
            method: 'POST',
            body: {
                current_password: currentPassword,
                new_password: newPassword,
            },
        }),

    forgotPassword: (email: string) =>
        request<{ detail: string }>('/api/v1/auth/forgot-password/', {
            method: 'POST',
            body: { email },
        }),

    resetPassword: (uid: string, token: string, new_password: string) =>
        request<{ detail: string }>('/api/v1/auth/reset-password/', {
            method: 'POST',
            body: { uid, token, new_password },
        }),

    googleLoginUrl: () => `${API_BASE}/api/v1/auth/google/`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Checkout endpoints — /api/v1/checkout/*
// ─────────────────────────────────────────────────────────────────────────────
export const checkoutApi = {
    config: (signal?: AbortSignal) =>
        request<CheckoutConfig>('/api/v1/checkout/config/', { signal }),

    validateCoupon: (code: string, subtotal: number) =>
        request<CouponValidateResult>(
            '/api/v1/checkout/validate-coupon/',
            { method: 'POST', body: { code, subtotal } },
        ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Payments endpoints — /api/v1/checkout/payments/*
// ─────────────────────────────────────────────────────────────────────────────
export const paymentsApi = {
    stkPush: (payload: StkPushPayload, idempotencyKey: string) =>
        request<Payment>('/api/v1/checkout/payments/stk-push/', {
            method: 'POST',
            body: payload,
            headers: { 'Idempotency-Key': idempotencyKey },
        }),

    detail: (id: string, signal?: AbortSignal) =>
        request<Payment>(`/api/v1/checkout/payments/${id}/`, { signal }),

    byReference: (orderReference: string, signal?: AbortSignal) =>
        request<Payment>(
            `/api/v1/checkout/payments/by-reference/${encodeURIComponent(orderReference)}/`,
            { signal },
        ),

    cancel: (id: string) =>
        request<void>(`/api/v1/checkout/payments/${id}/cancel/`, {
            method: 'POST',
        }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Account endpoints — /api/v1/account/*
// ─────────────────────────────────────────────────────────────────────────────
export const accountApi = {
    // ── Overview ──
    overview: (signal?: AbortSignal) =>
        request<{
            user: {
                id: number;
                email: string;
                first_name: string;
                last_name: string;
                joined_at: string | null;
            };
            default_address: Address | null;
            stats: {
                total_orders: number;
                in_transit: number;
                wishlist_count: number;
                unread_notifications: number;
            };
            recent_orders: {
                id: string;
                date: string;
                status: string;
                itemCount: number;
                total: string;
            }[];
        }>('/api/v1/account/overview/', { signal }),

    // ── Orders ──
    orders: {
        list: (signal?: AbortSignal) =>
            request<OrderListRow[]>('/api/v1/account/orders/', { signal }),

        detail: (reference: string, signal?: AbortSignal) =>
            request<OrderDetail>(
                `/api/v1/account/orders/${encodeURIComponent(reference)}/`,
                { signal },
            ),
    },

    // ── Addresses ──
    addresses: {
        list: (signal?: AbortSignal) =>
            request<Address[]>('/api/v1/account/addresses/', { signal }),

        create: (payload: AddressInput) =>
            request<Address>('/api/v1/account/addresses/', {
                method: 'POST',
                body: payload,
            }),

        detail: (id: number, signal?: AbortSignal) =>
            request<Address>(`/api/v1/account/addresses/${id}/`, { signal }),

        update: (id: number, payload: Partial<AddressInput>) =>
            request<Address>(`/api/v1/account/addresses/${id}/`, {
                method: 'PATCH',
                body: payload,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/account/addresses/${id}/`, {
                method: 'DELETE',
            }),

        setDefault: (id: number) =>
            request<Address>(`/api/v1/account/addresses/${id}/default/`, {
                method: 'POST',
            }),
    },

    // ── Notifications ──
    notifications: {
        list: (signal?: AbortSignal) =>
            request<NotificationRow[]>('/api/v1/account/notifications/', {
                signal,
            }),

        markRead: (id: number) =>
            request<NotificationRow>(
                `/api/v1/account/notifications/${id}/`,
                { method: 'PATCH' },
            ),

        remove: (id: number) =>
            request<void>(`/api/v1/account/notifications/${id}/`, {
                method: 'DELETE',
            }),

        markAllRead: () =>
            request<{ marked_read: number }>(
                '/api/v1/account/notifications/read-all/',
                { method: 'POST' },
            ),

        clearAll: () =>
            request<{ deleted: number }>(
                '/api/v1/account/notifications/',
                { method: 'DELETE' },
            ),

        unreadCount: (signal?: AbortSignal) =>
            request<{ unread: number }>(
                '/api/v1/account/notifications/unread-count/',
                { signal },
            ),
    },

    // ── Profile / settings ──
    profile: {
        get: (signal?: AbortSignal) =>
            request<ProfileData>('/api/v1/account/profile/', { signal }),

        update: (payload: ProfileUpdateInput) =>
            request<ProfileData>('/api/v1/account/profile/', {
                method: 'PATCH',
                body: payload,
            }),

        getPreferences: (signal?: AbortSignal) =>
            request<PreferencesInput>(
                '/api/v1/account/profile/preferences/',
                { signal },
            ),

        updatePreferences: (payload: PreferencesInput) =>
            request<PreferencesInput>(
                '/api/v1/account/profile/preferences/',
                { method: 'PATCH', body: payload },
            ),

        delete: () =>
            request<void>('/api/v1/account/profile/delete/', {
                method: 'POST',
                body: { confirm: 'DELETE' },
            }),
    },

    // ── Reviews ──
    reviews: {
        list: (signal?: AbortSignal) =>
            request<ReviewRow[]>('/api/v1/account/reviews/', { signal }),

        create: (payload: ReviewWriteInput) =>
            request<ReviewRow>('/api/v1/account/reviews/', {
                method: 'POST',
                body: payload,
            }),

        detail: (id: number, signal?: AbortSignal) =>
            request<ReviewRow>(`/api/v1/account/reviews/${id}/`, { signal }),

        update: (id: number, payload: Partial<ReviewWriteInput>) =>
            request<ReviewRow>(`/api/v1/account/reviews/${id}/`, {
                method: 'PATCH',
                body: payload,
            }),

        remove: (id: number) =>
            request<void>(`/api/v1/account/reviews/${id}/`, {
                method: 'DELETE',
            }),
    },

    // ── Wishlist ──
    wishlist: {
        list: (signal?: AbortSignal) =>
            request<WishlistRow[]>('/api/v1/account/wishlist/', { signal }),

        add: (payload: WishlistAddInput) =>
            request<WishlistRow>('/api/v1/account/wishlist/', {
                method: 'POST',
                body: payload,
            }),

        check: (variantId: string, signal?: AbortSignal) =>
            request<WishlistCheckResult>(
                `/api/v1/account/wishlist/check/?variant_id=${encodeURIComponent(variantId)}`,
                { signal },
            ),

        remove: (id: number) =>
            request<void>(`/api/v1/account/wishlist/${id}/`, {
                method: 'DELETE',
            }),

        removeByVariant: (variantId: string) =>
            request<void>(
                `/api/v1/account/wishlist/by-variant/${encodeURIComponent(variantId)}/`,
                { method: 'DELETE' },
            ),

        clearAll: () =>
            request<{ deleted: number }>(
                '/api/v1/account/wishlist/clear/',
                { method: 'DELETE' },
            ),
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Polling helper — waits for a payment to reach a terminal state
// ─────────────────────────────────────────────────────────────────────────────
const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set([
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'TIMEOUT',
]);

export interface PollPaymentOptions {
    signal?: AbortSignal;
    onPoll?: (payment: Payment) => void;
    intervalMs?: number;
    timeoutMs?: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        if (!signal) return;
        const onAbort = () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export async function pollPayment(
    paymentId: string,
    options: PollPaymentOptions = {},
): Promise<Payment> {
    const {
        signal,
        onPoll,
        intervalMs = 3000,
        timeoutMs = 180_000,
    } = options;

    const startedAt = Date.now();
    let last: Payment | null = null;

    while (true) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        try {
            last = await paymentsApi.detail(paymentId, signal);
            onPoll?.(last);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw err;
            }
            // Transient network blip — keep polling until timeout.
        }

        if (last && TERMINAL_PAYMENT_STATUSES.has(last.status)) {
            return last;
        }

        if (Date.now() - startedAt >= timeoutMs) {
            throw new ApiError(408, {
                detail: 'Timed out waiting for payment confirmation.',
            });
        }

        await sleep(intervalMs, signal);
    }
}