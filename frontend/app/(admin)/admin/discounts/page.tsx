'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tag, Plus, Search, X, CheckCircle2,
  Play, Pause, Copy, Trash2, Edit3,
  TrendingUp, Check, Image as ImageIcon, Video as VideoIcon,
  AlertCircle, BarChart3, Wand2,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type { AdminDiscount, AdminDiscountWrite } from '@/lib/admin-types';

type Tab = 'Overview' | 'All Discounts' | 'Analytics';
type DiscountStatus = 'Active' | 'Scheduled' | 'Expired' | 'Draft' | 'Paused';
type DiscountType = 'Percentage' | 'Fixed Amount' | 'Free Shipping' | 'BOGO' | 'Bundle' | 'Tiered';
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

interface RedemptionPoint {
  day: string;
  redemptions: number;
}

interface RevenuePoint {
  name: string;
  revenue: number;
}

interface AnalyticsPayload {
  redemptionsOverTime?: RedemptionPoint[];
  revenueByDiscount?: RevenuePoint[];
  totalUses?: number;
  revenueFromDiscounts?: number;
  bestDiscountCode?: string;
}

interface PickerProduct {
  id: string;
  name: string;
  brand: string;
}

interface PickerCategory {
  id: number;
  name: string;
}

function nowLocalForm(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

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

function formDateToIso(form: string): string {
  if (!form) return new Date().toISOString();
  const dt = new Date(form.replace(' ', 'T'));
  if (Number.isNaN(dt.getTime())) return new Date().toISOString();
  return dt.toISOString();
}

function toLocalInputValue(form: string): string {
  if (!form) return '';
  return form.replace(' ', 'T');
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function extractName(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'name' in raw) {
    const name = (raw as { name: unknown }).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function fromBackend(d: AdminDiscount): Discount {
  return {
    id: String(d.id),
    code: d.code,
    description: d.description,
    type: d.type as DiscountType,
    value: d.value,
    minOrder: d.minOrder ?? 0,
    maxCap: d.maxCap ?? 0,
    usageLimit: d.usageLimit ?? 0,
    perCustomer: d.perCustomer ?? 1,
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
    priority: d.priority ?? 5,
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

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'Overview', label: 'Overview', icon: BarChart3 },
  { id: 'All Discounts', label: 'All Discounts', icon: Tag },
  { id: 'Analytics', label: 'Analytics', icon: TrendingUp },
];

const STATUS_TABS: { id: DiscountStatus | 'All'; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Paused', label: 'Paused' },
  { id: 'Draft', label: 'Draft' },
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

  const saveDiscount = async (d: Discount) => {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {toast && (
        <div className="fixed bottom-4 right-4 z-[120] bg-slate-900 text-white px-3 py-2 rounded flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded bg-blue-950 text-white flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-900 truncate">
                Discounts
              </h1>
              <p className="text-[13px] text-slate-500 truncate">
                Run promotions and discount codes for your store
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px] shrink-0"
          >
            <Plus className="w-3 h-3" />
            Create Discount
          </button>
        </div>

        <div className="max-w-[1700px] mx-auto px-2 pb-0">
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

      <main className="max-w-[1700px] mx-auto px-0.5 py-2.5 space-y-2">
        {loading && (
          <div className="bg-white border border-slate-200 rounded p-6 text-center text-[13px] text-slate-500">
            Loading discounts…
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded p-2.5 flex items-start gap-2 text-[13px] text-red-800">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
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
        {!loading && !error && tab === 'Analytics' && (
          <AnalyticsTab discounts={discounts} />
        )}
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

function OverviewTab({
  discounts, onCreate, onJumpToList,
}: {
  discounts: Discount[];
  onCreate: () => void;
  onJumpToList: () => void;
}) {
  const active = useMemo(() => discounts.filter((d) => d.status === 'Active'), [discounts]);
  const scheduled = useMemo(() => discounts.filter((d) => d.status === 'Scheduled'), [discounts]);
  const redemptions = useMemo(
    () => discounts.reduce((s, d) => s + d.usageCount, 0),
    [discounts],
  );

  if (discounts.length === 0) {
    return (
      <div className="space-y-2">
        <PageHeader
          title="Discounts"
          subtitle="No promotions yet — create your first to start driving sales."
        />
        <EmptyState
          icon={<Tag className="w-5 h-5" />}
          title="Create your first promotion to start driving sales."
          action={{ label: 'Create Discount', onClick: onCreate, icon: <Plus className="w-3 h-3" /> }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="Active"
          value={String(active.length)}
          helper="Live promotions"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          tint="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          label="Scheduled"
          value={String(scheduled.length)}
          helper="Starting soon"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          tint="bg-blue-50 text-blue-950"
        />
        <KpiCard
          label="Total uses"
          value={redemptions.toLocaleString()}
          helper="All-time redemptions"
          icon={<Tag className="w-3.5 h-3.5" />}
          tint="bg-indigo-50 text-indigo-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <PromotionList
          title="Running now"
          emptyLabel="No active discounts."
          items={active}
          onViewAll={onJumpToList}
        />
        <PromotionList
          title="Coming up"
          emptyLabel="No scheduled discounts."
          items={scheduled}
          onViewAll={onJumpToList}
        />
      </div>
    </div>
  );
}

function PromotionList({
  title, emptyLabel, items, onViewAll,
}: {
  title: string;
  emptyLabel: string;
  items: Discount[];
  onViewAll: () => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-slate-900">{title}</p>
          <span className="text-[13px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        </div>
        <button onClick={onViewAll} className="text-[13px] font-medium text-blue-950 hover:underline">
          View all →
        </button>
      </div>
      <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {items.length === 0 ? (
          <li className="py-6 text-center text-[13px] text-slate-400">{emptyLabel}</li>
        ) : (
          items.map((d) => (
            <li key={d.id} className="px-3 py-2 flex items-center gap-2">
              <span className="w-1 h-9 rounded bg-blue-950 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {d.dealTitle || d.description}
                  </p>
                  <code className="text-[13px] font-mono text-blue-950 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded shrink-0">
                    {d.code}
                  </code>
                </div>
                <p className="text-[13px] text-slate-500 truncate mt-0.5">
                  {d.type} · {d.value} · {d.usageCount.toLocaleString()} uses
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

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

  const filtered = discounts.filter((d) => {
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.code.toLowerCase().includes(q) ||
      d.dealTitle.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  if (discounts.length === 0) {
    return (
      <div className="space-y-2">
        <PageHeader
          title="All Discounts"
          subtitle="No promotions yet — create your first to start driving sales."
        />
        <EmptyState
          icon={<Tag className="w-5 h-5" />}
          title="Create your first promotion to start driving sales."
          action={{ label: 'Create Discount', onClick: onCreate, icon: <Plus className="w-3 h-3" /> }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-white border border-slate-200 rounded p-0.5 flex items-center gap-0.5 overflow-x-auto">
        {STATUS_TABS.map((s) => {
          const count = s.id === 'All' ? discounts.length : discounts.filter((d) => d.status === s.id).length;
          const active = statusFilter === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[13px] font-medium whitespace-nowrap transition ${active ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {s.label}
              <span className={`inline-block px-1.5 py-0.5 rounded text-[13px] font-medium ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded p-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls + ' pl-8'}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-2 font-medium">Discount</th>
                <th className="py-2 px-2 font-medium">Value</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium text-right">Uses</th>
                <th className="py-2 px-2 font-medium">Ends</th>
                <th className="py-2 px-2 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-[13px]">
                    No discounts match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {d.image ? (
                          <img
                            src={d.image}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-[220px]">
                            {d.dealTitle || d.description || d.code}
                          </p>
                          <code className="text-[12px] font-mono text-blue-950">
                            {d.code}
                          </code>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <span className="font-medium text-slate-900">{d.value}</span>
                      <span className="block text-[12px] text-slate-400">{d.type}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[13px] font-medium border ${statusBadge(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 font-mono">
                      {d.usageCount.toLocaleString()}
                      {d.usageLimit > 0 && <span className="text-slate-400"> / {d.usageLimit.toLocaleString()}</span>}
                    </td>
                    <td className="py-2 px-2 text-slate-500 font-mono text-[12px]">
                      {d.endDate || 'Ongoing'}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => onEdit(d)} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onTogglePause(d.id)} title={d.status === 'Paused' ? 'Resume' : 'Pause'} className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                          {d.status === 'Paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => onDuplicate(d)} title="Duplicate" className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(d.id)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-600">
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
    </div>
  );
}

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
    <div className="space-y-1.5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`w-full border-2 border-dashed rounded px-3 py-4 text-center cursor-pointer transition ${dragging
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
        <div className="relative border border-slate-200 rounded overflow-hidden bg-slate-100">
          {kind === 'image' ? (
            <img src={value} alt="Preview" className="w-full aspect-[16/9] object-cover" />
          ) : (
            <video src={value} controls className="w-full aspect-[16/9] object-cover" />
          )}

          {uploading && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white">
              <div className="h-1 bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
              <p className="text-[13px] text-center py-1">{Math.round(progress)}%</p>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="absolute top-2 right-2 h-6 w-6 rounded bg-white/90 hover:bg-white text-red-600 flex items-center justify-center shadow"
            aria-label="Remove file"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {filename && (
            <p className="absolute bottom-2 left-2 bg-slate-900/70 text-white text-[12px] px-1.5 py-0.5 rounded font-mono truncate max-w-[80%]">
              {filename}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
      startDate: nowLocalForm(),
      endDate: '',
      status: 'Draft',
      appliesTo: 'Specific Products',
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
    initial?.code ? 'code' : 'code',
  );
  const [hasEndDate, setHasEndDate] = useState<boolean>(
    initial ? !!initial.endDate : true,
  );
  const [section, setSection] = useState(1);
  const [uploadError, setUploadError] = useState('');

  const [allProducts, setAllProducts] = useState<PickerProduct[]>([]);
  const [allCategories, setAllCategories] = useState<PickerCategory[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPickerLoading(true);
    setPickerError('');

    (async () => {
      try {
        const apiAny = adminApi as any;
        const productsApi =
          apiAny.products?.list ??
          apiAny.catalog?.products?.list ??
          null;
        const categoriesApi =
          apiAny.categories?.list ??
          apiAny.catalog?.categories?.list ??
          null;

        if (!productsApi || !categoriesApi) {
          throw new Error('adminApi.products/categories not available');
        }

        const [p, c] = await Promise.all([
          productsApi({ page_size: 500 }),
          categoriesApi(),
        ]);

        if (cancelled) return;

        const productList = Array.isArray(p) ? p : (p?.results ?? []);
        const categoryList = Array.isArray(c) ? c : (c?.results ?? []);

        setAllProducts(
          productList.map((x: any) => ({
            id: String(x.id),
            name: extractName(x.name),
            brand: extractName(x.brand) || extractName(x.brand_name),
          })),
        );
        setAllCategories(
          categoryList.map((x: any) => ({
            id: Number(x.id),
            name: extractName(x.name),
          })),
        );
      } catch (err) {
        if (cancelled) return;
        console.error('[DiscountModal] picker load failed', err);
        setPickerError('Could not load products/categories for the picker.');
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof Discount>(key: K, value: Discount[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const generateCode = () => {
    update('code', generateRandomCode());
  };

  const handleSubmit = (status: DiscountStatus) => {
    if (
      form.appliesTo === 'Specific Products' &&
      form.linkedProductIds.length === 0
    ) {
      alert(
        'Pick at least one product in step 4. Products, or switch "Applies to" to "Entire Order".',
      );
      setSection(4);
      return;
    }
    if (
      form.appliesTo === 'Specific Categories' &&
      form.linkedCategories.length === 0
    ) {
      alert(
        'Pick at least one category in step 4. Products, or switch "Applies to" to "Entire Order".',
      );
      setSection(4);
      return;
    }
    onSave({ ...form, status });
  };

  const hasWebsite = form.channels.includes('Website');
  const hasTikTok = form.channels.includes('TikTok');

  const needsProductsWarning =
    form.appliesTo === 'Specific Products' && form.linkedProductIds.length === 0;
  const needsCategoriesWarning =
    form.appliesTo === 'Specific Categories' && form.linkedCategories.length === 0;

  const filteredProducts = allProducts.filter((p) => {
    const q = productSearch.toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded w-full max-w-3xl max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">
              {isEdit ? 'Edit discount' : 'Create discount'}
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
            className="h-8 w-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { n: 1, label: 'Promotion' },
              { n: 2, label: 'Schedule' },
              { n: 3, label: 'Where & display' },
              { n: 4, label: 'Products' },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setSection(s.n)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium whitespace-nowrap border transition ${section === s.n
                  ? 'bg-blue-950 text-white border-blue-950'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[11px] font-semibold ${section === s.n ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  {s.n}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
          {section === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Promotion name" required>
                  <input
                    value={form.dealTitle}
                    onChange={(e) => update('dealTitle', e.target.value)}
                    className={inputCls}
                    placeholder="Weekend Flash Sale"
                  />
                </Field>

                <Field label="Discount type" required>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const t = e.target.value as DiscountType;
                      update('type', t);
                      update('promotionType', defaultPromotionType(t));
                    }}
                    className={inputCls}
                  >
                    <option value="Percentage">Percentage off</option>
                    <option value="Fixed Amount">Fixed amount off</option>
                    <option value="Free Shipping">Free shipping</option>
                    <option value="BOGO">Buy X Get Y</option>
                    <option value="Bundle">Bundle discount</option>
                    <option value="Tiered">Tiered discount</option>
                  </select>
                </Field>

                <Field label="Discount value" required>
                  <input
                    value={form.value}
                    onChange={(e) => update('value', e.target.value)}
                    className={inputCls}
                    placeholder={form.type === 'Percentage' ? '15%' : 'KES 500'}
                  />
                </Field>

                <Field label="Minimum order" helper="Optional — leave blank for any amount">
                  <input
                    type="number"
                    min={0}
                    value={form.minOrder || ''}
                    onChange={(e) => update('minOrder', Number(e.target.value) || 0)}
                    className={inputCls}
                    placeholder="e.g. 5000"
                  />
                </Field>
              </div>

              <div className="border-t border-slate-100 pt-2 space-y-2">
                <p className="text-[13px] font-medium text-slate-700">
                  How customers apply this discount
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2 border rounded p-2 cursor-pointer transition ${trigger === 'automatic' ? 'border-blue-950 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <input type="radio" checked={trigger === 'automatic'} onChange={() => setTrigger('automatic')} className="mt-1" />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Automatic</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        Applies at checkout without a code.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 border rounded p-2 cursor-pointer transition ${trigger === 'code' ? 'border-blue-950 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <input type="radio" checked={trigger === 'code'} onChange={() => setTrigger('code')} className="mt-1" />
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">Coupon code</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        Customer enters a code at checkout.
                      </p>
                    </div>
                  </label>
                </div>

                {trigger === 'code' && (
                  <Field label="Code" helper="Letters, numbers, and hyphens" required>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={form.code}
                        onChange={(e) => update('code', e.target.value.toUpperCase())}
                        className={inputCls + ' font-mono'}
                        placeholder="SAVE10"
                      />
                      <button type="button" onClick={generateCode} className={btnSecondary + ' shrink-0'}>
                        <Wand2 className="w-3 h-3" />
                        Generate
                      </button>
                    </div>
                  </Field>
                )}
              </div>
            </>
          )}

          {section === 2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Starts">
                  <input
                    type="datetime-local"
                    value={toLocalInputValue(form.startDate)}
                    onChange={(e) => update('startDate', e.target.value.replace('T', ' '))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="datetime-local"
                    value={toLocalInputValue(form.endDate)}
                    onChange={(e) => update('endDate', e.target.value.replace('T', ' '))}
                    className={inputCls + ' disabled:bg-slate-50 disabled:text-slate-500'}
                  />
                </Field>
              </div>

              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hasEndDate}
                  onChange={() => {
                    const next = !hasEndDate;
                    setHasEndDate(next);
                    if (!next) update('endDate', '');
                  }}
                />
                No end date (runs indefinitely)
              </label>

              <div className="border-t border-slate-100 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Total uses allowed" helper="Leave blank for unlimited">
                  <input
                    type="number"
                    min={0}
                    value={form.usageLimit || ''}
                    onChange={(e) => update('usageLimit', Number(e.target.value) || 0)}
                    className={inputCls}
                    placeholder="e.g. 300"
                  />
                </Field>
                <Field label="Uses per customer" helper="Default: 1">
                  <input
                    type="number"
                    min={0}
                    value={form.perCustomer ?? 1}
                    onChange={(e) => update('perCustomer', Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </>
          )}

          {section === 3 && (
            <>
              <Field label="Channels" helper="Where this promotion runs. Upload an image for Website, a video for TikTok.">
                <div className="flex flex-wrap gap-1.5">
                  {(['Website', 'WhatsApp', 'TikTok'] as Channel[]).map((c) => {
                    const on = form.channels.includes(c);
                    return (
                      <label
                        key={c}
                        className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1.5 rounded border cursor-pointer transition ${on ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
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

              <div className="border-t border-slate-100 pt-2 space-y-2">
                <p className="text-[13px] font-medium text-slate-700">On the storefront</p>

                <label className="flex items-center justify-between gap-3 border border-slate-200 rounded p-2 cursor-pointer hover:bg-slate-50">
                  <span className="text-[13px] text-slate-700">Show on Deals page</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.displayOnDealsPage}
                    onClick={(e) => { e.preventDefault(); update('displayOnDealsPage', !form.displayOnDealsPage); }}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${form.displayOnDealsPage ? 'bg-blue-950' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.displayOnDealsPage ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between gap-3 border border-slate-200 rounded p-2 cursor-pointer hover:bg-slate-50">
                  <span className="text-[13px] text-slate-700">Feature as top deal</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isMostDeal}
                    onClick={(e) => { e.preventDefault(); update('isMostDeal', !form.isMostDeal); }}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${form.isMostDeal ? 'bg-blue-950' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.isMostDeal ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </label>

                <Field label="Badge text" helper="Short label on the deal card (e.g. '15% OFF')">
                  <input
                    value={form.badgeText}
                    onChange={(e) => update('badgeText', e.target.value)}
                    className={inputCls}
                    placeholder="15% OFF"
                  />
                </Field>
              </div>

              {hasWebsite && (
                <div className="border-t border-slate-100 pt-2">
                  <Field label="Storefront image" helper="Shown on the deals page and checkout. Recommended 1200×675.">
                    <MediaUploader
                      kind="image"
                      value={form.image}
                      onChange={(url) => update('image', url)}
                      onError={setUploadError}
                    />
                  </Field>
                </div>
              )}

              {hasTikTok && (
                <div className="border-t border-slate-100 pt-2">
                  <Field label="TikTok video" helper="Vertical (9:16) recommended.">
                    <MediaUploader
                      kind="video"
                      value={form.tiktokVideo ?? ''}
                      onChange={(url) => update('tiktokVideo', url)}
                      onError={setUploadError}
                    />
                  </Field>
                </div>
              )}

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2 text-[13px] text-red-800">
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
            </>
          )}

          {section === 4 && (
            <>
              <Field
                label="Applies to"
                helper="Choose which products this discount affects. 'Specific Products' only affects the items you pick below."
                required
              >
                <select
                  value={form.appliesTo}
                  onChange={(e) => update('appliesTo', e.target.value as AppliesTo)}
                  className={inputCls}
                >
                  <option value="Specific Products">Specific Products (recommended)</option>
                  <option value="Specific Categories">Specific Categories</option>
                  <option value="Entire Order">Entire Order (all products)</option>
                </select>
              </Field>

              {form.appliesTo === 'Specific Products' && (
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-slate-700">
                      Products in this deal
                      <span className="ml-1.5 text-slate-400 font-normal">
                        ({form.linkedProductIds.length} selected)
                      </span>
                    </p>
                    {form.linkedProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => update('linkedProductIds', [])}
                        className="text-[12px] text-slate-500 hover:text-red-600"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {needsProductsWarning && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[12px] px-2 py-1.5 rounded">
                      This discount applies to specific products, but none are selected. Pick at least one product or the deal won't show on the storefront.
                    </div>
                  )}

                  {pickerError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-[12px] px-2 py-1.5 rounded">
                      {pickerError}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search products by name or brand…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className={inputCls + ' pl-8'}
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-white">
                    {pickerLoading ? (
                      <p className="px-3 py-6 text-center text-[12px] text-slate-400">
                        Loading products…
                      </p>
                    ) : filteredProducts.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[12px] text-slate-400">
                        {productSearch
                          ? `No products match "${productSearch}".`
                          : 'No products available.'}
                      </p>
                    ) : (
                      filteredProducts.map((p) => {
                        const checked = form.linkedProductIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                update(
                                  'linkedProductIds',
                                  checked
                                    ? form.linkedProductIds.filter((id) => id !== p.id)
                                    : [...form.linkedProductIds, p.id],
                                )
                              }
                              className="accent-blue-950"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-slate-900 truncate">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {p.brand || p.id}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {form.appliesTo === 'Specific Categories' && (
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-slate-700">
                      Categories in this deal
                      <span className="ml-1.5 text-slate-400 font-normal">
                        ({form.linkedCategories.length} selected)
                      </span>
                    </p>
                    {form.linkedCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => update('linkedCategories', [])}
                        className="text-[12px] text-slate-500 hover:text-red-600"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {needsCategoriesWarning && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[12px] px-2 py-1.5 rounded">
                      Pick at least one category or the deal won't show on the storefront.
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-white">
                    {pickerLoading ? (
                      <p className="px-3 py-6 text-center text-[12px] text-slate-400">
                        Loading categories…
                      </p>
                    ) : allCategories.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[12px] text-slate-400">
                        No categories available.
                      </p>
                    ) : (
                      allCategories.map((c) => {
                        const checked = form.linkedCategories.includes(c.name);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                update(
                                  'linkedCategories',
                                  checked
                                    ? form.linkedCategories.filter((n) => n !== c.name)
                                    : [...form.linkedCategories, c.name],
                                )
                              }
                              className="accent-blue-950"
                            />
                            <span className="text-[13px] text-slate-900">
                              {c.name}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {form.appliesTo === 'Entire Order' && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[12px] px-2 py-1.5 rounded">
                  This discount applies to <strong>every product</strong> in the store. Every active product will appear on the deals page with this discount applied.
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-2 py-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 bg-white">
          <div className="flex items-center gap-1.5">
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
              onClick={() => setSection((s) => Math.min(4, s + 1))}
              disabled={section === 4}
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
              <Check className="w-3 h-3" />
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

function AnalyticsTab({ discounts }: { discounts: Discount[] }) {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setAnalyticsLoading(true);
    setAnalyticsError(false);

    (async () => {
      try {
        const raw = await adminApi.discounts.analytics(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setAnalytics(raw as unknown as AnalyticsPayload);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAnalytics(null);
        setAnalyticsError(true);
      } finally {
        if (!ctrl.signal.aborted) setAnalyticsLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, []);

  const totalUses = useMemo(() => {
    if (analytics?.totalUses !== undefined) return analytics.totalUses;
    return discounts.reduce((s, d) => s + d.usageCount, 0);
  }, [discounts, analytics]);

  const revenueFromDiscounts = analytics?.revenueFromDiscounts ?? 0;

  const sortedByUsage = useMemo(
    () => [...discounts].sort((a, b) => b.usageCount - a.usageCount),
    [discounts],
  );

  const bestCode = useMemo(() => {
    if (analytics?.bestDiscountCode) return analytics.bestDiscountCode;
    return sortedByUsage[0]?.code ?? '—';
  }, [analytics, sortedByUsage]);

  const redemptionSeries = analytics?.redemptionsOverTime ?? [];
  const revenueSeries = analytics?.revenueByDiscount ?? [];

  const topDiscounts = sortedByUsage.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <KpiCard
          label="Total uses"
          value={totalUses.toLocaleString()}
          helper="Discounts applied to date"
          icon={<Tag className="w-3.5 h-3.5" />}
          tint="bg-blue-50 text-blue-950"
        />
        <KpiCard
          label="Revenue from discounts"
          value={revenueFromDiscounts ? KES(revenueFromDiscounts) : '—'}
          helper={revenueFromDiscounts ? 'Sales on discounted orders' : 'Awaiting analytics data'}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          tint="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          label="Best discount"
          value={bestCode}
          helper={bestCode === '—' ? 'No discount data yet' : 'Highest usage driver'}
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          tint="bg-indigo-50 text-indigo-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ChartCard title="Redemptions over time" subtitle="Daily usage">
          {redemptionSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={redemptionSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="redemptions" stroke="#172554" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty loading={analyticsLoading} error={analyticsError} />
          )}
        </ChartCard>

        <ChartCard title="Revenue by discount" subtitle="Top-performing codes">
          {revenueSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="revenue" fill="#172554" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty loading={analyticsLoading} error={analyticsError} />
          )}
        </ChartCard>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-semibold text-slate-900">Top Performing Discounts</p>
        </div>
        <div className="overflow-x-auto">
          {topDiscounts.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-slate-400">
              No discounts to rank yet. Create one to see performance here.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-2 font-medium">Discount</th>
                  <th className="py-2 px-2 font-medium">Type</th>
                  <th className="py-2 px-2 font-medium text-right">Redemptions</th>
                  <th className="py-2 px-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDiscounts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2">
                      <code className="text-[13px] font-mono text-blue-950 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                        {d.code}
                      </code>
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {d.value} · {d.type}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{d.usageCount.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[13px] font-medium border ${statusBadge(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartEmpty({ loading, error }: { loading: boolean; error: boolean }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-4">
      {loading ? (
        <p className="text-[13px] text-slate-400">Loading analytics…</p>
      ) : error ? (
        <>
          <AlertCircle className="w-4 h-4 text-amber-500 mb-1" />
          <p className="text-[13px] text-slate-500">Couldn't load analytics.</p>
        </>
      ) : (
        <>
          <BarChart3 className="w-5 h-5 text-slate-300 mb-1" />
          <p className="text-[13px] text-slate-500">No analytics data yet.</p>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Data appears once customers start redeeming.
          </p>
        </>
      )}
    </div>
  );
}

const inputCls =
  'w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 disabled:bg-slate-50 disabled:text-slate-500';

const btnPrimary =
  'inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-1.5 rounded text-[13px]';

const btnSecondary =
  'inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-1.5 rounded text-[13px]';

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
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
      <label className="block text-[13px] font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {helper && <p className="text-[13px] text-slate-500 mt-1">{helper}</p>}
    </div>
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
    <div className="bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
      <span className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${tint}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
        <p className="text-[15px] font-semibold text-slate-900 leading-tight truncate">{value}</p>
        <p className="text-[12px] text-slate-400 mt-0.5 truncate">{helper}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
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
    <div className="max-w-xl mx-auto my-6 bg-white border border-slate-200 rounded p-6 text-center space-y-2">
      <span className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
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