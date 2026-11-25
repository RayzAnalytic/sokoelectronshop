'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Banknote,
    Calendar,
    ChevronRight,
    Clock,
    Download,
    Package,
    Percent,
    RefreshCw,
    Repeat,
    ShoppingBag,
    Sparkles,
    TrendingUp,
    Truck,
    UserRound,
    Users,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
    AdminDirectOrder,
    AdminProduct,
    AdminCustomerFull,
    AdminCustomerStatsFull,
    AdminDirectCreator,
    AdminInboxConversation,
    AdminDirectContent,
    AdminDirectLive,
    AdminAnalyticsSummaryResponse,
    AdminFinanceSummaryResponse,
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
        return new Date(ts).toLocaleDateString('en-KE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
};

const formatTimeAgo = (iso: string | null | undefined): string => {
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

const initials = (name: string | null | undefined): string =>
    String(name || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';

interface RangeOption {
    id: string;
    label: string;
    days: number;
}

const RANGE_OPTIONS: RangeOption[] = [
    { id: 'today', label: 'Today', days: 1 },
    { id: 'yesterday', label: 'Yesterday', days: 1 },
    { id: '7days', label: 'Last 7 Days', days: 7 },
    { id: '30days', label: 'Last 30 Days', days: 30 },
    { id: 'month', label: 'This Month', days: 30 },
    { id: 'last_month', label: 'Last Month', days: 30 },
    { id: 'year', label: 'This Year', days: 365 },
];

const ORDER_STATUSES = [
    'New',
    'Awaiting Payment',
    'Paid',
    'Awaiting Shipment',
    'Shipped',
    'Delivered',
    'Cancelled',
    'Returned',
];

const PRODUCT_STATUS_STYLES = {
    low: 'bg-amber-50 text-amber-700 border-amber-100',
    out: 'bg-red-50 text-red-600 border-red-100',
};

const CHANNEL_COLORS = ['#172554', '#10b981', '#ec4899', '#0284c7', '#f59e0b', '#6366f1', '#94a3b8'];

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
    stockQuantity: number;
    lowStockThreshold: number;
    category: string;
    brand: string;
    salesCount: number;
    revenue: string;
    isActive: boolean;
}

interface NormalizedOrder extends AdminDirectOrder {
    createdAt: string;
}

interface ActivityItem {
    id: string;
    icon: React.ReactNode;
    title: string;
    detail: string;
    time: string;
}

interface AlertItem {
    id: string;
    icon: React.ReactNode;
    title: string;
    href: string;
}

interface FunnelStage {
    stage: string;
    count: number | null;
    dropoff: string;
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('bg-white border border-slate-200 rounded overflow-hidden', className)}>
            {children}
        </div>
    );
}

function CardHeader({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
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

function KpiCard({
    label,
    value,
    delta,
    positive,
    icon,
    sub,
}: {
    label: string;
    value: string;
    delta?: string;
    positive?: boolean;
    icon: React.ReactNode;
    sub?: string;
}) {
    return (
        <Card className="p-2 flex flex-col gap-1.5 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-slate-100 text-slate-700">
                    {icon}
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">{label}</span>
            </div>
            <div className="text-[15px] font-bold text-slate-900 truncate tabular-nums">{value}</div>
            <div className="flex items-center gap-1.5 min-w-0">
                {delta !== undefined && (
                    <span
                        className={cn(
                            'inline-flex items-center text-[13px] font-medium px-1.5 py-0.5 rounded shrink-0',
                            positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
                        )}
                    >
                        {positive ? (
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                            <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {delta}
                    </span>
                )}
                {sub && <span className="text-[13px] text-slate-400 truncate">{sub}</span>}
            </div>
        </Card>
    );
}

function StatusBadge({ label, variant }: { label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' }) {
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
    return (
        <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[13px] font-medium whitespace-nowrap', styles)}>
            {label}
        </span>
    );
}

function EmptyCard({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
    return (
        <div className="py-8 text-center">
            <span className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                {icon}
            </span>
            <p className="mt-2 text-[13px] font-semibold text-slate-900">{title}</p>
            {description && <p className="mt-1 text-[13px] text-slate-500 max-w-xs mx-auto">{description}</p>}
        </div>
    );
}

function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
    const colors = ['bg-slate-900', 'bg-slate-700', 'bg-slate-600', 'bg-slate-800', 'bg-slate-500'];
    const idx = String(name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return (
        <span
            className={cn(
                'flex items-center justify-center text-white text-[13px] font-semibold rounded shrink-0',
                colors[idx % colors.length],
                className,
            )}
        >
            {initials(name)}
        </span>
    );
}

function Thumb({
    src,
    alt,
    className,
    fallback,
}: {
    src?: string;
    alt?: string;
    className?: string;
    fallback?: React.ReactNode;
}) {
    if (!src) {
        return (
            <span
                className={cn(
                    'flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 rounded shrink-0',
                    className,
                )}
            >
                {fallback || <Package className="w-3.5 h-3.5" />}
            </span>
        );
    }
    return (
        <img
            src={src}
            alt={alt || ''}
            loading="lazy"
            className={cn('object-cover border border-slate-200 rounded shrink-0 bg-slate-50', className)}
        />
    );
}

function QuickAction({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
    return (
        <Link
            href={href}
            className="w-full text-left border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 p-2 flex items-center gap-2 transition-colors group"
        >
            <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-blue-950 group-hover:text-white transition-colors">
                {icon}
            </span>
            <span className="text-[13px] font-medium text-slate-800 flex-1 truncate">{title}</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </Link>
    );
}

export default function BusinessOverview() {
    const [rangeId, setRangeId] = useState<string>('30days');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [chartMetric, setChartMetric] = useState<'revenue' | 'orders' | 'aov' | 'profit'>('revenue');
    const [chartInterval, setChartInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: number; msg: string; variant: 'success' | 'error' } | null>(null);

    const [orders, setOrders] = useState<NormalizedOrder[]>([]);
    const [products, setProducts] = useState<NormalizedProduct[]>([]);
    const [customers, setCustomers] = useState<AdminCustomerFull[]>([]);
    const [customerStats, setCustomerStats] = useState<AdminCustomerStatsFull | null>(null);
    const [creators, setCreators] = useState<AdminDirectCreator[]>([]);
    const [inbox, setInbox] = useState<AdminInboxConversation[]>([]);
    const [content, setContent] = useState<AdminDirectContent[]>([]);
    const [lives, setLives] = useState<AdminDirectLive[]>([]);
    const [analyticsSummary, setAnalyticsSummary] = useState<AdminAnalyticsSummaryResponse | null>(null);
    const [financeSummary, setFinanceSummary] = useState<AdminFinanceSummaryResponse | null>(null);

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
            adminApi.directOrders.customers.list({ limit: 200 }),
            adminApi.directOrders.customers.stats(),
            adminApi.directOrders.creators.list(),
            adminApi.directOrders.inbox.list(),
            adminApi.directOrders.content.list(),
            adminApi.directOrders.lives.list(),
            adminApi.directOrders.analytics.summary(),
            adminApi.directOrders.finance.summary(),
        ]);

        if (results[0].status === 'fulfilled') setOrders((results[0].value || []) as NormalizedOrder[]);

        if (results[1].status === 'fulfilled') {
            const list = (results[1].value || []) as AdminProduct[];
            setProducts(
                list.map((p) => ({
                    id: p.id,
                    name: p.name,
                    sku: p.slug || '',
                    image: p.images?.[0]?.url || '',
                    price: p.price,
                    stockQuantity: p.stock_quantity ?? 0,
                    lowStockThreshold: p.low_stock_threshold ?? 5,
                    category: p.category?.name || '',
                    brand: p.brand?.name || '',
                    salesCount: p.sales_count ?? 0,
                    revenue: p.sales_volume ?? '0',
                    isActive: p.is_active,
                })),
            );
        }

        if (results[2].status === 'fulfilled') {
            const v = results[2].value;
            setCustomers(Array.isArray(v) ? v : v?.results ?? []);
        }

        if (results[3].status === 'fulfilled') setCustomerStats(results[3].value);
        if (results[4].status === 'fulfilled') setCreators(results[4].value || []);
        if (results[5].status === 'fulfilled') setInbox(results[5].value || []);
        if (results[6].status === 'fulfilled') setContent(results[6].value || []);
        if (results[7].status === 'fulfilled') setLives(results[7].value || []);
        if (results[8].status === 'fulfilled') setAnalyticsSummary(results[8].value);
        if (results[9].status === 'fulfilled') setFinanceSummary(results[9].value);

        if (results.every((r) => r.status === 'rejected')) {
            const first = results[0] as PromiseRejectedResult;
            setError(first.reason instanceof Error ? first.reason.message : 'Failed to load overview');
        }

        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    const rangeDays = useMemo(
        () => RANGE_OPTIONS.find((r) => r.id === rangeId)?.days || 30,
        [rangeId],
    );

    const cutoff = useMemo(() => {
        if (rangeId === 'today') {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }
        if (rangeId === 'yesterday') {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - 1);
            return d.getTime();
        }
        return Date.now() - rangeDays * 86400000;
    }, [rangeId, rangeDays]);

    const rangeOrders = useMemo<NormalizedOrder[]>(() => {
        return orders.filter((o) => {
            const ts = Date.parse(o.createdAt);
            if (Number.isNaN(ts) || ts < cutoff) return false;
            if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
            return true;
        });
    }, [orders, cutoff, sourceFilter]);

    const prevOrders = useMemo<NormalizedOrder[]>(() => {
        const span = rangeId === 'today' || rangeId === 'yesterday' ? 1 : rangeDays;
        const prevStart = cutoff - span * 86400000;
        const prevEnd = cutoff;
        return orders.filter((o) => {
            const ts = Date.parse(o.createdAt);
            if (Number.isNaN(ts)) return false;
            return ts >= prevStart && ts < prevEnd;
        });
    }, [orders, cutoff, rangeDays, rangeId]);

    const kpis = useMemo(() => {
        const revenue = rangeOrders.reduce((a, o) => a + Number(o.total || 0), 0);
        const prevRevenue = prevOrders.reduce((a, o) => a + Number(o.total || 0), 0);
        const ordersCount = rangeOrders.length;
        const prevOrdersCount = prevOrders.length;
        const aov = ordersCount ? revenue / ordersCount : 0;
        const prevAov = prevOrdersCount ? prevRevenue / prevOrdersCount : 0;
        const customerCount = customerStats?.total ?? customers.length;
        const newCustomers = customers.filter((c) => {
            const ts = Date.parse(c.createdAt || '');
            return !Number.isNaN(ts) && ts >= cutoff;
        }).length;
        const leads = customerStats?.new ?? inbox.length;
        const convertedLeads = inbox.filter((c) => c.status === 'converted').length;
        const returningCustomers =
            customerStats?.repeat ?? customers.filter((c) => (c.totalOrders || 0) >= 2).length;
        const conversionRate = ordersCount && leads ? Math.min((ordersCount / leads) * 100, 100) : 0;
        const grossProfit =
            Number(financeSummary?.grossProfit ?? 0) ||
            Math.max(Number(financeSummary?.netRevenue ?? 0), revenue * 0.35);

        const delta = (cur: number, prev: number) => {
            if (!prev) return { delta: cur ? '+100%' : '0%', positive: cur > 0 };
            const change = ((cur - prev) / prev) * 100;
            return { delta: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, positive: change >= 0 };
        };

        const r = delta(revenue, prevRevenue);
        const o = delta(ordersCount, prevOrdersCount);
        const a = delta(aov, prevAov);

        return {
            revenue,
            ordersCount,
            customerCount,
            newCustomers,
            leads,
            convertedLeads,
            grossProfit,
            conversionRate,
            aov,
            returningCustomers,
            revenueDelta: r,
            ordersDelta: o,
            aovDelta: a,
        };
    }, [rangeOrders, prevOrders, customers, customerStats, inbox, financeSummary, cutoff]);

    const chartData = useMemo(() => {
        const buckets = new Map<string, { label: string; revenue: number; orders: number; profit: number; aov: number }>();
        const bucketFor = (d: Date): string => {
            if (chartInterval === 'monthly') return `${d.getFullYear()}-${d.getMonth()}`;
            if (chartInterval === 'weekly') {
                const wd = Math.floor(d.getDate() / 7);
                return `${d.getFullYear()}-${d.getMonth()}-${wd}`;
            }
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        };
        const labelFor = (d: Date): string => {
            if (chartInterval === 'monthly')
                return d.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' });
            return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
        };

        rangeOrders.forEach((o) => {
            const d = new Date(o.createdAt);
            if (Number.isNaN(d.getTime())) return;
            const key = bucketFor(d);
            if (!buckets.has(key)) {
                buckets.set(key, { label: labelFor(d), revenue: 0, orders: 0, profit: 0, aov: 0 });
            }
            const b = buckets.get(key)!;
            b.revenue += Number(o.total || 0);
            b.orders += 1;
            b.profit += Number(o.total || 0) * 0.35;
        });

        return Array.from(buckets.values())
            .map((b) => ({ ...b, aov: b.orders ? b.revenue / b.orders : 0 }))
            .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
    }, [rangeOrders, chartInterval]);

    const channelBreakdown = useMemo(() => {
        const totals = new Map<string, { orders: number; revenue: number }>();
        rangeOrders.forEach((o) => {
            const key = o.source || 'other';
            if (!totals.has(key)) totals.set(key, { orders: 0, revenue: 0 });
            const t = totals.get(key)!;
            t.orders += 1;
            t.revenue += Number(o.total || 0);
        });
        const totalRevenue = Array.from(totals.values()).reduce((a, t) => a + t.revenue, 0) || 1;
        return Array.from(totals.entries())
            .map(([source, t], i) => ({
                name: sourceLabel(source),
                orders: t.orders,
                revenue: t.revenue,
                share: Math.round((t.revenue / totalRevenue) * 100),
                color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
            }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [rangeOrders]);

    const statusBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        ORDER_STATUSES.forEach((s) => {
            counts[s] = 0;
        });
        rangeOrders.forEach((o) => {
            if (counts[o.status] !== undefined) counts[o.status] += 1;
        });
        return ORDER_STATUSES.map((s) => ({ status: s, count: counts[s] }));
    }, [rangeOrders]);

    const recentOrders = useMemo(() => {
        return [...rangeOrders]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, 8);
    }, [rangeOrders]);

    const topProducts = useMemo(() => {
        const byProduct = new Map<string, { id: number | string | undefined; name: string; sku: string; image: string; units: number; revenue: number }>();
        rangeOrders.forEach((o) => {
            (o.items || []).forEach((it) => {
                const key = String(it.productId || it.sku || it.productName);
                if (!byProduct.has(key)) {
                    byProduct.set(key, {
                        id: it.productId,
                        name: it.productName || '—',
                        sku: it.sku || '',
                        image: it.image || '',
                        units: 0,
                        revenue: 0,
                    });
                }
                const p = byProduct.get(key)!;
                p.units += Number(it.quantity || 1);
                p.revenue += Number(it.price || 0) * Number(it.quantity || 1);
            });
        });
        return Array.from(byProduct.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }, [rangeOrders]);

    const lowStock = useMemo(() => {
        return [...products]
            .filter((p) => p.stockQuantity <= (p.lowStockThreshold ?? 5))
            .sort((a, b) => a.stockQuantity - b.stockQuantity)
            .slice(0, 5);
    }, [products]);

    const activityFeed = useMemo<ActivityItem[]>(() => {
        const items: ActivityItem[] = [];
        rangeOrders.slice(0, 15).forEach((o) => {
            items.push({
                id: `order-${o.reference}`,
                icon: <ShoppingBag className="w-3.5 h-3.5" />,
                title: `Order ${o.reference} created`,
                detail: `${o.customerName} · ${KES(o.total)}`,
                time: o.createdAt,
            });
        });
        customers.slice(0, 10).forEach((c) => {
            items.push({
                id: `customer-${c.id}`,
                icon: <UserRound className="w-3.5 h-3.5" />,
                title: `New customer ${c.name}`,
                detail: c.phone || c.email || '',
                time: c.createdAt || new Date().toISOString(),
            });
        });
        inbox.slice(0, 10).forEach((c) => {
            items.push({
                id: `inbox-${c.id}`,
                icon: <Users className="w-3.5 h-3.5" />,
                title: `New lead from ${c.contactName || c.contactHandle || 'Unknown'}`,
                detail: c.contactHandle || '',
                time: c.lastMessageAt || new Date().toISOString(),
            });
        });
        creators.slice(0, 6).forEach((c) => {
            if (Number(c.commissionOwed || 0) > 0) {
                items.push({
                    id: `creator-${c.id}`,
                    icon: <Banknote className="w-3.5 h-3.5" />,
                    title: `Commission due to ${c.name}`,
                    detail: KES(c.commissionOwed),
                    time: new Date().toISOString(),
                });
            }
        });
        return items
            .filter((i) => i.time)
            .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
            .slice(0, 10);
    }, [rangeOrders, customers, inbox, creators]);

    const alerts = useMemo<AlertItem[]>(() => {
        const list: AlertItem[] = [];
        const unverifiedPayments = rangeOrders.filter((o) => o.status === 'Awaiting Payment').length;
        if (unverifiedPayments > 0) {
            list.push({
                id: 'unverified',
                icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
                title: `${unverifiedPayments} payment${unverifiedPayments > 1 ? 's' : ''} awaiting verification`,
                href: '/tiktok/TikTokBusiness/OrdersProductsFulfillment',
            });
        }
        const toShip = rangeOrders.filter((o) => o.status === 'Paid' || o.status === 'Awaiting Shipment').length;
        if (toShip > 0) {
            list.push({
                id: 'toship',
                icon: <Truck className="w-3.5 h-3.5 text-blue-600" />,
                title: `${toShip} order${toShip > 1 ? 's' : ''} awaiting shipment`,
                href: '/tiktok/TikTokBusiness/OrdersProductsFulfillment',
            });
        }
        const outOfStock = products.filter((p) => p.stockQuantity === 0).length;
        if (outOfStock > 0) {
            list.push({
                id: 'oos',
                icon: <Package className="w-3.5 h-3.5 text-red-600" />,
                title: `${outOfStock} product${outOfStock > 1 ? 's' : ''} out of stock`,
                href: '/tiktok/TikTokBusiness/OrdersProductsFulfillment',
            });
        }
        if (lowStock.length > 0) {
            list.push({
                id: 'lowstock',
                icon: <Package className="w-3.5 h-3.5 text-amber-600" />,
                title: `${lowStock.length} product${lowStock.length > 1 ? 's' : ''} running low`,
                href: '/tiktok/TikTokBusiness/OrdersProductsFulfillment',
            });
        }
        const unpaidCommissions = creators.filter((c) => Number(c.commissionOwed || 0) > 0).length;
        if (unpaidCommissions > 0) {
            list.push({
                id: 'commission',
                icon: <Banknote className="w-3.5 h-3.5 text-slate-600" />,
                title: `${unpaidCommissions} creator commission${unpaidCommissions > 1 ? 's' : ''} unpaid`,
                href: '/tiktok/TikTokBusiness/CreatorsAffiliates',
            });
        }
        return list;
    }, [rangeOrders, products, lowStock, creators]);

    const topCreators = useMemo(() => {
        return [...creators]
            .filter((c) => Number(c.ordersCount || 0) > 0 || Number(c.revenue || 0) > 0)
            .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
            .slice(0, 5);
    }, [creators]);

    const funnelStages = useMemo<FunnelStage[]>(() => {
        const views = content.reduce((a, c) => a + Number(c.views || 0), 0);
        const leads = inbox.length;
        const conversions = rangeOrders.length;
        const top = views || Math.max(leads * 20, conversions * 100, 1);
        return [
            { stage: 'Content views', count: views || null },
            { stage: 'Leads captured', count: leads || null },
            { stage: 'Orders placed', count: conversions || null },
            { stage: 'Completed', count: rangeOrders.filter((o) => o.status === 'Delivered').length || null },
        ].map((s, i) => ({
            ...s,
            dropoff: i === 0 ? '—' : top ? `-${(((top - (s.count || 0)) / top) * 100).toFixed(1)}%` : '—',
        }));
    }, [content, inbox, rangeOrders]);

    const handleExport = () => {
        const rows: Array<Array<string | number>> = [
            ['Metric', 'Value'],
            ['Revenue', kpis.revenue],
            ['Orders', kpis.ordersCount],
            ['Customers', kpis.customerCount],
            ['New Customers', kpis.newCustomers],
            ['Leads', kpis.leads],
            ['Converted Leads', kpis.convertedLeads],
            ['Gross Profit', kpis.grossProfit],
            ['Conversion Rate', `${kpis.conversionRate.toFixed(2)}%`],
            ['Average Order Value', kpis.aov],
            ['Returning Customers', kpis.returningCustomers],
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiktok-overview-${rangeId}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Overview exported as CSV');
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
                            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                            Business Overview
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            How TikTok is performing across orders, leads, creators, and money.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="bg-white border border-slate-200 rounded px-2 py-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-blue-950" />
                            <select
                                value={rangeId}
                                onChange={(e) => setRangeId(e.target.value)}
                                className="bg-transparent border-none focus:outline-none cursor-pointer text-[13px]"
                            >
                                {RANGE_OPTIONS.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        >
                            <option value="all">All sources</option>
                            <option value="tiktok_dm">TikTok DM</option>
                            <option value="tiktok_comment">TikTok Comment</option>
                            <option value="live">TikTok LIVE</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="phone">Phone</option>
                            <option value="bio_link">Bio Link</option>
                        </select>
                        <button
                            onClick={() => void load(true)}
                            disabled={refreshing || loading}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm disabled:opacity-60"
                        >
                            <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm"
                        >
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                    </div>
                </div>
            </Card>

            {error && (
                <Card>
                    <div className="p-2 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900">Couldn&apos;t load overview</p>
                            <p className="text-[13px] text-slate-600 mt-0.5">{error}</p>
                        </div>
                        <button
                            onClick={() => void load(true)}
                            className="text-[13px] font-medium text-slate-900 hover:underline shrink-0"
                        >
                            Retry
                        </button>
                    </div>
                </Card>
            )}

            {loading ? (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-20 bg-slate-100 rounded animate-pulse" />
                        ))}
                    </div>
                    <div className="h-64 bg-slate-100 rounded animate-pulse" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        <KpiCard label="Total Revenue" value={KES(kpis.revenue)} delta={kpis.revenueDelta.delta} positive={kpis.revenueDelta.positive} icon={<Banknote className="w-3.5 h-3.5" />} />
                        <KpiCard label="Total Orders" value={NUM(kpis.ordersCount)} delta={kpis.ordersDelta.delta} positive={kpis.ordersDelta.positive} icon={<ShoppingBag className="w-3.5 h-3.5" />} />
                        <KpiCard label="Total Customers" value={NUM(kpis.customerCount)} sub={`${kpis.newCustomers} new`} icon={<Users className="w-3.5 h-3.5" />} />
                        <KpiCard label="New Leads" value={NUM(kpis.leads)} sub={`${kpis.convertedLeads} converted`} icon={<UserRound className="w-3.5 h-3.5" />} />
                        <KpiCard label="Gross Profit (est.)" value={KES(kpis.grossProfit)} sub="Net revenue or 35% margin" icon={<TrendingUp className="w-3.5 h-3.5" />} />
                        <KpiCard label="Conversion Rate" value={pct(kpis.conversionRate)} sub="Orders ÷ leads" icon={<Percent className="w-3.5 h-3.5" />} />
                        <KpiCard label="Avg. Order Value" value={KES(kpis.aov)} delta={kpis.aovDelta.delta} positive={kpis.aovDelta.positive} icon={<Banknote className="w-3.5 h-3.5" />} />
                        <KpiCard label="Returning Customers" value={NUM(kpis.returningCustomers)} icon={<Repeat className="w-3.5 h-3.5" />} />
                    </div>

                    <Card>
                        <CardHeader
                            title="Sales performance"
                            subtitle="Revenue, orders, average order value and profit over time"
                            action={
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded">
                                        {(['revenue', 'orders', 'aov', 'profit'] as const).map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => setChartMetric(m)}
                                                className={cn(
                                                    'px-2 py-1 rounded text-[13px] font-medium capitalize whitespace-nowrap',
                                                    chartMetric === m ? 'bg-white text-blue-950' : 'text-slate-600 hover:text-slate-900',
                                                )}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded">
                                        {(['daily', 'weekly', 'monthly'] as const).map((i) => (
                                            <button
                                                key={i}
                                                onClick={() => setChartInterval(i)}
                                                className={cn(
                                                    'px-2 py-1 rounded text-[13px] font-medium capitalize whitespace-nowrap',
                                                    chartInterval === i ? 'bg-white text-blue-950' : 'text-slate-600 hover:text-slate-900',
                                                )}
                                            >
                                                {i}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            }
                        />
                        <div className="h-64 w-full p-2">
                            {chartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-[13px] text-slate-400">
                                    No orders in this range.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={13} />
                                        <YAxis stroke="#172554" fontSize={13} />
                                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                                        <Bar dataKey={chartMetric} fill="#172554" radius={[2, 2, 0, 0]} barSize={22} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <Card>
                            <CardHeader title="Sales channels" subtitle="Where orders originate" />
                            <div className="p-2 space-y-2">
                                {channelBreakdown.length === 0 ? (
                                    <EmptyCard icon={<ShoppingBag className="w-5 h-5" />} title="No channels yet" description="Order sources will appear here." />
                                ) : (
                                    channelBreakdown.map((ch) => (
                                        <div key={ch.name} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2 text-[13px]">
                                                <span className="font-medium text-slate-800 truncate">{ch.name}</span>
                                                <span className="font-mono text-slate-600 shrink-0">{KES(ch.revenue)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                                                <div className="h-full rounded" style={{ width: `${ch.share}%`, backgroundColor: ch.color }} />
                                            </div>
                                            <div className="flex items-center justify-between text-[13px] text-slate-500">
                                                <span>{ch.orders} orders</span>
                                                <span>{ch.share}%</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Order status" subtitle="Order counts by status" />
                            <div className="p-2">
                                <div className="h-52 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={statusBreakdown} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                                            <YAxis dataKey="status" type="category" width={110} stroke="#172554" fontSize={13} />
                                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                                            <Bar dataKey="count" fill="#172554" radius={[0, 2, 2, 0]} barSize={16} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader title="Conversion funnel" subtitle="Journey from content to completed order" />
                        <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {funnelStages.map((s, idx) => (
                                <div key={s.stage} className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <div className="text-[13px] text-slate-400">Step {idx + 1}</div>
                                    <div className="font-medium text-slate-900 text-[13px] truncate mt-0.5">{s.stage}</div>
                                    <div className="text-[15px] font-bold text-blue-950 mt-1 tabular-nums">
                                        {s.count === null ? '—' : NUM(s.count)}
                                    </div>
                                    <div className="text-[13px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded inline-block mt-1">
                                        {s.dropoff}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <Card>
                            <CardHeader title="Recent orders" subtitle="Latest orders in range" action={<Link href="/tiktok/TikTokBusiness/OrdersProductsFulfillment" className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></Link>} />
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px] min-w-[520px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                                            <th className="py-2 px-2 font-medium">Order</th>
                                            <th className="py-2 px-2 font-medium">Customer</th>
                                            <th className="py-2 px-2 font-medium text-right">Total</th>
                                            <th className="py-2 px-2 font-medium">Status</th>
                                            <th className="py-2 px-2 font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                                                    No orders in range.
                                                </td>
                                            </tr>
                                        ) : (
                                            recentOrders.map((o) => (
                                                <tr key={o.reference} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2 font-mono font-medium text-slate-900">{o.reference}</td>
                                                    <td className="py-2 px-2 text-slate-700 truncate max-w-[160px]">{o.customerName}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-slate-900">{KES(o.total)}</td>
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
                                                    <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Top products" subtitle="Highest revenue in range" action={<Link href="/tiktok/TikTokBusiness/OrdersProductsFulfillment" className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5">Catalogue <ChevronRight className="w-3 h-3" /></Link>} />
                            <div className="p-2 space-y-1">
                                {topProducts.length === 0 ? (
                                    <EmptyCard icon={<Package className="w-5 h-5" />} title="No product sales" description="Product performance will appear here." />
                                ) : (
                                    topProducts.map((p) => (
                                        <div key={p.sku || p.name} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                            <Thumb src={p.image} className="w-8 h-8" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{p.name}</p>
                                                <p className="text-[13px] text-slate-400 font-mono truncate">{p.sku || '—'}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[13px] font-medium text-slate-900 tabular-nums">{KES(p.revenue)}</p>
                                                <p className="text-[13px] text-slate-400 tabular-nums">{p.units} units</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <Card>
                            <CardHeader title="Customer & lead activity" subtitle="New customers, leads, conversions" action={<Link href="/tiktok/TikTokBusiness/CustomersLeadsInbox" className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5">Open <ChevronRight className="w-3 h-3" /></Link>} />
                            <div className="p-2 grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">New customers</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(kpis.newCustomers)}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">Returning customers</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(kpis.returningCustomers)}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">New leads</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(kpis.leads)}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">Converted leads</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(kpis.convertedLeads)}</p>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Low stock" subtitle="Products running low or out of stock" action={<Link href="/tiktok/TikTokBusiness/OrdersProductsFulfillment" className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5">Fix <ChevronRight className="w-3 h-3" /></Link>} />
                            <div className="p-2 space-y-1">
                                {lowStock.length === 0 ? (
                                    <EmptyCard icon={<Package className="w-5 h-5" />} title="Stock is healthy" description="No low-stock products right now." />
                                ) : (
                                    lowStock.map((p) => (
                                        <div key={String(p.id)} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                            <Thumb src={p.image} className="w-7 h-7" />
                                            <p className="flex-1 text-[13px] font-medium text-slate-900 truncate">{p.name}</p>
                                            <span className={cn('text-[13px] font-mono font-semibold px-1.5 py-0.5 rounded border', p.stockQuantity === 0 ? PRODUCT_STATUS_STYLES.out : PRODUCT_STATUS_STYLES.low)}>
                                                {p.stockQuantity === 0 ? 'Out' : `${p.stockQuantity} left`}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <Card>
                            <CardHeader title="Top creators" subtitle="Creator performance in range" action={<Link href="/tiktok/TikTokBusiness/CreatorsAffiliates" className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5">Manage <ChevronRight className="w-3 h-3" /></Link>} />
                            <div className="p-2 space-y-1">
                                {topCreators.length === 0 ? (
                                    <EmptyCard icon={<UserRound className="w-5 h-5" />} title="No creator activity yet" description="Creator performance will appear here." />
                                ) : (
                                    topCreators.map((c) => (
                                        <div key={c.id} className="flex items-center gap-2 p-1.5 border-b border-slate-100 last:border-0">
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
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Marketing" subtitle="Content, views, campaigns" action={<Link href="/tiktok/TikTokBusiness/MarketingContentCampaigns" className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-0.5">Open <ChevronRight className="w-3 h-3" /></Link>} />
                            <div className="p-2 grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">Published content</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(content.filter((c) => c.status === 'Posted').length)}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">Scheduled</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(content.filter((c) => c.status === 'Scheduled').length)}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">Total views</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(content.reduce((a, c) => a + Number(c.views || 0), 0))}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                                    <p className="text-[13px] text-slate-500">LIVE sessions</p>
                                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{NUM(lives.length)}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                        <Card className="lg:col-span-2">
                            <CardHeader title="Business activity" subtitle="What's been happening" />
                            <div className="p-2 space-y-1">
                                {activityFeed.length === 0 ? (
                                    <EmptyCard icon={<Clock className="w-5 h-5" />} title="No activity yet" description="Activity will appear as things happen." />
                                ) : (
                                    activityFeed.map((item) => (
                                        <div key={item.id} className="flex items-start gap-2 p-1.5 border-b border-slate-100 last:border-0">
                                            <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                                {item.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-slate-900 truncate">{item.title}</p>
                                                <p className="text-[13px] text-slate-500 truncate">{item.detail}</p>
                                            </div>
                                            <span className="text-[13px] text-slate-400 shrink-0 whitespace-nowrap">{formatTimeAgo(item.time)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Attention needed" subtitle="Resolve issues across modules" />
                            <div className="p-2 space-y-1">
                                {alerts.length === 0 ? (
                                    <EmptyCard icon={<Sparkles className="w-5 h-5" />} title="All clear" description="Nothing needs your attention right now." />
                                ) : (
                                    alerts.map((a) => (
                                        <Link
                                            key={a.id}
                                            href={a.href}
                                            className="flex items-center gap-2 p-2 border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="shrink-0">{a.icon}</span>
                                            <span className="flex-1 text-[13px] font-medium text-slate-900 truncate">{a.title}</span>
                                            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                        </Link>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader title="Quick actions" subtitle="Jump into a module" />
                        <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            <QuickAction href="/tiktok/TikTokBusiness/CustomersLeadsInbox" icon={<UserRound className="w-3.5 h-3.5" />} title="Record lead" />
                            <QuickAction href="/tiktok/TikTokBusiness/OrdersProductsFulfillment" icon={<ShoppingBag className="w-3.5 h-3.5" />} title="Create order" />
                            <QuickAction href="/tiktok/TikTokBusiness/OrdersProductsFulfillment" icon={<Package className="w-3.5 h-3.5" />} title="Add product" />
                            <QuickAction href="/tiktok/TikTokBusiness/OrdersProductsFulfillment" icon={<Truck className="w-3.5 h-3.5" />} title="Pending orders" />
                            <QuickAction href="/tiktok/TikTokBusiness/CustomersLeadsInbox" icon={<Users className="w-3.5 h-3.5" />} title="Inbox" />
                            <QuickAction href="/tiktok/TikTokBusiness/CreatorsAffiliates" icon={<Banknote className="w-3.5 h-3.5" />} title="Commissions" />
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}