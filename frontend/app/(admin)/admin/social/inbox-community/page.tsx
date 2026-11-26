'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    Archive,
    AtSign,
    CheckCircle2,
    ChevronDown,
    Clock,
    Copy,
    ExternalLink,
    Filter,
    Inbox,
    Loader2,
    Mail,
    MessageCircle,
    MessageSquare,
    RefreshCw,
    Search,
    Send,
    Smile,
    UserCheck,
    X,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { adminApi as api } from '@/lib/admin-api';
import { ApiError, type Me } from '@/lib/api';

type Platform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
type InteractionType = 'dm' | 'comment' | 'mention';
type ConversationStatus = 'unread' | 'read' | 'pending' | 'resolved' | 'archived';
type InboxFolder =
    | 'all'
    | 'dm'
    | 'comment'
    | 'mention'
    | 'unread'
    | 'assigned_me'
    | 'unassigned'
    | 'resolved'
    | 'archived';

type Staff = {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
};

type CustomerRecord = {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    status?: string | null;
    orders_count?: number;
    total_spent?: number | null;
    last_order_at?: string | null;
};

type LinkedProduct = {
    id: string;
    name: string;
    price: number;
    currency: string;
    in_stock: boolean;
    url: string;
};

type ConversationMessage = {
    id: string;
    direction: 'inbound' | 'outbound' | 'note';
    body: string;
    created_at: string;
    author_name?: string | null;
    can_reply?: boolean;
};

type Conversation = {
    id: string;
    platform: Platform;
    type: InteractionType;
    customer_display_name: string;
    customer_username?: string | null;
    customer_avatar_url?: string | null;
    preview: string;
    related_post_title?: string | null;
    related_post_url?: string | null;
    related_post_thumbnail?: string | null;
    last_interaction_at: string;
    status: ConversationStatus;
    assigned_to?: Staff | null;
    unread: boolean;
    can_reply: boolean;
    can_react: boolean;
    can_hide: boolean;
    can_moderate: boolean;
    can_archive: boolean;
    can_assign: boolean;
    linked_customer?: CustomerRecord | null;
    linked_product?: LinkedProduct | null;
    messages: ConversationMessage[];
    platform_capability_note?: string | null;
};

type StaffWorkload = {
    staff_id: string;
    staff_name: string;
    assigned_count: number;
};

type InboxMetrics = {
    total_incoming: number;
    unread: number;
    resolved: number;
    unanswered: number;
    avg_response_seconds?: number | null;
    by_platform: Record<Platform, number>;
    staff_workload: StaffWorkload[];
};

type PlatformCapabilities = Record<Platform, {
    connected: boolean;
    supports_dm: boolean;
    supports_comments: boolean;
    supports_mentions: boolean;
    supports_reply: boolean;
    supports_react: boolean;
    supports_hide: boolean;
    supports_moderation: boolean;
    note?: string | null;
}>;

const PLATFORM_META: Record<Platform, { label: string; icon: IconType; color: string }> = {
    youtube: { label: 'YouTube', icon: FaYoutube, color: 'text-red-600' },
    facebook: { label: 'Facebook', icon: FaFacebook, color: 'text-blue-600' },
    instagram: { label: 'Instagram', icon: FaInstagram, color: 'text-pink-600' },
    tiktok: { label: 'TikTok', icon: FaTiktok, color: 'text-slate-900' },
};

const FOLDER_META: { key: InboxFolder; label: string; icon: typeof Inbox }[] = [
    { key: 'all', label: 'All interactions', icon: Inbox },
    { key: 'dm', label: 'Direct messages', icon: MessageSquare },
    { key: 'comment', label: 'Comments', icon: MessageCircle },
    { key: 'mention', label: 'Mentions', icon: AtSign },
    { key: 'unread', label: 'Unread', icon: Mail },
    { key: 'assigned_me', label: 'Assigned to me', icon: UserCheck },
    { key: 'unassigned', label: 'Unassigned', icon: AlertTriangle },
    { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
    { key: 'archived', label: 'Archived', icon: Archive },
];

const TEMPLATE_LIBRARY: { id: string; label: string; body: string }[] = [
    { id: 'pricing', label: 'Product pricing', body: 'Thanks for reaching out! The current price for this product is KES {price}. Would you like me to share more details?' },
    { id: 'availability', label: 'Product availability', body: 'Thanks for your interest! This item is currently {availability}. I can let you know as soon as it is back in stock.' },
    { id: 'delivery', label: 'Delivery questions', body: 'We deliver within 2–5 business days depending on your location. Delivery is free for orders above a certain amount. May I know your delivery area?' },
    { id: 'payment', label: 'Payment questions', body: 'We accept mobile money, card payments and bank transfer. Let me know which method is most convenient for you.' },
    { id: 'tracking', label: 'Order tracking', body: 'Please share your order number and I will check the delivery status for you right away.' },
    { id: 'returns', label: 'Returns and refunds', body: 'We accept returns within 7 days of delivery for unused items in original packaging. Please share your order number so I can guide you through the process.' },
    { id: 'hours', label: 'Business hours', body: 'Our team is available Monday to Saturday, 9:00 AM to 6:00 PM. We respond to messages received outside these hours on the next business day.' },
    { id: 'general', label: 'General enquiries', body: 'Thank you for reaching out. How can I assist you today?' },
];

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

function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

function formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

function formatSeconds(seconds?: number | null): string {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
}

function formatMoney(amount: number, currency?: string | null): string {
    const cur = currency || 'KES';
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(amount);
    } catch {
        return `${cur} ${amount.toFixed(2)}`;
    }
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

type InboxApiClient = {
    social?: {
        inbox?: {
            conversations?: {
                list?: (filters: Record<string, string>) => Promise<Conversation[]>;
                detail?: (id: string) => Promise<Conversation>;
                reply?: (id: string, body: string) => Promise<Conversation>;
                addNote?: (id: string, body: string) => Promise<Conversation>;
                assign?: (id: string, staff_id: string | null) => Promise<Conversation>;
                react?: (id: string, reaction?: string) => Promise<Conversation>;
                hide?: (id: string) => Promise<Conversation>;
                moderate?: (id: string) => Promise<Conversation>;
                markUnread?: (id: string) => Promise<Conversation>;
                resolve?: (id: string) => Promise<Conversation>;
                archive?: (id: string) => Promise<Conversation>;
                linkProduct?: (id: string, product_id: string) => Promise<Conversation>;
                linkCustomer?: (id: string, customer_id: string) => Promise<Conversation>;
            };
            capabilities?: () => Promise<PlatformCapabilities>;
            metrics?: () => Promise<InboxMetrics>;
            templates?: { list?: () => Promise<{ id: string; label: string; body: string }[]> };
        };
    };
    listStaff?: () => Promise<Staff[] | { staff?: Staff[]; results?: Staff[] }>;
    searchProducts?: (q: string) => Promise<LinkedProduct[] | { products?: LinkedProduct[]; results?: LinkedProduct[] }>;
};

const clientApi = () => api as unknown as InboxApiClient;

async function fetchConversations(filters: Record<string, string>): Promise<Conversation[]> {
    const fn = clientApi().social?.inbox?.conversations?.list;
    if (typeof fn === 'function') return fn(filters);
    const qs = new URLSearchParams(filters).toString();
    return jsonFetch<Conversation[]>(`/api/v1/admin/social/inbox/conversations/${qs ? `?${qs}` : ''}`);
}

async function fetchInboxCapabilities(): Promise<PlatformCapabilities> {
    const fn = clientApi().social?.inbox?.capabilities;
    if (typeof fn === 'function') return fn();
    return jsonFetch<PlatformCapabilities>('/api/v1/admin/social/inbox/capabilities/');
}

async function fetchInboxMetrics(): Promise<InboxMetrics> {
    const fn = clientApi().social?.inbox?.metrics;
    if (typeof fn === 'function') return fn();
    return jsonFetch<InboxMetrics>('/api/v1/admin/social/inbox/metrics/');
}

async function fetchConversationDetail(id: string): Promise<Conversation> {
    const fn = clientApi().social?.inbox?.conversations?.detail;
    if (typeof fn === 'function') return fn(id);
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/`);
}

async function sendConversationReply(id: string, body: string): Promise<Conversation> {
    const fn = clientApi().social?.inbox?.conversations?.reply;
    if (typeof fn === 'function') return fn(id, body);
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/reply/`, {
        method: 'POST',
        body: JSON.stringify({ body }),
    });
}

async function addConversationNote(id: string, body: string): Promise<Conversation> {
    const fn = clientApi().social?.inbox?.conversations?.addNote;
    if (typeof fn === 'function') return fn(id, body);
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/notes/`, {
        method: 'POST',
        body: JSON.stringify({ body }),
    });
}

async function assignConversationStaff(id: string, staffId: string | null): Promise<Conversation> {
    const fn = clientApi().social?.inbox?.conversations?.assign;
    if (typeof fn === 'function') return fn(id, staffId);
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/assign/`, {
        method: 'POST',
        body: JSON.stringify({ staff_id: staffId }),
    });
}

async function performConversationAction(
    id: string,
    action: string,
    payload?: Record<string, unknown>,
): Promise<Conversation> {
    const convs = clientApi().social?.inbox?.conversations;
    if (convs) {
        if (action === 'react' && typeof convs.react === 'function') return convs.react(id, String(payload?.reaction ?? 'like'));
        if (action === 'hide' && typeof convs.hide === 'function') return convs.hide(id);
        if (action === 'moderate' && typeof convs.moderate === 'function') return convs.moderate(id);
        if (action === 'mark-unread' && typeof convs.markUnread === 'function') return convs.markUnread(id);
        if (action === 'resolve' && typeof convs.resolve === 'function') return convs.resolve(id);
        if (action === 'archive' && typeof convs.archive === 'function') return convs.archive(id);
    }
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/${action}/`, {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
    });
}

async function linkProductToConversation(id: string, productId: string): Promise<Conversation> {
    const fn = clientApi().social?.inbox?.conversations?.linkProduct;
    if (typeof fn === 'function') return fn(id, productId);
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/product/`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
    });
}

async function linkCustomerToConversation(id: string, customerId: string): Promise<Conversation> {
    const fn = clientApi().social?.inbox?.conversations?.linkCustomer;
    if (typeof fn === 'function') return fn(id, customerId);
    return jsonFetch<Conversation>(`/api/v1/admin/social/inbox/conversations/${encodeURIComponent(id)}/customer/`, {
        method: 'POST',
        body: JSON.stringify({ customer_id: customerId }),
    });
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

async function searchProductCatalogue(q: string): Promise<LinkedProduct[]> {
    const fn = clientApi().searchProducts;
    if (typeof fn === 'function') {
        const res = await fn(q);
        if (Array.isArray(res)) return res;
        return res.products ?? res.results ?? [];
    }
    const res = await jsonFetch<LinkedProduct[] | { products?: LinkedProduct[]; results?: LinkedProduct[] }>(
        `/api/products/search?q=${encodeURIComponent(q)}&limit=10`,
    );
    if (Array.isArray(res)) return res;
    return res.products ?? res.results ?? [];
}

async function searchCustomerRecords(q: string): Promise<CustomerRecord[]> {
    const res = await jsonFetch<CustomerRecord[] | { customers?: CustomerRecord[]; results?: CustomerRecord[] }>(
        `/api/customers/search?q=${encodeURIComponent(q)}&limit=10`,
    );
    if (Array.isArray(res)) return res;
    return res.customers ?? res.results ?? [];
}

function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
    const Meta = PLATFORM_META[platform];
    const Icon = Meta.icon;
    return <Icon className={Meta.color} size={size} />;
}

function StatusPill({ status }: { status: ConversationStatus }) {
    const styles: Record<ConversationStatus, string> = {
        unread: 'bg-blue-50 text-blue-950 border-blue-200',
        read: 'bg-slate-50 text-slate-600 border-slate-200',
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        archived: 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium capitalize ${styles[status]}`}>
            {status}
        </span>
    );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
    if (url) {
        return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover bg-slate-100" />;
    }
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('');
    return (
        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px] font-semibold">
            {initials || '?'}
        </div>
    );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone?: 'blue' | 'amber' | 'emerald' }) {
    const toneClass =
        tone === 'blue' ? 'text-blue-950' : tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900';
    return (
        <div className="bg-white border border-slate-200 rounded p-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-[16px] font-semibold ${toneClass}`}>{value}</p>
        </div>
    );
}

function InboxCommunityPageContent() {
    const searchParams = useSearchParams();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
    const [metrics, setMetrics] = useState<InboxMetrics | null>(null);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [templates, setTemplates] = useState<{ id: string; label: string; body: string }[]>(TEMPLATE_LIBRARY);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [folder, setFolder] = useState<InboxFolder>('all');
    const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Conversation | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const [replyBody, setReplyBody] = useState('');
    const [replySending, setReplySending] = useState(false);
    const [replyError, setReplyError] = useState('');
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');

    const [noteBody, setNoteBody] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteError, setNoteError] = useState('');

    const [assignOpen, setAssignOpen] = useState(false);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const assignRef = useRef<HTMLDivElement | null>(null);

    const [productQuery, setProductQuery] = useState('');
    const debouncedProductQuery = useDebouncedValue(productQuery, 250);
    const [productResults, setProductResults] = useState<LinkedProduct[]>([]);
    const [productSearching, setProductSearching] = useState(false);
    const [productError, setProductError] = useState('');
    const [productPanelOpen, setProductPanelOpen] = useState(false);
    const [linkingProduct, setLinkingProduct] = useState(false);

    const [customerQuery, setCustomerQuery] = useState('');
    const debouncedCustomerQuery = useDebouncedValue(customerQuery, 250);
    const [customerResults, setCustomerResults] = useState<CustomerRecord[]>([]);
    const [customerSearching, setCustomerSearching] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
    const [linkingCustomer, setLinkingCustomer] = useState(false);

    const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
    const templateRef = useRef<HTMLDivElement | null>(null);

    const loadInbox = useCallback(async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);
        setLoadError('');
        try {
            const filters: Record<string, string> = {};
            if (folder !== 'all') filters.folder = folder;
            if (platformFilter !== 'all') filters.platform = platformFilter;
            if (debouncedSearch.trim()) filters.q = debouncedSearch.trim();

            const tplLoader = clientApi().social?.inbox?.templates?.list;
            const [convRes, capRes, metricRes, staffRes, tplRes] = await Promise.all([
                fetchConversations(filters),
                fetchInboxCapabilities(),
                fetchInboxMetrics(),
                fetchStaffOptions().catch(() => [] as Staff[]),
                typeof tplLoader === 'function' ? tplLoader().catch(() => []) : Promise.resolve([]),
            ]);

            setConversations(convRes);
            setCapabilities(capRes);
            setMetrics(metricRes);
            setStaffList(staffRes);
            if (Array.isArray(tplRes) && tplRes.length > 0) {
                setTemplates(tplRes);
            }
        } catch (err: any) {
            setLoadError(errorMessage(err, 'Could not load inbox.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [folder, platformFilter, debouncedSearch]);

    useEffect(() => {
        void loadInbox(true);
    }, [loadInbox]);

    useEffect(() => {
        const id = searchParams.get('id') || searchParams.get('item');
        if (id) setSelectedId(id);
    }, [searchParams]);

    const loadConversation = useCallback(async (id: string) => {
        setDetailLoading(true);
        setDetailError('');
        setReplyError('');
        setActionError('');
        setNoteError('');
        try {
            const data = await fetchConversationDetail(id);
            setSelected(data);
            setConversations((prev) =>
                prev.map((c) => (c.id === id ? { ...c, unread: false, status: c.status === 'unread' ? 'read' : c.status } : c)),
            );
        } catch (err: any) {
            setDetailError(errorMessage(err, 'Could not load conversation.'));
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
        void loadConversation(selectedId);
    }, [selectedId, loadConversation]);

    useEffect(() => {
        if (!assignOpen) return;
        const handler = (e: MouseEvent) => {
            if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
                setAssignOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [assignOpen]);

    useEffect(() => {
        if (!templateMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
                setTemplateMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [templateMenuOpen]);

    useEffect(() => {
        if (!productPanelOpen) return;
        if (!debouncedProductQuery.trim()) {
            setProductResults([]);
            return;
        }
        let cancelled = false;
        setProductSearching(true);
        setProductError('');
        searchProductCatalogue(debouncedProductQuery.trim())
            .then((res) => {
                if (!cancelled) setProductResults(res);
            })
            .catch((err) => {
                if (!cancelled) setProductError(errorMessage(err, 'Product search failed.'));
            })
            .finally(() => {
                if (!cancelled) setProductSearching(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedProductQuery, productPanelOpen]);

    useEffect(() => {
        if (!customerPanelOpen) return;
        if (!debouncedCustomerQuery.trim()) {
            setCustomerResults([]);
            return;
        }
        let cancelled = false;
        setCustomerSearching(true);
        setCustomerError('');
        searchCustomerRecords(debouncedCustomerQuery.trim())
            .then((res) => {
                if (!cancelled) setCustomerResults(res);
            })
            .catch((err) => {
                if (!cancelled) setCustomerError(errorMessage(err, 'Customer search failed.'));
            })
            .finally(() => {
                if (!cancelled) setCustomerSearching(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedCustomerQuery, customerPanelOpen]);

    const availablePlatforms = useMemo<Platform[]>(() => {
        if (!capabilities) return ['youtube', 'facebook', 'instagram', 'tiktok'];
        return (Object.keys(capabilities) as Platform[]).filter((p) => capabilities[p].connected);
    }, [capabilities]);

    const availableFolders = useMemo<InboxFolder[]>(() => {
        const base: InboxFolder[] = ['all', 'unread', 'assigned_me', 'unassigned', 'resolved', 'archived'];
        if (!capabilities) return ['all', 'dm', 'comment', 'mention', ...base.slice(1)];
        const anyDm = availablePlatforms.some((p) => capabilities[p].supports_dm);
        const anyComment = availablePlatforms.some((p) => capabilities[p].supports_comments);
        const anyMention = availablePlatforms.some((p) => capabilities[p].supports_mentions);
        const result: InboxFolder[] = ['all'];
        if (anyDm) result.push('dm');
        if (anyComment) result.push('comment');
        if (anyMention) result.push('mention');
        result.push(...base.slice(1));
        return result;
    }, [capabilities, availablePlatforms]);

    useEffect(() => {
        if (!availableFolders.includes(folder)) setFolder('all');
    }, [availableFolders, folder]);

    const filteredConversations = useMemo(() => {
        if (platformFilter === 'all') return conversations;
        return conversations.filter((c) => c.platform === platformFilter);
    }, [conversations, platformFilter]);

    const currentCapability = selected ? capabilities?.[selected.platform] : null;

    const handleRefresh = () => {
        void loadInbox(false);
        if (selectedId) void loadConversation(selectedId);
    };

    const handleReply = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selected || !replyBody.trim() || !selected.can_reply) return;
        setReplySending(true);
        setReplyError('');
        try {
            const updated = await sendConversationReply(selected.id, replyBody.trim());
            setSelected(updated);
            setConversations((prev) =>
                prev.map((c) => (c.id === updated.id ? { ...c, preview: updated.preview, last_interaction_at: updated.last_interaction_at } : c)),
            );
            setReplyBody('');
        } catch (err: any) {
            setReplyError(errorMessage(err, 'Could not send reply.'));
        } finally {
            setReplySending(false);
        }
    };

    const runAction = async (action: string, payload?: Record<string, unknown>, label?: string) => {
        if (!selected) return;
        setActionBusy(action);
        setActionError('');
        try {
            const updated = await performConversationAction(selected.id, action, payload);
            setSelected(updated);
            setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, messages: c.messages } : c)));
        } catch (err: any) {
            setActionError(`${label ?? 'Action'} failed: ${errorMessage(err, 'Unknown error')}`);
        } finally {
            setActionBusy(null);
        }
    };

    const handleAssign = async (staffId: string | null) => {
        if (!selected || !selected.can_assign) return;
        setAssigningId(staffId ?? 'unassign');
        setActionError('');
        try {
            const updated = await assignConversationStaff(selected.id, staffId);
            setSelected(updated);
            setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, assigned_to: updated.assigned_to, status: updated.status } : c)));
            setAssignOpen(false);
        } catch (err: any) {
            setActionError(errorMessage(err, 'Could not assign conversation.'));
        } finally {
            setAssigningId(null);
        }
    };

    const handleAddNote = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selected || !noteBody.trim()) return;
        setNoteSaving(true);
        setNoteError('');
        try {
            const updated = await addConversationNote(selected.id, noteBody.trim());
            setSelected(updated);
            setNoteBody('');
        } catch (err: any) {
            setNoteError(errorMessage(err, 'Could not save note.'));
        } finally {
            setNoteSaving(false);
        }
    };

    const handleLinkProduct = async (product: LinkedProduct) => {
        if (!selected) return;
        setLinkingProduct(true);
        setActionError('');
        try {
            const updated = await linkProductToConversation(selected.id, product.id);
            setSelected(updated);
            setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, linked_product: updated.linked_product } : c)));
            setProductPanelOpen(false);
            setProductQuery('');
            setProductResults([]);
        } catch (err: any) {
            setActionError(errorMessage(err, 'Could not link product.'));
        } finally {
            setLinkingProduct(false);
        }
    };

    const handleLinkCustomer = async (customer: CustomerRecord) => {
        if (!selected) return;
        setLinkingCustomer(true);
        setActionError('');
        try {
            const updated = await linkCustomerToConversation(selected.id, customer.id);
            setSelected(updated);
            setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, linked_customer: updated.linked_customer } : c)));
            setCustomerPanelOpen(false);
            setCustomerQuery('');
            setCustomerResults([]);
        } catch (err: any) {
            setActionError(errorMessage(err, 'Could not link customer.'));
        } finally {
            setLinkingCustomer(false);
        }
    };

    const handleCopyLink = async (url?: string | null) => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
        }
    };

    const applyTemplate = (body: string) => {
        setReplyBody(body);
        setTemplateMenuOpen(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
            </div>
        );
    }

    const unreadCount = metrics?.unread ?? conversations.filter((c) => c.unread).length;
    const unansweredCount = metrics?.unanswered ?? 0;
    const unassignedCount = conversations.filter((c) => !c.assigned_to).length;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-[20px] font-semibold text-slate-900">Inbox &amp; Community</h1>
                        <p className="text-[13px] text-slate-500 max-w-2xl">
                            Manage messages, comments and mentions across your connected platforms. Respond to customers and turn conversations into sales.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-950 border border-blue-200 font-medium">
                                <Mail className="w-3 h-3" /> {unreadCount} unread
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                <MessageCircle className="w-3 h-3" /> {unansweredCount} unanswered
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                <UserCheck className="w-3 h-3" /> {unassignedCount} unassigned
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search conversations…"
                                className="w-56 sm:w-64 bg-white border border-slate-200 rounded pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </header>

                {loadError && (
                    <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center justify-between gap-2">
                        <span>{loadError}</span>
                        <button type="button" onClick={handleRefresh} className="text-[12px] font-medium text-rose-700 hover:underline">
                            Retry
                        </button>
                    </div>
                )}

                {metrics && (
                    <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        <MetricCard label="Total incoming" value={metrics.total_incoming} />
                        <MetricCard label="Unread" value={metrics.unread} tone="blue" />
                        <MetricCard label="Unanswered" value={metrics.unanswered} tone="amber" />
                        <MetricCard label="Resolved" value={metrics.resolved} tone="emerald" />
                        <MetricCard label="Avg. response" value={formatSeconds(metrics.avg_response_seconds)} />
                        <MetricCard label="YouTube" value={metrics.by_platform.youtube ?? 0} />
                        <MetricCard
                            label="Other platforms"
                            value={(metrics.by_platform.facebook ?? 0) + (metrics.by_platform.instagram ?? 0) + (metrics.by_platform.tiktok ?? 0)}
                        />
                    </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(280px,340px)_1fr] gap-3">
                    <aside className="bg-white border border-slate-200 rounded p-2 space-y-3 h-fit">
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-2 pb-1">Folders</p>
                            <nav className="space-y-0.5">
                                {FOLDER_META.filter((f) => availableFolders.includes(f.key)).map((f) => {
                                    const Icon = f.icon;
                                    const active = folder === f.key;
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => setFolder(f.key)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition ${active ? 'bg-blue-950 text-white font-medium' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            <span className="flex-1 text-left">{f.label}</span>
                                            {f.key === 'unread' && unreadCount > 0 && (
                                                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-blue-50 text-blue-950'}`}>
                                                    {unreadCount}
                                                </span>
                                            )}
                                            {f.key === 'unassigned' && unassignedCount > 0 && (
                                                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-amber-50 text-amber-700'}`}>
                                                    {unassignedCount}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-2 pb-1">Platforms</p>
                            <nav className="space-y-0.5">
                                <button
                                    type="button"
                                    onClick={() => setPlatformFilter('all')}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition ${platformFilter === 'all' ? 'bg-blue-950 text-white font-medium' : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    <span className="flex-1 text-left">All platforms</span>
                                </button>
                                {availablePlatforms.map((p) => {
                                    const Meta = PLATFORM_META[p];
                                    const Icon = Meta.icon;
                                    const active = platformFilter === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPlatformFilter(p)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition ${active ? 'bg-blue-950 text-white font-medium' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : Meta.color}`} />
                                            <span className="flex-1 text-left">{Meta.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {metrics && metrics.staff_workload.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-2 pb-1">Staff workload</p>
                                <ul className="space-y-1 px-2">
                                    {metrics.staff_workload.map((w) => (
                                        <li key={w.staff_id} className="flex items-center justify-between text-[11px] text-slate-600">
                                            <span className="truncate">{w.staff_name}</span>
                                            <span className="font-medium text-slate-800">{w.assigned_count}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </aside>

                    <section className="bg-white border border-slate-200 rounded overflow-hidden flex flex-col min-h-[400px] lg:max-h-[calc(100vh-260px)]">
                        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                            <p className="text-[12px] font-medium text-slate-700">
                                {filteredConversations.length} conversation{filteredConversations.length === 1 ? '' : 's'}
                            </p>
                            {refreshing && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                            {filteredConversations.length === 0 && (
                                <div className="p-6 text-center space-y-1">
                                    <Inbox className="w-6 h-6 text-slate-300 mx-auto" />
                                    <p className="text-[13px] text-slate-600">No conversations match your filters.</p>
                                    <p className="text-[11px] text-slate-400">Try a different folder, platform or search term.</p>
                                </div>
                            )}
                            {filteredConversations.map((c) => {
                                const active = selectedId === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setSelectedId(c.id)}
                                        className={`w-full text-left px-3 py-2.5 transition ${active ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="relative shrink-0">
                                                <Avatar name={c.customer_display_name} url={c.customer_avatar_url} />
                                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                                    <PlatformIcon platform={c.platform} size={10} />
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <div className="flex items-center gap-1">
                                                    <p className={`text-[12px] truncate ${c.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                                                        {c.customer_display_name}
                                                    </p>
                                                    {c.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                                                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{formatRelative(c.last_interaction_at)}</span>
                                                </div>
                                                {c.customer_username && (
                                                    <p className="text-[10px] text-slate-400 truncate">@{c.customer_username}</p>
                                                )}
                                                <p className="text-[11px] text-slate-600 line-clamp-2">{c.preview}</p>
                                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                                    <StatusPill status={c.status} />
                                                    {c.assigned_to ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                            <UserCheck className="w-3 h-3" /> {c.assigned_to.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-amber-600 font-medium">Unassigned</span>
                                                    )}
                                                    {c.linked_product && (
                                                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{c.linked_product.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="bg-white border border-slate-200 rounded flex flex-col min-h-[400px] lg:max-h-[calc(100vh-260px)]">
                        {!selectedId && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
                                <MessageSquare className="w-8 h-8 text-slate-300" />
                                <p className="text-[13px] text-slate-600">Select a conversation to view details and reply.</p>
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
                                    onClick={() => void loadConversation(selectedId)}
                                    className="text-[12px] font-medium text-blue-950 hover:underline"
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {selected && !detailLoading && (
                            <>
                                <div className="px-3 py-2.5 border-b border-slate-200 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <Avatar name={selected.customer_display_name} url={selected.customer_avatar_url} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-[13px] font-semibold text-slate-900 truncate">{selected.customer_display_name}</p>
                                                <PlatformIcon platform={selected.platform} size={13} />
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {selected.customer_username ? `@${selected.customer_username}` : PLATFORM_META[selected.platform].label}
                                                {' · '}
                                                <span className="capitalize">{selected.type}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {selected.can_assign && (
                                                <div className="relative" ref={assignRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAssignOpen((v) => !v)}
                                                        className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition"
                                                    >
                                                        <UserCheck className="w-3 h-3" />
                                                        {selected.assigned_to ? selected.assigned_to.name.split(' ')[0] : 'Assign'}
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                    {assignOpen && (
                                                        <div className="absolute right-0 z-20 mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg py-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAssign(null)}
                                                                disabled={assigningId !== null}
                                                                className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                            >
                                                                Unassign
                                                            </button>
                                                            <div className="border-t border-slate-100 my-1" />
                                                            <div className="max-h-60 overflow-y-auto">
                                                                {staffList.map((s) => (
                                                                    <button
                                                                        key={s.id}
                                                                        type="button"
                                                                        onClick={() => handleAssign(s.id)}
                                                                        disabled={assigningId !== null}
                                                                        className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                                    >
                                                                        {s.name}
                                                                    </button>
                                                                ))}
                                                                {staffList.length === 0 && (
                                                                    <p className="px-3 py-1.5 text-[11px] text-slate-400">No staff accounts available.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {selected.related_post_title && (
                                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-2">
                                            {selected.related_post_thumbnail ? (
                                                <img src={selected.related_post_thumbnail} alt="" className="w-10 h-10 rounded object-cover bg-slate-100" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center">
                                                    <MessageCircle className="w-4 h-4 text-slate-400" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] text-slate-500">Related {selected.platform === 'youtube' ? 'video' : 'post'}</p>
                                                <p className="text-[12px] font-medium text-slate-800 truncate">{selected.related_post_title}</p>
                                            </div>
                                            {selected.related_post_url && (
                                                <a
                                                    href={selected.related_post_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-950 hover:underline shrink-0"
                                                >
                                                    Open <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-1">
                                        <StatusPill status={selected.status} />
                                        {selected.can_react && (
                                            <button
                                                type="button"
                                                onClick={() => runAction('react', { reaction: 'like' }, 'Reaction')}
                                                disabled={actionBusy !== null}
                                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                            >
                                                {actionBusy === 'react' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Smile className="w-3 h-3" />}
                                                Like
                                            </button>
                                        )}
                                        {selected.can_hide && (
                                            <button
                                                type="button"
                                                onClick={() => runAction('hide', {}, 'Hide')}
                                                disabled={actionBusy !== null}
                                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                            >
                                                {actionBusy === 'hide' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                                Hide
                                            </button>
                                        )}
                                        {selected.can_moderate && (
                                            <button
                                                type="button"
                                                onClick={() => runAction('moderate', {}, 'Moderation')}
                                                disabled={actionBusy !== null}
                                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                            >
                                                {actionBusy === 'moderate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                                                Moderate
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => runAction('mark-unread', {}, 'Mark unread')}
                                            disabled={actionBusy !== null}
                                            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                        >
                                            {actionBusy === 'mark-unread' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                            Mark unread
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => runAction('resolve', {}, 'Resolve')}
                                            disabled={actionBusy !== null || selected.status === 'resolved'}
                                            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                        >
                                            {actionBusy === 'resolve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                            Resolve
                                        </button>
                                        {selected.can_archive && (
                                            <button
                                                type="button"
                                                onClick={() => runAction('archive', {}, 'Archive')}
                                                disabled={actionBusy !== null}
                                                className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition disabled:opacity-50"
                                            >
                                                {actionBusy === 'archive' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                                                Archive
                                            </button>
                                        )}
                                    </div>

                                    {actionError && (
                                        <div className="bg-rose-50 border border-rose-200 rounded px-2 py-1 text-[11px] text-rose-700">{actionError}</div>
                                    )}

                                    {currentCapability && !currentCapability.supports_reply && (
                                        <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-[11px] text-amber-700">
                                            Replying is not available for this interaction on {PLATFORM_META[selected.platform].label}.
                                            {currentCapability.note ? ` ${currentCapability.note}` : ''}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-slate-50/40">
                                    {selected.messages.length === 0 && (
                                        <p className="text-center text-[12px] text-slate-400 py-4">No message history available.</p>
                                    )}
                                    {selected.messages.map((m) => {
                                        if (m.direction === 'note') {
                                            return (
                                                <div key={m.id} className="border border-amber-200 bg-amber-50/60 rounded px-2.5 py-1.5">
                                                    <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">Internal note</p>
                                                    <p className="text-[12px] text-slate-800 whitespace-pre-wrap">{m.body}</p>
                                                    <p className="text-[10px] text-slate-400 pt-0.5">
                                                        {m.author_name ?? 'Staff'} · {formatRelative(m.created_at)}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        const outbound = m.direction === 'outbound';
                                        return (
                                            <div key={m.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                                                <div
                                                    className={`max-w-[85%] rounded px-2.5 py-1.5 text-[12px] whitespace-pre-wrap ${outbound ? 'bg-blue-950 text-white' : 'bg-white border border-slate-200 text-slate-800'
                                                        }`}
                                                >
                                                    <p>{m.body}</p>
                                                    <p className={`text-[10px] pt-1 ${outbound ? 'text-blue-200' : 'text-slate-400'}`}>
                                                        {outbound ? 'You' : selected.customer_display_name} · {formatRelative(m.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-t border-slate-200 px-3 py-2 space-y-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => { setProductPanelOpen((v) => !v); setCustomerPanelOpen(false); }}
                                            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition"
                                        >
                                            <MessageCircle className="w-3 h-3" /> Product
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setCustomerPanelOpen((v) => !v); setProductPanelOpen(false); }}
                                            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1 rounded text-[11px] transition"
                                        >
                                            <UserCheck className="w-3 h-3" /> Customer
                                        </button>
                                        {selected.linked_product && (
                                            <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700">
                                                {selected.linked_product.name}
                                                {selected.linked_product.in_stock ? (
                                                    <span className="text-emerald-600 font-medium">In stock</span>
                                                ) : (
                                                    <span className="text-rose-600 font-medium">Out of stock</span>
                                                )}
                                                {selected.linked_product.url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleCopyLink(selected.linked_product?.url)}
                                                        className="text-slate-500 hover:text-slate-800"
                                                        title="Copy link"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                        {selected.linked_customer && (
                                            <Link
                                                href={`/customers/${encodeURIComponent(selected.linked_customer.id)}`}
                                                className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                                            >
                                                <UserCheck className="w-3 h-3" /> {selected.linked_customer.name}
                                                <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        )}
                                    </div>

                                    {productPanelOpen && (
                                        <div className="border border-slate-200 rounded p-2 space-y-1.5 bg-white">
                                            <div className="flex items-center gap-1.5">
                                                <Search className="w-3.5 h-3.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={productQuery}
                                                    onChange={(e) => setProductQuery(e.target.value)}
                                                    placeholder="Search product catalogue…"
                                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                                />
                                                <button type="button" onClick={() => setProductPanelOpen(false)} className="text-slate-400 hover:text-slate-700">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {productError && <p className="text-[11px] text-rose-600">{productError}</p>}
                                            {productSearching && <p className="text-[11px] text-slate-400">Searching…</p>}
                                            {!productSearching && productQuery.trim() && productResults.length === 0 && !productError && (
                                                <p className="text-[11px] text-slate-400">No products found.</p>
                                            )}
                                            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                                                {productResults.map((p) => (
                                                    <li key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-[12px] font-medium text-slate-800 truncate">{p.name}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {formatMoney(p.price, p.currency)} · {p.in_stock ? 'In stock' : 'Out of stock'}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLinkProduct(p)}
                                                            disabled={linkingProduct}
                                                            className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-50"
                                                        >
                                                            {linkingProduct ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Link'}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {customerPanelOpen && (
                                        <div className="border border-slate-200 rounded p-2 space-y-1.5 bg-white">
                                            <div className="flex items-center gap-1.5">
                                                <Search className="w-3.5 h-3.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={customerQuery}
                                                    onChange={(e) => setCustomerQuery(e.target.value)}
                                                    placeholder="Search existing customers…"
                                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                                />
                                                <button type="button" onClick={() => setCustomerPanelOpen(false)} className="text-slate-400 hover:text-slate-700">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                Only link when you have verified the identity. Do not merge based on similar display names.
                                            </p>
                                            {customerError && <p className="text-[11px] text-rose-600">{customerError}</p>}
                                            {customerSearching && <p className="text-[11px] text-slate-400">Searching…</p>}
                                            {!customerSearching && customerQuery.trim() && customerResults.length === 0 && !customerError && (
                                                <p className="text-[11px] text-slate-400">No customers found.</p>
                                            )}
                                            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                                                {customerResults.map((c) => (
                                                    <li key={c.id} className="py-1.5 flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-[12px] font-medium text-slate-800 truncate">{c.name}</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{c.email}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLinkCustomer(c)}
                                                            disabled={linkingCustomer}
                                                            className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-50"
                                                        >
                                                            {linkingCustomer ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Link'}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {selected.linked_customer && (
                                        <div className="bg-white border border-slate-200 rounded p-2">
                                            <p className="text-[11px] font-semibold text-slate-700">Customer record</p>
                                            <p className="text-[12px] text-slate-800">{selected.linked_customer.name}</p>
                                            <p className="text-[11px] text-slate-500">{selected.linked_customer.email}</p>
                                            <p className="text-[11px] text-slate-500">
                                                Orders: {selected.linked_customer.orders_count ?? 0}
                                                {selected.linked_customer.total_spent != null && ` · Total: ${selected.linked_customer.total_spent}`}
                                            </p>
                                        </div>
                                    )}

                                    <form onSubmit={handleAddNote} className="flex items-start gap-1.5">
                                        <textarea
                                            value={noteBody}
                                            onChange={(e) => setNoteBody(e.target.value)}
                                            rows={1}
                                            placeholder="Add internal note (not visible to customer)…"
                                            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 resize-none"
                                        />
                                        <button
                                            type="submit"
                                            disabled={noteSaving || !noteBody.trim()}
                                            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded text-[11px] font-medium transition disabled:opacity-50"
                                        >
                                            {noteSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Note'}
                                        </button>
                                    </form>
                                    {noteError && <p className="text-[11px] text-rose-600">{noteError}</p>}

                                    {selected.can_reply ? (
                                        <form onSubmit={handleReply} className="space-y-1.5">
                                            {replyError && <p className="text-[11px] text-rose-600">{replyError}</p>}
                                            <div className="flex items-end gap-1.5">
                                                <textarea
                                                    value={replyBody}
                                                    onChange={(e) => setReplyBody(e.target.value)}
                                                    rows={2}
                                                    placeholder={`Reply via ${PLATFORM_META[selected.platform].label}…`}
                                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 resize-none"
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <div className="relative" ref={templateRef}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setTemplateMenuOpen((v) => !v)}
                                                            className="w-full inline-flex items-center justify-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded text-[11px] font-medium transition"
                                                        >
                                                            Templates
                                                        </button>
                                                        {templateMenuOpen && (
                                                            <div className="absolute right-0 bottom-full mb-1 z-20 w-56 bg-white border border-slate-200 rounded shadow-lg py-1 max-h-64 overflow-y-auto">
                                                                {templates.map((t) => (
                                                                    <button
                                                                        key={t.id}
                                                                        type="button"
                                                                        onClick={() => applyTemplate(t.body)}
                                                                        className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                                                                    >
                                                                        {t.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="submit"
                                                        disabled={replySending || !replyBody.trim()}
                                                        className="inline-flex items-center justify-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {replySending ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Send className="w-3.5 h-3.5" />
                                                        )}
                                                        Send
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400">
                                                Templates are editable before sending. Replies are only delivered through authorized platform APIs.
                                            </p>
                                        </form>
                                    ) : (
                                        <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" />
                                            Reply is not available for this interaction.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default function InboxCommunityPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Loading…</div>}>
            <InboxCommunityPageContent />
        </Suspense>
    );
}