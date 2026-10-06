'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  Eye,
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
  Boxes,
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
  ReportSaleRow,
  ReportOrdersResponse,
  ReportOrderRow,
  ReportCustomersResponse,
  ReportTopBuyer,
  ReportProductsResponse,
  ReportProductRow,
  ReportInventoryResponse,
  ReportInventoryRow,
  ReportPaymentsResponse,
  ReportPaymentStream,
  ReportPaymentShareSlice,
  ReportTaxesResponse,
  ReportTaxRow,
  ReportShippingResponse,
  ReportShippingRow,
  ReportDiscountsResponse,
  ReportDiscountRow,
  ReportSocialResponse,
  ReportSocialVideo,
  ReportPlatformSummary,
  ReportSocialFunnelPoint,
  ReportProductVideoPerf,
  ReportTaxStatus,
  ReportDiscountStatus,
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

// ─────────────────────────────────────────────────────────────
// Reports tab → admin page it hands off to
// ─────────────────────────────────────────────────────────────
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

// Human label for the "Open in X" button
const REPORT_TAB_TARGETS: Record<ReportTab, string> = {
  sales: 'Orders',
  orders: 'Orders',
  customers: 'Customers',
  products: 'Products',
  inventory: 'Inventory',
  payments: 'Transactions',
  taxes: 'Settings',
  shipping: 'Shipping',
  discounts: 'Discounts',
  social: 'Social',
};

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

  // Modals
  const [selectedSale, setSelectedSale] = useState<ReportSaleRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ReportOrderRow | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ReportProductRow | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<ReportTopBuyer | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<ReportPaymentStream | null>(null);
  const [selectedPieSlice, setSelectedPieSlice] = useState<ReportPaymentShareSlice | null>(null);
  const [selectedTax, setSelectedTax] = useState<ReportTaxRow | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<ReportInventoryRow | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<ReportShippingRow | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<ReportDiscountRow | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ReportSocialVideo | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<ReportPlatformSummary | null>(null);
  const [selectedFunnelDay, setSelectedFunnelDay] = useState<ReportSocialFunnelPoint | null>(null);
  const [selectedProductVideo, setSelectedProductVideo] = useState<ReportProductVideoPerf | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Handoff to the operational admin page ────────────────
  const openInAdmin = (
    tab: ReportTab,
    extra: Record<string, string | undefined> = {},
  ) => {
    const base = REPORT_TAB_ROUTES[tab];
    const params = new URLSearchParams();

    params.set('range', appliedQuery.range ?? '7days');
    if (appliedQuery.range === 'custom') {
      if (appliedQuery.start) params.set('start', appliedQuery.start);
      if (appliedQuery.end) params.set('end', appliedQuery.end);
    }
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== '') params.set(k, v);
    }

    const sep = base.includes('?') ? '&' : '?';
    router.push(`${base}${sep}${params.toString()}`);
  };

  // "Sep 17" → "2026-09-17" (uses current year from the report label)
  const toIsoDate = (short: string) => {
    const year = new Date().getFullYear();
    const d = new Date(`${short}, ${year}`);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  // ── Fetch on tab or query change ─────────────────────────
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

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
  };

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

  const TABS: { id: ReportTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'taxes', label: 'Taxes & VAT', icon: Receipt },
    { id: 'shipping', label: 'Shipping', icon: Truck },
    { id: 'discounts', label: 'Discounts', icon: Percent },
    { id: 'social', label: 'Social Videos', icon: Share2 },
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
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── SALES DAY MODAL ─── */}
      {selectedSale && (
        <Modal onClose={() => setSelectedSale(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Sales Day</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedSale.date}, 2026</h3>
              <p className="text-[13px] text-slate-500 mt-1">Top category: {selectedSale.topCategory}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Revenue" value={`KES ${selectedSale.revenue.toLocaleString()}`} />
              <Stat label="Orders" value={selectedSale.orders.toString()} />
              <Stat label="Avg Order Value" value={`KES ${selectedSale.aov.toLocaleString()}`} />
              <Stat label="Refunds" value={selectedSale.refunds.toString()} />
            </div>
            <div className="flex justify-end gap-2 pt-1 flex-wrap">
              <button
                onClick={() => showToast(`Exported ${selectedSale.date} sales breakdown`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Export day
              </button>
              <button
                onClick={() => {
                  const iso = toIsoDate(selectedSale.date);
                  setSelectedSale(null);
                  openInAdmin('orders', { date: iso });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                Open day in Orders
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── ORDER MODAL ─── */}
      {selectedOrder && (
        <Modal onClose={() => setSelectedOrder(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Order</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedOrder.id}</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">{selectedOrder.date} · {selectedOrder.channel}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Customer" value={selectedOrder.customer} />
              <Stat label="Items" value={selectedOrder.items.toString()} />
              <Stat label="Total" value={`KES ${selectedOrder.total.toLocaleString()}`} />
              <Stat label="Payment" value={selectedOrder.payment} />
              <Stat label="Status" value={selectedOrder.status} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  openInAdmin('orders', { reference: selectedOrder.id });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Orders
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── PRODUCT MODAL ─── */}
      {selectedProduct && (
        <Modal onClose={() => setSelectedProduct(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedProduct.category}</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedProduct.product}</h3>
              <p className="text-[13px] text-slate-500 font-mono mt-0.5">SKU: {selectedProduct.sku}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Units Sold" value={selectedProduct.qty.toString()} />
              <Stat label="Revenue" value={`KES ${selectedProduct.revenue.toLocaleString()}`} />
              <Stat label="Returns" value={selectedProduct.returns.toString()} />
              <Stat label="Net Revenue" value={`KES ${selectedProduct.net.toLocaleString()}`} />
            </div>
            <p className="text-[13px] text-slate-500">Last sold: {selectedProduct.lastSold}</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  openInAdmin('products', { sku: selectedProduct.sku });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Products
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── CUSTOMER MODAL ─── */}
      {selectedCustomer && (
        <Modal onClose={() => setSelectedCustomer(null)}>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
                {selectedCustomer.customer.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-slate-900">{selectedCustomer.customer}</h3>
                <p className="text-[13px] text-slate-500 truncate">{selectedCustomer.email}</p>
                <p className="text-[13px] text-slate-500">{selectedCustomer.phone} · {selectedCustomer.county}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Orders" value={selectedCustomer.orders.toString()} />
              <Stat label="Spent" value={`KES ${selectedCustomer.spent.toLocaleString()}`} />
              <Stat label="AOV" value={`KES ${selectedCustomer.aov.toLocaleString()}`} />
            </div>
            <p className="text-[13px] text-slate-500">Last order: {selectedCustomer.lastOrder}</p>
            <div className="flex justify-end gap-2 pt-1 flex-wrap">
              <button
                onClick={() => showToast(`WhatsApp message opened for ${selectedCustomer.customer}`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  openInAdmin('customers', { q: selectedCustomer.email });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Customers
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── PAYMENT MODAL ─── */}
      {selectedPayment && (
        <Modal onClose={() => setSelectedPayment(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedPayment.provider}</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedPayment.method}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Transactions" value={selectedPayment.transactions.toLocaleString()} />
              <Stat label="Success rate" value={selectedPayment.successRate} />
              <Stat label="Volume" value={`KES ${selectedPayment.volume.toLocaleString()}`} />
              <Stat label="Fees" value={`-KES ${selectedPayment.fees.toLocaleString()}`} />
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2">
              <p className="text-[13px] text-emerald-800">Net settlement</p>
              <p className="text-[15px] font-bold text-emerald-700 mt-0.5">KES {selectedPayment.net.toLocaleString()}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  openInAdmin('payments', { method: selectedPayment.method });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Transactions
              </button>
              <button
                onClick={() => setSelectedPayment(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── PIE SLICE MODAL ─── */}
      {selectedPieSlice && payments && (
        <Modal onClose={() => setSelectedPieSlice(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedPieSlice.color }} />
              <h3 className="text-[15px] font-bold text-slate-900">{selectedPieSlice.name}</h3>
            </div>
            <Stat label="Volume" value={`KES ${selectedPieSlice.value.toLocaleString()}`} />
            <p className="text-[13px] text-slate-500">
              Share of total: {Math.round(
                (selectedPieSlice.value / payments.share.reduce((a, b) => a + b.value, 0)) * 100,
              )}%
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedPieSlice(null);
                  openInAdmin('payments', { method: selectedPieSlice.name });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Transactions
              </button>
              <button
                onClick={() => setSelectedPieSlice(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── TAX MODAL ─── */}
      {selectedTax && (
        <Modal onClose={() => setSelectedTax(null)}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Tax period</p>
                <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedTax.period}</h3>
              </div>
              <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${TAX_STATUS_STYLES[selectedTax.status]}`}>
                {selectedTax.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Taxable Sales" value={`KES ${selectedTax.taxableSales.toLocaleString()}`} />
              <Stat label="VAT 16%" value={`KES ${selectedTax.vat16.toLocaleString()}`} />
              <Stat label="Net" value={`KES ${selectedTax.net.toLocaleString()}`} />
            </div>
            <p className="text-[13px] text-slate-500">Due date: {selectedTax.dueDate}</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedTax(null);
                  openInAdmin('taxes', { period: selectedTax.period });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open tax settings
              </button>
              <button
                onClick={() => setSelectedTax(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── INVENTORY MODAL ─── */}
      {selectedInventory && (
        <Modal onClose={() => setSelectedInventory(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedInventory.warehouse}</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedInventory.product}</h3>
              <p className="text-[13px] text-slate-500 font-mono mt-0.5">SKU: {selectedInventory.sku}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="On Hand" value={selectedInventory.onHand.toString()} />
              <Stat label="Reserved" value={selectedInventory.reserved.toString()} />
              <Stat label="Available" value={selectedInventory.available.toString()} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Reorder Point" value={selectedInventory.reorderPoint.toString()} />
              <Stat label="Stock Value" value={`KES ${selectedInventory.value.toLocaleString()}`} />
            </div>
            <div className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded-sm border ${INVENTORY_STATUS_STYLES[selectedInventory.status]}`}>
              {selectedInventory.status}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedInventory(null);
                  openInAdmin('inventory', { sku: selectedInventory.sku });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Inventory
              </button>
              <button
                onClick={() => setSelectedInventory(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── SHIPPING MODAL ─── */}
      {selectedShipping && (
        <Modal onClose={() => setSelectedShipping(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Carrier</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedShipping.carrier}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Shipments" value={selectedShipping.shipments.toLocaleString()} />
              <Stat label="Delivered" value={selectedShipping.delivered.toLocaleString()} />
              <Stat label="In Transit" value={selectedShipping.inTransit.toLocaleString()} />
              <Stat label="Failed" value={selectedShipping.failed.toLocaleString()} />
              <Stat label="Avg Days" value={`${selectedShipping.avgDays} days`} />
              <Stat label="On-Time Rate" value={selectedShipping.onTimeRate} />
            </div>
            <Stat label="Total Cost" value={`KES ${selectedShipping.cost.toLocaleString()}`} />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedShipping(null);
                  openInAdmin('shipping', { carrier: selectedShipping.carrier });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Shipping
              </button>
              <button
                onClick={() => setSelectedShipping(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── DISCOUNT MODAL ─── */}
      {selectedDiscount && (
        <Modal onClose={() => setSelectedDiscount(null)}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Discount code</p>
                <h3 className="text-[15px] font-bold text-slate-900 mt-0.5 font-mono">{selectedDiscount.code}</h3>
              </div>
              <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${DISCOUNT_STATUS_STYLES[selectedDiscount.status]}`}>
                {selectedDiscount.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Type" value={selectedDiscount.type} />
              <Stat label="Uses" value={selectedDiscount.uses.toString()} />
              <Stat label="Discount Given" value={`KES ${selectedDiscount.discountGiven.toLocaleString()}`} />
              <Stat label="Revenue Generated" value={`KES ${selectedDiscount.revenue.toLocaleString()}`} />
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2">
              <p className="text-[13px] text-emerald-800">Return on discount</p>
              <p className="text-[15px] font-bold text-emerald-700 mt-0.5">{selectedDiscount.roi}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedDiscount(null);
                  openInAdmin('discounts', { code: selectedDiscount.code });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Discounts
              </button>
              <button
                onClick={() => setSelectedDiscount(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── SOCIAL: VIDEO MODAL ─── */}
      {selectedVideo && (
        <Modal onClose={() => setSelectedVideo(null)}>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border shrink-0 ${VIDEO_TYPE_STYLES[selectedVideo.videoType]}`}>
                {selectedVideo.videoType}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-slate-900 leading-snug">{selectedVideo.title}</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {selectedVideo.platform} · {selectedVideo.published} · {selectedVideo.duration}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-sm p-2">
              <p className="text-[13px] text-blue-900">Featured product</p>
              <p className="text-[15px] font-bold text-blue-950 mt-0.5">{selectedVideo.product}</p>
              <p className="text-[13px] text-blue-800 font-mono mt-0.5">
                {selectedVideo.sku} · {selectedVideo.category}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Views" value={selectedVideo.views.toLocaleString()} />
              <Stat label="Likes" value={selectedVideo.likes.toLocaleString()} />
              <Stat label="Comments" value={selectedVideo.comments.toLocaleString()} />
              <Stat label="Clicks to Product" value={selectedVideo.clicks.toLocaleString()} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Orders" value={selectedVideo.orders.toLocaleString()} />
              <Stat label="Conversion Rate" value={selectedVideo.conversionRate} />
              <Stat label="CTR" value={selectedVideo.ctr} />
              <Stat label="Ad Spend" value={selectedVideo.spend ? `KES ${selectedVideo.spend.toLocaleString()}` : 'Organic'} />
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2">
              <p className="text-[13px] text-emerald-800">Revenue from this video</p>
              <p className="text-[15px] font-bold text-emerald-700 mt-0.5">
                KES {selectedVideo.revenue.toLocaleString()}
              </p>
              <p className="text-[13px] text-emerald-700 mt-0.5">ROAS: {selectedVideo.roas}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedVideo(null);
                  openInAdmin('social', { post: selectedVideo.id });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Social
              </button>
              <button
                onClick={() => {
                  setSelectedVideo(null);
                  openInAdmin('products', { sku: selectedVideo.sku });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <Boxes className="w-3.5 h-3.5" />
                View product
              </button>
              <button
                onClick={() => setSelectedVideo(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── SOCIAL: PLATFORM MODAL ─── */}
      {selectedPlatform && (
        <Modal onClose={() => setSelectedPlatform(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PlatformIcon platform={selectedPlatform.platform} />
              <h3 className="text-[15px] font-bold text-slate-900">{selectedPlatform.platform}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Videos Published" value={selectedPlatform.videos.toString()} />
              <Stat label="Total Views" value={selectedPlatform.views.toLocaleString()} />
              <Stat label="Product Clicks" value={selectedPlatform.clicks.toLocaleString()} />
              <Stat label="Orders Attributed" value={selectedPlatform.orders.toLocaleString()} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Conversion Rate" value={selectedPlatform.convRate} />
              <Stat label="Ad Spend" value={selectedPlatform.spend ? `KES ${selectedPlatform.spend.toLocaleString()}` : 'Organic'} />
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2">
              <p className="text-[13px] text-emerald-800">Revenue from {selectedPlatform.platform}</p>
              <p className="text-[15px] font-bold text-emerald-700 mt-0.5">
                KES {selectedPlatform.revenue.toLocaleString()}
              </p>
              <p className="text-[13px] text-emerald-700 mt-0.5">ROAS: {selectedPlatform.roas}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedPlatform(null);
                  openInAdmin('social', { platform: selectedPlatform.platform });
                }}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Social
              </button>
              <button
                onClick={() => setSelectedPlatform(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── SOCIAL: FUNNEL DAY MODAL ─── */}
      {selectedFunnelDay && (
        <Modal onClose={() => setSelectedFunnelDay(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Social Funnel Day</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedFunnelDay.date}, 2026</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Views" value={selectedFunnelDay.views.toLocaleString()} />
              <Stat label="Product Clicks" value={selectedFunnelDay.clicks.toLocaleString()} />
              <Stat label="Orders" value={selectedFunnelDay.orders.toLocaleString()} />
              <Stat label="Revenue" value={`KES ${selectedFunnelDay.revenue.toLocaleString()}`} />
            </div>
            <div className="text-[13px] text-slate-500 space-y-1">
              <p>View → Click: {((selectedFunnelDay.clicks / selectedFunnelDay.views) * 100).toFixed(2)}%</p>
              <p>Click → Order: {((selectedFunnelDay.orders / selectedFunnelDay.clicks) * 100).toFixed(2)}%</p>
              <p>View → Order: {((selectedFunnelDay.orders / selectedFunnelDay.views) * 100).toFixed(2)}%</p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedFunnelDay(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── SOCIAL: PRODUCT VIDEO PERF MODAL ─── */}
      {selectedProductVideo && (
        <Modal onClose={() => setSelectedProductVideo(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedProductVideo.category}</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedProductVideo.product}</h3>
              <p className="text-[13px] text-slate-500 font-mono mt-0.5">SKU: {selectedProductVideo.sku}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Videos" value={selectedProductVideo.videos.toString()} />
              <Stat label="Total Views" value={selectedProductVideo.views.toLocaleString()} />
              <Stat label="Orders" value={selectedProductVideo.orders.toLocaleString()} />
              <Stat label="Avg Conv. Rate" value={selectedProductVideo.avgConvRate} />
            </div>
            <Stat label="Best Platform" value={selectedProductVideo.bestPlatform} />
            <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-2">
              <p className="text-[13px] text-emerald-800">Total revenue from videos</p>
              <p className="text-[15px] font-bold text-emerald-700 mt-0.5">
                KES {selectedProductVideo.revenue.toLocaleString()}
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedProductVideo(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* PAGE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Reports & Analytics</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Electronics shop · sales, inventory, and product video performance</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-white border border-slate-200 rounded-sm p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh this tab"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                className="bg-white border border-slate-200 rounded-sm px-2 py-2 flex items-center gap-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-950" />
                <span>{dateRangeLabel}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isDateMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDateMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-sm shadow-lg z-50 overflow-hidden py-1 text-[13px]">
                    {DATE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleRangePick(opt.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${dateRange === opt.id ? 'text-blue-950 font-medium bg-blue-50/40' : 'text-slate-700'
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
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-medium text-slate-600 mb-1">End</label>
                          <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                          />
                        </div>
                        <button
                          onClick={handleApplyCustom}
                          className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[13px]"
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
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting…' : 'Export'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {isExportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-lg z-50 overflow-hidden py-1 text-[13px]">
                    <button
                      onClick={() => handleExport('CSV')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => handleExport('Excel')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                      Export Excel
                    </button>
                    <button
                      onClick={() => handleExport('PDF')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
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

      {/* TABS */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-20">
        <div className="max-w-[1600px] mx-auto px-3 flex gap-0.5 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                  ? 'border-blue-950 text-blue-950 bg-blue-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN */}
      <main className="max-w-[1600px] mx-auto px-3 py-3">

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-100 rounded-sm p-3 mb-3 flex items-start gap-2 text-[13px]">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-700">Couldn&apos;t load this report</p>
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

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-64 bg-slate-100 rounded-sm w-full animate-pulse" />
            <div className="h-56 bg-slate-100 rounded-sm w-full animate-pulse" />
          </div>
        ) : (
          <>
            {/* ───── SALES ───── */}
            {activeTab === 'sales' && sales && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Revenue & Orders Timeline</h3>
                      <p className="text-[13px] text-slate-500">Daily transaction volume vs order counts · {sales.range_label}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-blue-950 rounded-sm" />
                        <span className="text-slate-600">Revenue</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                        <span className="text-slate-600">Orders</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={sales.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis yAxisId="left" stroke="#172554" fontSize={13} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={13} />
                        <Tooltip />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          fill="#172554"
                          radius={[2, 2, 0, 0]}
                          barSize={24}
                          onClick={(entry: unknown) => setSelectedSale(entry as ReportSaleRow)}
                          className="cursor-pointer"
                        />
                        <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[13px] text-slate-400 text-center">Click a bar to see day details</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Daily Sales Breakdown</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport('CSV')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={() => openInAdmin('sales')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Orders
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">Orders</th>
                          <th className="py-2 px-3 font-medium">Revenue</th>
                          <th className="py-2 px-3 font-medium text-right">AOV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sales.daily.map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedSale(row)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
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

            {/* ───── ORDERS ───── */}
            {activeTab === 'orders' && orders && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Order Report · {orders.range_label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport('CSV')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => openInAdmin('orders')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                    >
                      Open in Orders
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[820px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Order</th>
                        <th className="py-2 px-3 font-medium">Date</th>
                        <th className="py-2 px-3 font-medium">Customer</th>
                        <th className="py-2 px-3 font-medium">Items</th>
                        <th className="py-2 px-3 font-medium">Payment</th>
                        <th className="py-2 px-3 font-medium">Channel</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.rows.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrder(o)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-2 px-3 font-mono font-medium text-blue-950">{o.id}</td>
                          <td className="py-2 px-3 text-slate-600">{o.date}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{o.customer}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{o.items}</td>
                          <td className="py-2 px-3 text-slate-600">{o.payment}</td>
                          <td className="py-2 px-3 text-slate-600">{o.channel}</td>
                          <td className="py-2 px-3">
                            <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${o.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : o.status === 'Processing' ? 'bg-blue-50 text-blue-950 border-blue-100'
                                : o.status === 'Shipped' ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                  : o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-red-50 text-red-600 border-red-100'
                              }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-900 text-right">KES {o.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ───── PRODUCTS ───── */}
            {activeTab === 'products' && products && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Top Selling Products</h3>
                    <p className="text-[13px] text-slate-500">Click a bar or row for details</p>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={products.rows} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                        <YAxis dataKey="product" type="category" width={180} stroke="#172554" fontSize={13} />
                        <Tooltip />
                        <Bar
                          dataKey="revenue"
                          fill="#0284c7"
                          radius={[0, 2, 2, 0]}
                          barSize={18}
                          onClick={(entry: unknown) => setSelectedProduct(entry as ReportProductRow)}
                          className="cursor-pointer"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Product Performance</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport('Excel')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export Excel
                      </button>
                      <button
                        onClick={() => openInAdmin('products')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Products
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Product</th>
                          <th className="py-2 px-3 font-medium">SKU</th>
                          <th className="py-2 px-3 font-medium">Qty</th>
                          <th className="py-2 px-3 font-medium">Revenue</th>
                          <th className="py-2 px-3 font-medium">Returns</th>
                          <th className="py-2 px-3 font-medium text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.rows.map((p, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedProduct(p)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2 px-3 font-medium text-slate-900">{p.product}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{p.sku}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{p.qty}</td>
                            <td className="py-2 px-3 font-mono text-slate-800">KES {p.revenue.toLocaleString()}</td>
                            <td className="py-2 px-3 font-mono text-red-600">{p.returns}</td>
                            <td className="py-2 px-3 font-mono font-medium text-emerald-600 text-right">KES {p.net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ───── CUSTOMERS ───── */}
            {activeTab === 'customers' && customers && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">New vs Returning Customers</h3>
                    <p className="text-[13px] text-slate-500">Daily acquisition trends</p>
                  </div>

                  <div className="h-56 w-full">
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

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Top Buyers</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport('CSV')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={() => openInAdmin('customers')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Customers
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Customer</th>
                          <th className="py-2 px-3 font-medium">Orders</th>
                          <th className="py-2 px-3 font-medium">Spent</th>
                          <th className="py-2 px-3 font-medium">AOV</th>
                          <th className="py-2 px-3 font-medium text-right">Last Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customers.top_buyers.map((c, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedCustomer(c)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2 px-3 font-medium text-slate-900">{c.customer}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{c.orders}</td>
                            <td className="py-2 px-3 font-mono text-emerald-600">KES {c.spent.toLocaleString()}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">KES {c.aov.toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-500 text-right">{c.lastOrder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ───── INVENTORY ───── */}
            {activeTab === 'inventory' && inventory && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total SKUs', value: inventory.counts.total_skus, icon: Package, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Low Stock', value: inventory.counts.low, icon: AlertTriangle, color: 'text-amber-700 bg-amber-50' },
                    { label: 'Critical', value: inventory.counts.critical, icon: AlertTriangle, color: 'text-orange-700 bg-orange-50' },
                    { label: 'Out of Stock', value: inventory.counts.out, icon: X, color: 'text-red-600 bg-red-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
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

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Inventory Levels</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport('Excel')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export Excel
                      </button>
                      <button
                        onClick={() => openInAdmin('inventory')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Inventory
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Product</th>
                          <th className="py-2 px-3 font-medium">Warehouse</th>
                          <th className="py-2 px-3 font-medium text-right">On Hand</th>
                          <th className="py-2 px-3 font-medium text-right">Reserved</th>
                          <th className="py-2 px-3 font-medium text-right">Available</th>
                          <th className="py-2 px-3 font-medium text-right">Reorder Pt.</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 px-3 font-medium text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventory.rows.map((r) => (
                          <tr
                            key={r.sku}
                            onClick={() => setSelectedInventory(r)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2 px-3">
                              <p className="font-medium text-slate-900">{r.product}</p>
                              <p className="text-[13px] text-slate-400 font-mono">{r.sku}</p>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{r.warehouse}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">{r.onHand}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{r.reserved}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">{r.available}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{r.reorderPoint}</td>
                            <td className="py-2 px-3">
                              <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${INVENTORY_STATUS_STYLES[r.status]}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">KES {r.value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ───── PAYMENTS ───── */}
            {activeTab === 'payments' && payments && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">M-Pesa Settlement Report · {payments.range_label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport('PDF')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={() => openInAdmin('payments')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Transactions
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[640px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Stream</th>
                          <th className="py-2 px-3 font-medium">Txns</th>
                          <th className="py-2 px-3 font-medium">Volume</th>
                          <th className="py-2 px-3 font-medium">Fees</th>
                          <th className="py-2 px-3 font-medium text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.streams.map((pay, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedPayment(pay)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2 px-3 font-medium text-slate-900">{pay.method}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{pay.transactions.toLocaleString()}</td>
                            <td className="py-2 px-3 font-mono text-slate-800">KES {pay.volume.toLocaleString()}</td>
                            <td className="py-2 px-3 font-mono text-red-600">-KES {pay.fees.toLocaleString()}</td>
                            <td className="py-2 px-3 font-mono font-medium text-emerald-600 text-right">KES {pay.net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">M-Pesa Stream Split</h3>
                    <p className="text-[13px] text-slate-500">Click a slice for details</p>
                  </div>
                  <div className="h-48 w-full">
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
                          onClick={(entry: unknown) => setSelectedPieSlice(entry as ReportPaymentShareSlice)}
                          className="cursor-pointer"
                        >
                          {payments.share.map((entry, i) => (
                            <Cell key={i} fill={entry.color} className="hover:opacity-80" />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-0.5 text-[13px]">
                    {payments.share.map((slice) => (
                      <button
                        key={slice.name}
                        onClick={() => setSelectedPieSlice(slice)}
                        className="w-full flex items-center justify-between hover:bg-slate-50 rounded-sm px-2 py-2 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-slate-700 truncate">{slice.name}</span>
                        </div>
                        <span className="font-medium text-slate-900">KES {(slice.value / 1000).toFixed(0)}k</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ───── TAXES ───── */}
            {activeTab === 'taxes' && taxes && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">KRA VAT (16%) & Taxable Sales</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport('Excel')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export Excel
                    </button>
                    <button
                      onClick={() => openInAdmin('taxes')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                    >
                      Open tax settings
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Period</th>
                        <th className="py-2 px-3 font-medium">Taxable Sales</th>
                        <th className="py-2 px-3 font-medium">VAT (16%)</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 font-medium text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {taxes.rows.map((tax, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setSelectedTax(tax)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-2 px-3 font-medium text-slate-900">{tax.period}</td>
                          <td className="py-2 px-3 font-mono text-slate-800">KES {tax.taxableSales.toLocaleString()}</td>
                          <td className="py-2 px-3 font-mono text-red-600">KES {tax.vat16.toLocaleString()}</td>
                          <td className="py-2 px-3">
                            <span className={`text-[13px] font-medium px-2 py-0.5 rounded-sm border ${TAX_STATUS_STYLES[tax.status]}`}>
                              {tax.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-medium text-emerald-600 text-right">KES {tax.net.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ───── SHIPPING ───── */}
            {activeTab === 'shipping' && shipping && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total Shipments', value: shipping.totals.shipments.toLocaleString(), icon: Truck, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Delivered', value: shipping.totals.delivered.toLocaleString(), icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'In Transit', value: shipping.totals.in_transit.toLocaleString(), icon: Truck, color: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Failed', value: shipping.totals.failed.toLocaleString(), icon: X, color: 'text-red-600 bg-red-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
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

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Carrier Performance</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport('CSV')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={() => openInAdmin('shipping')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Shipping
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[840px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Carrier</th>
                          <th className="py-2 px-3 font-medium text-right">Shipments</th>
                          <th className="py-2 px-3 font-medium text-right">Delivered</th>
                          <th className="py-2 px-3 font-medium text-right">In Transit</th>
                          <th className="py-2 px-3 font-medium text-right">Failed</th>
                          <th className="py-2 px-3 font-medium text-right">Avg Days</th>
                          <th className="py-2 px-3 font-medium text-right">On-Time</th>
                          <th className="py-2 px-3 font-medium text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shipping.rows.map((s) => (
                          <tr
                            key={s.carrier}
                            onClick={() => setSelectedShipping(s)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2 px-3 font-medium text-slate-900">{s.carrier}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">{s.shipments}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-600">{s.delivered}</td>
                            <td className="py-2 px-3 text-right font-mono text-indigo-600">{s.inTransit}</td>
                            <td className="py-2 px-3 text-right font-mono text-red-600">{s.failed}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{s.avgDays}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-600">{s.onTimeRate}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">KES {s.cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ───── DISCOUNTS ───── */}
            {activeTab === 'discounts' && discounts && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Discount Code Performance</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport('Excel')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export Excel
                    </button>
                    <button
                      onClick={() => openInAdmin('discounts')}
                      className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                    >
                      Open in Discounts
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[840px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Code</th>
                        <th className="py-2 px-3 font-medium">Type</th>
                        <th className="py-2 px-3 font-medium text-right">Uses</th>
                        <th className="py-2 px-3 font-medium text-right">Discount Given</th>
                        <th className="py-2 px-3 font-medium text-right">Revenue</th>
                        <th className="py-2 px-3 font-medium text-right">ROI</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {discounts.rows.map((d) => (
                        <tr
                          key={d.code}
                          onClick={() => setSelectedDiscount(d)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-2 px-3 font-mono font-medium text-blue-950">{d.code}</td>
                          <td className="py-2 px-3 text-slate-600">{d.type}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{d.uses}</td>
                          <td className="py-2 px-3 text-right font-mono text-red-600">KES {d.discountGiven.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600">KES {d.revenue.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">{d.roi}</td>
                          <td className="py-2 px-3">
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

            {/* ───── SOCIAL ───── */}
            {activeTab === 'social' && social && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { label: 'Videos Published', value: social.summary.videos.toLocaleString(), change: social.summary.changes.videos, up: true, icon: Video, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Total Views', value: social.summary.views.toLocaleString(), change: social.summary.changes.views, up: true, icon: Eye, color: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Orders from Videos', value: social.summary.orders.toLocaleString(), change: social.summary.changes.orders, up: true, icon: ShoppingCart, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Video Revenue', value: `KES ${social.summary.revenue.toLocaleString()}`, change: social.summary.changes.revenue, up: true, icon: CircleDollarSign, color: 'text-emerald-700 bg-emerald-50' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${s.color}`}>
                          <s.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                      <div className="flex items-center gap-1 text-[13px]">
                        {s.up ? (
                          <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 text-red-600" />
                        )}
                        <span className={s.up ? 'text-emerald-700' : 'text-red-600'}>{s.change}</span>
                        <span className="text-slate-400">vs last period</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Social Sales Funnel</h3>
                      <p className="text-[13px] text-slate-500">Views → Product clicks → Orders</p>
                    </div>
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-blue-950 rounded-sm" />
                        <span className="text-slate-600">Views</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                        <span className="text-slate-600">Orders</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-56 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={social.funnel}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis yAxisId="left" stroke="#172554" fontSize={13} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={13} />
                        <Tooltip />
                        <Bar
                          yAxisId="left"
                          dataKey="views"
                          fill="#172554"
                          radius={[2, 2, 0, 0]}
                          barSize={20}
                          onClick={(entry: unknown) => setSelectedFunnelDay(entry as ReportSocialFunnelPoint)}
                          className="cursor-pointer"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="orders"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[13px] text-slate-400 text-center">Click a bar to see day breakdown</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-2 sm:px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-700 truncate">Product Videos Performance</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleExport('Excel')}
                        className="text-[13px] text-blue-950 hover:underline font-medium"
                      >
                        Export Excel
                      </button>
                      <button
                        onClick={() => openInAdmin('social')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded-sm text-[13px]"
                      >
                        Open in Social
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-2 sm:px-3 font-medium">Video</th>
                          <th className="py-2 px-2 sm:px-3 font-medium">Product</th>
                          <th className="py-2 px-2 sm:px-3 font-medium">Platform</th>
                          <th className="py-2 px-2 sm:px-3 font-medium text-right">Views</th>
                          <th className="py-2 px-2 sm:px-3 font-medium text-right">Clicks</th>
                          <th className="py-2 px-2 sm:px-3 font-medium text-right">Orders</th>
                          <th className="py-2 px-2 sm:px-3 font-medium text-right">Conv.</th>
                          <th className="py-2 px-2 sm:px-3 font-medium text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {social.videos.map((v) => (
                          <tr
                            key={v.id}
                            onClick={() => setSelectedVideo(v)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2 px-2 sm:px-3">
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
                            <td className="py-2 px-2 sm:px-3">
                              <p className="text-slate-700 truncate max-w-[160px]">{v.product}</p>
                              <p className="text-[13px] text-slate-400 font-mono">{v.sku}</p>
                            </td>
                            <td className="py-2 px-2 sm:px-3">
                              <PlatformIcon platform={v.platform} withLabel />
                            </td>
                            <td className="py-2 px-2 sm:px-3 text-right font-mono text-slate-700">{v.views.toLocaleString()}</td>
                            <td className="py-2 px-2 sm:px-3 text-right font-mono text-slate-600">{v.clicks.toLocaleString()}</td>
                            <td className="py-2 px-2 sm:px-3 text-right font-mono font-semibold text-slate-900">{v.orders}</td>
                            <td className="py-2 px-2 sm:px-3 text-right font-mono text-emerald-600">{v.conversionRate}</td>
                            <td className="py-2 px-2 sm:px-3 text-right font-mono font-semibold text-emerald-600">
                              KES {v.revenue.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                    <div className="px-2 sm:px-3 py-2 border-b border-slate-200 bg-slate-50">
                      <span className="text-[13px] font-medium text-slate-700">Platform Summary</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px] min-w-[560px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="py-2 px-2 sm:px-3 font-medium">Platform</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Videos</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Views</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Orders</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {social.platforms.map((p) => (
                            <tr
                              key={p.platform}
                              onClick={() => setSelectedPlatform(p)}
                              className="hover:bg-slate-50 cursor-pointer transition"
                            >
                              <td className="py-2 px-2 sm:px-3">
                                <PlatformIcon platform={p.platform} withLabel />
                              </td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono text-slate-700">{p.videos}</td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono text-slate-700">{p.views.toLocaleString()}</td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono font-semibold text-slate-900">{p.orders}</td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono font-semibold text-emerald-600">
                                KES {p.revenue.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                    <div className="px-2 sm:px-3 py-2 border-b border-slate-200 bg-slate-50">
                      <span className="text-[13px] font-medium text-slate-700">Top Products by Video Revenue</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px] min-w-[560px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="py-2 px-2 sm:px-3 font-medium">Product</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Videos</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Orders</th>
                            <th className="py-2 px-2 sm:px-3 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {social.product_perf.map((p) => (
                            <tr
                              key={p.sku}
                              onClick={() => setSelectedProductVideo(p)}
                              className="hover:bg-slate-50 cursor-pointer transition"
                            >
                              <td className="py-2 px-2 sm:px-3">
                                <p className="font-medium text-slate-900 truncate max-w-[180px] sm:max-w-none">{p.product}</p>
                                <p className="text-[13px] text-slate-400 font-mono">{p.sku} · {p.category}</p>
                              </td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono text-slate-700">{p.videos}</td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono font-semibold text-slate-900">{p.orders}</td>
                              <td className="py-2 px-2 sm:px-3 text-right font-mono font-semibold text-emerald-600">
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

/* ============================================================
   Reusable bits
   ============================================================ */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{value}</p>
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
      <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${meta.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${meta.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="text-slate-700 truncate">{platform}</span>
    </div>
  );
}