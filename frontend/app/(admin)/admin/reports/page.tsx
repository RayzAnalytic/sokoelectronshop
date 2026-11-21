'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Calendar,
  CheckCircle2,
  X,
  TrendingUp,
  ShoppingBag,
  Users,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ExternalLink,
  MessageCircle,
  Package,
  Warehouse,
  Truck,
  Percent,
  Share2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  Music2,
  Video,
  ShoppingCart,
  CircleDollarSign,
  Eye,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { FaFacebook, FaInstagram, FaYoutube } from 'react-icons/fa';

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  ReportQuery,
  ReportRange,
  ReportTab,
  ReportSalesResponse,
  ReportOrdersResponse,
  ReportCustomersResponse,
  ReportProductsResponse,
  ReportInventoryResponse,
  ReportInventoryRow,
  ReportPaymentsResponse,
  ReportTaxesResponse,
  ReportShippingResponse,
  ReportDiscountsResponse,
  ReportSocialResponse,
  ReportTaxStatus,
  ReportDiscountStatus,
  ReportSocialVideo,
} from '@/lib/admin-types';

type ExportFormat = 'CSV' | 'PDF' | 'Excel';

interface ReportDataMap {
  sales?: ReportSalesResponse;
  orders?: ReportOrdersResponse;
  customers?: ReportCustomersResponse;
  products?: ReportProductsResponse;
  inventory?: ReportInventoryResponse;
  payments?: ReportPaymentsResponse;
  taxes?: ReportTaxesResponse;
  shipping?: ReportShippingResponse;
  discounts?: ReportDiscountsResponse;
  social?: ReportSocialResponse;
}

const TAX_STATUS_STYLES: Record<ReportTaxStatus, string> = {
  Filed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Due: 'bg-amber-50 text-amber-700 border-amber-100',
  Overdue: 'bg-red-50 text-red-600 border-red-100',
};

const INVENTORY_STATUS_STYLES: Record<ReportInventoryRow['status'], string> = {
  'In Stock': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Low: 'bg-amber-50 text-amber-700 border-amber-100',
  Critical: 'bg-orange-50 text-orange-700 border-orange-100',
  Out: 'bg-red-50 text-red-600 border-red-100',
};

const DISCOUNT_STATUS_STYLES: Record<ReportDiscountStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Expired: 'bg-slate-50 text-slate-600 border-slate-200',
  Scheduled: 'bg-blue-50 text-blue-950 border-blue-100',
};

const VIDEO_TYPE_STYLES: Record<ReportSocialVideo['videoType'], string> = {
  Unboxing: 'bg-blue-50 text-blue-950 border-blue-100',
  Review: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Demo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Comparison: 'bg-amber-50 text-amber-700 border-amber-100',
  Tutorial: 'bg-purple-50 text-purple-700 border-purple-100',
};

const REPORT_TAB_ROUTES: Record<ReportTab, string> = {
  sales: '/admin/orders',
  orders: '/admin/orders',
  customers: '/admin/customers',
  products: '/admin/products',
  inventory: '/admin/inventory',
  payments: '/admin/transactions',
  taxes: '/admin/settings?tab=taxes',
  shipping: '/admin/shipping',
  discounts: '/admin/discounts',
  social: '/admin/social',
};

const TAB_META: Record<
  ReportTab,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  sales: { label: 'Sales', icon: TrendingUp },
  orders: { label: 'Orders', icon: ShoppingBag },
  customers: { label: 'Customers', icon: Users },
  products: { label: 'Products', icon: Package },
  inventory: { label: 'Inventory', icon: Warehouse },
  payments: { label: 'Payments', icon: CreditCard },
  taxes: { label: 'Taxes & VAT', icon: Receipt },
  shipping: { label: 'Shipping', icon: Truck },
  discounts: { label: 'Discounts', icon: Percent },
  social: { label: 'Social Videos', icon: Share2 },
};

const TAB_GROUPS: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabs: ReportTab[];
}[] = [
    {
      id: 'commerce',
      label: 'Commerce',
      icon: TrendingUp,
      tabs: ['sales', 'orders', 'products', 'inventory'],
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      tabs: ['customers', 'discounts', 'social'],
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: CreditCard,
      tabs: ['payments', 'taxes', 'shipping'],
    },
  ];

export default function ReportsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [dateRange, setDateRange] = useState<ReportRange>('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedQuery, setAppliedQuery] = useState<ReportQuery>({ range: '7days' });

  const [reportData, setReportData] = useState<ReportDataMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [openTabGroup, setOpenTabGroup] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openInAdmin = (tab: ReportTab) => {
    const base = REPORT_TAB_ROUTES[tab];
    const params = new URLSearchParams();
    params.set('range', appliedQuery.range ?? '7days');
    if (appliedQuery.range === 'custom') {
      if (appliedQuery.start) params.set('start', appliedQuery.start);
      if (appliedQuery.end) params.set('end', appliedQuery.end);
    }
    const sep = base.includes('?') ? '&' : '?';
    router.push(`${base}${sep}${params.toString()}`);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        switch (activeTab) {
          case 'sales': {
            const data = await adminApi.reports.sales(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, sales: data }));
            break;
          }
          case 'orders': {
            const data = await adminApi.reports.orders(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, orders: data }));
            break;
          }
          case 'customers': {
            const data = await adminApi.reports.customers(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, customers: data }));
            break;
          }
          case 'products': {
            const data = await adminApi.reports.products(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, products: data }));
            break;
          }
          case 'inventory': {
            const data = await adminApi.reports.inventory(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, inventory: data }));
            break;
          }
          case 'payments': {
            const data = await adminApi.reports.payments(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, payments: data }));
            break;
          }
          case 'taxes': {
            const data = await adminApi.reports.taxes(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, taxes: data }));
            break;
          }
          case 'shipping': {
            const data = await adminApi.reports.shipping(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, shipping: data }));
            break;
          }
          case 'discounts': {
            const data = await adminApi.reports.discounts(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, discounts: data }));
            break;
          }
          case 'social': {
            const data = await adminApi.reports.social(appliedQuery);
            if (!cancelled) setReportData((p) => ({ ...p, social: data }));
            break;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load report');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, appliedQuery.range, appliedQuery.start, appliedQuery.end]);

  const handleRangePick = (rng: ReportRange) => {
    setDateRange(rng);
    if (rng !== 'custom') {
      setAppliedQuery({ range: rng });
      setIsDateMenuOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) {
      showToast('Please select both start and end dates');
      return;
    }
    setAppliedQuery({ range: 'custom', start: customStart, end: customEnd });
    setIsDateMenuOpen(false);
  };

  const handleRefresh = async () => {
    try {
      await adminApi.reports.refreshCache({ tab: activeTab });
      setAppliedQuery((q) => ({ ...q }));
      showToast(`Refreshed ${activeTab.toUpperCase()} report`);
    } catch {
      showToast(`Refresh failed for ${activeTab.toUpperCase()}`);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    try {
      const res = await adminApi.reports.logExport({
        tab: activeTab,
        range: appliedQuery.range ?? '7days',
        format,
      });
      showToast(`Exported ${activeTab.toUpperCase()} as ${format} → ${res.filename}`);
    } catch {
      showToast(`Export failed for ${activeTab.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

  const dateRangeLabel = (() => {
    switch (dateRange) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7days': return 'Last 7 Days';
      case '30days': return 'Last 30 Days';
      case 'this_month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'custom':
        if (customStart && customEnd) return `${customStart} → ${customEnd}`;
        return 'Custom Range';
    }
  })();

  const DATE_OPTIONS: { id: ReportRange; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 Days' },
    { id: '30days', label: 'Last 30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom', label: 'Custom Range…' },
  ];

  const sales = reportData.sales;
  const orders = reportData.orders;
  const customers = reportData.customers;
  const products = reportData.products;
  const inventory = reportData.inventory;
  const payments = reportData.payments;
  const taxes = reportData.taxes;
  const shipping = reportData.shipping;
  const discounts = reportData.discounts;
  const social = reportData.social;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[15px] font-semibold text-slate-900">Reports</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-white border border-slate-200 rounded p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                className="bg-white border border-slate-200 rounded px-2 py-2 flex items-center gap-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-950" />
                <span>{dateRangeLabel}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isDateMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDateMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded shadow z-50 overflow-hidden py-1 text-[13px]">
                    {DATE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleRangePick(opt.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${dateRange === opt.id
                            ? 'text-blue-950 font-medium bg-blue-50/40'
                            : 'text-slate-700'
                          }`}
                      >
                        <span>{opt.label}</span>
                        {dateRange === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-950" />}
                      </button>
                    ))}

                    {dateRange === 'custom' && (
                      <div className="border-t border-slate-100 p-2 space-y-2">
                        <div>
                          <label className="block text-[13px] font-medium text-slate-600 mb-1">Start</label>
                          <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-medium text-slate-600 mb-1">End</label>
                          <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                          />
                        </div>
                        <button
                          onClick={handleApplyCustom}
                          className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded text-[13px]"
                        >
                          Apply Range
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-2 rounded text-[13px] transition disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting…' : 'Export'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {isExportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded shadow z-50 overflow-hidden py-1 text-[13px]">
                    <button
                      onClick={() => handleExport('CSV')}
                      className="w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => handleExport('Excel')}
                      className="w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                      Export Excel
                    </button>
                    <button
                      onClick={() => handleExport('PDF')}
                      className="w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-600" />
                      Export PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-40">
        <div className="max-w-[1700px] mx-auto px-2 flex items-stretch gap-1">
          {TAB_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = group.tabs.includes(activeTab);
            const isOpen = openTabGroup === group.id;
            const activeMeta = isGroupActive ? TAB_META[activeTab] : null;
            const showSuffix = activeMeta && activeTab !== group.tabs[0];

            return (
              <div key={group.id} className="relative shrink-0">
                <button
                  onClick={() => setOpenTabGroup(isOpen ? null : group.id)}
                  className={`flex items-center gap-1.5 px-2 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isGroupActive
                      ? 'border-blue-950 text-blue-950 bg-blue-50/30'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                  <GroupIcon className={`w-3.5 h-3.5 ${isGroupActive ? 'text-blue-950' : 'text-slate-400'}`} />
                  <span>{group.label}</span>
                  {showSuffix && activeMeta && (
                    <span className="text-slate-400 font-normal">· {activeMeta.label}</span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 ml-0.5 transition-transform ${isOpen ? 'rotate-180' : ''
                      } ${isGroupActive ? 'text-blue-950' : 'text-slate-400'}`}
                  />
                </button>

                {isOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenTabGroup(null)} />
                    <div className="absolute left-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow z-50 overflow-hidden py-1 text-[13px]">
                      {group.tabs.map((tabId) => {
                        const meta = TAB_META[tabId];
                        const TabIcon = meta.icon;
                        const isActive = activeTab === tabId;
                        return (
                          <button
                            key={tabId}
                            onClick={() => {
                              setActiveTab(tabId);
                              setOpenTabGroup(null);
                            }}
                            className={`w-full text-left px-2 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 ${isActive ? 'text-blue-950 font-medium bg-blue-50/40' : 'text-slate-700'
                              }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <TabIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                              <span className="truncate">{meta.label}</span>
                            </span>
                            {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-blue-950 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <main className="max-w-[1700px] mx-auto px-0.5 py-2">
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-100 rounded p-2 mb-2 flex items-start gap-2 text-[13px]">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-700">Couldn&apos;t load this report</p>
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

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-72 bg-slate-100 rounded w-full animate-pulse" />
            <div className="h-72 bg-slate-100 rounded w-full animate-pulse" />
          </div>
        ) : (
          <>
            {activeTab === 'sales' && sales && (
              <div className="space-y-2">
                <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Revenue & Orders Timeline</h3>
                      <p className="text-[13px] text-slate-500">{sales.range_label}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-blue-950 rounded" />
                        <span className="text-slate-600">Revenue</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
                        <span className="text-slate-600">Orders</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={sales.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis yAxisId="left" stroke="#172554" fontSize={13} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={13} />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="revenue" fill="#172554" radius={[2, 2, 0, 0]} barSize={24} />
                        <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Daily Sales</span>
                    <button
                      onClick={() => openInAdmin('sales')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                    >
                      Open in Orders
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Date</th>
                          <th className="py-2 px-2 font-medium">Orders</th>
                          <th className="py-2 px-2 font-medium">Revenue</th>
                          <th className="py-2 px-2 font-medium text-right">AOV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sales.daily.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-900">{row.date}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{row.orders}</td>
                            <td className="py-2 px-3 font-mono text-emerald-600">KES {row.revenue.toLocaleString()}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 text-right">KES {row.aov.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && orders && (
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Orders · {orders.range_label}</span>
                  <button
                    onClick={() => openInAdmin('orders')}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                  >
                    Open in Orders
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[820px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-2 font-medium">Order</th>
                        <th className="py-2 px-2 font-medium">Date</th>
                        <th className="py-2 px-2 font-medium">Customer</th>
                        <th className="py-2 px-2 font-medium">Items</th>
                        <th className="py-2 px-2 font-medium">Payment</th>
                        <th className="py-2 px-2 font-medium">Channel</th>
                        <th className="py-2 px-2 font-medium">Status</th>
                        <th className="py-2 px-2 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.rows.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-medium text-blue-950">{o.id}</td>
                          <td className="py-2 px-2 text-slate-600">{o.date}</td>
                          <td className="py-2 px-2 font-medium text-slate-900">{o.customer}</td>
                          <td className="py-2 px-2 font-mono text-slate-700">{o.items}</td>
                          <td className="py-2 px-2 text-slate-600">{o.payment}</td>
                          <td className="py-2 px-2 text-slate-600">{o.channel}</td>
                          <td className="py-2 px-2">
                            <span className={`text-[13px] font-medium px-2 py-0.5 rounded border ${o.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : o.status === 'Processing' ? 'bg-blue-50 text-blue-950 border-blue-100'
                                  : o.status === 'Shipped' ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    : o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100'
                                      : 'bg-red-50 text-red-600 border-red-100'
                              }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono font-semibold text-slate-900 text-right">KES {o.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'products' && products && (
              <div className="space-y-2">
                <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
                  <h3 className="text-[13px] font-semibold text-slate-900">Top Selling Products</h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={products.rows} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                        <YAxis dataKey="product" type="category" width={180} stroke="#172554" fontSize={13} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#0284c7" radius={[0, 2, 2, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Product Performance</span>
                    <button
                      onClick={() => openInAdmin('products')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                    >
                      Open in Products
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Product</th>
                          <th className="py-2 px-2 font-medium">SKU</th>
                          <th className="py-2 px-2 font-medium">Qty</th>
                          <th className="py-2 px-2 font-medium">Revenue</th>
                          <th className="py-2 px-2 font-medium">Returns</th>
                          <th className="py-2 px-2 font-medium text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.rows.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-medium text-slate-900">{p.product}</td>
                            <td className="py-2 px-2 font-mono text-slate-500">{p.sku}</td>
                            <td className="py-2 px-2 font-mono text-slate-700">{p.qty}</td>
                            <td className="py-2 px-2 font-mono text-slate-800">KES {p.revenue.toLocaleString()}</td>
                            <td className="py-2 px-2 font-mono text-red-600">{p.returns}</td>
                            <td className="py-2 px-2 font-mono font-medium text-emerald-600 text-right">KES {p.net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'customers' && customers && (
              <div className="space-y-2">
                <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
                  <h3 className="text-[13px] font-semibold text-slate-900">New vs Returning Customers</h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={customers.new_vs_returning}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis stroke="#172554" fontSize={13} />
                        <Tooltip />
                        <Line type="monotone" dataKey="newCust" name="New" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="returning" name="Returning" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Top Buyers</span>
                    <button
                      onClick={() => openInAdmin('customers')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                    >
                      Open in Customers
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Customer</th>
                          <th className="py-2 px-2 font-medium">Orders</th>
                          <th className="py-2 px-2 font-medium">Spent</th>
                          <th className="py-2 px-2 font-medium">AOV</th>
                          <th className="py-2 px-2 font-medium text-right">Last Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customers.top_buyers.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-medium text-slate-900">{c.customer}</td>
                            <td className="py-2 px-2 font-mono text-slate-700">{c.orders}</td>
                            <td className="py-2 px-2 font-mono text-emerald-600">KES {c.spent.toLocaleString()}</td>
                            <td className="py-2 px-2 font-mono text-slate-600">KES {c.aov.toLocaleString()}</td>
                            <td className="py-2 px-2 text-slate-500 text-right">{c.lastOrder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && inventory && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total SKUs', value: inventory.counts.total_skus, icon: Package, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Low Stock', value: inventory.counts.low, icon: AlertTriangle, color: 'text-amber-700 bg-amber-50' },
                    { label: 'Critical', value: inventory.counts.critical, icon: AlertTriangle, color: 'text-orange-700 bg-orange-50' },
                    { label: 'Out of Stock', value: inventory.counts.out, icon: X, color: 'text-red-600 bg-red-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${s.color}`}>
                          <s.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Inventory Levels</span>
                    <button
                      onClick={() => openInAdmin('inventory')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                    >
                      Open in Inventory
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Product</th>
                          <th className="py-2 px-2 font-medium">Warehouse</th>
                          <th className="py-2 px-2 font-medium text-right">On Hand</th>
                          <th className="py-2 px-2 font-medium text-right">Reserved</th>
                          <th className="py-2 px-2 font-medium text-right">Available</th>
                          <th className="py-2 px-2 font-medium text-right">Reorder Pt.</th>
                          <th className="py-2 px-2 font-medium">Status</th>
                          <th className="py-2 px-2 font-medium text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventory.rows.map((r) => (
                          <tr key={r.sku} className="hover:bg-slate-50">
                            <td className="py-2 px-2">
                              <p className="font-medium text-slate-900">{r.product}</p>
                              <p className="text-[13px] text-slate-400 font-mono">{r.sku}</p>
                            </td>
                            <td className="py-2 px-2 text-slate-600">{r.warehouse}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">{r.onHand}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-600">{r.reserved}</td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">{r.available}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-500">{r.reorderPoint}</td>
                            <td className="py-2 px-2">
                              <span className={`text-[13px] font-medium px-2 py-0.5 rounded border ${INVENTORY_STATUS_STYLES[r.status]}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-800">KES {r.value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && payments && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">M-Pesa Settlement · {payments.range_label}</span>
                    <button
                      onClick={() => openInAdmin('payments')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                    >
                      Open in Transactions
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[640px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Stream</th>
                          <th className="py-2 px-2 font-medium">Txns</th>
                          <th className="py-2 px-2 font-medium">Volume</th>
                          <th className="py-2 px-2 font-medium">Fees</th>
                          <th className="py-2 px-2 font-medium text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.streams.map((pay, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-medium text-slate-900">{pay.method}</td>
                            <td className="py-2 px-2 font-mono text-slate-700">{pay.transactions.toLocaleString()}</td>
                            <td className="py-2 px-2 font-mono text-slate-800">KES {pay.volume.toLocaleString()}</td>
                            <td className="py-2 px-2 font-mono text-red-600">-KES {pay.fees.toLocaleString()}</td>
                            <td className="py-2 px-2 font-mono font-medium text-emerald-600 text-right">KES {pay.net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded p-2 space-y-2">
                  <h3 className="text-[13px] font-semibold text-slate-900">Payment Split</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={payments.share}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {payments.share.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-0.5 text-[13px]">
                    {payments.share.map((slice) => (
                      <div
                        key={slice.name}
                        className="flex items-center justify-between rounded px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-slate-700 truncate">{slice.name}</span>
                        </div>
                        <span className="font-medium text-slate-900">KES {(slice.value / 1000).toFixed(0)}k</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'taxes' && taxes && (
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">KRA VAT (16%) & Taxable Sales</span>
                  <button
                    onClick={() => openInAdmin('taxes')}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                  >
                    Open tax settings
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-2 font-medium">Period</th>
                        <th className="py-2 px-2 font-medium">Taxable Sales</th>
                        <th className="py-2 px-2 font-medium">VAT (16%)</th>
                        <th className="py-2 px-2 font-medium">Status</th>
                        <th className="py-2 px-2 font-medium text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {taxes.rows.map((tax, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-medium text-slate-900">{tax.period}</td>
                          <td className="py-2 px-2 font-mono text-slate-800">KES {tax.taxableSales.toLocaleString()}</td>
                          <td className="py-2 px-2 font-mono text-red-600">KES {tax.vat16.toLocaleString()}</td>
                          <td className="py-2 px-2">
                            <span className={`text-[13px] font-medium px-2 py-0.5 rounded border ${TAX_STATUS_STYLES[tax.status]}`}>
                              {tax.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono font-medium text-emerald-600 text-right">KES {tax.net.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'shipping' && shipping && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total Shipments', value: shipping.totals.shipments.toLocaleString(), icon: Truck, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Delivered', value: shipping.totals.delivered.toLocaleString(), icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'In Transit', value: shipping.totals.in_transit.toLocaleString(), icon: Truck, color: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Failed', value: shipping.totals.failed.toLocaleString(), icon: X, color: 'text-red-600 bg-red-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-6 h-6 rounded flex items-center justify-center ${s.color}`}>
                          <s.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Carrier Performance</span>
                    <button
                      onClick={() => openInAdmin('shipping')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                    >
                      Open in Shipping
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[840px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Carrier</th>
                          <th className="py-2 px-2 font-medium text-right">Shipments</th>
                          <th className="py-2 px-2 font-medium text-right">Delivered</th>
                          <th className="py-2 px-2 font-medium text-right">In Transit</th>
                          <th className="py-2 px-2 font-medium text-right">Failed</th>
                          <th className="py-2 px-2 font-medium text-right">Avg Days</th>
                          <th className="py-2 px-2 font-medium text-right">On-Time</th>
                          <th className="py-2 px-2 font-medium text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shipping.rows.map((s) => (
                          <tr key={s.carrier} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-medium text-slate-900">{s.carrier}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">{s.shipments}</td>
                            <td className="py-2 px-2 text-right font-mono text-emerald-600">{s.delivered}</td>
                            <td className="py-2 px-2 text-right font-mono text-indigo-600">{s.inTransit}</td>
                            <td className="py-2 px-2 text-right font-mono text-red-600">{s.failed}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-600">{s.avgDays}</td>
                            <td className="py-2 px-2 text-right font-mono text-emerald-600">{s.onTimeRate}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-800">KES {s.cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'discounts' && discounts && (
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Discount Code Performance</span>
                  <button
                    onClick={() => openInAdmin('discounts')}
                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                  >
                    Open in Discounts
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[840px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-2 font-medium">Code</th>
                        <th className="py-2 px-2 font-medium">Type</th>
                        <th className="py-2 px-2 font-medium text-right">Uses</th>
                        <th className="py-2 px-2 font-medium text-right">Discount Given</th>
                        <th className="py-2 px-2 font-medium text-right">Revenue</th>
                        <th className="py-2 px-2 font-medium text-right">ROI</th>
                        <th className="py-2 px-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {discounts.rows.map((d) => (
                        <tr key={d.code} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-medium text-blue-950">{d.code}</td>
                          <td className="py-2 px-2 text-slate-600">{d.type}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">{d.uses}</td>
                          <td className="py-2 px-2 text-right font-mono text-red-600">KES {d.discountGiven.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-600">KES {d.revenue.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">{d.roi}</td>
                          <td className="py-2 px-2">
                            <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${DISCOUNT_STATUS_STYLES[d.status]}`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'social' && social && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { label: 'Videos Published', value: social.summary.videos.toLocaleString(), change: social.summary.changes.videos, icon: Video, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Total Views', value: social.summary.views.toLocaleString(), change: social.summary.changes.views, icon: Eye, color: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Orders from Videos', value: social.summary.orders.toLocaleString(), change: social.summary.changes.orders, icon: ShoppingCart, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Video Revenue', value: `KES ${social.summary.revenue.toLocaleString()}`, change: social.summary.changes.revenue, icon: CircleDollarSign, color: 'text-emerald-700 bg-emerald-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${s.color}`}>
                          <s.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                      <div className="flex items-center gap-1 text-[13px]">
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">{s.change}</span>
                        <span className="text-slate-400">vs last</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-slate-900">Social Sales Funnel</h3>
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-blue-950 rounded" />
                        <span className="text-slate-600">Views</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
                        <span className="text-slate-600">Orders</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={social.funnel}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis yAxisId="left" stroke="#172554" fontSize={13} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={13} />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="views" fill="#172554" radius={[2, 2, 0, 0]} barSize={20} />
                        <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-700 truncate">Product Videos</span>
                    <button
                      onClick={() => openInAdmin('social')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]"
                    >
                      Open in Social
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 font-medium">Video</th>
                          <th className="py-2 px-2 font-medium">Product</th>
                          <th className="py-2 px-2 font-medium">Platform</th>
                          <th className="py-2 px-2 font-medium text-right">Views</th>
                          <th className="py-2 px-2 font-medium text-right">Clicks</th>
                          <th className="py-2 px-2 font-medium text-right">Orders</th>
                          <th className="py-2 px-2 font-medium text-right">Conv.</th>
                          <th className="py-2 px-2 font-medium text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {social.videos.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${VIDEO_TYPE_STYLES[v.videoType]}`}>
                                  <Play className="w-3 h-3" />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate max-w-[200px] sm:max-w-[280px]">{v.title}</p>
                                  <p className="text-[13px] text-slate-400">
                                    {v.videoType} · {v.duration} · {v.published}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <p className="text-slate-700 truncate max-w-[160px]">{v.product}</p>
                              <p className="text-[13px] text-slate-400 font-mono">{v.sku}</p>
                            </td>
                            <td className="py-2 px-2">
                              <PlatformIcon platform={v.platform} withLabel />
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">{v.views.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-600">{v.clicks.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">{v.orders}</td>
                            <td className="py-2 px-2 text-right font-mono text-emerald-600">{v.conversionRate}</td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">
                              KES {v.revenue.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded overflow-hidden">
                    <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
                      <span className="text-[13px] font-medium text-slate-700">Platform Summary</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px] min-w-[560px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="py-2 px-2 font-medium">Platform</th>
                            <th className="py-2 px-2 font-medium text-right">Videos</th>
                            <th className="py-2 px-2 font-medium text-right">Views</th>
                            <th className="py-2 px-2 font-medium text-right">Orders</th>
                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {social.platforms.map((p) => (
                            <tr key={p.platform} className="hover:bg-slate-50">
                              <td className="py-2 px-2">
                                <PlatformIcon platform={p.platform} withLabel />
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-700">{p.videos}</td>
                              <td className="py-2 px-2 text-right font-mono text-slate-700">{p.views.toLocaleString()}</td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">{p.orders}</td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">
                                KES {p.revenue.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded overflow-hidden">
                    <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
                      <span className="text-[13px] font-medium text-slate-700">Top Products by Video Revenue</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px] min-w-[560px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="py-2 px-2 font-medium">Product</th>
                            <th className="py-2 px-2 font-medium text-right">Videos</th>
                            <th className="py-2 px-2 font-medium text-right">Orders</th>
                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {social.product_perf.map((p) => (
                            <tr key={p.sku} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <p className="font-medium text-slate-900 truncate max-w-[180px] sm:max-w-none">{p.product}</p>
                                <p className="text-[13px] text-slate-400 font-mono">{p.sku} · {p.category}</p>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-700">{p.videos}</td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">{p.orders}</td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">
                                KES {p.revenue.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PlatformIcon({ platform, withLabel = false }: { platform: string; withLabel?: boolean }) {
  const map: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
    TikTok: { icon: Music2, color: 'text-slate-900 bg-slate-100' },
    Instagram: { icon: FaInstagram, color: 'text-pink-600 bg-pink-50' },
    YouTube: { icon: FaYoutube, color: 'text-red-600 bg-red-50' },
    Facebook: { icon: FaFacebook, color: 'text-blue-700 bg-blue-50' },
    WhatsApp: { icon: MessageCircle, color: 'text-emerald-700 bg-emerald-50' },
  };
  const meta = map[platform] ?? { icon: Share2, color: 'text-slate-700 bg-slate-100' };
  const Icon = meta.icon;

  if (!withLabel) {
    return (
      <span className={`w-6 h-6 rounded flex items-center justify-center ${meta.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="text-slate-700 truncate">{platform}</span>
    </div>
  );
}