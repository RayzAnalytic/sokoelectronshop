'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  MessageCircle, Send, Search, Clock, CheckCircle2, X, AlertCircle,
  Shield, Users, LayoutTemplate, Zap, ChevronRight, CheckCheck,
  Paperclip, StickyNote, Check, Plus, RefreshCw, CreditCard, BarChart3,
  AlertTriangle, Loader2, Trash2, Copy, Eye, Filter, Calendar,
  ChevronDown, ShoppingBag, Package, Star,
  Play, Pause, Save, Info, Boxes, Layers,
  Bell,
  MoreHorizontal, TrendingUp,
  Grid3x3, Award, ShieldCheck, Webhook, Key,
  PanelLeftClose, PanelLeftOpen, Radio,
  Rocket, Gauge,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  AreaChart, Area,
} from 'recharts';

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  '';

const API_BASE = API_ORIGIN
  ? `${API_ORIGIN.replace(/\/+$/, '')}/api/v1/whatsapp`
  : '/api/v1/whatsapp';

const DIRECT_TOKEN_KEYS = [
  'access', 'access_token', 'accessToken', 'access-token', 'accesstoken',
  'token', 'jwt', 'jwt_access', 'jwt_token', 'jwtAccess', 'jwtToken',
  'auth_token', 'authToken', 'id_token', 'idToken',
  'bearer', 'bearer_token', 'bearerToken',
  'ACCESS_TOKEN', 'AUTH_TOKEN', 'JWT_TOKEN', 'TOKEN',
];

const NESTED_TOKEN_KEYS = [
  'access', 'access_token', 'accessToken', 'access-token',
  'token', 'jwt', 'jwt_access', 'jwtToken',
  'bearer', 'bearer_token', 'bearerToken',
  'accessTokenJwt', 'accessJwt',
];

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function isJWTShape(s: string): boolean {
  return /^ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+$/.test(s.trim());
}

function looksLikeToken(s: string): boolean {
  if (!s || s.length < 30) return false;
  if (isJWTShape(s)) return true;
  if (s.startsWith('{') || s.startsWith('[') || s.startsWith('<')) return false;
  return /^[A-Za-z0-9_.\-+/=]{30,}$/.test(s);
}

function findTokenInObject(obj: any, depth = 0): string | null {
  if (depth > 5 || !obj) return null;
  if (typeof obj === 'string') return looksLikeToken(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const found = findTokenInObject(v, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const key of NESTED_TOKEN_KEYS) {
      const v = (obj as any)[key];
      if (typeof v === 'string' && looksLikeToken(v)) return v;
    }
    for (const v of Object.values(obj)) {
      const found = findTokenInObject(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  const stores: Storage[] = [];
  try { stores.push(window.localStorage); } catch { }
  try { stores.push(window.sessionStorage); } catch { }

  for (const store of stores) {
    for (const key of DIRECT_TOKEN_KEYS) {
      try {
        const v = store.getItem(key);
        if (v && looksLikeToken(v)) return v;
      } catch { }
    }
  }

  for (const store of stores) {
    let len = 0;
    try { len = store.length; } catch { continue; }
    for (let i = 0; i < len; i++) {
      let raw: string | null = null;
      try {
        const key = store.key(i);
        if (!key) continue;
        raw = store.getItem(key);
      } catch { continue; }
      if (!raw) continue;

      if (looksLikeToken(raw)) return raw;

      if (raw.length > 10 && (raw[0] === '{' || raw[0] === '[')) {
        try {
          const parsed = JSON.parse(raw);
          const found = findTokenInObject(parsed);
          if (found) return found;
        } catch { }
      }
    }
  }

  return null;
}

if (typeof window !== 'undefined') {
  (window as any).__waDebug = () => {
    const t = getAccessToken();
    console.log('[WA] token found:', t ? t.slice(0, 30) + '…' : 'NONE');
    console.log('[WA] localStorage keys:', Object.keys(localStorage));
    console.log('[WA] sessionStorage keys:', Object.keys(sessionStorage));
    console.log('[WA] cookies:', document.cookie.split(';').map((c) => c.trim().split('=')[0]));
    return t;
  };
}

class ApiError extends Error {
  status: number;
  code?: string;
  data: any;
  constructor(status: number, message: string, data?: any, code?: string) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

async function apiRequest<T = any>(
  method: string,
  path: string,
  body?: any,
  opts: { isForm?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  const bearer = getAccessToken();
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRFToken'] = csrf;
  }

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (opts.isForm) {
      payload = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = isJson && data && typeof data === 'object'
      ? data.detail || data.message || `Request failed (${res.status})`
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data, isJson ? data?.code : undefined);
  }
  return data as T;
}

const api = {
  get: <T = any>(path: string, opts?: { signal?: AbortSignal }) =>
    apiRequest<T>('GET', path, undefined, opts),
  post: <T = any>(path: string, body?: any) => apiRequest<T>('POST', path, body),
  put: <T = any>(path: string, body?: any) => apiRequest<T>('PUT', path, body),
  patch: <T = any>(path: string, body?: any) => apiRequest<T>('PATCH', path, body),
  del: <T = any>(path: string) => apiRequest<T>('DELETE', path),
  postForm: <T = any>(path: string, form: FormData) =>
    apiRequest<T>('POST', path, form, { isForm: true }),
};

function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: any[],
): { data: T | null; loading: boolean; error: string; refetch: () => void } {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({
    data: null,
    loading: true,
    error: '',
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const key = JSON.stringify(deps) + '::' + tick;
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fnRef.current(ctrl.signal)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: '' });
      })
      .catch((err: any) => {
        if (!cancelled && err?.name !== 'AbortError') {
          setState({ data: null, loading: false, error: err?.message || 'Failed to load' });
        }
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [key]);
  return { ...state, refetch: () => setTick((t) => t + 1) };
}

const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function KES(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? parseFloat(n) : Number(n ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `KES ${Math.round(safe).toLocaleString('en-KE')}`;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Tab =
  | 'Overview' | 'Connection' | 'Catalog' | 'Inbox' | 'BotBuilder' | 'Orders'
  | 'Templates' | 'Automations' | 'Broadcasts' | 'Contacts'
  | 'QuickReplies' | 'Analytics' | 'Billing' | 'Webhooks' | 'Settings';

type CatalogSyncStatus =
  | 'NOT_SYNCED' | 'SYNCING' | 'SYNCED' | 'OUT_OF_DATE' | 'FAILED' | 'REJECTED';

type NodeKind =
  | 'message' | 'list' | 'products' | 'product_detail' | 'cart'
  | 'condition' | 'collect' | 'handoff' | 'end';

interface WaAccount {
  id: number | null;
  isActive: boolean;
  displayPhone: string;
  displayName: string;
  businessName: string;
  about: string;
  address: string;
  email: string;
  website: string;
  vertical: string;
  profilePictureUrl: string;
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
  qualityScore: string;
  messagingLimit: string;
  messagingLimitTier: string;
  verificationStatus: string;
  reviewStatus: string;
  twoStepPin: boolean;
  officialBusinessAccount: boolean;
  tokenDaysLeft: number | null;
  tokenExpiresAt: string | null;
  webhookUrl: string;
  webhookVerifyToken: string;
  webhookFields: string[];
  lastSyncedAt: string | null;
  lastError: string;
  hasCatalog: boolean;
  qualityHistory: { date: string; score: string }[];
  healthChecks: { id: number; at: string; ok: boolean; latencyMs: number; error: string }[];
  healthCheckOk?: boolean;
  healthCheckError?: string;
}

interface WaCatalog {
  id: number | null;
  name: string;
  metaCatalogId: string;
  connected: boolean;
  autoSync: boolean;
  eligibilityRule: string;
  syncFrequencyMinutes: number;
  hidePrice: boolean;
  defaultSort: string;
  excludeOutOfStock: boolean;
  lastFullSyncAt: string | null;
  lastSyncAdded: number;
  lastSyncUpdated: number;
  lastSyncFailed: number;
  lastError: string;
  itemCounts: {
    total: number; eligible: number; synced: number; syncing: number;
    outOfDate: number; failed: number; linked: number; unlinked: number;
    inStock: number; pinned: number; removed: number;
  };
}

interface WaCatalogItem {
  id: number;
  catalogId: number;
  retailerId: string;
  metaProductId: string;
  storeProductId: number | null;
  storeCategoryId: number | null;
  storeProductName: string | null;
  storeProductSlug: string | null;
  isLinked: boolean;
  isRemoved: boolean;
  isBrowsable: boolean;
  name: string;
  displayTitle: string;
  description: string;
  displayDescription: string;
  price: string;
  salePrice: string | null;
  effectivePrice: string;
  currency: string;
  imageUrl: string;
  customImageUrl: string;
  displayImageUrl: string;
  productUrl: string;
  category: string;
  tags: string[];
  brand: string;
  inStock: boolean;
  stockQuantity: number;
  eligible: boolean;
  pinned: boolean;
  sortOrder: number;
  hidePrice: boolean;
  isPriceHidden: boolean;
  customTitle: string;
  customDescription: string;
  viewCount: number;
  addToCartCount: number;
  removedAt: string | null;
  syncStatus: CatalogSyncStatus;
  reviewStatus: string | null;
  rejectionReason: string;
  lastError: string;
  lastSyncedAt: string | null;
  updatedAt: string | null;
}

interface WaContact {
  id: number;
  waId: string;
  profileName: string | null;
  email: string;
  userId: number | null;
  isVerified: boolean;
  isBlocked: boolean;
  tags: string[];
  attributes: Record<string, any>;
  notes: string;
  optInStatus: 'SUBSCRIBED' | 'UNSUBSCRIBED';
  optInSource: string;
  optInAt: string | null;
  lastInboundAt: string | null;
  orderCount: number;
  totalSpent: string;
  productAffinity: Record<string, any>;
  createdAt: string | null;
}

interface WaMessage {
  id: number;
  waMessageId: string;
  conversationId: number;
  direction: 'IN' | 'OUT';
  type: string;
  body: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'QUEUED';
  errorMessage: string;
  timestamp: string | null;
  mediaId: string;
  mediaUrl: string;
  mimeType: string;
  filename: string;
  templateName: string;
  templateParams: string[];
  productRefs: string[];
  cartItems: any[];
  interactiveButtons: any[];
  replyToId: number | null;
  reactions: { emoji: string; by: string }[];
  author: number | null;
  authorName: string | null;
  isInternalNote: boolean;
}

interface WaConversation {
  id: number;
  contact: WaContact;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  priority: string;
  assignedTo: number | null;
  assignedToName: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  firstMessageAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  windowOpen: boolean;
  serviceWindowExpiresAt: string | null;
  botPaused: boolean;
  starred: boolean;
  unreadCount: number;
  tags: string[];
  slaFirstResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  slaBreached: boolean;
  csat: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  messages?: WaMessage[];
  notes?: string;
}

interface WaTemplate {
  id: number;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';
  quality: string;
  components: any[];
  bodyText: string;
  metaTemplateId: string;
  rejectionReason: string;
  attachedCatalogItemIds: string[];
  hasProductAttachment: boolean;
  isPaused: boolean;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  version: number;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WaAutomation {
  id: number;
  name: string;
  trigger: string;
  triggerLabel: string;
  templateId: number | null;
  templateName: string;
  delayMinutes: number;
  recipients: string;
  conditions: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  steps: { id: number; position: number; kind: string; config: any }[];
  messagesSent: number;
  lastTriggeredAt: string | null;
  runs: { id: number; at: string; status: string; durationMs: number; error: string }[];
  createdAt: string | null;
  updatedAt: string | null;
}

interface WaBroadcast {
  id: number;
  campaignName: string;
  templateId: number | null;
  templateName: string;
  audience: string;
  audienceRuleRef: string;
  segmentId: number | null;
  audienceCount: number;
  attachedCatalogItemIds: string[];
  hasProductAttachment: boolean;
  variableMapping: Record<string, any>;
  abTest: boolean;
  recipients: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  estimatedCostKes: string;
  actualCostKes: string;
  sentAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  lastError: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WaOrder {
  id: number;
  orderNumber: string;
  contactId: number | null;
  contactName: string;
  phone: string;
  contactWaId: string;
  conversationId: number | null;
  checkoutOrderId: number | null;
  items: { name: string; qty: number; priceKes?: number; price?: string; quantity?: number }[];
  subtotal: string;
  total: string;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: string;
  paymentRef: string;
  deliveryAddress: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WaWebhookEvent {
  id: number;
  type: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'DELIVERED' | 'FAILED' | 'RETRYING';
  attempts: number;
  signatureValid: boolean;
  latencyMs: number;
  error: string;
  receivedAt: string | null;
}

interface WaInvoice {
  id: number;
  periodStart: string;
  periodEnd: string;
  amountKes: string;
  currency: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  issuedAt: string;
  pdfUrl: string;
}

interface BusinessHourRange {
  open: string;
  close: string;
  closed: boolean;
}

interface WaSettings {
  id?: number;
  businessHours: Record<string, BusinessHourRange>;
  timezone: string;
  notifications: Record<string, boolean>;
  routing: string;
  slaFirstResponseMin: number;
  slaResolutionMin: number;
  optOutKeywords: string[];
  defaultLanguage: string;
  csatEnabled: boolean;
  dataRetentionDays: number;
  welcomeMessage: string;
  awayMessage: string;
}

const DEFAULT_BUSINESS_HOURS: Record<string, BusinessHourRange> = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '09:00', close: '18:00', closed: true },
  sunday: { open: '09:00', close: '18:00', closed: true },
};

interface WaTeamMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  online: boolean;
  lastSeenAt: string | null;
  activeConversations: number;
}

interface WaAuditEntry {
  id: number;
  actor: number | null;
  actorName: string;
  action: string;
  target: string;
  payload: Record<string, any>;
  timestamp: string | null;
}

interface WaSegment {
  id: number;
  name: string;
  description: string;
  rules: { field: string; op: string; value: string }[];
  count: number;
  cachedCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WaQuickReply {
  id: number;
  shortcut: string;
  title: string;
  body: string;
  category: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WaNotification {
  id: number;
  type: 'message' | 'template' | 'order' | 'system' | 'broadcast' | 'quality';
  title: string;
  body: string;
  linkTab: string;
  read: boolean;
  payload: Record<string, any>;
  timestamp: string | null;
}

interface WaBotNode {
  id?: number;
  key: string;
  kind: NodeKind;
  title: string;
  body: string;
  options: { id: string; label: string; nextId: string | null }[];
  config?: Record<string, any>;
  position: { x: number; y: number };
}

interface WaBotFlow {
  id: number | null;
  name: string;
  isPublished: boolean;
  entryNodeKey: string;
  nodes: WaBotNode[];
}

interface WaAnalyticsSummary {
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  totalCostKes: string;
  deliveryRate: number;
  readRate: number;
  responseRate: number;
}

interface WaAnalyticsCommerce {
  messagesSentToday: number;
  abandonedCartsRecovered: number;
  ordersFromWhatsApp: number;
  ordersRevenueKes: number;
  averageResponseMin: number;
  productViews: number;
  addToCartRate: number;
  topProducts: { id: string; name: string; units: number; revenueKes: number }[];
  recoveryByProduct: { name: string; recovered: number }[];
}

interface WaBillingSummary {
  month: string;
  totalKes: string;
  utilityKes: string;
  marketingKes: string;
  authKes: string;
  serviceKes: string;
  utilityCount: number;
  marketingCount: number;
  authCount: number;
  serviceCount: number;
  freeServiceUsed: number;
  freeServiceLimit: number;
  lastSyncedAt: string;
}

type ToastVariant = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: string; message: string; variant: ToastVariant; }
interface ToastCtx { push: (message: string, variant?: ToastVariant) => void; }
const ToastContext = createContext<ToastCtx>({ push: () => { } });
const useToast = () => useContext(ToastContext);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = uid('t');
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-2 right-2 z-[500] space-y-2 max-w-sm">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => setItems((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const cfg = {
    success: { bg: 'bg-blue-950', Icon: CheckCircle2 },
    error: { bg: 'bg-red-600', Icon: X },
    warning: { bg: 'bg-slate-800', Icon: AlertTriangle },
    info: { bg: 'bg-slate-800', Icon: Info },
  }[item.variant];
  const Icon = cfg.Icon;
  return (
    <div className={`${cfg.bg} text-white px-3 py-2 rounded shadow-lg flex items-start gap-2 text-[13px]`}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white" />
      <span className="flex-1 break-words">{item.message}</span>
      <button onClick={onClose} className="text-white/70 hover:text-white shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const inputCls = 'w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/10 focus:border-blue-950 transition';
const btnPrimary = 'inline-flex items-center justify-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2 py-1.5 rounded text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const btnSecondary = 'inline-flex items-center justify-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2 py-1.5 rounded text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const btnDanger = 'inline-flex items-center justify-center gap-1 bg-red-600 hover:bg-red-500 text-white font-medium px-2 py-1.5 rounded text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const btnGhost = 'inline-flex items-center gap-1 bg-transparent hover:bg-slate-100 text-slate-600 font-medium px-1.5 py-1 rounded text-[13px] transition-colors';
const btnIcon = 'inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500 transition-colors';

const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
  color: '#0f172a',
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
};

function Toggle({
  checked, onChange, disabled, size = 'md', ariaLabel,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; size?: 'sm' | 'md'; ariaLabel?: string }) {
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9';
  const knob = size === 'sm' ? 'h-3 w-3 translate-x-0.5' : 'h-4 w-4 translate-x-0.5';
  const knobOn = size === 'sm' ? 'translate-x-3.5' : 'translate-x-4';
  return (
    <span
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!checked); }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onChange(!checked); }
      }}
      className={`relative inline-flex items-center rounded-full transition-colors shrink-0 ${track} ${checked ? 'bg-blue-950' : 'bg-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block bg-white rounded-full shadow-sm transform transition-transform ${knob} ${checked ? knobOn : ''}`} />
    </span>
  );
}

function PageHeader({ title, subtitle, action, badge }: { title: string; subtitle: string; action?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
          {badge}
        </div>
        <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {action && <div className="shrink-0 flex items-center gap-1 flex-wrap">{action}</div>}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: { label: string; onClick: () => void; icon?: React.ReactNode } }) {
  return (
    <div className="max-w-md mx-auto my-4 bg-white border border-slate-200 rounded px-2 py-6 text-center space-y-2">
      <span className="w-10 h-10 rounded bg-slate-50 text-slate-400 flex items-center justify-center mx-auto ring-1 ring-slate-100">{icon}</span>
      <div className="space-y-0.5">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        {description && <p className="text-[13px] text-slate-500">{description}</p>}
      </div>
      {action && <button onClick={action.onClick} className={btnPrimary}>{action.icon}{action.label}</button>}
    </div>
  );
}

function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-[13px] py-6 justify-center">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded px-3 py-3 flex items-start gap-2 text-[13px] text-red-800">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="text-red-700 hover:text-red-900 font-medium">
          Retry
        </button>
      )}
    </div>
  );
}

function Field({ label, helper, required, children, error }: { label: string; helper?: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[13px] font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {error ? <p className="text-[13px] text-red-600 mt-1">{error}</p> : helper ? <p className="text-[13px] text-slate-500 mt-1">{helper}</p> : null}
    </div>
  );
}

function Badge({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' }) {
  const cls = {
    success: 'bg-green-50 text-green-700 ring-green-100',
    warning: 'bg-slate-100 text-slate-700 ring-slate-200',
    danger: 'bg-red-50 text-red-700 ring-red-100',
    info: 'bg-slate-100 text-slate-700 ring-slate-200',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
    primary: 'bg-blue-50 text-blue-950 ring-blue-100',
  }[variant];
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[13px] font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}

function Modal({ onClose, title, subtitle, widthClass = 'max-w-2xl', children, footer }: {
  onClose: () => void; title: string; subtitle?: string; widthClass?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/40 flex items-center justify-center p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-sm w-full ${widthClass} max-h-[92vh] flex flex-col shadow-2xl ring-1 ring-slate-900/5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-[13px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className={btnIcon}><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
        {footer && <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-end gap-1 shrink-0 bg-slate-50">{footer}</div>}
      </div>
    </div>
  );
}

function Drawer({ onClose, title, subtitle, children, width = 'max-w-xl' }: {
  onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute right-0 top-0 h-full w-full ${width} bg-white flex flex-col shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-[13px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className={btnIcon}><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, helper, icon, primary }: { label: string; value: React.ReactNode; helper?: string; icon?: React.ReactNode; primary?: boolean }) {
  return (
    <div className={`${primary ? 'bg-blue-950 text-white' : 'bg-white border border-slate-200'} rounded px-2 py-2 transition-shadow hover:shadow-sm`}>
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className={primary ? 'text-white/70' : 'text-slate-400'}>{icon}</span>}
        <p className={`text-[13px] font-medium truncate uppercase ${primary ? 'text-white/70' : 'text-slate-500'}`}>{label}</p>
      </div>
      <p className={`text-[16px] font-semibold mt-0.5 ${primary ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {helper && <p className={`text-[13px] mt-0.5 ${primary ? 'text-white/70' : 'text-slate-500'}`}>{helper}</p>}
    </div>
  );
}

function DetailRow({ label, helper, value, valueNode, copy }: { label: string; helper?: string; value?: string; valueNode?: React.ReactNode; copy?: boolean }) {
  const toast = useToast();
  return (
    <div className="px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-700">{label}</p>
        {helper && <p className="text-[13px] text-slate-500 mt-0.5">{helper}</p>}
      </div>
      <div className="text-[13px] text-slate-900 text-right flex items-center gap-1">
        {valueNode ?? <span className="font-mono">{value}</span>}
        {copy && value && value !== '-' && (
          <button onClick={() => { navigator.clipboard.writeText(value); toast.push('Copied'); }} className="text-slate-400 hover:text-slate-700">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

const NAV_GROUPS: { id: string; label: string; items: Tab[]; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', items: ['Overview'], icon: <Gauge className="w-3.5 h-3.5" /> },
  { id: 'shop', label: 'Shop', items: ['Catalog', 'Orders'], icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { id: 'inbox', label: 'Inbox', items: ['Inbox', 'QuickReplies'], icon: <MessageCircle className="w-3.5 h-3.5" /> },
  { id: 'marketing', label: 'Marketing', items: ['Broadcasts', 'Templates', 'Automations', 'Contacts'], icon: <Rocket className="w-3.5 h-3.5" /> },
  { id: 'reports', label: 'Reports', items: ['Analytics'], icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'settings', label: 'Settings', items: ['Connection', 'Settings', 'Billing'], icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'advanced', label: 'Advanced', items: ['Webhooks', 'BotBuilder'], icon: <Layers className="w-3.5 h-3.5" /> },
];

const NAV_LABELS: Record<Tab, string> = {
  Overview: 'Overview',
  Connection: 'Connection',
  Catalog: 'Catalog',
  Inbox: 'Inbox',
  BotBuilder: 'Bot & Menus',
  Orders: 'Orders',
  Templates: 'Templates',
  Automations: 'Automations',
  Broadcasts: 'Broadcasts',
  Contacts: 'Contacts',
  QuickReplies: 'Quick Replies',
  Analytics: 'Analytics',
  Billing: 'Billing',
  Webhooks: 'Webhooks & Logs',
  Settings: 'Settings',
};

const SHORTCUTS = [
  { keys: ['Cmd', 'K'], label: 'Command palette' },
  { keys: ['Esc'], label: 'Close modal / drawer' },
  { keys: ['?'], label: 'Show shortcuts' },
];

export default function WhatsAppAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const notifications = useAsync<WaNotification[]>(
    async (signal) => api.get<WaNotification[]>('/account/notifications/', { signal }),
    [],
  );
  const accountSummary = useAsync<WaAccount>(
    async (signal) => api.get<WaAccount>('/account/', { signal }),
    [],
  );

  const unreadCount = (notifications.data || []).filter((n) => !n.read).length;
  const connected = accountSummary.data?.isActive ?? false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as Tab | null;
    if (t && (Object.keys(NAV_LABELS) as Tab[]).includes(t)) setTab(t);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); }
      if (e.key === 'Escape') {
        setOpenGroup(null);
        setPaletteOpen(false);
        setShortcutsOpen(false);
        setNotificationOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navRef.current && navRef.current.contains(target)) return;
      setOpenGroup(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-white text-slate-900 antialiased pb-10">
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
          <div className="max-w-[1700px] mx-auto px-2 h-12 flex items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-7 h-7 rounded bg-green-600 text-white flex items-center justify-center">
                <FaWhatsapp className="w-4 h-4" />
              </span>
              <div className="hidden sm:block leading-tight">
                <p className="text-[13px] font-semibold text-slate-900">
                  {accountSummary.data?.businessName || 'RazeStore'}
                </p>
                <p className="text-[13px] text-slate-500">WhatsApp Business</p>
              </div>
            </div>

            <nav ref={navRef} className="hidden lg:flex items-center gap-0.5 flex-1 justify-center relative">
              {NAV_GROUPS.map((g) => {
                const isActive = g.items.includes(tab);
                const isOpen = openGroup === g.id;
                const isSingle = g.items.length === 1;
                return (
                  <div key={g.id} className="relative">
                    {isSingle ? (
                      <button
                        onClick={() => setTab(g.items[0])}
                        className={`inline-flex items-center gap-1 px-2 py-1.5 text-[13px] font-medium rounded transition-colors ${isActive ? 'text-blue-950 bg-blue-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                      >
                        {g.icon}{g.label}
                      </button>
                    ) : (
                      <button
                        onClick={() => setOpenGroup((prev) => (prev === g.id ? null : g.id))}
                        className={`inline-flex items-center gap-1 px-2 py-1.5 text-[13px] font-medium rounded transition-colors ${isActive ? 'text-blue-950 bg-blue-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                      >
                        {g.icon}{g.label}
                        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                    {isOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white ring-1 ring-slate-900/5 rounded shadow-xl py-1 min-w-[190px] z-[60]">
                        {g.items.map((it) => {
                          const active = tab === it;
                          return (
                            <button
                              key={it}
                              onClick={() => { setTab(it); setOpenGroup(null); }}
                              className={`w-full text-left px-2 py-1.5 text-[13px] flex items-center justify-between gap-2 rounded ${active ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                              <span>{NAV_LABELS[it]}</span>
                              {active && <Check className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              <button onClick={() => setPaletteOpen(true)} className={btnIcon}>
                <Search className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-blue-950 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <NotificationCenter
                    notifications={notifications.data || []}
                    onClose={() => setNotificationOpen(false)}
                    onMarkAllRead={async () => {
                      try {
                        await api.post('/account/notifications/mark-all-read/');
                        notifications.refetch();
                      } catch { }
                    }}
                    onSelect={async (n) => {
                      setNotificationOpen(false);
                      if (!n.read) {
                        try { await api.post(`/account/notifications/${n.id}/read/`); notifications.refetch(); } catch { }
                      }
                      if (n.linkTab && (Object.keys(NAV_LABELS) as Tab[]).includes(n.linkTab as Tab)) {
                        setTab(n.linkTab as Tab);
                      }
                    }}
                  />
                )}
              </div>
              <span className="inline-flex items-center gap-1 px-1.5 py-2 rounded text-[13px] font-medium text-slate-600">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
                <span className="hidden xl:inline">{connected ? 'Live' : 'Offline'}</span>
              </span>

              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-[400] bg-slate-900/40 lg:hidden" onClick={() => setMobileNavOpen(false)}>
            <div className="absolute right-0 top-0 h-full w-64 bg-white flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-900">Navigate</span>
                <button onClick={() => setMobileNavOpen(false)} className={btnIcon}><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {NAV_GROUPS.map((g) => (
                  <div key={g.id} className="mb-1">
                    <p className="px-2 py-1.5 text-[13px] font-semibold uppercase text-slate-400">{g.label}</p>
                    {g.items.map((it) => (
                      <button
                        key={it}
                        onClick={() => { setTab(it); setMobileNavOpen(false); }}
                        className={`w-full text-left px-2 py-2 text-[13px] rounded-sm transition-colors ${tab === it ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {NAV_LABELS[it]}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="max-w-[1700px] mx-auto px-0.5 py-2 space-y-2">
          {tab === 'Overview' && <OverviewTab onNavigate={setTab} />}
          {tab === 'Connection' && <ConnectionTab />}
          {tab === 'Catalog' && <CatalogTab />}
          {tab === 'Inbox' && <InboxTab />}
          {tab === 'BotBuilder' && <BotBuilderTab />}
          {tab === 'Orders' && <OrdersTab />}
          {tab === 'Templates' && <TemplatesTab />}
          {tab === 'Automations' && <AutomationsTab />}
          {tab === 'Broadcasts' && <BroadcastsTab />}
          {tab === 'Contacts' && <ContactsTab />}
          {tab === 'QuickReplies' && <QuickRepliesTab />}
          {tab === 'Analytics' && <AnalyticsTab />}
          {tab === 'Billing' && <BillingTab />}
          {tab === 'Webhooks' && <WebhooksTab />}
          {tab === 'Settings' && <SettingsTab />}
        </main>

        {paletteOpen && (
          <CommandPalette
            onClose={() => setPaletteOpen(false)}
            onSelect={(t) => { setTab(t); setPaletteOpen(false); }}
          />
        )}

        {shortcutsOpen && (
          <Modal onClose={() => setShortcutsOpen(false)} title="Keyboard Shortcuts" widthClass="max-w-lg">
            <div className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2 px-2 py-2 rounded hover:bg-slate-50">
                  <span className="text-[13px] text-slate-700">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="inline-flex items-center justify-center min-w-[20px] h-6 px-1.5 bg-slate-100 border border-slate-200 rounded text-[13px] font-mono text-slate-700">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </div>
    </ToastProvider>
  );
}

function NotificationCenter({
  notifications, onClose, onMarkAllRead, onSelect,
}: { notifications: WaNotification[]; onClose: () => void; onMarkAllRead: () => void; onSelect: (n: WaNotification) => void }) {
  const iconFor = (t: WaNotification['type']) => {
    if (t === 'message') return <MessageCircle className="w-3.5 h-3.5 text-slate-600" />;
    if (t === 'order') return <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />;
    if (t === 'template') return <LayoutTemplate className="w-3.5 h-3.5 text-slate-600" />;
    if (t === 'broadcast') return <Send className="w-3.5 h-3.5 text-slate-600" />;
    if (t === 'quality') return <AlertTriangle className="w-3.5 h-3.5 text-slate-600" />;
    return <Info className="w-3.5 h-3.5 text-slate-500" />;
  };
  return (
    <>
      <div className="fixed inset-0 z-[350]" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-[360] w-80 bg-white rounded shadow-2xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-900">Notifications</p>
          <button onClick={onMarkAllRead} className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-slate-400 text-[13px]">No notifications</p>
          ) : notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onSelect(n)}
              className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-start gap-2 ${n.read ? '' : 'bg-blue-50/40'}`}
            >
              <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">{iconFor(n.type)}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${n.read ? 'text-slate-700' : 'text-slate-900 font-medium'}`}>{n.title}</p>
                <p className="text-[13px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-[13px] text-slate-400 mt-0.5 font-mono">{relativeTime(n.timestamp)}</p>
              </div>
              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-950 shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function CommandPalette({ onClose, onSelect }: { onClose: () => void; onSelect: (t: Tab) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const all = Object.keys(NAV_LABELS) as Tab[];
  const filtered = all.filter((t) => !query || NAV_LABELS[t].toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/40 flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="bg-white rounded w-full max-w-lg shadow-2xl ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to..."
            className="flex-1 text-[13px] outline-none bg-transparent"
          />
          <kbd className="px-1.5 py-1 bg-slate-100 rounded text-[13px] font-mono text-slate-500">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((t) => (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center justify-between"
            >
              <span>{NAV_LABELS[t]}</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-slate-400 text-[13px]">No results.</p>}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const overview = useAsync<{
    account: WaAccount;
    catalog: WaCatalog;
    items: WaCatalogItem[];
    conversations: WaConversation[];
    orders: WaOrder[];
    broadcasts: WaBroadcast[];
    commerce: WaAnalyticsCommerce;
  }>(async (signal) => {
    const [account, catalog, items, conversations, orders, broadcasts, commerce] = await Promise.all([
      api.get<WaAccount>('/account/', { signal }),
      api.get<WaCatalog>('/catalog/', { signal }),
      api.get<WaCatalogItem[]>('/catalog/items/', { signal }),
      api.get<WaConversation[]>('/conversations/', { signal }),
      api.get<WaOrder[]>('/orders/', { signal }),
      api.get<WaBroadcast[]>('/broadcasts/', { signal }),
      api.get<WaAnalyticsCommerce>('/analytics/commerce/', { signal }),
    ]);
    return { account, catalog, items, conversations, orders, broadcasts, commerce };
  }, []);

  const data = overview.data;
  const acct = data?.account ?? null;
  const items = data?.items || [];
  const convs = data?.conversations || [];
  const orders = data?.orders || [];
  const broadcasts = data?.broadcasts || [];
  const commerce = data?.commerce ?? null;

  const synced = items.filter((i) => i.syncStatus === 'SYNCED').length;
  const needsAttention = items.filter((i) => i.syncStatus === 'OUT_OF_DATE' || i.syncStatus === 'FAILED' || i.syncStatus === 'REJECTED').length;
  const openOrders = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
  const unreadTotal = convs.reduce((n, c) => n + (c.unreadCount || 0), 0);
  const recentConvs = convs.slice(0, 5);
  const activeBroadcasts = broadcasts.filter((b) => b.status === 'SENDING' || b.status === 'SCHEDULED');

  const syncCatalog = async () => {
    setRefreshing(true);
    try {
      await api.post('/catalog/sync/');
      overview.refetch();
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title="Overview"
        subtitle="Your WhatsApp store at a glance."
        action={
          <>
            <button onClick={() => onNavigate('Connection')} className={btnSecondary}>
              <Shield className="w-3 h-3" />Settings
            </button>
            <button onClick={() => onNavigate('Inbox')} className={btnPrimary}>
              <MessageCircle className="w-3 h-3" />Open Inbox
              {unreadTotal > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/20 text-[12px] font-bold">
                  {unreadTotal}
                </span>
              )}
            </button>
          </>
        }
      />

      {overview.loading && !data && <LoadingBlock label="Loading overview…" />}
      {overview.error && <ErrorBlock message={overview.error} onRetry={overview.refetch} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-sm px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-sm bg-green-600 text-white flex items-center justify-center shrink-0">
                <FaWhatsapp className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate text-slate-900">
                  {acct?.businessName || 'Not connected'}
                </p>
                <p className="text-[13px] text-slate-500 font-mono truncate">
                  {acct?.displayPhone || '—'}
                </p>
              </div>
            </div>
            <Badge variant={acct?.isActive ? 'success' : 'danger'}>
              <span className={`w-1.5 h-1.5 rounded-full ${acct?.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
              {acct?.isActive ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-slate-50 border border-slate-200 rounded px-2 py-2">
              <p className="text-[13px] text-slate-500 uppercase font-medium">Unread</p>
              <p className="text-[14px] font-bold mt-0.5 text-slate-900">{unreadTotal}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded px-2 py-2">
              <p className="text-[13px] text-slate-500 uppercase font-medium">Open orders</p>
              <p className="text-[14px] font-bold mt-0.5 text-slate-900">{openOrders}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button onClick={() => onNavigate('Connection')} className={btnSecondary}>
              <Shield className="w-3 h-3" />Settings
            </button>
            {acct?.officialBusinessAccount && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[13px] font-medium px-2 py-1.5 rounded border border-green-100">
                <ShieldCheck className="w-3 h-3" />OBA Verified
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded px-3 py-2 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">Product Catalog</p>
                <p className="text-[13px] text-slate-500 truncate">
                  {items.length > 0 ? `${items.length} items` : 'No items'}
                </p>
              </div>
            </div>
          </div>
          <div className="text-[13px] text-slate-600 py-1">
            <span className="font-medium text-slate-900">{synced} synced</span>
            {needsAttention > 0 ? <span className="text-amber-700"> · {needsAttention} need attention</span> : <span className="text-green-700"> · All up to date</span>}
          </div>
          <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
            <button onClick={syncCatalog} disabled={refreshing} className={btnPrimary}>
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {refreshing ? 'Syncing…' : 'Sync'}
            </button>
            <button onClick={() => onNavigate('Catalog')} className={btnSecondary}>
              <Eye className="w-3 h-3" />View
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <KpiCard primary label="Orders from WhatsApp" value={String(commerce?.ordersFromWhatsApp ?? 0)} icon={<ShoppingBag className="w-3 h-3" />} helper={KES(commerce?.ordersRevenueKes ?? 0) + ' revenue'} />
        <KpiCard label="Carts recovered" value={String(commerce?.abandonedCartsRecovered ?? 0)} icon={<ShoppingBag className="w-3 h-3" />} helper="Last 30 days" />
        <KpiCard label="Unread messages" value={String(unreadTotal)} icon={<MessageCircle className="w-3 h-3" />} helper="Customers waiting for a reply" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-slate-900">Recent Conversations</p>
            <button onClick={() => onNavigate('Inbox')} className={btnGhost}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {recentConvs.length === 0 && <p className="text-[13px] text-slate-500 text-center py-4">No conversations yet.</p>}
            {recentConvs.map((c) => (
              <button
                key={c.id}
                onClick={() => onNavigate('Inbox')}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-sm bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                  {(c.contact?.profileName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-slate-900 truncate">
                      {c.contact?.profileName ?? c.contact?.waId}
                    </p>
                    <span className="text-[13px] text-slate-400 font-mono shrink-0">{relativeTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-[13px] text-slate-500 truncate mt-0.5">{c.lastMessagePreview}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-950 text-white text-[10px] font-semibold shrink-0">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Broadcasts</p>
              <p className="text-[13px] text-slate-500 mt-0.5">{activeBroadcasts.length} active</p>
            </div>
            <button onClick={() => onNavigate('Broadcasts')} className={btnSecondary}>
              <Send className="w-3 h-3" />Open
            </button>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {broadcasts.slice(0, 3).length === 0 && <p className="text-[13px] text-slate-500">No broadcasts yet.</p>}
            {broadcasts.slice(0, 3).map((b) => (
              <div key={b.id} className="border border-slate-100 rounded px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{b.campaignName}</p>
                  <Badge variant={b.status === 'COMPLETED' ? 'success' : b.status === 'SENDING' ? 'info' : 'neutral'}>
                    {b.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-950 rounded-full"
                      style={{ width: `${b.audienceCount ? Math.min(100, (b.delivered / b.audienceCount) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[13px] text-slate-500 font-mono">{b.delivered}/{b.audienceCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionTab() {
  const toast = useToast();
  const acct = useAsync<WaAccount>(async (signal) => api.get<WaAccount>('/account/', { signal }), []);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const account = acct.data;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/account/refresh/');
      acct.refetch();
      toast.push('WhatsApp status refreshed');
    } catch (err: any) {
      toast.push(err?.message || 'Refresh failed', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleActive = async () => {
    if (!account) return;
    setToggling(true);
    try {
      await api.post('/account/set-active/', { is_active: !account.isActive });
      acct.refetch();
      toast.push(account.isActive ? 'Disconnected' : 'Connected');
    } catch (err: any) {
      toast.push(err?.message || 'Failed', 'error');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title="WhatsApp connection"
        subtitle="Check that your shop's WhatsApp account is connected and ready to receive customer messages."
        action={
          <>
            <button onClick={refresh} disabled={refreshing} className={btnSecondary}>
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {refreshing ? 'Checking…' : 'Check status'}
            </button>
            <button onClick={toggleActive} disabled={toggling || !account} className={account?.isActive ? btnDanger : btnPrimary}>
              {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {account?.isActive ? 'Disconnect' : 'Reconnect'}
            </button>
          </>
        }
      />

      {acct.loading && !account && <LoadingBlock />}
      {acct.error && <ErrorBlock message={acct.error} onRetry={acct.refetch} />}

      <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded bg-green-50 text-green-700 flex items-center justify-center shrink-0">
              <FaWhatsapp className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900">{account?.businessName || 'WhatsApp Business'}</p>
              <p className="text-[13px] text-slate-500">{account?.displayPhone || 'Phone number not available'}</p>
            </div>
          </div>
          <Badge variant={account?.isActive ? 'success' : 'danger'}>
            <span className={`w-1.5 h-1.5 rounded-full ${account?.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
            {account?.isActive ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
        <p className="text-[13px] text-slate-600">
          {account?.isActive
            ? 'Your WhatsApp account is active. Customers can contact your shop through WhatsApp.'
            : 'Your WhatsApp account is not active. Reconnect it to resume customer conversations.'}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-900">Business details</p>
        </div>
        <div className="divide-y divide-slate-100">
          <DetailRow label="Business name" value={account?.businessName || '—'} />
          <DetailRow label="WhatsApp phone number" value={account?.displayPhone || '—'} />
          <DetailRow
            label="Account review"
            valueNode={<Badge variant={account?.reviewStatus === 'APPROVED' ? 'success' : 'warning'}>{account?.reviewStatus || 'Pending'}</Badge>}
          />
        </div>
      </div>
    </div>
  );
}

function CatalogTab() {
  const toast = useToast();
  const catalog = useAsync<WaCatalog>(async (signal) => api.get<WaCatalog>('/catalog/', { signal }), []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CatalogSyncStatus | ''>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<WaCatalogItem | null>(null);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [syncing, setSyncing] = useState(false);

  const items = useAsync<WaCatalogItem[]>(async (signal) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('syncStatus', statusFilter);
    const qs = params.toString();
    return api.get<WaCatalogItem[]>(`/catalog/items/${qs ? '?' + qs : ''}`, { signal });
  }, [search, statusFilter]);

  const list = items.data || [];
  const clearFilters = () => { setSearch(''); setStatusFilter(''); };

  const sync = async () => {
    setSyncing(true);
    try {
      await api.post('/catalog/sync/');
      toast.push('Sync queued');
      catalog.refetch();
      items.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const toggleEligibility = async (item: WaCatalogItem) => {
    try {
      await api.patch(`/catalog/items/${item.id}/`, { eligible: !item.eligible });
      items.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Update failed', 'error');
    }
  };

  const bulk = async (eligible: boolean) => {
    if (selected.size === 0) return;
    try {
      await api.post('/catalog/items/bulk/', {
        ids: Array.from(selected),
        patch: { eligible },
      });
      toast.push(`${selected.size} updated`);
      setSelected(new Set());
      items.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Bulk update failed', 'error');
    }
  };

  const synced = list.filter((i) => i.syncStatus === 'SYNCED').length;
  const outOfDate = list.filter((i) => i.syncStatus === 'OUT_OF_DATE').length;
  const failed = list.filter((i) => i.syncStatus === 'FAILED' || i.syncStatus === 'REJECTED').length;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Catalog"
        subtitle="Live products from your store, projected into WhatsApp."
        action={
          <>
            <button onClick={() => setView(view === 'table' ? 'grid' : 'table')} className={btnSecondary}>
              {view === 'table' ? <Grid3x3 className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
              {view === 'table' ? 'Grid' : 'Table'}
            </button>
            <button onClick={sync} disabled={syncing} className={btnSecondary}>
              {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </>
        }
      />

      {catalog.error && <ErrorBlock message={catalog.error} onRetry={catalog.refetch} />}
      {items.error && <ErrorBlock message={items.error} onRetry={items.refetch} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Catalog items" value={String(catalog.data?.itemCounts.total ?? 0)} helper={`${catalog.data?.itemCounts.eligible ?? 0} eligible`} icon={<Boxes className="w-3 h-3" />} />
        <KpiCard label="Synced" value={String(catalog.data?.itemCounts.synced ?? synced)} icon={<CheckCircle2 className="w-3 h-3" />} />
        <KpiCard label="Out of date" value={String(catalog.data?.itemCounts.outOfDate ?? outOfDate)} icon={<RefreshCw className="w-3 h-3" />} />
        <KpiCard label="Failed" value={String(catalog.data?.itemCounts.failed ?? failed)} icon={<AlertTriangle className="w-3 h-3" />} />
      </div>

      <div className="bg-white border border-slate-200 rounded px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-md">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className={inputCls + ' pl-7'}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className={inputCls + ' max-w-[150px]'}
        >
          <option value="">All sync states</option>
          {(['SYNCED', 'OUT_OF_DATE', 'SYNCING', 'FAILED', 'REJECTED', 'NOT_SYNCED'] as CatalogSyncStatus[]).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        {(search || statusFilter) && (
          <button onClick={clearFilters} className={btnSecondary}>
            <X className="w-3 h-3" />Clear filters
          </button>
        )}
        {selected.size > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[13px] text-slate-600 mr-1">{selected.size} selected</span>
            <button onClick={() => bulk(true)} className={btnSecondary}>Publish</button>
            <button onClick={() => bulk(false)} className={btnSecondary}>Hide</button>
          </div>
        )}
      </div>

      {items.loading && list.length === 0 && <LoadingBlock />}

      {view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {list.map((i) => (
            <div
              key={i.id}
              className={`bg-white border rounded overflow-hidden text-left transition-all hover:shadow-sm ${selected.has(i.id) ? 'border-blue-950 ring-2 ring-blue-950/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <button type="button" onClick={() => setDetail(i)} className="w-full text-left">
                <div className="aspect-square bg-slate-100 relative">
                  {i.displayImageUrl ? (
                    <img src={i.displayImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400 m-auto mt-[40%]" />
                  )}
                </div>
              </button>
              <div className="px-2 py-2 flex items-start justify-between gap-2">
                <button type="button" onClick={() => setDetail(i)} className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-slate-900 line-clamp-2">{i.displayTitle || i.name}</p>
                  <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{KES(i.effectivePrice)}</p>
                </button>
                <Toggle checked={i.eligible} size="sm" onChange={() => toggleEligibility(i)} ariaLabel="Eligible" />
              </div>
            </div>
          ))}
          {list.length === 0 && !items.loading && (
            <p className="col-span-full text-center text-slate-500 text-[13px] py-6">No items match.</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === list.length}
                      onChange={() => setSelected(selected.size === list.length ? new Set() : new Set(list.map((i) => i.id)))}
                      className="rounded"
                    />
                  </th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase">Product</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase">SKU</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase text-right">Price</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase text-center">Stock</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase text-center">Eligible</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(i.id)}
                        onChange={(e) => {
                          const n = new Set(selected);
                          if (e.target.checked) n.add(i.id); else n.delete(i.id);
                          setSelected(n);
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={() => setDetail(i)} className="flex items-center gap-2 text-left">
                        <span className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0">
                          {i.displayImageUrl ? (
                            <img src={i.displayImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-3.5 h-3.5 m-auto text-slate-400" />
                          )}
                        </span>
                        <span className="font-medium text-slate-900 truncate">{i.displayTitle || i.name}</span>
                      </button>
                    </td>
                    <td className="py-2 px-3 font-mono text-[13px] text-slate-600">{i.retailerId}</td>
                    <td className="py-2 px-3 text-right font-medium">{KES(i.effectivePrice)}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant={i.inStock ? 'success' : 'neutral'}>{i.inStock ? 'In' : 'Out'}</Badge>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Toggle checked={i.eligible} size="sm" onChange={() => toggleEligibility(i)} ariaLabel="Toggle" />
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        variant={
                          i.syncStatus === 'SYNCED' ? 'success' :
                            i.syncStatus === 'OUT_OF_DATE' ? 'warning' :
                              i.syncStatus === 'FAILED' || i.syncStatus === 'REJECTED' ? 'danger' : 'neutral'
                        }
                      >
                        {i.syncStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length === 0 && !items.loading && (
            <div className="py-6 text-center">
              <p className="text-slate-400 text-[13px] mb-2">No items match your filters.</p>
              <button onClick={clearFilters} className={btnSecondary}>
                <X className="w-3 h-3" />Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {detail && (
        <Drawer onClose={() => setDetail(null)} title={detail.name} subtitle={`SKU: ${detail.retailerId}`} width="max-w-2xl">
          <div className="px-3 py-2 space-y-2 text-[13px]">
            <div className="flex gap-3 items-start">
              <div className="w-20 h-20 rounded bg-white ring-1 ring-slate-200 overflow-hidden shrink-0">
                {detail.displayImageUrl && <img src={detail.displayImageUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-[13px] font-medium text-slate-900">{detail.name}</p>
                <p className="text-[13px] text-slate-600 font-mono">{detail.retailerId}</p>
                <p className="text-[14px] font-semibold text-slate-900">{KES(detail.effectivePrice)}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={detail.isLinked ? 'success' : 'neutral'}>{detail.isLinked ? 'Linked' : 'Unlinked'}</Badge>
                  <Badge variant={detail.inStock ? 'success' : 'danger'}>{detail.inStock ? 'In stock' : 'Out of stock'}</Badge>
                  <Badge variant={detail.eligible ? 'success' : 'warning'}>{detail.eligible ? 'Published' : 'Hidden'}</Badge>
                </div>
              </div>
            </div>
            {detail.description && <p className="text-[13px] text-slate-600">{detail.description}</p>}
            {detail.lastError && (
              <div className="bg-red-50 border border-red-200 rounded px-2 py-2 text-[13px] text-red-800">
                {detail.lastError}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <div className="text-center bg-slate-50 rounded px-1.5 py-2">
                <p className="text-[13px] text-slate-500 uppercase font-medium">Views</p>
                <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{detail.viewCount.toLocaleString()}</p>
              </div>
              <div className="text-center bg-slate-50 rounded px-1.5 py-2">
                <p className="text-[13px] text-slate-500 uppercase font-medium">Cart adds</p>
                <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{detail.addToCartCount}</p>
              </div>
              <div className="text-center bg-slate-50 rounded px-1.5 py-2">
                <p className="text-[13px] text-slate-500 uppercase font-medium">Stock</p>
                <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{detail.stockQuantity}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <Toggle
                  checked={detail.eligible}
                  onChange={() => {
                    toggleEligibility(detail);
                    setDetail({ ...detail, eligible: !detail.eligible });
                  }}
                />
                Published to WhatsApp
              </label>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function InboxTab() {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'mine' | 'open' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showContext, setShowContext] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const list = useAsync<WaConversation[]>(async (signal) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filter !== 'all') params.set('tab', filter);
    const qs = params.toString();
    return api.get<WaConversation[]>(`/conversations/${qs ? '?' + qs : ''}`, { signal });
  }, [filter, search]);

  const detail = useAsync<WaConversation | null>(async (signal) => {
    if (!activeId) return null;
    return api.get<WaConversation>(`/conversations/${activeId}/`, { signal });
  }, [activeId]);

  useEffect(() => {
    if (detail.data?.messages) setMessages(detail.data.messages);
  }, [detail.data]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilterOpen(false); };
    if (filterOpen) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => {
      detail.refetch();
    }, 8000);
    return () => clearInterval(t);
  }, [activeId]);

  const convs = list.data || [];
  const active = detail.data || null;
  const counts = {
    all: convs.length,
    unassigned: convs.filter((c) => !c.assignedTo).length,
    mine: -1,
    open: convs.filter((c) => c.status === 'OPEN').length,
    resolved: convs.filter((c) => c.status === 'RESOLVED').length,
  };
  const unreadTotal = convs.reduce((n, c) => n + c.unreadCount, 0);

  const send = async () => {
    if (!draft.trim() || !active) return;
    setSending(true);
    try {
      const created = await api.post<WaMessage>(`/conversations/${active.id}/messages/`, {
        body: draft.trim(),
        isNote: isInternal,
      });
      setMessages((prev) => [...prev, created]);
      setDraft('');
      setIsInternal(false);
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!active) return;
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    try {
      const created = await api.postForm<WaMessage>(`/conversations/${active.id}/send-media/`, form);
      setMessages((prev) => [...prev, created]);
      toast.push(`${kind} uploaded`);
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Upload failed', 'error');
    }
  };

  const sendProduct = async (productId: string) => {
    if (!active) return;
    try {
      const created = await api.post<WaMessage>(
        `/conversations/${active.id}/send-product/`,
        { productId },
      );
      setMessages((prev) => [...prev, created]);
      toast.push('Product sent');
      setProductPickerOpen(false);
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Send failed', 'error');
    }
  };

  const resolve = async () => {
    if (!active) return;
    try {
      await api.post(`/conversations/${active.id}/resolve/`, {});
      detail.refetch();
      list.refetch();
      toast.push('Conversation resolved');
    } catch (err: any) {
      toast.push(err?.message || 'Resolve failed', 'error');
    }
  };

  const reopen = async () => {
    if (!active) return;
    try {
      await api.patch(`/conversations/${active.id}/`, { status: 'OPEN' });
      detail.refetch();
      list.refetch();
      toast.push('Reopened');
    } catch (err: any) {
      toast.push(err?.message || 'Reopen failed', 'error');
    }
  };

  const addInternalNote = async () => {
    if (!active) return;
    const text = typeof window !== 'undefined'
      ? window.prompt('Internal note (only visible to your team):')
      : null;
    if (!text || !text.trim()) return;
    try {
      const created = await api.post<WaMessage>(`/conversations/${active.id}/messages/`, {
        body: text.trim(),
        isNote: true,
      });
      setMessages((prev) => [...prev, created]);
      toast.push('Note added');
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Failed', 'error');
    }
  };

  const gridCols = sidebarCollapsed
    ? (showContext ? 'lg:grid-cols-[64px_1fr] xl:grid-cols-[64px_1fr_260px]' : 'lg:grid-cols-[64px_1fr]')
    : (showContext ? 'lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_260px]' : 'lg:grid-cols-[280px_1fr]');

  const filterOptions: Array<{ id: typeof filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'mine', label: 'Mine' },
    { id: 'open', label: 'Open' },
    { id: 'resolved', label: 'Resolved' },
  ];

  const countFor = (id: typeof filter) => {
    const v = counts[id];
    return v < 0 ? '—' : String(v);
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title="Inbox"
        subtitle="Every customer conversation — send products, take orders, and close deals."
        badge={unreadTotal > 0 ? <Badge variant="primary"><Radio className="w-2.5 h-2.5" />{unreadTotal} unread</Badge> : undefined}
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={btnSecondary}>
              {sidebarCollapsed ? <PanelLeftOpen className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
              {sidebarCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <button onClick={() => setShowContext(!showContext)} className={btnSecondary}>
              <Layers className="w-3 h-3" />{showContext ? 'Focus' : 'Customer'}
            </button>
          </div>
        }
      />

      {list.error && <ErrorBlock message={list.error} onRetry={list.refetch} />}
      {detail.error && <ErrorBlock message={detail.error} onRetry={detail.refetch} />}

      <div
        className={`bg-white border border-slate-200 rounded overflow-hidden grid grid-cols-1 ${gridCols}`}
        style={{ height: 'calc(100vh - 180px)', minHeight: 500 }}
      >
        <div className="border-r border-slate-100 flex flex-col min-h-0">
          {sidebarCollapsed ? (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {convs.map((c) => {
                const isActive = c.id === activeId;
                const initials = (c.contact.profileName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    title={c.contact.profileName || c.contact.waId}
                    className={`w-full flex flex-col items-center justify-center py-2 hover:bg-slate-50 transition-colors relative ${isActive ? 'bg-blue-50' : ''}`}
                  >
                    <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                      {initials}
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-blue-950 text-white text-[10px] font-semibold flex items-center justify-center">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
              {convs.length === 0 && <p className="py-6 text-center text-slate-400 text-[13px]">—</p>}
            </div>
          ) : (
            <>
              <div className="px-2 py-2 border-b border-slate-100 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={inputCls + ' pl-7'}
                  />
                </div>
                <div ref={filterRef} className="relative">
                  <button
                    onClick={() => setFilterOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-[13px] font-medium text-slate-700"
                  >
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{filterOptions.find((f) => f.id === filter)?.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 shrink-0">
                      <span className="text-[12px] font-semibold bg-slate-100 text-slate-700 px-1.5 rounded">
                        {countFor(filter)}
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {filterOpen && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded shadow-lg py-1">
                      {filterOptions.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => { setFilter(f.id); setFilterOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] text-left ${filter === f.id ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <span>{f.label}</span>
                          <span className={`text-[12px] font-semibold px-1.5 rounded ${filter === f.id ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {countFor(f.id)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {list.loading && convs.length === 0 && <LoadingBlock />}
                {convs.length === 0 && !list.loading && <p className="py-6 text-center text-slate-400 text-[13px]">No conversations.</p>}
                {convs.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                          {(c.contact.profileName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {c.contact.profileName || c.contact.waId}
                            </p>
                            <span className="text-[13px] text-slate-400 font-mono shrink-0">{relativeTime(c.lastMessageAt)}</span>
                          </div>
                          <p className="text-[13px] text-slate-500 truncate mt-0.5">{c.lastMessagePreview || 'No messages yet'}</p>
                          {c.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-950 text-white text-[12px] font-semibold mt-1">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {active ? (
          <div className="flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-slate-100 shrink-0 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">
                  {active.contact.profileName || active.contact.waId}
                </p>
                <p className="text-[13px] text-slate-500">
                  +{active.contact.waId} · {active.assignedToName ?? 'Unassigned'}
                  {!active.windowOpen && <span className="ml-2 text-red-600 font-medium">Window closed</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button title="Add internal note" onClick={addInternalNote} className={btnIcon}>
                  <StickyNote className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.patch(`/conversations/${active.id}/`, { starred: !active.starred });
                      detail.refetch();
                    } catch { }
                  }}
                  className={btnIcon}
                >
                  <Star className={`w-3.5 h-3.5 ${active.starred ? 'fill-slate-500 text-slate-500' : ''}`} />
                </button>
                {active.status === 'RESOLVED' ? (
                  <button onClick={reopen} className={btnSecondary}>
                    <RefreshCw className="w-3 h-3" />Reopen
                  </button>
                ) : (
                  <button onClick={resolve} className={btnSecondary}>
                    <CheckCircle2 className="w-3 h-3" />Resolve
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-slate-50">
              {detail.loading && messages.length === 0 && <LoadingBlock />}
              {messages.length === 0 && !detail.loading && (
                <p className="text-[13px] text-slate-500 text-center py-6">No messages yet.</p>
              )}
              {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
            </div>
            <div className="border-t border-slate-100 bg-white p-2 shrink-0 space-y-2">
              {!active.windowOpen && (
                <div className="bg-red-50 border border-red-200 rounded px-2 py-2 text-[13px] text-red-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    24-hour messaging window is closed. Free-form messages (including product images) will be rejected by WhatsApp.
                    Send a template first to reopen the conversation.
                  </span>
                </div>
              )}
              <div className="flex items-center gap-0.5 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <button title="Attach file" className={btnIcon} onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
                <button title="Send product" className={btnIcon} onClick={() => setProductPickerOpen(true)}>
                  <ShoppingBag className="w-3.5 h-3.5" />
                </button>
                <button title="Quick reply" className={btnIcon} onClick={() => setDraft((d) => d + 'Hi there! ')}>
                  <Zap className="w-3.5 h-3.5" />
                </button>
                <button title="Template" className={btnIcon} onClick={() => setDraft((d) => d + 'Hi {{1}}, ')}>
                  <LayoutTemplate className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Internal note"
                  onClick={() => setIsInternal((v) => !v)}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-sm transition-colors ${isInternal ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <StickyNote className="w-3.5 h-3.5" />
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[13px] text-slate-500">Enter to send, Shift+Enter new line</span>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  rows={4}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={isInternal ? 'Write an internal note (only visible to your team)…' : 'Type a message…'}
                  className={`${inputCls} resize-none min-h-[96px] ${isInternal ? 'bg-slate-50 border-slate-300' : ''}`}
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending || (!active.windowOpen && !isInternal)}
                  className={btnPrimary + ' h-10 px-3'}
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {productPickerOpen && active && (
              <ProductPicker
                onClose={() => setProductPickerOpen(false)}
                onPick={sendProduct}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
            <FaWhatsapp className="w-6 h-6" />
            <p className="text-[13px]">Select a conversation</p>
          </div>
        )}

        {active && showContext && (
          <div className="border-l border-slate-100 overflow-y-auto bg-white">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-slate-500 uppercase">Customer</p>
              <button onClick={() => setShowContext(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 py-2 space-y-2 text-[13px]">
              <div>
                <p className="font-medium text-slate-900">{active.contact.profileName}</p>
                <p className="text-slate-500 font-mono mt-0.5">+{active.contact.waId}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-slate-50 rounded px-1.5 py-2">
                  <p className="text-[13px] text-slate-500 uppercase font-medium">Orders</p>
                  <p className="text-[14px] font-semibold text-slate-900 mt-0.5">{active.contact.orderCount}</p>
                </div>
                <div className="bg-slate-50 rounded px-1.5 py-2">
                  <p className="text-[13px] text-slate-500 uppercase font-medium">Lifetime</p>
                  <p className="text-[14px] font-semibold text-slate-900 mt-0.5">{KES(active.contact.totalSpent)}</p>
                </div>
              </div>
              {active.contact.tags.length > 0 && (
                <div>
                  <p className="text-[13px] text-slate-500 uppercase font-medium mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {active.contact.tags.map((t) => (
                      <span key={t} className="px-1.5 py-1 rounded text-[13px] bg-slate-100 text-slate-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[13px] text-slate-500 uppercase font-medium mb-1">Opt-in</p>
                <Badge variant={active.contact.optInStatus === 'SUBSCRIBED' ? 'success' : 'neutral'}>
                  {active.contact.optInStatus}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const items = useAsync<WaCatalogItem[]>(async (signal) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const qs = params.toString();
    return api.get<WaCatalogItem[]>(`/catalog/items/${qs ? '?' + qs : ''}`, { signal });
  }, [search]);

  const list = (items.data || []).filter((i) => i.isLinked && !i.isRemoved && i.eligible);

  return (
    <Modal onClose={onClose} title="Send a product" widthClass="max-w-4xl">
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className={inputCls + ' pl-7'}
          />
        </div>
        {items.loading && list.length === 0 && <LoadingBlock />}
        <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
          {list.map((i) => (
            <button
              key={i.id}
              onClick={() => onPick(String(i.storeProductId || i.retailerId))}
              className="w-full flex items-center gap-3 px-3 py-2 text-left bg-white hover:bg-slate-50 transition-colors"
            >
              <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                {i.displayImageUrl ? (
                  <img src={i.displayImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-900">{i.displayTitle || i.name}</p>
                <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{KES(i.effectivePrice)}</p>
              </div>
              <span className="shrink-0 text-[13px] font-medium text-blue-950">Select</span>
            </button>
          ))}
        </div>
        {!items.loading && list.length === 0 && (
          <p className="text-center text-slate-500 text-[13px] py-6">No products match.</p>
        )}
      </div>
    </Modal>
  );
}

function MessageBubble({ m }: { m: WaMessage }) {
  if (m.isInternalNote) {
    return (
      <div className="flex justify-center">
        <div className="bg-slate-100 ring-1 ring-slate-200 rounded px-2 py-2 text-[13px] text-slate-800 max-w-[80%]">
          <p className="font-medium">Internal note</p>
          <p className="whitespace-pre-wrap mt-0.5">{m.body}</p>
        </div>
      </div>
    );
  }

  const out = m.direction === 'OUT';
  const isImage = m.type === 'image' && m.mediaUrl;

  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] text-[13px] px-3 py-2 ${out
          ? 'bg-blue-950 text-white rounded rounded-tr-none'
          : 'bg-white ring-1 ring-slate-200 text-slate-800 rounded rounded-tl-none'}`}
      >
        {isImage && (
          <img
            src={m.mediaUrl}
            alt=""
            className="rounded max-h-56 object-cover mb-1.5"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
        <div className={`flex items-center gap-1 mt-0.5 justify-end ${out ? 'text-white/70' : 'text-slate-400'}`}>
          <span className="text-[13px] font-mono">
            {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
          {out && m.status === 'FAILED' && <AlertCircle className="w-2.5 h-2.5 text-red-300" />}
          {out && m.status === 'SENT' && <Clock className="w-2.5 h-2.5" />}
          {out && m.status === 'DELIVERED' && <CheckCheck className="w-2.5 h-2.5" />}
          {out && m.status === 'READ' && <CheckCheck className="w-2.5 h-2.5" />}
        </div>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [statusFilter, setStatusFilter] = useState<WaOrder['status'] | ''>('');
  const orders = useAsync<WaOrder[]>(async (signal) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const qs = params.toString();
    return api.get<WaOrder[]>(`/orders/${qs ? '?' + qs : ''}`, { signal });
  }, [statusFilter]);

  const list = orders.data || [];
  const totalRevenue = list.reduce((n, o) => n + Number(o.total || 0), 0);

  const statusVariant = (s: WaOrder['status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (s === 'DELIVERED' || s === 'PAID') return 'success';
    if (s === 'SHIPPED' || s === 'CONFIRMED') return 'info';
    if (s === 'PENDING') return 'warning';
    if (s === 'CANCELLED') return 'danger';
    return 'neutral';
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title="Orders"
        subtitle="Orders placed through WhatsApp."
        action={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={inputCls + ' max-w-[150px]'}
          >
            <option value="">All statuses</option>
            {(['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as WaOrder['status'][]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        }
      />

      {orders.error && <ErrorBlock message={orders.error} onRetry={orders.refetch} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Orders" value={String(list.length)} icon={<ShoppingBag className="w-3 h-3" />} />
        <KpiCard label="Revenue" value={KES(totalRevenue)} icon={<CreditCard className="w-3 h-3" />} />
        <KpiCard label="Avg. order" value={KES(list.length ? totalRevenue / list.length : 0)} icon={<TrendingUp className="w-3 h-3" />} />
        <KpiCard label="Delivered" value={String(list.filter((o) => o.status === 'DELIVERED').length)} icon={<CheckCircle2 className="w-3 h-3" />} />
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Order</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Customer</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Items</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase text-right">Total</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Payment</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Status</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="py-2 px-2 font-mono font-medium">{o.orderNumber}</td>
                  <td className="py-2 px-2">{o.contactName}</td>
                  <td className="py-2 px-2">{(o.items || []).length} items</td>
                  <td className="py-2 px-2 text-right font-medium">{KES(o.total)}</td>
                  <td className="py-2 px-2"><Badge variant="neutral">{o.paymentMethod || '—'}</Badge></td>
                  <td className="py-2 px-2"><Badge variant={statusVariant(o.status)}>{o.status}</Badge></td>
                  <td className="py-2 px-2 text-right text-slate-500">{relativeTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.loading && list.length === 0 && <LoadingBlock />}
        {!orders.loading && list.length === 0 && (
          <p className="text-center text-slate-400 text-[13px] py-6">No orders yet.</p>
        )}
      </div>
    </div>
  );
}

function TemplatesTab() {
  const toast = useToast();
  const [category, setCategory] = useState<'' | 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('');
  const templates = useAsync<WaTemplate[]>(async (signal) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const qs = params.toString();
    return api.get<WaTemplate[]>(`/templates/${qs ? '?' + qs : ''}`, { signal });
  }, [category]);

  const list = templates.data || [];

  const submit = async (id: number) => {
    try {
      await api.post(`/templates/${id}/submit/`, {});
      toast.push('Submitted');
      templates.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Submit failed', 'error');
    }
  };

  const pause = async (id: number) => {
    try {
      await api.post(`/templates/${id}/pause/`, {});
      toast.push('Updated');
      templates.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Failed', 'error');
    }
  };

  const sync = async () => {
    try {
      await api.post('/templates/sync/', {});
      toast.push('Synced from Meta');
      templates.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Sync failed', 'error');
    }
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title="Templates"
        subtitle="Pre-approved messages for reach outside the 24h window."
        action={
          <button onClick={sync} className={btnSecondary}>
            <RefreshCw className="w-3 h-3" />Sync
          </button>
        }
      />

      {templates.error && <ErrorBlock message={templates.error} onRetry={templates.refetch} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Total" value={String(list.length)} icon={<LayoutTemplate className="w-3 h-3" />} />
        <KpiCard label="Approved" value={String(list.filter((t) => t.status === 'APPROVED').length)} icon={<CheckCircle2 className="w-3 h-3" />} />
        <KpiCard label="Pending" value={String(list.filter((t) => t.status === 'PENDING').length)} icon={<Clock className="w-3 h-3" />} />
        <KpiCard label="Rejected" value={String(list.filter((t) => t.status === 'REJECTED').length)} icon={<AlertTriangle className="w-3 h-3" />} />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm px-2 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          {(['', 'MARKETING', 'UTILITY', 'AUTHENTICATION'] as const).map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCategory(c as any)}
              className={`px-2 py-1.5 rounded-sm text-[13px] font-medium ${category === c ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      {templates.loading && list.length === 0 && <LoadingBlock />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {list.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-sm px-3 py-2 space-y-1.5 hover:shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-mono font-medium text-slate-900 truncate">{t.name}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">{t.language} · v{t.version}</p>
              </div>
              <Badge variant={t.status === 'APPROVED' ? 'success' : t.status === 'PENDING' ? 'warning' : t.status === 'REJECTED' ? 'danger' : 'neutral'}>
                {t.status}
              </Badge>
            </div>
            <p className="text-[13px] text-slate-600 line-clamp-3 min-h-[36px]">{t.bodyText || '—'}</p>
            {t.status === 'REJECTED' && t.rejectionReason && (
              <p className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-sm px-2 py-1">
                {t.rejectionReason}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <Badge variant="neutral">{t.category}</Badge>
              <div className="flex items-center gap-1">
                {(t.status === 'DRAFT' || t.status === 'REJECTED') && (
                  <button onClick={() => submit(t.id)} className={btnGhost}>
                    Submit
                  </button>
                )}
                {(t.status === 'APPROVED' || t.status === 'PAUSED') && (
                  <button onClick={() => pause(t.id)} className={btnGhost}>
                    {t.status === 'PAUSED' ? 'Resume' : 'Pause'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!templates.loading && list.length === 0 && (
          <p className="col-span-full text-center text-slate-500 text-[13px] py-6">
            No templates yet. Click <span className="font-medium text-slate-700">Sync</span> to pull approved templates from Meta.
          </p>
        )}
      </div>
    </div>
  );
}

function AutomationsTab() {
  const toast = useToast();
  const list = useAsync<WaAutomation[]>(async (signal) => api.get<WaAutomation[]>('/automations/', { signal }), []);

  const automations = list.data || [];

  const toggle = async (a: WaAutomation) => {
    try {
      await api.post(`/automations/${a.id}/toggle/`, {});
      toast.push('Automation updated');
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Update failed', 'error');
    }
  };

  return (
    <div className="space-y-2">
      <PageHeader title="Automations" subtitle="Event-driven sequences that respond to your customers." />

      {list.error && <ErrorBlock message={list.error} onRetry={list.refetch} />}

      {list.loading && automations.length === 0 && <LoadingBlock />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {automations.map((a) => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-sm px-3 py-2 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-900">{a.name}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">Trigger: {a.triggerLabel || a.trigger}</p>
                <p className="text-[13px] text-slate-500">Template: {a.templateName || '—'}</p>
              </div>
              <Toggle checked={a.status === 'ACTIVE'} onChange={() => toggle(a)} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[13px] text-slate-500">
              <span>{a.messagesSent} sent</span>
              <span>Delay {a.delayMinutes}min · {a.recipients || '—'}</span>
            </div>
          </div>
        ))}
        {!list.loading && automations.length === 0 && (
          <p className="col-span-full text-center text-slate-500 text-[13px] py-6">No automations yet.</p>
        )}
      </div>
    </div>
  );
}

function BroadcastsTab() {
  const toast = useToast();
  const list = useAsync<WaBroadcast[]>(async (signal) => api.get<WaBroadcast[]>('/broadcasts/', { signal }), []);

  const broadcasts = list.data || [];

  const send = async (id: number) => {
    try {
      await api.post(`/broadcasts/${id}/send/`, {});
      toast.push('Broadcast queued');
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Send failed', 'error');
    }
  };

  const pause = async (id: number) => {
    try {
      await api.post(`/broadcasts/${id}/pause/`, {});
      toast.push('Paused');
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Failed', 'error');
    }
  };

  const totalCost = broadcasts.reduce((n, b) => n + Number(b.actualCostKes || 0), 0);

  return (
    <div className="space-y-2">
      <PageHeader title="Broadcasts" subtitle="Marketing campaigns across your audience." />

      {list.error && <ErrorBlock message={list.error} onRetry={list.refetch} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Total" value={String(broadcasts.length)} icon={<Send className="w-3 h-3" />} />
        <KpiCard label="Completed" value={String(broadcasts.filter((b) => b.status === 'COMPLETED').length)} icon={<CheckCircle2 className="w-3 h-3" />} />
        <KpiCard label="Scheduled" value={String(broadcasts.filter((b) => b.status === 'SCHEDULED').length)} icon={<Calendar className="w-3 h-3" />} />
        <KpiCard label="Total cost" value={KES(totalCost)} icon={<CreditCard className="w-3 h-3" />} />
      </div>

      {list.loading && broadcasts.length === 0 && <LoadingBlock />}

      <div className="space-y-2">
        {broadcasts.map((b) => (
          <div key={b.id} className="bg-white border border-slate-200 rounded px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-900">{b.campaignName}</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Template: {b.templateName || '—'} · Audience: {b.audience || '—'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={b.status === 'COMPLETED' ? 'success' : b.status === 'SENDING' ? 'info' : b.status === 'FAILED' ? 'danger' : b.status === 'SCHEDULED' ? 'warning' : 'neutral'}>
                  {b.status}
                </Badge>
                {(b.status === 'DRAFT' || b.status === 'SCHEDULED' || b.status === 'PAUSED') && (
                  <button onClick={() => send(b.id)} className={btnSecondary}>Send</button>
                )}
                {b.status === 'SENDING' && (
                  <button onClick={() => pause(b.id)} className={btnSecondary}>Pause</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {[
                { label: 'Sent', value: b.recipients },
                { label: 'Delivered', value: b.delivered },
                { label: 'Read', value: b.read },
                { label: 'Replied', value: b.replied },
                { label: 'Failed', value: b.failed },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded px-1.5 py-2 text-center">
                  <p className="text-[13px] text-slate-500 uppercase">{s.label}</p>
                  <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!list.loading && broadcasts.length === 0 && (
          <p className="text-center text-slate-500 text-[13px] py-6">No broadcasts yet.</p>
        )}
      </div>
    </div>
  );
}

function ContactsTab() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'contacts' | 'segments'>('contacts');

  const contacts = useAsync<WaContact[]>(async (signal) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const qs = params.toString();
    return api.get<WaContact[]>(`/contacts/${qs ? '?' + qs : ''}`, { signal });
  }, [search]);

  const segments = useAsync<WaSegment[]>(async (signal) => api.get<WaSegment[]>('/segments/', { signal }), []);

  const list = contacts.data || [];
  const segmentList = segments.data || [];

  return (
    <div className="space-y-2">
      <PageHeader title="Contacts" subtitle="Your WhatsApp customer list." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Contacts" value={String(list.length)} icon={<Users className="w-3 h-3" />} />
        <KpiCard label="Subscribed" value={String(list.filter((c) => c.optInStatus === 'SUBSCRIBED').length)} icon={<CheckCircle2 className="w-3 h-3" />} />
        <KpiCard label="VIP" value={String(list.filter((c) => c.tags.includes('VIP')).length)} icon={<Star className="w-3 h-3" />} />
        <KpiCard label="Segments" value={String(segmentList.length)} icon={<Filter className="w-3 h-3" />} />
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="flex items-center border-b border-slate-100 px-3">
          {(['contacts', 'segments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[13px] font-medium border-b-2 ${tab === t ? 'border-blue-950 text-blue-950' : 'border-transparent text-slate-500'}`}
            >
              {t === 'contacts' ? 'Contacts' : 'Segments'}
            </button>
          ))}
        </div>
        {tab === 'contacts' && (
          <div className="px-3 py-2">
            <div className="relative max-w-md">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className={inputCls + ' pl-7'}
              />
            </div>
          </div>
        )}
      </div>

      {tab === 'contacts' ? (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {contacts.loading && list.length === 0 && <LoadingBlock />}
          {contacts.error && <ErrorBlock message={contacts.error} onRetry={contacts.refetch} />}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="py-2 px-2 font-medium text-[13px] uppercase">Name</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase">Phone</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase">Tags</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase text-right">Orders</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase text-right">Spent</th>
                  <th className="py-2 px-2 font-medium text-[13px] uppercase text-center">Opt-in</th>
                  <th className="py-2 px-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-medium text-slate-900">{c.profileName ?? c.waId}</td>
                    <td className="py-2 px-2 font-mono text-[13px] text-slate-600">+{c.waId}</td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-0.5">
                        {c.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-1 py-0.5 rounded-sm text-[13px] bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">{c.orderCount}</td>
                    <td className="py-2 px-2 text-right font-mono">{KES(c.totalSpent)}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant={c.optInStatus === 'SUBSCRIBED' ? 'success' : 'neutral'}>
                        {c.optInStatus === 'SUBSCRIBED' ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.optInStatus === 'SUBSCRIBED' && (
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/contacts/${c.id}/unsubscribe/`, {});
                              toast.push('Unsubscribed');
                              contacts.refetch();
                            } catch (err: any) {
                              toast.push(err?.message || 'Failed', 'error');
                            }
                          }}
                          className={btnGhost}
                        >
                          Unsub
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!contacts.loading && list.length === 0 && (
            <p className="text-center text-slate-500 text-[13px] py-6">No contacts yet.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {segments.loading && segmentList.length === 0 && <LoadingBlock />}
          {segments.error && <ErrorBlock message={segments.error} onRetry={segments.refetch} />}
          {segmentList.map((s) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-900">{s.name}</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">{s.description || '—'}</p>
                </div>
                <Badge variant="info">{s.count}</Badge>
              </div>
            </div>
          ))}
          {!segments.loading && segmentList.length === 0 && (
            <p className="col-span-full text-center text-slate-500 text-[13px] py-6">No segments yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuickRepliesTab() {
  const list = useAsync<WaQuickReply[]>(async (signal) => api.get<WaQuickReply[]>('/quick-replies/', { signal }), []);

  const replies = list.data || [];

  return (
    <div className="space-y-2">
      <PageHeader title="Quick Replies" subtitle="Canned responses for the Inbox." />
      {list.error && <ErrorBlock message={list.error} onRetry={list.refetch} />}
      {list.loading && replies.length === 0 && <LoadingBlock />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {replies.map((q) => (
          <div key={q.id} className="bg-white border border-slate-200 rounded px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-slate-900 text-[13px] font-medium">{q.shortcut}</p>
              {q.category && <Badge variant="neutral">{q.category}</Badge>}
            </div>
            <p className="text-[13px] mt-1 font-medium">{q.title}</p>
            <p className="text-[13px] text-slate-600 mt-1 line-clamp-3">{q.body}</p>
          </div>
        ))}
        {!list.loading && replies.length === 0 && (
          <p className="col-span-full text-center text-slate-500 text-[13px] py-6">No quick replies yet.</p>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const summary = useAsync<WaAnalyticsSummary>(async (signal) => api.get<WaAnalyticsSummary>('/analytics/summary/', { signal }), []);
  const series = useAsync<{ days: { day: string; sent: number; delivered: number; read: number; replies: number }[] }>(async (signal) => api.get('/analytics/series/', { signal }), []);
  const cost = useAsync<{ total: string; buckets: { name: string; value: number; color: string }[]; currency: string }>(async (signal) => api.get('/analytics/cost-breakdown/', { signal }), []);
  const funnel = useAsync<{ stage: string; count: number }[]>(async (signal) => api.get<{ stage: string; count: number }[]>('/analytics/funnel/', { signal }), []);
  const agents = useAsync<{ id: number; userId: number; name: string; messages: number; avgResponseMin: number; csat: number; slaRate: number; resolved: number }[]>(async (signal) => api.get<any[]>('/analytics/agents/', { signal }), []);

  const days = series.data?.days || [];
  const funnelData = funnel.data || [];
  const agentList = agents.data || [];
  const costBuckets = cost.data?.buckets || [];
  const maxFunnel = Math.max(...funnelData.map((f) => f.count), 1);

  return (
    <div className="space-y-2">
      <PageHeader title="Analytics" subtitle="Performance across messages, costs, and conversions." />

      {summary.error && <ErrorBlock message={summary.error} onRetry={summary.refetch} />}
      {series.error && <ErrorBlock message={series.error} onRetry={series.refetch} />}

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Messages sent" value={String(summary.data?.sent ?? 0)} icon={<Send className="w-3 h-3" />} />
        <KpiCard label="Customer replies" value={String(summary.data?.replied ?? 0)} icon={<MessageCircle className="w-3 h-3" />} />
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-900">Message Trends</p>
        </div>
        <div className="h-56 px-3 py-2">
          {series.loading && days.length === 0 ? (
            <LoadingBlock />
          ) : days.length === 0 ? (
            <p className="text-[13px] text-slate-500 text-center py-6">No message data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#172554" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={13} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={13} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="sent" stroke="#172554" fillOpacity={1} fill="url(#colorSent)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-2 py-2 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Cost by category</p>
          </div>
          <div className="h-56 px-2 py-2">
            {costBuckets.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-6">No cost data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBuckets}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name }: any) => name}
                  >
                    {costBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Pie>
                  <RTooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => KES(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Conversion Funnel</p>
          </div>
          <div className="px-2 py-2 space-y-2">
            {funnelData.map((f) => {
              const pct = (f.count / maxFunnel) * 100;
              return (
                <div key={f.stage}>
                  <div className="flex items-center justify-between gap-2 text-[13px] mb-0.5">
                    <span className="text-slate-700 font-medium">{f.stage}</span>
                    <span className="text-slate-500 font-mono">{f.count}</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-blue-950" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {funnelData.length === 0 && <p className="text-[13px] text-slate-500 text-center py-6">No funnel data yet.</p>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Top agents</p>
          </div>
          <div className="divide-y divide-slate-100">
            {agentList.map((l) => (
              <div key={l.id} className="px-3 py-2 flex items-center gap-2 text-[13px]">
                <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-[13px]">
                  {l.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-medium truncate">{l.name}</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">{l.messages} messages · {l.resolved} resolved</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-900 font-medium">{l.csat}</p>
                  <p className="text-[13px] text-slate-500">CSAT</p>
                </div>
              </div>
            ))}
            {agentList.length === 0 && <p className="text-[13px] text-slate-500 text-center py-6">No agents yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingTab() {
  const summary = useAsync<WaBillingSummary>(async (signal) => api.get<WaBillingSummary>('/billing/summary/', { signal }), []);
  const invoices = useAsync<WaInvoice[]>(async (signal) => api.get<WaInvoice[]>('/billing/invoices/', { signal }), []);

  const s = summary.data;
  const inv = invoices.data || [];

  return (
    <div className="space-y-2">
      <PageHeader title="Billing" subtitle="Costs and invoices for your WhatsApp account." />

      {summary.error && <ErrorBlock message={summary.error} onRetry={summary.refetch} />}
      {invoices.error && <ErrorBlock message={invoices.error} onRetry={invoices.refetch} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard primary label="Total this month" value={KES(s?.totalKes ?? 0)} icon={<CreditCard className="w-3 h-3" />} />
        <KpiCard label="Marketing" value={KES(s?.marketingKes ?? 0)} helper={`${s?.marketingCount ?? 0} messages`} />
        <KpiCard label="Utility" value={KES(s?.utilityKes ?? 0)} helper={`${s?.utilityCount ?? 0} messages`} />
        <KpiCard label="Authentication" value={KES(s?.authKes ?? 0)} helper={`${s?.authCount ?? 0} messages`} />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-900">Invoices</p>
        </div>
        <div className="divide-y divide-slate-100">
          {invoices.loading && inv.length === 0 && <LoadingBlock />}
          {inv.map((i) => (
            <div key={i.id} className="px-2 py-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-slate-900">
                  {formatDate(i.periodStart)} — {formatDate(i.periodEnd)}
                </p>
                <p className="text-[13px] text-slate-500 mt-0.5">Issued {formatDate(i.issuedAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[13px] font-semibold">{KES(i.amountKes)}</span>
                <Badge variant={i.status === 'PAID' ? 'success' : i.status === 'OVERDUE' ? 'danger' : 'warning'}>
                  {i.status}
                </Badge>
              </div>
            </div>
          ))}
          {!invoices.loading && inv.length === 0 && (
            <p className="text-center text-slate-500 text-[13px] py-6">No invoices yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WebhooksTab() {
  const toast = useToast();
  const list = useAsync<WaWebhookEvent[]>(async (signal) => api.get<WaWebhookEvent[]>('/webhooks/events/', { signal }), []);

  const events = list.data || [];

  const replay = async (id: number) => {
    try {
      await api.post(`/webhooks/events/${id}/replay/`, {});
      toast.push('Replay queued');
      list.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Replay failed', 'error');
    }
  };

  return (
    <div className="space-y-2">
      <PageHeader title="Webhooks & Logs" subtitle="Meta event deliveries and diagnostics." />

      {list.error && <ErrorBlock message={list.error} onRetry={list.refetch} />}

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        {list.loading && events.length === 0 && <LoadingBlock />}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Type</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase text-center">Signature</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase text-right">Latency</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase text-center">Attempts</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Status</th>
                <th className="py-2 px-2 font-medium text-[13px] uppercase">Received</th>
                <th className="py-2 px-2 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="py-2 px-2 font-mono text-[13px]">{w.type}</td>
                  <td className="py-2 px-2 text-center">
                    {w.signatureValid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mx-auto" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 mx-auto" />
                    )}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-[13px]">{w.latencyMs}ms</td>
                  <td className="py-2 px-2 text-center font-mono">{w.attempts}</td>
                  <td className="py-2 px-2">
                    <Badge variant={w.status === 'DELIVERED' ? 'success' : w.status === 'RETRYING' ? 'warning' : 'danger'}>
                      {w.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-slate-500">{relativeTime(w.receivedAt)}</td>
                  <td className="py-2 px-2 text-right">
                    <button onClick={() => replay(w.id)} className={btnGhost}>Replay</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.loading && events.length === 0 && (
          <p className="text-center text-slate-500 text-[13px] py-6">No webhook events yet.</p>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const toast = useToast();
  const settingsQ = useAsync<WaSettings>(async (signal) => api.get<WaSettings>('/account/settings/', { signal }), []);
  const team = useAsync<WaTeamMember[]>(async (signal) => api.get<WaTeamMember[]>('/account/team/', { signal }), []);
  const audit = useAsync<WaAuditEntry[]>(async (signal) => api.get<WaAuditEntry[]>('/account/audit/', { signal }), []);

  const [draft, setDraft] = useState<WaSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQ.data && !draft) {
      const incoming = settingsQ.data;
      const hours = incoming.businessHours && Object.keys(incoming.businessHours).length > 0
        ? incoming.businessHours
        : { ...DEFAULT_BUSINESS_HOURS };
      setDraft({ ...incoming, businessHours: hours });
    }
  }, [settingsQ.data]);

  const update = (patch: Partial<WaSettings>) => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.patch('/account/settings/', {
        business_hours: draft.businessHours,
        timezone: draft.timezone,
        notifications: draft.notifications,
        routing: draft.routing,
        sla_first_response_min: draft.slaFirstResponseMin,
        sla_resolution_min: draft.slaResolutionMin,
        opt_out_keywords: draft.optOutKeywords,
        default_language: draft.defaultLanguage,
        csat_enabled: draft.csatEnabled,
        data_retention_days: draft.dataRetentionDays,
        welcome_message: draft.welcomeMessage,
        away_message: draft.awayMessage,
      });
      toast.push('Settings saved');
      setDirty(false);
      settingsQ.refetch();
    } catch (err: any) {
      toast.push(err?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const s = draft;
  const teamList = team.data || [];
  const auditList = audit.data || [];

  return (
    <div className="space-y-2">
      <PageHeader
        title="Settings"
        subtitle="Workspace configuration."
        action={dirty && (
          <button onClick={save} disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save changes
          </button>
        )}
      />

      {settingsQ.loading && !s && <LoadingBlock />}
      {settingsQ.error && <ErrorBlock message={settingsQ.error} onRetry={settingsQ.refetch} />}

      {s && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-2 py-2 border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-900">Business Hours</p>
            </div>
            <div className="px-2 py-2 space-y-1.5">
              {Object.entries(s.businessHours || {}).map(([day, h]) => (
                <div key={day} className="flex items-center gap-1.5">
                  <span className="w-16 text-[13px] text-slate-700 capitalize">{day}</span>
                  <input
                    type="time"
                    value={h.open}
                    disabled={h.closed}
                    onChange={(e) => update({ businessHours: { ...s.businessHours, [day]: { ...h, open: e.target.value } } })}
                    className={inputCls + ' max-w-[90px]'}
                  />
                  <input
                    type="time"
                    value={h.close}
                    disabled={h.closed}
                    onChange={(e) => update({ businessHours: { ...s.businessHours, [day]: { ...h, close: e.target.value } } })}
                    className={inputCls + ' max-w-[90px]'}
                  />
                  <label className="flex items-center gap-1 text-[13px] ml-auto">
                    <input
                      type="checkbox"
                      checked={h.closed}
                      onChange={(e) => update({ businessHours: { ...s.businessHours, [day]: { ...h, closed: e.target.checked } } })}
                      className="rounded-sm"
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-2 py-2 border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-900">Routing & SLA</p>
            </div>
            <div className="px-2 py-2 space-y-2">
              <Field label="Routing strategy">
                <select
                  value={s.routing}
                  onChange={(e) => update({ routing: e.target.value })}
                  className={inputCls}
                >
                  <option value="ROUND_ROBIN">Round robin</option>
                  <option value="LOAD_BASED">Load based</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </Field>
              <Field label="First response SLA (min)">
                <input
                  type="number"
                  value={s.slaFirstResponseMin}
                  onChange={(e) => update({ slaFirstResponseMin: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Resolution SLA (min)">
                <input
                  type="number"
                  value={s.slaResolutionMin}
                  onChange={(e) => update({ slaResolutionMin: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-2 py-2 border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-900">Messages</p>
            </div>
            <div className="px-2 py-2 space-y-2">
              <Field label="Welcome message">
                <textarea
                  value={s.welcomeMessage}
                  onChange={(e) => update({ welcomeMessage: e.target.value })}
                  rows={2}
                  className={inputCls + ' resize-none'}
                />
              </Field>
              <Field label="Away message">
                <textarea
                  value={s.awayMessage}
                  onChange={(e) => update({ awayMessage: e.target.value })}
                  rows={2}
                  className={inputCls + ' resize-none'}
                />
              </Field>
              <Field label="Opt-out keywords" helper="Comma-separated">
                <input
                  value={s.optOutKeywords.join(', ')}
                  onChange={(e) => update({ optOutKeywords: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <Toggle size="sm" checked={s.csatEnabled} onChange={(v) => update({ csatEnabled: v })} />
                Send CSAT survey after resolve
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-2 py-2 border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-900">Team</p>
            </div>
            <div className="divide-y divide-slate-100">
              {team.loading && teamList.length === 0 && <LoadingBlock />}
              {team.error && <ErrorBlock message={team.error} onRetry={team.refetch} />}
              {teamList.map((m) => (
                <div key={m.id} className="px-2 py-2 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${m.online ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900">{m.name}</p>
                    <p className="text-[13px] text-slate-500 mt-0.5">{m.email}</p>
                  </div>
                  <Badge variant="neutral">{m.role}</Badge>
                </div>
              ))}
              {!team.loading && teamList.length === 0 && (
                <p className="text-center text-slate-500 text-[13px] py-6">No team members yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-2 py-2 border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-900">Audit log</p>
        </div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {audit.loading && auditList.length === 0 && <LoadingBlock />}
          {auditList.map((a) => (
            <div key={a.id} className="px-2 py-2 flex items-center justify-between gap-2 text-[13px]">
              <div className="min-w-0">
                <p className="text-slate-700">
                  <span className="font-medium">{a.actorName}</span> {a.action}
                </p>
                <p className="text-slate-500 truncate mt-0.5">{a.target}</p>
              </div>
              <span className="text-slate-400 shrink-0">{relativeTime(a.timestamp)}</span>
            </div>
          ))}
          {!audit.loading && auditList.length === 0 && (
            <p className="text-center text-slate-500 text-[13px] py-6">No audit entries yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BotBuilderTab() {
  const toast = useToast();
  const flowQ = useAsync<WaBotFlow>(async (signal) => api.get<WaBotFlow>('/bot/flow/', { signal }), []);

  const [flow, setFlow] = useState<WaBotFlow | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (flowQ.data && !flow) {
      setFlow(flowQ.data);
      if (flowQ.data.nodes[0]) setSelectedKey(flowQ.data.nodes[0].key);
    }
  }, [flowQ.data]);

  const selected = flow?.nodes.find((n) => n.key === selectedKey) || null;

  const updateNode = (key: string, patch: Partial<WaBotNode>) => {
    if (!flow) return;
    setFlow({ ...flow, nodes: flow.nodes.map((n) => (n.key === key ? { ...n, ...patch } : n)) });
    setDirty(true);
  };

  const addNode = () => {
    if (!flow) return;
    const key = uid('node');
    const newNode: WaBotNode = {
      key,
      kind: 'message',
      title: 'New node',
      body: 'Message body',
      options: [],
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
    };
    setFlow({ ...flow, nodes: [...flow.nodes, newNode] });
    setSelectedKey(key);
    setDirty(true);
  };

  const deleteNode = (key: string) => {
    if (!flow) return;
    if (flow.entryNodeKey === key) {
      toast.push('Cannot delete entry node', 'warning');
      return;
    }
    setFlow({ ...flow, nodes: flow.nodes.filter((n) => n.key !== key) });
    setSelectedKey(flow.nodes[0]?.key ?? null);
    setDirty(true);
  };

  const save = async () => {
    if (!flow) return;
    setSaving(true);
    try {
      const payload = {
        name: flow.name,
        entry_node_key: flow.entryNodeKey,
        is_published: flow.isPublished,
        nodes: flow.nodes.map((n) => ({
          key: n.key,
          kind: n.kind,
          title: n.title,
          body: n.body,
          options: n.options || [],
          config: n.config || {},
          position: { x: n.position.x, y: n.position.y },
        })),
      };
      const saved = await api.put<WaBotFlow>('/bot/flow/', payload);
      setFlow(saved);
      setDirty(false);
      toast.push('Flow saved');
    } catch (err: any) {
      toast.push(err?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (dirty) {
      toast.push('Save first', 'warning');
      return;
    }
    try {
      await api.post('/bot/flow/publish/', {});
      flowQ.refetch();
      toast.push('Published');
    } catch (err: any) {
      toast.push(err?.message || 'Publish failed', 'error');
    }
  };

  if (flowQ.error) {
    return (
      <div className="space-y-2">
        <PageHeader title="Bot & Menus" subtitle="Design the menu tree your customers see." />
        <ErrorBlock message={flowQ.error} onRetry={flowQ.refetch} />
      </div>
    );
  }

  if (flowQ.loading && !flow) return <LoadingBlock />;

  if (!flow) {
    return (
      <div className="space-y-2">
        <PageHeader title="Bot & Menus" subtitle="Design the menu tree your customers see." />
        <EmptyState
          icon={<Layers className="w-4 h-4" />}
          title="No flow yet"
          description="Save your first menu flow to get started."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Bot & Menus"
        subtitle="Design the menu tree your customers see."
        action={
          <>
            <span className={`inline-flex items-center gap-1 px-1.5 py-1.5 rounded-sm text-[13px] font-medium ring-1 ring-inset ${flow.isPublished ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
              {flow.isPublished ? 'Published' : 'Draft'}
            </span>
            <button onClick={addNode} className={btnSecondary}>
              <Plus className="w-3 h-3" />Add node
            </button>
            <button onClick={save} disabled={!dirty || saving} className={btnSecondary}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
            <button onClick={publish} className={btnPrimary}>
              <Play className="w-3 h-3" />Publish
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-2" style={{ minHeight: 560 }}>
        <div className="bg-white border border-slate-200 rounded-sm flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Nodes ({flow.nodes.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {flow.nodes.map((n) => (
              <button
                key={n.key}
                onClick={() => setSelectedKey(n.key)}
                className={`w-full text-left px-2 py-2 rounded-sm mb-0.5 ${selectedKey === n.key ? 'bg-blue-950 text-white' : 'hover:bg-slate-50'}`}
              >
                <span className={`text-[13px] font-mono px-1 py-0.5 rounded-sm uppercase ${selectedKey === n.key ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {n.kind}
                </span>
                <p className={`text-[13px] font-medium mt-1 truncate ${selectedKey === n.key ? 'text-white' : 'text-slate-900'}`}>
                  {n.title}
                </p>
              </button>
            ))}
            {flow.nodes.length === 0 && (
              <p className="text-center text-slate-400 text-[13px] py-4">No nodes yet.</p>
            )}
          </div>
        </div>

        <div
          className="bg-white border border-slate-200 rounded-sm overflow-hidden relative"
          style={{ backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          <div className="w-full h-full overflow-hidden relative">
            {flow.nodes.map((n) => (
              <div
                key={n.key}
                onClick={() => setSelectedKey(n.key)}
                className={`absolute w-[220px] rounded-sm px-2 py-2 bg-white cursor-pointer ${selectedKey === n.key ? 'ring-2 ring-blue-950' : 'ring-1 ring-slate-200'}`}
                style={{ left: n.position.x, top: n.position.y }}
              >
                <span className="text-[13px] font-mono px-1 py-0.5 rounded-sm bg-slate-100 text-slate-600 uppercase">{n.kind}</span>
                <p className="text-[13px] font-semibold text-slate-900 truncate mt-1">{n.title}</p>
                {n.body && <p className="text-[13px] text-slate-500 truncate mt-0.5">{n.body}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Node Inspector</p>
          </div>
          {selected ? (
            <div className="px-3 py-2 space-y-2 overflow-y-auto flex-1">
              <Field label="Title">
                <input
                  value={selected.title}
                  onChange={(e) => updateNode(selected.key, { title: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Kind">
                <select
                  value={selected.kind}
                  onChange={(e) => updateNode(selected.key, { kind: e.target.value as NodeKind })}
                  className={inputCls}
                >
                  {(['message', 'list', 'products', 'cart', 'handoff', 'end'] as NodeKind[]).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label="Body">
                <textarea
                  rows={3}
                  value={selected.body}
                  onChange={(e) => updateNode(selected.key, { body: e.target.value })}
                  className={inputCls + ' resize-none'}
                />
              </Field>
              <div className="pt-2 border-t border-slate-100">
                <button onClick={() => deleteNode(selected.key)} className={btnDanger}>
                  <Trash2 className="w-3 h-3" />Delete node
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Select a node</div>
          )}
        </div>
      </div>
    </div>
  );
}