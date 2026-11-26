'use client';

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import {
    BarChart3,
    MessageSquare,
    Users,
    Megaphone,
    Settings,
    Activity,
    Calendar,
    ChevronDown,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    Send,
    Inbox,
    Eye,
    TrendingUp,
    TrendingDown,
    Minus,
    DollarSign,
    ShoppingBag,
    UserPlus,
    UserCheck,
    ShieldCheck,
    ShieldOff,
    MousePointerClick,
    ExternalLink,
    RotateCw,
    Phone,
    Building2,
    Globe,
    Webhook,
    ShieldAlert,
    Lock,
    Unplug,
    Plug,
    Info,
    Timer,
} from 'lucide-react';

type Tab = 'analytics' | 'connection' | 'health';

type Period = 'today' | '7d' | '30d' | '90d' | 'custom';

type MetricValue = {
    value: number | null;
    previous: number | null;
    available: boolean;
};

type AnalyticsOverview = {
    sent: MetricValue;
    delivered: MetricValue;
    read: MetricValue;
    failed: MetricValue;
    incoming: MetricValue;
    outgoing: MetricValue;
    activeConversations: MetricValue;
    newContacts: MetricValue;
    avgResponseTimeSeconds: MetricValue;
    unanswered: MetricValue;
};

type MessagingSeriesPoint = {
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    incoming: number;
    outgoing: number;
};

type TemplateBreakdown = {
    templateName: string;
    category: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
};

type FailureBreakdown = {
    reason: string;
    count: number;
};

type MessagingPerformance = {
    series: MessagingSeriesPoint[];
    byTemplate: TemplateBreakdown[];
    failures: FailureBreakdown[];
};

type CustomerPerformance = {
    newContacts: MetricValue;
    returningCustomers: MetricValue;
    startedConversations: MetricValue;
    enquiries: MetricValue;
    optIns: MetricValue;
    optOuts: MetricValue;
    responseRate: MetricValue;
    repeatPurchases: MetricValue;
};

type CommercePerformance = {
    referredVisits: MetricValue;
    productPageVisits: MetricValue;
    enquiries: MetricValue;
    attributedOrders: MetricValue;
    attributedRevenue: MetricValue;
    conversionRate: MetricValue;
    averageOrderValue: MetricValue;
};

type CampaignMetric = {
    id: string;
    name: string;
    category: string;
    submitted: number;
    delivered: number;
    read: number;
    failed: number;
    clicks: number;
    visits: number;
    orders: number;
    revenue: number;
    cost: number;
    currency: string;
};

type MessagingCosts = {
    available: boolean;
    total: number | null;
    currency: string | null;
    byCategory: Array<{ category: string; cost: number }> | null;
    campaignCost: number | null;
    note: string | null;
};

type AnalyticsData = {
    overview: AnalyticsOverview;
    messaging: MessagingPerformance;
    customers: CustomerPerformance;
    commerce: CommercePerformance;
    campaigns: CampaignMetric[];
    costs: MessagingCosts;
};

type ConnectionInfo = {
    state:
    | 'connected'
    | 'connecting'
    | 'disconnected'
    | 'expired'
    | 'action_required'
    | 'error';
    metaBusinessPortfolio: string | null;
    wabaId: string | null;
    wabaName: string | null;
    phoneNumberId: string | null;
    displayName: string | null;
    phoneNumber: string | null;
    phoneVerified: boolean | null;
    businessProfile: {
        about: string | null;
        address: string | null;
        website: string | null;
        vertical: string | null;
    } | null;
    catalogueName: string | null;
    catalogueId: string | null;
    permissions: Array<{ name: string; granted: boolean }>;
    lastSyncedAt: string | null;
    requiredAction: string | null;
};

type HealthInfo = {
    api: {
        status: 'ok' | 'degraded' | 'down';
        lastRequestAt: string | null;
        failedRequests24h: number;
    };
    webhook: {
        status: 'ok' | 'degraded' | 'down';
        lastEventAt: string | null;
        verified: boolean;
    };
    token: {
        status: 'ok' | 'expiring' | 'expired';
        expiresAt: string | null;
    };
    errors: Array<{
        id: string;
        kind: 'api' | 'webhook' | 'rate_limit' | 'permission' | 'sync';
        message: string;
        at: string;
    }>;
};

const TABS: Array<{ key: Tab; label: string; icon: typeof BarChart3 }> = [
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'connection', label: 'Connection & settings', icon: Settings },
    { key: 'health', label: 'API & webhook health', icon: Activity },
];

const PERIODS: Array<{ value: Period; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' },
];

function formatNumber(v: number | null): string {
    if (v === null) return '—';
    return new Intl.NumberFormat('en-US').format(v);
}

function formatCurrency(v: number | null, currency = 'KES'): string {
    if (v === null) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(v);
}

function formatPercent(v: number | null): string {
    if (v === null) return '—';
    return `${v.toFixed(1)}%`;
}

function formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

function formatDuration(seconds: number | null): string {
    if (seconds === null) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

function DeltaBadge({
    current,
    previous,
}: {
    current: number | null;
    previous: number | null;
}) {
    if (current === null || previous === null || previous === 0) {
        return <span className="text-[11px] text-slate-400">—</span>;
    }
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.5) {
        return (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                <Minus className="w-3 h-3" />
                0%
            </span>
        );
    }
    const up = pct > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-emerald-600' : 'text-rose-600'}`}
        >
            <Icon className="w-3 h-3" />
            {up ? '+' : ''}
            {pct.toFixed(1)}%
        </span>
    );
}

function KpiCard({
    label,
    icon: Icon,
    metric,
    hint,
    format = 'number',
}: {
    label: string;
    icon: typeof Send;
    metric: MetricValue;
    hint?: string;
    format?: 'number' | 'currency' | 'percent' | 'duration';
}) {
    const formatted =
        format === 'currency'
            ? formatCurrency(metric.value)
            : format === 'percent'
                ? formatPercent(metric.value)
                : format === 'duration'
                    ? formatDuration(metric.value)
                    : formatNumber(metric.value);
    return (
        <div className="bg-white border border-slate-200 rounded p-3">
            <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded bg-slate-50 text-slate-600 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5" />
                </div>
                {metric.available && metric.previous !== null && (
                    <DeltaBadge current={metric.value} previous={metric.previous} />
                )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 truncate">{label}</p>
            <p className="text-[18px] font-semibold text-slate-900 leading-tight mt-0.5">
                {metric.available ? (
                    formatted
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </p>
            {hint && (
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{hint}</p>
            )}
        </div>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: typeof BarChart3;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-2 mb-2">
            <div className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
                {description && (
                    <p className="text-[11px] text-slate-500">{description}</p>
                )}
            </div>
            {action}
        </div>
    );
}

function MessagingChart({
    series,
    loading,
}: {
    series: MessagingSeriesPoint[];
    loading: boolean;
}) {
    const max = useMemo(() => {
        let m = 0;
        for (const p of series) {
            m = Math.max(m, p.sent, p.delivered, p.read, p.failed, p.incoming);
        }
        return m || 1;
    }, [series]);

    const lines = [
        { key: 'sent', label: 'Sent', color: 'bg-blue-500' },
        { key: 'delivered', label: 'Delivered', color: 'bg-emerald-500' },
        { key: 'read', label: 'Read', color: 'bg-indigo-500' },
        { key: 'failed', label: 'Failed', color: 'bg-rose-500' },
        { key: 'incoming', label: 'Incoming', color: 'bg-amber-500' },
    ] as const;

    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center text-[12px] text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading activity…
            </div>
        );
    }
    if (series.length === 0) {
        return (
            <div className="h-48 flex flex-col items-center justify-center text-[12px] text-slate-500">
                <MessageSquare className="w-5 h-5 text-slate-300 mb-1" />
                No messaging activity in this period.
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
                {lines.map((l) => (
                    <span
                        key={l.key}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-600"
                    >
                        <span className={`w-2 h-2 rounded-sm ${l.color}`} />
                        {l.label}
                    </span>
                ))}
            </div>
            <div className="flex items-end gap-1 h-40">
                {series.map((p) => (
                    <div
                        key={p.date}
                        className="flex-1 flex items-end gap-0.5 h-full"
                        title={p.date}
                    >
                        {lines.map((l) => (
                            <div
                                key={l.key}
                                className={`flex-1 ${l.color} rounded-sm`}
                                style={{
                                    height: `${Math.max(
                                        ((p[l.key] as number) / max) * 100,
                                        p[l.key] > 0 ? 2 : 0,
                                    )}%`,
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{series[0]?.date}</span>
                <span>{series[series.length - 1]?.date}</span>
            </div>
        </div>
    );
}

function ConnectionStatusPill({ state }: { state: ConnectionInfo['state'] }) {
    const map = {
        connected: {
            label: 'Connected',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-700',
            dot: 'bg-emerald-500',
        },
        connecting: {
            label: 'Connecting',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700',
            dot: 'bg-amber-500',
        },
        disconnected: {
            label: 'Disconnected',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            text: 'text-slate-600',
            dot: 'bg-slate-400',
        },
        expired: {
            label: 'Connection expired',
            bg: 'bg-orange-50',
            border: 'border-orange-200',
            text: 'text-orange-700',
            dot: 'bg-orange-500',
        },
        action_required: {
            label: 'Action required',
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-700',
            dot: 'bg-rose-500',
        },
        error: {
            label: 'Error',
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            text: 'text-rose-700',
            dot: 'bg-rose-500',
        },
    } as const;
    const m = map[state];
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
            {m.label}
        </span>
    );
}

function HealthDot({
    status,
}: {
    status: 'ok' | 'degraded' | 'down' | 'expiring' | 'expired';
}) {
    const color =
        status === 'ok'
            ? 'bg-emerald-500'
            : status === 'degraded' || status === 'expiring'
                ? 'bg-amber-500'
                : 'bg-rose-500';
    return <span className={`w-2 h-2 rounded-full ${color}`} />;
}

function AnalyticsTabContent() {
    const [period, setPeriod] = useState<Period>('30d');
    const [periodOpen, setPeriodOpen] = useState(false);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setLoading(true);
            setError('');
            try {
                const res = await adminApi.whatsapp.analytics.dashboard(
                    {
                        period,
                        ...(period === 'custom' && customFrom
                            ? { from: customFrom }
                            : {}),
                        ...(period === 'custom' && customTo
                            ? { to: customTo }
                            : {}),
                    },
                    signal,
                );
                setData(res);
            } catch (err) {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setError('Could not load analytics.');
            } finally {
                setLoading(false);
            }
        },
        [period, customFrom, customTo],
    );

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? '';

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0">
                    <h2 className="text-[13px] font-semibold text-slate-900">
                        Performance overview
                    </h2>
                    <p className="text-[11px] text-slate-500">
                        Messaging, customers and measurable commerce.
                    </p>
                </div>
                <div className="flex-1" />
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setPeriodOpen((o) => !o)}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50"
                    >
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {periodLabel}
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    {periodOpen && (
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded shadow-lg z-30 py-1">
                            {PERIODS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => {
                                        setPeriod(p.value);
                                        setPeriodOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 ${period === p.value ? 'text-blue-950 font-medium' : 'text-slate-700'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {period === 'custom' && (
                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900"
                        />
                        <span className="text-slate-400 text-[11px]">to</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900"
                        />
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Refresh
                </button>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                </div>
            )}

            {loading && !data ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-[88px] bg-white border border-slate-200 rounded animate-pulse"
                        />
                    ))}
                </div>
            ) : data ? (
                <>
                    <SectionHeader
                        icon={MessageSquare}
                        title="Messaging"
                        description="API acceptance, delivery and engagement metrics."
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <KpiCard label="Messages sent" icon={Send} metric={data.overview.sent} hint="API accepted" />
                        <KpiCard label="Delivered" icon={CheckCircle2} metric={data.overview.delivered} hint="Confirmed by WhatsApp" />
                        <KpiCard label="Read" icon={Eye} metric={data.overview.read} />
                        <KpiCard label="Failed" icon={XCircle} metric={data.overview.failed} />
                        <KpiCard label="Incoming" icon={Inbox} metric={data.overview.incoming} />
                        <KpiCard label="Outgoing" icon={MessageSquare} metric={data.overview.outgoing} />
                        <KpiCard label="Active conversations" icon={Users} metric={data.overview.activeConversations} />
                        <KpiCard label="Unanswered" icon={Clock} metric={data.overview.unanswered} />
                        <KpiCard label="New contacts" icon={UserPlus} metric={data.overview.newContacts} />
                        <KpiCard label="Avg response time" icon={Timer} metric={data.overview.avgResponseTimeSeconds} format="duration" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[12px] font-semibold text-slate-800">
                                Messaging over time
                            </h3>
                            <span className="text-[11px] text-slate-500">{periodLabel}</span>
                        </div>
                        <MessagingChart series={data.messaging.series} loading={loading} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <div className="bg-white border border-slate-200 rounded">
                            <div className="px-3 py-2 border-b border-slate-100">
                                <h3 className="text-[12px] font-semibold text-slate-800">
                                    Performance by template
                                </h3>
                            </div>
                            <div className="p-3">
                                {data.messaging.byTemplate.length === 0 ? (
                                    <p className="text-[12px] text-slate-500">No template activity.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-100">
                                                    <th className="text-left font-medium py-1">Template</th>
                                                    <th className="text-right font-medium py-1">Sent</th>
                                                    <th className="text-right font-medium py-1">Deliv.</th>
                                                    <th className="text-right font-medium py-1">Read</th>
                                                    <th className="text-right font-medium py-1">Failed</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {data.messaging.byTemplate.map((t) => (
                                                    <tr key={`${t.templateName}-${t.category}`}>
                                                        <td className="py-1 text-[11px] text-slate-800 truncate max-w-[160px]">
                                                            {t.templateName}
                                                        </td>
                                                        <td className="py-1 text-[11px] text-slate-700 text-right">{t.sent}</td>
                                                        <td className="py-1 text-[11px] text-emerald-700 text-right">{t.delivered}</td>
                                                        <td className="py-1 text-[11px] text-indigo-700 text-right">{t.read}</td>
                                                        <td className="py-1 text-[11px] text-rose-600 text-right">{t.failed}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded">
                            <div className="px-3 py-2 border-b border-slate-100">
                                <h3 className="text-[12px] font-semibold text-slate-800">
                                    Failure reasons
                                </h3>
                            </div>
                            <div className="p-3">
                                {data.messaging.failures.length === 0 ? (
                                    <p className="text-[12px] text-slate-500">No failures in this period.</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {data.messaging.failures.map((f) => (
                                            <li
                                                key={f.reason}
                                                className="flex items-center gap-2 text-[11px]"
                                            >
                                                <span className="truncate text-slate-700">{f.reason}</span>
                                                <span className="flex-1" />
                                                <span className="font-medium text-rose-600">{f.count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    <SectionHeader
                        icon={Users}
                        title="Customers"
                        description="Consent-aware engagement metrics."
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <KpiCard label="New contacts" icon={UserPlus} metric={data.customers.newContacts} />
                        <KpiCard label="Returning" icon={UserCheck} metric={data.customers.returningCustomers} />
                        <KpiCard label="Started conversations" icon={MessageSquare} metric={data.customers.startedConversations} />
                        <KpiCard label="Enquiries" icon={Inbox} metric={data.customers.enquiries} />
                        <KpiCard label="Opt-ins" icon={ShieldCheck} metric={data.customers.optIns} />
                        <KpiCard label="Opt-outs" icon={ShieldOff} metric={data.customers.optOuts} />
                        <KpiCard label="Response rate" icon={TrendingUp} metric={data.customers.responseRate} format="percent" />
                        <KpiCard label="Repeat purchases" icon={ShoppingBag} metric={data.customers.repeatPurchases} />
                    </div>

                    <SectionHeader
                        icon={ShoppingBag}
                        title="Commerce & attribution"
                        description="Measurable WhatsApp-assisted outcomes. Not every interacting customer is a proven conversion."
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <KpiCard label="Referred visits" icon={MousePointerClick} metric={data.commerce.referredVisits} />
                        <KpiCard label="Product page visits" icon={Eye} metric={data.commerce.productPageVisits} />
                        <KpiCard label="Enquiries" icon={Inbox} metric={data.commerce.enquiries} />
                        <KpiCard label="Attributed orders" icon={ShoppingBag} metric={data.commerce.attributedOrders} />
                        <KpiCard label="Attributed revenue" icon={DollarSign} metric={data.commerce.attributedRevenue} format="currency" />
                        <KpiCard label="Conversion rate" icon={TrendingUp} metric={data.commerce.conversionRate} format="percent" />
                        <KpiCard label="Average order value" icon={DollarSign} metric={data.commerce.averageOrderValue} format="currency" />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 text-[11px] text-blue-800 flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                            Attributions rely on campaign IDs, tagged links and verified order
                            records. The main Analytics / Reports page remains the source of
                            truth for total sales.
                        </span>
                    </div>

                    <SectionHeader
                        icon={Megaphone}
                        title="Campaign performance"
                        description="Platform-reported vs website-tracked metrics."
                    />
                    {data.campaigns.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                            No campaign data in this period.
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-100">
                                        <th className="text-left font-medium px-3 py-1.5">Campaign</th>
                                        <th className="text-right font-medium px-3 py-1.5">Submitted</th>
                                        <th className="text-right font-medium px-3 py-1.5">Delivered</th>
                                        <th className="text-right font-medium px-3 py-1.5">Read</th>
                                        <th className="text-right font-medium px-3 py-1.5">Failed</th>
                                        <th className="text-right font-medium px-3 py-1.5">Clicks</th>
                                        <th className="text-right font-medium px-3 py-1.5">Visits</th>
                                        <th className="text-right font-medium px-3 py-1.5">Orders</th>
                                        <th className="text-right font-medium px-3 py-1.5">Revenue</th>
                                        <th className="text-right font-medium px-3 py-1.5">Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.campaigns.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-1.5">
                                                <p className="text-[12px] text-slate-800 truncate max-w-[160px]">{c.name}</p>
                                                <p className="text-[10px] text-slate-500">{c.category}</p>
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-slate-700">{c.submitted}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-emerald-700">{c.delivered}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-indigo-700">{c.read}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-rose-600">{c.failed}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-slate-700">{c.clicks}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-slate-700">{c.visits}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-slate-700">{c.orders}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-slate-700">{formatCurrency(c.revenue, c.currency)}</td>
                                            <td className="px-3 py-1.5 text-right text-[11px] text-slate-700">{formatCurrency(c.cost, c.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <SectionHeader
                        icon={DollarSign}
                        title="Messaging costs"
                        description="Billing reported by Meta. Does not include e-commerce revenue."
                    />
                    {!data.costs.available ? (
                        <div className="bg-white border border-slate-200 rounded p-4 text-center text-[12px] text-slate-500">
                            {data.costs.note ?? 'Messaging cost data is not available yet.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="bg-white border border-slate-200 rounded p-3">
                                <p className="text-[11px] text-slate-500">Total cost</p>
                                <p className="text-[18px] font-semibold text-slate-900">
                                    {formatCurrency(data.costs.total, data.costs.currency ?? 'KES')}
                                </p>
                            </div>
                            <div className="bg-white border border-slate-200 rounded p-3">
                                <p className="text-[11px] text-slate-500">Campaign cost</p>
                                <p className="text-[18px] font-semibold text-slate-900">
                                    {formatCurrency(data.costs.campaignCost, data.costs.currency ?? 'KES')}
                                </p>
                            </div>
                            <div className="bg-white border border-slate-200 rounded p-3">
                                <p className="text-[11px] text-slate-500 mb-1">By category</p>
                                <ul className="space-y-0.5">
                                    {data.costs.byCategory?.map((c) => (
                                        <li
                                            key={c.category}
                                            className="flex items-center text-[11px]"
                                        >
                                            <span className="text-slate-600">{c.category}</span>
                                            <span className="flex-1" />
                                            <span className="text-slate-800 font-medium">
                                                {formatCurrency(c.cost, data.costs.currency ?? 'KES')}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}

function ConnectionTabContent() {
    const [info, setInfo] = useState<ConnectionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [reauthing, setReauthing] = useState(false);

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError('');
        try {
            const res = await adminApi.whatsapp.connection.status(signal);
            setInfo(res);
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return;
            setError('Could not load connection information.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const handleConnect = async () => {
        setConnecting(true);
        setError('');
        try {
            const json = await adminApi.whatsapp.connection.connect();
            window.location.href = json.onboardingUrl;
        } catch {
            setError('Could not start the connection flow.');
        } finally {
            setConnecting(false);
        }
    };

    const handleReauth = async () => {
        setReauthing(true);
        setError('');
        try {
            const json = await adminApi.whatsapp.connection.reauth();
            window.location.href = json.onboardingUrl;
        } catch {
            setError('Could not start reauthorization.');
        } finally {
            setReauthing(false);
        }
    };

    const handleDisconnect = async () => {
        if (!info) return;
        if (
            !window.confirm(
                'Disconnect WhatsApp Business? Messaging and commerce features will stop until reconnected.',
            )
        ) {
            return;
        }
        setDisconnecting(true);
        setError('');
        try {
            await adminApi.whatsapp.connection.disconnect();
            await load();
        } catch {
            setError('Could not disconnect.');
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded p-4 flex items-center gap-2 text-[12px] text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading connection…
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
            </div>
        );
    }

    if (!info) return null;

    const connected = info.state === 'connected';

    return (
        <div className="space-y-3">
            <SectionHeader
                icon={Settings}
                title="WhatsApp Business connection"
                description="Managed server-side using Meta's official onboarding flow. Tokens never touch the browser."
            />

            <div className="bg-white border border-slate-200 rounded p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <ConnectionStatusPill state={info.state} />
                    {info.requiredAction && (
                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            {info.requiredAction}
                        </span>
                    )}
                    <span className="flex-1" />
                    {!connected && (
                        <button
                            type="button"
                            onClick={handleConnect}
                            disabled={connecting}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50"
                        >
                            {connecting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Plug className="w-3.5 h-3.5" />
                            )}
                            Connect WhatsApp Business
                        </button>
                    )}
                    {(info.state === 'expired' || info.state === 'action_required') && (
                        <button
                            type="button"
                            onClick={handleReauth}
                            disabled={reauthing}
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50"
                        >
                            {reauthing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <ShieldAlert className="w-3.5 h-3.5" />
                            )}
                            Reauthorize
                        </button>
                    )}
                    {connected && (
                        <button
                            type="button"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="inline-flex items-center gap-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50"
                        >
                            {disconnecting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Unplug className="w-3.5 h-3.5" />
                            )}
                            Disconnect
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-white border border-slate-200 rounded">
                    <div className="px-3 py-2 border-b border-slate-100">
                        <h3 className="text-[12px] font-semibold text-slate-800">
                            Business information
                        </h3>
                    </div>
                    <div className="p-3 space-y-1.5 text-[12px]">
                        <Field icon={Building2} label="Meta portfolio" value={info.metaBusinessPortfolio} />
                        <Field icon={MessageSquare} label="WABA" value={info.wabaName} mono={info.wabaId} />
                        <Field icon={Phone} label="Phone number" value={info.phoneNumber} />
                        <Field icon={Globe} label="Display name" value={info.displayName} />
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 w-32 shrink-0">Phone verified</span>
                            {info.phoneVerified ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Verified
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                                    <AlertCircle className="w-3 h-3" />
                                    Not verified
                                </span>
                            )}
                        </div>
                        <Field
                            icon={Store}
                            label="Catalogue"
                            value={info.catalogueName}
                            mono={info.catalogueId}
                        />
                        <Field
                            icon={Clock}
                            label="Last sync"
                            value={formatRelative(info.lastSyncedAt)}
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded">
                    <div className="px-3 py-2 border-b border-slate-100">
                        <h3 className="text-[12px] font-semibold text-slate-800">
                            Business profile
                        </h3>
                    </div>
                    <div className="p-3 space-y-1.5 text-[12px]">
                        {info.businessProfile ? (
                            <>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">About</p>
                                    <p className="text-[11px] text-slate-700">
                                        {info.businessProfile.about ?? '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">Address</p>
                                    <p className="text-[11px] text-slate-700">
                                        {info.businessProfile.address ?? '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">Website</p>
                                    {info.businessProfile.website ? (
                                        <a
                                            href={info.businessProfile.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] text-blue-950 hover:underline inline-flex items-center gap-1"
                                        >
                                            {info.businessProfile.website}
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                    ) : (
                                        <p className="text-[11px] text-slate-700">—</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase">Vertical</p>
                                    <p className="text-[11px] text-slate-700">
                                        {info.businessProfile.vertical ?? '—'}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <p className="text-[11px] text-slate-500">
                                Business profile information not available.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold text-slate-800">
                        Permissions
                    </h3>
                    <span className="text-[10px] text-slate-500">
                        {info.permissions.filter((p) => p.granted).length}/
                        {info.permissions.length} granted
                    </span>
                </div>
                <div className="p-3">
                    {info.permissions.length === 0 ? (
                        <p className="text-[11px] text-slate-500">No permission data.</p>
                    ) : (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {info.permissions.map((p) => (
                                <li
                                    key={p.name}
                                    className="flex items-center gap-1.5 text-[11px]"
                                >
                                    {p.granted ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                        <Lock className="w-3 h-3 text-rose-500" />
                                    )}
                                    <span className={p.granted ? 'text-slate-700' : 'text-slate-500'}>
                                        {p.name}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                    Access tokens are stored server-side only. This page never handles
                    credentials. Connection is managed through Meta&apos;s official onboarding
                    process.
                </span>
            </div>
        </div>
    );
}

function Store({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 9l1.5-5h15L21 9" />
            <path d="M3 9v11h18V9" />
            <path d="M9 22V12h6v10" />
        </svg>
    );
}

function Field({
    icon: Icon,
    label,
    value,
    mono,
}: {
    icon: typeof Building2;
    label: string;
    value: string | null;
    mono?: string | null;
}) {
    return (
        <div className="flex items-start gap-1.5">
            <Icon className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
            <span className="text-slate-500 w-28 shrink-0">{label}</span>
            <div className="min-w-0 flex-1">
                <p className="text-slate-800 truncate">{value ?? '—'}</p>
                {mono && (
                    <p className="text-[10px] text-slate-400 font-mono truncate">{mono}</p>
                )}
            </div>
        </div>
    );
}

function HealthTabContent() {
    const [info, setInfo] = useState<HealthInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError('');
        try {
            const res = await adminApi.whatsapp.health.get(signal);
            setInfo(res);
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return;
            setError('Could not load integration health.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded p-4 flex items-center gap-2 text-[12px] text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking integration health…
            </div>
        );
    }
    if (error || !info) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {error || 'No health data.'}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <SectionHeader
                icon={Activity}
                title="API & webhook health"
                description="Live status of the Meta integration."
                action={
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                    </button>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-white border border-slate-200 rounded p-3">
                    <div className="flex items-center gap-1.5">
                        <HealthDot status={info.api.status} />
                        <p className="text-[11px] font-medium text-slate-700">API</p>
                        <span className="flex-1" />
                        <span className="text-[10px] text-slate-500">
                            {info.api.status}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Last request: {formatRelative(info.api.lastRequestAt)}
                    </p>
                    <p
                        className={`text-[10px] mt-0.5 ${info.api.failedRequests24h > 0 ? 'text-rose-600' : 'text-slate-500'}`}
                    >
                        Failed (24h): {info.api.failedRequests24h}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded p-3">
                    <div className="flex items-center gap-1.5">
                        <HealthDot status={info.webhook.status} />
                        <p className="text-[11px] font-medium text-slate-700">Webhook</p>
                        <span className="flex-1" />
                        <span className="text-[10px] text-slate-500">
                            {info.webhook.status}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Last event: {formatRelative(info.webhook.lastEventAt)}
                    </p>
                    <p
                        className={`text-[10px] mt-0.5 ${info.webhook.verified ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                        {info.webhook.verified ? 'Verified' : 'Not verified'}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded p-3">
                    <div className="flex items-center gap-1.5">
                        <HealthDot status={info.token.status} />
                        <p className="text-[11px] font-medium text-slate-700">Token</p>
                        <span className="flex-1" />
                        <span className="text-[10px] text-slate-500">
                            {info.token.status}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Expires: {info.token.expiresAt ? formatRelative(info.token.expiresAt) : '—'}
                    </p>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold text-slate-800">
                        Recent integration errors
                    </h3>
                    <span className="text-[10px] text-slate-500">
                        {info.errors.length} item{info.errors.length === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="p-3">
                    {info.errors.length === 0 ? (
                        <div className="py-4 text-center text-[12px] text-slate-500 inline-flex w-full items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            No recent errors.
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {info.errors.map((e) => {
                                const Icon =
                                    e.kind === 'webhook'
                                        ? Webhook
                                        : e.kind === 'rate_limit'
                                            ? Timer
                                            : e.kind === 'permission'
                                                ? ShieldAlert
                                                : e.kind === 'sync'
                                                    ? RotateCw
                                                    : AlertCircle;
                                return (
                                    <li
                                        key={e.id}
                                        className="flex items-start gap-2 bg-rose-50/60 border border-rose-200 rounded px-2 py-1.5"
                                    >
                                        <Icon className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] text-rose-800">
                                                {e.message}
                                            </p>
                                            <p className="text-[10px] text-rose-600">
                                                {e.kind} · {formatRelative(e.at)}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function WhatsAppAnalyticsPageContent() {
    const searchParams = useSearchParams();
    const initialTab = useMemo<Tab>(() => {
        const t = searchParams.get('tab');
        if (t === 'connection' || t === 'catalogue') return 'connection';
        if (t === 'health') return 'health';
        return 'analytics';
    }, [searchParams]);

    const [tab, setTab] = useState<Tab>(initialTab);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="px-3 sm:px-4 lg:px-5 py-3 space-y-3">
                <div>
                    <h1 className="text-[15px] font-semibold text-slate-900">
                        Analytics & Settings
                    </h1>
                    <p className="text-[12px] text-slate-500">
                        Performance measurement and integration configuration.
                    </p>
                </div>

                <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] border-b-2 -mb-px transition whitespace-nowrap ${active ? 'border-blue-950 text-blue-950 font-medium' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {tab === 'analytics' && <AnalyticsTabContent />}
                {tab === 'connection' && <ConnectionTabContent />}
                {tab === 'health' && <HealthTabContent />}
            </div>
        </div>
    );
}

export default function WhatsAppAnalyticsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
            }
        >
            <WhatsAppAnalyticsPageContent />
        </Suspense>
    );
}