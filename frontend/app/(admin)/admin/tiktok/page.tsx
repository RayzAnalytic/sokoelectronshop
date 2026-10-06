'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Video,
  Radio,
  Users,
  BarChart3,
  Wallet,
  Settings as SettingsIcon,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  DollarSign,
  Clock,
  Truck,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Pencil,
  Trash2,
  Calendar,
  Loader2,
  RefreshCw,
  Download,
  Printer,
  UploadCloud,
  Image as ImageIcon,
  Film,
  Play,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminDirectProduct,
  AdminDirectProductStatus,
  AdminDirectProductWrite,
  AdminDirectOrder,
  AdminDirectOrderStatus,
  AdminDirectOrderSource,
  AdminDirectContent,
  AdminDirectContentPlatform,
  AdminDirectContentStatus,
  AdminDirectContentWrite,
  AdminDirectLive,
  AdminDirectLiveStatus,
  AdminDirectCreator,
  AdminDirectCreatorStatus,
  AdminDirectCreatorWrite,
} from '@/lib/admin-types';

// ═══════════════════════════════════════════════════════════════════════════
// BRAND (change these two lines to rename the shop everywhere in the UI)
// ═══════════════════════════════════════════════════════════════════════════

const SHOP_NAME = 'Social Shop';
const SHOP_BADGE = 'SS';

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Tab =
  | 'Dashboard'
  | 'Products'
  | 'Orders'
  | 'Content'
  | 'LIVE Sessions'
  | 'Creators'
  | 'Analytics'
  | 'Finance'
  | 'Settings';

/**
 * `AdminDirectLiveWrite` is NOT exported from `@/lib/admin-types` today.
 * We declare it locally so the Schedule-LIVE modal type-checks.
 */
type AdminDirectLiveWrite = {
  title: string;
  hostName?: string;
  scheduledAt?: string | null;
  status?: AdminDirectLiveStatus;
};

/**
 * Local extension: `videoUrl` is NOT on AdminDirectContent / Write today.
 * Add it to admin-types.ts once the backend supports it.
 */
type ContentWithVideo = AdminDirectContent & { videoUrl?: string | null };
type ContentWriteWithVideo = AdminDirectContentWrite & {
  videoUrl?: string | null;
};

/** Local extension: optional product demo video. */
type ProductWithVideo = AdminDirectProduct & { videoUrl?: string | null };
type ProductWriteWithVideo = AdminDirectProductWrite & {
  videoUrl?: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOAD HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upload a file to the backend and return its public URL.
 *
 * The endpoint `/api/admin/uploads/` should:
 *   - accept multipart/form-data with fields: `file` and `kind` ("image"|"video")
 *   - validate mime type + size
 *   - store the file (S3 / Cloudinary / local media dir)
 *   - respond with JSON: { url: "https://..." }
 *
 * If the backend is not ready yet, the upload components fall back to a
 * local data-URL preview so the form is still usable.
 */
async function uploadFile(
  file: File,
  kind: 'image' | 'video',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);

  const res = await fetch('/api/admin/uploads/', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Upload failed (${res.status})`);
  }
  const data = (await res.json()) as { url?: string };
  if (!data?.url) throw new Error('Upload response is missing a url');
  return data.url;
}

/** Read a file as a data URL (used for local fallback preview). */
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; //  5 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const KES = (n: number | string | null | undefined) => {
  if (n === null || n === undefined) return 'KES —';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return 'KES —';
  return `KES ${num.toLocaleString('en-KE')}`;
};

const sourceLabel = (s: AdminDirectOrderSource) =>
  s === 'whatsapp' ? 'WhatsApp' : s === 'phone' ? 'Phone' : 'Admin';

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const toLocalInputValue = (iso: string | null | undefined) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

// ── Chart / KPI static data ──

const REVENUE_CHART_DATA = [
  { day: 'Mon', revenue: 12400 },
  { day: 'Tue', revenue: 18900 },
  { day: 'Wed', revenue: 15200 },
  { day: 'Thu', revenue: 24500 },
  { day: 'Fri', revenue: 31200 },
  { day: 'Sat', revenue: 45000 },
  { day: 'Sun', revenue: 38400 },
];

const ORDERS_BY_SOURCE = [
  { name: 'WhatsApp', value: 54, color: '#22c55e' },
  { name: 'Admin', value: 31, color: '#8b5cf6' },
  { name: 'Phone', value: 15, color: '#3b82f6' },
];

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '2px',
  color: '#0f172a',
  fontSize: '13px',
};

// ── Badge class helpers ──

const productStatusBadge = (s: AdminDirectProductStatus) =>
  s === 'Active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Draft'
      ? 'bg-slate-100 text-slate-600 border-slate-200'
      : 'bg-amber-50 text-amber-700 border-amber-100';

const orderStatusBadge = (s: AdminDirectOrderStatus) =>
  s === 'Delivered'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Shipped' || s === 'Awaiting Shipment'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : s === 'Paid'
        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
        : s === 'Cancelled' || s === 'Returned'
          ? 'bg-red-50 text-red-700 border-red-100'
          : 'bg-amber-50 text-amber-700 border-amber-100';

const contentStatusBadge = (s: AdminDirectContentStatus) =>
  s === 'Posted'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Scheduled'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : s === 'Archived'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';

const liveStatusBadge = (s: AdminDirectLiveStatus) =>
  s === 'Live'
    ? 'bg-red-50 text-red-700 border-red-100'
    : s === 'Ended'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Cancelled'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : 'bg-blue-50 text-blue-950 border-blue-100';

const creatorStatusBadge = (s: AdminDirectCreatorStatus) =>
  s === 'Active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : 'bg-slate-100 text-slate-600 border-slate-200';

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════

const TABS: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Products', label: 'Products', icon: Package },
    { id: 'Orders', label: 'Orders', icon: ClipboardList },
    { id: 'Content', label: 'Content', icon: Video },
    { id: 'LIVE Sessions', label: 'LIVE Sessions', icon: Radio },
    { id: 'Creators', label: 'Creators', icon: Users },
    { id: 'Analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'Finance', label: 'Finance', icon: Wallet },
    { id: 'Settings', label: 'Settings', icon: SettingsIcon },
  ];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function SocialShopPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');

  const [products, setProducts] = useState<AdminDirectProduct[]>([]);
  const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
  const [content, setContent] = useState<AdminDirectContent[]>([]);
  const [lives, setLives] = useState<AdminDirectLive[]>([]);
  const [creators, setCreators] = useState<AdminDirectCreator[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [logOrderOpen, setLogOrderOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminDirectOrder | null>(
    null,
  );

  const [addContentOpen, setAddContentOpen] = useState(false);
  const [scheduleLiveOpen, setScheduleLiveOpen] = useState(false);
  const [addCreatorOpen, setAddCreatorOpen] = useState(false);

  // ═══ DATA LOADING ═══

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    const results = await Promise.allSettled([
      adminApi.directOrders.products.list(),
      adminApi.directOrders.orders.list(),
      adminApi.directOrders.content.list(),
      adminApi.directOrders.lives.list(),
      adminApi.directOrders.creators.list(),
    ]);

    if (results[0].status === 'fulfilled') setProducts(results[0].value);
    if (results[1].status === 'fulfilled') setOrders(results[1].value);
    if (results[2].status === 'fulfilled') setContent(results[2].value);
    if (results[3].status === 'fulfilled') setLives(results[3].value);
    if (results[4].status === 'fulfilled') setCreators(results[4].value);

    const allFailed = results.every((r) => r.status === 'rejected');
    if (allFailed) {
      const first = results[0] as PromiseRejectedResult;
      setLoadError(
        first.reason instanceof Error
          ? first.reason.message
          : 'Failed to load shop data',
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Escape-to-close + body scroll lock ──
  useEffect(() => {
    const anyModal =
      logOrderOpen ||
      addProductOpen ||
      addContentOpen ||
      scheduleLiveOpen ||
      addCreatorOpen ||
      !!selectedOrder;
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedOrder) setSelectedOrder(null);
      else if (logOrderOpen) setLogOrderOpen(false);
      else if (addProductOpen) setAddProductOpen(false);
      else if (addContentOpen) setAddContentOpen(false);
      else if (scheduleLiveOpen) setScheduleLiveOpen(false);
      else if (addCreatorOpen) setAddCreatorOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [
    logOrderOpen,
    addProductOpen,
    addContentOpen,
    scheduleLiveOpen,
    addCreatorOpen,
    selectedOrder,
  ]);

  // ═══ DERIVED STATS ═══

  const stats = useMemo(() => {
    const ordersMonth = orders.length;
    const revenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
    const pendingShipment = orders.filter(
      (o) => o.status === 'Paid' || o.status === 'Awaiting Shipment',
    ).length;
    const activeCreators = creators.filter((c) => c.status === 'Active').length;
    return { ordersMonth, revenue, pendingShipment, activeCreators };
  }, [orders, creators]);

  // ═══ MUTATIONS ═══

  const handleAddProduct = async (payload: AdminDirectProductWrite) => {
    try {
      const created = await adminApi.directOrders.products.create(payload);
      setProducts((prev) => [created, ...prev]);
      setToast(`"${created.name}" added to ${SHOP_NAME} products`);
      setAddProductOpen(false);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to create product');
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}" from ${SHOP_NAME} products?`)) return;
    try {
      await adminApi.directOrders.products.remove(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setToast(`"${name}" removed`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to remove product');
    }
  };

  const advanceOrderStatus = async (
    reference: string,
    next: AdminDirectOrderStatus,
  ) => {
    try {
      const updated = await adminApi.directOrders.orders.advance(reference, {
        status: next,
      });
      setOrders((prev) =>
        prev.map((o) => (o.reference === reference ? updated : o)),
      );
      if (selectedOrder?.reference === reference) setSelectedOrder(updated);
      setToast(`Order moved to "${next}"`);
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : 'Failed to update order status',
      );
    }
  };

  const handleLogOrder = (newOrder: AdminDirectOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    setToast(`Order ${newOrder.reference} logged locally`);
    setLogOrderOpen(false);
  };

  const handleAddContent = async (payload: AdminDirectContentWrite) => {
    try {
      const created = await adminApi.directOrders.content.create(payload);
      setContent((prev) => [created, ...prev]);
      setToast(`Content "${created.title}" added`);
      setAddContentOpen(false);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to add content');
    }
  };

  const handleScheduleLive = async (payload: AdminDirectLiveWrite) => {
    try {
      const created = await adminApi.directOrders.lives.create(payload);
      setLives((prev) => [created, ...prev]);
      setToast(`LIVE "${created.title}" scheduled`);
      setScheduleLiveOpen(false);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to schedule LIVE');
    }
  };

  const handleAddCreator = async (payload: AdminDirectCreatorWrite) => {
    try {
      const created = await adminApi.directOrders.creators.create(payload);
      setCreators((prev) => [created, ...prev]);
      setToast(`Creator "${created.name}" added`);
      setAddCreatorOpen(false);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to add creator');
    }
  };

  // ═══ RENDER ═══

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">
      {toast && (
        <div className="fixed bottom-3 right-3 z-[120] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-slate-900 text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
              {SHOP_BADGE}
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-900 truncate">
                {SHOP_NAME}
              </h1>
              <p className="text-[13px] text-slate-500 truncate">
                Manage your social orders, products, content, and creators — all
                in one place.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void loadAll(true)}
              disabled={refreshing || loading}
              aria-label="Refresh"
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px] disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              onClick={() => setLogOrderOpen(true)}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Plus className="w-3.5 h-3.5" />
              Log New Order
            </button>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-3 pb-0">
          <div className="flex items-center gap-0.5 overflow-x-auto -mb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${active
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-red-900">
                Couldn&apos;t load {SHOP_NAME} data
              </p>
              <p className="text-[13px] text-red-800 mt-0.5">{loadError}</p>
            </div>
            <button
              onClick={() => void loadAll(true)}
              className="text-[13px] font-medium text-red-900 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-sm p-12 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px]">Loading {SHOP_NAME} data…</span>
          </div>
        ) : (
          <>
            {tab === 'Dashboard' && (
              <DashboardTab
                stats={stats}
                orders={orders}
                products={products}
                creators={creators}
                onCreateOrder={() => setLogOrderOpen(true)}
                onAddProduct={() => setAddProductOpen(true)}
                onScheduleLive={() => setScheduleLiveOpen(true)}
                onGoToOrders={() => setTab('Orders')}
                onGoToProducts={() => setTab('Products')}
              />
            )}

            {tab === 'Products' && (
              <ProductsTab
                products={products}
                onAddProduct={() => setAddProductOpen(true)}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {tab === 'Orders' && (
              <OrdersTab
                orders={orders}
                onSelectOrder={setSelectedOrder}
                onAdvance={advanceOrderStatus}
                onLogOrder={() => setLogOrderOpen(true)}
              />
            )}

            {tab === 'Content' && (
              <ContentTab
                content={content}
                onAddContent={() => setAddContentOpen(true)}
              />
            )}

            {tab === 'LIVE Sessions' && (
              <LiveTab
                lives={lives}
                onScheduleLive={() => setScheduleLiveOpen(true)}
              />
            )}

            {tab === 'Creators' && (
              <CreatorsTab
                creators={creators}
                onAddCreator={() => setAddCreatorOpen(true)}
              />
            )}

            {tab === 'Analytics' && <AnalyticsTab />}
            {tab === 'Finance' && (
              <FinanceTab orders={orders} creators={creators} />
            )}
            {tab === 'Settings' && <SettingsTab />}
          </>
        )}
      </main>

      {logOrderOpen && (
        <LogOrderModal
          onClose={() => setLogOrderOpen(false)}
          onSubmit={handleLogOrder}
          products={products}
        />
      )}

      {addProductOpen && (
        <AddProductModal
          onClose={() => setAddProductOpen(false)}
          onSubmit={handleAddProduct}
        />
      )}

      {addContentOpen && (
        <AddContentModal
          onClose={() => setAddContentOpen(false)}
          onSubmit={handleAddContent}
        />
      )}

      {scheduleLiveOpen && (
        <ScheduleLiveModal
          onClose={() => setScheduleLiveOpen(false)}
          onSubmit={handleScheduleLive}
        />
      )}

      {addCreatorOpen && (
        <AddCreatorModal
          onClose={() => setAddCreatorOpen(false)}
          onSubmit={handleAddCreator}
        />
      )}

      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAdvance={(next) =>
            void advanceOrderStatus(selectedOrder.reference, next)
          }
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD COMPONENTS (new)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reusable image picker + uploader.
 *
 * Shows a click-to-select tile; on file select it:
 *   1. shows an instant local preview via FileReader
 *   2. uploads to /api/admin/uploads/ and swaps in the real URL
 *   3. falls back to the data-URL if the upload endpoint fails
 */
function ImageUpload({
  label,
  helper,
  value,
  onChange,
  required,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WEBP…).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    // 1) instant local preview
    let localPreview = '';
    try {
      localPreview = await readAsDataURL(file);
      onChange(localPreview);
    } catch {
      /* ignore – we'll still try to upload */
    }

    // 2) upload to backend
    setUploading(true);
    try {
      const url = await uploadFile(file, 'image');
      onChange(url);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — preview kept locally until you retry.`
          : 'Upload failed. Preview kept locally.',
      );
      // we keep the localPreview so the form is still usable
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const clear = () => {
    onChange('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handlePick}
        className="relative cursor-pointer border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-sm aspect-video flex items-center justify-center overflow-hidden bg-slate-50 transition"
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="text-center px-3 py-6">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-slate-400 mx-auto animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
            )}
            <p className="text-[12px] font-medium text-slate-700 mt-2">
              {uploading ? 'Uploading…' : 'Click or drop an image here'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              JPG, PNG or WEBP — up to 5 MB
            </p>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePick();
          }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:underline"
        >
          <ImageIcon className="w-3 h-3" />
          {value ? 'Replace image' : 'Choose image'}
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-600 hover:underline"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {helper && !error && (
        <p className="text-[11px] text-slate-500 mt-1">{helper}</p>
      )}
      {error && (
        <p className="text-[11px] text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

/**
 * Reusable video picker + uploader. Same pattern as ImageUpload but
 * renders an inline <video> player for the preview.
 */
function VideoUpload({
  label,
  helper,
  value,
  onChange,
  required,
  poster,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  poster?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file (MP4, MOV, WEBM…).');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError('Video must be smaller than 100 MB.');
      return;
    }

    let localPreview = '';
    try {
      localPreview = await readAsDataURL(file);
      onChange(localPreview);
    } catch {
      /* ignore */
    }

    setUploading(true);
    try {
      const url = await uploadFile(file, 'video');
      onChange(url);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — preview kept locally until you retry.`
          : 'Upload failed. Preview kept locally.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const clear = () => {
    onChange('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-sm overflow-hidden bg-slate-50 transition"
      >
        {value ? (
          <div className="relative">
            <video
              src={value}
              poster={poster || undefined}
              controls
              playsInline
              className="w-full aspect-video bg-black object-contain"
            />
            {uploading && (
              <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={handlePick}
            className="cursor-pointer text-center px-3 py-10"
          >
            {uploading ? (
              <Loader2 className="w-7 h-7 text-slate-400 mx-auto animate-spin" />
            ) : (
              <Film className="w-7 h-7 text-slate-400 mx-auto" />
            )}
            <p className="text-[12px] font-medium text-slate-700 mt-2">
              {uploading ? 'Uploading video…' : 'Click or drop a video here'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              MP4, MOV or WEBM — up to 100 MB
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePick();
          }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:underline"
        >
          <Film className="w-3 h-3" />
          {value ? 'Replace video' : 'Choose video'}
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-600 hover:underline"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {helper && !error && (
        <p className="text-[11px] text-slate-500 mt-1">{helper}</p>
      )}
      {error && (
        <p className="text-[11px] text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function DashboardTab({
  stats,
  orders,
  products,
  creators,
  onCreateOrder,
  onAddProduct,
  onScheduleLive,
  onGoToOrders,
  onGoToProducts,
}: {
  stats: {
    ordersMonth: number;
    revenue: number;
    pendingShipment: number;
    activeCreators: number;
  };
  orders: AdminDirectOrder[];
  products: AdminDirectProduct[];
  creators: AdminDirectCreator[];
  onCreateOrder: () => void;
  onAddProduct: () => void;
  onScheduleLive: () => void;
  onGoToOrders: () => void;
  onGoToProducts: () => void;
}) {
  const overdue = orders.filter(
    (o) => o.status === 'Awaiting Shipment' || o.status === 'Paid',
  );
  const lowStock = products.filter(
    (p) => p.stockQuantity > 0 && p.stockQuantity <= 5,
  );
  const unpaidCommissions = creators.filter(
    (c) => Number(c.commissionOwed || 0) > 0,
  );

  if (orders.length === 0 && products.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white border border-slate-200 rounded-sm p-6 text-center space-y-3">
        <span className="w-12 h-12 rounded-sm bg-slate-900 text-white flex items-center justify-center mx-auto">
          <ShoppingBag className="w-6 h-6" />
        </span>
        <h2 className="text-[15px] font-semibold text-slate-900">
          No activity yet. Start by adding a product or logging your first
          order.
        </h2>
        <div className="flex justify-center gap-2 pt-1">
          <button
            onClick={onAddProduct}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <Package className="w-3.5 h-3.5" />
            Add Product
          </button>
          <button
            onClick={onCreateOrder}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Log New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Orders"
          value={String(stats.ordersMonth)}
          helper="Total orders logged from social channels this month"
          icon={<ClipboardList className="w-4 h-4" />}
          tint="bg-blue-50 text-blue-950"
        />
        <KpiCard
          label="Revenue"
          value={KES(stats.revenue)}
          helper="Total sales from social-sourced orders (KES)"
          icon={<DollarSign className="w-4 h-4" />}
          tint="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          label="Pending Shipment"
          value={String(stats.pendingShipment)}
          helper="Orders paid but not yet shipped"
          icon={<Truck className="w-4 h-4" />}
          tint="bg-amber-50 text-amber-700"
        />
        <KpiCard
          label="Active Creators"
          value={String(stats.activeCreators)}
          helper="Creators currently promoting your products"
          icon={<Users className="w-4 h-4" />}
          tint="bg-purple-50 text-purple-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-[13px] font-semibold text-slate-900">
              Action Needed
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Items that need your attention right now — overdue shipments,
              out-of-stock products, and unpaid creator commissions.
            </p>
          </div>
          <div className="p-3 space-y-2">
            {overdue.length === 0 &&
              lowStock.length === 0 &&
              unpaidCommissions.length === 0 && (
                <p className="text-[13px] text-slate-500 py-6 text-center">
                  You&apos;re all caught up. Nothing needs your attention right
                  now.
                </p>
              )}

            {overdue.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-sm p-2 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-amber-900">
                    {overdue.length} order{overdue.length > 1 ? 's' : ''}{' '}
                    awaiting shipment
                  </p>
                  <p className="text-[13px] text-amber-800 mt-0.5">
                    Customers paid but the items haven&apos;t been dispatched
                    yet.
                  </p>
                  <button
                    onClick={onGoToOrders}
                    className="text-[13px] font-medium text-amber-900 hover:underline mt-1"
                  >
                    View orders →
                  </button>
                </div>
              </div>
            )}

            {lowStock.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-sm p-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-red-900">
                    {lowStock.length} product{lowStock.length > 1 ? 's' : ''}{' '}
                    running low
                  </p>
                  <p className="text-[13px] text-red-800 mt-0.5">
                    {lowStock.map((p) => p.name).join(' · ')}
                  </p>
                  <button
                    onClick={onGoToProducts}
                    className="text-[13px] font-medium text-red-900 hover:underline mt-1"
                  >
                    Update stock →
                  </button>
                </div>
              </div>
            )}

            {unpaidCommissions.length > 0 && (
              <div className="border border-blue-200 bg-blue-50 rounded-sm p-2 flex items-start gap-2">
                <Wallet className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-blue-950">
                    {unpaidCommissions.length} creator commission
                    {unpaidCommissions.length > 1 ? 's' : ''} unpaid
                  </p>
                  <p className="text-[13px] text-blue-800 mt-0.5">
                    {unpaidCommissions.map((c) => c.name).join(' · ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-[13px] font-semibold text-slate-900">
              Quick Actions
            </p>
          </div>
          <div className="p-3 space-y-2">
            <QuickAction
              icon={<ClipboardList className="w-3.5 h-3.5" />}
              title="Log New Order"
              description="Record a sale that came from social media"
              onClick={onCreateOrder}
            />
            <QuickAction
              icon={<Package className="w-3.5 h-3.5" />}
              title="Add Product"
              description="Add an item you promote on social media"
              onClick={onAddProduct}
            />
            <QuickAction
              icon={<Radio className="w-3.5 h-3.5" />}
              title="Schedule LIVE"
              description="Plan an upcoming livestream session"
              onClick={onScheduleLive}
            />
            <QuickAction
              icon={<Wallet className="w-3.5 h-3.5" />}
              title="Record Payment"
              description="Log a creator commission payment"
              onClick={() => { }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  tint,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500 truncate">
          {label}
        </p>
        <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
          {value}
        </p>
        <p className="text-[12px] text-slate-400 mt-0.5">{helper}</p>
      </div>
      <span
        className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}
      >
        {icon}
      </span>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-sm p-2 flex items-start gap-2 transition"
    >
      <span className="w-7 h-7 rounded-sm bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

function ProductsTab({
  products,
  onAddProduct,
  onDeleteProduct,
}: {
  products: AdminDirectProduct[];
  onAddProduct: () => void;
  onDeleteProduct: (id: number, name: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">
            {SHOP_NAME} Products
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Products you promote on social media. Keep prices, stock, and
            details updated here.
          </p>
        </div>
        <button
          onClick={onAddProduct}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="No products added yet. Add your first product to start tracking sales and content."
          action={{
            label: 'Add Product',
            onClick: onAddProduct,
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <>
          <p className="text-[13px] text-slate-500 px-1">
            These are the products you actively promote on social media. Stock
            levels here are separate from your website unless you link them.
          </p>
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Product</th>
                    <th className="py-2 px-3 font-medium">SKU</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                    <th className="py-2 px-3 font-medium text-right">Stock</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium text-right">
                      Direct sales
                    </th>
                    <th className="py-2 px-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image}
                              alt=""
                              className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="w-9 h-9 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-slate-400" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-xs">
                              {p.name}
                            </p>
                            {(p.brand || p.category) && (
                              <p className="text-[12px] text-slate-400 truncate">
                                {[p.brand, p.category]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {p.sku || '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-medium text-slate-900">
                          {KES(p.price)}
                        </span>
                        {p.compareAtPrice && (
                          <span className="block text-[12px] text-slate-400 line-through">
                            {KES(p.compareAtPrice)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={
                            p.stockQuantity === 0
                              ? 'text-red-600 font-medium'
                              : p.stockQuantity <= 5
                                ? 'text-amber-700 font-medium'
                                : 'text-slate-700'
                          }
                        >
                          {p.stockQuantity}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${productStatusBadge(p.status)}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <p className="font-medium text-slate-900">
                          {p.directSalesCount}
                        </p>
                        <p className="text-[12px] text-slate-400">
                          {KES(p.directRevenue)}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500"
                            aria-label="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(p.id, p.name)}
                            className="p-1.5 rounded-sm hover:bg-red-50 text-slate-500 hover:text-red-600"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ORDERS
// ═══════════════════════════════════════════════════════════════════════════

const ORDER_TABS: {
  id: AdminDirectOrderStatus | 'All';
  label: string;
  helper: string;
}[] = [
    { id: 'All', label: 'All', helper: "Every order you've logged" },
    { id: 'New', label: 'New', helper: 'Just logged, not yet confirmed' },
    {
      id: 'Awaiting Payment',
      label: 'Awaiting Payment',
      helper: 'Order placed, payment not received',
    },
    { id: 'Paid', label: 'Paid', helper: 'Payment confirmed, ready to ship' },
    {
      id: 'Awaiting Shipment',
      label: 'Awaiting Shipment',
      helper: 'Paid but not yet dispatched',
    },
    { id: 'Shipped', label: 'Shipped', helper: 'On the way to the customer' },
    { id: 'Delivered', label: 'Delivered', helper: 'Customer has received the order' },
    { id: 'Cancelled', label: 'Cancelled', helper: 'Order was cancelled' },
    { id: 'Returned', label: 'Returned', helper: 'Customer returned the item' },
  ];

function OrdersTab({
  orders,
  onSelectOrder,
  onAdvance,
  onLogOrder,
}: {
  orders: AdminDirectOrder[];
  onSelectOrder: (o: AdminDirectOrder) => void;
  onAdvance: (reference: string, next: AdminDirectOrderStatus) => void;
  onLogOrder: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<
    AdminDirectOrderStatus | 'All'
  >('All');

  const filtered =
    statusFilter === 'All'
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Orders</p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Log and track every sale that comes from social media — videos,
            LIVE sessions, or DMs.
          </p>
        </div>
        <button
          onClick={onLogOrder}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Log New Order
        </button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title="No orders logged yet. When a customer buys through social media, log the order here."
          action={{
            label: 'Log New Order',
            onClick: onLogOrder,
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-sm p-0.5 flex items-center gap-0.5 overflow-x-auto">
            {ORDER_TABS.map((s) => {
              const count =
                s.id === 'All'
                  ? orders.length
                  : orders.filter((o) => o.status === s.id).length;
              const active = statusFilter === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  title={s.helper}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[12px] font-medium whitespace-nowrap transition ${active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {s.label}
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded-sm text-[11px] font-medium ${active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-slate-400 text-[13px]"
                      >
                        No orders with status &ldquo;{statusFilter}&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((o) => {
                      const firstItem = o.items[0];
                      return (
                        <tr
                          key={o.reference}
                          onClick={() => onSelectOrder(o)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-3 font-mono font-medium text-slate-900">
                            {o.reference}
                          </td>
                          <td className="py-2 px-3">
                            <p className="text-slate-800">{o.customerName}</p>
                            <p className="text-[12px] text-slate-400">
                              {sourceLabel(o.source)}
                            </p>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {firstItem?.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={firstItem.image}
                                  alt=""
                                  className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 shrink-0" />
                              )}
                              <span className="text-slate-600 truncate max-w-[220px]">
                                {firstItem?.productName || '—'}
                                {o.items.length > 1 &&
                                  ` +${o.items.length - 1}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900">
                            {KES(o.total)}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${orderStatusBadge(o.status)}`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td
                            className="py-2 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {o.status === 'Paid' && (
                              <button
                                onClick={() =>
                                  onAdvance(o.reference, 'Awaiting Shipment')
                                }
                                className="px-2.5 py-1.5 rounded-sm bg-slate-900 hover:bg-slate-800 text-white font-medium text-[12px]"
                              >
                                Mark shipped
                              </button>
                            )}
                            {o.status === 'Awaiting Shipment' && (
                              <button
                                onClick={() =>
                                  onAdvance(o.reference, 'Shipped')
                                }
                                className="px-2.5 py-1.5 rounded-sm bg-slate-900 hover:bg-slate-800 text-white font-medium text-[12px]"
                              >
                                Ship
                              </button>
                            )}
                            {o.status === 'Shipped' && (
                              <button
                                onClick={() =>
                                  onAdvance(o.reference, 'Delivered')
                                }
                                className="px-2.5 py-1.5 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[12px]"
                              >
                                Mark delivered
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: CONTENT
// ═══════════════════════════════════════════════════════════════════════════

function ContentTab({
  content,
  onAddContent,
}: {
  content: AdminDirectContent[];
  onAddContent: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Content</p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Plan, schedule, and track the videos and posts that promote your
            products.
          </p>
        </div>
        <button
          onClick={onAddContent}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Content
        </button>
      </div>

      {content.length === 0 ? (
        <EmptyState
          icon={<Video className="w-6 h-6" />}
          title="No content planned yet. Create your first post idea to get started."
          action={{
            label: 'Add Content',
            onClick: onAddContent,
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <>
          <p className="text-[13px] text-slate-500 px-1">
            Track every video or photo post you create. Enter performance
            numbers after posting to see what works best.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {content.map((cRaw) => {
              const c = cRaw as ContentWithVideo;
              return (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                >
                  <div className="relative aspect-video w-full bg-slate-900">
                    {c.videoUrl ? (
                      <video
                        src={c.videoUrl}
                        poster={c.thumbnailUrl || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover bg-black"
                      />
                    ) : c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-slate-500" />
                      </div>
                    )}
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-sm text-[12px] font-medium backdrop-blur-sm border ${contentStatusBadge(c.status)}`}
                    >
                      {c.status}
                    </span>
                    <span className="absolute top-2 right-2 bg-slate-900/80 text-white px-2 py-0.5 rounded-sm text-[12px] font-medium backdrop-blur-sm inline-flex items-center gap-1">
                      {c.videoUrl && <Play className="w-3 h-3" />}
                      {c.platform}
                    </span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <p className="text-[13px] font-medium text-slate-900 truncate">
                      {c.title}
                    </p>
                    {c.scheduledAt && (
                      <p className="text-[12px] text-slate-400 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(c.scheduledAt)}
                      </p>
                    )}
                    {c.caption && (
                      <p className="text-[12px] text-blue-800 truncate">
                        {c.caption}
                      </p>
                    )}
                    {c.productName && (
                      <p className="text-[12px] text-slate-500 truncate">
                        Features: {c.productName}
                      </p>
                    )}
                    {c.status === 'Posted' && (
                      <div className="flex items-center gap-3 pt-1.5 border-t border-slate-100 mt-1 text-[12px]">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Eye className="w-3 h-3" />
                          {c.views.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Heart className="w-3 h-3" />
                          {c.likes.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <MessageCircle className="w-3 h-3" />
                          {c.comments}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: LIVE SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

function LiveTab({
  lives,
  onScheduleLive,
}: {
  lives: AdminDirectLive[];
  onScheduleLive: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">
            LIVE Sessions
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Plan and track your livestream selling sessions.
          </p>
        </div>
        <button
          onClick={onScheduleLive}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule LIVE
        </button>
      </div>

      {lives.length === 0 ? (
        <EmptyState
          icon={<Radio className="w-6 h-6" />}
          title="No LIVE sessions scheduled. Plan your first livestream to start selling live."
          action={{
            label: 'Schedule LIVE',
            onClick: onScheduleLive,
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <>
          <p className="text-[13px] text-slate-500 px-1">
            Track every livestream you run. Record the results after each
            session to see what works.
          </p>
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Session</th>
                    <th className="py-2 px-3 font-medium">Scheduled</th>
                    <th className="py-2 px-3 font-medium text-center">
                      Peak viewers
                    </th>
                    <th className="py-2 px-3 font-medium text-center">Orders</th>
                    <th className="py-2 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lives.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900">{l.title}</p>
                        <p className="text-[12px] text-slate-400">
                          {l.hostName || '—'}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {l.scheduledAt
                          ? new Date(l.scheduledAt).toLocaleString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {l.peakViewers ? l.peakViewers.toLocaleString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {l.ordersCount || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-emerald-700">
                        {Number(l.revenue || 0) ? KES(l.revenue) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${liveStatusBadge(l.status)}`}
                        >
                          {l.status}
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: CREATORS
// ═══════════════════════════════════════════════════════════════════════════

function CreatorsTab({
  creators,
  onAddCreator,
}: {
  creators: AdminDirectCreator[];
  onAddCreator: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Creators</p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Track the creators who promote your products and manage their
            commissions.
          </p>
        </div>
        <button
          onClick={onAddCreator}
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Creator
        </button>
      </div>

      {creators.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No creators added yet. Add a creator to start tracking their sales and commissions."
          action={{
            label: 'Add Creator',
            onClick: onAddCreator,
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <>
          <p className="text-[13px] text-slate-500 px-1">
            These are the creators you work with. Track their sales, calculate
            commissions, and record payments here.
          </p>
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Creator</th>
                    <th className="py-2 px-3 font-medium">Platform</th>
                    <th className="py-2 px-3 font-medium text-center">Rate</th>
                    <th className="py-2 px-3 font-medium text-center">Orders</th>
                    <th className="py-2 px-3 font-medium text-right">Owed</th>
                    <th className="py-2 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creators.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {c.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.avatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">
                              {c.name}
                            </p>
                            <p className="text-[12px] text-slate-400 font-mono">
                              {c.handle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {c.platform || '—'}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {c.commissionRate}%
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {c.ordersCount}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-amber-700">
                        {Number(c.commissionOwed || 0)
                          ? KES(c.commissionOwed)
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {KES(c.revenue)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${creatorStatusBadge(c.status)}`}
                        >
                          {c.status}
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2">
        <p className="text-[13px] font-semibold text-slate-900">Analytics</p>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Track how your social activity translates into sales.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Total Revenue"
          value={KES(148250)}
          helper="All sales from social-sourced orders"
          icon={<DollarSign className="w-4 h-4" />}
          tint="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          label="Total Orders"
          value="286"
          helper="Number of orders from social media"
          icon={<ClipboardList className="w-4 h-4" />}
          tint="bg-blue-50 text-blue-950"
        />
        <KpiCard
          label="Average Order Value"
          value={KES(5184)}
          helper="Average amount spent per order"
          icon={<TrendingUp className="w-4 h-4" />}
          tint="bg-purple-50 text-purple-700"
        />
        <KpiCard
          label="Creator Commissions"
          value={KES(30350)}
          helper="Total commissions earned by creators"
          icon={<Users className="w-4 h-4" />}
          tint="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <p className="text-[13px] font-semibold text-slate-900">
            Revenue Trend
          </p>
          <p className="text-[12px] text-slate-500">
            Your revenue over the last 30 days
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REVENUE_CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
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
          <p className="text-[13px] font-semibold text-slate-900">
            Orders by Source
          </p>
          <p className="text-[12px] text-slate-500">
            Where your orders come from — WhatsApp, admin, or phone
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ORDERS_BY_SOURCE}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {ORDERS_BY_SOURCE.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 space-y-2">
        <p className="text-[13px] font-semibold text-blue-950">
          Manual Metrics
        </p>
        <p className="text-[13px] text-blue-800">
          Social platforms don&apos;t share view and follower data with your
          website, so enter these numbers manually each week to track your
          reach.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <ManualField
            label="Weekly Views"
            helper="Total views on your content this week"
            value="70300"
          />
          <ManualField
            label="Followers Gained"
            helper="New followers this week"
            value="1240"
          />
          <ManualField
            label="Profile Visits"
            helper="How many people visited your profile"
            value="8420"
          />
          <ManualField
            label="Link Clicks"
            helper="How many people clicked the link to your website"
            value="1860"
          />
        </div>
      </div>
    </div>
  );
}

function ManualField({
  label,
  helper,
  value,
}: {
  label: string;
  helper: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-blue-100 rounded-sm p-2">
      <label className="block text-[12px] font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        defaultValue={value}
        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
      />
      <p className="text-[11px] text-slate-500 mt-1">{helper}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: FINANCE
// ═══════════════════════════════════════════════════════════════════════════

function FinanceTab({
  orders,
  creators,
}: {
  orders: AdminDirectOrder[];
  creators: AdminDirectCreator[];
}) {
  const gross = orders.reduce((a, o) => a + Number(o.total || 0), 0);
  const commissions = creators.reduce(
    (a, c) => a + Number(c.commissionOwed || 0),
    0,
  );
  const withholding = Math.round(commissions * 0.05);
  const net = gross - commissions - withholding;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2">
        <p className="text-[13px] font-semibold text-slate-900">Finance</p>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Track revenue, creator commissions, and tax obligations from social
          sales.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-6 h-6" />}
          title="No financial data yet. Finance records will appear once you log orders and creator payments."
        />
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-[13px] font-semibold text-slate-900">
                Revenue Summary
              </p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                A breakdown of your income after creator commissions and tax
                deductions.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              <FinanceLine
                label="Gross Revenue"
                helper="Total sales from orders"
                value={KES(gross)}
              />
              <FinanceLine
                label="Less: Creator Commissions"
                helper="Total owed to creators"
                value={`− ${KES(commissions)}`}
                negative
              />
              <FinanceLine
                label="Less: Withholding Tax"
                helper="5% tax deducted on creator income"
                value={`− ${KES(withholding)}`}
                negative
              />
              <FinanceLine
                label="Net Revenue"
                helper="What remains after deductions"
                value={KES(net)}
                emphasis
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  Commission Ledger
                </p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Every commission you owe or have paid to creators. Export this
                  for your records.
                </p>
              </div>
              <button className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Creator</th>
                    <th className="py-2 px-3 font-medium text-right">Owed</th>
                    <th className="py-2 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2 px-3 font-medium text-center">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creators.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="text-[12px] text-slate-400 font-mono">
                          {c.handle}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-amber-700">
                        {Number(c.commissionOwed || 0)
                          ? KES(c.commissionOwed)
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {KES(c.revenue)}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {c.commissionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-[13px] font-semibold text-slate-900">
                Tax Compliance
              </p>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Social income is taxable in Kenya. This section helps you track
                what you owe and generate reports for KRA.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              <FinanceLine
                label="Total Income"
                helper="All revenue earned through social channels"
                value={KES(gross)}
              />
              <FinanceLine
                label="Withholding Tax Deducted"
                helper="5% deducted on creator earnings"
                value={KES(withholding)}
              />
            </div>
            <div className="p-2 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]">
                <Download className="w-3.5 h-3.5" />
                KRA Export
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FinanceLine({
  label,
  helper,
  value,
  negative,
  emphasis,
}: {
  label: string;
  helper: string;
  value: string;
  negative?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p
          className={`text-[13px] ${emphasis ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}
        >
          {label}
        </p>
        <p className="text-[12px] text-slate-500 mt-0.5">{helper}</p>
      </div>
      <p
        className={`text-[13px] font-medium whitespace-nowrap ${negative
            ? 'text-amber-700'
            : emphasis
              ? 'text-emerald-700'
              : 'text-slate-900'
          }`}
      >
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-sm p-2">
        <p className="text-[13px] font-semibold text-slate-900">Settings</p>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Configure your shop profile, team access, and preferences.
        </p>
      </div>

      <SettingsSection
        title="Shop Profile"
        description="Basic information about your shop. This appears on reports and packing slips."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField
            label="Shop Name"
            helper="Your business name as it appears to customers"
            defaultValue="SokoFlow Official"
          />
          <SettingsField
            label="Social Handle"
            helper="Your main social account username"
            defaultValue="@sokoflow.ke"
          />
          <SettingsField
            label="Business Phone"
            helper="The number customers should call"
            defaultValue="+254 712 345 678"
          />
          <SettingsField
            label="Pickup Address"
            helper="Where couriers collect your packages"
            defaultValue="Westlands, Nairobi"
          />
          <SettingsField
            label="Default Courier"
            helper="The delivery service you use most often"
            defaultValue="Pickup Mtaani"
          />
          <SettingsField
            label="Default Commission Rate"
            helper="The standard percentage you offer creators"
            defaultValue="15%"
          />
          <SettingsField
            label="Low Stock Threshold"
            helper="Alert me when any product drops below this number"
            defaultValue="5"
          />
          <SettingsField
            label="Currency"
            helper="All prices and reports use this currency"
            defaultValue="KES"
            disabled
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Team Access"
        description="Control who on your team can access orders, products, and financial data."
      >
        <p className="text-[13px] text-slate-500">
          Team access is managed from the main account settings. Contact your
          administrator.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Choose which events should trigger an alert. You can receive notifications by email, WhatsApp, or SMS."
      >
        <div className="space-y-2">
          <ToggleRow
            label="New Order Logged"
            helper="Get notified when a new order is added"
            defaultOn
          />
          <ToggleRow
            label="Low Stock Alert"
            helper="Get notified when a product is running low"
            defaultOn
          />
          <ToggleRow
            label="Creator Payment Due"
            helper="Get reminded when a creator commission is unpaid"
            defaultOn
          />
          <ToggleRow
            label="LIVE Reminder"
            helper="Get reminded before a scheduled LIVE session"
            defaultOn
          />
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function SettingsField({
  label,
  helper,
  defaultValue,
  disabled,
}: {
  label: string;
  helper: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        defaultValue={defaultValue}
        disabled={disabled}
        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:bg-slate-50 disabled:text-slate-500"
      />
      <p className="text-[11px] text-slate-500 mt-1">{helper}</p>
    </div>
  );
}

function ToggleRow({
  label,
  helper,
  defaultOn,
}: {
  label: string;
  helper: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer border border-slate-200 rounded-sm p-2 hover:bg-slate-50">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{helper}</p>
      </div>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="h-4 w-4 mt-1 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900 shrink-0"
      />
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODALS / DRAWERS
// ═══════════════════════════════════════════════════════════════════════════

function LogOrderModal({
  onClose,
  onSubmit,
  products,
}: {
  onClose: () => void;
  onSubmit: (o: AdminDirectOrder) => void;
  products: AdminDirectProduct[];
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [source, setSource] = useState<AdminDirectOrderSource>('whatsapp');
  const [productId, setProductId] = useState<number | ''>(
    products[0]?.id ?? '',
  );
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<string>(
    products[0] ? String(products[0].price) : '0',
  );
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'COD'>('MPESA');
  const [status, setStatus] = useState<AdminDirectOrderStatus>('New');
  const [notes, setNotes] = useState('');

  const product = products.find((p) => p.id === productId);
  const unitPrice = Number(price) || 0;
  const total = unitPrice * qty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !product) return;

    const nowIso = new Date().toISOString();
    const reference = `#SS-${Math.floor(90000 + Math.random() * 9999)}`;

    const order: AdminDirectOrder = {
      id: `local-${Date.now()}`,
      reference,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      source,
      status,
      backendStatus: status.toLowerCase().replace(/\s+/g, '_'),
      paymentStatus:
        status === 'Paid' || status === 'Delivered' ? 'paid' : 'unpaid',
      paymentMethod: paymentMethod === 'MPESA' ? 'M-Pesa' : 'Cash on Delivery',
      subtotal: String(total),
      shipping: '0',
      discount: '0',
      total: String(total),
      itemCount: qty,
      items: [
        {
          id: Date.now(),
          productId: String(product.id),
          productName: product.name,
          sku: product.sku,
          image: product.image,
          quantity: qty,
          price: String(unitPrice),
          subtotal: String(total),
        },
      ],
      creatorId: null,
      creatorName: '',
      commission: '0',
      notes: notes.trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
      deliveredAt: null,
    };
    onSubmit(order);
  };

  const canSubmit = !!customerName.trim() && !!product && qty > 0;

  return (
    <Modal
      onClose={onClose}
      title="Log New Order"
      subtitle="Record a sale that came from social media"
      widthClass="max-w-2xl"
    >
      <form
        id="log-order-form"
        onSubmit={handleSubmit}
        className="space-y-3 text-[13px]"
      >
        {products.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-900">
              You need at least one product before you can log an order.
            </p>
          </div>
        )}

        <SectionLabel>Customer Information</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Enter the buyer&apos;s details so you can contact them about delivery
          and payment.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Customer Name"
            helper="Full name of the buyer"
            required
          >
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className={inputCls}
            />
          </FormField>
          <FormField
            label="Phone Number"
            helper="Used for delivery updates via WhatsApp"
            required
          >
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              className={inputCls}
              placeholder="+254 …"
            />
          </FormField>
          <FormField label="Email" helper="Optional. Used for receipts.">
            <input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className={inputCls}
              placeholder="name@example.com"
            />
          </FormField>
          <FormField
            label="Source"
            helper="Where did this order come from? WhatsApp, admin, or phone"
          >
            <select
              value={source}
              onChange={(e) =>
                setSource(e.target.value as AdminDirectOrderSource)
              }
              className={inputCls}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="admin">Admin</option>
              <option value="phone">Phone</option>
            </select>
          </FormField>
        </div>

        <SectionLabel>Order Details</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Select the product and quantity. The price fills in automatically but
          you can adjust it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Product" required>
            <select
              value={productId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setProductId(id);
                const p = products.find((x) => x.id === id);
                if (p) setPrice(String(p.price));
              }}
              className={inputCls}
              disabled={products.length === 0}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Quantity" required>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
              className={inputCls}
            />
          </FormField>
          <FormField
            label="Unit Price (KES)"
            helper="Adjust if you gave a discount"
            required
          >
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputCls}
            />
          </FormField>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between">
          <span className="text-[12px] text-slate-500">Total</span>
          <span className="text-[15px] font-bold text-slate-900">
            {KES(total)}
          </span>
        </div>

        <SectionLabel>Payment</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Payment Method" required>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as 'MPESA' | 'COD')
              }
              className={inputCls}
            >
              <option value="MPESA">M-Pesa</option>
              <option value="COD">Cash on Delivery</option>
            </select>
          </FormField>
          <FormField label="Initial Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminDirectOrderStatus)
              }
              className={inputCls}
            >
              <option value="New">New</option>
              <option value="Awaiting Payment">Awaiting Payment</option>
              <option value="Paid">Paid</option>
              <option value="Awaiting Shipment">Awaiting Shipment</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
            </select>
          </FormField>
        </div>

        <FormField
          label="Notes"
          helper="Anything you want to remember about this order"
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </FormField>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="log-order-form"
          disabled={!canSubmit}
          className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Log order
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// AddProductModal — now with real image upload
// ─────────────────────────────────────────────────────────────
function AddProductModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: AdminDirectProductWrite) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [image, setImage] = useState('');
  const [price, setPrice] = useState('0');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [commissionRate, setCommissionRate] = useState('10');
  const [status, setStatus] = useState<AdminDirectProductStatus>('Draft');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        sku: sku.trim() || undefined,
        image: image || undefined,
        price: price.trim() || '0',
        compareAtPrice: compareAtPrice.trim() || null,
        stockQuantity: Number(stockQuantity) || 0,
        category: category.trim() || undefined,
        brand: brand.trim() || undefined,
        commissionRate: Number(commissionRate) || 0,
        status,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Add Product"
      subtitle="Add an item you promote on social media"
      widthClass="max-w-2xl"
    >
      <form
        id="add-product-form"
        onSubmit={handleSubmit}
        className="space-y-3 text-[13px]"
      >
        <SectionLabel>Product Image</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Upload the photo customers will see first. This is what appears on
          your product list and order records.
        </p>
        <ImageUpload
          label="Product Photo"
          helper="Square or portrait works best for social media."
          value={image}
          onChange={setImage}
        />

        <SectionLabel>Basic Information</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Enter the product details exactly as you want them to appear when
          someone asks about this item.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Product Name"
            helper="Write it the way a customer would search for it"
            required
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </FormField>
          <FormField
            label="SKU"
            helper="Your internal product code. Leave blank to auto-generate"
          >
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className={inputCls}
              placeholder="Auto"
            />
          </FormField>
          <FormField label="Brand">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            />
          </FormField>
        </div>

        <SectionLabel>Pricing &amp; Stock</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Set your selling price and track how much stock you have available for
          orders.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Price (KES)" required>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField
            label="Compare-at Price"
            helper="Original price shown crossed out"
          >
            <input
              type="number"
              min={0}
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Stock">
            <input
              type="number"
              min={0}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField
            label="Commission Rate (%)"
            helper="How much you pay a creator per sale"
          >
            <input
              type="number"
              min={0}
              max={100}
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminDirectProductStatus)
              }
              className={inputCls}
            >
              <option value="Draft">Draft — Not yet visible or active</option>
              <option value="Active">Active — Currently promoted</option>
              <option value="Archived">Archived — No longer promoted</option>
            </select>
          </FormField>
        </div>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="add-product-form"
          disabled={submitting || !name.trim()}
          className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {submitting ? 'Adding…' : 'Add product'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// AddContentModal — now with real image AND video upload
// ─────────────────────────────────────────────────────────────
function AddContentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (c: AdminDirectContentWrite) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<AdminDirectContentPlatform>(
    'tiktok' as AdminDirectContentPlatform,
  );
  const [status, setStatus] = useState<AdminDirectContentStatus>('Draft');
  const [scheduledAt, setScheduledAt] = useState('');
  const [caption, setCaption] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const payload: ContentWriteWithVideo = {
        title: title.trim(),
        platform,
        status,
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
        caption: caption.trim() || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        productName: productName.trim() || undefined,
        // NOTE: add `videoUrl` to AdminDirectContentWrite on the backend.
        videoUrl: videoUrl || null,
      };
      await onSubmit(payload as AdminDirectContentWrite);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Add Content"
      subtitle="Upload the video or image post that promotes your products"
      widthClass="max-w-3xl"
    >
      <form
        id="add-content-form"
        onSubmit={handleSubmit}
        className="space-y-4 text-[13px]"
      >
        <SectionLabel>Video (recommended)</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Upload the actual video you posted (or plan to post). People need to
          see the video — not just a picture — so this is the most important
          part of your content.
        </p>
        <VideoUpload
          label="Content Video"
          helper="MP4, MOV or WEBM — up to 100 MB. The thumbnail below will be used as the poster."
          value={videoUrl}
          onChange={setVideoUrl}
          poster={thumbnailUrl || undefined}
        />

        <SectionLabel>Thumbnail / Cover Image</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Optional. Used as the video poster and on the content card when no
          video is present.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <ImageUpload
            label="Cover Image"
            helper="JPG, PNG or WEBP — up to 5 MB."
            value={thumbnailUrl}
            onChange={setThumbnailUrl}
          />
          <div className="text-[12px] text-slate-500 leading-relaxed">
            <p className="font-medium text-slate-700 mb-1">Tips</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Landscape (16:9) looks best on desktop cards.</li>
              <li>Portrait (9:16) matches what you post on TikTok.</li>
              <li>If you skip the video, an image post still works fine.</li>
            </ul>
          </div>
        </div>

        <SectionLabel>Content Details</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Describe the post so you can track its performance later.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Title"
            helper="A short name for this piece of content"
            required
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
              placeholder="e.g. Unboxing — Ankara Tote Bag"
            />
          </FormField>
          <FormField label="Platform" helper="Where will this be posted?">
            <select
              value={platform as string}
              onChange={(e) =>
                setPlatform(e.target.value as AdminDirectContentPlatform)
              }
              className={inputCls}
            >
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </FormField>
          <FormField
            label="Scheduled Date"
            helper="Optional. Leave blank for an unscheduled idea."
          >
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminDirectContentStatus)
              }
              className={inputCls}
            >
              <option value="Draft">Draft — Idea, not ready yet</option>
              <option value="Scheduled">Scheduled — Ready to post</option>
              <option value="Posted">Posted — Already published</option>
              <option value="Archived">Archived — Old content</option>
            </select>
          </FormField>
        </div>

        <FormField
          label="Caption"
          helper="The text that goes with your post"
        >
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="Write your caption here…"
          />
        </FormField>

        <FormField
          label="Featured Product"
          helper="Which product does this content promote?"
        >
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className={inputCls}
            placeholder="e.g. Ankara Tote Bag"
          />
        </FormField>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="add-content-form"
          disabled={submitting || !title.trim()}
          className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {submitting ? 'Adding…' : 'Add content'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Schedule LIVE modal (unchanged)
// ─────────────────────────────────────────────────────────────
function ScheduleLiveModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (l: AdminDirectLiveWrite) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<AdminDirectLiveStatus>('Scheduled');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        hostName: hostName.trim() || undefined,
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
        status,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Schedule LIVE"
      subtitle="Plan an upcoming livestream selling session"
      widthClass="max-w-xl"
    >
      <form
        id="schedule-live-form"
        onSubmit={handleSubmit}
        className="space-y-3 text-[13px]"
      >
        <SectionLabel>Session Details</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Give your livestream a name and set the time. You can update results
          after it ends.
        </p>
        <div className="grid grid-cols-1 gap-3">
          <FormField
            label="Session Title"
            helper="A short name customers will recognise"
            required
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
              placeholder="e.g. Friday Flash Sale — Beauty"
            />
          </FormField>
          <FormField
            label="Host Name"
            helper="Who is going to run the livestream?"
          >
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Amina"
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Scheduled Date & Time"
              helper="When will you go live?"
            >
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as AdminDirectLiveStatus)
                }
                className={inputCls}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Live">Live now</option>
                <option value="Ended">Ended</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </FormField>
          </div>
        </div>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="schedule-live-form"
          disabled={submitting || !title.trim()}
          className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {submitting ? 'Scheduling…' : 'Schedule LIVE'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Add Creator modal (unchanged)
// ─────────────────────────────────────────────────────────────
function AddCreatorModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (c: AdminDirectCreatorWrite) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatar, setAvatar] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [commissionRate, setCommissionRate] = useState('10');
  const [status, setStatus] = useState<AdminDirectCreatorStatus>('Active');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !handle.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        handle: handle.trim(),
        avatar: avatar.trim() || undefined,
        platform,
        commissionRate: Number(commissionRate) || 0,
        status,
      } as AdminDirectCreatorWrite);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Add Creator"
      subtitle="Add a creator you work with and set their commission"
      widthClass="max-w-xl"
    >
      <form
        id="add-creator-form"
        onSubmit={handleSubmit}
        className="space-y-3 text-[13px]"
      >
        <SectionLabel>Creator Details</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Enter the creator&apos;s public details and the rate you agreed on.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Full Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
              placeholder="e.g. Amina Wanjiku"
            />
          </FormField>
          <FormField
            label="Handle"
            helper="Their username on the platform (include the @)"
            required
          >
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              className={inputCls}
              placeholder="@amina.ke"
            />
          </FormField>
          <FormField
            label="Avatar URL"
            helper="Optional. Link to their profile picture."
          >
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className={inputCls}
              placeholder="https://…"
            />
          </FormField>
          <FormField label="Platform">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={inputCls}
            >
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="Facebook">Facebook</option>
            </select>
          </FormField>
          <FormField
            label="Commission Rate (%)"
            helper="The percentage you pay this creator per sale"
          >
            <input
              type="number"
              min={0}
              max={100}
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminDirectCreatorStatus)
              }
              className={inputCls}
            >
              <option value="Active">Active — Currently working with us</option>
              <option value="Inactive">Inactive — Not currently working</option>
            </select>
          </FormField>
        </div>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="add-creator-form"
          disabled={submitting || !name.trim() || !handle.trim()}
          className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {submitting ? 'Adding…' : 'Add creator'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function OrderDrawer({
  order,
  onClose,
  onAdvance,
}: {
  order: AdminDirectOrder;
  onClose: () => void;
  onAdvance: (next: AdminDirectOrderStatus) => void;
}) {
  const nextStatus: AdminDirectOrderStatus | null =
    order.status === 'New'
      ? 'Awaiting Payment'
      : order.status === 'Awaiting Payment'
        ? 'Paid'
        : order.status === 'Paid'
          ? 'Awaiting Shipment'
          : order.status === 'Awaiting Shipment'
            ? 'Shipped'
            : order.status === 'Shipped'
              ? 'Delivered'
              : null;

  const firstItem = order.items[0];

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="min-w-0">
            <p className="text-[12px] text-slate-500">Order</p>
            <p className="text-[15px] font-semibold font-mono text-slate-900 mt-0.5 truncate">
              {order.reference}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
          <div className="border border-slate-200 rounded-sm p-2 flex items-center gap-2">
            {firstItem?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={firstItem.image}
                alt=""
                className="w-14 h-14 rounded-sm object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <span className="w-14 h-14 rounded-sm bg-slate-100 border border-slate-200 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-500">Items</p>
              <p className="font-medium text-slate-900 mt-0.5">
                {firstItem?.productName || '—'} ×{firstItem?.quantity ?? 0}
              </p>
              <p className="text-[12px] text-slate-400 mt-0.5">
                From {sourceLabel(order.source)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
            <p className="text-[12px] text-slate-500">Customer</p>
            <p className="font-medium text-slate-900">{order.customerName}</p>
            {order.customerPhone && (
              <p className="text-slate-600">{order.customerPhone}</p>
            )}
            {order.customerEmail && (
              <p className="text-slate-500 font-mono text-[12px]">
                {order.customerEmail}
              </p>
            )}
          </div>

          <div className="border border-slate-200 rounded-sm p-2 space-y-1">
            <p className="text-[12px] text-slate-500">Payment</p>
            <p className="text-slate-800">{order.paymentMethod}</p>
            <p className="text-slate-500 text-[12px]">
              Status: {order.paymentStatus}
            </p>
          </div>

          <div className="border border-slate-200 rounded-sm p-2 space-y-1">
            <p className="text-[12px] text-slate-500">Status</p>
            <span
              className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${orderStatusBadge(order.status)}`}
            >
              {order.status}
            </span>
          </div>

          <div className="bg-slate-900 text-white rounded-sm p-2 flex items-center justify-between">
            <span className="text-[12px]">Total</span>
            <span className="font-semibold text-emerald-400">
              {KES(order.total)}
            </span>
          </div>

          {order.notes && (
            <div className="border border-slate-200 rounded-sm p-2 space-y-1">
              <p className="text-[12px] text-slate-500">Notes</p>
              <p className="text-slate-700 whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[12px]">
              <MessageCircle className="w-3.5 h-3.5" />
              Send WhatsApp Update
            </button>
            <button className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded-sm text-[12px]">
              <Printer className="w-3.5 h-3.5" />
              Print Packing Slip
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-slate-200 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-[13px]"
          >
            Close
          </button>
          {nextStatus && (
            <button
              onClick={() => onAdvance(nextStatus)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-sm text-[13px]"
            >
              Move to &ldquo;{nextStatus}&rdquo;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SMALL SHARED PIECES
// ═══════════════════════════════════════════════════════════════════════════

const inputCls =
  'w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950';

const btnPrimary =
  'inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-sm text-[13px]';

const btnSecondary =
  'inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide pt-1">
      {children}
    </p>
  );
}

function FormField({
  label,
  helper,
  required,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {helper && <p className="text-[11px] text-slate-500 mt-1">{helper}</p>}
    </div>
  );
}

function Modal({
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-2xl',
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-slate-200 rounded-sm w-full ${widthClass} max-h-[92vh] flex flex-col shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">
              {title}
            </h3>
            <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-end gap-2 -mx-3 -mb-3 mt-3 sticky bottom-0 bg-white">
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}) {
  return (
    <div className="max-w-xl mx-auto my-8 bg-white border border-slate-200 rounded-sm p-6 text-center space-y-3">
      <span className="w-12 h-12 rounded-sm bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
        {icon}
      </span>
      <p className="text-[13px] text-slate-600">{title}</p>
      {action && (
        <button onClick={action.onClick} className={btnPrimary}>
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}