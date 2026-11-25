'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Megaphone,
  Package,
  Percent,
  PieChart as PieIcon,
  PlugZap,
  Printer,
  RefreshCw,
  Search,
  Shield,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Unplug,
  UserRound,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';
import { adminApi } from '@/lib/admin-api';
import type {
  AdminDirectOrder,
  AdminDirectCreator,
  AdminPayoutBatch,
  AdminReturnRequest,
  AdminProduct,
  AdminFinanceSummaryResponse,
  AdminAnalyticsSummaryResponse,
  AdminIntegration,
  AdminNotificationSetting,
  AdminAuditLog,
} from '@/lib/admin-types';

const SECTIONS = [
  { id: 'overview', label: 'Finance' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'profit', label: 'Profit' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'ads', label: 'Ad spend' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'reports', label: 'Reports' },
  { id: 'connections', label: 'Connections' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'health', label: 'Health' },
  { id: 'notifications', label: 'Notifications' },
];

const CHANNEL_COLORS = ['#172554', '#10b981', '#ec4899', '#0284c7', '#f59e0b', '#6366f1', '#94a3b8'];

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  color: '#0f172a',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  padding: '6px 10px',
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'tiktok-business': Building2,
  'tiktok-ads': Megaphone,
  'tiktok-shop': ShoppingCart,
  'content-api': FileText,
  'display-api': Eye,
  pixel: Sparkles,
};

const NUM = (n: number | string | null | undefined): string => {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-KE');
};

const KES = (n: number | string | null | undefined): string => {
  if (n === null || n === undefined) return 'KES —';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return 'KES —';
  return `KES ${num.toLocaleString('en-KE')}`;
};

const pct = (n: number | string | null | undefined): string => {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '—';
  return `${num.toFixed(1)}%`;
};

const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  try {
    return new Date(ts).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  try {
    return new Date(ts).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

type NotifySettings = Record<string, boolean>;

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('bg-white border border-slate-200 rounded overflow-hidden', className)}>{children}</div>;
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 px-2.5 py-2 border-b border-slate-200">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900 truncate">{title}</p>
        {subtitle && <p className="text-[13px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2 hover:border-slate-300 transition-colors">
      <span className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-slate-100 text-slate-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p className="text-[15px] font-bold text-slate-900 truncate tabular-nums">{value}</p>
        {sub && (
          <p className={cn('text-[13px] truncate', positive === undefined ? 'text-slate-400' : positive ? 'text-emerald-600' : 'text-red-600')}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-2">
      <p className="text-[13px] text-slate-500 truncate">{label}</p>
      <p className="text-[15px] font-bold text-slate-900 truncate tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[13px] text-slate-400 truncate mt-0.5">{hint}</p>}
    </div>
  );
}

function StatusBadge({ label, variant }: { label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' }) {
  const styles =
    variant === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : variant === 'danger'
          ? 'bg-red-50 text-red-600 border-red-100'
          : variant === 'info'
            ? 'bg-blue-50 text-blue-700 border-blue-100'
            : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={cn('inline-block px-1.5 py-0.5 rounded border text-[13px] font-medium whitespace-nowrap', styles)}>{label}</span>;
}

function EmptyCard({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="py-8 text-center">
      <span className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">{icon}</span>
      <p className="mt-2 text-[13px] font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-[13px] text-slate-500 max-w-xs mx-auto">{description}</p>}
    </div>
  );
}

function InfoBanner({ variant = 'info', title, children }: { variant?: 'info' | 'warning' | 'danger'; title: string; children: React.ReactNode }) {
  const icon =
    variant === 'warning' ? (
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
    ) : variant === 'danger' ? (
      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
    ) : (
      <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
    );
  return (
    <Card>
      <div className="p-2 flex items-start gap-2">
        {icon}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">{title}</p>
          <div className="text-[13px] text-slate-600 mt-0.5">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/10',
        checked ? 'bg-blue-950' : 'bg-slate-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

const inputCls = 'w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900';
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm disabled:opacity-60';
const btnSecondary = 'inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm disabled:opacity-60';
const btnDanger = 'inline-flex items-center justify-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-2.5 py-1.5 text-[13px] rounded shadow-sm disabled:opacity-60';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function FinanceAnalyticsSettings() {
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string; variant: 'success' | 'error' | 'info' } | null>(null);

  const [orders, setOrders] = useState<AdminDirectOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [creators, setCreators] = useState<AdminDirectCreator[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutBatch[]>([]);
  const [returns, setReturns] = useState<AdminReturnRequest[]>([]);
  const [financeSummary, setFinanceSummary] = useState<AdminFinanceSummaryResponse | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AdminAnalyticsSummaryResponse | null>(null);
  const [connections, setConnections] = useState<AdminIntegration[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<AdminNotificationSetting[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAuditLog[]>([]);

  const [reconciliationQuery, setReconciliationQuery] = useState('');
  const [reconciliationStatus, setReconciliationStatus] = useState<'all' | 'verified' | 'unverified' | 'failed'>('all');
  const [analyticsTab, setAnalyticsTab] = useState<'sales' | 'customers' | 'products' | 'creators' | 'marketing' | 'fulfillment'>('sales');

  const [reportType, setReportType] = useState('finance');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

  const notifySettings: NotifySettings = useMemo(() => {
    const map: NotifySettings = {};
    notificationSettings.forEach((s) => {
      map[s.key] = s.enabled;
    });
    return map;
  }, [notificationSettings]);

  const showToast = useCallback((msg: string, variant: 'success' | 'error' | 'info' = 'success') => {
    setToast({ id: Date.now(), msg, variant });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      adminApi.directOrders.orders.list(),
      adminApi.products.list(),
      adminApi.directOrders.creators.list(),
      adminApi.directOrders.payouts.list(),
      adminApi.directOrders.returns.list(),
      adminApi.directOrders.finance.summary(),
      adminApi.directOrders.analytics.summary(),
      adminApi.directOrders.integrations.list(),
      adminApi.directOrders.notifications.settings.list(),
      adminApi.directOrders.audit.list({ limit: 20 }),
    ]);

    if (results[0].status === 'fulfilled') setOrders(results[0].value || []);
    if (results[1].status === 'fulfilled') setProducts(results[1].value || []);
    if (results[2].status === 'fulfilled') setCreators(results[2].value || []);
    if (results[3].status === 'fulfilled') setPayouts(results[3].value || []);
    if (results[4].status === 'fulfilled') setReturns(results[4].value || []);
    if (results[5].status === 'fulfilled') setFinanceSummary(results[5].value);
    if (results[6].status === 'fulfilled') setAnalyticsSummary(results[6].value);
    if (results[7].status === 'fulfilled') setConnections(results[7].value || []);
    if (results[8].status === 'fulfilled') setNotificationSettings(results[8].value || []);
    if (results[9].status === 'fulfilled') {
      const v = results[9].value;
      setAuditLog(Array.isArray(v) ? v : v?.results ?? []);
    }

    if (results.every((r) => r.status === 'rejected')) {
      const first = results[0] as PromiseRejectedResult;
      setError(first.reason instanceof Error ? first.reason.message : 'Failed to load finance data');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const finance = useMemo(() => {
    const grossRevenue = orders.reduce((a, o) => a + Number(o.total || 0), 0);
    const refunds = returns.reduce((a, r) => a + Number(r.refundAmount || 0), 0);
    const discountEstimate = orders.reduce((a, o) => a + Number(o.total || 0) * 0.05, 0);
    const netRevenue = Math.max(grossRevenue - refunds, 0);
    const cogsEstimate = products.reduce((a, p) => a + Number(p.sales_volume || 0) * 0.65, 0);
    const grossProfit = netRevenue - cogsEstimate;
    const adSpend = Number(financeSummary?.advertisingSpend ?? 0);
    const creatorCommissions = creators.reduce((a, c) => a + Number(c.commissionPaid || 0) + Number(c.commissionOwed || 0), 0);
    const operatingExpenses = adSpend + creatorCommissions;
    const netProfit = grossProfit - operatingExpenses;
    return {
      grossRevenue,
      refunds,
      discountEstimate,
      netRevenue,
      cogsEstimate,
      grossProfit,
      adSpend,
      creatorCommissions,
      operatingExpenses,
      netProfit,
      hasCostData: Boolean(financeSummary),
    };
  }, [orders, returns, products, creators, financeSummary]);

  const revenueTimeline = useMemo(() => {
    const days = 14;
    const out: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
      const dayOrders = orders.filter((o) => {
        const ts = Date.parse(o.createdAt);
        if (Number.isNaN(ts)) return false;
        return new Date(ts).toDateString() === d.toDateString();
      });
      const revenue = dayOrders.reduce((a, o) => a + Number(o.total || 0), 0);
      out.push({ date: label, revenue, orders: dayOrders.length });
    }
    return out;
  }, [orders]);

  const profitTimeline = useMemo(() => {
    return revenueTimeline.map((d) => {
      const estCost = d.revenue * 0.65;
      const estExpenses = d.revenue * 0.08;
      return {
        ...d,
        cost: Math.round(estCost),
        expenses: Math.round(estExpenses),
        profit: Math.round(d.revenue - estCost - estExpenses),
      };
    });
  }, [revenueTimeline]);

  const bySource = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const key = o.source || 'other';
      if (!map[key]) map[key] = { count: 0, revenue: 0 };
      map[key].count += 1;
      map[key].revenue += Number(o.total || 0);
    });
    const total = Object.values(map).reduce((a, v) => a + v.revenue, 0) || 1;
    return Object.entries(map).map(([source, v], i) => ({
      name: String(source).charAt(0).toUpperCase() + String(source).slice(1).replace(/_/g, ' '),
      revenue: v.revenue,
      orders: v.count,
      share: Math.round((v.revenue / total) * 100),
      color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    }));
  }, [orders]);

  const productRevenue = useMemo(() => {
    return [...products]
      .map((p) => ({
        name: p.name,
        sku: p.slug,
        sales: Number(p.sales_count || 0),
        revenue: Number(p.sales_volume || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [products]);

  const creatorRevenue = useMemo(() => {
    return [...creators]
      .map((c) => ({
        name: c.name,
        handle: c.handle,
        revenue: Number(c.revenue || 0),
        orders: Number(c.ordersCount || 0),
        commission: Number(c.commissionOwed || 0) + Number(c.commissionPaid || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [creators]);

  const reconciliation = useMemo(() => {
    const q = reconciliationQuery.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (!q) return true;
        return (
          String(o.reference || '').toLowerCase().includes(q) ||
          String(o.customerName || '').toLowerCase().includes(q) ||
          String(o.customerPhone || '').toLowerCase().includes(q) ||
          String(o.mpesaReference || '').toLowerCase().includes(q)
        );
      })
      .filter((o) => o.status === 'Paid' || o.status === 'Awaiting Payment' || o.status === 'Delivered' || o.status === 'Shipped')
      .filter((o) => {
        if (reconciliationStatus === 'all') return true;
        if (reconciliationStatus === 'verified') return o.status === 'Paid' || o.status === 'Delivered' || o.status === 'Shipped';
        if (reconciliationStatus === 'unverified') return o.status === 'Awaiting Payment';
        if (reconciliationStatus === 'failed') return false;
        return true;
      })
      .slice(0, 50);
  }, [orders, reconciliationQuery, reconciliationStatus]);

  // ✅ FIX: define commissionRows BEFORE commissionTotals uses it
  const commissionRows = useMemo(() => {
    return creators.map((c) => {
      const rate = Number(c.commissionRate || 0);
      const revenue = Number(c.revenue || 0);
      return {
        creatorId: c.id,
        name: c.name,
        handle: c.handle,
        rate,
        revenue,
        earned: (revenue * rate) / 100,
        paid: Number(c.commissionPaid || 0),
        owed: Number(c.commissionOwed || 0),
      };
    });
  }, [creators]);

  const commissionTotals = useMemo(() => {
    return commissionRows.reduce(
      (acc, r) => ({
        earned: acc.earned + r.earned,
        paid: acc.paid + r.paid,
        owed: acc.owed + r.owed,
        revenue: acc.revenue + r.revenue,
      }),
      { earned: 0, paid: 0, owed: 0, revenue: 0 },
    );
  }, [commissionRows]);

  const payoutStats = useMemo(() => {
    const map: Record<string, number> = { Pending: 0, Approved: 0, Processing: 0, Paid: 0, Failed: 0, Reversed: 0 };
    let total = 0;
    payouts.forEach((p) => {
      if (map[p.status] !== undefined) map[p.status] += 1;
      total += Number(p.amount || 0);
    });
    return { ...map, total };
  }, [payouts]);

  const productTop = useMemo(() => {
    return [...products]
      .sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.slug,
        image: p.images?.[0]?.url,
        sales: p.sales_count || 0,
        revenue: p.sales_volume || 0,
      }));
  }, [products]);

  const fulfillmentStats = useMemo(() => {
    const total = orders.length || 1;
    const delivered = orders.filter((o) => o.status === 'Delivered').length;
    const cancelled = orders.filter((o) => o.status === 'Cancelled').length;
    const returned = returns.length;
    const pending = orders.filter((o) => o.status === 'New' || o.status === 'Awaiting Payment').length;
    return {
      total,
      delivered,
      cancelled,
      returned,
      pending,
      deliveryRate: (delivered / total) * 100,
      cancellationRate: (cancelled / total) * 100,
      returnRate: (returned / total) * 100,
    };
  }, [orders, returns]);

  const exportReport = (type: string) => {
    const rows: Array<Array<string | number>> = [];
    if (type === 'finance') {
      rows.push(['Metric', 'Value']);
      rows.push(['Gross revenue', finance.grossRevenue]);
      rows.push(['Refunds', finance.refunds]);
      rows.push(['Discounts (est.)', finance.discountEstimate]);
      rows.push(['Net revenue', finance.netRevenue]);
      rows.push(['COGS (est.)', finance.cogsEstimate]);
      rows.push(['Gross profit', finance.grossProfit]);
      rows.push(['Ad spend', finance.adSpend]);
      rows.push(['Creator commissions', finance.creatorCommissions]);
      rows.push(['Operating expenses', finance.operatingExpenses]);
      rows.push(['Net profit', finance.netProfit]);
    } else if (type === 'orders') {
      rows.push(['Reference', 'Date', 'Customer', 'Total', 'Status', 'Source']);
      orders.forEach((o) => rows.push([o.reference, o.createdAt, o.customerName, o.total, o.status, o.source]));
    } else if (type === 'commissions') {
      rows.push(['Creator', 'Handle', 'Rate', 'Revenue', 'Earned', 'Paid', 'Owed']);
      commissionRows.forEach((c) => rows.push([c.name, c.handle, c.rate, c.revenue, c.earned, c.paid, c.owed]));
    } else if (type === 'payouts') {
      rows.push(['Reference', 'Creator', 'Amount', 'Method', 'Status', 'Created']);
      payouts.forEach((p) => rows.push([p.reference, p.creatorName || '—', p.amount, p.payoutMethod, p.status, p.createdAt]));
    } else if (type === 'products') {
      rows.push(['Product', 'SKU', 'Sales', 'Revenue']);
      products.forEach((p) => rows.push([p.name, p.slug, p.sales_count || 0, p.sales_volume || 0]));
    } else if (type === 'creators') {
      rows.push(['Creator', 'Handle', 'Revenue', 'Orders', 'Commission']);
      creatorRevenue.forEach((c) => rows.push([c.name, c.handle, c.revenue, c.orders, c.commission]));
    } else if (type === 'ads') {
      rows.push(['Campaign', 'Spend', 'Revenue', 'ROAS']);
      rows.push(['No campaign data available', 0, 0, 0]);
    } else if (type === 'customers') {
      rows.push(['Customer', 'Orders', 'Total Spent']);
      const custMap: Record<string, { orders: number; spent: number }> = {};
      orders.forEach((o) => {
        const key = o.customerName || 'Unknown';
        if (!custMap[key]) custMap[key] = { orders: 0, spent: 0 };
        custMap[key].orders += 1;
        custMap[key].spent += Number(o.total || 0);
      });
      Object.entries(custMap).forEach(([name, v]) => rows.push([name, v.orders, v.spent]));
    }
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${type} report exported`);
  };

  const printReport = () => {
    window.print();
    showToast('Print dialog opened');
  };

  const handleAction = async (key: string, action: 'connect' | 'disconnect' | 'reconnect' | 'test') => {
    try {
      const updated = await adminApi.directOrders.integrations.action(key, action);
      setConnections((prev) => prev.map((c) => (c.key === key ? updated : c)));
      showToast(`Integration ${action} succeeded`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Integration action failed', 'error');
    }
  };

  const updateNotify = async (key: string, value: boolean) => {
    try {
      const updated = await adminApi.directOrders.notifications.settings.update({ [key]: value });
      setNotificationSettings(updated);
      showToast('Notification setting updated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update setting', 'error');
    }
  };

  return (
    <div className="space-y-2">
      {toast && (
        <div className="fixed bottom-3 right-3 left-3 sm:left-auto z-[110] bg-slate-900 text-white px-2 py-2 rounded flex items-center gap-2 text-[13px]">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="flex-1">{toast.msg}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              Finance, Analytics &amp; Settings
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Full financial picture, integrations, and account controls.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button onClick={() => void load(true)} disabled={refreshing || loading} className={btnSecondary}>
              <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => exportReport('finance')} className={btnPrimary}>
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        </div>

        <div className="px-2.5 pb-2 overflow-x-auto">
          <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'px-2.5 py-1.5 rounded text-[13px] font-medium whitespace-nowrap transition-colors',
                  section === s.id ? 'bg-white text-blue-950' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && (
        <InfoBanner variant="danger" title="Couldn't load finance data">
          {error}
        </InfoBanner>
      )}

      {loading ? (
        <Card>
          <div className="p-4 flex items-center gap-2 text-[13px] text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading finance…
          </div>
        </Card>
      ) : (
        <>
          {section === 'overview' && (
            <>
              {!finance.hasCostData && (
                <InfoBanner variant="warning" title="Some costs are estimated">
                  COGS and discounts are estimated at 65% and 5% respectively until product cost fields are populated.
                </InfoBanner>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <Kpi icon={<Banknote className="w-3.5 h-3.5" />} label="Gross revenue" value={KES(finance.grossRevenue)} />
                <Kpi icon={<TrendingDown className="w-3.5 h-3.5" />} label="Refunds" value={KES(finance.refunds)} />
                <Kpi icon={<TrendingUp className="w-3.5 h-3.5" />} label="Net revenue" value={KES(finance.netRevenue)} />
                <Kpi icon={<PieIcon className="w-3.5 h-3.5" />} label="Gross profit" value={KES(finance.grossProfit)} />
                <Kpi icon={<Wallet className="w-3.5 h-3.5" />} label="Ad spend" value={KES(finance.adSpend)} />
                <Kpi icon={<UserRound className="w-3.5 h-3.5" />} label="Creator commissions" value={KES(finance.creatorCommissions)} />
                <Kpi icon={<TrendingDown className="w-3.5 h-3.5" />} label="Operating expenses" value={KES(finance.operatingExpenses)} />
                <Kpi icon={<BarChart3 className="w-3.5 h-3.5" />} label="Net profit" value={KES(finance.netProfit)} positive={finance.netProfit >= 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <Card className="lg:col-span-2">
                  <CardHeader title="Revenue trend" subtitle="Last 14 days" />
                  <div className="h-60 w-full p-2">
                    {revenueTimeline.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueTimeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                          <YAxis stroke="#172554" fontSize={13} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Line type="monotone" dataKey="revenue" stroke="#172554" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Revenue by source" subtitle="Order attribution" />
                  <div className="p-2 space-y-1">
                    {bySource.length === 0 ? (
                      <EmptyCard icon={<ShoppingCart className="w-4 h-4" />} title="No orders yet" description="Revenue sources will appear here." />
                    ) : (
                      bySource.map((s) => (
                        <div key={s.name} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="font-medium text-slate-800 truncate">{s.name}</span>
                            <span className="font-mono text-slate-600 shrink-0">{KES(s.revenue)}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${s.share}%`, backgroundColor: s.color }} />
                          </div>
                          <div className="flex items-center justify-between text-[13px] text-slate-500">
                            <span>{s.orders} orders</span>
                            <span>{s.share}%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Recent transactions" subtitle="Latest orders" />
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                        <th className="py-2 px-2 font-medium">Reference</th>
                        <th className="py-2 px-2 font-medium">Customer</th>
                        <th className="py-2 px-2 font-medium text-right">Amount</th>
                        <th className="py-2 px-2 font-medium">Status</th>
                        <th className="py-2 px-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 10).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 text-[13px]">
                            No transactions yet.
                          </td>
                        </tr>
                      ) : (
                        orders.slice(0, 10).map((o) => (
                          <tr key={o.reference} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-mono font-medium text-slate-900">{o.reference}</td>
                            <td className="py-2 px-2 text-slate-700 truncate max-w-[160px]">{o.customerName}</td>
                            <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">{KES(o.total)}</td>
                            <td className="py-2 px-2">
                              <StatusBadge
                                label={o.status}
                                variant={o.status === 'Delivered' ? 'success' : o.status === 'Cancelled' ? 'danger' : 'info'}
                              />
                            </td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {section === 'revenue' && (
            <>
              <Card>
                <CardHeader title="Revenue reports" subtitle="Breakdown by source" />
                <div className="p-2 space-y-2">
                  <div className="h-64 w-full">
                    {revenueTimeline.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[13px] text-slate-400">No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueTimeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                          <YAxis stroke="#172554" fontSize={13} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="revenue" fill="#172554" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                        <th className="py-2 px-2 font-medium">Source</th>
                        <th className="py-2 px-2 font-medium text-right">Orders</th>
                        <th className="py-2 px-2 font-medium text-right">Revenue</th>
                        <th className="py-2 px-2 font-medium text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bySource.map((s) => (
                        <tr key={s.name} className="hover:bg-slate-50">
                          <td className="py-2 px-2 text-slate-700">{s.name}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{s.orders}</td>
                          <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">{KES(s.revenue)}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{s.share}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <Card>
                  <CardHeader title="Revenue by product" subtitle="Top products" />
                  <div className="p-2">
                    {productRevenue.length === 0 ? (
                      <EmptyCard icon={<Package className="w-4 h-4" />} title="No product data" description="Product revenue will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {productRevenue.map((p) => {
                          const max = productRevenue[0]?.revenue || 1;
                          return (
                            <div key={p.sku} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[13px]">
                                <span className="font-medium text-slate-800 truncate">{p.name}</span>
                                <span className="font-mono text-slate-600 shrink-0">{KES(p.revenue)}</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                                <div className="h-full rounded bg-blue-950" style={{ width: `${(p.revenue / max) * 100}%` }} />
                              </div>
                              <div className="text-[13px] text-slate-500">{p.sales} sales</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Revenue by creator" subtitle="Top creators" />
                  <div className="p-2">
                    {creatorRevenue.length === 0 ? (
                      <EmptyCard icon={<Users className="w-4 h-4" />} title="No creator data" description="Creator revenue will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {creatorRevenue.map((c) => {
                          const max = creatorRevenue[0]?.revenue || 1;
                          return (
                            <div key={c.handle} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[13px]">
                                <span className="font-medium text-slate-800 truncate">
                                  {c.name} <span className="text-slate-400">@{c.handle}</span>
                                </span>
                                <span className="font-mono text-slate-600 shrink-0">{KES(c.revenue)}</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                                <div className="h-full rounded bg-emerald-500" style={{ width: `${(c.revenue / max) * 100}%` }} />
                              </div>
                              <div className="flex justify-between text-[13px] text-slate-500">
                                <span>{c.orders} orders</span>
                                <span>Commission: {KES(c.commission)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {section === 'profit' && (
            <>
              {!finance.hasCostData && (
                <InfoBanner variant="warning" title="Profit is estimated">
                  COGS is estimated at 65% of revenue. Add actual product costs for accurate profit analysis.
                </InfoBanner>
              )}
              <Card>
                <CardHeader title="Profit analysis" subtitle="Revenue minus costs and expenses" />
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <MiniStat label="Gross sales" value={KES(finance.grossRevenue)} />
                    <MiniStat label="Refunds" value={KES(finance.refunds)} />
                    <MiniStat label="Net sales" value={KES(finance.netRevenue)} />
                    <MiniStat label="Discounts (est.)" value={KES(finance.discountEstimate)} hint="Estimated at 5%" />
                    <MiniStat label="Cost of goods (est.)" value={KES(finance.cogsEstimate)} hint="Estimated at 65%" />
                    <MiniStat label="Gross profit" value={KES(finance.grossProfit)} />
                    <MiniStat label="Ad spend" value={KES(finance.adSpend)} />
                    <MiniStat label="Creator commissions" value={KES(finance.creatorCommissions)} />
                    <MiniStat label="Operating expenses" value={KES(finance.operatingExpenses)} />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-slate-700">Net profit</span>
                      <span className={cn('text-[15px] font-bold tabular-nums', finance.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {KES(finance.netProfit)}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-500 mt-1">
                      {finance.netProfit >= 0 ? 'Profitable' : 'Loss'} — gross profit minus operating expenses.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Profit trend" subtitle="Estimated last 14 days" />
                <div className="h-64 w-full p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={profitTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                      <YAxis stroke="#172554" fontSize={13} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      <Bar dataKey="revenue" fill="#172554" radius={[2, 2, 0, 0]} name="Revenue" />
                      <Bar dataKey="cost" fill="#94a3b8" radius={[2, 2, 0, 0]} name="Cost" />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}

          {section === 'reconciliation' && (
            <>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 border-b border-slate-200">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900">Payment reconciliation</p>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      {reconciliation.length} transaction{reconciliation.length === 1 ? '' : 's'} · M-Pesa, Bank, Card, Cash
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200">
                      {(['all', 'verified', 'unverified', 'failed'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setReconciliationStatus(f)}
                          className={cn(
                            'px-2 py-1 rounded text-[13px] font-medium capitalize transition-colors',
                            reconciliationStatus === f ? 'bg-white text-blue-950' : 'text-slate-600 hover:text-slate-900',
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        value={reconciliationQuery}
                        onChange={(e) => setReconciliationQuery(e.target.value)}
                        placeholder="Search…"
                        className={cn(inputCls, 'w-56 pl-7')}
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                        <th className="py-2 px-2 font-medium">Reference</th>
                        <th className="py-2 px-2 font-medium">Customer</th>
                        <th className="py-2 px-2 font-medium text-right">Amount</th>
                        <th className="py-2 px-2 font-medium">Method</th>
                        <th className="py-2 px-2 font-medium">Status</th>
                        <th className="py-2 px-2 font-medium">Reconciliation</th>
                        <th className="py-2 px-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reconciliation.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 text-[13px]">
                            No transactions to reconcile.
                          </td>
                        </tr>
                      ) : (
                        reconciliation.map((o) => {
                          const verified = o.status === 'Paid' || o.status === 'Delivered' || o.status === 'Shipped';
                          return (
                            <tr key={o.reference} className="hover:bg-slate-50">
                              <td className="py-2 px-2 font-mono font-medium text-slate-900">{o.reference}</td>
                              <td className="py-2 px-2 text-slate-700 truncate max-w-[160px]">{o.customerName}</td>
                              <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">{KES(o.total)}</td>
                              <td className="py-2 px-2 text-slate-600">{o.paymentMethod || 'M-Pesa'}</td>
                              <td className="py-2 px-2">
                                <StatusBadge label={o.status} variant={verified ? 'success' : 'warning'} />
                              </td>
                              <td className="py-2 px-2">
                                <StatusBadge label={verified ? 'Verified' : 'Unverified'} variant={verified ? 'success' : 'warning'} />
                              </td>
                              <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {section === 'ads' && (
            <>
              <InfoBanner variant="info" title="TikTok Ads not connected">
                Connect a TikTok Ads account to track spend, impressions, and ROAS here.
              </InfoBanner>
              <Card>
                <CardHeader title="Advertising expenses" subtitle="Paid TikTok advertising spend" />
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MiniStat label="Total spend" value={KES(finance.adSpend)} />
                    <MiniStat label="Attributed revenue" value="KES —" />
                    <MiniStat label="ROAS" value="—" />
                    <MiniStat label="Avg. CPA" value="—" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-6 text-center">
                    <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-[13px] font-semibold text-slate-900 mt-2">No advertising data</p>
                    <p className="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Once a TikTok Ads account is connected, campaign spend, ROAS, and CPA will appear here.
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {section === 'commissions' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi icon={<Percent className="w-3.5 h-3.5" />} label="Total earned" value={KES(commissionTotals.earned)} />
                <Kpi icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Paid" value={KES(commissionTotals.paid)} />
                <Kpi icon={<Clock className="w-3.5 h-3.5" />} label="Outstanding" value={KES(commissionTotals.owed)} />
                <Kpi icon={<Banknote className="w-3.5 h-3.5" />} label="Creator revenue" value={KES(commissionTotals.revenue)} />
              </div>

              <Card>
                <CardHeader
                  title="Creator commissions"
                  subtitle={`${commissionRows.length} creator${commissionRows.length === 1 ? '' : 's'}`}
                  action={
                    <button onClick={() => exportReport('commissions')} className={btnSecondary}>
                      <Download className="w-3 h-3" /> Export
                    </button>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                        <th className="py-2 px-2 font-medium">Creator</th>
                        <th className="py-2 px-2 font-medium text-right">Rate</th>
                        <th className="py-2 px-2 font-medium text-right">Revenue</th>
                        <th className="py-2 px-2 font-medium text-right">Earned</th>
                        <th className="py-2 px-2 font-medium text-right">Paid</th>
                        <th className="py-2 px-2 font-medium text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {commissionRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">
                            No creator commissions yet.
                          </td>
                        </tr>
                      ) : (
                        commissionRows.map((c) => (
                          <tr key={c.creatorId} className="hover:bg-slate-50">
                            <td className="py-2 px-2 text-slate-700">
                              <span className="font-medium text-slate-900">{c.name}</span>{' '}
                              <span className="text-slate-400">@{c.handle}</span>
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">{c.rate}%</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-600">{KES(c.revenue)}</td>
                            <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">{KES(c.earned)}</td>
                            <td className="py-2 px-2 text-right font-mono text-emerald-600">{KES(c.paid)}</td>
                            <td className="py-2 px-2 text-right font-mono text-amber-600">{KES(c.owed)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {section === 'payouts' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(['Pending', 'Approved', 'Processing', 'Paid', 'Failed', 'Reversed'] as const).map((s) => (
                  <div key={s} className="bg-white border border-slate-200 rounded p-2">
                    <p className="text-[13px] text-slate-500 truncate">{s}</p>
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums mt-0.5">{payoutStats[s] ?? 0}</p>
                  </div>
                ))}
              </div>

              <Card>
                <CardHeader
                  title="Payout records"
                  subtitle={`${payouts.length} payout${payouts.length === 1 ? '' : 's'} · Total ${KES(payoutStats.total)}`}
                  action={
                    <button onClick={() => exportReport('payouts')} className={btnSecondary}>
                      <Download className="w-3 h-3" /> Export
                    </button>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                        <th className="py-2 px-2 font-medium">Reference</th>
                        <th className="py-2 px-2 font-medium">Creator</th>
                        <th className="py-2 px-2 font-medium text-right">Amount</th>
                        <th className="py-2 px-2 font-medium">Method</th>
                        <th className="py-2 px-2 font-medium">Status</th>
                        <th className="py-2 px-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 text-[13px]">
                            No payouts recorded yet.
                          </td>
                        </tr>
                      ) : (
                        payouts.map((p) => (
                          <tr key={p.reference} className="hover:bg-slate-50">
                            <td className="py-2 px-2 font-mono font-medium text-slate-900">{p.reference}</td>
                            <td className="py-2 px-2 text-slate-700 truncate max-w-[160px]">{p.creatorName || '—'}</td>
                            <td className="py-2 px-2 text-right font-mono font-medium text-slate-900">{KES(p.amount)}</td>
                            <td className="py-2 px-2 text-slate-600">{p.payoutMethod || '—'}</td>
                            <td className="py-2 px-2">
                              <StatusBadge
                                label={p.status}
                                variant={
                                  p.status === 'Paid' || p.status === 'Approved'
                                    ? 'success'
                                    : p.status === 'Failed' || p.status === 'Reversed'
                                      ? 'danger'
                                      : 'warning'
                                }
                              />
                            </td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {section === 'analytics' && (
            <>
              <Card>
                <div className="px-2.5 pt-2">
                  <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200 flex-wrap">
                    {[
                      { id: 'sales', label: 'Sales', icon: TrendingUp },
                      { id: 'customers', label: 'Customers', icon: Users },
                      { id: 'products', label: 'Products', icon: Package },
                      { id: 'creators', label: 'Creators', icon: UserRound },
                      { id: 'marketing', label: 'Marketing', icon: Megaphone },
                      { id: 'fulfillment', label: 'Fulfillment', icon: Truck },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setAnalyticsTab(t.id as typeof analyticsTab)}
                        className={cn(
                          'px-2.5 py-1.5 rounded text-[13px] font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1',
                          analyticsTab === t.id ? 'bg-white text-blue-950' : 'text-slate-600 hover:text-slate-900',
                        )}
                      >
                        <t.icon className="w-3 h-3" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2">
                  {analyticsTab === 'sales' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Total revenue" value={KES(finance.grossRevenue)} />
                        <MiniStat label="Orders" value={NUM(orders.length)} />
                        <MiniStat label="Avg. order value" value={KES(orders.length ? finance.grossRevenue / orders.length : 0)} />
                        <MiniStat label="Conversion rate" value={pct(analyticsSummary?.conversionRate ?? 0)} hint="All channels" />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <div className="bg-white border border-slate-200 rounded p-2">
                          <p className="text-[13px] font-semibold text-slate-900 mb-2">Revenue trend</p>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={revenueTimeline}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={13} />
                                <YAxis stroke="#172554" fontSize={13} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Area type="monotone" dataKey="revenue" stroke="#172554" fill="#dbeafe" strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-2">
                          <p className="text-[13px] font-semibold text-slate-900 mb-2">Sales by source</p>
                          <div className="space-y-2">
                            {bySource.map((s) => (
                              <div key={s.name} className="space-y-1">
                                <div className="flex justify-between text-[13px]">
                                  <span className="font-medium text-slate-800">{s.name}</span>
                                  <span className="font-mono text-slate-600">{KES(s.revenue)}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                                  <div className="h-full rounded" style={{ width: `${s.share}%`, backgroundColor: s.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {analyticsTab === 'customers' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Total customers" value={NUM(new Set(orders.map((o) => o.customerName)).size)} />
                        <MiniStat
                          label="New customers"
                          value={NUM(
                            new Set(
                              orders
                                .filter((o) => o.customerName && Date.parse(o.createdAt) > Date.now() - 1000 * 60 * 60 * 24 * 30)
                                .map((o) => o.customerName),
                            ).size,
                          )}
                          hint="Last 30 days"
                        />
                        <MiniStat
                          label="Returning"
                          value={NUM(
                            new Set(orders.map((o) => o.customerName)).size -
                            new Set(
                              orders
                                .filter((o) => Date.parse(o.createdAt) > Date.now() - 1000 * 60 * 60 * 24 * 30)
                                .map((o) => o.customerName),
                            ).size,
                          )}
                        />
                        <MiniStat
                          label="Avg. spend"
                          value={KES(
                            orders.length ? finance.grossRevenue / new Set(orders.map((o) => o.customerName)).size : 0,
                          )}
                        />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded p-3">
                        <p className="text-[13px] text-slate-500">
                          Customer analytics is based on order history. Return customers show up once repeat purchases are made.
                        </p>
                      </div>
                    </div>
                  )}

                  {analyticsTab === 'products' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Total products" value={NUM(products.length)} />
                        <MiniStat label="Best seller" value={productTop[0]?.name || '—'} />
                        <MiniStat label="Top revenue" value={KES(productTop[0]?.revenue || 0)} />
                        <MiniStat label="Avg. product revenue" value={KES(products.length ? finance.grossRevenue / products.length : 0)} />
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <p className="text-[13px] font-semibold text-slate-900 mb-2">Top products by revenue</p>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productRevenue.slice(0, 6)} layout="vertical" margin={{ left: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis type="number" stroke="#94a3b8" fontSize={13} />
                              <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={13} width={120} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                              <Bar dataKey="revenue" fill="#172554" radius={[0, 2, 2, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {analyticsTab === 'creators' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Active creators" value={NUM(creators.length)} />
                        <MiniStat label="Creator revenue" value={KES(commissionTotals.revenue)} />
                        <MiniStat label="Commission cost" value={KES(commissionTotals.earned)} />
                        <MiniStat
                          label="Avg. commission rate"
                          value={pct(
                            creators.length ? (commissionTotals.earned / (commissionTotals.revenue || 1)) * 100 : 0,
                          )}
                        />
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <p className="text-[13px] font-semibold text-slate-900 mb-2">Creator revenue comparison</p>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={creatorRevenue.slice(0, 6)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="handle" stroke="#94a3b8" fontSize={13} />
                              <YAxis stroke="#172554" fontSize={13} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                              <Bar dataKey="revenue" fill="#10b981" radius={[2, 2, 0, 0]} name="Revenue" />
                              <Bar dataKey="commission" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Commission" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {analyticsTab === 'marketing' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Ad spend" value={KES(finance.adSpend)} />
                        <MiniStat label="Attributed revenue" value="KES —" hint="Connect TikTok Ads" />
                        <MiniStat label="ROAS" value="—" />
                        <MiniStat label="CPA" value="—" />
                      </div>
                      <InfoBanner variant="info" title="Connect TikTok Ads">
                        Marketing analytics requires a connected TikTok Ads account to display spend, clicks, conversions, and ROAS.
                      </InfoBanner>
                    </div>
                  )}

                  {analyticsTab === 'fulfillment' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Total orders" value={NUM(fulfillmentStats.total)} />
                        <MiniStat label="Delivered" value={NUM(fulfillmentStats.delivered)} hint={pct(fulfillmentStats.deliveryRate)} />
                        <MiniStat label="Cancellation rate" value={pct(fulfillmentStats.cancellationRate)} />
                        <MiniStat label="Return rate" value={pct(fulfillmentStats.returnRate)} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <MiniStat label="Pending / processing" value={NUM(fulfillmentStats.pending)} />
                        <MiniStat label="Failed deliveries" value={NUM(0)} hint="Connect fulfillment data" />
                        <MiniStat label="Avg. processing time" value="—" hint="Connect fulfillment data" />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {section === 'reports' && (
            <>
              <Card>
                <CardHeader title="Report exports" subtitle="Generate CSV reports" />
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field label="Report type">
                      <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputCls}>
                        <option value="finance">Financial report</option>
                        <option value="orders">Sales / orders report</option>
                        <option value="customers">Customer report</option>
                        <option value="products">Product report</option>
                        <option value="creators">Creator report</option>
                        <option value="commissions">Commission report</option>
                        <option value="ads">Advertising report</option>
                        <option value="payouts">Payout report</option>
                      </select>
                    </Field>
                    <Field label="From">
                      <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="To">
                      <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => exportReport(reportType)} className={btnPrimary}>
                      <FileSpreadsheet className="w-3 h-3" /> Export CSV
                    </button>
                    <button onClick={printReport} className={btnSecondary}>
                      <Printer className="w-3 h-3" /> Print
                    </button>
                    <button onClick={() => exportReport('finance')} className={btnSecondary}>
                      <FileDown className="w-3 h-3" /> Quick finance export
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-500">
                    PDF export is available via the browser print dialog. CSV exports include all rows for the selected report type.
                  </p>
                </div>
              </Card>

              <Card>
                <CardHeader title="Quick exports" subtitle="One-click downloads" />
                <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {[
                    { type: 'finance', label: 'Finance', icon: Wallet },
                    { type: 'orders', label: 'Orders', icon: ShoppingCart },
                    { type: 'customers', label: 'Customers', icon: Users },
                    { type: 'products', label: 'Products', icon: Package },
                    { type: 'creators', label: 'Creators', icon: UserRound },
                    { type: 'commissions', label: 'Commissions', icon: Percent },
                    { type: 'payouts', label: 'Payouts', icon: Banknote },
                    { type: 'ads', label: 'Ads', icon: Megaphone },
                  ].map((r) => (
                    <button
                      key={r.type}
                      onClick={() => exportReport(r.type)}
                      className="flex items-center gap-2 px-2.5 py-2 bg-white border border-slate-200 rounded hover:bg-slate-50 text-left"
                    >
                      <r.icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-[13px] font-medium text-slate-800 truncate">{r.label}</span>
                      <Download className="w-3 h-3 text-slate-400 ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )}

          {section === 'connections' && (
            <>
              <InfoBanner variant="info" title="Secure OAuth integrations">
                Credentials are handled on the backend. Never expose access tokens or secrets in the frontend.
              </InfoBanner>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {connections.length === 0 ? (
                  <Card>
                    <EmptyCard icon={<Link2 className="w-5 h-5" />} title="No integrations configured" description="Add integrations to see them here." />
                  </Card>
                ) : (
                  connections.map((c) => {
                    const Icon = ICON_MAP[c.key] || Link2;
                    const isConnected = c.status === 'connected';
                    const isError = c.status === 'error' || c.status === 'expired';
                    return (
                      <Card key={c.id}>
                        <div className="p-2.5 flex items-start gap-2">
                          <span className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-slate-100 text-slate-700">
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-slate-900 truncate">{c.name}</p>
                                <p className="text-[13px] text-slate-500 mt-0.5">{c.description}</p>
                              </div>
                              <StatusBadge
                                label={isConnected ? 'Connected' : isError ? 'Error' : 'Disconnected'}
                                variant={isConnected ? 'success' : isError ? 'danger' : 'default'}
                              />
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[13px]">
                              <span className="text-slate-500">Account</span>
                              <span className="text-slate-800 font-medium truncate">{c.account || '—'}</span>
                              <span className="text-slate-500">Permissions</span>
                              <span className="text-slate-800 font-medium truncate">{c.permissions || '—'}</span>
                              <span className="text-slate-500">Last sync</span>
                              <span className="text-slate-800 font-medium">{c.lastSync ? formatDateTime(c.lastSync) : '—'}</span>
                            </div>
                            {c.error && (
                              <div className="mt-2 flex items-start gap-1.5 bg-red-50 border border-red-100 rounded p-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-[13px] text-red-700">{c.error}</p>
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {isConnected ? (
                                <>
                                  <button onClick={() => void handleAction(c.key, 'test')} className={btnSecondary}>
                                    <Zap className="w-3 h-3" /> Test
                                  </button>
                                  <button onClick={() => void handleAction(c.key, 'reconnect')} className={btnSecondary}>
                                    <RefreshCw className="w-3 h-3" /> Refresh
                                  </button>
                                  <button onClick={() => void handleAction(c.key, 'disconnect')} className={btnDanger}>
                                    <Unplug className="w-3 h-3" /> Disconnect
                                  </button>
                                </>
                              ) : isError ? (
                                <>
                                  <button onClick={() => void handleAction(c.key, 'reconnect')} className={btnPrimary}>
                                    <PlugZap className="w-3 h-3" /> Reconnect
                                  </button>
                                  <button onClick={() => void handleAction(c.key, 'disconnect')} className={btnDanger}>
                                    <Unplug className="w-3 h-3" /> Disconnect
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => void handleAction(c.key, 'connect')} className={btnPrimary}>
                                  <Link2 className="w-3 h-3" /> Connect
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}

          {section === 'permissions' && (
            <>
              <Card>
                <CardHeader title="Permissions & security" subtitle="Admin access controls" />
                <div className="p-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { label: 'View financial data', desc: 'Access revenue, profit, and financial reports' },
                      { label: 'Manage payments', desc: 'Verify and reconcile payment transactions' },
                      { label: 'Approve commissions', desc: 'Approve or adjust creator commission records' },
                      { label: 'Record payouts', desc: 'Create and confirm creator payout records' },
                      { label: 'Manage integrations', desc: 'Connect, disconnect, and configure TikTok integrations' },
                      { label: 'View customer information', desc: 'Access customer names, orders, and contact details' },
                      { label: 'Export reports', desc: 'Download CSV and PDF financial reports' },
                      { label: 'Change settings', desc: 'Modify notification and account preferences' },
                    ].map((p) => (
                      <div key={p.label} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded p-2">
                        <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-900">{p.label}</p>
                          <p className="text-[13px] text-slate-500 mt-0.5">{p.desc}</p>
                        </div>
                        <StatusBadge label="Admin" variant="info" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Staff activity log" subtitle="Recent actions and security events" />
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[13px] uppercase">
                        <th className="py-2 px-2 font-medium">Action</th>
                        <th className="py-2 px-2 font-medium">Actor</th>
                        <th className="py-2 px-2 font-medium">Type</th>
                        <th className="py-2 px-2 font-medium">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLog.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 text-[13px]">
                            No activity logged yet.
                          </td>
                        </tr>
                      ) : (
                        auditLog.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="py-2 px-2 text-slate-800">{a.summary || a.action}</td>
                            <td className="py-2 px-2 text-slate-600">{a.actorName || '—'}</td>
                            <td className="py-2 px-2">
                              <StatusBadge
                                label={a.action}
                                variant={
                                  a.action === 'security' ? 'danger' : a.action === 'payout' ? 'success' : a.action === 'status_change' ? 'info' : 'default'
                                }
                              />
                            </td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {section === 'health' && (
            <>
              <InfoBanner variant="info" title="Account health">
                Health information is based on platform-reported data where available. Do not invent violations or scores.
              </InfoBanner>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {connections.length === 0 ? (
                  <Card>
                    <EmptyCard icon={<Link2 className="w-5 h-5" />} title="No integrations" description="Health data will show once integrations exist." />
                  </Card>
                ) : (
                  connections.map((c) => {
                    const isConnected = c.status === 'connected';
                    const isError = c.status === 'error' || c.status === 'expired';
                    return (
                      <Card key={c.id}>
                        <div className="p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-slate-900 truncate">{c.name}</span>
                            <StatusBadge
                              label={isConnected ? 'Healthy' : isError ? 'Issue' : 'Offline'}
                              variant={isConnected ? 'success' : isError ? 'danger' : 'default'}
                            />
                          </div>
                          <div className="mt-1.5 space-y-1 text-[13px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Authorization</span>
                              <span className={isConnected ? 'text-emerald-600' : isError ? 'text-red-600' : 'text-slate-400'}>
                                {isConnected ? 'Active' : isError ? 'Expired' : 'Not connected'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Last sync</span>
                              <span className="text-slate-700">{c.lastSync ? formatDate(c.lastSync) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Sync failures</span>
                              <span className={isError ? 'text-red-600 font-medium' : 'text-slate-700'}>{isError ? '1' : '0'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Warnings</span>
                              <span className="text-slate-700">{c.error ? '1' : '0'}</span>
                            </div>
                          </div>
                          {c.error && (
                            <p className="mt-1.5 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded p-1.5">{c.error}</p>
                          )}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}

          {section === 'notifications' && (
            <>
              <Card>
                <CardHeader title="Notification settings" subtitle="Configure alerts for key events" />
                <div className="p-2 space-y-1">
                  {notificationSettings.length === 0 ? (
                    <EmptyCard icon={<AlertCircle className="w-5 h-5" />} title="No settings" description="Notification settings will appear here." />
                  ) : (
                    notificationSettings.map((n) => (
                      <div key={n.key} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-900">{n.label}</p>
                          <p className="text-[13px] text-slate-500 mt-0.5">{n.description}</p>
                        </div>
                        <Toggle checked={notifySettings[n.key] ?? n.enabled} onChange={(v) => void updateNotify(n.key, v)} />
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <InfoBanner variant="info" title="Notification delivery">
                Notifications use the existing notification infrastructure and are delivered to admins with the appropriate permissions.
              </InfoBanner>
            </>
          )}
        </>
      )}
    </div>
  );
}