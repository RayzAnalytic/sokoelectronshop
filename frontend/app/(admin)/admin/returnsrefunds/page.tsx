'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    RotateCcw,
    Search,
    Check,
    X,
    Clock,
    CreditCard,
    Package,
    Truck,
    Eye,
    MoreVertical,
    Download,
    Bell,
    MessageSquare,
    Mail,
    Smartphone,
    ThumbsUp,
    ThumbsDown,
    Banknote,
    History,
    Settings as SettingsIcon,
    Save,
    Plus,
    Trash2,
    FileText,
    User,
    MapPin,
    Info,
    CheckCircle2,
    Hourglass,
    Loader2,
    ChevronDown,
} from 'lucide-react';

import { adminApi } from '@/lib/admin-api';
import type {
    AdminReturnRequest,
    AdminReturnStatus,
    AdminReturnReason,
    AdminRefundMethod,
    AdminRefundRecord,
    AdminRefundStatus,
    AdminReturnStats,
    AdminReturnHistoryPoint,
    AdminReturnSettings,
} from '@/lib/admin-types';

type TabKey = 'requests' | 'refunds' | 'history' | 'settings';

type SortKey = 'recent' | 'oldest' | 'amount_high' | 'amount_low';

const RETURN_STATUS_STYLES: Record<AdminReturnStatus, string> = {
    REQUESTED: 'bg-amber-50 text-amber-700 border-amber-100',
    UNDER_REVIEW: 'bg-blue-50 text-blue-800 border-blue-100',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
    AWAITING_ITEM: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    ITEM_RECEIVED: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const REFUND_STATUS_STYLES: Record<AdminRefundStatus, string> = {
    NONE: 'bg-slate-100 text-slate-500 border-slate-200',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
    PROCESSING: 'bg-blue-50 text-blue-800 border-blue-100',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-100',
};

const RETURN_STATUS_LABEL: Record<AdminReturnStatus, string> = {
    REQUESTED: 'Requested',
    UNDER_REVIEW: 'Under review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    AWAITING_ITEM: 'Awaiting item',
    ITEM_RECEIVED: 'Item received',
    CLOSED: 'Closed',
};

const REFUND_STATUS_LABEL: Record<AdminRefundStatus, string> = {
    NONE: '—',
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
};

const REFUND_METHOD_LABEL: Record<AdminRefundMethod, string> = {
    original: 'Original payment',
    store_credit: 'Store credit',
    bank_transfer: 'Bank transfer',
    manual: 'Manual',
};

const CONDITION_LABEL: Record<string, string> = {
    unopened: 'Unopened',
    opened: 'Opened',
    damaged: 'Damaged',
    defective: 'Defective',
};

const inputCls =
    'w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950';

const selectCls =
    'bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950';

function fmtKES(n: number | string | null | undefined): string {
    const v = typeof n === 'number' ? n : Number(n ?? 0);
    if (!Number.isFinite(v)) return 'KES 0';
    return `KES ${v.toLocaleString('en-KE')}`;
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function fmtDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-KE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function daysSince(iso: string | null | undefined): number {
    if (!iso) return 0;
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

interface ConfirmActionState {
    kind: 'approve' | 'reject' | 'refund';
    ret: AdminReturnRequest;
}

export default function ReturnsPage() {
    const [tab, setTab] = useState<TabKey>('requests');

    const [returns, setReturns] = useState<AdminReturnRequest[]>([]);
    const [refunds, setRefunds] = useState<AdminRefundRecord[]>([]);
    const [reasons, setReasons] = useState<AdminReturnReason[]>([]);
    const [stats, setStats] = useState<AdminReturnStats | null>(null);
    const [history, setHistory] = useState<AdminReturnHistoryPoint[]>([]);
    const [settings, setSettings] = useState<AdminReturnSettings | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | AdminReturnStatus>('ALL');
    const [refundFilter, setRefundFilter] = useState<'ALL' | AdminRefundStatus>('ALL');
    const [sort, setSort] = useState<SortKey>('recent');

    const [openDetailId, setOpenDetailId] = useState<number | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);
    const [toast, setToast] = useState('');

    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flash = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    }, []);

    const loadReturns = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminApi.returns.list({
                q: query.trim() || undefined,
                status: statusFilter,
                refund_status: refundFilter,
                sort,
            });
            setReturns(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load returns.');
        } finally {
            setLoading(false);
        }
    }, [query, statusFilter, refundFilter, sort]);

    const loadRefunds = useCallback(async () => {
        try {
            const data = await adminApi.returns.refunds(query.trim());
            setRefunds(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load refunds.');
        }
    }, [query]);

    const loadReasons = useCallback(async () => {
        try {
            const data = await adminApi.returns.reasons.list();
            setReasons(data);
        } catch {
        }
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const data = await adminApi.returns.stats();
            setStats(data);
        } catch {
        }
    }, []);

    const loadHistory = useCallback(async () => {
        try {
            const data = await adminApi.returns.history();
            setHistory(data);
        } catch {
        }
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const data = await adminApi.returns.settings.get();
            setSettings(data);
        } catch {
        }
    }, []);

    useEffect(() => {
        void loadReasons();
        void loadStats();
        void loadSettings();
        void loadRefunds();
    }, [loadReasons, loadStats, loadSettings, loadRefunds]);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            void loadReturns();
        }, 250);
        return () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        };
    }, [loadReturns]);

    useEffect(() => {
        if (tab === 'history') void loadHistory();
        if (tab === 'refunds') void loadRefunds();
    }, [tab, loadHistory, loadRefunds]);

    const openDetail = useMemo(
        () => (openDetailId === null ? null : returns.find((r) => r.id === openDetailId) ?? null),
        [openDetailId, returns],
    );

    const kpis = useMemo(() => {
        const pending = stats?.pending ?? 0;
        const approved = stats?.approved ?? 0;
        const refunded30d = stats?.refunded30d ?? 0;
        const avgDays = stats?.avgDays ?? 0;
        const completed = stats?.completed30d ?? 0;
        return { pending, approved, refunded30d, avgDays, completed };
    }, [stats]);

    async function refreshAfterMutation() {
        await Promise.all([loadReturns(), loadStats(), loadRefunds()]);
    }

    async function handleApprove(ret: AdminReturnRequest) {
        setBusyId(ret.id);
        try {
            await adminApi.returns.approve(ret.id);
            await refreshAfterMutation();
            flash(`Return ${ret.code} approved`);
        } catch (err) {
            flash(err instanceof Error ? err.message : 'Could not approve return');
        } finally {
            setBusyId(null);
            setConfirmAction(null);
        }
    }

    async function handleReject(ret: AdminReturnRequest, note = '') {
        setBusyId(ret.id);
        try {
            await adminApi.returns.reject(ret.id, note);
            await refreshAfterMutation();
            flash(`Return ${ret.code} rejected`);
        } catch (err) {
            flash(err instanceof Error ? err.message : 'Could not reject return');
        } finally {
            setBusyId(null);
            setConfirmAction(null);
        }
    }

    async function handleRefund(ret: AdminReturnRequest) {
        setBusyId(ret.id);
        try {
            await adminApi.returns.refund(ret.id, { method: ret.refundMethod });
            await refreshAfterMutation();
            flash(`Refund of ${fmtKES(ret.originalAmount)} processed`);
        } catch (err) {
            flash(err instanceof Error ? err.message : 'Could not process refund');
        } finally {
            setBusyId(null);
            setConfirmAction(null);
        }
    }

    async function handlePatchReturn(id: number, patch: Parameters<typeof adminApi.returns.patch>[1]) {
        setBusyId(id);
        try {
            await adminApi.returns.patch(id, patch);
            const data = await adminApi.returns.list({
                q: query.trim() || undefined,
                status: statusFilter,
                refund_status: refundFilter,
                sort,
            });
            setReturns(data);
        } catch (err) {
            flash(err instanceof Error ? err.message : 'Could not update return');
        } finally {
            setBusyId(null);
        }
    }

    async function handleSetRefundMethod(ret: AdminReturnRequest, method: AdminRefundMethod) {
        setBusyId(ret.id);
        try {
            await adminApi.returns.setRefundMethod(ret.id, method);
            setReturns((prev) =>
                prev.map((r) => (r.id === ret.id ? { ...r, refundMethod: method } : r)),
            );
        } catch (err) {
            flash(err instanceof Error ? err.message : 'Could not update refund method');
        } finally {
            setBusyId(null);
        }
    }

    const TABS: { key: TabKey; label: string; icon: typeof RotateCcw; count?: number }[] = [
        { key: 'requests', label: 'Return requests', icon: Package, count: returns.length },
        { key: 'refunds', label: 'Refunds', icon: CreditCard, count: refunds.length },
        { key: 'history', label: 'History', icon: History },
        { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-[1700px] mx-auto px-2 py-3 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
                            <RotateCcw className="w-4 h-4 text-blue-950" />
                            Returns &amp; Refunds
                        </h1>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Review return requests, approve refunds, and keep customers informed.
                        </p>
                    </div>
                    <button
                        onClick={() => flash('Export started — you will receive a CSV by email.')}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </header>

            <main className="max-w-[1700px] mx-auto px-0.5 py-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <KpiCard
                        icon={Hourglass}
                        label="Pending review"
                        value={kpis.pending.toString()}
                        sub="Awaiting a decision"
                        accent="text-amber-700 bg-amber-50"
                    />
                    <KpiCard
                        icon={CheckCircle2}
                        label="Approved"
                        value={kpis.approved.toString()}
                        sub="Ready to refund"
                        accent="text-emerald-700 bg-emerald-50"
                    />
                    <KpiCard
                        icon={Banknote}
                        label="Refunded (30d)"
                        value={fmtKES(kpis.refunded30d)}
                        sub={`${kpis.completed} refunds completed`}
                        accent="text-blue-950 bg-blue-50"
                    />
                    <KpiCard
                        icon={Clock}
                        label="Avg. resolution"
                        value={`${kpis.avgDays.toFixed(1)} days`}
                        sub="From request to refund"
                        accent="text-indigo-700 bg-indigo-50"
                    />
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-1 flex items-center gap-1 overflow-x-auto">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium whitespace-nowrap transition ${
                                tab === t.key
                                    ? 'bg-blue-50 text-blue-950 border border-blue-950'
                                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                            }`}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                            {t.count !== undefined && (
                                <span
                                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded-sm ${
                                        tab === t.key ? 'bg-white text-blue-950' : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-sm px-2 py-2 flex items-center justify-between gap-2">
                        <span className="text-[13px] text-red-700">{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-500 hover:text-red-700"
                            aria-label="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {tab === 'requests' && (
                    <>
                        <Toolbar
                            query={query}
                            onQuery={setQuery}
                            placeholder="Search by return ID, order, customer name or email…"
                        >
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as typeof statusFilter)
                                }
                                className={selectCls}
                            >
                                <option value="ALL">All statuses</option>
                                {Object.entries(RETURN_STATUS_LABEL).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={refundFilter}
                                onChange={(e) =>
                                    setRefundFilter(e.target.value as typeof refundFilter)
                                }
                                className={selectCls}
                            >
                                <option value="ALL">All refund states</option>
                                {Object.entries(REFUND_STATUS_LABEL)
                                    .filter(([k]) => k !== 'NONE')
                                    .map(([k, v]) => (
                                        <option key={k} value={k}>
                                            {v}
                                        </option>
                                    ))}
                            </select>
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SortKey)}
                                className={selectCls}
                            >
                                <option value="recent">Most recent</option>
                                <option value="oldest">Oldest first</option>
                                <option value="amount_high">Highest amount</option>
                                <option value="amount_low">Lowest amount</option>
                            </select>
                        </Toolbar>

                        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                            <th className="py-2 px-2 font-medium w-40">Return</th>
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium w-[200px]">Product</th>
                                            <th className="py-2 px-2 font-medium">Reason</th>
                                            <th className="py-2 px-2 font-medium text-right">Amount</th>
                                            <th className="py-2 px-2 font-medium w-[170px]">Status</th>
                                            <th className="py-2 px-2 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={7} className="py-16">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                                                        <p className="text-[13px] text-slate-500">
                                                            Loading returns…
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : returns.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-16 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                                                            <RotateCcw className="w-6 h-6" />
                                                        </span>
                                                        <h3 className="text-[15px] font-semibold text-slate-900">
                                                            No return requests
                                                        </h3>
                                                        <p className="text-[13px] text-slate-500 max-w-xs">
                                                            {query ||
                                                            statusFilter !== 'ALL' ||
                                                            refundFilter !== 'ALL'
                                                                ? 'Try changing your filters.'
                                                                : 'Customer returns will appear here.'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            returns.map((r) => {
                                                const days = daysSince(r.requestedAt);
                                                const urgent =
                                                    (r.status === 'REQUESTED' ||
                                                        r.status === 'UNDER_REVIEW') &&
                                                    days >= 2;
                                                const isBusy = busyId === r.id;
                                                const canDecide =
                                                    r.status === 'REQUESTED' ||
                                                    r.status === 'UNDER_REVIEW';
                                                const canRefund =
                                                    r.status === 'APPROVED' ||
                                                    r.status === 'ITEM_RECEIVED';

                                                return (
                                                    <tr
                                                        key={r.id}
                                                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                                                            isBusy ? 'opacity-50' : ''
                                                        }`}
                                                        onClick={() => setOpenDetailId(r.id)}
                                                    >
                                                        <td className="py-2 px-2">
                                                            <div className="font-mono font-medium text-slate-900">
                                                                {r.code}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {r.orderId}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <div className="font-medium text-slate-800 truncate max-w-[180px]">
                                                                {r.customer.name}
                                                            </div>
                                                            <div className="text-[13px] text-slate-400 truncate max-w-[180px]">
                                                                {r.customer.email}
                                                            </div>
                                                        </td>
                                                        <td
                                                            className="py-2 px-2"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ProductCell ret={r} />
                                                        </td>
                                                        <td className="py-2 px-2 text-slate-600 max-w-[180px] truncate">
                                                            {r.reason}
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums whitespace-nowrap">
                                                            {fmtKES(r.originalAmount)}
                                                        </td>
                                                        <td
                                                            className="py-2 px-2"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <StatusCell
                                                                ret={r}
                                                                urgent={urgent}
                                                                days={days}
                                                            />
                                                        </td>
                                                        <td
                                                            className="py-2 px-2"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Kebab
                                                                onView={() => setOpenDetailId(r.id)}
                                                                onApprove={
                                                                    canDecide
                                                                        ? () =>
                                                                              setConfirmAction({
                                                                                  kind: 'approve',
                                                                                  ret: r,
                                                                              })
                                                                        : undefined
                                                                }
                                                                onReject={
                                                                    canDecide
                                                                        ? () =>
                                                                              setConfirmAction({
                                                                                  kind: 'reject',
                                                                                  ret: r,
                                                                              })
                                                                        : undefined
                                                                }
                                                                onRefund={
                                                                    canRefund
                                                                        ? () =>
                                                                              setConfirmAction({
                                                                                  kind: 'refund',
                                                                                  ret: r,
                                                                              })
                                                                        : undefined
                                                                }
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {tab === 'refunds' && (
                    <>
                        <Toolbar
                            query={query}
                            onQuery={setQuery}
                            placeholder="Search refunds by return ID, order, or customer…"
                        />

                        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                            <th className="py-2 px-2 font-medium">Return</th>
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium text-right">
                                                Amount
                                            </th>
                                            <th className="py-2 px-2 font-medium">Method</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium">Created</th>
                                            <th className="py-2 px-2 font-medium">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {refunds.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="py-16 text-center text-slate-400"
                                                >
                                                    No refund records.
                                                </td>
                                            </tr>
                                        ) : (
                                            refunds.map((r) => (
                                                <tr
                                                    key={r.id}
                                                    className="hover:bg-slate-50 transition-colors"
                                                >
                                                    <td className="py-2 px-2">
                                                        <div className="font-mono font-medium text-slate-900">
                                                            {r.returnCode}
                                                        </div>
                                                        <div className="text-[13px] text-slate-400">
                                                            {r.orderId}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-700">
                                                        {r.customer}
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                                                        {fmtKES(r.amount)}
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-600">
                                                        {REFUND_METHOD_LABEL[r.method]}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <span
                                                            className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded-sm border ${
                                                                REFUND_STATUS_STYLES[r.status]
                                                            }`}
                                                        >
                                                            {REFUND_STATUS_LABEL[r.status]}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                                                        {fmtDateTime(r.createdAt)}
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-500 font-mono text-[13px]">
                                                        {r.reference || '—'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {tab === 'history' && <HistoryTab history={history} />}

                {tab === 'settings' && settings && (
                    <SettingsTab
                        reasons={reasons}
                        settings={settings}
                        onReloadReasons={loadReasons}
                        onSaveSettings={async (patch) => {
                            try {
                                const updated = await adminApi.returns.settings.update(patch);
                                setSettings(updated);
                                flash('Return settings saved');
                            } catch (err) {
                                flash(
                                    err instanceof Error
                                        ? err.message
                                        : 'Could not save settings',
                                );
                            }
                        }}
                        onFlash={flash}
                    />
                )}

                {tab === 'settings' && !settings && (
                    <div className="bg-white border border-slate-200 rounded-sm py-16 flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        <p className="text-[13px] text-slate-500">Loading settings…</p>
                    </div>
                )}
            </main>

            {openDetail && (
                <ReturnDrawer
                    ret={openDetail}
                    busy={busyId === openDetail.id}
                    onClose={() => setOpenDetailId(null)}
                    onSaveInternalNotes={(notes) =>
                        handlePatchReturn(openDetail.id, { internalNotes: notes })
                    }
                    onSetRefundMethod={(m) => handleSetRefundMethod(openDetail, m)}
                    onSetStatus={(s) => handlePatchReturn(openDetail.id, { status: s })}
                    onApprove={() =>
                        setConfirmAction({ kind: 'approve', ret: openDetail })
                    }
                    onReject={() => setConfirmAction({ kind: 'reject', ret: openDetail })}
                    onRefund={() => setConfirmAction({ kind: 'refund', ret: openDetail })}
                    onFlash={flash}
                />
            )}

            {confirmAction && (
                <ConfirmAction
                    action={confirmAction}
                    onCancel={() => setConfirmAction(null)}
                    onConfirm={() => {
                        if (confirmAction.kind === 'approve')
                            void handleApprove(confirmAction.ret);
                        else if (confirmAction.kind === 'reject')
                            void handleReject(confirmAction.ret);
                        else void handleRefund(confirmAction.ret);
                    }}
                />
            )}

            {toast && (
                <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white text-[13px] px-3 py-2.5 rounded-sm shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}

function StatusCell({
    ret,
    urgent,
    days,
}: {
    ret: AdminReturnRequest;
    urgent: boolean;
    days: number;
}) {
    return (
        <FloatingPanel
            align="left"
            width={260}
            trigger={({ open, toggle, ref }) => (
                <button
                    ref={ref}
                    onClick={toggle}
                    className={`inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-sm border text-[13px] font-medium transition ${
                        RETURN_STATUS_STYLES[ret.status]
                    } ${open ? 'ring-1 ring-blue-950' : 'hover:brightness-95'}`}
                >
                    <span className="whitespace-nowrap truncate">
                        {RETURN_STATUS_LABEL[ret.status]}
                    </span>
                    {urgent && (
                        <span className="text-[13px] font-medium bg-rose-50 text-rose-700 border border-rose-100 px-1 py-0.5 rounded-sm shrink-0">
                            {days}d
                        </span>
                    )}
                    <ChevronDown
                        className={`w-3 h-3 shrink-0 transition ${
                            open ? 'rotate-180' : ''
                        }`}
                    />
                </button>
            )}
        >
            {({ close }) => (
                <div className="p-2 space-y-2 text-[13px]">
                    <div className="px-1 py-0.5 flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[13px] uppercase tracking-wide font-medium text-slate-400">
                            Return status
                        </span>
                        <button
                            onClick={close}
                            className="text-slate-400 hover:text-slate-700"
                            aria-label="Close"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div>
                        <div className="text-[13px] uppercase tracking-wide font-medium text-slate-400 mb-1">
                            Status
                        </div>
                        <span
                            className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded-sm border ${
                                RETURN_STATUS_STYLES[ret.status]
                            }`}
                        >
                            {RETURN_STATUS_LABEL[ret.status]}
                        </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <div className="text-[13px] uppercase tracking-wide font-medium text-slate-400 mb-1">
                            Refund
                        </div>
                        <span
                            className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded-sm border ${
                                REFUND_STATUS_STYLES[ret.refundStatus]
                            }`}
                        >
                            {REFUND_STATUS_LABEL[ret.refundStatus]}
                        </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <div className="text-[13px] uppercase tracking-wide font-medium text-slate-400 mb-1">
                            Requested
                        </div>
                        <div className="text-[13px] text-slate-800">
                            {fmtDate(ret.requestedAt)}
                        </div>
                        <div className="text-[13px] text-slate-400 mt-0.5">
                            {days === 0 ? 'Today' : `${days} days ago`}
                        </div>
                    </div>
                </div>
            )}
        </FloatingPanel>
    );
}

function ProductCell({ ret }: { ret: AdminReturnRequest }) {
    const first = ret.items[0];
    const extra = ret.items.length - 1;

    return (
        <FloatingPanel
            align="left"
            width={340}
            trigger={({ open, toggle, ref }) => (
                <button
                    ref={ref}
                    onClick={toggle}
                    className={`w-full flex items-center gap-2 text-left px-1.5 py-1 -mx-1.5 rounded-sm transition ${
                        open ? 'bg-blue-50' : 'hover:bg-slate-100'
                    }`}
                >
                    <div className="w-8 h-8 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        {first?.image ? (
                            <img
                                src={first.image}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-slate-800 truncate">
                            {first?.productName ?? '—'}
                        </div>
                        {extra > 0 && (
                            <div className="text-[13px] text-slate-400">
                                +{extra} more
                            </div>
                        )}
                    </div>
                    <ChevronDown
                        className={`w-3 h-3 text-slate-400 shrink-0 transition ${
                            open ? 'rotate-180' : ''
                        }`}
                    />
                </button>
            )}
        >
            {({ close }) => (
                <div className="p-1">
                    <div className="px-2 py-1.5 flex items-center justify-between border-b border-slate-100">
                        <span className="text-[13px] uppercase tracking-wide font-medium text-slate-400">
                            {ret.items.length} item{ret.items.length === 1 ? '' : 's'}
                        </span>
                        <button
                            onClick={close}
                            className="text-slate-400 hover:text-slate-700"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {ret.items.map((it) => (
                            <div key={it.id} className="flex items-center gap-2 p-2">
                                <div className="w-10 h-10 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                                    {it.image ? (
                                        <img
                                            src={it.image}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-medium text-slate-900 truncate">
                                        {it.productName}
                                    </div>
                                    <div className="text-[13px] text-slate-400 font-mono truncate">
                                        {it.sku}
                                    </div>
                                    <div className="text-[13px] text-slate-500">
                                        Qty {it.qty} ·{' '}
                                        {CONDITION_LABEL[it.condition] ?? it.condition}
                                    </div>
                                </div>
                                <div className="text-[13px] font-semibold text-slate-900 tabular-nums shrink-0">
                                    {fmtKES(Number(it.price) * it.qty)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </FloatingPanel>
    );
}

function FloatingPanel({
    trigger,
    children,
    width = 320,
    align = 'left',
}: {
    trigger: (props: {
        open: boolean;
        toggle: () => void;
        ref: React.MutableRefObject<HTMLButtonElement | null>;
    }) => React.ReactNode;
    children: (props: { close: () => void }) => React.ReactNode;
    width?: number;
    align?: 'left' | 'right';
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{
        top: number;
        left: number;
        maxHeight: number;
    } | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    const openMenu = () => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();

        let left = align === 'right' ? rect.right - width : rect.left;
        if (left + width > window.innerWidth - 8) {
            left = window.innerWidth - width - 8;
        }
        if (left < 8) left = 8;

        const top = rect.bottom + 4;
        const maxHeight = Math.max(140, window.innerHeight - top - 8);

        setPos({ top, left, maxHeight });
        setOpen(true);
    };

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (triggerRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onScroll = () => setOpen(false);
        const onResize = () => setOpen(false);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <>
            {trigger({
                open,
                toggle: () => (open ? close() : openMenu()),
                ref: triggerRef,
            })}
            {open && pos && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        left: pos.left,
                        width,
                        maxHeight: pos.maxHeight,
                    }}
                    className="z-[120] bg-white border border-slate-200 rounded-sm shadow-lg overflow-y-auto"
                >
                    {children({ close })}
                </div>
            )}
        </>
    );
}

function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    accent,
}: {
    icon: typeof Clock;
    label: string;
    value: string;
    sub: string;
    accent: string;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
                <span
                    className={`w-6 h-6 rounded-sm flex items-center justify-center ${accent}`}
                >
                    <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">
                    {label}
                </span>
            </div>
            <div className="text-[15px] font-bold text-slate-900 truncate">{value}</div>
            <div className="text-[13px] text-slate-400 truncate">{sub}</div>
        </div>
    );
}

function Toolbar({
    query,
    onQuery,
    placeholder,
    children,
}: {
    query: string;
    onQuery: (v: string) => void;
    placeholder: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-0.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-2">{children}</div>
            )}
        </div>
    );
}

function Kebab({
    onView,
    onApprove,
    onReject,
    onRefund,
}: {
    onView: () => void;
    onApprove?: () => void;
    onReject?: () => void;
    onRefund?: () => void;
}) {
    return (
        <FloatingPanel
            align="right"
            width={200}
            trigger={({ open, toggle, ref }) => (
                <button
                    ref={ref}
                    onClick={toggle}
                    className={`p-1.5 rounded-sm transition ${
                        open
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <MoreVertical className="w-4 h-4" />
                </button>
            )}
        >
            {({ close }) => (
                <>
                    <MenuItem
                        icon={<Eye className="w-3.5 h-3.5" />}
                        label="View details"
                        onClick={() => {
                            close();
                            onView();
                        }}
                    />
                    {onApprove && (
                        <MenuItem
                            icon={<ThumbsUp className="w-3.5 h-3.5" />}
                            label="Approve return"
                            onClick={() => {
                                close();
                                onApprove();
                            }}
                        />
                    )}
                    {onReject && (
                        <MenuItem
                            icon={<ThumbsDown className="w-3.5 h-3.5" />}
                            label="Reject return"
                            onClick={() => {
                                close();
                                onReject();
                            }}
                            danger
                        />
                    )}
                    {onRefund && (
                        <MenuItem
                            icon={<CreditCard className="w-3.5 h-3.5" />}
                            label="Process refund"
                            onClick={() => {
                                close();
                                onRefund();
                            }}
                        />
                    )}
                </>
            )}
        </FloatingPanel>
    );
}

function MenuItem({
    icon,
    label,
    onClick,
    danger,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition ${
                danger
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-slate-700 hover:bg-slate-50'
            }`}
        >
            <span className={danger ? 'text-rose-500' : 'text-slate-400'}>{icon}</span>
            {label}
        </button>
    );
}

function ReturnDrawer({
    ret,
    busy,
    onClose,
    onSaveInternalNotes,
    onSetRefundMethod,
    onSetStatus,
    onApprove,
    onReject,
    onRefund,
    onFlash,
}: {
    ret: AdminReturnRequest;
    busy: boolean;
    onClose: () => void;
    onSaveInternalNotes: (notes: string) => void;
    onSetRefundMethod: (m: AdminRefundMethod) => void;
    onSetStatus: (s: AdminReturnStatus) => void;
    onApprove: () => void;
    onReject: () => void;
    onRefund: () => void;
    onFlash: (msg: string) => void;
}) {
    const [internal, setInternal] = useState(ret.internalNotes ?? '');

    useEffect(() => {
        setInternal(ret.internalNotes ?? '');
    }, [ret.id, ret.internalNotes]);

    const canDecide = ret.status === 'REQUESTED' || ret.status === 'UNDER_REVIEW';
    const canRefund = ret.status === 'APPROVED' || ret.status === 'ITEM_RECEIVED';

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`bg-white border-l border-slate-200 w-full max-w-2xl h-full overflow-y-auto shadow-xl flex flex-col ${
                    busy ? 'opacity-70 pointer-events-none' : ''
                }`}
            >
                <div className="px-2 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                            <RotateCcw className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                                {ret.code}
                            </h3>
                            <p className="text-[13px] text-slate-500 truncate">
                                {ret.orderId} · {fmtDate(ret.requestedAt)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded-sm border ${
                                RETURN_STATUS_STYLES[ret.status]
                            }`}
                        >
                            {RETURN_STATUS_LABEL[ret.status]}
                        </span>
                        <span
                            className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded-sm border ${
                                REFUND_STATUS_STYLES[ret.refundStatus]
                            }`}
                        >
                            Refund: {REFUND_STATUS_LABEL[ret.refundStatus]}
                        </span>
                        <span className="text-[13px] text-slate-400">
                            {daysSince(ret.requestedAt)} days ago
                        </span>
                    </div>

                    <Section title="Customer" icon={User}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                            <Field label="Name" value={ret.customer.name} />
                            <Field label="Email" value={ret.customer.email} mono />
                            <Field label="Phone" value={ret.customer.phone} mono />
                            {ret.address && <Field label="Address" value={ret.address} />}
                        </div>
                    </Section>

                    <Section title="Returned items" icon={Package}>
                        <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200 overflow-hidden">
                            {ret.items.map((it) => (
                                <li key={it.id} className="flex items-center gap-3 p-2">
                                    <div className="w-12 h-12 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                                        <img
                                            src={it.image}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium text-slate-900 truncate">
                                            {it.productName}
                                        </div>
                                        <div className="text-[13px] text-slate-400 font-mono">
                                            {it.sku}
                                        </div>
                                        <div className="text-[13px] text-slate-500 mt-0.5">
                                            Qty {it.qty} · Condition:{' '}
                                            <span className="font-medium">
                                                {CONDITION_LABEL[it.condition] ??
                                                    it.condition}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[13px] font-semibold text-slate-900 tabular-nums">
                                            {fmtKES(Number(it.price) * it.qty)}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-between pt-2 mt-1 border-t border-slate-100 text-[13px]">
                            <span className="text-slate-500">Order total</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                                {fmtKES(ret.originalAmount)}
                            </span>
                        </div>
                        {Number(ret.refundAmount) > 0 && (
                            <div className="flex justify-between text-[13px]">
                                <span className="text-slate-500">Refund amount</span>
                                <span className="font-semibold text-emerald-700 tabular-nums">
                                    {fmtKES(ret.refundAmount)}
                                </span>
                            </div>
                        )}
                    </Section>

                    <Section title="Return reason" icon={Info}>
                        <div className="rounded-sm border border-slate-200 p-2 space-y-1">
                            <div className="text-[13px] font-medium text-slate-900">
                                {ret.reason}
                            </div>
                            {ret.notes && (
                                <p className="text-[13px] text-slate-600 whitespace-pre-line">
                                    {ret.notes}
                                </p>
                            )}
                        </div>
                    </Section>

                    {ret.tracking && (
                        <Section title="Return tracking" icon={Truck}>
                            <div className="rounded-sm border border-slate-200 p-2 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-[13px] font-mono text-slate-700">
                                    {ret.tracking}
                                </span>
                            </div>
                        </Section>
                    )}

                    <Section title="Refund method" icon={CreditCard}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {(
                                [
                                    'original',
                                    'store_credit',
                                    'bank_transfer',
                                    'manual',
                                ] as AdminRefundMethod[]
                            ).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => onSetRefundMethod(m)}
                                    className={`text-[13px] font-medium py-2 px-2 rounded-sm border transition ${
                                        ret.refundMethod === m
                                            ? 'bg-blue-50 border-blue-950 text-blue-950'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {REFUND_METHOD_LABEL[m]}
                                </button>
                            ))}
                        </div>
                    </Section>

                    <Section title="Internal notes" icon={FileText}>
                        <textarea
                            value={internal}
                            onChange={(e) => setInternal(e.target.value)}
                            onBlur={() => {
                                if (internal !== (ret.internalNotes ?? '')) {
                                    onSaveInternalNotes(internal);
                                }
                            }}
                            rows={3}
                            placeholder="Notes visible only to your team…"
                            className={inputCls + ' resize-none'}
                        />
                    </Section>

                    <Section title="Set status" icon={SettingsIcon}>
                        <select
                            value={ret.status}
                            onChange={(e) =>
                                onSetStatus(e.target.value as AdminReturnStatus)
                            }
                            className={inputCls}
                        >
                            {Object.entries(RETURN_STATUS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </Section>
                </div>

                <div className="border-t border-slate-200 px-2 py-2 flex items-center justify-between gap-2 sticky bottom-0 bg-white shrink-0">
                    <button
                        onClick={() =>
                            onFlash(`Notification queued for ${ret.customer.email}`)
                        }
                        className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 px-2 py-2"
                    >
                        <Bell className="w-3.5 h-3.5" />
                        Notify customer
                    </button>
                    <div className="flex items-center gap-2">
                        {canDecide && (
                            <>
                                <button
                                    onClick={onReject}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 font-medium px-3 py-2 rounded-sm text-[13px]"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Reject
                                </button>
                                <button
                                    onClick={onApprove}
                                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Approve return
                                </button>
                            </>
                        )}
                        {canRefund && (
                            <button
                                onClick={onRefund}
                                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                Process refund
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ConfirmAction({
    action,
    onCancel,
    onConfirm,
}: {
    action: ConfirmActionState;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { kind, ret } = action;

    const config = {
        approve: {
            title: 'Approve this return?',
            icon: ThumbsUp,
            accent: 'bg-emerald-50 text-emerald-700',
            body: `We will email ${ret.customer.name} a return label and mark the refund as pending. Amount: ${fmtKES(ret.originalAmount)}.`,
            confirmLabel: 'Approve return',
            confirmCls: 'bg-blue-950 hover:bg-blue-900',
        },
        reject: {
            title: 'Reject this return?',
            icon: ThumbsDown,
            accent: 'bg-rose-50 text-rose-700',
            body: `The customer will be notified that their return for ${ret.code} was not approved. Include a reason in the notes before confirming.`,
            confirmLabel: 'Reject return',
            confirmCls: 'bg-rose-600 hover:bg-rose-500',
        },
        refund: {
            title: 'Process the refund?',
            icon: CreditCard,
            accent: 'bg-emerald-50 text-emerald-700',
            body: `${fmtKES(ret.originalAmount)} will be refunded to ${ret.customer.name} via ${REFUND_METHOD_LABEL[ret.refundMethod].toLowerCase()}. The return will be closed.`,
            confirmLabel: 'Process refund',
            confirmCls: 'bg-emerald-600 hover:bg-emerald-500',
        },
    }[kind];

    const Icon = config.icon;

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={onCancel}
        >
            <div
                className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    <span
                        className={`w-9 h-9 rounded-sm flex items-center justify-center ${config.accent}`}
                    >
                        <Icon className="w-4 h-4" />
                    </span>
                    <h3 className="text-[15px] font-semibold text-slate-900">
                        {config.title}
                    </h3>
                </div>
                <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                    {config.body}
                </p>
                <div className="flex justify-end gap-2 mt-3">
                    <button
                        onClick={onCancel}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`text-white font-medium px-3 py-2 rounded-sm text-[13px] ${config.confirmCls}`}
                    >
                        {config.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function HistoryTab({ history }: { history: AdminReturnHistoryPoint[] }) {
    return (
        <div className="space-y-3">
            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <header>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        Monthly refund summary
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        Refund volume vs. total orders, last four months.
                    </p>
                </header>
                {history.length === 0 ? (
                    <p className="text-[13px] text-slate-400 py-4 text-center">
                        No history yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500">
                                    <th className="py-1.5 px-2 font-medium">Month</th>
                                    <th className="py-1.5 px-2 font-medium text-right">
                                        Returns
                                    </th>
                                    <th className="py-1.5 px-2 font-medium text-right">
                                        Refunded
                                    </th>
                                    <th className="py-1.5 px-2 font-medium text-right">
                                        Return rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {history.map((m) => (
                                    <tr key={m.month} className="hover:bg-slate-50">
                                        <td className="py-1.5 px-2 text-slate-800">
                                            {m.month}
                                        </td>
                                        <td className="py-1.5 px-2 text-right text-slate-600 tabular-nums">
                                            {m.returns}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-medium text-slate-900 tabular-nums">
                                            {fmtKES(m.refunded)}
                                        </td>
                                        <td className="py-1.5 px-2 text-right text-slate-600 tabular-nums">
                                            {m.rate}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function SettingsTab({
    reasons,
    settings,
    onReloadReasons,
    onSaveSettings,
    onFlash,
}: {
    reasons: AdminReturnReason[];
    settings: AdminReturnSettings;
    onReloadReasons: () => Promise<void>;
    onSaveSettings: (patch: Partial<AdminReturnSettings>) => Promise<void>;
    onFlash: (msg: string) => void;
}) {
    const [draftSettings, setDraftSettings] = useState(settings);
    const [newReason, setNewReason] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraftSettings(settings);
    }, [settings]);

    async function toggleActive(reason: AdminReturnReason) {
        try {
            await adminApi.returns.reasons.update(reason.id, {
                active: !reason.active,
            });
            await onReloadReasons();
        } catch (err) {
            onFlash(err instanceof Error ? err.message : 'Could not update reason');
        }
    }

    async function togglePhoto(reason: AdminReturnReason) {
        try {
            await adminApi.returns.reasons.update(reason.id, {
                requiresPhoto: !reason.requiresPhoto,
            });
            await onReloadReasons();
        } catch (err) {
            onFlash(err instanceof Error ? err.message : 'Could not update reason');
        }
    }

    async function removeReason(reason: AdminReturnReason) {
        if (!confirm(`Remove reason "${reason.label}"?`)) return;
        try {
            await adminApi.returns.reasons.remove(reason.id);
            await onReloadReasons();
            onFlash('Reason removed');
        } catch (err) {
            onFlash(err instanceof Error ? err.message : 'Could not remove reason');
        }
    }

    async function addReason() {
        if (!newReason.trim()) return;
        try {
            await adminApi.returns.reasons.create({
                label: newReason.trim(),
                description: newDescription.trim() || undefined,
            });
            setNewReason('');
            setNewDescription('');
            await onReloadReasons();
            onFlash('Reason added');
        } catch (err) {
            onFlash(err instanceof Error ? err.message : 'Could not add reason');
        }
    }

    async function saveSettings() {
        setSaving(true);
        try {
            await onSaveSettings({
                returnWindowDays: draftSettings.returnWindowDays,
                autoApproveUnder: draftSettings.autoApproveUnder,
                restockingFeePct: draftSettings.restockingFeePct,
                notifyEmail: draftSettings.notifyEmail,
                notifySms: draftSettings.notifySms,
                notifyPush: draftSettings.notifyPush,
            });
        } finally {
            setSaving(false);
        }
    }

    const notifyRows = [
        { label: 'Return received', channels: ['email'] },
        { label: 'Return approved', channels: ['email', 'sms'] },
        { label: 'Return rejected', channels: ['email'] },
        { label: 'Refund processed', channels: ['email', 'sms'] },
        { label: 'Refund failed', channels: ['email'] },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <section className="lg:col-span-2 bg-white border border-slate-200 rounded-sm">
                <header className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            Return reasons
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Options customers can pick when submitting a return.
                        </p>
                    </div>
                </header>

                <ul className="divide-y divide-slate-100">
                    {reasons.map((r) => (
                        <li key={r.id} className="p-3 flex items-start gap-3">
                            <span
                                className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${
                                    r.active
                                        ? 'bg-blue-50 text-blue-950'
                                        : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                <Info className="w-4 h-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[13px] font-medium text-slate-900">
                                        {r.label}
                                    </span>
                                    <span
                                        className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm border ${
                                            r.active
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}
                                    >
                                        {r.active ? 'Active' : 'Hidden'}
                                    </span>
                                    {r.requiresPhoto && (
                                        <span className="text-[13px] font-medium px-1.5 py-0.5 rounded-sm border bg-amber-50 text-amber-700 border-amber-100">
                                            Requires photo
                                        </span>
                                    )}
                                </div>
                                <p className="text-[13px] text-slate-500 mt-0.5">
                                    {r.description}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => void togglePhoto(r)}
                                    title="Toggle photo requirement"
                                    className="p-1.5 rounded-sm text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => void toggleActive(r)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                                        r.active ? 'bg-blue-950' : 'bg-slate-300'
                                    }`}
                                    aria-label={r.active ? 'Deactivate' : 'Activate'}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                            r.active ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                                <button
                                    onClick={() => void removeReason(r)}
                                    className="p-1.5 rounded-sm text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                    aria-label="Remove"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </li>
                    ))}
                    {reasons.length === 0 && (
                        <li className="p-6 text-center text-[13px] text-slate-400">
                            No reasons yet. Add one below.
                        </li>
                    )}
                </ul>

                <div className="p-3 border-t border-slate-100 space-y-2">
                    <div className="text-[13px] font-medium text-slate-700">
                        Add a reason
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            value={newReason}
                            onChange={(e) => setNewReason(e.target.value)}
                            placeholder="Reason label, e.g. 'Late delivery'"
                            className={inputCls}
                        />
                        <input
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Short description (optional)"
                            className={inputCls}
                        />
                    </div>
                    <button
                        onClick={() => void addReason()}
                        disabled={!newReason.trim()}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add reason
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                    <header>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            Return policy
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Automatically applied to new requests.
                        </p>
                    </header>
                    <Field label="Return window (days)">
                        <input
                            type="number"
                            value={draftSettings.returnWindowDays}
                            onChange={(e) =>
                                setDraftSettings((s) => ({
                                    ...s,
                                    returnWindowDays: Number(e.target.value),
                                }))
                            }
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Auto-approve under amount (KES)">
                        <input
                            type="number"
                            value={Number(draftSettings.autoApproveUnder)}
                            onChange={(e) =>
                                setDraftSettings((s) => ({
                                    ...s,
                                    autoApproveUnder: e.target.value,
                                }))
                            }
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Restocking fee (%)">
                        <input
                            type="number"
                            value={Number(draftSettings.restockingFeePct)}
                            onChange={(e) =>
                                setDraftSettings((s) => ({
                                    ...s,
                                    restockingFeePct: e.target.value,
                                }))
                            }
                            className={inputCls}
                        />
                    </Field>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                    <header>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            Customer notifications
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Channels used to reach out at each stage.
                        </p>
                    </header>
                    <ul className="divide-y divide-slate-100 text-[13px]">
                        {notifyRows.map((row) => (
                            <li
                                key={row.label}
                                className="py-2 flex items-center justify-between gap-2"
                            >
                                <span className="text-slate-700">{row.label}</span>
                                <div className="flex items-center gap-1">
                                    {(['email', 'sms', 'push'] as const).map((c) => {
                                        const Icon =
                                            c === 'email'
                                                ? Mail
                                                : c === 'sms'
                                                ? Smartphone
                                                : MessageSquare;
                                        const on = row.channels.includes(c);
                                        return (
                                            <span
                                                key={c}
                                                title={c}
                                                className={`w-6 h-6 rounded-sm flex items-center justify-center border transition ${
                                                    on
                                                        ? 'bg-blue-50 border-blue-950 text-blue-950'
                                                        : 'bg-white border-slate-200 text-slate-300'
                                                }`}
                                            >
                                                <Icon className="w-3 h-3" />
                                            </span>
                                        );
                                    })}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <button
                    onClick={() => void saveSettings()}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="w-3.5 h-3.5" />
                            Save settings
                        </>
                    )}
                </button>
            </section>
        </div>
    );
}

function Section({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof User;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                {title}
            </div>
            {children}
        </section>
    );
}

function Field({
    label,
    value,
    mono,
    children,
}: {
    label: string;
    value?: string;
    mono?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <div>
            <div className="text-[13px] uppercase tracking-wide text-slate-400 font-medium">
                {label}
            </div>
            {children ?? (
                <div
                    className={`text-[13px] text-slate-800 mt-0.5 ${
                        mono ? 'font-mono' : ''
                    }`}
                >
                    {value}
                </div>
            )}
        </div>
    );
}