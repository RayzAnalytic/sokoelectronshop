'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Plus, CheckCircle2, XCircle, Info, X, Send,
  Mail, ArrowRight, ArrowLeft, Eye, Trash2,
  Search, Tag, Calendar, Target, BarChart3,
  Snowflake, Rocket, Heart, ShoppingCart, Newspaper, Share2, Check,
  Pause, Play, DollarSign, MousePointerClick, AlertCircle,
  Loader2, RefreshCw,
} from 'lucide-react';
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaTiktok,
  FaYoutube,
  FaTelegram,
} from 'react-icons/fa';
import { adminApi } from '@/lib/admin-api';
import type {
  AdminMetaCampaign,
  AdminMetaCampaignWrite,
  AdminMetaCampaignAnalytics,
  AdminMetaCampaignChannel,
  AdminMetaCampaignStatus,
  AdminMetaCampaignType,
  AdminMetaCampaignAudienceSource,
} from '@/lib/admin-types';

type ToastKind = 'success' | 'error' | 'info';
interface ToastState { kind: ToastKind; message: string; }

type TabKey = 'All' | AdminMetaCampaignStatus;

interface SegmentOption {
  key: string;
  label: string;
  source: 'whatsapp' | 'newsletter';
  refId: number | string;
  size: number;
}

interface TemplateOption { id: string; name: string; status?: string; }
interface ListOption { id: string; name: string; size?: number; }

type ReactIcon = React.ComponentType<{ className?: string }>;

const PLATFORM_META: Record<string, { label: string; Icon: ReactIcon; tint: string }> = {
  instagram: { label: 'Instagram', Icon: FaInstagram, tint: 'text-pink-600' },
  facebook: { label: 'Facebook', Icon: FaFacebook, tint: 'text-blue-700' },
  tiktok: { label: 'TikTok', Icon: FaTiktok, tint: 'text-slate-900' },
  youtube: { label: 'YouTube', Icon: FaYoutube, tint: 'text-red-600' },
  telegram: { label: 'Telegram', Icon: FaTelegram, tint: 'text-sky-600' },
};

const CHANNEL_ICON: Record<AdminMetaCampaignChannel, ReactIcon> = {
  whatsapp: FaWhatsapp,
  email: Mail,
  social: Share2,
};

const CAMPAIGN_TYPE_LABEL: Record<AdminMetaCampaignType, string> = {
  product_promotion: 'Product Promotion',
  discount: 'Discount',
  seasonal: 'Seasonal',
  new_product: 'New Product',
  retention: 'Customer Retention',
  abandoned_cart: 'Abandoned Cart',
  newsletter: 'Newsletter',
  social: 'Social Post',
};

const CAMPAIGN_TYPE_TINT: Record<AdminMetaCampaignType, string> = {
  product_promotion: 'bg-blue-50 text-blue-950 border-blue-100',
  discount: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  seasonal: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  new_product: 'bg-purple-50 text-purple-700 border-purple-100',
  retention: 'bg-rose-50 text-rose-700 border-rose-100',
  abandoned_cart: 'bg-amber-50 text-amber-700 border-amber-100',
  newsletter: 'bg-slate-100 text-slate-700 border-slate-200',
  social: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

const CAMPAIGN_TYPE_ICON: Record<AdminMetaCampaignType, ReactIcon> = {
  product_promotion: Tag,
  discount: DollarSign,
  seasonal: Snowflake,
  new_product: Rocket,
  retention: Heart,
  abandoned_cart: ShoppingCart,
  newsletter: Newspaper,
  social: Share2,
};

const CAMPAIGN_TYPES: AdminMetaCampaignType[] = [
  'product_promotion',
  'discount',
  'seasonal',
  'new_product',
  'retention',
  'abandoned_cart',
  'newsletter',
  'social',
];

const CHANNEL_OPTIONS: {
  channel: AdminMetaCampaignChannel;
  label: string;
  tint: string;
  hint: string;
}[] = [
    {
      channel: 'whatsapp',
      label: 'WhatsApp',
      tint: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      hint: 'Message your WhatsApp customers',
    },
    {
      channel: 'email',
      label: 'Email',
      tint: 'bg-blue-50 text-blue-950 border-blue-100',
      hint: 'Email your subscribers',
    },
    {
      channel: 'social',
      label: 'Social',
      tint: 'bg-cyan-50 text-cyan-700 border-cyan-100',
      hint: 'Post on social media',
    },
  ];

const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'telegram'];

const STATUS_LABEL: Record<AdminMetaCampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_TINT: Record<AdminMetaCampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  scheduled: 'bg-purple-50 text-purple-700 border-purple-100',
  sending: 'bg-blue-50 text-blue-950 border-blue-100',
  paused: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  failed: 'bg-red-50 text-red-600 border-red-100',
};

const CHANNEL_LABEL: Record<AdminMetaCampaignChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  social: 'Social',
};

const CHANNEL_TINT: Record<AdminMetaCampaignChannel, string> = {
  whatsapp: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  email: 'bg-blue-50 text-blue-950 border-blue-100',
  social: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

function n(v: unknown): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function unwrapArray<T = any>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && Array.isArray((res as any).results)) {
    return (res as any).results as T[];
  }
  return [];
}

export default function CampaignsPage() {
  const [tab, setTab] = useState<TabKey>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<AdminMetaCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const [waTemplates, setWaTemplates] = useState<TemplateOption[]>([]);
  const [nlLists, setNlLists] = useState<ListOption[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AdminMetaCampaignType>('product_promotion');
  const [newSegmentKey, setNewSegmentKey] = useState('');
  const [newChannels, setNewChannels] = useState<Set<AdminMetaCampaignChannel>>(new Set());
  const [newScheduleType, setNewScheduleType] = useState<'now' | 'scheduled'>('now');
  const [newScheduleAt, setNewScheduleAt] = useState('');

  const [waTemplateId, setWaTemplateId] = useState('');
  const [nlListId, setNlListId] = useState('');
  const [nlSubject, setNlSubject] = useState('');
  const [nlBody, setNlBody] = useState('');
  const [socialCaption, setSocialCaption] = useState('');
  const [socialPlatforms, setSocialPlatforms] = useState<Set<string>>(new Set(['instagram']));

  const [analyticsCampaign, setAnalyticsCampaign] = useState<AdminMetaCampaign | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AdminMetaCampaignAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<AdminMetaCampaign | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!wizardOpen && !analyticsCampaign && !pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingDelete) setPendingDelete(null);
      else if (analyticsCampaign) setAnalyticsCampaign(null);
      else setWizardOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [wizardOpen, analyticsCampaign, pendingDelete]);

  const notify = (message: string, kind: ToastKind = 'success') =>
    setToast({ kind, message });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsRes, waTplRes, nlListRes, waSegRes, nlSegRes] = await Promise.all([
        adminApi.campaigns.list().catch(() => []),
        adminApi.whatsapp.templates.list().catch(() => []),
        adminApi.newsletter.lists.list().catch(() => []),
        adminApi.whatsapp.segments.list().catch(() => []),
        adminApi.newsletter.segments.list().catch(() => []),
      ]);

      setCampaigns(unwrapArray(campaignsRes));

      setWaTemplates(
        unwrapArray(waTplRes).map((t: any) => ({
          id: String(t.id),
          name: t.name || t.templateName || `template-${t.id}`,
          status: t.status,
        })),
      );

      setNlLists(
        unwrapArray(nlListRes).map((l: any) => ({
          id: String(l.id),
          name: l.name || `List ${l.id}`,
          size: n(l.subscriberCount ?? l.subscriber_count ?? l.size),
        })),
      );

      const segList: SegmentOption[] = [];
      unwrapArray(waSegRes).forEach((s: any) =>
        segList.push({
          key: `wa-${s.id}`,
          label: s.name || `WhatsApp segment #${s.id}`,
          source: 'whatsapp',
          refId: s.id,
          size: n(s.contactCount ?? s.contact_count ?? s.size),
        }),
      );
      unwrapArray(nlSegRes).forEach((s: any) =>
        segList.push({
          key: `nl-${s.id}`,
          label: s.name || `Email segment #${s.id}`,
          source: 'newsletter',
          refId: s.id,
          size: n(s.subscriberCount ?? s.subscriber_count ?? s.size),
        }),
      );
      setSegments(segList);
    } catch (e: any) {
      setError(e?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const tabCounts = useMemo(() => {
    const out: Record<TabKey, number> = {
      All: campaigns.length,
      draft: 0,
      scheduled: 0,
      sending: 0,
      paused: 0,
      completed: 0,
      failed: 0,
    };
    campaigns.forEach((c) => {
      if (out[c.status] !== undefined) out[c.status] += 1;
    });
    return out;
  }, [campaigns]);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (tab !== 'All' && c.status !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${c.name} ${c.audience_ref_id} ${(c.channels || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, tab, search]);

  const openAnalytics = async (c: AdminMetaCampaign) => {
    setAnalyticsCampaign(c);
    setAnalyticsData(null);
    setAnalyticsLoading(true);
    try {
      const data = await adminApi.campaigns.analytics(c.id).catch(() => null);
      setAnalyticsData(data);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const actionDispatch = async (c: AdminMetaCampaign) => {
    try {
      await adminApi.campaigns.dispatch(c.id);
      notify(`Dispatched "${c.name}"`);
      await loadAll();
    } catch (e: any) {
      notify(e?.message || 'Failed to dispatch campaign', 'error');
    }
  };

  const actionPause = async (c: AdminMetaCampaign) => {
    try {
      await adminApi.campaigns.pause(c.id);
      notify(`Paused "${c.name}"`, 'info');
      await loadAll();
    } catch (e: any) {
      notify(e?.message || 'Failed to pause campaign', 'error');
    }
  };

  const actionResume = async (c: AdminMetaCampaign) => {
    try {
      await adminApi.campaigns.resume(c.id);
      notify(`Resumed "${c.name}"`);
      await loadAll();
    } catch (e: any) {
      notify(e?.message || 'Failed to resume campaign', 'error');
    }
  };

  const confirmDelete = async () => {
    const c = pendingDelete;
    if (!c) return;
    try {
      await adminApi.campaigns.remove(c.id);
      notify('Campaign deleted', 'info');
      await loadAll();
    } catch (e: any) {
      notify(e?.message || 'Failed to delete campaign', 'error');
    } finally {
      setPendingDelete(null);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setNewName('');
    setNewType('product_promotion');
    setNewSegmentKey('');
    setNewChannels(new Set());
    setNewScheduleType('now');
    setNewScheduleAt('');
    setWaTemplateId('');
    setNlListId('');
    setNlSubject('');
    setNlBody('');
    setSocialCaption('');
    setSocialPlatforms(new Set(['instagram']));
  };

  const openWizard = () => {
    resetWizard();
    setWizardOpen(true);
  };

  const toggleChannel = (ch: AdminMetaCampaignChannel) => {
    setNewChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const toggleSocialPlatform = (p: string) => {
    setSocialPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const selectedSegment = segments.find((s) => s.key === newSegmentKey) || null;

  const canAdvance = (): boolean => {
    if (wizardStep === 1) {
      return (
        newName.trim().length > 0 &&
        !!selectedSegment &&
        newChannels.size > 0
      );
    }
    if (wizardStep === 2) {
      if (newChannels.has('whatsapp') && !waTemplateId) return false;
      if (newChannels.has('email') && (!nlSubject.trim() || !nlBody.trim() || !nlListId)) return false;
      if (newChannels.has('social') && (socialPlatforms.size === 0 || !socialCaption.trim())) return false;
      return true;
    }
    if (wizardStep === 3) {
      if (newScheduleType === 'scheduled' && !newScheduleAt) return false;
      return true;
    }
    return true;
  };

  const buildContent = () => {
    const content: Record<string, unknown> = {};

    if (newChannels.has('whatsapp')) {
      content.whatsapp = {
        template_id: Number(waTemplateId) || null,
        audience: selectedSegment?.source === 'whatsapp' ? 'SEGMENT' : 'ALL',
      };
    }

    if (newChannels.has('email')) {
      content.email = {
        subject: nlSubject.trim(),
        body: nlBody.trim(),
        template_id: null,
        audience_type: 'LIST',
        audience_id: String(nlListId),
      };
    }

    if (newChannels.has('social')) {
      content.social = {
        caption: socialCaption.trim(),
        platforms: Array.from(socialPlatforms),
      };
    }

    return content;
  };

  const launchCampaign = async () => {
    if (!canAdvance() || !selectedSegment) return;
    setSubmitting(true);

    const scheduledIso =
      newScheduleType === 'scheduled' && newScheduleAt
        ? new Date(newScheduleAt).toISOString()
        : null;

    const audience_source: AdminMetaCampaignAudienceSource =
      selectedSegment.source === 'whatsapp' ? 'whatsapp_segment' : 'newsletter_segment';

    const payload: AdminMetaCampaignWrite = {
      name: newName.trim(),
      campaign_type: newType,
      audience_source,
      audience_ref_id: String(selectedSegment.refId),
      scheduled_at: scheduledIso,
      channels: Array.from(newChannels),
      content: buildContent(),
    };

    try {
      const created = await adminApi.campaigns.create(payload);

      if (newScheduleType === 'now' && created?.id) {
        await adminApi.campaigns.dispatch(created.id);
      }

      notify('Campaign created and dispatched');
      setWizardOpen(false);
      resetWizard();
      await loadAll();
    } catch (e: any) {
      notify(e?.message || 'Failed to create campaign', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = ['Campaign basics', 'Channels & content', 'Schedule & launch'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-10 relative">
      {toast && (
        <div
          className={`fixed bottom-3 right-3 z-[120] text-white px-3 py-2 rounded flex items-center gap-2 text-[13px] ${toast.kind === 'success'
            ? 'bg-slate-900'
            : toast.kind === 'error'
              ? 'bg-red-700'
              : 'bg-slate-700'
            }`}
        >
          {toast.kind === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          {toast.kind === 'error' && <XCircle className="w-3.5 h-3.5 text-red-200 shrink-0" />}
          {toast.kind === 'info' && <Info className="w-3.5 h-3.5 text-blue-200 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-300 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-2 py-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-blue-950" />
              Campaigns
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Send promotions and updates to your customers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-medium px-3 py-2 rounded text-[13px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openWizard}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded text-[13px]"
            >
              <Plus className="w-3.5 h-3.5" />
              New campaign
            </button>
          </div>
        </div>

        <div className="max-w-[1700px] mx-auto px-2 flex items-center gap-0.5 border-t border-slate-100 pt-2 overflow-x-auto">
          {(['All', 'draft', 'scheduled', 'sending', 'paused', 'completed', 'failed'] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded text-[13px] font-medium border-b-2 whitespace-nowrap transition ${tab === t
                ? 'border-blue-950 text-blue-950'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
            >
              {t === 'All' ? 'All' : STATUS_LABEL[t as AdminMetaCampaignStatus]}
              <span
                className={`px-1.5 py-0.5 rounded text-[13px] ${tab === t ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {tabCounts[t] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="max-w-[1700px] mx-auto px-2 pt-2">
          <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-red-900">Couldn&apos;t load campaigns</p>
              <p className="text-[13px] text-red-800 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => void loadAll()}
              className="text-[13px] font-medium text-red-900 hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1700px] mx-auto px-0.5 py-2 space-y-2">
        <div className="bg-white border border-slate-200 rounded p-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-700">
              Campaigns · {filtered.length}
            </p>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[13px] text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading…
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-2 font-medium">Campaign</th>
                  <th className="py-2 px-2 font-medium">Type</th>
                  <th className="py-2 px-2 font-medium">Channels</th>
                  <th className="py-2 px-2 font-medium text-right">Audience</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium">Scheduled</th>
                  <th className="py-2 px-2 font-medium">Created</th>
                  <th className="py-2 px-2 w-40"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">
                      No campaigns yet. Click <span className="font-medium text-slate-700">New campaign</span> to get started.
                    </td>
                  </tr>
                ) : (
                  filtered.map((cmp) => {
                    const TypeIcon = CAMPAIGN_TYPE_ICON[cmp.campaign_type] || Tag;
                    return (
                      <tr key={cmp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2">
                          <p className="font-medium text-slate-900 truncate max-w-[260px]">
                            {cmp.name}
                          </p>
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${CAMPAIGN_TYPE_TINT[cmp.campaign_type] ||
                              'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                          >
                            <TypeIcon className="w-3 h-3" />
                            {CAMPAIGN_TYPE_LABEL[cmp.campaign_type] || cmp.campaign_type}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {(cmp.channels || []).map((ch) => {
                              const ChIcon = CHANNEL_ICON[ch];
                              return (
                                <span
                                  key={ch}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[13px] font-medium border ${CHANNEL_TINT[ch]}`}
                                >
                                  {ChIcon && <ChIcon className="w-3 h-3" />}
                                  {CHANNEL_LABEL[ch]}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                          {n(cmp.audience_size_cached).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-medium border ${STATUS_TINT[cmp.status]}`}
                          >
                            {STATUS_LABEL[cmp.status] || cmp.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-500 font-mono text-[13px]">
                          {cmp.scheduled_at
                            ? new Date(cmp.scheduled_at).toLocaleString('en-KE', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            : '—'}
                        </td>
                        <td className="py-2 px-2 text-slate-500 font-mono text-[13px]">
                          {new Date(cmp.created_at).toLocaleDateString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => void openAnalytics(cmp)}
                              className="px-2.5 py-2 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                            >
                              Results
                            </button>
                            {(cmp.status === 'draft' || cmp.status === 'scheduled') && (
                              <button
                                onClick={() => void actionDispatch(cmp)}
                                title="Send now"
                                className="p-2 rounded bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {cmp.status === 'sending' && (
                              <button
                                onClick={() => void actionPause(cmp)}
                                title="Pause"
                                className="p-2 rounded bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {cmp.status === 'paused' && (
                              <button
                                onClick={() => void actionResume(cmp)}
                                title="Resume"
                                className="p-2 rounded bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setPendingDelete(cmp)}
                              title="Delete"
                              className="p-2 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50"
                            >
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
      </main>

      {wizardOpen && (
        <Modal onClose={() => setWizardOpen(false)} maxWidth="max-w-2xl">
          <div
            className="h-0.5 w-full bg-slate-100 -mt-3 -mx-3 mb-3"
            style={{ width: 'calc(100% + 1.5rem)' }}
          >
            <div
              className="h-full bg-blue-950 transition-all duration-300"
              style={{ width: `${(wizardStep / 3) * 100}%` }}
            />
          </div>

          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900">
                New campaign · Step {wizardStep} of 3
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">{stepTitles[wizardStep - 1]}</p>
            </div>
            <button
              onClick={() => setWizardOpen(false)}
              className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-[13px]">
            {wizardStep === 1 && (
              <>
                <label className="block">
                  <span className="block font-medium text-slate-700 mb-1">Campaign name</span>
                  <input
                    type="text"
                    placeholder="e.g. Weekend M-Pesa discount"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                </label>

                <div>
                  <p className="font-medium text-slate-700 mb-1.5">Campaign type</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CAMPAIGN_TYPES.map((t) => {
                      const Icon = CAMPAIGN_TYPE_ICON[t];
                      const active = newType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewType(t)}
                          className={`p-2 rounded border text-left transition ${active
                            ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-100'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                        >
                          <span
                            className={`w-7 h-7 rounded flex items-center justify-center border ${CAMPAIGN_TYPE_TINT[t]}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <p className="text-[13px] font-medium text-slate-900 mt-1.5 truncate">
                            {CAMPAIGN_TYPE_LABEL[t]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="font-medium text-slate-700 mb-1.5 inline-flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Who will receive this?
                  </p>
                  {segments.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[13px] text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      No customer groups yet. Create one in WhatsApp Contacts or Newsletter
                      before sending a campaign.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {segments.map((seg) => {
                        const active = newSegmentKey === seg.key;
                        const SegSourceIcon = seg.source === 'whatsapp' ? FaWhatsapp : Mail;
                        return (
                          <button
                            key={seg.key}
                            type="button"
                            onClick={() => setNewSegmentKey(seg.key)}
                            className={`flex items-center justify-between gap-2 p-2 rounded border text-left transition ${active
                              ? 'border-blue-950 bg-blue-50 text-blue-950 font-medium'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <SegSourceIcon
                                className={`w-4 h-4 shrink-0 ${seg.source === 'whatsapp' ? 'text-emerald-600' : 'text-blue-950'}`}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-[13px]">{seg.label}</p>
                                <p className="text-[13px] text-slate-500">
                                  {seg.source === 'whatsapp' ? 'WhatsApp' : 'Email'} ·{' '}
                                  {seg.size.toLocaleString()} contacts
                                </p>
                              </div>
                            </div>
                            <span
                              className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? 'border-blue-950 bg-blue-950' : 'border-slate-300'
                                }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <p className="font-medium text-slate-700 mb-1.5">
                    Where will it be sent?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CHANNEL_OPTIONS.map((opt) => {
                      const Icon = CHANNEL_ICON[opt.channel];
                      const active = newChannels.has(opt.channel);
                      return (
                        <button
                          key={opt.channel}
                          type="button"
                          onClick={() => toggleChannel(opt.channel)}
                          className={`p-2 rounded border text-left transition ${active
                            ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-100'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                        >
                          <span
                            className={`w-8 h-8 rounded flex items-center justify-center border ${opt.tint}`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <p className="text-[13px] font-medium text-slate-900 mt-1">
                            {opt.label}
                          </p>
                          <p className="text-[13px] text-slate-500 mt-0.5">{opt.hint}</p>
                          <div className="flex items-center justify-end mt-2">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center ${active
                                ? 'bg-blue-950 border-blue-950 text-white'
                                : 'border-slate-300 bg-white'
                                }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <div className="space-y-2">
                {newChannels.has('whatsapp') && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded p-2 space-y-2">
                    <p className="text-[13px] font-semibold text-emerald-900 inline-flex items-center gap-1.5">
                      <FaWhatsapp className="w-4 h-4" />
                      WhatsApp message
                    </p>
                    <label className="block">
                      <span className="block font-medium text-slate-700 mb-1">
                        Message template
                      </span>
                      <select
                        value={waTemplateId}
                        onChange={(e) => setWaTemplateId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      >
                        <option value="">Select a template…</option>
                        {waTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.status ? `· ${t.status}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {newChannels.has('email') && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded p-2 space-y-2">
                    <p className="text-[13px] font-semibold text-blue-950 inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Email message
                    </p>
                    <label className="block">
                      <span className="block font-medium text-slate-700 mb-1">
                        Send to subscriber list
                      </span>
                      <select
                        value={nlListId}
                        onChange={(e) => setNlListId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      >
                        <option value="">Select a list…</option>
                        {nlLists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                            {l.size ? ` · ${l.size.toLocaleString()}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="block font-medium text-slate-700 mb-1">
                        Subject line
                      </span>
                      <input
                        type="text"
                        value={nlSubject}
                        onChange={(e) => setNlSubject(e.target.value)}
                        placeholder="e.g. Your weekly store update"
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </label>
                    <label className="block">
                      <span className="block font-medium text-slate-700 mb-1">
                        Message body
                      </span>
                      <textarea
                        rows={4}
                        value={nlBody}
                        onChange={(e) => setNlBody(e.target.value)}
                        placeholder="Hi {{customer_name}}, check out our new arrivals…"
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </label>
                  </div>
                )}

                {newChannels.has('social') && (
                  <div className="bg-cyan-50/50 border border-cyan-100 rounded p-2 space-y-2">
                    <p className="text-[13px] font-semibold text-cyan-900 inline-flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5" />
                      Social post
                    </p>
                    <div>
                      <p className="font-medium text-slate-700 mb-1.5">Where to post</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SOCIAL_PLATFORMS.map((p) => {
                          const meta = PLATFORM_META[p];
                          if (!meta) return null;
                          const active = socialPlatforms.has(p);
                          const Icon = meta.Icon;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => toggleSocialPlatform(p)}
                              aria-pressed={active}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[12px] font-medium transition ${active
                                ? 'bg-blue-950 border-blue-950 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                              <Icon
                                className={`w-3.5 h-3.5 ${active ? 'text-white' : meta.tint}`}
                              />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <span className="block font-medium text-slate-700 mb-1">Caption</span>
                      <textarea
                        rows={4}
                        value={socialCaption}
                        onChange={(e) => setSocialCaption(e.target.value)}
                        placeholder="Write what you want to post…"
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-2">
                <div>
                  <p className="font-medium text-slate-700 mb-1.5">When to send</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewScheduleType('now')}
                      className={`p-2 rounded border text-left transition ${newScheduleType === 'now'
                        ? 'border-blue-950 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <p className="font-medium">Send right away</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        Send to your customers immediately.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewScheduleType('scheduled')}
                      className={`p-2 rounded border text-left transition ${newScheduleType === 'scheduled'
                        ? 'border-blue-950 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    > 
                      <p className="font-medium">Schedule for later</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        Pick a good time to send.
                      </p>
                    </button>
                  </div>
                </div>

                {newScheduleType === 'scheduled' && (
                  <label className="block">
                    <span className="block font-medium text-slate-700 mb-1 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Send at
                    </span>
                    <input
                      type="datetime-local"
                      value={newScheduleAt}
                      onChange={(e) => setNewScheduleAt(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </label>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-2">
                  <p className="font-semibold text-slate-900 border-b border-slate-200 pb-2">
                    Review before sending
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <SummaryRow label="Name" value={newName || 'Untitled campaign'} />
                    <SummaryRow label="Type" value={CAMPAIGN_TYPE_LABEL[newType]} />
                    <SummaryRow
                      label="Audience"
                      value={
                        selectedSegment
                          ? `${selectedSegment.label} · ${selectedSegment.size.toLocaleString()}`
                          : '—'
                      }
                    />
                    <SummaryRow
                      label="Channels"
                      value={
                        Array.from(newChannels)
                          .map((c) => CHANNEL_LABEL[c])
                          .join(', ') || 'None selected'
                      }
                    />
                    <SummaryRow
                      label="When"
                      value={
                        newScheduleType === 'now'
                          ? 'Send right away'
                          : newScheduleAt
                            ? new Date(newScheduleAt).toLocaleString('en-KE')
                            : 'Not scheduled'
                      }
                    />
                  </div>

                  {newChannels.has('whatsapp') && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[12px] text-slate-500 mb-1 inline-flex items-center gap-1">
                        <FaWhatsapp className="w-3 h-3 text-emerald-600" />
                        WhatsApp template
                      </p>
                      <p className="text-[13px] text-slate-900">
                        {waTemplates.find((t) => t.id === waTemplateId)?.name || '—'}
                      </p>
                    </div>
                  )}
                  {newChannels.has('email') && (
                    <>
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[12px] text-slate-500 mb-1">Email subject</p>
                        <p className="text-[13px] text-slate-900">{nlSubject || '—'}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[12px] text-slate-500 mb-1">Email body</p>
                        <p className="text-[12px] text-slate-700 italic whitespace-pre-wrap line-clamp-4">
                          {nlBody || '—'}
                        </p>
                      </div>
                    </>
                  )}
                  {newChannels.has('social') && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[12px] text-slate-500 mb-1">Social channels</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {Array.from(socialPlatforms).map((p) => {
                          const meta = PLATFORM_META[p];
                          if (!meta) return null;
                          const Icon = meta.Icon;
                          return (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-medium border bg-white border-slate-200 text-slate-700"
                            >
                              <Icon className={`w-3 h-3 ${meta.tint}`} />
                              {meta.label}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[12px] text-slate-500 mb-1">Caption</p>
                      <p className="text-[13px] text-slate-900 italic whitespace-pre-wrap">
                        {socialCaption || '—'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-slate-200">
            {wizardStep > 1 ? (
              <button
                onClick={() => setWizardStep((p) => p - 1)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded text-[13px] disabled:opacity-60"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 3 ? (
              <button
                onClick={() => setWizardStep((p) => p + 1)}
                disabled={!canAdvance()}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => void launchCampaign()}
                disabled={submitting || !canAdvance()}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {submitting ? 'Sending…' : 'Send campaign'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {analyticsCampaign && (
        <Modal onClose={() => setAnalyticsCampaign(null)} maxWidth="max-w-2xl">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-950" />
                Campaign results
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                {analyticsCampaign.name}
              </p>
            </div>
            <button
              onClick={() => setAnalyticsCampaign(null)}
              className="h-8 w-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {analyticsLoading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading results…
            </div>
          ) : !analyticsData ? (
            <div className="py-12 text-center text-slate-400 text-[13px]">
              No results yet for this campaign.
            </div>
          ) : (
            <div className="space-y-2 text-[13px]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <AnalyticsKpi
                  label="Sent"
                  value={analyticsData.totals.sent.toLocaleString()}
                  icon={<Send className="w-3 h-3" />}
                />
                <AnalyticsKpi
                  label="Delivered"
                  value={analyticsData.totals.delivered.toLocaleString()}
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  tint="text-emerald-700"
                />
                <AnalyticsKpi
                  label="Opened"
                  value={analyticsData.totals.opened.toLocaleString()}
                  icon={<Eye className="w-3 h-3" />}
                  tint="text-blue-950"
                />
                <AnalyticsKpi
                  label="Clicked"
                  value={analyticsData.totals.clicked.toLocaleString()}
                  icon={<MousePointerClick className="w-3 h-3" />}
                  tint="text-indigo-700"
                />
                <AnalyticsKpi
                  label="Converted"
                  value={analyticsData.totals.converted.toLocaleString()}
                  tint="text-emerald-700"
                />
                <AnalyticsKpi
                  label="Revenue"
                  value={`KES ${analyticsData.totals.revenue.toLocaleString()}`}
                  icon={<DollarSign className="w-3 h-3" />}
                  tint="text-emerald-700"
                />
              </div>

              <div>
                <p className="font-medium text-slate-700 mb-1">How far did customers go?</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Sent', value: analyticsData.totals.sent, color: 'bg-blue-950' },
                    { label: 'Delivered', value: analyticsData.totals.delivered, color: 'bg-emerald-600' },
                    { label: 'Opened', value: analyticsData.totals.opened, color: 'bg-indigo-600' },
                    { label: 'Clicked', value: analyticsData.totals.clicked, color: 'bg-amber-500' },
                    { label: 'Converted', value: analyticsData.totals.converted, color: 'bg-purple-600' },
                  ].map((row) => {
                    const pct =
                      analyticsData.totals.sent > 0
                        ? (row.value / analyticsData.totals.sent) * 100
                        : 0;
                    return (
                      <div
                        key={row.label}
                        className="bg-slate-50 border border-slate-200 rounded p-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-medium text-slate-700">
                            {row.label}
                          </span>
                          <span className="text-[12px] font-mono text-slate-500">
                            {row.value.toLocaleString()} · {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded overflow-hidden">
                          <div
                            className={`h-full ${row.color}`}
                            style={{ width: `${Math.max(pct, row.value > 0 ? 2 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 mt-1 border-t border-slate-200">
            <button
              onClick={() => setAnalyticsCampaign(null)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal onClose={() => setPendingDelete(null)} maxWidth="max-w-md">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Delete &ldquo;{pendingDelete.name}&rdquo;?
              </h3>
              <p className="text-slate-500 mt-1 text-[13px]">
                Messages already sent to your customers stay delivered. This only removes the
                campaign from your list.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded text-[13px]"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className="text-[13px] font-medium text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}

function AnalyticsKpi({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tint?: string;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-2">
      <p className={`text-[12px] inline-flex items-center gap-1 ${tint || 'text-slate-500'}`}>
        {icon}
        {label}
      </p>
      <p className={`text-[15px] font-bold mt-0.5 ${tint || 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

function Modal({
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-slate-200 rounded ${maxWidth} w-full max-h-[90vh] flex flex-col p-2`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}