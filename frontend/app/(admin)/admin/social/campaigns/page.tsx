'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Copy,
    ExternalLink,
    Image as ImageIcon,
    Layers,
    Loader2,
    Package,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { adminApi as api } from '@/lib/admin-api';
import { ApiError, type Me } from '@/lib/api';

type Platform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
type CampaignStatus = 'draft' | 'pending_approval' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
type CampaignType =
    | 'product_launch'
    | 'product_promotion'
    | 'seasonal'
    | 'discount'
    | 'brand_awareness'
    | 'video_promotion'
    | 'influencer'
    | 'organic'
    | 'paid_advertising';

type CampaignObjective = 'awareness' | 'engagement' | 'traffic' | 'conversions' | 'sales';

type Staff = {
    id: string;
    name: string;
    email: string;
};

type Product = {
    id: string;
    name: string;
    sku: string;
    price: number;
    currency: string;
    image_url?: string | null;
    in_stock: boolean;
    stock_quantity?: number | null;
    category?: string | null;
};

type Discount = {
    id: string;
    code: string;
    description?: string | null;
    type: 'percentage' | 'fixed';
    value: number;
    valid_from: string;
    valid_to: string;
};

type ContentAsset = {
    id: string;
    title: string;
    type: 'post' | 'video' | 'image' | 'draft';
    platform: Platform | 'multi';
    status: 'draft' | 'scheduled' | 'published';
    thumbnail_url?: string | null;
    url?: string | null;
};

type CampaignContent = ContentAsset & {
    publication_status?: string | null;
    reach?: number | null;
    impressions?: number | null;
    views?: number | null;
    engagement?: number | null;
    clicks?: number | null;
};

type CampaignProduct = Product & {
    revenue?: number | null;
    orders?: number | null;
    units_sold?: number | null;
};

type CampaignPerformance = {
    reach?: number | null;
    impressions?: number | null;
    views?: number | null;
    engagement?: number | null;
    link_clicks?: number | null;
    website_visits?: number | null;
    add_to_cart?: number | null;
    orders?: number | null;
    attributed_revenue?: number | null;
    unattributed_orders?: number | null;
    attributed_orders?: number | null;
    organic?: {
        reach?: number | null;
        impressions?: number | null;
        views?: number | null;
        engagement?: number | null;
        link_clicks?: number | null;
    } | null;
    paid?: {
        reach?: number | null;
        impressions?: number | null;
        views?: number | null;
        engagement?: number | null;
        link_clicks?: number | null;
        spend?: number | null;
        roas?: number | null;
    } | null;
    last_synced_at?: string | null;
};

type CampaignFinancials = {
    planned_budget?: number | null;
    actual_spend?: number | null;
    attributed_revenue?: number | null;
    advertising_cost?: number | null;
    creator_commission?: number | null;
    currency?: string | null;
    roas?: number | null;
    profitability?: number | null;
    profitability_valid?: boolean;
};

type CampaignTracking = {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    tracking_link?: string | null;
    conversion_attribution?: 'complete' | 'partial' | 'unavailable' | null;
};

type CampaignAlert = {
    id: string;
    type: 'starting_soon' | 'ending_soon' | 'budget_warning' | 'integration_failure' | 'stock_out' | 'missing_tracking' | 'sync_failure';
    message: string;
    severity: 'info' | 'warning' | 'error';
    created_at: string;
};

type Campaign = {
    id: string;
    name: string;
    description?: string | null;
    objective: CampaignObjective;
    type: CampaignType;
    status: CampaignStatus;
    start_date: string;
    end_date: string;
    owner: Staff | null;
    internal_notes?: string | null;
    platforms: Platform[];
    accounts?: { platform: Platform; account_name: string; account_id: string }[];
    products: CampaignProduct[];
    content: CampaignContent[];
    discount_id?: string | null;
    discount?: Discount | null;
    promotional_message?: string | null;
    promotional_url?: string | null;
    offer_start?: string | null;
    offer_end?: string | null;
    budget?: CampaignFinancials | null;
    advertising?: {
        platform?: Platform | null;
        account?: string | null;
        external_id?: string | null;
        metrics_available?: boolean;
        note?: string | null;
    } | null;
    performance: CampaignPerformance;
    tracking: CampaignTracking;
    alerts: CampaignAlert[];
    created_at: string;
    updated_at: string;
};

type CampaignKPI = {
    total: number;
    active: number;
    scheduled: number;
    completed: number;
    requiring_attention: number;
    total_spend: number;
    attributed_revenue: number;
    attributed_orders: number;
    roas?: number | null;
    currency?: string | null;
    organic?: {
        reach?: number | null;
        engagement?: number | null;
        clicks?: number | null;
        orders?: number | null;
        attributed_revenue?: number | null;
    } | null;
    paid?: {
        spend?: number | null;
        impressions?: number | null;
        clicks?: number | null;
        orders?: number | null;
        attributed_revenue?: number | null;
        roas?: number | null;
    } | null;
};

const PLATFORM_META: Record<Platform, { label: string; icon: IconType; color: string }> = {
    youtube: { label: 'YouTube', icon: FaYoutube, color: 'text-red-600' },
    facebook: { label: 'Facebook', icon: FaFacebook, color: 'text-blue-600' },
    instagram: { label: 'Instagram', icon: FaInstagram, color: 'text-pink-600' },
    tiktok: { label: 'TikTok', icon: FaTiktok, color: 'text-slate-900' },
};

const CAMPAIGN_TYPE_META: Record<CampaignType, string> = {
    product_launch: 'Product launch',
    product_promotion: 'Product promotion',
    seasonal: 'Seasonal promotion',
    discount: 'Discount campaign',
    brand_awareness: 'Brand awareness',
    video_promotion: 'Video promotion',
    influencer: 'Influencer / Creator',
    organic: 'Organic social',
    paid_advertising: 'Paid advertising',
};

const STATUS_META: Record<CampaignStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    pending_approval: { label: 'Pending approval', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-950 border-blue-200' },
    active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    paused: { label: 'Paused', className: 'bg-orange-50 text-orange-700 border-orange-200' },
    completed: { label: 'Completed', className: 'bg-slate-50 text-slate-600 border-slate-200' },
    cancelled: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const OBJECTIVE_META: Record<CampaignObjective, string> = {
    awareness: 'Awareness',
    engagement: 'Engagement',
    traffic: 'Traffic',
    conversions: 'Conversions',
    sales: 'Sales',
};

type CreateDraft = {
    name: string;
    description: string;
    objective: CampaignObjective;
    type: CampaignType;
    start_date: string;
    end_date: string;
    status: CampaignStatus;
    owner_id: string;
    internal_notes: string;
    platforms: Platform[];
    accounts: { platform: Platform; account_name: string; account_id: string }[];
    product_ids: string[];
    discount_id: string;
    promotional_message: string;
    promotional_url: string;
    offer_start: string;
    offer_end: string;
    content_ids: string[];
    planned_budget: string;
    actual_spend: string;
    currency: string;
    advertising_platform: Platform | '';
    advertising_account: string;
    advertising_external_id: string;
};

function isoDateInput(d: Date): string {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function defaultDraft(): CreateDraft {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return {
        name: '',
        description: '',
        objective: 'awareness',
        type: 'product_promotion',
        start_date: isoDateInput(now),
        end_date: isoDateInput(end),
        status: 'draft',
        owner_id: '',
        internal_notes: '',
        platforms: [],
        accounts: [],
        product_ids: [],
        discount_id: '',
        promotional_message: '',
        promotional_url: '',
        offer_start: '',
        offer_end: '',
        content_ids: [],
        planned_budget: '',
        actual_spend: '',
        currency: 'KES',
        advertising_platform: '',
        advertising_account: '',
        advertising_external_id: '',
    };
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
        if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
            const d = (err.data as { detail: unknown }).detail;
            if (typeof d === 'string') return d;
        }
        return err.message || fallback;
    }
    if (err instanceof Error) return err.message;
    return fallback;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        credentials: 'include',
    });
    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (body && typeof body.detail === 'string') message = body.detail;
            else if (body && typeof body.message === 'string') message = body.message;
        } catch {
        }
        throw new Error(message);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
}

type CampaignApiClient = {
    social?: {
        campaigns?: {
            list?: (filters?: Record<string, string>) => Promise<Campaign[]>;
            kpi?: (filters?: Record<string, string>) => Promise<CampaignKPI>;
            detail?: (id: string) => Promise<Campaign>;
            create?: (payload: unknown) => Promise<Campaign>;
            pause?: (id: string) => Promise<Campaign>;
            resume?: (id: string) => Promise<Campaign>;
            complete?: (id: string) => Promise<Campaign>;
            cancel?: (id: string) => Promise<Campaign>;
        };
        accounts?: {
            list?: () => Promise<{ accounts?: unknown[]; platforms?: { platform: Platform; connected: boolean }[] }>;
        };
        content?: {
            search?: (q: string, limit?: number) => Promise<ContentAsset[]>;
        };
    };
    listStaff?: () => Promise<Staff[] | { staff?: Staff[]; results?: Staff[] }>;
    searchProducts?: (q: string) => Promise<Product[] | { products?: Product[]; results?: Product[] }>;
};

const clientApi = () => api as unknown as CampaignApiClient;

async function fetchCampaignsList(filters: Record<string, string>): Promise<Campaign[]> {
    const fn = clientApi().social?.campaigns?.list;
    if (typeof fn === 'function') return fn(filters);
    const qs = new URLSearchParams(filters).toString();
    return jsonFetch<Campaign[]>(`/api/v1/admin/social/campaigns/${qs ? `?${qs}` : ''}`);
}

async function fetchCampaignKpi(filters: Record<string, string>): Promise<CampaignKPI> {
    const fn = clientApi().social?.campaigns?.kpi;
    if (typeof fn === 'function') return fn(filters);
    const qs = new URLSearchParams(filters).toString();
    return jsonFetch<CampaignKPI>(`/api/v1/admin/social/campaigns/kpi/${qs ? `?${qs}` : ''}`);
}

async function fetchCampaignDetail(id: string): Promise<Campaign> {
    const fn = clientApi().social?.campaigns?.detail;
    if (typeof fn === 'function') return fn(id);
    return jsonFetch<Campaign>(`/api/v1/admin/social/campaigns/${encodeURIComponent(id)}/`);
}

async function createCampaignRequest(payload: unknown): Promise<Campaign> {
    const fn = clientApi().social?.campaigns?.create;
    if (typeof fn === 'function') return fn(payload);
    return jsonFetch<Campaign>('/api/v1/admin/social/campaigns/', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

async function runCampaignActionRequest(
    id: string,
    action: 'pause' | 'resume' | 'complete' | 'cancel',
): Promise<Campaign> {
    const fn = clientApi().social?.campaigns?.[action];
    if (typeof fn === 'function') return fn(id);
    return jsonFetch<Campaign>(`/api/v1/admin/social/campaigns/${encodeURIComponent(id)}/${action}/`, {
        method: 'POST',
    });
}

async function fetchConnectedPlatforms(): Promise<Platform[]> {
    const fn = clientApi().social?.accounts?.list;
    const res =
        typeof fn === 'function'
            ? await fn()
            : await jsonFetch<{ accounts?: { platform: Platform; status: string }[]; platforms?: { platform: Platform; connected: boolean }[] }>('/api/v1/admin/social/accounts/');
    if (Array.isArray(res?.platforms)) {
        return res.platforms.filter((p) => p.connected).map((p) => p.platform);
    }
    const accs = (res?.accounts ?? []) as { platform: Platform; status: string }[];
    return Array.from(new Set(accs.filter((a) => a.status === 'connected').map((a) => a.platform)));
}

async function fetchStaffOptions(): Promise<Staff[]> {
    const fn = clientApi().listStaff;
    if (typeof fn === 'function') {
        const res = await fn();
        if (Array.isArray(res)) return res;
        return res.staff ?? res.results ?? [];
    }
    const res = await jsonFetch<Staff[] | { staff?: Staff[]; results?: Staff[] }>('/api/staff?active=true');
    if (Array.isArray(res)) return res;
    return res.staff ?? res.results ?? [];
}

async function fetchDiscountOptions(): Promise<Discount[]> {
    const res = await jsonFetch<Discount[] | { discounts?: Discount[]; results?: Discount[] }>('/api/discounts?active=true');
    if (Array.isArray(res)) return res;
    return res.discounts ?? res.results ?? [];
}

async function searchProductCatalogue(q: string): Promise<Product[]> {
    const fn = clientApi().searchProducts;
    if (typeof fn === 'function') {
        const res = await fn(q);
        if (Array.isArray(res)) return res;
        return res.products ?? res.results ?? [];
    }
    const res = await jsonFetch<Product[] | { products?: Product[]; results?: Product[] }>(
        `/api/products/search?q=${encodeURIComponent(q)}&limit=20`,
    );
    if (Array.isArray(res)) return res;
    return res.products ?? res.results ?? [];
}

async function searchContentAssets(q: string): Promise<ContentAsset[]> {
    const fn = clientApi().social?.content?.search;
    if (typeof fn === 'function') return fn(q, 20);
    return jsonFetch<ContentAsset[]>(`/api/v1/admin/social/content/search/?q=${encodeURIComponent(q)}&limit=20`);
}

function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

function formatMoney(amount?: number | null, currency?: string | null): string {
    if (amount === null || amount === undefined) return '—';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currency || 'KES',
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency || 'KES'} ${amount.toFixed(2)}`;
    }
}

function formatNumber(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    try {
        return new Intl.NumberFormat().format(value);
    } catch {
        return String(value);
    }
}

function formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return iso;
    }
}

function formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function StatusBadge({ status }: { status: CampaignStatus }) {
    const m = STATUS_META[status];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium ${m.className}`}>
            {m.label}
        </span>
    );
}

function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
    const Meta = PLATFORM_META[platform];
    const Icon = Meta.icon;
    return <Icon className={Meta.color} size={size} />;
}

function alertClass(severity: CampaignAlert['severity']): string {
    if (severity === 'error') return 'bg-rose-50 border-rose-200 text-rose-700';
    if (severity === 'warning') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-blue-50 border-blue-200 text-blue-950';
}

function CampaignsPageContent() {
    const searchParams = useSearchParams();

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [kpi, setKpi] = useState<CampaignKPI | null>(null);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
    const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<CampaignType | 'all'>('all');
    const [ownerFilter, setOwnerFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Campaign | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const [createOpen, setCreateOpen] = useState(false);
    const [draft, setDraft] = useState<CreateDraft>(defaultDraft());
    const [createError, setCreateError] = useState('');
    const [creating, setCreating] = useState(false);

    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');

    const [productPickerOpen, setProductPickerOpen] = useState(false);
    const [productQuery, setProductQuery] = useState('');
    const debouncedProductQuery = useDebouncedValue(productQuery, 250);
    const [productResults, setProductResults] = useState<Product[]>([]);
    const [productSearching, setProductSearching] = useState(false);
    const [productPickerError, setProductPickerError] = useState('');

    const [contentPickerOpen, setContentPickerOpen] = useState(false);
    const [contentQuery, setContentQuery] = useState('');
    const debouncedContentQuery = useDebouncedValue(contentQuery, 250);
    const [contentResults, setContentResults] = useState<ContentAsset[]>([]);
    const [contentSearching, setContentSearching] = useState(false);
    const [contentPickerError, setContentPickerError] = useState('');

    const [copiedTrack, setCopiedTrack] = useState<string | null>(null);
    const [comparisonOpen, setComparisonOpen] = useState(false);

    const loadCampaigns = useCallback(async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);
        setLoadError('');
        try {
            const filters: Record<string, string> = {};
            if (statusFilter !== 'all') filters.status = statusFilter;
            if (platformFilter !== 'all') filters.platform = platformFilter;
            if (typeFilter !== 'all') filters.type = typeFilter;
            if (ownerFilter !== 'all') filters.owner_id = ownerFilter;
            if (dateFrom) filters.date_from = dateFrom;
            if (dateTo) filters.date_to = dateTo;
            if (debouncedSearch.trim()) filters.q = debouncedSearch.trim();

            const [campaignRes, kpiRes, platformsRes, staffRes, discountRes] = await Promise.all([
                fetchCampaignsList(filters),
                fetchCampaignKpi(filters),
                fetchConnectedPlatforms().catch(() => [] as Platform[]),
                fetchStaffOptions().catch(() => [] as Staff[]),
                fetchDiscountOptions().catch(() => [] as Discount[]),
            ]);

            setCampaigns(campaignRes);
            setKpi(kpiRes);
            setAvailablePlatforms(platformsRes);
            setStaffList(staffRes);
            setDiscounts(discountRes);
        } catch (err: any) {
            setLoadError(errorMessage(err, 'Could not load campaigns.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter, platformFilter, typeFilter, ownerFilter, dateFrom, dateTo, debouncedSearch]);

    useEffect(() => {
        void loadCampaigns(true);
    }, [loadCampaigns]);

    useEffect(() => {
        const action = searchParams.get('action');
        const id = searchParams.get('id');
        if (action === 'create') {
            setDraft(defaultDraft());
            setCreateError('');
            setCreateOpen(true);
        }
        if (id) {
            setSelectedId(id);
        }
    }, [searchParams]);

    const loadCampaign = useCallback(async (id: string) => {
        setDetailLoading(true);
        setDetailError('');
        setActionError('');
        try {
            const data = await fetchCampaignDetail(id);
            setSelected(data);
        } catch (err: any) {
            setDetailError(errorMessage(err, 'Could not load campaign.'));
            setSelected(null);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedId) {
            setSelected(null);
            return;
        }
        void loadCampaign(selectedId);
    }, [selectedId, loadCampaign]);

    useEffect(() => {
        if (!productPickerOpen) return;
        if (!debouncedProductQuery.trim()) {
            setProductResults([]);
            return;
        }
        let cancelled = false;
        setProductSearching(true);
        setProductPickerError('');
        searchProductCatalogue(debouncedProductQuery.trim())
            .then((res) => { if (!cancelled) setProductResults(res); })
            .catch((err) => { if (!cancelled) setProductPickerError(errorMessage(err, 'Product search failed.')); })
            .finally(() => { if (!cancelled) setProductSearching(false); });
        return () => { cancelled = true; };
    }, [debouncedProductQuery, productPickerOpen]);

    useEffect(() => {
        if (!contentPickerOpen) return;
        if (!debouncedContentQuery.trim()) {
            setContentResults([]);
            return;
        }
        let cancelled = false;
        setContentSearching(true);
        setContentPickerError('');
        searchContentAssets(debouncedContentQuery.trim())
            .then((res) => { if (!cancelled) setContentResults(res); })
            .catch((err) => { if (!cancelled) setContentPickerError(errorMessage(err, 'Content search failed.')); })
            .finally(() => { if (!cancelled) setContentSearching(false); });
        return () => { cancelled = true; };
    }, [debouncedContentQuery, contentPickerOpen]);

    const filteredCampaigns = useMemo(() => {
        if (platformFilter === 'all') return campaigns;
        return campaigns.filter((c) => c.platforms.includes(platformFilter));
    }, [campaigns, platformFilter]);

    const handleRefresh = () => {
        void loadCampaigns(false);
        if (selectedId) void loadCampaign(selectedId);
    };

    const openCreate = () => {
        setDraft(defaultDraft());
        setCreateError('');
        setCreateOpen(true);
    };

    const closeCreate = () => {
        if (creating) return;
        setCreateOpen(false);
        setCreateError('');
    };

    const togglePlatform = (p: Platform) => {
        setDraft((d) => ({
            ...d,
            platforms: d.platforms.includes(p) ? d.platforms.filter((x) => x !== p) : [...d.platforms, p],
            accounts: d.accounts.filter((a) => a.platform !== p || d.platforms.includes(p)),
        }));
    };

    const submitCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setCreateError('');

        if (!draft.name.trim()) {
            setCreateError('Campaign name is required.');
            return;
        }
        if (!draft.start_date || !draft.end_date) {
            setCreateError('Start and end dates are required.');
            return;
        }
        if (draft.platforms.length === 0) {
            setCreateError('Select at least one platform.');
            return;
        }
        if (draft.type === 'paid_advertising' && !draft.planned_budget) {
            setCreateError('Planned budget is required for paid campaigns.');
            return;
        }

        setCreating(true);
        try {
            const payload = {
                name: draft.name.trim(),
                description: draft.description.trim(),
                objective: draft.objective,
                type: draft.type,
                start_date: draft.start_date,
                end_date: draft.end_date,
                status: draft.status,
                owner_id: draft.owner_id || null,
                internal_notes: draft.internal_notes.trim(),
                platforms: draft.platforms,
                accounts: draft.accounts,
                product_ids: draft.product_ids,
                discount_id: draft.discount_id || null,
                promotional_message: draft.promotional_message.trim(),
                promotional_url: draft.promotional_url.trim(),
                offer_start: draft.offer_start || null,
                offer_end: draft.offer_end || null,
                content_ids: draft.content_ids,
                budget: {
                    planned_budget: draft.planned_budget ? Number(draft.planned_budget) : null,
                    actual_spend: draft.actual_spend ? Number(draft.actual_spend) : null,
                    currency: draft.currency,
                },
                advertising: draft.advertising_platform ? {
                    platform: draft.advertising_platform,
                    account: draft.advertising_account || null,
                    external_id: draft.advertising_external_id || null,
                } : null,
            };
            const created = await createCampaignRequest(payload);
            setCampaigns((prev) => [created, ...prev]);
            setCreateOpen(false);
            setSelectedId(created.id);
            void loadCampaigns(false);
        } catch (err: any) {
            setCreateError(errorMessage(err, 'Could not create campaign.'));
        } finally {
            setCreating(false);
        }
    };

    const runCampaignAction = async (action: 'pause' | 'resume' | 'complete' | 'cancel') => {
        if (!selected) return;
        setActionBusy(action);
        setActionError('');
        try {
            const updated = await runCampaignActionRequest(selected.id, action);
            setSelected(updated);
            setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? { ...c, status: updated.status } : c)));
        } catch (err: any) {
            setActionError(errorMessage(err, `Could not ${action} campaign.`));
        } finally {
            setActionBusy(null);
        }
    };

    const copyTracking = async (link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiedTrack(link);
            setTimeout(() => setCopiedTrack(null), 1500);
        } catch {
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-[20px] font-semibold text-slate-900">Campaigns &amp; Promotions</h1>
                        <p className="text-[13px] text-slate-500 max-w-2xl">
                            Plan and measure social campaigns across connected platforms, linking content and promotions to your product catalogue.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setComparisonOpen(true)}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px] transition"
                        >
                            <BarChart3 className="w-3.5 h-3.5" /> Compare
                        </button>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px] transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded text-[13px] transition"
                        >
                            <Plus className="w-3.5 h-3.5" /> Create campaign
                        </button>
                    </div>
                </header>

                {loadError && (
                    <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center justify-between gap-2">
                        <span>{loadError}</span>
                        <button type="button" onClick={handleRefresh} className="text-[12px] font-medium text-rose-700 hover:underline">Retry</button>
                    </div>
                )}

                {kpi && (
                    <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                        <KpiCard label="Total campaigns" value={formatNumber(kpi.total)} />
                        <KpiCard label="Active" value={formatNumber(kpi.active)} tone="emerald" />
                        <KpiCard label="Scheduled" value={formatNumber(kpi.scheduled)} tone="blue" />
                        <KpiCard label="Completed" value={formatNumber(kpi.completed)} />
                        <KpiCard label="Need attention" value={formatNumber(kpi.requiring_attention)} tone="amber" />
                        <KpiCard label="Spend" value={formatMoney(kpi.total_spend, kpi.currency)} />
                        <KpiCard label="Attributed revenue" value={formatMoney(kpi.attributed_revenue, kpi.currency)} tone="emerald" />
                        <KpiCard
                            label={kpi.roas != null ? 'ROAS' : 'Attributed orders'}
                            value={kpi.roas != null ? `${kpi.roas.toFixed(2)}×` : formatNumber(kpi.attributed_orders)}
                        />
                    </section>
                )}

                <section className="bg-white border border-slate-200 rounded p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search campaigns…"
                                className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | 'all')}
                            className="bg-white border border-slate-200 rounded px-2 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                        >
                            <option value="all">All statuses</option>
                            {(Object.keys(STATUS_META) as CampaignStatus[]).map((s) => (
                                <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                        </select>
                        <select
                            value={platformFilter}
                            onChange={(e) => setPlatformFilter(e.target.value as Platform | 'all')}
                            className="bg-white border border-slate-200 rounded px-2 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                        >
                            <option value="all">All platforms</option>
                            {availablePlatforms.map((p) => (
                                <option key={p} value={p}>{PLATFORM_META[p].label}</option>
                            ))}
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as CampaignType | 'all')}
                            className="bg-white border border-slate-200 rounded px-2 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                        >
                            <option value="all">All types</option>
                            {(Object.keys(CAMPAIGN_TYPE_META) as CampaignType[]).map((t) => (
                                <option key={t} value={t}>{CAMPAIGN_TYPE_META[t]}</option>
                            ))}
                        </select>
                        <select
                            value={ownerFilter}
                            onChange={(e) => setOwnerFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                        >
                            <option value="all">All owners</option>
                            {staffList.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                            />
                            <span className="text-[11px] text-slate-400">to</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                            />
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-3">
                    <section className="bg-white border border-slate-200 rounded overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                            <p className="text-[12px] font-medium text-slate-700">
                                {filteredCampaigns.length} campaign{filteredCampaigns.length === 1 ? '' : 's'}
                            </p>
                            {refreshing && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[calc(100vh-360px)] overflow-y-auto">
                            {filteredCampaigns.length === 0 && (
                                <div className="p-6 text-center space-y-1">
                                    <Layers className="w-6 h-6 text-slate-300 mx-auto" />
                                    <p className="text-[13px] text-slate-600">No campaigns match your filters.</p>
                                    <p className="text-[11px] text-slate-400">Try adjusting the filters or create a new campaign.</p>
                                </div>
                            )}
                            {filteredCampaigns.map((c) => {
                                const active = selectedId === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setSelectedId(c.id)}
                                        className={`w-full text-left px-3 py-2.5 transition ${active ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-[13px] font-semibold text-slate-900 truncate">{c.name}</p>
                                                    <StatusBadge status={c.status} />
                                                </div>
                                                <p className="text-[11px] text-slate-500 line-clamp-1">{c.description || CAMPAIGN_TYPE_META[c.type]}</p>
                                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                                    {c.platforms.map((p) => (
                                                        <span key={p} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600">
                                                            <PlatformIcon platform={p} size={10} /> {PLATFORM_META[p].label}
                                                        </span>
                                                    ))}
                                                    <span className="text-[10px] text-slate-400">
                                                        {formatDate(c.start_date)} – {formatDate(c.end_date)}
                                                    </span>
                                                    {c.owner && (
                                                        <span className="text-[10px] text-slate-500">· {c.owner.name}</span>
                                                    )}
                                                </div>
                                                {c.alerts.length > 0 && (
                                                    <div className="flex items-center gap-1 text-[10px] text-amber-700">
                                                        <AlertTriangle className="w-3 h-3" /> {c.alerts.length} alert{c.alerts.length === 1 ? '' : 's'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="bg-white border border-slate-200 rounded flex flex-col min-h-[500px] max-h-[calc(100vh-200px)]">
                        {!selectedId && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                                <Layers className="w-8 h-8 text-slate-300" />
                                <p className="text-[13px] text-slate-600">Select a campaign to view details.</p>
                            </div>
                        )}

                        {selectedId && detailLoading && (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                            </div>
                        )}

                        {selectedId && !detailLoading && detailError && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                                <AlertTriangle className="w-7 h-7 text-rose-400" />
                                <p className="text-[13px] text-rose-700">{detailError}</p>
                                <button
                                    type="button"
                                    onClick={() => void loadCampaign(selectedId)}
                                    className="text-[12px] font-medium text-blue-950 hover:underline"
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {selected && !detailLoading && (
                            <div className="flex flex-col h-full">
                                <div className="px-3 py-2.5 border-b border-slate-200 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h2 className="text-[14px] font-semibold text-slate-900 truncate">{selected.name}</h2>
                                                <StatusBadge status={selected.status} />
                                            </div>
                                            <p className="text-[11px] text-slate-500">{CAMPAIGN_TYPE_META[selected.type]} · {OBJECTIVE_META[selected.objective]}</p>
                                            <p className="text-[11px] text-slate-500">
                                                {formatDate(selected.start_date)} – {formatDate(selected.end_date)}
                                                {selected.owner && ` · ${selected.owner.name}`}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {selected.status === 'active' && (
                                                <button
                                                    type="button"
                                                    onClick={() => runCampaignAction('pause')}
                                                    disabled={actionBusy !== null}
                                                    className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                                >
                                                    {actionBusy === 'pause' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />} Pause
                                                </button>
                                            )}
                                            {selected.status === 'paused' && (
                                                <button
                                                    type="button"
                                                    onClick={() => runCampaignAction('resume')}
                                                    disabled={actionBusy !== null}
                                                    className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                                >
                                                    {actionBusy === 'resume' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Resume
                                                </button>
                                            )}
                                            {selected.status !== 'completed' && selected.status !== 'cancelled' && (
                                                <button
                                                    type="button"
                                                    onClick={() => runCampaignAction('complete')}
                                                    disabled={actionBusy !== null}
                                                    className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                                >
                                                    {actionBusy === 'complete' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Complete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {actionError && (
                                        <div className="bg-rose-50 border border-rose-200 rounded px-2 py-1 text-[11px] text-rose-700">{actionError}</div>
                                    )}
                                    {selected.alerts.length > 0 && (
                                        <div className="space-y-1">
                                            {selected.alerts.map((a) => (
                                                <div key={a.id} className={`border rounded px-2 py-1 text-[11px] flex items-start gap-1.5 ${alertClass(a.severity)}`}>
                                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                                    <div className="flex-1">
                                                        <p>{a.message}</p>
                                                        <p className="text-[10px] opacity-70">{formatDateTime(a.created_at)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                                    <DetailSection title="Financials">
                                        <div className="grid grid-cols-2 gap-2 text-[12px]">
                                            <DetailRow label="Planned budget" value={formatMoney(selected.budget?.planned_budget, selected.budget?.currency)} />
                                            <DetailRow label="Actual spend" value={formatMoney(selected.budget?.actual_spend, selected.budget?.currency)} />
                                            <DetailRow label="Attributed revenue" value={formatMoney(selected.budget?.attributed_revenue, selected.budget?.currency)} />
                                            <DetailRow label="Advertising cost" value={formatMoney(selected.budget?.advertising_cost, selected.budget?.currency)} />
                                            <DetailRow label="Creator commission" value={formatMoney(selected.budget?.creator_commission, selected.budget?.currency)} />
                                            <DetailRow label="ROAS" value={selected.budget?.roas != null ? `${selected.budget.roas.toFixed(2)}×` : 'Unavailable'} />
                                            <DetailRow
                                                label="Profitability"
                                                value={selected.budget?.profitability_valid ? formatMoney(selected.budget?.profitability, selected.budget?.currency) : 'Insufficient data'}
                                            />
                                        </div>
                                    </DetailSection>

                                    <DetailSection title="Performance">
                                        <div className="grid grid-cols-2 gap-2 text-[12px]">
                                            <DetailRow label="Reach" value={formatNumber(selected.performance.reach)} />
                                            <DetailRow label="Impressions" value={formatNumber(selected.performance.impressions)} />
                                            <DetailRow label="Views" value={formatNumber(selected.performance.views)} />
                                            <DetailRow label="Engagement" value={formatNumber(selected.performance.engagement)} />
                                            <DetailRow label="Link clicks" value={formatNumber(selected.performance.link_clicks)} />
                                            <DetailRow label="Website visits" value={formatNumber(selected.performance.website_visits)} />
                                            <DetailRow label="Add to cart" value={formatNumber(selected.performance.add_to_cart)} />
                                            <DetailRow label="Orders" value={formatNumber(selected.performance.orders)} />
                                            <DetailRow label="Attributed orders" value={formatNumber(selected.performance.attributed_orders)} />
                                            <DetailRow label="Attributed revenue" value={formatMoney(selected.performance.attributed_revenue, selected.budget?.currency)} />
                                            <DetailRow label="Unattributed orders" value={formatNumber(selected.performance.unattributed_orders)} />
                                        </div>
                                        {selected.performance.last_synced_at && (
                                            <p className="text-[10px] text-slate-400 pt-1">Last synced: {formatDateTime(selected.performance.last_synced_at)}</p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                            {selected.performance.organic && (
                                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                                    <p className="text-[11px] font-semibold text-slate-700 pb-1">Organic</p>
                                                    <PerfRow label="Reach" value={formatNumber(selected.performance.organic.reach)} />
                                                    <PerfRow label="Engagement" value={formatNumber(selected.performance.organic.engagement)} />
                                                    <PerfRow label="Clicks" value={formatNumber(selected.performance.organic.link_clicks)} />
                                                </div>
                                            )}
                                            {selected.performance.paid && (
                                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                                    <p className="text-[11px] font-semibold text-slate-700 pb-1">Paid</p>
                                                    <PerfRow label="Spend" value={formatMoney(selected.performance.paid.spend, selected.budget?.currency)} />
                                                    <PerfRow label="Impressions" value={formatNumber(selected.performance.paid.impressions)} />
                                                    <PerfRow label="Clicks" value={formatNumber(selected.performance.paid.link_clicks)} />
                                                    <PerfRow label="ROAS" value={selected.performance.paid.roas != null ? `${selected.performance.paid.roas.toFixed(2)}×` : 'Unavailable'} />
                                                </div>
                                            )}
                                        </div>
                                    </DetailSection>

                                    <DetailSection title="Tracking">
                                        <div className="space-y-1 text-[12px]">
                                            <PerfRow label="UTM source" value={selected.tracking.utm_source || '—'} />
                                            <PerfRow label="UTM medium" value={selected.tracking.utm_medium || '—'} />
                                            <PerfRow label="UTM campaign" value={selected.tracking.utm_campaign || '—'} />
                                            <PerfRow label="Attribution" value={selected.tracking.conversion_attribution || 'unavailable'} />
                                            {selected.tracking.tracking_link && (
                                                <div className="flex items-center gap-1 pt-1">
                                                    <span className="text-[11px] text-slate-500 truncate flex-1">{selected.tracking.tracking_link}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyTracking(selected.tracking.tracking_link!)}
                                                        className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-0.5 rounded text-[10px]"
                                                    >
                                                        <Copy className="w-3 h-3" /> {copiedTrack === selected.tracking.tracking_link ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </DetailSection>

                                    {selected.products.length > 0 && (
                                        <DetailSection title={`Products (${selected.products.length})`}>
                                            <ul className="divide-y divide-slate-100">
                                                {selected.products.map((p) => (
                                                    <li key={p.id} className="py-1.5 flex items-center gap-2">
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover bg-slate-100" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center">
                                                                <Package className="w-3.5 h-3.5 text-slate-400" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[12px] font-medium text-slate-800 truncate">{p.name}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {p.sku} · {formatMoney(p.price, p.currency)} · {p.in_stock ? 'In stock' : 'Out of stock'}
                                                            </p>
                                                        </div>
                                                        {!p.in_stock && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-600">
                                                                <AlertTriangle className="w-3 h-3" /> Stock
                                                            </span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </DetailSection>
                                    )}

                                    {selected.content.length > 0 && (
                                        <DetailSection title={`Content (${selected.content.length})`}>
                                            <ul className="divide-y divide-slate-100">
                                                {selected.content.map((c) => (
                                                    <li key={c.id} className="py-1.5 flex items-center gap-2">
                                                        {c.thumbnail_url ? (
                                                            <img src={c.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover bg-slate-100" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center">
                                                                <ImageIcon className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[12px] font-medium text-slate-800 truncate">{c.title}</p>
                                                            <p className="text-[10px] text-slate-500 capitalize">
                                                                {c.type} · {c.platform} · {c.publication_status || c.status}
                                                            </p>
                                                        </div>
                                                        {c.url && (
                                                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700">
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </DetailSection>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {createOpen && (
                <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
                    <form onSubmit={submitCreate} className="w-full max-w-3xl bg-white border border-slate-200 rounded shadow-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <h2 className="text-[15px] font-semibold text-slate-900">Create campaign</h2>
                            <button type="button" onClick={closeCreate} disabled={creating} className="text-slate-400 hover:text-slate-700 disabled:opacity-50">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="px-4 py-3 space-y-4 max-h-[75vh] overflow-y-auto">
                            {createError && (
                                <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700">{createError}</div>
                            )}

                            <SectionHeading title="General details" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Campaign name" required>
                                    <input
                                        value={draft.name}
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                        placeholder="e.g. Summer Sale 2026"
                                    />
                                </Field>
                                <Field label="Owner">
                                    <select
                                        value={draft.owner_id}
                                        onChange={(e) => setDraft({ ...draft, owner_id: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                                    >
                                        <option value="">Unassigned</option>
                                        {staffList.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Objective">
                                    <select
                                        value={draft.objective}
                                        onChange={(e) => setDraft({ ...draft, objective: e.target.value as CampaignObjective })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    >
                                        {(Object.keys(OBJECTIVE_META) as CampaignObjective[]).map((o) => (
                                            <option key={o} value={o}>{OBJECTIVE_META[o]}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Type">
                                    <select
                                        value={draft.type}
                                        onChange={(e) => setDraft({ ...draft, type: e.target.value as CampaignType })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    >
                                        {(Object.keys(CAMPAIGN_TYPE_META) as CampaignType[]).map((t) => (
                                            <option key={t} value={t}>{CAMPAIGN_TYPE_META[t]}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Start date">
                                    <input
                                        type="date"
                                        value={draft.start_date}
                                        onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="End date">
                                    <input
                                        type="date"
                                        value={draft.end_date}
                                        onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Status">
                                    <select
                                        value={draft.status}
                                        onChange={(e) => setDraft({ ...draft, status: e.target.value as CampaignStatus })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    >
                                        {(Object.keys(STATUS_META) as CampaignStatus[]).map((s) => (
                                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            <Field label="Description">
                                <textarea
                                    value={draft.description}
                                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                    rows={2}
                                    disabled={creating}
                                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] resize-none"
                                    placeholder="Short summary of the campaign"
                                />
                            </Field>
                            <Field label="Internal notes">
                                <textarea
                                    value={draft.internal_notes}
                                    onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })}
                                    rows={2}
                                    disabled={creating}
                                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] resize-none"
                                    placeholder="Only visible to staff"
                                />
                            </Field>

                            <SectionHeading title="Platforms" />
                            <div className="flex flex-wrap gap-2">
                                {(['youtube', 'facebook', 'instagram', 'tiktok'] as Platform[]).map((p) => {
                                    const available = availablePlatforms.includes(p);
                                    const active = draft.platforms.includes(p);
                                    const Meta = PLATFORM_META[p];
                                    const Icon = Meta.icon;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => available && togglePlatform(p)}
                                            disabled={creating || !available}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-[12px] transition ${active ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                } ${!available ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : Meta.color}`} />
                                            {Meta.label}
                                            {!available && <span className="text-[10px]">(not connected)</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            <SectionHeading title="Products" />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setProductPickerOpen((v) => !v)}
                                    disabled={creating}
                                    className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded text-[12px]"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add products
                                </button>
                                <span className="text-[11px] text-slate-500">{draft.product_ids.length} selected</span>
                            </div>
                            {productPickerOpen && (
                                <div className="border border-slate-200 rounded p-2 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Search className="w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            value={productQuery}
                                            onChange={(e) => setProductQuery(e.target.value)}
                                            placeholder="Search product catalogue…"
                                            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[12px]"
                                        />
                                        <button type="button" onClick={() => setProductPickerOpen(false)} className="text-slate-400 hover:text-slate-700">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    {productPickerError && <p className="text-[11px] text-rose-600">{productPickerError}</p>}
                                    {productSearching && <p className="text-[11px] text-slate-400">Searching…</p>}
                                    <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                        {productResults.map((p) => {
                                            const isSelected = draft.product_ids.includes(p.id);
                                            return (
                                                <li key={p.id} className="py-1.5 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => setDraft((d) => ({
                                                            ...d,
                                                            product_ids: isSelected
                                                                ? d.product_ids.filter((id) => id !== p.id)
                                                                : [...d.product_ids, p.id],
                                                        }))}
                                                        disabled={creating}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[12px] font-medium text-slate-800 truncate">{p.name}</p>
                                                        <p className="text-[10px] text-slate-500">{p.sku} · {formatMoney(p.price, p.currency)}</p>
                                                    </div>
                                                    {!p.in_stock && <span className="text-[10px] text-rose-600">Out of stock</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            <SectionHeading title="Promotion" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Discount">
                                    <select
                                        value={draft.discount_id}
                                        onChange={(e) => setDraft({ ...draft, discount_id: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    >
                                        <option value="">None</option>
                                        {discounts.map((d) => (
                                            <option key={d.id} value={d.id}>{d.code} · {d.description || d.type}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Promotional URL">
                                    <input
                                        value={draft.promotional_url}
                                        onChange={(e) => setDraft({ ...draft, promotional_url: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                        placeholder="https://…"
                                    />
                                </Field>
                                <Field label="Offer start">
                                    <input
                                        type="date"
                                        value={draft.offer_start}
                                        onChange={(e) => setDraft({ ...draft, offer_start: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Offer end">
                                    <input
                                        type="date"
                                        value={draft.offer_end}
                                        onChange={(e) => setDraft({ ...draft, offer_end: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                            </div>
                            <Field label="Promotional message">
                                <textarea
                                    value={draft.promotional_message}
                                    onChange={(e) => setDraft({ ...draft, promotional_message: e.target.value })}
                                    rows={2}
                                    disabled={creating}
                                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] resize-none"
                                />
                            </Field>

                            <SectionHeading title="Content" />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setContentPickerOpen((v) => !v)}
                                    disabled={creating}
                                    className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded text-[12px]"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add content
                                </button>
                                <span className="text-[11px] text-slate-500">{draft.content_ids.length} selected</span>
                            </div>
                            {contentPickerOpen && (
                                <div className="border border-slate-200 rounded p-2 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Search className="w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            value={contentQuery}
                                            onChange={(e) => setContentQuery(e.target.value)}
                                            placeholder="Search content drafts, posts, videos…"
                                            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[12px]"
                                        />
                                        <button type="button" onClick={() => setContentPickerOpen(false)} className="text-slate-400 hover:text-slate-700">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    {contentPickerError && <p className="text-[11px] text-rose-600">{contentPickerError}</p>}
                                    {contentSearching && <p className="text-[11px] text-slate-400">Searching…</p>}
                                    <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                        {contentResults.map((c) => {
                                            const isSelected = draft.content_ids.includes(c.id);
                                            return (
                                                <li key={c.id} className="py-1.5 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => setDraft((d) => ({
                                                            ...d,
                                                            content_ids: isSelected
                                                                ? d.content_ids.filter((id) => id !== c.id)
                                                                : [...d.content_ids, c.id],
                                                        }))}
                                                        disabled={creating}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[12px] font-medium text-slate-800 truncate">{c.title}</p>
                                                        <p className="text-[10px] text-slate-500 capitalize">{c.type} · {c.platform} · {c.status}</p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            <SectionHeading title="Budget & advertising" />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label={draft.type === 'paid_advertising' ? 'Planned budget (required)' : 'Planned budget'}>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={draft.planned_budget}
                                        onChange={(e) => setDraft({ ...draft, planned_budget: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Actual spend">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={draft.actual_spend}
                                        onChange={(e) => setDraft({ ...draft, actual_spend: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Currency">
                                    <input
                                        value={draft.currency}
                                        onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                                        disabled={creating}
                                        maxLength={4}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="Advertising platform">
                                    <select
                                        value={draft.advertising_platform}
                                        onChange={(e) => setDraft({ ...draft, advertising_platform: e.target.value as Platform | '' })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    >
                                        <option value="">None / Organic only</option>
                                        {availablePlatforms.map((p) => (
                                            <option key={p} value={p}>{PLATFORM_META[p].label}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Advertising account">
                                    <input
                                        value={draft.advertising_account}
                                        onChange={(e) => setDraft({ ...draft, advertising_account: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                                <Field label="External ID / reference">
                                    <input
                                        value={draft.advertising_external_id}
                                        onChange={(e) => setDraft({ ...draft, advertising_external_id: e.target.value })}
                                        disabled={creating}
                                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px]"
                                    />
                                </Field>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                A campaign budget does not automatically create an advertising campaign. Actual ad creation requires platform permissions.
                            </p>
                        </div>

                        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeCreate}
                                disabled={creating}
                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px] disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded text-[13px] disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                Create campaign
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {comparisonOpen && (
                <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="w-full max-w-4xl bg-white border border-slate-200 rounded shadow-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <h2 className="text-[15px] font-semibold text-slate-900">Campaign comparison</h2>
                            <button type="button" onClick={() => setComparisonOpen(false)} className="text-slate-400 hover:text-slate-700">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-4 py-3 max-h-[75vh] overflow-y-auto">
                            <ComparisonTable campaigns={filteredCampaigns} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'blue' }) {
    const toneClass =
        tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : tone === 'blue' ? 'text-blue-950' : 'text-slate-900';
    return (
        <div className="bg-white border border-slate-200 rounded p-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-[16px] font-semibold ${toneClass}`}>{value}</p>
        </div>
    );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-1.5">
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
            <div>{children}</div>
        </section>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="text-[12px] text-slate-800">{value}</p>
        </div>
    );
}

function PerfRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{label}</span>
            <span className="text-[11px] text-slate-800 font-medium">{value}</span>
        </div>
    );
}

function SectionHeading({ title }: { title: string }) {
    return <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide pt-1">{title}</h3>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-700">
                {label} {required && <span className="text-rose-600">*</span>}
            </label>
            {children}
        </div>
    );
}

function ComparisonTable({ campaigns }: { campaigns: Campaign[] }) {
    if (campaigns.length === 0) {
        return <p className="text-[13px] text-slate-500">No campaigns to compare with the current filters.</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-[12px] border border-slate-200">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="text-left px-2 py-1.5 font-medium">Campaign</th>
                        <th className="text-left px-2 py-1.5 font-medium">Type</th>
                        <th className="text-left px-2 py-1.5 font-medium">Platforms</th>
                        <th className="text-right px-2 py-1.5 font-medium">Spend</th>
                        <th className="text-right px-2 py-1.5 font-medium">Revenue</th>
                        <th className="text-right px-2 py-1.5 font-medium">Orders</th>
                        <th className="text-right px-2 py-1.5 font-medium">ROAS</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {campaigns.map((c) => (
                        <tr key={c.id}>
                            <td className="px-2 py-1.5 text-slate-800">{c.name}</td>
                            <td className="px-2 py-1.5 text-slate-600">{CAMPAIGN_TYPE_META[c.type]}</td>
                            <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                    {c.platforms.map((p) => <PlatformIcon key={p} platform={p} size={12} />)}
                                </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">{formatMoney(c.budget?.actual_spend, c.budget?.currency)}</td>
                            <td className="px-2 py-1.5 text-right">{formatMoney(c.performance.attributed_revenue, c.budget?.currency)}</td>
                            <td className="px-2 py-1.5 text-right">{formatNumber(c.performance.attributed_orders)}</td>
                            <td className="px-2 py-1.5 text-right">{c.budget?.roas != null ? `${c.budget.roas.toFixed(2)}×` : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function CampaignsPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Loading…</div>}>
            <CampaignsPageContent />
        </Suspense>
    );
}