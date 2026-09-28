'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Megaphone,
  Plus,
  CheckCircle2,
  X,
  Send,
  TrendingUp,
  Mail,
  MessageSquare,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Eye,
  Percent,
  Sparkles,
  Trash2,
  ChevronDown,
  Search,
  Tag,
  Calendar,
  Clock,
  Target,
  FileText,
  BarChart3,
  Layers,
  Gift,
  Snowflake,
  Rocket,
  Heart,
  ShoppingCart,
  Newspaper,
  Share2,
  Check,
  Pause,
  Play,
  DollarSign,
  MousePointerClick,
  UserMinus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

// --- TYPES ---
type CampaignTab = 'All' | 'Draft' | 'Scheduled' | 'Sending' | 'Completed' | 'Paused';

type CampaignChannel = 'Email' | 'SMS' | 'WhatsApp';
type CampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Completed' | 'Paused' | 'Failed';

type CampaignType =
  | 'Product Promotion'
  | 'Discount Campaign'
  | 'Seasonal Campaign'
  | 'New Product'
  | 'Customer Retention'
  | 'Abandoned Cart'
  | 'Newsletter'
  | 'Social Campaign';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  channel: CampaignChannel;
  audience: string;
  audienceSize: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  revenue: number;
  status: CampaignStatus;
  schedule: string;
  date: string;
}

const CAMPAIGN_TYPES: { type: CampaignType; icon: React.ComponentType<{ className?: string }>; tint: string; description: string }[] = [
  { type: 'Product Promotion', icon: Tag, tint: 'bg-blue-50 text-blue-950 border-blue-100', description: 'Highlight specific products or categories.' },
  { type: 'Discount Campaign', icon: DollarSign, tint: 'bg-emerald-50 text-emerald-700 border-emerald-100', description: 'Promo codes and percentage-off offers.' },
  { type: 'Seasonal Campaign', icon: Snowflake, tint: 'bg-indigo-50 text-indigo-700 border-indigo-100', description: 'Holiday, festive, and calendar events.' },
  { type: 'New Product', icon: Rocket, tint: 'bg-purple-50 text-purple-700 border-purple-100', description: 'Launch announcements to your base.' },
  { type: 'Customer Retention', icon: Heart, tint: 'bg-rose-50 text-rose-700 border-rose-100', description: 'Win-back and loyalty engagement.' },
  { type: 'Abandoned Cart', icon: ShoppingCart, tint: 'bg-amber-50 text-amber-700 border-amber-100', description: 'Recover carts with timely nudges.' },
  { type: 'Newsletter', icon: Newspaper, tint: 'bg-slate-100 text-slate-700 border-slate-200', description: 'Recurring content and store updates.' },
  { type: 'Social Campaign', icon: Share2, tint: 'bg-cyan-50 text-cyan-700 border-cyan-100', description: 'Cross-promote on social platforms.' },
];

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'cmp-1',
    name: 'Weekend Flash Sale - M-Pesa Discount',
    type: 'Discount Campaign',
    channel: 'WhatsApp',
    audience: 'All Active Customers (12,400)',
    audienceSize: 12400,
    sent: 12400,
    delivered: 12380,
    opened: 11670,
    clicked: 3532,
    converted: 892,
    unsubscribed: 42,
    openRate: 94.2,
    clickRate: 28.5,
    conversionRate: 7.2,
    revenue: 892000,
    status: 'Completed',
    schedule: 'Sent',
    date: 'Yesterday',
  },
  {
    id: 'cmp-2',
    name: 'New Django & Next.js Course Launch',
    type: 'New Product',
    channel: 'Email',
    audience: 'Developers & Tech Students (4,100)',
    audienceSize: 4100,
    sent: 4100,
    delivered: 4050,
    opened: 1993,
    clicked: 582,
    converted: 128,
    unsubscribed: 18,
    openRate: 48.6,
    clickRate: 14.2,
    conversionRate: 3.1,
    revenue: 384000,
    status: 'Completed',
    schedule: 'Sent',
    date: '3 days ago',
  },
  {
    id: 'cmp-3',
    name: 'Dedan Kimathi Tech Week Reminder',
    type: 'Seasonal Campaign',
    channel: 'SMS',
    audience: 'Nairobi & Nyeri Region (2,800)',
    audienceSize: 2800,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    unsubscribed: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
    revenue: 0,
    status: 'Scheduled',
    schedule: 'Tomorrow, 9:00 AM',
    date: 'Tomorrow, 9:00 AM',
  },
  {
    id: 'cmp-4',
    name: 'Abandoned Cart Recovery #4',
    type: 'Abandoned Cart',
    channel: 'WhatsApp',
    audience: 'Cart Abandoners > 24h (450)',
    audienceSize: 450,
    sent: 450,
    delivered: 448,
    opened: 394,
    clicked: 158,
    converted: 42,
    unsubscribed: 3,
    openRate: 88.0,
    clickRate: 35.1,
    conversionRate: 9.3,
    revenue: 63800,
    status: 'Sending',
    schedule: 'In progress',
    date: 'In progress',
  },
  {
    id: 'cmp-5',
    name: 'Q4 Enterprise Software Proposal',
    type: 'Product Promotion',
    channel: 'Email',
    audience: 'B2B Corporate Clients (320)',
    audienceSize: 320,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    unsubscribed: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
    revenue: 0,
    status: 'Draft',
    schedule: 'Unscheduled',
    date: 'Unscheduled',
  },
  {
    id: 'cmp-6',
    name: 'October Newsletter #10',
    type: 'Newsletter',
    channel: 'Email',
    audience: 'Newsletter Weekly (4,620)',
    audienceSize: 4620,
    sent: 4620,
    delivered: 4570,
    opened: 1497,
    clicked: 411,
    converted: 58,
    unsubscribed: 12,
    openRate: 32.4,
    clickRate: 8.9,
    conversionRate: 1.3,
    revenue: 174000,
    status: 'Completed',
    schedule: 'Sent',
    date: 'Sep 20, 2026',
  },
  {
    id: 'cmp-7',
    name: 'VIP Win-back — 15% Off',
    type: 'Customer Retention',
    channel: 'WhatsApp',
    audience: 'Inactive VIP Buyers (312)',
    audienceSize: 312,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    unsubscribed: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
    revenue: 0,
    status: 'Paused',
    schedule: 'Paused mid-send',
    date: 'Sep 19, 2026',
  },
];

const TEMPLATES = [
  { id: 't1', name: 'M-Pesa Promo Blast', channel: 'WhatsApp', preview: '🚀 Exclusive offer! Get 15% off your next order when you pay with M-Pesa STK push. Tap here to claim: {{checkout_link}}' },
  { id: 't2', name: 'Product Restock Alert', channel: 'Email', preview: 'Hi {{customer_name}}, your favorite mechanical keyboards are back in stock! Order now before they sell out.' },
  { id: 't3', name: 'Quick Feedback Survey', channel: 'SMS', preview: 'Hi {{customer_name}}, how was your experience today? Reply 1 for Excellent, 2 for Needs Improvement.' },
];

const AUDIENCES = [
  'All Active Customers (15,200)',
  'High Spenders > KES 10,000 (3,400)',
  'Cart Abandoners in Last 48 Hours (450)',
  'Nairobi & Mombasa Region (8,900)',
  'Inactive VIP Buyers (312)',
];

const PERFORMANCE_OVER_TIME = [
  { day: 'Mon', sent: 2100, opened: 1480, clicked: 412 },
  { day: 'Tue', sent: 3250, opened: 2240, clicked: 685 },
  { day: 'Wed', sent: 2890, opened: 2010, clicked: 592 },
  { day: 'Thu', sent: 4120, opened: 2980, clicked: 812 },
  { day: 'Fri', sent: 5210, opened: 3940, clicked: 1140 },
  { day: 'Sat', sent: 3820, opened: 2890, clicked: 805 },
  { day: 'Sun', sent: 2450, opened: 1760, clicked: 498 },
];

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<CampaignTab>('All');
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CampaignType | null>(null);
  const [channelFilter, setChannelFilter] = useState<CampaignChannel | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const [newCampName, setNewCampName] = useState('');
  const [newCampType, setNewCampType] = useState<CampaignType>('Product Promotion');
  const [newCampChannel, setNewCampChannel] = useState<CampaignChannel>('WhatsApp');
  const [newCampAudience, setNewCampAudience] = useState(AUDIENCES[0]);
  const [newCampSubject, setNewCampSubject] = useState('');
  const [newCampBody, setNewCampBody] = useState('');
  const [newCampScheduleType, setNewCampScheduleType] = useState<'now' | 'scheduled'>('now');
  const [newCampABTest, setNewCampABTest] = useState(false);

  const [analyticsCampaign, setAnalyticsCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!createOpen && !analyticsCampaign) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateOpen(false);
        setAnalyticsCampaign(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [createOpen, analyticsCampaign]);

  const toast = (msg: string) => setToastMessage(msg);

  const submitCampaign = () => {
    const audienceSize = Number(newCampAudience.match(/\(([^)]+)\)/)?.[1]?.replace(/,/g, '') ?? 0);

    const newCampaign: Campaign = {
      id: `cmp-${Date.now()}`,
      name: newCampName || 'Untitled Marketing Campaign',
      type: newCampType,
      channel: newCampChannel,
      audience: newCampAudience,
      audienceSize,
      sent: newCampScheduleType === 'now' ? audienceSize : 0,
      delivered: newCampScheduleType === 'now' ? audienceSize : 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      unsubscribed: 0,
      openRate: 0,
      clickRate: 0,
      conversionRate: 0,
      revenue: 0,
      status: newCampScheduleType === 'now' ? 'Sending' : 'Scheduled',
      schedule: newCampScheduleType === 'now' ? 'In progress' : 'Scheduled for tomorrow',
      date: newCampScheduleType === 'now' ? 'Just now' : 'Scheduled for tomorrow',
    };
    setCampaigns([newCampaign, ...campaigns]);
    setCreateOpen(false);
    setWizardStep(1);
    setNewCampName('');
    setNewCampSubject('');
    setNewCampBody('');
    toast(`Campaign created — ${newCampChannel} · ${newCampType}`);
  };

  const deleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast('Campaign deleted');
  };

  const togglePause = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.status === 'Sending') {
          toast(`Paused "${c.name}"`);
          return { ...c, status: 'Paused', schedule: 'Paused mid-send' };
        }
        if (c.status === 'Paused') {
          toast(`Resumed "${c.name}"`);
          return { ...c, status: 'Sending', schedule: 'In progress' };
        }
        if (c.status === 'Draft' || c.status === 'Scheduled') {
          toast(`Launched "${c.name}"`);
          return { ...c, status: 'Sending', schedule: 'In progress', sent: c.audienceSize, delivered: c.audienceSize };
        }
        return c;
      })
    );
  };

  const filtered = campaigns.filter((c) => {
    if (activeTab !== 'All' && c.status !== activeTab) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    if (channelFilter && c.channel !== channelFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.audience.toLowerCase().includes(q);
    }
    return true;
  });

  const tabCounts: Record<string, number> = {
    All: campaigns.length,
  };
  (['Draft', 'Scheduled', 'Sending', 'Completed', 'Paused'] as const).forEach((s) => {
    tabCounts[s] = campaigns.filter((c) => c.status === s).length;
  });

  const channelBadge = (c: CampaignChannel) =>
    c === 'WhatsApp'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : c === 'SMS'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-blue-50 text-blue-950 border-blue-100';

  const statusBadge = (s: CampaignStatus) =>
    s === 'Completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Sending'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Scheduled'
          ? 'bg-purple-50 text-purple-700 border-purple-100'
          : s === 'Paused'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
            : s === 'Failed'
              ? 'bg-red-50 text-red-600 border-red-100'
              : 'bg-slate-100 text-slate-600 border-slate-200';

  const typeTint = (type: CampaignType) =>
    CAMPAIGN_TYPES.find((x) => x.type === type)?.tint ?? 'bg-slate-100 text-slate-600 border-slate-200';

  const stepTitles = [
    'Campaign name & type',
    'Target audience',
    'Content & channel',
    'Schedule & A/B testing',
    'Review & launch',
  ];

  const activeFilterCount = (typeFilter ? 1 : 0) + (channelFilter ? 1 : 0);

  // Aggregate stats
  const totalSent = campaigns.reduce((a, c) => a + c.sent, 0);
  const totalRevenue = campaigns.reduce((a, c) => a + c.revenue, 0);
  const avgOpenRate =
    campaigns.filter((c) => c.sent > 0).length > 0
      ? campaigns.filter((c) => c.sent > 0).reduce((a, c) => a + c.openRate, 0) /
      campaigns.filter((c) => c.sent > 0).length
      : 0;
  const avgClickRate =
    campaigns.filter((c) => c.sent > 0).length > 0
      ? campaigns.filter((c) => c.sent > 0).reduce((a, c) => a + c.clickRate, 0) /
      campaigns.filter((c) => c.sent > 0).length
      : 0;

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

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Campaigns</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Multi-channel marketing engine — WhatsApp, SMS, and Email
            </p>
          </div>
          <button
            onClick={() => {
              setCreateOpen(true);
              setWizardStep(1);
            }}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New campaign</span>
          </button>
        </div>

        {/* TABS */}
        <div className="max-w-[1600px] mx-auto px-3 flex items-center gap-0.5 border-t border-slate-100 pt-2 overflow-x-auto">
          {(['All', 'Draft', 'Scheduled', 'Sending', 'Paused', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab
                  ? 'border-blue-950 text-blue-950'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
            >
              {tab}
              <span
                className={`px-1.5 py-0.5 rounded-sm text-[13px] ${activeTab === tab ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {tabCounts[tab] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

        {/* CAMPAIGN FLOW */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
          <div className="text-[13px] flex-1 min-w-0">
            <p className="font-medium text-blue-950">Campaign flow</p>
            <p className="text-blue-800 mt-0.5 flex flex-wrap items-center gap-1">
              Campaign <ArrowRight className="w-3 h-3" /> Audience <ArrowRight className="w-3 h-3" /> Content
              <ArrowRight className="w-3 h-3" /> Channel <ArrowRight className="w-3 h-3" /> Schedule
              <ArrowRight className="w-3 h-3" /> Send <ArrowRight className="w-3 h-3" /> Analytics
            </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Total campaigns</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{campaigns.length}</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                Across all channels
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Messages sent</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{totalSent.toLocaleString()}</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                All time
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Avg. open rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">{avgOpenRate.toFixed(1)}%</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <Eye className="w-3 h-3" />
                Strong WhatsApp
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Revenue attributed</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5 truncate">
                KES {totalRevenue.toLocaleString()}
              </p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <DollarSign className="w-3 h-3" />
                Avg click {avgClickRate.toFixed(1)}%
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* CAMPAIGN TYPES */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-900">Campaign types</p>
            <span className="text-[13px] text-slate-400">Click a type to filter</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {CAMPAIGN_TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = typeFilter === t.type;
              const count = campaigns.filter((c) => c.type === t.type).length;
              return (
                <button
                  key={t.type}
                  onClick={() => setTypeFilter(isActive ? null : t.type)}
                  className={`border rounded-sm p-2 text-left transition ${isActive
                      ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-7 h-7 rounded-sm flex items-center justify-center border shrink-0 ${t.tint}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span
                      className={`text-[13px] font-mono px-1.5 py-0.5 rounded-sm ${isActive ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {count}
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-slate-900 mt-1.5 truncate">{t.type}</p>
                  <p className="text-[13px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campaigns by name or audience…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Channel"
              value={channelFilter}
              options={['WhatsApp', 'SMS', 'Email']}
              onChange={(v) => setChannelFilter(v as CampaignChannel | null)}
            />
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setTypeFilter(null);
                  setChannelFilter(null);
                }}
                className="text-[13px] text-red-600 hover:underline font-medium px-2 py-2"
              >
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-700">
              Campaigns · {filtered.length}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Campaign</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Channel</th>
                  <th className="py-2 px-3 font-medium">Audience</th>
                  <th className="py-2 px-3 font-medium text-right">Sent</th>
                  <th className="py-2 px-3 font-medium text-right">Open</th>
                  <th className="py-2 px-3 font-medium text-right">Click</th>
                  <th className="py-2 px-3 font-medium text-right">Conv.</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Schedule</th>
                  <th className="py-2 px-3 w-40"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 text-[13px]">
                      No campaigns match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((cmp) => (
                    <tr key={cmp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-900 truncate max-w-[240px]">{cmp.name}</p>
                        <p className="text-[13px] text-slate-400 truncate">ID: {cmp.id}</p>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${typeTint(
                            cmp.type
                          )}`}
                        >
                          {cmp.type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-medium border ${channelBadge(
                            cmp.channel
                          )}`}
                        >
                          {cmp.channel === 'WhatsApp' && <MessageSquare className="w-3 h-3" />}
                          {cmp.channel === 'SMS' && <Smartphone className="w-3 h-3" />}
                          {cmp.channel === 'Email' && <Mail className="w-3 h-3" />}
                          {cmp.channel}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]">
                        {cmp.audience}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {cmp.sent.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-900">
                        {cmp.openRate > 0 ? `${cmp.openRate}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-blue-950">
                        {cmp.clickRate > 0 ? `${cmp.clickRate}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {cmp.conversionRate > 0 ? `${cmp.conversionRate}%` : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${statusBadge(
                            cmp.status
                          )}`}
                        >
                          {cmp.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono text-[13px]">
                        {cmp.schedule}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setAnalyticsCampaign(cmp)}
                            className="px-2.5 py-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px]"
                          >
                            Analytics
                          </button>
                          {(cmp.status === 'Sending' || cmp.status === 'Paused' || cmp.status === 'Draft' || cmp.status === 'Scheduled') && (
                            <button
                              onClick={() => togglePause(cmp.id)}
                              className={`p-2 rounded-sm border transition ${cmp.status === 'Sending'
                                  ? 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                                  : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              title={
                                cmp.status === 'Sending'
                                  ? 'Pause'
                                  : cmp.status === 'Paused'
                                    ? 'Resume'
                                    : 'Launch now'
                              }
                            >
                              {cmp.status === 'Sending' ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => deleteCampaign(cmp.id)}
                            className="p-2 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                            title="Delete campaign"
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

        {/* PERFORMANCE OVER TIME */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-900">
              Campaign performance · last 7 days
            </p>
            <span className="text-[13px] text-slate-400">Sent / Opened / Clicked</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PERFORMANCE_OVER_TIME}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={13} />
                <YAxis stroke="#94a3b8" fontSize={13} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Bar dataKey="sent" name="Sent" fill="#172554" radius={[3, 3, 0, 0]} />
                <Bar dataKey="opened" name="Opened" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                <Bar dataKey="clicked" name="Clicked" fill="#059669" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* WIZARD MODAL */}
      {createOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-slate-100">
              <div
                className="h-full bg-blue-950 transition-all duration-300"
                style={{ width: `${(wizardStep / 5) * 100}%` }}
              />
            </div>

            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-950" />
                  New campaign · Step {wizardStep} of 5
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">{stepTitles[wizardStep - 1]}</p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">

              {/* STEP 1: Campaign name & type */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Campaign name</label>
                    <input
                      type="text"
                      placeholder="e.g. End of month M-Pesa discount promo"
                      value={newCampName}
                      onChange={(e) => setNewCampName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Campaign type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CAMPAIGN_TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => setNewCampType(t.type)}
                            className={`p-2 rounded-sm border text-left transition ${newCampType === t.type
                                ? 'border-blue-950 bg-blue-50 ring-1 ring-blue-100'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-sm flex items-center justify-center border ${t.tint}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <p className="text-[13px] font-medium text-slate-900 mt-1.5 truncate">
                              {t.type}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 2: Audience */}
              {wizardStep === 2 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-2 inline-flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Target audience
                  </label>
                  <div className="space-y-1.5">
                    {AUDIENCES.map((seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => setNewCampAudience(seg)}
                        className={`w-full flex items-center justify-between gap-2 p-2 rounded-sm border text-left transition ${newCampAudience === seg
                            ? 'border-blue-950 bg-blue-50 text-blue-950 font-medium'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        <span className="truncate">{seg}</span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 ${newCampAudience === seg
                              ? 'border-blue-950 bg-blue-950'
                              : 'border-slate-300'
                            }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: Content & Channel */}
              {wizardStep === 3 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Marketing channel</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['WhatsApp', 'SMS', 'Email'] as CampaignChannel[]).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setNewCampChannel(ch)}
                          className={`p-2 rounded-sm border text-left font-medium transition flex flex-col gap-1.5 ${newCampChannel === ch
                              ? 'border-blue-950 bg-blue-50 text-blue-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          {ch === 'WhatsApp' && <MessageSquare className="w-4 h-4 text-emerald-600" />}
                          {ch === 'SMS' && <Smartphone className="w-4 h-4 text-amber-600" />}
                          {ch === 'Email' && <Mail className="w-4 h-4 text-blue-600" />}
                          <span className="text-[13px]">{ch}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="font-medium text-slate-700">Message content</label>
                    <button
                      type="button"
                      onClick={() => setNewCampBody(TEMPLATES[0].preview)}
                      className="text-[13px] font-medium text-blue-950 hover:underline"
                    >
                      Load template
                    </button>
                  </div>

                  {newCampChannel === 'Email' && (
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Subject line</label>
                      <input
                        type="text"
                        placeholder="e.g. Your weekly store update"
                        value={newCampSubject}
                        onChange={(e) => setNewCampSubject(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Message body</label>
                    <textarea
                      rows={5}
                      placeholder="Hi {{customer_name}}, check out our new catalog…"
                      value={newCampBody}
                      onChange={(e) => setNewCampBody(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] text-slate-500">Variables:</span>
                    {['{{customer_name}}', '{{phone}}', '{{checkout_link}}', '{{store_name}}'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setNewCampBody((prev) => prev + ' ' + v)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-sm font-mono text-[13px] transition"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* STEP 4: Schedule */}
              {wizardStep === 4 && (
                <>
                  <label className="block font-medium text-slate-700">Delivery timing</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCampScheduleType('now')}
                      className={`p-2 rounded-sm border text-left transition ${newCampScheduleType === 'now'
                          ? 'border-blue-950 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <p className="font-medium">Send immediately</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Dispatch to audience right away.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCampScheduleType('scheduled')}
                      className={`p-2 rounded-sm border text-left transition ${newCampScheduleType === 'scheduled'
                          ? 'border-blue-950 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <p className="font-medium">Schedule for later</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Pick an optimal dispatch time.
                      </p>
                    </button>
                  </div>

                  <label className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-sm cursor-pointer mt-2">
                    <div>
                      <p className="font-medium text-slate-900">A/B subject test</p>
                      <p className="text-[13px] text-slate-500">
                        Test two variations on 20% of the audience.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={newCampABTest}
                      onChange={(e) => setNewCampABTest(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                    />
                  </label>
                </>
              )}

              {/* STEP 5: Review */}
              {wizardStep === 5 && (
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-3">
                  <p className="font-semibold text-slate-900 border-b border-slate-200 pb-2">
                    Campaign summary
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[13px] text-slate-500">Name</p>
                      <p className="font-medium text-slate-900">
                        {newCampName || 'Untitled campaign'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Type</p>
                      <p className="font-medium text-slate-900">{newCampType}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Channel</p>
                      <p className="font-medium text-blue-950">{newCampChannel}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Audience</p>
                      <p className="font-medium text-slate-900">{newCampAudience}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">Schedule</p>
                      <p className="font-medium text-emerald-700">
                        {newCampScheduleType === 'now' ? 'Send immediately' : 'Scheduled'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] text-slate-500">A/B test</p>
                      <p className="font-medium text-slate-900">
                        {newCampABTest ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[13px] text-slate-500 mb-1">Message preview</p>
                    <p className="bg-white border border-slate-200 p-2 rounded-sm text-slate-700 italic whitespace-pre-wrap">
                      {newCampBody || 'No message body provided.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              {wizardStep > 1 ? (
                <button
                  onClick={() => setWizardStep((prev) => prev - 1)}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {wizardStep < 5 ? (
                <button
                  onClick={() => setWizardStep((prev) => prev + 1)}
                  className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  Next step
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={submitCampaign}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  Launch campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS MODAL */}
      {analyticsCampaign && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setAnalyticsCampaign(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-950" />
                  Campaign analytics
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5 truncate">{analyticsCampaign.name}</p>
              </div>
              <button
                onClick={() => setAnalyticsCampaign(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              {/* Top KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500 inline-flex items-center gap-1">
                    <Send className="w-3 h-3" /> Sent
                  </p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                    {analyticsCampaign.sent.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Delivered
                  </p>
                  <p className="text-[15px] font-bold text-emerald-700 mt-0.5">
                    {analyticsCampaign.delivered.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500 inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Opened
                  </p>
                  <p className="text-[15px] font-bold text-blue-950 mt-0.5">
                    {analyticsCampaign.opened.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500 inline-flex items-center gap-1">
                    <MousePointerClick className="w-3 h-3" /> Clicked
                  </p>
                  <p className="text-[15px] font-bold text-indigo-700 mt-0.5">
                    {analyticsCampaign.clicked.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Rate grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-white border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500">Open rate</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                    {analyticsCampaign.openRate}%
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500">Click rate</p>
                  <p className="text-[15px] font-bold text-slate-900 mt-0.5">
                    {analyticsCampaign.clickRate}%
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500">Conversion</p>
                  <p className="text-[15px] font-bold text-emerald-700 mt-0.5">
                    {analyticsCampaign.conversionRate}%
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-sm p-2">
                  <p className="text-[13px] text-slate-500 inline-flex items-center gap-1">
                    <UserMinus className="w-3 h-3" /> Unsubscribed
                  </p>
                  <p className="text-[15px] font-bold text-red-600 mt-0.5">
                    {analyticsCampaign.unsubscribed}
                  </p>
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-emerald-800 inline-flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Revenue attributed
                  </p>
                  <p className="text-[15px] font-bold text-emerald-900 mt-0.5">
                    KES {analyticsCampaign.revenue.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] text-emerald-800">Conversions</p>
                  <p className="text-[15px] font-bold text-emerald-900 mt-0.5">
                    {analyticsCampaign.converted}
                  </p>
                </div>
              </div>

              {/* Funnel visualization */}
              <div>
                <p className="font-medium text-slate-700 mb-2">Delivery funnel</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Sent', value: analyticsCampaign.sent, color: 'bg-blue-950' },
                    { label: 'Delivered', value: analyticsCampaign.delivered, color: 'bg-emerald-600' },
                    { label: 'Opened', value: analyticsCampaign.opened, color: 'bg-indigo-600' },
                    { label: 'Clicked', value: analyticsCampaign.clicked, color: 'bg-amber-500' },
                    { label: 'Converted', value: analyticsCampaign.converted, color: 'bg-purple-600' },
                  ].map((row) => {
                    const pct = analyticsCampaign.sent > 0 ? (row.value / analyticsCampaign.sent) * 100 : 0;
                    return (
                      <div key={row.label} className="bg-slate-50 border border-slate-200 rounded-sm p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-medium text-slate-700">{row.label}</span>
                          <span className="text-[13px] font-mono text-slate-500">
                            {row.value.toLocaleString()} · {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-sm overflow-hidden">
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

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setAnalyticsCampaign(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── FilterDropdown ─────────── */
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
        <div className="absolute top-full mt-1 left-0 w-56 rounded-sm border border-slate-200 bg-white shadow-lg z-50 p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-2 rounded-sm text-[13px] ${!isActive ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
                className={`w-full text-left px-2 py-2 rounded-sm text-[13px] flex items-center justify-between ${selected ? 'bg-blue-50 text-blue-950 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
