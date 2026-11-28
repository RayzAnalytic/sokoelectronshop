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
  RefreshCw,
  AlertCircle,
  Loader2,
  Truck,
  MessageCircle,
  Share2,
  Tag,
  Star,
  FileText,
  ArrowUpRight,
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
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  OverviewQuery,
  OverviewRange,
  OverviewResponse,
  OverviewKpi,
  OverviewTopProduct,
  OverviewLowStockRow,
  OverviewModuleSummary,
} from '@/lib/admin-types';

type UiDateRange = 'Today' | '7d' | '30d' | '90d' | 'Custom';

const BLUE = '#172554';
const GREEN = '#059669';
const RED = '#dc2626';

const BACKEND_URL =
  (process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

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

const UI_TO_API_RANGE: Record<UiDateRange, OverviewRange> = {
  Today: 'today',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  Custom: 'custom',
};

const KPI_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<OverviewTopProduct | null>(null);
  const [restockProduct, setRestockProduct] = useState<OverviewLowStockRow | null>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    const query: OverviewQuery = { range: UI_TO_API_RANGE[dateRange] };
    if (dateRange === 'Custom') {
      if (!appliedCustom?.start || !appliedCustom?.end) return;
      query.start = appliedCustom.start;
      query.end = appliedCustom.end;
    }
    const res = await adminApi.overview.get(query);
    if (res.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res);
      setError(null);
    }
  }, [dateRange, appliedCustom]);

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
      const rangeKey =
        dateRange === 'Custom' && appliedCustom
          ? `custom:${appliedCustom.start}..${appliedCustom.end}`
          : UI_TO_API_RANGE[dateRange];
      await adminApi.overview.refreshCache({ range: rangeKey });
      await loadData();
      showToast('Dashboard refreshed');
    } catch {
      showToast('Refresh failed');
    }
  };

  const handleExportCsv = () => {
    if (!data) {
      showToast('No dashboard data to export');
      return;
    }
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: string[] = ['Section,Name,Metric,Extra'];
    for (const k of data.kpis ?? []) {
      rows.push([esc('KPI'), esc(k.title), esc(`${k.prefix ?? ''}${k.value}${k.suffix ?? ''}`), esc(`${k.change}%`)].join(','));
    }
    for (const m of data.module_summaries ?? []) {
      rows.push([esc('Module'), esc(m.title), esc(m.metric), esc(m.subtext)].join(','));
    }
    for (const p of data.top_products ?? []) {
      rows.push([esc('Top Product'), esc(p.name), esc(`KES ${p.revenue}`), esc(`${p.sold} sold`)].join(','));
    }
    for (const o of data.recent_orders ?? []) {
      rows.push([esc('Recent Order'), esc(o.orderNumber), esc(`KES ${o.amount}`), esc(`${o.customer} · ${o.status}`)].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overview-${UI_TO_API_RANGE[dateRange]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported overview CSV');
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
      setRestockProduct(null);
      setRestockQty(10);
      try {
        await adminApi.overview.refreshCache({ range: UI_TO_API_RANGE[dateRange] });
      } catch { }
      await loadData();
    } catch (err) {
      setRestockError(err instanceof Error ? err.message : 'Restock failed.');
      showToast('Restock failed');
    } finally {
      setIsRestocking(false);
    }
  };

  const kpis: OverviewKpi[] = data?.kpis ?? [];
  const revenueChart = data?.revenue_chart ?? [];
  const orderStatus = data?.order_status ?? [];
  const topProducts = data?.top_products ?? [];
  const recentOrders = data?.recent_orders ?? [];
  const recentCustomers = data?.recent_customers ?? [];
  const lowStock = data?.low_stock ?? [];
  const topCategories = data?.top_categories ?? [];
  const recentTransactions = data?.recent_transactions ?? [];
  const paymentMethods = data?.payment_methods ?? [];
  const moduleSummaries: OverviewModuleSummary[] = data?.module_summaries ?? [];

  const totalOrdersForPie = useMemo(
    () => orderStatus.reduce((sum, s) => sum + (s.value || 0), 0),
    [orderStatus],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-3">
      {toast && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-2 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-white border border-slate-200 rounded p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200">
              {(['Today', '7d', '30d', '90d', 'Custom'] as UiDateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-2.5 py-1 rounded text-[13px] font-medium transition ${dateRange === range
                    ? 'bg-white text-blue-950 shadow'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>
            {dateRange === 'Custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-700"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-700"
                />
                <button
                  onClick={() => {
                    if (!customStart || !customEnd) {
                      showToast('Select both start and end dates');
                      return;
                    }
                    setAppliedCustom({ start: customStart, end: customEnd });
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium px-2 py-1 rounded transition"
                >
                  Apply
                </button>
              </div>
            )}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white text-[13px] font-medium px-3 py-1.5 rounded transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-0.5 py-1.5 space-y-1.5">
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-100 rounded p-2 flex items-start gap-2 text-[13px]">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-700">Couldn&apos;t load the dashboard</p>
              <p className="text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="bg-white border border-red-200 hover:bg-red-100 text-red-700 font-medium px-2 py-1 rounded text-[13px]"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} isLoading={isLoading} />
          ))}
          {!isLoading && kpis.length === 0 && (
            <p className="col-span-full text-[13px] text-slate-400 italic text-center py-2">
              No KPI data available.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-2">
            <h2 className="text-[13px] font-semibold text-slate-900 mb-1.5">Revenue</h2>
            {isLoading ? (
              <div className="h-56 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
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
                    <Area
                      type="monotone"
                      dataKey="revenue"
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

          <div className="bg-white border border-slate-200 rounded p-2">
            <h2 className="text-[13px] font-semibold text-slate-900 mb-1.5">Order Status</h2>
            {isLoading ? (
              <div className="h-56 bg-slate-100 rounded animate-pulse" />
            ) : orderStatus.length === 0 ? (
              <p className="text-[13px] text-slate-400 italic py-6 text-center">
                No orders in this range.
              </p>
            ) : (
              <>
                <div className="h-40 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={64}
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
                    <span className="text-[12px] text-slate-500">Orders</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-slate-100">
                  {orderStatus.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-[12px]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-600 truncate">{item.name}</span>
                      <span className="font-semibold text-slate-900 ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-2">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-[13px] font-semibold text-slate-900">Recent Orders</h2>
              <Link href="/admin/orders" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-4 text-center">No recent orders.</p>
              ) : (
                recentOrders.map((ord) => (
                  <div key={ord.id} className="py-1.5 flex items-center justify-between text-[13px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{ord.orderNumber}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 truncate">{ord.customer}</span>
                      </div>
                      <p className="text-[12px] text-slate-400 mt-0.5">{ord.time}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-semibold text-slate-900">{formatKES(ord.amount)}</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[12px] font-medium border ${STATUS_STYLES[ord.status] || 'bg-slate-50 text-slate-600 border-slate-200'
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

          <div className="bg-white border border-slate-200 rounded p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h2 className="text-[13px] font-semibold text-slate-900">Low Stock</h2>
              </div>
              <span className="text-[12px] font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                {lowStock.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {lowStock.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-4 text-center">All stocked up.</p>
              ) : (
                lowStock.map((item) => {
                  const img = resolveImageUrl(item.image);
                  return (
                    <div
                      key={item.id}
                      className="py-1.5 flex items-center justify-between gap-2 text-[13px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {img ? (
                          <img
                            src={img}
                            alt={item.name}
                            className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 bg-slate-100"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="w-7 h-7 rounded bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                            <Package className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 line-clamp-1">{item.name}</p>
                          <p className="text-[12px] text-red-600 font-medium">{item.stock} left</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setRestockError(null);
                          setRestockQty(10);
                          setRestockProduct(item);
                        }}
                        className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-1 rounded text-[12px] transition shrink-0"
                      >
                        Restock
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-2">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-[13px] font-semibold text-slate-900">Top Products</h2>
              <Link href="/admin/products" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-1.5 px-2 font-medium">Product</th>
                    <th className="py-1.5 px-2 font-medium text-right">Sold</th>
                    <th className="py-1.5 px-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 text-[13px]">
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
                          <td className="py-1.5 px-2 flex items-center gap-2">
                            {img ? (
                              <img
                                src={img}
                                alt={p.name}
                                className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 bg-slate-100"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="w-7 h-7 rounded bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                                <Package className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className="font-medium text-slate-900 line-clamp-1">{p.name}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-700">{p.sold}</td>
                          <td className="py-1.5 px-2 text-right font-semibold text-slate-900">
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

          <div className="bg-white border border-slate-200 rounded p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-950" />
                <h2 className="text-[13px] font-semibold text-slate-900">New Customers</h2>
              </div>
              <Link href="/admin/customers" className="text-[13px] font-medium text-blue-950 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentCustomers.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic py-4 text-center">No customers yet.</p>
              ) : (
                recentCustomers.map((c) => (
                  <div key={c.id} className="py-1.5 flex items-center justify-between gap-2 text-[13px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center text-[12px] font-semibold shrink-0">
                        {c.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[12px] text-slate-400 truncate">{c.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-slate-900">{formatKES(c.spent)}</p>
                      <p className="text-[12px] text-slate-400">{c.orders} orders</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {(topCategories.length > 0 || paymentMethods.length > 0 || recentTransactions.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
            <div className="bg-white border border-slate-200 rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[13px] font-semibold text-slate-900">Top Categories</h2>
                <Link href="/admin/categories" className="text-[13px] font-medium text-blue-950 hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-1.5">
                {topCategories.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic py-4 text-center">No category sales yet.</p>
                ) : (
                  topCategories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between gap-2 py-1 text-[13px] border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-medium text-slate-800 truncate">{cat.name}</span>
                        <span className="text-[12px] text-slate-400 shrink-0">{cat.products} items</span>
                      </div>
                      <span className="font-semibold text-slate-900 shrink-0">{formatKES(cat.revenue)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[13px] font-semibold text-slate-900">Payment Methods</h2>
                <Link href="/admin/payments" className="text-[13px] font-medium text-blue-950 hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {paymentMethods.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic py-4 text-center">No settled payments in range.</p>
                ) : (
                  paymentMethods.map((pm) => (
                    <div key={pm.name} className="space-y-1 text-[13px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800 truncate">{pm.name}</span>
                        <span className="font-semibold text-slate-900 shrink-0">
                          {formatKES(pm.amount)} ({pm.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${pm.percentage}%`, backgroundColor: pm.color }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[13px] font-semibold text-slate-900">Recent Transactions</h2>
                <Link href="/admin/transactions" className="text-[13px] font-medium text-blue-950 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentTransactions.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic py-4 text-center">No transactions yet.</p>
                ) : (
                  recentTransactions.map((tx) => (
                    <div key={tx.id} className="py-1.5 flex items-center justify-between text-[13px]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-slate-900">{tx.ref}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 truncate">{tx.method}</span>
                        </div>
                        <p className="text-[12px] text-slate-400 truncate">{tx.customer} · {tx.time}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-semibold text-slate-900">{formatKES(tx.amount)}</p>
                        <span className="text-[12px] text-slate-500">{tx.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {moduleSummaries.length > 0 && (
          <div className="bg-white border border-slate-200 rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">Admin Apps Summary</h2>
              <span className="text-[12px] text-slate-500">Live status across store modules</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {moduleSummaries.map((mod) => {
                const MIcon = KPI_ICON_MAP[mod.icon] ?? Package;
                return (
                  <Link
                    key={mod.id}
                    href={mod.href}
                    className="bg-slate-50/60 hover:bg-slate-50 border border-slate-200 rounded p-2 flex flex-col justify-between transition group"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MIcon className="h-3.5 w-3.5 text-blue-950 shrink-0" />
                        <span className="text-[12px] font-medium text-slate-600 truncate">{mod.title}</span>
                      </div>
                      {mod.attention > 0 ? (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          {mod.attention}
                        </span>
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-950 shrink-0" />
                      )}
                    </div>
                    <div className="mt-1">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{mod.metric}</p>
                      <p className="text-[12px] text-slate-500 truncate">{mod.subtext}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {selectedProduct &&
        (() => {
          const img = resolveImageUrl(selectedProduct.image);
          return (
            <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white border-l border-slate-200 w-full max-w-md h-full p-2 overflow-y-auto shadow-xl flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-[13px] font-semibold text-slate-900">Product Details</h3>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-slate-400 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full h-40 rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
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
                      <span className="text-[13px] font-semibold text-blue-950 uppercase">
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
                      <div className="bg-white border border-slate-200 p-2 rounded">
                        <p className="text-[13px] text-slate-500">Units Sold</p>
                        <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                          {selectedProduct.sold}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 p-2 rounded">
                        <p className="text-[13px] text-slate-500">Revenue</p>
                        <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                          {formatKES(selectedProduct.revenue)}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between py-2 border-b border-slate-100 text-[13px]">
                      <span className="text-slate-500">In Stock</span>
                      <span
                        className={`font-semibold ${selectedProduct.stock <= 5 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                      >
                        {selectedProduct.stock} units
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
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
                    className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded text-[13px] transition"
                  >
                    Restock
                  </button>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 px-3 rounded text-[13px] transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded max-w-md w-full p-3 space-y-3 shadow-xl relative">
            <button
              onClick={() => {
                if (isRestocking) return;
                setRestockProduct(null);
                setRestockError(null);
              }}
              disabled={isRestocking}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h3 className="text-[13px] font-semibold text-slate-900">Restock Inventory</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Add units to <span className="font-medium text-slate-900">{restockProduct.name}</span>
              </p>
            </div>

            <form onSubmit={handleRestock} className="space-y-2">
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
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:opacity-60"
                />
                <p className="text-[13px] text-slate-400 mt-1">
                  Current stock: {restockProduct.stock} units
                </p>
              </div>

              {restockError && (
                <div className="bg-red-50 border border-red-100 rounded p-2 flex items-start gap-2 text-[13px]">
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
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-2 rounded text-[13px] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestocking}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded text-[13px] transition disabled:opacity-60"
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

function KpiCard({ kpi, isLoading }: { kpi: OverviewKpi; isLoading: boolean }) {
  const Icon = KPI_ICON_MAP[kpi.icon] ?? DollarSign;

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-col justify-between min-h-[78px]">
        <div className="space-y-1.5 animate-pulse">
          <div className="h-3 bg-slate-100 rounded w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-6 bg-slate-100 rounded w-full mt-1.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded p-2 flex flex-col justify-between min-h-[78px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <p className="text-[12px] font-medium text-slate-500 truncate">{kpi.title}</p>
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
          className={`inline-flex items-center gap-0.5 text-[12px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${kpi.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
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

      <div className="h-7 mt-1.5 -mx-1">
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