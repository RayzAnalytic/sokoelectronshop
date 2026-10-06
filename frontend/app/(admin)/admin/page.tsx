'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Download,
  AlertTriangle,
  X,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Users,
  Package,
  RotateCcw,
  CreditCard,
  DollarSign,
  Calendar,
  UserPlus,
  Receipt,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  OverviewQuery,
  OverviewRange,
  OverviewResponse,
  OverviewKpi,
  OverviewTopProduct,
  OverviewLowStockRow,
  OverviewRecentOrder,
} from '@/lib/admin-types';

// ─────────────────────────────────────────────────────────────
// Local UI types
// ─────────────────────────────────────────────────────────────
type UiDateRange = 'Today' | '7d' | '30d' | '90d' | 'Custom';
type RevenueTab = 'Revenue' | 'Orders';
type SalesGrouping = 'Day' | 'Week' | 'Month';

// ─────────────────────────────────────────────────────────────
// Colours
// ─────────────────────────────────────────────────────────────
const BLUE = '#172554';
const GREEN = '#059669';
const RED = '#dc2626';
const AMBER = '#d97706';
const INDIGO = '#4f46e5';

// ─────────────────────────────────────────────────────────────
// Backend base URL — used to make relative media paths absolute
// ─────────────────────────────────────────────────────────────
const BACKEND_URL =
  (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const s = String(url).trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
    return s;
  }
  const clean = s.startsWith('/') ? s : `/${s}`;
  return `${BACKEND_URL}${clean}`;
}

// ─────────────────────────────────────────────────────────────
// Range maps
// ─────────────────────────────────────────────────────────────
const UI_TO_API_RANGE: Record<UiDateRange, OverviewRange> = {
  Today: 'today',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  Custom: 'custom',
};

// ─────────────────────────────────────────────────────────────
// Icon name → component map
// ─────────────────────────────────────────────────────────────
const KPI_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  DollarSign,
  Calendar,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Users,
  Package,
  AlertTriangle,
  RotateCcw,
  CreditCard,
};

const STATUS_STYLES: Record<string, string> = {
  Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Processing: 'bg-blue-50 text-blue-950 border-blue-100',
  Shipped: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  Confirmed: 'bg-sky-50 text-sky-900 border-sky-200',
  Cancelled: 'bg-red-50 text-red-600 border-red-100',
  Returned: 'bg-orange-50 text-orange-700 border-orange-200',
  Failed: 'bg-red-50 text-red-600 border-red-100',
};

const TXN_STATUS_STYLES: Record<string, string> = {
  Success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  Failed: 'bg-red-50 text-red-600 border-red-100',
  Refunded: 'bg-slate-50 text-slate-600 border-slate-200',
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[13px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading dashboard…
        </div>
      }
    >
      <AdminDashboardInner />
    </Suspense>
  );
}

function AdminDashboardInner() {
  const [dateRange, setDateRange] = useState<UiDateRange>('7d');
  const [revenueTab, setRevenueTab] = useState<RevenueTab>('Revenue');
  const [salesGrouping, setSalesGrouping] = useState<SalesGrouping>('Day');

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [selectedKpi, setSelectedKpi] = useState<OverviewKpi | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OverviewTopProduct | null>(null);
  const [restockProduct, setRestockProduct] = useState<OverviewLowStockRow | null>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch on range change ────────────────────────────────
  const loadData = useCallback(async () => {
    const query: OverviewQuery = { range: UI_TO_API_RANGE[dateRange] };
    const res = await adminApi.overview.get(query);
    if (res.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res);
      setError(null);
    }
  }, [dateRange]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loadData()
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const handleRefresh = async () => {
    try {
      await adminApi.overview.refreshCache({ range: UI_TO_API_RANGE[dateRange] });
      await loadData();
      showToast('Dashboard refreshed');
    } catch {
      showToast('Refresh failed');
    }
  };

  const formatKES = useCallback(
    (val: number) =>
      new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        maximumFractionDigits: 0,
      }).format(val),
    [],
  );

  // ── Restock — this now actually hits the API ─────────────
  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;

    if (!restockQty || restockQty < 1) {
      setRestockError('Enter a quantity of at least 1.');
      return;
    }

    setIsRestocking(true);
    setRestockError(null);

    try {
      await adminApi.inventory.adjust({
        productId: restockProduct.id,
        type: 'Add',
        quantity: restockQty,
        reason: 'Restock from dashboard',
      });

      showToast(`Added ${restockQty} unit${restockQty === 1 ? '' : 's'} to ${restockProduct.name}`);

      // Close modal immediately
      setRestockProduct(null);
      setRestockQty(10);

      // Clear server cache so the fresh numbers come back, then refetch
      try {
        await adminApi.overview.refreshCache({ range: UI_TO_API_RANGE[dateRange] });
      } catch {
        /* non-fatal */
      }
      await loadData();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Restock failed. Check the inventory endpoint.';
      setRestockError(msg);
      showToast('Restock failed');
    } finally {
      setIsRestocking(false);
    }
  };

  // ── Derived data ────────────────────────────────────────
  const kpis: OverviewKpi[] = data?.kpis ?? [];
  const revenueChart = data?.revenue_chart ?? [];
  const orderStatus = data?.order_status ?? [];
  const salesByPeriod = data?.sales_by_period ?? { Day: [], Week: [], Month: [] };
  const topCategories = data?.top_categories ?? [];
  const topProducts = data?.top_products ?? [];
  const recentOrders = data?.recent_orders ?? [];
  const recentCustomers = data?.recent_customers ?? [];
  const recentTransactions = data?.recent_transactions ?? [];
  const lowStock = data?.low_stock ?? [];
  const paymentMethods = data?.payment_methods ?? [];

  const totalOrdersForPie = useMemo(
    () => orderStatus.reduce((sum, s) => sum + (s.value || 0), 0),
    [orderStatus],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-8">

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PAGE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Overview of your store performance</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-white border border-slate-200 rounded-sm p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
              {(['Today', '7d', '30d', '90d', 'Custom'] as UiDateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition ${dateRange === range
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <button
              onClick={() => showToast('Exporting report…')}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white text-[13px] font-medium px-3 py-2 rounded-sm transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* ERROR */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-100 rounded-sm p-3 flex items-start gap-2 text-[13px]">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-700">Couldn&apos;t load the dashboard</p>
              <p className="text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="bg-white border border-red-200 hover:bg-red-100 text-red-700 font-medium px-2 py-1 rounded-sm text-[13px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI CARDS — ROW 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.slice(0, 5).map((kpi) => (
            <KpiCard
              key={kpi.id}
              kpi={kpi}
              isLoading={isLoading}
              onClick={() => setSelectedKpi(kpi)}
            />
          ))}
          {!isLoading && kpis.length === 0 && (
            <p className="col-span-full text-[13px] text-slate-400 italic text-center py-4">
              No KPI data available.
            </p>
          )}
        </div>

        {/* KPI CARDS — ROW 2 */}
        {kpis.length > 5 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.slice(5).map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                isLoading={isLoading}
                onClick={() => setSelectedKpi(kpi)}
              />
            ))}
          </div>
        )}

        {/* ROW: Revenue + Orders by Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-900">Revenue &amp; Orders Overview</h2>
                <p className="text-[13px] text-slate-500">Performance metrics across selected period</p>
              </div>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
                {(['Revenue', 'Orders'] as RevenueTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRevenueTab(tab)}
                    className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition ${revenueTab === tab
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="h-64 bg-slate-100 rounded-sm animate-pulse" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChart}>
                    <defs>
                      <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={13}
                      tickLine={false}
                      tickFormatter={(val) =>
                        revenueTab === 'Revenue' ? `${val / 1000}k` : String(val)
                      }
                    />
                    <Tooltip
                      formatter={(value: unknown) => [
                        revenueTab === 'Revenue'
                          ? formatKES(Number(value))
                          : `${value} orders`,
                        revenueTab,
                      ]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '2px',
                        color: '#0f172a',
                        fontSize: '13px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={revenueTab === 'Revenue' ? 'revenue' : 'orders'}
                      stroke={BLUE}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#fillBlue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">Orders by Status</h2>
              <p className="text-[13px] text-slate-500">Distribution of current workflow</p>
            </div>

            {isLoading ? (
              <div className="h-56 bg-slate-100 rounded-sm animate-pulse" />
            ) : orderStatus.length === 0 ? (
              <p className="text-[13px] text-slate-400 italic py-6 text-center">
                No orders in this range.
              </p>
            ) : (
              <div className="h-56 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {orderStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown) => [`${value} orders`, 'Count']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '2px',
                        color: '#0f172a',
                        fontSize: '13px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[15px] font-bold text-slate-900">
                    {totalOrdersForPie.toLocaleString()}
                  </span>
                  <span className="text-[13px] text-slate-500">Total</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              {orderStatus.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-[13px]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 truncate">{item.name}</span>
                  <span className="font-semibold text-slate-900 ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ROW: Sales by Period + Top Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-900">Sales by Period</h2>
                <p className="text-[13px] text-slate-500">Revenue grouped by day, week, or month</p>
              </div>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
                {(['Day', 'Week', 'Month'] as SalesGrouping[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setSalesGrouping(g)}
                    className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition ${salesGrouping === g
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="h-56 bg-slate-100 rounded-sm animate-pulse" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByPeriod[salesGrouping]}>
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={13} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={13}
                      tickLine={false}
                      tickFormatter={(val) => `${val / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [formatKES(Number(value)), 'Revenue']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '2px',
                        color: '#0f172a',
                        fontSize: '13px',
                      }}
                    />
                    <Bar dataKey="revenue" fill={BLUE} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-900">Top Categories</h2>
                <p className="text-[13px] text-slate-500">Revenue by product category</p>
              </div>
              <Link href="/admin/categories" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {topCategories.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-6 text-center">
                  No category data yet.
                </p>
              ) : (
                topCategories.map((cat) => (
                  <div
                    key={cat.name}
                    className="py-2 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-slate-900 truncate">{cat.name}</span>
                      <span className="text-slate-400 shrink-0">·</span>
                      <span className="text-slate-500 shrink-0">
                        {cat.products} products
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900 shrink-0">
                      {formatKES(cat.revenue)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ROW: Top Products + Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-900">Top Selling Products</h2>
                <p className="text-[13px] text-slate-500">Best performing items by revenue</p>
              </div>
              <Link href="/admin/products" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-2 px-2 font-medium">Product</th>
                    <th className="py-2 px-2 font-medium">SKU</th>
                    <th className="py-2 px-2 font-medium text-right">Sold</th>
                    <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-[13px]">
                        No product sales yet.
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p) => {
                      const img = resolveImageUrl(p.image);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProduct(p)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-2 flex items-center gap-2">
                            {img ? (
                              <img
                                src={img}
                                alt={p.name}
                                className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0 bg-slate-100"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                                <Package className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className="font-medium text-slate-900 line-clamp-1">{p.name}</span>
                          </td>
                          <td className="py-2 px-2 text-slate-500 font-mono">{p.sku}</td>
                          <td className="py-2 px-2 text-right text-slate-700">{p.sold}</td>
                          <td className="py-2 px-2 text-right font-semibold text-slate-900">
                            {formatKES(p.revenue)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-900">Recent Orders</h2>
                <p className="text-[13px] text-slate-500">Latest store transactions</p>
              </div>
              <Link href="/admin/orders" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-6 text-center">
                  No recent orders.
                </p>
              ) : (
                recentOrders.map((ord) => (
                  <div key={ord.id} className="py-2 flex items-center justify-between text-[13px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{ord.orderNumber}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 truncate">{ord.customer}</span>
                      </div>
                      <p className="text-[13px] text-slate-400 mt-0.5">{ord.time}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-semibold text-slate-900">{formatKES(ord.amount)}</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${STATUS_STYLES[ord.status] || 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                      >
                        {ord.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ROW: Recent Customers + Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-950" />
                <div>
                  <h2 className="text-[13px] font-semibold text-slate-900">Recent Customers</h2>
                  <p className="text-[13px] text-slate-500">Newest registered users</p>
                </div>
              </div>
              <Link href="/admin/customers" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentCustomers.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-6 text-center">
                  No customers yet.
                </p>
              ) : (
                recentCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="py-2 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
                        {c.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[13px] text-slate-400 truncate">{c.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-slate-900">{formatKES(c.spent)}</p>
                      <p className="text-[13px] text-slate-400">
                        {c.orders} orders · {c.joined}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-950" />
                <div>
                  <h2 className="text-[13px] font-semibold text-slate-900">Recent Transactions</h2>
                  <p className="text-[13px] text-slate-500">Latest payment activity</p>
                </div>
              </div>
              <Link href="/admin/transactions" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentTransactions.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-6 text-center">
                  No transactions yet.
                </p>
              ) : (
                recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="py-2 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-slate-900">{t.ref}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 truncate">{t.customer}</span>
                      </div>
                      <p className="text-[13px] text-slate-400 mt-0.5">
                        {t.method} · {t.time}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-semibold text-slate-900">{formatKES(t.amount)}</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${TXN_STATUS_STYLES[t.status] || 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ROW: Low Stock + Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <h2 className="text-[13px] font-semibold text-slate-900">Low Stock Alerts</h2>
                  <p className="text-[13px] text-slate-500">Products needing restock</p>
                </div>
              </div>
              <span className="text-[13px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-sm border border-red-100">
                {lowStock.length} items
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {lowStock.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-6 text-center">
                  All products are well stocked.
                </p>
              ) : (
                lowStock.map((item) => {
                  const img = resolveImageUrl(item.image);
                  return (
                    <div
                      key={item.id}
                      className="py-2 flex items-center justify-between gap-2 text-[13px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {img ? (
                          <img
                            src={img}
                            alt={item.name}
                            className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0 bg-slate-100"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                            <Package className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-medium text-slate-900 line-clamp-1">{item.name}</h4>
                          <p className="text-[13px] text-slate-400 truncate">
                            SKU: {item.sku} · Threshold: {item.threshold}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded-sm border border-red-200 text-[13px]">
                          {item.stock} left
                        </span>
                        <button
                          onClick={() => {
                            setRestockError(null);
                            setRestockQty(10);
                            setRestockProduct(item);
                          }}
                          className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">Payment Method Breakdown</h2>
              <p className="text-[13px] text-slate-500">Volume distribution across gateways</p>
            </div>

            <div className="h-56 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={paymentMethods}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    stroke="#94a3b8"
                    fontSize={13}
                    tickLine={false}
                    tickFormatter={(v) => `${v / 1000000}M`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={13}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [formatKES(Number(value)), 'Volume']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '2px',
                      color: '#0f172a',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                    {paymentMethods.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>

      {/* KPI MODAL */}
      {selectedKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 space-y-3 shadow-xl relative">
            <button
              onClick={() => setSelectedKpi(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-900 p-1.5 rounded-sm hover:bg-slate-100 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <span className="text-[13px] font-semibold text-blue-950 uppercase tracking-wide">
                {selectedKpi.title} Breakdown
              </span>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">
                {selectedKpi.prefix}
                {selectedKpi.value.toLocaleString()}
                {selectedKpi.suffix}
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">Detailed trend for {dateRange}.</p>
            </div>

            <div className="h-40 w-full bg-white border border-slate-200 rounded-sm p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedKpi.sparklineData}>
                  <defs>
                    <linearGradient id="fillKpi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={BLUE}
                    strokeWidth={2}
                    fill="url(#fillKpi)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Change</span>
                <span
                  className={`font-semibold ${selectedKpi.isPositive ? 'text-emerald-600' : 'text-red-600'
                    }`}
                >
                  {selectedKpi.isPositive
                    ? `+${selectedKpi.change}%`
                    : `${selectedKpi.change}%`}{' '}
                  vs previous cycle
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Data Interval</span>
                <span className="font-medium text-slate-900">Real-time ({dateRange})</span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedKpi(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT DRAWER */}
      {selectedProduct && (() => {
        const img = resolveImageUrl(selectedProduct.image);
        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white border-l border-slate-200 w-full max-w-md h-full p-3 overflow-y-auto shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-semibold text-slate-900">Product Details</h3>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-slate-400 hover:text-slate-900 p-1.5 rounded-sm hover:bg-slate-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="w-full h-40 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {img ? (
                      <img
                        src={img}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-[13px] font-semibold text-blue-950 uppercase tracking-wide">
                      {selectedProduct.category}
                    </span>
                    <h2 className="text-[15px] font-bold text-slate-900 mt-0.5">
                      {selectedProduct.name}
                    </h2>
                    <p className="text-[13px] text-slate-500 font-mono mt-0.5">
                      SKU: {selectedProduct.sku}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-slate-200 p-2 rounded-sm">
                      <p className="text-[13px] text-slate-500">Units Sold</p>
                      <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                        {selectedProduct.sold}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 p-2 rounded-sm">
                      <p className="text-[13px] text-slate-500">Revenue</p>
                      <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                        {formatKES(selectedProduct.revenue)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Inventory</span>
                      <span
                        className={`font-semibold ${selectedProduct.stock <= 5 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                      >
                        {selectedProduct.stock} units
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Listing ID</span>
                      <span className="font-mono text-slate-900">{selectedProduct.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => {
                    setRestockError(null);
                    setRestockQty(10);
                    setRestockProduct({
                      id: selectedProduct.id,
                      name: selectedProduct.name,
                      sku: selectedProduct.sku,
                      stock: selectedProduct.stock,
                      threshold: 0,
                      category: selectedProduct.category,
                      image: selectedProduct.image,
                    });
                    setSelectedProduct(null);
                  }}
                  className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px] transition"
                >
                  Restock
                </button>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 px-3 rounded-sm text-[13px] transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RESTOCK MODAL */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 space-y-3 shadow-xl relative">
            <button
              onClick={() => {
                if (isRestocking) return;
                setRestockProduct(null);
                setRestockError(null);
              }}
              disabled={isRestocking}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-900 p-1.5 rounded-sm hover:bg-slate-100 transition disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h3 className="text-[13px] font-semibold text-slate-900">Restock Inventory</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Add units to{' '}
                <span className="font-medium text-slate-900">{restockProduct.name}</span>
              </p>
            </div>

            <form onSubmit={handleRestock} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  Units to add
                </label>
                <input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  disabled={isRestocking}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
                />
                <p className="text-[13px] text-slate-400 mt-1">
                  Current stock: {restockProduct.stock} units
                </p>
              </div>

              {restockError && (
                <div className="bg-red-50 border border-red-100 rounded-sm p-2 flex items-start gap-2 text-[13px]">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-red-700">{restockError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRestockProduct(null);
                    setRestockError(null);
                  }}
                  disabled={isRestocking}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestocking}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
                >
                  {isRestocking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isRestocking ? 'Adding…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ═════════════════════════════════════════════════════════════════════════════
function KpiCard({
  kpi,
  isLoading,
  onClick,
}: {
  kpi: OverviewKpi;
  isLoading: boolean;
  onClick: () => void;
}) {
  const Icon = KPI_ICON_MAP[kpi.icon] ?? DollarSign;

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col justify-between min-h-[92px]">
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-slate-100 rounded-sm w-1/2" />
          <div className="h-5 bg-slate-100 rounded-sm w-3/4" />
          <div className="h-8 bg-slate-100 rounded-sm w-full mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-sm p-2 hover:border-blue-950 transition cursor-pointer flex flex-col justify-between min-h-[92px]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <p className="text-[13px] font-medium text-slate-500 truncate">{kpi.title}</p>
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
            {kpi.prefix}
            {kpi.value.toLocaleString(undefined, {
              minimumFractionDigits: kpi.decimals || 0,
              maximumFractionDigits: kpi.decimals || 0,
            })}
            {kpi.suffix}
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-0.5 text-[13px] font-semibold px-2 py-0.5 rounded-sm shrink-0 ${kpi.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}
        >
          {kpi.isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {kpi.change > 0 ? `+${kpi.change}%` : `${kpi.change}%`}
        </span>
      </div>

      <div className="h-9 mt-2 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kpi.sparklineData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={kpi.isPositive ? GREEN : RED}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}