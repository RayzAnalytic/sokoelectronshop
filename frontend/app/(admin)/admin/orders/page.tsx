'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Download,
  Plus,
  Calendar,
  Printer,
  ArrowLeft,
  Check,
  X,
  MoreVertical,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  Send,
  DollarSign,
  ChevronDown,
  Truck,
  Package,
  CreditCard,
  MapPin,
  Tag,
  FileText,
  Clock,
  Undo2,
  Ban,
  AlertCircle,
} from 'lucide-react';

// --- TYPES ---
type OrderStatus =
  | 'All'
  | 'Pending'
  | 'Payment Pending'
  | 'Paid'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Failed'
  | 'Refunded'
  | 'Returned';

type PaymentMethod = 'M-Pesa' | 'Airtel Money' | 'Stripe' | 'COD';
type PaymentStatus = 'Paid' | 'Pending' | 'Failed' | 'Refunded';

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  image: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface TimelineEvent {
  id: string;
  user: string;
  action: string;
  date: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  items: OrderItem[];
  itemsCount: number;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionRef: string;
  fulfillmentStatus: OrderStatus;
  date: string;
  courier?: string;
  trackingNumber?: string;
  internalNotes: string;
  timeline: TimelineEvent[];
}

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: '#SKO-9842',
    customerName: 'Isaac Mutinda',
    customerPhone: '+254 712 345 678',
    customerEmail: 'isaac.mutinda@gmail.com',
    customerAddress: 'Dedan Kimathi University, Nyeri',
    items: [
      {
        id: 'item-1',
        name: 'Lenovo ThinkPad X1 Carbon Gen 10',
        sku: 'LNV-TPX1-G10',
        image: '/Lenovo.jpeg',
        qty: 1,
        unitPrice: 145000,
        discount: 5000,
        subtotal: 140000,
      },
      {
        id: 'item-2',
        name: 'Logitech MX Master 3S Wireless Mouse',
        sku: 'LOG-MXM3S-BLK',
        image: '/phone.jpeg',
        qty: 1,
        unitPrice: 12500,
        discount: 0,
        subtotal: 12500,
      },
    ],
    itemsCount: 2,
    subtotal: 157500,
    discountTotal: 5000,
    shippingFee: 0,
    total: 152500,
    paymentMethod: 'M-Pesa',
    paymentStatus: 'Paid',
    transactionRef: 'RGH78923XYZ',
    fulfillmentStatus: 'Processing',
    date: '2026-09-23 10:30',
    courier: 'Wells Fargo Courier',
    trackingNumber: 'WF-KEN-89234',
    internalNotes: 'Customer requested expedited delivery before Friday afternoon.',
    timeline: [
      { id: 't-1', user: 'System', action: 'Order placed via WhatsApp store', date: '2026-09-23 10:30' },
      { id: 't-2', user: 'Admin Isaac', action: 'Verified M-Pesa payment STK push confirmation', date: '2026-09-23 10:32' },
      { id: 't-3', user: 'Admin Isaac', action: 'Updated fulfillment status to Processing', date: '2026-09-23 11:00' },
    ],
  },
  {
    id: 'ord-102',
    orderNumber: '#SKO-9843',
    customerName: 'Amina Mohamed',
    customerPhone: '+254 733 987 654',
    customerEmail: 'amina.m@outlook.com',
    customerAddress: 'Westlands Commercial Centre, Nairobi',
    items: [
      {
        id: 'item-3',
        name: 'Dell UltraSharp 27 4K USB-C Monitor',
        sku: 'DEL-U2723QE',
        image: '/dellmonitor.jpeg',
        qty: 1,
        unitPrice: 68000,
        discount: 0,
        subtotal: 68000,
      },
    ],
    itemsCount: 1,
    subtotal: 68000,
    discountTotal: 0,
    shippingFee: 0,
    total: 68000,
    paymentMethod: 'Airtel Money',
    paymentStatus: 'Paid',
    transactionRef: 'ATL45920ABC',
    fulfillmentStatus: 'Shipped',
    date: '2026-09-22 15:45',
    courier: 'G4S Courier',
    trackingNumber: 'G4S-NBO-49201',
    internalNotes: 'Fragile item. Handle with extreme care.',
    timeline: [
      { id: 't-4', user: 'System', action: 'Order placed online', date: '2026-09-22 15:45' },
      { id: 't-5', user: 'Admin Isaac', action: 'Marked as Shipped with G4S tracking #G4S-NBO-49201', date: '2026-09-22 17:20' },
    ],
  },
  {
    id: 'ord-103',
    orderNumber: '#SKO-9844',
    customerName: 'Kevin Otieno',
    customerPhone: '+254 722 111 222',
    customerEmail: 'kevin.otieno@yahoo.com',
    customerAddress: 'Milimani Estate, Kisumu',
    items: [
      {
        id: 'item-4',
        name: 'Apple iPhone 15 Pro Max 256GB',
        sku: 'APL-IP15PM-256',
        image: '/phone.jpeg',
        qty: 1,
        unitPrice: 185000,
        discount: 0,
        subtotal: 185000,
      },
    ],
    itemsCount: 1,
    subtotal: 185000,
    discountTotal: 0,
    shippingFee: 0,
    total: 185000,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    transactionRef: 'N/A',
    fulfillmentStatus: 'Pending',
    date: '2026-09-23 12:15',
    internalNotes: 'Call customer before dispatching delivery rider.',
    timeline: [
      { id: 't-6', user: 'System', action: 'Order placed with Cash on Delivery', date: '2026-09-23 12:15' },
    ],
  },
  {
    id: 'ord-104',
    orderNumber: '#SKO-9845',
    customerName: 'Grace Wanjiku',
    customerPhone: '+254 701 234 567',
    customerEmail: 'grace.w@gmail.com',
    customerAddress: 'Karen, Nairobi',
    items: [
      {
        id: 'item-5',
        name: 'Samsung Galaxy S24 Ultra 512GB',
        sku: 'SAM-S24U-512',
        image: '/phone.jpeg',
        qty: 1,
        unitPrice: 175000,
        discount: 10000,
        subtotal: 165000,
      },
      {
        id: 'item-6',
        name: 'Samsung Galaxy Buds2 Pro',
        sku: 'SAM-BUDS2PRO',
        image: '/phone.jpeg',
        qty: 1,
        unitPrice: 22000,
        discount: 2000,
        subtotal: 20000,
      },
    ],
    itemsCount: 2,
    subtotal: 197000,
    discountTotal: 12000,
    shippingFee: 500,
    total: 185500,
    paymentMethod: 'Stripe',
    paymentStatus: 'Paid',
    transactionRef: 'STRIPE-88921',
    fulfillmentStatus: 'Packed',
    date: '2026-09-21 09:10',
    courier: 'Sendy',
    trackingNumber: 'SND-49302',
    internalNotes: 'Gift wrapping requested.',
    timeline: [
      { id: 't-7', user: 'System', action: 'Order placed online', date: '2026-09-21 09:10' },
      { id: 't-8', user: 'Admin Grace', action: 'Payment confirmed via Stripe', date: '2026-09-21 09:12' },
      { id: 't-9', user: 'Admin Grace', action: 'Order packed and ready for dispatch', date: '2026-09-21 14:00' },
    ],
  },
  {
    id: 'ord-105',
    orderNumber: '#SKO-9846',
    customerName: 'David Kiprop',
    customerPhone: '+254 720 888 999',
    customerEmail: 'd.kiprop@kenya.co.ke',
    customerAddress: 'Eldoret Town, Uasin Gishu',
    items: [
      {
        id: 'item-7',
        name: 'HP Spectre x360 14',
        sku: 'HP-SPX360-14',
        image: '/Lenovo.jpeg',
        qty: 1,
        unitPrice: 165000,
        discount: 0,
        subtotal: 165000,
      },
    ],
    itemsCount: 1,
    subtotal: 165000,
    discountTotal: 0,
    shippingFee: 0,
    total: 165000,
    paymentMethod: 'M-Pesa',
    paymentStatus: 'Paid',
    transactionRef: 'RGH99011ABC',
    fulfillmentStatus: 'Delivered',
    date: '2026-09-20 11:00',
    courier: 'G4S Courier',
    trackingNumber: 'G4S-ELD-11223',
    internalNotes: 'Delivered successfully. Customer confirmed receipt.',
    timeline: [
      { id: 't-10', user: 'System', action: 'Order placed via WhatsApp', date: '2026-09-20 11:00' },
      { id: 't-11', user: 'Admin Isaac', action: 'Payment confirmed', date: '2026-09-20 11:05' },
      { id: 't-12', user: 'Admin Isaac', action: 'Order shipped via G4S', date: '2026-09-20 15:00' },
      { id: 't-13', user: 'System', action: 'Order delivered and confirmed', date: '2026-09-22 10:30' },
    ],
  },
  {
    id: 'ord-106',
    orderNumber: '#SKO-9847',
    customerName: 'Fatuma Ali',
    customerPhone: '+254 734 555 666',
    customerEmail: 'fatuma.ali@gmail.com',
    customerAddress: 'Mombasa Island, Mombasa',
    items: [
      {
        id: 'item-8',
        name: 'iPad Pro 12.9 M2',
        sku: 'APL-IPP129-M2',
        image: '/phone.jpeg',
        qty: 1,
        unitPrice: 155000,
        discount: 0,
        subtotal: 155000,
      },
    ],
    itemsCount: 1,
    subtotal: 155000,
    discountTotal: 0,
    shippingFee: 0,
    total: 155000,
    paymentMethod: 'Airtel Money',
    paymentStatus: 'Refunded',
    transactionRef: 'ATL77812XYZ',
    fulfillmentStatus: 'Refunded',
    date: '2026-09-19 16:20',
    courier: 'Wells Fargo Courier',
    trackingNumber: 'WF-MSA-55678',
    internalNotes: 'Customer returned item due to defect. Refund processed.',
    timeline: [
      { id: 't-14', user: 'System', action: 'Order placed online', date: '2026-09-19 16:20' },
      { id: 't-15', user: 'Admin Grace', action: 'Payment confirmed', date: '2026-09-19 16:25' },
      { id: 't-16', user: 'Admin Grace', action: 'Order shipped', date: '2026-09-20 09:00' },
      { id: 't-17', user: 'Admin Isaac', action: 'Customer reported defect, return initiated', date: '2026-09-22 14:00' },
      { id: 't-18', user: 'Admin Isaac', action: 'Refund processed KES 155,000', date: '2026-09-23 10:00' },
    ],
  },
  {
    id: 'ord-107',
    orderNumber: '#SKO-9848',
    customerName: 'Peter Njoroge',
    customerPhone: '+254 715 777 888',
    customerEmail: 'p.njoroge@yahoo.com',
    customerAddress: 'Thika Road, Nairobi',
    items: [
      {
        id: 'item-9',
        name: 'Asus ROG Zephyrus G14',
        sku: 'ASU-ROG-G14',
        image: '/Lenovo.jpeg',
        qty: 1,
        unitPrice: 195000,
        discount: 15000,
        subtotal: 180000,
      },
    ],
    itemsCount: 1,
    subtotal: 195000,
    discountTotal: 15000,
    shippingFee: 0,
    total: 180000,
    paymentMethod: 'M-Pesa',
    paymentStatus: 'Failed',
    transactionRef: 'FAILED-001',
    fulfillmentStatus: 'Failed',
    date: '2026-09-23 08:45',
    internalNotes: 'Payment failed. Customer notified to retry.',
    timeline: [
      { id: 't-19', user: 'System', action: 'Order placed via WhatsApp', date: '2026-09-23 08:45' },
      { id: 't-20', user: 'System', action: 'M-Pesa payment failed - insufficient funds', date: '2026-09-23 08:46' },
    ],
  },
  {
    id: 'ord-108',
    orderNumber: '#SKO-9849',
    customerName: 'Mercy Chebet',
    customerPhone: '+254 726 333 444',
    customerEmail: 'mercy.chebet@gmail.com',
    customerAddress: 'Nakuru Town, Nakuru',
    items: [
      {
        id: 'item-10',
        name: 'Google Pixel 8 Pro',
        sku: 'GOO-PX8P-128',
        image: '/phone.jpeg',
        qty: 1,
        unitPrice: 135000,
        discount: 0,
        subtotal: 135000,
      },
    ],
    itemsCount: 1,
    subtotal: 135000,
    discountTotal: 0,
    shippingFee: 0,
    total: 135000,
    paymentMethod: 'Stripe',
    paymentStatus: 'Paid',
    transactionRef: 'STRIPE-99012',
    fulfillmentStatus: 'Returned',
    date: '2026-09-18 13:30',
    courier: 'Sendy',
    trackingNumber: 'SND-11223',
    internalNotes: 'Customer returned item. Awaiting inspection.',
    timeline: [
      { id: 't-21', user: 'System', action: 'Order placed online', date: '2026-09-18 13:30' },
      { id: 't-22', user: 'Admin Grace', action: 'Payment confirmed', date: '2026-09-18 13:35' },
      { id: 't-23', user: 'Admin Grace', action: 'Order shipped via Sendy', date: '2026-09-19 10:00' },
      { id: 't-24', user: 'Admin Isaac', action: 'Return requested by customer', date: '2026-09-21 09:00' },
      { id: 't-25', user: 'System', action: 'Item returned and logged', date: '2026-09-22 16:00' },
    ],
  },
];

const PAYMENT_METHODS: PaymentMethod[] = ['M-Pesa', 'Airtel Money', 'Stripe', 'COD'];
const PAYMENT_STATUSES: PaymentStatus[] = ['Paid', 'Pending', 'Failed', 'Refunded'];

const ALL_STATUSES: OrderStatus[] = [
  'All',
  'Pending',
  'Payment Pending',
  'Paid',
  'Processing',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Failed',
  'Refunded',
  'Returned',
];

export default function OrdersPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {selectedOrderId ? (
        <OrderDetailPage orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      ) : (
        <OrdersListPage onSelectOrder={setSelectedOrderId} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   1. ORDERS LIST
   ══════════════════════════════════════════ */
function OrdersListPage({ onSelectOrder }: { onSelectOrder: (id: string) => void }) {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [activeTab, setActiveTab] = useState<OrderStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const tabCounts: Record<string, number> = {
    All: orders.length,
  };
  ALL_STATUSES.filter((s) => s !== 'All').forEach((status) => {
    tabCounts[status] = orders.filter((o) => o.fulfillmentStatus === status).length;
  });

  const filteredOrders = orders.filter((ord) => {
    if (activeTab !== 'All' && ord.fulfillmentStatus !== activeTab) return false;
    if (paymentMethodFilter && ord.paymentMethod !== paymentMethodFilter) return false;
    if (paymentStatusFilter && ord.paymentStatus !== paymentStatusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        ord.orderNumber.toLowerCase().includes(q) ||
        ord.customerName.toLowerCase().includes(q) ||
        ord.customerPhone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allSelected = filteredOrders.length > 0 && selectedIds.length === filteredOrders.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filteredOrders.map((o) => o.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const bulkUpdateStatus = (status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (selectedIds.includes(o.id) ? { ...o, fulfillmentStatus: status } : o))
    );
    setToastMessage(`Marked ${selectedIds.length} orders as ${status}`);
    setSelectedIds([]);
  };

  const statusBadge = (s: OrderStatus) => {
    if (s === 'Delivered' || s === 'Paid') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (s === 'Processing' || s === 'Packed') return 'bg-blue-50 text-blue-950 border-blue-100';
    if (s === 'Shipped') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (s === 'Pending' || s === 'Payment Pending') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (s === 'Cancelled' || s === 'Failed' || s === 'Refunded' || s === 'Returned')
      return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

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
            <p className="text-[13px] text-slate-500 mt-0.5">Manage customer transactions and fulfillment</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setToastMessage('Exporting orders CSV…')}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setToastMessage('Create order modal opened')}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create order</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 pb-2 flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2">
          {ALL_STATUSES.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition shrink-0 ${activeTab === tab ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {tab}
              <span
                className={`text-[13px] px-1.5 rounded-sm ${activeTab === tab ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
              >
                {tabCounts[tab] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
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
                type="text"
                placeholder="Date range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 w-40"
              />
            </div>

            <FilterDropdown
              label="Payment"
              value={paymentMethodFilter}
              options={PAYMENT_METHODS as unknown as string[]}
              onChange={(v) => setPaymentMethodFilter(v as PaymentMethod | null)}
            />
            <FilterDropdown
              label="Status"
              value={paymentStatusFilter}
              options={PAYMENT_STATUSES as unknown as string[]}
              onChange={(v) => setPaymentStatusFilter(v as PaymentStatus | null)}
            />
          </div>
        </div>

        {/* BULK ACTIONS */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => bulkUpdateStatus('Processing')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Mark Processing
              </button>
              <button
                onClick={() => bulkUpdateStatus('Packed')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Mark Packed
              </button>
              <button
                onClick={() => bulkUpdateStatus('Shipped')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Mark Shipped
              </button>
              <button
                onClick={() => bulkUpdateStatus('Delivered')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Mark Delivered
              </button>
              <button
                onClick={() => setToastMessage('Printing selected invoices…')}
                className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Print invoices
              </button>
              <button
                onClick={() => setToastMessage('Exporting selected orders…')}
                className="bg-emerald-600 hover:bg-emerald-500 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
              >
                Export
              </button>
            </div>
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
                      className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
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
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      No orders match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => onSelectOrder(ord.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ord.id)}
                          onChange={() => toggleRow(ord.id)}
                          className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{ord.orderNumber}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900 truncate max-w-[180px]">{ord.customerName}</p>
                        <p className="text-[13px] text-slate-400 font-mono">{ord.customerPhone}</p>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">{ord.itemsCount}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        KES {ord.total.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-medium border border-slate-200">
                            {ord.paymentMethod}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${ord.paymentStatus === 'Paid'
                                ? 'bg-emerald-500'
                                : ord.paymentStatus === 'Pending'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                            title={ord.paymentStatus}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                            ord.fulfillmentStatus
                          )}`}
                        >
                          {ord.fulfillmentStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">{ord.date}</td>
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectOrder(ord.id)}
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

/* ══════════════════════════════════════════
   2. ORDER DETAIL
   ══════════════════════════════════════════ */
function OrderDetailPage({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<Order>(() => {
    return INITIAL_ORDERS.find((o) => o.id === orderId) || INITIAL_ORDERS[0];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState(
    `Hello ${order.customerName}, your order ${order.orderNumber} is currently ${order.fulfillmentStatus}. Thank you for shopping with us!`
  );
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(String(order.total));
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const updateStatus = (newStatus: OrderStatus) => {
    setOrder((prev) => ({
      ...prev,
      fulfillmentStatus: newStatus,
      timeline: [
        {
          id: `t-${Date.now()}`,
          user: 'Admin',
          action: `Updated status to ${newStatus}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        ...prev.timeline,
      ],
    }));
    setToastMessage(`Status updated to ${newStatus}`);
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setOrder((prev) => ({
      ...prev,
      internalNotes: prev.internalNotes ? `${prev.internalNotes}\n${newNote.trim()}` : newNote.trim(),
    }));
    setNewNote('');
    setToastMessage('Note added');
  };

  const sendWhatsApp = () => {
    setWhatsAppOpen(false);
    setToastMessage('WhatsApp update sent');
  };

  const confirmRefund = () => {
    setRefundOpen(false);
    setOrder((prev) => ({
      ...prev,
      paymentStatus: 'Refunded',
      fulfillmentStatus: 'Refunded',
      timeline: [
        {
          id: `t-${Date.now()}`,
          user: 'Admin',
          action: `Refunded KES ${refundAmount}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        ...prev.timeline,
      ],
    }));
    setToastMessage(`Refunded KES ${refundAmount}`);
  };

  const markReturned = () => {
    setOrder((prev) => ({
      ...prev,
      fulfillmentStatus: 'Returned',
      timeline: [
        {
          id: `t-${Date.now()}`,
          user: 'Admin',
          action: 'Marked as Returned',
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        ...prev.timeline,
      ],
    }));
    setToastMessage('Order marked as Returned');
  };

  const markCancelled = () => {
    setOrder((prev) => ({
      ...prev,
      fulfillmentStatus: 'Cancelled',
      timeline: [
        {
          id: `t-${Date.now()}`,
          user: 'Admin',
          action: 'Order cancelled',
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        ...prev.timeline,
      ],
    }));
    setToastMessage('Order cancelled');
  };

  const anyModalOpen = whatsAppOpen || refundOpen;

  const statusBadgeClass = (s: OrderStatus) => {
    if (s === 'Delivered' || s === 'Paid') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (s === 'Processing' || s === 'Packed') return 'bg-blue-50 text-blue-950 border-blue-100';
    if (s === 'Shipped') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (s === 'Pending' || s === 'Payment Pending') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (s === 'Cancelled' || s === 'Failed' || s === 'Refunded' || s === 'Returned')
      return 'bg-red-50 text-red-600 border-red-100';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

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
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
              className="h-8 w-8 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold text-slate-900">{order.orderNumber}</h1>
                <span
                  className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${statusBadgeClass(
                    order.fulfillmentStatus
                  )}`}
                >
                  {order.fulfillmentStatus}
                </span>
              </div>
              <p className="text-[13px] text-slate-500">Placed on {order.date}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={order.fulfillmentStatus}
              onChange={(e) => updateStatus(e.target.value as OrderStatus)}
              className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
            >
              <option value="Pending">Pending</option>
              <option value="Payment Pending">Payment Pending</option>
              <option value="Paid">Paid</option>
              <option value="Processing">Processing</option>
              <option value="Packed">Packed</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
              <option value="Returned">Returned</option>
            </select>

            <button
              onClick={() => setWhatsAppOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setToastMessage('Generating PDF invoice…')}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invoice</span>
            </button>

            <button
              onClick={() => setRefundOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refund</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-3">
          {/* ITEMS */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">Order items ({order.itemsCount})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2 font-medium">Product</th>
                    <th className="py-2 px-2 font-medium text-center">Qty</th>
                    <th className="py-2 px-2 font-medium text-right">Unit</th>
                    <th className="py-2 px-2 font-medium text-right">Discount</th>
                    <th className="py-2 px-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.image}
                            alt=""
                            className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[240px]">{item.name}</p>
                            <p className="font-mono text-[13px] text-slate-400">SKU: {item.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">{item.qty}</td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {item.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right text-red-600">
                        {item.discount > 0 ? `-${item.discount.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-900">
                        {item.subtotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col items-end gap-1 text-[13px]">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">KES {order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Discount</span>
                <span className="font-medium text-red-600">
                  -KES {order.discountTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Shipping fee</span>
                <span className="font-medium">
                  {order.shippingFee === 0 ? 'Free' : `KES ${order.shippingFee.toLocaleString()}`}
                </span>
              </div>
              <div className="flex justify-between w-64 text-slate-900 font-semibold pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>KES {order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* PAYMENT */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">Payment information</h2>
              <span
                className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${order.paymentStatus === 'Paid'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : order.paymentStatus === 'Pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-red-50 text-red-600 border-red-100'
                  }`}
              >
                {order.paymentStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-sm p-2 text-[13px]">
              <div>
                <p className="text-slate-500">Method</p>
                <p className="font-medium text-slate-900 mt-0.5">{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-slate-500">Reference</p>
                <p className="font-mono font-medium text-blue-950 mt-0.5">{order.transactionRef}</p>
              </div>
              <div>
                <p className="text-slate-500">Amount</p>
                <p className="font-medium text-slate-900 mt-0.5">KES {order.total.toLocaleString()}</p>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setToastMessage('Opening digital receipt…')}
                  className="text-blue-950 hover:underline font-medium inline-flex items-center gap-1"
                >
                  View receipt
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">Status timeline</h2>
            <ul className="space-y-2">
              {order.timeline.map((t) => (
                <li
                  key={t.id}
                  className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900">{t.action}</p>
                    <p className="text-[13px] text-slate-500 mt-0.5">By {t.user}</p>
                  </div>
                  <span className="text-[13px] font-mono text-slate-400 shrink-0">{t.date}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-3">
          {/* CUSTOMER */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">Customer</h2>
              <button
                onClick={() => setToastMessage('Opening customer profile…')}
                className="text-[13px] text-blue-950 hover:underline font-medium inline-flex items-center gap-0.5"
              >
                View
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-[13px]">
              <p className="font-medium text-slate-900">{order.customerName}</p>
              <p className="text-slate-600 font-mono">{order.customerPhone}</p>
              <p className="text-slate-600 truncate">{order.customerEmail}</p>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500">Delivery address</p>
                <p className="text-slate-800 mt-0.5">{order.customerAddress}</p>
              </div>
            </div>
          </div>

          {/* SHIPPING */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">Shipping</h2>
              <button
                onClick={() => setToastMessage('Courier tracking dialog opened')}
                className="text-[13px] text-blue-950 hover:underline font-medium"
              >
                Add tracking
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Courier</span>
                <span className="font-medium text-slate-900">{order.courier || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tracking</span>
                <span className="font-mono font-medium text-blue-950">{order.trackingNumber || 'Pending'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
              <button
                onClick={markReturned}
                className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition"
              >
                <Undo2 className="w-3 h-3" />
                Mark Returned
              </button>
              <button
                onClick={markCancelled}
                className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1.5 rounded-sm text-[13px] transition"
              >
                <Ban className="w-3 h-3" />
                Cancel Order
              </button>
            </div>
          </div>

          {/* NOTES */}
          <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-900">Internal notes</h2>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-[13px] text-slate-700 whitespace-pre-line">
              {order.internalNotes || 'No internal notes yet.'}
            </div>

            <form onSubmit={addNote} className="space-y-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Add internal note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                >
                  Add note
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* WHATSAPP MODAL */}
      {whatsAppOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setWhatsAppOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">Send WhatsApp update</h3>
              <button
                onClick={() => setWhatsAppOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-slate-500 mb-1">Live preview</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 text-slate-800">
                <p className="whitespace-pre-line">{whatsAppText}</p>
                <p className="text-[13px] text-slate-400 text-right mt-1">10:45 AM ✓✓</p>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Edit template</label>
              <textarea
                rows={4}
                value={whatsAppText}
                onChange={(e) => setWhatsAppText(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWhatsAppOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={sendWhatsApp}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Send className="w-3.5 h-3.5" />
                Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFUND MODAL */}
      {refundOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setRefundOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Process refund</h3>
              <p className="text-slate-500 mt-1">
                Refund to customer via {order.paymentMethod}
              </p>
            </div>

            <label className="block text-left">
              <span className="text-slate-700 font-medium">Refund amount (KES)</span>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-1 w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </label>

            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setRefundOpen(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmRefund}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Confirm refund
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────── FilterDropdown ─────────── */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
            ? 'bg-blue-50 border-blue-950 text-blue-950'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {value ?? label}
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
                <span className="truncate">{opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}