'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  ExternalLink,
  X,
  CheckCircle2,
  ShoppingBag,
  Send,
  Download,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  RotateCcw,
  TrendingUp,
  Eye,
  AlertTriangle,
  Globe,
  Music2,
  MessageCircle,
  Target,
  UserPlus,
  Repeat,
  Heart,
  Wallet,
} from 'lucide-react';

import { FaInstagram, FaFacebook, FaFacebookF } from 'react-icons/fa';


import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// --- TYPES ---
type DateRange = '7days' | '30days' | '90days' | 'year';
type AreaMetric = 'sessions' | 'visitors' | 'pageviews';

interface AbandonedCart {
  id: string;
  customer: string;
  phone: string;
  items: string;
  value: string;
  time: string;
  date: string;
}

interface KPI {
  id: string;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  spark: number[];
  detail: string;
}

interface TopPage {
  page: string;
  views: number;
  avgTime: string;
  bounce: string;
  conversions: string;
  trend: { date: string; views: number }[];
}

interface FunnelStage {
  stage: string;
  count: number;
  dropoff: string;
  breakdown: { source: string; users: number }[];
}

interface DeviceRow {
  device: string;
  users: number;
  fill: string;
  sessions: number;
  convRate: string;
  bounce: string;
}

interface CountyRow {
  county: string;
  share: number;
  visitors: number;
  orders: number;
  revenue: string;
}

// --- NEW TYPES ---
interface SalesBreakdownRow {
  name: string;
  revenue: number;
  orders: number;
  units: number;
  growth: number;
  color?: string;
  image?: string;
}

interface CustomerMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  detail: string;
}

interface ProductPerfRow {
  id: string;
  name: string;
  sku: string;
  image: string;
  views: number;
  purchases: number;
  revenue: number;
  stock: number;
  category: string;
  conversion: string;
  status: 'best' | 'low' | 'out' | 'abandoned';
}

interface ChannelRow {
  name: string;
  share: number;
  visitors: number;
  orders: number;
  revenue: string;
  convRate: string;
  color: string;
  icon: any;
}

// --- MOCK DATA ---
const RANGE_MULTIPLIER: Record<DateRange, number> = {
  '7days': 1,
  '30days': 4.2,
  '90days': 12.5,
  year: 48,
};

const KPI_BASE: KPI[] = [
  { id: 'sessions', label: 'Sessions', value: '15,480', delta: '+14.2%', positive: true, spark: [12, 14, 18, 16, 22, 25, 29], detail: 'Total user sessions across the storefront.' },
  { id: 'visitors', label: 'Unique Visitors', value: '12,120', delta: '+11.8%', positive: true, spark: [10, 11, 15, 14, 18, 20, 24], detail: 'Distinct users identified by cookie or login.' },
  { id: 'pageviews', label: 'Page Views', value: '49,150', delta: '+19.4%', positive: true, spark: [30, 35, 42, 40, 50, 58, 65], detail: 'Total page views across all storefront pages.' },
  { id: 'bounce', label: 'Bounce Rate', value: '42.6%', delta: '-3.1%', positive: true, spark: [48, 47, 45, 46, 44, 43, 42], detail: 'Sessions that left without interacting beyond the landing page.' },
  { id: 'duration', label: 'Avg. Duration', value: '2m 18s', delta: '+12s', positive: true, spark: [2, 2.1, 2.2, 2.1, 2.3, 2.2, 2.3], detail: 'Average time spent per session on the storefront.' },
  { id: 'conversion', label: 'Conversion Rate', value: '3.45%', delta: '+0.6%', positive: true, spark: [2.5, 2.8, 3.0, 2.9, 3.2, 3.3, 3.45], detail: 'Percentage of sessions that completed a purchase.' },
];

const SESSIONS_TIMELINE = [
  { date: 'Sep 17', sessions: 1420, visitors: 1100, pageviews: 4200 },
  { date: 'Sep 18', sessions: 1680, visitors: 1350, pageviews: 5100 },
  { date: 'Sep 19', sessions: 2100, visitors: 1720, pageviews: 6800 },
  { date: 'Sep 20', sessions: 2950, visitors: 2400, pageviews: 9400 },
  { date: 'Sep 21', sessions: 1980, visitors: 1590, pageviews: 5900 },
  { date: 'Sep 22', sessions: 2450, visitors: 1980, pageviews: 7600 },
  { date: 'Sep 23', sessions: 3120, visitors: 2580, pageviews: 10200 },
];

const TRAFFIC_SOURCES = [
  { name: 'WhatsApp', value: 45, color: '#10b981', visits: 6966, orders: 312, revenue: 'KES 412,000' },
  { name: 'Organic Search', value: 25, color: '#0284c7', visits: 3870, orders: 178, revenue: 'KES 218,500' },
  { name: 'Direct', value: 15, color: '#6366f1', visits: 2322, orders: 104, revenue: 'KES 128,900' },
  { name: 'Social (TikTok/IG)', value: 10, color: '#f59e0b', visits: 1548, orders: 62, revenue: 'KES 78,300' },
  { name: 'Paid Ads', value: 5, color: '#ec4899', visits: 774, orders: 28, revenue: 'KES 34,200' },
];

const TOP_PAGES: TopPage[] = [
  {
    page: '/store/sokoflow-pro', views: 14200, avgTime: '2m 14s', bounce: '32.4%', conversions: '3.8%',
    trend: [{ date: 'Sep 17', views: 1800 }, { date: 'Sep 18', views: 2000 }, { date: 'Sep 19', views: 2200 }, { date: 'Sep 20', views: 2400 }, { date: 'Sep 21', views: 1900 }, { date: 'Sep 22', views: 2100 }, { date: 'Sep 23', views: 1800 }],
  },
  {
    page: '/store/mpesa-gateway', views: 9800, avgTime: '1m 50s', bounce: '41.1%', conversions: '4.2%',
    trend: [{ date: 'Sep 17', views: 1200 }, { date: 'Sep 18', views: 1400 }, { date: 'Sep 19', views: 1500 }, { date: 'Sep 20', views: 1600 }, { date: 'Sep 21', views: 1300 }, { date: 'Sep 22', views: 1400 }, { date: 'Sep 23', views: 1400 }],
  },
  {
    page: '/', views: 24500, avgTime: '0m 54s', bounce: '54.0%', conversions: '1.9%',
    trend: [{ date: 'Sep 17', views: 3200 }, { date: 'Sep 18', views: 3400 }, { date: 'Sep 19', views: 3600 }, { date: 'Sep 20', views: 3800 }, { date: 'Sep 21', views: 3300 }, { date: 'Sep 22', views: 3600 }, { date: 'Sep 23', views: 3600 }],
  },
  {
    page: '/store/saas-starter', views: 6400, avgTime: '3m 05s', bounce: '28.2%', conversions: '5.1%',
    trend: [{ date: 'Sep 17', views: 800 }, { date: 'Sep 18', views: 900 }, { date: 'Sep 19', views: 950 }, { date: 'Sep 20', views: 1000 }, { date: 'Sep 21', views: 850 }, { date: 'Sep 22', views: 950 }, { date: 'Sep 23', views: 950 }],
  },
  {
    page: '/checkout/stk-push', views: 3200, avgTime: '1m 12s', bounce: '18.5%', conversions: '84.0%',
    trend: [{ date: 'Sep 17', views: 400 }, { date: 'Sep 18', views: 450 }, { date: 'Sep 19', views: 480 }, { date: 'Sep 20', views: 500 }, { date: 'Sep 21', views: 450 }, { date: 'Sep 22', views: 460 }, { date: 'Sep 23', views: 460 }],
  },
];

const FUNNEL_STAGES: FunnelStage[] = [
  { stage: 'Visited Store', count: 12450, dropoff: '—', breakdown: [{ source: 'WhatsApp', users: 5600 }, { source: 'Organic', users: 3120 }, { source: 'Direct', users: 1860 }, { source: 'Social', users: 1240 }, { source: 'Paid', users: 630 }] },
  { stage: 'Product View', count: 8900, dropoff: '-28.5%', breakdown: [{ source: 'WhatsApp', users: 4010 }, { source: 'Organic', users: 2230 }, { source: 'Direct', users: 1330 }, { source: 'Social', users: 890 }, { source: 'Paid', users: 440 }] },
  { stage: 'Add to Cart', count: 2420, dropoff: '-72.8%', breakdown: [{ source: 'WhatsApp', users: 1090 }, { source: 'Organic', users: 605 }, { source: 'Direct', users: 363 }, { source: 'Social', users: 242 }, { source: 'Paid', users: 120 }] },
  { stage: 'Checkout Initiated', count: 980, dropoff: '-59.5%', breakdown: [{ source: 'WhatsApp', users: 441 }, { source: 'Organic', users: 245 }, { source: 'Direct', users: 147 }, { source: 'Social', users: 98 }, { source: 'Paid', users: 49 }] },
  { stage: 'Purchased (M-Pesa)', count: 824, dropoff: '-15.9%', breakdown: [{ source: 'WhatsApp', users: 371 }, { source: 'Organic', users: 206 }, { source: 'Direct', users: 124 }, { source: 'Social', users: 82 }, { source: 'Paid', users: 41 }] },
];

const DEVICES_DATA: DeviceRow[] = [
  { device: 'Mobile (Android/iOS)', users: 8400, fill: '#10b981', sessions: 10500, convRate: '3.8%', bounce: '40.2%' },
  { device: 'Desktop (Windows/Mac)', users: 2900, fill: '#0284c7', sessions: 3600, convRate: '3.1%', bounce: '45.8%' },
  { device: 'Tablet', users: 450, fill: '#f59e0b', sessions: 580, convRate: '2.2%', bounce: '52.1%' },
];

const KENYAN_COUNTIES: CountyRow[] = [
  { county: 'Nairobi', share: 58, visitors: 6840, orders: 320, revenue: 'KES 412,000' },
  { county: 'Mombasa', share: 18, visitors: 2120, orders: 98, revenue: 'KES 128,500' },
  { county: 'Kisumu', share: 12, visitors: 1410, orders: 64, revenue: 'KES 82,300' },
  { county: 'Nakuru', share: 7, visitors: 820, orders: 32, revenue: 'KES 41,200' },
  { county: 'Eldoret / Uasin Gishu', share: 5, visitors: 590, orders: 24, revenue: 'KES 31,800' },
];

const ABANDONED_CARTS_DATA: AbandonedCart[] = [
  { id: 'AC-901', customer: 'Brian Kipkorir', phone: '+254 712 345 678', items: 'WhatsApp Chatbot Pro License', value: 'KES 3,000', time: '14 mins ago', date: 'Sep 23' },
  { id: 'AC-902', customer: 'Brenda Akinyi', phone: '+254 722 987 654', items: 'M-Pesa STK Gateway Plugin', value: 'KES 2,900', time: '42 mins ago', date: 'Sep 23' },
  { id: 'AC-903', customer: 'Kevin Odhiambo', phone: '+254 733 112 233', items: 'Multi-Tenant SaaS Starter Kit', value: 'KES 7,000', time: '2 hours ago', date: 'Sep 22' },
  { id: 'AC-904', customer: 'Mercy Wanjiku', phone: '+254 700 554 433', items: 'Tailwind UI Kit', value: 'KES 3,000', time: '3 hours ago', date: 'Sep 22' },
  { id: 'AC-905', customer: 'Samuel Kariuki', phone: '+254 711 223 344', items: 'SokoFlow Analytics Add-on', value: 'KES 1,500', time: '5 hours ago', date: 'Sep 21' },
  { id: 'AC-906', customer: 'Faith Njeri', phone: '+254 720 998 877', items: 'M-Pesa Reconciliation Module', value: 'KES 4,200', time: '8 hours ago', date: 'Sep 21' },
];

const ABANDONED_TREND = [
  { date: 'Sep 17', carts: 24 },
  { date: 'Sep 18', carts: 19 },
  { date: 'Sep 19', carts: 31 },
  { date: 'Sep 20', carts: 28 },
  { date: 'Sep 21', carts: 15 },
  { date: 'Sep 22', carts: 22 },
  { date: 'Sep 23', carts: 18 },
];

/* ============================================================
   NEW: SALES ANALYTICS DATA
   ============================================================ */
const SALES_SUMMARY = {
  gross: 2_450_000,
  net: 2_185_400,
  refunds: 62_800,
  discounts: 201_800,
  orders: 1420,
  aov: 1542,
  revenueGrowth: 14.2,
};

const SALES_TREND = [
  { date: 'Sep 17', gross: 320000, net: 285000, refunds: 8000 },
  { date: 'Sep 18', gross: 348000, net: 310000, refunds: 9000 },
  { date: 'Sep 19', gross: 412000, net: 368000, refunds: 11000 },
  { date: 'Sep 20', gross: 485000, net: 432000, refunds: 13000 },
  { date: 'Sep 21', gross: 398000, net: 355000, refunds: 9000 },
  { date: 'Sep 22', gross: 442000, net: 394000, refunds: 8400 },
  { date: 'Sep 23', gross: 520000, net: 464000, refunds: 9200 },
];

const SALES_BY_PRODUCT: SalesBreakdownRow[] = [
  { name: 'WhatsApp Chatbot Pro License', revenue: 480000, orders: 160, units: 160, growth: 18.2, image: '/phone.jpeg' },
  { name: 'M-Pesa STK Gateway Plugin', revenue: 385000, orders: 133, units: 133, growth: 12.4, image: '/phone.jpeg' },
  { name: 'Multi-Tenant SaaS Starter Kit', revenue: 320000, orders: 46, units: 46, growth: 22.1, image: '/Lenovo.jpeg' },
  { name: 'Tailwind UI Kit — Pro', revenue: 248000, orders: 83, units: 83, growth: -3.2, image: '/phone.jpeg' },
  { name: 'SokoFlow Analytics Add-on', revenue: 185000, orders: 123, units: 123, growth: 8.9, image: '/Lenovo.jpeg' },
];

const SALES_BY_CATEGORY: SalesBreakdownRow[] = [
  { name: 'WhatsApp & Chatbots', revenue: 680000, orders: 226, units: 226, growth: 16.4, color: '#10b981' },
  { name: 'Payments & Checkout', revenue: 520000, orders: 198, units: 198, growth: 11.2, color: '#0284c7' },
  { name: 'SaaS Templates', revenue: 445000, orders: 89, units: 89, growth: 20.8, color: '#6366f1' },
  { name: 'UI Kits', revenue: 320000, orders: 108, units: 108, growth: -2.4, color: '#f59e0b' },
  { name: 'Analytics Add-ons', revenue: 220000, orders: 147, units: 147, growth: 7.6, color: '#ec4899' },
];

const SALES_BY_BRAND: SalesBreakdownRow[] = [
  { name: 'SokoFlow', revenue: 985000, orders: 328, units: 328, growth: 18.2, color: '#172554' },
  { name: 'M-Pesa Labs', revenue: 620000, orders: 214, units: 214, growth: 9.8, color: '#10b981' },
  { name: 'TailwindForge', revenue: 410000, orders: 138, units: 138, growth: 4.2, color: '#0284c7' },
  { name: 'AfriStack', revenue: 290000, orders: 96, units: 96, growth: 12.5, color: '#f59e0b' },
  { name: 'Nairobi UI', revenue: 175000, orders: 58, units: 58, growth: -1.8, color: '#ec4899' },
];

/* ============================================================
   NEW: CUSTOMER ANALYTICS DATA
   ============================================================ */
const CUSTOMER_METRICS: CustomerMetric[] = [
  { id: 'new', label: 'New Customers', value: '842', delta: '+18.4%', positive: true, detail: 'First-time buyers this period.' },
  { id: 'returning', label: 'Returning Customers', value: '578', delta: '+9.2%', positive: true, detail: 'Customers with 2+ purchases.' },
  { id: 'retention', label: 'Retention Rate', value: '68.4%', delta: '+2.1%', positive: true, detail: 'Customers who purchased again within 90 days.' },
  { id: 'ltv', label: 'Customer LTV', value: 'KES 18,400', delta: '+6.8%', positive: true, detail: 'Average lifetime value per customer.' },
  { id: 'aov', label: 'Avg. Spend / Order', value: 'KES 1,542', delta: '+3.4%', positive: true, detail: 'Average order value across all customers.' },
  { id: 'acq', label: 'Acquisition Cost', value: 'KES 380', delta: '-4.1%', positive: true, detail: 'Blended cost to acquire one customer.' },
];

const NEW_VS_RETURNING = [
  { date: 'Sep 17', new: 82, returning: 54 },
  { date: 'Sep 18', new: 96, returning: 62 },
  { date: 'Sep 19', new: 124, returning: 78 },
  { date: 'Sep 20', new: 152, returning: 96 },
  { date: 'Sep 21', new: 108, returning: 72 },
  { date: 'Sep 22', new: 138, returning: 86 },
  { date: 'Sep 23', new: 142, returning: 130 },
];

const TOP_CUSTOMERS = [
  { id: 'c1', name: 'Amina Mwangi', email: 'amina@example.com', orders: 24, spent: 184500, avatar: 'AM', tier: 'VIP' },
  { id: 'c2', name: 'Brian Kiprono', email: 'brian@example.com', orders: 18, spent: 132400, avatar: 'BK', tier: 'Gold' },
  { id: 'c3', name: 'Kevin Ochieng', email: 'kevin@example.com', orders: 15, spent: 98700, avatar: 'KO', tier: 'Gold' },
  { id: 'c4', name: 'Fatuma Hassan', email: 'fatuma@example.com', orders: 12, spent: 75200, avatar: 'FH', tier: 'Silver' },
  { id: 'c5', name: 'Wanjiru Kamau', email: 'wanjiru@example.com', orders: 9, spent: 48900, avatar: 'WK', tier: 'Silver' },
];

/* ============================================================
   NEW: PRODUCT ANALYTICS DATA
   ============================================================ */
const PRODUCT_PERF: ProductPerfRow[] = [
  { id: 'p1', name: 'WhatsApp Chatbot Pro License', sku: 'WCP-PRO', image: '/phone.jpeg', views: 14200, purchases: 160, revenue: 480000, stock: 999, category: 'WhatsApp & Chatbots', conversion: '1.13%', status: 'best' },
  { id: 'p2', name: 'M-Pesa STK Gateway Plugin', sku: 'MPESA-STK', image: '/phone.jpeg', views: 9800, purchases: 133, revenue: 385000, stock: 999, category: 'Payments & Checkout', conversion: '1.36%', status: 'best' },
  { id: 'p3', name: 'Multi-Tenant SaaS Starter Kit', sku: 'SAAS-MT', image: '/Lenovo.jpeg', views: 6400, purchases: 46, revenue: 320000, stock: 999, category: 'SaaS Templates', conversion: '0.72%', status: 'best' },
  { id: 'p4', name: 'Tailwind UI Kit — Pro', sku: 'TW-PRO', image: '/phone.jpeg', views: 18200, purchases: 83, revenue: 248000, stock: 999, category: 'UI Kits', conversion: '0.46%', status: 'low' },
  { id: 'p5', name: 'SokoFlow Analytics Add-on', sku: 'SFA-ADD', image: '/Lenovo.jpeg', views: 4200, purchases: 123, revenue: 185000, stock: 999, category: 'Analytics Add-ons', conversion: '2.93%', status: 'best' },
  { id: 'p6', name: 'Legacy SMS Gateway', sku: 'SMS-OLD', image: '/phone.jpeg', views: 2100, purchases: 4, revenue: 12000, stock: 0, category: 'Payments & Checkout', conversion: '0.19%', status: 'out' },
  { id: 'p7', name: 'Old Landing Page Template', sku: 'LP-OLD', image: '/Lenovo.jpeg', views: 3400, purchases: 2, revenue: 4000, stock: 999, category: 'UI Kits', conversion: '0.06%', status: 'abandoned' },
  { id: 'p8', name: 'Basic Invoice Generator', sku: 'INV-BSC', image: '/phone.jpeg', views: 5600, purchases: 6, revenue: 18000, stock: 999, category: 'Analytics Add-ons', conversion: '0.11%', status: 'abandoned' },
];

/* ============================================================
   NEW: CHANNEL ANALYTICS DATA
   ============================================================ */
const CHANNEL_DATA: ChannelRow[] = [
  { name: 'Website', share: 42, visitors: 5120, orders: 312, revenue: 'KES 620,000', convRate: '6.1%', color: '#172554', icon: Globe },
  { name: 'WhatsApp', share: 21, visitors: 2560, orders: 248, revenue: 'KES 412,000', convRate: '9.7%', color: '#10b981', icon: MessageCircle },
  { name: 'Instagram', share: 17, visitors: 2070, orders: 132, revenue: 'KES 218,500', convRate: '6.4%', color: '#ec4899', icon: FaInstagram },
  { name: 'Facebook', share: 10, visitors: 1220, orders: 84, revenue: 'KES 128,900', convRate: '6.9%', color: '#0284c7', icon: FaFacebook },
  { name: 'TikTok', share: 7, visitors: 850, orders: 62, revenue: 'KES 78,300', convRate: '7.3%', color: '#f59e0b', icon: Music2 },
  { name: 'Other', share: 3, visitors: 365, orders: 18, revenue: 'KES 34,200', convRate: '4.9%', color: '#6366f1', icon: Target },
];

const CHANNEL_TREND = [
  { date: 'Sep 17', whatsapp: 280, instagram: 190, facebook: 110, tiktok: 62, website: 480 },
  { date: 'Sep 18', whatsapp: 310, instagram: 210, facebook: 118, tiktok: 70, website: 520 },
  { date: 'Sep 19', whatsapp: 342, instagram: 240, facebook: 128, tiktok: 78, website: 580 },
  { date: 'Sep 20', whatsapp: 398, instagram: 272, facebook: 142, tiktok: 88, website: 640 },
  { date: 'Sep 21', whatsapp: 322, instagram: 224, facebook: 120, tiktok: 72, website: 560 },
  { date: 'Sep 22', whatsapp: 368, instagram: 252, facebook: 134, tiktok: 82, website: 600 },
  { date: 'Sep 23', whatsapp: 412, instagram: 288, facebook: 148, tiktok: 92, website: 680 },
];

const SOCIAL_ACTIVITY = [
  { platform: 'WhatsApp Business', metric: 'Conversations Started', value: '1,284', delta: '+18.4%', positive: true, color: '#10b981' },
  { platform: 'Instagram', metric: 'Profile Visits', value: '4,820', delta: '+12.1%', positive: true, color: '#ec4899' },
  { platform: 'TikTok', metric: 'Video Views', value: '48,200', delta: '+34.6%', positive: true, color: '#f59e0b' },
  { platform: 'Facebook', metric: 'Page Reach', value: '12,400', delta: '-2.4%', positive: false, color: '#0284c7' },
];

// --- HELPERS ---
const formatKES = (val: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);

const PRODUCT_STATUS_STYLES: Record<ProductPerfRow['status'], string> = {
  best: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  low: 'bg-amber-50 text-amber-700 border-amber-100',
  out: 'bg-red-50 text-red-600 border-red-100',
  abandoned: 'bg-slate-50 text-slate-600 border-slate-200',
};

const PRODUCT_STATUS_LABELS: Record<ProductPerfRow['status'], string> = {
  best: 'Best Seller',
  low: 'Low Performer',
  out: 'Out of Stock',
  abandoned: 'Abandoned',
};

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [comparePrevious, setComparePrevious] = useState(true);
  const [areaMetric, setAreaMetric] = useState<AreaMetric>('sessions');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Section tab state
  const [activeTab, setActiveTab] = useState<'traffic' | 'sales' | 'customers' | 'products' | 'channels'>('traffic');

  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [selectedSource, setSelectedSource] = useState<typeof TRAFFIC_SOURCES[0] | null>(null);
  const [selectedPage, setSelectedPage] = useState<TopPage | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<CountyRow | null>(null);
  const [selectedCartDay, setSelectedCartDay] = useState<string | null>(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // New modal states
  const [selectedSalesRow, setSelectedSalesRow] = useState<SalesBreakdownRow | null>(null);
  const [selectedCustomerMetric, setSelectedCustomerMetric] = useState<CustomerMetric | null>(null);
  const [selectedProductPerf, setSelectedProductPerf] = useState<ProductPerfRow | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelRow | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const kpis: KPI[] = useMemo(() => {
    const mult = RANGE_MULTIPLIER[dateRange];
    return KPI_BASE.map((k) => {
      if (k.id === 'bounce' || k.id === 'duration' || k.id === 'conversion') return k;
      const numeric = Number(k.value.replace(/[^0-9.]/g, ''));
      const scaled = Math.round(numeric * mult);
      return { ...k, value: scaled.toLocaleString() };
    });
  }, [dateRange]);

  const handleSendReminder = (cart: AbandonedCart) => {
    showToast(`WhatsApp reminder sent to ${cart.customer} (${cart.phone})`);
  };

  const filteredCarts = selectedCartDay
    ? ABANDONED_CARTS_DATA.filter((c) => c.date === selectedCartDay)
    : ABANDONED_CARTS_DATA;

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

      {/* ============ KPI MODAL ============ */}
      {selectedKpi && (
        <Modal onClose={() => setSelectedKpi(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedKpi.label}</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedKpi.value}</h3>
              <p className="text-[13px] text-slate-500 mt-1">{selectedKpi.detail}</p>
            </div>

            <div className="h-40 bg-white border border-slate-200 rounded-sm p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedKpi.spark.map((v, i) => ({ date: SESSIONS_TIMELINE[i]?.date ?? `D${i + 1}`, value: v }))}>
                  <defs>
                    <linearGradient id="kpiFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#172554" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                  <YAxis stroke="#172554" fontSize={13} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#172554" strokeWidth={2} fill="url(#kpiFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Change vs previous</span>
                <span className={`font-medium ${selectedKpi.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedKpi.delta}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Date range</span>
                <span className="font-medium text-slate-900">{dateRange}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Comparison</span>
                <span className="font-medium text-slate-900">{comparePrevious ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ SOURCE MODAL ============ */}
      {selectedSource && (
        <Modal onClose={() => setSelectedSource(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedSource.color }} />
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">{selectedSource.name}</h3>
                <p className="text-[13px] text-slate-500">{selectedSource.value}% of all traffic</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Visits" value={selectedSource.visits.toLocaleString()} />
              <Stat label="Orders" value={selectedSource.orders.toString()} />
              <Stat label="Revenue" value={selectedSource.revenue} />
            </div>

            <div className="h-32 bg-white border border-slate-200 rounded-sm p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SESSIONS_TIMELINE.map((s) => ({ date: s.date, visits: Math.round((selectedSource.visits / 7) * 0.9) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                  <YAxis stroke="#172554" fontSize={13} />
                  <Tooltip />
                  <Line type="monotone" dataKey="visits" stroke={selectedSource.color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ TOP PAGE DRAWER ============ */}
      {selectedPage && (
        <Drawer onClose={() => setSelectedPage(null)}>
          <div className="space-y-3 text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Page Analytics</p>
                <h3 className="text-[13px] font-mono font-bold text-slate-900 mt-0.5 break-all">{selectedPage.page}</h3>
              </div>
              <button
                onClick={() => setSelectedPage(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-40 bg-white border border-slate-200 rounded-sm p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedPage.trend}>
                  <defs>
                    <linearGradient id="pageFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#172554" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                  <YAxis stroke="#172554" fontSize={13} />
                  <Tooltip />
                  <Area type="monotone" dataKey="views" stroke="#172554" strokeWidth={2} fill="url(#pageFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Total views</span>
                <span className="font-medium text-slate-900">{selectedPage.views.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Avg. time on page</span>
                <span className="font-medium text-slate-900">{selectedPage.avgTime}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Bounce rate</span>
                <span className="font-medium text-slate-900">{selectedPage.bounce}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Conversion rate</span>
                <span className="font-medium text-emerald-600">{selectedPage.conversions}</span>
              </div>
            </div>

            <button
              onClick={() => showToast(`Opening live preview of ${selectedPage.page}`)}
              className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px]"
            >
              Open live page
            </button>
          </div>
        </Drawer>
      )}

      {/* ============ FUNNEL STAGE MODAL ============ */}
      {selectedStage && (
        <Modal onClose={() => setSelectedStage(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">Funnel Stage</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedStage.stage}</h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {selectedStage.count.toLocaleString()} users reached this stage
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wide">By source</p>
              {selectedStage.breakdown.map((b) => {
                const pct = Math.round((b.users / selectedStage.count) * 100);
                return (
                  <div key={b.source} className="space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-slate-700">{b.source}</span>
                      <span className="font-mono text-slate-600">{b.users.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-sm overflow-hidden">
                      <div className="bg-blue-950 h-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ============ DEVICE MODAL ============ */}
      {selectedDevice && (
        <Modal onClose={() => setSelectedDevice(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${selectedDevice.fill}20`, color: selectedDevice.fill }}>
                {selectedDevice.device.startsWith('Mobile') ? <Smartphone className="w-4 h-4" /> :
                  selectedDevice.device.startsWith('Desktop') ? <Monitor className="w-4 h-4" /> :
                    <Tablet className="w-4 h-4" />}
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">{selectedDevice.device}</h3>
                <p className="text-[13px] text-slate-500">{selectedDevice.users.toLocaleString()} users</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Sessions" value={selectedDevice.sessions.toLocaleString()} />
              <Stat label="Conv. rate" value={selectedDevice.convRate} />
              <Stat label="Bounce" value={selectedDevice.bounce} />
            </div>
          </div>
        </Modal>
      )}

      {/* ============ COUNTY MODAL ============ */}
      {selectedCounty && (
        <Modal onClose={() => setSelectedCounty(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">{selectedCounty.county}</h3>
                <p className="text-[13px] text-slate-500">{selectedCounty.share}% of all visitors</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Visitors" value={selectedCounty.visitors.toLocaleString()} />
              <Stat label="Orders" value={selectedCounty.orders.toString()} />
              <Stat label="Revenue" value={selectedCounty.revenue} />
            </div>
          </div>
        </Modal>
      )}

      {/* ============ SALES ROW MODAL ============ */}
      {selectedSalesRow && (
        <Modal onClose={() => setSelectedSalesRow(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {selectedSalesRow.image ? (
                <img src={selectedSalesRow.image} alt={selectedSalesRow.name} className="w-10 h-10 rounded-sm object-cover border border-slate-200" />
              ) : (
                <span className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${selectedSalesRow.color}20`, color: selectedSalesRow.color }}>
                  <Package className="w-4 h-4" />
                </span>
              )}
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">{selectedSalesRow.name}</h3>
                <p className="text-[13px] text-slate-500">{formatKES(selectedSalesRow.revenue)} revenue</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Orders" value={selectedSalesRow.orders.toString()} />
              <Stat label="Units" value={selectedSalesRow.units.toString()} />
              <Stat label="Growth" value={`${selectedSalesRow.growth > 0 ? '+' : ''}${selectedSalesRow.growth}%`} />
            </div>
          </div>
        </Modal>
      )}

      {/* ============ CUSTOMER METRIC MODAL ============ */}
      {selectedCustomerMetric && (
        <Modal onClose={() => setSelectedCustomerMetric(null)}>
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedCustomerMetric.label}</p>
              <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedCustomerMetric.value}</h3>
              <p className="text-[13px] text-slate-500 mt-1">{selectedCustomerMetric.detail}</p>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 text-[13px]">
              <span className="text-slate-500">Change vs previous</span>
              <span className={`font-medium ${selectedCustomerMetric.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                {selectedCustomerMetric.delta}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ PRODUCT PERF DRAWER ============ */}
      {selectedProductPerf && (
        <Drawer onClose={() => setSelectedProductPerf(null)}>
          <div className="space-y-3 text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-blue-950 uppercase tracking-wide">{selectedProductPerf.category}</p>
                <h3 className="text-[15px] font-bold text-slate-900 mt-0.5">{selectedProductPerf.name}</h3>
                <p className="text-[13px] text-slate-500 font-mono mt-0.5">SKU: {selectedProductPerf.sku}</p>
              </div>
              <button
                onClick={() => setSelectedProductPerf(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="w-full h-40 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden">
              <img src={selectedProductPerf.image} alt={selectedProductPerf.name} className="w-full h-full object-cover" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Views" value={selectedProductPerf.views.toLocaleString()} />
              <Stat label="Purchases" value={selectedProductPerf.purchases.toString()} />
              <Stat label="Revenue" value={formatKES(selectedProductPerf.revenue)} />
              <Stat label="Conversion" value={selectedProductPerf.conversion} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Stock</span>
                <span className={`font-semibold ${selectedProductPerf.stock === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {selectedProductPerf.stock === 0 ? 'Out of stock' : `${selectedProductPerf.stock} units`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${PRODUCT_STATUS_STYLES[selectedProductPerf.status]}`}>
                  {PRODUCT_STATUS_LABELS[selectedProductPerf.status]}
                </span>
              </div>
            </div>

            <button
              onClick={() => showToast(`Opening ${selectedProductPerf.name} in Products`)}
              className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px]"
            >
              View in Products
            </button>
          </div>
        </Drawer>
      )}

      {/* ============ CHANNEL MODAL ============ */}
      {selectedChannel && (
        <Modal onClose={() => setSelectedChannel(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${selectedChannel.color}20`, color: selectedChannel.color }}>
                <selectedChannel.icon className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">{selectedChannel.name}</h3>
                <p className="text-[13px] text-slate-500">{selectedChannel.share}% of all channel traffic</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Visitors" value={selectedChannel.visitors.toLocaleString()} />
              <Stat label="Orders" value={selectedChannel.orders.toString()} />
              <Stat label="Revenue" value={selectedChannel.revenue} />
              <Stat label="Conv. rate" value={selectedChannel.convRate} />
            </div>
          </div>
        </Modal>
      )}

      {/* ============ ABANDONED CARTS MODAL ============ */}
      {cartModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white border border-slate-200 rounded-sm max-w-2xl w-full p-3 shadow-xl space-y-3 text-[13px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Abandoned Cart Recovery</h3>
                  <p className="text-slate-500 text-[13px]">
                    {selectedCartDay ? `Showing carts from ${selectedCartDay}` : 'Instantly ping leads via WhatsApp Cloud API'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setCartModalOpen(false); setSelectedCartDay(null); }}
                className="w-8 h-8 rounded-sm bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCarts.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No carts for this day.</p>
              ) : (
                filteredCarts.map((cart) => (
                  <div key={cart.id} className="p-2 bg-slate-50 border border-slate-200 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{cart.customer}</span>
                        <span className="text-[13px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-sm font-mono">{cart.phone}</span>
                      </div>
                      <div className="text-slate-600">
                        {cart.items} • <span className="font-medium text-emerald-600">{cart.value}</span>
                      </div>
                      <div className="text-[13px] text-slate-400">Abandoned {cart.time} ({cart.date})</div>
                    </div>

                    <button
                      onClick={() => handleSendReminder(cart)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-sm transition shrink-0 text-[13px]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send WhatsApp</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setCartModalOpen(false); setSelectedCartDay(null); }}
                className="px-3 py-2 bg-slate-900 text-white font-medium rounded-sm hover:bg-slate-800 transition text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAGE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Analytics</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Deep dive into traffic, sales, customers, products, and channels</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-sm px-2 py-2 text-[13px] font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={comparePrevious}
                onChange={(e) => setComparePrevious(e.target.checked)}
                className="accent-blue-950"
              />
              <span>Compare previous</span>
            </label>

            <div className="bg-white border border-slate-200 rounded-sm px-2 py-2 flex items-center gap-2 text-[13px] font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-blue-950" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="bg-transparent border-none focus:outline-none cursor-pointer text-[13px]"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="year">Year to Date</option>
              </select>
            </div>

            <button
              onClick={() => showToast('Exporting analytics report as CSV…')}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white text-[13px] font-medium px-3 py-2 rounded-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* SECTION TABS */}
        <div className="max-w-[1600px] mx-auto px-3 pb-2">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-sm border border-slate-200 overflow-x-auto max-w-full">
            {[
              { id: 'traffic', label: 'Traffic' },
              { id: 'sales', label: 'Sales' },
              { id: 'customers', label: 'Customers' },
              { id: 'products', label: 'Products' },
              { id: 'channels', label: 'Channels' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* ================================================= */}
        {/* TAB: TRAFFIC (existing content) */}
        {/* ================================================= */}
        {activeTab === 'traffic' && (
          <>
            {/* ROW 1: KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              {kpis.map((kpi) => (
                <button
                  key={kpi.id}
                  onClick={() => setSelectedKpi(kpi)}
                  className="text-left bg-white border border-slate-200 rounded-sm p-2 space-y-2 hover:border-blue-950 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-500 truncate">{kpi.label}</span>
                    <span className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm shrink-0 ${kpi.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                      {kpi.positive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                      {kpi.delta}
                    </span>
                  </div>
                  <div className="text-[15px] font-bold text-slate-900">{kpi.value}</div>
                  {comparePrevious && (
                    <div className="text-[13px] text-slate-400">vs prev. period</div>
                  )}
                </button>
              ))}
            </div>

            {/* ROW 2: TRAFFIC + SOURCES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Traffic Overview</h3>
                    <p className="text-[13px] text-slate-500">Real-time engagement over selected range</p>
                  </div>

                  <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-sm">
                    {(['sessions', 'visitors', 'pageviews'] as AreaMetric[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setAreaMetric(m)}
                        className={`px-2.5 py-2 rounded-sm text-[13px] font-medium transition capitalize ${areaMetric === m ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-64 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SESSIONS_TIMELINE}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#172554" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                      <YAxis stroke="#172554" fontSize={13} />
                      <Tooltip />
                      <Area type="monotone" dataKey={areaMetric} stroke="#172554" strokeWidth={2} fillOpacity={1} fill="url(#colorMetric)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Traffic Sources</h3>
                  <p className="text-[13px] text-slate-500">Click a slice for details</p>
                </div>

                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={TRAFFIC_SOURCES}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(entry: any) => setSelectedSource(entry)}
                        className="cursor-pointer"
                      >
                        {TRAFFIC_SOURCES.map((entry, index) => (
                          <Cell key={index} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-0.5 text-[13px]">
                  {TRAFFIC_SOURCES.map((src) => (
                    <button
                      key={src.name}
                      onClick={() => setSelectedSource(src)}
                      className="w-full flex items-center justify-between hover:bg-slate-50 rounded-sm px-2 py-2 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: src.color }} />
                        <span className="text-slate-700 truncate">{src.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">{src.value}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 3: TOP PAGES */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-700">Top Performing Pages</span>
                <span className="text-[13px] text-blue-950 font-medium">Click a row</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Page</th>
                      <th className="py-2 px-3 font-medium">Views</th>
                      <th className="py-2 px-3 font-medium">Avg. Time</th>
                      <th className="py-2 px-3 font-medium">Bounce</th>
                      <th className="py-2 px-3 font-medium text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {TOP_PAGES.map((row) => (
                      <tr
                        key={row.page}
                        onClick={() => setSelectedPage(row)}
                        className="hover:bg-slate-50 cursor-pointer transition"
                      >
                        <td className="py-2 px-3 font-mono font-medium text-blue-950 flex items-center gap-1.5">
                          <span>{row.page}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{row.views.toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{row.avgTime}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{row.bounce}</td>
                        <td className="py-2 px-3 font-mono font-medium text-emerald-600 text-right">{row.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 4: FUNNEL */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">Conversion Funnel</h3>
                <p className="text-[13px] text-slate-500">Click a stage for source breakdown</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {FUNNEL_STAGES.map((stage, idx) => (
                  <button
                    key={stage.stage}
                    onClick={() => setSelectedStage(stage)}
                    className="text-left bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1 hover:border-blue-950 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="text-[13px] text-slate-400">Step {idx + 1}</div>
                    <div className="font-medium text-slate-900 text-[13px]">{stage.stage}</div>
                    <div className="text-[15px] font-bold text-blue-950">{stage.count.toLocaleString()}</div>
                    <div className="text-[13px] text-red-600 bg-red-50 px-2 py-0.5 rounded-sm inline-block">
                      {stage.dropoff}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ROW 5: DEVICES + LOCATIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Device Breakdown</h3>
                  <p className="text-[13px] text-slate-500">Click a bar for stats</p>
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DEVICES_DATA} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                      <YAxis dataKey="device" type="category" width={140} stroke="#172554" fontSize={13} />
                      <Tooltip />
                      <Bar dataKey="users" radius={[0, 4, 4, 0]} barSize={20} onClick={(entry: any) => setSelectedDevice(entry)} className="cursor-pointer">
                        {DEVICES_DATA.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-0.5">
                  {DEVICES_DATA.map((d) => (
                    <button
                      key={d.device}
                      onClick={() => setSelectedDevice(d)}
                      className="w-full flex items-center justify-between hover:bg-slate-50 rounded-sm px-2 py-2 text-[13px] transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-slate-700 truncate">{d.device}</span>
                      </div>
                      <span className="font-medium text-slate-900">{d.users.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Top Locations</h3>
                  <p className="text-[13px] text-slate-500">Click a county for order details</p>
                </div>

                <div className="space-y-3 pt-1">
                  {KENYAN_COUNTIES.map((loc) => (
                    <button
                      key={loc.county}
                      onClick={() => setSelectedCounty(loc)}
                      className="w-full space-y-1 text-[13px] text-left hover:bg-slate-50 rounded-sm px-2 py-2 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{loc.county}</span>
                        <span className="font-mono text-slate-600">{loc.visitors.toLocaleString()} ({loc.share}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-sm overflow-hidden">
                        <div className="bg-blue-950 h-full rounded-sm" style={{ width: `${loc.share}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 6: CART ABANDONMENT */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-[13px] font-medium text-red-600">Cart Abandonment Rate</div>
                  <div className="text-[15px] font-bold text-slate-900">28.4%</div>
                  <p className="text-[13px] text-slate-500">
                    Potential lost: <span className="font-medium text-slate-800 font-mono">KES 142,500</span>
                  </p>
                </div>

                <button
                  onClick={() => { setSelectedCartDay(null); setCartModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-sm transition text-[13px]"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Recover ({ABANDONED_CARTS_DATA.length})</span>
                </button>
              </div>

              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ABANDONED_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                    <YAxis stroke="#f43f5e" fontSize={13} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="carts"
                      name="Abandoned Carts"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={(props: any) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="#f43f5e"
                            stroke="#fff"
                            strokeWidth={2}
                            className="cursor-pointer"
                            onClick={() => { setSelectedCartDay(payload.date); setCartModalOpen(true); }}
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[13px] text-slate-400 text-center">Click a point to view that day's carts</p>
            </div>
          </>
        )}

        {/* ================================================= */}
        {/* TAB: SALES ANALYTICS */}
        {/* ================================================= */}
        {activeTab === 'sales' && (
          <>
            {/* SALES SUMMARY KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'Gross Sales', value: formatKES(SALES_SUMMARY.gross), delta: '+14.2%', positive: true, icon: DollarSign },
                { label: 'Net Sales', value: formatKES(SALES_SUMMARY.net), delta: '+12.8%', positive: true, icon: Wallet },
                { label: 'Refunds', value: formatKES(SALES_SUMMARY.refunds), delta: '+3.1%', positive: false, icon: RotateCcw },
                { label: 'Orders', value: SALES_SUMMARY.orders.toLocaleString(), delta: '+8.1%', positive: true, icon: ShoppingCart },
                { label: 'Avg. Order Value', value: formatKES(SALES_SUMMARY.aov), delta: '+3.4%', positive: true, icon: TrendingUp },
                { label: 'Revenue Growth', value: `${SALES_SUMMARY.revenueGrowth}%`, delta: '+1.2%', positive: true, icon: ArrowUpRight },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <s.icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                    </div>
                  </div>
                  <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                  <span className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm ${s.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                    {s.positive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {s.delta}
                  </span>
                </div>
              ))}
            </div>

            {/* SALES TREND CHART */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">Sales Trend — Gross vs Net</h3>
                <p className="text-[13px] text-slate-500">Daily revenue after refunds and discounts</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={SALES_TREND}>
                    <defs>
                      <linearGradient id="fillGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#172554" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                    <YAxis stroke="#172554" fontSize={13} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v: any) => formatKES(Number(v))} />
                    <Area type="monotone" dataKey="gross" stroke="#172554" strokeWidth={2} fill="url(#fillGross)" />
                    <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} fill="url(#fillNet)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 text-[13px] text-slate-600 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-950" />Gross</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Net</span>
              </div>
            </div>

            {/* BREAKDOWNS: Product / Category / Brand */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {[
                { title: 'Sales by Product', data: SALES_BY_PRODUCT },
                { title: 'Sales by Category', data: SALES_BY_CATEGORY },
                { title: 'Sales by Brand', data: SALES_BY_BRAND },
              ].map((block) => (
                <div key={block.title} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">{block.title}</h3>
                    <p className="text-[13px] text-slate-500">Click any row for details</p>
                  </div>
                  <div className="space-y-1">
                    {block.data.map((row) => (
                      <button
                        key={row.name}
                        onClick={() => setSelectedSalesRow(row)}
                        className="w-full text-left hover:bg-slate-50 rounded-sm px-2 py-2 transition"
                      >
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="font-medium text-slate-800 truncate">{row.name}</span>
                          <span className="font-mono font-semibold text-slate-900 shrink-0">{formatKES(row.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[13px] text-slate-500 mt-0.5">
                          <span>{row.orders} orders · {row.units} units</span>
                          <span className={row.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {row.growth >= 0 ? '+' : ''}{row.growth}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ================================================= */}
        {/* TAB: CUSTOMER ANALYTICS */}
        {/* ================================================= */}
        {activeTab === 'customers' && (
          <>
            {/* CUSTOMER METRIC CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {CUSTOMER_METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedCustomerMetric(m)}
                  className="text-left bg-white border border-slate-200 rounded-sm p-2 space-y-2 hover:border-blue-950 transition-all"
                >
                  <div className="text-[13px] font-medium text-slate-500 truncate">{m.label}</div>
                  <div className="text-[15px] font-bold text-slate-900">{m.value}</div>
                  <span className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm ${m.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                    {m.positive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {m.delta}
                  </span>
                </button>
              ))}
            </div>

            {/* NEW VS RETURNING CHART */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">New vs Returning Customers</h3>
                <p className="text-[13px] text-slate-500">Daily split of first-time vs repeat buyers</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={NEW_VS_RETURNING}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                    <YAxis stroke="#172554" fontSize={13} />
                    <Tooltip />
                    <Bar dataKey="new" name="New" stackId="a" fill="#172554" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="returning" name="Returning" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 text-[13px] text-slate-600 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-950" />New</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Returning</span>
              </div>
            </div>

            {/* TOP CUSTOMERS */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-700">Top Customers by Lifetime Value</span>
                <span className="text-[13px] text-blue-950 font-medium">Showing top 5</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Customer</th>
                      <th className="py-2 px-3 font-medium">Tier</th>
                      <th className="py-2 px-3 font-medium text-right">Orders</th>
                      <th className="py-2 px-3 font-medium text-right">Lifetime Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {TOP_CUSTOMERS.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-950 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
                            {c.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{c.name}</p>
                            <p className="text-[13px] text-slate-400 truncate">{c.email}</p>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${c.tier === 'VIP' ? 'bg-violet-50 text-violet-700 border-violet-100'
                              : c.tier === 'Gold' ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>{c.tier}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{c.orders}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">{formatKES(c.spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================================================= */}
        {/* TAB: PRODUCT ANALYTICS */}
        {/* ================================================= */}
        {activeTab === 'products' && (
          <>
            {/* PRODUCT SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'Most Viewed', value: PRODUCT_PERF.reduce((a, b) => a.views > b.views ? a : b).name.split(' ')[0], icon: Eye, color: 'text-blue-950 bg-blue-50' },
                { label: 'Most Purchased', value: PRODUCT_PERF.reduce((a, b) => a.purchases > b.purchases ? a : b).name.split(' ')[0], icon: ShoppingCart, color: 'text-emerald-700 bg-emerald-50' },
                { label: 'Best Seller', value: PRODUCT_PERF.find(p => p.status === 'best')?.name.split(' ')[0] ?? '—', icon: TrendingUp, color: 'text-blue-950 bg-blue-50' },
                { label: 'Low Performers', value: PRODUCT_PERF.filter(p => p.status === 'low').length.toString(), icon: ArrowDownRight, color: 'text-amber-700 bg-amber-50' },
                { label: 'Out of Stock', value: PRODUCT_PERF.filter(p => p.status === 'out').length.toString(), icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
                { label: 'Abandoned', value: PRODUCT_PERF.filter(p => p.status === 'abandoned').length.toString(), icon: Package, color: 'text-slate-600 bg-slate-50' },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${s.color}`}>
                      <s.icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                  </div>
                  <div className="text-[15px] font-bold text-slate-900 truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {/* PRODUCT PERFORMANCE TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-700">Product Performance</span>
                <span className="text-[13px] text-blue-950 font-medium">Click a row for details</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Product</th>
                      <th className="py-2 px-3 font-medium text-right">Views</th>
                      <th className="py-2 px-3 font-medium text-right">Purchases</th>
                      <th className="py-2 px-3 font-medium text-right">Revenue</th>
                      <th className="py-2 px-3 font-medium text-right">Stock</th>
                      <th className="py-2 px-3 font-medium text-right">Conversion</th>
                      <th className="py-2 px-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PRODUCT_PERF.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProductPerf(p)}
                        className="hover:bg-slate-50 cursor-pointer transition"
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <img src={p.image} alt={p.name} className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{p.name}</p>
                              <p className="text-[13px] text-slate-400 font-mono truncate">{p.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{p.views.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{p.purchases}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">{formatKES(p.revenue)}</td>
                        <td className={`py-2 px-3 text-right font-mono ${p.stock === 0 ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
                          {p.stock === 0 ? 'Out' : p.stock}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{p.conversion}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${PRODUCT_STATUS_STYLES[p.status]}`}>
                            {PRODUCT_STATUS_LABELS[p.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================================================= */}
        {/* TAB: CHANNEL ANALYTICS */}
        {/* ================================================= */}
        {activeTab === 'channels' && (
          <>
            {/* CHANNEL SHARE CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CHANNEL_DATA.map((ch) => (
                <button
                  key={ch.name}
                  onClick={() => setSelectedChannel(ch)}
                  className="text-left bg-white border border-slate-200 rounded-sm p-3 space-y-2 hover:border-blue-950 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0" style={{ backgroundColor: `${ch.color}20`, color: ch.color }}>
                        <ch.icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">{ch.name}</div>
                        <div className="text-[13px] text-slate-500">{ch.visitors.toLocaleString()} visitors</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-bold text-slate-900">{ch.share}%</div>
                      <div className="text-[13px] text-slate-500">of traffic</div>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${ch.share}%`, backgroundColor: ch.color }} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <p className="text-[13px] text-slate-500">Orders</p>
                      <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{ch.orders}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Revenue</p>
                      <p className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">{ch.revenue}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Conv.</p>
                      <p className="text-[13px] font-semibold text-emerald-600 mt-0.5">{ch.convRate}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* CHANNEL TREND */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">Channel Traffic Trend</h3>
                <p className="text-[13px] text-slate-500">Daily visitors per channel over the selected range</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={CHANNEL_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                    <YAxis stroke="#172554" fontSize={13} />
                    <Tooltip />
                    <Line type="monotone" dataKey="website" name="Website" stroke="#172554" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="whatsapp" name="WhatsApp" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="instagram" name="Instagram" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="facebook" name="Facebook" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tiktok" name="TikTok" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SOCIAL ACTIVITY + CONNECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Social Activity</h3>
                  <p className="text-[13px] text-slate-500">Connected platforms feeding the storefront</p>
                </div>
                <div className="space-y-1">
                  {SOCIAL_ACTIVITY.map((s) => (
                    <div key={s.platform} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-900 truncate">{s.platform}</p>
                          <p className="text-[13px] text-slate-500 truncate">{s.metric}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold text-slate-900">{s.value}</p>
                        <p className={`text-[13px] ${s.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {s.delta}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Platform Attribution</h3>
                  <p className="text-[13px] text-slate-500">Marketing activity connected to store conversions</p>
                </div>
                <div className="space-y-2">
                  {[
                    { platform: 'WhatsApp Business API', metric: 'Chat → Order conversion', value: '9.7%', desc: 'Highest converting channel' },
                    { platform: 'Instagram Shop', metric: 'Profile → Store visit', value: '6.4%', desc: 'Strong product discovery' },
                    { platform: 'TikTok Pixel', metric: 'Video → Store visit', value: '7.3%', desc: 'Best performing ads' },
                    { platform: 'Facebook Pixel', metric: 'Page → Store visit', value: '6.9%', desc: 'Stable retargeting' },
                  ].map((p) => (
                    <div key={p.platform} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{p.platform}</p>
                        <p className="text-[13px] text-slate-500 truncate">{p.metric}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold text-blue-950">{p.value}</p>
                        <p className="text-[13px] text-slate-400 truncate max-w-[140px]">{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}

/* ─── Reusable bits ─── */
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

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="bg-white border-l border-slate-200 w-full max-w-md h-full p-3 overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
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
