'use client';

import React, { useState } from 'react';
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
  Send,
  Mail,
  MessageCircle,
  Copy,
  PieChart as PieIcon,
} from 'lucide-react';
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

// --- TYPES ---
type ReportTab = 'sales' | 'products' | 'customers' | 'payments' | 'taxes';
type DateRange = 'today' | '7days' | '30days' | 'this_month' | 'year';
type ExportFormat = 'CSV' | 'PDF' | 'Excel';

interface SaleRow {
  date: string;
  revenue: number;
  orders: number;
  aov: number;
  topCategory: string;
  refunds: number;
}

interface ProductRow {
  product: string;
  sku: string;
  qty: number;
  revenue: number;
  returns: number;
  net: number;
  category: string;
  lastSold: string;
}

interface CustomerRow {
  customer: string;
  email: string;
  phone: string;
  orders: number;
  spent: number;
  aov: number;
  lastOrder: string;
  county: string;
}

interface PaymentRow {
  method: string;
  transactions: number;
  volume: number;
  fees: number;
  net: number;
  provider: string;
  successRate: string;
}

interface TaxRow {
  period: string;
  taxableSales: number;
  vat16: number;
  net: number;
  dueDate: string;
  status: 'Filed' | 'Due' | 'Overdue';
}

// --- MOCK DATA ---
const SALES_DAILY_DATA: SaleRow[] = [
  { date: 'Sep 17', revenue: 45200, orders: 32, aov: 1412, topCategory: 'Software Licenses', refunds: 0 },
  { date: 'Sep 18', revenue: 58900, orders: 41, aov: 1436, topCategory: 'Payment Plugins', refunds: 1 },
  { date: 'Sep 19', revenue: 71200, orders: 54, aov: 1318, topCategory: 'SaaS Kits', refunds: 0 },
  { date: 'Sep 20', revenue: 98400, orders: 72, aov: 1366, topCategory: 'UI Kits', refunds: 2 },
  { date: 'Sep 21', revenue: 64100, orders: 48, aov: 1335, topCategory: 'WhatsApp Tools', refunds: 1 },
  { date: 'Sep 22', revenue: 89000, orders: 63, aov: 1412, topCategory: 'Software Licenses', refunds: 0 },
  { date: 'Sep 23', revenue: 112000, orders: 85, aov: 1317, topCategory: 'Payment Plugins', refunds: 1 },
];

const TOP_PRODUCTS_DATA: ProductRow[] = [
  { product: 'WhatsApp Chatbot Pro License', sku: 'SFT-BOT-01', qty: 340, revenue: 1020000, returns: 2, net: 1014000, category: 'WhatsApp Tools', lastSold: '2 mins ago' },
  { product: 'M-Pesa STK Push Gateway Plugin', sku: 'SFT-PAY-02', qty: 290, revenue: 870000, returns: 1, net: 867000, category: 'Payment Plugins', lastSold: '14 mins ago' },
  { product: 'Multi-Tenant SaaS Starter Kit', sku: 'SFT-SAAS-03', qty: 180, revenue: 1260000, returns: 4, net: 1232000, category: 'SaaS Kits', lastSold: '1 hour ago' },
  { product: 'Tailwind Dashboard UI Kit', sku: 'SFT-UI-04', qty: 155, revenue: 465000, returns: 0, net: 465000, category: 'UI Kits', lastSold: '3 hours ago' },
  { product: 'WhatsApp Catalog Sync Bot', sku: 'SFT-CAT-05', qty: 120, revenue: 360000, returns: 1, net: 357000, category: 'WhatsApp Tools', lastSold: '5 hours ago' },
];

const CUSTOMERS_DATA: CustomerRow[] = [
  { customer: 'Brian Kipkorir', email: 'brian@merchant.co.ke', phone: '+254 712 345 678', orders: 12, spent: 45600, aov: 3800, lastOrder: 'Sep 23, 2026', county: 'Nairobi' },
  { customer: 'Brenda Akinyi', email: 'brenda@shop.co.ke', phone: '+254 722 987 654', orders: 9, spent: 34200, aov: 3800, lastOrder: 'Sep 22, 2026', county: 'Nairobi' },
  { customer: 'Kevin Odhiambo', email: 'kevin@tech.co.ke', phone: '+254 733 112 233', orders: 7, spent: 28900, aov: 4128, lastOrder: 'Sep 21, 2026', county: 'Mombasa' },
  { customer: 'Mercy Wanjiku', email: 'mercy@store.co.ke', phone: '+254 700 554 433', orders: 6, spent: 24000, aov: 4000, lastOrder: 'Sep 20, 2026', county: 'Kisumu' },
  { customer: 'Collins Cheruiyot', email: 'collins@soko.co.ke', phone: '+254 711 223 344', orders: 5, spent: 19500, aov: 3900, lastOrder: 'Sep 19, 2026', county: 'Nakuru' },
];

const NEW_VS_RETURNING_DATA = [
  { date: 'Sep 17', newCust: 22, returning: 10 },
  { date: 'Sep 18', newCust: 28, returning: 13 },
  { date: 'Sep 19', newCust: 35, returning: 19 },
  { date: 'Sep 20', newCust: 46, returning: 26 },
  { date: 'Sep 21', newCust: 30, returning: 18 },
  { date: 'Sep 22', newCust: 40, returning: 23 },
  { date: 'Sep 23', newCust: 52, returning: 33 },
];

const PAYMENTS_DATA: PaymentRow[] = [
  { method: 'M-Pesa STK Push', transactions: 1420, volume: 4820000, fees: 67480, net: 4752520, provider: 'Safaricom', successRate: '99.2%' },
  { method: 'M-Pesa C2B Paybill', transactions: 380, volume: 1240000, fees: 22320, net: 1217680, provider: 'Safaricom', successRate: '98.7%' },
  { method: 'Card (Visa / Mastercard)', transactions: 112, volume: 560000, fees: 16240, net: 543760, provider: 'Stripe', successRate: '96.4%' },
  { method: 'Bank Transfer (EFT)', transactions: 24, volume: 380000, fees: 1900, net: 378100, provider: 'KCB / Equity', successRate: '100%' },
];

const PAYMENT_SHARE_PIE = [
  { name: 'M-Pesa STK Push', value: 4820000, color: '#10b981' },
  { name: 'M-Pesa C2B', value: 1240000, color: '#059669' },
  { name: 'Credit Card', value: 560000, color: '#0284c7' },
  { name: 'Bank Transfer', value: 380000, color: '#6366f1' },
];

const TAXES_DATA: TaxRow[] = [
  { period: 'September 2026 (W3)', taxableSales: 6850000, vat16: 1096000, net: 5754000, dueDate: 'Oct 20, 2026', status: 'Due' },
  { period: 'September 2026 (W2)', taxableSales: 5420000, vat16: 867200, net: 4552800, dueDate: 'Oct 20, 2026', status: 'Due' },
  { period: 'September 2026 (W1)', taxableSales: 4980000, vat16: 796800, net: 4183200, dueDate: 'Sep 20, 2026', status: 'Filed' },
  { period: 'August 2026 (Full)', taxableSales: 21400000, vat16: 3424000, net: 17976000, dueDate: 'Sep 20, 2026', status: 'Filed' },
];

const TAX_STATUS_STYLES: Record<TaxRow['status'], string> = {
  Filed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Due: 'bg-amber-50 text-amber-700 border-amber-100',
  Overdue: 'bg-red-50 text-red-600 border-red-100',
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Modals
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [selectedPieSlice, setSelectedPieSlice] = useState<typeof PAYMENT_SHARE_PIE[0] | null>(null);
  const [selectedTax, setSelectedTax] = useState<TaxRow | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTabChange = (tab: ReportTab) => {
    setIsLoading(true);
    setActiveTab(tab);
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleExport = (format: ExportFormat) => {
    setIsExportMenuOpen(false);
    showToast(`Exported ${activeTab.toUpperCase()} report as ${format}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-3 right-3 z-[110] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ---- SALE ROW MODAL ---- */}
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
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => showToast(`Exported ${selectedSale.date} sales breakdown`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Export day
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

      {/* ---- PRODUCT MODAL ---- */}
      {selectedProduct && (
        <Modal onClose={() => setSelectedProduct(null)}>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedProduct.category}</p>
                <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedProduct.product}</h3>
                <p className="text-[13px] text-slate-500 font-mono mt-0.5">SKU: {selectedProduct.sku}</p>
              </div>
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
                onClick={() => showToast(`Opening product page for ${selectedProduct.product}`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View product
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

      {/* ---- CUSTOMER MODAL ---- */}
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
                onClick={() => showToast(`Email draft opened for ${selectedCustomer.customer}`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
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

      {/* ---- PAYMENT MODAL ---- */}
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
                onClick={() => showToast(`Reconciling ${selectedPayment.method}…`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Reconcile
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

      {/* ---- PIE SLICE MODAL ---- */}
      {selectedPieSlice && (
        <Modal onClose={() => setSelectedPieSlice(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedPieSlice.color }} />
              <h3 className="text-[15px] font-bold text-slate-900">{selectedPieSlice.name}</h3>
            </div>
            <Stat label="Volume" value={`KES ${selectedPieSlice.value.toLocaleString()}`} />
            <p className="text-[13px] text-slate-500">
              Share of total: {Math.round((selectedPieSlice.value / PAYMENT_SHARE_PIE.reduce((a, b) => a + b.value, 0)) * 100)}%
            </p>
            <div className="flex justify-end pt-1">
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

      {/* ---- TAX MODAL ---- */}
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
              {selectedTax.status === 'Due' && (
                <button
                  onClick={() => showToast(`Opening KRA iTax filing for ${selectedTax.period}`)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  File with KRA
                </button>
              )}
              <button
                onClick={() => showToast(`Downloading VAT return for ${selectedTax.period}`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
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

      {/* PAGE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Reports & Analytics</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Exportable financial, sales, product, and tax reports</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white border border-slate-200 rounded-sm px-2 py-2 flex items-center gap-2 text-[13px] font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-blue-950" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="bg-transparent border-none focus:outline-none cursor-pointer text-[13px]"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="year">Year to Date</option>
              </select>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {isExportMenuOpen && (
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
              )}
            </div>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-3 flex gap-0.5 overflow-x-auto">
          {[
            { id: 'sales', label: 'Sales', icon: TrendingUp },
            { id: 'products', label: 'Products', icon: ShoppingBag },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'payments', label: 'Payments', icon: CreditCard },
            { id: 'taxes', label: 'Taxes & VAT', icon: Receipt },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as ReportTab)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
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

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-64 bg-slate-100 rounded-sm w-full animate-pulse" />
            <div className="h-56 bg-slate-100 rounded-sm w-full animate-pulse" />
          </div>
        ) : (
          <>
            {/* ---- SALES ---- */}
            {activeTab === 'sales' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Revenue & Orders Timeline</h3>
                      <p className="text-[13px] text-slate-500">Daily transaction volume vs order counts</p>
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
                      <ComposedChart data={SALES_DAILY_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis yAxisId="left" stroke="#172554" fontSize={13} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={13} />
                        <Tooltip />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          fill="#172554"
                          radius={[4, 4, 0, 0]}
                          barSize={24}
                          onClick={(entry: any) => setSelectedSale(entry)}
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
                    <button
                      onClick={() => handleExport('CSV')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export CSV
                    </button>
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
                        {SALES_DAILY_DATA.map((row, idx) => (
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

            {/* ---- PRODUCTS ---- */}
            {activeTab === 'products' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Top Selling Products</h3>
                    <p className="text-[13px] text-slate-500">Click a bar or row for details</p>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={TOP_PRODUCTS_DATA} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                        <YAxis dataKey="product" type="category" width={180} stroke="#172554" fontSize={13} />
                        <Tooltip />
                        <Bar
                          dataKey="revenue"
                          fill="#0284c7"
                          radius={[0, 4, 4, 0]}
                          barSize={18}
                          onClick={(entry: any) => setSelectedProduct(entry)}
                          className="cursor-pointer"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Product Performance</span>
                    <button
                      onClick={() => handleExport('Excel')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
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
                        {TOP_PRODUCTS_DATA.map((p, idx) => (
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

            {/* ---- CUSTOMERS ---- */}
            {activeTab === 'customers' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">New vs Returning Customers</h3>
                    <p className="text-[13px] text-slate-500">Daily acquisition trends</p>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={NEW_VS_RETURNING_DATA}>
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
                    <button
                      onClick={() => handleExport('CSV')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
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
                        {CUSTOMERS_DATA.map((c, idx) => (
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

            {/* ---- PAYMENTS ---- */}
            {activeTab === 'payments' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Payment Gateway Settlement</span>
                    <button
                      onClick={() => handleExport('PDF')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export PDF
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Method</th>
                          <th className="py-2 px-3 font-medium">Txns</th>
                          <th className="py-2 px-3 font-medium">Volume</th>
                          <th className="py-2 px-3 font-medium">Fees</th>
                          <th className="py-2 px-3 font-medium text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {PAYMENTS_DATA.map((pay, idx) => (
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
                    <h3 className="text-[13px] font-semibold text-slate-900">Method Share</h3>
                    <p className="text-[13px] text-slate-500">Click a slice for details</p>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={PAYMENT_SHARE_PIE}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                          onClick={(entry: any) => setSelectedPieSlice(entry)}
                          className="cursor-pointer"
                        >
                          {PAYMENT_SHARE_PIE.map((entry, i) => (
                            <Cell key={i} fill={entry.color} className="hover:opacity-80" />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-0.5 text-[13px]">
                    {PAYMENT_SHARE_PIE.map((slice) => (
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

            {/* ---- TAXES ---- */}
            {activeTab === 'taxes' && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">KRA VAT (16%) & Taxable Sales</span>
                  <button
                    onClick={() => handleExport('Excel')}
                    className="text-[13px] text-blue-950 hover:underline font-medium"
                  >
                    Export Excel
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
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
                      {TAXES_DATA.map((tax, idx) => (
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
          </>
        )}
      </main>
    </div>
  );
}

/* ---- Reusable bits ---- */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl relative" onClick={(e) => e.stopPropagation()}>
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
