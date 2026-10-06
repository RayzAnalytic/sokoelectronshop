'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  Wallet,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { FaInstagram, FaFacebook } from 'react-icons/fa';

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

import { adminApi } from '@/lib/admin-api';
import type {
  AnalyticsRange,
  AnalyticsTab,
  AnalyticsQuery,
  AnalyticsTrafficResponse,
  AnalyticsSalesResponse,
  AnalyticsCustomersResponse,
  AnalyticsProductsResponse,
  AnalyticsChannelsResponse,
  AnalyticsKpi,
  AnalyticsSessionsPoint,
  AnalyticsSource,
  AnalyticsFunnelStage,
  AnalyticsDevice,
  AnalyticsCounty,
  AnalyticsAbandonedCart,
  AnalyticsSalesBreakdownRow,
  AnalyticsCustomerMetric,
  AnalyticsProductPerfRow,
  AnalyticsProductStatus,
  AnalyticsChannelRow,
  AnalyticsTopCustomer,
} from '@/lib/admin-types';

// ─────────────────────────────────────────────────────────────
// Local-only types (chart helpers, not part of the API)
// ─────────────────────────────────────────────────────────────
type AreaMetric = 'sessions' | 'visitors' | 'pageviews';

type PageTab = AnalyticsTab;

interface AnalyticsDataMap {
  traffic?: AnalyticsTrafficResponse;
  sales?: AnalyticsSalesResponse;
  customers?: AnalyticsCustomersResponse;
  products?: AnalyticsProductsResponse;
  channels?: AnalyticsChannelsResponse;
}

// ─────────────────────────────────────────────────────────────
// Static style maps (unchanged)
// ─────────────────────────────────────────────────────────────
const PRODUCT_STATUS_STYLES: Record<AnalyticsProductStatus, string> = {
  best: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  low: 'bg-amber-50 text-amber-700 border-amber-100',
  out: 'bg-red-50 text-red-600 border-red-100',
  abandoned: 'bg-slate-50 text-slate-600 border-slate-200',
};

const PRODUCT_STATUS_LABELS: Record<AnalyticsProductStatus, string> = {
  best: 'Best Seller',
  low: 'Low Performer',
  out: 'Out of Stock',
  abandoned: 'Abandoned',
};

// Backend sends the channel icon as a string name — map it back
// to the actual icon component.
const CHANNEL_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Website: Globe,
  WhatsApp: MessageCircle,
  Instagram: FaInstagram,
  Facebook: FaFacebook,
  TikTok: Music2,
  Other: Target,
};

const formatKES = (val: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(val);

// ═════════════════════════════════════════════════════════════════════════════
// PAGE — wrapped in Suspense (future-proofing for searchParams use)
// ═════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[13px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading analytics…
        </div>
      }
    >
      <AnalyticsPageInner />
    </Suspense>
  );
}

function AnalyticsPageInner() {
  const [dateRange, setDateRange] = useState<AnalyticsRange>('7days');
  const [comparePrevious, setComparePrevious] = useState(true);
  const [areaMetric, setAreaMetric] = useState<AreaMetric>('sessions');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PageTab>('traffic');

  // Data + async state
  const [reportData, setReportData] = useState<AnalyticsDataMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedKpi, setSelectedKpi] = useState<AnalyticsKpi | null>(null);
  const [selectedSource, setSelectedSource] = useState<AnalyticsSource | null>(null);
  const [selectedStage, setSelectedStage] = useState<AnalyticsFunnelStage | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<AnalyticsDevice | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<AnalyticsCounty | null>(null);
  const [selectedCartDay, setSelectedCartDay] = useState<string | null>(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);

  const [selectedSalesRow, setSelectedSalesRow] = useState<AnalyticsSalesBreakdownRow | null>(null);
  const [selectedCustomerMetric, setSelectedCustomerMetric] = useState<AnalyticsCustomerMetric | null>(null);
  const [selectedProductPerf, setSelectedProductPerf] = useState<AnalyticsProductPerfRow | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<AnalyticsChannelRow | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // ── Fetch on tab or range change ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const query: AnalyticsQuery = { range: dateRange };

    const load = async () => {
      try {
        switch (activeTab) {
          case 'traffic': {
            const data = await adminApi.analytics.traffic(query);
            if (!cancelled) setReportData((p) => ({ ...p, traffic: data }));
            break;
          }
          case 'sales': {
            const data = await adminApi.analytics.sales(query);
            if (!cancelled) setReportData((p) => ({ ...p, sales: data }));
            break;
          }
          case 'customers': {
            const data = await adminApi.analytics.customers(query);
            if (!cancelled) setReportData((p) => ({ ...p, customers: data }));
            break;
          }
          case 'products': {
            const data = await adminApi.analytics.products(query);
            if (!cancelled) setReportData((p) => ({ ...p, products: data }));
            break;
          }
          case 'channels': {
            const data = await adminApi.analytics.channels(query);
            if (!cancelled) setReportData((p) => ({ ...p, channels: data }));
            break;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, dateRange]);

  const handleRefresh = async () => {
    try {
      await adminApi.analytics.refreshCache({ tab: activeTab });
      showToast(`Refreshed ${activeTab.toUpperCase()} analytics`);
      // re-trigger fetch
      setReportData((p) => ({ ...p }));
    } catch {
      showToast(`Refresh failed for ${activeTab.toUpperCase()}`);
    }
  };

  // ── Read current tab data ────────────────────────────────
  const traffic = reportData.traffic;
  const sales = reportData.sales;
  const customers = reportData.customers;
  const products = reportData.products;
  const channels = reportData.channels;

  // Fallbacks so the UI can render safely while loading
  const kpis: AnalyticsKpi[] = traffic?.kpis ?? [];
  const sessionsTimeline: AnalyticsSessionsPoint[] = traffic?.sessions_timeline ?? [];
  const trafficSources: AnalyticsSource[] = traffic?.sources ?? [];
  const funnelStages: AnalyticsFunnelStage[] = traffic?.funnel ?? [];
  const devicesData: AnalyticsDevice[] = traffic?.devices ?? [];
  const counties: AnalyticsCounty[] = traffic?.counties ?? [];
  const abandonedCarts: AnalyticsAbandonedCart[] = traffic?.abandoned_carts ?? [];
  const abandonedTrend = traffic?.abandoned_trend ?? [];

  const filteredCarts = selectedCartDay
    ? abandonedCarts.filter((c) => c.date === selectedCartDay)
    : abandonedCarts;

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
                <AreaChart
                  data={selectedKpi.spark.map((v, i) => ({
                    date: sessionsTimeline[i]?.date ?? `D${i + 1}`,
                    value: v,
                  }))}
                >
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
                <LineChart
                  data={sessionsTimeline.map((s) => ({
                    date: s.date,
                    visits: Math.round((selectedSource.visits / Math.max(sessionsTimeline.length, 1)) * 0.9),
                  }))}
                >
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
                const pct = selectedStage.count ? Math.round((b.users / selectedStage.count) * 100) : 0;
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
              <span
                className="w-9 h-9 rounded-sm flex items-center justify-center"
                style={{ backgroundColor: `${selectedDevice.fill}20`, color: selectedDevice.fill }}
              >
                {selectedDevice.device.startsWith('Mobile') ? (
                  <Smartphone className="w-4 h-4" />
                ) : selectedDevice.device.startsWith('Desktop') ? (
                  <Monitor className="w-4 h-4" />
                ) : (
                  <Tablet className="w-4 h-4" />
                )}
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
                <img
                  src={selectedSalesRow.image}
                  alt={selectedSalesRow.name}
                  className="w-10 h-10 rounded-sm object-cover border border-slate-200"
                />
              ) : (
                <span
                  className="w-10 h-10 rounded-sm flex items-center justify-center"
                  style={{
                    backgroundColor: `${selectedSalesRow.color ?? '#172554'}20`,
                    color: selectedSalesRow.color ?? '#172554',
                  }}
                >
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
              <Stat
                label="Growth"
                value={`${selectedSalesRow.growth > 0 ? '+' : ''}${selectedSalesRow.growth}%`}
              />
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
              {selectedProductPerf.image ? (
                <img src={selectedProductPerf.image} alt={selectedProductPerf.name} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-slate-400">
                  <Package className="w-8 h-8" />
                </span>
              )}
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
              {(() => {
                const Icon = CHANNEL_ICON_MAP[selectedChannel.icon] ?? Target;
                return (
                  <span
                    className="w-10 h-10 rounded-sm flex items-center justify-center"
                    style={{ backgroundColor: `${selectedChannel.color}20`, color: selectedChannel.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                );
              })()}
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
                    {selectedCartDay
                      ? `Showing carts from ${selectedCartDay}`
                      : 'Instantly ping leads via WhatsApp Cloud API'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCartModalOpen(false);
                  setSelectedCartDay(null);
                }}
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
                  <div
                    key={cart.id}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{cart.customer}</span>
                        <span className="text-[13px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-sm font-mono">
                          {cart.phone}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        {cart.items} • <span className="font-medium text-emerald-600">{cart.value}</span>
                      </div>
                      <div className="text-[13px] text-slate-400">
                        Abandoned {cart.time} ({cart.date})
                      </div>
                    </div>

                    <button
                      onClick={() => showToast(`WhatsApp reminder sent to ${cart.customer} (${cart.phone})`)}
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
                onClick={() => {
                  setCartModalOpen(false);
                  setSelectedCartDay(null);
                }}
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
            <p className="text-[13px] text-slate-500 mt-0.5">
              Deep dive into traffic, sales, customers, products, and channels
            </p>
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
                onChange={(e) => setDateRange(e.target.value as AnalyticsRange)}
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
            {([
              { id: 'traffic', label: 'Traffic' },
              { id: 'sales', label: 'Sales' },
              { id: 'customers', label: 'Customers' },
              { id: 'products', label: 'Products' },
              { id: 'channels', label: 'Channels' },
            ] as { id: PageTab; label: string }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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

        {/* ERROR */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-100 rounded-sm p-3 flex items-start gap-2 text-[13px]">
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

        {/* LOADING */}
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-20 bg-slate-100 rounded-sm w-full animate-pulse" />
            <div className="h-64 bg-slate-100 rounded-sm w-full animate-pulse" />
            <div className="h-56 bg-slate-100 rounded-sm w-full animate-pulse" />
          </div>
        ) : (
          <>
            {/* ═════════ TRAFFIC TAB ═════════ */}
            {activeTab === 'traffic' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                  {kpis.map((kpi) => (
                    <button
                      key={kpi.id}
                      onClick={() => setSelectedKpi(kpi)}
                      className="text-left bg-white border border-slate-200 rounded-sm p-2 space-y-2 hover:border-blue-950 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-slate-500 truncate">{kpi.label}</span>
                        <span
                          className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm shrink-0 ${kpi.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                            }`}
                        >
                          {kpi.positive ? (
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 mr-0.5" />
                          )}
                          {kpi.delta}
                        </span>
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">{kpi.value}</div>
                      {comparePrevious && <div className="text-[13px] text-slate-400">vs prev. period</div>}
                    </button>
                  ))}
                </div>

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
                            className={`px-2.5 py-1.5 rounded-sm text-[13px] font-medium transition capitalize ${areaMetric === m ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                              }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-64 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sessionsTimeline}>
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
                          <Area
                            type="monotone"
                            dataKey={areaMetric}
                            stroke="#172554"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorMetric)"
                          />
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
                            data={trafficSources}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="value"
                            onClick={(entry: unknown) => setSelectedSource(entry as AnalyticsSource)}
                            className="cursor-pointer"
                          >
                            {trafficSources.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={entry.color}
                                className="hover:opacity-80 transition-opacity cursor-pointer"
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-0.5 text-[13px]">
                      {trafficSources.map((src) => (
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

                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Conversion Funnel</h3>
                    <p className="text-[13px] text-slate-500">Click a stage for source breakdown</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {funnelStages.map((stage, idx) => (
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-6 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Device Breakdown</h3>
                      <p className="text-[13px] text-slate-500">Click a bar for stats</p>
                    </div>

                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={devicesData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                          <YAxis dataKey="device" type="category" width={140} stroke="#172554" fontSize={13} />
                          <Tooltip />
                          <Bar
                            dataKey="users"
                            radius={[0, 2, 2, 0]}
                            barSize={20}
                            onClick={(entry: unknown) => setSelectedDevice(entry as AnalyticsDevice)}
                            className="cursor-pointer"
                          >
                            {devicesData.map((d, i) => (
                              <Cell key={i} fill={d.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-0.5">
                      {devicesData.map((d) => (
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
                      {counties.length === 0 ? (
                        <p className="text-[13px] text-slate-400 italic py-6 text-center">No address data yet.</p>
                      ) : (
                        counties.map((loc) => (
                          <button
                            key={loc.county}
                            onClick={() => setSelectedCounty(loc)}
                            className="w-full space-y-1 text-[13px] text-left hover:bg-slate-50 rounded-sm px-2 py-2 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-800">{loc.county}</span>
                              <span className="font-mono text-slate-600">
                                {loc.visitors.toLocaleString()} ({loc.share}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-sm overflow-hidden">
                              <div className="bg-blue-950 h-full rounded-sm" style={{ width: `${loc.share}%` }} />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

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
                      onClick={() => {
                        setSelectedCartDay(null);
                        setCartModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-sm transition text-[13px]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Recover ({abandonedCarts.length})</span>
                    </button>
                  </div>

                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={abandonedTrend}>
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
                          activeDot={(props: unknown) => {
                            const { cx, cy, payload } = props as {
                              cx: number;
                              cy: number;
                              payload: { date: string };
                            };
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="#f43f5e"
                                stroke="#fff"
                                strokeWidth={2}
                                className="cursor-pointer"
                                onClick={() => {
                                  setSelectedCartDay(payload.date);
                                  setCartModalOpen(true);
                                }}
                              />
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="text-[13px] text-slate-400 text-center">
                    Click a point to view that day&apos;s carts
                  </p>
                </div>
              </>
            )}

            {/* ═════════ SALES TAB ═════════ */}
            {activeTab === 'sales' && sales && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    { label: 'Gross Sales', value: formatKES(sales.summary.gross), delta: '+14.2%', positive: true, icon: DollarSign },
                    { label: 'Net Sales', value: formatKES(sales.summary.net), delta: '+12.8%', positive: true, icon: Wallet },
                    { label: 'Refunds', value: formatKES(sales.summary.refunds), delta: '+3.1%', positive: false, icon: RotateCcw },
                    { label: 'Orders', value: sales.summary.orders.toLocaleString(), delta: '+8.1%', positive: true, icon: ShoppingCart },
                    { label: 'Avg. Order Value', value: formatKES(sales.summary.aov), delta: '+3.4%', positive: true, icon: TrendingUp },
                    { label: 'Revenue Growth', value: `${sales.summary.revenueGrowth}%`, delta: '+1.2%', positive: true, icon: ArrowUpRight },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <s.icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[13px] font-medium text-slate-500 truncate">{s.label}</span>
                        </div>
                      </div>
                      <div className="text-[15px] font-bold text-slate-900">{s.value}</div>
                      <span
                        className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm ${s.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}
                      >
                        {s.positive ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {s.delta}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Sales Trend — Gross vs Net</h3>
                    <p className="text-[13px] text-slate-500">Daily revenue after refunds and discounts</p>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sales.trend}>
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
                        <Tooltip formatter={(v: unknown) => formatKES(Number(v))} />
                        <Area type="monotone" dataKey="gross" stroke="#172554" strokeWidth={2} fill="url(#fillGross)" />
                        <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} fill="url(#fillNet)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] text-slate-600 pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-950" />
                      Gross
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Net
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {[
                    { title: 'Sales by Product', data: sales.by_product },
                    { title: 'Sales by Category', data: sales.by_category },
                    { title: 'Sales by Brand', data: sales.by_brand },
                  ].map((block) => (
                    <div key={block.title} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-900">{block.title}</h3>
                        <p className="text-[13px] text-slate-500">Click any row for details</p>
                      </div>
                      <div className="space-y-1">
                        {block.data.length === 0 ? (
                          <p className="text-[13px] text-slate-400 italic py-6 text-center">
                            No data for this range.
                          </p>
                        ) : (
                          block.data.map((row) => (
                            <button
                              key={row.name}
                              onClick={() => setSelectedSalesRow(row)}
                              className="w-full text-left hover:bg-slate-50 rounded-sm px-2 py-2 transition"
                            >
                              <div className="flex items-center justify-between gap-2 text-[13px]">
                                <span className="font-medium text-slate-800 truncate">{row.name}</span>
                                <span className="font-mono font-semibold text-slate-900 shrink-0">
                                  {formatKES(row.revenue)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[13px] text-slate-500 mt-0.5">
                                <span>
                                  {row.orders} orders · {row.units} units
                                </span>
                                <span className={row.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                  {row.growth >= 0 ? '+' : ''}
                                  {row.growth}%
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ═════════ CUSTOMERS TAB ═════════ */}
            {activeTab === 'customers' && customers && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {customers.metrics.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedCustomerMetric(m)}
                      className="text-left bg-white border border-slate-200 rounded-sm p-2 space-y-2 hover:border-blue-950 transition-all"
                    >
                      <div className="text-[13px] font-medium text-slate-500 truncate">{m.label}</div>
                      <div className="text-[15px] font-bold text-slate-900">{m.value}</div>
                      <span
                        className={`inline-flex items-center text-[13px] font-medium px-2 py-0.5 rounded-sm ${m.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}
                      >
                        {m.positive ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {m.delta}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">New vs Returning Customers</h3>
                    <p className="text-[13px] text-slate-500">Daily split of first-time vs repeat buyers</p>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customers.new_vs_returning}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                        <YAxis stroke="#172554" fontSize={13} />
                        <Tooltip />
                        <Bar dataKey="new" name="New" stackId="a" fill="#172554" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="returning" name="Returning" stackId="a" fill="#10b981" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] text-slate-600 pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-950" />
                      New
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Returning
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">
                      Top Customers by Lifetime Value
                    </span>
                    <span className="text-[13px] text-blue-950 font-medium">
                      Showing top {customers.top_customers.length}
                    </span>
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
                        {customers.top_customers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 text-[13px]">
                              No customers yet.
                            </td>
                          </tr>
                        ) : (
                          customers.top_customers.map((c: AnalyticsTopCustomer) => (
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
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${c.tier === 'VIP'
                                      ? 'bg-violet-50 text-violet-700 border-violet-100'
                                      : c.tier === 'Gold'
                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}
                                >
                                  {c.tier}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">{c.orders}</td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                {formatKES(c.spent)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ═════════ PRODUCTS TAB ═════════ */}
            {activeTab === 'products' && products && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    { label: 'Most Viewed', value: products.summary.most_viewed, icon: Eye, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Most Purchased', value: products.summary.most_purchased, icon: ShoppingCart, color: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Best Seller', value: products.summary.best_seller, icon: TrendingUp, color: 'text-blue-950 bg-blue-50' },
                    { label: 'Low Performers', value: products.summary.low_performers.toString(), icon: ArrowDownRight, color: 'text-amber-700 bg-amber-50' },
                    { label: 'Out of Stock', value: products.summary.out_of_stock.toString(), icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
                    { label: 'Abandoned', value: products.summary.abandoned.toString(), icon: Package, color: 'text-slate-600 bg-slate-50' },
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
                        {products.rows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400 text-[13px]">
                              No product activity in this range.
                            </td>
                          </tr>
                        ) : (
                          products.rows.map((p) => (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedProductPerf(p)}
                              className="hover:bg-slate-50 cursor-pointer transition"
                            >
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt={p.name}
                                      className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                                      <Package className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900 truncate">{p.name}</p>
                                    <p className="text-[13px] text-slate-400 font-mono truncate">{p.sku}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">{p.views.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">{p.purchases}</td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                {formatKES(p.revenue)}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-mono ${p.stock === 0 ? 'text-red-600 font-semibold' : 'text-slate-700'
                                  }`}
                              >
                                {p.stock === 0 ? 'Out' : p.stock}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">{p.conversion}</td>
                              <td className="py-2 px-3 text-right">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${PRODUCT_STATUS_STYLES[p.status]}`}
                                >
                                  {PRODUCT_STATUS_LABELS[p.status]}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ═════════ CHANNELS TAB ═════════ */}
            {activeTab === 'channels' && channels && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {channels.channels.map((ch) => {
                    const Icon = CHANNEL_ICON_MAP[ch.icon] ?? Target;
                    return (
                      <button
                        key={ch.name}
                        onClick={() => setSelectedChannel(ch)}
                        className="text-left bg-white border border-slate-200 rounded-sm p-3 space-y-2 hover:border-blue-950 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${ch.color}20`, color: ch.color }}
                            >
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-slate-900 truncate">{ch.name}</div>
                              <div className="text-[13px] text-slate-500">
                                {ch.visitors.toLocaleString()} visitors
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[15px] font-bold text-slate-900">{ch.share}%</div>
                            <div className="text-[13px] text-slate-500">of traffic</div>
                          </div>
                        </div>

                        <div className="w-full bg-slate-100 h-2 rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm"
                            style={{ width: `${ch.share}%`, backgroundColor: ch.color }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div>
                            <p className="text-[13px] text-slate-500">Orders</p>
                            <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{ch.orders}</p>
                          </div>
                          <div>
                            <p className="text-[13px] text-slate-500">Revenue</p>
                            <p className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">
                              {ch.revenue}
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] text-slate-500">Conv.</p>
                            <p className="text-[13px] font-semibold text-emerald-600 mt-0.5">{ch.convRate}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Channel Traffic Trend</h3>
                    <p className="text-[13px] text-slate-500">Daily visitors per channel over the selected range</p>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={channels.trend}>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Social Activity</h3>
                      <p className="text-[13px] text-slate-500">Connected platforms feeding the storefront</p>
                    </div>
                    <div className="space-y-1">
                      {channels.social_activity.length === 0 ? (
                        <p className="text-[13px] text-slate-400 italic py-4 text-center">
                          No social posts published yet.
                        </p>
                      ) : (
                        channels.social_activity.map((s) => (
                          <div
                            key={s.platform}
                            className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm"
                          >
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
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">Platform Attribution</h3>
                      <p className="text-[13px] text-slate-500">Marketing activity connected to store conversions</p>
                    </div>
                    <div className="space-y-2">
                      {channels.attribution.map((p) => (
                        <div
                          key={p.platform}
                          className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm"
                        >
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
          </>
        )}

      </main>
    </div>
  );
}

/* ─── Reusable bits ─── */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm max-w-lg w-full p-3 shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
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
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white border-l border-slate-200 w-full max-w-md h-full p-3 overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
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