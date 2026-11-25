'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Banknote,
    Boxes,
    CheckCircle2,
    ChevronRight,
    Clock,
    Download,
    Layers,
    Loader2,
    Package,
    Plus,
    RefreshCw,
    Search,
    ShoppingBag,
    Sparkles,
    Trash2,
    TrendingUp,
    Truck,
    X,
} from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import type {
    AdminDirectOrder,
    AdminDirectOrderStatus,
    AdminDirectProduct,
    AdminDirectProductStatus,
    AdminDirectReturnRequest,
    AdminDirectProductWrite,
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
        return new Date(ts).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return iso;
    }
};

const sourceLabel = (s: string | null | undefined): string => {
    if (s === 'whatsapp') return 'WhatsApp';
    if (s === 'phone') return 'Phone';
    if (s === 'admin') return 'Admin';
    if (s === 'live') return 'TikTok LIVE';
    if (s === 'video_dm') return 'Video DM';
    if (s === 'bio_link') return 'Bio Link';
    if (s === 'tiktok_dm') return 'TikTok DM';
    if (s === 'tiktok_comment') return 'TikTok Comment';
    if (s === 'instagram_dm') return 'Instagram DM';
    if (s === 'email') return 'Email';
    return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
};

const ORDER_STATUSES: AdminDirectOrderStatus[] = [
    'New',
    'Awaiting Payment',
    'Paid',
    'Awaiting Shipment',
    'Shipped',
    'Delivered',
    'Cancelled',
    'Returned',
];

const PRODUCT_STATUS_FILTERS = ['All', 'Active', 'Draft', 'Out of stock', 'Low stock'] as const;
const STOCK_BUCKETS = ['All', 'In stock', 'Low stock', 'Out of stock'] as const;

const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'create', label: 'New order' },
    { id: 'products', label: 'Catalogue' },
    { id: 'categories', label: 'Categories' },
    { id: 'variations', label: 'Variations' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'sync', label: 'TikTok sync' },
    { id: 'payments', label: 'Payments' },
    { id: 'fulfillment', label: 'Fulfillment' },
    { id: 'returns', label: 'Returns' },
    { id: 'settings', label: 'Settings' },
];

interface CategoryRef {
    id: number;
    name: string;
    slug?: string;
}

interface BrandRef {
    id: number;
    name: string;
}

interface NormalizedProduct {
    id: number | string;
    name: string;
    sku: string;
    image: string;
    price: string;
    compareAtPrice: string | null;
    stockQuantity: number;
    lowStockThreshold: number;
    category: string;
    categoryId: number | undefined;
    brand: string;
    brandId: number | undefined;
    isActive: boolean;
    salesCount: number;
    revenue: string;
    status: AdminDirectProductStatus;
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

function Thumb({ src, className, fallback }: { src?: string; className?: string; fallback?: React.ReactNode }) {
    if (!src) {
        return (
            <span className={cn('flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 rounded shrink-0', className)}>
                {fallback || <Package className="w-3.5 h-3.5" />}
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

function QuickAction({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="w-full text-left border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 p-2 flex items-center gap-2 transition-colors group">
            <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-blue-950 group-hover:text-white transition-colors">{icon}</span>
            <span className="text-[13px] font-medium text-slate-800 flex-1 truncate">{title}</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
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

export default function OrdersProductsFulfillment() {
    const [section, setSection] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: number; msg: string; variant: 'success' | 'error' } | null>(null);

    const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
    const [products, setProducts] = useState<NormalizedProduct[]>([]);
    const [categories, setCategories] = useState<CategoryRef[]>([]);
    const [brands, setBrands] = useState<BrandRef[]>([]);
    const [returns, setReturns] = useState<AdminDirectReturnRequest[]>([]);

    const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | AdminDirectOrderStatus>('All');
    const [orderSearch, setOrderSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [productStatusFilter, setProductStatusFilter] = useState<(typeof PRODUCT_STATUS_FILTERS)[number]>('All');
    const [productStockFilter, setProductStockFilter] = useState<(typeof STOCK_BUCKETS)[number]>('All');
    const [selectedOrder, setSelectedOrder] = useState<AdminDirectOrder | null>(null);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [showAddCategory, setShowAddCategory] = useState(false);

    const showToast = useCallback((msg: string, variant: 'success' | 'error' = 'success') => {
        setToast({ id: Date.now(), msg, variant });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const results = await Promise.allSettled([
            adminApi.directOrders.orders.list(),
            adminApi.products.list(),
            adminApi.categories.refs(),
            adminApi.brands.refs(),
            adminApi.directOrders.returns.list(),
        ]);

        if (results[0].status === 'fulfilled') setOrders(results[0].value || []);
        if (results[1].status === 'fulfilled') {
            setProducts(
                (results[1].value || []).map((p) => ({
                    id: p.id,
                    name: p.name,
                    sku: p.slug || '',
                    image: p.images?.[0]?.url || '',
                    price: p.price,
                    compareAtPrice: p.compare_at_price,
                    stockQuantity: p.stock_quantity ?? 0,
                    lowStockThreshold: p.low_stock_threshold ?? 5,
                    category: p.category?.name || '',
                    categoryId: p.category?.id,
                    brand: p.brand?.name || '',
                    brandId: p.brand?.id,
                    isActive: p.is_active,
                    salesCount: p.sales_count ?? 0,
                    revenue: p.sales_volume ?? '0',
                    status: p.is_active ? 'Active' : 'Draft',
                })),
            );
        }
        if (results[2].status === 'fulfilled') setCategories(results[2].value || []);
        if (results[3].status === 'fulfilled') setBrands(results[3].value || []);
        if (results[4].status === 'fulfilled') setReturns(results[4].value || []);

        if (results.every((r) => r.status === 'rejected')) {
            const first = results[0] as PromiseRejectedResult;
            setError(first.reason instanceof Error ? first.reason.message : 'Failed to load data');
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    const filteredOrders = useMemo(() => {
        let list = orders;
        if (orderStatusFilter !== 'All') list = list.filter((o) => o.status === orderStatusFilter);
        const q = orderSearch.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (o) =>
                    String(o.reference || '').toLowerCase().includes(q) ||
                    String(o.customerName || '').toLowerCase().includes(q) ||
                    String(o.customerPhone || '').toLowerCase().includes(q),
            );
        }
        return list;
    }, [orders, orderStatusFilter, orderSearch]);

    const filteredProducts = useMemo(() => {
        let list = products;
        const q = productSearch.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (p) =>
                    String(p.name || '').toLowerCase().includes(q) ||
                    String(p.sku || '').toLowerCase().includes(q) ||
                    String(p.brand || '').toLowerCase().includes(q) ||
                    String(p.category || '').toLowerCase().includes(q),
            );
        }
        if (productStatusFilter === 'Active') list = list.filter((p) => p.isActive);
        else if (productStatusFilter === 'Draft') list = list.filter((p) => !p.isActive);
        else if (productStatusFilter === 'Out of stock') list = list.filter((p) => p.stockQuantity === 0);
        else if (productStatusFilter === 'Low stock')
            list = list.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold);

        if (productStockFilter === 'In stock') list = list.filter((p) => p.stockQuantity > p.lowStockThreshold);
        else if (productStockFilter === 'Low stock')
            list = list.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold);
        else if (productStockFilter === 'Out of stock') list = list.filter((p) => p.stockQuantity === 0);

        return list;
    }, [products, productSearch, productStatusFilter, productStockFilter]);

    const stats = useMemo(() => {
        const revenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
        const aov = orders.length ? revenue / orders.length : 0;
        const byStatus: Record<string, number> = {};
        ORDER_STATUSES.forEach((s) => {
            byStatus[s] = 0;
        });
        orders.forEach((o) => {
            if (byStatus[o.status] !== undefined) byStatus[o.status] += 1;
        });
        const totalStock = products.reduce((a, p) => a + p.stockQuantity, 0);
        const stockValue = products.reduce((a, p) => a + p.stockQuantity * Number(p.price || 0), 0);
        const lowStock = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold).length;
        const outOfStock = products.filter((p) => p.stockQuantity === 0).length;
        return { revenue, aov, byStatus, totalStock, stockValue, lowStock, outOfStock };
    }, [orders, products]);

    const handleAdvanceOrder = async (order: AdminDirectOrder, next: AdminDirectOrderStatus) => {
        try {
            const updated = await adminApi.directOrders.orders.advance(order.reference, { status: next });
            setOrders((prev) => prev.map((o) => (o.reference === order.reference ? updated : o)));
            if (selectedOrder?.reference === order.reference) {
                setSelectedOrder(updated);
            }
            showToast(`Order ${order.reference} moved to ${next}`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to update order', 'error');
        }
    };

    const handleDeleteProduct = async (product: NormalizedProduct) => {
        try {
            await adminApi.products.remove(String(product.id));
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
            showToast(`${product.name} removed`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to remove product', 'error');
        }
    };

    const handleCreateProduct = async (payload: AdminDirectProductWrite) => {
        try {
            const created = await adminApi.products.create({
                name: payload.name,
                description: payload.description || '',
                brand_id: payload.brandId ?? 0,
                category_id: payload.categoryId ?? 0,
                price: Number(payload.price) || 0,
                compare_at_price: payload.compareAtPrice ? Number(payload.compareAtPrice) : null,
                stock_quantity: Number(payload.stockQuantity) || 0,
                low_stock_threshold: Number(payload.lowStockThreshold) || 5,
                is_active: payload.status === 'Active',
                images: payload.image ? [{ url: payload.image, is_primary: true, sort_order: 0 }] : [],
            });
            setProducts((prev) => [
                {
                    id: created.id,
                    name: created.name,
                    sku: created.slug || '',
                    image: created.images?.[0]?.url || '',
                    price: created.price,
                    compareAtPrice: created.compare_at_price,
                    stockQuantity: created.stock_quantity ?? 0,
                    lowStockThreshold: created.low_stock_threshold ?? 5,
                    category: created.category?.name || '',
                    categoryId: created.category?.id,
                    brand: created.brand?.name || '',
                    brandId: created.brand?.id,
                    isActive: created.is_active,
                    salesCount: created.sales_count ?? 0,
                    revenue: created.sales_volume ?? '0',
                    status: created.is_active ? 'Active' : 'Draft',
                },
                ...prev,
            ]);
            setShowAddProduct(false);
            showToast(`${created.name} added`);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create product', 'error');
        }
    };

    const handleExportOrders = () => {
        const rows: Array<Array<string | number>> = [
            ['Reference', 'Date', 'Customer', 'Total', 'Status', 'Source'],
            ...filteredOrders.map((o) => [o.reference, o.createdAt, o.customerName, o.total, o.status, o.source]),
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Orders exported');
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
                            <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                            Orders, Products &amp; Fulfillment
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Manage orders, catalogue, stock, payments, and fulfilment.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button onClick={() => void load(true)} disabled={refreshing || loading} className={btnSecondary}>
                            <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button onClick={handleExportOrders} className={btnSecondary}>
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => setSection('create')} className={btnPrimary}>
                            <Plus className="w-3 h-3" /> New order
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
                        <button onClick={() => void load(true)} className="text-[13px] font-medium text-slate-900 hover:underline shrink-0">
                            Retry
                        </button>
                    </div>
                </Card>
            )}

            {loading ? (
                <Card>
                    <div className="p-4 flex items-center gap-2 text-[13px] text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                </Card>
            ) : (
                <>
                    {section === 'overview' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                <Kpi icon={<ShoppingBag className="w-3.5 h-3.5" />} label="Total orders" value={NUM(orders.length)} />
                                <Kpi icon={<Banknote className="w-3.5 h-3.5" />} label="Revenue" value={KES(stats.revenue)} />
                                <Kpi icon={<TrendingUp className="w-3.5 h-3.5" />} label="Avg. order value" value={KES(stats.aov)} />
                                <Kpi icon={<Package className="w-3.5 h-3.5" />} label="Products" value={NUM(products.length)} />
                            </div>

                            <Card>
                                <CardHeader title="Order status" subtitle="Counts by status across all orders" />
                                <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {ORDER_STATUSES.map((s) => (
                                        <div key={s} className="bg-slate-50 border border-slate-200 rounded p-2">
                                            <p className="text-[13px] text-slate-500 truncate">{s}</p>
                                            <p className="text-[15px] font-bold text-slate-900 tabular-nums">
                                                {NUM(stats.byStatus[s] || 0)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                <Card>
                                    <CardHeader title="Stock position" subtitle="Current inventory snapshot" />
                                    <div className="p-2 grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                            <p className="text-[13px] text-slate-500">Total units</p>
                                            <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(stats.totalStock)}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                            <p className="text-[13px] text-slate-500">Stock value</p>
                                            <p className="text-[15px] font-bold text-slate-900 tabular-nums">{KES(stats.stockValue)}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                            <p className="text-[13px] text-slate-500">Low stock</p>
                                            <p className="text-[15px] font-bold text-amber-700 tabular-nums">{NUM(stats.lowStock)}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                            <p className="text-[13px] text-slate-500">Out of stock</p>
                                            <p className="text-[15px] font-bold text-red-600 tabular-nums">{NUM(stats.outOfStock)}</p>
                                        </div>
                                    </div>
                                </Card>

                                <Card>
                                    <CardHeader title="Quick actions" />
                                    <div className="p-2 grid grid-cols-2 gap-2">
                                        <QuickAction icon={<Plus className="w-3.5 h-3.5" />} title="New order" onClick={() => setSection('create')} />
                                        <QuickAction
                                            icon={<Package className="w-3.5 h-3.5" />}
                                            title="Add product"
                                            onClick={() => {
                                                setSection('products');
                                                setShowAddProduct(true);
                                            }}
                                        />
                                        <QuickAction icon={<Boxes className="w-3.5 h-3.5" />} title="Inventory" onClick={() => setSection('inventory')} />
                                        <QuickAction icon={<Truck className="w-3.5 h-3.5" />} title="Fulfillment" onClick={() => setSection('fulfillment')} />
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {section === 'orders' && (
                        <Card>
                            <CardHeader
                                title="All orders"
                                subtitle={`${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`}
                                action={
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                            <input
                                                value={orderSearch}
                                                onChange={(e) => setOrderSearch(e.target.value)}
                                                placeholder="Search orders…"
                                                className={cn(inputCls, 'w-48 pl-7')}
                                            />
                                        </div>
                                        <button onClick={() => setSection('create')} className={btnPrimary}>
                                            <Plus className="w-3 h-3" /> New
                                        </button>
                                    </div>
                                }
                            />
                            <div className="px-2 py-1 flex items-center gap-0.5 overflow-x-auto border-b border-slate-200">
                                {(['All', ...ORDER_STATUSES] as const).map((s) => {
                                    const count = s === 'All' ? orders.length : orders.filter((o) => o.status === s).length;
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setOrderStatusFilter(s)}
                                            className={cn(
                                                'inline-flex items-center gap-1 px-2 py-1 text-[13px] font-medium whitespace-nowrap rounded transition-colors',
                                                orderStatusFilter === s ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100',
                                            )}
                                        >
                                            {s}
                                            <span
                                                className={cn(
                                                    'inline-block px-1 py-0.5 text-[13px] font-semibold tabular-nums rounded',
                                                    orderStatusFilter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                                                )}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Reference</th>
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium">Items</th>
                                            <th className="py-2 px-2 font-medium text-right">Total</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium">Source</th>
                                            <th className="py-2 px-2 font-medium">Date</th>
                                            <th className="py-2 px-2 w-24" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No orders match your filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredOrders.map((o) => {
                                                const firstItem = o.items?.[0];
                                                return (
                                                    <tr
                                                        key={o.reference}
                                                        className="hover:bg-slate-50 cursor-pointer"
                                                        onClick={() => setSelectedOrder(o)}
                                                    >
                                                        <td className="py-2 px-2 font-mono font-medium text-slate-900">{o.reference}</td>
                                                        <td className="py-2 px-2 text-slate-700 truncate max-w-[160px]">{o.customerName}</td>
                                                        <td className="py-2 px-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Thumb src={firstItem?.image} className="w-7 h-7" />
                                                                <span className="text-slate-600 truncate max-w-[200px]">
                                                                    {firstItem?.productName || '—'}
                                                                    {(o.items?.length ?? 0) > 1 && ` +${(o.items?.length ?? 0) - 1}`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">{KES(o.total)}</td>
                                                        <td className="py-2 px-2">
                                                            <StatusBadge
                                                                label={o.status}
                                                                variant={
                                                                    o.status === 'Delivered'
                                                                        ? 'success'
                                                                        : o.status === 'Cancelled' || o.status === 'Returned'
                                                                            ? 'danger'
                                                                            : o.status === 'Paid' || o.status === 'Shipped'
                                                                                ? 'info'
                                                                                : 'warning'
                                                                }
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2 text-slate-600">{sourceLabel(o.source)}</td>
                                                        <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                                                        <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {o.status === 'Paid' && (
                                                                    <button onClick={() => void handleAdvanceOrder(o, 'Awaiting Shipment')} className={btnPrimary}>
                                                                        Pack
                                                                    </button>
                                                                )}
                                                                {o.status === 'Awaiting Shipment' && (
                                                                    <button onClick={() => void handleAdvanceOrder(o, 'Shipped')} className={btnPrimary}>
                                                                        Ship
                                                                    </button>
                                                                )}
                                                                {o.status === 'Shipped' && (
                                                                    <button onClick={() => void handleAdvanceOrder(o, 'Delivered')} className={btnSecondary}>
                                                                        Delivered
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {section === 'create' && (
                        <CreateOrder
                            products={products}
                            onCancel={() => setSection('orders')}
                            onSuccess={(order) => {
                                setOrders((prev) => [order, ...prev]);
                                setSection('orders');
                                showToast(`Order ${order.reference} created`);
                            }}
                            onError={(msg) => showToast(msg, 'error')}
                        />
                    )}

                    {section === 'products' && (
                        <Card>
                            <CardHeader
                                title="Product catalogue"
                                subtitle={`${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`}
                                action={
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                            <input
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                placeholder="Search products…"
                                                className={cn(inputCls, 'w-48 pl-7')}
                                            />
                                        </div>
                                        <select
                                            value={productStatusFilter}
                                            onChange={(e) => setProductStatusFilter(e.target.value as (typeof PRODUCT_STATUS_FILTERS)[number])}
                                            className={cn(inputCls, 'w-32')}
                                        >
                                            {PRODUCT_STATUS_FILTERS.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={productStockFilter}
                                            onChange={(e) => setProductStockFilter(e.target.value as (typeof STOCK_BUCKETS)[number])}
                                            className={cn(inputCls, 'w-32')}
                                        >
                                            {STOCK_BUCKETS.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => setShowAddProduct(true)} className={btnPrimary}>
                                            <Plus className="w-3 h-3" /> Add
                                        </button>
                                    </div>
                                }
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Product</th>
                                            <th className="py-2 px-2 font-medium">SKU</th>
                                            <th className="py-2 px-2 font-medium">Category</th>
                                            <th className="py-2 px-2 font-medium text-right">Price</th>
                                            <th className="py-2 px-2 font-medium text-right">Stock</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium text-right">Sales</th>
                                            <th className="py-2 px-2 w-16" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No products match your filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredProducts.map((p) => (
                                                <tr key={String(p.id)} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Thumb src={p.image} className="w-8 h-8" />
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 truncate max-w-[220px]">{p.name}</p>
                                                                {p.brand && <p className="text-[13px] text-slate-400 truncate">{p.brand}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 font-mono text-[13px] text-slate-500">{p.sku || '—'}</td>
                                                    <td className="py-2 px-2 text-slate-600 truncate max-w-[140px]">{p.category || '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900">{KES(p.price)}</td>
                                                    <td className="py-2 px-2 text-right">
                                                        <span
                                                            className={cn(
                                                                'font-mono font-semibold tabular-nums',
                                                                p.stockQuantity === 0
                                                                    ? 'text-red-600'
                                                                    : p.stockQuantity <= p.lowStockThreshold
                                                                        ? 'text-amber-700'
                                                                        : 'text-slate-700',
                                                            )}
                                                        >
                                                            {p.stockQuantity}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge label={p.isActive ? 'Active' : 'Draft'} variant={p.isActive ? 'success' : 'neutral'} />
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        <p className="font-medium text-slate-900 tabular-nums">{p.salesCount}</p>
                                                        <p className="text-[13px] text-slate-400 tabular-nums">{KES(p.revenue)}</p>
                                                    </td>
                                                    <td className="py-2 px-2 text-right">
                                                        <button className={iconBtn} onClick={() => void handleDeleteProduct(p)} aria-label="Delete product">
                                                            <Trash2 className="w-3.5 h-3.5" />
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

                    {section === 'categories' && (
                        <Card>
                            <CardHeader
                                title="Categories"
                                subtitle={`${categories.length} categories`}
                                action={
                                    <button onClick={() => setShowAddCategory(true)} className={btnPrimary}>
                                        <Plus className="w-3 h-3" /> Add
                                    </button>
                                }
                            />
                            <div className="p-2 space-y-1">
                                {categories.length === 0 ? (
                                    <EmptyCard icon={<Layers className="w-5 h-5" />} title="No categories yet" description="Add categories to organise your catalogue." />
                                ) : (
                                    categories.map((c) => (
                                        <div key={c.id} className="flex items-center justify-between gap-2 p-2 border border-slate-200 rounded">
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{c.name}</p>
                                                <p className="text-[13px] text-slate-400 truncate">{c.slug || '—'}</p>
                                            </div>
                                            <span className="text-[13px] text-slate-500 shrink-0">
                                                {products.filter((p) => p.categoryId === c.id).length} products
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}

                    {section === 'variations' && (
                        <Card>
                            <CardHeader title="Variations" subtitle="Product variants and attributes" />
                            <div className="p-2">
                                <EmptyCard
                                    icon={<Layers className="w-5 h-5" />}
                                    title="No variations configured"
                                    description="Product variations (size, color, model) will appear here once defined on products."
                                />
                            </div>
                        </Card>
                    )}

                    {section === 'inventory' && (
                        <Card>
                            <CardHeader title="Inventory" subtitle="Stock position across all products" />
                            <div className="p-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
                                <Kpi icon={<Boxes className="w-3.5 h-3.5" />} label="Total units" value={NUM(stats.totalStock)} />
                                <Kpi icon={<Banknote className="w-3.5 h-3.5" />} label="Stock value" value={KES(stats.stockValue)} />
                                <Kpi icon={<Clock className="w-3.5 h-3.5" />} label="Low stock" value={NUM(stats.lowStock)} />
                                <Kpi icon={<AlertCircle className="w-3.5 h-3.5" />} label="Out of stock" value={NUM(stats.outOfStock)} />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Product</th>
                                            <th className="py-2 px-2 font-medium">SKU</th>
                                            <th className="py-2 px-2 font-medium text-right">On hand</th>
                                            <th className="py-2 px-2 font-medium text-right">Value</th>
                                            <th className="py-2 px-2 font-medium">Health</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {products.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No inventory yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            products.map((p) => (
                                                <tr key={String(p.id)} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2">
                                                        <div className="flex items-center gap-2">
                                                            <Thumb src={p.image} className="w-7 h-7" />
                                                            <span className="font-medium text-slate-900 truncate max-w-[220px]">{p.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 font-mono text-[13px] text-slate-500">{p.sku || '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono tabular-nums">{p.stockQuantity}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900 tabular-nums">
                                                        {KES(p.stockQuantity * Number(p.price || 0))}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={p.stockQuantity === 0 ? 'Out of stock' : p.stockQuantity <= p.lowStockThreshold ? 'Low' : 'Healthy'}
                                                            variant={p.stockQuantity === 0 ? 'danger' : p.stockQuantity <= p.lowStockThreshold ? 'warning' : 'success'}
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

                    {section === 'sync' && (
                        <Card>
                            <CardHeader title="TikTok catalogue sync" subtitle="Push and pull catalogue information with TikTok" />
                            <div className="p-2 space-y-2">
                                <div className="bg-slate-50 border border-slate-200 rounded p-2 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-slate-900">Sync status unavailable</p>
                                        <p className="text-[13px] text-slate-500 mt-0.5">
                                            TikTok Shop integration is not connected. Products will remain managed in your website catalogue.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    <Kpi icon={<Package className="w-3.5 h-3.5" />} label="Products" value={NUM(products.length)} />
                                    <Kpi icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Synced" value="—" />
                                    <Kpi icon={<AlertCircle className="w-3.5 h-3.5" />} label="Failed" value="—" />
                                    <Kpi icon={<Clock className="w-3.5 h-3.5" />} label="Last sync" value="—" />
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'payments' && (
                        <Card>
                            <CardHeader title="Payment verification" subtitle="Transactions awaiting review" />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Order</th>
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium text-right">Amount</th>
                                            <th className="py-2 px-2 font-medium">Method</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {orders.filter((o) => o.status === 'Awaiting Payment' || o.status === 'Paid').length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No payments awaiting verification.
                                                </td>
                                            </tr>
                                        ) : (
                                            orders
                                                .filter((o) => o.status === 'Awaiting Payment' || o.status === 'Paid')
                                                .map((o) => (
                                                    <tr key={o.reference} className="hover:bg-slate-50">
                                                        <td className="py-2 px-2 font-mono font-medium text-slate-900">{o.reference}</td>
                                                        <td className="py-2 px-2 text-slate-700 truncate max-w-[160px]">{o.customerName}</td>
                                                        <td className="py-2 px-2 text-right font-mono font-medium">{KES(o.total)}</td>
                                                        <td className="py-2 px-2 text-slate-600">{o.paymentMethod || '—'}</td>
                                                        <td className="py-2 px-2">
                                                            <StatusBadge
                                                                label={o.status === 'Paid' ? 'Verified' : 'Awaiting'}
                                                                variant={o.status === 'Paid' ? 'success' : 'warning'}
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

                    {section === 'fulfillment' && (
                        <Card>
                            <CardHeader title="Fulfillment queue" subtitle="Orders by fulfillment stage" />
                            <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                                {(['Paid', 'Awaiting Shipment', 'Shipped', 'Delivered'] as const).map((stage) => {
                                    const list = orders.filter((o) => o.status === stage);
                                    return (
                                        <div key={stage} className="bg-slate-50 border border-slate-200 rounded flex flex-col">
                                            <div className="px-2 py-1.5 border-b border-slate-200 flex items-center justify-between">
                                                <StatusBadge
                                                    label={stage}
                                                    variant={stage === 'Delivered' ? 'success' : stage === 'Shipped' ? 'info' : 'warning'}
                                                />
                                                <span className="text-[13px] text-slate-500 tabular-nums">{list.length}</span>
                                            </div>
                                            <div className="p-1.5 space-y-1.5 flex-1 min-h-[120px]">
                                                {list.length === 0 ? (
                                                    <p className="text-[13px] text-slate-400 text-center py-4">Empty</p>
                                                ) : (
                                                    list.map((o) => (
                                                        <button
                                                            key={o.reference}
                                                            onClick={() => setSelectedOrder(o)}
                                                            className="w-full text-left bg-white border border-slate-200 rounded p-1.5 hover:border-slate-300"
                                                        >
                                                            <p className="text-[13px] font-mono font-medium text-slate-900 truncate">{o.reference}</p>
                                                            <p className="text-[13px] text-slate-600 truncate">{o.customerName}</p>
                                                            <p className="text-[13px] text-slate-400 tabular-nums">{KES(o.total)}</p>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {section === 'returns' && (
                        <Card>
                            <CardHeader title="Returns & refunds" subtitle={`${returns.length} record${returns.length === 1 ? '' : 's'}`} />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Reference</th>
                                            <th className="py-2 px-2 font-medium">Order</th>
                                            <th className="py-2 px-2 font-medium">Reason</th>
                                            <th className="py-2 px-2 font-medium text-right">Refund</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {returns.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No returns recorded.
                                                </td>
                                            </tr>
                                        ) : (
                                            returns.map((r) => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2 font-mono font-medium text-slate-900">{r.reference}</td>
                                                    <td className="py-2 px-2 font-mono text-slate-700">{r.orderReference}</td>
                                                    <td className="py-2 px-2 text-slate-500 truncate max-w-[200px]">{r.reasonDetail || r.reason}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900">{KES(r.refundAmount)}</td>
                                                    <td className="py-2 px-2">
                                                        <StatusBadge
                                                            label={r.status}
                                                            variant={r.status === 'Refunded' ? 'success' : r.status === 'Rejected' ? 'danger' : 'warning'}
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

                    {section === 'settings' && (
                        <Card>
                            <CardHeader title="Order settings" subtitle="Defaults and integrations" />
                            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Field label="Default currency"><input className={inputCls} defaultValue="KES" disabled /></Field>
                                <Field label="Default low-stock threshold"><input className={inputCls} defaultValue="5" /></Field>
                                <Field label="Store name"><input className={inputCls} defaultValue="TikTok Business" /></Field>
                                <Field label="Support email"><input className={inputCls} placeholder="support@example.com" /></Field>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {selectedOrder && (
                <Modal onClose={() => setSelectedOrder(null)} title={`Order ${selectedOrder.reference}`} subtitle={selectedOrder.customerName}>
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <MiniStat label="Total" value={KES(selectedOrder.total)} />
                            <MiniStat label="Status" value={selectedOrder.status} />
                            <MiniStat label="Source" value={sourceLabel(selectedOrder.source)} />
                            <MiniStat label="Created" value={formatDate(selectedOrder.createdAt)} />
                        </div>
                        <Card>
                            <CardHeader title="Items" />
                            <div className="p-2 space-y-1">
                                {(selectedOrder.items || []).map((it, i) => (
                                    <div key={i} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                        <Thumb src={it.image} className="w-8 h-8" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-slate-900 truncate">{it.productName}</p>
                                            <p className="text-[13px] text-slate-500 font-mono truncate">{it.sku}</p>
                                        </div>
                                        <p className="text-[13px] text-slate-500 tabular-nums">×{it.quantity}</p>
                                        <p className="text-[13px] font-medium text-slate-900 tabular-nums">{KES(it.price)}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                            <button onClick={() => setSelectedOrder(null)} className={btnSecondary}>Close</button>
                            {selectedOrder.status === 'Paid' && (
                                <button onClick={() => void handleAdvanceOrder(selectedOrder, 'Awaiting Shipment')} className={btnPrimary}>
                                    Mark packed
                                </button>
                            )}
                            {selectedOrder.status === 'Awaiting Shipment' && (
                                <button onClick={() => void handleAdvanceOrder(selectedOrder, 'Shipped')} className={btnPrimary}>
                                    Ship
                                </button>
                            )}
                            {selectedOrder.status === 'Shipped' && (
                                <button onClick={() => void handleAdvanceOrder(selectedOrder, 'Delivered')} className={btnSecondary}>
                                    Delivered
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {showAddProduct && (
                <AddProductModal
                    categories={categories}
                    brands={brands}
                    onClose={() => setShowAddProduct(false)}
                    onSubmit={handleCreateProduct}
                />
            )}

            {showAddCategory && (
                <AddCategoryModal
                    onClose={() => setShowAddCategory(false)}
                    onSubmit={() => {
                        setShowAddCategory(false);
                        showToast('Category feature coming soon');
                    }}
                />
            )}
        </div>
    );
}

function CreateOrder({
    products,
    onCancel,
    onSuccess,
    onError,
}: {
    products: NormalizedProduct[];
    onCancel: () => void;
    onSuccess: (order: AdminDirectOrder) => void;
    onError: (msg: string) => void;
}) {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [source, setSource] = useState('tiktok_dm');
    const [paymentMethod, setPaymentMethod] = useState('mpesa');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<Array<{
        productId: string;
        productName: string;
        sku: string;
        image: string;
        quantity: number;
        price: number;
    }>>([]);
    const [productId, setProductId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const addItem = () => {
        const p = products.find((x) => String(x.id) === productId);
        if (!p) return;
        if (p.stockQuantity <= 0) {
            onError(`${p.name} is out of stock`);
            return;
        }
        setItems((prev) => [
            ...prev,
            { productId: String(p.id), productName: p.name, sku: p.sku, image: p.image, quantity: 1, price: Number(p.price) || 0 },
        ]);
        setProductId('');
    };

    const updateQuantity = (idx: number, q: string) => {
        setItems((prev) =>
            prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, Number(q) || 1) } : it)),
        );
    };

    const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const total = items.reduce((a, it) => a + it.price * it.quantity, 0);

    const handleSubmit = async () => {
        if (!customerName || !customerPhone || items.length === 0) return;
        setSubmitting(true);
        try {
            const order = await adminApi.directOrders.orders.create({
                customerName,
                customerPhone,
                customerEmail,
                source: source as 'tiktok_dm' | 'tiktok_comment' | 'live' | 'video_dm' | 'bio_link' | 'whatsapp' | 'phone' | 'admin',
                status: 'New',
                paymentMethod,
                notes,
                items: items.map((it) => ({
                    productId: Number(it.productId) || undefined,
                    productName: it.productName,
                    sku: it.sku,
                    image: it.image,
                    qty: it.quantity,
                    price: String(it.price),
                })),
            });
            onSuccess(order);
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Failed to create order');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader title="New order" subtitle="Create a manual order" />
            <div className="p-2 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Customer name" required>
                        <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    </Field>
                    <Field label="Phone" required>
                        <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                    </Field>
                    <Field label="Email">
                        <input className={inputCls} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
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
                    <Field label="Payment method">
                        <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            <option value="mpesa">M-Pesa</option>
                            <option value="cod">Cash on delivery</option>
                            <option value="bank">Bank transfer</option>
                            <option value="card">Card</option>
                        </select>
                    </Field>
                </div>

                <div className="border-t border-slate-200 pt-2">
                    <p className="text-[13px] font-semibold text-slate-500 uppercase mb-1">Items</p>
                    <div className="flex gap-2">
                        <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
                            <option value="">Select a product…</option>
                            {products.map((p) => (
                                <option key={String(p.id)} value={String(p.id)} disabled={p.stockQuantity <= 0}>
                                    {p.name} — {KES(p.price)} {p.stockQuantity <= 0 ? '(Out)' : ''}
                                </option>
                            ))}
                        </select>
                        <button onClick={addItem} disabled={!productId} className={btnSecondary}>
                            <Plus className="w-3 h-3" /> Add
                        </button>
                    </div>
                    <div className="space-y-1 mt-2">
                        {items.map((it, i) => (
                            <div key={i} className="flex items-center gap-2 border border-slate-200 rounded p-1.5">
                                <Thumb src={it.image} className="w-8 h-8" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-slate-900 truncate">{it.productName}</p>
                                    <p className="text-[13px] text-slate-500 tabular-nums">{KES(it.price)}</p>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    value={it.quantity}
                                    onChange={(e) => updateQuantity(i, e.target.value)}
                                    className={cn(inputCls, 'w-16 text-right')}
                                />
                                <button onClick={() => removeItem(i)} className={iconBtn}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <Field label="Notes">
                    <textarea className={cn(inputCls, 'min-h-[60px]')} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>

                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <p className="text-[13px] text-slate-500">
                        Total: <span className="font-semibold text-slate-900">{KES(total)}</span>
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
                        <button
                            onClick={() => void handleSubmit()}
                            disabled={!customerName || !customerPhone || items.length === 0 || submitting}
                            className={btnPrimary}
                        >
                            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                            <CheckCircle2 className="w-3 h-3" /> Create order
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function AddProductModal({
    categories,
    brands,
    onClose,
    onSubmit,
}: {
    categories: CategoryRef[];
    brands: BrandRef[];
    onClose: () => void;
    onSubmit: (payload: AdminDirectProductWrite) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [sku, setSku] = useState('');
    const [price, setPrice] = useState('');
    const [compareAtPrice, setCompareAtPrice] = useState('');
    const [stockQuantity, setStockQuantity] = useState('0');
    const [lowStockThreshold, setLowStockThreshold] = useState('5');
    const [brandId, setBrandId] = useState(brands[0]?.id || 0);
    const [categoryId, setCategoryId] = useState(categories[0]?.id || 0);
    const [status, setStatus] = useState<AdminDirectProductStatus>('Active');
    const [image, setImage] = useState('');

    return (
        <Modal onClose={onClose} title="Add product" subtitle="Create a new product in the catalogue">
            <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Name" required>
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="SKU">
                        <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} />
                    </Field>
                    <Field label="Price" required>
                        <input type="number" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
                    </Field>
                    <Field label="Compare-at price">
                        <input type="number" className={inputCls} value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} />
                    </Field>
                    <Field label="Stock quantity">
                        <input type="number" className={inputCls} value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} />
                    </Field>
                    <Field label="Low-stock threshold">
                        <input type="number" className={inputCls} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                    </Field>
                    <Field label="Brand">
                        <select className={inputCls} value={brandId} onChange={(e) => setBrandId(Number(e.target.value))}>
                            <option value={0}>—</option>
                            {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Category">
                        <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
                            <option value={0}>—</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Status">
                        <select
                            className={inputCls}
                            value={status}
                            onChange={(e) => setStatus(e.target.value as AdminDirectProductStatus)}
                        >
                            <option value="Active">Active</option>
                            <option value="Draft">Draft</option>
                        </select>
                    </Field>
                    <Field label="Image URL">
                        <input className={inputCls} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea className={cn(inputCls, 'min-h-[70px]')} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>Cancel</button>
                    <button
                        onClick={() =>
                            onSubmit({
                                name,
                                description,
                                sku,
                                price,
                                compareAtPrice,
                                stockQuantity: Number(stockQuantity) || 0,
                                lowStockThreshold: Number(lowStockThreshold) || 5,
                                brandId,
                                categoryId,
                                status,
                                image,
                            })
                        }
                        disabled={!name || !price}
                        className={btnPrimary}
                    >
                        <CheckCircle2 className="w-3 h-3" /> Save product
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function AddCategoryModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: { name: string }) => void }) {
    const [name, setName] = useState('');
    return (
        <Modal onClose={onClose} title="Add category" subtitle="Create a new product category">
            <div className="space-y-2">
                <Field label="Name" required>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className={btnSecondary}>Cancel</button>
                    <button onClick={() => onSubmit({ name })} disabled={!name} className={btnPrimary}>
                        Save
                    </button>
                </div>
            </div>
        </Modal>
    );
}