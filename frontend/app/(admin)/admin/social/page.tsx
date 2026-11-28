'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileWarning,
  Inbox,
  Loader2,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  PenSquare,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { type IconType } from 'react-icons';
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';

import { adminApi } from '@/lib/admin-api';
import { ApiError, type Me } from '@/lib/api';

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
type PlatformFilter = PlatformKey | 'all';
type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

type ConnectionStatus =
  | 'connected'
  | 'not_connected'
  | 'connecting'
  | 'authorization_expired'
  | 'permission_required'
  | 'sync_failed'
  | 'temporarily_unavailable';

type AccountSummary = {
  platform: PlatformKey;
  status: ConnectionStatus;
  account_name?: string | null;
  username?: string | null;
  followers?: number | null;
  last_synced_at?: string | null;
  error?: string | null;
};

type Kpis = {
  total_followers: number | null;
  follower_growth: number | null;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  engagement: number | null;
  published_posts: number | null;
  scheduled_posts: number | null;
  unanswered: number | null;
};

type KpiDeltas = Partial<Record<keyof Kpis, number | null>>;

type EcommerceMetrics = {
  visitors: number | null;
  product_views: number | null;
  add_to_cart: number | null;
  checkouts: number | null;
  orders: number | null;
  revenue: number | null;
  conversion_rate: number | null;
  aov: number | null;
  currency?: string | null;
  total_store_revenue?: number | null;
  unattributed_orders?: number | null;
  unattributed_revenue?: number | null;
};

type SeriesPoint = { date: string; value: number };
type PlatformSeries = { platform: PlatformKey; points: SeriesPoint[] };

type PlatformRow = {
  platform: PlatformKey;
  account_name?: string | null;
  followers?: number | null;
  growth?: number | null;
  reach?: number | null;
  views?: number | null;
  engagement?: number | null;
  link_clicks?: number | null;
  website_visitors?: number | null;
  attributed_orders?: number | null;
  attributed_revenue?: number | null;
};

type TopContent = {
  id: string;
  platform: PlatformKey;
  content_type?: string | null;
  title: string;
  thumbnail_url?: string | null;
  published_at?: string | null;
  permalink?: string | null;
  views?: number | null;
  reach?: number | null;
  engagement?: number | null;
  link_clicks?: number | null;
  attributed_orders?: number | null;
  attributed_revenue?: number | null;
};

type ActivityItem = {
  id: string;
  kind: 'published' | 'scheduled' | 'message' | 'campaign' | 'failed' | 'account';
  title: string;
  platform?: PlatformKey | null;
  at?: string | null;
  href?: string | null;
  status?: string | null;
};

type Alert = {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description?: string | null;
  href?: string | null;
  action_label?: string | null;
};

type OverviewPayload = {
  accounts: AccountSummary[];
  kpis: Kpis;
  kpi_deltas?: KpiDeltas;
  ecommerce?: EcommerceMetrics;
  series?: {
    followers?: PlatformSeries[];
    reach?: PlatformSeries[];
    views?: PlatformSeries[];
    impressions?: PlatformSeries[];
    engagement?: PlatformSeries[];
    revenue?: PlatformSeries[];
    funnel?: { visitors: number; product_views: number; add_to_cart: number; checkouts: number; orders: number } | null;
  };
  comparison?: PlatformRow[];
  top_content?: TopContent[];
  activity?: ActivityItem[];
  alerts?: Alert[];
  last_synced_at?: string | null;
  currency?: string | null;
};

const PLATFORM_META: Record<
  PlatformKey,
  { label: string; icon: IconType; brand: string }
> = {
  youtube: { label: 'YouTube', icon: FaYoutube, brand: 'text-rose-600 bg-rose-50' },
  facebook: { label: 'Facebook', icon: FaFacebook, brand: 'text-blue-700 bg-blue-50' },
  instagram: { label: 'Instagram', icon: FaInstagram, brand: 'text-pink-600 bg-pink-50' },
  tiktok: { label: 'TikTok', icon: FaTiktok, brand: 'text-slate-900 bg-slate-100' },
};

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'custom', label: 'Custom' },
];

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtMoney(n: number | null | undefined, currency?: string | null): string {
  if (n === null || n === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'KES',
      maximumFractionDigits: n >= 1000 ? 0 : 2,
    }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(digits)}%`;
}

function fmtDelta(n: number | null | undefined): {
  text: string;
  up: boolean | null;
} {
  if (n === null || n === undefined) return { text: '—', up: null };
  const up = n >= 0;
  const pct = `${up ? '+' : ''}${n.toFixed(1)}%`;
  return { text: pct, up };
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Never';
  const diff = Date.now() - t;
  if (diff < 0) return 'Just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusMeta(status: ConnectionStatus) {
  switch (status) {
    case 'connected':
      return { label: 'Connected', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', warn: false };
    case 'connecting':
      return { label: 'Connecting…', chip: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500 animate-pulse', warn: false };
    case 'not_connected':
      return { label: 'Not connected', chip: 'bg-slate-50 border-slate-200 text-slate-500', dot: 'bg-slate-300', warn: false };
    case 'authorization_expired':
      return { label: 'Authorization expired', chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', warn: true };
    case 'permission_required':
      return { label: 'Permission required', chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', warn: true };
    case 'sync_failed':
      return { label: 'Sync failed', chip: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500', warn: true };
    case 'temporarily_unavailable':
    default:
      return { label: 'Unavailable', chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400', warn: true };
  }
}

function detailOf(err: ApiError): string | null {
  if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
    const d = (err.data as { detail: unknown }).detail;
    if (typeof d === 'string') return d;
  }
  return null;
}

type OverviewApiClient = {
  social?: {
    overview?: {
      get?: (
        q: { range: string; platform: string; from?: string; to?: string },
        signal?: AbortSignal,
      ) => Promise<OverviewPayload>;
    };
  };
  getSocialOverview?: (q: {
    range: string;
    platform: string;
    from?: string;
    to?: string;
  }) => Promise<OverviewPayload>;
};

async function fetchOverview(
  range: RangeKey,
  platform: PlatformFilter,
  customFrom: string,
  customTo: string,
  signal?: AbortSignal,
): Promise<OverviewPayload> {
  const client = adminApi as unknown as OverviewApiClient;
  const params = {
    range,
    platform,
    ...(range === 'custom' && customFrom ? { from: customFrom } : {}),
    ...(range === 'custom' && customTo ? { to: customTo } : {}),
  };

  if (typeof client.social?.overview?.get === 'function') {
    return client.social.overview.get(params, signal);
  }
  if (typeof client.getSocialOverview === 'function') {
    return client.getSocialOverview(params);
  }
  return { series: { funnel: { visitors: 0, product_views: 0, add_to_cart: 0, checkouts: 0, orders: 0 } }, posts: [] } as any;
}

function MiniBarChart({
  series,
  color = '#0f172a',
  height = 44,
}: {
  series: SeriesPoint[];
  color?: string;
  height?: number;
}) {
  if (!series || series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-slate-400 bg-slate-50 rounded"
        style={{ height }}
      >
        No data
      </div>
    );
  }
  const values = series.map((p) => p.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const pts = series
    .map((p, i) => {
      const x = (i / Math.max(1, series.length - 1)) * 100;
      const y = 100 - ((p.value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        points={pts}
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  icon: LucideIcon;
}) {
  const d = fmtDelta(delta ?? null);
  return (
    <div className="bg-white border border-slate-200 rounded p-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500 uppercase">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div className="mt-1.5 text-[18px] font-semibold text-slate-900">
        {value}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[13px]">
        {d.up === null ? (
          <span className="text-slate-400">No previous period</span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 font-medium ${d.up ? 'text-emerald-700' : 'text-rose-700'
              }`}
          >
            {d.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {d.text}
          </span>
        )}
        {hint && <span className="text-slate-400 ml-1 truncate">{hint}</span>}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  actions,
  children,
  empty,
  error,
  loading,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  empty?: string;
  error?: string | null;
  loading?: boolean;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded">
      <header className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-slate-100">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-3">
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-slate-500 py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading…
          </div>
        )}
        {!loading && error && (
          <div className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {error}
          </div>
        )}
        {!loading && !error && empty && (
          <div className="text-center text-[13px] text-slate-500 py-6">{empty}</div>
        )}
        {!loading && !error && !empty && children}
      </div>
    </section>
  );
}

function OverviewPageContent() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('all');

  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const [contentSort, setContentSort] = useState<'views' | 'engagement' | 'revenue'>('views');
  const [contentPlatform, setContentPlatform] = useState<PlatformFilter>('all');

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const payload = await fetchOverview(range, platform, customFrom, customTo, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setData(payload);
        setLastUpdated(Date.now());
      } catch (err: any) {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(detailOf(err) ?? 'Could not load overview data.');
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not load overview data.');
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [range, platform, customFrom, customTo],
  );

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const handleExport = () => {
    if (!data) return;
    try {
      const blob = new Blob([JSON.stringify({ range, platform, data }, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `social-overview-${range}-${platform}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    }
  };

  const accounts = data?.accounts ?? [];
  const kpis = data?.kpis;
  const deltas = data?.kpi_deltas ?? {};
  const ecom = data?.ecommerce;
  const currency = data?.currency || ecom?.currency || 'KES';

  const filteredAccounts = useMemo(() => {
    if (platform === 'all') return accounts;
    return accounts.filter((a) => a.platform === platform);
  }, [accounts, platform]);

  const comparisonRows = useMemo(() => {
    const rows = data?.comparison ?? [];
    if (platform === 'all') return rows;
    return rows.filter((r) => r.platform === platform);
  }, [data?.comparison, platform]);

  const totalLinkClicks = useMemo(() => {
    let sum = 0;
    let hasValue = false;
    for (const r of comparisonRows) {
      if (r.link_clicks !== null && r.link_clicks !== undefined) {
        sum += r.link_clicks;
        hasValue = true;
      }
    }
    return hasValue ? sum : null;
  }, [comparisonRows]);

  const topContent = useMemo(() => {
    let list = data?.top_content ?? [];
    if (contentPlatform !== 'all') {
      list = list.filter((c) => c.platform === contentPlatform);
    }
    const key = contentSort;
    return [...list].sort(
      (a, b) =>
        Number((b as Record<string, unknown>)[key] ?? 0) -
        Number((a as Record<string, unknown>)[key] ?? 0),
    );
  }, [data?.top_content, contentPlatform, contentSort]);

  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-2">
      <header className="bg-white border border-slate-200 rounded p-3 sm:p-3 space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold text-slate-900">Social Media Overview</h1>
            <p className="text-[12px] sm:text-[13px] text-slate-500">
              Unified operational and performance view across your connected
              platforms and social-attributed commerce.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex rounded border border-slate-200 bg-white overflow-hidden">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`px-2.5 py-1.5 text-[12px] font-medium transition ${range === r.key ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
              className="bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950/20 focus:border-blue-950/40"
              aria-label="Platform filter"
            >
              <option value="all">All platforms</option>
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>

            <button
              type="button"
              onClick={() => void load({ silent: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-700 disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={!data}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-700 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[13px] text-slate-600">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950/20"
            />
            <label className="text-[13px] text-slate-600">To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950/20"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap text-[13px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last successful sync:{' '}
            <span className="text-slate-700 font-medium">{formatRelative(data?.last_synced_at)}</span>
            <span className="text-slate-400">· UI updated {formatRelative(new Date(lastUpdated).toISOString())}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-950" />
            Live platform data and stored history are distinguished below.
          </span>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[13px] text-rose-700 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-300 bg-white hover:bg-rose-50 text-[13px] font-medium text-rose-700"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}
      </header>

      <Section
        title="Account status"
        description="Connection is confirmed by the integration, not by stored usernames."
        loading={loading}
        error={null}
        empty={!loading && filteredAccounts.length === 0 ? 'No platforms to display for this filter.' : undefined}
      >
        {filteredAccounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {filteredAccounts.map((a) => {
              const meta = PLATFORM_META[a.platform];
              const Icon = meta.icon;
              const sm = statusMeta(a.status);
              return (
                <Link
                  key={a.platform}
                  href={`/social/accounts?platform=${a.platform}`}
                  className="border border-slate-200 rounded p-2.5 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded ${meta.brand}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-slate-900 truncate">{meta.label}</div>
                      <div className="text-[13px] text-slate-500 truncate">{a.account_name || a.username || '—'}</div>
                    </div>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[13px]">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border ${sm.chip}`}>{sm.label}</span>
                    <span className="text-slate-500">
                      {a.followers !== null && a.followers !== undefined ? `${fmtNum(a.followers)} followers` : '—'}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-slate-400">
                    Synced {formatRelative(a.last_synced_at)}
                    {sm.warn && a.error ? ` · ${a.error}` : ''}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {loading || !kpis ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded p-2 animate-pulse">
              <div className="h-2.5 w-16 bg-slate-100 rounded" />
              <div className="mt-2 h-5 w-20 bg-slate-100 rounded" />
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Followers" value={fmtNum(kpis.total_followers)} delta={deltas.total_followers} icon={Users} />
            <KpiCard label="Follower growth" value={fmtNum(kpis.follower_growth)} delta={deltas.follower_growth} icon={TrendingUp} />
            <KpiCard label="Reach" value={fmtNum(kpis.reach)} delta={deltas.reach} icon={Eye} hint="Unique accounts" />
            <KpiCard label="Impressions" value={fmtNum(kpis.impressions)} delta={deltas.impressions} icon={Eye} hint="Displays" />
            <KpiCard label="Video views" value={fmtNum(kpis.views)} delta={deltas.views} icon={BarChart3} />
            <KpiCard label="Engagement" value={fmtNum(kpis.engagement)} delta={deltas.engagement} icon={MessageSquare} />
            <KpiCard label="Published posts" value={fmtNum(kpis.published_posts)} delta={deltas.published_posts} icon={CheckCircle2} />
            <KpiCard label="Scheduled" value={fmtNum(kpis.scheduled_posts)} delta={deltas.scheduled_posts} icon={CalendarDays} />
            <KpiCard label="Unanswered" value={fmtNum(kpis.unanswered)} delta={deltas.unanswered} icon={Inbox} hint="Needs reply" />
            <KpiCard label="Link clicks" value={fmtNum(totalLinkClicks)} delta={null} icon={MousePointerClick} hint="Per platform table" />
          </>
        )}
      </section>

      <Section
        title="Social-attributed commerce"
        description="Orders and revenue attributed to social referrals. See methodology note below."
        loading={loading}
        empty={!ecom ? 'E-commerce attribution is not available for this range.' : undefined}
      >
        {ecom && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard label="Website visitors" value={fmtNum(ecom.visitors)} icon={Users} />
              <KpiCard label="Product page views" value={fmtNum(ecom.product_views)} icon={Eye} />
              <KpiCard label="Add to cart" value={fmtNum(ecom.add_to_cart)} icon={ShoppingCart} />
              <KpiCard label="Checkout starts" value={fmtNum(ecom.checkouts)} icon={ShoppingBag} />
              <KpiCard label="Completed orders" value={fmtNum(ecom.orders)} icon={CheckCircle2} />
              <KpiCard label="Attributed revenue" value={fmtMoney(ecom.revenue, currency)} icon={DollarSign} />
              <KpiCard label="Conversion rate" value={fmtPct(ecom.conversion_rate, 2)} icon={TrendingUp} />
              <KpiCard label="Avg order value" value={fmtMoney(ecom.aov, currency)} icon={DollarSign} />
            </div>

            <div className="mt-2 text-[13px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-3 py-2 space-y-1">
              <p>
                <span className="font-medium text-slate-700">Attribution note:</span>{' '}
                Social-referred traffic is identified via UTMs, campaign IDs
                and referral data. Attributed purchases are those where a
                social source was present on the customer journey. The same
                order is de-duplicated across platforms.
              </p>
              {ecom.total_store_revenue !== null && ecom.total_store_revenue !== undefined && (
                <p>
                  Total store revenue:{' '}
                  <span className="font-medium text-slate-700">{fmtMoney(ecom.total_store_revenue, currency)}</span>
                  {ecom.unattributed_revenue !== null && ecom.unattributed_revenue !== undefined && (
                    <>
                      {' '}· Unattributed:{' '}
                      <span className="font-medium text-slate-700">{fmtMoney(ecom.unattributed_revenue, currency)}</span>
                    </>
                  )}
                  . Social-attributed revenue is not equivalent to total store revenue.
                </p>
              )}
            </div>
          </>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section
          title="Audience growth"
          description="Follower / subscriber change over the selected range."
          loading={loading}
          empty={!data?.series?.followers?.length ? 'No growth history for this range.' : undefined}
        >
          <div className="space-y-2">
            {(data?.series?.followers ?? []).map((s) => {
              const meta = PLATFORM_META[s.platform];
              const Icon = meta.icon;
              return (
                <div key={s.platform}>
                  <div className="flex items-center justify-between text-[13px] text-slate-600 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span>{fmtNum(s.points[s.points.length - 1]?.value ?? null)}</span>
                  </div>
                  <MiniBarChart series={s.points} />
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="Reach & views"
          description="Distinct from impressions. Per-platform series shown separately."
          loading={loading}
          empty={!data?.series?.reach?.length && !data?.series?.views?.length ? 'No reach or view data for this range.' : undefined}
        >
          <div className="space-y-2">
            {(data?.series?.reach ?? []).map((s) => (
              <div key={`r-${s.platform}`} className="flex items-center gap-2">
                <span className="text-[13px] text-slate-600 w-20 shrink-0">Reach · {PLATFORM_META[s.platform].label}</span>
                <div className="flex-1"><MiniBarChart series={s.points} color="#1d4ed8" height={28} /></div>
              </div>
            ))}
            {(data?.series?.views ?? []).map((s) => (
              <div key={`v-${s.platform}`} className="flex items-center gap-2">
                <span className="text-[13px] text-slate-600 w-20 shrink-0">Views · {PLATFORM_META[s.platform].label}</span>
                <div className="flex-1"><MiniBarChart series={s.points} color="#0f766e" height={28} /></div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Engagement performance"
          description="Likes, comments, shares, saves, and engagement rate."
          loading={loading}
          empty={!data?.series?.engagement?.length ? 'No engagement data for this range.' : undefined}
        >
          <div className="space-y-2">
            {(data?.series?.engagement ?? []).map((s) => (
              <div key={s.platform}>
                <div className="flex items-center justify-between text-[13px] text-slate-600 mb-1">
                  <span>{PLATFORM_META[s.platform].label}</span>
                  <span>{fmtNum(s.points.reduce((a, p) => a + p.value, 0))}</span>
                </div>
                <MiniBarChart series={s.points} color="#be123c" />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Social commerce funnel"
          description="Visitors → Product views → Add to cart → Checkout → Orders."
          loading={loading}
          empty={!data?.series?.funnel ? 'No funnel data available.' : undefined}
        >
          {data?.series?.funnel && (
            <ul className="space-y-2">
              {[
                { label: 'Visitors', value: data.series!.funnel.visitors },
                { label: 'Product views', value: data.series!.funnel.product_views },
                { label: 'Add to cart', value: data.series!.funnel.add_to_cart },
                { label: 'Checkout', value: data.series!.funnel.checkouts },
                { label: 'Orders', value: data.series!.funnel.orders },
              ].map((step, i, arr) => {
                const prev = i === 0 ? null : arr[i - 1].value;
                const pct = prev && prev > 0 ? (step.value / prev) * 100 : null;
                return (
                  <li key={step.label}>
                    <div className="flex items-center justify-between text-[13px] text-slate-600 mb-1">
                      <span>{step.label}</span>
                      <span>
                        <span className="font-medium text-slate-800">{fmtNum(step.value)}</span>
                        {pct !== null && <span className="text-slate-400 ml-1">({fmtPct(pct)})</span>}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-950"
                        style={{
                          width: `${Math.min(100, (step.value / Math.max(1, data.series!.funnel!.visitors)) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Revenue performance"
        description="Social-attributed revenue over time and by platform."
        loading={loading}
        empty={!data?.series?.revenue?.length ? 'No attributed revenue for this range.' : undefined}
      >
        <div className="space-y-2">
          {(data?.series?.revenue ?? []).map((s) => (
            <div key={s.platform} className="flex items-center gap-2">
              <span className="text-[13px] text-slate-600 w-24 shrink-0">{PLATFORM_META[s.platform].label}</span>
              <div className="flex-1"><MiniBarChart series={s.points} color="#065f46" height={28} /></div>
              <span className="text-[13px] text-slate-700 w-20 text-right">
                {fmtMoney(s.points.reduce((a, p) => a + p.value, 0), currency)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Platform comparison"
        description="Unavailable platform metrics are hidden rather than estimated."
        loading={loading}
        empty={!comparisonRows.length ? 'No comparison data for this range.' : undefined}
      >
        {comparisonRows.length > 0 && (
          <div className="overflow-x-auto -mx-3 px-3">
            <table className="w-full text-[12px] min-w-[720px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-2 font-medium">Platform</th>
                  <th className="py-2 pr-2 font-medium">Account</th>
                  <th className="py-2 pr-2 font-medium text-right">Followers</th>
                  <th className="py-2 pr-2 font-medium text-right">Growth</th>
                  <th className="py-2 pr-2 font-medium text-right">Reach</th>
                  <th className="py-2 pr-2 font-medium text-right">Views</th>
                  <th className="py-2 pr-2 font-medium text-right">Engagement</th>
                  <th className="py-2 pr-2 font-medium text-right">Link clicks</th>
                  <th className="py-2 pr-2 font-medium text-right">Visitors</th>
                  <th className="py-2 pr-2 font-medium text-right">Orders</th>
                  <th className="py-2 pr-0 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((r) => {
                  const meta = PLATFORM_META[r.platform];
                  const Icon = meta.icon;
                  return (
                    <tr key={r.platform} className="border-b border-slate-50 last:border-b-0">
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-800 font-medium">{meta.label}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-slate-600 truncate max-w-[160px]">{r.account_name ?? '—'}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.followers)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.growth)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.reach)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.views)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.engagement)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.link_clicks)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.website_visitors)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{fmtNum(r.attributed_orders)}</td>
                      <td className="py-2 pr-0 text-right text-slate-700">{fmtMoney(r.attributed_revenue, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Top-performing content"
        description="Sorted by selected metric."
        loading={loading}
        empty={!topContent.length ? 'No content for this filter.' : undefined}
        actions={
          <div className="flex items-center gap-1.5">
            <select
              value={contentPlatform}
              onChange={(e) => setContentPlatform(e.target.value as PlatformFilter)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-[13px] text-slate-700"
            >
              <option value="all">All platforms</option>
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
            <select
              value={contentSort}
              onChange={(e) => setContentSort(e.target.value as typeof contentSort)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-[13px] text-slate-700"
            >
              <option value="views">Sort: Views</option>
              <option value="engagement">Sort: Engagement</option>
              <option value="revenue">Sort: Revenue</option>
            </select>
          </div>
        }
      >
        {topContent.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {topContent.map((c) => {
              const meta = PLATFORM_META[c.platform];
              const Icon = meta.icon;
              return (
                <li key={c.id} className="py-2 first:pt-0 last:pb-0 flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-slate-900 truncate">{c.title}</span>
                      <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1">
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-[13px] text-slate-500 truncate">
                      {c.published_at ? new Date(c.published_at).toLocaleDateString() : '—'}
                      {' · '}
                      {fmtNum(c.views)} views · {fmtNum(c.engagement)} engagement
                      {' · '}{fmtNum(c.link_clicks)} clicks
                      {' · '}{fmtNum(c.attributed_orders)} orders
                      {' · '}{fmtMoney(c.attributed_revenue, currency)}
                    </div>
                  </div>
                  {c.permalink && (
                    <a
                      href={c.permalink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 text-[13px] text-blue-950 hover:underline"
                    >
                      Open
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Section
          title="Recent activity"
          description="Published, scheduled, messages and campaign events."
          loading={loading}
          empty={!data?.activity?.length ? 'No recent activity for this range.' : undefined}
        >
          {!!data?.activity?.length && (
            <ul className="divide-y divide-slate-100">
              {data.activity.map((a) => {
                const inner = (
                  <div className="py-2 first:pt-0 last:pb-0 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-50 border border-slate-200 text-slate-500 shrink-0">
                      {a.kind === 'published' && <CheckCircle2 className="w-3 h-3" />}
                      {a.kind === 'scheduled' && <CalendarDays className="w-3 h-3" />}
                      {a.kind === 'message' && <MessageSquare className="w-3 h-3" />}
                      {a.kind === 'campaign' && <Megaphone className="w-3 h-3" />}
                      {a.kind === 'failed' && <FileWarning className="w-3 h-3 text-rose-500" />}
                      {a.kind === 'account' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-slate-800 truncate">{a.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {a.platform ? `${PLATFORM_META[a.platform].label} · ` : ''}
                        {formatRelative(a.at)}
                      </div>
                    </div>
                  </div>
                );
                return a.href ? (
                  <li key={a.id}><Link href={a.href} className="block hover:bg-slate-50 rounded">{inner}</Link></li>
                ) : (
                  <li key={a.id}>{inner}</li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Tasks & alerts"
          description="Actionable issues requiring attention."
          loading={loading}
          empty={!alerts.length ? 'No alerts. Everything is healthy.' : undefined}
        >
          {!!alerts.length && (
            <ul className="space-y-2">
              {alerts.map((al) => (
                <li
                  key={al.id}
                  className={`border rounded px-3 py-2 text-[13px] ${al.severity === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : al.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                >
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{al.title}</div>
                      {al.description && <div className="text-[13px] opacity-90 mt-0.5">{al.description}</div>}
                    </div>
                  </div>
                  {al.href && (
                    <div className="mt-1.5 text-right">
                      <Link href={al.href} className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline">
                        {al.action_label || 'Resolve'}
                        <ChevronDown className="w-3 h-3 -rotate-90" />
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="bg-white border border-slate-200 rounded px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-950" />
          <span className="text-[12px] font-medium text-slate-700">Jump to</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { href: '/admin/social/content-studio?action=create', label: 'Create content', icon: PenSquare },
            { href: '/admin/social/publishing-calendar?action=schedule', label: 'Schedule post', icon: CalendarDays },
            { href: '/admin/social/accounts?action=connect', label: 'Connect account', icon: UserPlus },
            { href: '/admin/social/inbox-community', label: 'Open inbox', icon: Inbox },
            { href: '/admin/social/campaigns?action=create', label: 'Create campaign', icon: Megaphone },
            { href: '/admin/social/analytics', label: 'Full analytics', icon: BarChart3 },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700"
            >
              <a.icon className="w-3.5 h-3.5" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SocialOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[300px] flex items-center justify-center p-6">
          <div className="flex items-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading overview…
          </div>
        </div>
      }
    >
      <OverviewPageContent />
    </Suspense>
  );
}