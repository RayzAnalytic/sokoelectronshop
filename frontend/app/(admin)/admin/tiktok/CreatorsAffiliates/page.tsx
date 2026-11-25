'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    Download,
    Eye,
    Loader2,
    Link2,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    UserRound,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import { adminApi } from '@/lib/admin-api';
import type {
    AdminDirectCreator,
    AdminDirectCreatorWrite,
    AdminDirectOrder,
    AdminPayoutBatch,
    AdminProduct,
    AdminPartnership,
    AdminCreatorSample,
    AdminCreatorApplication,
} from '@/lib/admin-types';

const KES = (n: number | string | null | undefined): string => {
    if (n === null || n === undefined) return 'KES —';
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return 'KES —';
    return `KES ${num.toLocaleString('en-KE')}`;
};

const NUM = (n: number | string | null | undefined): string => {
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('en-KE');
};

const cn = (...parts: Array<string | false | null | undefined>): string =>
    parts.filter(Boolean).join(' ');

const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    try {
        return new Date(ts).toLocaleDateString('en-KE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
};

const initials = (name: string | null | undefined): string =>
    String(name || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';

const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'directory', label: 'Directory' },
    { id: 'applications', label: 'Applications' },
    { id: 'partnerships', label: 'Partnerships' },
    { id: 'samples', label: 'Samples' },
    { id: 'links', label: 'Links & codes' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'payouts', label: 'Payouts' },
    { id: 'performance', label: 'Performance' },
    { id: 'reports', label: 'Reports' },
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

interface NormalizedProduct {
    id: number | string;
    name: string;
    sku: string;
    image: string;
    price: string;
}

interface CommissionRow {
    creatorId: number;
    creatorName: string;
    handle: string;
    rate: number;
    revenue: number;
    commissionAmount: number;
    paid: number;
    owed: number;
    status: 'Pending' | 'Payable' | 'Paid';
}

interface SampleRow {
    id: number;
    creatorName: string;
    productName: string;
    productImage: string;
    quantity: number;
    status: string;
    requestedAt: string | null;
}

interface ApplicationRow {
    id: number;
    name: string;
    handle: string;
    phone: string;
    followers: number;
    niche: string;
    status: string;
    createdAt: string;
}

interface PartnershipRow {
    id: number;
    creatorId: number;
    creatorName: string;
    handle: string;
    status: string;
    rate: string;
    startDate: string;
    endDate: string | null;
    orders: number;
    revenue: string;
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

function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
    const colors = ['bg-slate-900', 'bg-slate-700', 'bg-slate-600', 'bg-slate-800', 'bg-slate-500'];
    const idx = String(name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return (
        <span className={cn('flex items-center justify-center text-white text-[13px] font-semibold rounded shrink-0', colors[idx % colors.length], className)}>
            {initials(name)}
        </span>
    );
}

function Thumb({ src, className }: { src?: string; className?: string }) {
    if (!src) {
        return (
            <span className={cn('flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 rounded shrink-0', className)}>
                <UserRound className="w-3.5 h-3.5" />
            </span>
        );
    }
    return <img src={src} alt="" loading="lazy" className={cn('object-cover border border-slate-200 rounded shrink-0 bg-slate-50', className)} />;
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
const iconBtn = 'inline-flex items-center justify-center h-7 w-7 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100';

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

export default function CreatorsAffiliates() {
    const [section, setSection] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: number; msg: string; variant: 'success' | 'error' } | null>(null);

    const [creators, setCreators] = useState<AdminDirectCreator[]>([]);
    const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
    const [payouts, setPayouts] = useState<AdminPayoutBatch[]>([]);
    const [products, setProducts] = useState<NormalizedProduct[]>([]);
    const [samples, setSamples] = useState<AdminCreatorSample[]>([]);
    const [applications, setApplications] = useState<AdminCreatorApplication[]>([]);
    const [partnerships, setPartnerships] = useState<AdminPartnership[]>([]);

    const [search, setSearch] = useState('');
    const [selectedCreator, setSelectedCreator] = useState<AdminDirectCreator | null>(null);
    const [showAddCreator, setShowAddCreator] = useState(false);
    const [showAddPayout, setShowAddPayout] = useState(false);

    const showToast = useCallback((msg: string, variant: 'success' | 'error' = 'success') => {
        setToast({ id: Date.now(), msg, variant });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const results = await Promise.allSettled([
            adminApi.directOrders.creators.list(),
            adminApi.directOrders.orders.list(),
            adminApi.directOrders.payouts.list(),
            adminApi.products.list(),
            adminApi.directOrders.creatorSamples.list(),
            adminApi.directOrders.creatorApplications.list(),
            adminApi.directOrders.partnerships.list(),
        ]);

        if (results[0].status === 'fulfilled') setCreators(results[0].value || []);
        if (results[1].status === 'fulfilled') setOrders(results[1].value || []);
        if (results[2].status === 'fulfilled') setPayouts(results[2].value || []);
        if (results[3].status === 'fulfilled') {
            const list = (results[3].value || []) as AdminProduct[];
            setProducts(
                list.map((p) => ({
                    id: p.id,
                    name: p.name,
                    sku: p.slug || '',
                    image: p.images?.[0]?.url || '',
                    price: p.price,
                })),
            );
        }
        if (results[4].status === 'fulfilled') setSamples(results[4].value || []);
        if (results[5].status === 'fulfilled') setApplications(results[5].value || []);
        if (results[6].status === 'fulfilled') setPartnerships(results[6].value || []);

        if (results.every((r) => r.status === 'rejected')) {
            const first = results[0] as PromiseRejectedResult;
            setError(first.reason instanceof Error ? first.reason.message : 'Failed to load creators');
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    const filteredCreators = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return creators;
        return creators.filter(
            (c) =>
                String(c.name || '').toLowerCase().includes(q) ||
                String(c.handle || '').toLowerCase().includes(q) ||
                String(c.platform || '').toLowerCase().includes(q),
        );
    }, [creators, search]);

    const stats = useMemo(() => {
        const total = creators.length;
        const active = creators.filter((c) => c.status === 'Active').length;
        const totalOrders = creators.reduce((a, c) => a + Number(c.ordersCount || 0), 0);
        const totalRevenue = creators.reduce((a, c) => a + Number(c.revenue || 0), 0);
        const totalOwed = creators.reduce((a, c) => a + Number(c.commissionOwed || 0), 0);
        const totalPaid = creators.reduce((a, c) => a + Number(c.commissionPaid || 0), 0);
        const totalCommission = totalOwed + totalPaid;
        return { total, active, totalOrders, totalRevenue, totalOwed, totalPaid, totalCommission };
    }, [creators]);

    const commissionRows = useMemo<CommissionRow[]>(() => {
        return creators
            .map((c) => {
                const rate = Number(c.commissionRate || 0);
                const revenue = Number(c.revenue || 0);
                const commissionAmount = (revenue * rate) / 100;
                const paid = Number(c.commissionPaid || 0);
                const owed = Number(c.commissionOwed || 0);
                return {
                    creatorId: c.id,
                    creatorName: c.name,
                    handle: c.handle,
                    rate,
                    revenue,
                    commissionAmount,
                    paid,
                    owed,
                    status: (owed > 0 ? 'Payable' : paid > 0 ? 'Paid' : 'Pending') as CommissionRow['status'],
                };
            })
            .sort((a, b) => b.commissionAmount - a.commissionAmount);
    }, [creators]);

    const applicationRows = useMemo<ApplicationRow[]>(() => {
        return applications.map((a) => ({
            id: a.id,
            name: a.name,
            handle: a.handle,
            phone: a.phone || '',
            followers: a.followers || 0,
            niche: a.niche || '',
            status: a.status,
            createdAt: a.createdAt || new Date().toISOString(),
        }));
    }, [applications]);

    const partnershipRows = useMemo<PartnershipRow[]>(() => {
        return partnerships.map((p) => {
            const creator = creators.find((c) => c.id === p.creatorId);
            return {
                id: p.id,
                creatorId: p.creatorId,
                creatorName: creator?.name || p.creatorName || '—',
                handle: creator?.handle || '',
                status: p.status,
                rate: String(p.commissionRate ?? '0'),
                startDate: p.startDate,
                endDate: p.endDate ?? null,
                orders: creator?.ordersCount ?? 0,
                revenue: creator?.revenue ?? '0',
            };
        });
    }, [partnerships, creators]);

    const sampleRows = useMemo<SampleRow[]>(() => {
        return samples.map((s) => ({
            id: s.id,
            creatorName: s.creatorName,
            productName: s.productName,
            productImage: s.productImage || '',
            quantity: s.quantity,
            status: s.status,
            requestedAt: s.requestedAt,
        }));
    }, [samples]);

    const affiliateLinks = useMemo(
        () =>
            creators
                .filter((c) => c.status === 'Active')
                .map((c) => ({
                    id: `L-${c.id}`,
                    creatorName: c.name,
                    code: String(c.handle || '').replace('@', '').toUpperCase() || `CREATOR${c.id}`,
                    link: `https://sokoelectronshop.vercel.app/?ref=${encodeURIComponent(c.handle || String(c.id))}`,
                    orders: c.ordersCount || 0,
                    revenue: Number(c.revenue || 0),
                    conversion: c.ordersCount > 0 ? 2.4 : 0,
                    status: 'Active',
                    createdAt: c.createdAt,
                })),
        [creators],
    );

    const performanceData = useMemo(() => {
        const days = 7;
        const out: Array<{ date: string; revenue: number; orders: number }> = [];
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

    const topCreators = useMemo(
        () => [...creators].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0)).slice(0, 5),
        [creators],
    );

    const handleAddCreator = async (payload: AdminDirectCreatorWrite) => {
        try {
            const created = await adminApi.directOrders.creators.create(payload);
            setCreators((prev) => [created, ...prev]);
            setShowAddCreator(false);
            showToast(`Creator ${created.name} added`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to add creator', 'error');
        }
    };

    const handleCreatePayout = async (creatorId: number, amount: number) => {
        try {
            const batch = await adminApi.directOrders.payouts.create({
                status: 'Pending',
                payoutMethod: 'M-Pesa',
                notes: `Payout to creator #${creatorId}`,
            });
            setPayouts((prev) => [batch, ...prev]);
            setCreators((prev) =>
                prev.map((c) =>
                    c.id === creatorId
                        ? {
                            ...c,
                            commissionOwed: '0',
                            commissionPaid: String(Number(c.commissionPaid || 0) + Number(amount || 0)),
                        }
                        : c,
                ),
            );
            setShowAddPayout(false);
            showToast(`Payout batch ${batch.reference} created`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create payout', 'error');
        }
    };

    const handleExport = () => {
        const rows: Array<Array<string | number>> = [
            ['Creator', 'Handle', 'Platform', 'Rate %', 'Orders', 'Revenue', 'Owed', 'Paid'],
            ...creators.map((c) => [
                c.name,
                c.handle,
                c.platform,
                c.commissionRate,
                c.ordersCount,
                c.revenue,
                c.commissionOwed,
                c.commissionPaid,
            ]),
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `creators-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Creators exported');
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
                            <UserRound className="w-3.5 h-3.5 text-slate-400" />
                            Creators &amp; Affiliates
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Manage creators, partnerships, commissions, and payouts.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button onClick={() => void load(true)} disabled={refreshing || loading} className={btnSecondary}>
                            <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button onClick={handleExport} className={btnSecondary}>
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => setShowAddCreator(true)} className={btnPrimary}>
                            <Plus className="w-3 h-3" /> Add creator
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
                            <p className="text-[13px] font-semibold text-slate-900">Couldn&apos;t load creators</p>
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
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading creators…
                    </div>
                </Card>
            ) : (
                <>
                    {section === 'overview' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                <Kpi icon={<Users className="w-3.5 h-3.5" />} label="Total creators" value={NUM(stats.total)} sub={`${stats.active} active`} />
                                <Kpi icon={<Link2 className="w-3.5 h-3.5" />} label="Attributed orders" value={NUM(stats.totalOrders)} />
                                <Kpi icon={<Banknote className="w-3.5 h-3.5" />} label="Creator revenue" value={KES(stats.totalRevenue)} />
                                <Kpi icon={<Wallet className="w-3.5 h-3.5" />} label="Owed to creators" value={KES(stats.totalOwed)} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                                <Card className="lg:col-span-2">
                                    <CardHeader title="Performance trend" subtitle="Recent creator-attributed activity" />
                                    <div className="h-60 w-full p-2">
                                        {performanceData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data yet</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={performanceData}>
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
                                    <CardHeader
                                        title="Top creators"
                                        subtitle="By revenue"
                                        action={
                                            <button onClick={() => setSection('directory')} className="text-[13px] font-medium text-blue-950 hover:underline">
                                                View all
                                            </button>
                                        }
                                    />
                                    <div className="p-2 space-y-1">
                                        {topCreators.length === 0 ? (
                                            <EmptyCard icon={<UserRound className="w-5 h-5" />} title="No creators yet" description="Add your first creator to start tracking." />
                                        ) : (
                                            topCreators.map((c) => (
                                                <div key={c.id} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                                    <Avatar name={c.name} className="w-7 h-7" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-medium text-slate-900 truncate">{c.name}</p>
                                                        <p className="text-[13px] text-slate-400 truncate font-mono">{c.handle}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[13px] font-medium text-slate-900 tabular-nums">{KES(c.revenue)}</p>
                                                        <p className="text-[13px] text-slate-400 tabular-nums">{c.ordersCount} orders</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {section === 'directory' && (
                        <Card>
                            <CardHeader
                                title="Creator directory"
                                subtitle={`${filteredCreators.length} creator${filteredCreators.length === 1 ? '' : 's'}`}
                                action={
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                            <input
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder="Search creators…"
                                                className={cn(inputCls, 'w-56 pl-7')}
                                            />
                                        </div>
                                        <button onClick={() => setShowAddCreator(true)} className={btnPrimary}>
                                            <Plus className="w-3 h-3" /> Add
                                        </button>
                                    </div>
                                }
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Creator</th>
                                            <th className="py-2 px-2 font-medium">Platform</th>
                                            <th className="py-2 px-2 font-medium text-center">Rate</th>
                                            <th className="py-2 px-2 font-medium text-center">Orders</th>
                                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                                            <th className="py-2 px-2 font-medium text-right">Owed</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 w-16" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredCreators.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No creators yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCreators.map((c) => (
                                                <tr key={c.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Thumb src={c.avatar} className="w-7 h-7" />
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 truncate">{c.name}</p>
                                                                <p className="text-[13px] text-slate-400 font-mono truncate">{c.handle}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-600">{c.platform || '—'}</td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{c.commissionRate}%</td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{c.ordersCount}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900">{KES(c.revenue)}</td>
                                                    <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">
                                                        {Number(c.commissionOwed || 0) ? KES(c.commissionOwed) : '—'}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={c.status}
                                                            variant={c.status === 'Active' ? 'success' : c.status === 'Paused' ? 'warning' : 'neutral'}
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        <button className={iconBtn} onClick={() => setSelectedCreator(c)} aria-label="View creator">
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'applications' && (
                        <Card>
                            <CardHeader title="Applications & invitations" subtitle={`${applicationRows.length} pending`} />
                            <div className="p-2 space-y-1">
                                {applicationRows.length === 0 ? (
                                    <EmptyCard icon={<Sparkles className="w-5 h-5" />} title="No pending applications" description="Applications from creators will appear here." />
                                ) : (
                                    applicationRows.map((a) => (
                                        <div key={a.id} className="flex flex-wrap items-center gap-2 p-2 border border-slate-200 rounded">
                                            <Avatar name={a.name} className="w-7 h-7" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{a.name}</p>
                                                <p className="text-[13px] text-slate-400 truncate">
                                                    {a.handle}
                                                    {a.followers ? ` · ${NUM(a.followers)} followers` : ''}
                                                    {a.niche ? ` · ${a.niche}` : ''}
                                                </p>
                                            </div>
                                            <StatusBadge
                                                label={a.status}
                                                variant={a.status === 'Approved' ? 'success' : a.status === 'Rejected' ? 'danger' : 'warning'}
                                            />
                                            <span className="text-[13px] text-slate-400">{formatDate(a.createdAt)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'partnerships' && (
                        <Card>
                            <CardHeader title="Partnerships" subtitle={`${partnershipRows.length} partnership${partnershipRows.length === 1 ? '' : 's'}`} />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Creator</th>
                                            <th className="py-2 px-2 font-medium text-center">Rate</th>
                                            <th className="py-2 px-2 font-medium text-center">Orders</th>
                                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                                            <th className="py-2 px-2 font-medium">Started</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {partnershipRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No partnerships yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            partnershipRows.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar name={p.creatorName} className="w-7 h-7" />
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 truncate">{p.creatorName}</p>
                                                                <p className="text-[13px] text-slate-400 font-mono truncate">{p.handle}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{p.rate}%</td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{p.orders}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900">{KES(p.revenue)}</td>
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(p.startDate)}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={p.status}
                                                            variant={p.status === 'Active' ? 'success' : p.status === 'Paused' ? 'warning' : 'neutral'}
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

                    {section === 'samples' && (
                        <Card>
                            <CardHeader title="Product samples" subtitle={`${sampleRows.length} sample request${sampleRows.length === 1 ? '' : 's'}`} />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Creator</th>
                                            <th className="py-2 px-2 font-medium">Product</th>
                                            <th className="py-2 px-2 font-medium text-center">Qty</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium">Requested</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sampleRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No samples requested.
                                                </td>
                                            </tr>
                                        ) : (
                                            sampleRows.map((s) => (
                                                <tr key={s.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar name={s.creatorName} className="w-7 h-7" />
                                                            <span className="font-medium text-slate-900 truncate">{s.creatorName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Thumb src={s.productImage} className="w-7 h-7" />
                                                            <span className="text-slate-700 truncate max-w-[200px]">{s.productName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{s.quantity}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={s.status}
                                                            variant={s.status === 'Delivered' ? 'success' : s.status === 'Dispatched' ? 'info' : 'warning'}
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(s.requestedAt)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'links' && (
                        <Card>
                            <CardHeader title="Affiliate links & codes" subtitle={`${affiliateLinks.length} active`} />
                            <div className="p-2 space-y-1">
                                {affiliateLinks.length === 0 ? (
                                    <EmptyCard icon={<Link2 className="w-5 h-5" />} title="No affiliate links yet" description="Affiliate links appear once creators are active." />
                                ) : (
                                    affiliateLinks.map((l) => (
                                        <div key={l.id} className="border border-slate-200 rounded p-2 space-y-1">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-medium text-slate-900 truncate">{l.creatorName}</p>
                                                    <p className="text-[13px] text-slate-400 font-mono">{l.code}</p>
                                                </div>
                                                <StatusBadge label={l.status} variant="success" />
                                            </div>
                                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                                <span className="text-[13px] text-slate-600 font-mono truncate flex-1">{l.link}</span>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(l.link);
                                                        showToast('Link copied');
                                                    }}
                                                    className={iconBtn}
                                                    aria-label="Copy link"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4 text-[13px] text-slate-500 pt-1">
                                                <span>{l.orders} orders</span>
                                                <span>{KES(l.revenue)}</span>
                                                <span>Conv. {l.conversion}%</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'commissions' && (
                        <Card>
                            <CardHeader
                                title="Commissions"
                                subtitle={`${commissionRows.length} creator${commissionRows.length === 1 ? '' : 's'}`}
                                action={
                                    <button onClick={() => setShowAddPayout(true)} disabled={stats.totalOwed <= 0} className={btnPrimary}>
                                        <Banknote className="w-3 h-3" /> New payout
                                    </button>
                                }
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Creator</th>
                                            <th className="py-2 px-2 font-medium text-center">Rate</th>
                                            <th className="py-2 px-2 font-medium text-right">Attributed</th>
                                            <th className="py-2 px-2 font-medium text-right">Commission</th>
                                            <th className="py-2 px-2 font-medium text-right">Paid</th>
                                            <th className="py-2 px-2 font-medium text-right">Owed</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {commissionRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No commissions yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            commissionRows.map((c) => (
                                                <tr key={c.creatorId} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar name={c.creatorName} className="w-7 h-7" />
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 truncate">{c.creatorName}</p>
                                                                <p className="text-[13px] text-slate-400 font-mono truncate">{c.handle}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-center tabular-nums">{c.rate}%</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-700 tabular-nums">{KES(c.revenue)}</td>
                                                    <td className="py-2 px-2 text-right font-mono font-medium text-slate-900 tabular-nums">{KES(c.commissionAmount)}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-700 tabular-nums">{KES(c.paid)}</td>
                                                    <td className="py-2 px-2 text-right font-mono font-medium text-slate-900 tabular-nums">{KES(c.owed)}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge label={c.status} variant={c.status === 'Paid' ? 'success' : c.status === 'Payable' ? 'warning' : 'neutral'} />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'payouts' && (
                        <Card>
                            <CardHeader
                                title="Payouts"
                                subtitle={`${payouts.length} batch${payouts.length === 1 ? '' : 'es'}`}
                                action={<button onClick={() => setShowAddPayout(true)} className={btnPrimary}><Plus className="w-3 h-3" /> New</button>}
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Reference</th>
                                            <th className="py-2 px-2 font-medium">Method</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {payouts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No payouts recorded.
                                                </td>
                                            </tr>
                                        ) : (
                                            payouts.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2 font-mono font-medium text-slate-900">{p.reference}</td>
                                                    <td className="py-2 px-2 text-slate-600">{p.payoutMethod || '—'}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={p.status}
                                                            variant={p.status === 'Paid' ? 'success' : p.status === 'Failed' ? 'danger' : 'warning'}
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'performance' && (
                        <Card>
                            <CardHeader title="Creator performance" subtitle="Ranked by revenue" />
                            <div className="p-2 space-y-1">
                                {[...creators]
                                    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
                                    .map((c) => (
                                        <div key={c.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded">
                                            <Avatar name={c.name} className="w-7 h-7" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{c.name}</p>
                                                <p className="text-[13px] text-slate-400 font-mono truncate">{c.handle}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[13px] font-medium text-slate-900 tabular-nums">{KES(c.revenue)}</p>
                                                <p className="text-[13px] text-slate-400 tabular-nums">{c.ordersCount} orders</p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </Card>
                    )}

                    {section === 'reports' && (
                        <Card>
                            <CardHeader
                                title="Reports"
                                subtitle="Export creator-related data"
                                action={
                                    <button onClick={handleExport} className={btnSecondary}>
                                        <Download className="w-3 h-3" /> Export CSV
                                    </button>
                                }
                            />
                            <div className="p-2 space-y-1 text-[13px] text-slate-600">
                                <p>Use the Export button to download a CSV of every creator with:</p>
                                <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                                    <li>Name, handle, and platform</li>
                                    <li>Commission rate</li>
                                    <li>Attributed order count</li>
                                    <li>Revenue generated</li>
                                    <li>Commission owed and paid</li>
                                </ul>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {selectedCreator && (
                <Modal onClose={() => setSelectedCreator(null)} title={selectedCreator.name} subtitle={selectedCreator.handle}>
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <MiniStat label="Rate" value={`${selectedCreator.commissionRate}%`} />
                            <MiniStat label="Orders" value={NUM(selectedCreator.ordersCount)} />
                            <MiniStat label="Revenue" value={KES(selectedCreator.revenue)} />
                            <MiniStat label="Owed" value={KES(selectedCreator.commissionOwed)} />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button onClick={() => setSelectedCreator(null)} className={btnSecondary}>
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showAddCreator && <AddCreatorModal onClose={() => setShowAddCreator(false)} onSubmit={handleAddCreator} />}
            {showAddPayout && <NewPayoutModal creators={creators} onClose={() => setShowAddPayout(false)} onSubmit={handleCreatePayout} />}
        </div>
    );
}

function AddCreatorModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: AdminDirectCreatorWrite) => void }) {
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [platform, setPlatform] = useState<'TikTok' | 'Instagram' | 'YouTube'>('TikTok');
    const [rate, setRate] = useState('10');
    const [avatar, setAvatar] = useState('');

    return (
        <Modal onClose={onClose} title="Add creator" subtitle="Add a new creator">
            <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Name" required>
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="Handle" required>
                        <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
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
                    <Field label="Commission rate (%)" required>
                        <input type="number" className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} />
                    </Field>
                    <Field label="Avatar URL">
                        <input className={inputCls} value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
                    </Field>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>
                        Cancel
                    </button>
                    <button
                        onClick={() =>
                            onSubmit({
                                name,
                                handle,
                                platform,
                                commissionRate: Number(rate || 0),
                                avatar,
                            })
                        }
                        disabled={!name || !handle}
                        className={btnPrimary}
                    >
                        <CheckCircle2 className="w-3 h-3" /> Add creator
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function NewPayoutModal({
    creators,
    onClose,
    onSubmit,
}: {
    creators: AdminDirectCreator[];
    onClose: () => void;
    onSubmit: (creatorId: number, amount: number) => void;
}) {
    const [creatorId, setCreatorId] = useState<number>(creators[0]?.id || 0);
    const creator = creators.find((c) => c.id === creatorId);
    const amount = Number(creator?.commissionOwed || 0);

    return (
        <Modal onClose={onClose} title="New payout" subtitle="Create a payout batch">
            <div className="space-y-2">
                <Field label="Creator" required>
                    <select className={inputCls} value={creatorId} onChange={(e) => setCreatorId(Number(e.target.value))}>
                        {creators.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} — owed {KES(c.commissionOwed)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Amount">
                    <input className={inputCls} value={KES(amount)} disabled />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>
                        Cancel
                    </button>
                    <button onClick={() => onSubmit(creatorId, amount)} disabled={amount <= 0} className={btnPrimary}>
                        <Banknote className="w-3 h-3" /> Create payout
                    </button>
                </div>
            </div>
        </Modal>
    );
}