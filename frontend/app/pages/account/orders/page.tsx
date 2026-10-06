'use client';

import React, {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ShoppingBag, Eye, X, Download, Truck, RefreshCw, MessageCircle,
    Check, MapPin, CreditCard, Package, Clock, Loader2, AlertCircle,
    Ban, PackageCheck, Tag,
} from 'lucide-react';
import {
    accountApi,
    whatsappApi,
    ApiError,
    type OrderDetail,
    type OrderListRow,
    type OrderStatus as ApiOrderStatus,
    type OrderItem as ApiOrderItem,
} from '@/lib/api';
import { useCart } from '@/lib/store/cart';

// ─────────────────────────────────────────────────────────────────────────────
// Local view types
// ─────────────────────────────────────────────────────────────────────────────
type UiStatus =
    | 'Pending'
    | 'Confirmed'
    | 'Processing'
    | 'Shipped'
    | 'Delivered'
    | 'Returned'
    | 'Cancelled'
    | 'Failed';

type UiPaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';

interface OrderViewItem {
    key: string;      // String(id) — the account serializer sends `id`
    productId: string;
    name: string;
    brand: string;
    price: number;
    quantity: number;
    image: string;
}

interface PreviewItem {
    image: string;
    name: string;
    quantity: number;
}

interface OrderView {
    reference: string;
    date: string;
    status: UiStatus;
    paymentStatus: UiPaymentStatus;
    items: OrderViewItem[];
    previewItems: PreviewItem[];
    itemCount: number;
    total: number;
    subtotal: number;
    discount: number;
    coupon: string | null;
    shipping: number;
    vat: number;
    paymentMethod: string;
    paymentRef: string;
    courier?: string;
    trackingNumber?: string;
    estimatedDelivery: string;
    shippingAddress: {
        name: string;
        street: string;
        town: string;
        county: string;
        postalCode: string;
        phone: string;
    };
    timeline: { status: string; date: string; note?: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatKES = (n: number | string): string => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (!Number.isFinite(num)) return 'KES 0';
    return `KES ${num.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
};

const numOr0 = (v: string | number | null | undefined): number => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n as number) ? (n as number) : 0;
};

const mapStatus = (status: ApiOrderStatus): UiStatus => {
    switch (status) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'processing': return 'Processing';
        case 'shipped': return 'Shipped';
        case 'delivered': return 'Delivered';
        case 'returned': return 'Returned';
        case 'cancelled': return 'Cancelled';
        case 'failed': return 'Failed';
        default: return 'Pending';
    }
};

const statusColor = (status: UiStatus): string => {
    switch (status) {
        case 'Delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Shipped':
            return 'bg-blue-50 text-blue-900 border-blue-200';
        case 'Processing':
            return 'bg-indigo-50 text-indigo-900 border-indigo-200';
        case 'Confirmed':
            return 'bg-sky-50 text-sky-900 border-sky-200';
        case 'Returned':
            return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'Cancelled':
        case 'Failed':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'Pending':
        default:
            return 'bg-amber-50 text-amber-700 border-amber-200';
    }
};

const paymentStatusBadge = (status: UiPaymentStatus): string | null => {
    switch (status) {
        case 'paid':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'unpaid':
            return 'bg-slate-50 text-slate-600 border-slate-200';
        case 'refunded':
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'failed':
            return 'bg-red-50 text-red-700 border-red-200';
        default:
            return null;
    }
};

const paymentStatusLabel = (status: UiPaymentStatus): string => {
    switch (status) {
        case 'paid': return 'Paid';
        case 'unpaid': return 'Unpaid';
        case 'refunded': return 'Refunded';
        case 'failed': return 'Payment failed';
        default: return status;
    }
};

const formatDateShort = (iso: string): string => {
    try {
        return new Date(iso).toLocaleDateString('en-KE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
};

const formatDateTime = (iso: string): string => {
    try {
        return new Date(iso).toLocaleString('en-KE', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

const canReject = (status: UiStatus): boolean =>
    status === 'Pending' || status === 'Confirmed' || status === 'Processing';

const canClaim = (status: UiStatus): boolean => status === 'Shipped';

const listRowToView = (row: OrderListRow): OrderView => ({
    reference: row.reference,
    date: formatDateShort(row.created_at),
    status: mapStatus(row.status),
    paymentStatus: row.payment_status,
    items: [],
    previewItems: row.preview_items ?? [],
    itemCount: row.item_count,
    total: numOr0(row.total),
    subtotal: 0,
    discount: 0,
    coupon: null,
    shipping: 0,
    vat: 0,
    paymentMethod: '',
    paymentRef: '',
    estimatedDelivery: '',
    shippingAddress: {
        name: '', street: '', town: '', county: '', postalCode: '', phone: '',
    },
    timeline: [],
});

/**
 * Map the account detail payload to the local view shape.
 *
 * The `items` array here comes from `account.serializers.OrderItemSerializer`,
 * which uses `price` and `image` (NOT `unit_price` / `image_url`).
 * The checkout app has a different serializer with the other names —
 * don't mix them up. See the doc comment on `OrderItem` in `lib/api.ts`.
 */
const detailToView = (d: OrderDetail): OrderView => {
    const items: OrderViewItem[] = (d.items || []).map(
        (i: ApiOrderItem) => ({
            key: String(i.id),
            productId: i.product_id,
            name: i.name,
            brand: i.brand,
            price: numOr0(i.price),
            quantity: i.quantity,
            image: i.image,
        }),
    );

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    return {
        reference: d.reference,
        date: formatDateShort(d.created_at),
        status: mapStatus(d.status),
        paymentStatus: d.payment_status,
        items,
        previewItems: items.slice(0, 4).map((i) => ({
            image: i.image,
            name: i.name,
            quantity: i.quantity,
        })),
        itemCount,
        total: numOr0(d.total),
        subtotal: numOr0(d.subtotal),
        discount: numOr0(d.discount),
        coupon: d.coupon || null,
        shipping: numOr0(d.shipping),
        vat: numOr0(d.tax),
        paymentMethod:
            d.payment_method === 'MPESA' ? 'M-PESA' : 'Cash on delivery',
        paymentRef: d.mpesa_receipt || d.payment_reference || '—',
        courier: d.courier || undefined,
        trackingNumber: d.tracking_number || undefined,
        estimatedDelivery: d.estimated_delivery,
        shippingAddress: {
            name: d.full_name,
            street: d.address_street,
            town: d.address_town,
            county: d.address_county,
            postalCode: d.address_postal_code,
            phone: d.phone,
        },
        timeline: (d.timeline || []).map((e) => ({
            status: e.status,
            date: e.created_at,
            note: e.note || undefined,
        })),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
    'All', 'Pending', 'Confirmed', 'Processing',
    'Shipped', 'Delivered', 'Failed', 'Cancelled', 'Returned',
] as const;
type Tab = typeof TABS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Outer — Suspense wrapper for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
    return (
        <Suspense
            fallback={
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Loading orders…
                </div>
            }
        >
            <OrdersInner />
        </Suspense>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner
// ─────────────────────────────────────────────────────────────────────────────
function OrdersInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const addToCart = useCart((s) => s.addItem);

    const [activeTab, setActiveTab] = useState<Tab>('All');
    const [search, setSearch] = useState('');
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [detail, setDetail] = useState<OrderView | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [reordering, setReordering] = useState(false);
    const [supportLoading, setSupportLoading] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);

    const [toast, setToast] = useState<string | null>(null);
    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const refreshOrders = useCallback(async () => {
        try {
            const rows = await accountApi.orders.list();
            setOrders(rows.map(listRowToView));
        } catch {
            /* caller already flashed an error */
        }
    }, []);

    const openDetail = useCallback(
        async (reference: string, silent = false) => {
            setDetailLoading(true);

            const fromList = orders.find((o) => o.reference === reference);
            if (fromList) setDetail(fromList);

            if (!silent) {
                router.replace(
                    `/pages/account/orders?ref=${encodeURIComponent(reference)}`,
                    { scroll: false },
                );
            }

            try {
                const full = await accountApi.orders.detail(reference);
                setDetail(detailToView(full));
            } catch {
                /* keep partial from list */
            } finally {
                setDetailLoading(false);
            }
        },
        [orders, router],
    );

    const closeDetail = useCallback(() => {
        setDetail(null);
        setDetailLoading(false);
        setRejectOpen(false);
        router.replace('/pages/account/orders', { scroll: false });
    }, [router]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const rows = await accountApi.orders.list();
                if (cancelled) return;
                setOrders(rows.map(listRowToView));
            } catch (err) {
                if (cancelled) return;
                setErrorMessage(
                    err instanceof ApiError
                        ? err.message || 'Could not load your orders.'
                        : 'Could not load your orders.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (orders.length === 0) return;

        const ref = searchParams.get('ref');
        if (!ref) return;

        const match = orders.find((o) => o.reference === ref);
        if (match) {
            openDetail(ref, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders, searchParams]);

    useEffect(() => {
        if (!detail) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !reordering && !claiming && !rejectOpen) {
                closeDetail();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [detail, reordering, claiming, rejectOpen, closeDetail]);

    useEffect(() => {
        if (!detail) return;

        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [detail]);

    const handleReorder = async (reference: string) => {
        if (reordering) return;
        setReordering(true);

        try {
            const items = await accountApi.orders.reorder(reference);

            if (items.length === 0) {
                flash('No items to reorder.');
                return;
            }

            let succeeded = 0;
            let failed = 0;

            for (const item of items) {
                const qty = Math.max(1, item.quantity);
                for (let i = 0; i < qty; i++) {
                    try {
                        await addToCart({
                            variantId: item.variant_id,
                            productId: item.product_id,
                            name: item.name,
                            brand: item.brand,
                            image: item.image,
                            unitPrice: parseFloat(item.unit_price),
                            slug: item.slug,
                        });
                        succeeded += 1;
                    } catch {
                        failed += 1;
                        break;
                    }
                }
            }

            if (failed === 0) {
                flash(
                    `Added ${succeeded} item${succeeded !== 1 ? 's' : ''} to cart.`,
                );
            } else if (succeeded === 0) {
                flash(`Could not add ${failed} item${failed !== 1 ? 's' : ''}.`);
            } else {
                flash(`Added ${succeeded}; ${failed} failed.`);
            }
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not reorder.'
                    : 'Could not reorder.',
            );
        } finally {
            setReordering(false);
        }
    };

    const handleSupport = async (reference: string) => {
        if (supportLoading) return;
        setSupportLoading(true);
        try {
            const link = await whatsappApi.orderLink(reference);
            window.open(link.whatsappUrl, '_blank', 'noopener,noreferrer');
        } catch {
            flash('Could not open WhatsApp support.');
        } finally {
            setSupportLoading(false);
        }
    };

    const handleClaim = async (reference: string) => {
        if (claiming) return;
        if (
            !window.confirm(
                'Confirm you have received this order? This closes the delivery.',
            )
        ) {
            return;
        }

        setClaiming(true);
        try {
            await accountApi.orders.claim(reference);
            flash('Thanks — receipt confirmed.');
            await refreshOrders();
            await openDetail(reference, true);
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not confirm receipt.'
                    : 'Could not confirm receipt.',
            );
        } finally {
            setClaiming(false);
        }
    };

    const handleReject = async (reference: string, reason: string) => {
        await accountApi.orders.reject(reference, reason);
        setRejectOpen(false);
        flash('Order cancelled.');
        await refreshOrders();
        await openDetail(reference, true);
    };

    const filtered = useMemo(() => {
        return orders
            .filter((o) => {
                if (activeTab === 'All') return true;
                return o.status === activeTab;
            })
            .filter((o) => {
                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return (
                    o.reference.toLowerCase().includes(q) ||
                    o.previewItems.some((i) => i.name.toLowerCase().includes(q))
                );
            });
    }, [orders, activeTab, search]);

    return (
        <div className="space-y-5">
            {toast && (
                <div className="fixed bottom-6 right-6 z-[80] bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-start gap-2 max-w-md">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{toast}</span>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-sm p-5">
                <h1 className="text-lg font-bold text-slate-900">My Orders</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                    Track, review, and manage all your purchases
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {TABS.map((tab) => {
                        const isActive = tab === activeTab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive
                                    ? 'bg-blue-950 text-white'
                                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search orders or products…"
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
            </div>

            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {errorMessage}
                </div>
            )}

            {isLoading ? (
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Loading orders…
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                    <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-sm font-semibold text-slate-900">
                        {orders.length === 0 ? 'No orders yet' : 'No orders found'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        {orders.length === 0
                            ? 'Place your first order to see it here.'
                            : 'Try a different filter or search term.'}
                    </p>
                    {orders.length === 0 && (
                        <Link
                            href="/pages/products"
                            className="mt-4 inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                        >
                            Browse Products
                        </Link>
                    )}
                </div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map((order) => {
                        const payBadge = paymentStatusBadge(order.paymentStatus);
                        return (
                            <li
                                key={order.reference}
                                className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-sm font-semibold text-slate-900 font-mono">
                                            #{order.reference}
                                        </span>
                                        <span
                                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusColor(order.status)}`}
                                        >
                                            {order.status}
                                        </span>
                                        {payBadge && (
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded border ${payBadge}`}
                                            >
                                                {paymentStatusLabel(order.paymentStatus)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        Placed {order.date}
                                    </div>
                                </div>

                                <div className="p-4">
                                    {order.previewItems.length > 0 ? (
                                        <div className="flex items-center gap-3 overflow-x-auto">
                                            {order.previewItems.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-2 shrink-0"
                                                >
                                                    <img
                                                        src={item.image || '/placeholder.png'}
                                                        alt={item.name}
                                                        className="h-12 w-12 rounded-sm object-cover border border-slate-200"
                                                    />
                                                    <div className="hidden sm:block min-w-0 max-w-[180px]">
                                                        <p className="text-xs font-medium text-slate-900 truncate">
                                                            {item.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500">
                                                            Qty {item.quantity}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {order.itemCount > order.previewItems.length && (
                                                <span className="text-xs text-slate-500 shrink-0">
                                                    +{order.itemCount - order.previewItems.length} more
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500">
                                            {order.itemCount} item
                                            {order.itemCount === 1 ? '' : 's'}
                                        </p>
                                    )}
                                </div>

                                <div className="p-4 pt-0 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] text-slate-500">Total</p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {formatKES(order.total)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openDetail(order.reference)}
                                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition-colors"
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        Details
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {detail && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/70 backdrop-blur-sm"
                    onClick={() => !reordering && !claiming && !rejectOpen && closeDetail()}
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                                    Order
                                </p>
                                <h2 className="text-base font-bold text-slate-900 font-mono truncate">
                                    #{detail.reference}
                                </h2>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span
                                    className={`text-[11px] font-medium px-2.5 py-1 rounded border ${statusColor(detail.status)}`}
                                >
                                    {detail.status}
                                </span>
                                {detail.paymentStatus === 'refunded' && (
                                    <span className="text-[11px] font-medium px-2.5 py-1 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                                        Refunded
                                    </span>
                                )}
                                {detail.paymentStatus === 'failed' && (
                                    <span className="text-[11px] font-medium px-2.5 py-1 rounded border bg-red-50 text-red-700 border-red-200">
                                        Payment failed
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={closeDetail}
                                    disabled={reordering || claiming}
                                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 disabled:opacity-40"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto p-5 space-y-5">
                            {detailLoading ? (
                                <div className="py-12 text-center text-xs text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                    Loading order details…
                                </div>
                            ) : (
                                <>
                                    {detail.timeline.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                                                Delivery Progress
                                            </h3>
                                            <ol className="space-y-3">
                                                {detail.timeline.map((step, idx) => {
                                                    const isLast = idx === detail.timeline.length - 1;
                                                    const isCancelled = step.status === 'Cancelled';
                                                    const isFailed = step.status === 'Failed';
                                                    const isReturned = step.status === 'Returned';
                                                    return (
                                                        <li key={idx} className="flex gap-3">
                                                            <div className="flex flex-col items-center">
                                                                <span
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isCancelled || isFailed
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : isReturned
                                                                            ? 'bg-orange-100 text-orange-700'
                                                                            : isLast
                                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                                : 'bg-blue-100 text-blue-900'
                                                                        }`}
                                                                >
                                                                    {isCancelled || isFailed ? (
                                                                        <X className="h-3.5 w-3.5" />
                                                                    ) : isReturned ? (
                                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                                    ) : (
                                                                        <Check className="h-3.5 w-3.5" />
                                                                    )}
                                                                </span>
                                                                {idx < detail.timeline.length - 1 && (
                                                                    <span className="w-px flex-1 bg-slate-200 my-1" />
                                                                )}
                                                            </div>
                                                            <div className="pb-3">
                                                                <p className="text-xs font-semibold text-slate-900">
                                                                    {step.status}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500">
                                                                    {formatDateTime(step.date)}
                                                                </p>
                                                                {step.note && (
                                                                    <p className="text-[11px] text-slate-600 mt-0.5 italic">
                                                                        {step.note}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ol>
                                        </section>
                                    )}

                                    {(detail.trackingNumber ||
                                        detail.courier ||
                                        detail.estimatedDelivery) && (
                                            <section className="bg-slate-50 border border-slate-200 rounded-sm p-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                                    {detail.courier && (
                                                        <div>
                                                            <p className="text-slate-500 mb-0.5 flex items-center gap-1">
                                                                <Truck className="h-3 w-3" /> Courier
                                                            </p>
                                                            <p className="font-semibold text-slate-900">
                                                                {detail.courier}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {detail.trackingNumber && (
                                                        <div>
                                                            <p className="text-slate-500 mb-0.5">
                                                                Tracking No.
                                                            </p>
                                                            <p className="font-mono text-slate-900">
                                                                {detail.trackingNumber}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {detail.estimatedDelivery && (
                                                        <div>
                                                            <p className="text-slate-500 mb-0.5 flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> ETA
                                                            </p>
                                                            <p className="font-semibold text-slate-900">
                                                                {detail.estimatedDelivery}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        )}

                                    <section>
                                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
                                            <Package className="h-3.5 w-3.5" /> Items (
                                            {detail.items.length})
                                        </h3>
                                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-sm overflow-hidden">
                                            {detail.items.map((item) => (
                                                <li
                                                    key={item.key}
                                                    className="flex items-center gap-3 p-3"
                                                >
                                                    <img
                                                        src={item.image || '/placeholder.png'}
                                                        alt={item.name}
                                                        className="h-14 w-14 rounded-sm object-cover border border-slate-200 shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] uppercase text-slate-500 font-medium">
                                                            {item.brand}
                                                        </p>
                                                        <p className="text-xs font-semibold text-slate-900 truncate">
                                                            {item.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                                            Qty {item.quantity}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-bold text-slate-900">
                                                            {formatKES(item.price * item.quantity)}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500">
                                                            {formatKES(item.price)} each
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <section className="border border-slate-200 rounded-sm p-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5" /> Shipping Address
                                            </h3>
                                            <p className="text-xs text-slate-700 leading-relaxed">
                                                <span className="font-semibold text-slate-900">
                                                    {detail.shippingAddress.name}
                                                </span>
                                                <br />
                                                {detail.shippingAddress.street}
                                                <br />
                                                {detail.shippingAddress.town},{' '}
                                                {detail.shippingAddress.county}
                                                <br />
                                                {detail.shippingAddress.postalCode &&
                                                    `${detail.shippingAddress.postalCode} • `}
                                                {detail.shippingAddress.phone}
                                            </p>
                                        </section>

                                        <section className="border border-slate-200 rounded-sm p-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                                                <CreditCard className="h-3.5 w-3.5" /> Payment
                                            </h3>
                                            <p className="text-xs text-slate-700">
                                                <span className="text-slate-500">Method:</span>{' '}
                                                <span className="font-semibold text-slate-900">
                                                    {detail.paymentMethod}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-700 mt-1">
                                                <span className="text-slate-500">Reference:</span>{' '}
                                                <span className="font-mono text-slate-900">
                                                    {detail.paymentRef}
                                                </span>
                                            </p>
                                            {detail.paymentStatus === 'refunded' && (
                                                <p className="text-xs mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    <RefreshCw className="h-3 w-3" />
                                                    Refunded to original method
                                                </p>
                                            )}
                                            {detail.paymentStatus === 'failed' && (
                                                <p className="text-xs mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-red-50 text-red-700 border border-red-200">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Payment was not completed
                                                </p>
                                            )}
                                        </section>
                                    </div>

                                    <section className="border border-slate-200 rounded-sm p-4 space-y-2 text-xs">
                                        <div className="flex justify-between text-slate-700">
                                            <span>Subtotal</span>
                                            <span className="font-medium">
                                                {formatKES(detail.subtotal)}
                                            </span>
                                        </div>

                                        {detail.discount > 0 && (
                                            <div className="flex justify-between text-emerald-700">
                                                <span className="inline-flex items-center gap-1">
                                                    <Tag className="h-3 w-3" />
                                                    Discount
                                                    {detail.coupon ? ` (${detail.coupon})` : ''}
                                                </span>
                                                <span className="font-medium">
                                                    − {formatKES(detail.discount)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex justify-between text-slate-700">
                                            <span>Shipping</span>
                                            <span className="font-medium">
                                                {detail.shipping === 0
                                                    ? 'Free'
                                                    : formatKES(detail.shipping)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-700">
                                            <span>
                                                VAT
                                                {detail.subtotal - detail.discount > 0 &&
                                                    detail.vat > 0
                                                    ? ` (${Math.round(
                                                        (detail.vat /
                                                            (detail.subtotal - detail.discount)) *
                                                        100,
                                                    )}%)`
                                                    : ''}
                                            </span>
                                            <span className="font-medium">
                                                {formatKES(detail.vat)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                                            <span className="font-bold text-slate-900">Total</span>
                                            <span className="font-bold text-slate-900">
                                                {formatKES(detail.total)}
                                            </span>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => flash('Invoice download coming soon.')}
                                disabled={detailLoading}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs disabled:opacity-50"
                            >
                                <Download className="h-3.5 w-3.5" /> Invoice
                            </button>

                            {detail.trackingNumber && (
                                <button
                                    type="button"
                                    onClick={() => flash('Tracking link not available yet.')}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs"
                                >
                                    <Truck className="h-3.5 w-3.5" /> Track
                                </button>
                            )}

                            {detail.status === 'Delivered' && (
                                <button
                                    type="button"
                                    onClick={() => handleReorder(detail.reference)}
                                    disabled={reordering}
                                    aria-busy={reordering}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs disabled:opacity-60"
                                >
                                    {reordering ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Adding…
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="h-3.5 w-3.5" /> Reorder
                                        </>
                                    )}
                                </button>
                            )}

                            {canReject(detail.status) && (
                                <button
                                    type="button"
                                    onClick={() => setRejectOpen(true)}
                                    disabled={reordering || claiming}
                                    className="inline-flex items-center gap-1.5 bg-white border border-red-300 hover:bg-red-50 text-red-700 font-medium px-3 py-2 rounded-sm text-xs disabled:opacity-60"
                                >
                                    <Ban className="h-3.5 w-3.5" />
                                    Cancel Order
                                </button>
                            )}

                            {canClaim(detail.status) && (
                                <button
                                    type="button"
                                    onClick={() => handleClaim(detail.reference)}
                                    disabled={claiming}
                                    aria-busy={claiming}
                                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-xs disabled:opacity-60"
                                >
                                    {claiming ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Confirming…
                                        </>
                                    ) : (
                                        <>
                                            <PackageCheck className="h-3.5 w-3.5" />
                                            Confirm Received
                                        </>
                                    )}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => handleSupport(detail.reference)}
                                disabled={supportLoading}
                                aria-busy={supportLoading}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs disabled:opacity-60"
                            >
                                {supportLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <MessageCircle className="h-3.5 w-3.5" />
                                )}
                                Support
                            </button>

                            <button
                                type="button"
                                onClick={closeDetail}
                                disabled={reordering || claiming}
                                className="ml-auto inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs disabled:opacity-60"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {rejectOpen && detail && (
                <RejectModal
                    reference={detail.reference}
                    onClose={() => setRejectOpen(false)}
                    onSubmit={(reason) => handleReject(detail.reference, reason)}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RejectModal
// ─────────────────────────────────────────────────────────────────────────────
function RejectModal({
    reference,
    onClose,
    onSubmit,
}: {
    reference: string;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setError('');
        setSubmitting(true);
        try {
            await onSubmit(reason.trim());
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message || 'Could not cancel this order.'
                    : 'Could not cancel this order.',
            );
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={() => !submitting && onClose()}
        >
            <div
                className="bg-white w-full max-w-md rounded-sm shadow-xl border border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-200 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        <Ban className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                            Cancel order #{reference}?
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                            This cannot be undone. If the order has already shipped, contact
                            support instead.
                        </p>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    <label className="block">
                        <span className="block text-xs font-medium text-slate-700 mb-1">
                            Reason (optional)
                        </span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={submitting}
                            rows={3}
                            maxLength={500}
                            placeholder="Changed my mind, ordered by mistake…"
                            className="w-full border border-slate-200 rounded-sm px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
                        />
                    </label>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm text-xs flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="text-xs font-medium px-3 py-2 rounded-sm border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                        Keep order
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={submitting}
                        className="text-xs font-medium px-3 py-2 rounded-sm bg-red-600 hover:bg-red-500 text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                        {submitting && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Cancel order
                    </button>
                </div>
            </div>
        </div>
    );
}