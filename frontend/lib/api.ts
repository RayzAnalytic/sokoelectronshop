// lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

// ─────────────────────────────────────────────────────────────
// TOKEN STORAGE
// ─────────────────────────────────────────────────────────────

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user';

export const tokenStore = {
    getAccess(): string | null {
        if (typeof window === 'undefined') return null;
        return (
            localStorage.getItem(ACCESS_KEY) ??
            sessionStorage.getItem(ACCESS_KEY)
        );
    },
    getRefresh(): string | null {
        if (typeof window === 'undefined') return null;
        return (
            localStorage.getItem(REFRESH_KEY) ??
            sessionStorage.getItem(REFRESH_KEY)
        );
    },
    getUser<T = any>(): T | null {
        if (typeof window === 'undefined') return null;
        const raw =
            localStorage.getItem(USER_KEY) ??
            sessionStorage.getItem(USER_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },
    set(access: string, refresh: string, user: unknown, persistent = true) {
        if (typeof window === 'undefined') return;

        const primary = persistent ? localStorage : sessionStorage;
        const other = persistent ? sessionStorage : localStorage;

        other.removeItem(ACCESS_KEY);
        other.removeItem(REFRESH_KEY);
        other.removeItem(USER_KEY);

        primary.setItem(ACCESS_KEY, access);
        primary.setItem(REFRESH_KEY, refresh);
        primary.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() {
        if (typeof window === 'undefined') return;
        [localStorage, sessionStorage].forEach((store) => {
            store.removeItem(ACCESS_KEY);
            store.removeItem(REFRESH_KEY);
            store.removeItem(USER_KEY);
        });
    },
    isAuthenticated(): boolean {
        return Boolean(tokenStore.getAccess());
    },
};

// ─────────────────────────────────────────────────────────────
// ERROR TYPE
// ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
    status: number;
    data: any;

    constructor(message: string, status: number, data: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }

    fieldErrors(): Record<string, string> {
        const out: Record<string, string> = {};
        if (!this.data || typeof this.data !== 'object') return out;
        for (const key of Object.keys(this.data)) {
            const raw = (this.data as any)[key];
            const msg = Array.isArray(raw) ? raw[0] : String(raw);
            if (
                key === 'non_field_errors' ||
                key === 'detail' ||
                key === 'error'
            ) {
                continue;
            }
            out[key] = msg;
        }
        return out;
    }

    nonFieldError(): string | null {
        const d = this.data;
        if (!d || typeof d !== 'object') return null;
        const nfe = d.non_field_errors;
        if (Array.isArray(nfe) && nfe[0]) return nfe[0];
        if (typeof nfe === 'string') return nfe;
        if (typeof d.detail === 'string') return d.detail;
        if (typeof d.error === 'string') return d.error;
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// TOKEN REFRESH
// ─────────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
    const refresh = tokenStore.getRefresh();
    if (!refresh) throw new ApiError('No refresh token', 401, null);

    const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
        tokenStore.clear();
        throw new ApiError('Session expired', 401, null);
    }

    const data = await res.json();
    const access = data.access as string;
    const newRefresh = (data.refresh as string) ?? refresh;
    const user = tokenStore.getUser();

    const persistent =
        typeof window !== 'undefined' &&
        localStorage.getItem(ACCESS_KEY) !== null;

    tokenStore.set(access, newRefresh, user, persistent);

    return access;
}

// ─────────────────────────────────────────────────────────────
// CORE FETCH WRAPPER
// ─────────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, 'body'> & {
    body?: unknown;
    skipAuth?: boolean;
    skipRefresh?: boolean;
    raw?: boolean;
};

async function request<T = any>(
    path: string,
    options: RequestOptions = {}
): Promise<T> {
    const {
        body,
        skipAuth = false,
        skipRefresh = false,
        raw = false,
        headers: customHeaders,
        ...rest
    } = options;

    const headers = new Headers(customHeaders as HeadersInit | undefined);
    headers.set('Accept', 'application/json');

    if (body !== undefined && !(body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    if (!skipAuth) {
        const access = tokenStore.getAccess();
        if (access) headers.set('Authorization', `Bearer ${access}`);
    }

    const init: RequestInit = {
        ...rest,
        headers,
        body:
            body === undefined
                ? undefined
                : body instanceof FormData
                    ? body
                    : JSON.stringify(body),
    };

    const res = await fetch(`${API_URL}${path}`, init);

    if (res.status === 401 && !skipRefresh && !skipAuth) {
        try {
            if (!refreshPromise) {
                refreshPromise = refreshAccessToken().finally(() => {
                    refreshPromise = null;
                });
            }
            const newAccess = await refreshPromise;
            headers.set('Authorization', `Bearer ${newAccess}`);
            const retry = await fetch(`${API_URL}${path}`, {
                ...init,
                headers,
            });

            if (retry.status === 204) return null as T;
            if (raw) return retry as unknown as T;

            const retryData = await retry.json().catch(() => null);
            if (!retry.ok) {
                throw new ApiError(
                    retryData?.detail ??
                    retryData?.error ??
                    retryData?.non_field_errors?.[0] ??
                    'Request failed',
                    retry.status,
                    retryData
                );
            }
            return retryData as T;
        } catch {
            tokenStore.clear();
            if (typeof window !== 'undefined') {
                window.location.href = '/auth/login';
            }
            throw new ApiError('Session expired', 401, null);
        }
    }

    if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        const data = await res.json().catch(() => null);
        throw new ApiError(
            data?.detail ??
            `Too many requests. Please wait ${seconds} seconds and try again.`,
            429,
            data
        );
    }

    if (res.status === 204) return null as T;
    if (raw) return res as unknown as T;

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message =
            data?.detail ??
            data?.error ??
            data?.non_field_errors?.[0] ??
            `Request failed with status ${res.status}`;
        throw new ApiError(message, res.status, data);
    }

    return data as T;
}

// ─────────────────────────────────────────────────────────────
// HTTP VERBS
// ─────────────────────────────────────────────────────────────

export const api = {
    get: <T = any>(path: string, options?: RequestOptions) =>
        request<T>(path, { ...options, method: 'GET' }),

    post: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
        request<T>(path, { ...options, method: 'POST', body }),

    put: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
        request<T>(path, { ...options, method: 'PUT', body }),

    patch: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
        request<T>(path, { ...options, method: 'PATCH', body }),

    delete: <T = any>(path: string, options?: RequestOptions) =>
        request<T>(path, { ...options, method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────

export type AuthUser = {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: 'ADMIN' | 'MANAGER' | 'CUSTOMER';
    phone_number?: string;
    profile_picture?: string | null;
    email_verified: boolean;
    date_joined: string;
};

type AuthResponse = {
    access: string;
    refresh: string;
    user: AuthUser;
};

export const auth = {
    register: async (payload: {
        fullName: string;
        email: string;
        phone: string;
        password: string;
        confirmPassword: string;
        termsAccepted: boolean;
    }): Promise<AuthResponse> => {
        const data = await api.post<AuthResponse>(
            '/api/auth/register/',
            payload,
            { skipAuth: true, skipRefresh: true }
        );
        tokenStore.set(data.access, data.refresh, data.user, true);
        return data;
    },

    login: async (
        payload: { email: string; password: string },
        persistent = true
    ): Promise<AuthResponse> => {
        const data = await api.post<AuthResponse>(
            '/api/auth/login/',
            payload,
            { skipAuth: true, skipRefresh: true }
        );
        tokenStore.set(data.access, data.refresh, data.user, persistent);
        return data;
    },
    loginWithGoogle: async (
        accessToken: string,
        persistent = true
    ): Promise<AuthResponse> => {
        const data = await api.post<AuthResponse>(
            '/api/auth/google/',
            { access_token: accessToken },      // ← was { id_token: accessToken }
            { skipAuth: true, skipRefresh: true }
        );
        tokenStore.set(data.access, data.refresh, data.user, persistent);
        return data;
    },

    logout: async (): Promise<void> => {
        const refresh = tokenStore.getRefresh();
        try {
            await api.post('/api/auth/logout/', { refresh });
        } catch {
            // Ignore
        } finally {
            tokenStore.clear();
        }
    },

    me: (): Promise<AuthUser> => api.get<AuthUser>('/api/auth/me/'),

    isAuthenticated: () => tokenStore.isAuthenticated(),
    getUser: () => tokenStore.getUser<AuthUser>(),
};

// ─────────────────────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────────────────────

export const password = {
    requestReset: async (email: string): Promise<{ detail: string }> => {
        return api.post<{ detail: string }>(
            '/api/auth/password/reset/',
            { email: email.trim().toLowerCase() },
            { skipAuth: true, skipRefresh: true }
        );
    },

    validateToken: async (
        token: string
    ): Promise<{ valid: boolean; email?: string }> => {
        return api.get<{ valid: boolean; email?: string }>(
            `/api/auth/password/reset/validate/?token=${encodeURIComponent(token)}`,
            { skipAuth: true, skipRefresh: true }
        );
    },

    confirmReset: async (payload: {
        token: string;
        password: string;
        confirmPassword: string;
    }): Promise<{ detail: string }> => {
        return api.post<{ detail: string }>(
            '/api/auth/password/reset/confirm/',
            {
                token: payload.token,
                password: payload.password,
                confirm_password: payload.confirmPassword,
            },
            { skipAuth: true, skipRefresh: true }
        );
    },
};

// ─────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────

export type PaymentStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | 'REFUNDED';

export type PaymentGateway = 'DUSUPAY' | 'PESAPAL' | 'MPESA';

export type Payment = {
    id: string;
    order_reference: string;
    amount: string;
    currency: string;
    gateway: PaymentGateway;
    status: PaymentStatus;
    description: string;
    payment_url: string;
    internal_reference: string;
    gateway_reference: string;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
};

export type DusupayInitiatePayload = {
    amount: number | string;
    currency?: string;
    provider_code: string;
    transaction_method?: 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER';
    msisdn?: string;
    customer_email?: string;
    customer_name?: string;
    description: string;
    redirect_url: string;
    order_reference: string;
};

export type PesapalInitiatePayload = {
    amount: number | string;
    currency?: string;
    description: string;
    order_reference: string;
    email_address: string;
    phone_number: string;
    country_code?: string;
    first_name: string;
    last_name: string;
    callback_url: string;
    cancellation_url?: string;
};

export type MpesaInitiatePayload = {
    amount: number | string;
    phone_number: string;
    order_reference: string;
    description?: string;
};

export const payments = {
    initiateDusupay: (payload: DusupayInitiatePayload): Promise<Payment> =>
        api.post<Payment>('/api/payments/dusupay/initiate/', payload),

    initiatePesapal: (payload: PesapalInitiatePayload): Promise<Payment> =>
        api.post<Payment>('/api/payments/pesapal/initiate/', payload),

    initiateMpesa: (payload: MpesaInitiatePayload): Promise<Payment> =>
        api.post<Payment>('/api/payments/mpesa/initiate/', payload),

    get: (id: string): Promise<Payment> =>
        api.get<Payment>(`/api/payments/${id}/`),

    list: (params?: { gateway?: PaymentGateway; status?: PaymentStatus }) => {
        const qs = new URLSearchParams();
        if (params?.gateway) qs.set('gateway', params.gateway);
        if (params?.status) qs.set('status', params.status);
        const query = qs.toString();
        return api.get<{ results: Payment[] } | Payment[]>(
            `/api/payments/${query ? `?${query}` : ''}`
        );
    },
};

// ─────────────────────────────────────────────────────────────
// SOCIAL MEDIA
// ─────────────────────────────────────────────────────────────

export type SocialPlatform =
    | 'YOUTUBE'
    | 'FACEBOOK'
    | 'INSTAGRAM'
    | 'X'
    | 'TIKTOK_SHOP';

export type SocialAccount = {
    id: string;
    platform: SocialPlatform;
    username: string;
    is_active: boolean;
    shop_cipher?: string;
};

export type YouTubeVideo = {
    videoId: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
};

export type FacebookPostResponse = { id: string };

export type InstagramMedia = {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    permalink: string;
    timestamp: string;
};

export type TweetResponse = {
    data: { id: string; text: string };
};

export type TikTokAuthorizeResponse = { authorization_url: string };

export type TikTokCallbackResponse = {
    detail: string;
    shop_cipher: string;
    linked_to_user: boolean;
};

export type TikTokProduct = {
    id: string;
    title: string;
    description?: string;
    status?: string;
    skus?: Array<{
        id: string;
        seller_sku?: string;
        price?: {
            sale_price: string;
            original_price?: string;
            currency: string;
        };
        inventory?: Array<{
            quantity: number;
            warehouse_id?: string;
        }>;
    }>;
};

export type TikTokProductListResponse = {
    data?: {
        products?: TikTokProduct[];
        next_page_token?: string;
        total_count?: number;
    };
    code?: number;
    message?: string;
};

export const social = {
    listAccounts: (): Promise<SocialAccount[]> =>
        api.get<SocialAccount[]>('/api/social/accounts/'),

    searchYouTube: (query: string): Promise<{ items: YouTubeVideo[] }> =>
        api.get<{ items: YouTubeVideo[] }>(
            `/api/social/youtube/search/?q=${encodeURIComponent(query)}`
        ),

    postToFacebook: (
        message: string,
        link?: string
    ): Promise<FacebookPostResponse> =>
        api.post<FacebookPostResponse>('/api/social/facebook/post/', {
            message,
            ...(link ? { link } : {}),
        }),

    listInstagramMedia: (): Promise<{ data: InstagramMedia[] }> =>
        api.get<{ data: InstagramMedia[] }>('/api/social/instagram/media/'),

    postTweet: (text: string): Promise<TweetResponse> =>
        api.post<TweetResponse>('/api/social/twitter/tweet/', { text }),

    tiktokAuthorize: (): Promise<TikTokAuthorizeResponse> =>
        api.get<TikTokAuthorizeResponse>('/api/social/tiktok/authorize/'),

    tiktokProducts: (): Promise<TikTokProductListResponse> =>
        api.get<TikTokProductListResponse>('/api/social/tiktok/products/'),
};

// ─────────────────────────────────────────────────────────────
// WHATSAPP
// ─────────────────────────────────────────────────────────────

export type WhatsAppDirection = 'INBOUND' | 'OUTBOUND';

export type WhatsAppStatus =
    | 'PENDING'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'FAILED';

export type WhatsAppMessage = {
    id: string;
    wa_message_id: string;
    direction: WhatsAppDirection;
    from_number: string;
    to_number: string;
    body: string;
    status: WhatsAppStatus;
    created_at: string;
    updated_at: string;
};

export type WhatsAppSendResponse = {
    messaging_product: 'whatsapp';
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string; message_status?: string }>;
};

export type WhatsAppTemplatePayload = {
    to: string;
    template_name: string;
    language?: string;
    components?: Array<Record<string, any>>;
};

export const whatsapp = {
    sendText: (to: string, text: string): Promise<WhatsAppSendResponse> =>
        api.post<WhatsAppSendResponse>('/api/whatsapp/send/', { to, text }),

    sendTemplate: (
        payload: WhatsAppTemplatePayload
    ): Promise<WhatsAppSendResponse> =>
        api.post<WhatsAppSendResponse>('/api/whatsapp/send/', {
            to: payload.to,
            template_name: payload.template_name,
            language: payload.language ?? 'en_US',
            components: payload.components ?? [],
        }),

    listMessages: (params?: {
        direction?: WhatsAppDirection;
        status?: WhatsAppStatus;
    }) => {
        const qs = new URLSearchParams();
        if (params?.direction) qs.set('direction', params.direction);
        if (params?.status) qs.set('status', params.status);
        const query = qs.toString();
        return api.get<{ results: WhatsAppMessage[] } | WhatsAppMessage[]>(
            `/api/whatsapp/messages/${query ? `?${query}` : ''}`
        );
    },

    getMessage: (id: string): Promise<WhatsAppMessage> =>
        api.get<WhatsAppMessage>(`/api/whatsapp/messages/${id}/`),
};

// ─────────────────────────────────────────────────────────────
// ONBOARDING — 12-step setup flow
// ─────────────────────────────────────────────────────────────

export type OnboardingStatus =
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED';

export type OnboardingProgress = {
    id: string;
    current_step: number;
    completed_steps: number[];
    step_data: Record<string, unknown>;
    status: OnboardingStatus;
    started_at: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    review_notes: string;
    completed_count: number;
    percent_complete: number;
    created_at: string;
    updated_at: string;
};

export type OnboardingStepMeta = {
    key: string;
    title: string;
    description: string;
    optional: boolean;
};

export type OnboardingStepsResponse = {
    total_steps: number;
    steps: Record<string, OnboardingStepMeta>;
};

// ── Step 1 — Account ──
export type Step1AccountPayload = {
    fullName: string;
    email: string;
    phone: string;
    role: 'Owner' | 'Manager' | 'Staff';
    password?: string;
    confirm?: string;
    agreed: boolean;
};

export type Step1AccountResponse = {
    fullName: string;
    email: string;
    phone: string;
    role: string;
};

// ── Step 2 — Store Profile ──
export type Step2StoreResponse = {
    name: string;
    tagline: string;
    description: string;
    logo: string | null;
    street: string;
    town: string;
    county: string;
    postal_code: string;
    support_email: string;
    support_phone: string;
};

export type Step2StorePayload = {
    name: string;
    tagline?: string;
    description?: string;
    logo?: File | null;
    street?: string;
    town?: string;
    county?: string;
    postal_code?: string;
    support_email?: string;
    support_phone?: string;
};

// ── Step 3 — Business & Tax ──
export type BusinessType = 'sole' | 'ltd' | 'partner' | 'none';
export type ETimsEnv = 'sandbox' | 'production';

export type Step3BusinessResponse = {
    type: BusinessType;
    kra_pin: string;
    reg_number: string;
    vat_registered: boolean;
    vat_number: string;
    etims_enabled: boolean;
    etims_device_id: string;
    etims_pin: string;
    etims_env: ETimsEnv;
    invoice_footer: string;
};

export type Step3BusinessPayload = {
    type: BusinessType;
    kra_pin?: string;
    reg_number?: string;
    vat_registered?: boolean;
    vat_number?: string;
    etims_enabled?: boolean;
    etims_device_id?: string;
    etims_pin?: string;
    etims_api_key?: string;
    etims_env?: ETimsEnv;
    invoice_footer?: string;
};

export type Step3ETimsTestPayload = {
    device_id: string;
    pin: string;
    api_key: string;
    env: ETimsEnv;
};

export type Step3ETimsTestResponse = {
    ok: boolean;
    detail: string;
};

// ── Step 4 — Payments (M-Pesa only) ──
export type PaymentEnv = 'sandbox' | 'production';

export type Step4Mpesa = {
    consumer_key: string;
    consumer_secret: string;
    passkey: string;
    shortcode: string;
    env: PaymentEnv;
};

export type Step4PaymentsResponse = {
    mpesa_enabled: boolean;
    mpesa: Step4Mpesa;
};

export type Step4PaymentsPayload = {
    mpesa_enabled: boolean;
    mpesa?: Partial<Step4Mpesa>;
};

export type Step4TestPayload = {
    credentials: Record<string, unknown>;
};

export type Step4TestResponse = {
    ok: boolean;
    detail: string;
};

// ── Step 5 — WhatsApp ──
export type Step5WhatsAppResponse = {
    number: string;
    verified: boolean;
    verified_at: string | null;
    template: string;
    new_order_alert: boolean;
    auto_reply: boolean;
};

export type Step5WhatsAppPayload = {
    number: string;
    template?: string;
    new_order_alert?: boolean;
    auto_reply?: boolean;
};

export type Step5VerifyPayload = {
    number: string;
    otp: string;
};

export type Step5VerifyResponse = {
    ok: boolean;
    detail: string;
};

export type Step5SendTestPayload = {
    template?: string;
    sample_data?: Record<string, string>;
};

export type Step5SendTestResponse = {
    ok: boolean;
    detail: string;
    rendered?: string;
};

// ── Step 6 — Shipping ──
export type ShippingPreset = 'national' | 'nairobi' | 'custom';

export type Step6Rate = {
    id?: string;
    method: string;
    price: string;
    eta: string;
};

export type Step6Zone = {
    id?: string;
    name: string;
    counties: string[];
    rates: Step6Rate[];
};

export type Step6ShippingResponse = {
    preset: ShippingPreset;
    zones: Step6Zone[];
    free_shipping_enabled: boolean;
    free_shipping_threshold: string | null;
};

export type Step6ShippingPayload = {
    preset: ShippingPreset;
    zones: Array<{
        name: string;
        counties: string[];
        rates: Array<{
            method: string;
            price: string;
            eta: string;
        }>;
    }>;
    free_shipping_enabled: boolean;
    free_shipping_threshold?: string;
};

// ── Step 7 — First Categories ──
export type Step7CategoryItem = {
    id?: string;
    name: string;
    slug: string;
    description: string;
    image?: string | null;
};

export type Step7CategoriesResponse = {
    categories: Step7CategoryItem[];
};

export type Step7CategoriesPayload = {
    categories: Array<{
        name: string;
        slug: string;
        description: string;
        image?: File | null;
    }>;
};

export type Step7CategoriesSubmitResponse = {
    created: Step7CategoryItem[];
    progress: OnboardingProgress;
};

// ── Step 8 — First Products ──
export type Step8ProductImage = {
    id: string;
    url: string;
    order: number;
};

export type Step8ProductItem = {
    id?: string;
    name: string;
    slug?: string;
    short_description: string;
    price: string;
    sale_price: string | null;
    sku: string;
    stock: number;
    category?: string | null;
    category_name?: string;
    images: Step8ProductImage[];
};

export type Step8ProductsResponse = {
    products: Step8ProductItem[];
};

export type Step8ProductsPayload = {
    products: Array<{
        name: string;
        category: string;
        price: string;
        sale_price?: string;
        stock: number;
        sku?: string;
        short_description: string;
        images?: File[];
    }>;
};

export type Step8ProductsSubmitResponse = {
    created: Step8ProductItem[];
    progress: OnboardingProgress;
};

// ── Step 9 — Social Channels ──
export type Step9PlatformId =
    | 'tiktok_shop'
    | 'instagram'
    | 'facebook'
    | 'youtube'
    | 'x';

export type Step9PlatformStatus = {
    id: Step9PlatformId;
    connected: boolean;
    username: string;
    connected_at: string | null;
    gated: boolean;
};

export type Step9SocialResponse = {
    platforms: Step9PlatformStatus[];
    connected_count: number;
    total_count: number;
};

export type Step9MarkPayload = {
    connected_platforms?: Step9PlatformId[];
};

// ── Step 10 — Theme ──
export type ThemePreset =
    | 'blue'
    | 'dark'
    | 'white'
    | 'orange'
    | 'green'
    | 'red'
    | 'custom';

export type ThemeFont = 'Inter' | 'Poppins' | 'Roboto';

export type Step10ThemeResponse = {
    preset: ThemePreset;
    primary: string;
    accent: string;
    font: ThemeFont;
    radius: number;
    dark_store: boolean;
};

export type Step10ThemePayload = {
    preset?: ThemePreset;
    primary?: string;
    accent?: string;
    font?: ThemeFont;
    radius?: number;
    dark_store?: boolean;
};

// ── Step 11 — Team ──
export type TeamRole = 'admin' | 'manager' | 'orders' | 'content';

export type Step11InviteItem = {
    id?: string;
    email: string;
    role: TeamRole;
    status?: string;
    created_at?: string;
    expires_at?: string;
};

export type Step11TeamResponse = {
    invites: Step11InviteItem[];
};

export type Step11TeamPayload = {
    invites: Array<{
        email: string;
        role: TeamRole;
    }>;
};

// ── Step 12 — Finish ──
export type Step12StepState = 'done' | 'skipped';

export type Step12Step = {
    number: number;
    slug: string;
    title: string;
    description: string;
    optional: boolean;
    state: Step12StepState;
};

export type Step12Stats = {
    categories_added: number;
    products_added: number;
    payment_methods: number;
    team_members: number;
};

export type Step12FinishResponse = {
    steps: Step12Step[];
    stats: Step12Stats;
    completed_count: number;
    total_count: number;
    ready_to_go_live: boolean;
    missing_steps: number[];
    status: OnboardingStatus;
    submitted_at: string | null;
};

export type Step12FinalizePayload = {
    confirm: boolean;
};

export const onboarding = {
    // ── Global ──
    getProgress: (): Promise<OnboardingProgress> =>
        api.get<OnboardingProgress>('/api/onboarding/progress/'),

    listSteps: (): Promise<OnboardingStepsResponse> =>
        api.get<OnboardingStepsResponse>('/api/onboarding/steps/'),

    // ── Step 1: Account ──
    getStep1: (): Promise<Step1AccountResponse> =>
        api.get<Step1AccountResponse>('/api/onboarding/steps/1/'),

    submitStep1: (payload: Step1AccountPayload): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/1/', payload),

    // ── Step 2: Store Profile ──
    getStep2: (): Promise<Step2StoreResponse> =>
        api.get<Step2StoreResponse>('/api/onboarding/steps/2/'),

    submitStep2: (
        payload: Step2StorePayload,
    ): Promise<OnboardingProgress> => {
        const hasFile = payload.logo instanceof File;
        if (!hasFile) {
            return api.post<OnboardingProgress>(
                '/api/onboarding/steps/2/',
                payload,
            );
        }
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            fd.append(k, v instanceof File ? v : String(v));
        });
        return api.post<OnboardingProgress>(
            '/api/onboarding/steps/2/',
            fd,
        );
    },

    // ── Step 3: Business & Tax ──
    getStep3: (): Promise<Step3BusinessResponse> =>
        api.get<Step3BusinessResponse>('/api/onboarding/steps/3/'),

    submitStep3: (
        payload: Step3BusinessPayload,
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/3/', payload),

    testETims: (
        payload: Step3ETimsTestPayload,
    ): Promise<Step3ETimsTestResponse> =>
        api.post<Step3ETimsTestResponse>(
            '/api/onboarding/steps/3/etims-test/',
            payload,
        ),

    // ── Step 4: Payments (M-Pesa only) ──
    getStep4: (): Promise<Step4PaymentsResponse> =>
        api.get<Step4PaymentsResponse>('/api/onboarding/steps/4/'),

    submitStep4: (
        payload: Step4PaymentsPayload,
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/4/', payload),

    testStep4: (
        payload: Step4TestPayload,
    ): Promise<Step4TestResponse> =>
        api.post<Step4TestResponse>(
            '/api/onboarding/steps/4/test/',
            payload,
        ),

    // ── Step 5: WhatsApp ──
    getStep5: (): Promise<Step5WhatsAppResponse> =>
        api.get<Step5WhatsAppResponse>('/api/onboarding/steps/5/'),

    submitStep5: (
        payload: Step5WhatsAppPayload,
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/5/', payload),

    verifyWhatsApp: (
        payload: Step5VerifyPayload,
    ): Promise<Step5VerifyResponse> =>
        api.post<Step5VerifyResponse>(
            '/api/onboarding/steps/5/verify/',
            payload,
        ),

    sendWhatsAppTest: (
        payload: Step5SendTestPayload,
    ): Promise<Step5SendTestResponse> =>
        api.post<Step5SendTestResponse>(
            '/api/onboarding/steps/5/send-test/',
            payload,
        ),

    // ── Step 6: Shipping ──
    getStep6: (): Promise<Step6ShippingResponse> =>
        api.get<Step6ShippingResponse>('/api/onboarding/steps/6/'),

    submitStep6: (
        payload: Step6ShippingPayload,
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/6/', payload),

    // ── Step 7: First Categories ──
    getStep7: (): Promise<Step7CategoriesResponse> =>
        api.get<Step7CategoriesResponse>('/api/onboarding/steps/7/'),

    submitStep7: (
        payload: Step7CategoriesPayload,
    ): Promise<Step7CategoriesSubmitResponse> => {
        const hasImages = payload.categories.some(
            (c) => c.image instanceof File,
        );

        if (!hasImages) {
            return api.post<Step7CategoriesSubmitResponse>(
                '/api/onboarding/steps/7/',
                {
                    categories: payload.categories.map(
                        ({ image, ...rest }) => rest,
                    ),
                },
            );
        }

        const fd = new FormData();
        const stripped = payload.categories.map(({ image, ...rest }) => rest);
        fd.append('categories', JSON.stringify(stripped));
        payload.categories.forEach((c, i) => {
            if (c.image instanceof File) {
                fd.append(`image_${i}`, c.image);
            }
        });
        return api.post<Step7CategoriesSubmitResponse>(
            '/api/onboarding/steps/7/',
            fd,
        );
    },

    // ── Step 8: First Products ──
    getStep8: (): Promise<Step8ProductsResponse> =>
        api.get<Step8ProductsResponse>('/api/onboarding/steps/8/'),

    submitStep8: (
        payload: Step8ProductsPayload,
    ): Promise<Step8ProductsSubmitResponse> => {
        const hasImages = payload.products.some(
            (p) => p.images && p.images.length > 0,
        );

        if (!hasImages) {
            return api.post<Step8ProductsSubmitResponse>(
                '/api/onboarding/steps/8/',
                {
                    products: payload.products.map(
                        ({ images, ...rest }) => rest,
                    ),
                },
            );
        }

        const fd = new FormData();
        const stripped = payload.products.map(
            ({ images, ...rest }) => rest,
        );
        fd.append('products', JSON.stringify(stripped));
        payload.products.forEach((p, i) => {
            (p.images || []).slice(0, 3).forEach((file, n) => {
                if (file instanceof File) {
                    fd.append(`image_${i}_${n}`, file);
                }
            });
        });
        return api.post<Step8ProductsSubmitResponse>(
            '/api/onboarding/steps/8/',
            fd,
        );
    },

    // ── Step 9: Social Channels ──
    getStep9: (): Promise<Step9SocialResponse> =>
        api.get<Step9SocialResponse>('/api/onboarding/steps/9/'),

    submitStep9: (
        payload: Step9MarkPayload = {},
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/9/', payload),

    // ── Step 10: Theme ──
    getStep10: (): Promise<Step10ThemeResponse> =>
        api.get<Step10ThemeResponse>('/api/onboarding/steps/10/'),

    submitStep10: (
        payload: Step10ThemePayload = {},
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/10/', payload),

    // ── Step 11: Team ──
    getStep11: (): Promise<Step11TeamResponse> =>
        api.get<Step11TeamResponse>('/api/onboarding/steps/11/'),

    submitStep11: (
        payload: Step11TeamPayload,
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/11/', payload),

    // ── Step 12: Finish ──
    getStep12: (): Promise<Step12FinishResponse> =>
        api.get<Step12FinishResponse>('/api/onboarding/steps/12/'),

    finalizeStep12: (
        payload: Step12FinalizePayload = { confirm: true },
    ): Promise<OnboardingProgress> =>
        api.post<OnboardingProgress>('/api/onboarding/steps/12/', payload),
};

export { API_URL };