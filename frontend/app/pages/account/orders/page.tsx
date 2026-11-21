'use client';

import React, {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ShoppingBag, Eye, X, Truck, RefreshCw, MessageCircle,
    Check, MapPin, CreditCard, Package, Clock, Loader2, AlertCircle,
    Ban, PackageCheck, Tag, Printer, FileText, Share2, Phone, Mail,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
    accountApi,
    cartApi,
    whatsappApi,
    ApiError,
    type OrderDetail,
    type OrderListRow,
    type OrderStatus as ApiOrderStatus,
    type OrderItem as ApiOrderItem,
} from '@/lib/api';
import { useCart } from '@/lib/store/cart';
import { useAuth } from '@/lib/hooks/use-auth';

const SHOP = {
    name: 'Razestore',
    logo: '/logo.jpeg',
    tagline: 'Genuine Electronics · Nationwide Delivery',
    address: 'Biashara Street, Nairobi CBD',
    phone: '+254 700 000 000',
    email: 'hello@razestore.co.ke',
    website: 'razestore.co.ke',
    vatPin: 'P051234567X',
};

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
    key: string;
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
    taxRate: number;
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

const computeTaxRate = (order: OrderDetail): number => {
    const anyOrder = order as unknown as { tax_rate?: number };
    if (typeof anyOrder.tax_rate === 'number' && anyOrder.tax_rate > 0) {
        return anyOrder.tax_rate;
    }
    const base = numOr0(order.subtotal) - numOr0(order.discount);
    const tax = numOr0(order.tax);
    const net = base - tax;
    if (net > 0 && tax > 0) {
        return Math.round((tax / net) * 100);
    }
    return 16;
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
        case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Shipped': return 'bg-blue-50 text-blue-950 border-blue-200';
        case 'Processing': return 'bg-indigo-50 text-indigo-900 border-indigo-200';
        case 'Confirmed': return 'bg-sky-50 text-sky-900 border-sky-200';
        case 'Returned': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'Cancelled':
        case 'Failed': return 'bg-red-50 text-red-700 border-red-200';
        default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
};

const paymentStatusBadge = (status: UiPaymentStatus): string | null => {
    switch (status) {
        case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'unpaid': return 'bg-slate-50 text-slate-600 border-slate-200';
        case 'refunded': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'failed': return 'bg-red-50 text-red-700 border-red-200';
        default: return null;
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

const paymentDotColor = (status: UiPaymentStatus): string => {
    switch (status) {
        case 'paid': return 'bg-emerald-500';
        case 'failed': return 'bg-red-500';
        case 'refunded': return 'bg-indigo-500';
        case 'unpaid':
        default: return 'bg-amber-500';
    }
};

const formatDateShort = (iso: string): string => {
    try {
        return new Date(iso).toLocaleDateString('en-KE', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    } catch {
        return iso;
    }
};

const formatDateTime = (iso: string): string => {
    try {
        return new Date(iso).toLocaleString('en-KE', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
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
    taxRate: 16,
    paymentMethod: '',
    paymentRef: '',
    estimatedDelivery: '',
    shippingAddress: {
        name: '', street: '', town: '', county: '', postalCode: '', phone: '',
    },
    timeline: [],
});

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
            image: i.image, name: i.name, quantity: i.quantity,
        })),
        itemCount,
        total: numOr0(d.total),
        subtotal: numOr0(d.subtotal),
        discount: numOr0(d.discount),
        coupon: d.coupon || null,
        shipping: numOr0(d.shipping),
        vat: numOr0(d.tax),
        taxRate: computeTaxRate(d),
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

const ReceiptPrintStyles = () => (
    <style jsx global>{`
        @media print {
            body * { visibility: hidden !important; }
            .receipt-printable,
            .receipt-printable * { visibility: visible !important; }
            .receipt-printable {
                position: absolute !important;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 190mm !important;
                min-height: 277mm !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #0f172a !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 10mm; }
        }
    `}</style>
);

const TABS = [
    'All', 'Pending', 'Confirmed', 'Processing',
    'Shipped', 'Delivered', 'Failed', 'Cancelled', 'Returned',
] as const;
type Tab = typeof TABS[number];

export default function OrdersPage() {
    return (
        <Suspense
            fallback={
                <div className="bg-white border border-slate-200 rounded p-2 text-center text-[13px] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Loading orders…
                </div>
            }
        >
            <ReceiptPrintStyles />
            <OrdersInner />
        </Suspense>
    );
}

function OrdersInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const addToCart = useCart((s) => s.addItem);
    const { me } = useAuth();
    const isSignedIn = me !== null;

    const [activeTab, setActiveTab] = useState<Tab>('All');
    const [search, setSearch] = useState('');
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [detail, setDetail] = useState<OrderView | null>(null);
    const [rawDetail, setRawDetail] = useState<OrderDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [reordering, setReordering] = useState(false);
    const [supportLoading, setSupportLoading] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);

    const receiptRef = useRef<HTMLDivElement | null>(null);

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
            return;
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
                setRawDetail(full);
                setDetail(detailToView(full));
            } catch {
                return;
            } finally {
                setDetailLoading(false);
            }
        },
        [orders, router],
    );

    const closeDetail = useCallback(() => {
        setDetail(null);
        setRawDetail(null);
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
        if (match) openDetail(ref, true); 
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
                try {
                    if (isSignedIn) {
                        await cartApi.addItem({
                            productId: item.product_id,
                            variantId: item.variant_id,
                            name: item.name,
                            brand: item.brand,
                            image: item.image,
                            unitPrice: item.unit_price,
                            quantity: qty,
                        });
                    } else {
                        await addToCart(
                            {
                                variantId: item.variant_id,
                                productId: item.product_id,
                                name: item.name,
                                brand: item.brand,
                                image: item.image,
                                unitPrice: item.unit_price,
                                slug: item.slug,
                            },
                            qty,
                        );
                    }
                    succeeded += 1;
                } catch {
                    failed += 1;
                }
            }

            if (failed === 0) {
                flash(
                    `Added ${succeeded} item${succeeded !== 1 ? 's' : ''} to cart.`,
                );
            } else if (succeeded === 0) {
                flash(
                    `Could not add ${failed} item${failed !== 1 ? 's' : ''}.`,
                );
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

    const handleDownloadPdf = async (reference: string) => {
        if (pdfBusy) return;
        setPdfBusy(true);
        try {
            const blob = await accountApi.orders.downloadPdf(reference);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-${reference}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            flash('Receipt downloaded.');
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not download receipt.'
                    : 'Could not download receipt.',
            );
        } finally {
            setPdfBusy(false);
        }
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    const handleShareReceipt = (order: OrderView) => {
        const lines: string[] = [];
        lines.push(`*${SHOP.name}* — Order Receipt`);
        lines.push('');
        lines.push(`Order: #${order.reference}`);
        lines.push(`Date: ${order.date}`);
        lines.push('');
        lines.push('*Items:*');
        order.items.forEach((it) => {
            lines.push(
                `• ${it.name} ×${it.quantity} — ${formatKES(it.price * it.quantity)}`,
            );
        });
        lines.push('');
        lines.push(`Subtotal: ${formatKES(order.subtotal)}`);
        if (order.discount > 0) {
            lines.push(`Discount: -${formatKES(order.discount)}`);
        }
        lines.push(`Shipping: ${order.shipping === 0 ? 'Free' : formatKES(order.shipping)}`);
        lines.push(`VAT: ${formatKES(order.vat)}`);
        lines.push(`*Total: ${formatKES(order.total)}*`);
        lines.push('');
        lines.push(`Payment: ${order.paymentMethod} · ${order.paymentRef}`);
        lines.push('');
        lines.push(`Need help? Call ${SHOP.phone}`);

        const text = encodeURIComponent(lines.join('\n'));
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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
        <div className="space-y-2">
            {toast && (
                <div className="fixed bottom-2 right-2 z-[80] bg-blue-950 text-white text-[13px] px-2 py-2 rounded flex items-start gap-2 max-w-md no-print">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="">{toast}</span>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded p-2 no-print">
                <h1 className="text-[15px] font-semibold text-slate-900">My Orders</h1>
                <p className="text-[13px] text-slate-500 mt-0.5">
                    Track, review, and manage all your purchases
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded p-2 no-print">
                <div className="md:hidden space-y-2">
                    <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as Tab)}
                        aria-label="Filter orders by status"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                        {TABS.map((tab) => (
                            <option key={tab} value={tab}>
                                {tab === 'All' ? 'All orders' : tab}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search orders or products…"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                </div>

                <div className="hidden md:flex md:items-center gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {TABS.map((tab) => {
                            const isActive = tab === activeTab;
                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-2 py-2 rounded text-[13px] font-medium whitespace-nowrap transition-colors ${isActive
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
                        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                </div>
            </div>

            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-2 rounded text-[13px] flex items-center gap-2 no-print">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {errorMessage}
                </div>
            )}

            {isLoading ? (
                <div className="bg-white border border-slate-200 rounded p-8 text-center text-[13px] text-slate-500 no-print">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Loading orders…
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-8 text-center no-print">
                    <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-1" />
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        {orders.length === 0 ? 'No orders yet' : 'No orders found'}
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-1">
                        {orders.length === 0
                            ? 'Place your first order to see it here.'
                            : 'Try a different filter or search term.'}
                    </p>
                    {orders.length === 0 && (
                        <Link
                            href="/pages/products"
                            className="mt-1 inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px]"
                        >
                            Browse Products
                        </Link>
                    )}
                </div>
            ) : (
                <ul className="space-y-2 no-print">
                    {filtered.map((order) => {
                        const payBadge = paymentStatusBadge(order.paymentStatus);
                        return (
                            <li
                                key={order.reference}
                                className="bg-white border border-slate-200 rounded overflow-hidden"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-slate-100 bg-slate-50">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[13px] font-semibold text-slate-900 font-mono">
                                            #{order.reference}
                                        </span>
                                        <span className={`text-[13px] font-medium px-2 py-0.5 rounded border ${statusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                        {payBadge && (
                                            <span className={`text-[13px] font-medium px-2 py-0.5 rounded border ${payBadge}`}>
                                                {paymentStatusLabel(order.paymentStatus)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[13px] text-slate-500">
                                        Placed {order.date}
                                    </div>
                                </div>

                                <div className="p-2">
                                    {order.previewItems.length > 0 ? (
                                        <div className="flex items-center gap-2 overflow-x-auto">
                                            {order.previewItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2 shrink-0">
                                                    <img
                                                        src={item.image || '/placeholder.png'}
                                                        alt={item.name}
                                                        className="h-12 w-12 rounded object-cover border border-slate-200"
                                                    />
                                                    <div className="hidden sm:block min-w-0 max-w-[180px]">
                                                        <p className="text-[13px] font-medium text-slate-900 truncate">
                                                            {item.name}
                                                        </p>
                                                        <p className="text-[13px] text-slate-500">
                                                            Qty {item.quantity}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {order.itemCount > order.previewItems.length && (
                                                <span className="text-[13px] text-slate-500 shrink-0">
                                                    +{order.itemCount - order.previewItems.length} more
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[13px] text-slate-500">
                                            {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                                        </p>
                                    )}
                                </div>

                                <div className="p-2 pt-0 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[13px] text-slate-500">Total</p>
                                        <p className="text-[15px] font-bold text-slate-900">
                                            {formatKES(order.total)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openDetail(order.reference)}
                                        className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] transition-colors"
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
                    className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/70 backdrop-blur-sm print:bg-transparent print:backdrop-blur-none"
                    onClick={() => !reordering && !claiming && !rejectOpen && closeDetail()}
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50 shrink-0 no-print">
                            <div className="min-w-0">
                                <p className="text-[13px] uppercase font-semibold text-slate-500">
                                    Order
                                </p>
                                <h2 className="text-[15px] font-bold text-slate-900 font-mono truncate">
                                    #{detail.reference}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[13px] font-medium px-2 py-1 rounded border ${statusColor(detail.status)}`}>
                                    {detail.status}
                                </span>
                                {detail.paymentStatus === 'refunded' && (
                                    <span className="text-[13px] font-medium px-2 py-1 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                                        Refunded
                                    </span>
                                )}
                                {detail.paymentStatus === 'failed' && (
                                    <span className="text-[13px] font-medium px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200">
                                        Payment failed
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={closeDetail}
                                    disabled={reordering || claiming}
                                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 disabled:opacity-40"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto p-2 space-y-2">
                            {detailLoading ? (
                                <div className="py-8 text-center text-[13px] text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                                    Loading order details…
                                </div>
                            ) : (
                                <>
                                    {detail.timeline.length > 0 && (
                                        <section className="no-print">
                                            <h3 className="text-[13px] font-semibold uppercase text-slate-500 mb-1">
                                                Delivery Progress
                                            </h3>
                                            <ol className="space-y-2">
                                                {detail.timeline.map((step, idx) => {
                                                    const isLast = idx === detail.timeline.length - 1;
                                                    const isCancelled = step.status === 'Cancelled';
                                                    const isFailed = step.status === 'Failed';
                                                    const isReturned = step.status === 'Returned';
                                                    return (
                                                        <li key={idx} className="flex gap-2">
                                                            <div className="flex flex-col items-center">
                                                                <span
                                                                    className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${isCancelled || isFailed
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : isReturned
                                                                            ? 'bg-orange-100 text-orange-700'
                                                                            : isLast
                                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                                : 'bg-blue-100 text-blue-950'
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
                                                                    <span className="w-px flex-1 bg-slate-200 my-2" />
                                                                )}
                                                            </div>
                                                            <div className="pb-2">
                                                                <p className="text-[13px] font-semibold text-slate-900">
                                                                    {step.status}
                                                                </p>
                                                                <p className="text-[13px] text-slate-500">
                                                                    {formatDateTime(step.date)}
                                                                </p>
                                                                {step.note && (
                                                                    <p className="text-[13px] text-slate-600 mt-0.5 italic">
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

                                    {(detail.trackingNumber || detail.courier || detail.estimatedDelivery) && (
                                        <section className="bg-slate-50 border border-slate-200 rounded p-2 no-print">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
                                                {detail.courier && (
                                                    <div>
                                                        <p className="text-slate-500 mb-0.5 flex items-center gap-2">
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
                                                        <p className="text-slate-500 mb-0.5 flex items-center gap-2">
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

                                    <section className="no-print">
                                        <h3 className="text-[13px] font-semibold uppercase text-slate-500 mb-2 flex items-center gap-2">
                                            <Package className="h-3.5 w-3.5" /> Items ({detail.items.length})
                                        </h3>
                                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden">
                                            {detail.items.map((item) => (
                                                <li key={item.key} className="flex items-center gap-2 p-2">
                                                    <img
                                                        src={item.image || '/placeholder.png'}
                                                        alt={item.name}
                                                        className="h-14 w-14 rounded object-cover border border-slate-200 shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] uppercase text-slate-500 font-medium">
                                                            {item.brand}
                                                        </p>
                                                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                                                            {item.name}
                                                        </p>
                                                        <p className="text-[13px] text-slate-500 mt-0.5">
                                                            Qty {item.quantity}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[13px] font-bold text-slate-900">
                                                            {formatKES(item.price * item.quantity)}
                                                        </p>
                                                        <p className="text-[13px] text-slate-500">
                                                            {formatKES(item.price)} each
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 no-print">
                                        <section className="border border-slate-200 rounded p-2">
                                            <h3 className="text-[13px] font-semibold uppercase text-slate-500 mb-2 flex items-center gap-2">
                                                <MapPin className="h-3.5 w-3.5" /> Shipping Address
                                            </h3>
                                            <p className="text-[13px] text-slate-700">
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

                                        <section className="border border-slate-200 rounded p-2">
                                            <h3 className="text-[13px] font-semibold uppercase  text-slate-500 mb-1 flex items-center gap-2">
                                                <CreditCard className="h-3.5 w-3.5" /> Payment
                                            </h3>
                                            <p className="text-[13px] text-slate-700">
                                                <span className="text-slate-500">Method:</span>{' '}
                                                <span className="font-semibold text-slate-900">
                                                    {detail.paymentMethod}
                                                </span>
                                            </p>
                                            <p className="text-[13px] text-slate-700 mt-1">
                                                <span className="text-slate-500">Reference:</span>{' '}
                                                <span className="font-mono text-slate-900">
                                                    {detail.paymentRef}
                                                </span>
                                            </p>
                                            {detail.paymentStatus === 'refunded' && (
                                                <p className="text-[13px] mt-1 inline-flex items-center gap-2 px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    <RefreshCw className="h-3 w-3" />
                                                    Refunded to original method
                                                </p>
                                            )}
                                            {detail.paymentStatus === 'failed' && (
                                                <p className="text-[13px] mt-1 inline-flex items-center gap-2 px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Payment was not completed
                                                </p>
                                            )}
                                        </section>
                                    </div>

                                    <section className="border border-slate-200 rounded p-2 space-y-2 text-[13px] no-print">
                                        <div className="flex justify-between text-slate-700">
                                            <span>Subtotal</span>
                                            <span className="font-medium">{formatKES(detail.subtotal)}</span>
                                        </div>
                                        {detail.discount > 0 && (
                                            <div className="flex justify-between text-emerald-700">
                                                <span className="inline-flex items-center gap-2">
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
                                                {detail.shipping === 0 ? 'Free' : formatKES(detail.shipping)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-700">
                                            <span>
                                                VAT
                                                {detail.vat > 0 && detail.taxRate > 0
                                                    ? ` (${detail.taxRate}%)`
                                                    : ''}
                                            </span>
                                            <span className="font-medium">{formatKES(detail.vat)}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-slate-200 text-[13px]">
                                            <span className="font-bold text-slate-900">Total</span>
                                            <span className="font-bold text-slate-900">
                                                {formatKES(detail.total)}
                                            </span>
                                        </div>
                                    </section>

                                    {rawDetail && (
                                        <section className="pt-1 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-1 flex-wrap gap-2 no-print">
                                                <h3 className="text-[13px] font-semibold uppercase text-slate-500">
                                                    Receipt
                                                </h3>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadPdf(detail.reference)}
                                                        disabled={pdfBusy}
                                                        className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded text-[13px] disabled:opacity-60"
                                                    >
                                                        {pdfBusy ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <FileText className="h-3 w-3" />
                                                        )}
                                                        PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handlePrintReceipt}
                                                        className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded text-[13px]"
                                                    >
                                                        <Printer className="h-3 w-3" />
                                                        Print
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleShareReceipt(detail)}
                                                        className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded text-[13px]"
                                                    >
                                                        <Share2 className="h-3 w-3" />
                                                        Share
                                                    </button>
                                                </div>
                                            </div>

                                            <CustomerReceiptCard
                                                ref={receiptRef}
                                                order={rawDetail}
                                            />
                                        </section>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="p-2 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 shrink-0 no-print">
                            {detail.trackingNumber && (
                                <button
                                    type="button"
                                    onClick={() => flash('Tracking link not available yet.')}
                                    className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-2 py-2 rounded text-[13px]"
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
                                    className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-2 py-2 rounded text-[13px] disabled:opacity-60"
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
                                    className="inline-flex items-center gap-2 bg-white border border-red-300 hover:bg-red-50 text-red-700 font-medium px-2 py-2 rounded text-[13px] disabled:opacity-60"
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
                                    className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded text-[13px] disabled:opacity-60"
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
                                className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium px-2 py-2 rounded text-[13px] disabled:opacity-60"
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
                                className="ml-auto inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded text-[13px] disabled:opacity-60"
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

const CustomerReceiptCard = React.forwardRef<
    HTMLDivElement,
    { order: OrderDetail }
>(function CustomerReceiptCard({ order }, ref) {
    const mpesaRef = order.mpesa_receipt || '—';
    const discountValue = parseFloat(String(order.discount)) || 0;
    const shippingValue = parseFloat(String(order.shipping)) || 0;
    const totalUnits = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const taxRate = computeTaxRate(order);

    const qrValue = JSON.stringify({
        ref: order.reference,
        total: order.total,
        mpesa: mpesaRef,
        token: order.verify_token || order.reference,
        verify: `https://${SHOP.website}/verify/${order.reference}`,
    });

    return (
        <div
            ref={ref}
            className="receipt-printable bg-white border border-slate-200 rounded overflow-hidden print:border-0 print:shadow-none print:rounded-none print:w-full print:max-w-[190mm] print:mx-auto print:flex print:flex-col print:justify-between print:min-h-[277mm]"
        >
            <div className="flex justify-between items-start gap-2 px-2 py-2 border-b-2 border-slate-100 print:border-slate-900 print:pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    {SHOP.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={SHOP.logo}
                            alt={SHOP.name}
                            className="w-12 h-12 object-contain shrink-0"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded bg-blue-950 text-white flex items-center justify-center shrink-0 font-bold text-[15px]">
                            {SHOP.name.charAt(0)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-[15px] font-bold text-slate-900 truncate">
                            {SHOP.name}
                        </h2>
                        <p className="text-[13px] text-slate-500 truncate">
                            {SHOP.tagline}
                        </p>
                        <p className="text-[13px] text-slate-400 truncate">
                            {SHOP.address}
                        </p>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <p className="text-[13px] uppercase text-slate-400 font-semibold">
                        Receipt
                    </p>
                    <p className="text-[13px] font-mono font-bold text-slate-900">
                        #{order.reference}
                    </p>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        {formatDateTime(order.created_at)}
                    </p>
                    <span
                        className={`inline-flex items-center gap-2 mt-2 px-2 py-0.5 rounded text-[13px] font-medium border ${paymentStatusBadge(order.payment_status) ??
                            'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${paymentDotColor(order.payment_status)}`}
                        />
                        {paymentStatusLabel(order.payment_status)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-2 sm:gap-8 my-2 px-2">
                <div>
                    <p className="text-[13px] uppercase text-slate-400 font-semibold mb-2">
                        Shipped to
                    </p>
                    <div className="space-y-2 text-[13px]">
                        <p className="font-semibold text-slate-900">
                            {order.full_name || 'Walk-in customer'}
                        </p>
                        {order.phone && (
                            <p className="text-slate-600 font-mono flex items-center gap-2">
                                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                {order.phone}
                            </p>
                        )}
                        {order.email && (
                            <p className="text-slate-600 flex items-center gap-2">
                                <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span className="truncate">{order.email}</span>
                            </p>
                        )}
                        {order.address_street && (
                            <p className="text-slate-500 flex items-start gap-2 pt-2">
                                <MapPin className="w-2.5 h-2.5 text-slate-400 mt-0.5 shrink-0" />
                                <span className="min-w-0">
                                    {order.address_street}, {order.address_town},{' '}
                                    {order.address_county}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                <div>
                    <p className="text-[13px] uppercase text-slate-400 font-semibold mb-2">
                        Payment profile
                    </p>
                    <dl className="space-y-2 text-[13px]">
                        <div className="flex items-baseline justify-between gap-2">
                            <dt className="text-slate-500">Method</dt>
                            <dd className="font-medium text-slate-900 text-right">
                                {order.payment_method === 'MPESA' ? 'M-Pesa' : 'Cash on delivery'}
                            </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <dt className="text-slate-500">M-Pesa ref</dt>
                            <dd className="font-mono font-semibold text-blue-950 text-right truncate">
                                {mpesaRef}
                            </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <dt className="text-slate-500">Units</dt>
                            <dd className="font-medium text-slate-900 text-right">
                                {totalUnits}
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>

            <div className="px-2">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 print:border-slate-900">
                            <th className="py-2 pr-2 text-[13px] uppercase text-slate-400 font-semibold">
                                Item
                            </th>
                            <th className="py-2 px-2 text-[13px] uppercase text-slate-400 font-semibold text-center w-16">
                                Qty
                            </th>
                            <th className="py-2 pl-2 text-[13px] uppercase text-slate-400 font-semibold text-right w-28">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => {
                            const price = parseFloat(String(item.price)) || 0;
                            const subtotal = price * item.quantity;
                            return (
                                <tr
                                    key={item.id}
                                    className="border-b border-slate-100 align-top"
                                >
                                    <td className="py-2 pr-2">
                                        <div className="flex items-start gap-2">
                                            {item.image ? ( 
                                                <img
                                                    src={item.image}
                                                    alt=""
                                                    className="w-9 h-9 rounded object-cover border border-slate-200 bg-white shrink-0"
                                                />
                                            ) : (
                                                <span className="w-9 h-9 rounded bg-slate-100 border border-slate-200 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-semibold text-slate-900">
                                                    {item.name}
                                                </p>
                                                {item.brand && (
                                                    <p className="text-[13px] text-slate-500">
                                                        {item.brand}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-2 mt-0.5">
                                                    {item.serial_number && (
                                                        <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200 text-[13px] font-mono text-slate-600">
                                                            S/N {item.serial_number}
                                                        </span>
                                                    )}
                                                    {item.imei && (
                                                        <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200 text-[13px] font-mono text-slate-600">
                                                            IMEI {item.imei}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-center text-[13px] text-slate-700 whitespace-nowrap">
                                        ×{item.quantity}
                                    </td>
                                    <td className="py-2 pl-2 text-right">
                                        <p className="text-[13px] font-semibold text-slate-900 whitespace-nowrap">
                                            {formatKES(subtotal)}
                                        </p>
                                        <p className="text-[13px] text-slate-500 whitespace-nowrap">
                                            {formatKES(price)} each
                                        </p>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col-reverse sm:flex-row print:flex-row items-stretch sm:items-end print:items-end justify-between gap-2 px-2 py-2 mt-auto border-t border-slate-200 print:border-slate-900">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded border border-slate-200 bg-white shrink-0">
                        <QRCodeSVG
                            value={qrValue}
                            size={80}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                        />
                    </div>
                    <div className="text-[12px] text-slate-500 space-y-0.5 min-w-0">
                        <p className="font-semibold text-slate-800 text-[13px]">
                            Thank you for shopping with {SHOP.name}!
                        </p>
                        <p>
                            Warranty valid for 12 months on all electronics.
                            Keep this receipt for returns and service.
                        </p>
                        <p className="text-slate-400 break-words pt-0.5">
                            {SHOP.website} · {SHOP.email} · {SHOP.phone}
                        </p>
                        <p className="text-slate-400">VAT PIN: {SHOP.vatPin}</p>
                    </div>
                </div>

                <div className="w-full sm:w-64 shrink-0 space-y-1.5">
                    <div className="flex justify-between gap-2 text-[13px] text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-800">
                            {formatKES(order.subtotal)}
                        </span>
                    </div>

                    {discountValue > 0 && (
                        <div className="flex justify-between gap-2 text-[13px] text-slate-600">
                            <span className="truncate">
                                Discount{order.coupon ? ` (${order.coupon})` : ''}
                            </span>
                            <span className="font-medium text-red-600 whitespace-nowrap">
                                −{formatKES(order.discount)}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between gap-2 text-[13px] text-slate-600">
                        <span>Shipping</span>
                        <span className="font-medium text-slate-800 whitespace-nowrap">
                            {shippingValue === 0 ? 'Free' : formatKES(order.shipping)}
                        </span>
                    </div>

                    <div className="flex justify-between gap-2 text-[13px] text-slate-600">
                        <span>VAT{taxRate > 0 ? ` (${taxRate}%)` : ''}</span>
                        <span className="font-medium text-slate-800 whitespace-nowrap">
                            {formatKES(order.tax)}
                        </span>
                    </div>

                    <div className="pt-2 mt-0.5 border-t border-slate-200 flex justify-between items-baseline gap-2">
                        <span className="text-[13px] uppercase text-slate-500 font-semibold">
                            Total
                        </span>
                        <span className="text-[15px] font-bold text-slate-900 whitespace-nowrap">
                            {formatKES(order.total)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

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
            className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 no-print"
            onClick={() => !submitting && onClose()}
        >
            <div
                className="bg-white w-full max-w-md rounded shadow-xl border border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-2 border-b border-slate-200 flex items-start gap-2">
                    <span className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                        <Ban className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-slate-900">
                            Cancel order #{reference}?
                        </h3>
                        <p className="text-[13px] text-slate-600 mt-1">
                            This cannot be undone. If the order has already shipped, contact
                            support instead.
                        </p>
                    </div>
                </div>

                <div className="p-2 space-y-2">
                    <label className="block">
                        <span className="block text-[13px] font-medium text-slate-700 mb-2">
                            Reason (optional)
                        </span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={submitting}
                            rows={3}
                            maxLength={500}
                            placeholder="Changed my mind, ordered by mistake…"
                            className="w-full border border-slate-200 rounded px-2 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
                        />
                    </label>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-2 rounded text-[13px] flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="p-2 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="text-[13px] font-medium px-2 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                        Keep order
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={submitting}
                        className="text-[13px] font-medium px-2 py-2 rounded bg-red-600 hover:bg-red-500 text-white inline-flex items-center gap-2 disabled:opacity-60"
                    >
                        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Cancel order
                    </button>
                </div>
            </div>
        </div>
    );
}