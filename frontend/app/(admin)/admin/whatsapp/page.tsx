'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  MessageSquare,
  CheckCheck,
  Eye,
  XCircle,
  Inbox,
  Send,
  Users,
  MessageSquareOff,
  UserPlus,
  UserCheck,
  HelpCircle,
  MousePointerClick,
  ShoppingCart,
  DollarSign,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  Settings,
  Calendar,
  ChevronDown,
  Package,
  Zap,
  Megaphone,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ShieldAlert,
  Webhook,
  FileWarning,
  RotateCw,
} from 'lucide-react';

type ConnectionState =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'expired'
  | 'action_required'
  | 'error';

type ConnectionSummary = {
  state: ConnectionState;
  displayName: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean | null;
  apiStatus: 'ok' | 'degraded' | 'down' | null;
  webhookStatus: 'ok' | 'degraded' | 'down' | null;
  lastSyncedAt: string | null;
  requiredAction: string | null;
};

type Period = '7d' | '30d' | '90d';

type MetricValue = {
  value: number | null;
  previous: number | null;
  available: boolean;
};

type MessagingKpis = {
  sent: MetricValue;
  delivered: MetricValue;
  read: MetricValue;
  failed: MetricValue;
  incoming: MetricValue;
  outgoing: MetricValue;
  activeConversations: MetricValue;
  unansweredConversations: MetricValue;
};

type CustomerCommerceKpis = {
  newContacts: MetricValue;
  returningCustomers: MetricValue;
  enquiries: MetricValue;
  referredVisits: MetricValue;
  attributedOrders: MetricValue;
  attributedRevenue: MetricValue;
};

type ChartPoint = {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  incoming: number;
};

type RecentConversation = {
  id: string;
  customerName: string | null;
  phoneNumber: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  assignedTo: string | null;
  unread: boolean;
  orderId: string | null;
};

type ProductActivity = {
  recentlyShared: Array<{
    productId: string;
    name: string;
    sharedAt: string;
  }>;
  productEnquiries: number;
  syncIssues: number;
  whatsappOrders: number;
  recentNotifications: Array<{
    orderId: string;
    reference: string;
    status: string;
    at: string;
  }>;
};

type AutomationActivity = {
  activeAutomations: number;
  successfulRuns: number;
  failedRuns: number;
  scheduledCampaigns: number;
  campaignsNeedingAttention: number;
  templateAlerts: Array<{
    templateId: string;
    name: string;
    status: 'approved' | 'rejected' | 'pending';
    at: string;
  }>;
};

type AlertItem = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  resolveHref: string;
  resolveLabel: string;
};

type OverviewData = {
  connection: ConnectionSummary;
  period: Period;
  messaging: MessagingKpis | null;
  customerCommerce: CustomerCommerceKpis | null;
  chart: ChartPoint[];
  conversations: RecentConversation[];
  products: ProductActivity | null;
  automation: AutomationActivity | null;
  alerts: AlertItem[];
};

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const STATE_META: Record<
  ConnectionState,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  connected: {
    label: 'Connected',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  disconnected: {
    label: 'Disconnected',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  expired: {
    label: 'Connection expired',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  action_required: {
    label: 'Action required',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  error: {
    label: 'Error',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
};

const SEVERITY_META: Record<
  AlertItem['severity'],
  { bg: string; border: string; text: string; icon: typeof AlertCircle }
> = {
  critical: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    icon: XCircle,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: AlertCircle,
  },
};

function formatNumber(v: number | null): string {
  if (v === null) return '—';
  return new Intl.NumberFormat('en-US').format(v);
}

function formatCurrency(v: number | null): string {
  if (v === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function DeltaBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null || previous === 0) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-emerald-600' : 'text-rose-600'}`}
    >
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  icon: Icon,
  metric,
  format = 'number',
}: {
  label: string;
  icon: typeof MessageSquare;
  metric: MetricValue;
  format?: 'number' | 'currency';
}) {
  const formatted =
    format === 'currency' ? formatCurrency(metric.value) : formatNumber(metric.value);
  return (
    <div className="bg-white border border-slate-200 rounded p-3">
      <div className="flex items-center justify-between">
        <div className="w-7 h-7 rounded bg-slate-50 text-slate-600 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
        </div>
        {metric.available && metric.previous !== null && (
          <DeltaBadge current={metric.value} previous={metric.previous} />
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500 truncate">{label}</p>
      <p className="text-[18px] font-semibold text-slate-900 leading-tight mt-0.5">
        {metric.available ? formatted : <span className="text-slate-300">—</span>}
      </p>
      {!metric.available && (
        <p className="text-[10px] text-slate-400 mt-0.5">Not tracked yet</p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <h2 className="text-[12px] font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function ConnectionPanel({
  connection,
  loading,
}: {
  connection: ConnectionSummary | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded p-3 flex items-center gap-2 text-[12px] text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading connection…
      </div>
    );
  }
  if (!connection) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded p-3 flex items-center gap-2 text-[12px] text-rose-700">
        <AlertCircle className="w-3.5 h-3.5" />
        Could not load connection status.
      </div>
    );
  }
  const meta = STATE_META[connection.state];
  const connected = connection.state === 'connected';

  if (!connected) {
    return (
      <div className="bg-white border border-slate-200 rounded p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${meta.bg} ${meta.border} ${meta.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <h3 className="text-[13px] font-semibold text-slate-900 mt-1.5">
              Connect your WhatsApp Business Account
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Messaging and commerce features require an active WhatsApp Business
              connection. Connect an account to start using this section.
            </p>
            {connection.requiredAction && (
              <p className="text-[12px] text-amber-700 mt-1">
                {connection.requiredAction}
              </p>
            )}
            <Link
              href="/whatsapp/analytics?tab=connection"
              className="inline-flex items-center gap-1.5 mt-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition"
            >
              <Settings className="w-3.5 h-3.5" />
              Open connection settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const apiOk = connection.apiStatus === 'ok';
  const webhookOk = connection.webhookStatus === 'ok';

  return (
    <div className="bg-white border border-slate-200 rounded p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-slate-900 truncate">
                {connection.displayName ?? 'WhatsApp Business'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.bg} ${meta.border} ${meta.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              {connection.phoneNumber ?? '—'}
            </p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-600">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connection.phoneVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            {connection.phoneVerified ? 'Phone verified' : 'Phone unverified'}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <span
              className={`w-1.5 h-1.5 rounded-full ${apiOk ? 'bg-emerald-500' : connection.apiStatus === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'}`}
            />
            API {connection.apiStatus ?? 'unknown'}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <span
              className={`w-1.5 h-1.5 rounded-full ${webhookOk ? 'bg-emerald-500' : connection.webhookStatus === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'}`}
            />
            Webhook {connection.webhookStatus ?? 'unknown'}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          Last sync {formatRelative(connection.lastSyncedAt)}
          <Link
            href="/whatsapp/analytics?tab=connection"
            className="ml-1 inline-flex items-center gap-1 text-blue-950 hover:underline font-medium"
          >
            <Settings className="w-3 h-3" />
            Manage
          </Link>
        </div>
      </div>

      {connection.requiredAction && (
        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[11px] text-amber-800">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{connection.requiredAction}</span>
        </div>
      )}
    </div>
  );
}

function Chart({
  points,
  loading,
}: {
  points: ChartPoint[];
  loading: boolean;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const p of points) {
      m = Math.max(m, p.sent, p.delivered, p.read, p.failed, p.incoming);
    }
    return m || 1;
  }, [points]);

  const series = [
    { key: 'sent', label: 'Sent', color: 'bg-blue-500' },
    { key: 'delivered', label: 'Delivered', color: 'bg-emerald-500' },
    { key: 'read', label: 'Read', color: 'bg-indigo-500' },
    { key: 'failed', label: 'Failed', color: 'bg-rose-500' },
    { key: 'incoming', label: 'Incoming', color: 'bg-amber-500' },
  ] as const;

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center text-[12px] text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading activity…
      </div>
    );
  }
  if (points.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-[12px] text-slate-500">
        <MessageSquare className="w-5 h-5 text-slate-300 mb-1" />
        No messaging activity in this period.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 text-[11px] text-slate-600">
            <span className={`w-2 h-2 rounded-sm ${s.color}`} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-1 h-40">
        {points.map((p) => (
          <div
            key={p.date}
            className="flex-1 flex items-end gap-0.5 h-full"
            title={p.date}
          >
            {series.map((s) => (
              <div
                key={s.key}
                className={`flex-1 ${s.color} rounded-sm`}
                style={{
                  height: `${Math.max(
                    ((p[s.key] as number) / max) * 100,
                    p[s.key] > 0 ? 2 : 0,
                  )}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function WhatsAppOverviewPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);

  const load = useCallback(
    async (nextPeriod: Period, silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `/api/whatsapp/overview?period=${nextPeriod}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('Failed to load overview');
        const json = (await res.json()) as OverviewData;
        setData(json);
      } catch {
        setError('Could not load WhatsApp overview data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(period);
  }, [period, load]);

  const handleRefresh = () => load(period, true);

  const connection = data?.connection ?? null;
  const connected = connection?.state === 'connected';
  const messaging = data?.messaging ?? null;
  const customerCommerce = data?.customerCommerce ?? null;
  const chart = data?.chart ?? [];
  const conversations = data?.conversations ?? [];
  const products = data?.products ?? null;
  const automation = data?.automation ?? null;
  const alerts = data?.alerts ?? [];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? '';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-3 sm:px-4 lg:px-5 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900">Overview</h1>
            <p className="text-[12px] text-slate-500">
              WhatsApp integration health, messaging and commerce at a glance.
            </p>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {periodLabel}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {periodOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded shadow-lg z-30 py-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setPeriod(p.value);
                      setPeriodOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 ${period === p.value ? 'text-blue-950 font-medium' : 'text-slate-700'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <ConnectionPanel connection={connection} loading={loading} />

        {connected && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] font-semibold text-slate-800">
                  Messaging
                </h2>
                <Link
                  href="/whatsapp/inbox"
                  className="text-[11px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                >
                  Open Inbox
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[88px] bg-white border border-slate-200 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : messaging ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <KpiCard label="Messages sent" icon={Send} metric={messaging.sent} />
                  <KpiCard label="Delivered" icon={CheckCheck} metric={messaging.delivered} />
                  <KpiCard label="Read" icon={Eye} metric={messaging.read} />
                  <KpiCard label="Failed" icon={XCircle} metric={messaging.failed} />
                  <KpiCard label="Incoming" icon={Inbox} metric={messaging.incoming} />
                  <KpiCard label="Outgoing" icon={MessageSquare} metric={messaging.outgoing} />
                  <KpiCard label="Active conversations" icon={Users} metric={messaging.activeConversations} />
                  <KpiCard label="Unanswered" icon={MessageSquareOff} metric={messaging.unansweredConversations} />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded p-3 text-[12px] text-slate-500">
                  Messaging metrics are not available yet.
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] font-semibold text-slate-800">
                  Customer & Commerce
                </h2>
                <Link
                  href="/whatsapp/commerce"
                  className="text-[11px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                >
                  Open Commerce
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[88px] bg-white border border-slate-200 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : customerCommerce ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <KpiCard label="New contacts" icon={UserPlus} metric={customerCommerce.newContacts} />
                  <KpiCard label="Returning customers" icon={UserCheck} metric={customerCommerce.returningCustomers} />
                  <KpiCard label="Enquiries" icon={HelpCircle} metric={customerCommerce.enquiries} />
                  <KpiCard label="Referred visits" icon={MousePointerClick} metric={customerCommerce.referredVisits} />
                  <KpiCard label="Attributed orders" icon={ShoppingCart} metric={customerCommerce.attributedOrders} />
                  <KpiCard label="Attributed revenue" icon={DollarSign} metric={customerCommerce.attributedRevenue} format="currency" />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded p-3 text-[12px] text-slate-500">
                  Customer and commerce metrics are not available yet.
                </div>
              )}
            </div>

            <SectionCard
              title="Messaging activity"
              action={
                <span className="text-[11px] text-slate-500">{periodLabel}</span>
              }
            >
              <Chart points={chart} loading={loading} />
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <SectionCard
                title="Recent conversations"
                action={
                  <Link
                    href="/whatsapp/inbox"
                    className="text-[11px] font-medium text-blue-950 hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                {loading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 bg-slate-50 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-slate-500">
                    No recent conversations.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 -mx-3">
                    {conversations.slice(0, 5).map((c) => (
                      <Link
                        key={c.id}
                        href={`/whatsapp/inbox?conversation=${encodeURIComponent(c.id)}`}
                        className="flex items-start gap-2 px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">
                          {(c.customerName || c.phoneNumber).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-medium text-slate-800 truncate">
                              {c.customerName || c.phoneNumber}
                            </span>
                            {c.unread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                            {c.orderId && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 shrink-0">
                                Order
                              </span>
                            )}
                            <span className="flex-1" />
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatRelative(c.lastMessageAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {c.lastMessagePreview}
                          </p>
                          {c.assignedTo && (
                            <p className="text-[10px] text-slate-400 truncate">
                              Assigned to {c.assignedTo}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Product & sales activity"
                action={
                  <Link
                    href="/whatsapp/commerce"
                    className="text-[11px] font-medium text-blue-950 hover:underline"
                  >
                    Open Commerce
                  </Link>
                }
              >
                {loading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-8 bg-slate-50 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : !products ? (
                  <div className="py-6 text-center text-[12px] text-slate-500">
                    No product activity available.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 rounded px-2 py-1.5">
                        <p className="text-[10px] text-slate-500">Enquiries</p>
                        <p className="text-[14px] font-semibold text-slate-900">
                          {formatNumber(products.productEnquiries)}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded px-2 py-1.5">
                        <p className="text-[10px] text-slate-500">Sync issues</p>
                        <p className={`text-[14px] font-semibold ${products.syncIssues > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatNumber(products.syncIssues)}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded px-2 py-1.5">
                        <p className="text-[10px] text-slate-500">WA orders</p>
                        <p className="text-[14px] font-semibold text-slate-900">
                          {formatNumber(products.whatsappOrders)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-700 mb-1">
                        Recently shared
                      </p>
                      {products.recentlyShared.length === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          No products shared recently.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {products.recentlyShared.slice(0, 3).map((p) => (
                            <li key={p.productId}>
                              <Link
                                href={`/products/${encodeURIComponent(p.productId)}`}
                                className="flex items-center gap-1.5 text-[11px] text-slate-700 hover:text-blue-950"
                              >
                                <Package className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{p.name}</span>
                                <span className="flex-1" />
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {formatRelative(p.sharedAt)}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-700 mb-1">
                        Recent order notifications
                      </p>
                      {products.recentNotifications.length === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          No order notifications yet.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {products.recentNotifications.slice(0, 3).map((n) => (
                            <li key={`${n.orderId}-${n.at}`}>
                              <Link
                                href={`/orders/${encodeURIComponent(n.orderId)}`}
                                className="flex items-center gap-1.5 text-[11px] text-slate-700 hover:text-blue-950"
                              >
                                <ShoppingCart className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  Order {n.reference}
                                </span>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {n.status}
                                </span>
                                <span className="flex-1" />
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {formatRelative(n.at)}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Automation & campaigns"
              action={
                <Link
                  href="/whatsapp/messages?tab=automation"
                  className="text-[11px] font-medium text-blue-950 hover:underline"
                >
                  Open Messages
                </Link>
              }
            >
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-slate-50 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : !automation ? (
                <div className="py-4 text-center text-[12px] text-slate-500">
                  No automation data available.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Zap className="w-3 h-3" />
                        <span className="text-[10px]">Active automations</span>
                      </div>
                      <p className="text-[14px] font-semibold text-slate-900 mt-0.5">
                        {formatNumber(automation.activeAutomations)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1 text-slate-500">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[10px]">Successful runs</span>
                      </div>
                      <p className="text-[14px] font-semibold text-slate-900 mt-0.5">
                        {formatNumber(automation.successfulRuns)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1 text-slate-500">
                        <XCircle className="w-3 h-3" />
                        <span className="text-[10px]">Failed runs</span>
                      </div>
                      <p className={`text-[14px] font-semibold mt-0.5 ${automation.failedRuns > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatNumber(automation.failedRuns)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Megaphone className="w-3 h-3" />
                        <span className="text-[10px]">Scheduled campaigns</span>
                      </div>
                      <p className="text-[14px] font-semibold text-slate-900 mt-0.5">
                        {formatNumber(automation.scheduledCampaigns)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1 text-slate-500">
                        <AlertCircle className="w-3 h-3" />
                        <span className="text-[10px]">Needs attention</span>
                      </div>
                      <p className={`text-[14px] font-semibold mt-0.5 ${automation.campaignsNeedingAttention > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {formatNumber(automation.campaignsNeedingAttention)}
                      </p>
                    </div>
                  </div>

                  {automation.templateAlerts.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-slate-700 mb-1">
                        Template updates
                      </p>
                      <ul className="space-y-1">
                        {automation.templateAlerts.slice(0, 3).map((t) => (
                          <li
                            key={t.templateId}
                            className="flex items-center gap-1.5 text-[11px]"
                          >
                            <FileWarning
                              className={`w-3 h-3 shrink-0 ${t.status === 'rejected' ? 'text-rose-500' : t.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}
                            />
                            <span className="text-slate-700 truncate">{t.name}</span>
                            <span
                              className={`text-[10px] rounded px-1 shrink-0 ${t.status === 'rejected' ? 'bg-rose-50 text-rose-700' : t.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                            >
                              {t.status}
                            </span>
                            <span className="flex-1" />
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatRelative(t.at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Alerts & system health"
              action={
                <span className="text-[11px] text-slate-500">
                  {alerts.length} item{alerts.length === 1 ? '' : 's'}
                </span>
              }
            >
              {loading ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 bg-slate-50 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="py-4 text-center text-[12px] text-slate-500 inline-flex w-full items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Everything looks healthy.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {alerts.map((a) => {
                    const meta = SEVERITY_META[a.severity];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={a.id}
                        className={`flex items-start gap-2 rounded border px-2.5 py-2 ${meta.bg} ${meta.border}`}
                      >
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.text}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[12px] font-medium ${meta.text}`}>
                            {a.title}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {a.description}
                          </p>
                        </div>
                        <Link
                          href={a.resolveHref}
                          className="text-[11px] font-medium text-blue-950 hover:underline whitespace-nowrap shrink-0 inline-flex items-center gap-1"
                        >
                          {a.resolveLabel}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </>
        )}

        {!connected && !loading && connection && (
          <div className="bg-white border border-slate-200 rounded p-4 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900 mt-2">
              Overview is unavailable while disconnected
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5 max-w-md mx-auto">
              Metrics, conversations and commerce activity will appear once your
              WhatsApp Business Account is connected and verified.
            </p>
            <Link
              href="/whatsapp/analytics?tab=connection"
              className="inline-flex items-center gap-1.5 mt-2 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded text-[12px] transition"
            >
              <Settings className="w-3.5 h-3.5" />
              Open connection settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhatsAppOverviewPage;