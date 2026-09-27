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
} from 'lucide-react';
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

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [comparePrevious, setComparePrevious] = useState(true);
  const [areaMetric, setAreaMetric] = useState<AreaMetric>('sessions');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [selectedSource, setSelectedSource] = useState<typeof TRAFFIC_SOURCES[0] | null>(null);
  const [selectedPage, setSelectedPage] = useState<TopPage | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<CountyRow | null>(null);
  const [selectedCartDay, setSelectedCartDay] = useState<string | null>(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);

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

      {/* ---- KPI MODAL ---- */}
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

      {/* ---- SOURCE MODAL ---- */}
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

      {/* ---- TOP PAGE DRAWER ---- */}
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

      {/* ---- FUNNEL STAGE MODAL ---- */}
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

      {/* ---- DEVICE MODAL ---- */}
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

      {/* ---- COUNTY MODAL ---- */}
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

      {/* ---- ABANDONED CARTS MODAL ---- */}
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
            <h1 className="text-[15px] font-semibold text-slate-900">Storefront Analytics</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Live behavioral tracking and cart recovery</p>
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
      </header>

      {/* MAIN */}
      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

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
                <span className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm shrink-0 ${
                  kpi.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
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
                    className={`px-2.5 py-2 rounded-sm text-[13px] font-medium transition capitalize ${
                      areaMetric === m ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
