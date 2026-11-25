'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    Banknote,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Clock,
    Download,
    Eye,
    Inbox as InboxIcon,
    Loader2,
    MessageCircle,
    Phone,
    Plus,
    RefreshCw,
    Search,
    Send,
    ShoppingBag,
    Sparkles,
    Star,
    Tag,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import type {
    AdminCustomerFull,
    AdminCustomerStatsFull,
    AdminInboxConversation,
    AdminDirectOrder,
    AdminLead,
    AdminLeadWrite,
    AdminFollowUp,
    AdminFollowUpWrite,
    AdminSupportTicket,
    AdminSupportTicketWrite,
    AdminCustomerSegment,
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

const pct = (n: number | string | null | undefined): string => {
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return '—';
    return `${num.toFixed(1)}%`;
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

const formatAgo = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return '—';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
};

const channelLabel = (c: string | null | undefined): string => {
    if (c === 'whatsapp') return 'WhatsApp';
    if (c === 'tiktok_dm') return 'TikTok DM';
    if (c === 'tiktok_comment') return 'TikTok Comment';
    if (c === 'instagram_dm') return 'Instagram DM';
    if (c === 'phone') return 'Phone';
    if (c === 'email') return 'Email';
    return String(c || '').charAt(0).toUpperCase() + String(c || '').slice(1);
};

const initials = (name: string | null | undefined): string =>
    String(name || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';

const LEAD_STATUSES = ['New', 'Contacted', 'Interested', 'Negotiating', 'Awaiting Decision', 'Converted', 'Lost'] as const;
const TICKET_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;

const SECTIONS = [
    { id: 'customers', label: 'Customers' },
    { id: 'leads', label: 'Leads' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'followups', label: 'Follow-ups' },
    { id: 'segments', label: 'Segments' },
    { id: 'tickets', label: 'Support' },
    { id: 'activity', label: 'Activity' },
];

interface ActivityItem {
    id: string;
    icon: React.ReactNode;
    title: string;
    detail: string;
    time: string;
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

function StatusBadge({ label, variant }: { label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' }) {
    const styles =
        variant === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : variant === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : variant === 'danger'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : variant === 'info'
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : variant === 'brand'
                            ? 'bg-white text-slate-900 border-slate-300 font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200';
    return (
        <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[13px] font-medium whitespace-nowrap', styles)}>
            {label}
        </span>
    );
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

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2 hover:border-slate-300 transition-colors">
            <span className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-slate-100 text-slate-700">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
                <p className="text-[15px] font-bold text-slate-900 truncate tabular-nums">{value}</p>
            </div>
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

export default function CustomersLeadsInbox() {
    const [section, setSection] = useState('customers');
    const [toast, setToast] = useState<{ id: number; msg: string; variant: 'success' | 'error' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [customers, setCustomers] = useState<AdminCustomerFull[]>([]);
    const [customerStats, setCustomerStats] = useState<AdminCustomerStatsFull | null>(null);
    const [inbox, setInbox] = useState<AdminInboxConversation[]>([]);
    const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
    const [leads, setLeads] = useState<AdminLead[]>([]);
    const [followups, setFollowups] = useState<AdminFollowUp[]>([]);
    const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
    const [segments, setSegments] = useState<AdminCustomerSegment[]>([]);

    const [search, setSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerFull | null>(null);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [leadModalOpen, setLeadModalOpen] = useState(false);
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [followupModalOpen, setFollowupModalOpen] = useState(false);

    const showToast = useCallback((msg: string, variant: 'success' | 'error' = 'success') => {
        setToast({ id: Date.now(), msg, variant });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        const results = await Promise.allSettled([
            adminApi.directOrders.customers.list({ limit: 500 }),
            adminApi.directOrders.customers.stats(),
            adminApi.directOrders.inbox.list(),
            adminApi.directOrders.orders.list(),
            adminApi.directOrders.leads.list(),
            adminApi.directOrders.followups.list(),
            adminApi.directOrders.tickets.list(),
            adminApi.directOrders.segments.list(),
        ]);

        if (results[0].status === 'fulfilled') {
            const v = results[0].value;
            setCustomers(Array.isArray(v) ? v : v?.results ?? []);
        }
        if (results[1].status === 'fulfilled') setCustomerStats(results[1].value);
        if (results[2].status === 'fulfilled') setInbox(results[2].value || []);
        if (results[3].status === 'fulfilled') setOrders(results[3].value || []);
        if (results[4].status === 'fulfilled') {
            const v = results[4].value;
            setLeads(Array.isArray(v) ? v : v?.results ?? []);
        }
        if (results[5].status === 'fulfilled') setFollowups(results[5].value || []);
        if (results[6].status === 'fulfilled') setTickets(results[6].value || []);
        if (results[7].status === 'fulfilled') setSegments(results[7].value || []);

        if (results.every((r) => r.status === 'rejected')) {
            const first = results[0] as PromiseRejectedResult;
            setError(first.reason instanceof Error ? first.reason.message : 'Failed to load data');
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredCustomers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter(
            (c) =>
                String(c.name || '').toLowerCase().includes(q) ||
                String(c.phone || '').toLowerCase().includes(q) ||
                String(c.email || '').toLowerCase().includes(q) ||
                String(c.username || '').toLowerCase().includes(q),
        );
    }, [customers, search]);

    const activeConversation = inbox.find((c) => c.id === activeConversationId) || null;

    const selectedCustomerOrders = useMemo(() => {
        if (!selectedCustomer) return [];
        const key = selectedCustomer.phone || selectedCustomer.name;
        return orders.filter((o) => (o.customerPhone || o.customerName) === key);
    }, [orders, selectedCustomer]);

    const selectedCustomerConversations = useMemo(() => {
        if (!selectedCustomer) return [];
        return inbox.filter(
            (c) => c.contactName === selectedCustomer.name || c.contactHandle === selectedCustomer.phone,
        );
    }, [inbox, selectedCustomer]);

    const activityTimeline = useMemo<ActivityItem[]>(() => {
        const items: ActivityItem[] = [];
        if (selectedCustomer) {
            items.push({
                id: 'reg',
                icon: <UserRound className="w-3.5 h-3.5" />,
                title: 'Customer registered',
                detail: selectedCustomer.email || selectedCustomer.phone || '—',
                time: selectedCustomer.createdAt,
            });
            selectedCustomerOrders.forEach((o) => {
                items.push({
                    id: `order-${o.reference}`,
                    icon: <ShoppingBag className="w-3.5 h-3.5" />,
                    title: `Order ${o.reference}`,
                    detail: `${o.status} · ${KES(o.total)}`,
                    time: o.createdAt,
                });
            });
            selectedCustomerConversations.forEach((c) => {
                items.push({
                    id: `conv-${c.id}`,
                    icon: <InboxIcon className="w-3.5 h-3.5" />,
                    title: `Conversation via ${channelLabel(c.channel)}`,
                    detail: c.subject || c.messages?.[0]?.body || '—',
                    time: c.lastMessageAt || c.createdAt,
                });
            });
        }
        return items.filter((i) => i.time).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    }, [selectedCustomer, selectedCustomerOrders, selectedCustomerConversations]);

    const globalActivity = useMemo<ActivityItem[]>(() => {
        const items: ActivityItem[] = [];
        customers.slice(0, 12).forEach((c) => {
            items.push({
                id: `cust-${c.id}`,
                icon: <UserRound className="w-3.5 h-3.5" />,
                title: `${c.name} registered`,
                detail: c.phone || c.email || '',
                time: c.createdAt,
            });
        });
        orders.slice(0, 12).forEach((o) => {
            items.push({
                id: `ord-${o.reference}`,
                icon: <ShoppingBag className="w-3.5 h-3.5" />,
                title: `Order ${o.reference} created`,
                detail: `${o.customerName} · ${KES(o.total)}`,
                time: o.createdAt,
            });
        });
        inbox.slice(0, 12).forEach((c) => {
            items.push({
                id: `inb-${c.id}`,
                icon: <InboxIcon className="w-3.5 h-3.5" />,
                title: `New message from ${c.contactName || c.contactHandle || 'Unknown'}`,
                detail: channelLabel(c.channel),
                time: c.lastMessageAt || c.createdAt,
            });
        });
        return items.filter((i) => i.time).sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 25);
    }, [customers, orders, inbox]);

    const handleSendReply = async () => {
        if (!activeConversation || !replyText.trim()) return;
        const body = replyText.trim();
        setReplyText('');
        try {
            const msg = await adminApi.directOrders.inbox.messages.create({
                conversation: activeConversation.id,
                direction: 'out',
                body,
            });
            setInbox((prev) =>
                prev.map((c) =>
                    c.id === activeConversation.id
                        ? { ...c, messages: [...(c.messages || []), msg] }
                        : c,
                ),
            );
            showToast('Reply sent');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to send reply', 'error');
        }
    };

    const handleAdvanceLead = async (lead: AdminLead, next: string) => {
        try {
            const updated = await adminApi.directOrders.leads.update(lead.id, { status: next });
            setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to update lead', 'error');
        }
    };

    const handleConvertLead = async (lead: AdminLead) => {
        try {
            const res = await adminApi.directOrders.leads.convert(lead.id, {
                customerName: lead.name,
                customerPhone: lead.phone,
                source: lead.source,
                items: [],
            });
            setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.lead : l)));
            setOrders((prev) => [res.order, ...prev]);
            showToast(`${lead.name} converted`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to convert lead', 'error');
        }
    };

    const handleCreateLead = async (payload: AdminLeadWrite) => {
        try {
            const created = await adminApi.directOrders.leads.create(payload);
            setLeads((prev) => [created, ...prev]);
            setLeadModalOpen(false);
            showToast(`Lead ${created.name} created`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create lead', 'error');
        }
    };

    const handleCreateTicket = async (payload: AdminSupportTicketWrite) => {
        try {
            const created = await adminApi.directOrders.tickets.create(payload);
            setTickets((prev) => [created, ...prev]);
            setTicketModalOpen(false);
            showToast('Support ticket created');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create ticket', 'error');
        }
    };

    const handleCreateFollowup = async (payload: AdminFollowUpWrite) => {
        try {
            const created = await adminApi.directOrders.followups.create(payload);
            setFollowups((prev) => [created, ...prev]);
            setFollowupModalOpen(false);
            showToast('Follow-up scheduled');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to schedule follow-up', 'error');
        }
    };

    const exportCustomers = () => {
        const rows: Array<Array<string | number>> = [
            ['Name', 'Phone', 'Email', 'Orders', 'Spend', 'Segment', 'Joined'],
            ...filteredCustomers.map((c) => [
                c.name,
                c.phone || '',
                c.email || '',
                c.totalOrders || 0,
                c.lifetimeSpend || 0,
                c.segment || '',
                c.createdAt || '',
            ]),
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Customers exported');
    };

    const totalCustomers = customerStats?.total ?? customers.length;
    const repeatRate =
        customerStats?.repeatRate ??
        (customers.length === 0
            ? 0
            : Math.round((customers.filter((c) => (c.totalOrders || 0) >= 2).length / customers.length) * 100));
    const totalSpend = customers.reduce((a, c) => a + Number(c.lifetimeSpend || 0), 0);
    const avgSpend = customers.length ? totalSpend / customers.length : 0;

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
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Customers, Leads &amp; Inbox
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Manage the full TikTok customer journey — leads, buyers, and conversations.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button onClick={() => void load()} disabled={loading} className={btnSecondary}>
                            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button onClick={exportCustomers} className={btnSecondary}>
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => setLeadModalOpen(true)} className={btnPrimary}>
                            <Plus className="w-3 h-3" /> New lead
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
                            <p className="text-[13px] font-semibold text-slate-900">Couldn&apos;t load data</p>
                            <p className="text-[13px] text-slate-600 mt-0.5">{error}</p>
                        </div>
                        <button onClick={() => void load()} className="text-[13px] font-medium text-slate-900 hover:underline shrink-0">
                            Retry
                        </button>
                    </div>
                </Card>
            )}

            {loading ? (
                <Card>
                    <div className="p-4 flex items-center gap-2 text-[13px] text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading customers…
                    </div>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        <Kpi icon={<Users className="w-3.5 h-3.5" />} label="Total customers" value={NUM(totalCustomers)} />
                        <Kpi icon={<Sparkles className="w-3.5 h-3.5" />} label="Repeat rate" value={pct(repeatRate)} />
                        <Kpi icon={<Star className="w-3.5 h-3.5" />} label="VIP customers" value={NUM(customerStats?.vip ?? customers.filter((c) => c.segment === 'VIP').length)} />
                        <Kpi icon={<Banknote className="w-3.5 h-3.5" />} label="Avg. spend" value={KES(avgSpend)} />
                    </div>

                    {section === 'customers' && (
                        <Card>
                            <CardHeader
                                title="Customer directory"
                                subtitle={`${filteredCustomers.length} customer${filteredCustomers.length === 1 ? '' : 's'}`}
                                action={
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search…"
                                            className={cn(inputCls, 'w-56 pl-7')}
                                        />
                                    </div>
                                }
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[780px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium">Contact</th>
                                            <th className="py-2 px-2 font-medium">Segment</th>
                                            <th className="py-2 px-2 font-medium text-center">Orders</th>
                                            <th className="py-2 px-2 font-medium text-right">Spend</th>
                                            <th className="py-2 px-2 font-medium">Joined</th>
                                            <th className="py-2 px-2 w-16" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredCustomers.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No customers yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCustomers.map((c) => (
                                                <tr key={c.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar name={c.name} className="w-7 h-7" />
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 truncate max-w-[180px]">{c.name}</p>
                                                                {c.username && <p className="text-[13px] text-slate-400 truncate">@{c.username}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <p className="text-slate-700">{c.phone || '—'}</p>
                                                        {c.email && <p className="text-[13px] text-slate-400 truncate max-w-[180px]">{c.email}</p>}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={c.segment || 'Regular'}
                                                            variant={
                                                                c.segment === 'VIP'
                                                                    ? 'brand'
                                                                    : c.segment === 'Repeat'
                                                                        ? 'info'
                                                                        : c.segment === 'Inactive'
                                                                            ? 'danger'
                                                                            : 'neutral'
                                                            }
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-center tabular-nums text-slate-700">{c.totalOrders || 0}</td>
                                                    <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-900">{KES(c.lifetimeSpend)}</td>
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                                                    <td className="py-2 px-2 text-right">
                                                        <button className={iconBtn} onClick={() => setSelectedCustomer(c)} aria-label="View profile">
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

                    {section === 'leads' && (
                        <Card>
                            <CardHeader
                                title="Lead pipeline"
                                subtitle="Move leads between statuses using the buttons"
                                action={
                                    <button onClick={() => setLeadModalOpen(true)} className={btnPrimary}>
                                        <Plus className="w-3 h-3" /> New lead
                                    </button>
                                }
                            />
                            <div className="p-2 overflow-x-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 min-w-[900px]">
                                    {LEAD_STATUSES.map((status) => {
                                        const list = leads.filter((l) => l.status === status);
                                        return (
                                            <div key={status} className="bg-slate-50 border border-slate-200 rounded flex flex-col">
                                                <div className="px-2 py-1.5 border-b border-slate-200 flex items-center justify-between">
                                                    <span className="text-[13px] font-medium text-slate-700 truncate">{status}</span>
                                                    <span className="text-[13px] text-slate-500 tabular-nums">{list.length}</span>
                                                </div>
                                                <div className="p-1.5 space-y-1.5 flex-1 min-h-[120px]">
                                                    {list.length === 0 ? (
                                                        <p className="text-[13px] text-slate-400 text-center py-3">Empty</p>
                                                    ) : (
                                                        list.map((l) => (
                                                            <div key={l.id} className="bg-white border border-slate-200 rounded p-1.5 space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Avatar name={l.name} className="w-5 h-5" />
                                                                    <p className="text-[13px] font-medium text-slate-900 truncate">{l.name}</p>
                                                                </div>
                                                                <p className="text-[13px] text-slate-500 truncate">{l.interest || '—'}</p>
                                                                <p className="text-[13px] text-slate-400 truncate">{channelLabel(l.source)}</p>
                                                                <div className="flex items-center justify-between gap-1">
                                                                    {status !== 'Converted' && status !== 'Lost' && (
                                                                        <button
                                                                            onClick={() =>
                                                                                void handleAdvanceLead(
                                                                                    l,
                                                                                    LEAD_STATUSES[Math.min(LEAD_STATUSES.indexOf(status) + 1, LEAD_STATUSES.length - 1)],
                                                                                )
                                                                            }
                                                                            className="text-[13px] font-medium text-blue-950 hover:underline"
                                                                        >
                                                                            Advance
                                                                        </button>
                                                                    )}
                                                                    {status !== 'Converted' && (
                                                                        <button
                                                                            onClick={() => void handleConvertLead(l)}
                                                                            className="text-[13px] font-medium text-emerald-600 hover:underline"
                                                                        >
                                                                            Convert
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'inbox' && (
                        <Card>
                            <CardHeader title="Inbox" subtitle="Conversations from WhatsApp, TikTok DMs, and more" />
                            {inbox.length === 0 ? (
                                <EmptyCard icon={<InboxIcon className="w-5 h-5" />} title="No conversations yet" description="Conversations from customers will appear here." />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
                                    <div className="lg:col-span-4 border-r border-slate-200 overflow-y-auto max-h-[500px]">
                                        {inbox.map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => setActiveConversationId(c.id)}
                                                className={cn(
                                                    'w-full text-left px-2 py-2 border-b border-slate-100 flex items-start gap-2',
                                                    activeConversationId === c.id ? 'bg-slate-50' : 'hover:bg-slate-50',
                                                )}
                                            >
                                                <Avatar name={c.contactName || c.contactHandle || '?'} className="w-8 h-8 mt-0.5" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[13px] font-medium text-slate-900 truncate">
                                                            {c.contactName || c.contactHandle || 'Unknown'}
                                                        </p>
                                                        <span className="text-[13px] text-slate-400 shrink-0">{formatAgo(c.lastMessageAt)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <StatusBadge
                                                            label={channelLabel(c.channel)}
                                                            variant={c.channel === 'whatsapp' ? 'success' : 'info'}
                                                        />
                                                        {c.unreadCount > 0 && (
                                                            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-blue-950 text-white text-[13px] font-semibold">
                                                                {c.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[13px] text-slate-500 truncate mt-1">
                                                        {c.messages?.[c.messages.length - 1]?.body || c.subject || 'No messages yet'}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="lg:col-span-8 flex flex-col">
                                        {activeConversation ? (
                                            <>
                                                <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Avatar name={activeConversation.contactName || '?'} className="w-8 h-8" />
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-semibold text-slate-900 truncate">
                                                                {activeConversation.contactName}
                                                            </p>
                                                            <p className="text-[13px] text-slate-500 truncate">
                                                                {activeConversation.contactHandle}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button className={btnSecondary}>
                                                        <Phone className="w-3 h-3" /> Call
                                                    </button>
                                                </div>
                                                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[360px]">
                                                    {(activeConversation.messages || []).length === 0 ? (
                                                        <p className="text-[13px] text-slate-400 text-center py-6">No messages yet.</p>
                                                    ) : (
                                                        (activeConversation.messages || []).map((msg) => (
                                                            <div
                                                                key={msg.id}
                                                                className={cn(
                                                                    'max-w-[75%] text-[13px] px-2 py-1.5 rounded',
                                                                    msg.direction === 'out'
                                                                        ? 'ml-auto bg-blue-950 text-white rounded-tr-none'
                                                                        : 'bg-slate-100 text-slate-800 rounded-tl-none',
                                                                )}
                                                            >
                                                                {msg.body}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                <div className="border-t border-slate-200 p-2 flex items-center gap-2">
                                                    <input
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                void handleSendReply();
                                                            }
                                                        }}
                                                        placeholder="Type a reply…"
                                                        className={cn(inputCls, 'flex-1')}
                                                    />
                                                    <button onClick={() => void handleSendReply()} disabled={!replyText.trim()} className={btnPrimary}>
                                                        <Send className="w-3 h-3" /> Send
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center">
                                                <p className="text-[13px] text-slate-400">Select a conversation</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {section === 'followups' && (
                        <Card>
                            <CardHeader
                                title="Follow-ups"
                                subtitle={`${followups.length} scheduled`}
                                action={<button onClick={() => setFollowupModalOpen(true)} className={btnPrimary}><Plus className="w-3 h-3" /> Schedule</button>}
                            />
                            <div className="p-2 space-y-1">
                                {followups.length === 0 ? (
                                    <EmptyCard icon={<Calendar className="w-5 h-5" />} title="No follow-ups" description="Schedule reminders to keep leads warm." />
                                ) : (
                                    followups.map((f) => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded">
                                            <span
                                                className={cn(
                                                    'w-7 h-7 rounded flex items-center justify-center shrink-0',
                                                    f.status === 'Overdue'
                                                        ? 'bg-red-50 text-red-600'
                                                        : f.status === 'Today'
                                                            ? 'bg-amber-50 text-amber-600'
                                                            : 'bg-slate-100 text-slate-700',
                                                )}
                                            >
                                                <Clock className="w-3.5 h-3.5" />
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{f.name}</p>
                                                <p className="text-[13px] text-slate-500 truncate">
                                                    {f.type} · {formatDate(f.date)} · {f.assignedTo ?? 'Unassigned'}
                                                </p>
                                            </div>
                                            <StatusBadge
                                                label={f.status}
                                                variant={f.status === 'Overdue' ? 'danger' : f.status === 'Today' ? 'warning' : 'neutral'}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'segments' && (
                        <Card>
                            <CardHeader title="Customer segments" subtitle="Computed from live customer data" />
                            <div className="p-2 space-y-2">
                                {segments.length === 0 ? (
                                    <EmptyCard icon={<Tag className="w-5 h-5" />} title="No segments yet" description="Segments will appear once you have customers." />
                                ) : (
                                    segments.map((s) => {
                                        const all = customers.length || 1;
                                        const share = Math.round((s.memberCount / all) * 100);
                                        return (
                                            <div key={s.id} className="space-y-1">
                                                <div className="flex items-center justify-between gap-2 text-[13px]">
                                                    <span className="font-medium text-slate-800 truncate">{s.name}</span>
                                                    <span className="font-mono text-slate-600 shrink-0">
                                                        {s.memberCount} ({share}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                                                    <div className="h-full rounded" style={{ width: `${share}%`, backgroundColor: s.color }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'tickets' && (
                        <Card>
                            <CardHeader
                                title="Support tickets"
                                subtitle={`${tickets.length} tickets`}
                                action={<button onClick={() => setTicketModalOpen(true)} className={btnPrimary}><Plus className="w-3 h-3" /> New ticket</button>}
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Ticket</th>
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium">Priority</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tickets.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No tickets yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            tickets.map((t) => (
                                                <tr key={t.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <p className="font-medium text-slate-900">{t.subject}</p>
                                                        <p className="text-[13px] text-slate-400 font-mono">{t.reference}</p>
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-700 truncate max-w-[180px]">{t.customerName || '—'}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={t.priority}
                                                            variant={t.priority === 'Urgent' ? 'danger' : t.priority === 'High' ? 'warning' : 'neutral'}
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={t.status}
                                                            variant={
                                                                t.status === 'Resolved' || t.status === 'Closed'
                                                                    ? 'success'
                                                                    : t.status === 'Waiting for Customer'
                                                                        ? 'warning'
                                                                        : 'info'
                                                            }
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'activity' && (
                        <Card>
                            <CardHeader title="Activity" subtitle="Recent activity across customers, orders and inbox" />
                            <div className="p-2 space-y-1">
                                {globalActivity.length === 0 ? (
                                    <EmptyCard icon={<Clock className="w-5 h-5" />} title="No activity yet" description="Activity from across the business will appear here." />
                                ) : (
                                    globalActivity.map((a) => (
                                        <div key={a.id} className="flex items-start gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                            <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">{a.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{a.title}</p>
                                                <p className="text-[13px] text-slate-500 truncate">{a.detail}</p>
                                            </div>
                                            <span className="text-[13px] text-slate-400 shrink-0 whitespace-nowrap">{formatAgo(a.time)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}
                </>
            )}

            {selectedCustomer && (
                <Modal
                    onClose={() => setSelectedCustomer(null)}
                    title={selectedCustomer.name}
                    subtitle={selectedCustomer.phone || selectedCustomer.email || ''}
                    widthClass="max-w-2xl"
                >
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <MiniStat label="Orders" value={NUM(selectedCustomer.totalOrders || 0)} />
                            <MiniStat label="Lifetime spend" value={KES(selectedCustomer.lifetimeSpend)} />
                            <MiniStat label="Segment" value={selectedCustomer.segment || 'Regular'} />
                            <MiniStat label="Joined" value={formatDate(selectedCustomer.createdAt)} />
                        </div>

                        <Card>
                            <CardHeader title="Activity timeline" />
                            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                                {activityTimeline.length === 0 ? (
                                    <p className="text-[13px] text-slate-400 text-center py-4">No activity yet.</p>
                                ) : (
                                    activityTimeline.map((a) => (
                                        <div key={a.id} className="flex items-start gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                            <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">{a.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{a.title}</p>
                                                <p className="text-[13px] text-slate-500 truncate">{a.detail}</p>
                                            </div>
                                            <span className="text-[13px] text-slate-400 shrink-0 whitespace-nowrap">{formatAgo(a.time)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Orders"
                                action={
                                    <Link
                                        href="/tiktok/TikTokBusiness/OrdersProductsFulfillment"
                                        className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5"
                                    >
                                        Open orders <ChevronRight className="w-3 h-3" />
                                    </Link>
                                }
                            />
                            <div className="p-2 space-y-1">
                                {selectedCustomerOrders.length === 0 ? (
                                    <p className="text-[13px] text-slate-400 text-center py-3">No orders yet.</p>
                                ) : (
                                    selectedCustomerOrders.map((o) => (
                                        <div key={o.reference} className="flex items-center justify-between gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-mono font-medium text-slate-900 truncate">{o.reference}</p>
                                                <p className="text-[13px] text-slate-400 truncate">{formatDate(o.createdAt)}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[13px] font-medium text-slate-900 tabular-nums">{KES(o.total)}</p>
                                                <p className="text-[13px] text-slate-400">{o.status}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedCustomer(null)} className={btnSecondary}>
                                Close
                            </button>
                            <Link href="/tiktok/TikTokBusiness/CustomersLeadsInbox" className={btnPrimary}>
                                <MessageCircle className="w-3 h-3" /> Message
                            </Link>
                        </div>
                    </div>
                </Modal>
            )}

            {leadModalOpen && <LeadForm onClose={() => setLeadModalOpen(false)} onSubmit={handleCreateLead} />}
            {ticketModalOpen && <TicketForm onClose={() => setTicketModalOpen(false)} onSubmit={handleCreateTicket} />}
            {followupModalOpen && <FollowupForm onClose={() => setFollowupModalOpen(false)} onSubmit={handleCreateFollowup} />}
        </div>
    );
}

function LeadForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: AdminLeadWrite) => void }) {
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [phone, setPhone] = useState('');
    const [interest, setInterest] = useState('');
    const [estimatedValue, setEstimatedValue] = useState('');
    const [source, setSource] = useState('tiktok_dm');
    const [notes, setNotes] = useState('');

    return (
        <Modal onClose={onClose} title="New lead" subtitle="Record a new potential customer">
            <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Name" required>
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="TikTok handle">
                        <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
                    </Field>
                    <Field label="Phone">
                        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </Field>
                    <Field label="Source">
                        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
                            <option value="tiktok_dm">TikTok DM</option>
                            <option value="tiktok_comment">TikTok Comment</option>
                            <option value="live">TikTok LIVE</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="phone">Phone</option>
                            <option value="bio_link">Bio Link</option>
                        </select>
                    </Field>
                    <Field label="Product of interest">
                        <input className={inputCls} value={interest} onChange={(e) => setInterest(e.target.value)} />
                    </Field>
                    <Field label="Estimated value">
                        <input type="number" className={inputCls} value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
                    </Field>
                </div>
                <Field label="Notes">
                    <textarea className={cn(inputCls, 'min-h-[70px]')} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>
                        Cancel
                    </button>
                    <button
                        onClick={() =>
                            onSubmit({
                                name,
                                handle,
                                phone,
                                interest,
                                estimatedValue,
                                source: source as AdminLeadWrite['source'],
                                notes,
                            })
                        }
                        disabled={!name}
                        className={btnPrimary}
                    >
                        <CheckCircle2 className="w-3 h-3" /> Save lead
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function TicketForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: AdminSupportTicketWrite) => void }) {
    const [customer, setCustomer] = useState('');
    const [subject, setSubject] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Normal' | 'High' | 'Urgent'>('Normal');
    const [description, setDescription] = useState('');

    return (
        <Modal onClose={onClose} title="New support ticket" subtitle="Log a customer issue">
            <div className="space-y-2">
                <Field label="Customer" required>
                    <input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} />
                </Field>
                <Field label="Subject" required>
                    <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
                </Field>
                <Field label="Priority">
                    <select
                        className={inputCls}
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as 'Low' | 'Normal' | 'High' | 'Urgent')}
                    >
                        {TICKET_PRIORITIES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Description">
                    <textarea className={cn(inputCls, 'min-h-[90px]')} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit({ customer, subject, priority, description })}
                        disabled={!customer || !subject}
                        className={btnPrimary}
                    >
                        <CheckCircle2 className="w-3 h-3" /> Create ticket
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function FollowupForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: AdminFollowUpWrite) => void }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [type, setType] = useState<'Call' | 'Message' | 'Email' | 'Visit'>('Call');
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');

    return (
        <Modal onClose={onClose} title="Schedule follow-up" subtitle="Set a reminder">
            <div className="space-y-2">
                <Field label="Name" required>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Phone">
                    <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Type">
                    <select
                        className={inputCls}
                        value={type}
                        onChange={(e) => setType(e.target.value as 'Call' | 'Message' | 'Email' | 'Visit')}
                    >
                        <option value="Call">Call</option>
                        <option value="Message">Message</option>
                        <option value="Email">Email</option>
                        <option value="Visit">Visit</option>
                    </select>
                </Field>
                <Field label="Date" required>
                    <input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Notes">
                    <textarea className={cn(inputCls, 'min-h-[60px]')} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit({ name, phone, type, date, notes })}
                        disabled={!name || !date}
                        className={btnPrimary}
                    >
                        <CheckCircle2 className="w-3 h-3" /> Schedule
                    </button>
                </div>
            </div>
        </Modal>
    );
}