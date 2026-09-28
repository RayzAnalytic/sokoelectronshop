'use client';

import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  X,
  TrendingUp,
  DollarSign,
  Package,
  Eye,
  Percent,
  AlertCircle,
  Globe,
  Layers,
  Video,
  Megaphone,
  ClipboardList,
  BarChart3,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// --- TYPES ---
type TikTokTab =
  | 'Overview'
  | 'Products'
  | 'Content'
  | 'Promotions'
  | 'Orders'
  | 'Analytics';

interface SyncedProduct {
  id: string;
  name: string;
  sku: string;
  image: string;
  price: number;
  tiktokPrice: number;
  synced: boolean;
  lastSynced: string;
}

interface TikTokContent {
  id: string;
  title: string;
  type: 'Live Showcase' | 'Short Video' | 'Product Ad';
  status: 'Published' | 'Draft' | 'Scheduled' | 'Rejected';
  views: number;
  clicks: number;
  publishedAt: string;
  thumbnail: string;
}

interface TikTokPromotion {
  id: string;
  name: string;
  type: 'Flash Deal' | 'Coupon' | 'Bundle';
  discount: string;
  products: number;
  startsAt: string;
  endsAt: string;
  status: 'Active' | 'Scheduled' | 'Ended';
}

interface TikTokOrder {
  id: string;
  orderNumber: string;
  customer: string;
  items: string;
  itemImage: string;
  total: number;
  status: 'To Ship' | 'Shipped' | 'Delivered' | 'Cancelled';
  date: string;
  shippingAddress: string;
}

const INITIAL_PRODUCTS: SyncedProduct[] = [
  { id: 'p1', name: 'Wireless Ergonomic Mechanical Keyboard', sku: 'KB-ERG-01', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&auto=format&fit=crop&q=80', price: 6500, tiktokPrice: 6999, synced: true, lastSynced: '10 mins ago' },
  { id: 'p2', name: 'UltraWide 29" Gaming Monitor', sku: 'MON-UW-29', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=200&auto=format&fit=crop&q=80', price: 28000, tiktokPrice: 29500, synced: true, lastSynced: '2 hours ago' },
  { id: 'p3', name: 'Smart Home Wi-Fi Router AX3000', sku: 'NET-AX3000', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80', price: 8500, tiktokPrice: 8999, synced: true, lastSynced: 'Yesterday' },
  { id: 'p4', name: 'USB-C Multiport Hub 7-in-1', sku: 'HUB-7IN1', image: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=200&auto=format&fit=crop&q=80', price: 2500, tiktokPrice: 2799, synced: false, lastSynced: 'Never' },
  { id: 'p5', name: 'SokoFlow Pro Subscription (1 Yr)', sku: 'SF-PRO-YR', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&auto=format&fit=crop&q=80', price: 12000, tiktokPrice: 12000, synced: false, lastSynced: 'Never' },
];

const INITIAL_CONTENT: TikTokContent[] = [
  { id: 'c1', title: 'Keyboard unboxing & typing test', type: 'Short Video', status: 'Published', views: 42300, clicks: 1420, publishedAt: '2 days ago', thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&auto=format&fit=crop&q=80' },
  { id: 'c2', title: 'Monitor install timelapse', type: 'Short Video', status: 'Published', views: 18900, clicks: 512, publishedAt: '5 days ago', thumbnail: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=200&auto=format&fit=crop&q=80' },
  { id: 'c3', title: 'SokoFlow x TikTok live showcase', type: 'Live Showcase', status: 'Scheduled', views: 0, clicks: 0, publishedAt: 'Tomorrow, 8 PM EAT', thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&auto=format&fit=crop&q=80' },
  { id: 'c4', title: 'Smart home giveaway teaser', type: 'Product Ad', status: 'Draft', views: 0, clicks: 0, publishedAt: 'Not scheduled', thumbnail: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80' },
];

const INITIAL_PROMOTIONS: TikTokPromotion[] = [
  { id: 'pr1', name: 'Keyboard Weekend Flash', type: 'Flash Deal', discount: '-15%', products: 3, startsAt: 'Sat 10:00 AM', endsAt: 'Sun 11:59 PM', status: 'Scheduled' },
  { id: 'pr2', name: 'Welcome Coupon', type: 'Coupon', discount: 'KES 500 off', products: 12, startsAt: 'Sep 15, 2026', endsAt: 'Oct 15, 2026', status: 'Active' },
  { id: 'pr3', name: 'Bundle: Monitor + Hub', type: 'Bundle', discount: '-10% on both', products: 2, startsAt: 'Sep 01, 2026', endsAt: 'Sep 30, 2026', status: 'Active' },
  { id: 'pr4', name: 'Back-to-school deal', type: 'Flash Deal', discount: '-20%', products: 5, startsAt: 'Aug 20, 2026', endsAt: 'Sep 05, 2026', status: 'Ended' },
];

const INITIAL_ORDERS: TikTokOrder[] = [
  { id: 'ord-1', orderNumber: '#TT-98421', customer: 'Brian Kiprop', items: 'Wireless Ergonomic Mechanical Keyboard x1', itemImage: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&auto=format&fit=crop&q=80', total: 6999, status: 'To Ship', date: 'Today, 2:45 PM', shippingAddress: 'Westlands, Nairobi, Kenya' },
  { id: 'ord-2', orderNumber: '#TT-98420', customer: 'Amina Mohamed', items: 'Smart Home Wi-Fi Router AX3000 x1', itemImage: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80', total: 8999, status: 'Shipped', date: 'Today, 11:15 AM', shippingAddress: 'Nyali, Mombasa, Kenya' },
  { id: 'ord-3', orderNumber: '#TT-98419', customer: 'Kevin Ochieng', items: 'UltraWide 29" Gaming Monitor x1', itemImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=200&auto=format&fit=crop&q=80', total: 29500, status: 'Delivered', date: 'Yesterday', shippingAddress: 'Milimani, Kisumu, Kenya' },
  { id: 'ord-4', orderNumber: '#TT-98418', customer: 'Sharon Wangari', items: 'USB-C Multiport Hub 7-in-1 x2', itemImage: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=200&auto=format&fit=crop&q=80', total: 5598, status: 'Delivered', date: 'Sep 21, 2026', shippingAddress: 'Ruiru, Kiambu, Kenya' },
];

const REVENUE_CHART_DATA = [
  { day: 'Mon', revenue: 12400 },
  { day: 'Tue', revenue: 18900 },
  { day: 'Wed', revenue: 15200 },
  { day: 'Thu', revenue: 24500 },
  { day: 'Fri', revenue: 31200 },
  { day: 'Sat', revenue: 45000 },
  { day: 'Sun', revenue: 38400 },
];

const VIEWS_CHART_DATA = [
  { day: 'Mon', views: 4200 },
  { day: 'Tue', views: 6800 },
  { day: 'Wed', views: 5100 },
  { day: 'Thu', views: 9400 },
  { day: 'Fri', views: 14200 },
  { day: 'Sat', views: 22100 },
  { day: 'Sun', views: 18500 },
];

const TRAFFIC_SOURCES_DATA = [
  { name: 'Live Stream Showcase', value: 54, color: '#ec4899' },
  { name: 'Short Video Showcase', value: 31, color: '#8b5cf6' },
  { name: 'Shop Tab Organic', value: 15, color: '#3b82f6' },
];

const TOP_PRODUCTS = [
  { name: 'Wireless Ergonomic Mechanical Keyboard', sales: 142, revenue: 'KES 993,858', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&auto=format&fit=crop&q=80' },
  { name: 'UltraWide 29" Gaming Monitor', sales: 48, revenue: 'KES 1,416,000', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=200&auto=format&fit=crop&q=80' },
  { name: 'Smart Home Wi-Fi Router AX3000', sales: 96, revenue: 'KES 863,904', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80' },
];

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '2px',
  color: '#0f172a',
  fontSize: '13px',
};

export default function TikTokShopPage() {
  const [isConnected, setIsConnected] = useState(true);
  const [activeTab, setActiveTab] = useState<TikTokTab>('Overview');
  const [products, setProducts] = useState<SyncedProduct[]>(INITIAL_PRODUCTS);
  const [content, setContent] = useState<TikTokContent[]>(INITIAL_CONTENT);
  const [promotions] = useState<TikTokPromotion[]>(INITIAL_PROMOTIONS);
  const [orders, setOrders] = useState<TikTokOrder[]>(INITIAL_ORDERS);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TikTokOrder | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!selectedOrder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedOrder(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedOrder]);

  const toast = (msg: string) => setToastMessage(msg);

  const handleSyncNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setProducts((prev) => prev.map((p) => (p.synced ? { ...p, lastSynced: 'Just now' } : p)));
      toast('Synced catalog & orders');
    }, 1100);
  };

  const handleToggleSyncProduct = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const next = !p.synced;
          toast(next ? `Synced "${p.name}"` : `Unsynced "${p.name}"`);
          return { ...p, synced: next, lastSynced: next ? 'Just now' : p.lastSynced };
        }
        return p;
      })
    );
  };

  const handleSyncAll = () => {
    setProducts((prev) => prev.map((p) => ({ ...p, synced: true, lastSynced: 'Just now' })));
    toast('All products synced');
  };

  const handleFulfillOrder = (orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'Shipped' } : o)));
    toast('Order fulfillment initiated');
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: 'Shipped' } : null));
    }
  };

  const handlePublishContent = () => {
    toast('Publish dialog would open');
  };

  const handleCreatePromotion = () => {
    toast('Create promotion dialog would open');
  };

  const TABS: { id: TikTokTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'Overview', label: 'Overview', icon: TrendingUp },
    { id: 'Products', label: 'Products', icon: ShoppingBag },
    { id: 'Content', label: 'Content', icon: Video },
    { id: 'Promotions', label: 'Promotions', icon: Megaphone },
    { id: 'Orders', label: 'Orders', icon: ClipboardList },
    { id: 'Analytics', label: 'Analytics', icon: BarChart3 },
  ];

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

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-slate-900 text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
              TT
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                TikTok Shop
                <span
                  className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </h1>
              <p className="text-[13px] text-slate-500 truncate">
                Live storefront, synced inventory, promotions, and orders
              </p>
            </div>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-950' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* NOT CONNECTED */}
        {!isConnected ? (
          <div className="max-w-xl mx-auto my-8 bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
            <span className="w-12 h-12 rounded-sm bg-slate-900 text-white flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                TikTok Shop is not connected
              </h2>
              <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">
                Your TikTok Shop integration is managed by the platform administrator.
                Contact support if you believe this is an error.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* TABS */}
            <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5 overflow-x-auto max-w-full">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* OVERVIEW */}
            {activeTab === 'Overview' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <KpiCard
                    label="TikTok revenue"
                    value="KES 148,250"
                    delta="+18.4% this week"
                    icon={<DollarSign className="w-4 h-4" />}
                    tint="bg-emerald-50 text-emerald-700"
                  />
                  <KpiCard
                    label="TikTok orders"
                    value="286"
                    delta="+12.1% fulfillment"
                    icon={<Package className="w-4 h-4" />}
                    tint="bg-blue-50 text-blue-950"
                  />
                  <KpiCard
                    label="Live & video views"
                    value="70,300"
                    delta="+34.2% engagement"
                    icon={<Eye className="w-4 h-4" />}
                    tint="bg-pink-50 text-pink-700"
                  />
                  <KpiCard
                    label="Conversion rate"
                    value="3.8%"
                    delta="+0.6% vs benchmark"
                    icon={<Percent className="w-4 h-4" />}
                    tint="bg-purple-50 text-purple-700"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                    <p className="text-[13px] font-semibold text-slate-900">Revenue trend (GMV)</p>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={REVENUE_CHART_DATA}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" stroke="#94a3b8" fontSize={13} />
                          <YAxis stroke="#94a3b8" fontSize={13} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#0f172a"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                    <p className="text-[13px] font-semibold text-slate-900">Top products</p>
                    <div className="space-y-1.5">
                      {TOP_PRODUCTS.map((prod, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-200 bg-slate-50 rounded-sm p-2 flex items-center gap-2"
                        >
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-10 h-10 rounded-sm object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {prod.name}
                            </p>
                            <div className="flex items-center justify-between text-[13px] text-slate-500 mt-0.5">
                              <span>{prod.sales} units</span>
                              <span className="font-medium text-emerald-700">{prod.revenue}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCTS */}
            {activeTab === 'Products' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      Synced catalog · {products.filter((p) => p.synced).length}
                    </p>
                    <p className="text-[13px] text-slate-500">
                      Manage items pushed to your TikTok Shop storefront
                    </p>
                  </div>
                  <button
                    onClick={handleSyncAll}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sync all
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Product</th>
                          <th className="py-2 px-3 font-medium">SKU</th>
                          <th className="py-2 px-3 font-medium text-right">Store price</th>
                          <th className="py-2 px-3 font-medium text-right">TikTok price</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 px-3 font-medium">Last synced</th>
                          <th className="py-2 px-3 w-36"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((prod) => (
                          <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <img
                                  src={prod.image}
                                  alt={prod.name}
                                  className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                                />
                                <span className="font-medium text-slate-900 truncate max-w-xs">
                                  {prod.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">{prod.sku}</td>
                            <td className="py-2 px-3 text-right text-slate-700">
                              KES {prod.price.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                              KES {prod.tiktokPrice.toLocaleString()}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                                  prod.synced
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {prod.synced ? 'Synced' : 'Unsynced'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono">
                              {prod.lastSynced}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => handleToggleSyncProduct(prod.id)}
                                className={`px-2.5 py-2 rounded-sm font-medium text-[13px] border transition ${
                                  prod.synced
                                    ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                {prod.synced ? 'Unsync' : 'Add to TikTok'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT */}
            {activeTab === 'Content' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      Content library · {content.length}
                    </p>
                    <p className="text-[13px] text-slate-500">
                      Live showcases, short videos, and product ads
                    </p>
                  </div>
                  <button
                    onClick={handlePublishContent}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <Video className="w-3.5 h-3.5" />
                    New content
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {content.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                    >
                      <div className="relative h-36 w-full bg-slate-100">
                        <img
                          src={c.thumbnail}
                          alt={c.title}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute top-2 left-2 px-2 py-0.5 rounded-sm text-[13px] font-medium backdrop-blur-sm ${
                            c.status === 'Published'
                              ? 'bg-emerald-500 text-white'
                              : c.status === 'Scheduled'
                                ? 'bg-blue-500 text-white'
                                : c.status === 'Rejected'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-800/80 text-white'
                          }`}
                        >
                          {c.status}
                        </span>
                        <span className="absolute top-2 right-2 bg-slate-900/80 text-white px-2 py-0.5 rounded-sm text-[13px] font-medium backdrop-blur-sm">
                          {c.type}
                        </span>
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                        <p className="text-[13px] text-slate-400">{c.publishedAt}</p>
                        <div className="flex items-center gap-3 pt-1 border-t border-slate-100 mt-1 text-[13px]">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Eye className="w-3 h-3" />
                            {c.views.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Percent className="w-3 h-3" />
                            {c.clicks.toLocaleString()} clicks
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PROMOTIONS */}
            {activeTab === 'Promotions' && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      Promotions & deals · {promotions.length}
                    </p>
                    <p className="text-[13px] text-slate-500">
                      Flash deals, coupons, and bundles on TikTok Shop
                    </p>
                  </div>
                  <button
                    onClick={handleCreatePromotion}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    Create promotion
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2 px-3 font-medium">Promotion</th>
                          <th className="py-2 px-3 font-medium">Type</th>
                          <th className="py-2 px-3 font-medium">Discount</th>
                          <th className="py-2 px-3 font-medium text-center">Products</th>
                          <th className="py-2 px-3 font-medium">Period</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {promotions.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                            <td className="py-2 px-3 text-slate-600">{p.type}</td>
                            <td className="py-2 px-3 font-medium text-emerald-700">{p.discount}</td>
                            <td className="py-2 px-3 text-center text-slate-700">{p.products}</td>
                            <td className="py-2 px-3 text-[13px] text-slate-500">
                              {p.startsAt} — {p.endsAt}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                                  p.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : p.status === 'Scheduled'
                                      ? 'bg-blue-50 text-blue-950 border-blue-100'
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {p.status}
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
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-slate-700">
                    TikTok orders · {orders.length}
                  </p>
                  <p className="text-[13px] text-slate-400 hidden sm:block">
                    Click a row for full details
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2 px-3 font-medium">Order</th>
                        <th className="py-2 px-3 font-medium">Customer</th>
                        <th className="py-2 px-3 font-medium">Items</th>
                        <th className="py-2 px-3 font-medium text-right">Total</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 w-32"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((ord) => (
                        <tr
                          key={ord.id}
                          onClick={() => setSelectedOrder(ord)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-3 font-mono font-medium text-slate-900">
                            {ord.orderNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-800">{ord.customer}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={ord.itemImage}
                                alt=""
                                className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                              />
                              <span className="text-slate-600 truncate max-w-xs">
                                {ord.items}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900">
                            KES {ord.total.toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${
                                ord.status === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : ord.status === 'Shipped'
                                    ? 'bg-blue-50 text-blue-950 border-blue-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            {ord.status === 'To Ship' ? (
                              <button
                                onClick={(e) => handleFulfillOrder(ord.id, e)}
                                className="px-2.5 py-2 rounded-sm bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px]"
                              >
                                Fulfill
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[13px]">Done</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ANALYTICS */}
            {activeTab === 'Analytics' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-pink-700" />
                    Showcase & live views
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={VIEWS_CHART_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={13} />
                        <YAxis stroke="#94a3b8" fontSize={13} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="views" fill="#ec4899" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    GMV trend (KES)
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={REVENUE_CHART_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={13} />
                        <YAxis stroke="#94a3b8" fontSize={13} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-950" />
                    Traffic & sales source breakdown
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={TRAFFIC_SOURCES_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          {TRAFFIC_SOURCES_DATA.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ORDER DETAILS DRAWER */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <p className="text-[13px] text-slate-500">Order</p>
                <p className="text-[15px] font-semibold font-mono text-slate-900 mt-0.5 truncate">
                  {selectedOrder.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              <div className="border border-slate-200 rounded-sm p-2 flex items-center gap-2">
                <img
                  src={selectedOrder.itemImage}
                  alt=""
                  className="w-14 h-14 rounded-sm object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-500">Items</p>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedOrder.items}</p>
                  <p className="text-[13px] text-slate-400 font-mono mt-0.5">
                    TikTok live showcase
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] text-slate-500">Customer</p>
                <p className="font-medium text-slate-900">{selectedOrder.customer}</p>
                <p className="text-slate-600 inline-flex items-center gap-1 mt-0.5">
                  <Globe className="w-3 h-3 text-slate-400" />
                  {selectedOrder.shippingAddress}
                </p>
              </div>

              <div className="bg-slate-900 text-white rounded-sm p-2 flex items-center justify-between">
                <span className="text-[13px]">Total paid</span>
                <span className="font-semibold text-emerald-400">
                  KES {selectedOrder.total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex gap-2 shrink-0">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
              {selectedOrder.status === 'To Ship' && (
                <button
                  onClick={(e) => handleFulfillOrder(selectedOrder.id, e)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-sm text-[13px]"
                >
                  Fulfill order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── KPI card ─────────── */
function KpiCard({
  label,
  value,
  delta,
  icon,
  tint,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
          <TrendingUp className="w-3 h-3" />
          {delta}
        </p>
      </div>
      <span
        className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}
      >
        {icon}
      </span>
    </div>
  );
}