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
  ExternalLink,
  AlertCircle,
  Settings as SettingsIcon,
  Globe,
  Layers,
  Link2,
  Video,
  Megaphone,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  Lock,
  Unlock,
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
  | 'Analytics'
  | 'Settings';

// Capabilities that MAY or MAY NOT be granted to a given merchant account.
// The UI must only enable the functions that the backend reports as available.
type CapabilityKey =
  | 'catalog_sync'
  | 'content_publish'
  | 'product_promotion'
  | 'order_sync'
  | 'performance_analytics';

interface Capability {
  key: CapabilityKey;
  label: string;
  description: string;
  granted: boolean;
  notes?: string;
}

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

const INITIAL_CAPABILITIES: Capability[] = [
  {
    key: 'catalog_sync',
    label: 'Product / Catalog Sync',
    description: 'Push your product catalog, prices, and stock to TikTok Shop.',
    granted: true,
  },
  {
    key: 'content_publish',
    label: 'Content Publishing',
    description: 'Publish live showcases, short videos, and product ads via TikTok API.',
    granted: true,
  },
  {
    key: 'product_promotion',
    label: 'Product Promotion',
    description: 'Create flash deals, coupons, and bundles on TikTok Shop.',
    granted: true,
  },
  {
    key: 'order_sync',
    label: 'Order Synchronization',
    description: 'Pull TikTok Shop orders and push fulfillment status.',
    granted: true,
  },
  {
    key: 'performance_analytics',
    label: 'Performance Analytics',
    description: 'Access views, clicks, GMV, and conversion metrics.',
    granted: true,
    notes: 'Only summary-level metrics available on your plan.',
  },
];

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

const CAPABILITY_TINTS: Record<CapabilityKey, string> = {
  catalog_sync: 'bg-blue-50 text-blue-950 border-blue-100',
  content_publish: 'bg-pink-50 text-pink-700 border-pink-100',
  product_promotion: 'bg-amber-50 text-amber-700 border-amber-100',
  order_sync: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  performance_analytics: 'bg-purple-50 text-purple-700 border-purple-100',
};

const CAPABILITY_ICONS: Record<CapabilityKey, React.ComponentType<{ className?: string }>> = {
  catalog_sync: ShoppingBag,
  content_publish: Video,
  product_promotion: Megaphone,
  order_sync: ClipboardList,
  performance_analytics: BarChart3,
};

export default function TikTokShopPage() {
  const [isConnected, setIsConnected] = useState(true);
  const [activeTab, setActiveTab] = useState<TikTokTab>('Overview');
  const [capabilities, setCapabilities] = useState<Capability[]>(INITIAL_CAPABILITIES);
  const [products, setProducts] = useState<SyncedProduct[]>(INITIAL_PRODUCTS);
  const [content, setContent] = useState<TikTokContent[]>(INITIAL_CONTENT);
  const [promotions] = useState<TikTokPromotion[]>(INITIAL_PROMOTIONS);
  const [orders, setOrders] = useState<TikTokOrder[]>(INITIAL_ORDERS);

  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState('Hourly');
  const [defaultMarkup, setDefaultMarkup] = useState('8');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackdropActive, setIsBackdropActive] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<TikTokOrder | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showCapabilityModal, setShowCapabilityModal] = useState(false);

  const anyModalOpen =
    isBackdropActive || showDisconnectModal || selectedOrder !== null || showCapabilityModal;

  const capGranted = (key: CapabilityKey) =>
    capabilities.find((c) => c.key === key)?.granted ?? false;

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
        if (showDisconnectModal) setShowDisconnectModal(false);
        else if (selectedOrder) setSelectedOrder(null);
        else if (showCapabilityModal) setShowCapabilityModal(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen, showDisconnectModal, selectedOrder, showCapabilityModal]);

  const toast = (msg: string) => setToastMessage(msg);

  const handleOAuthConnect = () => {
    setIsBackdropActive(true);
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setIsBackdropActive(false);
      setIsConnected(true);
      toast('Connected to TikTok Shop');
    }, 1400);
  };

  const handleSyncNow = () => {
    if (!capGranted('catalog_sync')) {
      toast('Catalog sync not authorized for this account');
      return;
    }
    setIsBackdropActive(true);
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setIsBackdropActive(false);
      setProducts((prev) => prev.map((p) => (p.synced ? { ...p, lastSynced: 'Just now' } : p)));
      toast('Synced catalog & orders');
    }, 1100);
  };

  const handleToggleSyncProduct = (id: string) => {
    if (!capGranted('catalog_sync')) {
      toast('Catalog sync not authorized for this account');
      return;
    }
    setIsBackdropActive(true);
    setTimeout(() => {
      setIsBackdropActive(false);
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
    }, 500);
  };

  const handleSyncAll = () => {
    if (!capGranted('catalog_sync')) {
      toast('Catalog sync not authorized for this account');
      return;
    }
    setIsBackdropActive(true);
    setTimeout(() => {
      setIsBackdropActive(false);
      setProducts((prev) => prev.map((p) => ({ ...p, synced: true, lastSynced: 'Just now' })));
      toast('All products synced');
    }, 900);
  };

  const handleFulfillOrder = (orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!capGranted('order_sync')) {
      toast('Order sync not authorized for this account');
      return;
    }
    setIsBackdropActive(true);
    setTimeout(() => {
      setIsBackdropActive(false);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'Shipped' } : o)));
      toast('Order fulfillment initiated');
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'Shipped' } : null));
      }
    }, 700);
  };

  const handlePublishContent = () => {
    if (!capGranted('content_publish')) {
      toast('Content publishing not authorized for this account');
      return;
    }
    toast('Publish dialog would open');
  };

  const handleCreatePromotion = () => {
    if (!capGranted('product_promotion')) {
      toast('Product promotion not authorized for this account');
      return;
    }
    toast('Create promotion dialog would open');
  };

  const confirmDisconnect = () => {
    setShowDisconnectModal(false);
    setIsConnected(false);
    toast('Disconnected from TikTok Shop');
  };

  const toggleCapability = (key: CapabilityKey) => {
    setCapabilities((prev) =>
      prev.map((c) => (c.key === key ? { ...c, granted: !c.granted } : c))
    );
    const cap = capabilities.find((c) => c.key === key);
    if (cap) toast(`${cap.label} ${cap.granted ? 'revoked' : 'granted'} (simulated)`);
  };

  const TABS: { id: TikTokTab; label: string; icon: React.ComponentType<{ className?: string }>; capability?: CapabilityKey }[] = [
    { id: 'Overview', label: 'Overview', icon: TrendingUp },
    { id: 'Products', label: 'Products', icon: ShoppingBag, capability: 'catalog_sync' },
    { id: 'Content', label: 'Content', icon: Video, capability: 'content_publish' },
    { id: 'Promotions', label: 'Promotions', icon: Megaphone, capability: 'product_promotion' },
    { id: 'Orders', label: 'Orders', icon: ClipboardList, capability: 'order_sync' },
    { id: 'Analytics', label: 'Analytics', icon: BarChart3, capability: 'performance_analytics' },
    { id: 'Settings', label: 'Settings', icon: SettingsIcon },
  ];

  const visibleTabs = TABS.filter((t) => !t.capability || capGranted(t.capability));

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
                  className={`inline-block px-2 py-0.5 rounded-sm text-[13px] font-medium border ${isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {isConnected && (
                  <button
                    onClick={() => setShowCapabilityModal(true)}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-950 hover:underline"
                  >
                    <Info className="w-3 h-3" />
                    {capabilities.filter((c) => c.granted).length}/{capabilities.length} capabilities
                  </button>
                )}
              </h1>
              <p className="text-[13px] text-slate-500 truncate">
                Live storefront, synced inventory, promotions, and orders
              </p>
            </div>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCapabilityModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Capabilities
              </button>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing || !capGranted('catalog_sync')}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
                title={!capGranted('catalog_sync') ? 'Catalog sync not authorized' : undefined}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-950' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* CAPABILITY WARNING */}
        {isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
            <div className="text-[13px] flex-1 min-w-0">
              <p className="font-medium text-blue-950">Adaptive TikTok Shop integration</p>
              <p className="text-blue-800 mt-0.5">
                TikTok Shop API access is granted per merchant and per region. Only the functions
                your account has been authorised for are shown below. Unauthorised tabs and actions
                are hidden or disabled automatically.
              </p>
            </div>
            <button
              onClick={() => setShowCapabilityModal(true)}
              className="text-[13px] font-medium text-blue-950 hover:underline shrink-0"
            >
              Review
            </button>
          </div>
        )}

        {/* NOT CONNECTED */}
        {!isConnected ? (
          <div className="max-w-xl mx-auto my-8 bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
            <span className="w-12 h-12 rounded-sm bg-slate-900 text-white flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Connect your TikTok Shop
              </h2>
              <p className="text-[13px] text-slate-500 mt-1 max-w-md mx-auto">
                Sync your catalog, publish content, run promotions, and pull orders. Only the
                capabilities granted to your TikTok seller account will be activated.
              </p>
            </div>
            <button
              onClick={handleOAuthConnect}
              disabled={isSyncing}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-sm text-[13px] transition disabled:opacity-70 inline-flex items-center justify-center gap-1.5"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect TikTok Shop (OAuth)
                </>
              )}
            </button>
            <p className="text-[13px] text-slate-400">
              Secure API integration compliant with TikTok Shop Developer Terms.
            </p>
          </div>
        ) : (
          <>
            {/* CAPABILITY CHIPS */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-medium text-slate-500 inline-flex items-center gap-1 pr-1">
                <Link2 className="w-3 h-3" />
                Active capabilities:
              </span>
              {capabilities.map((cap) => {
                const Icon = CAPABILITY_ICONS[cap.key];
                return (
                  <span
                    key={cap.key}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[13px] font-medium border ${cap.granted
                        ? CAPABILITY_TINTS[cap.key]
                        : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                      }`}
                    title={cap.granted ? cap.description : `${cap.label} — not granted`}
                  >
                    <Icon className="w-3 h-3" />
                    {cap.label}
                  </span>
                );
              })}
            </div>

            {/* TABS */}
            <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5 overflow-x-auto max-w-full">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${activeTab === tab.id
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
            {activeTab === 'Products' && capGranted('catalog_sync') && (
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
                                className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${prod.synced
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
                                className={`px-2.5 py-2 rounded-sm font-medium text-[13px] border transition ${prod.synced
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
            {activeTab === 'Content' && capGranted('content_publish') && (
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
                          className={`absolute top-2 left-2 px-2 py-0.5 rounded-sm text-[13px] font-medium backdrop-blur-sm ${c.status === 'Published'
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
            {activeTab === 'Promotions' && capGranted('product_promotion') && (
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
                                className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${p.status === 'Active'
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
            {activeTab === 'Orders' && capGranted('order_sync') && (
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
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${ord.status === 'Delivered'
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
            {activeTab === 'Analytics' && capGranted('performance_analytics') && (
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
                        <Bar dataKey="views" fill="#ec4899" radius={[4, 4, 0, 0]} />
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

            {/* SETTINGS */}
            {activeTab === 'Settings' && (
              <div className="max-w-2xl bg-white border border-slate-200 rounded-sm p-2 space-y-3">
                <p className="text-[15px] font-semibold text-slate-900 border-b border-slate-100 pb-2 inline-flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-slate-900" />
                  TikTok Shop integration settings
                </p>

                <div className="space-y-3 text-[13px]">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      TikTok Shop ID (read-only)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value="TT_SHOP_KE_88492019382"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-600 font-mono"
                      />
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium px-3 py-2 rounded-sm text-[13px]">
                        Verified
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                    <p className="text-blue-800 text-[13px]">
                      Capabilities are determined by TikTok based on your seller tier, region, and
                      approved API access. Revoked capabilities are automatically hidden from the
                      navigation.
                    </p>
                  </div>

                  <label className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-sm p-2 cursor-pointer">
                    <div>
                      <p className="font-medium text-slate-900">Auto-sync catalog & inventory</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Sync stock quantities across both platforms
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoSync}
                      disabled={!capGranted('catalog_sync')}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-50"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Sync interval
                      </label>
                      <select
                        value={syncInterval}
                        onChange={(e) => setSyncInterval(e.target.value)}
                        disabled={!capGranted('catalog_sync')}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                      >
                        <option value="Real-time">Real-time (webhook)</option>
                        <option value="Hourly">Every hour</option>
                        <option value="Daily">Once daily</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Default markup %
                      </label>
                      <input
                        type="number"
                        value={defaultMarkup}
                        onChange={(e) => setDefaultMarkup(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-red-600">Disconnect TikTok Shop</p>
                      <p className="text-[13px] text-slate-400">
                        Halts automated inventory syncing and order ingestion.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDisconnectModal(true)}
                      className="bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                      Disconnect
                    </button>
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
              {selectedOrder.status === 'To Ship' && capGranted('order_sync') && (
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

      {/* CAPABILITY MODAL */}
      {showCapabilityModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setShowCapabilityModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-950" />
                  TikTok Shop capabilities
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Only authorised functions are enabled in this module
                </p>
              </div>
              <button
                onClick={() => setShowCapabilityModal(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-[13px]">
              {capabilities.map((cap) => {
                const Icon = CAPABILITY_ICONS[cap.key];
                return (
                  <div
                    key={cap.key}
                    className={`border rounded-sm p-2 flex items-start gap-2 ${cap.granted
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-slate-50 opacity-75'
                      }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-sm flex items-center justify-center border shrink-0 ${CAPABILITY_TINTS[cap.key]}`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{cap.label}</p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[13px] font-medium border ${cap.granted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {cap.granted ? (
                            <Unlock className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                          {cap.granted ? 'Granted' : 'Not granted'}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 mt-1">{cap.description}</p>
                      {cap.notes && (
                        <p className="text-[13px] text-slate-400 italic mt-1">Note: {cap.notes}</p>
                      )}

                      <button
                        onClick={() => toggleCapability(cap.key)}
                        className="mt-2 text-[13px] font-medium text-blue-950 hover:underline"
                      >
                        {cap.granted ? 'Simulate revoke' : 'Simulate grant'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowCapabilityModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCONNECT CONFIRM */}
      {showDisconnectModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setShowDisconnectModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl text-center space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-sm bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Disconnect TikTok Shop?
              </h3>
              <p className="text-slate-500 mt-1">
                Product inventory sync and order tracking will be disabled until reconnected.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-sm text-[13px]"
              >
                Disconnect
              </button>
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

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  color: '#0f172a',
  fontSize: '13px',
};