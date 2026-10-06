'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Plus, CheckCircle2, X, Send, Download, Users, TrendingUp, UserPlus,
  UserX, Percent, Search, Trash2, Eye, ChevronDown, Check, Mail, List,
  Tag, FileText, BarChart3, Layers, Edit3, Play, Pause, AlertTriangle,
  Upload, Loader2, RefreshCw, Image as ImageIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminSubscriber, AdminSubscriberStats, AdminSubscriberList,
  AdminSubscriberListWrite, AdminSegment, AdminEmailTemplate,
  AdminEmailTemplateWrite, AdminTemplateCategory, AdminCampaign,
  AdminCampaignWrite, AdminCampaignRecipient, AdminAudienceType,
  AdminGrowthPoint, AdminCampaignPerformance, AdminAnalyticsSummary,
} from '@/lib/admin-types';

// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'subscribers' | 'lists' | 'segments' | 'templates' | 'campaigns' | 'analytics';
type StatusFilter = 'Subscribed' | 'Unsubscribed';

const SOURCE_OPTIONS = ['Footer Popup', 'Checkout', 'WhatsApp Opt-in', 'Manual Import'];
const STATUS_OPTIONS: StatusFilter[] = ['Subscribed', 'Unsubscribed'];
const TEMPLATE_CATEGORIES: AdminTemplateCategory[] = [
  'Welcome', 'Promotional', 'Transactional', 'Re-engagement',
];
const LIST_COLOR_PRESETS = [
  { label: 'Blue', value: 'bg-blue-50 text-blue-950 border-blue-100' },
  { label: 'Emerald', value: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { label: 'Amber', value: 'bg-amber-50 text-amber-700 border-amber-100' },
  { label: 'Indigo', value: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { label: 'Rose', value: 'bg-rose-50 text-rose-700 border-rose-100' },
  { label: 'Slate', value: 'bg-slate-100 text-slate-600 border-slate-200' },
];
const DEFAULT_LIST_COLOR = 'bg-blue-50 text-blue-950 border-blue-100';

// ─────────────────────────────────────────────────────────────────────────────
function isAbort(e: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      e instanceof DOMException &&
      e.name === 'AbortError') ||
    (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError')
  );
}
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const anyE = e as Record<string, unknown>;
    if (typeof anyE.detail === 'string') return anyE.detail;
    if (typeof anyE.message === 'string') return anyE.message;
  }
  return 'Something went wrong. Please try again.';
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-KE', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-KE', { month: 'short', day: '2-digit', year: 'numeric' });
}
function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function safeColor(color?: string | null): string {
  if (color && /(bg|text|border)-/.test(color)) return color;
  return DEFAULT_LIST_COLOR;
}
function pct(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `${n}%`;
}

/** Normalize API responses that may be [] | { results: [] } | { data: [] } */
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.results)) return v.results as T[];
    if (Array.isArray(v.data)) return v.data as T[];
  }
  return [];
}

interface AudienceChoice {
  key: string;
  type: AdminAudienceType;
  id: string;
  label: string;
  count: number;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function NewsletterPage() {
  const [activeTab, setActiveTab] = useState<Tab>('subscribers');

  const [subscribers, setSubscribers] = useState<AdminSubscriber[]>([]);
  const [stats, setStats] = useState<AdminSubscriberStats | null>(null);
  const [lists, setLists] = useState<AdminSubscriberList[]>([]);
  const [segments, setSegments] = useState<AdminSegment[]>([]);
  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [growth, setGrowth] = useState<AdminGrowthPoint[]>([]);
  const [perf, setPerf] = useState<AdminCampaignPerformance[]>([]);
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);

  const [loadingSubs, setLoadingSubs] = useState(true);
  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toast = useCallback((m: string) => setToastMessage(m), []);
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const [subscriberModal, setSubscriberModal] = useState<
    { open: false } | { open: true; initial: AdminSubscriber | null }
  >({ open: false });
  const [listModal, setListModal] = useState<
    { open: false } | { open: true; initial: AdminSubscriberList | null }
  >({ open: false });
  const [templateModal, setTemplateModal] = useState<
    { open: false } | { open: true; initial: AdminEmailTemplate | null }
  >({ open: false });
  const [templatePreview, setTemplatePreview] = useState<AdminEmailTemplate | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<Partial<AdminCampaignWrite> | null>(null);
  const [recipientsFor, setRecipientsFor] = useState<AdminCampaign | null>(null);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadSubscribers = useCallback(async (signal?: AbortSignal) => {
    setLoadingSubs(true);
    try {
      const rows = await adminApi.newsletter.subscribers.list(
        {
          status:
            statusFilter === 'Subscribed' ? 'active'
              : statusFilter === 'Unsubscribed' ? 'unsubscribed'
                : undefined,
          source: sourceFilter ?? undefined,
          list: listFilter !== null ? String(listFilter) : undefined,
          search: debouncedSearch || undefined,
        },
        signal,
      );
      setSubscribers(asArray<AdminSubscriber>(rows));
    } catch (e) {
      if (!isAbort(e)) setError(errMsg(e));
    } finally {
      if (!signal?.aborted) setLoadingSubs(false);
    }
  }, [statusFilter, sourceFilter, listFilter, debouncedSearch]);

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    try { setStats(await adminApi.newsletter.subscribers.stats(signal)); }
    catch (e) { if (!isAbort(e)) setError(errMsg(e)); }
  }, []);

  const loadLists = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await adminApi.newsletter.lists.list(signal);
      setLists(asArray<AdminSubscriberList>(data));
    } catch (e) {
      if (!isAbort(e)) setError(errMsg(e));
    }
  }, []);

  const loadSegments = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await adminApi.newsletter.segments.list(signal);
      setSegments(asArray<AdminSegment>(data));
    } catch (e) {
      if (!isAbort(e)) setError(errMsg(e));
    }
  }, []);

  const loadTemplates = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await adminApi.newsletter.templates.list(signal);
      setTemplates(asArray<AdminEmailTemplate>(data));
    } catch (e) {
      if (!isAbort(e)) setError(errMsg(e));
    }
  }, []);

  const loadCampaigns = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await adminApi.newsletter.campaigns.list(signal);
      setCampaigns(asArray<AdminCampaign>(data));
    } catch (e) {
      if (!isAbort(e)) setError(errMsg(e));
    }
  }, []);

  const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
    setLoadingAnalytics(true);
    try {
      const [g, p, s] = await Promise.all([
        adminApi.newsletter.analytics.growth(signal),
        adminApi.newsletter.analytics.campaigns(signal),
        adminApi.newsletter.analytics.summary(signal),
      ]);
      setGrowth(asArray<AdminGrowthPoint>(g));
      setPerf(asArray<AdminCampaignPerformance>(p));
      setSummary(s);
    } catch (e) {
      if (!isAbort(e)) setError(errMsg(e));
    } finally {
      if (!signal?.aborted) setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    (async () => {
      setLoadingCore(true);
      await Promise.all([
        loadStats(c.signal), loadLists(c.signal), loadSegments(c.signal),
        loadTemplates(c.signal), loadCampaigns(c.signal),
      ]);
      if (!c.signal.aborted) setLoadingCore(false);
    })();
    return () => c.abort();
  }, [loadStats, loadLists, loadSegments, loadTemplates, loadCampaigns]);

  useEffect(() => {
    const c = new AbortController();
    loadSubscribers(c.signal);
    return () => c.abort();
  }, [loadSubscribers]);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    const c = new AbortController();
    loadAnalytics(c.signal);
    return () => c.abort();
  }, [activeTab, loadAnalytics]);

  const liveIds = useMemo(
    () => campaigns
      .filter((c) => c.status === 'sending' || c.status === 'queued')
      .map((c) => c.id)
      .join(','),
    [campaigns],
  );

  useEffect(() => {
    if (!liveIds) return;
    const ids = liveIds.split(',').map((x) => Number(x));
    let cancelled = false;
    const tick = async () => {
      try {
        const updates = await Promise.all(
          ids.map((id) => adminApi.newsletter.campaigns.status(String(id))),
        );
        if (cancelled) return;
        setCampaigns((prev) =>
          prev.map((c) => {
            const u = updates.find((x) => x.id === c.id);
            if (!u) return c;
            return {
              ...c,
              status: u.status,
              recipient_count: u.recipient_count,
              sent_count: u.sent_count,
              failed_count: u.failed_count,
              sent_at: u.sent_at,
            };
          }),
        );
      } catch { /* ignore */ }
    };
    const timer = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [liveIds]);

  const audienceChoices: AudienceChoice[] = useMemo(() => {
    const out: AudienceChoice[] = [
      {
        key: 'all_active:',
        type: 'all_active',
        id: '',
        label: 'All active subscribers',
        count: stats?.active ?? 0,
      },
    ];

    lists.forEach((l) => {
      out.push({
        key: `list:${l.id}`,
        type: 'list',
        id: String(l.id),
        label: `List · ${l.name}`,
        count: l.subscriberCount ?? 0,
      });
    });

    segments.forEach((segment) => {
      out.push({
        key: `segment:${segment.id}`,
        type: 'segment',
        id: String(segment.id),
        label: `Segment · ${segment.name}`,
        count: segment.count ?? 0,
      });
    });

    return out;
  }, [lists, segments, stats]);

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0) + (listFilter !== null ? 1 : 0);

  const listNameForFilter =
    listFilter !== null
      ? lists.find((l) => l.id === listFilter)?.name ?? null
      : null;

  const tabs = [
    { id: 'subscribers' as Tab, label: 'Subscribers', icon: Users, count: stats?.total },
    { id: 'lists' as Tab, label: 'Lists', icon: List, count: lists.length },
    { id: 'segments' as Tab, label: 'Segments', icon: Layers, count: segments.length },
    { id: 'templates' as Tab, label: 'Templates', icon: FileText, count: templates.length },
    { id: 'campaigns' as Tab, label: 'Campaigns', icon: Send, count: campaigns.length },
    { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
  ];

  // ── Actions ───────────────────────────────────────────────────────────────
  const refreshSubscriberContext = useCallback(async () => {
    await Promise.all([loadStats(), loadLists()]);
  }, [loadStats, loadLists]);

  const handleDeleteSubscriber = async (sub: AdminSubscriber) => {
    if (!window.confirm(`Remove ${sub.email} from all lists?`)) return;
    const prev = subscribers;
    setSubscribers((p) => p.filter((s) => s.id !== sub.id));
    try {
      await adminApi.newsletter.subscribers.remove(String(sub.id));
      toast('Subscriber removed');
      refreshSubscriberContext();
    } catch (e) {
      setSubscribers(prev);
      setError(errMsg(e));
    }
  };

  const handleToggleSubscriber = async (sub: AdminSubscriber) => {
    const prev = subscribers;
    setSubscribers((p) =>
      p.map((s) =>
        s.id === sub.id
          ? { ...s, is_active: !s.is_active, status: s.is_active ? 'Unsubscribed' : 'Subscribed' }
          : s,
      ),
    );
    try {
      const updated = await adminApi.newsletter.subscribers.toggleActive(String(sub.id));
      setSubscribers((p) => p.map((s) => (s.id === updated.id ? updated : s)));
      toast(updated.is_active ? 'Subscriber re-activated' : 'Subscriber deactivated');
      refreshSubscriberContext();
    } catch (e) {
      setSubscribers(prev);
      setError(errMsg(e));
    }
  };

  const handleExportSubscribers = () => {
    const header = 'Email,Name,Source,Status,Joined Date,Tags';
    const rows = subscribers.map(
      (s) =>
        `${s.email},"${s.name}",${s.source},${s.status},${fmtDate(s.subscribed_at)},"${(s.tags ?? []).join('|')}"`,
    );
    const csv = `data:text/csv;charset=utf-8,${[header, ...rows].join('\n')}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `subscribers_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Exported ${subscribers.length} subscribers`);
  };

  const handleDeleteList = async (list: AdminSubscriberList) => {
    if (!window.confirm(`Delete list "${list.name}"? Subscribers will not be deleted.`)) return;
    try {
      await adminApi.newsletter.lists.remove(String(list.id));
      setLists((p) => p.filter((l) => l.id !== list.id));
      if (listFilter === list.id) setListFilter(null);
      toast('List deleted');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const handleDeleteTemplate = async (tpl: AdminEmailTemplate) => {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await adminApi.newsletter.templates.remove(String(tpl.id));
      setTemplates((p) => p.filter((t) => t.id !== tpl.id));
      toast('Template deleted');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const handleDeleteCampaign = async (c: AdminCampaign) => {
    if (!window.confirm(`Delete campaign "${c.name}"?`)) return;
    try {
      await adminApi.newsletter.campaigns.remove(String(c.id));
      setCampaigns((p) => p.filter((x) => x.id !== c.id));
      toast('Campaign deleted');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const handleCampaignAction = async (
    c: AdminCampaign,
    action: 'send' | 'pause' | 'resume',
  ) => {
    try {
      const updated = await adminApi.newsletter.campaigns[action](String(c.id));
      setCampaigns((p) => p.map((x) => (x.id === updated.id ? updated : x)));
      toast(
        action === 'send'
          ? `Campaign "${c.name}" queued for sending`
          : action === 'pause'
            ? `Campaign "${c.name}" paused`
            : `Campaign "${c.name}" resumed`,
      );
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const openCampaignFromTemplate = (tpl: AdminEmailTemplate) => {
    setTemplatePreview(null);
    setCampaignDraft({
      name: tpl.name,
      subject: tpl.subject,
      body: tpl.body,
      hero_image_url: tpl.hero_image_url || undefined,
      cta_text: tpl.cta_text || undefined,
      cta_url: tpl.cta_url || undefined,
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
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

      {error && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[110] max-w-lg w-[calc(100%-24px)] bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm shadow-lg flex items-start gap-2 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Newsletter</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Subscriber lists, segments, templates, campaigns, and delivery analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSubscribers}
              disabled={subscribers.length === 0}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setCampaignDraft({})}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>New campaign</span>
            </button>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-3 flex items-center gap-0.5 border-t border-slate-100 pt-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border-b-2 transition whitespace-nowrap ${isActive
                  ? 'border-blue-950 text-blue-950'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-950' : 'text-slate-400'}`} />
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-sm text-[13px] ${isActive ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">
        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatCard
            label="Total subscribers"
            value={stats ? (stats.total ?? 0).toLocaleString() : '—'}
            hint={`${(stats?.active ?? 0).toLocaleString()} active`}
            hintTone="emerald"
            icon={Users}
            iconClass="bg-blue-50 text-blue-950"
            loading={loadingCore}
          />
          <StatCard
            label="New this month"
            value={stats ? `+${(stats.new_this_month ?? 0).toLocaleString()}` : '—'}
            hint="Joined in last 30 days"
            hintTone="emerald"
            icon={UserPlus}
            iconClass="bg-emerald-50 text-emerald-700"
            loading={loadingCore}
          />
          <StatCard
            label="Unsubscribed"
            value={stats ? (stats.unsubscribed ?? 0).toLocaleString() : '—'}
            hint={stats ? `${stats.churn_rate ?? 0}% churn` : '—'}
            icon={UserX}
            iconClass="bg-red-50 text-red-600"
            loading={loadingCore}
          />
          <StatCard
            label="Avg. open rate"
            value={summary ? `${summary.avg_open_rate ?? 0}%` : '—'}
            hint="Across all campaigns"
            hintTone="emerald"
            icon={Percent}
            iconClass="bg-purple-50 text-purple-700"
            loading={loadingCore || loadingAnalytics}
          />
        </div>

        {/* SUBSCRIBERS */}
        {activeTab === 'subscribers' && (
          <>
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email or name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Status"
                  value={statusFilter}
                  options={STATUS_OPTIONS as unknown as string[]}
                  onChange={(v) => setStatusFilter(v as StatusFilter | null)}
                />
                <FilterDropdown
                  label="Source"
                  value={sourceFilter}
                  options={SOURCE_OPTIONS}
                  onChange={(v) => setSourceFilter(v)}
                />
                <FilterDropdown
                  label="List"
                  value={listNameForFilter}
                  options={lists.map((l) => l.name)}
                  onChange={(v) => {
                    const found = lists.find((l) => l.name === v);
                    setListFilter(found ? found.id : null);
                  }}
                />
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter(null);
                      setSourceFilter(null);
                      setListFilter(null);
                    }}
                    className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
                  >
                    Clear ({activeFilterCount})
                  </button>
                )}
                <button
                  onClick={() => setSubscriberModal({ open: true, initial: null })}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">
                  Subscribers directory · {loadingSubs ? '…' : subscribers.length}
                </p>
                <button
                  onClick={() => loadSubscribers()}
                  className="text-[13px] font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSubs ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-medium">Email</th>
                      <th className="py-2 px-3 font-medium">Name</th>
                      <th className="py-2 px-3 font-medium">Lists</th>
                      <th className="py-2 px-3 font-medium">Source</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Joined</th>
                      <th className="py-2 px-3 w-28" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingSubs && subscribers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                          Loading subscribers…
                        </td>
                      </tr>
                    ) : subscribers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No subscribers match your filters.
                        </td>
                      </tr>
                    ) : (
                      subscribers.map((sub) => (
                        <tr key={String(sub.id)} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-900 truncate max-w-[260px]">
                            {sub.email}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{sub.name || '—'}</span>
                              {(sub.tags ?? []).includes('vip') && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[13px] font-medium px-1.5 py-0.5 rounded-sm">
                                  VIP
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {(sub.lists ?? []).slice(0, 2).map((l) => (
                                <span
                                  key={String(l.id)}
                                  className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm border ${safeColor(l.color)}`}
                                >
                                  {l.name}
                                </span>
                              ))}
                              {(sub.lists ?? []).length > 2 && (
                                <span className="text-[13px] text-slate-500">
                                  +{(sub.lists ?? []).length - 2}
                                </span>
                              )}
                              {(sub.lists ?? []).length === 0 && (
                                <span className="text-[13px] text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-sm font-medium border bg-slate-100 text-slate-600 border-slate-200">
                              {sub.source || '—'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => handleToggleSubscriber(sub)}
                              title="Toggle active status"
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border transition ${sub.status === 'Subscribed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                }`}
                            >
                              {sub.status}
                            </button>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {fmtDate(sub.subscribed_at)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSubscriberModal({ open: true, initial: sub })}
                                className="p-1.5 rounded-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                                title="Edit subscriber"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSubscriber(sub)}
                                className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                                title="Remove subscriber"
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
            </div>
          </>
        )}

        {/* LISTS */}
        {activeTab === 'lists' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Subscriber lists</p>
                <p className="text-[13px] text-slate-500">Group subscribers for targeted broadcasts</p>
              </div>
              <button
                onClick={() => setListModal({ open: true, initial: null })}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" /> New list
              </button>
            </div>

            {loadingCore ? (
              <SkeletonGrid />
            ) : lists.length === 0 ? (
              <EmptyState
                icon={List}
                title="No lists yet"
                body="Create your first list to start segmenting your audience."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lists.map((list) => (
                  <div
                    key={String(list.id)}
                    className="bg-white border border-slate-200 rounded-sm p-2 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-sm flex items-center justify-center border shrink-0 ${safeColor(list.color)}`}
                        >
                          <List className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {list.name}
                          </p>
                          <p className="text-[13px] text-slate-500">
                            {(list.subscriberCount ?? 0).toLocaleString()} subscribers
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setListModal({ open: true, initial: list })}
                          className="p-1.5 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                          title="Edit list"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteList(list)}
                          className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50"
                          title="Delete list"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-600 min-h-[34px]">
                      {list.description || 'No description.'}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setListFilter(list.id);
                          setStatusFilter(null);
                          setSourceFilter(null);
                          setActiveTab('subscribers');
                        }}
                        className="text-[13px] font-medium text-blue-950 hover:underline"
                      >
                        View subscribers
                      </button>
                      <button
                        onClick={() =>
                          setCampaignDraft({
                            audience_type: 'list',
                            audience_id: String(list.id),
                          })
                        }
                        className="text-[13px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Send className="w-3 h-3" /> Send to list
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEGMENTS */}
        {activeTab === 'segments' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2">
              <p className="text-[13px] font-semibold text-slate-900">Dynamic segments</p>
              <p className="text-[13px] text-slate-500">
                Rule-based audiences refreshed automatically from order + subscriber data
              </p>
            </div>
            {loadingCore ? (
              <SkeletonGrid />
            ) : segments.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No segments available"
                body="Segments are defined server-side and appear here once configured."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="bg-white border border-slate-200 rounded-sm p-2 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-sm flex items-center justify-center border shrink-0 ${safeColor(seg.color)}`}
                        >
                          <Layers className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {seg.name}
                          </p>
                          <p className="text-[13px] text-slate-500">
                            {(seg.count ?? 0).toLocaleString()} contacts
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-600">{seg.description}</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
                      <p className="text-[13px] font-medium text-slate-500">Rules</p>
                      {(seg.rules ?? []).map((r, i) => (
                        <p
                          key={i}
                          className="text-[13px] font-mono text-slate-700 inline-flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3 text-slate-400" />
                          {r}
                        </p>
                      ))}
                    </div>
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() =>
                          setCampaignDraft({
                            audience_type: 'segment',
                            audience_id: seg.id,
                          })
                        }
                        className="text-[13px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Send className="w-3 h-3" /> Send to segment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Email templates</p>
                <p className="text-[13px] text-slate-500">
                  Reusable content blocks with merge tags like {'{{name}}'}
                </p>
              </div>
              <button
                onClick={() => setTemplateModal({ open: true, initial: null })}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" /> New template
              </button>
            </div>
            {loadingCore ? (
              <SkeletonGrid />
            ) : templates.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No templates yet"
                body="Save your best emails as templates and reuse them in campaigns."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((tpl) => (
                  <div
                    key={String(tpl.id)}
                    className="bg-white border border-slate-200 rounded-sm p-2 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {tpl.name}
                          </p>
                          <p className="text-[13px] text-slate-500">
                            {tpl.category} · Updated {fmtDate(tpl.updated_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setTemplateModal({ open: true, initial: tpl })}
                          className="p-1.5 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                          title="Edit template"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl)}
                          className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {tpl.hero_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tpl.hero_image_url}
                        alt=""
                        className="w-full h-24 object-cover rounded-sm border border-slate-200"
                      />
                    )}
                    <p className="text-[13px] font-medium text-slate-800 truncate">{tpl.subject}</p>
                    <p className="text-[13px] text-slate-500 line-clamp-2 whitespace-pre-line">
                      {tpl.body}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => setTemplatePreview(tpl)}
                        className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                      <button
                        onClick={() => openCampaignFromTemplate(tpl)}
                        className="text-[13px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Use in campaign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-[13px] font-medium text-slate-700">
                Campaigns · {campaigns.length}
              </p>
              <button
                onClick={() => setCampaignDraft({})}
                className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New campaign
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Campaign</th>
                    <th className="py-2 px-3 font-medium">Audience</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium text-right">Recipients</th>
                    <th className="py-2 px-3 font-medium text-right">Open</th>
                    <th className="py-2 px-3 font-medium text-right">Click</th>
                    <th className="py-2 px-3 font-medium">Schedule / Sent</th>
                    <th className="py-2 px-3 w-56" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCore && campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                        Loading campaigns…
                      </td>
                    </tr>
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No campaigns yet. Create your first one.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => {
                      const isLive = c.status === 'sending' || c.status === 'queued';
                      return (
                        <tr key={String(c.id)} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900 truncate max-w-[240px]">
                              {c.subject}
                            </p>
                            <p className="text-[13px] text-slate-400 truncate">{c.name}</p>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{c.audienceLabel || '—'}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${campaignStatusBadge(c.status)}`}
                            >
                              {isLive && <Loader2 className="w-3 h-3 animate-spin" />}
                              {titleCase(c.status)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {c.sent_count > 0 && isLive
                              ? `${c.sent_count.toLocaleString()} / ${c.recipient_count.toLocaleString()}`
                              : c.recipient_count.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {pct(c.openRate)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {pct(c.clickRate)}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {c.sent_at
                              ? fmtDateTime(c.sent_at)
                              : c.scheduled_at
                                ? fmtDateTime(c.scheduled_at)
                                : 'Not scheduled'}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-1">
                              {(c.status === 'draft' ||
                                c.status === 'scheduled' ||
                                c.status === 'paused') && (
                                  <button
                                    onClick={() => handleCampaignAction(c, 'send')}
                                    className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-2 rounded-sm text-[13px] transition"
                                  >
                                    <Play className="w-3 h-3" />
                                    {c.status === 'paused' ? 'Resume' : 'Send now'}
                                  </button>
                                )}
                              {isLive && (
                                <button
                                  onClick={() => handleCampaignAction(c, 'pause')}
                                  className="inline-flex items-center gap-1 bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-2 rounded-sm text-[13px] hover:bg-amber-50 transition"
                                >
                                  <Pause className="w-3 h-3" /> Pause
                                </button>
                              )}
                              {c.status === 'sent' && (
                                <button
                                  onClick={() => setRecipientsFor(c)}
                                  className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
                                >
                                  <Eye className="w-3 h-3" /> Report
                                </button>
                              )}
                              {(c.status === 'draft' || c.status === 'failed') && (
                                <button
                                  onClick={() => handleDeleteCampaign(c)}
                                  className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                                  title="Delete campaign"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">Subscriber list growth</p>
                <button
                  onClick={() => loadAnalytics()}
                  className="text-[13px] font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingAnalytics ? 'animate-spin' : ''}`} />{' '}
                  Refresh
                </button>
              </div>
              <div className="h-64 w-full">
                {growth.length === 0 ? (
                  <ChartPlaceholder loading={loadingAnalytics} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={growth}
                      margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke="#94a3b8"
                        fontSize={13}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        padding={{ left: 12, right: 12 }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={13}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        allowDecimals={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          color: '#0f172a',
                          fontSize: '13px',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        }}
                        labelStyle={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        formatter={(value: number) => [value.toLocaleString(), 'Subscribers']}
                      />
                      <Line
                        type="monotone"
                        dataKey="subscribers"
                        name="Subscribers"
                        stroke="#172554"
                        strokeWidth={2.5}
                        dot={{
                          r: 4,
                          fill: '#ffffff',
                          stroke: '#172554',
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 6,
                          fill: '#172554',
                          stroke: '#ffffff',
                          strokeWidth: 2,
                        }}
                        isAnimationActive={true}
                        animationDuration={600}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">
                  Campaign performance · open / click / bounce rates
                </p>
                <span className="text-[13px] text-slate-400">Last campaigns</span>
              </div>
              <div className="h-64 w-full">
                {perf.length === 0 ? (
                  <ChartPlaceholder loading={loadingAnalytics} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perf} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={13}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={13}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          color: '#0f172a',
                          fontSize: '13px',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        }}
                        labelStyle={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}
                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '13px' }} />
                      <Bar dataKey="open" name="Open %" fill="#172554" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="click" name="Click %" fill="#059669" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="bounce" name="Bounce %" fill="#dc2626" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Emails delivered</p>
                <p className="text-[15px] font-bold text-slate-900">
                  {summary ? (summary.delivered_total ?? 0).toLocaleString() : '—'}
                </p>
                <p className="text-[13px] text-emerald-600 inline-flex items-center gap-0.5">
                  <Check className="w-3 h-3" />
                  {summary ? `${summary.delivery_rate ?? 0}% delivery rate` : '—'}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Avg. open rate</p>
                <p className="text-[15px] font-bold text-slate-900">
                  {summary ? `${summary.avg_open_rate ?? 0}%` : '—'}
                </p>
                <p className="text-[13px] text-slate-500">
                  Avg. click {summary ? `${summary.avg_click_rate ?? 0}%` : '—'}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Unsubscribe rate</p>
                <p className="text-[15px] font-bold text-slate-900">
                  {summary ? `${summary.avg_unsub_rate ?? 0}%` : '—'}
                </p>
                <p className="text-[13px] text-slate-500">Below the 0.5% threshold</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {subscriberModal.open && (
        <SubscriberModal
          initial={subscriberModal.initial}
          onClose={() => setSubscriberModal({ open: false })}
          onSaved={async (msg) => {
            setSubscriberModal({ open: false });
            toast(msg);
            await loadSubscribers();
            refreshSubscriberContext();
          }}
        />
      )}
      {listModal.open && (
        <ListModal
          initial={listModal.initial}
          onClose={() => setListModal({ open: false })}
          onSaved={async (msg) => {
            setListModal({ open: false });
            toast(msg);
            await loadLists();
          }}
        />
      )}
      {templateModal.open && (
        <TemplateModal
          initial={templateModal.initial}
          onClose={() => setTemplateModal({ open: false })}
          onSaved={async (msg) => {
            setTemplateModal({ open: false });
            toast(msg);
            await loadTemplates();
          }}
        />
      )}
      {templatePreview && (
        <Modal
          title={templatePreview.name}
          subtitle={`${templatePreview.category} · Updated ${fmtDate(templatePreview.updated_at)}`}
          onClose={() => setTemplatePreview(null)}
          maxWidth="max-w-2xl"
          footer={
            <>
              <button
                onClick={() => setTemplatePreview(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
              <button
                onClick={() => openCampaignFromTemplate(templatePreview)}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Send className="w-3.5 h-3.5" /> Use in campaign
              </button>
            </>
          }
        >
          <div>
            <p className="text-[13px] font-medium text-slate-500 mb-1">Subject</p>
            <p className="text-[13px] text-slate-900 font-medium">{templatePreview.subject}</p>
          </div>
          {templatePreview.hero_image_url && (
            <div>
              <p className="text-[13px] font-medium text-slate-500 mb-1">Hero image</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={templatePreview.hero_image_url}
                alt=""
                className="w-full rounded-sm border border-slate-200"
              />
            </div>
          )}
          <div>
            <p className="text-[13px] font-medium text-slate-500 mb-1">Body</p>
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-3">
              <p className="text-[13px] text-slate-700 whitespace-pre-wrap">
                {templatePreview.body}
              </p>
            </div>
          </div>
          {(templatePreview.cta_text || templatePreview.cta_url) && (
            <div>
              <p className="text-[13px] font-medium text-slate-500 mb-1">Call to action</p>
              <p className="text-[13px] text-slate-800">
                <span className="font-medium">{templatePreview.cta_text}</span>
                {templatePreview.cta_url ? (
                  <span className="text-slate-400"> → {templatePreview.cta_url}</span>
                ) : null}
              </p>
            </div>
          )}
        </Modal>
      )}
      {campaignDraft && (
        <CampaignModal
          draft={campaignDraft}
          templates={templates}
          audienceChoices={audienceChoices}
          onClose={() => setCampaignDraft(null)}
          onCreated={async (msg) => {
            setCampaignDraft(null);
            toast(msg);
            await loadCampaigns();
          }}
        />
      )}
      {recipientsFor && (
        <RecipientsModal campaign={recipientsFor} onClose={() => setRecipientsFor(null)} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
function campaignStatusBadge(s: string): string {
  switch (s) {
    case 'sent':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'sending':
    case 'queued':
      return 'bg-blue-50 text-blue-950 border-blue-100';
    case 'scheduled':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'paused':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'failed':
      return 'bg-red-50 text-red-600 border-red-100';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function StatCard({
  label,
  value,
  hint,
  hintTone,
  icon: Icon,
  iconClass,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'emerald';
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {loading ? (
          <div className="h-5 w-20 bg-slate-100 rounded-sm animate-pulse mt-1" />
        ) : (
          <p className="text-[15px] font-bold text-slate-900 mt-0.5">{value}</p>
        )}
        {hint && (
          <p
            className={`text-[13px] mt-0.5 inline-flex items-center gap-0.5 ${hintTone === 'emerald' ? 'text-emerald-600' : 'text-slate-500'
              }`}
          >
            {hintTone === 'emerald' && <TrendingUp className="w-3 h-3" />}
            {hint}
          </p>
        )}
      </div>
      <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white border border-slate-200 rounded-sm p-2 space-y-3 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-sm bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-1/2 bg-slate-100 rounded-sm" />
              <div className="h-3 w-1/3 bg-slate-100 rounded-sm" />
            </div>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-sm" />
          <div className="h-3 w-4/5 bg-slate-100 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm py-12 flex flex-col items-center text-center">
      <span className="w-10 h-10 rounded-sm bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
        <Icon className="w-5 h-5" />
      </span>
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      <p className="text-[13px] text-slate-500 mt-0.5 max-w-sm">{body}</p>
    </div>
  );
}

function ChartPlaceholder({ loading }: { loading: boolean }) {
  if (loading)
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  return (
    <div className="h-full w-full flex items-center justify-center text-slate-400 text-[13px]">
      No data available yet.
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-3xl',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-slate-200 rounded-sm ${maxWidth} w-full max-h-[90vh] flex flex-col shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">{children}</div>
        {footer && (
          <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SubscriberModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminSubscriber | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [email, setEmail] = useState(initial?.email ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [source, setSource] = useState(initial?.source ?? SOURCE_OPTIONS[0]);
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    if (!email.trim()) {
      setFormError('Email is required.');
      return;
    }
    const payload = {
      email: email.trim(),
      name: name.trim(),
      source,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      is_active: isActive,
    };
    setSaving(true);
    try {
      if (initial) {
        await adminApi.newsletter.subscribers.update(String(initial.id), payload);
        onSaved('Subscriber updated');
      } else {
        await adminApi.newsletter.subscribers.create(payload);
        onSaved('Subscriber created');
      }
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Edit subscriber' : 'Add subscriber'}
      subtitle={
        initial
          ? `Joined ${fmtDate(initial.subscribed_at)}`
          : 'Manually add a contact to your newsletter'
      }
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {initial ? 'Save changes' : 'Add subscriber'}
          </button>
        </>
      }
    >
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}
      <div>
        <label className="block font-medium text-slate-700 mb-1">Email *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Wanjiru"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-slate-700 mb-1">Status</label>
          <select
            value={isActive ? 'active' : 'inactive'}
            onChange={(e) => setIsActive(e.target.value === 'active')}
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          >
            <option value="active">Subscribed</option>
            <option value="inactive">Unsubscribed</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">
          Tags <span className="text-slate-400">(comma separated)</span>
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="vip, buyer, whatsapp"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      {initial && (initial.lists ?? []).length > 0 && (
        <div>
          <p className="font-medium text-slate-700 mb-1">List membership</p>
          <div className="flex flex-wrap gap-1">
            {initial.lists.map((l) => (
              <span
                key={String(l.id)}
                className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm border ${safeColor(l.color)}`}
              >
                {l.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ListModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminSubscriberList | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_LIST_COLOR);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('List name is required.');
      return;
    }
    const payload: AdminSubscriberListWrite = {
      name: name.trim(),
      description: description.trim(),
      color,
    };
    setSaving(true);
    try {
      if (initial) {
        await adminApi.newsletter.lists.update(String(initial.id), payload);
        onSaved('List updated');
      } else {
        await adminApi.newsletter.lists.create(payload);
        onSaved('List created');
      }
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Edit list' : 'New list'}
      subtitle="Group subscribers for targeted broadcasts"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {initial ? 'Save changes' : 'Create list'}
          </button>
        </>
      }
    >
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}
      <div>
        <label className="block font-medium text-slate-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Newsletter Weekly"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What kind of contacts belong in this list?"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Colour</label>
        <div className="flex flex-wrap gap-2">
          {LIST_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setColor(preset.value)}
              className={`px-2.5 py-1.5 rounded-sm border text-[13px] font-medium transition ${preset.value} ${color === preset.value ? 'ring-2 ring-blue-950 ring-offset-1' : ''
                }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function TemplateModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminEmailTemplate | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [category, setCategory] = useState<AdminTemplateCategory>(
    initial?.category ?? 'Promotional',
  );
  const [ctaText, setCtaText] = useState(initial?.cta_text ?? '');
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? '');
  const [heroImage, setHeroImage] = useState(initial?.hero_image_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setFormError(null);
    setUploading(true);
    try {
      const { url } = await adminApi.newsletter.uploadImage(file);
      setHeroImage(url);
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setFormError('Name, subject and body are required.');
      return;
    }
    const payload: AdminEmailTemplateWrite = {
      name: name.trim(),
      subject: subject.trim(),
      body,
      category,
      cta_text: ctaText.trim(),
      cta_url: ctaUrl.trim(),
      hero_image_url: heroImage,
    };
    setSaving(true);
    try {
      if (initial) {
        await adminApi.newsletter.templates.update(String(initial.id), payload);
        onSaved('Template updated');
      } else {
        await adminApi.newsletter.templates.create(payload);
        onSaved('Template created');
      }
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Edit template' : 'New template'}
      subtitle="Reusable email content with merge tags"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {initial ? 'Save changes' : 'Create template'}
          </button>
        </>
      }
    >
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Template name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Welcome Email"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        </div>
        <div>
          <label className="block font-medium text-slate-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AdminTemplateCategory)}
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Subject line *</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Karibu {{name}} — welcome to SokoFlow"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-slate-700">Hero image</label>
          <div className="flex items-center gap-2">
            {heroImage && (
              <button
                type="button"
                onClick={() => setHeroImage('')}
                className="text-[13px] text-red-600 hover:underline font-medium"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            className="w-full h-32 object-cover rounded-sm border border-slate-200"
          />
        ) : (
          <div className="w-full h-24 rounded-sm border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 gap-2">
            <ImageIcon className="w-4 h-4" />
            <span className="text-[13px]">No image selected</span>
          </div>
        )}
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Body *</label>
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'Hi {{name}},\n\nThank you for joining…'}
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
        <p className="text-[13px] text-slate-400 mt-1">
          Merge tags: {'{{name}}'}, {'{{email}}'}, {'{{order_number}}'}, {'{{store_url}}'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-slate-700 mb-1">CTA text</label>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Shop now"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        </div>
        <div>
          <label className="block font-medium text-slate-700 mb-1">CTA URL</label>
          <input
            type="url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://sokoflow.co.ke/shop"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CampaignModal({
  draft,
  templates,
  audienceChoices,
  onClose,
  onCreated,
}: {
  draft: Partial<AdminCampaignWrite>;
  templates: AdminEmailTemplate[];
  audienceChoices: AudienceChoice[];
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const initialAudienceKey = `${draft.audience_type ?? 'all_active'}:${draft.audience_id ?? ''}`;
  const [audienceKey, setAudienceKey] = useState(
    audienceChoices.some((a) => a.key === initialAudienceKey)
      ? initialAudienceKey
      : 'all_active:',
  );
  const [templateId, setTemplateId] = useState<string>('');
  const [name, setName] = useState(draft.name ?? '');
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState(draft.body ?? '');
  const [ctaText, setCtaText] = useState(draft.cta_text ?? '');
  const [ctaUrl, setCtaUrl] = useState(draft.cta_url ?? '');
  const [heroImage, setHeroImage] = useState(draft.hero_image_url ?? '');
  const [schedule, setSchedule] = useState<'now' | 'tomorrow' | 'custom'>('now');
  const [customDate, setCustomDate] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 86400000)),
  );
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedAudience = audienceChoices.find((a) => a.key === audienceKey);

  const upload = async (file: File) => {
    setFormError(null);
    setUploading(true);
    try {
      const { url } = await adminApi.newsletter.uploadImage(file);
      setHeroImage(url);
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => String(t.id) === id);
    if (!tpl) return;
    setSubject(tpl.subject);
    setBody(tpl.body);
    setCtaText(tpl.cta_text ?? '');
    setCtaUrl(tpl.cta_url ?? '');
    setHeroImage(tpl.hero_image_url ?? '');
    if (!name.trim()) setName(tpl.name);
  };

  const resolveScheduledAt = (): string | null => {
    if (schedule === 'now') return null;
    if (schedule === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    }
    if (!customDate) return null;
    const d = new Date(customDate);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Campaign name is required.');
      return;
    }
    if (!subject.trim()) {
      setFormError('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      setFormError('Email body cannot be empty.');
      return;
    }
    if (!selectedAudience) {
      setFormError('Choose a target audience.');
      return;
    }

    const payload: AdminCampaignWrite = {
      name: name.trim(),
      subject: subject.trim(),
      body,
      hero_image_url: heroImage,
      cta_text: ctaText.trim(),
      cta_url: ctaUrl.trim(),
      audience_type: selectedAudience.type,
      audience_id: selectedAudience.id,
      scheduled_at: resolveScheduledAt(),
    };
    setSaving(true);
    try {
      const created = await adminApi.newsletter.campaigns.create(payload);
      onCreated(
        created.status === 'sending' || created.status === 'queued'
          ? 'Campaign dispatched'
          : created.scheduled_at
            ? 'Campaign scheduled'
            : 'Campaign saved as draft',
      );
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New campaign"
      subtitle="Compose and dispatch to your audience"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {schedule === 'now' ? 'Dispatch broadcast' : 'Schedule broadcast'}
          </button>
        </>
      }
    >
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}
      <div>
        <label className="block font-medium text-slate-700 mb-1">Target audience</label>
        <select
          value={audienceKey}
          onChange={(e) => setAudienceKey(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        >
          {audienceChoices.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label} — {a.count.toLocaleString()} contacts
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Start from template</label>
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          >
            <option value="">Blank campaign</option>
            {templates.map((t) => (
              <option key={String(t.id)} value={String(t.id)}>
                {t.name} · {t.category}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium text-slate-700 mb-1">Campaign name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="October Launch Teaser"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        </div>
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Subject line *</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Weekly picks: top electronics & M-Pesa deals"
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-slate-700">Hero image</label>
          <div className="flex items-center gap-2">
            {heroImage && (
              <button
                type="button"
                onClick={() => setHeroImage('')}
                className="text-[13px] text-red-600 hover:underline font-medium"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            className="w-full h-28 object-cover rounded-sm border border-slate-200"
          />
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-slate-700">Email body *</label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? 'Edit content' : 'Preview'}
          </button>
        </div>
        {!showPreview ? (
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{name}}, welcome to this week's newsletter…"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 min-h-[160px]">
            <p className="text-[15px] font-semibold text-slate-900">
              {subject || 'Untitled subject'}
            </p>
            {heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt=""
                className="w-full rounded-sm border border-slate-200 mt-2"
              />
            )}
            <p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-2">
              {body || 'No content entered yet.'}
            </p>
            {ctaText && (
              <span className="inline-block mt-3 bg-blue-950 text-white text-[13px] font-medium px-3 py-1.5 rounded-sm">
                {ctaText}
              </span>
            )}
          </div>
        )}
        <p className="text-[13px] text-slate-400 mt-1">
          Merge tags: {'{{name}}'}, {'{{email}}'}, {'{{order_number}}'}, {'{{store_url}}'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-slate-700 mb-1">CTA text</label>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Shop now"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        </div>
        <div>
          <label className="block font-medium text-slate-700 mb-1">CTA URL</label>
          <input
            type="url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://sokoflow.co.ke/shop"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        </div>
      </div>
      <div>
        <label className="block font-medium text-slate-700 mb-1">Schedule</label>
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as 'now' | 'tomorrow' | 'custom')}
          className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        >
          <option value="now">Send immediately</option>
          <option value="tomorrow">Tomorrow morning (9 AM EAT)</option>
          <option value="custom">Custom date &amp; time</option>
        </select>
        {schedule === 'custom' && (
          <input
            type="datetime-local"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="w-full mt-2 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
          />
        )}
      </div>
      {selectedAudience && (
        <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between">
          <span className="text-[13px] text-slate-600">
            This campaign will reach{' '}
            <span className="font-semibold text-slate-900">
              {selectedAudience.count.toLocaleString()}
            </span>{' '}
            contacts
          </span>
          <Mail className="w-4 h-4 text-slate-400" />
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function RecipientsModal({
  campaign,
  onClose,
}: {
  campaign: AdminCampaign;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AdminCampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const data = await adminApi.newsletter.campaigns.recipients(
          String(campaign.id),
          c.signal,
        );
        if (!c.signal.aborted) setRows(asArray<AdminCampaignRecipient>(data));
      } catch (e) {
        if (!isAbort(e)) setLoadError(errMsg(e));
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [campaign.id]);

  const recipientBadge = (status: AdminCampaignRecipient['status']) => {
    switch (status) {
      case 'sent':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'queued':
        return 'bg-blue-50 text-blue-950 border-blue-100';
      case 'bounced':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-red-50 text-red-600 border-red-100';
    }
  };

  return (
    <Modal
      title={campaign.subject}
      subtitle={`${campaign.name} · ${campaign.audienceLabel}`}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <button
          onClick={onClose}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
        >
          Close
        </button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="border border-slate-200 rounded-sm p-2">
          <p className="text-[13px] text-slate-500">Recipients</p>
          <p className="text-[15px] font-bold text-slate-900">
            {(campaign.recipient_count ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="border border-slate-200 rounded-sm p-2">
          <p className="text-[13px] text-slate-500">Delivered</p>
          <p className="text-[15px] font-bold text-slate-900">
            {(campaign.sent_count ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="border border-slate-200 rounded-sm p-2">
          <p className="text-[13px] text-slate-500">Open rate</p>
          <p className="text-[15px] font-bold text-slate-900">{pct(campaign.openRate)}</p>
        </div>
        <div className="border border-slate-200 rounded-sm p-2">
          <p className="text-[13px] text-slate-500">Click rate</p>
          <p className="text-[15px] font-bold text-slate-900">{pct(campaign.clickRate)}</p>
        </div>
      </div>
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}
      <div className="border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
          <p className="text-[13px] font-medium text-slate-700">
            Recipients {loading ? '' : `· ${rows.length}`}
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" /> Loading recipients…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-[13px]">
              No recipient records available.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Sent at</th>
                  <th className="py-2 px-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="py-2 px-3 font-mono text-slate-800 truncate max-w-[240px]">
                      {r.email}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${recipientBadge(r.status)}`}
                      >
                        {titleCase(r.status)}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-400">
                      {fmtDateTime(r.sent_at)}
                    </td>
                    <td className="py-2 px-3 text-slate-500 truncate max-w-[200px]">
                      {r.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = value !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded-sm px-3 py-2 text-[13px] font-medium transition whitespace-nowrap ${isActive
          ? 'bg-blue-50 border-blue-950 text-blue-950'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
      >
        {value ?? label}
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1 max-h-72 overflow-y-auto">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive
              ? 'bg-blue-50 text-blue-950 font-medium'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            All {label.toLowerCase()}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected
                  ? 'bg-blue-50 text-blue-950 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}