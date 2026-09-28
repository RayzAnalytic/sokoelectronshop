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

// ============================================================
// TYPES
// ============================================================
type ReportTab =
  | 'sales'
  | 'orders'
  | 'customers'
  | 'products'
  | 'inventory'
  | 'payments'
  | 'taxes'
  | 'shipping'
  | 'discounts'
  | 'social';

type DateRange =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'this_month'
  | 'last_month'
  | 'custom';

type ExportFormat = 'CSV' | 'PDF' | 'Excel';

interface SaleRow {
  date: string;
  revenue: number;
  orders: number;
  aov: number;
  topCategory: string;
  refunds: number;
}

interface OrderRow {
  id: string;
  date: string;
  customer: string;
  items: number;
  total: number;
  status: string;
  payment: string;
  channel: string;
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

interface InventoryRow {
  product: string;
  sku: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  status: 'In Stock' | 'Low' | 'Critical' | 'Out';
  value: number;
}

interface ShippingRow {
  carrier: string;
  shipments: number;
  delivered: number;
  inTransit: number;
  failed: number;
  avgDays: number;
  cost: number;
  onTimeRate: string;
}

interface DiscountRow {
  code: string;
  type: string;
  uses: number;
  discountGiven: number;
  revenue: number;
  roi: string;
  status: 'Active' | 'Expired' | 'Scheduled';
}

interface SocialVideoRow {
  id: string;
  title: string;
  product: string;
  sku: string;
  category: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook' | 'WhatsApp';
  videoType: 'Unboxing' | 'Review' | 'Demo' | 'Comparison' | 'Tutorial';
  published: string;
  duration: string;
  views: number;
  likes: number;
  comments: number;
  clicks: number;
  orders: number;
  revenue: number;
  conversionRate: string;
  ctr: string;
  spend: number;
  roas: string;
}

interface PlatformSummaryRow {
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook' | 'WhatsApp';
  videos: number;
  views: number;
  clicks: number;
  orders: number;
  revenue: number;
  spend: number;
  roas: string;
  convRate: string;
}

interface SocialFunnelRow {
  date: string;
  views: number;
  clicks: number;
  orders: number;
  revenue: number;
}

interface ProductVideoPerfRow {
  product: string;
  sku: string;
  category: string;
  videos: number;
  views: number;
  orders: number;
  revenue: number;
  bestPlatform: string;
  avgConvRate: string;
}

// ============================================================
// MOCK DATA — Electronics Shop
// ============================================================
const SALES_DAILY_DATA: SaleRow[] = [
  { date: 'Sep 17', revenue: 45200, orders: 32, aov: 1412, topCategory: 'Smartphones', refunds: 0 },
  { date: 'Sep 18', revenue: 58900, orders: 41, aov: 1436, topCategory: 'Laptops', refunds: 1 },
  { date: 'Sep 19', revenue: 71200, orders: 54, aov: 1318, topCategory: 'Audio', refunds: 0 },
  { date: 'Sep 20', revenue: 98400, orders: 72, aov: 1366, topCategory: 'TVs', refunds: 2 },
  { date: 'Sep 21', revenue: 64100, orders: 48, aov: 1335, topCategory: 'Accessories', refunds: 1 },
  { date: 'Sep 22', revenue: 89000, orders: 63, aov: 1412, topCategory: 'Smartphones', refunds: 0 },
  { date: 'Sep 23', revenue: 112000, orders: 85, aov: 1317, topCategory: 'Laptops', refunds: 1 },
];

const ORDERS_DATA: OrderRow[] = [
  { id: '#ORD-8942', date: 'Sep 23, 2026', customer: 'Amina Mwangi', items: 3, total: 9899, status: 'Delivered', payment: 'M-Pesa', channel: 'WhatsApp' },
  { id: '#ORD-8941', date: 'Sep 23, 2026', customer: 'Brian Kiprono', items: 1, total: 1499, status: 'Processing', payment: 'M-Pesa', channel: 'Website' },
  { id: '#ORD-8940', date: 'Sep 22, 2026', customer: 'Wanjiru Kamau', items: 2, total: 450, status: 'Shipped', payment: 'M-Pesa', channel: 'Instagram' },
  { id: '#ORD-8939', date: 'Sep 22, 2026', customer: 'Kevin Ochieng', items: 1, total: 899, status: 'Pending', payment: 'M-Pesa', channel: 'TikTok' },
  { id: '#ORD-8938', date: 'Sep 21, 2026', customer: 'Fatuma Hassan', items: 4, total: 2450, status: 'Delivered', payment: 'M-Pesa', channel: 'Website' },
  { id: '#ORD-8937', date: 'Sep 21, 2026', customer: 'David Mutua', items: 1, total: 120, status: 'Cancelled', payment: 'M-Pesa', channel: 'Facebook' },
  { id: '#ORD-8936', date: 'Sep 20, 2026', customer: 'Grace Njeri', items: 2, total: 3200, status: 'Processing', payment: 'M-Pesa', channel: 'WhatsApp' },
];

const TOP_PRODUCTS_DATA: ProductRow[] = [
  { product: 'Samsung Galaxy A55 5G', sku: 'ELEC-SAM-A55', qty: 340, revenue: 1020000, returns: 2, net: 1014000, category: 'Smartphones', lastSold: '2 mins ago' },
  { product: 'HP Pavilion 15 Core i5', sku: 'ELEC-HP-PAV15', qty: 290, revenue: 870000, returns: 1, net: 867000, category: 'Laptops', lastSold: '14 mins ago' },
  { product: 'Sony WH-1000XM5 Headphones', sku: 'ELEC-SNY-XM5', qty: 180, revenue: 1260000, returns: 4, net: 1232000, category: 'Audio', lastSold: '1 hour ago' },
  { product: 'Samsung 55" Crystal UHD TV', sku: 'ELEC-SAM-TV55', qty: 155, revenue: 465000, returns: 0, net: 465000, category: 'TVs', lastSold: '3 hours ago' },
  { product: 'Anker 20000mAh Power Bank', sku: 'ELEC-ANK-PB20', qty: 120, revenue: 360000, returns: 1, net: 357000, category: 'Accessories', lastSold: '5 hours ago' },
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

// M-Pesa only — split into two streams (STK Push vs C2B Paybill)
const PAYMENTS_DATA: PaymentRow[] = [
  { method: 'M-Pesa STK Push', transactions: 1420, volume: 4820000, fees: 67480, net: 4752520, provider: 'Safaricom', successRate: '99.2%' },
  { method: 'M-Pesa C2B Paybill', transactions: 380, volume: 1240000, fees: 22320, net: 1217680, provider: 'Safaricom', successRate: '98.7%' },
];

const PAYMENT_SHARE_PIE = [
  { name: 'M-Pesa STK Push', value: 4820000, color: '#10b981' },
  { name: 'M-Pesa C2B Paybill', value: 1240000, color: '#059669' },
];

const TAXES_DATA: TaxRow[] = [
  { period: 'September 2026 (W3)', taxableSales: 6850000, vat16: 1096000, net: 5754000, dueDate: 'Oct 20, 2026', status: 'Due' },
  { period: 'September 2026 (W2)', taxableSales: 5420000, vat16: 867200, net: 4552800, dueDate: 'Oct 20, 2026', status: 'Due' },
  { period: 'September 2026 (W1)', taxableSales: 4980000, vat16: 796800, net: 4183200, dueDate: 'Sep 20, 2026', status: 'Filed' },
  { period: 'August 2026 (Full)', taxableSales: 21400000, vat16: 3424000, net: 17976000, dueDate: 'Sep 20, 2026', status: 'Filed' },
];

const INVENTORY_DATA: InventoryRow[] = [
  { product: 'Samsung Galaxy A55 5G', sku: 'ELEC-SAM-A55', warehouse: 'Nairobi HQ', onHand: 342, reserved: 12, available: 330, reorderPoint: 100, status: 'In Stock', value: 342000 },
  { product: 'HP Pavilion 15 Core i5', sku: 'ELEC-HP-PAV15', warehouse: 'Nairobi HQ', onHand: 88, reserved: 8, available: 80, reorderPoint: 100, status: 'Low', value: 88000 },
  { product: 'Sony WH-1000XM5 Headphones', sku: 'ELEC-SNY-XM5', warehouse: 'Mombasa DC', onHand: 0, reserved: 0, available: 0, reorderPoint: 50, status: 'Out', value: 0 },
  { product: 'Samsung 55" Crystal UHD TV', sku: 'ELEC-SAM-TV55', warehouse: 'Nairobi HQ', onHand: 34, reserved: 4, available: 30, reorderPoint: 25, status: 'Low', value: 34000 },
  { product: 'Anker 20000mAh Power Bank', sku: 'ELEC-ANK-PB20', warehouse: 'Kisumu Hub', onHand: 5, reserved: 2, available: 3, reorderPoint: 40, status: 'Critical', value: 5000 },
];

const SHIPPING_DATA: ShippingRow[] = [
  { carrier: 'G4S Kenya', shipments: 820, delivered: 742, inTransit: 62, failed: 16, avgDays: 2.4, cost: 205000, onTimeRate: '94.2%' },
  { carrier: 'Sendy', shipments: 540, delivered: 498, inTransit: 38, failed: 4, avgDays: 1.8, cost: 135000, onTimeRate: '97.1%' },
  { carrier: 'Pickup Mtaani', shipments: 320, delivered: 298, inTransit: 18, failed: 4, avgDays: 1.2, cost: 48000, onTimeRate: '98.4%' },
  { carrier: 'Postal Corp', shipments: 180, delivered: 152, inTransit: 22, failed: 6, avgDays: 4.1, cost: 27000, onTimeRate: '88.3%' },
];

const DISCOUNTS_DATA: DiscountRow[] = [
  { code: 'WELCOME10', type: 'Percentage 10%', uses: 342, discountGiven: 128000, revenue: 1152000, roi: '9.0x', status: 'Active' },
  { code: 'MPESA200', type: 'Fixed KES 200', uses: 218, discountGiven: 43600, revenue: 872000, roi: '20.0x', status: 'Active' },
  { code: 'BLACKFRIDAY', type: 'Percentage 25%', uses: 189, discountGiven: 245000, revenue: 735000, roi: '3.0x', status: 'Expired' },
  { code: 'WHATSAPP15', type: 'Percentage 15%', uses: 124, discountGiven: 78000, revenue: 442000, roi: '5.7x', status: 'Active' },
  { code: 'NEWSLETTER20', type: 'Percentage 20%', uses: 62, discountGiven: 62000, revenue: 248000, roi: '4.0x', status: 'Scheduled' },
];

const SOCIAL_VIDEOS_DATA: SocialVideoRow[] = [
  {
    id: 'sv-001',
    title: 'Samsung Galaxy A55 Unboxing + First Impressions',
    product: 'Samsung Galaxy A55 5G',
    sku: 'ELEC-SAM-A55',
    category: 'Smartphones',
    platform: 'TikTok',
    videoType: 'Unboxing',
    published: 'Sep 22, 2026',
    duration: '0:48',
    views: 184000,
    likes: 12400,
    comments: 512,
    clicks: 6420,
    orders: 248,
    revenue: 992000,
    conversionRate: '3.86%',
    ctr: '3.49%',
    spend: 0,
    roas: '∞',
  },
  {
    id: 'sv-002',
    title: 'Sony WH-1000XM5 — Honest Review After 30 Days',
    product: 'Sony WH-1000XM5 Headphones',
    sku: 'ELEC-SNY-XM5',
    category: 'Audio',
    platform: 'YouTube',
    videoType: 'Review',
    published: 'Sep 20, 2026',
    duration: '14:02',
    views: 48200,
    likes: 3410,
    comments: 386,
    clicks: 4180,
    orders: 132,
    revenue: 924000,
    conversionRate: '3.16%',
    ctr: '8.67%',
    spend: 42000,
    roas: '22.0x',
  },
  {
    id: 'sv-003',
    title: 'HP Pavilion 15 vs Lenovo IdeaPad — Which to Buy?',
    product: 'HP Pavilion 15 Core i5',
    sku: 'ELEC-HP-PAV15',
    category: 'Laptops',
    platform: 'Instagram',
    videoType: 'Comparison',
    published: 'Sep 19, 2026',
    duration: '2:14',
    views: 31200,
    likes: 2210,
    comments: 274,
    clicks: 2890,
    orders: 84,
    revenue: 252000,
    conversionRate: '2.91%',
    ctr: '9.26%',
    spend: 18000,
    roas: '14.0x',
  },
  {
    id: 'sv-004',
    title: 'How to Set Up Your Samsung 55" TV in 3 Minutes',
    product: 'Samsung 55" Crystal UHD TV',
    sku: 'ELEC-SAM-TV55',
    category: 'TVs',
    platform: 'YouTube',
    videoType: 'Tutorial',
    published: 'Sep 18, 2026',
    duration: '3:12',
    views: 22400,
    likes: 1620,
    comments: 198,
    clicks: 3120,
    orders: 62,
    revenue: 186000,
    conversionRate: '1.99%',
    ctr: '13.93%',
    spend: 24000,
    roas: '7.75x',
  },
  {
    id: 'sv-005',
    title: 'Anker Power Bank 20000mAh — Real Test (Charges iPhone 8x)',
    product: 'Anker 20000mAh Power Bank',
    sku: 'ELEC-ANK-PB20',
    category: 'Accessories',
    platform: 'TikTok',
    videoType: 'Demo',
    published: 'Sep 17, 2026',
    duration: '0:38',
    views: 142000,
    likes: 9800,
    comments: 384,
    clicks: 5840,
    orders: 168,
    revenue: 504000,
    conversionRate: '2.88%',
    ctr: '4.11%',
    spend: 12000,
    roas: '42.0x',
  },
  {
    id: 'sv-006',
    title: 'WhatsApp Status: Samsung A55 Flash Sale (24hrs)',
    product: 'Samsung Galaxy A55 5G',
    sku: 'ELEC-SAM-A55',
    category: 'Smartphones',
    platform: 'WhatsApp',
    videoType: 'Demo',
    published: 'Sep 16, 2026',
    duration: '0:20',
    views: 24800,
    likes: 0,
    comments: 142,
    clicks: 2140,
    orders: 96,
    revenue: 384000,
    conversionRate: '4.49%',
    ctr: '8.63%',
    spend: 0,
    roas: '∞',
  },
  {
    id: 'sv-007',
    title: 'Facebook Ad: Sony XM5 Noise Cancelling Demo',
    product: 'Sony WH-1000XM5 Headphones',
    sku: 'ELEC-SNY-XM5',
    category: 'Audio',
    platform: 'Facebook',
    videoType: 'Demo',
    published: 'Sep 15, 2026',
    duration: '1:04',
    views: 62400,
    likes: 3120,
    comments: 218,
    clicks: 3120,
    orders: 48,
    revenue: 336000,
    conversionRate: '1.54%',
    ctr: '5.00%',
    spend: 36000,
    roas: '9.33x',
  },
  {
    id: 'sv-008',
    title: 'Anker vs Baseus Power Bank — 5-Minute Comparison',
    product: 'Anker 20000mAh Power Bank',
    sku: 'ELEC-ANK-PB20',
    category: 'Accessories',
    platform: 'Instagram',
    videoType: 'Comparison',
    published: 'Sep 14, 2026',
    duration: '5:18',
    views: 18600,
    likes: 1240,
    comments: 96,
    clicks: 1420,
    orders: 42,
    revenue: 126000,
    conversionRate: '2.96%',
    ctr: '7.63%',
    spend: 8000,
    roas: '15.75x',
  },
];

const PLATFORM_SUMMARY_DATA: PlatformSummaryRow[] = [
  { platform: 'TikTok', videos: 12, views: 326000, clicks: 12260, orders: 416, revenue: 1496000, spend: 12000, roas: '124.7x', convRate: '3.39%' },
  { platform: 'YouTube', videos: 8, views: 70600, clicks: 7300, orders: 194, revenue: 1110000, spend: 66000, roas: '16.8x', convRate: '2.66%' },
  { platform: 'Instagram', videos: 9, views: 49800, clicks: 4310, orders: 126, revenue: 378000, spend: 26000, roas: '14.5x', convRate: '2.92%' },
  { platform: 'Facebook', videos: 6, views: 62400, clicks: 3120, orders: 48, revenue: 336000, spend: 36000, roas: '9.33x', convRate: '1.54%' },
  { platform: 'WhatsApp', videos: 4, views: 24800, clicks: 2140, orders: 96, revenue: 384000, spend: 0, roas: '∞', convRate: '4.49%' },
];

const SOCIAL_FUNNEL_DATA: SocialFunnelRow[] = [
  { date: 'Sep 17', views: 142000, clicks: 5840, orders: 168, revenue: 504000 },
  { date: 'Sep 18', views: 22400, clicks: 3120, orders: 62, revenue: 186000 },
  { date: 'Sep 19', views: 31200, clicks: 2890, orders: 84, revenue: 252000 },
  { date: 'Sep 20', views: 48200, clicks: 4180, orders: 132, revenue: 924000 },
  { date: 'Sep 21', views: 18600, clicks: 1420, orders: 42, revenue: 126000 },
  { date: 'Sep 22', views: 184000, clicks: 6420, orders: 248, revenue: 992000 },
  { date: 'Sep 23', views: 62400, clicks: 3120, orders: 48, revenue: 336000 },
];

const PRODUCT_VIDEO_PERF_DATA: ProductVideoPerfRow[] = [
  { product: 'Samsung Galaxy A55 5G', sku: 'ELEC-SAM-A55', category: 'Smartphones', videos: 4, views: 208800, orders: 344, revenue: 1376000, bestPlatform: 'TikTok', avgConvRate: '3.94%' },
  { product: 'Sony WH-1000XM5 Headphones', sku: 'ELEC-SNY-XM5', category: 'Audio', videos: 3, views: 110600, orders: 180, revenue: 1260000, bestPlatform: 'YouTube', avgConvRate: '2.35%' },
  { product: 'Anker 20000mAh Power Bank', sku: 'ELEC-ANK-PB20', category: 'Accessories', videos: 3, views: 160600, orders: 210, revenue: 630000, bestPlatform: 'TikTok', avgConvRate: '2.92%' },
  { product: 'HP Pavilion 15 Core i5', sku: 'ELEC-HP-PAV15', category: 'Laptops', videos: 2, views: 31200, orders: 84, revenue: 252000, bestPlatform: 'Instagram', avgConvRate: '2.91%' },
  { product: 'Samsung 55" Crystal UHD TV', sku: 'ELEC-SAM-TV55', category: 'TVs', videos: 2, views: 22400, orders: 62, revenue: 186000, bestPlatform: 'YouTube', avgConvRate: '1.99%' },
];

// Status style maps
const TAX_STATUS_STYLES: Record<TaxRow['status'], string> = {
  Filed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Due: 'bg-amber-50 text-amber-700 border-amber-100',
  Overdue: 'bg-red-50 text-red-600 border-red-100',
};

const INVENTORY_STATUS_STYLES: Record<InventoryRow['status'], string> = {
  'In Stock': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Low: 'bg-amber-50 text-amber-700 border-amber-100',
  Critical: 'bg-orange-50 text-orange-700 border-orange-100',
  Out: 'bg-red-50 text-red-600 border-red-100',
};

const DISCOUNT_STATUS_STYLES: Record<DiscountRow['status'], string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Expired: 'bg-slate-50 text-slate-600 border-slate-200',
  Scheduled: 'bg-blue-50 text-blue-950 border-blue-100',
};

const VIDEO_TYPE_STYLES: Record<SocialVideoRow['videoType'], string> = {
  Unboxing: 'bg-blue-50 text-blue-950 border-blue-100',
  Review: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Demo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Comparison: 'bg-amber-50 text-amber-700 border-amber-100',
  Tutorial: 'bg-purple-50 text-purple-700 border-purple-100',
};

// ============================================================
// COMPONENT
// ============================================================
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  // Modals
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [selectedPieSlice, setSelectedPieSlice] = useState<typeof PAYMENT_SHARE_PIE[0] | null>(null);
  const [selectedTax, setSelectedTax] = useState<TaxRow | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<InventoryRow | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<ShippingRow | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountRow | null>(null);

  // Social modals
  const [selectedVideo, setSelectedVideo] = useState<SocialVideoRow | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformSummaryRow | null>(null);
  const [selectedFunnelDay, setSelectedFunnelDay] = useState<SocialFunnelRow | null>(null);
  const [selectedProductVideo, setSelectedProductVideo] = useState<ProductVideoPerfRow | null>(null);

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

  const DATE_OPTIONS: { id: DateRange; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 Days' },
    { id: '30days', label: 'Last 30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom', label: 'Custom Range…' },
  ];

  const TABS: { id: ReportTab; label: string; icon: any }[] = [
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

      {/* ---- ORDER MODAL ---- */}
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
                onClick={() => showToast(`Opening order ${selectedOrder.id}`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View order
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

      {/* ---- PRODUCT MODAL ---- */}
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

      {/* ---- INVENTORY MODAL ---- */}
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
                onClick={() => setSelectedInventory(null)}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- SHIPPING MODAL ---- */}
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
            <div className="flex justify-end pt-1">
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

      {/* ---- DISCOUNT MODAL ---- */}
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
            <div className="flex justify-end pt-1">
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

      {/* ---- SOCIAL: VIDEO DETAIL MODAL ---- */}
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
                onClick={() => showToast(`Opening ${selectedVideo.platform} video ${selectedVideo.id}`)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open video
              </button>
              <button
                onClick={() => showToast(`Opening product ${selectedVideo.sku}`)}
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

      {/* ---- SOCIAL: PLATFORM DETAIL MODAL ---- */}
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
            <div className="flex justify-end pt-1">
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

      {/* ---- SOCIAL: FUNNEL DAY MODAL ---- */}
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

      {/* ---- SOCIAL: PRODUCT VIDEO PERF MODAL ---- */}
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
            {/* DATE RANGE PICKER */}
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
                        onClick={() => {
                          if (opt.id === 'custom') {
                            setDateRange('custom');
                          } else {
                            setDateRange(opt.id);
                            setIsDateMenuOpen(false);
                          }
                        }}
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
                          onClick={() => {
                            if (customStart && customEnd) {
                              setIsDateMenuOpen(false);
                              showToast(`Filtered from ${customStart} to ${customEnd}`);
                            } else {
                              showToast('Please select both start and end dates');
                            }
                          }}
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

            {/* EXPORT MENU */}
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
                      <p className="text-[13px] text-slate-500">Daily transaction volume vs order counts · {dateRangeLabel}</p>
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
                          radius={[2, 2, 0, 0]}
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

            {/* ---- ORDERS ---- */}
            {activeTab === 'orders' && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Order Report · {dateRangeLabel}</span>
                  <button
                    onClick={() => handleExport('CSV')}
                    className="text-[13px] text-blue-950 hover:underline font-medium"
                  >
                    Export CSV
                  </button>
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
                      {ORDERS_DATA.map((o) => (
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
                          radius={[0, 2, 2, 0]}
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

            {/* ---- INVENTORY ---- */}
            {activeTab === 'inventory' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total SKUs', value: '482', icon: Package, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Low Stock', value: '12', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50' },
                    { label: 'Critical', value: '4', icon: AlertTriangle, color: 'text-orange-700 bg-orange-50' },
                    { label: 'Out of Stock', value: '3', icon: X, color: 'text-red-600 bg-red-50' },
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
                    <button
                      onClick={() => handleExport('Excel')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export Excel
                    </button>
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
                        {INVENTORY_DATA.map((r) => (
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

            {/* ---- PAYMENTS (M-Pesa only) ---- */}
            {activeTab === 'payments' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">M-Pesa Settlement Report</span>
                    <button
                      onClick={() => handleExport('PDF')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export PDF
                    </button>
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
                    <h3 className="text-[13px] font-semibold text-slate-900">M-Pesa Stream Split</h3>
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

            {/* ---- SHIPPING ---- */}
            {activeTab === 'shipping' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total Shipments', value: '1,860', icon: Truck, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Delivered', value: '1,690', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'In Transit', value: '140', icon: Truck, color: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Failed', value: '30', icon: X, color: 'text-red-600 bg-red-50' },
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
                    <button
                      onClick={() => handleExport('CSV')}
                      className="text-[13px] text-blue-950 hover:underline font-medium"
                    >
                      Export CSV
                    </button>
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
                        {SHIPPING_DATA.map((s) => (
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

            {/* ---- DISCOUNTS ---- */}
            {activeTab === 'discounts' && (
              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Discount Code Performance</span>
                  <button
                    onClick={() => handleExport('Excel')}
                    className="text-[13px] text-blue-950 hover:underline font-medium"
                  >
                    Export Excel
                  </button>
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
                      {DISCOUNTS_DATA.map((d) => (
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

            {/* ---- SOCIAL: PRODUCT VIDEOS ---- */}
            {activeTab === 'social' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { label: 'Videos Published', value: '39', change: '+8', up: true, icon: Video, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Total Views', value: '533,600', change: '+18.2%', up: true, icon: Eye, color: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Orders from Videos', value: '880', change: '+22.5%', up: true, icon: ShoppingCart, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Video Revenue', value: 'KES 3,696,000', change: '+26.8%', up: true, icon: CircleDollarSign, color: 'text-emerald-700 bg-emerald-50' },
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
                      <p className="text-[13px] text-slate-500">Views → Product clicks → Orders · {dateRangeLabel}</p>
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
                      <ComposedChart data={SOCIAL_FUNNEL_DATA}>
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
                          onClick={(entry: any) => setSelectedFunnelDay(entry)}
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
                    <button
                      onClick={() => handleExport('Excel')}
                      className="text-[13px] text-blue-950 hover:underline font-medium shrink-0"
                    >
                      Export Excel
                    </button>
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
                        {SOCIAL_VIDEOS_DATA.map((v) => (
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
                          {PLATFORM_SUMMARY_DATA.map((p) => (
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
                          {PRODUCT_VIDEO_PERF_DATA.map((p) => (
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
  const map: Record<string, { icon: any; color: string }> = {
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