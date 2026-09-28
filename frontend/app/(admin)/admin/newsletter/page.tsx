'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Send,
  Download,
  Users,
  TrendingUp,
  UserPlus,
  UserX,
  Percent,
  Search,
  Trash2,
  Eye,
  ChevronDown,
  Check,
  Mail,
  List,
  Tag,
  FileText,
  Calendar,
  Clock,
  BarChart3,
  ExternalLink,
  AlertTriangle,
  Layers,
  Settings,
  Copy,
  Edit3,
  Play,
  Pause,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// --- TYPES ---
type SubscriberStatus = 'Subscribed' | 'Unsubscribed';
type SubscriberSource = 'Footer Popup' | 'Checkout' | 'WhatsApp Opt-in' | 'Manual Import';

type Tab = 'subscribers' | 'lists' | 'segments' | 'templates' | 'campaigns' | 'analytics';

type CampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Paused' | 'Failed';
type ProviderId = 'sendgrid' | 'mailgun' | 'ses' | 'resend' | 'smtp';

interface Subscriber {
  id: string;
  email: string;
  name: string;
  source: SubscriberSource;
  status: SubscriberStatus;
  joinedDate: string;
  listIds: string[];
  tags: string[];
}

interface SubscriberList {
  id: string;
  name: string;
  description: string;
  subscriberCount: number;
  color: string;
}

interface Segment {
  id: string;
  name: string;
  description: string;
  rules: string[];
  count: number;
  color: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'Welcome' | 'Promotional' | 'Transactional' | 'Re-engagement';
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  listName: string;
  recipients: number;
  scheduledAt: string | null;
  sentAt: string | null;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubRate: number;
}

interface EmailProvider {
  id: ProviderId;
  name: string;
  description: string;
  status: 'Connected' | 'Disconnected';
  apiKeyMasked: string;
  dailyLimit: number;
  sentToday: number;
  color: string;
}

const INITIAL_PROVIDERS: EmailProvider[] = [
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional and marketing email delivery (Twilio).',
    status: 'Connected',
    apiKeyMasked: 'SG.xxxx••••••••••••••••',
    dailyLimit: 100000,
    sentToday: 842,
    color: 'bg-blue-50 text-blue-950 border-blue-100',
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Reliable SMTP relay and email API.',
    status: 'Disconnected',
    apiKeyMasked: '—',
    dailyLimit: 10000,
    sentToday: 0,
    color: 'bg-red-50 text-red-700 border-red-100',
  },
  {
    id: 'ses',
    name: 'Amazon SES',
    description: 'Cost-effective bulk email at scale.',
    status: 'Disconnected',
    apiKeyMasked: '—',
    dailyLimit: 50000,
    sentToday: 0,
    color: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Modern developer-first email API.',
    status: 'Disconnected',
    apiKeyMasked: '—',
    dailyLimit: 20000,
    sentToday: 0,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
];

const INITIAL_LISTS: SubscriberList[] = [
  { id: 'list-1', name: 'All Subscribers', description: 'Master list of every opted-in contact.', subscriberCount: 7820, color: 'bg-blue-50 text-blue-950 border-blue-100' },
  { id: 'list-2', name: 'Newsletter Weekly', description: 'Weekly storefront updates and deals.', subscriberCount: 4620, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'list-3', name: 'VIP Buyers', description: 'High-value customers (KES 100k+ lifetime spend).', subscriberCount: 312, color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'list-4', name: 'Checkout Opt-ins', description: 'Captured during order checkout.', subscriberCount: 3200, color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
];

const INITIAL_SEGMENTS: Segment[] = [
  { id: 'seg-1', name: 'Active Buyers', description: 'Purchased in the last 90 days.', rules: ['orders >= 1', 'last_order <= 90 days', 'status = Active'], count: 1240, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'seg-2', name: 'At Risk', description: 'No purchase in 90+ days.', rules: ['last_order >= 90 days', 'orders >= 1', 'status = Active'], count: 486, color: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'seg-3', name: 'VIP Spenders', description: 'Lifetime spend over KES 100k.', rules: ['lifetime_spend >= 100000'], count: 312, color: 'bg-amber-50 text-amber-800 border-amber-100' },
  { id: 'seg-4', name: 'M-Pesa Only', description: 'Preferred payment method M-Pesa.', rules: ['preferred_payment = M-Pesa'], count: 6520, color: 'bg-blue-50 text-blue-950 border-blue-100' },
];

const INITIAL_TEMPLATES: Template[] = [
  { id: 'tpl-1', name: 'Welcome Email', subject: 'Karibu {{name}} — welcome to SokoFlow', body: 'Hi {{name}},\n\nThank you for joining our newsletter. Here is a 5% discount on your first order: WELCOME5.\n\nEnjoy shopping!', category: 'Welcome', updatedAt: 'Sep 20, 2026' },
  { id: 'tpl-2', name: 'Weekly Deals', subject: 'This week\'s top electronics deals', body: 'Hi {{name}},\n\nFresh arrivals and limited-time discounts are here. Check them out now!\n\nShop: {{store_url}}', category: 'Promotional', updatedAt: 'Sep 18, 2026' },
  { id: 'tpl-3', name: 'Order Receipt', subject: 'Your order #{{order_number}} is confirmed', body: 'Hi {{name}},\n\nWe received your payment of KES {{amount}}. Your order is now processing.\n\nTrack: {{track_url}}', category: 'Transactional', updatedAt: 'Sep 15, 2026' },
  { id: 'tpl-4', name: 'We Miss You', subject: 'We miss you, {{name}}!', body: 'Hi {{name}},\n\nIt has been a while. Come back and enjoy 10% off your next order with code COMEBACK10.', category: 'Re-engagement', updatedAt: 'Sep 10, 2026' },
];

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: 'cmp-1', name: 'September VIP Preview', subject: 'Exclusive: early access for VIPs', status: 'Sent', listName: 'VIP Buyers', recipients: 312, scheduledAt: null, sentAt: 'Sep 22, 2026 09:00', openRate: 48.2, clickRate: 14.7, bounceRate: 0.6, unsubRate: 0.2 },
  { id: 'cmp-2', name: 'Weekly Deals #34', subject: 'New arrivals: laptops & phones', status: 'Sent', listName: 'Newsletter Weekly', recipients: 4620, scheduledAt: null, sentAt: 'Sep 20, 2026 10:00', openRate: 32.4, clickRate: 8.9, bounceRate: 0.9, unsubRate: 0.4 },
  { id: 'cmp-3', name: 'October Launch Teaser', subject: 'Something big is coming…', status: 'Scheduled', listName: 'All Subscribers', recipients: 7820, scheduledAt: 'Oct 01, 2026 09:00', sentAt: null, openRate: 0, clickRate: 0, bounceRate: 0, unsubRate: 0 },
  { id: 'cmp-4', name: 'Comeback Campaign Draft', subject: 'We miss you — take 10% off', status: 'Draft', listName: 'Checkout Opt-ins', recipients: 3200, scheduledAt: null, sentAt: null, openRate: 0, clickRate: 0, bounceRate: 0, unsubRate: 0 },
];

const INITIAL_SUBSCRIBERS: Subscriber[] = [
  { id: 'sub-1', email: 'brian.kiprop@strathmore.edu', name: 'Brian Kiprop', source: 'Footer Popup', status: 'Subscribed', joinedDate: 'Sep 22, 2026', listIds: ['list-1', 'list-2'], tags: ['student'] },
  { id: 'sub-2', email: 'amina.mohamed@gmail.com', name: 'Amina Mohamed', source: 'Checkout', status: 'Subscribed', joinedDate: 'Sep 21, 2026', listIds: ['list-1', 'list-4'], tags: ['buyer'] },
  { id: 'sub-3', email: 'kevin.ochieng@outlook.com', name: 'Kevin Ochieng', source: 'WhatsApp Opt-in', status: 'Subscribed', joinedDate: 'Sep 20, 2026', listIds: ['list-1', 'list-2'], tags: ['whatsapp'] },
  { id: 'sub-4', email: 'sharon.wangari@yahoo.com', name: 'Sharon Wangari', source: 'Footer Popup', status: 'Unsubscribed', joinedDate: 'Sep 14, 2026', listIds: ['list-1'], tags: [] },
  { id: 'sub-5', email: 'dev.isaacmutinda@gmail.com', name: 'Isaac Mutinda', source: 'Manual Import', status: 'Subscribed', joinedDate: 'Sep 10, 2026', listIds: ['list-1', 'list-3'], tags: ['vip', 'developer'] },
  { id: 'sub-6', email: 'wanjiku.mwangi@startup.co.ke', name: 'Wanjiku Mwangi', source: 'Checkout', status: 'Subscribed', joinedDate: 'Sep 05, 2026', listIds: ['list-1', 'list-3', 'list-4'], tags: ['vip'] },
];

const GROWTH_CHART_DATA = [
  { month: 'Apr', subscribers: 1200 },
  { month: 'May', subscribers: 1950 },
  { month: 'Jun', subscribers: 2800 },
  { month: 'Jul', subscribers: 3900 },
  { month: 'Aug', subscribers: 5400 },
  { month: 'Sep', subscribers: 7820 },
];

const CAMPAIGN_PERFORMANCE = [
  { name: 'VIP Preview', open: 48.2, click: 14.7, bounce: 0.6 },
  { name: 'Weekly #34', open: 32.4, click: 8.9, bounce: 0.9 },
  { name: 'Weekly #33', open: 29.1, click: 7.2, bounce: 1.1 },
  { name: 'Weekly #32', open: 31.5, click: 9.4, bounce: 0.8 },
  { name: 'August Promo', open: 27.6, click: 6.3, bounce: 1.4 },
];

const SOURCES: SubscriberSource[] = ['Footer Popup', 'Checkout', 'WhatsApp Opt-in', 'Manual Import'];
const STATUSES: SubscriberStatus[] = ['Subscribed', 'Unsubscribed'];

export default function NewsletterPage() {
  const [activeTab, setActiveTab] = useState<Tab>('subscribers');

  const [subscribers, setSubscribers] = useState<Subscriber[]>(INITIAL_SUBSCRIBERS);
  const [lists] = useState<SubscriberList[]>(INITIAL_LISTS);
  const [segments] = useState<Segment[]>(INITIAL_SEGMENTS);
  const [templates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [providers, setProviders] = useState<EmailProvider[]>(INITIAL_PROVIDERS);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriberStatus | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SubscriberSource | null>(null);
  const [listFilter, setListFilter] = useState<string | null>(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState('All Subscribers');
  const [broadcastTemplate, setBroadcastTemplate] = useState('');
  const [broadcastSchedule, setBroadcastSchedule] = useState('now');
  const [showPreview, setShowPreview] = useState(false);

  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false);
  const [settingsProviderId, setSettingsProviderId] = useState<ProviderId | null>(null);
  const [providerApiKey, setProviderApiKey] = useState('');

  const [templatePreview, setTemplatePreview] = useState<Template | null>(null);

  const anyModalOpen = broadcastOpen || providerSettingsOpen || !!templatePreview;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [anyModalOpen]);

  const closeAll = () => {
    setBroadcastOpen(false);
    setProviderSettingsOpen(false);
    setTemplatePreview(null);
  };

  const toast = (msg: string) => setToastMessage(msg);

  const sendBroadcast = () => {
    const provider = providers.find((p) => p.status === 'Connected');
    if (!provider) {
      toast('Connect an email provider before sending');
      return;
    }
    const audienceSize =
      lists.find((l) => l.name === broadcastAudience)?.subscriberCount ?? subscribers.filter((s) => s.status === 'Subscribed').length;

    const newCampaign: Campaign = {
      id: `cmp-${Date.now()}`,
      name: broadcastSubject || 'Untitled Campaign',
      subject: broadcastSubject || 'Untitled Campaign',
      status: broadcastSchedule === 'now' ? 'Sending' : 'Scheduled',
      listName: broadcastAudience,
      recipients: audienceSize,
      scheduledAt: broadcastSchedule === 'now' ? null : new Date(Date.now() + 86400000).toISOString().replace('T', ' ').substring(0, 16),
      sentAt: broadcastSchedule === 'now' ? new Date().toISOString().replace('T', ' ').substring(0, 16) : null,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      unsubRate: 0,
    };

    setCampaigns([newCampaign, ...campaigns]);
    setBroadcastOpen(false);
    setBroadcastSubject('');
    setBroadcastBody('');
    setShowPreview(false);
    toast(
      broadcastSchedule === 'now'
        ? `Broadcast dispatched via ${provider.name}`
        : `Broadcast scheduled for later via ${provider.name}`
    );
  };

  const exportSubscribers = () => {
    const csv =
      'data:text/csv;charset=utf-8,' +
      [
        'Email,Name,Source,Status,Joined Date,Tags',
        ...subscribers.map(
          (s) => `${s.email},"${s.name}",${s.source},${s.status},${s.joinedDate},"${s.tags.join('|')}"`
        ),
      ].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'subscribers_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Exported subscribers CSV');
  };

  const removeSubscriber = (id: string) => {
    setSubscribers((prev) => prev.filter((s) => s.id !== id));
    toast('Subscriber removed');
  };

  const toggleProvider = (id: ProviderId) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const next = p.status === 'Connected' ? 'Disconnected' : 'Connected';
          toast(`${p.name} ${next.toLowerCase()}`);
          return { ...p, status: next, apiKeyMasked: next === 'Connected' ? '••••••••••••••••' : '—' };
        }
        // Only one provider can be active at a time
        return p.status === 'Connected' ? { ...p, status: 'Disconnected' } : p;
      })
    );
  };

  const openProviderSettings = (id: ProviderId) => {
    setSettingsProviderId(id);
    setProviderApiKey('');
    setProviderSettingsOpen(true);
  };

  const saveProviderSettings = () => {
    if (!settingsProviderId) return;
    setProviders((prev) =>
      prev.map((p) =>
        p.id === settingsProviderId
          ? {
            ...p,
            apiKeyMasked: providerApiKey ? `${providerApiKey.slice(0, 6)}••••••••` : p.apiKeyMasked,
          }
          : p
      )
    );
    setProviderSettingsOpen(false);
    toast('Provider credentials saved');
  };

  const filtered = subscribers.filter((sub) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || sub.email.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || sub.status === statusFilter;
    const matchesSource = !sourceFilter || sub.source === sourceFilter;
    const matchesList = !listFilter || sub.listIds.includes(listFilter);
    return matchesSearch && matchesStatus && matchesSource && matchesList;
  });

  const activeFilterCount = (statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0) + (listFilter ? 1 : 0);

  const sourceBadge = (s: SubscriberSource) =>
    s === 'Footer Popup'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : s === 'Checkout'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : s === 'WhatsApp Opt-in'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-slate-100 text-slate-600 border-slate-200';

  const campaignStatusBadge = (s: CampaignStatus) =>
    s === 'Sent'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : s === 'Sending'
        ? 'bg-blue-50 text-blue-950 border-blue-100'
        : s === 'Scheduled'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : s === 'Paused'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
            : s === 'Failed'
              ? 'bg-red-50 text-red-600 border-red-100'
              : 'bg-slate-100 text-slate-600 border-slate-200';

  // Derived: the currently connected provider (used for banners & gating)
  const activeProvider = providers.find((p) => p.status === 'Connected');

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'subscribers', label: 'Subscribers', icon: Users, count: subscribers.length },
    { id: 'lists', label: 'Lists', icon: List, count: lists.length },
    { id: 'segments', label: 'Segments', icon: Layers, count: segments.length },
    { id: 'templates', label: 'Templates', icon: FileText, count: templates.length },
    { id: 'campaigns', label: 'Campaigns', icon: Send, count: campaigns.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

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
            <h1 className="text-[15px] font-semibold text-slate-900">Newsletter</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Subscriber lists, segments, templates, campaigns, and delivery analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportSubscribers}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setBroadcastOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>New campaign</span>
            </button>
          </div>
        </div>

        {/* TABS */}
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

        {/* EMAIL PROVIDER BANNER */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
          <Mail className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
          <div className="text-[13px] flex-1 min-w-0">
            <p className="font-medium text-blue-950">Email delivery is handled by an external provider</p>
            <p className="text-blue-800 mt-0.5">
              SokoFlow does not build SMTP infrastructure. Campaigns dispatch through your connected provider (SendGrid, Mailgun, SES, Resend).
              {activeProvider ? (
                <> Currently connected: <span className="font-medium">{activeProvider.name}</span>.</>
              ) : (
                <> No provider connected — connect one to start sending.</>
              )}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('campaigns')}
            className="text-[13px] font-medium text-blue-950 hover:underline shrink-0"
          >
            Manage providers
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Total subscribers</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">7,820</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                Active list
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">New this month</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">+1,420</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                +18.4% popups
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Unsubscribed</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">142</p>
              <p className="text-[13px] text-slate-500 mt-0.5">1.8% churn</p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Avg. open rate</p>
              <p className="text-[15px] font-bold text-slate-900 mt-0.5">33.8%</p>
              <p className="text-[13px] text-emerald-600 mt-0.5 inline-flex items-center gap-0.5">
                <Percent className="w-3 h-3" />
                Last 30 days
              </p>
            </div>
            <span className="w-8 h-8 rounded-sm bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* SUBSCRIBERS TAB */}
        {activeTab === 'subscribers' && (
          <>
            {/* FILTERS */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email or name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Status"
                  value={statusFilter}
                  options={STATUSES as unknown as string[]}
                  onChange={(v) => setStatusFilter(v as SubscriberStatus | null)}
                />
                <FilterDropdown
                  label="Source"
                  value={sourceFilter}
                  options={SOURCES as unknown as string[]}
                  onChange={(v) => setSourceFilter(v as SubscriberSource | null)}
                />
                <FilterDropdown
                  label="List"
                  value={listFilter ? lists.find((l) => l.id === listFilter)?.name ?? null : null}
                  options={lists.map((l) => l.name)}
                  onChange={(v) => {
                    const found = lists.find((l) => l.name === v);
                    setListFilter(found?.id ?? null);
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
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">
                  Subscribers directory · {filtered.length}
                </p>
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
                      <th className="py-2 px-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-[13px]">
                          No subscribers match your filters.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-900 truncate max-w-[260px]">
                            {sub.email}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{sub.name}</span>
                              {sub.tags.includes('vip') && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[13px] font-medium px-1.5 py-0.5 rounded-sm">
                                  VIP
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {sub.listIds.slice(0, 2).map((lid) => {
                                const l = lists.find((x) => x.id === lid);
                                if (!l) return null;
                                return (
                                  <span
                                    key={lid}
                                    className={`text-[13px] font-medium px-1.5 py-0.5 rounded-sm border ${l.color}`}
                                  >
                                    {l.name}
                                  </span>
                                );
                              })}
                              {sub.listIds.length > 2 && (
                                <span className="text-[13px] text-slate-500">+{sub.listIds.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${sourceBadge(
                                sub.source
                              )}`}
                            >
                              {sub.source}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${sub.status === 'Subscribed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-red-50 text-red-600 border-red-100'
                                }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">{sub.joinedDate}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => removeSubscriber(sub.id)}
                              className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                              title="Remove subscriber"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {/* LISTS TAB */}
        {activeTab === 'lists' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Subscriber lists</p>
                <p className="text-[13px] text-slate-500">
                  Group subscribers for targeted broadcasts
                </p>
              </div>
              <button
                onClick={() => toast('Create list dialog opened')}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New list
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lists.map((list) => (
                <div key={list.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-sm flex items-center justify-center border shrink-0 ${list.color}`}
                      >
                        <List className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{list.name}</p>
                        <p className="text-[13px] text-slate-500">
                          {list.subscriberCount.toLocaleString()} subscribers
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-slate-600">{list.description}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setListFilter(list.id);
                        setActiveTab('subscribers');
                      }}
                      className="text-[13px] font-medium text-blue-950 hover:underline"
                    >
                      View subscribers
                    </button>
                    <button
                      onClick={() => {
                        setBroadcastAudience(list.name);
                        setBroadcastOpen(true);
                      }}
                      className="text-[13px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                    >
                      <Send className="w-3 h-3" />
                      Send to list
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEGMENTS TAB */}
        {activeTab === 'segments' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Dynamic segments</p>
                <p className="text-[13px] text-slate-500">
                  Rule-based audiences refreshed automatically
                </p>
              </div>
              <button
                onClick={() => toast('Create segment dialog opened')}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New segment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {segments.map((seg) => (
                <div key={seg.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-sm flex items-center justify-center border shrink-0 ${seg.color}`}
                      >
                        <Layers className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{seg.name}</p>
                        <p className="text-[13px] text-slate-500">
                          {seg.count.toLocaleString()} contacts
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toast(`Editing ${seg.name}`)}
                      className="p-1.5 rounded-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                      title="Edit segment"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-600">{seg.description}</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-1">
                    <p className="text-[13px] font-medium text-slate-500">Rules</p>
                    {seg.rules.map((r, i) => (
                      <p key={i} className="text-[13px] font-mono text-slate-700 inline-flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {r}
                      </p>
                    ))}
                  </div>
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => {
                        setBroadcastAudience(seg.name);
                        setBroadcastOpen(true);
                      }}
                      className="text-[13px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                    >
                      <Send className="w-3 h-3" />
                      Send to segment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEMPLATES TAB */}
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
                onClick={() => toast('Create template dialog opened')}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{tpl.name}</p>
                        <p className="text-[13px] text-slate-500">
                          {tpl.category} · Updated {tpl.updatedAt}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-slate-800 truncate">{tpl.subject}</p>
                  <p className="text-[13px] text-slate-500 line-clamp-2 whitespace-pre-line">{tpl.body}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => setTemplatePreview(tpl)}
                      className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        setBroadcastSubject(tpl.subject);
                        setBroadcastBody(tpl.body);
                        setBroadcastTemplate(tpl.id);
                        setBroadcastOpen(true);
                      }}
                      className="text-[13px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Use in campaign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAMPAIGNS TAB */}
        {activeTab === 'campaigns' && (
          <div className="space-y-3">
            {/* PROVIDERS CARD */}
            <div className="bg-white border border-slate-200 rounded-sm">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">Email providers</p>
                  <p className="text-[13px] text-slate-500">
                    Only one provider can be active at a time
                  </p>
                </div>
                {activeProvider ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium px-2 py-1 rounded-sm border bg-emerald-50 text-emerald-700 border-emerald-100">
                    <Check className="w-3 h-3" />
                    Connected: {activeProvider.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium px-2 py-1 rounded-sm border bg-red-50 text-red-600 border-red-100">
                    <AlertTriangle className="w-3 h-3" />
                    No provider connected
                  </span>
                )}
              </div>

              <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className={`bg-white border rounded-sm p-2 space-y-2 ${p.status === 'Connected' ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-2 py-0.5 rounded-sm border ${p.status === 'Connected'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                      >
                        {p.status === 'Connected' ? <Check className="w-3 h-3" /> : null}
                        {p.status}
                      </span>
                      <span className="text-[13px] text-slate-400 font-mono">
                        {p.sentToday}/{p.dailyLimit.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-slate-900">{p.name}</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">{p.description}</p>
                      <p className="text-[13px] text-slate-400 font-mono mt-1 truncate">{p.apiKeyMasked}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                      <button
                        onClick={() => openProviderSettings(p.id)}
                        className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" />
                        Settings
                      </button>
                      <button
                        onClick={() => toggleProvider(p.id)}
                        className={`text-[13px] font-medium px-2.5 py-1.5 rounded-sm border transition ${p.status === 'Connected'
                            ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                            : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                      >
                        {p.status === 'Connected' ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CAMPAIGNS TABLE */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">Campaigns</p>
                <button
                  onClick={() => setBroadcastOpen(true)}
                  className="text-[13px] font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New campaign
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
                      <th className="py-2 px-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <p className="font-medium text-slate-900 truncate max-w-[240px]">{c.subject}</p>
                          <p className="text-[13px] text-slate-400 truncate">{c.name}</p>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{c.listName}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm font-medium border ${campaignStatusBadge(
                              c.status
                            )}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {c.recipients.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {c.openRate > 0 ? `${c.openRate}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {c.clickRate > 0 ? `${c.clickRate}%` : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          {c.sentAt ?? c.scheduledAt ?? 'Not scheduled'}
                        </td>
                        <td className="py-2 px-3">
                          {c.status === 'Draft' || c.status === 'Scheduled' || c.status === 'Paused' ? (
                            <button
                              onClick={() => {
                                setCampaigns((prev) =>
                                  prev.map((x) =>
                                    x.id === c.id
                                      ? { ...x, status: x.status === 'Paused' ? 'Sending' : 'Sending' }
                                      : x
                                  )
                                );
                                toast(`Campaign "${c.name}" resumed`);
                              }}
                              className="inline-flex items-center gap-1 bg-blue-950 hover:bg-blue-900 text-white font-medium px-2.5 py-2 rounded-sm text-[13px] transition"
                            >
                              <Play className="w-3 h-3" />
                              {c.status === 'Paused' ? 'Resume' : 'Send now'}
                            </button>
                          ) : c.status === 'Sending' ? (
                            <button
                              onClick={() => {
                                setCampaigns((prev) =>
                                  prev.map((x) => (x.id === c.id ? { ...x, status: 'Paused' } : x))
                                );
                                toast(`Campaign "${c.name}" paused`);
                              }}
                              className="inline-flex items-center gap-1 bg-white border border-amber-200 text-amber-700 font-medium px-2.5 py-2 rounded-sm text-[13px] hover:bg-amber-50 transition"
                            >
                              <Pause className="w-3 h-3" />
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={() => toast(`Viewing report for ${c.name}`)}
                              className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
                            >
                              <Eye className="w-3 h-3" />
                              Report
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-3">
            {/* Growth chart */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">
                  Subscriber list growth · 6 months
                </p>
                <span className="text-[13px] text-slate-400">Marketing analytics</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={GROWTH_CHART_DATA}>
                    <defs>
                      <linearGradient id="subColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#172554" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#172554" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={13} />
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
                    <Area
                      type="monotone"
                      dataKey="subscribers"
                      stroke="#172554"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#subColor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Campaign performance */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-900">
                  Campaign performance · open / click / bounce rates
                </p>
                <span className="text-[13px] text-slate-400">Last 5 campaigns</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CAMPAIGN_PERFORMANCE}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={13} />
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
                    <Bar dataKey="open" name="Open %" fill="#172554" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="click" name="Click %" fill="#059669" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="bounce" name="Bounce %" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Delivery KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Emails delivered</p>
                <p className="text-[15px] font-bold text-slate-900">18,432</p>
                <p className="text-[13px] text-emerald-600 inline-flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> 99.4% delivery rate
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Avg. open rate</p>
                <p className="text-[15px] font-bold text-slate-900">33.8%</p>
                <p className="text-[13px] text-slate-500">Industry avg: 21%</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1">
                <p className="text-[13px] font-medium text-slate-500">Unsubscribe rate</p>
                <p className="text-[15px] font-bold text-slate-900">0.34%</p>
                <p className="text-[13px] text-slate-500">Below the 0.5% threshold</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BROADCAST / CAMPAIGN MODAL */}
      {broadcastOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setBroadcastOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900">New campaign</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Compose and dispatch via {activeProvider ? activeProvider.name : 'an external provider'}
                </p>
              </div>
              <button
                onClick={() => setBroadcastOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px]">
              {!activeProvider && (
                <div className="bg-red-50 border border-red-200 rounded-sm p-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-red-700 text-[13px]">
                    No email provider is connected. Connect one under the Campaigns tab before sending.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target audience
                </label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name} — {l.subscriberCount.toLocaleString()} subscribers
                    </option>
                  ))}
                  {segments.map((s) => (
                    <option key={s.id} value={s.name}>
                      Segment · {s.name} — {s.count.toLocaleString()} contacts
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Start from template (optional)
                </label>
                <select
                  value={broadcastTemplate}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBroadcastTemplate(id);
                    const tpl = templates.find((t) => t.id === id);
                    if (tpl) {
                      setBroadcastSubject(tpl.subject);
                      setBroadcastBody(tpl.body);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="">Blank campaign</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject line</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly picks: top electronics & M-Pesa deals"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">Email body</label>
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
                    rows={7}
                    placeholder="Hi {{name}}, welcome to this week's newsletter…"
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                  />
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 min-h-[160px]">
                    <p className="text-[15px] font-semibold text-slate-900">
                      {broadcastSubject || 'Untitled subject'}
                    </p>
                    <p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-2">
                      {broadcastBody || 'No content entered yet.'}
                    </p>
                  </div>
                )}
                <p className="text-[13px] text-slate-400 mt-1">
                  Merge tags: {'{{name}}'}, {'{{email}}'}, {'{{order_number}}'}, {'{{store_url}}'}
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Schedule</label>
                <select
                  value={broadcastSchedule}
                  onChange={(e) => setBroadcastSchedule(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                >
                  <option value="now">Send immediately</option>
                  <option value="tomorrow">Tomorrow morning (9 AM EAT)</option>
                  <option value="custom">Custom date & time</option>
                </select>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setBroadcastOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={sendBroadcast}
                disabled={!activeProvider}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {broadcastSchedule === 'now' ? 'Dispatch broadcast' : 'Schedule broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROVIDER SETTINGS MODAL */}
      {providerSettingsOpen && settingsProviderId && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setProviderSettingsOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-md w-full p-3 shadow-xl space-y-3 text-[13px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">
                {providers.find((p) => p.id === settingsProviderId)?.name} settings
              </h3>
              <button
                onClick={() => setProviderSettingsOpen(false)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                API key / secret
              </label>
              <input
                type="password"
                placeholder="Paste API key"
                value={providerApiKey}
                onChange={(e) => setProviderApiKey(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <p className="text-[13px] text-slate-400 mt-1">
                Keys are stored encrypted. Only the first few characters are shown after saving.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-[13px]">
                SokoFlow does not deliver email directly. All dispatches are routed through the
                connected provider using their official API.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setProviderSettingsOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={saveProviderSettings}
                className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Save credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE PREVIEW MODAL */}
      {templatePreview && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setTemplatePreview(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                  {templatePreview.name}
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {templatePreview.category} · Updated {templatePreview.updatedAt}
                </p>
              </div>
              <button
                onClick={() => setTemplatePreview(null)}
                className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Subject</p>
                <p className="text-[13px] text-slate-900 font-medium">
                  {templatePreview.subject}
                </p>
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-500 mb-1">Body</p>
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-3">
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap">
                    {templatePreview.body}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setTemplatePreview(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setBroadcastSubject(templatePreview.subject);
                  setBroadcastBody(templatePreview.body);
                  setBroadcastTemplate(templatePreview.id);
                  setTemplatePreview(null);
                  setBroadcastOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
              >
                <Send className="w-3.5 h-3.5" />
                Use in campaign
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
