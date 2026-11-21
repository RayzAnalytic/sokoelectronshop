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
  Printer,
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
  Mail,
  Copy,
  Inbox as InboxIcon,
  UserRound,
  Boxes,
  Receipt,
  Undo2,
  UserCog,
  ExternalLink,
  Send,
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
  AdminDirectContentPlatform,
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
type ContentWriteWithVideo = AdminDirectContentWrite & {
  videoUrl?: string | null;
};

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

const inputCls =
  'w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 active:bg-blue-950 text-white font-medium px-2.5 py-1.5 text-[13px] rounded-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950/30 disabled:opacity-60 disabled:cursor-not-allowed';

const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium px-2.5 py-1.5 text-[13px] rounded-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950/10 disabled:opacity-60 disabled:cursor-not-allowed';

const btnDanger =
  'inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium px-2.5 py-1.5 text-[13px] rounded-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30 disabled:opacity-60 disabled:cursor-not-allowed';

const iconBtn =
  'inline-flex items-center justify-center h-7 w-7 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950/20';

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

const PAYOUT_STATUS_VARIANT = (
  s: AdminPayoutBatch['status'],
): BadgeVariant =>
  s === 'Paid'
    ? 'success'
    : s === 'Failed'
      ? 'danger'
      : s === 'Approved'
        ? 'info'
        : s === 'Pending'
          ? 'warning'
          : 'neutral';

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
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
    <div className="max-w-sm mx-auto my-6 bg-white border border-slate-200 rounded p-2 text-center">
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
        <button onClick={action.onClick} className={cn(btnPrimary, 'mt-2')}>
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
        style={{ animation: 'modalIn 180ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="px-2 py-2 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3
              id="modal-title"
              className="text-[13px] font-semibold text-slate-900 truncate"
            >
              {title}
            </h3>
            <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className={iconBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">{children}</div>
      </div>
      <style jsx global>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-slate-200">
      {children}
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
    <Modal
      onClose={onCancel}
      title={title}
      subtitle={description}
      widthClass="max-w-sm"
    >
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

      {helper && !error && (
        <p className="text-[13px] text-slate-500">{helper}</p>
      )}
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
          <div
            onClick={handlePick}
            className="cursor-pointer text-center px-2 py-6"
          >
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

      {helper && !error && (
        <p className="text-[13px] text-slate-500">{helper}</p>
      )}
      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const styles = {
    success: {
      bg: 'bg-white border-slate-200',
      icon: <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0" />,
    },
    error: {
      bg: 'bg-white border-red-200',
      icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />,
    },
    info: {
      bg: 'bg-white border-slate-200',
      icon: <Info className="w-4 h-4 text-slate-700 shrink-0" />,
    },
  }[toast.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-3 right-3 z-[130] px-2 py-2 border rounded flex items-center gap-2 text-[13px] text-slate-900 max-w-xs',
        styles.bg,
      )}
      style={{ animation: 'toastIn 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {styles.icon}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-slate-700"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <style jsx global>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          'relative inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
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
          'relative inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
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
          className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-sm shadow-2xl min-w-[220px] z-[120] py-1"
          style={{ animation: 'menuIn 140ms cubic-bezier(0.16, 1, 0.3, 1)' }}
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

      <style jsx global>{`
        @keyframes menuIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

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
  const [selectedOrder, setSelectedOrder] = useState<AdminDirectOrder | null>(
    null,
  );
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
    if (
      results[3].status === 'fulfilled' ||
      results[4].status === 'fulfilled'
    ) {
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
    if (results[14].status === 'fulfilled')
      setAnalyticsSummary(results[14].value);
    if (results[15].status === 'fulfilled')
      setFinanceSummary(results[15].value);

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
    const activeCreators = creators.filter(
      (c) => c.status === 'Active',
    ).length;
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
            setProducts((prev) =>
              prev.filter((p) => String(p.id) !== String(id)),
            );
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
        prev.map((o) =>
          o.reference === reference ? { ...o, status: next } : o,
        ),
      );
      setSelectedOrder((prev) =>
        prev?.reference === reference ? { ...prev, status: next } : prev,
      );

      try {
        const updated = isLogged
          ? await adminApi.directOrders.logged.advance(reference, {
            status: next,
          })
          : await adminApi.directOrders.orders.advance(reference, {
            status: next,
          });

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
        setOrders((prev) =>
          prev.filter((o) => o.reference !== newOrder.reference),
        );
        setLoggedRefs((prev) => {
          const next = new Set(prev);
          next.delete(newOrder.reference);
          return next;
        });
        showToast(
          e instanceof Error ? e.message : 'Failed to save order',
          'error',
        );
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
        showToast(
          e instanceof Error ? e.message : 'Failed to add content',
          'error',
        );
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
        showToast(
          e instanceof Error ? e.message : 'Failed to schedule LIVE',
          'error',
        );
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
        showToast(
          e instanceof Error ? e.message : 'Failed to add creator',
          'error',
        );
      }
    },
    [showToast],
  );

  const handleConvertInbox = useCallback(
    async (conversation: AdminInboxConversation) => {
      try {
        const created = await adminApi.directOrders.inbox.convert(
          conversation.id,
          {
            customerName: conversation.contactName,
            customerPhone: conversation.contactHandle,
            source: 'whatsapp',
            items: [],
          },
        );
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
        showToast(
          e instanceof Error ? e.message : 'Failed to send reply',
          'error',
        );
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
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-blue-950 focus:text-white focus:px-3 focus:py-1.5 focus:text-[13px] focus:rounded"
      >
        Skip to content
      </a>

      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1700px] mx-auto px-0.5 lg:px-0.5">
          <div className="py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-9 h-9 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <TikTokLogo className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[13px] font-semibold text-slate-900 truncate">
                  {SHOP_NAME}
                </h1>
                <p className="text-[13px] text-slate-500 truncate mt-0.5">
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
                <RefreshCw
                  className={cn('w-3 h-3', refreshing && 'animate-spin')}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => setLogOrderOpen(true)}
                className={btnPrimary}
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Log New Order</span>
                <span className="sm:hidden">Order</span>
              </button>
            </div>
          </div>

          <nav
            aria-label="Sections"
            className="relative flex flex-wrap items-center gap-0.5 -mb-px"
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
        className="max-w-[1700px] mx-auto px-0.5 lg:px-0.5 py-2 space-y-2 bg-white"
      >
        {loadError && (
          <div className="bg-white border border-red-200 rounded p-2 flex items-start gap-2">
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

            {tab === 'Returns' && (
              <ReturnsTab returns={returns} orders={orders} />
            )}

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

      {logOrderOpen && (
        <LogOrderModal
          onClose={() => setLogOrderOpen(false)}
          onSubmit={(o) => void handleLogOrder(o)}
          products={products}
        />
      )}

      {addProductOpen && (
        <AddProductModal
          onClose={() => setAddProductOpen(false)}
          onSubmit={handleAddProduct}
          brands={brands}
          categories={categories}
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
          isLogged={loggedRefs.has(selectedOrder.reference)}
          onClose={() => setSelectedOrder(null)}
          onAdvance={(next) =>
            void advanceOrderStatus(selectedOrder.reference, next)
          }
        />
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
    <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2 hover:border-slate-300 transition-all">
      <span className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-slate-100 text-slate-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-500 uppercase truncate">
          {label}
        </p>
        <p className="text-base font-bold text-slate-900 truncate tabular-nums">
          {value}
        </p>
      </div>
    </div>
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
      className="w-full text-left border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 p-2 flex items-center gap-2 transition-all group"
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
  const lowStock = products.filter(
    (p) => p.stockQuantity <= 5,
  );
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
        <KpiCard
          label="Orders"
          value={String(stats.ordersMonth)}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <KpiCard
          label="Revenue"
          value={KES(stats.revenue)}
          icon={<Banknote className="w-4 h-4" />}
        />
        <KpiCard
          label="Orders to Send"
          value={String(stats.pendingShipment)}
          icon={<Truck className="w-4 h-4" />}
        />
        <KpiCard
          label="Active Creators"
          value={String(stats.activeCreators)}
          icon={<UserRound className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded">
          <div className="px-2 py-2 border-b border-slate-200">
            <p className="text-[13px] font-semibold text-slate-900">
              Action needed
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Orders waiting to be sent, products running low, and creator payments due.
            </p>
          </div>
          <div className="p-2 space-y-2">
            {overdue.length === 0 &&
              lowStock.length === 0 &&
              unpaidCommissions.length === 0 && (
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
                    {overdue.length} order{overdue.length > 1 ? 's' : ''}{' '}
                    awaiting shipment
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
                    {lowStock.length} product{lowStock.length > 1 ? 's' : ''}{' '}
                    running low
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
                    {unpaidCommissions.length} creator commission
                    {unpaidCommissions.length > 1 ? 's' : ''} unpaid
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
        </div>

        <div className="bg-white border border-slate-200 rounded">
          <div className="px-2 py-2 border-b border-slate-200">
            <p className="text-[13px] font-semibold text-slate-900">
              Quick actions
            </p>
          </div>
          <div className="p-2 grid grid-cols-2 gap-2">
            <QuickAction
              icon={<ShoppingBag className="w-3.5 h-3.5" />}
              title="Log Order"
              onClick={onCreateOrder}
            />
            <QuickAction
              icon={<Package className="w-3.5 h-3.5" />}
              title="Add Product"
              onClick={onAddProduct}
            />
            <QuickAction
              icon={<Video className="w-3.5 h-3.5" />}
              title="Schedule LIVE"
              onClick={onScheduleLive}
            />
            <QuickAction
              icon={<Wallet className="w-3.5 h-3.5" />}
              title="Payouts"
              onClick={onGoToPayouts}
            />
          </div>
        </div>
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
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            Shop Products
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Products from your store catalog.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-5 h-5" />}
          title="No products added yet"
          description="Add your first product to start tracking TikTok sales and stock."
          action={{
            label: 'Add Product',
            onClick: onAddProduct,
            icon: <Plus className="w-3 h-3" />,
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
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
                  <th className="py-2 px-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-slate-400 text-[13px]"
                    >
                      No products match &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  shown.map((p, idx) => (
                    <tr
                      key={`${p.id}-${idx}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Thumb
                            src={p.image}
                            className="w-8 h-8"
                            fallbackIcon={<Package className="w-3.5 h-3.5" />}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-xs">
                              {p.name}
                            </p>
                            {(p.brand || p.category) && (
                              <p className="text-[13px] text-slate-400 truncate">
                                {[p.brand, p.category]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-[13px] text-slate-500">
                        {p.sku || '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-medium text-slate-900 tabular-nums">
                          {KES(p.price)}
                        </span>
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
                        <StatusBadge variant={productStatusVariant(p.status)} dot>
                          {p.status}
                        </StatusBadge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <p className="font-medium text-slate-900 tabular-nums">
                          {p.directSalesCount}
                        </p>
                        <p className="text-[13px] text-slate-400 tabular-nums">
                          {KES(p.directRevenue)}
                        </p>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-end">
                          <button
                            className={iconBtn}
                            aria-label={`Delete ${p.name}`}
                            onClick={() => onDeleteProduct(p.id, p.name)}
                          >
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
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className={btnSecondary}
              >
                Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InventoryTab({ products }: { products: AdminDirectProduct[] }) {
  const buckets = useMemo(() => {
    const out = {
      out: [] as AdminDirectProduct[],
      low: [] as AdminDirectProduct[],
      ok: [] as AdminDirectProduct[],
    };
    products.forEach((p) => {
      if (p.stockQuantity === 0) out.out.push(p);
      else if (p.stockQuantity <= 5) out.low.push(p);
      else out.ok.push(p);
    });
    return out;
  }, [products]);

  const totalValue = products.reduce(
    (a, p) => a + Number(p.price || 0) * p.stockQuantity,
    0,
  );

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Boxes className="w-3.5 h-3.5 text-slate-400" />
          Inventory
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Stock position across all catalog products.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Total SKUs"
          value={String(products.length)}
          icon={<Package className="w-4 h-4" />}
        />
        <KpiCard
          label="Out of Stock"
          value={String(buckets.out.length)}
          icon={<AlertCircle className="w-4 h-4" />}
        />
        <KpiCard
          label="Low Stock"
          value={String(buckets.low.length)}
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiCard
          label="Stock Value"
          value={KES(totalValue)}
          icon={<Banknote className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wide">
                <th className="py-2 px-2 font-medium">Product</th>
                <th className="py-2 px-2 font-medium">SKU</th>
                <th className="py-2 px-2 font-medium text-right">On hand</th>
                <th className="py-2 px-2 font-medium text-right">
                  Unit price
                </th>
                <th className="py-2 px-2 font-medium text-right">Value</th>
                <th className="py-2 px-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">
                    No inventory yet.
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => {
                  const value = Number(p.price || 0) * p.stockQuantity;
                  const health =
                    p.stockQuantity === 0
                      ? {
                        label: 'Out of stock',
                        variant: 'danger' as BadgeVariant,
                      }
                      : p.stockQuantity <= 5
                        ? { label: 'Low', variant: 'warning' as BadgeVariant }
                        : {
                          label: 'Healthy',
                          variant: 'success' as BadgeVariant,
                        };
                  return (
                    <tr
                      key={`${p.id}-${idx}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Thumb
                            src={p.image}
                            className="w-7 h-7"
                            fallbackIcon={<Package className="w-3 h-3" />}
                          />
                          <p className="font-medium text-slate-900 truncate max-w-xs">
                            {p.name}
                          </p>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-[13px] text-slate-500">
                        {p.sku || '—'}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                        {p.stockQuantity}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                        {KES(p.price)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-900">
                        {KES(value)}
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge variant={health.variant} dot>
                          {health.label}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  const [statusFilter, setStatusFilter] = useState<
    AdminDirectOrderStatus | 'All'
  >('All');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list =
      statusFilter === 'All'
        ? orders
        : orders.filter((o) => o.status === statusFilter);
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
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
            Orders
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Log and track every sale from TikTok.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-5 h-5" />}
          title="No orders logged yet"
          description="When a customer buys through TikTok, log the order here."
          action={{
            label: 'Log New Order',
            onClick: onLogOrder,
            icon: <Plus className="w-3 h-3" />,
          }}
        />
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded p-1 flex items-center gap-0.5 overflow-x-auto">
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
                    active
                      ? 'bg-blue-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {s.label}
                  <span
                    className={cn(
                      'inline-block px-1 py-0.5 text-[13px] font-semibold tabular-nums rounded',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                    <th className="py-2 px-2 font-medium">Order</th>
                    <th className="py-2 px-2 font-medium">Customer</th>
                    <th className="py-2 px-2 font-medium">Items</th>
                    <th className="py-2 px-2 font-medium text-right">Total</th>
                    <th className="py-2 px-2 font-medium">Status</th>
                    <th className="py-2 px-2 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-slate-400 text-[13px]"
                      >
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
                              <span className="font-mono font-medium text-slate-900">
                                {o.reference}
                              </span>
                              {isLogged && (
                                <span
                                  title="Manually logged"
                                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[13px] font-medium bg-white text-slate-600 border border-slate-200"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Logged
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <p className="text-slate-800 truncate max-w-[160px]">
                              {o.customerName}
                            </p>
                            <p className="text-[13px] text-slate-400">
                              {sourceLabel(o.source)}
                            </p>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Thumb
                                src={firstItem?.image}
                                className="w-7 h-7"
                                fallbackIcon={<Package className="w-3 h-3" />}
                              />
                              <span className="text-slate-600 truncate max-w-[200px]">
                                {firstItem?.productName || '—'}
                                {o.items.length > 1 &&
                                  ` +${o.items.length - 1}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                            {KES(o.total)}
                          </td>
                          <td className="py-2 px-2">
                            <StatusBadge variant={orderStatusVariant(o.status)} dot>
                              {o.status}
                            </StatusBadge>
                          </td>
                          <td
                            className="py-2 px-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {o.status === 'Paid' && (
                              <button
                                onClick={() =>
                                  onAdvance(o.reference, 'Awaiting Shipment')
                                }
                                className={btnPrimary}
                              >
                                Mark shipped
                              </button>
                            )}
                            {o.status === 'Awaiting Shipment' && (
                              <button
                                onClick={() =>
                                  onAdvance(o.reference, 'Shipped')
                                }
                                className={btnPrimary}
                              >
                                Ship
                              </button>
                            )}
                            {o.status === 'Shipped' && (
                              <button
                                onClick={() =>
                                  onAdvance(o.reference, 'Delivered')
                                }
                                className={btnSecondary}
                              >
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
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className={btnSecondary}
                >
                  Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
                </button>
              </div>
            )}
          </div>
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
  const [active, setActive] = useState<number | null>(
    conversations[0]?.id ?? null,
  );
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

  const channelVariant = (
    c: AdminInboxConversation['channel'],
  ): BadgeVariant => {
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
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <InboxIcon className="w-3.5 h-3.5 text-slate-400" />
            Inbox
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            WhatsApp, TikTok DMs, and comments in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant="info" dot>
            {unread} unread
          </StatusBadge>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-[520px] overflow-hidden">
        <div className="border-r border-slate-200 overflow-y-auto">
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
                <Avatar
                  name={m.contactName || m.contactHandle || '?'}
                  className="w-8 h-8 mt-0.5"
                />
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
                    <StatusBadge variant={channelVariant(m.channel)}>
                      {channelLabel(m.channel)}
                    </StatusBadge>
                    {m.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-blue-950 text-white text-[13px] font-semibold">
                        {m.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-500 truncate mt-1">
                    {m.messages?.[m.messages.length - 1]?.body ||
                      m.subject ||
                      'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col">
          {current ? (
            <>
              <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    name={current.contactName || current.contactHandle || '?'}
                    className="w-8 h-8"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                      {current.contactName || 'Unknown'}
                    </p>
                    <p className="text-[13px] text-slate-500 truncate">
                      {current.contactHandle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className={btnSecondary}
                    onClick={() => {
                      if (current.contactHandle) {
                        window.location.href = `tel:${current.contactHandle}`;
                      }
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
                    {current.status === 'converted'
                      ? 'Converted'
                      : 'Convert to order'}
                  </button>
                </div>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {(current.messages ?? []).length === 0 ? (
                  <p className="text-[13px] text-slate-400 text-center py-6">
                    No messages yet.
                  </p>
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
                <button
                  className={btnPrimary}
                  onClick={() => void handleSend()}
                  disabled={!reply.trim()}
                >
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
      </div>
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

  const totalSpend = customers.reduce(
    (a, c) => a + Number(c.lifetimeSpend || 0),
    0,
  );
  const repeatRate =
    customerStats?.repeatRate ??
    (customers.length === 0
      ? 0
      : Math.round(
        (customers.filter((c) => c.totalOrders >= 2).length /
          customers.length) *
        100,
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
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <UserRound className="w-3.5 h-3.5 text-slate-400" />
            Customers
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Everyone who bought from your TikTok channels.
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers…"
            className={cn(inputCls, 'w-56 pl-7')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Customers"
          value={String(customerStats?.total ?? customers.length)}
          icon={<UserRound className="w-4 h-4" />}
        />
        <KpiCard
          label="Repeat rate"
          value={`${repeatRate}%`}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiCard
          label="VIP customers"
          value={String(
            customerStats?.vip ??
            customers.filter((c) => c.segment === 'VIP').length,
          )}
          icon={<Sparkles className="w-4 h-4" />}
        />
        <KpiCard
          label="Lifetime spend"
          value={KES(customerStats?.lifetimeSpend ?? totalSpend)}
          icon={<Banknote className="w-4 h-4" />}
        />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={<UserRound className="w-5 h-5" />}
          title="No customers yet"
          description="Customers will appear once you log orders."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
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
                          : c.segment === 'COD Risk' ||
                            c.segment === 'Inactive'
                            ? 'danger'
                            : 'neutral';
                    const key = c.phone || c.name;
                    const lastOrderIso =
                      c.lastOrderAt || customerOrderMap.get(key) || null;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={c.name} className="w-7 h-7" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[200px]">
                                {c.name}
                              </p>
                              {c.county && (
                                <p className="text-[13px] text-slate-400 truncate">
                                  {c.county}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <p className="text-slate-700">{c.phone || '—'}</p>
                          {c.email && (
                            <p className="text-[13px] text-slate-400 truncate max-w-[180px]">
                              {c.email}
                            </p>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <StatusBadge variant={segmentVariant} dot>
                            {c.segment}
                          </StatusBadge>
                        </td>
                        <td className="py-2 px-2 text-center tabular-nums text-slate-700">
                          {c.totalOrders}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-900">
                          {KES(c.lifetimeSpend)}
                        </td>
                        <td className="py-2 px-2 text-slate-500">
                          {formatDate(lastOrderIso)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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

  const columns: {
    id: AdminDirectOrderStatus;
    label: string;
    variant: BadgeVariant;
  }[] = [
      { id: 'Paid', label: 'Paid — pack', variant: 'info' },
      { id: 'Awaiting Shipment', label: 'Ready to ship', variant: 'warning' },
      { id: 'Shipped', label: 'In transit', variant: 'info' },
      { id: 'Delivered', label: 'Delivered', variant: 'success' },
    ];

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-slate-400" />
          Fulfillment
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Pack, ship, and confirm deliveries. {queue.length} orders in the queue.
        </p>
      </div>

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
              <div
                key={col.id}
                className="bg-white border border-slate-200 rounded flex flex-col"
              >
                <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between">
                  <StatusBadge variant={col.variant} dot>
                    {col.label}
                  </StatusBadge>
                  <span className="text-[13px] text-slate-500 tabular-nums">
                    {items.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {items.length === 0 ? (
                    <p className="text-[13px] text-slate-400 text-center py-4">
                      Empty
                    </p>
                  ) : (
                    items.map((o) => (
                      <button
                        key={o.reference}
                        onClick={() => onSelectOrder(o)}
                        className="w-full text-left border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 p-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[13px] font-medium text-slate-900">
                            {o.reference}
                          </span>
                          {loggedRefs.has(o.reference) && (
                            <Sparkles className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <p className="text-[13px] text-slate-600 truncate mt-0.5">
                          {o.customerName}
                        </p>
                        <p className="text-[13px] text-slate-400 tabular-nums mt-0.5">
                          {KES(o.total)}
                        </p>
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
              </div>
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
  const returnedValue = returns.reduce(
    (a, r) => a + Number(r.refundAmount || 0),
    0,
  );

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Undo2 className="w-3.5 h-3.5 text-slate-400" />
          Returns & Refunds
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Cancelled and returned orders, with the value affected.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Returns"
          value={String(returns.filter((r) => r.status !== 'Rejected').length)}
          icon={<Undo2 className="w-4 h-4" />}
        />
        <KpiCard
          label="Pending"
          value={String(returns.filter((r) => r.status === 'Requested').length)}
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiCard
          label="Value affected"
          value={KES(returnedValue)}
          icon={<Banknote className="w-4 h-4" />}
        />
        <KpiCard
          label="Return rate"
          value={`${orders.length === 0
              ? 0
              : Math.round((returns.length / orders.length) * 100)
            }%`}
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
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
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
                    <td className="py-2 px-2 font-mono font-medium text-slate-900">
                      {r.reference}
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-700">
                      {r.orderReference}
                    </td>
                    <td className="py-2 px-2 text-slate-500">
                      {r.reasonDetail || r.reason}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-slate-900">
                      {KES(r.refundAmount)}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge
                        variant={RETURN_STATUS_VARIANT(r.status)}
                        dot
                      >
                        {r.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
      <div className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-slate-400" />
            Content
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Plan, schedule, and track TikTok videos.
          </p>
        </div>
        <button onClick={onAddContent} className={btnPrimary}>
          <Plus className="w-3 h-3" />
          Add Content
        </button>
      </div>

      {content.length === 0 ? (
        <EmptyState
          icon={<Video className="w-5 h-5" />}
          title="No TikTok content planned yet"
          description="Create your first video idea to start tracking what works."
          action={{
            label: 'Add Content',
            onClick: onAddContent,
            icon: <Plus className="w-3 h-3" />,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {content.map((cRaw) => {
            const c = cRaw as ContentWithVideo;
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded overflow-hidden hover:border-slate-300 transition-all"
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
                    <Thumb
                      src={c.thumbnailUrl}
                      className="!w-full !h-full !border-0"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5">
                    <StatusBadge variant={contentStatusVariant(c.status)} dot>
                      {c.status}
                    </StatusBadge>
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
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {c.title}
                  </p>
                  {c.scheduledAt && (
                    <p className="text-[13px] text-slate-400 inline-flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(c.scheduledAt)}
                    </p>
                  )}
                  {c.caption && (
                    <p className="text-[13px] text-slate-500 truncate">
                      {c.caption}
                    </p>
                  )}
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
              </div>
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
      <div className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-slate-400" />
            LIVE Sessions
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Plan and track TikTok livestream selling sessions.
          </p>
        </div>
        <button onClick={onScheduleLive} className={btnPrimary}>
          <Plus className="w-3 h-3" />
          Schedule LIVE
        </button>
      </div>

      {lives.length === 0 ? (
        <EmptyState
          icon={<Video className="w-5 h-5" />}
          title="No LIVE sessions scheduled"
          description="Plan your first TikTok livestream to start selling live."
          action={{
            label: 'Schedule LIVE',
            onClick: onScheduleLive,
            icon: <Plus className="w-3 h-3" />,
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Session</th>
                  <th className="py-2 px-2 font-medium">Scheduled</th>
                  <th className="py-2 px-2 font-medium text-center">
                    Peak viewers
                  </th>
                  <th className="py-2 px-2 font-medium text-center">Orders</th>
                  <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lives.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 px-2">
                      <p className="font-medium text-slate-900">{l.title}</p>
                      <p className="text-[13px] text-slate-400">
                        {l.hostName || '—'}
                      </p>
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {formatDateTime(l.scheduledAt)}
                    </td>
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
                      <StatusBadge variant={liveStatusVariant(l.status)} dot>
                        {l.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
      <div className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <UserRound className="w-3.5 h-3.5 text-slate-400" />
            Creators
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Track creators and manage their commissions.
          </p>
        </div>
        <button onClick={onAddCreator} className={btnPrimary}>
          <Plus className="w-3 h-3" />
          Add Creator
        </button>
      </div>

      {creators.length === 0 ? (
        <EmptyState
          icon={<UserRound className="w-5 h-5" />}
          title="No creators added yet"
          description="Add a TikTok creator to start tracking their sales and commissions."
          action={{
            label: 'Add Creator',
            onClick: onAddCreator,
            icon: <Plus className="w-3 h-3" />,
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
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
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Thumb
                          src={c.avatar}
                          className="w-7 h-7"
                          fallbackIcon={<UserRound className="w-3.5 h-3.5" />}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-[13px] text-slate-400 font-mono">
                            {c.handle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {c.platform || '—'}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">
                      {c.commissionRate}%
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">
                      {c.ordersCount}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                      {Number(c.commissionOwed || 0)
                        ? KES(c.commissionOwed)
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 tabular-nums">
                      {KES(c.revenue)}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge variant={creatorStatusVariant(c.status)} dot>
                        {c.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
    <div className="bg-white border border-slate-200 rounded p-2">
      <label className="block text-[13px] font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        defaultValue={value}
        className={inputCls}
      />
      <p className="text-[13px] text-slate-500 mt-1">{helper}</p>
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
  const byStatus = summary?.byStatus ?? [];

  const totalRevenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders === 0 ? 0 : totalRevenue / totalOrders;
  const commissionTotal = creators.reduce(
    (a, c) => a + Number(c.commissionOwed || 0),
    0,
  );

  const pieColors = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];
  const sourceData = bySource.length
    ? bySource.map((s, i) => ({
      name: s.source,
      value: s.count,
      color: pieColors[i % pieColors.length],
    }))
    : [];

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
          Analytics
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Track how TikTok activity translates into sales.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Total Revenue"
          value={KES(summary?.monthRevenue ?? totalRevenue)}
          icon={<Banknote className="w-4 h-4" />}
        />
        <KpiCard
          label="Total Orders"
          value={String(summary?.monthOrders ?? totalOrders)}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <KpiCard
          label="Avg. Order Value"
          value={KES(Math.round(avgOrder))}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiCard
          label="Creator Commissions"
          value={KES(commissionTotal)}
          icon={<UserRound className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="bg-white border border-slate-200 rounded-sm p-2">
          <p className="text-[13px] font-semibold text-slate-900">
            Revenue Trend
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            TikTok revenue over the recent period
          </p>
          <div className="h-52 w-full mt-2">
            {daily.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    stroke="#94a3b8"
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#0f172a', stroke: '#0f172a' }}
                    activeDot={{ r: 4, fill: '#334155', stroke: '#334155' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-2">
          <p className="text-[13px] font-semibold text-slate-900">
            How Orders Arrived
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Which TikTok entry point brought the customer in
          </p>
          <div className="h-52 w-full mt-2">
            {sourceData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {sourceData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {byStatus.length > 0 && (
        <div className="bg-white border border-slate-200 rounded p-2">
          <p className="text-[13px] font-semibold text-slate-900">
            Order Status
          </p>
          <div className="mt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {byStatus.map((s) => (
              <div
                key={s.status}
                className="border border-slate-200 rounded p-2 flex items-center justify-between"
              >
                <span className="text-[13px] text-slate-600">{s.status}</span>
                <span className="text-[13px] font-semibold tabular-nums text-slate-900">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            Manual Metrics
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            TikTok doesn&apos;t share views/followers — enter manually.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <ManualField
            label="Weekly Views"
            helper="Total views this week"
            value="0"
          />
          <ManualField
            label="Followers Gained"
            helper="New followers this week"
            value="0"
          />
          <ManualField
            label="Profile Visits"
            helper="Profile visitors"
            value="0"
          />
          <ManualField
            label="Bio Link Clicks"
            helper="Bio link taps"
            value="0"
          />
        </div>
      </div>
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
    <div className="px-2 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p
          className={cn(
            'text-[13px]',
            emphasis
              ? 'font-semibold text-slate-900'
              : 'font-medium text-slate-800',
          )}
        >
          {label}
        </p>
        <p className="text-[13px] text-slate-500 mt-0.5">{helper}</p>
      </div>
      <p
        className={cn(
          'text-[13px] font-medium whitespace-nowrap tabular-nums',
          negative
            ? 'text-slate-600'
            : emphasis
              ? 'text-slate-900 font-semibold'
              : 'text-slate-900',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FinanceTab({
  summary,
  creators,
}: {
  summary: AdminFinanceSummaryResponse | null;
  creators: AdminDirectCreator[];
}) {
  const gross = Number(summary?.grossRevenue ?? 0);
  const commissions =
    Number(summary?.creatorCommissions ?? 0) ||
    creators.reduce((a, c) => a + Number(c.commissionOwed || 0), 0);
  const withholding = Number(summary?.withholdingTax ?? 0);
  const expenses = Number(summary?.expenses ?? 0);
  const net =
    Number(summary?.netRevenue ?? 0) ||
    gross - commissions - withholding - expenses;

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-slate-400" />
          Finance
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Revenue, creator commissions, and tax obligations.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200">
          <p className="text-[13px] font-semibold text-slate-900">
            Revenue Summary
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Income after commissions and tax deductions.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          <FinanceLine
            label="Gross Revenue"
            helper="Total sales from TikTok orders"
            value={KES(gross)}
          />
          <FinanceLine
            label="Less: Creator Commissions"
            helper="Total owed to creators"
            value={`- ${KES(commissions)}`}
            negative
          />
          <FinanceLine
            label="Less: Withholding Tax"
            helper="5% tax on creator income"
            value={`- ${KES(withholding)}`}
            negative
          />
          {expenses > 0 && (
            <FinanceLine
              label="Less: Expenses"
              helper="Operating expenses recorded"
              value={`- ${KES(expenses)}`}
              negative
            />
          )}
          <FinanceLine
            label="Net Revenue"
            helper="What remains after deductions"
            value={KES(net)}
            emphasis
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">
              Commission Ledger
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5">
              What you owe or have paid to creators.
            </p>
          </div>
          <button className={btnSecondary}>
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                <th className="py-2 px-2 font-medium">Creator</th>
                <th className="py-2 px-2 font-medium text-right">Owed</th>
                <th className="py-2 px-2 font-medium text-right">Revenue</th>
                <th className="py-2 px-2 font-medium text-center">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creators.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 text-[13px]">
                    No creators yet.
                  </td>
                </tr>
              ) : (
                creators.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 px-2">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-[13px] text-slate-400 font-mono">
                        {c.handle}
                      </p>
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                      {Number(c.commissionOwed || 0)
                        ? KES(c.commissionOwed)
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 tabular-nums">
                      {KES(c.revenue)}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700 tabular-nums">
                      {c.commissionRate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalOwed = creators.reduce(
    (a, c) => a + Number(c.commissionOwed || 0),
    0,
  );
  const selectedTotal = creators
    .filter((c) => selected.has(c.id))
    .reduce((a, c) => a + Number(c.commissionOwed || 0), 0);

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            Creator Payments
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Batch and record M-Pesa payouts to your creators.
          </p>
        </div>
        <button
          className={btnPrimary}
          disabled={selected.size === 0}
          onClick={() => {
            void onPay(Array.from(selected));
            setSelected(new Set());
          }}
        >
          <Banknote className="w-3 h-3" />
          Pay selected ({selected.size})
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Creators"
          value={String(creators.length)}
          icon={<UserRound className="w-4 h-4" />}
        />
        <KpiCard
          label="Total owed"
          value={KES(totalOwed)}
          icon={<Wallet className="w-4 h-4" />}
        />
        <KpiCard
          label="Selected batch"
          value={KES(selectedTotal)}
          icon={<Receipt className="w-4 h-4" />}
        />
        <KpiCard
          label="Payout batches"
          value={String(payouts.length)}
          icon={<Banknote className="w-4 h-4" />}
        />
      </div>

      {creators.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-5 h-5" />}
          title="No creators to pay"
          description="Add creators first to start running payouts."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 w-10"></th>
                  <th className="py-2 px-2 font-medium">Creator</th>
                  <th className="py-2 px-2 font-medium text-right">Owed</th>
                  <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  <th className="py-2 px-2 font-medium text-center">Rate</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creators.map((c) => {
                  const owed = Number(c.commissionOwed || 0);
                  const checked = selected.has(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={owed <= 0}
                          onChange={() => toggle(c.id)}
                          className="accent-blue-950"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Thumb
                            src={c.avatar}
                            className="w-7 h-7"
                            fallbackIcon={<UserRound className="w-3 h-3" />}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">
                              {c.name}
                            </p>
                            <p className="text-[13px] text-slate-400 font-mono">
                              {c.handle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-900 tabular-nums">
                        {owed > 0 ? KES(owed) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-700 tabular-nums">
                        {KES(c.revenue)}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-700 tabular-nums">
                        {c.commissionRate}%
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge
                          variant={owed > 0 ? 'warning' : 'success'}
                          dot
                        >
                          {owed > 0 ? 'Pending' : 'Settled'}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payouts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-2 py-2 border-b border-slate-200">
            <p className="text-[13px] font-semibold text-slate-900">
              Payout Batches
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Reference</th>
                  <th className="py-2 px-2 font-medium">Method</th>
                  <th className="py-2 px-2 font-medium text-center">Items</th>
                  <th className="py-2 px-2 font-medium text-right">Total</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono font-medium text-slate-900">
                      {p.reference}
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {p.payoutMethod || '—'}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-700">
                      {p.itemsCount}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-slate-900">
                      {KES(p.totalAmount)}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge
                        variant={PAYOUT_STATUS_VARIANT(p.status)}
                        dot
                      >
                        {p.status}
                      </StatusBadge>
                    </td>
                    <td className="py-2 px-2 text-slate-500">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
  const gross = Number(summary?.grossRevenue ?? 0);
  const commissions =
    Number(summary?.creatorCommissions ?? 0) ||
    creators.reduce((a, c) => a + Number(c.commissionOwed || 0), 0);
  const withholding = Number(summary?.withholdingTax ?? 0);
  const vat = Math.round(gross * 0.16);

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded-sm p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-slate-400" />
          Tax Summary
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Social income is taxable in Kenya. Track what you owe KRA.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Total income"
          value={KES(gross)}
          icon={<Banknote className="w-4 h-4" />}
        />
        <KpiCard
          label="Withholding tax"
          value={KES(withholding)}
          icon={<Receipt className="w-4 h-4" />}
        />
        <KpiCard
          label="Estimated VAT (16%)"
          value={KES(vat)}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiCard
          label="Commissions paid"
          value={KES(commissions)}
          icon={<UserRound className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-200">
          <p className="text-[13px] font-semibold text-slate-900">
            Tax obligations summary
          </p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Auto-calculated from your TikTok orders and creator payouts.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          <FinanceLine
            label="Total Income"
            helper="All revenue earned through TikTok"
            value={KES(gross)}
          />
          <FinanceLine
            label="Withholding Tax Deducted"
            helper="5% deducted on creator earnings"
            value={KES(withholding)}
          />
          <FinanceLine
            label="Estimated VAT (16%)"
            helper="If you are VAT-registered"
            value={KES(vat)}
          />
          <FinanceLine
            label="Net Position After Tax"
            helper="Gross less withholding and VAT"
            value={KES(gross - withholding - vat)}
            emphasis
          />
        </div>
        <div className="px-2 py-2 border-t border-slate-100 flex items-center gap-2">
          <button className={btnPrimary}>
            <Download className="w-3 h-3" />
            KRA export
          </button>
          <button className={btnSecondary}>
            <ExternalLink className="w-3 h-3" />
            Open iTax
          </button>
        </div>
      </div>
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
    <div className="bg-white border border-slate-200 rounded verflow-hidden">
      <div className="px-2 py-2 border-b border-slate-200">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="p-2">{children}</div>
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
      <label className="block text-[13px] font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        defaultValue={defaultValue}
        disabled={disabled}
        className={inputCls}
      />
      <p className="text-[13px] text-slate-500 mt-1">{helper}</p>
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
    <label className="flex items-start justify-between gap-2 cursor-pointer border border-slate-200 rounded p-2 hover:bg-slate-50 transition-colors">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{helper}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          'relative inline-flex h-4 w-8 shrink-0 rounded-full transition-colors mt-0.5',
          on ? 'bg-blue-950' : 'bg-slate-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
            on && 'translate-x-4',
          )}
        />
      </button>
    </label>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
          Settings
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Configure your TikTok profile, preferences, and notifications.
        </p>
      </div>

      <SettingsSection
        title="TikTok Profile"
        description="Your account details. These appear on reports and packing slips."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SettingsField
            label="Business Name"
            helper="Your business name as it appears to customers"
            defaultValue="SokoFlow Official"
          />
          <SettingsField
            label="TikTok Handle"
            helper="Your TikTok username (include the @)"
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
        title="Notifications"
        description="Choose which events should trigger an alert."
      >
        <div className="space-y-2">
          <ToggleRow
            label="New Order Logged"
            helper="Get notified when a new TikTok order is added"
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
            helper="Get reminded before a scheduled TikTok LIVE"
            defaultOn
          />
        </div>
      </SettingsSection>
    </div>
  );
}

function TeamTab({ team }: { team: AdminTeamMember[] }) {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <UserCog className="w-3.5 h-3.5 text-slate-400" />
            Team & Roles
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            People who can access and manage this workspace.
          </p>
        </div>
        <button className={btnPrimary}>
          <Plus className="w-3 h-3" />
          Invite member
        </button>
      </div>

      {team.length === 0 ? (
        <EmptyState
          icon={<UserCog className="w-5 h-5" />}
          title="No team members yet"
          description="Invite teammates to help manage TikTok orders, content, and payouts."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                  <th className="py-2 px-2 font-medium">Member</th>
                  <th className="py-2 px-2 font-medium">Email</th>
                  <th className="py-2 px-2 font-medium">Role</th>
                  <th className="py-2 px-2 font-medium">Last active</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={m.name} className="w-7 h-7" />
                        <p className="font-medium text-slate-900">{m.name}</p>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{m.email}</td>
                    <td className="py-2 px-2">
                      <StatusBadge variant="neutral">{m.role}</StatusBadge>
                    </td>
                    <td className="py-2 px-2 text-slate-500">
                      {m.lastActiveAt ? formatDateTime(m.lastActiveAt) : '—'}
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge
                        variant={
                          m.status === 'Active'
                            ? 'success'
                            : m.status === 'Invited'
                              ? 'warning'
                              : 'danger'
                        }
                        dot
                      >
                        {m.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

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

    const nowIsoStr = new Date().toISOString();
    const reference = `#TT-${Math.floor(90000 + Math.random() * 9999)}`;

    const order: AdminDirectOrder = {
      id: `pending-${Date.now()}`,
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
      createdAt: nowIsoStr,
      updatedAt: nowIsoStr,
      deliveredAt: null,
    };
    onSubmit(order);
  };

  const canSubmit = !!customerName.trim() && !!product && qty > 0;

  return (
    <Modal
      onClose={onClose}
      title="Log New TikTok Order"
      subtitle="Record a sale that came from TikTok"
      widthClass="max-w-2xl"
    >
      <form id="log-order-form" onSubmit={handleSubmit} className="space-y-2">
        {products.length === 0 && (
          <div className="bg-white border border-amber-200 rounded p-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[13px] text-slate-700">
              You need at least one product before you can log an order.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>Customer Information</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              helper="Used for WhatsApp updates"
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
            <FormField label="Email" helper="Optional">
              <input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className={inputCls}
                placeholder="name@example.com"
              />
            </FormField>
            <FormField label="Where did it come in?" helper="TikTok entry point">
              <select
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as AdminDirectOrderSource)
                }
                className={inputCls}
              >
                <option value="whatsapp">Bio link → WhatsApp</option>
                <option value="video_dm">Video DM</option>
                <option value="live">TikTok LIVE</option>
                <option value="admin">Admin</option>
                <option value="phone">Phone call</option>
              </select>
            </FormField>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Order Details</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              helper="Adjust if discounted"
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
          <div className="bg-slate-50 border border-slate-200 rounded p-2 flex items-center justify-between">
            <span className="text-[13px] text-slate-500 font-medium uppercase">
              Total
            </span>
            <span className="text-base font-bold text-slate-900 tabular-nums">
              {KES(total)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Payment</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </div>

        <FormField label="Notes" helper="Anything you want to remember">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={cn(inputCls, 'resize-none')}
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
          className={btnPrimary}
        >
          <CheckCircle2 className="w-3 h-3" />
          Log order
        </button>
      </ModalFooter>
    </Modal>
  );
}

type AddProductPayload = AdminDirectProductWrite & {
  brandId?: number;
  categoryId?: number;
};

function AddProductModal({
  onClose,
  onSubmit,
  brands,
  categories,
}: {
  onClose: () => void;
  onSubmit: (p: AdminDirectProductWrite) => Promise<void> | void;
  brands: AdminBrandRef[];
  categories: AdminCategoryRef[];
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [image, setImage] = useState('');
  const [price, setPrice] = useState('0');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [categoryId, setCategoryId] = useState<number>(
    categories[0]?.id ?? 0,
  );
  const [brandId, setBrandId] = useState<number>(brands[0]?.id ?? 0);
  const [status, setStatus] = useState<AdminDirectProductStatus>('Draft');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (brands.length && !brandId) setBrandId(brands[0].id);
  }, [brands, brandId]);
  useEffect(() => {
    if (categories.length && !categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const payload: AddProductPayload = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        image: image || undefined,
        price: price.trim() || '0',
        compareAtPrice: compareAtPrice.trim() || null,
        stockQuantity: Number(stockQuantity) || 0,
        status,
        brandId,
        categoryId,
      };
      await onSubmit(payload as AdminDirectProductWrite);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!name.trim() && brandId > 0 && categoryId > 0;

  return (
    <Modal
      onClose={onClose}
      title="Add Catalog Product"
      subtitle="Add an item to your store catalog"
      widthClass="max-w-2xl"
    >
      <form
        id="add-product-form"
        onSubmit={handleSubmit}
        className="space-y-2"
      >
        {brands.length === 0 && (
          <div className="bg-white border border-amber-200 rounded p-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[13px] text-slate-700">
              You need at least one brand in your catalog before adding a
              product.
            </p>
          </div>
        )}
        {categories.length === 0 && (
          <div className="bg-white border border-amber-200 rounded p-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[13px] text-slate-700">
              You need at least one category in your catalog before adding a
              product.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>Product Image</SectionLabel>
          <ImageUpload
            label="Product Photo"
            helper="JPG, PNG or WEBP — up to 5 MB."
            value={image}
            onChange={setImage}
          />
        </div>

        <div className="space-y-2">
          <SectionLabel>Basic Information</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FormField
              label="Product Name"
              helper="Customer-facing name"
              required
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
              />
            </FormField>
            <FormField label="SKU" helper="Internal code">
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Brand" required>
              <select
                value={brandId}
                onChange={(e) => setBrandId(Number(e.target.value))}
                className={inputCls}
                disabled={brands.length === 0}
              >
                {brands.length === 0 ? (
                  <option value={0}>No brands available</option>
                ) : (
                  brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </FormField>
            <FormField label="Category" required>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className={inputCls}
                disabled={categories.length === 0}
              >
                {categories.length === 0 ? (
                  <option value={0}>No categories available</option>
                ) : (
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </FormField>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Pricing &amp; Stock</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            <FormField label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as AdminDirectProductStatus)
                }
                className={inputCls}
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
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
          form="add-product-form"
          disabled={submitting || !canSubmit}
          className={btnPrimary}
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          {submitting ? 'Adding…' : 'Add product'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function AddContentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (c: AdminDirectContentWrite) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
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
        platform: 'TikTok' as AdminDirectContentPlatform,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        caption: caption.trim() || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        productName: productName.trim() || undefined,
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
      title="Add TikTok Video"
      subtitle="Upload the video or cover image that promotes your products"
      widthClass="max-w-3xl"
    >
      <form
        id="add-content-form"
        onSubmit={handleSubmit}
        className="space-y-2"
      >
        <div className="space-y-2">
          <SectionLabel>Video (recommended)</SectionLabel>
          <VideoUpload
            label="TikTok Video"
            helper="MP4, MOV or WEBM — up to 100 MB."
            value={videoUrl}
            onChange={setVideoUrl}
            poster={thumbnailUrl || undefined}
          />
        </div>

        <div className="space-y-2">
          <SectionLabel>Thumbnail / Cover Image</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            <ImageUpload
              label="Cover Image"
              helper="JPG, PNG or WEBP — up to 5 MB."
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
            />
            <div className="text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
              <p className="font-semibold text-slate-700 mb-1">Tips</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Portrait (9:16) is what TikTok expects.</li>
                <li>The cover shows in the player before play.</li>
                <li>If you skip the video, a cover still works.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Content Details</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FormField label="Title" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={inputCls}
                placeholder="e.g. Unboxing — Ankara Tote Bag"
              />
            </FormField>
            <FormField label="Scheduled Date" helper="Optional">
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
                <option value="Draft">Draft</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Posted">Posted</option>
                <option value="Archived">Archived</option>
              </select>
            </FormField>
            <FormField
              label="Featured Product"
              helper="Which product does this promote?"
            >
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Ankara Tote Bag"
              />
            </FormField>
          </div>
          <FormField label="Caption" helper="Text that goes with the video">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className={cn(inputCls, 'resize-none')}
              placeholder="Write your TikTok caption here…"
            />
          </FormField>
        </div>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="add-content-form"
          disabled={submitting || !title.trim()}
          className={btnPrimary}
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          {submitting ? 'Adding…' : 'Add content'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

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
    if (!title.trim() || !scheduledAt) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        hostName: hostName.trim() || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        status,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Schedule TikTok LIVE"
      subtitle="Plan an upcoming TikTok livestream selling session"
      widthClass="max-w-xl"
    >
      <form
        id="schedule-live-form"
        onSubmit={handleSubmit}
        className="space-y-2"
      >
        <div className="space-y-2">
          <SectionLabel>Session Details</SectionLabel>
          <div className="grid grid-cols-1 gap-2">
            <FormField label="Session Title" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={inputCls}
                placeholder="e.g. Friday Flash Sale — Beauty"
              />
            </FormField>
            <FormField label="Host Name" helper="Who is running the LIVE?">
              <input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Amina"
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FormField label="Scheduled Date & Time" required>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
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
        </div>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          form="schedule-live-form"
          disabled={submitting || !title.trim() || !scheduledAt}
          className={btnPrimary}
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          {submitting ? 'Scheduling…' : 'Schedule LIVE'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

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
        platform: 'TikTok',
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
      title="Add TikTok Creator"
      subtitle="Add a creator you work with and set their commission"
      widthClass="max-w-xl"
    >
      <form
        id="add-creator-form"
        onSubmit={handleSubmit}
        className="space-y-2"
      >
        <div className="space-y-2">
          <SectionLabel>Creator Details</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FormField label="Full Name" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
                placeholder="e.g. Amina Wanjiku"
              />
            </FormField>
            <FormField label="TikTok Handle" helper="Include the @" required>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                className={inputCls}
                placeholder="@amina.ke"
              />
            </FormField>
            <FormField label="Avatar URL" helper="Optional">
              <input
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className={inputCls}
                placeholder="https://…"
              />
            </FormField>
            <FormField label="Commission Rate (%)" helper="Per TikTok sale">
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
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
          form="add-creator-form"
          disabled={submitting || !name.trim() || !handle.trim()}
          className={btnPrimary}
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          {submitting ? 'Adding…' : 'Add creator'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function OrderDrawer({
  order,
  isLogged,
  onClose,
  onAdvance,
}: {
  order: AdminDirectOrder;
  isLogged: boolean;
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

  const handleWhatsApp = () => {
    if (!order.customerPhone) return;
    const digits = order.customerPhone.replace(/[^\d]/g, '');
    const text = encodeURIComponent(
      `Hi ${order.customerName}, about your order ${order.reference} (${KES(order.total)}). `,
    );
    window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
  };

  const handleCall = () => {
    if (!order.customerPhone) return;
    window.location.href = `tel:${order.customerPhone}`;
  };

  const handleEmail = () => {
    if (!order.customerEmail) return;
    window.location.href = `mailto:${order.customerEmail}?subject=Order ${order.reference}`;
  };

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard.writeText(order.reference);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
        className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col rounded-l-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'drawerIn 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <style jsx global>{`
          @keyframes drawerIn {
            from {
              transform: translateX(20px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>

        <div className="flex items-start justify-between px-2 py-2 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <p className="text-[13px] text-slate-500">Order</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p
                id="order-drawer-title"
                className="text-[13px] font-semibold font-mono text-slate-900 truncate"
              >
                {order.reference}
              </p>
              <button
                onClick={() => void handleCopyRef()}
                aria-label="Copy reference"
                className="text-slate-400 hover:text-slate-700"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            {isLogged && (
              <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[13px] font-medium bg-white text-slate-600 border border-slate-200">
                <Sparkles className="w-2.5 h-2.5" />
                Manually logged
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className={iconBtn}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 text-[13px]">
          <div className="border border-slate-200 rounded p-2 flex items-center gap-2">
            <Thumb
              src={firstItem?.image}
              className="w-12 h-12"
              fallbackIcon={<Package className="w-4 h-4" />}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-slate-500">Items</p>
              <p className="font-medium text-slate-900 mt-0.5">
                {firstItem?.productName || '—'} ×{firstItem?.quantity ?? 0}
              </p>
              <p className="text-[13px] text-slate-400 mt-0.5">
                From {sourceLabel(order.source)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-1">
            <p className="text-[13px] text-slate-500 font-medium uppercase">
              Customer
            </p>
            <p className="font-medium text-slate-900">{order.customerName}</p>
            {order.customerPhone && (
              <p className="text-slate-600 inline-flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400" />
                {order.customerPhone}
              </p>
            )}
            {order.customerEmail && (
              <p className="text-slate-500 text-[13px] inline-flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-slate-400" />
                {order.customerEmail}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border border-slate-200 rounded p-2">
              <p className="text-[13px] text-slate-500 font-medium uppercase mb-1">
                Payment
              </p>
              <p className="text-slate-800">{order.paymentMethod}</p>
              <p className="text-slate-500 text-[13px] mt-0.5 capitalize">
                {order.paymentStatus}
              </p>
            </div>
            <div className="border border-slate-200 rounded p-2">
              <p className="text-[13px] text-slate-500 font-medium uppercase mb-1">
                Status
              </p>
              <StatusBadge variant={orderStatusVariant(order.status)} dot>
                {order.status}
              </StatusBadge>
            </div>
          </div>

          <div className="bg-blue-950 text-white rounded p-2 flex items-center justify-between">
            <span className="text-[13px] uppercase opacity-80">
              Total
            </span>
            <span className="font-semibold text-white text-base tabular-nums">
              {KES(order.total)}
            </span>
          </div>

          {order.notes && (
            <div className="border border-slate-200 rounded-sm p-2 space-y-1">
              <p className="text-[13px] text-slate-500 font-medium uppercase">
                Notes
              </p>
              <p className="text-slate-700 whitespace-pre-wrap text-[13px]">
                {order.notes}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleWhatsApp}
              disabled={!order.customerPhone}
              className={btnSecondary}
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </button>
            <button
              onClick={handleCall}
              disabled={!order.customerPhone}
              className={btnSecondary}
            >
              <Phone className="w-3 h-3" />
              Call
            </button>
            <button
              onClick={handleEmail}
              disabled={!order.customerEmail}
              className={btnSecondary}
            >
              <Mail className="w-3 h-3" />
              Email
            </button>
            <button onClick={handlePrint} className={btnSecondary}>
              <Printer className="w-3 h-3" />
              Print slip
            </button>
          </div>
        </div>

        <div className="px-2 py-2 border-t border-slate-200 flex gap-2 shrink-0">
          <button onClick={onClose} className={cn(btnSecondary, 'flex-1')}>
            Close
          </button>
          {nextStatus && (
            <button
              onClick={() => onAdvance(nextStatus)}
              className={cn(btnPrimary, 'flex-1')}
            >
              <ArrowUpRight className="w-3 h-3" />
              Move to &ldquo;{nextStatus}&rdquo;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}