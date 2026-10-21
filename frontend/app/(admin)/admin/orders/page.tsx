'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Download, Plus, Calendar, Printer, ArrowLeft, Check, X,
  MoreVertical, RefreshCw, ChevronRight,
  Send, DollarSign, ChevronDown, Undo2, Ban, Loader2, AlertCircle, Truck,
  FileText, Share2, MapPin, Phone, Mail,
} from 'lucide-react';
import { QRScannerModal, QRCodeSVG } from '@/components/admin/QRScannerModal';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type {
  AdminOrderRow,
  AdminOrderDetail,
  AdminOrderStats,
  AdminOrderTabCounts,
  AdminOrderTab,
  AdminOrderStatus,
  AdminOrderPaymentStatus,
  AdminOrderFilters,
  AdminOrderStatusEvent,
} from '@/lib/admin-types';

const TABS: { key: AdminOrderTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'payment_pending', label: 'Payment Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'returned', label: 'Returned' },
];

const STATUS_LABELS: Record<AdminOrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

const PAYMENT_STATUS_LABELS: Record<AdminOrderPaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
};

const PAYMENT_STATUS_OPTIONS: AdminOrderPaymentStatus[] = [
  'unpaid', 'paid', 'refunded', 'failed',
];

const SHOP = {
  name: 'RazeStore',
  displayName: 'RAZESTORE KENYA',
  logo: '/logo.jpeg',
  tagline: 'Genuine Electronics · Nationwide Delivery',
  address: 'Biashara Street, Nairobi CBD',
  phone: '+254 116 103 872',
  email: 'hello@razestore.co.ke',
  website: 'razestore.co.ke',
  vatPin: 'P051234567X',
  warranty: '12 Months Hardware Coverage',
  security: 'Warranty Void If Seal Is Damaged',
};

const THERMAL_LABEL_WIDTH_MM = 80;
const THERMAL_LABEL_HEIGHT_MM = 100;

const formatKES = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(num)) return 'KES 0';
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const formatDateShort = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const toWaNumber = (raw?: string | null): string => {
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '').replace(/^0/, '254');
};

const statusColor = (s: AdminOrderStatus): string => {
  switch (s) {
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'shipped': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'processing': return 'bg-blue-50 text-blue-950 border-blue-100';
    case 'confirmed': return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'returned': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'cancelled':
    case 'failed': return 'bg-red-50 text-red-600 border-red-100';
    case 'pending':
    default: return 'bg-amber-50 text-amber-700 border-amber-100';
  }
};

const statusDotColor = (s: AdminOrderStatus): string => {
  switch (s) {
    case 'delivered': return 'bg-emerald-500';
    case 'shipped': return 'bg-indigo-500';
    case 'processing': return 'bg-blue-500';
    case 'confirmed': return 'bg-sky-500';
    case 'returned': return 'bg-orange-500';
    case 'cancelled':
    case 'failed': return 'bg-red-500';
    case 'pending':
    default: return 'bg-amber-500';
  }
};

const paymentStatusColor = (s: AdminOrderPaymentStatus): string => {
  switch (s) {
    case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'refunded': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'failed': return 'bg-red-50 text-red-600 border-red-100';
    case 'unpaid':
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const paymentDotColor = (s: AdminOrderPaymentStatus): string => {
  switch (s) {
    case 'paid': return 'bg-emerald-500';
    case 'failed': return 'bg-red-500';
    case 'refunded': return 'bg-indigo-500';
    case 'unpaid':
    default: return 'bg-amber-500';
  }
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

const PrintStyles = () => (
  <style jsx global>{`
    .thermal-page {
      display: none;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      body * {
        visibility: hidden !important;
      }
      .thermal-page,
      .thermal-page * {
        visibility: visible !important;
      }
      .thermal-page {
        display: block !important;
        position: static !important;
        width: auto !important;
        height: auto !important;
        background: #ffffff;
      }
      .thermal-sticker {
        width: ${THERMAL_LABEL_WIDTH_MM}mm;
        height: ${THERMAL_LABEL_HEIGHT_MM}mm;
        padding: 3mm 4mm;
        box-sizing: border-box;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
        display: flex;
        flex-direction: column;
        color: #000000;
        background: #ffffff;
        font-family: 'Courier New', ui-monospace, monospace;
        overflow: hidden;
      }
      .thermal-sticker:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .thermal-divider {
        border-top: 1pt dashed #000000;
        margin: 1.5mm 0;
      }
      .thermal-header {
        text-align: center;
      }
      .thermal-header-title {
        font-size: 12pt;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .thermal-header-sub {
        font-size: 8pt;
        margin-top: 0.5mm;
      }
      .thermal-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 2mm;
        padding: 0.5mm 0;
        font-size: 8.5pt;
      }
      .thermal-label {
        font-weight: 700;
        flex-shrink: 0;
      }
      .thermal-value {
        text-align: right;
        word-break: break-word;
      }
      .thermal-value-mono {
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .thermal-products {
        font-size: 8pt;
      }
      .thermal-product-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 2mm;
        padding: 0.6mm 0;
        border-bottom: 0.5pt dotted #000000;
      }
      .thermal-product-item:last-child {
        border-bottom: none;
      }
      .thermal-product-name {
        flex: 1;
        word-break: break-word;
      }
      .thermal-product-qty {
        flex-shrink: 0;
        font-weight: 700;
      }
      .thermal-qr {
        display: flex;
        justify-content: center;
        padding: 1.5mm 0;
      }
      .thermal-footer {
        font-size: 7.5pt;
        line-height: 1.5;
        margin-top: 0.5mm;
      }
      .no-print {
        display: none !important;
      }
      @page {
        size: ${THERMAL_LABEL_WIDTH_MM}mm ${THERMAL_LABEL_HEIGHT_MM}mm;
        margin: 0;
      }
    }
  `}</style>
);

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[13px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading orders…
        </div>
      }
    >
      <PrintStyles />
      <OrdersPageInner />
    </Suspense>
  );
}

function OrdersPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialRef = searchParams.get('reference');
  const [selectedReference, setSelectedReference] = useState<string | null>(initialRef);

  const searchKey = searchParams.toString();
  useEffect(() => {
    const ref = searchParams.get('reference');
    if (ref !== selectedReference) setSelectedReference(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  const handleBack = () => {
    setSelectedReference(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('reference');
    const qs = params.toString();
    router.replace(qs ? `/admin/orders?${qs}` : '/admin/orders');
  };

  const handleSelectOrder = (reference: string) => {
    setSelectedReference(reference);
    const params = new URLSearchParams(searchParams.toString());
    params.set('reference', reference);
    router.replace(`/admin/orders?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {selectedReference ? (
        <OrderDetailPage reference={selectedReference} onBack={handleBack} />
      ) : (
        <OrdersListPage onSelectOrder={handleSelectOrder} />
      )}

      <QRScannerModal />
    </div>
  );
}

function ReportsBreadcrumb() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const range = searchParams.get('range');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const from = searchParams.get('from');

  if (!range) return null;

  const back = new URLSearchParams();
  back.set('tab', from ?? 'orders');
  back.set('range', range);
  if (range === 'custom' && start && end) {
    back.set('start', start);
    back.set('end', end);
  }

  return (
    <div className="mb-2 flex items-center gap-2 text-[13px] text-slate-500">
      <button
        onClick={() => router.push(`/admin/reports?${back.toString()}`)}
        className="text-blue-950 hover:underline font-medium"
      >
        Reports
      </button>
      <ChevronRight className="w-3 h-3 text-slate-400" />
      <span className="text-slate-700">Orders</span>
    </div>
  );
}

function OrdersListPage({
  onSelectOrder,
}: {
  onSelectOrder: (reference: string) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchKey = searchParams.toString();

  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [tabCounts, setTabCounts] = useState<AdminOrderTabCounts | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminOrderTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const initialDates = useMemo(() => {
    const date = searchParams.get('date');
    const range = searchParams.get('range');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (date) return { from: date, to: date };
    if (range === 'custom' && start && end) return { from: start, to: end };
    return { from: '', to: '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [paymentFilter, setPaymentFilter] = useState<AdminOrderPaymentStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const appliedKeyRef = useRef<string>('');
  useEffect(() => {
    if (appliedKeyRef.current === searchKey) return;
    appliedKeyRef.current = searchKey;

    const date = searchParams.get('date');
    const range = searchParams.get('range');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (date) {
      setDateFrom(date);
      setDateTo(date);
    } else if (range === 'custom' && start && end) {
      setDateFrom(start);
      setDateTo(end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const refreshAggregates = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        adminApi.orders.tabCounts(),
        adminApi.orders.stats(),
      ]);
      setTabCounts(c);
      setStats(s);
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => { void refreshAggregates(); }, [refreshAggregates]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: AdminOrderFilters = { tab: activeTab };
      if (searchQuery.trim()) filters.search = searchQuery.trim();
      if (paymentFilter) filters.payment_status = paymentFilter;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const res = await adminApi.orders.list(filters);
      setRows(res.results);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message || 'Could not load orders.'
          : 'Could not load orders.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, paymentFilter, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
  }, [fetchList]);

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('date');
    params.delete('start');
    params.delete('end');
    const qs = params.toString();
    router.replace(qs ? `/admin/orders?${qs}` : '/admin/orders');
  };

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : rows.map((r) => r.reference));
  const toggleRow = (ref: string) =>
    setSelectedIds((prev) =>
      prev.includes(ref) ? prev.filter((x) => x !== ref) : [...prev, ref],
    );

  const handleExport = async () => {
    setToastMessage('Exporting orders CSV…');
    try {
      const filters: AdminOrderFilters = { tab: activeTab };
      if (searchQuery.trim()) filters.search = searchQuery.trim();
      if (paymentFilter) filters.payment_status = paymentFilter;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const { csv } = await adminApi.orders.export(filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage('Exported orders');
    } catch {
      setToastMessage('Export failed');
    }
  };

  const tabCount = (key: AdminOrderTab): number => {
    if (!tabCounts) return 0;
    return (tabCounts as unknown as Record<string, number>)[key] ?? 0;
  };

  const hasDateFilter = Boolean(dateFrom || dateTo);
  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'All';

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-2 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px] no-print">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-[1700px] mx-auto px-2 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Orders</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage customer transactions and fulfillment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setToastMessage('Create order is not supported yet')}
              className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create order</span>
            </button>
          </div>
        </div>

        <div className="max-w-[1700px] mx-auto px-2 pb-2 flex items-center gap-2 border-t border-slate-100 pt-2">
          <FloatingDropdown
            width={260}
            align="left"
            trigger={({ open, toggle, ref }) => (
              <button
                ref={ref}
                onClick={toggle}
                className="inline-flex items-center gap-2 px-2 py-2 rounded-sm text-[13px] font-medium bg-blue-950 text-white hover:bg-blue-900 transition"
              >
                <span className="truncate">{activeTabLabel}</span>
                <span className="text-[13px] px-2 py-0.5 rounded-sm bg-blue-900 text-white">
                  {tabCount(activeTab)}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
              </button>
            )}
          >
            {({ close }) => (
              <>
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        close();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-sm text-[13px] transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-950 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span
                        className={`text-[13px] px-2 py-0.5 rounded-sm shrink-0 ${
                          isActive
                            ? 'bg-blue-100 text-blue-950'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tabCount(tab.key)}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </FloatingDropdown>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-2 py-2 space-y-2">
        <ReportsBreadcrumb />

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Active orders</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">{stats.active_orders}</p>
              </div>
              <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4" />
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Pending</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5">{stats.pending_orders}</p>
              </div>
              <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Revenue today</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                  {formatKES(stats.revenue_today)}
                </p>
              </div>
              <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Revenue this month</p>
                <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                  {formatKES(stats.revenue_month)}
                </p>
              </div>
              <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search order #, customer, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-sm pl-9 pr-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 w-44"
              />
            </div>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-sm pl-9 pr-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 w-44"
              />
            </div>

            {hasDateFilter && (
              <button
                onClick={clearDates}
                className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px]"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
                Clear dates
              </button>
            )}

            <FilterDropdown
              label="Payment status"
              value={paymentFilter}
              options={PAYMENT_STATUS_OPTIONS as unknown as string[]}
              labels={PAYMENT_STATUS_LABELS as unknown as Record<string, string>}
              onChange={(v) => setPaymentFilter(v as AdminOrderPaymentStatus | null)}
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-2 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExport}
                className="bg-emerald-600 hover:bg-emerald-500 px-2 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Export current view
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="bg-blue-900 hover:bg-blue-800 px-2 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-2 rounded-sm flex items-center gap-2 text-[13px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-2 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-2 font-medium">Order #</th>
                  <th className="py-2 px-2 font-medium">Customer</th>
                  <th className="py-2 px-2 font-medium text-center">Items</th>
                  <th className="py-2 px-2 font-medium text-right">Total</th>
                  <th className="py-2 px-2 font-medium">Payment</th>
                  <th className="py-2 px-2 font-medium">Fulfillment</th>
                  <th className="py-2 px-2 font-medium">Date</th>
                  <th className="py-2 px-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-[13px]">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      Loading orders…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-[13px]">
                      No orders match your filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((ord) => (
                    <tr
                      key={ord.reference}
                      onClick={() => onSelectOrder(ord.reference)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ord.reference)}
                          onChange={() => toggleRow(ord.reference)}
                          className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2 font-mono font-medium text-slate-900">
                        #{ord.reference}
                      </td>
                      <td className="py-2 px-2">
                        <p className="font-medium text-slate-900 truncate max-w-[180px]">
                          {ord.customer_name || '—'}
                        </p>
                        <p className="text-[13px] text-slate-400 font-mono">
                          {ord.customer_phone || '—'}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-700">{ord.item_count}</td>
                      <td className="py-2 px-2 text-right font-medium text-slate-900">
                        {formatKES(ord.total)}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-medium border border-slate-200">
                            {ord.payment_method}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${paymentDotColor(ord.payment_status)}`}
                            title={ord.payment_status_label}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusColor(ord.status)}`}
                        >
                          {STATUS_LABELS[ord.status]}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-400 font-mono">
                        {formatDate(ord.date)}
                      </td>
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectOrder(ord.reference)}
                          className="p-2 rounded-sm bg-slate-100 hover:bg-blue-950 hover:text-white text-slate-700 transition"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}

function OrderDetailPage({
  reference,
  onBack,
}: {
  reference: string;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingCourier, setTrackingCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const [newNote, setNewNote] = useState('');

  const [printMode, setPrintMode] = useState<'labels' | null>(null);
  const [labelPrintBusy, setLabelPrintBusy] = useState(false);

  const receiptRef = useRef<HTMLDivElement | null>(null);

  const anyModalOpen = whatsAppOpen || refundOpen || trackingOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const flash = useCallback((msg: string) => setToastMessage(msg), []);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await adminApi.orders.detail(reference);
      setOrder(d);
      setWhatsAppText(
        `Hello ${d.customer_name || 'there'}, an update on your order #${d.reference}: ` +
        `current status is ${d.status_label}.`,
      );
      setTrackingCourier(d.courier || '');
      setTrackingNumber(d.tracking_number || '');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message || 'Could not load order.'
          : 'Could not load order.',
      );
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionBusy) {
        setWhatsAppOpen(false);
        setRefundOpen(false);
        setTrackingOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen, actionBusy]);

  const runAction = async <T,>(
    fn: () => Promise<T>,
    successMsg: string,
  ): Promise<boolean> => {
    if (actionBusy) return false;
    setActionBusy(true);
    try {
      await fn();
      flash(successMsg);
      await fetchDetail();
      return true;
    } catch (err) {
      flash(
        err instanceof ApiError
          ? err.message || 'Action failed.'
          : 'Action failed.',
      );
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const updateStatus = async (newStatus: AdminOrderStatus) => {
    if (!order || newStatus === order.status) return;
    await runAction(
      () => adminApi.orders.setStatus(order.reference, newStatus),
      `Status updated to ${STATUS_LABELS[newStatus]}`,
    );
  };

  const sendWhatsApp = async () => {
    if (!order) return;
    const ok = await runAction(
      () => adminApi.orders.whatsapp(order.reference, whatsAppText.trim()),
      'WhatsApp update logged',
    );
    if (ok) setWhatsAppOpen(false);
  };

  const confirmRefund = async () => {
    if (!order) return;
    const ok = await runAction(
      () => adminApi.orders.refund(order.reference, { reason: refundReason.trim() }),
      'Order marked as refunded',
    );
    if (ok) {
      setRefundOpen(false);
      setRefundReason('');
    }
  };

  const saveTracking = async () => {
    if (!order) return;
    if (!trackingCourier.trim() && !trackingNumber.trim()) {
      flash('Provide a courier, a tracking number, or both.');
      return;
    }
    const ok = await runAction(
      () => adminApi.orders.setTracking(order.reference, {
        courier: trackingCourier.trim(),
        tracking_number: trackingNumber.trim(),
      }),
      'Tracking updated',
    );
    if (ok) setTrackingOpen(false);
  };

  const markReturned = async () => {
    if (!order) return;
    await runAction(
      () => adminApi.orders.markReturned(order.reference),
      'Order marked as Returned',
    );
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newNote.trim()) return;
    const ok = await runAction(
      () => adminApi.orders.addNote(order.reference, newNote.trim()),
      'Note added',
    );
    if (ok) setNewNote('');
  };

  const handlePrintLabels = () => {
    if (!order) return;
    if (order.items.length === 0) {
      flash('No items to print.');
      return;
    }
    if (labelPrintBusy) return;
    setLabelPrintBusy(true);
    setPrintMode('labels');
  };

  useEffect(() => {
    if (printMode !== 'labels' || !order) return;

    let cancelled = false;
    const printRef = order.reference;
    const itemCount = order.items.length;

    const timer = setTimeout(() => {
      if (cancelled) return;
      window.print();
    }, 300);

    const onAfterPrint = () => {
      if (cancelled) return;
      setPrintMode(null);
      setLabelPrintBusy(false);

      adminApi.orders
        .addNote(
          printRef,
          `[System] Printed ${itemCount} thermal warranty label${itemCount === 1 ? '' : 's'} · ${new Date().toISOString()}`,
        )
        .then(() => flash('Labels printed · backend updated'))
        .catch(() => flash('Labels printed · backend sync failed'));

      window.removeEventListener('afterprint', onAfterPrint);
    };

    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printMode, order, flash]);

  const handleDownloadPdf = async () => {
    if (!order || pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await adminApi.orders.downloadPdf(order.reference);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${order.reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash('Receipt downloaded');
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

  const handleShareWhatsApp = () => {
    if (!order) return;
    const wa = toWaNumber(order.customer_phone);
    const lines: string[] = [];
    lines.push(`*${SHOP.name}* — Order Receipt`);
    lines.push('');
    lines.push(`Hi ${order.customer_name || 'there'},`);
    lines.push(`Thanks for your purchase! Here is your receipt summary:`);
    lines.push('');
    lines.push(`Order: #${order.reference}`);
    lines.push(`Date: ${formatDateShort(order.created_at)}`);
    if (order.payments[0]?.mpesa_receipt_number) {
      lines.push(`M-Pesa Ref: ${order.payments[0].mpesa_receipt_number}`);
    }
    lines.push('');
    lines.push('*Items:*');
    order.items.forEach((it) => {
      const serial = it.serial_number ? ` (S/N ${it.serial_number})` : '';
      const imei = it.imei ? ` (IMEI ${it.imei})` : '';
      lines.push(`• ${it.name} ×${it.quantity}${serial}${imei} — ${formatKES(it.subtotal)}`);
    });
    lines.push('');
    lines.push(`Subtotal: ${formatKES(order.subtotal)}`);
    if (parseFloat(order.discount) > 0) {
      lines.push(`Discount: -${formatKES(order.discount)}`);
    }
    lines.push(`Shipping: ${parseFloat(order.shipping) === 0 ? 'Free' : formatKES(order.shipping)}`);
    lines.push(`VAT (16%): ${formatKES(order.tax)}`);
    lines.push(`*Total: ${formatKES(order.total)}*`);
    lines.push('');
    lines.push(`Payment status: ${order.payment_status_label}`);
    lines.push('');
    lines.push(`Need help? Call ${SHOP.phone}`);

    const text = encodeURIComponent(lines.join('\n'));
    const url = wa
      ? `https://wa.me/${wa}?text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading order…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-2">
        <div className="bg-white border border-slate-200 rounded-sm p-6 max-w-md w-full text-center space-y-2">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900">Order not found</h1>
          <p className="text-[13px] text-slate-600">
            {error || 'We could not load this order.'}
          </p>
          <button
            onClick={onBack}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded-sm text-[13px] transition"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  const isTerminal =
    order.status === 'delivered' ||
    order.status === 'returned' ||
    order.status === 'cancelled' ||
    order.status === 'failed';

  const canRefund = order.payment_status === 'paid';
  const canMarkReturned = order.status === 'shipped' || order.status === 'delivered';

  const mpesaRef = order.payments[0]?.mpesa_receipt_number || '—';
  const receiptQrValue = JSON.stringify({
    ref: order.reference,
    total: order.total,
    mpesa: mpesaRef,
    token: order.verify_token || order.reference,
    verify: `https://${SHOP.website}/verify/${order.reference}`,
  });

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-2 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px] no-print">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {printMode === 'labels' && (
        <div className="thermal-page">
          <ThermalSticker order={order} />
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-[1700px] mx-auto px-2 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
              className="h-8 w-8 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[15px] font-semibold text-slate-900 font-mono">
                  #{order.reference}
                </h1>
                <span
                  className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${statusColor(order.status)}`}
                >
                  {order.status_label}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${paymentStatusColor(order.payment_status)}`}
                >
                  {order.payment_status_label}
                </span>
              </div>
              <p className="text-[13px] text-slate-500">
                Placed on {formatDate(order.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              {pdfBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            <button
              onClick={handlePrintLabels}
              disabled={labelPrintBusy || actionBusy}
              title="Prints a single thermal warranty sticker for the whole order"
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              {labelPrintBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Print Label</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2 py-2 rounded-sm text-[13px]"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>

            <span className="hidden md:block h-6 w-px bg-slate-200" />

            <FloatingDropdown
              width={220}
              align="right"
              trigger={({ open, toggle, ref }) => (
                <button
                  ref={ref}
                  onClick={toggle}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-60"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor(order.status)}`}
                  />
                  <span className="truncate">{STATUS_LABELS[order.status]}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            >
              {({ close }) => (
                <>
                  {(Object.keys(STATUS_LABELS) as AdminOrderStatus[]).map((k) => {
                    const isActive = k === order.status;
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          close();
                          if (!isActive) void updateStatus(k);
                        }}
                        disabled={actionBusy || isActive}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-sm text-[13px] transition disabled:opacity-60 ${
                          isActive
                            ? 'bg-blue-50 text-blue-950'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${statusColor(k)}`}
                        >
                          {STATUS_LABELS[k]}
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </>
              )}
            </FloatingDropdown>

            <button
              onClick={() => setWhatsAppOpen(true)}
              disabled={actionBusy}
              className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Message</span>
            </button>

            {canRefund && (
              <button
                onClick={() => setRefundOpen(true)}
                disabled={actionBusy}
                className="inline-flex items-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refund</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-2 py-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 space-y-2">
          <ReceiptCard
            ref={receiptRef}
            order={order}
            mpesaRef={mpesaRef}
            qrValue={receiptQrValue}
          />
        </div>

        <div className="space-y-2 no-print">
          <div className="bg-blue-50/60 border border-blue-100 rounded-sm p-2 space-y-1">
            <p className="text-[13px] font-semibold text-blue-950 flex items-center gap-2">
              <Printer className="w-3.5 h-3.5" />
              Thermal warranty label
            </p>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              Printing generates one single sticker ({THERMAL_LABEL_WIDTH_MM}×{THERMAL_LABEL_HEIGHT_MM}mm) listing all {order.items.length} item{order.items.length === 1 ? '' : 's'} in this order, and logs a print event to the backend for audit.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">Customer</h2>
            <div className="pt-2 border-t border-slate-100 space-y-2 text-[13px]">
              <p className="font-medium text-slate-900">
                {order.customer_name || '—'}
              </p>
              <p className="text-slate-600 font-mono flex items-center gap-2">
                <Phone className="w-3 h-3 text-slate-400" />
                {order.customer_phone || '—'}
              </p>
              <p className="text-slate-600 truncate flex items-center gap-2">
                <Mail className="w-3 h-3 text-slate-400" />
                {order.customer_email || '—'}
              </p>
              {(order.contact_email || order.contact_phone) &&
                (order.contact_email !== order.customer_email ||
                  order.contact_phone !== order.customer_phone) && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-slate-500">Delivery contact</p>
                    <p className="text-slate-800 mt-0.5 font-mono">
                      {order.contact_phone}
                    </p>
                    <p className="text-slate-800 truncate">{order.contact_email}</p>
                  </div>
                )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">Shipping</h2>
              <button
                onClick={() => setTrackingOpen(true)}
                disabled={actionBusy}
                className="text-[13px] text-blue-950 hover:underline font-medium disabled:opacity-60"
              >
                {order.courier || order.tracking_number ? 'Edit' : 'Add tracking'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <span className="font-medium text-slate-900">{order.delivery_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Courier</span>
                <span className="font-medium text-slate-900">
                  {order.courier || 'Not assigned'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tracking</span>
                <span className="font-mono font-medium text-blue-950 truncate">
                  {order.tracking_number || 'Pending'}
                </span>
              </div>
              {order.estimated_delivery && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ETA</span>
                  <span className="font-medium text-slate-900">
                    {order.estimated_delivery}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
              {canMarkReturned && (
                <button
                  onClick={markReturned}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-medium px-2 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
                >
                  <Undo2 className="w-3 h-3" />
                  Mark Returned
                </button>
              )}
              {!isTerminal && (
                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-medium px-2 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
                >
                  <Ban className="w-3 h-3" />
                  Cancel Order
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Internal notes
            </h2>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-[13px] text-slate-700 whitespace-pre-line min-h-[60px]">
              {order.internal_notes || 'No internal notes yet.'}
            </div>

            <form onSubmit={addNote} className="space-y-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Add internal note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={actionBusy}
                className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={actionBusy || !newNote.trim()}
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add note
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Status timeline ({order.timeline.length})
            </h2>
            {order.timeline.length === 0 ? (
              <p className="text-[13px] text-slate-400 italic py-2">
                No status events recorded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {order.timeline.map((t: AdminOrderStatusEvent) => {
                  const isCancel = t.to_status === 'cancelled' || t.to_status === 'failed';
                  const isReturn = t.to_status === 'returned';
                  return (
                    <li
                      key={t.id}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-start gap-2"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isCancel
                            ? 'bg-red-100 text-red-700'
                            : isReturn
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        {isCancel ? (
                          <X className="w-3 h-3" />
                        ) : isReturn ? (
                          <Undo2 className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900">
                          {t.from_label ? `${t.from_label} → ${t.status_label}` : t.status_label}
                        </p>
                        {t.note && (
                          <p className="text-[13px] text-slate-600 mt-0.5">{t.note}</p>
                        )}
                        <p className="text-[13px] text-slate-400 mt-0.5">
                          {t.actor_label || 'System'} · {formatDate(t.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {order.notes && (
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <h2 className="text-[13px] font-semibold text-slate-900">
                Customer note
              </h2>
              <p className="text-[13px] text-slate-700 whitespace-pre-line pt-2 border-t border-slate-100">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </main>

      {whatsAppOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 no-print"
          onClick={() => !actionBusy && setWhatsAppOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-2 shadow-xl space-y-2 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">
                Send WhatsApp update
              </h3>
              <button
                onClick={() => setWhatsAppOpen(false)}
                disabled={actionBusy}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-slate-500 mb-2">Live preview</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 text-slate-800">
                <p className="whitespace-pre-line">{whatsAppText}</p>
                <p className="text-[13px] text-slate-400 text-right mt-2">
                  Just now ✓✓
                </p>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Edit message
              </label>
              <textarea
                rows={4}
                value={whatsAppText}
                onChange={(e) => setWhatsAppText(e.target.value)}
                disabled={actionBusy}
                className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWhatsAppOpen(false)}
                disabled={actionBusy}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sendWhatsApp}
                disabled={actionBusy || !whatsAppText.trim()}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-60"
              >
                {actionBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {refundOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 no-print"
          onClick={() => !actionBusy && setRefundOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-2 shadow-xl text-center space-y-2 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Process refund
              </h3>
              <p className="text-slate-500 mt-2">
                Mark this order as refunded for the full amount of{' '}
                {formatKES(order.total)}. The actual M-Pesa reversal is a
                separate step you perform outside this system.
              </p>
            </div>

            <label className="block text-left">
              <span className="text-slate-700 font-medium">Reason (optional)</span>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                disabled={actionBusy}
                rows={2}
                placeholder="Customer returned item, wrong model…"
                className="mt-2 w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
            </label>

            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setRefundOpen(false)}
                disabled={actionBusy}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRefund}
                disabled={actionBusy}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px] disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm refund
              </button>
            </div>
          </div>
        </div>
      )}

      {trackingOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 no-print"
          onClick={() => !actionBusy && setTrackingOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-2 shadow-xl space-y-2 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Shipping details
              </h3>
            </div>

            <label className="block">
              <span className="text-slate-700 font-medium">Courier</span>
              <input
                type="text"
                value={trackingCourier}
                onChange={(e) => setTrackingCourier(e.target.value)}
                disabled={actionBusy}
                placeholder="e.g. G4S Courier, Sendy"
                className="mt-2 w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-slate-700 font-medium">Tracking number</span>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                disabled={actionBusy}
                placeholder="e.g. G4S-NBO-49201"
                className="mt-2 w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
            </label>

            <p className="text-[12px] text-slate-500">
              Setting tracking does not change the order status. Move the
              order to <span className="font-medium">Shipped</span> from the
              status dropdown to notify the customer.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setTrackingOpen(false)}
                disabled={actionBusy}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTracking}
                disabled={actionBusy}
                className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded-sm text-[13px] disabled:opacity-60"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ThermalSticker({ order }: { order: AdminOrderDetail }) {
  const qrValue = JSON.stringify({
    ref: order.reference,
    items: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.quantity,
      serial: i.serial_number || null,
    })),
    total: order.total,
    token: order.verify_token || order.reference,
    verify: `https://${SHOP.website}/verify/${order.reference}`,
  });

  return (
    <div className="thermal-sticker">
      <div className="thermal-header">
        <div className="thermal-header-title">{SHOP.displayName}</div>
        <div className="thermal-header-sub">Official Warranty Sticker</div>
      </div>
      <div className="thermal-divider" />
      <div>
        <div className="thermal-row">
          <span className="thermal-label">ORDER ID:</span>
          <span className="thermal-value thermal-value-mono">#{order.reference}</span>
        </div>
        <div className="thermal-row">
          <span className="thermal-label">CUSTOMER:</span>
          <span className="thermal-value">{order.customer_name || '—'}</span>
        </div>
        <div className="thermal-row">
          <span className="thermal-label">DATE BOUGHT:</span>
          <span className="thermal-value">{formatDateShort(order.created_at)}</span>
        </div>
        <div className="thermal-row">
          <span className="thermal-label">TOTAL:</span>
          <span className="thermal-value thermal-value-mono">{formatKES(order.total)}</span>
        </div>
      </div>
      <div className="thermal-divider" />
      <div>
        <div className="thermal-row">
          <span className="thermal-label">PRODUCTS ({order.items.length}):</span>
          <span className="thermal-value"></span>
        </div>
        <div className="thermal-products">
          {order.items.map((item) => (
            <div key={item.id} className="thermal-product-item">
              <span className="thermal-product-name">
                {item.name}
                {item.serial_number ? ` · S/N ${item.serial_number}` : ''}
                {item.imei ? ` · IMEI ${item.imei}` : ''}
              </span>
              <span className="thermal-product-qty">×{item.quantity}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="thermal-divider" />
      <div className="thermal-qr">
        <QRCodeSVG
          value={qrValue}
          size={120}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <div className="thermal-divider" />
      <div className="thermal-footer">
        <div><strong>WARRANTY:</strong> {SHOP.warranty}</div>
        <div><strong>SECURITY:</strong> {SHOP.security}</div>
        <div><strong>SUPPORT:</strong> {SHOP.email}</div>
      </div>
    </div>
  );
}

const ReceiptCard = React.forwardRef<HTMLDivElement, {
  order: AdminOrderDetail;
  mpesaRef: string;
  qrValue: string;
}>(function ReceiptCard({ order, mpesaRef, qrValue }, ref) {
  const discountValue = parseFloat(order.discount);
  const shippingValue = parseFloat(order.shipping);

  return (
    <div
      ref={ref}
      className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm no-print"
    >
      <div className="px-2 py-3 flex items-center justify-between gap-2 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          {SHOP.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={SHOP.logo}
              alt={SHOP.name}
              className="w-12 h-12 rounded-sm object-contain shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0 font-bold text-[15px]">
              {SHOP.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 leading-tight truncate">
              {SHOP.name}
            </h2>
            <p className="text-[13px] text-slate-500 truncate">
              {SHOP.tagline}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[13px] uppercase text-slate-400 font-semibold">
            Receipt
          </p>
          <p className="text-[13px] font-mono font-semibold text-slate-900">
            #{order.reference}
          </p>
          <span
            className={`inline-flex items-center gap-2 mt-2 px-2 py-0.5 rounded-sm text-[13px] font-medium border ${paymentStatusColor(order.payment_status)}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${paymentDotColor(order.payment_status)}`}
            />
            {order.payment_status_label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="px-2 py-3 border-b sm:border-b-0 sm:border-r border-slate-100">
          <p className="text-[13px] uppercase text-slate-400 font-semibold mb-2">
            Billed to
          </p>
          <div className="space-y-2 text-[13px]">
            <p className="font-semibold text-slate-900">
              {order.customer_name || 'Walk-in customer'}
            </p>
            {order.customer_phone && (
              <p className="text-slate-600 font-mono flex items-center gap-2">
                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                {order.customer_phone}
              </p>
            )}
            {order.customer_email && (
              <p className="text-slate-600 flex items-center gap-2">
                <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span className="truncate">{order.customer_email}</span>
              </p>
            )}
            {(order.contact_phone || order.contact_email) &&
              (order.contact_phone !== order.customer_phone ||
                order.contact_email !== order.customer_email) && (
                <p className="text-slate-500 flex items-start gap-2 pt-2">
                  <MapPin className="w-2.5 h-2.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    Delivery: {order.contact_phone || order.contact_email}
                  </span>
                </p>
              )}
          </div>
        </div>

        <div className="px-2 py-3">
          <p className="text-[12px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-2">
            Details
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-y-2 text-[13px] items-baseline">
            <dt className="text-slate-500 pr-2">Date</dt>
            <dd className="text-slate-900 font-medium text-right">
              {formatDate(order.created_at)}
            </dd>

            <dt className="text-slate-500 pr-2">Payment</dt>
            <dd className="text-slate-900 font-medium text-right">
              {order.payment_method}
            </dd>

            <dt className="text-slate-500 pr-2">M-Pesa</dt>
            <dd className="text-blue-950 font-mono font-semibold text-right truncate">
              {mpesaRef}
            </dd>
          </dl>
        </div>
      </div>

      <div className="border-t border-slate-100 px-2 pt-2 pb-3">
        <p className="text-[12px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-2">
          Items purchased
        </p>

        <ul className="space-y-2">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 p-2 rounded-sm bg-slate-50/70 border border-slate-100"
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="w-9 h-9 rounded-sm object-cover border border-slate-200 bg-white shrink-0"
                />
              ) : (
                <span className="w-9 h-9 rounded-sm bg-slate-100 border border-slate-200 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                      {item.name}
                    </p>
                    {item.brand && (
                      <p className="text-[12px] text-slate-500 truncate">
                        {item.brand}
                      </p>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900 shrink-0">
                    {formatKES(item.subtotal)}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[13px] text-slate-500">
                    ×{item.quantity} · {formatKES(item.price)} each
                  </span>
                  {item.serial_number && (
                    <span className="inline-block px-2 py-0.5 rounded-sm bg-white border border-slate-200 text-[12px] font-mono text-slate-600">
                      S/N {item.serial_number}
                    </span>
                  )}
                  {item.imei && (
                    <span className="inline-block px-2 py-0.5 rounded-sm bg-white border border-slate-200 text-[12px] font-mono text-slate-600">
                      IMEI {item.imei}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-100 px-2 py-3 grid grid-cols-1 md:grid-cols-[1fr_240px] gap-2 items-start">
        <div className="flex items-start gap-2">
          <div className="p-2 rounded-sm border border-slate-200 bg-white shrink-0">
            <QRCodeSVG
              value={qrValue}
              size={88}
              level="M"
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <div className="text-[13px] text-slate-500 space-y-2">
            <p className="font-semibold text-slate-800 text-[13px]">
              Scan to verify
            </p>
            <p className="leading-relaxed">
              Present at pickup, or scan with the admin QR scanner to confirm.
            </p>
            <div className="pt-2 space-y-2 text-[10px] text-slate-400">
              <p>{SHOP.address}</p>
              <p>VAT PIN: {SHOP.vatPin}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-sm border border-slate-100 p-2 space-y-2 text-[13px]">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-medium text-slate-800">
              {formatKES(order.subtotal)}
            </span>
          </div>

          {discountValue > 0 && (
            <div className="flex justify-between text-slate-600">
              <span className="truncate pr-2">
                Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}
              </span>
              <span className="font-medium text-red-600">
                −{formatKES(order.discount)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span className="font-medium text-slate-800">
              {shippingValue === 0 ? 'Free' : formatKES(order.shipping)}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>VAT (16%)</span>
            <span className="font-medium text-slate-800">
              {formatKES(order.tax)}
            </span>
          </div>

          <div className="pt-2 mt-0.5 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-[13px] uppercase text-slate-500 font-semibold">
              Total
            </span>
            <span className="text-[15px] font-bold text-slate-900">
              {formatKES(order.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50/70 border-t border-slate-100 px-2 py-2 text-center text-[12px] text-slate-500 space-y-2">
        <p className="font-medium text-slate-700">
          Thank you for shopping with {SHOP.name}!
        </p>
        <p>
          Warranty valid for 12 months on all electronics. Keep this receipt for returns and service.
        </p>
        <p className="font-mono text-[10px] text-slate-400 pt-0.5">
          {SHOP.website} · {SHOP.email}
        </p>
      </div>
    </div>
  );
});

function FilterDropdown({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = value !== null;
  const display = value ? labels?.[value] ?? value : label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 border rounded-sm px-2 py-2 text-[13px] font-medium transition whitespace-nowrap ${
          isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {display}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-2">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${
              !isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-2" />
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${
                  selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{labels?.[opt] ?? opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FloatingDropdown({
  trigger,
  children,
  width = 240,
  align = 'left',
}: {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: React.MutableRefObject<HTMLButtonElement | null>;
  }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  width?: number;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const openMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    if (left < 8) left = 8;

    const top = rect.bottom + 4;
    const maxHeight = Math.max(140, window.innerHeight - top - 8);

    setPos({ top, left, maxHeight });
    setOpen(true);
  };

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      {trigger({
        open,
        toggle: () => (open ? close() : openMenu()),
        ref: triggerRef,
      })}
      {open && pos && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width,
            maxHeight: pos.maxHeight,
          }}
          className="z-[120] bg-white border border-slate-200 rounded-sm shadow-lg overflow-y-auto p-2"
        >
          {children({ close })}
        </div>
      )}
    </>
  );
}