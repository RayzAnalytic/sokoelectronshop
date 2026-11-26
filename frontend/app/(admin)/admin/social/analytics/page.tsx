'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    ChevronDown,
    Download,
    Info,
    Loader2,
    RefreshCw,
    ShoppingBag,
    Users,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { adminApi as api, ApiError } from '@/lib/admin-api';

type PlatformId = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

type DateRangeId =
    | 'today'
    | 'yesterday'
    | 'last_7_days'
    | 'last_30_days'
    | 'last_90_days'
    | 'this_month'
    | 'previous_month'
    | 'custom';

type ContentType = 'all' | 'video' | 'post' | 'reel' | 'story' | 'short';

type Metric = {
    value: number | null;
    previous: number | null;
    available: boolean;
};

type PlatformAccount = {
    id: string;
    platform: PlatformId;
    handle: string;
    name: string;
    last_synced_at: string | null;
    coverage_start: string | null;
    coverage_end: string | null;
    sync_status: 'ok' | 'failed' | 'pending' | 'never';
    missing_metrics: string[];
};

type Campaign = {
    id: string;
    name: string;
    platform: PlatformId;
    type: 'organic' | 'paid';
    spend: number | null;
    reach: Metric;
    impressions: Metric;
    views: Metric;
    engagement: Metric;
    clicks: Metric;
    website_visits: Metric;
    orders: Metric;
    attributed_revenue: Metric;
    roas: number | null;
};

type ContentRow = {
    id: string;
    campaign_id?: string | null;
    thumbnail_url: string | null;
    title: string;
    platform: PlatformId;
    account_handle: string;
    content_type: string;
    published_at: string;
    views: Metric;
    reach: Metric;
    impressions: Metric;
    likes: Metric;
    comments: Metric;
    shares: Metric;
    saves: Metric;
    engagement_rate: Metric;
    link_clicks: Metric;
    attributed_orders: Metric;
    attributed_revenue: Metric;
};

type ProductRow = {
    id: string;
    name: string;
    sku: string;
    image_url: string | null;
    product_views: number;
    clicks: number;
    add_to_cart: number;
    orders: number;
    units_sold: number;
    attributed_revenue: number;
    conversion_rate: number;
};

type FunnelStage = {
    key: string;
    label: string;
    value: number;
    definition: string;
};

type RevenueBreakdownRow = {
    key: string;
    label: string;
    visits: number;
    assisted_orders: number;
    attributed_orders: number;
    attributed_revenue: number;
    direct_orders: number;
    unattributed_orders: number;
};

type PlatformSummary = {
    platform: PlatformId;
    accounts: PlatformAccount[];
    followers: Metric;
    follower_growth: Metric;
    reach: Metric;
    impressions: Metric;
    views: Metric;
    engagement: Metric;
    engagement_rate: Metric;
    link_clicks: Metric;
    profile_visits: Metric;
    published_content: Metric;
    unavailable: string[];
};

type AudiencePoint = {
    date: string;
    [platform: string]: number | string;
};

type AuditMeta = {
    attribution_model: string;
    reporting_window_days: number;
    generated_at: string;
    currency: string;
};

type AnalyticsPayload = {
    accounts: PlatformAccount[];
    platform_summaries: PlatformSummary[];
    campaigns: Campaign[];
    content: ContentRow[];
    products: ProductRow[];
    funnel: FunnelStage[];
    revenue_breakdown: RevenueBreakdownRow[];
    audience_growth: AudiencePoint[];
    audit: AuditMeta;
};

const PLATFORMS: { id: PlatformId; label: string }[] = [
    { id: 'youtube', label: 'YouTube' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' },
];

const PLATFORM_LABEL: Record<PlatformId, string> = {
    youtube: 'YouTube',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
};

const PLATFORM_META: Record<PlatformId, { icon: IconType; color: string }> = {
    youtube: { icon: FaYoutube, color: 'text-red-600' },
    facebook: { icon: FaFacebook, color: 'text-blue-600' },
    instagram: { icon: FaInstagram, color: 'text-pink-600' },
    tiktok: { icon: FaTiktok, color: 'text-slate-900' },
};

const DATE_RANGES: { id: DateRangeId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last_7_days', label: 'Last 7 days' },
    { id: 'last_30_days', label: 'Last 30 days' },
    { id: 'last_90_days', label: 'Last 90 days' },
    { id: 'this_month', label: 'This month' },
    { id: 'previous_month', label: 'Previous month' },
    { id: 'custom', label: 'Custom range' },
];

const CONTENT_TYPES: { id: ContentType; label: string }[] = [
    { id: 'all', label: 'All content' },
    { id: 'video', label: 'Video' },
    { id: 'post', label: 'Post' },
    { id: 'reel', label: 'Reel' },
    { id: 'story', label: 'Story' },
    { id: 'short', label: 'Short' },
];

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'audience', label: 'Audience' },
    { id: 'content', label: 'Content' },
    { id: 'commerce', label: 'Social commerce' },
    { id: 'revenue', label: 'Revenue attribution' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'products', label: 'Products' },
    { id: 'reports', label: 'Reports & sync' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const REPORT_DEFINITIONS: {
    id: string;
    title: string;
    description: string;
}[] = [
        {
            id: 'social_overview',
            title: 'Social media overview',
            description: 'Followers, reach, impressions, views and engagement across all platforms.',
        },
        {
            id: 'platform_comparison',
            title: 'Platform comparison',
            description: 'Side-by-side platform performance with metric availability notes.',
        },
        {
            id: 'audience_growth',
            title: 'Audience growth',
            description: 'Follower growth per platform for the selected period.',
        },
        {
            id: 'content_performance',
            title: 'Content performance',
            description: 'Every tracked piece of content with engagement and attribution.',
        },
        {
            id: 'campaign_performance',
            title: 'Campaign performance',
            description: 'Organic and paid campaign metrics including ROAS where valid.',
        },
        {
            id: 'social_commerce',
            title: 'Social commerce',
            description: 'Funnel from social clicks to completed purchase.',
        },
        {
            id: 'revenue_attribution',
            title: 'Revenue attribution',
            description: 'Attributed revenue by platform, campaign, content and UTM.',
        },
        {
            id: 'product_performance',
            title: 'Product performance',
            description: 'Products receiving social traffic with conversion metrics.',
        },
    ];

type AnalyticsQuery = {
    range?: string;
    start?: string;
    end?: string;
    platform?: string;
    account?: string;
    campaign?: string;
    content_type?: string;
    compare?: boolean;
};

type AnalyticsApiClient = {
    social?: {
        analytics?: {
            report?: (q: AnalyticsQuery) => Promise<AnalyticsPayload>;
        };
    };
    socialAnalyticsReport?: (q: AnalyticsQuery) => Promise<AnalyticsPayload>;
};

async function fetchAnalyticsReport(query: AnalyticsQuery): Promise<AnalyticsPayload> {
    const client = api as unknown as AnalyticsApiClient;
    if (typeof client.social?.analytics?.report === 'function') {
        return client.social.analytics.report(query);
    }
    if (typeof client.socialAnalyticsReport === 'function') {
        return client.socialAnalyticsReport(query);
    }
    throw new Error('Analytics report endpoint is not available.');
}

function formatNumber(n: number | null | undefined): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined, currency = 'KES'): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: n >= 1000 ? 0 : 2,
        }).format(n);
    } catch {
        return `${currency} ${n.toFixed(2)}`;
    }
}

function formatPercent(n: number | null | undefined, digits = 1): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return `${n.toFixed(digits)}%`;
}

function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString();
    } catch {
        return '—';
    }
}

function delta(current: number | null, previous: number | null): number | null {
    if (
        current === null ||
        previous === null ||
        Number.isNaN(current) ||
        Number.isNaN(previous) ||
        previous === 0
    ) {
        return null;
    }
    return ((current - previous) / previous) * 100;
}

function detailOf(err: ApiError): string | null {
    if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
        const d = (err.data as { detail: unknown }).detail;
        if (typeof d === 'string') return d;
    }
    return null;
}

function metricValue(m: Metric | undefined): number | null {
    if (!m || !m.available) return null;
    return m.value;
}

function csvEscape(v: unknown): string {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null)[][]): string {
    const lines = [headers.map(csvEscape).join(',')];
    for (const row of rows) lines.push(row.map(csvEscape).join(','));
    return lines.join('\n');
}

function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function MetricDelta({ current, previous }: { current: number | null; previous: number | null }) {
    const d = delta(current, previous);
    if (d === null) {
        return <span className="text-slate-400">No previous-period data</span>;
    }
    const up = d >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(d).toFixed(1)}% vs previous
        </span>
    );
}

function StatCard({
    label,
    value,
    rawValue,
    previous,
    available = true,
    suffix,
    tooltip,
    icon,
}: {
    label: string;
    value: string;
    rawValue?: number | null;
    previous?: number | null;
    available?: boolean;
    suffix?: string;
    tooltip?: string;
    icon?: React.ReactNode;
}) {
    const prevVal = previous ?? null;
    return (
        <div className="bg-white border border-slate-200 rounded p-3">
            <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1" title={tooltip}>
                    {label}
                    {tooltip && <Info className="w-3 h-3 text-slate-400" />}
                </span>
                {icon && <span className="text-slate-400">{icon}</span>}
            </div>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-[20px] font-semibold text-slate-900 leading-none">
                    {available ? value : '—'}
                </span>
                {suffix && available && <span className="text-[11px] text-slate-500">{suffix}</span>}
            </div>
            {previous !== undefined && (
                <div className="mt-1 text-[11px]">
                    {!available ? (
                        <span className="text-slate-400">Not exposed by this platform</span>
                    ) : prevVal === null ? (
                        <span className="text-slate-400">No previous-period data</span>
                    ) : (
                        <MetricDelta current={rawValue ?? null} previous={prevVal} />
                    )}
                </div>
            )}
        </div>
    );
}

function MetricCell({ m, formatter }: { m: Metric; formatter?: (n: number) => string }) {
    if (!m.available) {
        return (
            <span className="text-slate-400" title="Not exposed by this platform">
                —
            </span>
        );
    }
    const v = m.value;
    if (v === null) return <span className="text-slate-400">—</span>;
    return <span>{formatter ? formatter(v) : formatNumber(v)}</span>;
}

function PlatformBadge({ platform }: { platform: PlatformId }) {
    const meta = PLATFORM_META[platform];
    const Icon = meta.icon;
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
            <span>{PLATFORM_LABEL[platform]}</span>
        </span>
    );
}

function SelectField({
    label,
    value,
    onChange,
    disabled,
    children,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-600">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 pr-7 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 disabled:bg-slate-100 disabled:text-slate-500 appearance-none"
                >
                    {children}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>
    );
}

function SectionCard({
    title,
    description,
    children,
    actions,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <section className="bg-white border border-slate-200 rounded">
            <header className="px-3 sm:px-4 py-2.5 border-b border-slate-200 flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
                    {description && <p className="text-[12px] text-slate-500 mt-0.5">{description}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </header>
            <div className="p-3 sm:p-4">{children}</div>
        </section>
    );
}

function LineChart({
    points,
    series,
    height = 220,
}: {
    points: AudiencePoint[];
    series: { key: string; color: string; label: string }[];
    height?: number;
}) {
    const width = 640;
    const padding = { top: 12, right: 12, bottom: 24, left: 40 };

    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const allValues: number[] = [];
    for (const p of points) {
        for (const s of series) {
            const v = p[s.key];
            if (typeof v === 'number') allValues.push(v);
        }
    }
    const max = allValues.length ? Math.max(...allValues) : 0;
    const min = 0;

    const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
    const yScale = (v: number) => padding.top + innerH - ((v - min) / (max - min || 1)) * innerH;

    if (!points.length) {
        return (
            <div className="text-center text-[12px] text-slate-500 py-10">
                No audience growth data available for this period.
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]" role="img" aria-label="Audience growth over time">
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = padding.top + innerH * t;
                    const val = max - (max - min) * t;
                    return (
                        <g key={t}>
                            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                            <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                                {formatNumber(val)}
                            </text>
                        </g>
                    );
                })}
                {series.map((s) => {
                    const coords = points
                        .map((p, i) => {
                            const v = p[s.key];
                            if (typeof v !== 'number') return null;
                            return `${padding.left + i * xStep},${yScale(v)}`;
                        })
                        .filter(Boolean) as string[];
                    if (!coords.length) return null;
                    return <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2" points={coords.join(' ')} />;
                })}
                {points.map((p, i) => {
                    if (points.length > 12 && i % Math.ceil(points.length / 8) !== 0) {
                        return null;
                    }
                    return (
                        <text key={p.date + i} x={padding.left + i * xStep} y={height - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
                            {p.date}
                        </text>
                    );
                })}
            </svg>
            <div className="flex flex-wrap items-center gap-3 mt-2 pl-1">
                {series.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                        <span className="w-3 h-0.5 rounded" style={{ background: s.color }} />
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function FunnelChart({ stages }: { stages: FunnelStage[] }) {
    if (!stages.length) {
        return <div className="text-center text-[12px] text-slate-500 py-6">No funnel events recorded for this period.</div>;
    }
    const max = Math.max(...stages.map((s) => s.value), 1);
    return (
        <div className="space-y-2">
            {stages.map((s) => {
                const pct = (s.value / max) * 100;
                return (
                    <div key={s.key} className="space-y-1" title={s.definition}>
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="text-slate-700 font-medium">{s.label}</span>
                            <span className="text-slate-900 font-semibold">{formatNumber(s.value)}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded">
                            <div className="h-2 rounded bg-blue-950" style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AnalyticsPageContent() {
    const [dateRange, setDateRange] = useState<DateRangeId>('last_30_days');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
    const [accountFilter, setAccountFilter] = useState<'all' | string>('all');
    const [campaignFilter, setCampaignFilter] = useState<'all' | string>('all');
    const [contentType, setContentType] = useState<ContentType>('all');
    const [comparePeriod, setComparePeriod] = useState(true);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<AnalyticsPayload | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    const [sortColumn, setSortColumn] = useState<keyof ContentRow>('views');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [productSort, setProductSort] = useState<'views' | 'orders' | 'revenue'>('revenue');

    const query = useMemo(
        () => ({
            range: dateRange,
            start: dateRange === 'custom' ? customStart : undefined,
            end: dateRange === 'custom' ? customEnd : undefined,
            platform: platformFilter === 'all' ? undefined : platformFilter,
            account: accountFilter === 'all' ? undefined : accountFilter,
            campaign: campaignFilter === 'all' ? undefined : campaignFilter,
            content_type: contentType === 'all' ? undefined : contentType,
            compare: comparePeriod,
        }),
        [dateRange, customStart, customEnd, platformFilter, accountFilter, campaignFilter, contentType, comparePeriod],
    );

    const loadData = useCallback(
        async (opts?: { silent?: boolean }) => {
            if (!opts?.silent) setLoading(true);
            else setRefreshing(true);
            setError('');
            try {
                const payload = await fetchAnalyticsReport(query);
                setData(payload);
            } catch (err) {
                if (err instanceof ApiError) {
                    setError(detailOf(err) ?? 'Could not load analytics. Please try again.');
                } else if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('Could not load analytics. Please try again.');
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [query],
    );

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const accountOptions = useMemo(() => {
        if (!data) return [];
        if (platformFilter === 'all') return data.accounts;
        return data.accounts.filter((a) => a.platform === platformFilter);
    }, [data, platformFilter]);

    const campaignOptions = useMemo(() => {
        if (!data) return [];
        return data.campaigns.filter(
            (c) =>
                (platformFilter === 'all' || c.platform === platformFilter) &&
                (accountFilter === 'all' || data.accounts.some((a) => a.id === accountFilter && a.platform === c.platform)),
        );
    }, [data, platformFilter, accountFilter]);

    const filteredContent = useMemo(() => {
        if (!data) return [];
        let rows = data.content.slice();
        if (platformFilter !== 'all') rows = rows.filter((r) => r.platform === platformFilter);
        if (contentType !== 'all') rows = rows.filter((r) => r.content_type === contentType);
        if (campaignFilter !== 'all') {
            rows = rows.filter((r) => !r.campaign_id || r.campaign_id === campaignFilter);
        }
        rows.sort((a, b) => {
            const av = metricValue(a[sortColumn] as unknown as Metric) ?? 0;
            const bv = metricValue(b[sortColumn] as unknown as Metric) ?? 0;
            return sortDir === 'asc' ? av - bv : bv - av;
        });
        return rows;
    }, [data, platformFilter, contentType, campaignFilter, sortColumn, sortDir]);

    const sortedProducts = useMemo(() => {
        if (!data) return [];
        const rows = data.products.slice();
        rows.sort((a, b) => {
            if (productSort === 'views') return b.product_views - a.product_views;
            if (productSort === 'orders') return b.orders - a.orders;
            return b.attributed_revenue - a.attributed_revenue;
        });
        return rows;
    }, [data, productSort]);

    const visiblePlatformSummaries = useMemo(() => {
        if (!data) return [];
        if (platformFilter === 'all') return data.platform_summaries;
        return data.platform_summaries.filter((s) => s.platform === platformFilter);
    }, [data, platformFilter]);

    const totals = useMemo(() => {
        if (!data) {
            return {
                followers: null as number | null,
                followersPrev: null as number | null,
                reach: null as number | null,
                reachPrev: null as number | null,
                impressions: null as number | null,
                impressionsPrev: null as number | null,
                views: null as number | null,
                viewsPrev: null as number | null,
                engagement: null as number | null,
                engagementPrev: null as number | null,
                engagement_rate: null as number | null,
                engagement_ratePrev: null as number | null,
                link_clicks: null as number | null,
                link_clicksPrev: null as number | null,
                profile_visits: null as number | null,
                profile_visitsPrev: null as number | null,
                published: null as number | null,
                publishedPrev: null as number | null,
            };
        }
        const sum = (sel: (s: PlatformSummary) => Metric | undefined): { cur: number | null; prev: number | null } => {
            let cur: number | null = 0;
            let prev: number | null = 0;
            let anyAvailable = false;
            for (const s of visiblePlatformSummaries) {
                const m = sel(s);
                if (!m || !m.available) continue;
                anyAvailable = true;
                if (m.value === null) cur = null;
                else if (cur !== null) cur += m.value;
                if (m.previous === null) prev = null;
                else if (prev !== null) prev += m.previous;
            }
            if (!anyAvailable) return { cur: null, prev: null };
            return { cur, prev };
        };
        const followers = sum((s) => s.followers);
        const reach = sum((s) => s.reach);
        const impressions = sum((s) => s.impressions);
        const views = sum((s) => s.views);
        const engagement = sum((s) => s.engagement);
        const linkClicks = sum((s) => s.link_clicks);
        const profileVisits = sum((s) => s.profile_visits);
        const published = sum((s) => s.published_content);

        const engRateCur = engagement.cur !== null && reach.cur ? (engagement.cur / reach.cur) * 100 : null;
        const engRatePrev = engagement.prev !== null && reach.prev ? (engagement.prev / reach.prev) * 100 : null;

        return {
            followers: followers.cur,
            followersPrev: followers.prev,
            reach: reach.cur,
            reachPrev: reach.prev,
            impressions: impressions.cur,
            impressionsPrev: impressions.prev,
            views: views.cur,
            viewsPrev: views.prev,
            engagement: engagement.cur,
            engagementPrev: engagement.prev,
            engagement_rate: engRateCur,
            engagement_ratePrev: engRatePrev,
            link_clicks: linkClicks.cur,
            link_clicksPrev: linkClicks.prev,
            profile_visits: profileVisits.cur,
            profile_visitsPrev: profileVisits.prev,
            published: published.cur,
            publishedPrev: published.prev,
        };
    }, [data, visiblePlatformSummaries]);

    const handleRefresh = () => void loadData({ silent: true });

    const handleExport = (reportId: string) => {
        if (!data) return;
        setNotice('');
        try {
            if (reportId === 'social_overview') {
                const headers = ['Platform', 'Followers', 'Reach', 'Impressions', 'Views', 'Engagement', 'Engagement rate %', 'Link clicks', 'Profile visits', 'Published content', 'Unavailable metrics'];
                const rows = visiblePlatformSummaries.map((s) => [
                    PLATFORM_LABEL[s.platform],
                    metricValue(s.followers),
                    metricValue(s.reach),
                    metricValue(s.impressions),
                    metricValue(s.views),
                    metricValue(s.engagement),
                    metricValue(s.engagement_rate),
                    metricValue(s.link_clicks),
                    metricValue(s.profile_visits),
                    metricValue(s.published_content),
                    s.unavailable.join('; '),
                ]);
                downloadCsv(`social-overview-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'platform_comparison') {
                const headers = ['Platform', 'Account', 'Followers', 'Reach', 'Impressions', 'Views', 'Engagement', 'Engagement rate %', 'Link clicks', 'Profile visits', 'Published content', 'Sync status', 'Last synced'];
                const rows = data.accounts.map((a) => {
                    const summary = data.platform_summaries.find((s) => s.platform === a.platform);
                    return [
                        PLATFORM_LABEL[a.platform],
                        a.handle,
                        summary ? metricValue(summary.followers) : null,
                        summary ? metricValue(summary.reach) : null,
                        summary ? metricValue(summary.impressions) : null,
                        summary ? metricValue(summary.views) : null,
                        summary ? metricValue(summary.engagement) : null,
                        summary ? metricValue(summary.engagement_rate) : null,
                        summary ? metricValue(summary.link_clicks) : null,
                        summary ? metricValue(summary.profile_visits) : null,
                        summary ? metricValue(summary.published_content) : null,
                        a.sync_status,
                        a.last_synced_at ?? '',
                    ];
                });
                downloadCsv(`platform-comparison-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'audience_growth') {
                const headers = ['Date', ...PLATFORMS.map((p) => p.label)];
                const rows = data.audience_growth.map((pt) => [
                    pt.date,
                    ...PLATFORMS.map((p) => (typeof pt[p.id] === 'number' ? (pt[p.id] as number) : null)),
                ]);
                downloadCsv(`audience-growth-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'content_performance') {
                const headers = ['Title', 'Platform', 'Account', 'Content type', 'Published', 'Views', 'Reach', 'Impressions', 'Likes', 'Comments', 'Shares', 'Saves', 'Engagement rate %', 'Link clicks', 'Attributed orders', 'Attributed revenue'];
                const rows = filteredContent.map((r) => [
                    r.title,
                    PLATFORM_LABEL[r.platform],
                    r.account_handle,
                    r.content_type,
                    r.published_at,
                    metricValue(r.views),
                    metricValue(r.reach),
                    metricValue(r.impressions),
                    metricValue(r.likes),
                    metricValue(r.comments),
                    metricValue(r.shares),
                    metricValue(r.saves),
                    metricValue(r.engagement_rate),
                    metricValue(r.link_clicks),
                    metricValue(r.attributed_orders),
                    metricValue(r.attributed_revenue),
                ]);
                downloadCsv(`content-performance-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'campaign_performance') {
                const headers = ['Campaign', 'Platform', 'Type', 'Reach', 'Impressions', 'Views', 'Engagement', 'Clicks', 'Website visits', 'Orders', 'Attributed revenue', 'Spend', 'ROAS'];
                const rows = data.campaigns.map((c) => [
                    c.name,
                    PLATFORM_LABEL[c.platform],
                    c.type,
                    metricValue(c.reach),
                    metricValue(c.impressions),
                    metricValue(c.views),
                    metricValue(c.engagement),
                    metricValue(c.clicks),
                    metricValue(c.website_visits),
                    metricValue(c.orders),
                    metricValue(c.attributed_revenue),
                    c.spend,
                    c.roas,
                ]);
                downloadCsv(`campaign-performance-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'social_commerce') {
                const headers = ['Stage', 'Value', 'Definition'];
                const rows = data.funnel.map((f) => [f.label, f.value, f.definition]);
                downloadCsv(`social-commerce-funnel-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'revenue_attribution') {
                const headers = ['Segment', 'Visits', 'Assisted orders', 'Attributed orders', 'Attributed revenue', 'Direct orders', 'Unattributed orders'];
                const rows = data.revenue_breakdown.map((r) => [
                    r.label,
                    r.visits,
                    r.assisted_orders,
                    r.attributed_orders,
                    r.attributed_revenue,
                    r.direct_orders,
                    r.unattributed_orders,
                ]);
                downloadCsv(`revenue-attribution-${Date.now()}.csv`, rowsToCsv(headers, rows));
            } else if (reportId === 'product_performance') {
                const headers = ['Product', 'SKU', 'Product views', 'Clicks', 'Add to cart', 'Orders', 'Units sold', 'Attributed revenue', 'Conversion rate %'];
                const rows = sortedProducts.map((p) => [
                    p.name,
                    p.sku,
                    p.product_views,
                    p.clicks,
                    p.add_to_cart,
                    p.orders,
                    p.units_sold,
                    p.attributed_revenue,
                    p.conversion_rate,
                ]);
                downloadCsv(`product-performance-${Date.now()}.csv`, rowsToCsv(headers, rows));
            }
            setNotice('Report exported.');
        } catch {
            setNotice('');
            setError('Could not generate the export. Please try again.');
        }
    };

    const toggleSort = (col: keyof ContentRow) => {
        if (sortColumn === col) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(col);
            setSortDir('desc');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-3 sm:p-5 space-y-3">
            <header className="bg-white border border-slate-200 rounded p-3 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <h1 className="text-[18px] font-semibold text-slate-900 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-950" />
                            Analytics &amp; Reports
                        </h1>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            Social media performance across YouTube, Facebook, Instagram and TikTok,
                            combined with attributed e-commerce results.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/analytics"
                            className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 rounded text-[12px] transition"
                        >
                            E-commerce analytics
                        </Link>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50"
                        >
                            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Refresh data
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExport('social_overview')}
                            disabled={!data}
                            className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export report
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <SelectField label="Date range" value={dateRange} onChange={(v) => setDateRange(v as DateRangeId)}>
                        {DATE_RANGES.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="Platform"
                        value={platformFilter}
                        onChange={(v) => {
                            setPlatformFilter(v as 'all' | PlatformId);
                            setAccountFilter('all');
                            setCampaignFilter('all');
                        }}
                    >
                        <option value="all">All platforms</option>
                        {PLATFORMS.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField label="Account" value={accountFilter} onChange={setAccountFilter}>
                        <option value="all">All accounts</option>
                        {accountOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {PLATFORM_LABEL[a.platform]} · {a.handle}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField label="Campaign" value={campaignFilter} onChange={setCampaignFilter}>
                        <option value="all">All campaigns</option>
                        {campaignOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField label="Content type" value={contentType} onChange={(v) => setContentType(v as ContentType)}>
                        {CONTENT_TYPES.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label}
                            </option>
                        ))}
                    </SelectField>

                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-600">Compare period</label>
                        <label className="inline-flex items-center gap-2 w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-900 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={comparePeriod}
                                onChange={(e) => setComparePeriod(e.target.checked)}
                                className="accent-blue-950"
                            />
                            Previous period
                        </label>
                    </div>
                </div>

                {dateRange === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-slate-600">Custom start</label>
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-slate-600">Custom end</label>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            className={`px-2.5 py-1.5 text-[12px] font-medium rounded transition ${activeTab === t.id
                                    ? 'bg-blue-950 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {error && <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700">{error}</div>}
                {notice && !error && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-[12px] text-emerald-700">{notice}</div>
                )}
            </header>

            {loading ? (
                <div className="bg-white border border-slate-200 rounded p-10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
            ) : !data ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-[13px] text-slate-500 text-center">
                    No analytics data is available for this selection.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        <StatCard
                            label="Followers / subscribers"
                            value={formatNumber(totals.followers)}
                            rawValue={totals.followers}
                            previous={comparePeriod ? totals.followersPrev : undefined}
                            available={totals.followers !== null}
                            tooltip="Combined followers and subscribers across authorised accounts. Platforms define this differently; see platform comparison."
                            icon={<Users className="w-4 h-4" />}
                        />
                        <StatCard
                            label="Reach"
                            value={formatNumber(totals.reach)}
                            rawValue={totals.reach}
                            previous={comparePeriod ? totals.reachPrev : undefined}
                            available={totals.reach !== null}
                            tooltip="Unique accounts reached. Only included for platforms that expose reach."
                        />
                        <StatCard
                            label="Impressions"
                            value={formatNumber(totals.impressions)}
                            rawValue={totals.impressions}
                            previous={comparePeriod ? totals.impressionsPrev : undefined}
                            available={totals.impressions !== null}
                        />
                        <StatCard
                            label="Views"
                            value={formatNumber(totals.views)}
                            rawValue={totals.views}
                            previous={comparePeriod ? totals.viewsPrev : undefined}
                            available={totals.views !== null}
                            tooltip="Platform-specific view definitions apply. Not directly comparable across platforms without adjustment."
                        />
                        <StatCard
                            label="Engagement"
                            value={formatNumber(totals.engagement)}
                            rawValue={totals.engagement}
                            previous={comparePeriod ? totals.engagementPrev : undefined}
                            available={totals.engagement !== null}
                        />
                        <StatCard
                            label="Engagement rate"
                            value={formatPercent(totals.engagement_rate)}
                            rawValue={totals.engagement_rate}
                            previous={comparePeriod ? totals.engagement_ratePrev : undefined}
                            available={totals.engagement_rate !== null}
                        />
                        <StatCard
                            label="Link clicks"
                            value={formatNumber(totals.link_clicks)}
                            rawValue={totals.link_clicks}
                            previous={comparePeriod ? totals.link_clicksPrev : undefined}
                            available={totals.link_clicks !== null}
                        />
                        <StatCard
                            label="Profile visits"
                            value={formatNumber(totals.profile_visits)}
                            rawValue={totals.profile_visits}
                            previous={comparePeriod ? totals.profile_visitsPrev : undefined}
                            available={totals.profile_visits !== null}
                            tooltip="Profile visits are only exposed by some platforms."
                        />
                        <StatCard
                            label="Published content"
                            value={formatNumber(totals.published)}
                            rawValue={totals.published}
                            previous={comparePeriod ? totals.publishedPrev : undefined}
                            available={totals.published !== null}
                        />
                    </div>

                    {activeTab === 'overview' && (
                        <div className="space-y-3">
                            <SectionCard
                                title="Platform performance comparison"
                                description="Metrics are reported per platform. Unavailable metrics are marked, not inferred."
                            >
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[12px]">
                                        <thead>
                                            <tr className="text-left text-slate-500 border-b border-slate-200">
                                                <th className="py-1.5 pr-3 font-medium">Platform</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Followers</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Reach</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Impressions</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Views</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Engagement</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Eng. rate</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Link clicks</th>
                                                <th className="py-1.5 px-2 font-medium text-right">Profile visits</th>
                                                <th className="py-1.5 pl-2 font-medium text-right">Published</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visiblePlatformSummaries.map((s) => (
                                                <tr key={s.platform} className="border-b border-slate-100 last:border-b-0">
                                                    <td className="py-1.5 pr-3"><PlatformBadge platform={s.platform} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.followers} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.reach} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.impressions} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.views} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.engagement} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.engagement_rate} formatter={(n) => formatPercent(n)} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.link_clicks} /></td>
                                                    <td className="py-1.5 px-2 text-right"><MetricCell m={s.profile_visits} /></td>
                                                    <td className="py-1.5 pl-2 text-right"><MetricCell m={s.published_content} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {visiblePlatformSummaries.some((s) => s.unavailable.length > 0) && (
                                    <div className="mt-3 space-y-1">
                                        {visiblePlatformSummaries
                                            .filter((s) => s.unavailable.length > 0)
                                            .map((s) => (
                                                <p key={s.platform} className="text-[11px] text-slate-500">
                                                    <span className="font-medium text-slate-700">{PLATFORM_LABEL[s.platform]}:</span>{' '}
                                                    {s.unavailable.join(', ')} unavailable for the connected account.
                                                </p>
                                            ))}
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard
                                title="Per-platform detail"
                                description="Metric definitions differ across platforms. Aggregations above are only shown where the underlying metric is comparable."
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {visiblePlatformSummaries.map((s) => (
                                        <div key={s.platform} className="border border-slate-200 rounded p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <PlatformBadge platform={s.platform} />
                                                <span className="text-[11px] text-slate-400">
                                                    {s.accounts.map((a) => a.handle).join(', ') || 'No connected account'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-[12px]">
                                                <div>
                                                    <p className="text-slate-500">Followers</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.followers} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Growth</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.follower_growth} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Views</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.views} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Reach</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.reach} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Impressions</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.impressions} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Engagement</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.engagement} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Eng. rate</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.engagement_rate} formatter={(n) => formatPercent(n)} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Link clicks</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.link_clicks} /></p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Profile visits</p>
                                                    <p className="font-semibold text-slate-900"><MetricCell m={s.profile_visits} /></p>
                                                </div>
                                            </div>
                                            {s.unavailable.length > 0 && (
                                                <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                                    <span>Not available: {s.unavailable.join(', ')}.</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {activeTab === 'audience' && (
                        <SectionCard
                            title="Audience growth"
                            description="Follower growth per platform for the selected period. Demographic data is only shown when an authorised platform source exposes it."
                        >
                            <LineChart
                                points={data.audience_growth}
                                series={PLATFORMS.map((p) => ({
                                    key: p.id,
                                    label: p.label,
                                    color:
                                        p.id === 'youtube'
                                            ? '#ef4444'
                                            : p.id === 'facebook'
                                                ? '#2563eb'
                                                : p.id === 'instagram'
                                                    ? '#ec4899'
                                                    : '#0f172a',
                                }))}
                            />
                            <p className="text-[11px] text-slate-500 mt-3">
                                Best-performing periods are derived from recorded engagement timing.
                                Sensitive demographic attributes are never inferred or displayed
                                without an authorised source.
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'content' && (
                        <SectionCard
                            title="Content performance"
                            description="Every tracked piece of content. Sort by any metric; unavailable metrics are marked."
                            actions={
                                <button
                                    type="button"
                                    onClick={() => handleExport('content_performance')}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1 rounded text-[11px]"
                                >
                                    <Download className="w-3 h-3" /> Export
                                </button>
                            }
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-200">
                                            <th className="py-1.5 pr-2 font-medium">Content</th>
                                            <th className="py-1.5 px-2 font-medium">Platform</th>
                                            <th className="py-1.5 px-2 font-medium">Type</th>
                                            <th className="py-1.5 px-2 font-medium">Published</th>
                                            {(
                                                [
                                                    ['views', 'Views'],
                                                    ['reach', 'Reach'],
                                                    ['impressions', 'Impr.'],
                                                    ['likes', 'Likes'],
                                                    ['comments', 'Comments'],
                                                    ['shares', 'Shares'],
                                                    ['saves', 'Saves'],
                                                    ['engagement_rate', 'Eng. rate'],
                                                    ['link_clicks', 'Clicks'],
                                                    ['attributed_orders', 'Orders'],
                                                    ['attributed_revenue', 'Revenue'],
                                                ] as [keyof ContentRow, string][]
                                            ).map(([key, label]) => (
                                                <th
                                                    key={key}
                                                    className="py-1.5 px-2 font-medium text-right cursor-pointer select-none whitespace-nowrap"
                                                    onClick={() => toggleSort(key)}
                                                >
                                                    {label}
                                                    {sortColumn === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredContent.map((r) => (
                                            <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
                                                <td className="py-1.5 pr-2">
                                                    <div className="flex items-center gap-2">
                                                        {r.thumbnail_url ? (
                                                            <img src={r.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-slate-900 truncate max-w-[220px]">{r.title}</p>
                                                            <p className="text-[11px] text-slate-500">{r.account_handle}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-2"><PlatformBadge platform={r.platform} /></td>
                                                <td className="py-1.5 px-2 capitalize">{r.content_type}</td>
                                                <td className="py-1.5 px-2">{formatDate(r.published_at)}</td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.views} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.reach} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.impressions} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.likes} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.comments} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.shares} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.saves} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.engagement_rate} formatter={(n) => formatPercent(n)} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.link_clicks} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.attributed_orders} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={r.attributed_revenue} formatter={(n) => formatCurrency(n, data.audit.currency)} /></td>
                                            </tr>
                                        ))}
                                        {!filteredContent.length && (
                                            <tr>
                                                <td colSpan={15} className="py-6 text-center text-slate-500">
                                                    No content matches the current filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    )}

                    {activeTab === 'commerce' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <SectionCard
                                title="Social conversion funnel"
                                description="Uses tracked website events. A social click is not assumed to become a visit."
                            >
                                <FunnelChart stages={data.funnel} />
                                <p className="text-[11px] text-slate-500 mt-3">
                                    Attribution model: <span className="font-medium text-slate-700">{data.audit.attribution_model}</span>.
                                    Reporting window: <span className="font-medium text-slate-700">{data.audit.reporting_window_days} days</span>.
                                </p>
                            </SectionCard>
                            <SectionCard
                                title="Social commerce summary"
                                description="Derived from existing website analytics and verified order records."
                            >
                                <div className="grid grid-cols-2 gap-2 text-[12px]">
                                    {data.funnel.map((s) => (
                                        <div key={s.key} className="border border-slate-200 rounded p-2">
                                            <p className="text-slate-500">{s.label}</p>
                                            <p className="text-[16px] font-semibold text-slate-900">{formatNumber(s.value)}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{s.definition}</p>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {activeTab === 'revenue' && (
                        <SectionCard
                            title="Revenue attribution"
                            description={`Paid revenue is derived from verified payment records. Attribution model: ${data.audit.attribution_model}, window: ${data.audit.reporting_window_days} days. Duplicate attributions across platforms are prevented at the attribution layer.`}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-200">
                                            <th className="py-1.5 pr-3 font-medium">Segment</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Visits</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Assisted orders</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Attributed orders</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Attributed revenue</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Direct orders</th>
                                            <th className="py-1.5 pl-2 font-medium text-right">Unattributed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.revenue_breakdown.map((r) => (
                                            <tr key={r.key} className="border-b border-slate-100 last:border-b-0">
                                                <td className="py-1.5 pr-3 font-medium text-slate-800">{r.label}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(r.visits)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(r.assisted_orders)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(r.attributed_orders)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatCurrency(r.attributed_revenue, data.audit.currency)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(r.direct_orders)}</td>
                                                <td className="py-1.5 pl-2 text-right">{formatNumber(r.unattributed_orders)}</td>
                                            </tr>
                                        ))}
                                        {!data.revenue_breakdown.length && (
                                            <tr>
                                                <td colSpan={7} className="py-6 text-center text-slate-500">
                                                    No attribution data available for this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-3">
                                Pending, failed and refunded transactions are excluded from attributed revenue in line with existing accounting rules.
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'campaigns' && (
                        <SectionCard
                            title="Campaign performance"
                            description="Organic and paid campaigns are separated. ROAS is only calculated when valid spend and attributed revenue exist."
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-200">
                                            <th className="py-1.5 pr-3 font-medium">Campaign</th>
                                            <th className="py-1.5 px-2 font-medium">Platform</th>
                                            <th className="py-1.5 px-2 font-medium">Type</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Reach</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Impr.</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Views</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Engagement</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Clicks</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Visits</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Orders</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Revenue</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Spend</th>
                                            <th className="py-1.5 pl-2 font-medium text-right">ROAS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.campaigns.map((c) => (
                                            <tr key={c.id} className="border-b border-slate-100 last:border-b-0">
                                                <td className="py-1.5 pr-3 font-medium text-slate-800">{c.name}</td>
                                                <td className="py-1.5 px-2"><PlatformBadge platform={c.platform} /></td>
                                                <td className="py-1.5 px-2 capitalize">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${c.type === 'paid' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                                        {c.type}
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.reach} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.impressions} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.views} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.engagement} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.clicks} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.website_visits} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.orders} /></td>
                                                <td className="py-1.5 px-2 text-right"><MetricCell m={c.attributed_revenue} formatter={(n) => formatCurrency(n, data.audit.currency)} /></td>
                                                <td className="py-1.5 px-2 text-right">{c.spend === null ? '—' : formatCurrency(c.spend, data.audit.currency)}</td>
                                                <td className="py-1.5 pl-2 text-right">{c.roas === null ? '—' : `${c.roas.toFixed(2)}×`}</td>
                                            </tr>
                                        ))}
                                        {!data.campaigns.length && (
                                            <tr>
                                                <td colSpan={13} className="py-6 text-center text-slate-500">
                                                    No campaigns match the current filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    )}

                    {activeTab === 'products' && (
                        <SectionCard
                            title="Products receiving social traffic"
                            description="Product catalogue data combined with website analytics attribution."
                            actions={
                                <div className="flex items-center gap-1">
                                    {(['views', 'orders', 'revenue'] as const).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setProductSort(s)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${productSort === s
                                                    ? 'bg-blue-950 text-white border-blue-950'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            Sort: {s === 'views' ? 'Views' : s === 'orders' ? 'Orders' : 'Revenue'}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handleExport('product_performance')}
                                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1 rounded text-[11px]"
                                    >
                                        <Download className="w-3 h-3" /> Export
                                    </button>
                                </div>
                            }
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-200">
                                            <th className="py-1.5 pr-3 font-medium">Product</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Views</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Clicks</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Add to cart</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Orders</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Units</th>
                                            <th className="py-1.5 px-2 font-medium text-right">Revenue</th>
                                            <th className="py-1.5 pl-2 font-medium text-right">Conv. rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedProducts.map((p) => (
                                            <tr key={p.id} className="border-b border-slate-100 last:border-b-0">
                                                <td className="py-1.5 pr-3">
                                                    <div className="flex items-center gap-2">
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
                                                                <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-slate-900 truncate max-w-[240px]">{p.name}</p>
                                                            <p className="text-[11px] text-slate-500">{p.sku}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(p.product_views)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(p.clicks)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(p.add_to_cart)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(p.orders)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatNumber(p.units_sold)}</td>
                                                <td className="py-1.5 px-2 text-right">{formatCurrency(p.attributed_revenue, data.audit.currency)}</td>
                                                <td className="py-1.5 pl-2 text-right">{formatPercent(p.conversion_rate, 2)}</td>
                                            </tr>
                                        ))}
                                        {!sortedProducts.length && (
                                            <tr>
                                                <td colSpan={8} className="py-6 text-center text-slate-500">
                                                    No products received social traffic in this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    )}

                    {activeTab === 'reports' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <div className="lg:col-span-2 space-y-3">
                                <SectionCard
                                    title="Predefined reports"
                                    description="Reports respect the selected date range, platform and other filters. Exports are generated from real data only."
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {REPORT_DEFINITIONS.map((r) => (
                                            <div key={r.id} className="border border-slate-200 rounded p-2.5 flex flex-col gap-1.5">
                                                <div>
                                                    <p className="text-[13px] font-medium text-slate-900">{r.title}</p>
                                                    <p className="text-[11px] text-slate-500">{r.description}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleExport(r.id)}
                                                    className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1 rounded text-[11px] self-start"
                                                >
                                                    <Download className="w-3 h-3" /> Export CSV
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </div>
                            <div className="space-y-3">
                                <SectionCard title="Data synchronization" description="Last sync, coverage and missing metrics per platform.">
                                    <ul className="space-y-2">
                                        {data.accounts.map((a) => (
                                            <li key={a.id} className="border border-slate-200 rounded p-2">
                                                <div className="flex items-center justify-between">
                                                    <PlatformBadge platform={a.platform} />
                                                    <span className="text-[11px] text-slate-500">{a.handle}</span>
                                                </div>
                                                <div className="mt-1 text-[11px] text-slate-600 space-y-0.5">
                                                    <p>Last synced: {formatDateTime(a.last_synced_at)}</p>
                                                    <p>
                                                        Coverage: {formatDate(a.coverage_start)} – {formatDate(a.coverage_end)}
                                                    </p>
                                                    <p>
                                                        Status:{' '}
                                                        <span
                                                            className={
                                                                a.sync_status === 'ok'
                                                                    ? 'text-emerald-600 font-medium'
                                                                    : a.sync_status === 'failed'
                                                                        ? 'text-rose-600 font-medium'
                                                                        : a.sync_status === 'pending'
                                                                            ? 'text-amber-600 font-medium'
                                                                            : 'text-slate-500 font-medium'
                                                            }
                                                        >
                                                            {a.sync_status}
                                                        </span>
                                                    </p>
                                                    {a.missing_metrics.length > 0 && (
                                                        <p className="text-amber-700">Missing: {a.missing_metrics.join(', ')}</p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                        {!data.accounts.length && (
                                            <li className="text-[12px] text-slate-500">No social accounts are connected.</li>
                                        )}
                                    </ul>
                                </SectionCard>

                                <SectionCard title="Report metadata" description="Transparency about how numbers are produced.">
                                    <dl className="text-[12px] text-slate-700 space-y-1">
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-slate-500">Attribution model</dt>
                                            <dd className="font-medium">{data.audit.attribution_model}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-slate-500">Reporting window</dt>
                                            <dd className="font-medium">{data.audit.reporting_window_days} days</dd>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-slate-500">Currency</dt>
                                            <dd className="font-medium">{data.audit.currency}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-slate-500">Generated</dt>
                                            <dd className="font-medium">{formatDateTime(data.audit.generated_at)}</dd>
                                        </div>
                                    </dl>
                                </SectionCard>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function SocialAnalyticsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
            }
        >
            <AnalyticsPageContent />
        </Suspense>
    );
}