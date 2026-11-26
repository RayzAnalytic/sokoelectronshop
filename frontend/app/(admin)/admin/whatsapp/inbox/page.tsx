'use client';

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import {
    Search,
    Inbox,
    User,
    UserPlus,
    UserCheck,
    Mail,
    Calendar,
    ShoppingBag,
    DollarSign,
    Package,
    Send,
    Paperclip,
    Check,
    CheckCheck,
    Clock,
    AlertCircle,
    XCircle,
    Loader2,
    ChevronLeft,
    ChevronDown,
    X,
    MessageSquare,
    Archive,
    CheckCircle2,
    RotateCw,
    StickyNote,
    ExternalLink,
    FileText,
    ShieldCheck,
    ShieldOff,
    Users,
    MessageCircle,
    Lock,
} from 'lucide-react';

type ConversationStatus = 'open' | 'pending' | 'resolved' | 'archived';
type FilterKey =
    | 'all'
    | 'unread'
    | 'assigned_me'
    | 'unassigned'
    | 'open'
    | 'pending'
    | 'resolved'
    | 'archived';

type Conversation = {
    id: string;
    customerId: string | null;
    customerName: string | null;
    phoneNumber: string;
    lastMessagePreview: string;
    lastMessageAt: string;
    unreadCount: number;
    assignedToId: string | null;
    assignedToName: string | null;
    status: ConversationStatus;
    labels: string[];
    priority: 'low' | 'normal' | 'high' | null;
    customerIdentified: boolean;
};

type MessageAttachment = {
    id: string;
    kind: 'image' | 'document' | 'video' | 'audio';
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
};

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

type Message = {
    id: string;
    conversationId: string;
    direction: 'inbound' | 'outbound';
    body: string | null;
    attachments: MessageAttachment[];
    createdAt: string;
    status: MessageStatus;
    errorReason: string | null;
    isInternalNote: boolean;
    sentById: string | null;
    sentByName: string | null;
    templateName: string | null;
};

type CustomerDetail = {
    id: string;
    name: string;
    phoneNumber: string;
    email: string | null;
    registeredAt: string | null;
    ordersCount: number;
    totalSpent: number;
    lastPaymentStatus: string | null;
    lastDeliveryStatus: string | null;
    notes: string | null;
    marketingOptIn: boolean;
    consentSource: string | null;
    consentAt: string | null;
    optOutAt: string | null;
};

type ConversationContext = {
    conversation: Conversation;
    messages: Message[];
    customer: CustomerDetail | null;
    window: {
        isOpen: boolean;
        expiresAt: string | null;
        canSendFreeform: boolean;
        requiresTemplate: boolean;
    };
};

type StaffMember = {
    id: string;
    name: string;
};

type ProductSearchResult = {
    id: string;
    name: string;
    sku: string;
    price: number;
    currency: string;
    imageUrl: string | null;
    inStock: boolean;
    productUrl: string;
};

type CustomerOrder = {
    id: string;
    reference: string;
    date: string;
    status: string;
    paymentStatus: string;
    deliveryStatus: string;
    total: number;
    currency: string;
    trackingUrl: string | null;
};

type TemplateSummary = {
    id: string;
    name: string;
    language: string;
    category: string;
    status: 'approved' | 'pending' | 'rejected';
};

const FILTERS: Array<{ key: FilterKey; label: string; icon: typeof Inbox }> = [
    { key: 'all', label: 'All', icon: Inbox },
    { key: 'unread', label: 'Unread', icon: MessageSquare },
    { key: 'assigned_me', label: 'Assigned to me', icon: UserCheck },
    { key: 'unassigned', label: 'Unassigned', icon: UserPlus },
    { key: 'open', label: 'Open', icon: MessageCircle },
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
    { key: 'archived', label: 'Archived', icon: Archive },
];

const STATUS_META: Record<
    ConversationStatus,
    { label: string; bg: string; text: string; border: string }
> = {
    open: {
        label: 'Open',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
    },
    pending: {
        label: 'Pending',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    resolved: {
        label: 'Resolved',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
    },
    archived: {
        label: 'Archived',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
    },
};

function formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString();
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString();
}

function formatCurrency(v: number, currency = 'KES'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'KES',
        maximumFractionDigits: 2,
    }).format(v);
}

function StatusPill({ status }: { status: ConversationStatus }) {
    const m = STATUS_META[status] ?? STATUS_META.open;
    return (
        <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            {m.label}
        </span>
    );
}

function MessageStatusIcon({ status }: { status: MessageStatus }) {
    if (status === 'sending') return <Clock className="w-3 h-3 text-slate-400" />;
    if (status === 'sent') return <Check className="w-3 h-3 text-slate-400" />;
    if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-slate-400" />;
    if (status === 'read') return <CheckCheck className="w-3 h-3 text-blue-500" />;
    return <XCircle className="w-3 h-3 text-rose-500" />;
}

function ConversationRow({
    conversation,
    active,
    onSelect,
}: {
    conversation: Conversation;
    active: boolean;
    onSelect: () => void;
}) {
    const display = conversation.customerName || conversation.phoneNumber;
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-left px-3 py-2 border-b border-slate-100 transition ${active ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
        >
            <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-medium shrink-0">
                    {display.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-slate-800 truncate">
                            {display}
                        </span>
                        {conversation.customerIdentified && (
                            <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                        )}
                        {conversation.priority === 'high' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        )}
                        <span className="flex-1" />
                        <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelative(conversation.lastMessageAt)}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {conversation.lastMessagePreview}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <StatusPill status={conversation.status} />
                        {conversation.assignedToName && (
                            <span className="text-[10px] text-slate-500 truncate">
                                {conversation.assignedToName}
                            </span>
                        )}
                        {conversation.labels.slice(0, 2).map((l) => (
                            <span
                                key={l}
                                className="text-[10px] text-slate-600 bg-slate-100 rounded px-1"
                            >
                                {l}
                            </span>
                        ))}
                        <span className="flex-1" />
                        {conversation.unreadCount > 0 && (
                            <span className="min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                {conversation.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}

function MessageBubble({ message }: { message: Message }) {
    if (message.isInternalNote) {
        return (
            <div className="flex justify-center my-1.5">
                <div className="max-w-[80%] bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-[11px] text-amber-800">
                    <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium mb-0.5">
                        <StickyNote className="w-3 h-3" />
                        Internal note · {message.sentByName ?? 'Staff'}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                </div>
            </div>
        );
    }
    const outbound = message.direction === 'outbound';
    return (
        <div className={`flex ${outbound ? 'justify-end' : 'justify-start'} my-1`}>
            <div
                className={`max-w-[78%] rounded px-2.5 py-1.5 text-[12px] ${outbound ? 'bg-emerald-50 border border-emerald-200 text-slate-800' : 'bg-white border border-slate-200 text-slate-800'}`}
            >
                {message.templateName && (
                    <div className="text-[10px] text-slate-500 mb-0.5">
                        Template · {message.templateName}
                    </div>
                )}
                {message.body && (
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                )}
                {message.attachments.length > 0 && (
                    <div className="mt-1 space-y-1">
                        {message.attachments.map((a) =>
                            a.kind === 'image' ? (
                                <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                >
                                    <img
                                        src={a.url}
                                        alt={a.filename}
                                        className="max-h-40 rounded border border-slate-200"
                                    />
                                </a>
                            ) : (
                                <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-[11px] text-blue-950 hover:underline"
                                >
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate">{a.filename}</span>
                                </a>
                            ),
                        )}
                    </div>
                )}
                {message.errorReason && (
                    <p className="text-[10px] text-rose-600 mt-1">{message.errorReason}</p>
                )}
                <div
                    className={`flex items-center gap-1 mt-0.5 ${outbound ? 'justify-end' : 'justify-start'}`}
                >
                    <span className="text-[10px] text-slate-400">
                        {formatTime(message.createdAt)}
                    </span>
                    {outbound && <MessageStatusIcon status={message.status} />}
                </div>
            </div>
        </div>
    );
}

function CustomerPanel({
    customer,
    orders,
    ordersLoading,
    onRefreshOrders,
}: {
    customer: CustomerDetail | null;
    orders: CustomerOrder[];
    ordersLoading: boolean;
    onRefreshOrders: () => void;
}) {
    if (!customer) {
        return (
            <div className="p-3 text-center">
                <div className="w-9 h-9 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                    <User className="w-4 h-4" />
                </div>
                <p className="text-[12px] font-medium text-slate-800 mt-1.5">
                    Unidentified contact
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                    No existing customer matches this phone number.
                </p>
                <Link
                    href="/customers/new"
                    className="inline-flex items-center gap-1.5 mt-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[11px] transition"
                >
                    <UserPlus className="w-3 h-3" />
                    Create customer
                </Link>
            </div>
        );
    }

    return (
        <div className="p-3 space-y-2">
            <div>
                <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                        {customer.name}
                    </p>
                    <Link
                        href={`/customers/${encodeURIComponent(customer.id)}`}
                        className="text-slate-400 hover:text-blue-950 shrink-0"
                        title="Open customer"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                    {customer.phoneNumber}
                </p>
            </div>

            <div className="space-y-1 text-[11px]">
                {customer.email && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{customer.email}</span>
                    </div>
                )}
                {customer.registeredAt && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Customer since {new Date(customer.registeredAt).toLocaleDateString()}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-slate-50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1 text-slate-500">
                        <ShoppingBag className="w-3 h-3" />
                        <span className="text-[10px]">Orders</span>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-900">
                        {customer.ordersCount}
                    </p>
                </div>
                <div className="bg-slate-50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1 text-slate-500">
                        <DollarSign className="w-3 h-3" />
                        <span className="text-[10px]">Total spent</span>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-900">
                        {formatCurrency(customer.totalSpent)}
                    </p>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-medium text-slate-700">
                        Recent orders
                    </p>
                    <button
                        type="button"
                        onClick={onRefreshOrders}
                        disabled={ordersLoading}
                        className="text-slate-400 hover:text-blue-950 disabled:opacity-50"
                        title="Refresh orders"
                    >
                        <RotateCw className={`w-3 h-3 ${ordersLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {ordersLoading ? (
                    <div className="space-y-1">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No orders yet.</p>
                ) : (
                    <ul className="space-y-1">
                        {orders.slice(0, 4).map((o) => (
                            <li key={o.id}>
                                <Link
                                    href={`/orders/${encodeURIComponent(o.id)}`}
                                    className="block px-2 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
                                >
                                    <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-medium text-slate-800 truncate">
                                            {o.reference}
                                        </span>
                                        <span className="flex-1" />
                                        <span className="text-[10px] text-slate-500">
                                            {formatCurrency(o.total, o.currency)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                        <span>{o.status}</span>
                                        <span>·</span>
                                        <span>{o.paymentStatus}</span>
                                        <span>·</span>
                                        <span>{o.deliveryStatus}</span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div>
                <p className="text-[11px] font-medium text-slate-700 mb-1">
                    Marketing consent
                </p>
                {customer.marketingOptIn ? (
                    <div className="flex items-start gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[11px] text-emerald-800 font-medium">
                                Opted in
                            </p>
                            <p className="text-[10px] text-emerald-700">
                                {customer.consentSource ?? 'Source unknown'}
                                {customer.consentAt &&
                                    ` · ${new Date(customer.consentAt).toLocaleDateString()}`}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                        <ShieldOff className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[11px] text-amber-800 font-medium">
                                Not opted in
                            </p>
                            <p className="text-[10px] text-amber-700">
                                Do not send marketing messages.
                            </p>
                        </div>
                    </div>
                )}
                {customer.optOutAt && (
                    <p className="text-[10px] text-rose-600 mt-1">
                        Opted out on {new Date(customer.optOutAt).toLocaleDateString()}
                    </p>
                )}
            </div>

            {customer.notes && (
                <div>
                    <p className="text-[11px] font-medium text-slate-700 mb-1">
                        Notes
                    </p>
                    <p className="text-[11px] text-slate-600 whitespace-pre-wrap break-words bg-slate-50 rounded px-2 py-1.5">
                        {customer.notes}
                    </p>
                </div>
            )}
        </div>
    );
}

function ProductPicker({
    open,
    onClose,
    onShare,
}: {
    open: boolean;
    onClose: () => void;
    onShare: (product: ProductSearchResult) => void;
}) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ProductSearchResult[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setError('');
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const t = setTimeout(() => {
            adminApi.whatsapp.inbox
                .searchProducts(q, 8, controller.signal)
                .then((data) => setResults(data))
                .catch((err) => {
                    if ((err as { name?: string })?.name === 'AbortError') return;
                    setError('Could not search products.');
                })
                .finally(() => setLoading(false));
        }, 300);
        return () => {
            controller.abort();
            clearTimeout(t);
        };
    }, [query, open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-3">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <h3 className="text-[12px] font-semibold text-slate-800">
                        Share a product
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-900"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-3 space-y-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search product catalogue by name or SKU…"
                            autoFocus
                            className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                        />
                    </div>
                    {error && (
                        <p className="text-[11px] text-rose-600">{error}</p>
                    )}
                    <div className="max-h-72 overflow-y-auto">
                        {loading ? (
                            <div className="py-6 text-center text-[12px] text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                                Searching…
                            </div>
                        ) : query.trim().length < 2 ? (
                            <div className="py-6 text-center text-[12px] text-slate-500">
                                Type at least 2 characters.
                            </div>
                        ) : results.length === 0 ? (
                            <div className="py-6 text-center text-[12px] text-slate-500">
                                No products found.
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {results.map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center gap-2 py-2"
                                    >
                                        {p.imageUrl ? (
                                            <img
                                                src={p.imageUrl}
                                                alt={p.name}
                                                className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                                <Package className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-medium text-slate-800 truncate">
                                                {p.name}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate">
                                                {p.sku} · {formatCurrency(p.price, p.currency)}
                                                {!p.inStock && ' · Out of stock'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onShare(p)}
                                            disabled={!p.inStock}
                                            className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white text-[11px] font-medium px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Send className="w-3 h-3" />
                                            Share
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TemplatePicker({
    open,
    onClose,
    templates,
    loading,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    templates: TemplateSummary[];
    loading: boolean;
    onSelect: (t: TemplateSummary) => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-3">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <h3 className="text-[12px] font-semibold text-slate-800">
                        Choose an approved template
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-900"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-3">
                    {loading ? (
                        <div className="py-6 text-center text-[12px] text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                            Loading templates…
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="py-6 text-center text-[12px] text-slate-500">
                            No approved templates available.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {templates.map((t) => (
                                <li key={t.id} className="py-2 flex items-center gap-2">
                                    <div className="w-7 h-7 rounded bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                        <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-medium text-slate-800 truncate">
                                            {t.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                            {t.category} · {t.language}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(t)}
                                        className="bg-blue-950 hover:bg-blue-900 text-white text-[11px] font-medium px-2 py-1 rounded"
                                    >
                                        Use
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function WhatsAppInboxPageContent() {
    const searchParams = useSearchParams();
    const initialConvId = searchParams.get('conversation');

    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');

    const [activeId, setActiveId] = useState<string | null>(initialConvId);
    const [context, setContext] = useState<ConversationContext | null>(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [contextError, setContextError] = useState('');

    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const [staff, setStaff] = useState<StaffMember[]>([]);

    const [composer, setComposer] = useState('');
    const [internalNote, setInternalNote] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');

    const [productPickerOpen, setProductPickerOpen] = useState(false);
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [templates, setTemplates] = useState<TemplateSummary[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);

    const [assignOpen, setAssignOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const [mobilePane, setMobilePane] = useState<'list' | 'thread' | 'customer'>(
        initialConvId ? 'thread' : 'list',
    );

    const messageEndRef = useRef<HTMLDivElement>(null);
    const messageContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialConvId) {
            setActiveId(initialConvId);
            setMobilePane('thread');
        }
    }, [initialConvId]);

    const loadConversations = useCallback(
        async (silent = false, signal?: AbortSignal) => {
            if (!silent) setListLoading(true);
            setListError('');
            try {
                const data = await adminApi.whatsapp.inbox.listConversations(
                    {
                        filter,
                        ...(search.trim() ? { q: search.trim() } : {}),
                    },
                    signal,
                );
                setConversations(data);
                setActiveId((prev) => prev ?? (data.length > 0 ? data[0].id : null));
            } catch (err) {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setListError('Could not load conversations.');
            } finally {
                setListLoading(false);
            }
        },
        [filter, search],
    );

    useEffect(() => {
        const controller = new AbortController();
        const t = setTimeout(
            () => void loadConversations(false, controller.signal),
            250,
        );
        return () => {
            clearTimeout(t);
            controller.abort();
        };
    }, [loadConversations]);

    useEffect(() => {
        const controller = new AbortController();
        adminApi.whatsapp.inbox
            .listStaff(controller.signal)
            .then((d) => setStaff(d))
            .catch(() => setStaff([]));
        return () => controller.abort();
    }, []);

    const loadContext = useCallback(
        async (id: string, silent = false, signal?: AbortSignal) => {
            if (!silent) setContextLoading(true);
            setContextError('');
            try {
                const data = await adminApi.whatsapp.inbox.context(id, signal);
                setContext(data);
            } catch (err) {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setContextError('Could not load conversation.');
            } finally {
                setContextLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (!activeId) {
            setContext(null);
            setOrders([]);
            return;
        }
        const controller = new AbortController();
        void loadContext(activeId, false, controller.signal);
        return () => controller.abort();
    }, [activeId, loadContext]);

    useEffect(() => {
        if (!context?.customer?.id) {
            setOrders([]);
            return;
        }
        const controller = new AbortController();
        setOrdersLoading(true);
        adminApi.whatsapp.inbox
            .customerOrders(context.customer.id, 10, controller.signal)
            .then((d) => setOrders(d))
            .catch((err) => {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setOrders([]);
            })
            .finally(() => setOrdersLoading(false));
        return () => controller.abort();
    }, [context?.customer?.id]);

    useEffect(() => {
        if (!messageContainerRef.current) return;
        messageContainerRef.current.scrollTop =
            messageContainerRef.current.scrollHeight;
    }, [context?.messages.length, activeId]);

    const refreshOrders = () => {
        if (!context?.customer?.id) return;
        setOrdersLoading(true);
        adminApi.whatsapp.inbox
            .customerOrders(context.customer.id, 10)
            .then((d) => setOrders(d))
            .catch(() => setOrders([]))
            .finally(() => setOrdersLoading(false));
    };

    const loadTemplates = () => {
        setTemplatesLoading(true);
        adminApi.whatsapp.templates
            .list({ status: 'approved' })
            .then((d) => setTemplates(d as unknown as TemplateSummary[]))
            .catch(() => setTemplates([]))
            .finally(() => setTemplatesLoading(false));
    };

    const openTemplatePicker = () => {
        setTemplatePickerOpen(true);
        if (templates.length === 0) loadTemplates();
    };

    const handleSend = async () => {
        if (!context) return;
        const body = composer.trim();
        if (!internalNote) {
            if (!body) return;
            if (context.window.requiresTemplate && !selectedTemplate) {
                setSendError(
                    'Outside the 24-hour messaging window. Choose an approved template to send.',
                );
                return;
            }
        } else if (!body) {
            return;
        }

        setSending(true);
        setSendError('');
        const optimisticId = `local-${Date.now()}`;
        const optimistic: Message = {
            id: optimisticId,
            conversationId: context.conversation.id,
            direction: 'outbound',
            body,
            attachments: [],
            createdAt: new Date().toISOString(),
            status: 'sending',
            errorReason: null,
            isInternalNote: internalNote,
            sentById: null,
            sentByName: null,
            templateName: selectedTemplate?.name ?? null,
        };
        setContext((prev) =>
            prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev,
        );
        setComposer('');

        try {
            const sent = await adminApi.whatsapp.inbox.sendMessage(
                context.conversation.id,
                {
                    body,
                    is_internal_note: internalNote,
                    template_id: selectedTemplate?.id ?? null,
                },
            );
            setContext((prev) =>
                prev
                    ? {
                        ...prev,
                        messages: prev.messages.map((m) =>
                            m.id === optimisticId ? sent : m,
                        ),
                    }
                    : prev,
            );
            setSelectedTemplate(null);
        } catch {
            setContext((prev) =>
                prev
                    ? {
                        ...prev,
                        messages: prev.messages.map((m) =>
                            m.id === optimisticId
                                ? {
                                    ...m,
                                    status: 'failed',
                                    errorReason: 'Could not send message.',
                                }
                                : m,
                        ),
                    }
                    : prev,
            );
            setSendError('Message failed to send. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleShareProduct = async (product: ProductSearchResult) => {
        if (!context) return;
        setProductPickerOpen(false);
        setSendError('');
        try {
            await adminApi.whatsapp.inbox.shareProduct(
                context.conversation.id,
                product.id,
            );
            await loadContext(context.conversation.id, true);
        } catch {
            setSendError('Could not share product.');
        }
    };

    const handleAssign = async (staffId: string | null) => {
        if (!context) return;
        setActionLoading('assign');
        try {
            await adminApi.whatsapp.inbox.assign(context.conversation.id, {
                staff_id: staffId,
            });
            await loadContext(context.conversation.id, true);
            await loadConversations(true);
        } catch {
            setSendError('Action failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateStatus = async (status: ConversationStatus) => {
        if (!context) return;
        setActionLoading('mark_resolved');
        try {
            await adminApi.whatsapp.inbox.updateStatus(
                context.conversation.id,
                status,
            );
            await loadContext(context.conversation.id, true);
            await loadConversations(true);
        } catch {
            setSendError('Action failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const groupedMessages = useMemo(() => {
        if (!context) return [];
        const groups: Array<{ day: string; messages: Message[] }> = [];
        for (const m of context.messages) {
            const day = formatDay(m.createdAt);
            if (groups.length === 0 || groups[groups.length - 1].day !== day) {
                groups.push({ day, messages: [m] });
            } else {
                groups[groups.length - 1].messages.push(m);
            }
        }
        return groups;
    }, [context]);

    return (
        <div className="min-h-[calc(100vh-52px)] bg-slate-50">
            <div className="px-3 sm:px-4 lg:px-5 py-3">
                <div className="bg-white border border-slate-200 rounded overflow-hidden flex flex-col lg:grid lg:grid-cols-[300px_1fr_280px] lg:h-[calc(100vh-84px)]">
                    <aside
                        className={`${mobilePane === 'list' ? 'block' : 'hidden'} lg:block border-r border-slate-200 flex flex-col min-h-0`}
                    >
                        <div className="p-2 border-b border-slate-100 space-y-1.5">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search name, phone or order…"
                                    className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                />
                            </div>
                            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                                {FILTERS.map((f) => {
                                    const Icon = f.icon;
                                    const active = filter === f.key;
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => setFilter(f.key)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] whitespace-nowrap transition ${active ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            <Icon className="w-3 h-3" />
                                            {f.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {listLoading ? (
                                <div className="p-2 space-y-1.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-14 bg-slate-50 rounded animate-pulse"
                                        />
                                    ))}
                                </div>
                            ) : listError ? (
                                <div className="p-3 text-[12px] text-rose-600 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {listError}
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="py-8 text-center text-[12px] text-slate-500">
                                    <Inbox className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                                    No conversations match this filter.
                                </div>
                            ) : (
                                conversations.map((c) => (
                                    <ConversationRow
                                        key={c.id}
                                        conversation={c}
                                        active={activeId === c.id}
                                        onSelect={() => {
                                            setActiveId(c.id);
                                            setMobilePane('thread');
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </aside>

                    <section
                        className={`${mobilePane === 'thread' ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 border-r border-slate-200`}
                    >
                        {!activeId || contextError ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-[12px] text-slate-500 p-4">
                                <MessageCircle className="w-6 h-6 text-slate-300 mb-1" />
                                {contextError
                                    ? contextError
                                    : 'Select a conversation to view messages.'}
                            </div>
                        ) : contextLoading && !context ? (
                            <div className="flex-1 flex items-center justify-center text-[12px] text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                Loading conversation…
                            </div>
                        ) : context ? (
                            <>
                                <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMobilePane('list')}
                                        className="lg:hidden text-slate-500 hover:text-slate-900"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[13px] font-semibold text-slate-900 truncate">
                                                {context.customer?.name ||
                                                    context.conversation.customerName ||
                                                    context.conversation.phoneNumber}
                                            </p>
                                            <StatusPill status={context.conversation.status} />
                                            {context.customer && (
                                                <UserCheck className="w-3 h-3 text-emerald-500" />
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-mono truncate">
                                            {context.conversation.phoneNumber}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMobilePane('customer')}
                                        className="lg:hidden text-slate-500 hover:text-slate-900"
                                        title="Customer info"
                                    >
                                        <User className="w-4 h-4" />
                                    </button>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setAssignOpen((o) => !o)}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50"
                                        >
                                            <Users className="w-3 h-3" />
                                            <span className="hidden sm:inline">
                                                {context.conversation.assignedToName
                                                    ? context.conversation.assignedToName
                                                    : 'Assign'}
                                            </span>
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                        {assignOpen && (
                                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleAssign(null);
                                                        setAssignOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                                                >
                                                    Unassign
                                                </button>
                                                {staff.map((s) => (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() => {
                                                            void handleAssign(s.id);
                                                            setAssignOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                                                    >
                                                        {s.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!context.window.canSendFreeform && (
                                    <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
                                        <Lock className="w-3 h-3 shrink-0" />
                                        Outside the 24-hour customer-service window. Use an approved
                                        template to send a new message.
                                    </div>
                                )}

                                <div
                                    ref={messageContainerRef}
                                    className="flex-1 overflow-y-auto min-h-0 px-3 py-2 bg-slate-50"
                                >
                                    {groupedMessages.map((g) => (
                                        <div key={g.day}>
                                            <div className="flex items-center gap-2 my-2">
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <span className="text-[10px] text-slate-500">
                                                    {g.day}
                                                </span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                            </div>
                                            {g.messages.map((m) => (
                                                <MessageBubble key={m.id} message={m} />
                                            ))}
                                        </div>
                                    ))}
                                    <div ref={messageEndRef} />
                                </div>

                                <div className="border-t border-slate-200 p-2 space-y-1.5">
                                    {sendError && (
                                        <div className="bg-rose-50 border border-rose-200 rounded px-2 py-1 text-[11px] text-rose-700 flex items-center gap-1.5">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            {sendError}
                                        </div>
                                    )}
                                    {selectedTemplate && (
                                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-[11px] text-blue-800">
                                            <FileText className="w-3 h-3 shrink-0" />
                                            <span className="truncate">
                                                Template: {selectedTemplate.name}
                                            </span>
                                            <span className="flex-1" />
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTemplate(null)}
                                                className="text-blue-700 hover:text-blue-900"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setInternalNote((v) => !v)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] ${internalNote ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'}`}
                                            title="Internal note (not sent to customer)"
                                        >
                                            <StickyNote className="w-3 h-3" />
                                            {internalNote ? 'Note' : 'Reply'}
                                        </button>
                                        <span className="flex-1" />
                                        <button
                                            type="button"
                                            onClick={() => setProductPickerOpen(true)}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100"
                                            title="Share product"
                                        >
                                            <Package className="w-3 h-3" />
                                            Product
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openTemplatePicker}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100"
                                            title="Use template"
                                        >
                                            <FileText className="w-3 h-3" />
                                            Template
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleUpdateStatus('resolved')}
                                            disabled={actionLoading === 'mark_resolved'}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                            title="Mark resolved"
                                        >
                                            {actionLoading === 'mark_resolved' ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3" />
                                            )}
                                            Resolve
                                        </button>
                                    </div>
                                    <div className="flex items-end gap-1.5">
                                        <button
                                            type="button"
                                            className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                                            title="Attach file"
                                            disabled
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </button>
                                        <textarea
                                            value={composer}
                                            onChange={(e) => setComposer(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    void handleSend();
                                                }
                                            }}
                                            rows={2}
                                            placeholder={
                                                internalNote
                                                    ? 'Write an internal note (staff only)…'
                                                    : context.window.requiresTemplate
                                                        ? 'Choose a template to send a message…'
                                                        : 'Type a message…'
                                            }
                                            disabled={
                                                !internalNote &&
                                                context.window.requiresTemplate &&
                                                !selectedTemplate
                                            }
                                            className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 resize-none disabled:bg-slate-50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void handleSend()}
                                            disabled={sending || !composer.trim()}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${internalNote ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-950 hover:bg-blue-900 text-white'}`}
                                        >
                                            {sending ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Send className="w-3.5 h-3.5" />
                                            )}
                                            {internalNote ? 'Note' : 'Send'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </section>

                    <aside
                        className={`${mobilePane === 'customer' ? 'block' : 'hidden'} lg:block overflow-y-auto min-h-0`}
                    >
                        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setMobilePane('thread')}
                                className="lg:hidden text-slate-500 hover:text-slate-900"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <p className="text-[12px] font-semibold text-slate-800">
                                Customer
                            </p>
                        </div>
                        <CustomerPanel
                            customer={context?.customer ?? null}
                            orders={orders}
                            ordersLoading={ordersLoading}
                            onRefreshOrders={refreshOrders}
                        />
                    </aside>
                </div>
            </div>

            <ProductPicker
                open={productPickerOpen}
                onClose={() => setProductPickerOpen(false)}
                onShare={(p) => void handleShareProduct(p)}
            />

            <TemplatePicker
                open={templatePickerOpen}
                onClose={() => setTemplatePickerOpen(false)}
                templates={templates}
                loading={templatesLoading}
                onSelect={(t) => {
                    setSelectedTemplate(t);
                    setTemplatePickerOpen(false);
                }}
            />
        </div>
    );
}

export default function WhatsAppInboxPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-[calc(100vh-52px)] bg-slate-50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
            }
        >
            <WhatsAppInboxPageContent />
        </Suspense>
    );
}