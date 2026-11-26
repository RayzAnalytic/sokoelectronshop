'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import Link from 'next/link';
import {
    Package,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    ShoppingBag,
    Image as ImageIcon,
    Tag,
    Layers,
    Archive,
    ExternalLink,
    Settings,
    RotateCw,
    Send,
    Megaphone,
    Calendar,
    Users,
    DollarSign,
    MousePointerClick,
    TrendingUp,
    ChevronDown,
    ChevronRight,
    X,
    Plus,
    Play,
    Pause,
    Copy,
    Info,
    ShieldAlert,
    Link2,
    Store,
    BarChart3,
    FileText,
} from 'lucide-react';

type Tab = 'catalogue' | 'sync' | 'sharing' | 'campaigns';

type SyncStatus =
    | 'synced'
    | 'pending'
    | 'syncing'
    | 'failed'
    | 'not_eligible'
    | 'unavailable'
    | 'archived';

type ProductStatus = 'active' | 'draft' | 'archived';

type Product = {
    id: string;
    name: string;
    sku: string;
    imageUrl: string | null;
    price: number;
    salePrice: number | null;
    currency: string;
    category: string | null;
    variations: number;
    stock: number;
    productStatus: ProductStatus;
    productUrl: string;
    syncStatus: SyncStatus;
    metaItemId: string | null;
    lastSyncedAt: string | null;
    syncError: string | null;
};

type CatalogueInfo = {
    connected: boolean;
    catalogueId: string | null;
    catalogueName: string | null;
    lastSyncAt: string | null;
    syncEnabled: boolean;
    requiredAction: string | null;
};

type CampaignStatus =
    | 'draft'
    | 'scheduled'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled';

type Campaign = {
    id: string;
    name: string;
    objective: string;
    templateName: string;
    audienceLabel: string;
    productCount: number;
    discountCode: string | null;
    startAt: string | null;
    endAt: string | null;
    status: CampaignStatus;
    estimatedRecipients: number;
    metrics: {
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
    } | null;
};

const TABS: Array<{ key: Tab; label: string; icon: typeof Package }> = [
    { key: 'catalogue', label: 'Catalogue', icon: Package },
    { key: 'sync', label: 'Synchronization', icon: RefreshCw },
    { key: 'sharing', label: 'Product sharing', icon: Send },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
];

const SYNC_META: Record<
    SyncStatus,
    { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }
> = {
    synced: {
        label: 'Synced',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: CheckCircle2,
    },
    pending: {
        label: 'Pending',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: Clock,
    },
    syncing: {
        label: 'Syncing',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        icon: Loader2,
    },
    failed: {
        label: 'Failed',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: XCircle,
    },
    not_eligible: {
        label: 'Not eligible',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: AlertCircle,
    },
    unavailable: {
        label: 'Unavailable',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: AlertCircle,
    },
    archived: {
        label: 'Archived',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: Archive,
    },
};

const CAMPAIGN_META: Record<
    CampaignStatus,
    { label: string; bg: string; text: string; border: string }
> = {
    draft: {
        label: 'Draft',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
    },
    scheduled: {
        label: 'Scheduled',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
    },
    running: {
        label: 'Running',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
    },
    paused: {
        label: 'Paused',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
    },
    completed: {
        label: 'Completed',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
    },
    failed: {
        label: 'Failed',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
    },
    cancelled: {
        label: 'Cancelled',
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
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatCurrency(v: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(v);
}

function SyncPill({ status }: { status: SyncStatus }) {
    const m = SYNC_META[status];
    const Icon = m.icon;
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            <Icon
                className={`w-2.5 h-2.5 ${status === 'syncing' ? 'animate-spin' : ''}`}
            />
            {m.label}
        </span>
    );
}

function CampaignPill({ status }: { status: CampaignStatus }) {
    const m = CAMPAIGN_META[status];
    return (
        <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            {m.label}
        </span>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: typeof Package;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-2 mb-2">
            <div className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
                <p className="text-[11px] text-slate-500">{description}</p>
            </div>
            {action}
        </div>
    );
}

function CatalogueConnectionCard({
    catalogue,
    loading,
    onRefresh,
}: {
    catalogue: CatalogueInfo | null;
    loading: boolean;
    onRefresh: () => void;
}) {
    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded p-3 flex items-center gap-2 text-[12px] text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading catalogue connection…
            </div>
        );
    }
    if (!catalogue || !catalogue.connected) {
        return (
            <div className="bg-white border border-slate-200 rounded p-4">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[13px] font-semibold text-slate-900">
                            Meta commerce catalogue not connected
                        </h3>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            Connect a Meta commerce catalogue to the WhatsApp Business Account
                            to synchronise website products.
                        </p>
                        {catalogue?.requiredAction && (
                            <p className="text-[12px] text-amber-700 mt-1">
                                {catalogue.requiredAction}
                            </p>
                        )}
                        <Link
                            href="/whatsapp/analytics?tab=catalogue"
                            className="inline-flex items-center gap-1.5 mt-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Open catalogue settings
                        </Link>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-900 truncate">
                    {catalogue.catalogueName ?? 'Meta catalogue'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                    {catalogue.catalogueId}
                </p>
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 border-emerald-200 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Clock className="w-3 h-3" />
                Last sync {formatRelative(catalogue.lastSyncAt)}
            </span>
            {!catalogue.syncEnabled && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    Sync paused
                </span>
            )}
            <span className="flex-1" />
            <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50"
            >
                <RotateCw className="w-3 h-3" />
                Refresh
            </button>
            <Link
                href="/whatsapp/analytics?tab=catalogue"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-950 hover:bg-blue-900 text-white text-[11px] font-medium"
            >
                <Settings className="w-3 h-3" />
                Manage
            </Link>
        </div>
    );
}

function CatalogueTab({
    products,
    loading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    syncFilter,
    setSyncFilter,
    onSyncNow,
    syncingIds,
    catalogue,
    catalogueLoading,
    onRefreshCatalogue,
}: {
    products: Product[];
    loading: boolean;
    error: string;
    search: string;
    setSearch: (v: string) => void;
    statusFilter: 'all' | ProductStatus;
    setStatusFilter: (v: 'all' | ProductStatus) => void;
    syncFilter: 'all' | SyncStatus;
    setSyncFilter: (v: 'all' | SyncStatus) => void;
    onSyncNow: (id: string) => void;
    syncingIds: Set<string>;
    catalogue: CatalogueInfo | null;
    catalogueLoading: boolean;
    onRefreshCatalogue: () => void;
}) {
    return (
        <div className="space-y-2">
            <CatalogueConnectionCard
                catalogue={catalogue}
                loading={catalogueLoading}
                onRefresh={onRefreshCatalogue}
            />

            <SectionHeader
                icon={Package}
                title="Website Product Catalogue"
                description="The single source of truth. Products created here sync automatically to the Meta catalogue when eligible."
                action={
                    <Link
                        href="/products/new"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-950 text-white text-[11px] font-medium hover:bg-blue-900 transition"
                    >
                        <Plus className="w-3 h-3" />
                        New product
                    </Link>
                }
            />

            <div className="bg-white border border-slate-200 rounded">
                <div className="p-2 border-b border-slate-100 flex flex-wrap items-center gap-1.5">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search products by name or SKU…"
                            className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(e.target.value as 'all' | ProductStatus)
                        }
                        className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                    >
                        <option value="all">All status</option>
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                    </select>
                    <select
                        value={syncFilter}
                        onChange={(e) =>
                            setSyncFilter(e.target.value as 'all' | SyncStatus)
                        }
                        className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                    >
                        <option value="all">All sync</option>
                        <option value="synced">Synced</option>
                        <option value="pending">Pending</option>
                        <option value="syncing">Syncing</option>
                        <option value="failed">Failed</option>
                        <option value="not_eligible">Not eligible</option>
                        <option value="unavailable">Unavailable</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                {loading ? (
                    <div className="p-2 space-y-1.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-14 bg-slate-50 rounded animate-pulse"
                            />
                        ))}
                    </div>
                ) : error ? (
                    <div className="p-3 text-[12px] text-rose-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {error}
                    </div>
                ) : products.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-slate-500">
                        <Package className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                        No products match these filters.
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {products.map((p) => (
                            <li key={p.id} className="px-3 py-2">
                                <div className="flex items-start gap-2">
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                            <ImageIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <Link
                                                href={`/products/${encodeURIComponent(p.id)}`}
                                                className="text-[12px] font-medium text-slate-900 truncate hover:text-blue-950"
                                            >
                                                {p.name}
                                            </Link>
                                            <SyncPill status={p.syncStatus} />
                                            {p.productStatus !== 'active' && (
                                                <span className="text-[10px] text-slate-500 border border-slate-200 rounded px-1">
                                                    {p.productStatus}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
                                            <span className="font-mono">{p.sku}</span>
                                            <span>·</span>
                                            <span className="font-medium text-slate-700">
                                                {formatCurrency(
                                                    p.salePrice ?? p.price,
                                                    p.currency,
                                                )}
                                                {p.salePrice && (
                                                    <span className="text-slate-400 line-through ml-1">
                                                        {formatCurrency(p.price, p.currency)}
                                                    </span>
                                                )}
                                            </span>
                                            {p.category && (
                                                <>
                                                    <span>·</span>
                                                    <span>{p.category}</span>
                                                </>
                                            )}
                                            <span>·</span>
                                            <span>
                                                {p.stock > 0
                                                    ? `${p.stock} in stock`
                                                    : 'Out of stock'}
                                            </span>
                                            {p.variations > 0 && (
                                                <>
                                                    <span>·</span>
                                                    <span>{p.variations} variations</span>
                                                </>
                                            )}
                                            {p.lastSyncedAt && (
                                                <>
                                                    <span>·</span>
                                                    <span>
                                                        Synced {formatRelative(p.lastSyncedAt)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {p.syncError && (
                                            <p className="text-[10px] text-rose-600 mt-0.5 truncate">
                                                {p.syncError}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Link
                                            href={p.productUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 rounded text-slate-500 hover:bg-slate-100"
                                            title="View on website"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => onSyncNow(p.id)}
                                            disabled={
                                                syncingIds.has(p.id) ||
                                                p.syncStatus === 'syncing'
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            {syncingIds.has(p.id) ||
                                                p.syncStatus === 'syncing' ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <RotateCw className="w-3 h-3" />
                                            )}
                                            Sync
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 text-[11px] text-blue-800 flex items-start gap-1.5">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                    Products are managed in the main Product Catalogue. New or changed
                    products sync automatically; manual sync is for retrying failures or
                    forcing an update.
                </span>
            </div>
        </div>
    );
}

function SyncTab({
    products,
    loading,
    error,
    onSyncNow,
    syncingIds,
    catalogue,
    catalogueLoading,
    onRefreshCatalogue,
}: {
    products: Product[];
    loading: boolean;
    error: string;
    onSyncNow: (id: string) => void;
    syncingIds: Set<string>;
    catalogue: CatalogueInfo | null;
    catalogueLoading: boolean;
    onRefreshCatalogue: () => void;
}) {
    const attention = products.filter(
        (p) => p.syncStatus === 'failed' || p.syncStatus === 'pending',
    );
    const synced = products.filter((p) => p.syncStatus === 'synced');

    return (
        <div className="space-y-2">
            <CatalogueConnectionCard
                catalogue={catalogue}
                loading={catalogueLoading}
                onRefresh={onRefreshCatalogue}
            />

            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-slate-200 rounded px-2.5 py-2">
                    <p className="text-[10px] text-slate-500">Synced</p>
                    <p className="text-[16px] font-semibold text-emerald-600">
                        {synced.length}
                    </p>
                </div>
                <div className="bg-white border border-slate-200 rounded px-2.5 py-2">
                    <p className="text-[10px] text-slate-500">Requires attention</p>
                    <p
                        className={`text-[16px] font-semibold ${attention.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}
                    >
                        {attention.length}
                    </p>
                </div>
                <div className="bg-white border border-slate-200 rounded px-2.5 py-2">
                    <p className="text-[10px] text-slate-500">Total products</p>
                    <p className="text-[16px] font-semibold text-slate-900">
                        {products.length}
                    </p>
                </div>
            </div>

            <SectionHeader
                icon={RefreshCw}
                title="Synchronization status"
                description="Live view of which website products exist in the Meta catalogue."
            />

            {loading ? (
                <div className="space-y-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-14 bg-white border border-slate-200 rounded animate-pulse"
                        />
                    ))}
                </div>
            ) : error ? (
                <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-500">
                                <th className="text-left font-medium px-3 py-1.5">
                                    Product
                                </th>
                                <th className="text-left font-medium px-3 py-1.5">
                                    SKU
                                </th>
                                <th className="text-left font-medium px-3 py-1.5 hidden sm:table-cell">
                                    Meta ID
                                </th>
                                <th className="text-left font-medium px-3 py-1.5 hidden md:table-cell">
                                    Price
                                </th>
                                <th className="text-left font-medium px-3 py-1.5 hidden md:table-cell">
                                    Stock
                                </th>
                                <th className="text-left font-medium px-3 py-1.5 hidden lg:table-cell">
                                    Last sync
                                </th>
                                <th className="text-left font-medium px-3 py-1.5">
                                    Status
                                </th>
                                <th className="text-right font-medium px-3 py-1.5">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-3 py-6 text-center text-[12px] text-slate-500"
                                    >
                                        No products available.
                                    </td>
                                </tr>
                            ) : (
                                products.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-1.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {p.imageUrl ? (
                                                    <img
                                                        src={p.imageUrl}
                                                        alt={p.name}
                                                        className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-7 h-7 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                                        <ImageIcon className="w-3 h-3" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-[12px] text-slate-800 truncate max-w-[180px]">
                                                        {p.name}
                                                    </p>
                                                    {p.syncError && (
                                                        <p className="text-[10px] text-rose-600 truncate max-w-[180px]">
                                                            {p.syncError}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-slate-600 font-mono whitespace-nowrap">
                                            {p.sku}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-slate-600 font-mono whitespace-nowrap hidden sm:table-cell">
                                            {p.metaItemId ?? '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-slate-700 whitespace-nowrap hidden md:table-cell">
                                            {formatCurrency(
                                                p.salePrice ?? p.price,
                                                p.currency,
                                            )}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] whitespace-nowrap hidden md:table-cell">
                                            <span
                                                className={
                                                    p.stock > 0
                                                        ? 'text-slate-700'
                                                        : 'text-rose-600'
                                                }
                                            >
                                                {p.stock > 0 ? p.stock : 'Out'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-slate-600 whitespace-nowrap hidden lg:table-cell">
                                            {formatRelative(p.lastSyncedAt)}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <SyncPill status={p.syncStatus} />
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <Link
                                                    href={`/products/${encodeURIComponent(p.id)}`}
                                                    className="p-1 rounded text-slate-500 hover:bg-slate-100"
                                                    title="View product"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => onSyncNow(p.id)}
                                                    disabled={
                                                        syncingIds.has(p.id) ||
                                                        p.syncStatus === 'syncing'
                                                    }
                                                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded border border-slate-200 bg-white text-[10px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                >
                                                    {syncingIds.has(p.id) ||
                                                        p.syncStatus === 'syncing' ? (
                                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                    ) : (
                                                        <RotateCw className="w-2.5 h-2.5" />
                                                    )}
                                                    Retry
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 text-[11px] text-blue-800 flex items-start gap-1.5">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                    Sync results come from Meta. A product is marked synced only after Meta
                    confirms receipt of the corresponding catalogue item.
                </span>
            </div>
        </div>
    );
}

function SharingTab({
    products,
    loading,
}: {
    products: Product[];
    loading: boolean;
}) {
    const [search, setSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [shareMode, setShareMode] = useState<'native' | 'link'>('native');
    const [sharing, setSharing] = useState(false);
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return products.filter((p) => p.productStatus === 'active').slice(0, 20);
        return products
            .filter(
                (p) =>
                    p.productStatus === 'active' &&
                    (p.name.toLowerCase().includes(q) ||
                        p.sku.toLowerCase().includes(q)),
            )
            .slice(0, 20);
    }, [products, search]);

    const handleShare = async () => {
        if (!selectedProduct) return;
        setSharing(true);
        setShareError('');
        setShareSuccess('');
        try {
            const res = await fetch('/api/whatsapp/products/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: selectedProduct.id,
                    mode: shareMode,
                }),
            });
            if (!res.ok) throw new Error('share failed');
            setShareSuccess(
                shareMode === 'native'
                    ? 'Product prepared for the Inbox. Pick a customer to send.'
                    : 'Product link prepared for the Inbox. Pick a customer to send.',
            );
        } catch {
            setShareError('Could not prepare product for sharing.');
        } finally {
            setSharing(false);
        }
    };

    return (
        <div className="space-y-2">
            <SectionHeader
                icon={Send}
                title="Share products through WhatsApp"
                description="Select a website product and prepare it for a WhatsApp message."
            />

            <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search products by name or SKU…"
                        className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                    />
                </div>
                {loading ? (
                    <div className="space-y-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-12 bg-slate-50 rounded animate-pulse"
                            />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-6 text-center text-[12px] text-slate-500">
                        <Package className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                        No products available to share.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {filtered.map((p) => {
                            const active = selectedProduct?.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelectedProduct(p)}
                                    className={`flex items-start gap-2 p-2 rounded border text-left transition ${active ? 'border-blue-950 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                            <ImageIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-medium text-slate-900 truncate">
                                            {p.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate">
                                            {p.sku} ·{' '}
                                            {formatCurrency(p.salePrice ?? p.price, p.currency)}
                                        </p>
                                        <p
                                            className={`text-[10px] ${p.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                                        >
                                            {p.stock > 0
                                                ? `${p.stock} in stock`
                                                : 'Out of stock'}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedProduct && (
                <div className="bg-white border border-slate-200 rounded">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-slate-900">
                            Share preview
                        </p>
                        <button
                            type="button"
                            onClick={() => setSelectedProduct(null)}
                            className="text-slate-500 hover:text-slate-900"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="p-3 space-y-2">
                        <div className="flex items-start gap-2">
                            {selectedProduct.imageUrl ? (
                                <img
                                    src={selectedProduct.imageUrl}
                                    alt={selectedProduct.name}
                                    className="w-14 h-14 rounded object-cover border border-slate-200 shrink-0"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                    <ImageIcon className="w-5 h-5" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-slate-900 truncate">
                                    {selectedProduct.name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {selectedProduct.sku} ·{' '}
                                    {formatCurrency(
                                        selectedProduct.salePrice ?? selectedProduct.price,
                                        selectedProduct.currency,
                                    )}
                                </p>
                                <p
                                    className={`text-[11px] ${selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                                >
                                    {selectedProduct.stock > 0
                                        ? `${selectedProduct.stock} in stock`
                                        : 'Out of stock'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] font-medium text-slate-700 mb-1">
                                Share as
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setShareMode('native')}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] transition ${shareMode === 'native' ? 'border-blue-950 bg-blue-50/60 text-blue-950 font-medium' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    Native product message
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShareMode('link')}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] transition ${shareMode === 'link' ? 'border-blue-950 bg-blue-50/60 text-blue-950 font-medium' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                    Website product link
                                </button>
                            </div>
                            {shareMode === 'native' && !selectedProduct.metaItemId && (
                                <p className="text-[10px] text-amber-700 mt-1">
                                    Native product messaging requires the product to be synced
                                    to the Meta catalogue.
                                </p>
                            )}
                        </div>

                        {shareError && (
                            <div className="bg-rose-50 border border-rose-200 rounded px-2 py-1.5 text-[11px] text-rose-700 flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {shareError}
                            </div>
                        )}
                        {shareSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 text-[11px] text-emerald-700 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                {shareSuccess}
                                <Link
                                    href="/whatsapp/inbox"
                                    className="ml-auto font-medium underline"
                                >
                                    Open Inbox
                                </Link>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleShare}
                            disabled={
                                sharing ||
                                (shareMode === 'native' && !selectedProduct.metaItemId)
                            }
                            className="inline-flex items-center justify-center gap-1.5 w-full bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sharing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                            Prepare in Inbox
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 text-[11px] text-blue-800 flex items-start gap-1.5">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                    Orders placed after sharing continue through the existing website
                    checkout, Payments, Inventory and Delivery systems.
                </span>
            </div>
        </div>
    );
}

function CampaignsTab({
    campaigns,
    loading,
    error,
    onRefresh,
}: {
    campaigns: Campaign[];
    loading: boolean;
    error: string;
    onRefresh: () => void;
}) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="space-y-2">
            <SectionHeader
                icon={Megaphone}
                title="Campaigns & promotions"
                description="Run approved, consent-aware WhatsApp campaigns through existing templates."
                action={
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50"
                        >
                            <RotateCw className="w-3 h-3" />
                            Refresh
                        </button>
                        <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-950 text-white text-[11px] font-medium opacity-60 cursor-not-allowed"
                            title="Campaign creation is handled via Analytics & Settings"
                        >
                            <Plus className="w-3 h-3" />
                            New campaign
                        </button>
                    </div>
                }
            />

            <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                    Campaigns are limited to customers with verified marketing consent.
                    Opted-out customers are always excluded.
                </span>
            </div>

            {loading ? (
                <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-20 bg-white border border-slate-200 rounded animate-pulse"
                        />
                    ))}
                </div>
            ) : error ? (
                <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                </div>
            ) : campaigns.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                    <Megaphone className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                    No campaigns yet.
                </div>
            ) : (
                <div className="space-y-1.5">
                    {campaigns.map((c) => {
                        const isOpen = expanded === c.id;
                        return (
                            <div
                                key={c.id}
                                className="bg-white border border-slate-200 rounded"
                            >
                                <button
                                    type="button"
                                    onClick={() => setExpanded(isOpen ? null : c.id)}
                                    className="w-full text-left px-3 py-2"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-medium text-slate-900 truncate">
                                            {c.name}
                                        </p>
                                        <CampaignPill status={c.status} />
                                        <span className="flex-1" />
                                        {c.startAt && (
                                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(c.startAt)}
                                                {c.endAt && ` – ${formatDate(c.endAt)}`}
                                            </span>
                                        )}
                                        {isOpen ? (
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {c.objective}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
                                        <span className="inline-flex items-center gap-1">
                                            <FileText className="w-2.5 h-2.5" />
                                            {c.templateName}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Users className="w-2.5 h-2.5" />
                                            {c.audienceLabel} · {c.estimatedRecipients} est.
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Package className="w-2.5 h-2.5" />
                                            {c.productCount} products
                                        </span>
                                        {c.discountCode && (
                                            <span className="inline-flex items-center gap-1">
                                                <Tag className="w-2.5 h-2.5" />
                                                {c.discountCode}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-slate-100 px-3 py-2 space-y-2">
                                        {c.metrics ? (
                                            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
                                                <MetricCell
                                                    icon={Send}
                                                    label="Submitted"
                                                    value={c.metrics.submitted}
                                                />
                                                <MetricCell
                                                    icon={CheckCircle2}
                                                    label="Delivered"
                                                    value={c.metrics.delivered}
                                                />
                                                <MetricCell
                                                    icon={Eye}
                                                    label="Read"
                                                    value={c.metrics.read}
                                                />
                                                <MetricCell
                                                    icon={XCircle}
                                                    label="Failed"
                                                    value={c.metrics.failed}
                                                    danger={c.metrics.failed > 0}
                                                />
                                                <MetricCell
                                                    icon={MousePointerClick}
                                                    label="Clicks"
                                                    value={c.metrics.clicks}
                                                />
                                                <MetricCell
                                                    icon={BarChart3}
                                                    label="Visits"
                                                    value={c.metrics.visits}
                                                />
                                                <MetricCell
                                                    icon={ShoppingBag}
                                                    label="Orders"
                                                    value={c.metrics.orders}
                                                />
                                                <MetricCell
                                                    icon={DollarSign}
                                                    label="Revenue"
                                                    value={formatCurrency(
                                                        c.metrics.revenue,
                                                        c.metrics.currency,
                                                    )}
                                                />
                                                <MetricCell
                                                    icon={TrendingUp}
                                                    label="Cost"
                                                    value={formatCurrency(
                                                        c.metrics.cost,
                                                        c.metrics.currency,
                                                    )}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-slate-500">
                                                No performance data yet.
                                            </p>
                                        )}

                                        <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-[10px] text-blue-800 flex items-start gap-1">
                                            <Info className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                                            Platform metrics (delivered, read) are
                                            reported by Meta. Website metrics
                                            (clicks, visits, orders, revenue) require
                                            verified tracking.
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Eye({ className }: { className?: string }) {
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function MetricCell({
    icon: Icon,
    label,
    value,
    danger,
}: {
    icon: typeof Send;
    label: string;
    value: number | string;
    danger?: boolean;
}) {
    return (
        <div className="bg-slate-50 rounded px-2 py-1.5">
            <div className="flex items-center gap-1 text-slate-500">
                <Icon className="w-2.5 h-2.5" />
                <span className="text-[9px] uppercase tracking-wide">{label}</span>
            </div>
            <p
                className={`text-[12px] font-semibold mt-0.5 ${danger ? 'text-rose-600' : 'text-slate-900'}`}
            >
                {value}
            </p>
        </div>
    );
}

function WhatsAppCommercePage() {
    const [tab, setTab] = useState<Tab>('catalogue');

    const [catalogue, setCatalogue] = useState<CatalogueInfo | null>(null);
    const [catalogueLoading, setCatalogueLoading] = useState(true);

    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [productsError, setProductsError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');
    const [syncFilter, setSyncFilter] = useState<'all' | SyncStatus>('all');
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [campaignsError, setCampaignsError] = useState('');

    const loadCatalogue = useCallback(async () => {
        setCatalogueLoading(true);
        try {
            const res = await fetch('/api/whatsapp/commerce/catalogue', {
                cache: 'no-store',
            });
            if (!res.ok) throw new Error('failed');
            setCatalogue((await res.json()) as CatalogueInfo);
        } catch {
            setCatalogue(null);
        } finally {
            setCatalogueLoading(false);
        }
    }, []);

    const loadProducts = useCallback(async () => {
        setProductsLoading(true);
        setProductsError('');
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('q', search.trim());
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (syncFilter !== 'all') params.set('sync', syncFilter);
            const res = await fetch(
                `/api/whatsapp/commerce/products?${params.toString()}`,
                { cache: 'no-store' },
            );
            if (!res.ok) throw new Error('failed');
            setProducts((await res.json()) as Product[]);
        } catch {
            setProductsError('Could not load products.');
        } finally {
            setProductsLoading(false);
        }
    }, [search, statusFilter, syncFilter]);

    const loadCampaigns = useCallback(async () => {
        setCampaignsLoading(true);
        setCampaignsError('');
        try {
            const res = await fetch('/api/whatsapp/campaigns', {
                cache: 'no-store',
            });
            if (!res.ok) throw new Error('failed');
            setCampaigns((await res.json()) as Campaign[]);
        } catch {
            setCampaignsError('Could not load campaigns.');
        } finally {
            setCampaignsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCatalogue();
    }, [loadCatalogue]);

    useEffect(() => {
        const t = setTimeout(() => loadProducts(), 250);
        return () => clearTimeout(t);
    }, [loadProducts]);

    useEffect(() => {
        if (tab === 'campaigns') loadCampaigns();
    }, [tab, loadCampaigns]);

    const handleSyncNow = async (id: string) => {
        setSyncingIds((prev) => new Set(prev).add(id));
        try {
            const res = await fetch(`/api/whatsapp/commerce/products/${id}/sync`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('sync failed');
            await loadProducts();
        } catch {
        } finally {
            setSyncingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleRefresh = () => {
        if (tab === 'campaigns') {
            loadCampaigns();
        } else {
            loadCatalogue();
            loadProducts();
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="px-3 sm:px-4 lg:px-5 py-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-semibold text-slate-900">
                            Commerce & Campaigns
                        </h1>
                        <p className="text-[12px] text-slate-500">
                            Sync the website catalogue to WhatsApp and run compliant
                            campaigns.
                        </p>
                    </div>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        Refresh
                    </button>
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

                {tab === 'catalogue' && (
                    <CatalogueTab
                        products={products}
                        loading={productsLoading}
                        error={productsError}
                        search={search}
                        setSearch={setSearch}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        syncFilter={syncFilter}
                        setSyncFilter={setSyncFilter}
                        onSyncNow={handleSyncNow}
                        syncingIds={syncingIds}
                        catalogue={catalogue}
                        catalogueLoading={catalogueLoading}
                        onRefreshCatalogue={loadCatalogue}
                    />
                )}

                {tab === 'sync' && (
                    <SyncTab
                        products={products}
                        loading={productsLoading}
                        error={productsError}
                        onSyncNow={handleSyncNow}
                        syncingIds={syncingIds}
                        catalogue={catalogue}
                        catalogueLoading={catalogueLoading}
                        onRefreshCatalogue={loadCatalogue}
                    />
                )}

                {tab === 'sharing' && (
                    <SharingTab products={products} loading={productsLoading} />
                )}

                {tab === 'campaigns' && (
                    <CampaignsTab
                        campaigns={campaigns}
                        loading={campaignsLoading}
                        error={campaignsError}
                        onRefresh={loadCampaigns}
                    />
                )}
            </div>
        </div>
    );
}

export default WhatsAppCommercePage;