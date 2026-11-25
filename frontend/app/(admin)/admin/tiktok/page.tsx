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
  ShoppingBag,
  Package,
  Video,
  Truck,
  BarChart3,
  Wallet,
  Settings as SettingsIcon,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Clock,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Trash2,
  Calendar,
  Loader2,
  RefreshCw,
  Download,
  UploadCloud,
  Image as ImageIcon,
  Film,
  Play,
  Search,
  ChevronRight,
  ChevronDown,
  Info,
  Sparkles,
  Music2,
  ArrowUpRight,
  Phone,
  Send,
  Inbox as InboxIcon,
  UserRound,
  Boxes,
  Undo2,
  ExternalLink,
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
  AdminProduct,
  AdminBrandRef,
  AdminCategoryRef,
  AdminDirectProduct,
  AdminDirectProductStatus,
  AdminDirectProductWrite,
  AdminDirectOrder,
  AdminDirectOrderStatus,
  AdminDirectOrderSource,
  AdminDirectOrderWrite,
  AdminDirectContent,
  AdminDirectContentStatus,
  AdminDirectContentWrite,
  AdminDirectLive,
  AdminDirectLiveStatus,
  AdminDirectLiveWrite,
  AdminDirectCreator,
  AdminDirectCreatorStatus,
  AdminDirectCreatorWrite,
  AdminCustomerFull,
  AdminCustomerStatsFull,
  AdminInboxConversation,
  AdminInboxMessage,
  AdminTeamMember,
  AdminDirectReturnRequest,
  AdminPayoutBatch,
  AdminAnalyticsSummaryResponse,
  AdminFinanceSummaryResponse,
} from '@/lib/admin-types';

const SHOP_NAME = 'TikTok Business';
const PAGE_SIZE = 25;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const TT_CYAN = '#25F4EE';
const TT_PINK = '#FE2C55';
const TT_BLACK = '#000000';

type Tab =
  | 'Dashboard'
  | 'Orders'
  | 'Inbox'
  | 'Customers'
  | 'Products'
  | 'Inventory'
  | 'Content'
  | 'LIVE Sessions'
  | 'Creators'
  | 'Fulfillment'
  | 'Returns'
  | 'Analytics'
  | 'Finance'
  | 'Payouts'
  | 'Tax'
  | 'Settings'
  | 'Team';

type ContentWithVideo = AdminDirectContent & { videoUrl?: string | null };

type ToastState = {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
} | null;

type NavItem = { id: Tab; label: string };
type NavGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[] | null;
};

const KES = (n: number | string | null | undefined) => {
  if (n === null || n === undefined) return 'KES —';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return 'KES —';
  return `KES ${num.toLocaleString('en-KE')}`;
};

const sourceLabel = (s: AdminDirectOrderSource | string) => {
  if (s === 'whatsapp') return 'WhatsApp';
  if (s === 'phone') return 'Phone';
  if (s === 'admin') return 'Admin';
  if (s === 'live') return 'TikTok LIVE';
  if (s === 'video_dm') return 'Video DM';
  if (s === 'bio_link') return 'Bio link';
  if (s === 'tiktok_dm') return 'TikTok DM';
  if (s === 'tiktok_comment') return 'TikTok Comment';
  if (s === 'instagram_dm') return 'Instagram DM';
  if (s === 'email') return 'Email';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  try {
    return new Date(ts).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  try {
    return new Date(ts).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const mapCatalogToDirect = (p: AdminProduct): AdminDirectProduct => ({
  id: p.id as unknown as number,
  name: p.name,
  sku: p.slug || '',
  image: p.images?.[0]?.url || '',
  price: p.price,
  compareAtPrice: p.compare_at_price,
  stockQuantity: p.stock_quantity,
  category: p.category?.name || '',
  brand: p.brand?.name || '',
  directSalesCount: p.sales_count ?? 0,
  directRevenue: p.sales_volume ?? '0',
  status: p.is_active ? 'Active' : 'Draft',
  viral: false,
  videoLink: '',
  lowStockThreshold: p.low_stock_threshold ?? 5,
  linkedToWebsite: true,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

/* ─────────────────────────── shared UI primitives ─────────────────────────── */

const inputCls =
  'w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

const btnBase =
  'inline-flex items-center justify-center gap-1.5 font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm transition-all focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed';

const btnPrimary = cn(
  btnBase,
  'bg-blue-950 hover:bg-blue-900 active:bg-blue-950 text-white focus-visible:ring-2 focus-visible:ring-blue-950/30',
);
const btnSecondary = cn(
  btnBase,
  'bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-950/10',
);
const btnDanger = cn(
  btnBase,
  'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus-visible:ring-2 focus-visible:ring-red-600/30',
);

const iconBtn =
  'inline-flex items-center justify-center h-7 w-7 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950/20';

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 px-2.5 py-2 border-b border-slate-200">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900 truncate">{title}</p>
        {subtitle && (
          <p className="text-[13px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="text-slate-400">{icon}</span>
            {title}
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-2 flex items-center gap-2 hover:border-slate-300 transition-colors">
      <span className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-slate-100 text-slate-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p className="text-[15px] font-bold text-slate-900 truncate tabular-nums">
          {value}
        </p>
      </div>
    </Card>
  );
}

function QuickAction({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 p-2 flex items-center gap-2 transition-colors group"
    >
      <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-blue-950 group-hover:text-white transition-colors">
        {icon}
      </span>
      <span className="text-[13px] font-medium text-slate-800 flex-1 truncate">
        {title}
      </span>
      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  );
}

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'brand';

const badgeVariantCls: Record<BadgeVariant, string> = {
  success: 'bg-white text-slate-700 border-slate-200',
  warning: 'bg-white text-slate-700 border-slate-200',
  danger: 'bg-white text-slate-700 border-slate-200',
  info: 'bg-white text-slate-700 border-slate-200',
  neutral: 'bg-white text-slate-700 border-slate-200',
  brand: 'bg-white text-slate-900 border-slate-300 font-semibold',
};

function StatusBadge({
  variant,
  children,
  dot,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[13px] font-medium whitespace-nowrap',
        badgeVariantCls[variant],
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'danger' && 'bg-red-500',
            variant === 'info' && 'bg-blue-500',
            variant === 'neutral' && 'bg-slate-400',
            variant === 'brand' && 'bg-blue-950',
          )}
        />
      )}
      {children}
    </span>
  );
}

const productStatusVariant = (s: AdminDirectProductStatus): BadgeVariant =>
  s === 'Active' ? 'success' : s === 'Draft' ? 'neutral' : 'warning';

const orderStatusVariant = (s: AdminDirectOrderStatus): BadgeVariant =>
  s === 'Delivered'
    ? 'success'
    : s === 'Shipped' || s === 'Awaiting Shipment'
      ? 'info'
      : s === 'Paid'
        ? 'info'
        : s === 'Cancelled' || s === 'Returned'
          ? 'danger'
          : 'warning';

const contentStatusVariant = (s: AdminDirectContentStatus): BadgeVariant =>
  s === 'Posted' ? 'success' : s === 'Scheduled' ? 'info' : 'neutral';

const liveStatusVariant = (s: AdminDirectLiveStatus): BadgeVariant =>
  s === 'Live'
    ? 'danger'
    : s === 'Ended'
      ? 'success'
      : s === 'Cancelled'
        ? 'neutral'
        : 'info';

const creatorStatusVariant = (s: AdminDirectCreatorStatus): BadgeVariant =>
  s === 'Active' ? 'success' : 'neutral';

const RETURN_STATUS_VARIANT = (
  s: AdminDirectReturnRequest['status'],
): BadgeVariant =>
  s === 'Refunded'
    ? 'success'
    : s === 'Received'
      ? 'info'
      : s === 'Approved'
        ? 'info'
        : s === 'Rejected'
          ? 'danger'
          : 'warning';

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  color: '#0f172a',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  padding: '6px 10px',
};

const NAV_GROUPS: NavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, items: null },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingBag,
    items: [
      { id: 'Orders', label: 'Orders' },
      { id: 'Fulfillment', label: 'Delivery' },
      { id: 'Returns', label: 'Returns' },
      { id: 'Inbox', label: 'Messages' },
      { id: 'Customers', label: 'Customers' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    items: [
      { id: 'Products', label: 'All Products' },
      { id: 'Inventory', label: 'Stock' },
    ],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: Video,
    items: [
      { id: 'Content', label: 'Videos & Posts' },
      { id: 'LIVE Sessions', label: 'LIVE Sessions' },
      { id: 'Creators', label: 'Creators' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    items: [
      { id: 'Analytics', label: 'Sales Overview' },
      { id: 'Finance', label: 'Money & Finance' },
      { id: 'Payouts', label: 'Creator Payments' },
      { id: 'Tax', label: 'Tax Summary' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    items: [{ id: 'Settings', label: 'Shop Settings' }],
  },
];

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20.5 7.5a6.8 6.8 0 0 1-3.2-.8v7.5a5.6 5.6 0 1 1-5.6-5.6c.24 0 .47.02.7.05v2.87a2.85 2.85 0 0 0-2.15 2.75 2.8 2.8 0 1 0 5.6 0V2.5h2.9c.1.85.36 1.66.78 2.4a6.8 6.8 0 0 0 2.97 2.4v2.2Z"
        fill={TT_CYAN}
        transform="translate(-1.5, -0.5)"
      />
      <path
        d="M20.5 7.5a6.8 6.8 0 0 1-3.2-.8v7.5a5.6 5.6 0 1 1-5.6-5.6c.24 0 .47.02.7.05v2.87a2.85 2.85 0 0 0-2.15 2.75 2.8 2.8 0 1 0 5.6 0V2.5h2.9c.1.85.36 1.66.78 2.4a6.8 6.8 0 0 0 2.97 2.4v2.2Z"
        fill={TT_PINK}
        opacity="0.85"
      />
      <path
        d="M20.5 7.5a6.8 6.8 0 0 1-3.2-.8v7.5a5.6 5.6 0 1 1-5.6-5.6c.24 0 .47.02.7.05v2.87a2.85 2.85 0 0 0-2.15 2.75 2.8 2.8 0 1 0 5.6 0V2.5h2.9c.1.85.36 1.66.78 2.4a6.8 6.8 0 0 0 2.97 2.4v2.2Z"
        fill={TT_BLACK}
        transform="translate(0.5, 0.5)"
      />
    </svg>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function uploadFile(file: File, kind: 'image' | 'video'): Promise<string> {
  const res = await adminApi.directOrders.uploads[kind](file);
  if (!res?.url) throw new Error('Upload response missing url');
  return res.url;
}

function Thumb({
  src,
  alt = '',
  className,
  fallbackIcon,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}) {
  if (!src) {
    return (
      <span
        className={cn(
          'flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 rounded shrink-0',
          className,
        )}
      >
        {fallbackIcon}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn(
        'object-cover border border-slate-200 rounded shrink-0 bg-slate-50',
        className,
      )}
    />
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  const colors = [
    'bg-slate-900',
    'bg-slate-700',
    'bg-slate-600',
    'bg-slate-800',
    'bg-slate-500',
    'bg-slate-700',
  ];
  const idx = (name || '?')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        'flex items-center justify-center text-white text-[13px] font-semibold rounded shrink-0',
        colors[idx % colors.length],
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold text-slate-500 uppercase">
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
    <div className="space-y-1">
      <label className="block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {helper && <p className="text-[13px] text-slate-500">{helper}</p>}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}) {
  return (
    <div className="max-w-sm mx-auto my-6 bg-white border border-slate-200 rounded p-3 text-center">
      <span className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
        {icon}
      </span>
      <h3 className="mt-2 text-[13px] font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button onClick={action.onClick} className={cn(btnPrimary, 'mt-3')}>
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-slate-100 rounded', className)} />;
}

function TabSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
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
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-white border border-slate-200 w-full rounded max-h-[92vh] flex flex-col outline-none',
          widthClass,
        )}
      >
        <div className="px-2.5 py-2 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3
              id="modal-title"
              className="text-[13px] font-semibold text-slate-900 truncate"
            >
              {title}
            </h3>
            <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className={iconBtn}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 py-2">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onCancel} title={title} subtitle={description} widthClass="max-w-sm">
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className={btnSecondary} disabled={busy}>
          Cancel
        </button>
        <button
          onClick={() => void handle()}
          disabled={busy}
          className={variant === 'danger' ? btnDanger : btnPrimary}
        >
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── upload widgets ─────────────────────────── */

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
  const [file, setFile] = useState<File | null>(null);
  const blobUrl = useObjectUrl(file);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = blobUrl || value;
  const handlePick = () => inputRef.current?.click();

  const handleFile = async (f: File) => {
    setError(null);
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WEBP).');
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    setFile(f);
    setUploading(true);
    try {
      const url = await uploadFile(f, 'image');
      onChange(url);
      setFile(null);
    } catch (e) {
      setError(
        e instanceof Error ? `${e.message} — preview kept locally.` : 'Upload failed.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const clear = () => {
    onChange('');
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1">
      <label className="block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handlePick}
        className="relative cursor-pointer border-2 border-dashed border-slate-200 rounded hover:border-slate-400 hover:bg-slate-50 aspect-video flex items-center justify-center overflow-hidden bg-slate-50 transition-colors group"
      >
        {preview ? (
          <>
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 bg-white text-slate-900 text-[13px] font-medium px-2 py-1 rounded shadow-md transition-opacity">
                Click to replace
              </span>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="text-center px-2 py-2">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-slate-400 mx-auto animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5 text-slate-400 mx-auto" />
            )}
            <p className="text-[13px] font-medium text-slate-700 mt-1.5">
              {uploading ? 'Uploading…' : 'Click or drop an image here'}
            </p>
            <p className="text-[13px] text-slate-400 mt-0.5">
              JPG, PNG or WEBP — up to 5 MB
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePick();
          }}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-700 hover:text-slate-900"
        >
          <ImageIcon className="w-3 h-3" />
          {preview ? 'Replace image' : 'Choose image'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600 hover:text-red-700"
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
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {helper && !error && <p className="text-[13px] text-slate-500">{helper}</p>}
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

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
  const [file, setFile] = useState<File | null>(null);
  const blobUrl = useObjectUrl(file);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = blobUrl || value;
  const handlePick = () => inputRef.current?.click();

  const handleFile = async (f: File) => {
    setError(null);
    if (!f.type.startsWith('video/')) {
      setError('Please choose a video file (MP4, MOV, WEBM).');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError('Video must be smaller than 100 MB.');
      return;
    }
    setFile(f);
    setUploading(true);
    try {
      const url = await uploadFile(f, 'video');
      onChange(url);
      setFile(null);
    } catch (e) {
      setError(
        e instanceof Error ? `${e.message} — preview kept locally.` : 'Upload failed.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const clear = () => {
    onChange('');
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1">
      <label className="block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-slate-200 rounded hover:border-slate-400 overflow-hidden bg-slate-50 transition-colors"
      >
        {preview ? (
          <div className="relative">
            <video
              src={preview}
              poster={poster || undefined}
              controls
              playsInline
              className="w-full aspect-video bg-black object-contain"
            />
            {uploading && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div onClick={handlePick} className="cursor-pointer text-center px-2 py-6">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-slate-400 mx-auto animate-spin" />
            ) : (
              <Film className="w-6 h-6 text-slate-400 mx-auto" />
            )}
            <p className="text-[13px] font-medium text-slate-700 mt-1.5">
              {uploading ? 'Uploading video…' : 'Click or drop a video here'}
            </p>
            <p className="text-[13px] text-slate-400 mt-0.5">
              MP4, MOV or WEBM — up to 100 MB
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePick();
          }}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-700 hover:text-slate-900"
        >
          <Film className="w-3 h-3" />
          {preview ? 'Replace video' : 'Choose video'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600 hover:text-red-700"
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
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {helper && !error && <p className="text-[13px] text-slate-500">{helper}</p>}
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const styles = {
    success: {
      border: 'border-slate-200',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
    },
    error: {
      border: 'border-red-200',
      icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />,
    },
    info: {
      border: 'border-slate-200',
      icon: <Info className="w-4 h-4 text-slate-700 shrink-0" />,
    },
  }[toast.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-3 right-3 z-[130] px-2.5 py-2 border rounded bg-white flex items-center gap-2 text-[13px] text-slate-900 max-w-xs',
        styles.border,
      )}
    >
      {styles.icon}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NavDropdown({
  group,
  activeTab,
  onSelect,
}: {
  group: NavGroup;
  activeTab: Tab;
  onSelect: (t: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = group.icon;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!group.items) {
    const active = activeTab === group.id;
    return (
      <button
        onClick={() => onSelect(group.id as Tab)}
        className={cn(
          'relative inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors rounded',
          active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {group.label}
        {active && (
          <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-blue-950" />
        )}
      </button>
    );
  }

  const isGroupActive = group.items.some((i) => i.id === activeTab);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'relative inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors rounded',
          isGroupActive
            ? 'text-slate-900'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {group.label}
        <ChevronDown
          className={cn('w-3 h-3 transition-transform', open && 'rotate-180')}
        />
        {isGroupActive && (
          <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-blue-950" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded shadow-lg min-w-[220px] z-[120] py-1"
        >
          {group.items.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="menuitem"
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-[13px] flex items-center justify-between gap-2 transition-colors',
                  active
                    ? 'bg-blue-950 text-white'
                    : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <span>{item.label}</span>
                {active && <ChevronRight className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── main component ─────────────────────────── */

export default function TikTokBusinessPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');

  const [products, setProducts] = useState<AdminDirectProduct[]>([]);
  const [brands, setBrands] = useState<AdminBrandRef[]>([]);
  const [categories, setCategories] = useState<AdminCategoryRef[]>([]);
  const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
  const [content, setContent] = useState<AdminDirectContent[]>([]);
  const [lives, setLives] = useState<AdminDirectLive[]>([]);
  const [creators, setCreators] = useState<AdminDirectCreator[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerFull[]>([]);
  const [customerStats, setCustomerStats] =
    useState<AdminCustomerStatsFull | null>(null);
  const [inbox, setInbox] = useState<AdminInboxConversation[]>([]);
  const [team, setTeam] = useState<AdminTeamMember[]>([]);
  const [returns, setReturns] = useState<AdminDirectReturnRequest[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutBatch[]>([]);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<AdminAnalyticsSummaryResponse | null>(null);
  const [financeSummary, setFinanceSummary] =
    useState<AdminFinanceSummaryResponse | null>(null);
  const [loggedRefs, setLoggedRefs] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const [logOrderOpen, setLogOrderOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminDirectOrder | null>(null);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [scheduleLiveOpen, setScheduleLiveOpen] = useState(false);
  const [addCreatorOpen, setAddCreatorOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const showToast = useCallback(
    (message: string, variant: 'success' | 'error' | 'info' = 'success') => {
      setToast({ id: Date.now(), message, variant });
    },
    [],
  );

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    const results = await Promise.allSettled([
      adminApi.products.list(),
      adminApi.brands.refs(),
      adminApi.categories.refs(),
      adminApi.directOrders.orders.list(),
      adminApi.directOrders.logged.list(),
      adminApi.directOrders.content.list(),
      adminApi.directOrders.lives.list(),
      adminApi.directOrders.creators.list(),
      adminApi.directOrders.customers.stats(),
      adminApi.directOrders.customers.list({ limit: 200 }),
      adminApi.directOrders.inbox.list(),
      adminApi.directOrders.team.list(),
      adminApi.directOrders.returns.list(),
      adminApi.directOrders.payouts.list(),
      adminApi.directOrders.analytics.summary(),
      adminApi.directOrders.finance.summary(),
    ]);

    if (results[0].status === 'fulfilled') {
      setProducts(results[0].value.map(mapCatalogToDirect));
    }
    if (results[1].status === 'fulfilled') setBrands(results[1].value);
    if (results[2].status === 'fulfilled') setCategories(results[2].value);

    const checkoutOrders =
      results[3].status === 'fulfilled' ? results[3].value : [];
    const loggedOrders =
      results[4].status === 'fulfilled' ? results[4].value : [];
    if (results[3].status === 'fulfilled' || results[4].status === 'fulfilled') {
      setOrders([...loggedOrders, ...checkoutOrders]);
      setLoggedRefs(new Set(loggedOrders.map((o) => o.reference)));
    }

    if (results[5].status === 'fulfilled') setContent(results[5].value);
    if (results[6].status === 'fulfilled') setLives(results[6].value);
    if (results[7].status === 'fulfilled') setCreators(results[7].value);
    if (results[8].status === 'fulfilled') setCustomerStats(results[8].value);
    if (results[9].status === 'fulfilled') {
      const v = results[9].value;
      setCustomers(Array.isArray(v) ? v : v.results ?? []);
    }
    if (results[10].status === 'fulfilled') setInbox(results[10].value);
    if (results[11].status === 'fulfilled') setTeam(results[11].value);
    if (results[12].status === 'fulfilled') setReturns(results[12].value);
    if (results[13].status === 'fulfilled') setPayouts(results[13].value);
    if (results[14].status === 'fulfilled') setAnalyticsSummary(results[14].value);
    if (results[15].status === 'fulfilled') setFinanceSummary(results[15].value);

    const allFailed = results.every((r) => r.status === 'rejected');
    if (allFailed) {
      const first = results[0] as PromiseRejectedResult;
      setLoadError(
        first.reason instanceof Error
          ? first.reason.message
          : `Failed to load ${SHOP_NAME} data`,
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
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const anyModal =
      logOrderOpen ||
      addProductOpen ||
      addContentOpen ||
      scheduleLiveOpen ||
      addCreatorOpen ||
      !!selectedOrder ||
      !!confirmState;
    if (!anyModal) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmState) setConfirmState(null);
      else if (selectedOrder) setSelectedOrder(null);
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
    confirmState,
  ]);

  const stats = useMemo(() => {
    const ordersMonth = orders.length;
    const revenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
    const pendingShipment = orders.filter(
      (o) => o.status === 'Paid' || o.status === 'Awaiting Shipment',
    ).length;
    const activeCreators = creators.filter((c) => c.status === 'Active').length;
    return { ordersMonth, revenue, pendingShipment, activeCreators };
  }, [orders, creators]);

  const handleAddProduct = useCallback(
    async (payload: AdminDirectProductWrite) => {
      try {
        const created = await adminApi.products.create({
          name: payload.name,
          description: '',
          brand_id: payload.brandId ?? brands[0]?.id ?? 0,
          category_id: payload.categoryId ?? categories[0]?.id ?? 0,
          price: payload.price,
          compare_at_price: payload.compareAtPrice ?? null,
          stock_quantity: payload.stockQuantity ?? 0,
          low_stock_threshold: payload.lowStockThreshold ?? 5,
          is_active: payload.status === 'Active',
          images: payload.image
            ? [{ url: payload.image, is_primary: true, sort_order: 0 }]
            : [],
        });
        const mapped = mapCatalogToDirect(created);
        setProducts((prev) => [mapped, ...prev]);
        showToast(`"${created.name}" added to catalog`);
        setAddProductOpen(false);
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : 'Failed to create product',
          'error',
        );
      }
    },
    [showToast, brands, categories],
  );

  const handleDeleteProduct = useCallback(
    (id: number | string, name: string) => {
      setConfirmState({
        title: `Remove "${name}"?`,
        description:
          'This will remove the product from your catalog. Past orders that referenced it are not affected.',
        confirmLabel: 'Remove product',
        onConfirm: async () => {
          try {
            await adminApi.products.remove(String(id));
            setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
            showToast(`"${name}" removed`);
          } catch (e) {
            showToast(
              e instanceof Error ? e.message : 'Failed to remove product',
              'error',
            );
          } finally {
            setConfirmState(null);
          }
        },
      });
    },
    [showToast],
  );

  const advanceOrderStatus = useCallback(
    async (reference: string, next: AdminDirectOrderStatus) => {
      const isLogged = loggedRefs.has(reference);
      const prevOrders = orders;
      setOrders((prev) =>
        prev.map((o) => (o.reference === reference ? { ...o, status: next } : o)),
      );
      setSelectedOrder((prev) =>
        prev?.reference === reference ? { ...prev, status: next } : prev,
      );

      try {
        const updated = isLogged
          ? await adminApi.directOrders.logged.advance(reference, { status: next })
          : await adminApi.directOrders.orders.advance(reference, { status: next });

        setOrders((prev) =>
          prev.map((o) => (o.reference === reference ? updated : o)),
        );
        if (selectedOrder?.reference === reference) setSelectedOrder(updated);
        showToast(`Order moved to "${next}"`);
      } catch (e) {
        setOrders(prevOrders);
        showToast(
          e instanceof Error ? e.message : 'Failed to update order status',
          'error',
        );
      }
    },
    [orders, selectedOrder, loggedRefs, showToast],
  );

  const handleLogOrder = useCallback(
    async (newOrder: AdminDirectOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
      setLoggedRefs((prev) => new Set(prev).add(newOrder.reference));
      setLogOrderOpen(false);

      try {
        const payload: AdminDirectOrderWrite = {
          customerName: newOrder.customerName,
          customerPhone: newOrder.customerPhone,
          customerEmail: newOrder.customerEmail,
          source: newOrder.source,
          status: newOrder.status,
          paymentMethod: newOrder.paymentMethod,
          notes: newOrder.notes,
          items: newOrder.items.map((it) => ({
            productId: Number(it.productId) || undefined,
            productName: it.productName,
            sku: it.sku,
            image: it.image,
            qty: it.quantity,
            price: it.price,
          })),
        };

        const created = await adminApi.directOrders.logged.create(payload);

        setOrders((prev) =>
          prev.map((o) => (o.reference === newOrder.reference ? created : o)),
        );
        setLoggedRefs((prev) => {
          const next = new Set(prev);
          next.delete(newOrder.reference);
          next.add(created.reference);
          return next;
        });
        showToast(`Order ${created.reference} saved`);
      } catch (e) {
        setOrders((prev) => prev.filter((o) => o.reference !== newOrder.reference));
        setLoggedRefs((prev) => {
          const next = new Set(prev);
          next.delete(newOrder.reference);
          return next;
        });
        showToast(e instanceof Error ? e.message : 'Failed to save order', 'error');
      }
    },
    [showToast],
  );

  const handleAddContent = useCallback(
    async (payload: AdminDirectContentWrite) => {
      try {
        const created = await adminApi.directOrders.content.create(payload);
        setContent((prev) => [created, ...prev]);
        showToast(`Content "${created.title}" added`);
        setAddContentOpen(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to add content', 'error');
      }
    },
    [showToast],
  );

  const handleScheduleLive = useCallback(
    async (payload: AdminDirectLiveWrite) => {
      try {
        const created = await adminApi.directOrders.lives.create(payload);
        setLives((prev) => [created, ...prev]);
        showToast(`LIVE "${created.title}" scheduled`);
        setScheduleLiveOpen(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to schedule LIVE', 'error');
      }
    },
    [showToast],
  );

  const handleAddCreator = useCallback(
    async (payload: AdminDirectCreatorWrite) => {
      try {
        const created = await adminApi.directOrders.creators.create(payload);
        setCreators((prev) => [created, ...prev]);
        showToast(`Creator "${created.name}" added`);
        setAddCreatorOpen(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to add creator', 'error');
      }
    },
    [showToast],
  );

  const handleConvertInbox = useCallback(
    async (conversation: AdminInboxConversation) => {
      try {
        const created = await adminApi.directOrders.inbox.convert(conversation.id, {
          customerName: conversation.contactName,
          customerPhone: conversation.contactHandle,
          source: 'whatsapp',
          items: [],
        });
        setOrders((prev) => [created, ...prev]);
        setInbox((prev) =>
          prev.map((c) =>
            c.id === conversation.id
              ? {
                ...c,
                status: 'converted',
                convertedOrder: created.id ? Number(created.id) : null,
              }
              : c,
          ),
        );
        showToast(
          `Order ${created.reference} created from ${conversation.contactName}`,
        );
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : 'Failed to convert conversation',
          'error',
        );
      }
    },
    [showToast],
  );

  const handleSendInboxReply = useCallback(
    async (conversation: AdminInboxConversation, body: string) => {
      try {
        const msg = await adminApi.directOrders.inbox.messages.create({
          conversation: conversation.id,
          direction: 'out',
          body,
        });
        setInbox((prev) =>
          prev.map((c) =>
            c.id === conversation.id
              ? { ...c, messages: [...(c.messages ?? []), msg] }
              : c,
          ),
        );
        showToast('Reply sent');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to send reply', 'error');
      }
    },
    [showToast],
  );

  const handlePayoutCreators = useCallback(
    async (creatorIds: number[]) => {
      if (creatorIds.length === 0) return;
      try {
        const batch = await adminApi.directOrders.payouts.create({
          status: 'Pending',
          payoutMethod: 'M-Pesa',
          notes: `Creator payout batch (${creatorIds.length})`,
        });
        setPayouts((prev) => [batch, ...prev]);
        setCreators((prev) =>
          prev.map((c) =>
            creatorIds.includes(c.id)
              ? { ...c, commissionOwed: '0', commissionPaid: c.commissionOwed }
              : c,
          ),
        );
        showToast(`Payout batch ${batch.reference} created`);
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : 'Failed to create payout batch',
          'error',
        );
      }
    },
    [showToast],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-blue-950 focus:text-white focus:px-3 focus:py-1.5 focus:text-[13px] focus:rounded"
      >
        Skip to content
      </a>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1700px] mx-auto px-2 lg:px-3">
          <div className="py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-9 h-9 rounded border border-slate-200 flex items-center justify-center shrink-0">
                <TikTokLogo className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[13px] font-semibold text-slate-900 truncate">
                  {SHOP_NAME}
                </h1>
                <p className="text-[13px] text-slate-500 truncate mt-0.5 hidden sm:block">
                  Orders, products, content & creators — one dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void loadAll(true)}
                disabled={refreshing || loading}
                className={btnSecondary}
                aria-label="Refresh data"
              >
                <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={() => setLogOrderOpen(true)} className={btnPrimary}>
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Log New Order</span>
                <span className="sm:hidden">Order</span>
              </button>
            </div>
          </div>

          <nav
            aria-label="Sections"
            className="relative flex items-center gap-0.5 -mb-px overflow-x-auto"
          >
            {NAV_GROUPS.map((group) => (
              <NavDropdown
                key={group.id}
                group={group}
                activeTab={tab}
                onSelect={setTab}
              />
            ))}
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="max-w-[1700px] mx-auto px-2 lg:px-3 py-2 space-y-2"
      >
        {loadError && (
          <Card>
            <div className="p-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">
                  Couldn&apos;t load {SHOP_NAME} data
                </p>
                <p className="text-[13px] text-slate-600 mt-0.5">{loadError}</p>
              </div>
              <button
                onClick={() => void loadAll(true)}
                className="text-[13px] font-medium text-slate-900 hover:underline shrink-0"
              >
                Retry
              </button>
            </div>
          </Card>
        )}

        {loading ? (
          <TabSkeleton />
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
                onGoToPayouts={() => setTab('Payouts')}
              />
            )}

            {tab === 'Orders' && (
              <OrdersTab
                orders={orders}
                loggedRefs={loggedRefs}
                onSelectOrder={setSelectedOrder}
                onAdvance={(ref, next) => void advanceOrderStatus(ref, next)}
                onLogOrder={() => setLogOrderOpen(true)}
              />
            )}

            {tab === 'Inbox' && (
              <InboxTab
                conversations={inbox}
                onConvert={handleConvertInbox}
                onReply={handleSendInboxReply}
              />
            )}

            {tab === 'Customers' && (
              <CustomersTab
                customers={customers}
                customerStats={customerStats}
                orders={orders}
              />
            )}

            {tab === 'Fulfillment' && (
              <FulfillmentTab
                orders={orders}
                loggedRefs={loggedRefs}
                onSelectOrder={setSelectedOrder}
                onAdvance={(ref, next) => void advanceOrderStatus(ref, next)}
              />
            )}

            {tab === 'Returns' && <ReturnsTab returns={returns} orders={orders} />}

            {tab === 'Products' && (
              <ProductsTab
                products={products}
                onAddProduct={() => setAddProductOpen(true)}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {tab === 'Inventory' && <InventoryTab products={products} />}

            {tab === 'Content' && (
              <ContentTab
                content={content}
                onAddContent={() => setAddContentOpen(true)}
              />
            )}

            {tab === 'LIVE Sessions' && (
              <LiveTab lives={lives} onScheduleLive={() => setScheduleLiveOpen(true)} />
            )}

            {tab === 'Creators' && (
              <CreatorsTab creators={creators} onAddCreator={() => setAddCreatorOpen(true)} />
            )}

            {tab === 'Analytics' && (
              <AnalyticsTab
                summary={analyticsSummary}
                orders={orders}
                creators={creators}
              />
            )}

            {tab === 'Finance' && (
              <FinanceTab summary={financeSummary} creators={creators} />
            )}

            {tab === 'Payouts' && (
              <PayoutsTab
                creators={creators}
                payouts={payouts}
                onPay={handlePayoutCreators}
              />
            )}

            {tab === 'Tax' && (
              <TaxTab summary={financeSummary} creators={creators} />
            )}

            {tab === 'Settings' && <SettingsTab />}

            {tab === 'Team' && <TeamTab team={team} />}
          </>
        )}
      </main>

      {/* ─── modals ─── */}
      {logOrderOpen && (
        <Modal
          onClose={() => setLogOrderOpen(false)}
          title="Log New Order"
          subtitle="Record a sale from TikTok, WhatsApp, or a phone call."
          widthClass="max-w-2xl"
        >
          <LogOrderForm
            products={products}
            onSubmit={(o) => void handleLogOrder(o)}
            onCancel={() => setLogOrderOpen(false)}
          />
        </Modal>
      )}

      {addProductOpen && (
        <Modal
          onClose={() => setAddProductOpen(false)}
          title="Add Product"
          subtitle="Add a new product to your catalog."
          widthClass="max-w-2xl"
        >
          <AddProductForm
            brands={brands}
            categories={categories}
            onSubmit={handleAddProduct}
            onCancel={() => setAddProductOpen(false)}
          />
        </Modal>
      )}

      {addContentOpen && (
        <Modal
          onClose={() => setAddContentOpen(false)}
          title="Add Content"
          subtitle="Plan a new TikTok video or post."
          widthClass="max-w-2xl"
        >
          <AddContentForm
            onSubmit={handleAddContent}
            onCancel={() => setAddContentOpen(false)}
          />
        </Modal>
      )}

      {scheduleLiveOpen && (
        <Modal
          onClose={() => setScheduleLiveOpen(false)}
          title="Schedule LIVE"
          subtitle="Plan a TikTok LIVE selling session."
          widthClass="max-w-2xl"
        >
          <ScheduleLiveForm
            onSubmit={handleScheduleLive}
            onCancel={() => setScheduleLiveOpen(false)}
          />
        </Modal>
      )}

      {addCreatorOpen && (
        <Modal
          onClose={() => setAddCreatorOpen(false)}
          title="Add Creator"
          subtitle="Add a TikTok creator to your shop."
          widthClass="max-w-xl"
        >
          <AddCreatorForm
            onSubmit={handleAddCreator}
            onCancel={() => setAddCreatorOpen(false)}
          />
        </Modal>
      )}

      {selectedOrder && (
        <Modal
          onClose={() => setSelectedOrder(null)}
          title={`Order ${selectedOrder.reference}`}
          subtitle={selectedOrder.customerName}
          widthClass="max-w-xl"
        >
          <OrderDetail
            order={selectedOrder}
            isLogged={loggedRefs.has(selectedOrder.reference)}
            onAdvance={(next) => void advanceOrderStatus(selectedOrder.reference, next)}
            onClose={() => setSelectedOrder(null)}
          />
        </Modal>
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── tab sections ─────────────────────────── */

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
  onGoToPayouts,
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
  onGoToPayouts: () => void;
}) {
  const overdue = orders.filter(
    (o) => o.status === 'Awaiting Shipment' || o.status === 'Paid',
  );
  const lowStock = products.filter((p) => p.stockQuantity <= 5);
  const unpaidCommissions = creators.filter(
    (c) => Number(c.commissionOwed || 0) > 0,
  );

  if (orders.length === 0 && products.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="w-5 h-5" />}
        title="Your shop is ready to get started"
        description="Add a product or record your first order to see your shop activity here."
        action={{
          label: 'Log New Order',
          onClick: onCreateOrder,
          icon: <Plus className="w-3 h-3" />,
        }}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Orders" value={String(stats.ordersMonth)} icon={<ShoppingBag className="w-4 h-4" />} />
        <KpiCard label="Revenue" value={KES(stats.revenue)} icon={<Banknote className="w-4 h-4" />} />
        <KpiCard label="Orders to Send" value={String(stats.pendingShipment)} icon={<Truck className="w-4 h-4" />} />
        <KpiCard label="Active Creators" value={String(stats.activeCreators)} icon={<UserRound className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Action needed"
            subtitle="Orders waiting to be sent, products running low, and creator payments due."
          />
          <div className="p-2 space-y-2">
            {overdue.length === 0 && lowStock.length === 0 && unpaidCommissions.length === 0 && (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                <p className="text-[13px] font-medium text-slate-700 mt-1.5">
                  You&apos;re all caught up
                </p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Nothing needs your attention right now.
                </p>
              </div>
            )}

            {overdue.length > 0 && (
              <div className="border border-slate-200 rounded p-2 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">
                    {overdue.length} order{overdue.length > 1 ? 's' : ''} awaiting shipment
                  </p>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    Customers paid but items aren&apos;t dispatched yet.
                  </p>
                  <button
                    onClick={onGoToOrders}
                    className="text-[13px] font-medium text-slate-900 hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    View orders <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {lowStock.length > 0 && (
              <div className="border border-slate-200 rounded p-2 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">
                    {lowStock.length} product{lowStock.length > 1 ? 's' : ''} running low
                  </p>
                  <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                    {lowStock.map((p) => p.name).join(' · ')}
                  </p>
                  <button
                    onClick={onGoToProducts}
                    className="text-[13px] font-medium text-slate-900 hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    Update stock <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {unpaidCommissions.length > 0 && (
              <div className="border border-slate-200 rounded p-2 flex items-start gap-2">
                <Wallet className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">
                    {unpaidCommissions.length} creator commission{unpaidCommissions.length > 1 ? 's' : ''} unpaid
                  </p>
                  <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                    {unpaidCommissions.map((c) => c.name).join(' · ')}
                  </p>
                  <button
                    onClick={onGoToPayouts}
                    className="text-[13px] font-medium text-slate-900 hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    Open payouts <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="p-2 grid grid-cols-2 gap-2">
            <QuickAction icon={<ShoppingBag className="w-3.5 h-3.5" />} title="Log Order" onClick={onCreateOrder} />
            <QuickAction icon={<Package className="w-3.5 h-3.5" />} title="Add Product" onClick={onAddProduct} />
            <QuickAction icon={<Video className="w-3.5 h-3.5" />} title="Schedule LIVE" onClick={onScheduleLive} />
            <QuickAction icon={<Wallet className="w-3.5 h-3.5" />} title="Payouts" onClick={onGoToPayouts} />
          </div>
        </Card>
      </div>
    </>
  );
}

function ProductsTab({
  products,
  onAddProduct,
  onDeleteProduct,
}: {
  products: AdminDirectProduct[];
  onAddProduct: () => void;
  onDeleteProduct: (id: number | string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    );
  }, [products, debouncedQuery]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Shop Products"
        subtitle="Products from your store catalog."
        icon={<Package className="w-3.5 h-3.5" />}
        action={
          <>
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search products…"
                className={cn(inputCls, 'w-48 pl-7')}
              />
            </div>
            <button onClick={onAddProduct} className={btnPrimary}>
              <Plus className="w-3 h-3" />
              Add Product
            </button>
          </>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-5 h-5" />}
          title="No products added yet"
          description="Add your first product to start tracking TikTok sales and stock."
          action={{ label: 'Add Product', onClick: onAddProduct, icon: <Plus className="w-3 h-3" /> }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wide">
                  <th className="py-2 px-2 font-medium">Product</th>
                  <th className="py-2 px-2 font-medium">SKU</th>
                  <th className="py-2 px-2 font-medium text-right">Price</th>
                  <th className="py-2 px-2 font-medium text-right">Stock</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium text-right">Sales</th>
                  <th className="py-2 px-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 text-[13px]">
                      No products match &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  shown.map((p, idx) => (
                    <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Thumb src={p.image} className="w-8 h-8" fallbackIcon={<Package className="w-3.5 h-3.5" />} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-xs">{p.name}</p>
                            {(p.brand || p.category) && (
                              <p className="text-[13px] text-slate-400 truncate">
                                {[p.brand, p.category].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-[13px] text-slate-500">{p.sku || '—'}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-medium text-slate-900 tabular-nums">{KES(p.price)}</span>
                        {p.compareAtPrice && (
                          <span className="block text-[13px] text-slate-400 line-through tabular-nums">
                            {KES(p.compareAtPrice)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className={cn(
                            'tabular-nums',
                            p.stockQuantity === 0
                              ? 'text-red-600 font-semibold'
                              : p.stockQuantity <= 5
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-700',
                          )}
                        >
                          {p.stockQuantity}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge variant={productStatusVariant(p.status)} dot>{p.status}</StatusBadge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <p className="font-medium text-slate-900 tabular-nums">{p.directSalesCount}</p>
                        <p className="text-[13px] text-slate-400 tabular-nums">{KES(p.directRevenue)}</p>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-end">
                          <button className={iconBtn} aria-label={`Delete ${p.name}`} onClick={() => onDeleteProduct(p.id, p.name)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {visible < filtered.length && (
            <div className="border-t border-slate-200 p-2 text-center">
              <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className={btnSecondary}>
                Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function InventoryTab({ products }: { products: AdminDirectProduct[] }) {
  const buckets = useMemo(() => {
    const out = { out: [] as AdminDirectProduct[], low: [] as AdminDirectProduct[], ok: [] as AdminDirectProduct[] };
    products.forEach((p) => {
      if (p.stockQuantity === 0) out.out.push(p);
      else if (p.stockQuantity <= 5) out.low.push(p);
      else out.ok.push(p);
    });
    return out;
  }, [products]);

  const totalValue = products.reduce((a, p) => a + Number(p.price || 0) * p.stockQuantity, 0);

  return (
    <div className="space-y-2">
      <PageHeader title="Inventory" subtitle="Stock position across all catalog products." icon={<Boxes className="w-3.5 h-3.5" />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Total SKUs" value={String(products.length)} icon={<Package className="w-4 h-4" />} />
        <KpiCard label="Out of Stock" value={String(buckets.out.length)} icon={<AlertCircle className="w-4 h-4" />} />
        <KpiCard label="Low Stock" value={String(buckets.low.length)} icon={<Clock className="w-4 h-4" />} />
        <KpiCard label="Stock Value" value={KES(totalValue)} icon={<Banknote className="w-4 h-4" />} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wide">
                <th className="py-2 px-2 font-medium">Product</th>
                <th className="py-2 px-2 font-medium">SKU</th>
                <th className="py-2 px-2 font-medium text-right">On hand</th>
                <th className="py-2 px-2 font-medium text-right">Unit price</th>
                <th className="py-2 px-2 font-medium text-right">Value</th>
                <th className="py-2 px-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">No inventory yet.</td>
                </tr>
              ) : (
                products.map((p, idx) => {
                  const value = Number(p.price || 0) * p.stockQuantity;
                  const health =
                    p.stockQuantity === 0
                      ? { label: 'Out of stock', variant: 'danger' as BadgeVariant }
                      : p.stockQuantity <= 5
                        ? { label: 'Low', variant: 'warning' as BadgeVariant }
                        : { label: 'Healthy', variant: 'success' as BadgeVariant };
                  return (
                    <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Thumb src={p.image} className="w-7 h-7" fallbackIcon={<Package className="w-3 h-3" />} />
                          <p className="font-medium text-slate-900 truncate max-w-xs">{p.name}</p>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-[13px] text-slate-500">{p.sku || '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{p.stockQuantity}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{KES(p.price)}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-900">{KES(value)}</td>
                      <td className="py-2 px-2">
                        <StatusBadge variant={health.variant} dot>{health.label}</StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const ORDER_TABS: { id: AdminDirectOrderStatus | 'All'; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'New', label: 'New' },
  { id: 'Awaiting Payment', label: 'Awaiting Payment' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Awaiting Shipment', label: 'Awaiting Shipment' },
  { id: 'Shipped', label: 'Shipped' },
  { id: 'Delivered', label: 'Delivered' },
  { id: 'Cancelled', label: 'Cancelled' },
  { id: 'Returned', label: 'Returned' },
];

function OrdersTab({
  orders,
  loggedRefs,
  onSelectOrder,
  onAdvance,
  onLogOrder,
}: {
  orders: AdminDirectOrder[];
  loggedRefs: Set<string>;
  onSelectOrder: (o: AdminDirectOrder) => void;
  onAdvance: (reference: string, next: AdminDirectOrderStatus) => void;
  onLogOrder: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<AdminDirectOrderStatus | 'All'>('All');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = statusFilter === 'All' ? orders : orders.filter((o) => o.status === statusFilter);
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.reference.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.customerPhone || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [orders, statusFilter, debouncedQuery]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Orders"
        subtitle="Log and track every sale from TikTok."
        icon={<ShoppingBag className="w-3.5 h-3.5" />}
        action={
          <>
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search orders…"
                className={cn(inputCls, 'w-48 pl-7')}
              />
            </div>
            <button onClick={onLogOrder} className={btnPrimary}>
              <Plus className="w-3 h-3" />
              Log New Order
            </button>
          </>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-5 h-5" />}
          title="No orders logged yet"
          description="When a customer buys through TikTok, log the order here."
          action={{ label: 'Log New Order', onClick: onLogOrder, icon: <Plus className="w-3 h-3" /> }}
        />
      ) : (
        <>
          <Card className="p-1 flex items-center gap-0.5 overflow-x-auto">
            {ORDER_TABS.map((s) => {
              const count =
                s.id === 'All'
                  ? orders.length
                  : orders.filter((o) => o.status === s.id).length;
              const active = statusFilter === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setStatusFilter(s.id);
                    setVisible(PAGE_SIZE);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 text-[13px] font-medium whitespace-nowrap rounded transition-colors',
                    active ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {s.label}
                  <span
                    className={cn(
                      'inline-block px-1 py-0.5 text-[13px] font-semibold tabular-nums rounded',
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                    <th className="py-2 px-2 font-medium">Order</th>
                    <th className="py-2 px-2 font-medium">Customer</th>
                    <th className="py-2 px-2 font-medium">Items</th>
                    <th className="py-2 px-2 font-medium text-right">Total</th>
                    <th className="py-2 px-2 font-medium">Status</th>
                    <th className="py-2 px-2 w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">
                        No orders match your filters.
                      </td>
                    </tr>
                  ) : (
                    shown.map((o, idx) => {
                      const firstItem = o.items[0];
                      const isLogged = loggedRefs.has(o.reference);
                      return (
                        <tr
                          key={`${o.reference}-${idx}`}
                          onClick={() => onSelectOrder(o)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-slate-900">{o.reference}</span>
                              {isLogged && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[13px] font-medium bg-white text-slate-600 border border-slate-200">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Logged
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <p className="text-slate-800 truncate max-w-[160px]">{o.customerName}</p>
                            <p className="text-[13px] text-slate-400">{sourceLabel(o.source)}</p>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Thumb src={firstItem?.image} className="w-7 h-7" fallbackIcon={<Package className="w-3 h-3" />} />
                              <span className="text-slate-600 truncate max-w-[200px]">
                                {firstItem?.productName || '—'}
                                {o.items.length > 1 && ` +${o.items.length - 1}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">{KES(o.total)}</td>
                          <td className="py-2 px-2">
                            <StatusBadge variant={orderStatusVariant(o.status)} dot>{o.status}</StatusBadge>
                          </td>
                          <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                            {o.status === 'Paid' && (
                              <button onClick={() => onAdvance(o.reference, 'Awaiting Shipment')} className={btnPrimary}>
                                Mark shipped
                              </button>
                            )}
                            {o.status === 'Awaiting Shipment' && (
                              <button onClick={() => onAdvance(o.reference, 'Shipped')} className={btnPrimary}>
                                Ship
                              </button>
                            )}
                            {o.status === 'Shipped' && (
                              <button onClick={() => onAdvance(o.reference, 'Delivered')} className={btnSecondary}>
                                Delivered
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
            {visible < filtered.length && (
              <div className="border-t border-slate-200 p-2 text-center">
                <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className={btnSecondary}>
                  Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function InboxTab({
  conversations,
  onConvert,
  onReply,
}: {
  conversations: AdminInboxConversation[];
  onConvert: (c: AdminInboxConversation) => void | Promise<void>;
  onReply: (c: AdminInboxConversation, body: string) => void | Promise<void>;
}) {
  const [active, setActive] = useState<number | null>(conversations[0]?.id ?? null);
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (conversations.length === 0) {
      setActive(null);
      return;
    }
    if (active === null || !conversations.some((c) => c.id === active)) {
      setActive(conversations[0].id);
    }
  }, [conversations, active]);

  const current = conversations.find((c) => c.id === active) ?? null;

  const channelLabel = (c: AdminInboxConversation['channel']) => {
    if (c === 'whatsapp') return 'WhatsApp';
    if (c === 'tiktok_dm') return 'TikTok DM';
    if (c === 'tiktok_comment') return 'TikTok Comment';
    if (c === 'instagram_dm') return 'Instagram DM';
    if (c === 'phone') return 'Phone';
    if (c === 'email') return 'Email';
    return c;
  };

  const channelVariant = (c: AdminInboxConversation['channel']): BadgeVariant => {
    if (c === 'whatsapp') return 'success';
    if (c === 'tiktok_dm' || c === 'instagram_dm') return 'info';
    if (c === 'tiktok_comment') return 'neutral';
    if (c === 'phone') return 'warning';
    return 'neutral';
  };

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon className="w-5 h-5" />}
        title="No conversations yet"
        description="When customers reach out through WhatsApp, TikTok DMs or comments, they'll land here."
      />
    );
  }

  const unread = conversations.reduce((a, c) => a + (c.unreadCount || 0), 0);

  const handleSend = async () => {
    if (!current || !reply.trim()) return;
    const body = reply.trim();
    setReply('');
    await onReply(current, body);
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title="Inbox"
        subtitle="WhatsApp, TikTok DMs, and comments in one place."
        icon={<InboxIcon className="w-3.5 h-3.5" />}
        action={<StatusBadge variant="info" dot>{unread} unread</StatusBadge>}
      />

      <Card className="grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-[520px]">
        <div className="border-r border-slate-200 overflow-y-auto max-h-[70vh]">
          {conversations.map((m) => {
            const isActive = m.id === active;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={cn(
                  'w-full text-left px-2 py-2 border-b border-slate-100 flex items-start gap-2 transition-colors',
                  isActive ? 'bg-slate-50' : 'hover:bg-slate-50',
                )}
              >
                <Avatar name={m.contactName || m.contactHandle || '?'} className="w-8 h-8 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-slate-900 truncate">
                      {m.contactName || m.contactHandle || 'Unknown'}
                    </p>
                    <span className="text-[13px] text-slate-400 shrink-0">
                      {m.lastMessageAt ? formatDateTime(m.lastMessageAt) : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <StatusBadge variant={channelVariant(m.channel)}>{channelLabel(m.channel)}</StatusBadge>
                    {m.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-blue-950 text-white text-[13px] font-semibold">
                        {m.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 truncate mt-1">
                    {m.messages?.[m.messages.length - 1]?.body || m.subject || 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col min-h-0">
          {current ? (
            <>
              <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={current.contactName || current.contactHandle || '?'} className="w-8 h-8" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{current.contactName || 'Unknown'}</p>
                    <p className="text-[13px] text-slate-500 truncate">{current.contactHandle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className={btnSecondary}
                    onClick={() => {
                      if (current.contactHandle) window.location.href = `tel:${current.contactHandle}`;
                    }}
                  >
                    <Phone className="w-3 h-3" />
                    Call
                  </button>
                  <button
                    className={btnPrimary}
                    onClick={() => void onConvert(current)}
                    disabled={current.status === 'converted'}
                  >
                    <ShoppingBag className="w-3 h-3" />
                    {current.status === 'converted' ? 'Converted' : 'Convert to order'}
                  </button>
                </div>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {(current.messages ?? []).length === 0 ? (
                  <p className="text-[13px] text-slate-400 text-center py-6">No messages yet.</p>
                ) : (
                  (current.messages ?? []).map((msg: AdminInboxMessage) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'max-w-[75%] text-[13px] px-2 py-2 rounded',
                        msg.direction === 'out'
                          ? 'ml-auto bg-blue-950 text-white rounded-tr-none'
                          : 'bg-slate-100 text-slate-800 rounded-tl-none',
                      )}
                    >
                      {msg.body}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-200 p-2 flex items-center gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Type a reply…"
                  className={cn(inputCls, 'flex-1')}
                />
                <button className={btnPrimary} onClick={() => void handleSend()} disabled={!reply.trim()}>
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-slate-400">Select a conversation</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function CustomersTab({
  customers,
  customerStats,
  orders,
}: {
  customers: AdminCustomerFull[];
  customerStats: AdminCustomerStatsFull | null;
  orders: AdminDirectOrder[];
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
    );
  }, [customers, debouncedQuery]);

  const totalSpend = customers.reduce((a, c) => a + Number(c.lifetimeSpend || 0), 0);
  const repeatRate =
    customerStats?.repeatRate ??
    (customers.length === 0
      ? 0
      : Math.round(
        (customers.filter((c) => c.totalOrders >= 2).length / customers.length) * 100,
      ));

  const customerOrderMap = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      const key = o.customerPhone || o.customerName;
      const existing = map.get(key);
      if (!existing || Date.parse(o.createdAt) > Date.parse(existing)) {
        map.set(key, o.createdAt);
      }
    });
    return map;
  }, [orders]);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Customers"
        subtitle="Everyone who bought from your TikTok channels."
        icon={<UserRound className="w-3.5 h-3.5" />}
        action={
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers…"
              className={cn(inputCls, 'w-56 pl-7')}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Customers" value={String(customerStats?.total ?? customers.length)} icon={<UserRound className="w-4 h-4" />} />
        <KpiCard label="Repeat rate" value={`${repeatRate}%`} icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="VIP customers" value={String(customerStats?.vip ?? customers.filter((c) => c.segment === 'VIP').length)} icon={<Sparkles className="w-4 h-4" />} />
        <KpiCard label="Lifetime spend" value={KES(customerStats?.lifetimeSpend ?? totalSpend)} icon={<Banknote className="w-4 h-4" />} />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={<UserRound className="w-5 h-5" />}
          title="No customers yet"
          description="Customers will appear once you log orders."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Customer</th>
                  <th className="py-2 px-2 font-medium">Contact</th>
                  <th className="py-2 px-2 font-medium">Segment</th>
                  <th className="py-2 px-2 font-medium text-center">Orders</th>
                  <th className="py-2 px-2 font-medium text-right">Spend</th>
                  <th className="py-2 px-2 font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">
                      No customers match &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const segmentVariant: BadgeVariant =
                      c.segment === 'VIP'
                        ? 'brand'
                        : c.segment === 'Repeat'
                          ? 'info'
                          : c.segment === 'COD Risk' || c.segment === 'Inactive'
                            ? 'danger'
                            : 'neutral';
                    const key = c.phone || c.name;
                    const lastOrderIso = c.lastOrderAt || customerOrderMap.get(key) || null;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={c.name} className="w-7 h-7" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[200px]">{c.name}</p>
                              {c.county && <p className="text-[13px] text-slate-400 truncate">{c.county}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <p className="text-slate-700">{c.phone || '—'}</p>
                          {c.email && <p className="text-[13px] text-slate-400 truncate max-w-[180px]">{c.email}</p>}
                        </td>
                        <td className="py-2 px-2">
                          <StatusBadge variant={segmentVariant} dot>{c.segment}</StatusBadge>
                        </td>
                        <td className="py-2 px-2 text-center tabular-nums text-slate-700">{c.totalOrders}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-900">{KES(c.lifetimeSpend)}</td>
                        <td className="py-2 px-2 text-slate-500">{formatDate(lastOrderIso)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FulfillmentTab({
  orders,
  loggedRefs,
  onSelectOrder,
  onAdvance,
}: {
  orders: AdminDirectOrder[];
  loggedRefs: Set<string>;
  onSelectOrder: (o: AdminDirectOrder) => void;
  onAdvance: (reference: string, next: AdminDirectOrderStatus) => void;
}) {
  const queue = orders.filter(
    (o) =>
      o.status === 'Paid' ||
      o.status === 'Awaiting Shipment' ||
      o.status === 'Shipped',
  );

  const columns: { id: AdminDirectOrderStatus; label: string; variant: BadgeVariant }[] = [
    { id: 'Paid', label: 'Paid — pack', variant: 'info' },
    { id: 'Awaiting Shipment', label: 'Ready to ship', variant: 'warning' },
    { id: 'Shipped', label: 'In transit', variant: 'info' },
    { id: 'Delivered', label: 'Delivered', variant: 'success' },
  ];

  return (
    <div className="space-y-2">
      <PageHeader
        title="Fulfillment"
        subtitle={`Pack, ship, and confirm deliveries. ${queue.length} orders in the queue.`}
        icon={<Truck className="w-3.5 h-3.5" />}
      />

      {queue.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-5 h-5" />}
          title="Nothing to fulfill"
          description="Orders that are paid but not yet delivered will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {columns.map((col) => {
            const items = queue.filter((o) => o.status === col.id);
            return (
              <Card key={col.id} className="flex flex-col">
                <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between">
                  <StatusBadge variant={col.variant} dot>{col.label}</StatusBadge>
                  <span className="text-[13px] text-slate-500 tabular-nums">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {items.length === 0 ? (
                    <p className="text-[13px] text-slate-400 text-center py-4">Empty</p>
                  ) : (
                    items.map((o) => (
                      <button
                        key={o.reference}
                        onClick={() => onSelectOrder(o)}
                        className="w-full text-left border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 p-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[13px] font-medium text-slate-900">{o.reference}</span>
                          {loggedRefs.has(o.reference) && <Sparkles className="w-3 h-3 text-slate-400" />}
                        </div>
                        <p className="text-[13px] text-slate-600 truncate mt-0.5">{o.customerName}</p>
                        <p className="text-[13px] text-slate-400 tabular-nums mt-0.5">{KES(o.total)}</p>
                        {col.id === 'Paid' && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvance(o.reference, 'Awaiting Shipment');
                            }}
                            className="mt-1 inline-block text-[13px] font-medium text-slate-900 hover:underline"
                          >
                            Mark packed
                          </span>
                        )}
                        {col.id === 'Awaiting Shipment' && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvance(o.reference, 'Shipped');
                            }}
                            className="mt-1 inline-block text-[13px] font-medium text-slate-900 hover:underline"
                          >
                            Dispatch
                          </span>
                        )}
                        {col.id === 'Shipped' && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvance(o.reference, 'Delivered');
                            }}
                            className="mt-1 inline-block text-[13px] font-medium text-slate-900 hover:underline"
                          >
                            Mark delivered
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReturnsTab({
  returns,
  orders,
}: {
  returns: AdminDirectReturnRequest[];
  orders: AdminDirectOrder[];
}) {
  const returnedValue = returns.reduce((a, r) => a + Number(r.refundAmount || 0), 0);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Returns & Refunds"
        subtitle="Cancelled and returned orders, with the value affected."
        icon={<Undo2 className="w-3.5 h-3.5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Returns" value={String(returns.filter((r) => r.status !== 'Rejected').length)} icon={<Undo2 className="w-4 h-4" />} />
        <KpiCard label="Pending" value={String(returns.filter((r) => r.status === 'Requested').length)} icon={<Clock className="w-4 h-4" />} />
        <KpiCard label="Value affected" value={KES(returnedValue)} icon={<Banknote className="w-4 h-4" />} />
        <KpiCard
          label="Return rate"
          value={`${orders.length === 0 ? 0 : Math.round((returns.length / orders.length) * 100)}%`}
          icon={<BarChart3 className="w-4 h-4" />}
        />
      </div>

      {returns.length === 0 ? (
        <EmptyState
          icon={<Undo2 className="w-5 h-5" />}
          title="No returns or cancellations"
          description="This is the healthiest place to be. Keep it up."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Reference</th>
                  <th className="py-2 px-2 font-medium">Order</th>
                  <th className="py-2 px-2 font-medium">Reason</th>
                  <th className="py-2 px-2 font-medium text-right">Refund</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono font-medium text-slate-900">{r.reference}</td>
                    <td className="py-2 px-2 font-mono text-slate-700">{r.orderReference}</td>
                    <td className="py-2 px-2 text-slate-500">{r.reasonDetail || r.reason}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-slate-900">{KES(r.refundAmount)}</td>
                    <td className="py-2 px-2">
                      <StatusBadge variant={RETURN_STATUS_VARIANT(r.status)} dot>{r.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ContentTab({
  content,
  onAddContent,
}: {
  content: AdminDirectContent[];
  onAddContent: () => void;
}) {
  return (
    <div className="space-y-2">
      <PageHeader
        title="Content"
        subtitle="Plan, schedule, and track TikTok videos."
        icon={<Video className="w-3.5 h-3.5" />}
        action={
          <button onClick={onAddContent} className={btnPrimary}>
            <Plus className="w-3 h-3" />
            Add Content
          </button>
        }
      />

      {content.length === 0 ? (
        <EmptyState
          icon={<Video className="w-5 h-5" />}
          title="No TikTok content planned yet"
          description="Create your first video idea to start tracking what works."
          action={{ label: 'Add Content', onClick: onAddContent, icon: <Plus className="w-3 h-3" /> }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {content.map((cRaw) => {
            const c = cRaw as ContentWithVideo;
            return (
              <Card key={c.id} className="hover:border-slate-300 transition-colors">
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
                    <Thumb src={c.thumbnailUrl} className="!w-full !h-full !border-0" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5">
                    <StatusBadge variant={contentStatusVariant(c.status)} dot>{c.status}</StatusBadge>
                  </div>
                  <div className="absolute top-1.5 right-1.5">
                    <span className="bg-slate-900/80 text-white px-1.5 py-0.5 rounded text-[13px] font-medium backdrop-blur-sm inline-flex items-center gap-1">
                      {c.videoUrl && <Play className="w-2.5 h-2.5" />}
                      <Music2 className="w-2.5 h-2.5" />
                      {c.platform}
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{c.title}</p>
                  {c.scheduledAt && (
                    <p className="text-[13px] text-slate-400 inline-flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(c.scheduledAt)}
                    </p>
                  )}
                  {c.caption && <p className="text-[13px] text-slate-500 truncate">{c.caption}</p>}
                  {c.status === 'Posted' && (
                    <div className="flex items-center gap-3 pt-1.5 border-t border-slate-100 mt-1.5 text-[13px]">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Eye className="w-2.5 h-2.5" />
                        {c.views.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Heart className="w-2.5 h-2.5" />
                        {c.likes.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <MessageCircle className="w-2.5 h-2.5" />
                        {c.comments}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiveTab({
  lives,
  onScheduleLive,
}: {
  lives: AdminDirectLive[];
  onScheduleLive: () => void;
}) {
  return (
    <div className="space-y-2">
      <PageHeader
        title="LIVE Sessions"
        subtitle="Plan and track TikTok livestream selling sessions."
        icon={<Video className="w-3.5 h-3.5" />}
        action={
          <button onClick={onScheduleLive} className={btnPrimary}>
            <Plus className="w-3 h-3" />
            Schedule LIVE
          </button>
        }
      />

      {lives.length === 0 ? (
        <EmptyState
          icon={<Video className="w-5 h-5" />}
          title="No LIVE sessions scheduled"
          description="Plan your first TikTok livestream to start selling live."
          action={{ label: 'Schedule LIVE', onClick: onScheduleLive, icon: <Plus className="w-3 h-3" /> }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Session</th>
                  <th className="py-2 px-2 font-medium">Scheduled</th>
                  <th className="py-2 px-2 font-medium text-center">Peak viewers</th>
                  <th className="py-2 px-2 font-medium text-center">Orders</th>
                  <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lives.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2">
                      <p className="font-medium text-slate-900">{l.title}</p>
                      <p className="text-[13px] text-slate-400">{l.hostName || '—'}</p>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{formatDateTime(l.scheduledAt)}</td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">
                      {l.peakViewers ? l.peakViewers.toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">
                      {l.ordersGenerated || '—'}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                      {Number(l.revenue || 0) ? KES(l.revenue) : '—'}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge variant={liveStatusVariant(l.status)} dot>{l.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CreatorsTab({
  creators,
  onAddCreator,
}: {
  creators: AdminDirectCreator[];
  onAddCreator: () => void;
}) {
  return (
    <div className="space-y-2">
      <PageHeader
        title="Creators"
        subtitle="Track creators and manage their commissions."
        icon={<UserRound className="w-3.5 h-3.5" />}
        action={
          <button onClick={onAddCreator} className={btnPrimary}>
            <Plus className="w-3 h-3" />
            Add Creator
          </button>
        }
      />

      {creators.length === 0 ? (
        <EmptyState
          icon={<UserRound className="w-5 h-5" />}
          title="No creators added yet"
          description="Add a TikTok creator to start tracking their sales and commissions."
          action={{ label: 'Add Creator', onClick: onAddCreator, icon: <Plus className="w-3 h-3" /> }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Creator</th>
                  <th className="py-2 px-2 font-medium">Platform</th>
                  <th className="py-2 px-2 font-medium text-center">Rate</th>
                  <th className="py-2 px-2 font-medium text-center">Orders</th>
                  <th className="py-2 px-2 font-medium text-right">Owed</th>
                  <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creators.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Thumb src={c.avatar} className="w-7 h-7" fallbackIcon={<UserRound className="w-3.5 h-3.5" />} />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-[13px] text-slate-400 font-mono">{c.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{c.platform || '—'}</td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">{c.commissionRate}%</td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">{c.ordersCount}</td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                      {Number(c.commissionOwed || 0) ? KES(c.commissionOwed) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 tabular-nums">{KES(c.revenue)}</td>
                    <td className="py-2 px-2">
                      <StatusBadge variant={creatorStatusVariant(c.status)} dot>{c.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function AnalyticsTab({
  summary,
  orders,
  creators,
}: {
  summary: AdminAnalyticsSummaryResponse | null;
  orders: AdminDirectOrder[];
  creators: AdminDirectCreator[];
}) {
  const daily = summary?.daily ?? [];
  const bySource = summary?.bySource ?? [];

  const totalRevenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders === 0 ? 0 : totalRevenue / totalOrders;
  const commissionTotal = creators.reduce((a, c) => a + Number(c.commissionOwed || 0), 0);

  const pieColors = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];
  const sourceData = bySource.length
    ? bySource.map((s, i) => ({ name: s.source, value: s.count, color: pieColors[i % pieColors.length] }))
    : [];

  return (
    <div className="space-y-2">
      <PageHeader
        title="Analytics"
        subtitle="Track how TikTok activity translates into sales."
        icon={<BarChart3 className="w-3.5 h-3.5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Total Revenue" value={KES(summary?.monthRevenue ?? totalRevenue)} icon={<Banknote className="w-4 h-4" />} />
        <KpiCard label="Total Orders" value={String(summary?.monthOrders ?? totalOrders)} icon={<ShoppingBag className="w-4 h-4" />} />
        <KpiCard label="Avg. Order Value" value={KES(Math.round(avgOrder))} icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Creator Commissions" value={KES(commissionTotal)} icon={<UserRound className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card>
          <CardHeader title="Revenue Trend" subtitle="TikTok revenue over the recent period" />
          <div className="h-52 w-full p-2">
            {daily.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={13} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={13} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Orders by Source" subtitle="Where your sales come from" />
          <div className="h-52 w-full p-2">
            {sourceData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {sourceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Finance / Payouts / Tax / Settings / Team ─── */

function FinanceTab({
  summary,
  creators,
}: {
  summary: AdminFinanceSummaryResponse | null;
  creators: AdminDirectCreator[];
}) {
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalCosts = summary?.totalCosts ?? 0;
  const net = totalRevenue - totalCosts;
  const unpaid = creators.reduce((a, c) => a + Number(c.commissionOwed || 0), 0);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Money & Finance"
        subtitle="Revenue, costs, and creator payments at a glance."
        icon={<Wallet className="w-3.5 h-3.5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Revenue" value={KES(totalRevenue)} icon={<Banknote className="w-4 h-4" />} />
        <KpiCard label="Costs" value={KES(totalCosts)} icon={<ArrowUpRight className="w-4 h-4" />} />
        <KpiCard label="Net" value={KES(net)} icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Owed to creators" value={KES(unpaid)} icon={<UserRound className="w-4 h-4" />} />
      </div>
    </div>
  );
}

function PayoutsTab({
  creators,
  payouts,
  onPay,
}: {
  creators: AdminDirectCreator[];
  payouts: AdminPayoutBatch[];
  onPay: (creatorIds: number[]) => void | Promise<void>;
}) {
  const owed = creators.filter((c) => Number(c.commissionOwed || 0) > 0);
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-2">
      <PageHeader
        title="Creator Payments"
        subtitle="Track and settle creator commissions."
        icon={<Wallet className="w-3.5 h-3.5" />}
        action={
          <button
            onClick={() => {
              void onPay(selected);
              setSelected([]);
            }}
            disabled={selected.length === 0}
            className={btnPrimary}
          >
            <Banknote className="w-3 h-3" />
            Pay selected ({selected.length})
          </button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                <th className="py-2 px-2 w-8" />
                <th className="py-2 px-2 font-medium">Creator</th>
                <th className="py-2 px-2 font-medium text-right">Owed</th>
                <th className="py-2 px-2 font-medium text-right">Paid</th>
                <th className="py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">No creators yet.</td>
                </tr>
              ) : (
                creators.map((c) => {
                  const has = selected.includes(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={() => toggle(c.id)}
                          disabled={Number(c.commissionOwed || 0) <= 0}
                          className="w-3.5 h-3.5 accent-blue-950"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="text-[13px] text-slate-400 font-mono">{c.handle}</p>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-900">
                        {Number(c.commissionOwed || 0) ? KES(c.commissionOwed) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                        {Number(c.commissionPaid || 0) ? KES(c.commissionPaid) : '—'}
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge variant={creatorStatusVariant(c.status)} dot>{c.status}</StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {payouts.length > 0 && (
        <Card>
          <CardHeader title="Payout history" subtitle={`${payouts.length} batches`} />
          <div className="p-2 space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-slate-200 rounded p-2">
                <div>
                  <p className="font-mono text-[13px] font-medium text-slate-900">{p.reference}</p>
                  <p className="text-[13px] text-slate-500">{formatDate(p.createdAt)}</p>
                </div>
                <StatusBadge variant={p.status === 'Paid' ? 'success' : p.status === 'Failed' ? 'danger' : 'warning'} dot>
                  {p.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TaxTab({
  summary,
  creators,
}: {
  summary: AdminFinanceSummaryResponse | null;
  creators: AdminDirectCreator[];
}) {
  const totalRevenue = summary?.totalRevenue ?? 0;
  const vat = totalRevenue * 0.16;
  const wht = totalRevenue * 0.05;
  const totalCommission = creators.reduce((a, c) => a + Number(c.commissionOwed || 0), 0);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Tax Summary"
        subtitle="Estimated VAT and withholding tax on revenue."
        icon={<Banknote className="w-3.5 h-3.5" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Revenue" value={KES(totalRevenue)} icon={<Banknote className="w-4 h-4" />} />
        <KpiCard label="VAT (16%)" value={KES(vat)} icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="WHT (5%)" value={KES(wht)} icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Commission total" value={KES(totalCommission)} icon={<UserRound className="w-4 h-4" />} />
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-2">
      <PageHeader title="Shop Settings" subtitle="Manage your shop configuration." icon={<SettingsIcon className="w-3.5 h-3.5" />} />
      <Card>
        <CardHeader title="General" subtitle="Basic shop details." />
        <div className="p-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormField label="Shop name">
              <input className={inputCls} defaultValue={SHOP_NAME} />
            </FormField>
            <FormField label="Currency">
              <input className={inputCls} defaultValue="KES" disabled />
            </FormField>
            <FormField label="Support email">
              <input className={inputCls} type="email" placeholder="support@example.com" />
            </FormField>
            <FormField label="Support phone">
              <input className={inputCls} type="tel" placeholder="+254…" />
            </FormField>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TeamTab({ team }: { team: AdminTeamMember[] }) {
  return (
    <div className="space-y-2">
      <PageHeader title="Team" subtitle="Everyone who has access to this shop." icon={<UserRound className="w-3.5 h-3.5" />} />
      {team.length === 0 ? (
        <EmptyState icon={<UserRound className="w-5 h-5" />} title="No team members yet" description="Invite teammates from your settings." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Name</th>
                  <th className="py-2 px-2 font-medium">Email</th>
                  <th className="py-2 px-2 font-medium">Role</th>
                  <th className="py-2 px-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.name} className="w-7 h-7" />
                        <span className="font-medium text-slate-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{t.email}</td>
                    <td className="py-2 px-2">
                      <StatusBadge variant={t.role === 'Owner' ? 'brand' : 'neutral'} dot>{t.role}</StatusBadge>
                    </td>
                    <td className="py-2 px-2 text-slate-500">{formatDate(t.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── forms & drawers ─── */

function LogOrderForm({
  products,
  onSubmit,
  onCancel,
}: {
  products: AdminDirectProduct[];
  onSubmit: (o: AdminDirectOrder) => void;
  onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState<AdminDirectOrderSource>('tiktok_dm');
  const [items, setItems] = useState<Array<{ productId?: string; productName: string; sku: string; image: string; quantity: number; price: number }>>([]);
  const [productId, setProductId] = useState('');

  const addItem = () => {
    const p = products.find((x) => String(x.id) === productId);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: String(p.id),
        productName: p.name,
        sku: p.sku,
        image: p.image,
        quantity: 1,
        price: Number(p.price || 0),
      },
    ]);
    setProductId('');
  };

  const total = items.reduce((a, i) => a + i.price * i.quantity, 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField label="Customer name" required>
          <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </FormField>
        <FormField label="Customer phone" required>
          <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </FormField>
        <FormField label="Source" required>
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as AdminDirectOrderSource)}>
            <option value="tiktok_dm">TikTok DM</option>
            <option value="tiktok_comment">TikTok Comment</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="bio_link">Bio link</option>
            <option value="live">TikTok LIVE</option>
          </select>
        </FormField>
      </div>

      <SectionLabel>Items</SectionLabel>
      <div className="flex gap-2">
        <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name} — {KES(p.price)}
            </option>
          ))}
        </select>
        <button onClick={addItem} disabled={!productId} className={btnSecondary}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 border border-slate-200 rounded p-2">
            <Thumb src={it.image} className="w-8 h-8" fallbackIcon={<Package className="w-3 h-3" />} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-900 truncate">{it.productName}</p>
              <p className="text-[13px] text-slate-500 tabular-nums">{KES(it.price)}</p>
            </div>
            <input
              type="number"
              min={1}
              value={it.quantity}
              onChange={(e) => {
                const q = Math.max(1, Number(e.target.value) || 1);
                setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, quantity: q } : x)));
              }}
              className={cn(inputCls, 'w-16 text-right')}
            />
            <button
              onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              className={iconBtn}
              aria-label="Remove item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
        <p className="text-[13px] text-slate-500">
          Total: <span className="font-semibold text-slate-900">{KES(total)}</span>
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button
            onClick={() =>
              onSubmit({
                id: 0,
                reference: `ORD-${Date.now()}`,
                customerName,
                customerPhone,
                customerEmail: '',
                source,
                status: 'New',
                total: String(total),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                paymentMethod: 'M-Pesa',
                notes: '',
                items: items.map((it) => ({
                  productId: it.productId ?? '',
                  productName: it.productName,
                  sku: it.sku,
                  image: it.image,
                  quantity: it.quantity,
                  price: String(it.price),
                })),
              } as AdminDirectOrder)
            }
            disabled={!customerName || !customerPhone || items.length === 0}
            className={btnPrimary}
          >
            <CheckCircle2 className="w-3 h-3" />
            Save order
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProductForm({
  brands,
  categories,
  onSubmit,
  onCancel,
}: {
  brands: AdminBrandRef[];
  categories: AdminCategoryRef[];
  onSubmit: (p: AdminDirectProductWrite) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [image, setImage] = useState('');
  const [brandId, setBrandId] = useState<number | undefined>(brands[0]?.id);
  const [categoryId, setCategoryId] = useState<number | undefined>(categories[0]?.id);
  const [status, setStatus] = useState<'Active' | 'Draft'>('Active');

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField label="Name" required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="SKU">
          <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} />
        </FormField>
        <FormField label="Price (KES)" required>
          <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </FormField>
        <FormField label="Stock quantity" required>
          <input type="number" className={inputCls} value={stock} onChange={(e) => setStock(e.target.value)} />
        </FormField>
        <FormField label="Brand">
          <select className={inputCls} value={brandId ?? ''} onChange={(e) => setBrandId(Number(e.target.value) || undefined)}>
            <option value="">—</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </FormField>
        <FormField label="Category">
          <select className={inputCls} value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value) || undefined)}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'Active' | 'Draft')}>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
          </select>
        </FormField>
      </div>

      <ImageUpload label="Product image" value={image} onChange={setImage} />

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() =>
            onSubmit({
              name,
              sku,
              image,
              price: Number(price || 0),
              stockQuantity: Number(stock || 0),
              brandId,
              categoryId,
              status,
            } as AdminDirectProductWrite)
          }
          disabled={!name || !price}
          className={btnPrimary}
        >
          Save product
        </button>
      </div>
    </div>
  );
}

function AddContentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (c: AdminDirectContentWrite) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  return (
    <div className="space-y-2">
      <FormField label="Title" required>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>
      <FormField label="Caption">
        <textarea className={cn(inputCls, 'min-h-[72px]')} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </FormField>
      <VideoUpload label="Video" value={videoUrl} onChange={setVideoUrl} />
      <ImageUpload label="Thumbnail" value={thumbnailUrl} onChange={setThumbnailUrl} />
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() => onSubmit({ title, caption, videoUrl, thumbnailUrl } as AdminDirectContentWrite)}
          disabled={!title}
          className={btnPrimary}
        >
          Save content
        </button>
      </div>
    </div>
  );
}

function ScheduleLiveForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (l: AdminDirectLiveWrite) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  return (
    <div className="space-y-2">
      <FormField label="Session title" required>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>
      <FormField label="Host name">
        <input className={inputCls} value={hostName} onChange={(e) => setHostName(e.target.value)} />
      </FormField>
      <FormField label="Scheduled at" required>
        <input type="datetime-local" className={inputCls} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </FormField>
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() => onSubmit({ title, hostName, scheduledAt } as AdminDirectLiveWrite)}
          disabled={!title || !scheduledAt}
          className={btnPrimary}
        >
          Schedule
        </button>
      </div>
    </div>
  );
}

function AddCreatorForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (c: AdminDirectCreatorWrite) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [rate, setRate] = useState('10');

  return (
    <div className="space-y-2">
      <FormField label="Creator name" required>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Handle" required>
        <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
      </FormField>
      <FormField label="Platform">
        <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="TikTok">TikTok</option>
          <option value="Instagram">Instagram</option>
          <option value="YouTube">YouTube</option>
        </select>
      </FormField>
      <FormField label="Commission rate (%)" required>
        <input type="number" className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} />
      </FormField>
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button
          onClick={() => onSubmit({ name, handle, platform, commissionRate: Number(rate || 0) } as AdminDirectCreatorWrite)}
          disabled={!name || !handle}
          className={btnPrimary}
        >
          Add creator
        </button>
      </div>
    </div>
  );
}

function OrderDetail({
  order,
  isLogged,
  onAdvance,
  onClose,
}: {
  order: AdminDirectOrder;
  isLogged: boolean;
  onAdvance: (next: AdminDirectOrderStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge variant={orderStatusVariant(order.status)} dot>{order.status}</StatusBadge>
        {isLogged && (
          <span className="inline-flex items-center gap-1 text-[13px] text-slate-500">
            <Sparkles className="w-3 h-3" /> Logged manually
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[13px]">
        <div>
          <p className="text-slate-500">Customer</p>
          <p className="font-medium text-slate-900">{order.customerName}</p>
          <p className="text-slate-600">{order.customerPhone}</p>
        </div>
        <div>
          <p className="text-slate-500">Source</p>
          <p className="font-medium text-slate-900">{sourceLabel(order.source)}</p>
          <p className="text-slate-600">{formatDateTime(order.createdAt)}</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded">
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 p-2 border-b border-slate-100 last:border-0">
            <Thumb src={it.image} className="w-8 h-8" fallbackIcon={<Package className="w-3 h-3" />} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-900 truncate">{it.productName}</p>
              <p className="text-[13px] text-slate-500 font-mono truncate">{it.sku}</p>
            </div>
            <p className="text-[13px] text-slate-500 tabular-nums">×{it.quantity}</p>
            <p className="text-[13px] font-medium text-slate-900 tabular-nums">{KES(it.price)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold text-slate-900 tabular-nums">{KES(order.total)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-2">
        <button onClick={onClose} className={btnSecondary}>Close</button>
        {order.status === 'Paid' && (
          <button onClick={() => onAdvance('Awaiting Shipment')} className={btnPrimary}>Mark shipped</button>
        )}
        {order.status === 'Awaiting Shipment' && (
          <button onClick={() => onAdvance('Shipped')} className={btnPrimary}>Ship</button>
        )}
        {order.status === 'Shipped' && (
          <button onClick={() => onAdvance('Delivered')} className={btnSecondary}>Delivered</button>
        )}
      </div>
    </div>
  );
}