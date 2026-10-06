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
  MoreVertical, RefreshCw, MessageSquare, ExternalLink, ChevronRight,
  Send, DollarSign, ChevronDown, Undo2, Ban, Loader2, AlertCircle, Truck,
} from 'lucide-react';
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

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════
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

const statusColor = (s: AdminOrderStatus): string => {
  switch (s) {
    case 'delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'shipped':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'processing':
      return 'bg-blue-50 text-blue-950 border-blue-100';
    case 'confirmed':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'returned':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'cancelled':
      return 'bg-red-50 text-red-600 border-red-100';
    case 'failed':
      return 'bg-red-50 text-red-600 border-red-100';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-100';
  }
};

const paymentStatusColor = (s: AdminOrderPaymentStatus): string => {
  switch (s) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'refunded':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'failed':
      return 'bg-red-50 text-red-600 border-red-100';
    case 'unpaid':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
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

// ═════════════════════════════════════════════════════════════════════════════
// PAGE — wrapped in Suspense (useSearchParams requirement)
// ═════════════════════════════════════════════════════════════════════════════
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
      <OrdersPageInner />
    </Suspense>
  );
}

function OrdersPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Auto-open detail if a `reference` is in the URL
  const initialRef = searchParams.get('reference');
  const [selectedReference, setSelectedReference] = useState<string | null>(initialRef);

  // If the URL changes (e.g. Reports hands off a different reference), sync
  const searchKey = searchParams.toString();
  useEffect(() => {
    const ref = searchParams.get('reference');
    if (ref !== selectedReference) {
      setSelectedReference(ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  const handleBack = () => {
    setSelectedReference(null);
    // Remove `reference` from URL, keep everything else (range, date, …)
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
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS BREADCRUMB
// ═════════════════════════════════════════════════════════════════════════════
function ReportsBreadcrumb() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const range = searchParams.get('range');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const from = searchParams.get('from'); // optional source tab

  // Only render when we know we came from Reports
  if (!range) return null;

  const back = new URLSearchParams();
  back.set('tab', from ?? 'orders');
  back.set('range', range);
  if (range === 'custom' && start && end) {
    back.set('start', start);
    back.set('end', end);
  }

  return (
    <div className="mb-2 flex items-center gap-1.5 text-[13px] text-slate-500">
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

// ═════════════════════════════════════════════════════════════════════════════
// 1. LIST VIEW
// ═════════════════════════════════════════════════════════════════════════════
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

  // Date filters seeded from the URL on first render
  const initialDates = useMemo(() => {
    const date = searchParams.get('date');
    const range = searchParams.get('range');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (date) return { from: date, to: date };
    if (range === 'custom' && start && end) return { from: start, to: end };
    return { from: '', to: '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on first mount

  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [paymentFilter, setPaymentFilter] = useState<AdminOrderPaymentStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Re-apply query params when they change (e.g. user clicks another Reports handoff)
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

  // ── Fetch tab counts + stats once on mount ──
  const refreshAggregates = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        adminApi.orders.tabCounts(),
        adminApi.orders.stats(),
      ]);
      setTabCounts(c);
      setStats(s);
    } catch {
      // Non-fatal — the list still works without them.
    }
  }, []);

  useEffect(() => {
    void refreshAggregates();
  }, [refreshAggregates]);

  // ── Fetch list on filter change (debounced on search) ──
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

  // ── Clear date filters (and remove them from URL) ──
  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('date');
    params.delete('start');
    params.delete('end');
    // keep `range` so the breadcrumb still shows
    const qs = params.toString();
    router.replace(qs ? `/admin/orders?${qs}` : '/admin/orders');
  };

  // ── Selection ──
  const allSelected =
    rows.length > 0 && selectedIds.length === rows.length;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : rows.map((r) => r.reference));
  const toggleRow = (ref: string) =>
    setSelectedIds((prev) =>
      prev.includes(ref) ? prev.filter((x) => x !== ref) : [...prev, ref],
    );

  // ── Export ──
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

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Orders</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Manage customer transactions and fulfillment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setToastMessage('Create order is not supported yet')}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create order</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 pb-2 flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition shrink-0 ${isActive ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {tab.label}
                <span
                  className={`text-[13px] px-1.5 rounded-sm ${isActive ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {tabCount(tab.key)}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* BREADCRUMB FROM REPORTS */}
        <ReportsBreadcrumb />

        {/* STATS */}
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

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search order #, customer, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 w-44"
              />
            </div>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 w-44"
              />
            </div>

            {hasDateFilter && (
              <button
                onClick={clearDates}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
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

        {/* BULK */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleExport}
                className="bg-emerald-600 hover:bg-emerald-500 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Export current view
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-center gap-2 text-[13px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3 font-medium">Order #</th>
                  <th className="py-2 px-3 font-medium">Customer</th>
                  <th className="py-2 px-3 font-medium text-center">Items</th>
                  <th className="py-2 px-3 font-medium text-right">Total</th>
                  <th className="py-2 px-3 font-medium">Payment</th>
                  <th className="py-2 px-3 font-medium">Fulfillment</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      Loading orders…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
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
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ord.reference)}
                          onChange={() => toggleRow(ord.reference)}
                          className="rounded-sm border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">
                        #{ord.reference}
                      </td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900 truncate max-w-[180px]">
                          {ord.customer_name || '—'}
                        </p>
                        <p className="text-[13px] text-slate-400 font-mono">
                          {ord.customer_phone || '—'}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">{ord.item_count}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {formatKES(ord.total)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-medium border border-slate-200">
                            {ord.payment_method}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${paymentDotColor(ord.payment_status)}`}
                            title={ord.payment_status_label}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusColor(ord.status)}`}
                        >
                          {STATUS_LABELS[ord.status]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">
                        {formatDate(ord.date)}
                      </td>
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectOrder(ord.reference)}
                          className="p-1.5 rounded-sm bg-slate-100 hover:bg-blue-950 hover:text-white text-slate-700 transition"
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

// ═════════════════════════════════════════════════════════════════════════════
// 2. DETAIL VIEW — unchanged
// ═════════════════════════════════════════════════════════════════════════════
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

  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingCourier, setTrackingCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const [newNote, setNewNote] = useState('');

  const anyModalOpen = whatsAppOpen || refundOpen || trackingOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const flash = (msg: string) => setToastMessage(msg);

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

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

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
      () => adminApi.orders.refund(order.reference, {
        reason: refundReason.trim(),
      }),
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
      <div className="min-h-screen flex items-center justify-center p-3">
        <div className="bg-white border border-slate-200 rounded-sm p-6 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-sm flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900">Order not found</h1>
          <p className="text-[13px] text-slate-600">
            {error || 'We could not load this order.'}
          </p>
          <button
            onClick={onBack}
            className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition"
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
  const canMarkReturned =
    order.status === 'shipped' || order.status === 'delivered';

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-2 flex-wrap">
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
            <select
              value={order.status}
              onChange={(e) => updateStatus(e.target.value as AdminOrderStatus)}
              disabled={actionBusy}
              className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
            >
              {(Object.keys(STATUS_LABELS) as AdminOrderStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABELS[k]}
                </option>
              ))}
            </select>

            <button
              onClick={() => setWhatsAppOpen(true)}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => flash('Invoice download coming soon.')}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invoice</span>
            </button>

            {canRefund && (
              <button
                onClick={() => setRefundOpen(true)}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refund</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* ITEMS */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Order items ({order.items.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2 font-medium">Product</th>
                    <th className="py-2 px-2 font-medium text-center">Qty</th>
                    <th className="py-2 px-2 font-medium text-right">Unit</th>
                    <th className="py-2 px-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt=""
                              className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="w-9 h-9 rounded-sm bg-slate-100 border border-slate-200 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[240px]">
                              {item.name}
                            </p>
                            {item.brand && (
                              <p className="text-[13px] text-slate-400 truncate">
                                {item.brand}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">{item.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {formatKES(item.price)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-900">
                        {formatKES(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col items-end gap-1 text-[13px]">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatKES(order.subtotal)}</span>
              </div>
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between w-64 text-slate-600">
                  <span>Discount {order.coupon_code && `(${order.coupon_code})`}</span>
                  <span className="font-medium text-red-600">
                    -{formatKES(order.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between w-64 text-slate-600">
                <span>Shipping fee</span>
                <span className="font-medium">
                  {parseFloat(order.shipping) === 0 ? 'Free' : formatKES(order.shipping)}
                </span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>VAT (16%)</span>
                <span className="font-medium">{formatKES(order.tax)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-900 font-semibold pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>{formatKES(order.total)}</span>
              </div>
            </div>
          </div>

          {/* PAYMENT */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">
                Payment information
              </h2>
              <span
                className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${paymentStatusColor(order.payment_status)}`}
              >
                {order.payment_status_label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-sm p-2 text-[13px]">
              <div>
                <p className="text-slate-500">Method</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {order.payment_method}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Payment ref</p>
                <p className="font-mono font-medium text-blue-950 mt-0.5 truncate">
                  {order.payments[0]?.mpesa_receipt_number || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Amount</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {formatKES(order.total)}
                </p>
              </div>
              <div className="flex items-end">
                <p className="text-slate-500">
                  {order.payments.length} attempt
                  {order.payments.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Status timeline ({order.timeline.length})
            </h2>
            {order.timeline.length === 0 ? (
              <p className="text-[13px] text-slate-400 italic py-3">
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
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isCancel
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
        </div>

        <div className="space-y-3">
          {/* CUSTOMER */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">Customer</h2>
            <div className="pt-2 border-t border-slate-100 space-y-1 text-[13px]">
              <p className="font-medium text-slate-900">
                {order.customer_name || '—'}
              </p>
              <p className="text-slate-600 font-mono">
                {order.customer_phone || '—'}
              </p>
              <p className="text-slate-600 truncate">
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

          {/* SHIPPING */}
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

            <div className="pt-2 border-t border-slate-100 space-y-1 text-[13px]">
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
                  className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition disabled:opacity-60"
                >
                  <Undo2 className="w-3 h-3" />
                  Mark Returned
                </button>
              )}
              {!isTerminal && (
                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition disabled:opacity-60"
                >
                  <Ban className="w-3 h-3" />
                  Cancel Order
                </button>
              )}
            </div>
          </div>

          {/* NOTES */}
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
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={actionBusy || !newNote.trim()}
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add note
                </button>
              </div>
            </form>
          </div>

          {/* CUSTOMER NOTE */}
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

      {/* WHATSAPP MODAL */}
      {whatsAppOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => !actionBusy && setWhatsAppOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl space-y-3 text-[13px]"
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
              <p className="text-slate-500 mb-1">Live preview</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 text-slate-800">
                <p className="whitespace-pre-line">{whatsAppText}</p>
                <p className="text-[13px] text-slate-400 text-right mt-1">
                  Just now ✓✓
                </p>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Edit message
              </label>
              <textarea
                rows={4}
                value={whatsAppText}
                onChange={(e) => setWhatsAppText(e.target.value)}
                disabled={actionBusy}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWhatsAppOpen(false)}
                disabled={actionBusy}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sendWhatsApp}
                disabled={actionBusy || !whatsAppText.trim()}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
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

      {/* REFUND MODAL */}
      {refundOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => !actionBusy && setRefundOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Process refund
              </h3>
              <p className="text-slate-500 mt-1">
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
                className="mt-1 w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
              />
            </label>

            <div className="flex justify-center gap-2 pt-1">
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
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px] disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRACKING MODAL */}
      {trackingOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => !actionBusy && setTrackingOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-[13px]"
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
                className="mt-1 w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
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
                className="mt-1 w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
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
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTracking}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-60"
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

// ═════════════════════════════════════════════════════════════════════════════
// FilterDropdown
// ═════════════════════════════════════════════════════════════════════════════
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
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
          ? 'bg-blue-50 border-blue-950 text-blue-950'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {display}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
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