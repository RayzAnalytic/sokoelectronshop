'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Users,
  Search,
  Download,
  Plus,
  Calendar,
  ShoppingBag,
  DollarSign,
  ArrowLeft,
  Check,
  X,
  MoreVertical,
  ShieldAlert,
  MessageSquare,
  Mail,
  MapPin,
  Edit3,
  Trash2,
  Send,
  ChevronDown,
  Heart,
  ShoppingCart,
  Star,
  Ticket,
  Bell,
  Tag,
  TrendingUp,
  Clock,
  Package,
  Phone,
} from 'lucide-react';

// --- TYPES ---
type CustomerStatus = 'Active' | 'Blocked';
type CustomerSegment = 'VIP' | 'Loyal' | 'New' | 'At Risk' | 'Churned' | 'Regular';
type MarketingConsent = 'Subscribed' | 'Unsubscribed' | 'Pending';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  date: string;
  itemsCount: number;
  total: number;
  status: string;
  paymentMethod: string;
}

interface CustomerAddress {
  id: string;
  title: string;
  address: string;
  city: string;
  isDefault: boolean;
}

interface CustomerNote {
  id: string;
  author: string;
  date: string;
  text: string;
}

interface WishlistItem {
  id: string;
  productName: string;
  sku: string;
  price: number;
  addedDate: string;
  image: string;
}

interface CartItem {
  id: string;
  productName: string;
  sku: string;
  price: number;
  qty: number;
  addedDate: string;
  image: string;
}

interface Review {
  id: string;
  productName: string;
  rating: number;
  comment: string;
  date: string;
  status: 'Published' | 'Pending' | 'Hidden';
}

interface SupportTicket {
  id: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  date: string;
  lastUpdate: string;
}

interface CommunicationLog {
  id: string;
  channel: 'WhatsApp' | 'Email' | 'SMS' | 'Call';
  direction: 'Inbound' | 'Outbound';
  subject: string;
  date: string;
  agent: string;
}

interface Customer {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  location: string;
  dateJoined: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string;
  status: CustomerStatus;
  segment: CustomerSegment;
  mostPurchasedCategory: string;
  preferredPayment: string;
  marketingConsent: MarketingConsent;
  orders: CustomerOrder[];
  addresses: CustomerAddress[];
  notes: CustomerNote[];
  wishlist: WishlistItem[];
  cart: CartItem[];
  reviews: Review[];
  supportTickets: SupportTicket[];
  communicationLog: CommunicationLog[];
}

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Isaac Mutinda',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    email: 'isaac.mutinda@gmail.com',
    phone: '+254 712 345 678',
    location: 'Nyeri, Kenya',
    dateJoined: '2026-04-12',
    ordersCount: 8,
    totalSpent: 345000,
    lastOrderDate: '2026-09-23',
    status: 'Active',
    segment: 'VIP',
    mostPurchasedCategory: 'Laptops',
    preferredPayment: 'M-Pesa',
    marketingConsent: 'Subscribed',
    orders: [
      { id: 'ord-101', orderNumber: '#SKO-9842', date: '2026-09-23', itemsCount: 2, total: 157500, status: 'Processing', paymentMethod: 'M-Pesa' },
      { id: 'ord-089', orderNumber: '#SKO-9120', date: '2026-08-14', itemsCount: 1, total: 145000, status: 'Delivered', paymentMethod: 'M-Pesa' },
      { id: 'ord-042', orderNumber: '#SKO-8451', date: '2026-06-02', itemsCount: 3, total: 42500, status: 'Delivered', paymentMethod: 'M-Pesa' },
    ],
    addresses: [
      { id: 'addr-1', title: 'Hostel Residence', address: 'Dedan Kimathi University, Dedan Kimathi Road', city: 'Nyeri', isDefault: true },
      { id: 'addr-2', title: 'Family Home', address: 'Kitui Town Central, Kenyatta Road', city: 'Kitui', isDefault: false },
    ],
    notes: [
      { id: 'n-1', author: 'Admin Isaac', date: '2026-08-15 10:22', text: 'VIP customer. Prefers M-Pesa STK push transactions.' },
    ],
    wishlist: [
      { id: 'w-1', productName: 'Dell UltraSharp 27 4K Monitor', sku: 'DEL-U2723QE', price: 68000, addedDate: '2026-09-20', image: '/dellmonitor.jpeg' },
      { id: 'w-2', productName: 'Logitech MX Keys S', sku: 'LOG-MXKS-BLK', price: 18500, addedDate: '2026-09-15', image: '/phone.jpeg' },
    ],
    cart: [
      { id: 'c-1', productName: 'Samsung Galaxy Buds2 Pro', sku: 'SAM-BUDS2PRO', price: 22000, qty: 1, addedDate: '2026-09-23', image: '/phone.jpeg' },
    ],
    reviews: [
      { id: 'r-1', productName: 'Lenovo ThinkPad X1 Carbon Gen 10', rating: 5, comment: 'Excellent build quality and battery life. Highly recommend for developers.', date: '2026-08-20', status: 'Published' },
      { id: 'r-2', productName: 'Logitech MX Master 3S', rating: 4, comment: 'Great mouse, but slightly pricey.', date: '2026-06-15', status: 'Published' },
    ],
    supportTickets: [
      { id: 't-1', subject: 'Delivery delay on #SKO-9120', status: 'Resolved', priority: 'Medium', date: '2026-08-15', lastUpdate: '2026-08-17' },
    ],
    communicationLog: [
      { id: 'cl-1', channel: 'WhatsApp', direction: 'Outbound', subject: 'Order #SKO-9842 dispatched', date: '2026-09-23 14:00', agent: 'Admin Isaac' },
      { id: 'cl-2', channel: 'Email', direction: 'Outbound', subject: 'Receipt for order #SKO-9120', date: '2026-08-14 16:00', agent: 'System' },
      { id: 'cl-3', channel: 'Call', direction: 'Inbound', subject: 'Inquiry about delivery timing', date: '2026-08-13 10:30', agent: 'Support Grace' },
    ],
  },
  {
    id: 'cust-2',
    name: 'Amina Mohamed',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    email: 'amina.m@outlook.com',
    phone: '+254 733 987 654',
    location: 'Nairobi, Kenya',
    dateJoined: '2026-05-20',
    ordersCount: 4,
    totalSpent: 182000,
    lastOrderDate: '2026-09-22',
    status: 'Active',
    segment: 'Loyal',
    mostPurchasedCategory: 'Monitors',
    preferredPayment: 'M-Pesa',
    marketingConsent: 'Subscribed',
    orders: [
      { id: 'ord-102', orderNumber: '#SKO-9843', date: '2026-09-22', itemsCount: 1, total: 68000, status: 'Shipped', paymentMethod: 'M-Pesa' },
      { id: 'ord-077', orderNumber: '#SKO-8912', date: '2026-07-11', itemsCount: 2, total: 114000, status: 'Delivered', paymentMethod: 'M-Pesa' },
    ],
    addresses: [
      { id: 'addr-3', title: 'Office Desk', address: 'Westlands Commercial Centre, Ring Road', city: 'Nairobi', isDefault: true },
    ],
    notes: [
      { id: 'n-2', author: 'Support Admin', date: '2026-07-12 14:05', text: 'Always requests fragile handling on monitors.' },
    ],
    wishlist: [
      { id: 'w-3', productName: 'Apple MacBook Pro 14 M3', sku: 'APL-MBP14-M3', price: 245000, addedDate: '2026-09-18', image: '/Lenovo.jpeg' },
    ],
    cart: [],
    reviews: [
      { id: 'r-3', productName: 'Dell UltraSharp 27 4K USB-C Monitor', rating: 5, comment: 'Perfect color accuracy for design work.', date: '2026-07-20', status: 'Published' },
    ],
    supportTickets: [],
    communicationLog: [
      { id: 'cl-4', channel: 'Email', direction: 'Outbound', subject: 'Shipping confirmation #SKO-9843', date: '2026-09-22 17:30', agent: 'System' },
    ],
  },
  {
    id: 'cust-3',
    name: 'Kevin Otieno',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    email: 'kevin.otieno@yahoo.com',
    phone: '+254 722 111 222',
    location: 'Kisumu, Kenya',
    dateJoined: '2026-08-01',
    ordersCount: 1,
    totalSpent: 185000,
    lastOrderDate: '2026-09-23',
    status: 'Active',
    segment: 'New',
    mostPurchasedCategory: 'Phones',
    preferredPayment: 'M-Pesa',
    marketingConsent: 'Pending',
    orders: [
      { id: 'ord-103', orderNumber: '#SKO-9844', date: '2026-09-23', itemsCount: 1, total: 185000, status: 'Pending', paymentMethod: 'M-Pesa' },
    ],
    addresses: [
      { id: 'addr-4', title: 'Residence', address: 'Milimani Estate, Block 4', city: 'Kisumu', isDefault: true },
    ],
    notes: [],
    wishlist: [],
    cart: [],
    reviews: [],
    supportTickets: [
      { id: 't-2', subject: 'Payment confirmation not received', status: 'Open', priority: 'High', date: '2026-09-23', lastUpdate: '2026-09-23' },
    ],
    communicationLog: [
      { id: 'cl-5', channel: 'Call', direction: 'Inbound', subject: 'Query about payment status', date: '2026-09-23 12:30', agent: 'Support Grace' },
    ],
  },
  {
    id: 'cust-4',
    name: 'Samantha Njeri',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    email: 'samantha.n@gmail.com',
    phone: '+254 700 555 444',
    location: 'Nairobi, Kenya',
    dateJoined: '2026-02-15',
    ordersCount: 12,
    totalSpent: 96000,
    lastOrderDate: '2026-09-19',
    status: 'Blocked',
    segment: 'At Risk',
    mostPurchasedCategory: 'Accessories',
    preferredPayment: 'M-Pesa',
    marketingConsent: 'Unsubscribed',
    orders: [
      { id: 'ord-055', orderNumber: '#SKO-7621', date: '2026-09-19', itemsCount: 1, total: 12500, status: 'Delivered', paymentMethod: 'M-Pesa' },
    ],
    addresses: [
      { id: 'addr-5', title: 'Apartment', address: 'Kilimani Heights, Argwings Kodhek Rd', city: 'Nairobi', isDefault: true },
    ],
    notes: [
      { id: 'n-3', author: 'Security Lead', date: '2026-09-20 09:15', text: 'Blocked due to multiple chargeback disputes and fraudulent COD orders.' },
    ],
    wishlist: [
      { id: 'w-4', productName: 'Anker 100W GaN Charger', sku: 'ANK-100W-GAN', price: 8500, addedDate: '2026-09-10', image: '/phone.jpeg' },
    ],
    cart: [
      { id: 'c-2', productName: 'USB-C to HDMI Cable', sku: 'CBL-USBC-HDMI', price: 2500, qty: 2, addedDate: '2026-09-18', image: '/phone.jpeg' },
    ],
    reviews: [
      { id: 'r-4', productName: 'Anker Power Bank 20000mAh', rating: 2, comment: 'Stopped working after a month.', date: '2026-09-01', status: 'Pending' },
    ],
    supportTickets: [
      { id: 't-3', subject: 'Refund request for defective power bank', status: 'In Progress', priority: 'High', date: '2026-09-05', lastUpdate: '2026-09-15' },
      { id: 't-4', subject: 'Account blocked appeal', status: 'Open', priority: 'Urgent', date: '2026-09-20', lastUpdate: '2026-09-20' },
    ],
    communicationLog: [
      { id: 'cl-6', channel: 'Email', direction: 'Outbound', subject: 'Account suspension notice', date: '2026-09-20 09:30', agent: 'Security Lead' },
      { id: 'cl-7', channel: 'WhatsApp', direction: 'Inbound', subject: 'Appeal against account block', date: '2026-09-21 11:00', agent: 'Support Grace' },
    ],
  },
  {
    id: 'cust-5',
    name: 'Grace Wanjiku',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150',
    email: 'grace.w@gmail.com',
    phone: '+254 701 234 567',
    location: 'Nairobi, Kenya',
    dateJoined: '2026-06-10',
    ordersCount: 3,
    totalSpent: 245000,
    lastOrderDate: '2026-09-21',
    status: 'Active',
    segment: 'VIP',
    mostPurchasedCategory: 'Laptops',
    preferredPayment: 'M-Pesa',
    marketingConsent: 'Subscribed',
    orders: [
      { id: 'ord-104', orderNumber: '#SKO-9845', date: '2026-09-21', itemsCount: 2, total: 185500, status: 'Packed', paymentMethod: 'M-Pesa' },
      { id: 'ord-082', orderNumber: '#SKO-9102', date: '2026-07-28', itemsCount: 1, total: 59500, status: 'Delivered', paymentMethod: 'M-Pesa' },
    ],
    addresses: [
      { id: 'addr-6', title: 'Home', address: 'Karen Road, House 24', city: 'Nairobi', isDefault: true },
    ],
    notes: [
      { id: 'n-4', author: 'Admin Grace', date: '2026-09-21 14:10', text: 'Gift wrapping requested. Deliver before 5pm.' },
    ],
    wishlist: [
      { id: 'w-5', productName: 'Apple iPad Pro 12.9 M2', sku: 'APL-IPP129-M2', price: 155000, addedDate: '2026-09-19', image: '/phone.jpeg' },
    ],
    cart: [],
    reviews: [
      { id: 'r-5', productName: 'Samsung Galaxy S24 Ultra', rating: 5, comment: 'Best Android phone I have ever used.', date: '2026-09-22', status: 'Published' },
    ],
    supportTickets: [],
    communicationLog: [
      { id: 'cl-8', channel: 'WhatsApp', direction: 'Outbound', subject: 'Gift wrapping confirmed', date: '2026-09-21 15:00', agent: 'Admin Grace' },
    ],
  },
];

const SEGMENTS: CustomerSegment[] = ['VIP', 'Loyal', 'New', 'At Risk', 'Churned', 'Regular'];
const ORDER_COUNT_OPTIONS = ['1', '2-5', '5+'];
const SPENT_RANGE_OPTIONS = ['100k+', '50k-100k', '<50k'];
const SPENT_LABELS: Record<string, string> = {
  '100k+': 'KES 100k+ (VIP)',
  '50k-100k': 'KES 50k–100k',
  '<50k': 'Under KES 50k',
};

export default function CustomersPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {selectedCustomerId ? (
        <CustomerDetailPage customerId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />
      ) : (
        <CustomersListPage onSelectCustomer={setSelectedCustomerId} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   1. LIST VIEW
   ══════════════════════════════════════════ */
function CustomersListPage({ onSelectCustomer }: { onSelectCustomer: (id: string) => void }) {
  const [customers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | null>(null);
  const [orderCountFilter, setOrderCountFilter] = useState<string | null>(null);
  const [spentRangeFilter, setSpentRangeFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const totalCustomers = customers.length;
  const newThisMonth = customers.filter((c) => c.dateJoined.startsWith('2026-09')).length;
  const repeatRate =
    totalCustomers > 0
      ? Math.round((customers.filter((c) => c.ordersCount > 1).length / totalCustomers) * 100)
      : 0;
  const totalRevenue = customers.reduce((a, c) => a + c.totalSpent, 0);
  const totalOrders = customers.reduce((a, c) => a + c.ordersCount, 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const segmentCounts: Record<string, number> = {};
  SEGMENTS.forEach((s) => {
    segmentCounts[s] = customers.filter((c) => c.segment === s).length;
  });

  const filtered = customers.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (segmentFilter && c.segment !== segmentFilter) return false;
    if (orderCountFilter === '1' && c.ordersCount !== 1) return false;
    if (orderCountFilter === '2-5' && (c.ordersCount < 2 || c.ordersCount > 5)) return false;
    if (orderCountFilter === '5+' && c.ordersCount <= 5) return false;

    if (spentRangeFilter === '100k+' && c.totalSpent < 100000) return false;
    if (spentRangeFilter === '50k-100k' && (c.totalSpent < 50000 || c.totalSpent > 100000)) return false;
    if (spentRangeFilter === '<50k' && c.totalSpent >= 50000) return false;

    return true;
  });

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map((c) => c.id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const activeFilterCount =
    (segmentFilter ? 1 : 0) + (orderCountFilter ? 1 : 0) + (spentRangeFilter ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSegmentFilter(null);
    setOrderCountFilter(null);
    setSpentRangeFilter(null);
  };

  const segmentBadge = (s: CustomerSegment) =>
    s === 'VIP'
      ? 'bg-amber-50 text-amber-800 border-amber-100'
      : s === 'Loyal'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : s === 'New'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : s === 'At Risk'
            ? 'bg-red-50 text-red-600 border-red-100'
            : s === 'Churned'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-slate-50 text-slate-700 border-slate-200';

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
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Customers</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Mini CRM — profiles, segments, and lifetime value
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setToastMessage('Exporting customers CSV…')}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setToastMessage('Add customer modal opened')}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add customer</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Total customers</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{totalCustomers}</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">New this month</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{newThisMonth}</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Repeat rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{repeatRate}%</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Avg. order value</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {avgOrderValue.toLocaleString()}
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* SEGMENT CHIPS */}
        <div className="bg-white border border-slate-200 rounded-sm p-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[13px] font-medium text-slate-500 shrink-0 inline-flex items-center gap-1 pr-1">
              <Tag className="w-3 h-3" />
              Segments:
            </span>
            <button
              onClick={() => setSegmentFilter(null)}
              className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition shrink-0 ${segmentFilter === null
                  ? 'bg-blue-950 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              All ({totalCustomers})
            </button>
            {SEGMENTS.map((s) => (
              <button
                key={s}
                onClick={() => setSegmentFilter(s)}
                className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition shrink-0 ${segmentFilter === s
                    ? 'bg-blue-950 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {s} ({segmentCounts[s]})
              </button>
            ))}
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, email, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Orders"
              value={orderCountFilter}
              options={ORDER_COUNT_OPTIONS}
              labels={{ '1': '1 order', '2-5': '2–5 orders', '5+': '5+ orders' }}
              onChange={setOrderCountFilter}
            />
            <FilterDropdown
              label="Spend"
              value={spentRangeFilter}
              options={SPENT_RANGE_OPTIONS}
              labels={SPENT_LABELS}
              onChange={setSpentRangeFilter}
            />

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* BULK */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium">{selectedIds.length} selected</span>
            <button
              onClick={() => {
                setToastMessage('Exported selected customers');
                setSelectedIds([]);
              }}
              className="bg-blue-900 hover:bg-blue-800 px-2.5 py-2 rounded-sm text-[13px] font-medium transition"
            >
              Export selected
            </button>
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
                  <th className="py-2 px-3 font-medium">Customer</th>
                  <th className="py-2 px-3 font-medium">Contact</th>
                  <th className="py-2 px-3 font-medium">Segment</th>
                  <th className="py-2 px-3 font-medium text-center">Orders</th>
                  <th className="py-2 px-3 font-medium text-right">Spent</th>
                  <th className="py-2 px-3 font-medium">Last order</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px]">
                      No customers match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelectCustomer(c.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''
                          }`}
                      >
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(c.id)}
                            className="rounded border-slate-300 text-blue-950 focus:ring-blue-950 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={c.avatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{c.name}</p>
                              <p className="text-[13px] text-slate-400 truncate">{c.location}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <p className="text-slate-600 truncate max-w-[180px]">{c.email}</p>
                          <p className="font-mono text-[13px] text-slate-400">{c.phone}</p>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${segmentBadge(
                              c.segment
                            )}`}
                          >
                            {c.segment}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700">{c.ordersCount}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {c.totalSpent.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{c.lastOrderDate}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${c.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-red-50 text-red-600 border-red-100'
                              }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectCustomer(c.id)}
                            className="p-1.5 rounded-sm bg-slate-100 hover:bg-blue-950 hover:text-white text-slate-700 transition"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
   2. DETAIL VIEW
   ══════════════════════════════════════════ */
function CustomerDetailPage({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const [customer, setCustomer] = useState<Customer>(
    () => INITIAL_CUSTOMERS.find((c) => c.id === customerId) || INITIAL_CUSTOMERS[0]
  );

  type DetailTab =
    | 'Overview'
    | 'Orders'
    | 'Wishlist & Cart'
    | 'Reviews'
    | 'Support Tickets'
    | 'Communication'
    | 'Addresses'
    | 'Notes';

  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState(
    `Hello ${customer.name}, thank you for being a valued customer.`
  );

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Important update regarding your account');
  const [emailBody, setEmailBody] = useState(
    `Dear ${customer.name},\n\nWe appreciate your continued trust in our services.`
  );

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const [newAddressTitle, setNewAddressTitle] = useState('');
  const [newAddressText, setNewAddressText] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('Nairobi');
  const [newNoteText, setNewNoteText] = useState('');

  const anyModalOpen = whatsAppOpen || emailOpen || blockConfirmOpen;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWhatsAppOpen(false);
        setEmailOpen(false);
        setBlockConfirmOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  const toggleBlock = () => {
    const next = customer.status === 'Active' ? 'Blocked' : 'Active';
    setCustomer((prev) => ({ ...prev, status: next }));
    setBlockConfirmOpen(false);
    setToastMessage(`Customer ${next.toLowerCase()}`);
  };

  const toggleMarketingConsent = () => {
    const next: MarketingConsent =
      customer.marketingConsent === 'Subscribed'
        ? 'Unsubscribed'
        : customer.marketingConsent === 'Unsubscribed'
          ? 'Pending'
          : 'Subscribed';
    setCustomer((prev) => ({ ...prev, marketingConsent: next }));
    setToastMessage(`Marketing consent: ${next}`);
  };

  const addAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressTitle.trim() || !newAddressText.trim()) return;
    setCustomer((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses,
        { id: `addr-${Date.now()}`, title: newAddressTitle, address: newAddressText, city: newAddressCity, isDefault: false },
      ],
    }));
    setNewAddressTitle('');
    setNewAddressText('');
    setToastMessage('Address added');
  };

  const deleteAddress = (id: string) => {
    setCustomer((prev) => ({ ...prev, addresses: prev.addresses.filter((a) => a.id !== id) }));
    setToastMessage('Address removed');
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setCustomer((prev) => ({
      ...prev,
      notes: [
        {
          id: `note-${Date.now()}`,
          author: 'Admin',
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          text: newNoteText.trim(),
        },
        ...prev.notes,
      ],
    }));
    setNewNoteText('');
    setToastMessage('Note added');
  };

  const segmentBadge = (s: CustomerSegment) =>
    s === 'VIP'
      ? 'bg-amber-50 text-amber-800 border-amber-100'
      : s === 'Loyal'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : s === 'New'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : s === 'At Risk'
            ? 'bg-red-50 text-red-600 border-red-100'
            : s === 'Churned'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-slate-50 text-slate-700 border-slate-200';

  const ticketStatusBadge = (s: SupportTicket['status']) =>
    s === 'Open'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : s === 'In Progress'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Resolved'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-slate-100 text-slate-600 border-slate-200';

  const priorityBadge = (p: SupportTicket['priority']) =>
    p === 'Urgent'
      ? 'bg-red-50 text-red-600 border-red-100'
      : p === 'High'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : p === 'Medium'
          ? 'bg-blue-50 text-blue-950 border-blue-100'
          : 'bg-slate-100 text-slate-600 border-slate-200';

  const channelBadge = (c: CommunicationLog['channel']) =>
    c === 'WhatsApp'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : c === 'Email'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : c === 'SMS'
          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

  const avgOrderValue =
    customer.ordersCount > 0 ? Math.round(customer.totalSpent / customer.ordersCount) : 0;

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: 'Overview', label: 'Overview' },
    { key: 'Orders', label: 'Orders', count: customer.orders.length },
    { key: 'Wishlist & Cart', label: 'Wishlist & Cart', count: customer.wishlist.length + customer.cart.length },
    { key: 'Reviews', label: 'Reviews', count: customer.reviews.length },
    { key: 'Support Tickets', label: 'Support', count: customer.supportTickets.length },
    { key: 'Communication', label: 'Communication', count: customer.communicationLog.length },
    { key: 'Addresses', label: 'Addresses', count: customer.addresses.length },
    { key: 'Notes', label: 'Notes', count: customer.notes.length },
  ];

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
              className="h-8 w-8 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <img
              src={customer.avatar}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-[15px] font-semibold text-slate-900 truncate">{customer.name}</h1>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-sm font-medium text-[13px] border ${segmentBadge(
                    customer.segment
                  )}`}
                >
                  {customer.segment}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${customer.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-red-50 text-red-600 border-red-100'
                    }`}
                >
                  {customer.status}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 font-mono truncate">
                {customer.email} · {customer.phone} · {customer.location}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setWhatsAppOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={() => setEmailOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => setBlockConfirmOpen(true)}
              className={`inline-flex items-center gap-1.5 font-medium px-3 py-2 rounded-sm text-[13px] transition border ${customer.status === 'Active'
                  ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                  : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {customer.status === 'Active' ? 'Block' : 'Unblock'}
              </span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 pb-2 flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition shrink-0 ${activeTab === tab.key ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`text-[13px] px-1.5 rounded-sm ${activeTab === tab.key ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3">

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Total orders</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">{customer.ordersCount}</p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Lifetime spend</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                    KES {customer.totalSpent.toLocaleString()}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Avg. order value</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                    KES {avgOrderValue.toLocaleString()}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500">Last order</p>
                  <p className="text-[15px] font-bold font-mono text-slate-900 mt-0.5 truncate">
                    {customer.lastOrderDate}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>
            </div>

            {/* CUSTOMER PROFILE CARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <p className="text-[13px] font-semibold text-slate-900">Customer profile</p>
                <div className="space-y-2 text-[13px] pt-2 border-t border-slate-100">
                  <div className="flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Email</p>
                      <p className="text-slate-900 truncate">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Phone</p>
                      <p className="text-slate-900 font-mono">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Location</p>
                      <p className="text-slate-900">{customer.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-500">Customer since</p>
                      <p className="text-slate-900 font-mono">{customer.dateJoined}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <p className="text-[13px] font-semibold text-slate-900">Preferences</p>
                <div className="space-y-2 text-[13px] pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Segment</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${segmentBadge(
                        customer.segment
                      )}`}
                    >
                      {customer.segment}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Top category</span>
                    <span className="font-medium text-slate-900">{customer.mostPurchasedCategory}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Preferred payment</span>
                    <span className="font-medium text-emerald-700">{customer.preferredPayment}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-500 inline-flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      Marketing
                    </span>
                    <button
                      onClick={toggleMarketingConsent}
                      className={`inline-block px-2 py-0.5 rounded-sm font-medium border transition ${customer.marketingConsent === 'Subscribed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                          : customer.marketingConsent === 'Unsubscribed'
                            ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                        }`}
                    >
                      {customer.marketingConsent}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <p className="text-[13px] font-semibold text-slate-900">Recent activity</p>
                <div className="space-y-2 text-[13px] pt-2 border-t border-slate-100">
                  {customer.communicationLog.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 border ${channelBadge(log.channel)}`}>
                        {log.channel === 'WhatsApp' && <MessageSquare className="w-3 h-3" />}
                        {log.channel === 'Email' && <Mail className="w-3 h-3" />}
                        {log.channel === 'SMS' && <Send className="w-3 h-3" />}
                        {log.channel === 'Call' && <Phone className="w-3 h-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-900 truncate">{log.subject}</p>
                        <p className="text-slate-400 font-mono">{log.date}</p>
                      </div>
                    </div>
                  ))}
                  {customer.communicationLog.length === 0 && (
                    <p className="text-[13px] text-slate-400 italic">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* RECENT ORDERS */}
            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">Recent orders</p>
                <button
                  onClick={() => setActiveTab('Orders')}
                  className="text-[13px] text-blue-950 hover:underline font-medium"
                >
                  View all
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="py-2 px-3 font-medium">Order #</th>
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium text-center">Items</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                      <th className="py-2 px-3 font-medium">Payment</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.orders.slice(0, 3).map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-medium text-blue-950">{ord.orderNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{ord.date}</td>
                        <td className="py-2 px-3 text-center text-slate-700">{ord.itemsCount}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {ord.total.toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {ord.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-blue-50 text-blue-950 border border-blue-100">
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'Orders' && (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Order history · {customer.orders.length}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium">Order #</th>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium text-center">Items</th>
                    <th className="py-2 px-3 font-medium text-right">Total</th>
                    <th className="py-2 px-3 font-medium">Payment</th>
                    <th className="py-2 px-3 font-medium">Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-medium text-blue-950">{ord.orderNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{ord.date}</td>
                      <td className="py-2 px-3 text-center text-slate-700">{ord.itemsCount}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900">
                        {ord.total.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {ord.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-sm font-medium bg-blue-50 text-blue-950 border border-blue-100">
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WISHLIST & CART */}
        {activeTab === 'Wishlist & Cart' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <p className="text-[13px] font-semibold text-slate-900">
                    Wishlist · {customer.wishlist.length}
                  </p>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {customer.wishlist.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic text-center py-6">
                    No wishlist items.
                  </p>
                ) : (
                  customer.wishlist.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center gap-2"
                    >
                      <img
                        src={item.image}
                        alt=""
                        className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-[13px] font-mono text-slate-400">
                          {item.sku} · Added {item.addedDate}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        KES {item.price.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-950" />
                  <p className="text-[13px] font-semibold text-slate-900">
                    Cart · {customer.cart.length}
                  </p>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {customer.cart.length === 0 ? (
                  <p className="text-[13px] text-slate-400 italic text-center py-6">
                    Cart is empty.
                  </p>
                ) : (
                  customer.cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center gap-2"
                    >
                      <img
                        src={item.image}
                        alt=""
                        className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-[13px] font-mono text-slate-400">
                          {item.sku} · Qty {item.qty} · Added {item.addedDate}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        KES {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVIEWS */}
        {activeTab === 'Reviews' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Product reviews · {customer.reviews.length}
              </p>
            </div>
            <div className="p-2 space-y-2">
              {customer.reviews.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic text-center py-6">
                  No reviews submitted yet.
                </p>
              ) : (
                customer.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">
                          {rev.productName}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${star <= rev.rating
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-slate-300'
                                }`}
                            />
                          ))}
                          <span className="text-[13px] text-slate-500 ml-1">
                            {rev.rating}.0
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium text-[13px] border ${rev.status === 'Published'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : rev.status === 'Pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                          {rev.status}
                        </span>
                        <span className="text-[13px] font-mono text-slate-400">{rev.date}</span>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-600">{rev.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUPPORT TICKETS */}
        {activeTab === 'Support Tickets' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Support tickets · {customer.supportTickets.length}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium">Subject</th>
                    <th className="py-2 px-3 font-medium">Priority</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Opened</th>
                    <th className="py-2 px-3 font-medium">Last update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.supportTickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-[13px]">
                        No support tickets.
                      </td>
                    </tr>
                  ) : (
                    customer.supportTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-900">{t.subject}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${priorityBadge(
                              t.priority
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${ticketStatusBadge(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{t.date}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{t.lastUpdate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMMUNICATION */}
        {activeTab === 'Communication' && (
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200">
              <p className="text-[13px] font-semibold text-slate-900">
                Communication history · {customer.communicationLog.length}
              </p>
            </div>
            <div className="p-2 space-y-2">
              {customer.communicationLog.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic text-center py-6">
                  No communication recorded.
                </p>
              ) : (
                customer.communicationLog.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-start gap-2"
                  >
                    <span
                      className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border ${channelBadge(
                        log.channel
                      )}`}
                    >
                      {log.channel === 'WhatsApp' && <MessageSquare className="w-4 h-4" />}
                      {log.channel === 'Email' && <Mail className="w-4 h-4" />}
                      {log.channel === 'SMS' && <Send className="w-4 h-4" />}
                      {log.channel === 'Call' && <Phone className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-900">{log.subject}</span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-sm font-medium text-[13px] border ${log.direction === 'Inbound'
                              ? 'bg-blue-50 text-blue-950 border-blue-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                        >
                          {log.direction}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        {log.channel} · by {log.agent}
                      </p>
                    </div>
                    <span className="text-[13px] font-mono text-slate-400 shrink-0">{log.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ADDRESSES */}
        {activeTab === 'Addresses' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {customer.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-blue-950 shrink-0" />
                        <span className="text-[13px] font-medium text-slate-900 truncate">
                          {addr.title}
                        </span>
                      </div>
                      {addr.isDefault && (
                        <span className="bg-blue-50 text-blue-950 border border-blue-100 text-[13px] font-medium px-1.5 py-0.5 rounded-sm shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-600 mt-1">{addr.address}</p>
                    <p className="text-[13px] text-slate-400 mt-0.5">{addr.city}</p>
                  </div>
                  <div className="flex justify-end gap-1 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setToastMessage('Edit address mode enabled')}
                      className="p-1.5 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteAddress(addr.id)}
                      className="p-1.5 rounded-sm bg-red-50 hover:bg-red-100 text-red-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 max-w-xl space-y-2">
              <p className="text-[13px] font-semibold text-slate-900">Add new address</p>
              <form onSubmit={addAddress} className="space-y-3 text-[13px]">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. Workspace"
                    value={newAddressTitle}
                    onChange={(e) => setNewAddressTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Street address *</label>
                  <input
                    type="text"
                    placeholder="Street, building, apartment"
                    value={newAddressText}
                    onChange={(e) => setNewAddressText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newAddressCity}
                    onChange={(e) => setNewAddressCity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newAddressTitle.trim() || !newAddressText.trim()}
                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                  >
                    Save address
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'Notes' && (
          <div className="max-w-2xl space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2 text-[13px]">
              <p className="font-semibold text-slate-900">Internal notes</p>

              {customer.notes.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {customer.notes.map((note) => (
                    <div key={note.id} className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-slate-800">{note.author}</span>
                        <span className="text-[13px] font-mono text-slate-400">{note.date}</span>
                      </div>
                      <p className="text-[13px] text-slate-600">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addNote} className="space-y-2 pt-2 border-t border-slate-100">
                <textarea
                  rows={3}
                  placeholder="Type a confidential note…"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                  >
                    Add note
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
              <p className="text-[15px] font-semibold text-slate-900">Send WhatsApp message</p>
              <button
                onClick={() => setWhatsAppOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-[13px] font-medium text-slate-500 mb-1">Live preview</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 text-slate-800">
                <p className="whitespace-pre-line">{whatsAppText}</p>
                <p className="text-[13px] text-slate-400 text-right mt-1">Just now ✓✓</p>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Message</label>
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
                onClick={() => {
                  setWhatsAppOpen(false);
                  setToastMessage('WhatsApp message sent');
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {emailOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setEmailOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-slate-900">Send email</p>
              <button
                onClick={() => setEmailOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Body</label>
              <textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEmailOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setEmailOpen(false);
                  setToastMessage('Email dispatched');
                }}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Mail className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK CONFIRM */}
      {blockConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setBlockConfirmOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-10 h-10 rounded-sm flex items-center justify-center mx-auto ${customer.status === 'Active'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-700'
                }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                {customer.status === 'Active' ? 'Block customer?' : 'Unblock customer?'}
              </h3>
              <p className="text-[13px] text-slate-500 mt-1">
                {customer.status === 'Active'
                  ? 'They will not be able to log in or place new orders.'
                  : 'Their full purchasing privileges will be restored.'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setBlockConfirmOpen(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={toggleBlock}
                className={`flex-1 font-medium py-2 rounded-sm text-[13px] text-white ${customer.status === 'Active'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   FilterDropdown
   ══════════════════════════════════════════ */
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