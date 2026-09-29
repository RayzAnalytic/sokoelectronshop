'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ShoppingBag, Eye, X, Download, Truck, RefreshCw, MessageCircle,
    Check, MapPin, CreditCard, Package, Clock, Loader2,
} from 'lucide-react';
import {
    accountApi,
    ApiError,
    type OrderDetail,
    type OrderListRow,
    type OrderStatus as ApiOrderStatus,
    type OrderItem as ApiOrderItem,
    type DeliveryMethod,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Local view types (what the UI renders with)
// ─────────────────────────────────────────────────────────────────────────────
type UiStatus = 'Pending' | 'Processing' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';

interface OrderViewItem {
    id: string;
    productId: string;
    name: string;
    brand: string;
    price: number;
    quantity: number;
    image: string;
}

interface OrderView {
    reference: string;
    date: string;
    status: UiStatus;
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
    items: OrderViewItem[];
    itemCount: number;
    total: number;
    subtotal: number;
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

const mapStatus = (status: ApiOrderStatus): UiStatus => {
    switch (status) {
        case 'pending': return 'Pending';
        case 'processing': return 'Processing';
        case 'packed': return 'Packed';
        case 'shipped': return 'Shipped';
        case 'delivered': return 'Delivered';
        case 'cancelled': return 'Cancelled';
        default: return 'Pending';
    }
};

const statusColor = (status: UiStatus): string => {
    switch (status) {
        case 'Delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Shipped':
            return 'bg-blue-50 text-blue-900 border-blue-200';
        case 'Packed':
            return 'bg-indigo-50 text-indigo-900 border-indigo-200';
        case 'Cancelled':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'Processing':
        case 'Pending':
        default:
            return 'bg-amber-50 text-amber-700 border-amber-200';
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

// Map list-row → partial OrderView (enough for the card)
const listRowToView = (row: OrderListRow): OrderView => ({
    reference: row.reference,
    date: formatDateShort(row.created_at),
    status: mapStatus(row.status),
    paymentStatus: row.payment_status,
    items: [],
    itemCount: row.item_count,
    total: parseFloat(row.total),
    subtotal: 0,
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

// Map full detail → OrderView (everything the modal needs)
const detailToView = (d: OrderDetail): OrderView => ({
    reference: d.reference,
    date: formatDateShort(d.created_at),
    status: mapStatus(d.status),
    paymentStatus: d.payment_status,
    items: (d.items || []).map((i: ApiOrderItem) => ({
        id: String(i.id),
        productId: i.product_id,
        name: i.name,
        brand: i.brand,
        price: parseFloat(i.price),
        quantity: i.quantity,
        image: i.image,
    })),
    itemCount: d.items.length,
    total: parseFloat(d.total),
    subtotal: parseFloat(d.subtotal),
    shipping: parseFloat(d.shipping),
    vat: parseFloat(d.tax),
    paymentMethod: d.payment_method === 'MPESA' ? 'M-PESA' : 'Cash on delivery',
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
const TABS = ['All', 'Pending', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'] as const;
type Tab = typeof TABS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState<Tab>('All');
    const [search, setSearch] = useState('');
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    // Modal state: full detail fetched on demand
    const [detail, setDetail] = useState<OrderView | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // ── Fetch list on mount ──
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

    // ── Open detail modal — fetch full order ──
    const openDetail = async (reference: string) => {
        setDetailLoading(true);
        // Seed the modal with the list-row shape so the header renders immediately.
        const fromList = orders.find((o) => o.reference === reference);
        if (fromList) setDetail(fromList);

        try {
            const full = await accountApi.orders.detail(reference);
            setDetail(detailToView(full));
        } catch {
            // If detail fails, keep the partial list view — user still sees something.
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setDetail(null);
        setDetailLoading(false);
    };

    // ── Filter + search ──
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
                    o.items.some((i) => i.name.toLowerCase().includes(q))
                );
            });
    }, [orders, activeTab, search]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-sm p-5">
                <h1 className="text-lg font-bold text-slate-900">My Orders</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                    Track, review, and manage all your purchases
                </p>
            </div>

            {/* Tabs + search */}
            <div className="bg-white border border-slate-200 rounded-sm p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {TABS.map((tab) => {
                        const isActive = tab === activeTab;
                        return (
                            <button
                                key={tab}
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

            {/* Error banner */}
            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs">
                    {errorMessage}
                </div>
            )}

            {/* Loading / Empty / List */}
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
                    <Link
                        href="/pages/products"
                        className="mt-4 inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                    >
                        Browse Products
                    </Link>
                </div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map((order) => (
                        <li
                            key={order.reference}
                            className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                        >
                            {/* Top row */}
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
                                    {order.paymentStatus === 'paid' && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                                            Paid
                                        </span>
                                    )}
                                    {order.paymentStatus === 'unpaid' && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                                            Unpaid
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    Placed {order.date}
                                </div>
                            </div>

                            {/* Items preview / summary */}
                            <div className="p-4">
                                {order.items.length > 0 ? (
                                    <div className="flex items-center gap-3 overflow-x-auto">
                                        {order.items.slice(0, 4).map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 shrink-0">
                                                <img
                                                    src={item.image}
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
                                        {order.items.length > 4 && (
                                            <span className="text-xs text-slate-500">
                                                +{order.items.length - 4} more
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500">
                                        {order.itemCount} item
                                        {order.itemCount === 1 ? '' : 's'} ·{' '}
                                        <span className="text-slate-400">
                                            Open details to view
                                        </span>
                                    </p>
                                )}
                            </div>

                            {/* Bottom row */}
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
                    ))}
                </ul>
            )}

            {/* Details modal */}
            {detail && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/70 backdrop-blur-sm"
                    onClick={closeDetail}
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
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
                                <button
                                    type="button"
                                    onClick={closeDetail}
                                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto p-5 space-y-5">
                            {detailLoading ? (
                                <div className="py-12 text-center text-xs text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                    Loading order details…
                                </div>
                            ) : (
                                <>
                                    {/* Timeline */}
                                    {detail.timeline.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                                                Delivery Progress
                                            </h3>
                                            <ol className="space-y-3">
                                                {detail.timeline.map((step, idx) => {
                                                    const isLast = idx === detail.timeline.length - 1;
                                                    const isCancelled = step.status === 'Cancelled';
                                                    return (
                                                        <li key={idx} className="flex gap-3">
                                                            <div className="flex flex-col items-center">
                                                                <span
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isCancelled
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : isLast
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : 'bg-blue-100 text-blue-900'
                                                                        }`}
                                                                >
                                                                    {isCancelled ? (
                                                                        <X className="h-3.5 w-3.5" />
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

                                    {/* Tracking + ETA */}
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

                                    {/* Items */}
                                    <section>
                                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
                                            <Package className="h-3.5 w-3.5" /> Items (
                                            {detail.items.length})
                                        </h3>
                                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-sm overflow-hidden">
                                            {detail.items.map((item, idx) => (
                                                <li
                                                    key={idx}
                                                    className="flex items-center gap-3 p-3"
                                                >
                                                    <img
                                                        src={item.image}
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
                                                            {formatKES(
                                                                item.price * item.quantity,
                                                            )}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500">
                                                            {formatKES(item.price)} each
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>

                                    {/* Two-column: address + payment */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <section className="border border-slate-200 rounded-sm p-4">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5" /> Shipping
                                                Address
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
                                                <span className="text-slate-500">
                                                    Method:
                                                </span>{' '}
                                                <span className="font-semibold text-slate-900">
                                                    {detail.paymentMethod}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-700 mt-1">
                                                <span className="text-slate-500">
                                                    Reference:
                                                </span>{' '}
                                                <span className="font-mono text-slate-900">
                                                    {detail.paymentRef}
                                                </span>
                                            </p>
                                        </section>
                                    </div>

                                    {/* Totals */}
                                    <section className="border border-slate-200 rounded-sm p-4 space-y-2 text-xs">
                                        <div className="flex justify-between text-slate-700">
                                            <span>Subtotal</span>
                                            <span className="font-medium">
                                                {formatKES(detail.subtotal)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-700">
                                            <span>Shipping</span>
                                            <span className="font-medium">
                                                {detail.shipping === 0
                                                    ? 'Free'
                                                    : formatKES(detail.shipping)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-700">
                                            <span>VAT (16%)</span>
                                            <span className="font-medium">
                                                {formatKES(detail.vat)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                                            <span className="font-bold text-slate-900">
                                                Total
                                            </span>
                                            <span className="font-bold text-slate-900">
                                                {formatKES(detail.total)}
                                            </span>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 shrink-0">
                            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                <Download className="h-3.5 w-3.5" /> Invoice
                            </button>
                            {detail.trackingNumber && (
                                <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                    <Truck className="h-3.5 w-3.5" /> Track
                                </button>
                            )}
                            {detail.status === 'Delivered' && (
                                <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                    <RefreshCw className="h-3.5 w-3.5" /> Reorder
                                </button>
                            )}
                            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                <MessageCircle className="h-3.5 w-3.5" /> Support
                            </button>
                            <button
                                type="button"
                                onClick={closeDetail}
                                className="ml-auto inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}