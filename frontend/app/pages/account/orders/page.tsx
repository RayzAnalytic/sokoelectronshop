'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ShoppingBag, Eye, X, Download, Truck, RefreshCw, MessageCircle,
    Check, MapPin, CreditCard, Package, Clock
} from 'lucide-react';

// ---------- Types (matches what checkout saves) ----------
interface StoredOrderItem {
    id: string;
    productId: string;
    name: string;
    brand: string;
    price: number;
    quantity: number;
    image: string;
}

interface StoredOrder {
    orderId: string;
    date: string;
    total: number;
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    paymentLabel: string;
    deliveryMethod: 'express' | 'standard' | 'pickup';
    estimatedDelivery: string;
    coupon: string | null;
    notes: string | null;
    customer: {
        email: string;
        phone: string;
        fullName: string;
        address: {
            street: string;
            town: string;
            county: string;
            postalCode: string;
        };
    };
    items: StoredOrderItem[];
}

type OrderStatus = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';

interface OrderView {
    id: string;
    date: string;
    status: OrderStatus;
    items: StoredOrderItem[];
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

// ---------- Helpers ----------
const formatUSD = (n: number) => `$${n.toFixed(2)}`;

const statusColor = (status: OrderStatus) => {
    switch (status) {
        case 'Delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Shipped':
            return 'bg-blue-50 text-blue-900 border-blue-200';
        case 'Cancelled':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'Pending':
        default:
            return 'bg-amber-50 text-amber-700 border-amber-200';
    }
};

const safeParseDate = (value: string): number => {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
};

const TABS = ['All', 'Pending', 'Shipped', 'Delivered', 'Cancelled'] as const;
type Tab = typeof TABS[number];

export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState<Tab>('All');
    const [search, setSearch] = useState('');
    const [modalOrder, setModalOrder] = useState<OrderView | null>(null);
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Read all `order:*` entries from sessionStorage
    useEffect(() => {
        const loaded: OrderView[] = [];
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (!key?.startsWith('order:')) continue;
                const raw = sessionStorage.getItem(key);
                if (!raw) continue;

                const stored: StoredOrder = JSON.parse(raw);

                loaded.push({
                    id: stored.orderId,
                    date: stored.date,
                    status: 'Pending',
                    items: stored.items,
                    total: stored.total,
                    subtotal: stored.subtotal,
                    shipping: stored.shipping,
                    vat: stored.tax,
                    paymentMethod: stored.paymentLabel,
                    paymentRef: stored.coupon ? `Coupon ${stored.coupon}` : '—',
                    estimatedDelivery: stored.estimatedDelivery,
                    shippingAddress: {
                        name: stored.customer.fullName,
                        street: stored.customer.address.street,
                        town: stored.customer.address.town,
                        county: stored.customer.address.county,
                        postalCode: stored.customer.address.postalCode,
                        phone: stored.customer.phone,
                    },
                    timeline: [
                        {
                            status: 'Order Placed',
                            date: new Date().toISOString(),
                            note: `Paid via ${stored.paymentLabel}`,
                        },
                        {
                            status: 'Processing',
                            date: new Date().toISOString(),
                            note: 'Preparing your items for dispatch',
                        },
                    ],
                });
            }
        } catch {
            // sessionStorage unavailable or corrupted — show empty state
        }
        loaded.sort((a, b) => safeParseDate(b.date) - safeParseDate(a.date));
        setOrders(loaded);
        setIsLoading(false);
    }, []);

    const filtered = useMemo(() => {
        return orders
            .filter((o) => {
                if (activeTab === 'All') return true;
                if (activeTab === 'Pending') return o.status === 'Pending';
                return o.status === activeTab;
            })
            .filter((o) => {
                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return (
                    o.id.toLowerCase().includes(q) ||
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
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                    isActive
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

            {/* Loading */}
            {isLoading ? (
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center text-xs text-slate-500">
                    Loading orders…
                </div>
            ) : filtered.length === 0 ? (
                /* Empty */
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
                        <li key={order.id} className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                            {/* Top row */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-sm font-semibold text-slate-900">{order.id}</span>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusColor(order.status)}`}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    Placed {order.date}
                                </div>
                            </div>

                            {/* Items preview */}
                            <div className="p-4 flex items-center gap-3 overflow-x-auto">
                                {order.items.slice(0, 4).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 shrink-0">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="h-12 w-12 rounded-sm object-cover border border-slate-200"
                                        />
                                        <div className="hidden sm:block min-w-0 max-w-[180px]">
                                            <p className="text-xs font-medium text-slate-900 truncate">{item.name}</p>
                                            <p className="text-[10px] text-slate-500">Qty {item.quantity}</p>
                                        </div>
                                    </div>
                                ))}
                                {order.items.length > 4 && (
                                    <span className="text-xs text-slate-500">+{order.items.length - 4} more</span>
                                )}
                            </div>

                            {/* Bottom row */}
                            <div className="p-4 pt-0 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] text-slate-500">Total</p>
                                    <p className="text-sm font-bold text-slate-900">{formatUSD(order.total)}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalOrder(order)}
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
            {modalOrder && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/70 backdrop-blur-sm"
                    onClick={() => setModalOrder(null)}
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div>
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Order</p>
                                <h2 className="text-base font-bold text-slate-900">{modalOrder.id}</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[11px] font-medium px-2.5 py-1 rounded border ${statusColor(modalOrder.status)}`}>
                                    {modalOrder.status}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setModalOrder(null)}
                                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto p-5 space-y-5">

                            {/* Timeline */}
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                                    Delivery Progress
                                </h3>
                                <ol className="space-y-3">
                                    {modalOrder.timeline.map((step, idx) => {
                                        const isLast = idx === modalOrder.timeline.length - 1;
                                        const isCancelled = step.status === 'Cancelled';
                                        return (
                                            <li key={idx} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                                        isCancelled
                                                            ? 'bg-red-100 text-red-700'
                                                            : isLast
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-blue-100 text-blue-900'
                                                    }`}>
                                                        {isCancelled ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                                    </span>
                                                    {idx < modalOrder.timeline.length - 1 && (
                                                        <span className="w-px flex-1 bg-slate-200 my-1" />
                                                    )}
                                                </div>
                                                <div className="pb-3">
                                                    <p className="text-xs font-semibold text-slate-900">{step.status}</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {new Date(step.date).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    {step.note && (
                                                        <p className="text-[11px] text-slate-600 mt-0.5 italic">{step.note}</p>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>

                            {/* Tracking + ETA */}
                            {(modalOrder.trackingNumber || modalOrder.courier || modalOrder.estimatedDelivery) && (
                                <section className="bg-slate-50 border border-slate-200 rounded-sm p-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        {modalOrder.courier && (
                                            <div>
                                                <p className="text-slate-500 mb-0.5 flex items-center gap-1">
                                                    <Truck className="h-3 w-3" /> Courier
                                                </p>
                                                <p className="font-semibold text-slate-900">{modalOrder.courier}</p>
                                            </div>
                                        )}
                                        {modalOrder.trackingNumber && (
                                            <div>
                                                <p className="text-slate-500 mb-0.5">Tracking No.</p>
                                                <p className="font-mono text-slate-900">{modalOrder.trackingNumber}</p>
                                            </div>
                                        )}
                                        {modalOrder.estimatedDelivery && (
                                            <div>
                                                <p className="text-slate-500 mb-0.5 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> ETA
                                                </p>
                                                <p className="font-semibold text-slate-900">
                                                    {modalOrder.estimatedDelivery}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Items */}
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5" /> Items ({modalOrder.items.length})
                                </h3>
                                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-sm overflow-hidden">
                                    {modalOrder.items.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-3 p-3">
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="h-14 w-14 rounded-sm object-cover border border-slate-200 shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] uppercase text-slate-500 font-medium">{item.brand}</p>
                                                <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Qty {item.quantity}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-slate-900">
                                                    {formatUSD(item.price * item.quantity)}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    {formatUSD(item.price)} each
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
                                        <MapPin className="h-3.5 w-3.5" /> Shipping Address
                                    </h3>
                                    <p className="text-xs text-slate-700 leading-relaxed">
                                        <span className="font-semibold text-slate-900">{modalOrder.shippingAddress.name}</span><br />
                                        {modalOrder.shippingAddress.street}<br />
                                        {modalOrder.shippingAddress.town}, {modalOrder.shippingAddress.county}<br />
                                        {modalOrder.shippingAddress.postalCode && `${modalOrder.shippingAddress.postalCode} • `}
                                        {modalOrder.shippingAddress.phone}
                                    </p>
                                </section>

                                <section className="border border-slate-200 rounded-sm p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5" /> Payment
                                    </h3>
                                    <p className="text-xs text-slate-700">
                                        <span className="text-slate-500">Method:</span>{' '}
                                        <span className="font-semibold text-slate-900">{modalOrder.paymentMethod}</span>
                                    </p>
                                    <p className="text-xs text-slate-700 mt-1">
                                        <span className="text-slate-500">Reference:</span>{' '}
                                        <span className="font-mono text-slate-900">{modalOrder.paymentRef}</span>
                                    </p>
                                </section>
                            </div>

                            {/* Totals */}
                            <section className="border border-slate-200 rounded-sm p-4 space-y-2 text-xs">
                                <div className="flex justify-between text-slate-700">
                                    <span>Subtotal</span>
                                    <span className="font-medium">{formatUSD(modalOrder.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span>Shipping</span>
                                    <span className="font-medium">
                                        {modalOrder.shipping === 0 ? 'Free' : formatUSD(modalOrder.shipping)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span>VAT (8.5%)</span>
                                    <span className="font-medium">{formatUSD(modalOrder.vat)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                                    <span className="font-bold text-slate-900">Total</span>
                                    <span className="font-bold text-slate-900">{formatUSD(modalOrder.total)}</span>
                                </div>
                            </section>
                        </div>

                        {/* Footer actions */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 shrink-0">
                            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                <Download className="h-3.5 w-3.5" /> Invoice
                            </button>
                            {modalOrder.trackingNumber && (
                                <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                    <Truck className="h-3.5 w-3.5" /> Track
                                </button>
                            )}
                            {modalOrder.status === 'Delivered' && (
                                <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                    <RefreshCw className="h-3.5 w-3.5" /> Reorder
                                </button>
                            )}
                            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs">
                                <MessageCircle className="h-3.5 w-3.5" /> Support
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalOrder(null)}
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