'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    BarChart3,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    Eye,
    Film,
    Heart,
    Image as ImageIcon,
    Loader2,
    MessageCircle,
    Music2,
    Play,
    Plus,
    Radio,
    RefreshCw,
    Search,
    Sparkles,
    Tag,
    Target,
    TrendingUp,
    UploadCloud,
    X,
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import { adminApi } from '@/lib/admin-api';
import type {
    AdminDirectContent,
    AdminDirectContentWrite,
    AdminDirectLive,
    AdminDirectLiveWrite,
    AdminDirectOrder,
    AdminProduct,
    AdminDirectContentStatus,
} from '@/lib/admin-types';

const NUM = (n: number | string | null | undefined): string => {
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('en-KE');
};

const KES = (n: number | string | null | undefined): string => {
    if (n === null || n === undefined) return 'KES —';
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return 'KES —';
    return `KES ${num.toLocaleString('en-KE')}`;
};

const cn = (...parts: Array<string | false | null | undefined>): string =>
    parts.filter(Boolean).join(' ');

const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    try {
        return new Date(ts).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return iso;
    }
};

const formatDateTime = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    try {
        return new Date(ts).toLocaleString('en-KE', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'library', label: 'Content' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'videos', label: 'Videos' },
    { id: 'live', label: 'LIVE' },
    { id: 'promotions', label: 'Promotions' },
    { id: 'ads', label: 'Ads' },
    { id: 'audiences', label: 'Audiences' },
    { id: 'assets', label: 'Assets' },
    { id: 'pixel', label: 'Pixel' },
    { id: 'analytics', label: 'Analytics' },
];

const CONTENT_STATUSES: AdminDirectContentStatus[] = [
    'Idea',
    'Draft',
    'In Review',
    'Approved',
    'Scheduled',
    'Posted',
    'Failed',
    'Archived',
];

const TOOLTIP_STYLE = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    color: '#0f172a',
    fontSize: '13px',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
    padding: '6px 10px',
};

interface TimelinePoint {
    date: string;
    revenue: number;
    orders: number;
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('bg-white border border-slate-200 rounded overflow-hidden', className)}>{children}</div>;
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-2 px-2.5 py-2 border-b border-slate-200">
            <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{title}</p>
                {subtitle && <p className="text-[13px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
    return (
        <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2 hover:border-slate-300 transition-colors">
            <span className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-slate-100 text-slate-700">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
                <p className="text-[15px] font-bold text-slate-900 truncate tabular-nums">{value}</p>
                {sub && <p className="text-[13px] text-slate-400 truncate">{sub}</p>}
            </div>
        </div>
    );
}

function StatusBadge({ label, variant }: { label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
    const styles =
        variant === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : variant === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : variant === 'danger'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : variant === 'info'
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200';
    return <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[13px] font-medium whitespace-nowrap', styles)}>{label}</span>;
}

function EmptyCard({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
    return (
        <div className="py-8 text-center">
            <span className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">{icon}</span>
            <p className="mt-2 text-[13px] font-semibold text-slate-900">{title}</p>
            {description && <p className="mt-1 text-[13px] text-slate-500 max-w-xs mx-auto">{description}</p>}
        </div>
    );
}

function Modal({
    onClose,
    title,
    subtitle,
    children,
    widthClass = 'max-w-2xl',
}: {
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    widthClass?: string;
}) {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2" onClick={onClose} role="presentation">
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                className={cn('bg-white border border-slate-200 w-full rounded max-h-[92vh] flex flex-col', widthClass)}
            >
                <div className="px-2.5 py-2 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-[13px] font-semibold text-slate-900 truncate">{title}</h3>
                        {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} aria-label="Close" className="inline-flex items-center justify-center h-7 w-7 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2.5 py-2">{children}</div>
            </div>
        </div>
    );
}

const inputCls = 'w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900';
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm disabled:opacity-60';
const btnSecondary = 'inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm disabled:opacity-60';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
            <p className="text-[13px] text-slate-500 truncate">{label}</p>
            <p className="text-[13px] font-semibold text-slate-900 truncate mt-0.5">{value}</p>
        </div>
    );
}

export default function MarketingContentCampaigns() {
    const [section, setSection] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: number; msg: string; variant: 'success' | 'error' } | null>(null);

    const [content, setContent] = useState<AdminDirectContent[]>([]);
    const [lives, setLives] = useState<AdminDirectLive[]>([]);
    const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
    const [products, setProducts] = useState<AdminProduct[]>([]);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | AdminDirectContentStatus>('All');
    const [showAddContent, setShowAddContent] = useState(false);
    const [showAddLive, setShowAddLive] = useState(false);
    const [selectedContent, setSelectedContent] = useState<AdminDirectContent | null>(null);

    const showToast = useCallback((msg: string, variant: 'success' | 'error' = 'success') => {
        setToast({ id: Date.now(), msg, variant });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const results = await Promise.allSettled([
            adminApi.directOrders.content.list(),
            adminApi.directOrders.lives.list(),
            adminApi.directOrders.orders.list(),
            adminApi.products.list(),
        ]);

        if (results[0].status === 'fulfilled') setContent(results[0].value || []);
        if (results[1].status === 'fulfilled') setLives(results[1].value || []);
        if (results[2].status === 'fulfilled') setOrders(results[2].value || []);
        if (results[3].status === 'fulfilled') setProducts(results[3].value || []);

        if (results.every((r) => r.status === 'rejected')) {
            const first = results[0] as PromiseRejectedResult;
            setError(first.reason instanceof Error ? first.reason.message : 'Failed to load marketing data');
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    const filteredContent = useMemo(() => {
        let list = content;
        if (statusFilter !== 'All') list = list.filter((c) => c.status === statusFilter);
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (c) =>
                    String(c.title || '').toLowerCase().includes(q) ||
                    String(c.caption || '').toLowerCase().includes(q),
            );
        }
        return list;
    }, [content, statusFilter, search]);

    const stats = useMemo(() => {
        const total = content.length;
        const published = content.filter((c) => c.status === 'Posted').length;
        const scheduled = content.filter((c) => c.status === 'Scheduled').length;
        const totalViews = content.reduce((a, c) => a + Number(c.views || 0), 0);
        const totalLikes = content.reduce((a, c) => a + Number(c.likes || 0), 0);
        const totalComments = content.reduce((a, c) => a + Number(c.comments || 0), 0);
        const totalLive = lives.length;
        const revenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
        const engagementRate = totalViews ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
        return { total, published, scheduled, totalViews, totalLikes, totalComments, totalLive, revenue, engagementRate };
    }, [content, lives, orders]);

    const timeline = useMemo<TimelinePoint[]>(() => {
        const days = 7;
        const out: TimelinePoint[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
            const dayOrders = orders.filter((o) => {
                const ts = Date.parse(o.createdAt);
                if (Number.isNaN(ts)) return false;
                return new Date(ts).toDateString() === d.toDateString();
            });
            const revenue = dayOrders.reduce((a, o) => a + Number(o.total || 0), 0);
            out.push({ date: label, revenue, orders: dayOrders.length });
        }
        return out;
    }, [orders]);

    const contentByStatus = useMemo(() => {
        return CONTENT_STATUSES.map((s) => ({
            status: s,
            count: content.filter((c) => c.status === s).length,
        }));
    }, [content]);

    const contentByPlatform = useMemo(() => {
        const map: Record<string, number> = {};
        content.forEach((c) => {
            const key = c.platform || 'TikTok';
            map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map).map(([name, count]) => ({ name, count }));
    }, [content]);

    const upcoming = useMemo(() => {
        const now = Date.now();
        return [...content]
            .filter((c) => c.scheduledAt && Date.parse(c.scheduledAt) > now)
            .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))
            .slice(0, 5);
    }, [content]);

    const recentPublished = useMemo(() => {
        return [...content]
            .filter((c) => c.status === 'Posted')
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
            .slice(0, 6);
    }, [content]);

    const handleAddContent = async (payload: AdminDirectContentWrite) => {
        try {
            const created = await adminApi.directOrders.content.create(payload);
            setContent((prev) => [created, ...prev]);
            setShowAddContent(false);
            showToast(`Content "${created.title}" created`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create content', 'error');
        }
    };

    const handleAddLive = async (payload: AdminDirectLiveWrite) => {
        try {
            const created = await adminApi.directOrders.lives.create(payload);
            setLives((prev) => [created, ...prev]);
            setShowAddLive(false);
            showToast(`LIVE "${created.title}" scheduled`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to schedule LIVE', 'error');
        }
    };

    const exportContent = () => {
        const rows: Array<Array<string | number>> = [
            ['Title', 'Platform', 'Status', 'Views', 'Likes', 'Comments', 'Scheduled'],
            ...filteredContent.map((c) => [
                c.title,
                c.platform,
                c.status,
                c.views,
                c.likes,
                c.comments,
                c.scheduledAt || '',
            ]),
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `content-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Content exported');
    };

    return (
        <div className="space-y-2">
            {toast && (
                <div className="fixed bottom-3 right-3 left-3 sm:left-auto z-[110] bg-slate-900 text-white px-2 py-2 rounded flex items-center gap-2 text-[13px]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="flex-1">{toast.msg}</span>
                </div>
            )}

            <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
                    <div className="min-w-0">
                        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-slate-400" />
                            Marketing, Content &amp; Campaigns
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Plan content, run LIVE sessions, and measure campaign performance.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button onClick={() => void load(true)} disabled={refreshing || loading} className={btnSecondary}>
                            <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button onClick={exportContent} className={btnSecondary}>
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => setShowAddContent(true)} className={btnPrimary}>
                            <Plus className="w-3 h-3" /> New content
                        </button>
                    </div>
                </div>

                <div className="px-2.5 pb-2 overflow-x-auto">
                    <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200">
                        {SECTIONS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setSection(s.id)}
                                className={cn(
                                    'px-2.5 py-1.5 rounded text-[13px] font-medium whitespace-nowrap transition-colors',
                                    section === s.id ? 'bg-white text-blue-950' : 'text-slate-600 hover:text-slate-900',
                                )}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {error && (
                <Card>
                    <div className="p-2 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900">Couldn&apos;t load marketing data</p>
                            <p className="text-[13px] text-slate-600 mt-0.5">{error}</p>
                        </div>
                        <button onClick={() => void load(true)} className="text-[13px] font-medium text-slate-900 hover:underline shrink-0">
                            Retry
                        </button>
                    </div>
                </Card>
            )}

            {loading ? (
                <Card>
                    <div className="p-4 flex items-center gap-2 text-[13px] text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading content…
                    </div>
                </Card>
            ) : (
                <>
                    {section === 'overview' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                <Kpi icon={<Film className="w-3.5 h-3.5" />} label="Content pieces" value={NUM(stats.total)} sub={`${stats.published} published`} />
                                <Kpi icon={<Eye className="w-3.5 h-3.5" />} label="Total views" value={NUM(stats.totalViews)} />
                                <Kpi icon={<Radio className="w-3.5 h-3.5" />} label="LIVE sessions" value={NUM(stats.totalLive)} />
                                <Kpi icon={<TrendingUp className="w-3.5 h-3.5" />} label="Engagement" value={`${stats.engagementRate.toFixed(1)}%`} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                                <Card className="lg:col-span-2">
                                    <CardHeader title="Campaign performance" subtitle="Recent attributed revenue" />
                                    <div className="h-60 w-full p-2">
                                        {timeline.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data yet</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={timeline}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                                                    <YAxis stroke="#172554" fontSize={13} />
                                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                                    <Line type="monotone" dataKey="revenue" stroke="#172554" strokeWidth={2} dot={{ r: 3 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </Card>

                                <Card>
                                    <CardHeader title="Upcoming content" subtitle="Next 5 scheduled" />
                                    <div className="p-2 space-y-1">
                                        {upcoming.length === 0 ? (
                                            <EmptyCard icon={<Calendar className="w-5 h-5" />} title="Nothing scheduled" description="Scheduled content will appear here." />
                                        ) : (
                                            upcoming.map((c) => (
                                                <div key={c.id} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                                    <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                                                        <p className="text-[13px] text-slate-400 truncate">{formatDateTime(c.scheduledAt)}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                <Card>
                                    <CardHeader title="Content by status" subtitle="Distribution" />
                                    <div className="p-2 grid grid-cols-2 gap-2">
                                        {contentByStatus.map((s) => (
                                            <div key={s.status} className="bg-slate-50 border border-slate-200 rounded p-2">
                                                <p className="text-[13px] text-slate-500 truncate">{s.status}</p>
                                                <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(s.count)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                <Card>
                                    <CardHeader title="Recent published" subtitle="Latest posts" />
                                    <div className="p-2 space-y-1">
                                        {recentPublished.length === 0 ? (
                                            <EmptyCard icon={<Film className="w-5 h-5" />} title="No published content yet" description="Published posts will appear here." />
                                        ) : (
                                            recentPublished.map((c) => (
                                                <div key={c.id} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                                    <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                                        <Film className="w-3.5 h-3.5" />
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                                                        <p className="text-[13px] text-slate-400 truncate">
                                                            {NUM(c.views)} views · {NUM(c.likes)} likes
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {section === 'library' && (
                        <Card>
                            <CardHeader
                                title="Content library"
                                subtitle={`${filteredContent.length} item${filteredContent.length === 1 ? '' : 's'}`}
                                action={
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                            <input
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder="Search…"
                                                className={cn(inputCls, 'w-48 pl-7')}
                                            />
                                        </div>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as 'All' | AdminDirectContentStatus)}
                                            className={cn(inputCls, 'w-32')}
                                        >
                                            <option value="All">All</option>
                                            {CONTENT_STATUSES.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => setShowAddContent(true)} className={btnPrimary}>
                                            <Plus className="w-3 h-3" /> New
                                        </button>
                                    </div>
                                }
                            />
                            <div className="p-2">
                                {filteredContent.length === 0 ? (
                                    <EmptyCard icon={<Film className="w-5 h-5" />} title="No content yet" description="Create your first content piece to get started." />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {filteredContent.map((c) => (
                                            <div
                                                key={c.id}
                                                className="border border-slate-200 rounded overflow-hidden hover:border-slate-300 cursor-pointer"
                                                onClick={() => setSelectedContent(c)}
                                            >
                                                <div className="relative aspect-video w-full bg-slate-900">
                                                    {c.videoUrl ? (
                                                        <video src={c.videoUrl} poster={c.thumbnailUrl} className="w-full h-full object-cover" preload="metadata" muted />
                                                    ) : c.thumbnailUrl ? (
                                                        <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Film className="w-6 h-6 text-slate-500" />
                                                        </div>
                                                    )}
                                                    <div className="absolute top-1.5 left-1.5">
                                                        <StatusBadge
                                                            label={c.status}
                                                            variant={c.status === 'Posted' ? 'success' : c.status === 'Scheduled' ? 'info' : 'neutral'}
                                                        />
                                                    </div>
                                                    <div className="absolute top-1.5 right-1.5">
                                                        <span className="bg-slate-900/80 text-white px-1.5 py-0.5 rounded text-[13px] font-medium backdrop-blur-sm inline-flex items-center gap-1">
                                                            <Music2 className="w-2.5 h-2.5" /> {c.platform}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-2 space-y-1">
                                                    <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                                                    {c.scheduledAt && (
                                                        <p className="text-[13px] text-slate-400 inline-flex items-center gap-1">
                                                            <Calendar className="w-2.5 h-2.5" /> {formatDate(c.scheduledAt)}
                                                        </p>
                                                    )}
                                                    {c.caption && <p className="text-[13px] text-slate-500 truncate">{c.caption}</p>}
                                                    <div className="flex items-center gap-3 pt-1.5 border-t border-slate-100 mt-1.5 text-[13px]">
                                                        <span className="inline-flex items-center gap-1 text-slate-600"><Eye className="w-2.5 h-2.5" /> {NUM(c.views)}</span>
                                                        <span className="inline-flex items-center gap-1 text-slate-600"><Heart className="w-2.5 h-2.5" /> {NUM(c.likes)}</span>
                                                        <span className="inline-flex items-center gap-1 text-slate-600"><MessageCircle className="w-2.5 h-2.5" /> {NUM(c.comments)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'calendar' && (
                        <Card>
                            <CardHeader title="Content calendar" subtitle="Upcoming and past scheduled content" />
                            <div className="p-2 space-y-1">
                                {content.length === 0 ? (
                                    <EmptyCard icon={<Calendar className="w-5 h-5" />} title="Nothing on the calendar" description="Scheduled content will appear here." />
                                ) : (
                                    [...content]
                                        .filter((c) => c.scheduledAt)
                                        .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))
                                        .map((c) => (
                                            <div key={c.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded">
                                                <span className="w-8 h-8 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                                                    <p className="text-[13px] text-slate-400 truncate">{formatDateTime(c.scheduledAt)} · {c.platform}</p>
                                                </div>
                                                <StatusBadge
                                                    label={c.status}
                                                    variant={c.status === 'Posted' ? 'success' : c.status === 'Scheduled' ? 'info' : 'neutral'}
                                                />
                                            </div>
                                        ))
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'videos' && (
                        <Card>
                            <CardHeader
                                title="Video management"
                                subtitle="Videos in the library"
                                action={<button onClick={() => setShowAddContent(true)} className={btnPrimary}><Plus className="w-3 h-3" /> Upload</button>}
                            />
                            <div className="p-2">
                                {content.filter((c) => c.videoUrl || c.thumbnailUrl).length === 0 ? (
                                    <EmptyCard icon={<Film className="w-5 h-5" />} title="No videos uploaded" description="Upload a video to start publishing to TikTok." />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {content.filter((c) => c.videoUrl || c.thumbnailUrl).map((c) => (
                                            <div key={c.id} className="border border-slate-200 rounded overflow-hidden">
                                                <div className="relative aspect-video w-full bg-black">
                                                    {c.videoUrl ? (
                                                        <video src={c.videoUrl} poster={c.thumbnailUrl} controls className="w-full h-full object-contain" />
                                                    ) : (
                                                        <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                    {c.videoUrl && (
                                                        <span className="absolute bottom-1.5 left-1.5 bg-slate-900/80 text-white px-1.5 py-0.5 rounded text-[13px] inline-flex items-center gap-1">
                                                            <Play className="w-2.5 h-2.5" /> Video
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="p-2">
                                                    <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                                                    <p className="text-[13px] text-slate-400 truncate">{c.status} · {c.platform}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'live' && (
                        <Card>
                            <CardHeader
                                title="LIVE sessions"
                                subtitle={`${lives.length} session${lives.length === 1 ? '' : 's'}`}
                                action={<button onClick={() => setShowAddLive(true)} className={btnPrimary}><Plus className="w-3 h-3" /> Schedule</button>}
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Session</th>
                                            <th className="py-2 px-2 font-medium">Host</th>
                                            <th className="py-2 px-2 font-medium">Scheduled</th>
                                            <th className="py-2 px-2 font-medium text-center">Peak viewers</th>
                                            <th className="py-2 px-2 font-medium text-center">Orders</th>
                                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {lives.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No LIVE sessions scheduled.
                                                </td>
                                            </tr>
                                        ) : (
                                            lives.map((l) => (
                                                <tr key={l.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2 font-medium text-slate-900 truncate max-w-[200px]">{l.title}</td>
                                                    <td className="py-2 px-2 text-slate-600">{l.hostName || '—'}</td>
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDateTime(l.scheduledAt)}</td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{l.peakViewers ? NUM(l.peakViewers) : '—'}</td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{l.ordersGenerated || '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900">{l.revenue ? KES(l.revenue) : '—'}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={l.status}
                                                            variant={l.status === 'Live' ? 'danger' : l.status === 'Ended' ? 'success' : l.status === 'Cancelled' ? 'neutral' : 'info'}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'promotions' && (
                        <Card>
                            <CardHeader title="Promotions & offers" subtitle="Discounts and codes" />
                            <div className="p-2">
                                <EmptyCard
                                    icon={<Tag className="w-5 h-5" />}
                                    title="Promotions coming soon"
                                    description="Create discount codes and product offers here once the promotions backend is available."
                                />
                            </div>
                        </Card>
                    )}

                    {section === 'ads' && (
                        <Card>
                            <CardHeader title="Advertising campaigns" subtitle="Paid TikTok advertising" />
                            <div className="p-2 space-y-2">
                                <div className="bg-slate-50 border border-slate-200 rounded p-2 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-slate-900">TikTok Ads not connected</p>
                                        <p className="text-[13px] text-slate-500 mt-0.5">
                                            Connect your TikTok Ads account to see spend, impressions, and campaign attribution.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <Kpi icon={<Target className="w-3.5 h-3.5" />} label="Active campaigns" value="—" />
                                    <Kpi icon={<Eye className="w-3.5 h-3.5" />} label="Impressions" value="—" />
                                    <Kpi icon={<TrendingUp className="w-3.5 h-3.5" />} label="Conversions" value="—" />
                                    <Kpi icon={<BarChart3 className="w-3.5 h-3.5" />} label="ROAS" value="—" />
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'audiences' && (
                        <Card>
                            <CardHeader title="Audiences" subtitle="Targeting segments" />
                            <div className="p-2">
                                <EmptyCard
                                    icon={<Target className="w-5 h-5" />}
                                    title="No audiences configured"
                                    description="Audiences from the TikTok Ads integration will appear here."
                                />
                            </div>
                        </Card>
                    )}

                    {section === 'assets' && (
                        <Card>
                            <CardHeader
                                title="Creative asset library"
                                subtitle="Images and videos used in campaigns"
                                action={
                                    <button className={btnPrimary} onClick={() => showToast('Asset upload coming soon')}>
                                        <UploadCloud className="w-3 h-3" /> Upload
                                    </button>
                                }
                            />
                            <div className="p-2">
                                {content.filter((c) => c.thumbnailUrl).length === 0 ? (
                                    <EmptyCard icon={<ImageIcon className="w-5 h-5" />} title="No assets yet" description="Upload images and videos to use in campaigns." />
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                        {content.filter((c) => c.thumbnailUrl).map((c) => (
                                            <div key={c.id} className="border border-slate-200 rounded overflow-hidden">
                                                <img src={c.thumbnailUrl} alt="" className="w-full aspect-square object-cover" />
                                                <p className="p-1.5 text-[13px] text-slate-700 truncate">{c.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'pixel' && (
                        <Card>
                            <CardHeader title="TikTok Pixel" subtitle="Conversion tracking status" />
                            <div className="p-2 space-y-2">
                                <div className="bg-slate-50 border border-slate-200 rounded p-2 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-slate-900">Pixel not connected</p>
                                        <p className="text-[13px] text-slate-500 mt-0.5">
                                            Set up the TikTok Pixel to track page views, add-to-carts, checkouts, and purchases.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <Kpi icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Status" value="Disconnected" />
                                    <Kpi icon={<Eye className="w-3.5 h-3.5" />} label="Events (24h)" value="—" />
                                    <Kpi icon={<Clock className="w-3.5 h-3.5" />} label="Last event" value="—" />
                                    <Kpi icon={<AlertCircle className="w-3.5 h-3.5" />} label="Errors" value="—" />
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'analytics' && (
                        <Card>
                            <CardHeader title="Marketing analytics" subtitle="Performance across all channels" />
                            <div className="p-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Kpi icon={<Film className="w-3.5 h-3.5" />} label="Content" value={NUM(stats.total)} />
                                        <Kpi icon={<Eye className="w-3.5 h-3.5" />} label="Views" value={NUM(stats.totalViews)} />
                                        <Kpi icon={<Heart className="w-3.5 h-3.5" />} label="Likes" value={NUM(stats.totalLikes)} />
                                        <Kpi icon={<MessageCircle className="w-3.5 h-3.5" />} label="Comments" value={NUM(stats.totalComments)} />
                                    </div>
                                    <Card>
                                        <CardHeader title="Content by platform" />
                                        <div className="p-2 space-y-1">
                                            {contentByPlatform.length === 0 ? (
                                                <p className="text-[13px] text-slate-400 text-center py-2">No data</p>
                                            ) : (
                                                contentByPlatform.map((p) => (
                                                    <div key={p.name} className="flex items-center justify-between gap-2 text-[13px]">
                                                        <span className="text-slate-700 truncate">{p.name}</span>
                                                        <span className="font-mono font-medium text-slate-900">{p.count}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </Card>
                                </div>
                                <div>
                                    <Card>
                                        <CardHeader title="Weekly revenue" subtitle="From all orders" />
                                        <div className="h-56 w-full p-2">
                                            {timeline.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data</div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={timeline}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                                                        <YAxis stroke="#172554" fontSize={13} />
                                                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                                                        <Bar dataKey="revenue" fill="#172554" radius={[2, 2, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {selectedContent && (
                <Modal onClose={() => setSelectedContent(null)} title={selectedContent.title} subtitle={selectedContent.platform}>
                    <div className="space-y-2">
                        {selectedContent.videoUrl && (
                            <video src={selectedContent.videoUrl} poster={selectedContent.thumbnailUrl} controls className="w-full rounded border border-slate-200" />
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <MiniStat label="Status" value={selectedContent.status} />
                            <MiniStat label="Views" value={NUM(selectedContent.views)} />
                            <MiniStat label="Likes" value={NUM(selectedContent.likes)} />
                            <MiniStat label="Comments" value={NUM(selectedContent.comments)} />
                        </div>
                        {selectedContent.caption && (
                            <div>
                                <p className="text-[13px] font-medium text-slate-700 mb-1">Caption</p>
                                <p className="text-[13px] text-slate-600 bg-slate-50 border border-slate-200 rounded p-2">{selectedContent.caption}</p>
                            </div>
                        )}
                        <div className="flex justify-end pt-2">
                            <button onClick={() => setSelectedContent(null)} className={btnSecondary}>Close</button>
                        </div>
                    </div>
                </Modal>
            )}

            {showAddContent && <AddContentModal onClose={() => setShowAddContent(false)} onSubmit={handleAddContent} />}
            {showAddLive && <AddLiveModal onClose={() => setShowAddLive(false)} onSubmit={handleAddLive} />}
        </div>
    );
}

function AddContentModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: AdminDirectContentWrite) => void }) {
    const [title, setTitle] = useState('');
    const [caption, setCaption] = useState('');
    const [platform, setPlatform] = useState<'TikTok' | 'Instagram' | 'YouTube'>('TikTok');
    const [scheduledAt, setScheduledAt] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [status, setStatus] = useState<AdminDirectContentStatus>('Draft');

    return (
        <Modal onClose={onClose} title="New content" subtitle="Add a piece of content to your library">
            <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Title" required>
                        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
                    </Field>
                    <Field label="Platform">
                        <select
                            className={inputCls}
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value as 'TikTok' | 'Instagram' | 'YouTube')}
                        >
                            <option value="TikTok">TikTok</option>
                            <option value="Instagram">Instagram</option>
                            <option value="YouTube">YouTube</option>
                        </select>
                    </Field>
                    <Field label="Scheduled for">
                        <input type="datetime-local" className={inputCls} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                    </Field>
                    <Field label="Status">
                        <select
                            className={inputCls}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as AdminDirectContentStatus)}
                        >
                            <option value="Idea">Idea</option>
                            <option value="Draft">Draft</option>
                            <option value="In Review">In Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Scheduled">Scheduled</option>
                        </select>
                    </Field>
                    <Field label="Video URL">
                        <input className={inputCls} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
                    </Field>
                    <Field label="Thumbnail URL">
                        <input className={inputCls} value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://…" />
                    </Field>
                </div>
                <Field label="Caption">
                    <textarea className={cn(inputCls, 'min-h-[80px]')} value={caption} onChange={(e) => setCaption(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>Cancel</button>
                    <button
                        onClick={() =>
                            onSubmit({
                                title,
                                caption,
                                platform,
                                scheduledAt: scheduledAt || null,
                                videoUrl: videoUrl || null,
                                thumbnailUrl: thumbnailUrl || null,
                                status,
                            })
                        }
                        disabled={!title}
                        className={btnPrimary}
                    >
                        <CheckCircle2 className="w-3 h-3" /> Create
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function AddLiveModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: AdminDirectLiveWrite) => void }) {
    const [title, setTitle] = useState('');
    const [hostName, setHostName] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');

    return (
        <Modal onClose={onClose} title="Schedule LIVE" subtitle="Plan a TikTok LIVE selling session">
            <div className="space-y-2">
                <Field label="Session title" required>
                    <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label="Host name">
                    <input className={inputCls} value={hostName} onChange={(e) => setHostName(e.target.value)} />
                </Field>
                <Field label="Scheduled at" required>
                    <input type="datetime-local" className={inputCls} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>Cancel</button>
                    <button onClick={() => onSubmit({ title, hostName, scheduledAt })} disabled={!title || !scheduledAt} className={btnPrimary}>
                        <CheckCircle2 className="w-3 h-3" /> Schedule
                    </button>
                </div>
            </div>
        </Modal>
    );
}