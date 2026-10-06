'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tag, Plus, Search, X, CheckCircle2,
  Play, Pause, Copy, Trash2, Edit3, Download,
  DollarSign, TrendingUp, BarChart3, Settings2, Zap,
  Wand2, ChevronRight, Calculator, Check,
  Image as ImageIcon, Video as VideoIcon, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type { AdminDiscount, AdminDiscountWrite } from '@/lib/admin-types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Tab = 'Overview' | 'All Discounts' | 'Analytics' | 'Rules';
type DiscountStatus = 'Active' | 'Scheduled' | 'Expired' | 'Draft' | 'Paused';
type DiscountType =
  | 'Percentage' | 'Fixed Amount' | 'Free Shipping'
  | 'BOGO' | 'Bundle' | 'Tiered';
type AppliesTo = 'Entire Order' | 'Specific Products' | 'Specific Categories';
type Eligibility = 'All Customers' | 'New Customers Only' | 'Repeat Customers Only' | 'Specific Tags' | 'Specific Customers';
type Channel = 'Website' | 'WhatsApp' | 'TikTok';

interface Discount {
  id: string;
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minOrder: number;
  maxCap: number;
  usageLimit: number;
  perCustomer: number;
  usageCount: number;
  startDate: string;
  endDate: string;
  status: DiscountStatus;
  appliesTo: AppliesTo;
  eligibility: Eligibility;
  targetAudience: string;
  isMostDeal: boolean;
  image: string;
  displayOnDealsPage: boolean;
  promotionType: string;
  dealTitle: string;
  badgeText: string;
  priority: number;
  linkedProductIds: string[];
  linkedCategories: string[];
  channels: Channel[];
  tiktokVideo?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ISO 8601 (`2026-10-03T17:52:00.000Z`) → form-friendly string for
 * `<input type="datetime-local">` (`2026-10-03 17:52`).
 */
function isoToFormDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ` +
    `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  );
}

/**
 * Form-friendly string (`2026-10-03 17:52`) → ISO 8601
 * (`2026-10-03T17:52:00.000Z`).
 */
function formDateToIso(form: string): string {
  if (!form) return new Date().toISOString();
  const dt = new Date(form.replace(' ', 'T'));
  if (Number.isNaN(dt.getTime())) return new Date().toISOString();
  return dt.toISOString();
}

/**
 * Client-side code generator. Mirrors the modal's "Generate" button.
 * Uses a reduced alphabet (no I, O, 0, 1) so a customer reading the
 * code off a screen can't confuse the characters.
 */
function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function fromBackend(d: AdminDiscount): Discount {
  return {
    id: String(d.id),
    code: d.code,
    description: d.description,
    type: d.type as DiscountType,
    value: d.value,
    minOrder: d.minOrder,
    maxCap: d.maxCap,
    usageLimit: d.usageLimit,
    perCustomer: d.perCustomer,
    usageCount: d.usageCount,
    startDate: isoToFormDate(d.startDate),
    endDate: isoToFormDate(d.endDate),
    status: d.status as DiscountStatus,
    appliesTo: d.appliesTo as AppliesTo,
    eligibility: d.eligibility as Eligibility,
    targetAudience: d.targetAudience,
    isMostDeal: d.isMostDeal,
    image: d.image,
    displayOnDealsPage: d.displayOnDealsPage,
    promotionType: d.promotionType as string,
    dealTitle: d.dealTitle,
    badgeText: d.badgeText,
    priority: d.priority,
    linkedProductIds: d.linkedProductIds ?? [],
    linkedCategories: d.linkedCategories ?? [],
    channels: (d.channels ?? []) as Channel[],
    tiktokVideo: d.tiktokVideo,
  };
}

function toBackend(d: Discount): AdminDiscountWrite {
  return {
    code: d.code,
    description: d.description,
    dealTitle: d.dealTitle,
    badgeText: d.badgeText,
    type: d.type as AdminDiscountWrite['type'],
    value: d.value,
    minOrder: d.minOrder,
    maxCap: d.maxCap,
    promotionType: d.promotionType as AdminDiscountWrite['promotionType'],
    usageLimit: d.usageLimit,
    perCustomer: d.perCustomer,
    startDate: formDateToIso(d.startDate),
    endDate: d.endDate ? formDateToIso(d.endDate) : null,
    appliesTo: d.appliesTo as AdminDiscountWrite['appliesTo'],
    eligibility: d.eligibility as AdminDiscountWrite['eligibility'],
    targetAudience: d.targetAudience,
    linkedCategories: d.linkedCategories,
    linkedProductIds: d.linkedProductIds,
    status: d.status as AdminDiscountWrite['status'],
    isMostDeal: d.isMostDeal,
    image: d.image,
    displayOnDealsPage: d.displayOnDealsPage,
    priority: d.priority,
    channels: d.channels as AdminDiscountWrite['channels'],
    tiktokVideo: d.tiktokVideo,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════

const AVAILABLE_CATEGORIES = ['TVs', 'Laptops', 'Smartphones', 'Audio', 'Gaming', 'Accessories', 'Speakers', 'Networking'];
const AVAILABLE_PRODUCTS = [
  'Wireless Ergonomic Mechanical Keyboard',
  'UltraWide 29" Gaming Monitor',
  'Smart Home Wi-Fi Router AX3000',
  'USB-C Multiport Hub 7-in-1',
  'SokoFlow Pro Subscription (1 Yr)',
  'Adjustable Desk Monitor Arm',
];

const REDEMPTIONS_OVER_TIME = [
  { day: 'Mon', redemptions: 12 }, { day: 'Tue', redemptions: 18 },
  { day: 'Wed', redemptions: 15 }, { day: 'Thu', redemptions: 24 },
  { day: 'Fri', redemptions: 38 }, { day: 'Sat', redemptions: 47 },
  { day: 'Sun', redemptions: 28 },
];

const REVENUE_BY_DISCOUNT = [
  { name: 'SAVE10', revenue: 367500 },
  { name: 'FREESHIP', revenue: 283500 },
  { name: 'VIP15', revenue: 201000 },
  { name: 'TVWEEK15', revenue: 142800 },
  { name: 'BUY2GET1', revenue: 89600 },
];

const TYPE_BREAKDOWN = [
  { name: 'Percentage', value: 412, color: '#172554' },
  { name: 'Fixed', value: 189, color: '#10b981' },
  { name: 'Free Ship', value: 189, color: '#8b5cf6' },
  { name: 'BOGO', value: 34, color: '#f59e0b' },
];

const CHANNEL_BREAKDOWN = [
  { name: 'Website', value: 540, color: '#172554' },
  { name: 'WhatsApp', value: 210, color: '#10b981' },
  { name: 'TikTok', value: 74, color: '#ec4899' },
];

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '2px',
  color: '#0f172a',
  fontSize: '12px',
};

const KES = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

const MAX_IMAGE_MB = 5;
const MAX_VIDEO_MB = 60;

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'Overview', label: 'Overview', icon: BarChart3 },
  { id: 'All Discounts', label: 'All Discounts', icon: Tag },
  { id: 'Analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'Rules', label: 'Rules', icon: Settings2 },
];

export default function DiscountsPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadDiscounts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await adminApi.discounts.list({}, signal);
      setDiscounts(rows.map(fromBackend));
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.error('Failed to load discounts', err);
      setError('Could not load discounts. Try refreshing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadDiscounts(ctrl.signal);
    return () => ctrl.abort();
  }, [loadDiscounts]);

  // ── Save: create or update ────────────────────────────────────────
  const saveDiscount = async (d: Discount) => {
    // The write serializer rejects a blank `code`. If Section 2 was
    // skipped or the user left the field empty, generate one now so
    // the publish action always succeeds.
    const code = d.code?.trim() ? d.code : generateRandomCode();
    const payload = toBackend({ ...d, code });

    const isEdit = discounts.some((x) => x.id === d.id);
    try {
      if (isEdit) {
        await adminApi.discounts.update(Number(d.id), payload);
      } else {
        await adminApi.discounts.create(payload);
      }
      await loadDiscounts();
      setEditingDiscount(null);
      setCreating(false);
      setToast(`Discount "${code}" saved`);
    } catch (err) {
      console.error('Save failed', err);
      setToast('Save failed — see console');
    }
  };

  const deleteDiscount = async (id: string) => {
    try {
      await adminApi.discounts.remove(Number(id));
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
      setToast('Discount deleted');
    } catch (err) {
      console.error('Delete failed', err);
      setToast('Delete failed — see console');
    }
  };

  const duplicateDiscount = async (d: Discount) => {
    try {
      const clone = await adminApi.discounts.duplicate(Number(d.id));
      setDiscounts((prev) => [fromBackend(clone), ...prev]);
      setToast(`Duplicated as ${clone.code}`);
    } catch (err) {
      console.error('Duplicate failed', err);
      setToast('Duplicate failed — see console');
    }
  };

  const togglePause = async (id: string) => {
    const d = discounts.find((x) => x.id === id);
    if (!d) return;
    try {
      const updated = d.status === 'Paused'
        ? await adminApi.discounts.resume(Number(id))
        : await adminApi.discounts.pause(Number(id));
      setDiscounts((prev) =>
        prev.map((x) => (x.id === id ? fromBackend(updated) : x))
      );
      setToast('Status updated');
    } catch (err) {
      console.error('Pause/resume failed', err);
      setToast('Status update failed — see console');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {toast && (
        <div className="fixed bottom-3 right-3 z-[120] bg-slate-900 text-white px-3 py-2 rounded-sm shadow-lg flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-900 truncate">
                Discounts &amp; Promotions
              </h1>
              <p className="text-[13px] text-slate-500 truncate">
                Create and manage discount codes, automatic promotions, and flash sales.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Discount
          </button>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${active ? 'border-blue-950 text-blue-950' : 'border-transparent text-slate-500 hover:text-slate-800'
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
        {loading && (
          <div className="bg-white border border-slate-200 rounded-sm p-6 text-center text-[13px] text-slate-500">
            Loading discounts…
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-3 flex items-start gap-2 text-[13px] text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => loadDiscounts()}
              className="font-medium text-red-900 hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && tab === 'Overview' && (
          <OverviewTab
            discounts={discounts}
            onCreate={() => setCreating(true)}
            onJumpToList={() => setTab('All Discounts')}
          />
        )}
        {!loading && !error && tab === 'All Discounts' && (
          <ListTab
            discounts={discounts}
            onEdit={setEditingDiscount}
            onDelete={deleteDiscount}
            onDuplicate={duplicateDiscount}
            onTogglePause={togglePause}
            onCreate={() => setCreating(true)}
          />
        )}
        {!loading && !error && tab === 'Analytics' && <AnalyticsTab />}
        {!loading && !error && tab === 'Rules' && <RulesTab onToast={setToast} />}
      </main>

      {(creating || editingDiscount) && (
        <DiscountModal
          initial={editingDiscount}
          onClose={() => {
            setCreating(false);
            setEditingDiscount(null);
          }}
          onSave={saveDiscount}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({
  discounts, onCreate, onJumpToList,
}: {
  discounts: Discount[];
  onCreate: () => void;
  onJumpToList: () => void;
}) {
  const stats = useMemo(() => {
    const active = discounts.filter((d) => d.status === 'Active').length;
    const redemptions = discounts.reduce((s, d) => s + d.usageCount, 0);
    const revenue = redemptions * 1540;
    const avgDiscount = redemptions ? Math.round((revenue * 0.12) / redemptions) : 0;
    return { active, redemptions, revenue, avgDiscount };
  }, [discounts]);

  const grouped = {
    Active: discounts.filter((d) => d.status === 'Active'),
    Scheduled: discounts.filter((d) => d.status === 'Scheduled'),
    Expired: discounts.filter((d) => d.status === 'Expired'),
    Draft: discounts.filter((d) => d.status === 'Draft'),
  };

  if (discounts.length === 0) {
    return (
      <div className="space-y-3">
        <PageHeader
          title="Discounts & Promotions"
          subtitle="Create and manage discount codes, automatic promotions, and flash sales."
        />
        <EmptyState
          icon={<Tag className="w-6 h-6" />}
          title="No discounts created yet. Create your first promotion to start driving sales."
          action={{ label: 'Create Discount', onClick: onCreate, icon: <Plus className="w-3.5 h-3.5" /> }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Active Discounts" value={String(stats.active)} helper="Currently running promotions" icon={<Zap className="w-4 h-4" />} tint="bg-emerald-50 text-emerald-700" />
        <KpiCard label="Total Redemptions" value={stats.redemptions.toLocaleString()} helper="Times discounts were used this month" icon={<Tag className="w-4 h-4" />} tint="bg-blue-50 text-blue-950" />
        <KpiCard label="Revenue from Discounts" value={KES(stats.revenue)} helper="Total sales attributed to discounted orders" icon={<TrendingUp className="w-4 h-4" />} tint="bg-indigo-50 text-indigo-700" />
        <KpiCard label="Average Discount Value" value={KES(stats.avgDiscount)} helper="Mean discount amount per redemption" icon={<Calculator className="w-4 h-4" />} tint="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(['Active', 'Scheduled', 'Expired', 'Draft'] as const).map((key) => {
          const list = grouped[key];
          return (
            <section key={key} className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">{key} Discounts</p>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm">{list.length}</span>
                </div>
                <button onClick={onJumpToList} className="text-[12px] font-medium text-blue-950 hover:underline">
                  View all →
                </button>
              </div>
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {list.length === 0 ? (
                  <li className="py-8 text-center text-[12px] text-slate-400">
                    No {key.toLowerCase()} discounts.
                  </li>
                ) : (
                  list.map((d) => (
                    <li key={d.id} className="px-3 py-2 flex items-center gap-2">
                      <span className="w-1.5 h-10 rounded-sm bg-blue-950 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {d.dealTitle || d.description}
                          </p>
                          <code className="text-[11px] font-mono text-blue-950 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded-sm shrink-0">
                            {d.code}
                          </code>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {d.type} · {d.value} · {d.usageCount.toLocaleString()} uses
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_TABS: { id: DiscountStatus | 'All'; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Paused', label: 'Paused' },
  { id: 'Draft', label: 'Draft' },
];

function ListTab({
  discounts, onEdit, onDelete, onDuplicate, onTogglePause, onCreate,
}: {
  discounts: Discount[];
  onEdit: (d: Discount) => void;
  onDelete: (id: string) => void;
  onDuplicate: (d: Discount) => void;
  onTogglePause: (id: string) => void;
  onCreate: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<DiscountStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DiscountType | 'All'>('All');
  const [channelFilter, setChannelFilter] = useState<Channel | 'All'>('All');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = discounts.filter((d) => {
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    const matchesType = typeFilter === 'All' || d.type === typeFilter;
    const matchesChannel = channelFilter === 'All' || d.channels.includes(channelFilter);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.code.toLowerCase().includes(q) ||
      d.dealTitle.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q);
    return matchesStatus && matchesType && matchesChannel && matchesSearch;
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAll = () =>
    setSelected(filtered.length === selected.length ? [] : filtered.map((d) => d.id));

  const bulkDelete = () => {
    selected.forEach(onDelete);
    setSelected([]);
  };

  if (discounts.length === 0) {
    return (
      <div className="space-y-3">
        <PageHeader title="All Discounts" subtitle="Every promotion you have created, organised by status." />
        <EmptyState
          icon={<Tag className="w-6 h-6" />}
          title="No discounts created yet. Create your first promotion to start driving sales."
          action={{ label: 'Create Discount', onClick: onCreate, icon: <Plus className="w-3.5 h-3.5" /> }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader title="All Discounts" subtitle="Every promotion you have created, organised by status." />

      <p className="text-[13px] text-slate-500 px-1">
        Discounts can be applied automatically or require a code at checkout. Use the filter
        tabs to see what&apos;s running, what&apos;s scheduled, and what has ended.
      </p>

      <div className="bg-white border border-slate-200 rounded-sm p-0.5 flex items-center gap-0.5 overflow-x-auto">
        {STATUS_TABS.map((s) => {
          const count = s.id === 'All' ? discounts.length : discounts.filter((d) => d.status === s.id).length;
          const active = statusFilter === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[12px] font-medium whitespace-nowrap transition ${active ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {s.label}
              <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[11px] font-medium ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls + ' pl-9'}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DiscountType | 'All')} className={inputCls + ' sm:max-w-[160px]'}>
          <option value="All">All Types</option>
          <option value="Percentage">Percentage</option>
          <option value="Fixed Amount">Fixed Amount</option>
          <option value="Free Shipping">Free Shipping</option>
          <option value="BOGO">BOGO</option>
          <option value="Bundle">Bundle</option>
          <option value="Tiered">Tiered</option>
        </select>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as Channel | 'All')} className={inputCls + ' sm:max-w-[160px]'}>
          <option value="All">All Channels</option>
          <option value="Website">Website</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="TikTok">TikTok</option>
        </select>
        <button onClick={() => setSelected(filtered.map((d) => d.id))} className={btnSecondary + ' shrink-0'}>
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {selected.length > 0 && (
        <div className="bg-blue-950 text-white rounded-sm px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium">
            {selected.length} discount{selected.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                selected.forEach(onTogglePause);
                setSelected([]);
              }}
              className="bg-white/10 hover:bg-white/20 text-white font-medium px-2.5 py-1.5 rounded-sm text-[12px] inline-flex items-center gap-1.5"
            >
              <Pause className="w-3 h-3" />
              Pause Selected
            </button>
            <button
              onClick={bulkDelete}
              className="bg-red-600 hover:bg-red-500 text-white font-medium px-2.5 py-1.5 rounded-sm text-[12px] inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.length === filtered.length}
                    onChange={selectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="py-2 px-3 font-medium">Discount Name</th>
                <th className="py-2 px-3 font-medium">Code</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium">Value</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Start</th>
                <th className="py-2 px-3 font-medium">End</th>
                <th className="py-2 px-3 font-medium text-right">Uses</th>
                <th className="py-2 px-3 font-medium text-right">Revenue</th>
                <th className="py-2 px-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-[13px]">
                    No discounts match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const revenue = d.usageCount * 1540;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          aria-label={`Select ${d.code}`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {d.image ? (
                            <img
                              src={d.image}
                              alt=""
                              className="w-8 h-8 rounded-sm object-cover border border-slate-200 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[200px]">
                              {d.dealTitle || d.description}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                              {d.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <code className="text-[11px] font-mono text-blue-950 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm">
                          {d.code}
                        </code>
                      </td>
                      <td className="py-2 px-3 text-slate-700">{d.type}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{d.value}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[11px] ${statusBadge(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[12px]">{d.startDate || '—'}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[12px]">{d.endDate || 'No end date'}</td>
                      <td className="py-2 px-3 text-right text-slate-700 font-mono">
                        {d.usageCount.toLocaleString()}
                        {d.usageLimit > 0 && <span className="text-slate-400"> / {d.usageLimit.toLocaleString()}</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700">{KES(revenue)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => onEdit(d)} title="Edit" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-600">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onTogglePause(d.id)} title={d.status === 'Paused' ? 'Resume' : 'Pause'} className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-600">
                            {d.status === 'Paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onDuplicate(d)} title="Duplicate" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-600">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDelete(d.id)} title="Delete" className="p-1.5 rounded-sm hover:bg-red-50 text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA UPLOADER
// ═══════════════════════════════════════════════════════════════════════════

function MediaUploader({
  kind, value, onChange, onError,
}: {
  kind: 'image' | 'video';
  value: string;
  onChange: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState('');

  const maxMb = kind === 'image' ? MAX_IMAGE_MB : MAX_VIDEO_MB;
  const accept = kind === 'image' ? 'image/*' : 'video/mp4,video/quicktime,video/webm';

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;

    const expectedPrefix = kind === 'image' ? 'image/' : 'video/';
    if (!file.type.startsWith(expectedPrefix)) {
      onError(`Only ${kind === 'image' ? 'images' : 'videos'} are allowed here.`);
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      onError(`File is larger than ${maxMb}MB.`);
      return;
    }

    setFilename(file.name);
    setUploading(true);
    setProgress(30);

    try {
      const { url } = await adminApi.discounts.uploadMedia(file);
      setProgress(100);
      onChange(url);
    } catch (err) {
      console.error('Upload failed', err);
      onError(
        err instanceof Error
          ? `Upload failed: ${err.message}`
          : 'Upload failed. Try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    onChange('');
    setFilename('');
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-sm px-3 py-4 text-center cursor-pointer transition ${dragging
          ? 'border-blue-950 bg-blue-50/40'
          : 'border-slate-300 hover:border-blue-950 hover:bg-blue-50/20'
          }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        {kind === 'image' ? (
          <ImageIcon className="w-5 h-5 mx-auto text-slate-400" />
        ) : (
          <VideoIcon className="w-5 h-5 mx-auto text-slate-400" />
        )}
        <p className="text-[13px] text-slate-700 font-medium mt-1">
          {dragging
            ? 'Drop file here'
            : kind === 'image'
              ? 'Drag & drop or click to upload image'
              : 'Drag & drop or click to upload video'}
        </p>
        <p className="text-[12px] text-slate-500 mt-0.5">
          {kind === 'image' ? 'JPG, PNG, WebP' : 'MP4, MOV, WebM'} · max {maxMb}MB
        </p>
      </div>

      {value && (
        <div className="relative border border-slate-200 rounded-sm overflow-hidden bg-slate-100">
          {kind === 'image' ? (
            <img src={value} alt="Preview" className="w-full aspect-[16/9] object-cover" />
          ) : (
            <video src={value} controls className="w-full aspect-[16/9] object-cover" />
          )}

          {uploading && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white">
              <div className="h-1 bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
              <p className="text-[11px] text-center py-1">{Math.round(progress)}%</p>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="absolute top-2 right-2 h-6 w-6 rounded-sm bg-white/90 hover:bg-white text-red-600 flex items-center justify-center shadow"
            aria-label="Remove file"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {filename && (
            <p className="absolute bottom-2 left-2 bg-slate-900/70 text-white text-[11px] px-1.5 py-0.5 rounded-sm font-mono truncate max-w-[80%]">
              {filename}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE / EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════

function DiscountModal({
  initial, onClose, onSave,
}: {
  initial: Discount | null;
  onClose: () => void;
  onSave: (d: Discount) => void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState<Discount>(
    initial ?? {
      id: `disc_${Date.now()}`,
      code: '',
      description: '',
      type: 'Percentage',
      value: '10%',
      minOrder: 0,
      maxCap: 0,
      usageLimit: 0,
      perCustomer: 1,
      usageCount: 0,
      startDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
      endDate: '',
      status: 'Draft',
      appliesTo: 'Entire Order',
      eligibility: 'All Customers',
      targetAudience: 'All People & Customers',
      isMostDeal: false,
      image: '',
      displayOnDealsPage: true,
      promotionType: 'Percentage Discount',
      dealTitle: '',
      badgeText: '',
      priority: 5,
      linkedProductIds: [],
      linkedCategories: [],
      channels: ['Website'],
      tiktokVideo: '',
    },
  );

  const [trigger, setTrigger] = useState<'automatic' | 'code'>(
    initial ? (initial.code ? 'code' : 'automatic') : 'code',
  );
  const [hasEndDate, setHasEndDate] = useState(!!initial?.endDate);
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  const [announceWhatsApp, setAnnounceWhatsApp] = useState(false);
  const [createTikTokPost, setCreateTikTokPost] = useState(false);
  const [tiktokCaption, setTiktokCaption] = useState('');
  const [section, setSection] = useState(1);
  const [uploadError, setUploadError] = useState('');

  const update = <K extends keyof Discount>(key: K, value: Discount[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const generateCode = () => {
    update('code', generateRandomCode());
  };

  const handleSubmit = (status: DiscountStatus) => {
    onSave({ ...form, status });
  };

  const hasWebsite = form.channels.includes('Website');
  const hasTikTok = form.channels.includes('TikTok');

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-sm w-full max-w-4xl max-h-[94vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">
              {isEdit ? 'Edit Discount' : 'Create Discount'}
            </h3>
            <p className="text-[13px] text-slate-500 truncate">
              {isEdit
                ? `Editing "${initial.dealTitle || initial.code}"`
                : 'Set up a new promotion for your store.'}
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

        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { n: 1, label: 'Details' },
              { n: 2, label: 'Trigger' },
              { n: 3, label: 'Conditions' },
              { n: 4, label: 'Schedule' },
              { n: 5, label: 'Limits' },
              { n: 6, label: 'Display' },
              { n: 7, label: 'Social' },
            ].map((s, i, arr) => (
              <React.Fragment key={s.n}>
                <button
                  type="button"
                  onClick={() => setSection(s.n)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[12px] font-medium whitespace-nowrap border transition ${section === s.n
                    ? 'bg-blue-950 text-white border-blue-950'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${section === s.n ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                  >
                    {s.n}
                  </span>
                  {s.label}
                </button>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-[13px]">
          {section === 1 && (
            <>
              <SectionLabel>1. Discount Details</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Give this promotion a name for your reference and choose how it works.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Discount Name" helper="Internal name, e.g., 'Black Friday 2026' or 'Welcome 10%'" required>
                  <input
                    value={form.dealTitle}
                    onChange={(e) => update('dealTitle', e.target.value)}
                    className={inputCls}
                    placeholder="Weekend Flash Sale"
                  />
                </Field>

                <Field label="Discount Type" required>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const t = e.target.value as DiscountType;
                      update('type', t);
                      update('promotionType', defaultPromotionType(t));
                    }}
                    className={inputCls}
                  >
                    <option value="Percentage">Percentage Off</option>
                    <option value="Fixed Amount">Fixed Amount Off</option>
                    <option value="Free Shipping">Free Shipping</option>
                    <option value="BOGO">Buy X Get Y</option>
                    <option value="Bundle">Bundle Discount</option>
                    <option value="Tiered">Tiered Discount</option>
                  </select>
                </Field>

                <Field label="Discount Value" required>
                  <input
                    value={form.value}
                    onChange={(e) => update('value', e.target.value)}
                    className={inputCls}
                    placeholder={form.type === 'Percentage' ? '15%' : 'KES 500'}
                  />
                </Field>

                <Field
                  label="Maximum Discount Amount"
                  helper="Leave blank for no cap. Useful to prevent large discounts on expensive items."
                >
                  <input
                    type="number"
                    min={0}
                    value={form.maxCap || ''}
                    onChange={(e) => update('maxCap', Number(e.target.value) || 0)}
                    className={inputCls}
                    placeholder="e.g. 1000"
                  />
                </Field>

                <Field label="Short Description">
                  <input
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    className={inputCls}
                    placeholder="15% off all Smart TVs and home entertainment displays"
                  />
                </Field>

                <Field label="Badge Text" helper="Short label shown on the deal card">
                  <input
                    value={form.badgeText}
                    onChange={(e) => update('badgeText', e.target.value)}
                    className={inputCls}
                    placeholder="15% OFF"
                  />
                </Field>
              </div>
            </>
          )}

          {section === 2 && (
            <>
              <SectionLabel>2. Trigger Method</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Choose how customers get this discount.
              </p>

              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 border rounded-sm p-3 cursor-pointer transition ${trigger === 'automatic' ? 'border-blue-950 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <input type="radio" checked={trigger === 'automatic'} onChange={() => setTrigger('automatic')} className="mt-1" />
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">Automatic</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      Applies automatically when conditions are met. No code needed.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 border rounded-sm p-3 cursor-pointer transition ${trigger === 'code' ? 'border-blue-950 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <input type="radio" checked={trigger === 'code'} onChange={() => setTrigger('code')} className="mt-1" />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-slate-900">Coupon Code</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      Customer must enter a code at checkout.
                    </p>
                  </div>
                </label>
              </div>

              {trigger === 'code' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <Field label="Code" helper="Use letters, numbers, and hyphens. Example: SAVE10" required>
                    <div className="flex items-center gap-2">
                      <input
                        value={form.code}
                        onChange={(e) => update('code', e.target.value.toUpperCase())}
                        className={inputCls + ' font-mono'}
                        placeholder="SAVE10"
                      />
                      <button type="button" onClick={generateCode} className={btnSecondary + ' shrink-0'}>
                        <Wand2 className="w-3.5 h-3.5" />
                        Generate
                      </button>
                    </div>
                  </Field>
                  <Field label="Code Prefix" helper="Add a prefix like 'TIKTOK-' for tracking channel-specific codes.">
                    <input className={inputCls} placeholder="e.g. TIKTOK-" />
                  </Field>
                </div>
              )}
            </>
          )}

          {section === 3 && (
            <>
              <SectionLabel>3. Conditions (Who Qualifies)</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Set rules for when this discount applies.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Minimum Order Value" helper="Order must be at least this amount (KES)">
                  <input
                    type="number"
                    min={0}
                    value={form.minOrder || ''}
                    onChange={(e) => update('minOrder', Number(e.target.value) || 0)}
                    className={inputCls}
                    placeholder="e.g. 5000"
                  />
                </Field>

                <Field label="Minimum Quantity" helper="Order must contain at least this many items">
                  <input type="number" min={0} className={inputCls} placeholder="e.g. 2" />
                </Field>

                <Field label="Customer Eligibility">
                  <select
                    value={form.eligibility}
                    onChange={(e) => {
                      const v = e.target.value as Eligibility;
                      update('eligibility', v);
                      update('targetAudience', defaultAudience(v));
                    }}
                    className={inputCls}
                  >
                    <option value="All Customers">All Customers</option>
                    <option value="New Customers Only">New Customers Only (first order)</option>
                    <option value="Repeat Customers Only">Repeat Customers Only</option>
                    <option value="Specific Tags">Specific Customer Tags</option>
                    <option value="Specific Customers">Specific Customers</option>
                  </select>
                </Field>

                <Field label="Product Eligibility" helper="What products this discount applies to">
                  <select
                    value={form.appliesTo}
                    onChange={(e) => update('appliesTo', e.target.value as AppliesTo)}
                    className={inputCls}
                  >
                    <option value="Entire Order">All Products</option>
                    <option value="Specific Products">Specific Products</option>
                    <option value="Specific Categories">Specific Categories</option>
                  </select>
                </Field>
              </div>

              {form.appliesTo === 'Specific Categories' && (
                <Field label="Linked Categories">
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_CATEGORIES.map((cat) => {
                      const on = form.linkedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            update(
                              'linkedCategories',
                              on ? form.linkedCategories.filter((c) => c !== cat) : [...form.linkedCategories, cat],
                            )
                          }
                          className={`px-2 py-1 rounded-sm text-[12px] font-medium border transition ${on ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {form.appliesTo === 'Specific Products' && (
                <Field label="Linked Products">
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-sm p-2">
                    {AVAILABLE_PRODUCTS.map((p) => {
                      const on = form.linkedProductIds.includes(p);
                      return (
                        <label
                          key={p}
                          className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer hover:bg-slate-50 rounded-sm px-1.5 py-1"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              update(
                                'linkedProductIds',
                                on ? form.linkedProductIds.filter((x) => x !== p) : [...form.linkedProductIds, p],
                              )
                            }
                          />
                          {p}
                        </label>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="Channel Eligibility" helper="Pick where this discount runs. An image uploader appears for Website; a video uploader appears for TikTok.">
                <div className="flex flex-wrap gap-2">
                  {(['Website', 'WhatsApp', 'TikTok'] as Channel[]).map((c) => {
                    const on = form.channels.includes(c);
                    return (
                      <label
                        key={c}
                        className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-sm border cursor-pointer transition ${on ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            update('channels', on ? form.channels.filter((x) => x !== c) : [...form.channels, c])
                          }
                          className="hidden"
                        />
                        {c}
                      </label>
                    );
                  })}
                </div>
              </Field>

              {hasWebsite && (
                <div className="border border-blue-200 bg-blue-50/40 rounded-sm p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-950" />
                    <p className="text-[13px] font-semibold text-blue-950">
                      Website Image
                    </p>
                  </div>
                  <p className="text-[12px] text-blue-900 -mt-1">
                    Shown on the storefront deals page, homepage banner, and checkout.
                    Recommended 1200×675 (16:9).
                  </p>
                  <MediaUploader
                    kind="image"
                    value={form.image}
                    onChange={(url) => update('image', url)}
                    onError={setUploadError}
                  />
                </div>
              )}

              {hasTikTok && (
                <div className="border border-pink-200 bg-pink-50/40 rounded-sm p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <VideoIcon className="w-4 h-4 text-pink-700" />
                    <p className="text-[13px] font-semibold text-pink-900">
                      TikTok Video
                    </p>
                  </div>
                  <p className="text-[12px] text-pink-800 -mt-1">
                    Vertical (9:16) recommended. This video is attached to the scheduled
                    TikTok post.
                  </p>
                  <MediaUploader
                    kind="video"
                    value={form.tiktokVideo ?? ''}
                    onChange={(url) => update('tiktokVideo', url)}
                    onError={setUploadError}
                  />
                </div>
              )}
            </>
          )}

          {section === 4 && (
            <>
              <SectionLabel>4. Schedule</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Set when this promotion starts and ends.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Start Date & Time">
                  <input
                    type="datetime-local"
                    value={form.startDate.replace(' ', 'T')}
                    onChange={(e) => update('startDate', e.target.value.replace('T', ' '))}
                    className={inputCls}
                  />
                </Field>
                <Field label="End Date & Time">
                  <input
                    type="datetime-local"
                    value={form.endDate ? form.endDate.replace(' ', 'T') : ''}
                    onChange={(e) => update('endDate', e.target.value.replace('T', ' '))}
                    className={inputCls}
                    disabled={!hasEndDate}
                  />
                </Field>
              </div>

              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hasEndDate}
                  onChange={() => {
                    setHasEndDate(!hasEndDate);
                    if (hasEndDate) update('endDate', '');
                  }}
                />
                No End Date (ongoing promotion)
              </label>
            </>
          )}

          {section === 5 && (
            <>
              <SectionLabel>5. Usage Limits</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Control how many times this discount can be used.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Total Usage Limit" helper="Maximum total redemptions. Leave blank for unlimited.">
                  <input
                    type="number"
                    min={0}
                    value={form.usageLimit || ''}
                    onChange={(e) => update('usageLimit', Number(e.target.value) || 0)}
                    className={inputCls}
                    placeholder="e.g. 300"
                  />
                </Field>
                <Field label="Per Customer Limit" helper="How many times one customer can use this. Default: 1.">
                  <input
                    type="number"
                    min={0}
                    value={form.perCustomer}
                    onChange={(e) => update('perCustomer', Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </Field>
              </div>

              <label className="inline-flex items-start gap-2 text-[13px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firstOrderOnly}
                  onChange={() => setFirstOrderOnly(!firstOrderOnly)}
                  className="mt-0.5"
                />
                <span>
                  First Order Only
                  <span className="block text-[12px] text-slate-500 mt-0.5">
                    Restrict to customers who have never ordered.
                  </span>
                </span>
              </label>
            </>
          )}

          {section === 6 && (
            <>
              <SectionLabel>6. Display Settings</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Control how this discount appears to customers. To change the image, use the
                Website channel in Section 3.
              </p>

              <div className="space-y-2">
                <ToggleRow
                  label="Show on Storefront Banner"
                  helper="Display a banner on the homepage."
                  checked={showBanner}
                  onChange={() => setShowBanner(!showBanner)}
                />
                {showBanner && (
                  <Field label="Banner Text">
                    <input
                      value={bannerText}
                      onChange={(e) => setBannerText(e.target.value)}
                      className={inputCls}
                      placeholder="Use code SAVE10 for 10% off your first order!"
                    />
                  </Field>
                )}

                <ToggleRow
                  label="Show Countdown Timer"
                  helper="Display time remaining for flash sales."
                  checked={showCountdown}
                  onChange={() => setShowCountdown(!showCountdown)}
                />

                <ToggleRow
                  label="Display on Deals Page"
                  helper="Show this promotion on the storefront's Special Deals page."
                  checked={form.displayOnDealsPage}
                  onChange={() => update('displayOnDealsPage', !form.displayOnDealsPage)}
                />

                <ToggleRow
                  label="Mark as Most Deal"
                  helper="Highlight this on the Special Deals page as a featured promotion."
                  checked={form.isMostDeal}
                  onChange={() => update('isMostDeal', !form.isMostDeal)}
                />

                <Field label="Priority" helper="Higher numbers surface first on the deals page.">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.priority}
                    onChange={(e) => update('priority', Number(e.target.value) || 1)}
                    className={inputCls + ' max-w-[100px]'}
                  />
                </Field>
              </div>

              {hasWebsite && form.image && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Storefront preview
                  </p>
                  <div className="max-w-[220px] border border-slate-200 rounded-sm overflow-hidden">
                    <div className="relative aspect-square bg-slate-100">
                      <img src={form.image} alt="" className="w-full h-full object-cover" />
                      {form.badgeText && (
                        <span className="absolute top-2 left-2 bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded-sm">
                          {form.badgeText}
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-slate-500 uppercase truncate">
                        {form.dealTitle || 'Promotion'}
                      </p>
                      <p className="text-[12px] font-semibold text-slate-900 truncate mt-0.5">
                        {form.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <code className="text-[10px] font-mono text-blue-950 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded-sm">
                          {form.code || 'AUTO'}
                        </code>
                        <span className="text-[11px] font-medium text-red-600">{form.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {section === 7 && (
            <>
              <SectionLabel>7. TikTok &amp; WhatsApp Promotion</SectionLabel>
              <p className="text-[12px] text-slate-500 -mt-2">
                Push this discount to your social and messaging channels. To change the
                TikTok video, use the TikTok channel in Section 3.
              </p>

              <div className="space-y-2">
                <ToggleRow
                  label="Announce on WhatsApp"
                  helper="Send a broadcast to opted-in customers."
                  checked={announceWhatsApp}
                  onChange={() => setAnnounceWhatsApp(!announceWhatsApp)}
                />
                {announceWhatsApp && (
                  <Field label="WhatsApp Broadcast Template">
                    <select className={inputCls}>
                      <option>Promotional Broadcast</option>
                      <option>Weekend Flash</option>
                      <option>VIP Early Access</option>
                    </select>
                  </Field>
                )}

                <ToggleRow
                  label="Create TikTok Post"
                  helper="Schedule a TikTok post announcing this promotion."
                  checked={createTikTokPost}
                  onChange={() => {
                    setCreateTikTokPost(!createTikTokPost);
                    if (!createTikTokPost && !tiktokCaption) {
                      setTiktokCaption(
                        `🔥 ${form.dealTitle || 'Special offer'}! ${form.value} off with code ${form.code}. Shop now!`,
                      );
                    }
                  }}
                />

                {createTikTokPost && (
                  <>
                    {!form.tiktokVideo && (
                      <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2 text-[12px] text-amber-900">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span>
                            No video attached yet. Select the <strong>TikTok</strong> channel
                            in Section 3 to upload one.
                          </span>
                          <button
                            type="button"
                            onClick={() => setSection(3)}
                            className="block font-medium text-amber-900 hover:underline mt-1"
                          >
                            Go to Section 3 →
                          </button>
                        </div>
                      </div>
                    )}

                    {form.tiktokVideo && (
                      <div className="border border-pink-100 bg-pink-50/40 rounded-sm p-2">
                        <p className="text-[12px] font-medium text-pink-900 mb-1.5">
                          Attached video
                        </p>
                        <video
                          src={form.tiktokVideo}
                          controls
                          className="w-full max-w-[240px] aspect-[9/16] rounded-sm bg-black object-cover"
                        />
                      </div>
                    )}

                    <Field
                      label="TikTok Caption"
                      helper="Pre-filled with an AI-generated caption. Edit before posting."
                    >
                      <textarea
                        rows={3}
                        value={tiktokCaption}
                        onChange={(e) => setTiktokCaption(e.target.value)}
                        className={inputCls + ' resize-none'}
                      />
                    </Field>
                  </>
                )}
              </div>
            </>
          )}

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-2 flex items-start gap-2 text-[12px] text-red-800">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">{uploadError}</span>
              <button
                onClick={() => setUploadError('')}
                className="text-red-600 hover:text-red-900 shrink-0"
                aria-label="Dismiss upload error"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 bg-white">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSection((s) => Math.max(1, s - 1))}
              disabled={section === 1}
              className={btnSecondary + ' disabled:opacity-40'}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setSection((s) => Math.min(7, s + 1))}
              disabled={section === 7}
              className={btnSecondary + ' disabled:opacity-40'}
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={() => handleSubmit('Draft')} className={btnSecondary}>
              Save as Draft
            </button>
            <button type="button" onClick={() => handleSubmit('Active')} className={btnPrimary}>
              <Check className="w-3.5 h-3.5" />
              {isEdit ? 'Save Changes' : 'Publish Discount'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultPromotionType(t: DiscountType): string {
  switch (t) {
    case 'Percentage': return 'Percentage Discount';
    case 'Fixed Amount': return 'Fixed Amount Discount';
    case 'Free Shipping': return 'Free Shipping';
    case 'BOGO': return 'BOGO';
    case 'Bundle': return 'Bundle Discount';
    case 'Tiered': return 'Tiered Discount';
  }
}

function defaultAudience(e: Eligibility): string {
  switch (e) {
    case 'All Customers': return 'All People & Customers';
    case 'New Customers Only': return 'New Customers';
    case 'Repeat Customers Only': return 'Repeat Customers';
    case 'Specific Tags': return 'Tagged Customers';
    case 'Specific Customers': return 'Selected Customers';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  return (
    <div className="space-y-3">
      <PageHeader
        title="Discount Analytics"
        subtitle="Track how your promotions perform and which codes drive the most sales."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard label="Total Discounts Given" value={KES(120653)} helper="Total KES discounted this month" icon={<DollarSign className="w-4 h-4" />} tint="bg-rose-50 text-rose-700" />
        <KpiCard label="Total Redemptions" value="824" helper="Times discounts were used" icon={<Tag className="w-4 h-4" />} tint="bg-blue-50 text-blue-950" />
        <KpiCard label="Revenue from Discounts" value={KES(1084400)} helper="Total sales from orders using discounts" icon={<TrendingUp className="w-4 h-4" />} tint="bg-emerald-50 text-emerald-700" />
        <KpiCard label="AOV (Discounted)" value={KES(1316)} helper="vs. KES 1540 on non-discounted orders" icon={<Calculator className="w-4 h-4" />} tint="bg-indigo-50 text-indigo-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Redemptions Over Time" subtitle="Daily/weekly usage">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={REDEMPTIONS_OVER_TIME}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="redemptions" stroke="#172554" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by Discount" subtitle="Top-performing promotions">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={REVENUE_BY_DISCOUNT}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="revenue" fill="#172554" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Discount Type Breakdown" subtitle="Redemptions per type">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={TYPE_BREAKDOWN} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {TYPE_BREAKDOWN.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Channel Breakdown" subtitle="Redemptions per channel">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={CHANNEL_BREAKDOWN} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {CHANNEL_BREAKDOWN.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-semibold text-slate-900">Top Performing Discounts</p>
          <p className="text-[12px] text-slate-500 mt-0.5">
            ROI = Revenue ÷ Discount Given. A higher ROI means the promotion is paying for itself.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-3 font-medium">Discount</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium text-right">Redemptions</th>
                <th className="py-2 px-3 font-medium text-right">Revenue</th>
                <th className="py-2 px-3 font-medium text-right">Discount Given</th>
                <th className="py-2 px-3 font-medium text-right">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { code: 'SAVE10', type: '10% off', red: 245, revenue: 367500, disc: 36750, roi: 10.0 },
                { code: 'FREESHIP', type: 'Free shipping', red: 189, revenue: 283500, disc: 18900, roi: 15.0 },
                { code: 'VIP15', type: '15% off', red: 67, revenue: 201000, disc: 30150, roi: 6.7 },
              ].map((r) => (
                <tr key={r.code} className="hover:bg-slate-50">
                  <td className="py-2 px-3">
                    <code className="text-[11px] font-mono text-blue-950 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm">
                      {r.code}
                    </code>
                  </td>
                  <td className="py-2 px-3 text-slate-600">{r.type}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.red}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">{KES(r.revenue)}</td>
                  <td className="py-2 px-3 text-right font-mono text-rose-700">{KES(r.disc)}</td>
                  <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700">{r.roi.toFixed(1)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RULES
// ═══════════════════════════════════════════════════════════════════════════

function RulesTab({ onToast }: { onToast: (msg: string) => void }) {
  const conditions = [
    { name: 'Cart Value', example: 'Cart ≥ KES 5,000' },
    { name: 'Product Quantity', example: 'Quantity ≥ 3' },
    { name: 'Product Category', example: 'Category = "Accessories"' },
    { name: 'Specific Product', example: 'Product ID = 123' },
    { name: 'Customer Tag', example: 'Tag = "VIP"' },
    { name: 'Customer Order Count', example: 'Orders ≤ 1 (first order)' },
    { name: 'Customer Total Spent', example: 'Total spent ≥ KES 50,000' },
    { name: 'Day of Week', example: 'Day = Friday' },
    { name: 'Time of Day', example: 'Time between 6 PM–10 PM' },
    { name: 'Channel', example: 'Channel = WhatsApp' },
  ];
  const actions = [
    { name: 'Create Adjustment', example: '-15% on order total' },
    { name: 'Free Shipping', example: 'Shipping = KES 0' },
    { name: 'Add Gift Item', example: 'Add "Sample Sachet"' },
    { name: 'Send Notification', example: 'Send "Promo applied!"' },
  ];

  return (
    <div className="space-y-3">
      <PageHeader title="Promotion Rules" subtitle="Build complex conditions for when discounts apply." />

      <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 text-[13px] text-blue-900">
        Rules let you combine conditions with AND/OR logic. Use the simulator to preview how
        a rule behaves against sample orders before publishing.
      </div>

      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-semibold text-slate-900">Example Rule Tree</p>
          <p className="text-[12px] text-slate-500 mt-0.5">
            This is how the rule engine evaluates conditions and actions.
          </p>
        </div>
        <div className="p-3 space-y-2 text-[13px] font-mono text-slate-800">
          <p className="font-semibold text-blue-950">IF</p>
          <div className="pl-5 space-y-1 border-l-2 border-slate-200 ml-1">
            <p>├── Cart Value ≥ KES 5,000</p>
            <p>└── AND Customer Tag = &quot;VIP&quot;</p>
          </div>
          <p className="font-semibold text-emerald-700 pt-1">THEN</p>
          <div className="pl-5 border-l-2 border-slate-200 ml-1">
            <p>└── Apply 20% discount</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-[13px] font-semibold text-slate-900">Condition Types</p>
            <p className="text-[12px] text-slate-500 mt-0.5">Building blocks for the &quot;IF&quot; side of a rule.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Condition</th>
                  <th className="py-2 px-3 font-medium">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conditions.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono text-[12px]">{c.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-[13px] font-semibold text-slate-900">Action Types</p>
            <p className="text-[12px] text-slate-500 mt-0.5">What happens when the conditions match.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Action</th>
                  <th className="py-2 px-3 font-medium">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((a) => (
                  <tr key={a.name} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-900">{a.name}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono text-[12px]">{a.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Rule Builder</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              No rules configured yet for this promotion. Add conditions to control when
              this discount applies.
            </p>
          </div>
          <button onClick={() => onToast('Rule builder would open')} className={btnPrimary}>
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <span className="w-12 h-12 rounded-sm bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Settings2 className="w-6 h-6" />
            </span>
            <p className="text-[13px] text-slate-500">
              Rules combine conditions with AND/OR logic. Every condition must be satisfied
              (for AND) or at least one must be satisfied (for OR) before the action runs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PIECES
// ═══════════════════════════════════════════════════════════════════════════

const inputCls =
  'w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:bg-slate-50 disabled:text-slate-500';

const btnPrimary =
  'inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]';

const btnSecondary =
  'inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]';

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide pt-1">
      {children}
    </p>
  );
}

function Field({
  label, helper, required, children,
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

function ToggleRow({
  label, helper, checked, onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer border border-slate-200 rounded-sm p-2 hover:bg-slate-50">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{helper}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onChange();
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors mt-1 ${checked ? 'bg-blue-950' : 'bg-slate-300'
          }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'
            }`}
        />
      </button>
    </label>
  );
}

function KpiCard({
  label, value, helper, icon, tint,
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
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{helper}</p>
      </div>
      <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
        {icon}
      </span>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}

function EmptyState({
  icon, title, action,
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

function statusBadge(s: DiscountStatus): string {
  switch (s) {
    case 'Active': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Scheduled': return 'bg-blue-50 text-blue-950 border-blue-100';
    case 'Expired': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Paused': return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'Draft': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  }
}