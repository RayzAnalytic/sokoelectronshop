'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    RotateCcw,
    Search,
    Check,
    X,
    AlertTriangle,
    Clock,
    CreditCard,
    Package,
    Truck,
    Eye,
    MoreVertical,
    ChevronDown,
    ChevronRight,
    Filter,
    Download,
    Bell,
    MessageSquare,
    Mail,
    Smartphone,
    Ban,
    ThumbsUp,
    ThumbsDown,
    Banknote,
    History,
    Settings as SettingsIcon,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Save,
    Plus,
    Trash2,
    Copy,
    FileText,
    User,
    Calendar,
    MapPin,
    ShoppingBag,
    Info,
    CheckCircle2,
    XCircle,
    Hourglass,
    RefreshCw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type TabKey = 'requests' | 'refunds' | 'history' | 'settings';

type ReturnStatus =
    | 'REQUESTED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'AWAITING_ITEM'
    | 'ITEM_RECEIVED'
    | 'CLOSED';

type RefundStatus =
    | 'NONE'
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';

type RefundMethod = 'original' | 'store_credit' | 'bank_transfer' | 'manual';

type NotificationChannel = 'email' | 'sms' | 'push';

interface ReturnItem {
    id: string;
    productName: string;
    sku: string;
    qty: number;
    price: number;
    image: string;
    condition: 'unopened' | 'opened' | 'damaged' | 'defective';
}

interface ReturnRequest {
    id: string;
    code: string;
    orderId: string;
    customer: {
        name: string;
        email: string;
        phone: string;
    };
    items: ReturnItem[];
    reason: string;
    reasonId: string;
    notes: string;
    status: ReturnStatus;
    refundStatus: RefundStatus;
    refundMethod: RefundMethod;
    requestedAt: string;
    resolvedAt?: string;
    refundAmount: number;
    originalAmount: number;
    address?: string;
    tracking?: string;
    internalNotes?: string;
}

interface ReturnReason {
    id: string;
    label: string;
    description: string;
    requiresPhoto: boolean;
    active: boolean;
}

interface RefundRecord {
    id: string;
    returnCode: string;
    orderId: string;
    customer: string;
    amount: number;
    method: RefundMethod;
    status: RefundStatus;
    createdAt: string;
    completedAt?: string;
    reference?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_RETURN_REASONS: ReturnReason[] = [
    { id: 'r1', label: 'Defective product', description: 'Item arrived broken or does not work', requiresPhoto: true, active: true },
    { id: 'r2', label: 'Wrong item received', description: 'Different product than ordered', requiresPhoto: true, active: true },
    { id: 'r3', label: 'Not as described', description: 'Product differs from the listing', requiresPhoto: true, active: true },
    { id: 'r4', label: 'Damaged in transit', description: 'Shipping damage', requiresPhoto: true, active: true },
    { id: 'r5', label: 'Changed my mind', description: 'Customer no longer wants the item', requiresPhoto: false, active: true },
    { id: 'r6', label: 'Found a better price', description: 'Better offer elsewhere', requiresPhoto: false, active: true },
    { id: 'r7', label: 'Late delivery', description: 'Arrived after the promised date', requiresPhoto: false, active: true },
    { id: 'r8', label: 'Missing accessories', description: 'Incomplete package', requiresPhoto: true, active: false },
];

const INITIAL_RETURNS: ReturnRequest[] = [
    {
        id: 'ret-1',
        code: 'RET-2026-0142',
        orderId: 'ORD-9921',
        customer: {
            name: 'Mary Wanjiku',
            email: 'mary.w@gmail.com',
            phone: '+254 712 345 678',
        },
        items: [
            {
                id: 'i1',
                productName: 'Sony WH-1000XM5 Noise Cancelling',
                sku: 'SNY-WH5-BLK',
                qty: 1,
                price: 42000,
                image: '/phone.jpeg',
                condition: 'defective',
            },
        ],
        reason: 'Defective product',
        reasonId: 'r1',
        notes: 'Left earcup produces crackling sound at any volume level.',
        status: 'REQUESTED',
        refundStatus: 'NONE',
        refundMethod: 'original',
        requestedAt: '2026-09-28T09:15:00Z',
        refundAmount: 0,
        originalAmount: 42000,
    },
    {
        id: 'ret-2',
        code: 'RET-2026-0141',
        orderId: 'ORD-9908',
        customer: {
            name: 'David Otieno',
            email: 'd.otieno@gmail.com',
            phone: '+254 722 456 789',
        },
        items: [
            {
                id: 'i1',
                productName: 'Logitech MX Master 3S Wireless Mouse',
                sku: 'LOG-MX3S-M',
                qty: 2,
                price: 14500,
                image: '/phone.jpeg',
                condition: 'unopened',
            },
        ],
        reason: 'Changed my mind',
        reasonId: 'r5',
        notes: 'Ordered two by mistake. Seals intact.',
        status: 'APPROVED',
        refundStatus: 'PENDING',
        refundMethod: 'original',
        requestedAt: '2026-09-27T14:22:00Z',
        refundAmount: 29000,
        originalAmount: 29000,
        address: 'Nairobi, Westlands',
    },
    {
        id: 'ret-3',
        code: 'RET-2026-0140',
        orderId: 'ORD-9887',
        customer: {
            name: 'Grace Muthoni',
            email: 'grace.m@gmail.com',
            phone: '+254 733 567 890',
        },
        items: [
            {
                id: 'i1',
                productName: 'Apex Ultra X1 Pro Smartphone 5G',
                sku: 'APX-X1-5G-BLK-256',
                qty: 1,
                price: 99999,
                image: '/phone.jpeg',
                condition: 'not_as_described' as never,
            },
        ],
        reason: 'Not as described',
        reasonId: 'r3',
        notes: 'Listing showed 512GB, delivered 256GB.',
        status: 'ITEM_RECEIVED',
        refundStatus: 'PROCESSING',
        refundMethod: 'original',
        requestedAt: '2026-09-22T11:05:00Z',
        refundAmount: 99999,
        originalAmount: 99999,
        tracking: 'G4S-8847293-KE',
    },
    {
        id: 'ret-4',
        code: 'RET-2026-0139',
        orderId: 'ORD-9863',
        customer: {
            name: 'Peter Kariuki',
            email: 'p.kariuki@gmail.com',
            phone: '+254 701 234 567',
        },
        items: [
            {
                id: 'i1',
                productName: 'Dell UltraSharp 27" 4K Monitor',
                sku: 'DLL-U27-4K',
                qty: 1,
                price: 42000,
                image: '/dellmonitor.jpeg',
                condition: 'damaged',
            },
        ],
        reason: 'Damaged in transit',
        reasonId: 'r4',
        notes: 'Screen cracked on the upper-right corner.',
        status: 'CLOSED',
        refundStatus: 'COMPLETED',
        refundMethod: 'original',
        requestedAt: '2026-09-15T08:40:00Z',
        resolvedAt: '2026-09-19T15:00:00Z',
        refundAmount: 42000,
        originalAmount: 42000,
        tracking: 'G4S-8819276-KE',
    },
    {
        id: 'ret-5',
        code: 'RET-2026-0138',
        orderId: 'ORD-9840',
        customer: {
            name: 'Amina Hassan',
            email: 'amina.h@gmail.com',
            phone: '+254 745 678 901',
        },
        items: [
            {
                id: 'i1',
                productName: 'Wireless Mechanical Keyboard K2',
                sku: 'MCH-K2-WL',
                qty: 1,
                price: 12999,
                image: '/phone.jpeg',
                condition: 'opened',
            },
        ],
        reason: 'Changed my mind',
        reasonId: 'r5',
        notes: 'Used for one day, not the switch type I wanted.',
        status: 'REJECTED',
        refundStatus: 'NONE',
        refundMethod: 'original',
        requestedAt: '2026-09-12T17:30:00Z',
        resolvedAt: '2026-09-13T10:00:00Z',
        refundAmount: 0,
        originalAmount: 12999,
        internalNotes: 'Opened and used; falls outside return policy for change-of-mind.',
    },
];

const INITIAL_REFUNDS: RefundRecord[] = [
    {
        id: 'rf-1',
        returnCode: 'RET-2026-0139',
        orderId: 'ORD-9863',
        customer: 'Peter Kariuki',
        amount: 42000,
        method: 'original',
        status: 'COMPLETED',
        createdAt: '2026-09-19T15:00:00Z',
        completedAt: '2026-09-20T09:30:00Z',
        reference: 'MPESA-8827461',
    },
    {
        id: 'rf-2',
        returnCode: 'RET-2026-0140',
        orderId: 'ORD-9887',
        customer: 'Grace Muthoni',
        amount: 99999,
        method: 'original',
        status: 'PROCESSING',
        createdAt: '2026-09-27T09:15:00Z',
    },
    {
        id: 'rf-3',
        returnCode: 'RET-2026-0141',
        orderId: 'ORD-9908',
        customer: 'David Otieno',
        amount: 29000,
        method: 'original',
        status: 'PENDING',
        createdAt: '2026-09-28T10:00:00Z',
    },
    {
        id: 'rf-4',
        returnCode: 'RET-2026-0135',
        orderId: 'ORD-9812',
        customer: 'Esther Njeri',
        amount: 18500,
        method: 'store_credit',
        status: 'COMPLETED',
        createdAt: '2026-09-10T14:20:00Z',
        completedAt: '2026-09-10T14:25:00Z',
        reference: 'CREDIT-ENS-0910',
    },
    {
        id: 'rf-5',
        returnCode: 'RET-2026-0130',
        orderId: 'ORD-9788',
        customer: 'John Kamau',
        amount: 14500,
        method: 'original',
        status: 'FAILED',
        createdAt: '2026-09-05T11:00:00Z',
        reference: 'MPESA-8815230',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const RETURN_STATUS_STYLES: Record<ReturnStatus, string> = {
    REQUESTED: 'bg-amber-50 text-amber-700 border-amber-100',
    UNDER_REVIEW: 'bg-blue-50 text-blue-800 border-blue-100',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
    AWAITING_ITEM: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    ITEM_RECEIVED: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const REFUND_STATUS_STYLES: Record<RefundStatus, string> = {
    NONE: 'bg-slate-100 text-slate-500 border-slate-200',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
    PROCESSING: 'bg-blue-50 text-blue-800 border-blue-100',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-100',
};

const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
    REQUESTED: 'Requested',
    UNDER_REVIEW: 'Under review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    AWAITING_ITEM: 'Awaiting item',
    ITEM_RECEIVED: 'Item received',
    CLOSED: 'Closed',
};

const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
    NONE: '—',
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
};

const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtKES(n: number) {
    return `KES ${n.toLocaleString('en-KE')}`;
}

function fmtDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function fmtDateTime(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-KE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function daysSince(iso: string): number {
    if (!iso) return 0;
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
    const [tab, setTab] = useState<TabKey>('requests');

    const [returns, setReturns] = useState<ReturnRequest[]>(INITIAL_RETURNS);
    const [refunds, setRefunds] = useState<RefundRecord[]>(INITIAL_REFUNDS);
    const [reasons, setReasons] = useState<ReturnReason[]>(INITIAL_RETURN_REASONS);

    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | ReturnStatus>('ALL');
    const [refundFilter, setRefundFilter] = useState<'ALL' | RefundStatus>('ALL');
    const [sort, setSort] = useState<'recent' | 'oldest' | 'amount_high' | 'amount_low'>('recent');

    const [openDetail, setOpenDetail] = useState<ReturnRequest | null>(null);
    const [openKebab, setOpenKebab] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<
        | { kind: 'approve'; ret: ReturnRequest }
        | { kind: 'reject'; ret: ReturnRequest }
        | { kind: 'refund'; ret: ReturnRequest }
        | null
    >(null);
    const [toast, setToast] = useState('');

    // Close kebab on outside click
    useEffect(() => {
        const onDoc = () => setOpenKebab(null);
        if (openKebab) document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
    }, [openKebab]);

    function flash(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    }

    // ── Filter + sort ─────────────────────────────────────────────────────────
    const filteredReturns = useMemo(() => {
        let list = [...returns];
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(
                (r) =>
                    r.code.toLowerCase().includes(q) ||
                    r.orderId.toLowerCase().includes(q) ||
                    r.customer.name.toLowerCase().includes(q) ||
                    r.customer.email.toLowerCase().includes(q),
            );
        }
        if (statusFilter !== 'ALL') list = list.filter((r) => r.status === statusFilter);
        if (refundFilter !== 'ALL') list = list.filter((r) => r.refundStatus === refundFilter);

        switch (sort) {
            case 'recent':
                list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
                break;
            case 'oldest':
                list.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
                break;
            case 'amount_high':
                list.sort((a, b) => b.originalAmount - a.originalAmount);
                break;
            case 'amount_low':
                list.sort((a, b) => a.originalAmount - b.originalAmount);
                break;
        }
        return list;
    }, [returns, query, statusFilter, refundFilter, sort]);

    const filteredRefunds = useMemo(() => {
        let list = [...refunds];
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(
                (r) =>
                    r.returnCode.toLowerCase().includes(q) ||
                    r.orderId.toLowerCase().includes(q) ||
                    r.customer.toLowerCase().includes(q),
            );
        }
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [refunds, query]);

    // ── KPI summary ───────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const pending = returns.filter(
            (r) => r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW',
        ).length;
        const approved = returns.filter((r) => r.status === 'APPROVED').length;
        const refunded30d = refunds
            .filter((r) => r.status === 'COMPLETED')
            .reduce((s, r) => s + r.amount, 0);
        const avgDays =
            returns
                .filter((r) => r.resolvedAt)
                .map((r) => daysSince(r.requestedAt) - daysSince(r.resolvedAt!))
                .reduce((s, d, _, arr) => s + d / arr.length, 0) || 2.4;
        return { pending, approved, refunded30d, avgDays };
    }, [returns, refunds]);

    // ── Actions ───────────────────────────────────────────────────────────────
    function updateReturn(id: string, patch: Partial<ReturnRequest>) {
        setReturns((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        setOpenDetail((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    }

    function approveReturn(ret: ReturnRequest) {
        updateReturn(ret.id, { status: 'APPROVED' });
        setRefunds((prev) => [
            {
                id: `rf-${Date.now()}`,
                returnCode: ret.code,
                orderId: ret.orderId,
                customer: ret.customer.name,
                amount: ret.originalAmount,
                method: ret.refundMethod,
                status: 'PENDING',
                createdAt: new Date().toISOString(),
            },
            ...prev,
        ]);
        updateReturn(ret.id, {
            status: 'APPROVED',
            refundStatus: 'PENDING',
            refundAmount: ret.originalAmount,
        });
        setConfirmAction(null);
        flash(`Return ${ret.code} approved`);
    }

    function rejectReturn(ret: ReturnRequest) {
        updateReturn(ret.id, {
            status: 'REJECTED',
            resolvedAt: new Date().toISOString(),
        });
        setConfirmAction(null);
        flash(`Return ${ret.code} rejected`);
    }

    function startRefund(ret: ReturnRequest) {
        updateReturn(ret.id, {
            status: 'CLOSED',
            refundStatus: 'COMPLETED',
            resolvedAt: new Date().toISOString(),
        });
        setRefunds((prev) =>
            prev.map((r) =>
                r.returnCode === ret.code
                    ? { ...r, status: 'COMPLETED', completedAt: new Date().toISOString() }
                    : r,
            ),
        );
        setConfirmAction(null);
        flash(`Refund of ${fmtKES(ret.originalAmount)} processed`);
    }

    // ── Tabs config ───────────────────────────────────────────────────────────
    const TABS: { key: TabKey; label: string; icon: typeof RotateCcw; count?: number }[] = [
        { key: 'requests', label: 'Return requests', icon: Package, count: returns.length },
        { key: 'refunds', label: 'Refunds', icon: CreditCard, count: refunds.length },
        { key: 'history', label: 'History', icon: History },
        { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
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

            <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

                {/* KPI CARDS */}
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
                        sub={`${refunds.filter((r) => r.status === 'COMPLETED').length} refunds completed`}
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

                {/* TABS */}
                <div className="bg-white border border-slate-200 rounded-sm p-1 flex items-center gap-1 overflow-x-auto">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium whitespace-nowrap transition ${tab === t.key
                                    ? 'bg-blue-50 text-blue-950 border border-blue-950'
                                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                                }`}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                            {t.count !== undefined && (
                                <span
                                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded-sm ${tab === t.key ? 'bg-white text-blue-950' : 'bg-slate-100 text-slate-500'
                                        }`}
                                >
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── REQUESTS TAB ──────────────────────────────────────────── */}
                {tab === 'requests' && (
                    <>
                        <Toolbar
                            query={query}
                            onQuery={setQuery}
                            placeholder="Search by return ID, order, customer name or email…"
                        >
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
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
                                onChange={(e) => setRefundFilter(e.target.value as typeof refundFilter)}
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
                                onChange={(e) => setSort(e.target.value as typeof sort)}
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
                                            <th className="py-2 px-3 font-medium w-40">Return</th>
                                            <th className="py-2 px-3 font-medium">Customer</th>
                                            <th className="py-2 px-3 font-medium">Product</th>
                                            <th className="py-2 px-3 font-medium">Reason</th>
                                            <th className="py-2 px-3 font-medium text-right">Amount</th>
                                            <th className="py-2 px-3 font-medium">Status</th>
                                            <th className="py-2 px-3 font-medium">Refund</th>
                                            <th className="py-2 px-3 font-medium">Requested</th>
                                            <th className="py-2 px-3 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredReturns.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="py-16 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                                                            <RotateCcw className="w-6 h-6" />
                                                        </span>
                                                        <h3 className="text-[15px] font-semibold text-slate-900">
                                                            No return requests
                                                        </h3>
                                                        <p className="text-[13px] text-slate-500 max-w-xs">
                                                            {query || statusFilter !== 'ALL' || refundFilter !== 'ALL'
                                                                ? 'Try changing your filters.'
                                                                : 'Customer returns will appear here.'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReturns.map((r) => {
                                                const days = daysSince(r.requestedAt);
                                                const urgent =
                                                    (r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW') &&
                                                    days >= 2;
                                                const isKebab = openKebab === r.id;

                                                return (
                                                    <tr
                                                        key={r.id}
                                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                        onClick={() => setOpenDetail(r)}
                                                    >
                                                        <td className="py-2 px-3">
                                                            <div className="font-mono font-medium text-slate-900">
                                                                {r.code}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {r.orderId}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="font-medium text-slate-800 truncate max-w-[180px]">
                                                                {r.customer.name}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                                                {r.customer.email}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={r.items[0]?.image}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-slate-800 truncate max-w-[220px]">
                                                                        {r.items[0]?.productName}
                                                                    </div>
                                                                    {r.items.length > 1 && (
                                                                        <div className="text-[11px] text-slate-400">
                                                                            +{r.items.length - 1} more
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-slate-600 max-w-[180px] truncate">
                                                            {r.reason}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums whitespace-nowrap">
                                                            {fmtKES(r.originalAmount)}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span
                                                                className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-sm border whitespace-nowrap ${RETURN_STATUS_STYLES[r.status]
                                                                    }`}
                                                            >
                                                                {RETURN_STATUS_LABEL[r.status]}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span
                                                                className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-sm border whitespace-nowrap ${REFUND_STATUS_STYLES[r.refundStatus]
                                                                    }`}
                                                            >
                                                                {REFUND_STATUS_LABEL[r.refundStatus]}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-1 text-[12px]">
                                                                <span className="text-slate-600">
                                                                    {fmtDate(r.requestedAt)}
                                                                </span>
                                                                {urgent && (
                                                                    <span className="text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded-sm">
                                                                        {days}d
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td
                                                            className="py-2 px-3 relative"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={() => setOpenKebab(isKebab ? null : r.id)}
                                                                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                            {isKebab && (
                                                                <Kebab
                                                                    onView={() => {
                                                                        setOpenKebab(null);
                                                                        setOpenDetail(r);
                                                                    }}
                                                                    onApprove={
                                                                        r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW'
                                                                            ? () => {
                                                                                setOpenKebab(null);
                                                                                setConfirmAction({ kind: 'approve', ret: r });
                                                                            }
                                                                            : undefined
                                                                    }
                                                                    onReject={
                                                                        r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW'
                                                                            ? () => {
                                                                                setOpenKebab(null);
                                                                                setConfirmAction({ kind: 'reject', ret: r });
                                                                            }
                                                                            : undefined
                                                                    }
                                                                    onRefund={
                                                                        r.status === 'APPROVED' ||
                                                                            r.status === 'ITEM_RECEIVED'
                                                                            ? () => {
                                                                                setOpenKebab(null);
                                                                                setConfirmAction({ kind: 'refund', ret: r });
                                                                            }
                                                                            : undefined
                                                                    }
                                                                />
                                                            )}
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

                {/* ── REFUNDS TAB ───────────────────────────────────────────── */}
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
                                            <th className="py-2 px-3 font-medium">Return</th>
                                            <th className="py-2 px-3 font-medium">Customer</th>
                                            <th className="py-2 px-3 font-medium text-right">Amount</th>
                                            <th className="py-2 px-3 font-medium">Method</th>
                                            <th className="py-2 px-3 font-medium">Status</th>
                                            <th className="py-2 px-3 font-medium">Created</th>
                                            <th className="py-2 px-3 font-medium">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRefunds.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-16 text-center text-slate-400">
                                                    No refund records.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRefunds.map((r) => (
                                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-2 px-3">
                                                        <div className="font-mono font-medium text-slate-900">
                                                            {r.returnCode}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">{r.orderId}</div>
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-700">{r.customer}</td>
                                                    <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                                                        {fmtKES(r.amount)}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-600">
                                                        {REFUND_METHOD_LABEL[r.method]}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span
                                                            className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-sm border ${REFUND_STATUS_STYLES[r.status]
                                                                }`}
                                                        >
                                                            {REFUND_STATUS_LABEL[r.status]}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                                        {fmtDateTime(r.createdAt)}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
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

                {/* ── HISTORY TAB ───────────────────────────────────────────── */}
                {tab === 'history' && (
                    <HistoryTab returns={returns} />
                )}

                {/* ── SETTINGS TAB ──────────────────────────────────────────── */}
                {tab === 'settings' && (
                    <SettingsTab reasons={reasons} onUpdate={setReasons} onFlash={flash} />
                )}
            </main>

            {/* RETURN DETAIL DRAWER */}
            {openDetail && (
                <ReturnDrawer
                    ret={openDetail}
                    onClose={() => setOpenDetail(null)}
                    onUpdate={(patch) => updateReturn(openDetail.id, patch)}
                    onApprove={() => setConfirmAction({ kind: 'approve', ret: openDetail })}
                    onReject={() => setConfirmAction({ kind: 'reject', ret: openDetail })}
                    onRefund={() => setConfirmAction({ kind: 'refund', ret: openDetail })}
                    onFlash={flash}
                />
            )}

            {/* CONFIRM ACTION */}
            {confirmAction && (
                <ConfirmAction
                    action={confirmAction}
                    onCancel={() => setConfirmAction(null)}
                    onConfirm={() => {
                        if (confirmAction.kind === 'approve') approveReturn(confirmAction.ret);
                        else if (confirmAction.kind === 'reject') rejectReturn(confirmAction.ret);
                        else startRefund(confirmAction.ret);
                    }}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white text-[13px] px-4 py-2.5 rounded-sm shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
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
                <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">{label}</span>
            </div>
            <div className="text-[15px] font-bold text-slate-900 truncate">{value}</div>
            <div className="text-[11px] text-slate-400 truncate">{sub}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar
// ─────────────────────────────────────────────────────────────────────────────
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
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
            </div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kebab menu
// ─────────────────────────────────────────────────────────────────────────────
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
        <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full mt-1 right-0 w-52 bg-white border border-slate-200 rounded-sm shadow-lg z-50 py-1"
        >
            <MenuItem icon={<Eye className="w-3.5 h-3.5" />} label="View details" onClick={onView} />
            {onApprove && (
                <MenuItem
                    icon={<ThumbsUp className="w-3.5 h-3.5" />}
                    label="Approve return"
                    onClick={onApprove}
                />
            )}
            {onReject && (
                <MenuItem
                    icon={<ThumbsDown className="w-3.5 h-3.5" />}
                    label="Reject return"
                    onClick={onReject}
                    danger
                />
            )}
            {onRefund && (
                <MenuItem
                    icon={<CreditCard className="w-3.5 h-3.5" />}
                    label="Process refund"
                    onClick={onRefund}
                />
            )}
        </div>
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
            className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
        >
            <span className={danger ? 'text-rose-500' : 'text-slate-400'}>{icon}</span>
            {label}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Return detail drawer
// ─────────────────────────────────────────────────────────────────────────────
function ReturnDrawer({
    ret,
    onClose,
    onUpdate,
    onApprove,
    onReject,
    onRefund,
    onFlash,
}: {
    ret: ReturnRequest;
    onClose: () => void;
    onUpdate: (patch: Partial<ReturnRequest>) => void;
    onApprove: () => void;
    onReject: () => void;
    onRefund: () => void;
    onFlash: (msg: string) => void;
}) {
    const [internal, setInternal] = useState(ret.internalNotes ?? '');

    const canDecide = ret.status === 'REQUESTED' || ret.status === 'UNDER_REVIEW';
    const canRefund = ret.status === 'APPROVED' || ret.status === 'ITEM_RECEIVED';

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white border-l border-slate-200 w-full max-w-2xl h-full overflow-y-auto shadow-xl flex flex-col"
            >
                {/* Header */}
                <div className="px-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between gap-2 shrink-0">
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

                <div className="p-3 space-y-3">
                    {/* Status row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-sm border ${RETURN_STATUS_STYLES[ret.status]
                                }`}
                        >
                            {RETURN_STATUS_LABEL[ret.status]}
                        </span>
                        <span
                            className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-sm border ${REFUND_STATUS_STYLES[ret.refundStatus]
                                }`}
                        >
                            Refund: {REFUND_STATUS_LABEL[ret.refundStatus]}
                        </span>
                        <span className="text-[11px] text-slate-400">
                            {daysSince(ret.requestedAt)} days ago
                        </span>
                    </div>

                    {/* Customer */}
                    <Section title="Customer" icon={User}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                            <Field label="Name" value={ret.customer.name} />
                            <Field label="Email" value={ret.customer.email} mono />
                            <Field label="Phone" value={ret.customer.phone} mono />
                            {ret.address && <Field label="Address" value={ret.address} />}
                        </div>
                    </Section>

                    {/* Items */}
                    <Section title="Returned items" icon={Package}>
                        <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200 overflow-hidden">
                            {ret.items.map((it) => (
                                <li key={it.id} className="flex items-center gap-3 p-2">
                                    <div className="w-12 h-12 rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={it.image} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium text-slate-900 truncate">
                                            {it.productName}
                                        </div>
                                        <div className="text-[11px] text-slate-400 font-mono">
                                            {it.sku}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Qty {it.qty} · Condition:{' '}
                                            <span className="font-medium">
                                                {CONDITION_LABEL[it.condition] ?? it.condition}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[13px] font-semibold text-slate-900 tabular-nums">
                                            {fmtKES(it.price * it.qty)}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-between pt-2 mt-2 border-t border-slate-100 text-[13px]">
                            <span className="text-slate-500">Order total</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                                {fmtKES(ret.originalAmount)}
                            </span>
                        </div>
                        {ret.refundAmount > 0 && (
                            <div className="flex justify-between text-[13px]">
                                <span className="text-slate-500">Refund amount</span>
                                <span className="font-semibold text-emerald-700 tabular-nums">
                                    {fmtKES(ret.refundAmount)}
                                </span>
                            </div>
                        )}
                    </Section>

                    {/* Reason */}
                    <Section title="Return reason" icon={Info}>
                        <div className="rounded-sm border border-slate-200 p-2 space-y-1">
                            <div className="text-[13px] font-medium text-slate-900">{ret.reason}</div>
                            {ret.notes && (
                                <p className="text-[13px] text-slate-600 whitespace-pre-line">
                                    {ret.notes}
                                </p>
                            )}
                        </div>
                    </Section>

                    {/* Tracking */}
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

                    {/* Refund method */}
                    <Section title="Refund method" icon={CreditCard}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {(['original', 'store_credit', 'bank_transfer', 'manual'] as RefundMethod[]).map(
                                (m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => onUpdate({ refundMethod: m })}
                                        className={`text-[12px] font-medium py-2 px-2 rounded-sm border transition ${ret.refundMethod === m
                                                ? 'bg-blue-50 border-blue-950 text-blue-950'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {REFUND_METHOD_LABEL[m]}
                                    </button>
                                ),
                            )}
                        </div>
                    </Section>

                    {/* Internal notes */}
                    <Section title="Internal notes" icon={FileText}>
                        <textarea
                            value={internal}
                            onChange={(e) => setInternal(e.target.value)}
                            onBlur={() => onUpdate({ internalNotes: internal })}
                            rows={3}
                            placeholder="Notes visible only to your team…"
                            className={inputCls + ' resize-none'}
                        />
                    </Section>

                    {/* Status setter (manual override) */}
                    <Section title="Set status" icon={SettingsIcon}>
                        <select
                            value={ret.status}
                            onChange={(e) => onUpdate({ status: e.target.value as ReturnStatus })}
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

                {/* Footer actions */}
                <div className="border-t border-slate-200 px-3 py-2 flex items-center justify-between gap-2 sticky bottom-0 bg-white shrink-0">
                    <button
                        onClick={() => onFlash(`Notification sent to ${ret.customer.email}`)}
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

// ─────────────────────────────────────────────────────────────────────────────
// Confirm action
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmAction({
    action,
    onCancel,
    onConfirm,
}: {
    action: { kind: 'approve' | 'reject' | 'refund'; ret: ReturnRequest };
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
                    <span className={`w-9 h-9 rounded-sm flex items-center justify-center ${config.accent}`}>
                        <Icon className="w-4 h-4" />
                    </span>
                    <h3 className="text-[15px] font-semibold text-slate-900">{config.title}</h3>
                </div>
                <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">{config.body}</p>
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

// ─────────────────────────────────────────────────────────────────────────────
// History tab
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab({ returns }: { returns: ReturnRequest[] }) {
    const closed = returns
        .filter((r) => r.status === 'CLOSED' || r.status === 'REJECTED')
        .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));

    const monthlyTotals = [
        { month: 'Sep 2026', refunded: 241799, returns: 18, rate: '2.1%' },
        { month: 'Aug 2026', refunded: 189420, returns: 14, rate: '1.8%' },
        { month: 'Jul 2026', refunded: 302115, returns: 22, rate: '2.6%' },
        { month: 'Jun 2026', refunded: 148900, returns: 12, rate: '1.5%' },
    ];

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
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-1.5 px-2 font-medium">Month</th>
                                <th className="py-1.5 px-2 font-medium text-right">Returns</th>
                                <th className="py-1.5 px-2 font-medium text-right">Refunded</th>
                                <th className="py-1.5 px-2 font-medium text-right">Return rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {monthlyTotals.map((m) => (
                                <tr key={m.month} className="hover:bg-slate-50">
                                    <td className="py-1.5 px-2 text-slate-800">{m.month}</td>
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
            </section>

            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <header>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        Recently closed &amp; rejected
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        Completed return cases.
                    </p>
                </header>
                {closed.length === 0 ? (
                    <p className="text-[13px] text-slate-400 py-4 text-center">
                        No closed returns yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {closed.map((r) => (
                            <li key={r.id} className="py-2 flex items-center gap-3">
                                <span
                                    className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${r.status === 'REJECTED'
                                            ? 'bg-rose-50 text-rose-600'
                                            : 'bg-emerald-50 text-emerald-700'
                                        }`}
                                >
                                    {r.status === 'REJECTED' ? (
                                        <XCircle className="w-4 h-4" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-slate-900 truncate">
                                        {r.code} · {r.customer.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                        {r.reason} · resolved {fmtDate(r.resolvedAt ?? r.requestedAt)}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[13px] font-semibold text-slate-900 tabular-nums">
                                        {r.status === 'REJECTED' ? '—' : fmtKES(r.refundAmount || r.originalAmount)}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings tab
// ─────────────────────────────────────────────────────────────────────────────
function SettingsTab({
    reasons,
    onUpdate,
    onFlash,
}: {
    reasons: ReturnReason[];
    onUpdate: (r: ReturnReason[]) => void;
    onFlash: (msg: string) => void;
}) {
    const [draft, setDraft] = useState(reasons);
    const [newReason, setNewReason] = useState('');
    const [newDescription, setNewDescription] = useState('');

    function toggle(id: string) {
        setDraft((prev) =>
            prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
        );
    }

    function togglePhoto(id: string) {
        setDraft((prev) =>
            prev.map((r) => (r.id === id ? { ...r, requiresPhoto: !r.requiresPhoto } : r)),
        );
    }

    function remove(id: string) {
        setDraft((prev) => prev.filter((r) => r.id !== id));
    }

    function add() {
        if (!newReason.trim()) return;
        const reason: ReturnReason = {
            id: `r${Date.now()}`,
            label: newReason.trim(),
            description: newDescription.trim() || '—',
            requiresPhoto: false,
            active: true,
        };
        setDraft((prev) => [...prev, reason]);
        setNewReason('');
        setNewDescription('');
    }

    function save() {
        onUpdate(draft);
        onFlash('Return settings saved');
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Reasons list */}
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
                    {draft.map((r) => (
                        <li key={r.id} className="p-3 flex items-start gap-3">
                            <span
                                className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${r.active ? 'bg-blue-50 text-blue-950' : 'bg-slate-100 text-slate-400'
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
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm border ${r.active
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}
                                    >
                                        {r.active ? 'Active' : 'Hidden'}
                                    </span>
                                    {r.requiresPhoto && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm border bg-amber-50 text-amber-700 border-amber-100">
                                            Requires photo
                                        </span>
                                    )}
                                </div>
                                <p className="text-[13px] text-slate-500 mt-0.5">{r.description}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => togglePhoto(r.id)}
                                    title="Toggle photo requirement"
                                    className="p-1.5 rounded-sm text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => toggle(r.id)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${r.active ? 'bg-blue-950' : 'bg-slate-300'
                                        }`}
                                    aria-label={r.active ? 'Deactivate' : 'Activate'}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${r.active ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                                <button
                                    onClick={() => remove(r.id)}
                                    className="p-1.5 rounded-sm text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                    aria-label="Remove"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="p-3 border-t border-slate-100 space-y-2">
                    <div className="text-[13px] font-medium text-slate-700">Add a reason</div>
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
                        onClick={add}
                        disabled={!newReason.trim()}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add reason
                    </button>
                </div>
            </section>

            {/* Policy + notification settings */}
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
                        <input type="number" defaultValue={14} className={inputCls} />
                    </Field>
                    <Field label="Auto-approve under amount (KES)">
                        <input type="number" defaultValue={5000} className={inputCls} />
                    </Field>
                    <Field label="Restocking fee (%)">
                        <input type="number" defaultValue={0} className={inputCls} />
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
                        {[
                            { label: 'Return received', channels: ['email'] },
                            { label: 'Return approved', channels: ['email', 'sms'] },
                            { label: 'Return rejected', channels: ['email'] },
                            { label: 'Refund processed', channels: ['email', 'sms'] },
                            { label: 'Refund failed', channels: ['email'] },
                        ].map((row) => (
                            <li key={row.label} className="py-2 flex items-center justify-between gap-2">
                                <span className="text-slate-700">{row.label}</span>
                                <div className="flex items-center gap-1">
                                    {(['email', 'sms', 'push'] as const).map((c) => {
                                        const Icon = c === 'email' ? Mail : c === 'sms' ? Smartphone : MessageSquare;
                                        const on = row.channels.includes(c);
                                        return (
                                            <span
                                                key={c}
                                                title={c}
                                                className={`w-6 h-6 rounded-sm flex items-center justify-center border transition ${on
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
                    onClick={save}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                    <Save className="w-3.5 h-3.5" />
                    Save settings
                </button>
            </section>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
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
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                {title}
            </div>
            {children}
        </section>
    );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                {label}
            </div>
            <div className={`text-[13px] text-slate-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>
                {value}
            </div>
        </div>
    );
}