'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  MessageCircle,
  Send,
  Search,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Shield,
  ShieldCheck,
  Users,
  LayoutTemplate,
  Zap,
  ChevronRight,
  CheckCheck,
  ToggleLeft,
  ToggleRight,
  Paperclip,
  Smile,
  UserPlus,
  Tag as TagIcon,
  StickyNote,
  Check,
  Ban,
  Download,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Image as ImageIcon,
  CreditCard,
  TrendingUp,
  BarChart3,
  Award,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
  AdminWhatsAppAccount,
  AdminWhatsAppAnalyticsSeries,
  AdminWhatsAppAnalyticsSummary,
  AdminWhatsAppAutomation,
  AdminWhatsAppBillingSummary,
  AdminWhatsAppBroadcast,
  AdminWhatsAppContact,
  AdminWhatsAppConversation,
  AdminWhatsAppConversationDetail,
  AdminWhatsAppCostBreakdown,
  AdminWhatsAppMessage,
  AdminWhatsAppTemplate,
  WhatsAppAutomationStatus,
  WhatsAppBroadcastStatus,
  WhatsAppConversationStatus,
  WhatsAppMessageStatus,
  WhatsAppQualityScore,
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
} from '@/lib/admin-types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Tab =
  | 'Connection'
  | 'Inbox'
  | 'Templates'
  | 'Automations'
  | 'Broadcasts'
  | 'Contacts'
  | 'Analytics'
  | 'Billing'
  | 'Settings';

type ConversationStatus = 'Open' | 'Pending' | 'Resolved' | 'Unassigned';
type ConversationFilter = 'All' | 'Unassigned' | 'Mine' | 'Open' | 'Resolved';
type MessageDirection = 'inbound' | 'outbound';
type DeliveryStatus = 'Sent' | 'Delivered' | 'Read';

type TemplateCategory = 'Marketing' | 'Utility' | 'Authentication';
type TemplateStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';
type QualityRating = 'Green' | 'Yellow' | 'Red';

type AutomationTrigger =
  | 'Order Placed'
  | 'Order Shipped'
  | 'Order Delivered'
  | 'Order Cancelled'
  | 'Payment Received'
  | 'Abandoned Cart'
  | 'Welcome Message'
  | 'Away Message';

type AutomationStatus = 'Active' | 'Paused' | 'Draft';

type BroadcastStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Paused' | 'Completed' | 'Failed';

type OptInStatus = 'Subscribed' | 'Unsubscribed';

interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string;
  whatsappProfileName: string;
  lastMessage: string;
  lastMessageTime: string;
  status: ConversationStatus;
  assignedTo: string | null;
  tags: string[];
  notes: string;
  messages: {
    id: string;
    direction: MessageDirection;
    body: string;
    timestamp: string;
    status: DeliveryStatus;
  }[];
}

interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  quality: QualityRating;
  lastUsed: string;
  headerType: 'None' | 'Text' | 'Image' | 'Video' | 'Document';
  headerContent: string;
  body: string;
  footer: string;
  buttons: { type: 'URL' | 'QUICK_REPLY' | 'PHONE'; text: string }[];
  exampleValues: string[];
}

interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  templateId: string;
  delayMinutes: number;
  recipients: 'Customer' | 'Admin Team' | 'Both';
  conditions: string;
  status: AutomationStatus;
  messagesSent: number;
  lastTriggered: string;
}

interface Broadcast {
  id: string;
  campaignName: string;
  templateName: string;
  recipients: number;
  delivered: number;
  read: number;
  replied: number;
  dateSent: string;
  status: BroadcastStatus;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  lastContact: string;
  optInStatus: OptInStatus;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTERS — wire shape → UI shape
//
// Every enum on the wire is UPPERCASE (Django TextChoices values). The
// UI uses title-case for display. The adapters normalise at the
// boundary so the render tree stays unchanged.
// ═══════════════════════════════════════════════════════════════════════════

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function mapConversationStatus(s: WhatsAppConversationStatus): ConversationStatus {
  if (s === 'OPEN') return 'Open';
  if (s === 'PENDING') return 'Pending';
  return 'Resolved';
}

function mapTemplateCategory(c: WhatsAppTemplateCategory): TemplateCategory {
  if (c === 'MARKETING') return 'Marketing';
  if (c === 'AUTHENTICATION') return 'Authentication';
  return 'Utility';
}

function mapTemplateStatus(s: WhatsAppTemplateStatus): TemplateStatus {
  if (s === 'APPROVED') return 'Approved';
  if (s === 'PENDING') return 'Pending';
  if (s === 'REJECTED') return 'Rejected';
  return 'Draft';
}

function mapQuality(q: WhatsAppQualityScore | 'UNKNOWN'): QualityRating {
  if (q === 'GREEN') return 'Green';
  if (q === 'YELLOW') return 'Yellow';
  return 'Red';
}

function mapMessageStatus(s: WhatsAppMessageStatus): DeliveryStatus {
  if (s === 'READ') return 'Read';
  if (s === 'DELIVERED') return 'Delivered';
  return 'Sent';
}

function mapAutomationStatus(s: WhatsAppAutomationStatus): AutomationStatus {
  if (s === 'ACTIVE') return 'Active';
  if (s === 'PAUSED') return 'Paused';
  return 'Draft';
}

function mapBroadcastStatus(s: WhatsAppBroadcastStatus): BroadcastStatus {
  if (s === 'COMPLETED') return 'Completed';
  if (s === 'SENDING') return 'Sending';
  if (s === 'SCHEDULED') return 'Scheduled';
  if (s === 'PAUSED') return 'Paused';
  if (s === 'FAILED') return 'Failed';
  return 'Draft';
}

function adaptMessage(m: AdminWhatsAppMessage): Conversation['messages'][number] {
  return {
    id: String(m.id),
    direction: m.direction === 'OUT' ? 'outbound' : 'inbound',
    body: m.body,
    timestamp: new Date(m.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: mapMessageStatus(m.status),
  };
}

function adaptConversation(
  c: AdminWhatsAppConversation,
  messages: AdminWhatsAppMessage[] = [],
): Conversation {
  return {
    id: String(c.id),
    customerName: c.contact.profileName || c.contact.waId,
    customerPhone: `+${c.contact.waId}`,
    whatsappProfileName: c.contact.profileName || c.contact.waId,
    lastMessage: c.lastMessagePreview || '',
    lastMessageTime: relativeTime(c.lastMessageAt),
    status: mapConversationStatus(c.status),
    assignedTo: c.assignedToName || null,
    tags: c.contact.tags || [],
    notes: c.contact.notes || '',
    messages: messages.map(adaptMessage),
  };
}

function adaptConversationDetail(c: AdminWhatsAppConversationDetail): Conversation {
  return adaptConversation(c, c.messages);
}

function adaptTemplate(t: AdminWhatsAppTemplate): Template {
  const body = (t.components as any[])?.find((c) => c?.type === 'BODY')?.text ?? '';
  const header = (t.components as any[])?.find((c) => c?.type === 'HEADER');
  const footer = (t.components as any[])?.find((c) => c?.type === 'FOOTER')?.text ?? '';
  const buttons = ((t.components as any[])?.find((c) => c?.type === 'BUTTONS')?.buttons ?? [])
    .slice(0, 3)
    .map((b: any) => ({
      type: (b.type === 'URL' ? 'URL' : b.type === 'PHONE_NUMBER' ? 'PHONE' : 'QUICK_REPLY') as
        | 'URL'
        | 'PHONE'
        | 'QUICK_REPLY',
      text: b.text ?? '',
    }));

  return {
    id: String(t.id),
    name: t.name,
    category: mapTemplateCategory(t.category),
    language: t.language,
    status: mapTemplateStatus(t.status),
    quality: mapQuality(t.quality),
    lastUsed: t.lastSyncedAt ? relativeTime(t.lastSyncedAt) : 'Never',
    headerType: header ? (header.format ?? 'None') : 'None',
    headerContent: header?.text ?? '',
    body,
    footer,
    buttons,
    exampleValues: [],
  };
}

function adaptAutomation(a: AdminWhatsAppAutomation): Automation {
  const recipients: Automation['recipients'] =
    a.recipients === 'CUSTOMER'
      ? 'Customer'
      : a.recipients === 'ADMIN_TEAM'
        ? 'Admin Team'
        : 'Both';

  return {
    id: String(a.id),
    name: a.name,
    trigger: a.trigger as AutomationTrigger,
    templateId: a.templateName || String(a.templateId ?? ''),
    delayMinutes: a.delayMinutes,
    recipients,
    conditions: a.conditions,
    status: mapAutomationStatus(a.status),
    messagesSent: a.messagesSent,
    lastTriggered: a.lastTriggered ? relativeTime(a.lastTriggered) : 'Never',
  };
}

function adaptBroadcast(b: AdminWhatsAppBroadcast): Broadcast {
  return {
    id: String(b.id),
    campaignName: b.campaignName,
    templateName: b.templateName,
    recipients: b.recipients,
    delivered: b.delivered,
    read: b.read,
    replied: b.replied,
    dateSent: b.sentAt
      ? new Date(b.sentAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
      : b.scheduledAt
        ? new Date(b.scheduledAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    status: mapBroadcastStatus(b.status),
  };
}

function adaptContact(c: AdminWhatsAppContact): Contact {
  return {
    id: String(c.id),
    name: c.profileName || `+${c.waId}`,
    phone: `+${c.waId}`,
    tags: c.tags || [],
    totalOrders: 0,
    totalSpent: 0,
    lastContact: relativeTime(c.lastInboundAt),
    optInStatus: c.optInStatus === 'SUBSCRIBED' ? 'Subscribed' : 'Unsubscribed',
    notes: c.notes || '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const KES = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '2px',
  color: '#0f172a',
  fontSize: '13px',
};

const qualityBadge = (q: QualityRating) =>
  q === 'Green'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : q === 'Yellow'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-red-50 text-red-700 border-red-100';

const templateStatusBadge = (s: TemplateStatus) =>
  s === 'Approved'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Pending'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : s === 'Rejected'
        ? 'bg-red-50 text-red-700 border-red-100'
        : 'bg-slate-100 text-slate-600 border-slate-200';

const automationStatusBadge = (s: AutomationStatus) =>
  s === 'Active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Paused'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

const broadcastStatusBadge = (s: BroadcastStatus) =>
  s === 'Completed'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Sending'
      ? 'bg-blue-50 text-blue-950 border-blue-100'
      : s === 'Scheduled'
        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
        : s === 'Paused'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : s === 'Failed'
            ? 'bg-red-50 text-red-700 border-red-100'
            : 'bg-slate-100 text-slate-600 border-slate-200';

const conversationStatusBadge = (s: ConversationStatus) =>
  s === 'Open'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : s === 'Pending'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : s === 'Resolved'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : 'bg-blue-50 text-blue-950 border-blue-100';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'Connection', label: 'Connection', icon: Wifi },
  { id: 'Inbox', label: 'Inbox', icon: MessageCircle },
  { id: 'Templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'Automations', label: 'Automations', icon: Zap },
  { id: 'Broadcasts', label: 'Broadcasts', icon: Send },
  { id: 'Contacts', label: 'Contacts', icon: Users },
  { id: 'Analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'Billing', label: 'Billing', icon: CreditCard },
  { id: 'Settings', label: 'Settings', icon: Shield },
];

export default function WhatsAppAdminPage() {
  const [tab, setTab] = useState<Tab>('Inbox');
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The header badge reflects `WhatsAppAccount.isActive` — one fetch
  // on mount, refreshed by the Connection tab when the user acts.
  useEffect(() => {
    let cancelled = false;
    adminApi.whatsapp.connection
      .get()
      .then((acct) => {
        if (!cancelled) setConnected(acct.isActive);
      })
      .catch(() => {
        // Unauthenticated or not yet configured — badge shows Disconnected.
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

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
            <span className="w-9 h-9 rounded-sm bg-[#25D366] text-white flex items-center justify-center shrink-0">
              <FaWhatsapp className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-900 truncate">
                WhatsApp Business
              </h1>
              <p className="text-[13px] text-slate-500 truncate">
                Manage conversations, templates, automations, and messaging costs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[13px] font-medium border ${connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
            >
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${active
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
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
        {tab === 'Connection' && (
          <ConnectionTab
            onConnect={() => {
              setConnected(true);
              setToast('WhatsApp number connected');
            }}
            onDisconnect={() => {
              setConnected(false);
              setToast('WhatsApp number disconnected');
            }}
            onToast={setToast}
          />
        )}
        {tab === 'Inbox' && <InboxTab onToast={setToast} />}
        {tab === 'Templates' && <TemplatesTab onToast={setToast} />}
        {tab === 'Automations' && <AutomationsTab onToast={setToast} />}
        {tab === 'Broadcasts' && <BroadcastsTab onToast={setToast} />}
        {tab === 'Contacts' && <ContactsTab onToast={setToast} />}
        {tab === 'Analytics' && <AnalyticsTab />}
        {tab === 'Billing' && <BillingTab />}
        {tab === 'Settings' && <SettingsTab onToast={setToast} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

function ConnectionTab({
  onConnect,
  onDisconnect,
  onToast,
}: {
  onConnect: () => void;
  onDisconnect: () => void;
  onToast: (msg: string) => void;
}) {
  const [account, setAccount] = useState<AdminWhatsAppAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const acct = await adminApi.whatsapp.connection.get();
      setAccount(acct);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const acct = await adminApi.whatsapp.connection.refresh();
      setAccount(acct);
      onToast('Status refreshed');
    } catch (e: any) {
      onToast(e?.message ?? 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account) return;
    if (!confirm('Disconnect this WhatsApp number? Outbound sends will stop.')) return;
    try {
      await adminApi.whatsapp.connection.setActive(false);
      setAccount({ ...account, isActive: false });
      onDisconnect();
    } catch (e: any) {
      onToast(e?.message ?? 'Disconnect failed');
    }
  };

  const handleConnect = async () => {
    if (!account) return;
    try {
      await adminApi.whatsapp.connection.setActive(true);
      setAccount({ ...account, isActive: true });
      onConnect();
    } catch (e: any) {
      onToast(e?.message ?? 'Connect failed');
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Connection"
        subtitle="Connect your WhatsApp Business number to manage customer conversations and automate order updates."
      />

      {loading ? (
        <LoadingPanel label="Loading account…" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : !account || !account.isActive ? (
        <div className="max-w-2xl mx-auto my-8 bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
          <span className="w-12 h-12 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <FaWhatsapp className="w-6 h-6" />
          </span>
          <p className="text-[13px] text-slate-600 max-w-md mx-auto">
            {account
              ? 'Your WhatsApp Business number is disconnected. Reconnect it to start sending order updates and replying to customers.'
              : 'Your WhatsApp Business number is not connected yet. Connect it to start sending order updates, replying to customers, and recovering abandoned carts.'}
          </p>
          {account && (
            <button onClick={handleConnect} className={btnPrimaryGreen}>
              <Wifi className="w-3.5 h-3.5" />
              Connect WhatsApp
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-[13px] text-emerald-900">
              Your WhatsApp number is connected and active. Messages sent from this number
              will appear in the Shared Inbox and trigger any automations you have turned on.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-[13px] font-semibold text-slate-900">Account Details</p>
            </div>
            <div className="divide-y divide-slate-100">
              <DetailRow
                label="Business Phone Number"
                helper="The WhatsApp number customers will see when they message you"
                value={account.displayPhone}
              />
              <DetailRow
                label="Account Status"
                helper=""
                valueNode={
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[13px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-100">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                }
              />
              <DetailRow
                label="Quality Score"
                helper="Green (Good), Yellow (Medium), or Red (Low). Based on customer feedback and spam reports."
                valueNode={
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[13px] font-medium border ${qualityBadge(mapQuality(account.qualityScore))}`}
                  >
                    <Award className="w-3 h-3" />
                    {account.qualityScore === 'GREEN'
                      ? 'Green (Good)'
                      : account.qualityScore === 'YELLOW'
                        ? 'Yellow (Medium)'
                        : 'Red (Low)'}
                  </span>
                }
              />
              <DetailRow
                label="Messaging Limit"
                helper="How many unique customers you can message in a rolling 24-hour period"
                value={account.messagingLimit}
              />
              <DetailRow
                label="Business Verification"
                helper=""
                valueNode={
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[13px] font-medium border ${account.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {account.verificationStatus === 'VERIFIED' ? 'Verified' : 'Not Verified'}
                  </span>
                }
              />
              <DetailRow
                label="Access Token"
                helper="System User token used to send messages on your behalf"
                valueNode={
                  account.tokenDaysLeft !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[13px] ${account.tokenDaysLeft <= 7 ? 'text-amber-700 font-medium' : 'text-slate-600'}`}
                    >
                      {account.tokenExpiresAt
                        ? `Expires in ${account.tokenDaysLeft} day${account.tokenDaysLeft === 1 ? '' : 's'}`
                        : 'No expiry'}
                    </span>
                  ) : (
                    <span className="text-[13px] text-slate-600">No expiry</span>
                  )
                }
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-2 flex flex-wrap gap-2">
            <button onClick={handleRefresh} disabled={refreshing} className={btnSecondary}>
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {refreshing ? 'Refreshing…' : 'Refresh Status'}
            </button>
            <button onClick={handleDisconnect} className={btnDanger}>
              <X className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-[13px] font-semibold text-slate-900">Business Profile</p>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Display Name"
                helper="The business name customers see in WhatsApp. Must match your verified business name."
                defaultValue={account.businessName}
              />
              <Field
                label="Phone Number ID"
                helper="The identifier Meta assigns to your WhatsApp Business phone number"
                defaultValue={account.phoneNumberId}
              />
              <Field
                label="WABA ID"
                helper="Your WhatsApp Business Account identifier"
                defaultValue={account.wabaId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — INBOX
// ═══════════════════════════════════════════════════════════════════════════

function InboxTab({ onToast }: { onToast: (msg: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>('All');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [windowOpen, setWindowOpen] = useState(true);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Initial list load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi.whatsapp.inbox
      .listConversations({})
      .then((res) => {
        if (cancelled) return;
        const adapted = res.map((c) => adaptConversation(c));
        setConversations(adapted);
        setActiveId(adapted[0]?.id ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Could not load conversations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Detail load when the active conversation changes
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingDetail(true);

    adminApi.whatsapp.inbox
      .conversationDetail(Number(activeId))
      .then((detail) => {
        if (cancelled) return;
        const adapted = adaptConversationDetail(detail);
        setWindowOpen(detail.windowOpen);
        setConversations((prev) =>
          prev.map((c) => (c.id === adapted.id ? adapted : c)),
        );
      })
      .catch((e) => {
        if (!cancelled) onToast(e?.message ?? 'Could not load the conversation.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, onToast]);

  // Poll for new messages every 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const since = new Date(Date.now() - 60_000).toISOString();
        await adminApi.whatsapp.inbox.poll(since);
        // The polled messages are not merged here because the shape
        // (flat list) requires a fan-out per conversation. When the
        // backend ships a compact delta shape, merge them into state.
      } catch {
        // Silent — polling should never surface errors to the user.
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(
    () =>
      conversations.filter((c) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          c.customerName.toLowerCase().includes(q) ||
          c.customerPhone.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q);

        const matchesFilter =
          filter === 'All' ||
          (filter === 'Mine' && c.assignedTo === 'You') ||
          (filter === 'Unassigned' && !c.assignedTo) ||
          filter === c.status;

        return matchesSearch && matchesFilter;
      }),
    [conversations, search, filter],
  );

  const send = async () => {
    if (!draft.trim() || !active) return;
    setSending(true);
    try {
      const msg = await adminApi.whatsapp.inbox.sendMessage(Number(active.id), {
        body: draft.trim(),
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === active.id
            ? {
              ...c,
              messages: [...c.messages, adaptMessage(msg)],
              lastMessage: msg.body,
              lastMessageTime: 'Just now',
            }
            : c,
        ),
      );
      setDraft('');
    } catch (e: any) {
      if (e?.code === 'WINDOW_CLOSED') {
        setWindowOpen(false);
        onToast('Reply window closed — send a template instead.');
      } else {
        onToast(e?.message ?? 'Could not send the message.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!active) return;
    try {
      const updated = await adminApi.whatsapp.inbox.resolve(Number(active.id), {});
      setConversations((prev) =>
        prev.map((c) =>
          c.id === active.id ? { ...c, status: mapConversationStatus(updated.status) } : c,
        ),
      );
      onToast('Conversation marked Resolved');
    } catch (e: any) {
      onToast(e?.message ?? 'Could not resolve.');
    }
  };

  if (loading) return <LoadingPanel label="Loading conversations…" />;
  if (error) return <ErrorPanel message={error} />;

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Inbox"
        subtitle="All your customer conversations in one place. Reply, assign, and track every chat."
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon={<FaWhatsapp className="w-6 h-6" />}
          title="No conversations yet. When a customer messages your WhatsApp number, their chat will appear here."
        />
      ) : (
        <div
          className="bg-white border border-slate-200 rounded-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_1fr]"
          style={{ height: 'calc(100vh - 240px)', minHeight: 540 }}
        >
          <div className="border-r border-slate-200 flex flex-col min-h-0">
            <div className="p-2 border-b border-slate-200 space-y-2 shrink-0">
              <p className="text-[13px] text-slate-500">
                The left panel shows all conversations. Click any chat to view the full
                message history and reply.
              </p>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search conversations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputCls + ' pl-9'}
                />
              </div>
              <div className="bg-slate-100 p-0.5 rounded-sm inline-flex gap-0.5 w-full overflow-x-auto">
                {(['All', 'Unassigned', 'Mine', 'Open', 'Resolved'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 px-2 py-1.5 rounded-sm text-[12px] font-medium transition whitespace-nowrap ${filter === f ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filtered.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-2.5 hover:bg-slate-50 transition ${isActive ? 'bg-emerald-50/60' : ''
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-9 h-9 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                        {c.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-slate-900 truncate">
                            {c.customerName}
                          </p>
                          <span className="text-[12px] text-slate-400 font-mono shrink-0">
                            {c.lastMessageTime}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 truncate mt-0.5">
                          {c.lastMessage || 'No messages yet'}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-sm text-[11px] font-medium border ${conversationStatusBadge(c.status)}`}
                          >
                            {c.status}
                          </span>
                          {c.assignedTo && (
                            <span className="text-[11px] text-slate-400 truncate">
                              · {c.assignedTo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-12 text-center text-slate-400 text-[13px]">
                  No conversations match your filters.
                </p>
              )}
            </div>
          </div>

          {active ? (
            <div className="flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold text-[13px] shrink-0">
                    {active.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                      {active.customerName}
                    </p>
                    <p className="text-[12px] text-slate-500 truncate">
                      {active.customerPhone} · {active.whatsappProfileName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ActionButton icon={<UserPlus className="w-3.5 h-3.5" />} label="Assign to" onClick={() => onToast('Assign dialog coming soon')} />
                  <ActionButton icon={<TagIcon className="w-3.5 h-3.5" />} label="Add Tag" onClick={() => onToast('Tag dialog coming soon')} />
                  <ActionButton icon={<StickyNote className="w-3.5 h-3.5" />} label="Add Note" onClick={() => onToast('Note dialog coming soon')} />
                  <ActionButton icon={<Check className="w-3.5 h-3.5" />} label="Resolve" onClick={handleResolve} />
                  <ActionButton icon={<Ban className="w-3.5 h-3.5" />} label="Mark as Spam" onClick={() => onToast('Reported as spam')} danger />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {loadingDetail ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-[13px]">Loading messages…</span>
                  </div>
                ) : active.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <span className="text-[13px]">No messages loaded yet.</span>
                  </div>
                ) : (
                  active.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-sm px-2.5 py-2 text-[13px] ${m.direction === 'outbound'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <div
                          className={`flex items-center gap-1 mt-1 justify-end ${m.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                        >
                          <span className="text-[11px] font-mono">{m.timestamp}</span>
                          {m.direction === 'outbound' && (
                            <CheckCheck
                              className={`w-3 h-3 ${m.status === 'Read' ? 'text-white' : 'text-emerald-200'}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-200 bg-white shrink-0">
                {windowOpen ? (
                  <>
                    <div className="px-2 pt-2 flex items-center gap-1 overflow-x-auto">
                      <QuickReply label="Thanks!" onClick={() => setDraft('Thanks for reaching out!')} />
                      <QuickReply label="Delivery info" onClick={() => setDraft('Delivery takes 1–2 business days within Nairobi.')} />
                      <QuickReply label="Payment link" onClick={() => setDraft('Here is your payment link: https://sokoflow.com/pay')} />
                    </div>
                    <div className="p-2 flex items-end gap-2">
                      <button className="p-2 rounded-sm hover:bg-slate-100 text-slate-500" aria-label="Attach">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-sm hover:bg-slate-100 text-slate-500" aria-label="Emoji">
                        <Smile className="w-4 h-4" />
                      </button>
                      <textarea
                        rows={1}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        placeholder="Type a message…"
                        className="flex-1 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                      <button
                        onClick={() => void send()}
                        disabled={!draft.trim() || sending}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white p-2 rounded-sm"
                        aria-label="Send"
                      >
                        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-amber-50 border-t border-amber-200 flex items-center justify-between gap-2">
                    <p className="text-[13px] text-amber-900">
                      The 24-hour reply window is closed. Send a template to continue.
                    </p>
                    <button
                      onClick={() => onToast('Template picker coming soon')}
                      className="text-[13px] font-medium text-amber-900 hover:underline inline-flex items-center gap-1"
                    >
                      <LayoutTemplate className="w-3 h-3" />
                      Send Template
                    </button>
                  </div>
                )}
                {windowOpen && (
                  <div className="px-2 pb-2 flex items-center gap-2 text-[12px]">
                    <button
                      onClick={() => onToast('Template picker coming soon')}
                      className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <LayoutTemplate className="w-3 h-3" />
                      Send Template
                    </button>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400">Use when the 24-hour reply window is closed</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
              <FaWhatsapp className="w-8 h-8" />
              <p className="text-[13px]">Select a conversation</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickReply({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[12px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-sm whitespace-nowrap"
    >
      {label}
    </button>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-sm text-[12px] font-medium border transition ${danger
        ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

function TemplatesTab({ onToast }: { onToast: (msg: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.whatsapp.templates.list({});
      setTemplates(res.map(adaptTemplate));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await adminApi.whatsapp.templates.sync();
      onToast(`Synced ${result.added + result.updated} templates from Meta.`);
      await load();
    } catch (e: any) {
      onToast(e?.message ?? 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Templates"
        subtitle="Pre-approved messages you can send to customers outside the 24-hour reply window."
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleSync} disabled={syncing} className={btnSecondary}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing…' : 'Sync from Meta'}
            </button>
            <button onClick={() => setShowCreate(true)} className={btnPrimaryGreen}>
              <Plus className="w-3.5 h-3.5" />
              Create Template
            </button>
          </div>
        }
      />

      <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-900">
          All templates must be approved by Meta before you can use them. Approval usually
          takes a few minutes to a few hours.
        </p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading templates…" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="w-6 h-6" />}
          title="No templates created yet. Create a template to send order updates, payment reminders, and promotional messages."
          action={{
            label: 'Create Template',
            onClick: () => setShowCreate(true),
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Template Name</th>
                  <th className="py-2 px-3 font-medium">Category</th>
                  <th className="py-2 px-3 font-medium">Language</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Quality Rating</th>
                  <th className="py-2 px-3 font-medium">Last Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">{t.name}</td>
                    <td className="py-2 px-3 text-slate-600">{t.category}</td>
                    <td className="py-2 px-3 text-slate-600">{t.language}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${templateStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${qualityBadge(t.quality)}`}>
                        {t.quality}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{t.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            onToast('Template created. Submitting to Meta…');
            await load();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('Utility');
  const [language, setLanguage] = useState('en');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [exampleValues, setExampleValues] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const components: any[] = [
      { type: 'BODY', text: body },
    ];
    if (footer) components.push({ type: 'FOOTER', text: footer });

    const categoryMap: Record<TemplateCategory, WhatsAppTemplateCategory> = {
      Marketing: 'MARKETING',
      Utility: 'UTILITY',
      Authentication: 'AUTHENTICATION',
    };

    try {
      const created = await adminApi.whatsapp.templates.create({
        name,
        language,
        category: categoryMap[category],
        components,
      });
      // Immediately submit for Meta review
      await adminApi.whatsapp.templates.submit(created.id);
      await onCreated();
    } catch (e: any) {
      onToast(e?.message ?? 'Could not create the template.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Create Template" subtitle="Submit a template for Meta review" widthClass="max-w-3xl">
      <form id="create-template-form" onSubmit={handleSubmit} className="space-y-4 text-[13px]">
        <SectionLabel>Template Details</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Choose a name, category, and language. The category determines when you can send
          this template and how much it costs.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Template Name" helper="Lowercase, no spaces. Example: order_confirmation" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Category" helper="Utility for order updates, Marketing for promotions, Authentication for OTPs">
            <select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} className={inputCls}>
              <option>Utility</option>
              <option>Marketing</option>
              <option>Authentication</option>
            </select>
          </Field>
          <Field label="Language" helper="The language this template is written in">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
              <option value="en">English</option>
              <option value="sw">Swahili</option>
            </select>
          </Field>
        </div>

        <SectionLabel>Body</SectionLabel>
        <p className="text-[12px] text-slate-500 -mt-2">
          Write the main message. Use variables like {'{{1}}'} for the customer&apos;s name, {'{{2}}'} for the order
          number, etc.
        </p>
        <Field
          label="Body Text"
          helper="Use {{1}}, {{2}} etc. for dynamic content. Keep it clear and short."
          required
        >
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className={inputCls + ' resize-none'}
            placeholder="Hi {{1}}, your order #{{2}} has been received…"
          />
        </Field>
        <Field label="Example Values" helper="Provide sample values for each variable so Meta can review the template">
          <input
            value={exampleValues}
            onChange={(e) => setExampleValues(e.target.value)}
            className={inputCls}
            placeholder="Brian, SOKO-9921"
          />
        </Field>

        <SectionLabel>Footer (Optional)</SectionLabel>
        <Field label="Footer Text">
          <input value={footer} onChange={(e) => setFooter(e.target.value)} className={inputCls} />
        </Field>

        {body && (
          <>
            <SectionLabel>Live Preview</SectionLabel>
            <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 space-y-1">
              <p className="text-[12px] text-emerald-700 font-medium uppercase">
                {name || 'Your Business'}
              </p>
              <p className="text-[13px] text-slate-800 whitespace-pre-wrap">{body}</p>
              {footer && <p className="text-[12px] text-slate-500 mt-1">{footer}</p>}
            </div>
          </>
        )}
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" form="create-template-form" className={btnPrimaryGreen} disabled={submitting}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════════════

function AutomationsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.whatsapp.automations.list();
      setAutomations(res.map(adaptAutomation));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load automations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (a: Automation) => {
    try {
      const updated = await adminApi.whatsapp.automations.toggle(Number(a.id), {});
      setAutomations((prev) =>
        prev.map((x) =>
          x.id === a.id ? { ...x, status: mapAutomationStatus(updated.status) } : x,
        ),
      );
      onToast('Automation toggled');
    } catch (e: any) {
      onToast(e?.message ?? 'Could not toggle the automation.');
    }
  };

  const triggerDefaultTemplate: Record<AutomationTrigger, string> = {
    'Order Placed': 'Order Confirmation',
    'Order Shipped': 'Shipping Update',
    'Order Delivered': 'Delivery Confirmation',
    'Order Cancelled': 'Cancellation Notice',
    'Payment Received': 'Payment Confirmation',
    'Abandoned Cart': 'Cart Recovery',
    'Welcome Message': 'Welcome Message',
    'Away Message': 'Away Reply',
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Automations"
        subtitle="Automatically send messages when events happen in your store."
      />

      {loading ? (
        <LoadingPanel label="Loading automations…" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : automations.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-6 h-6" />}
          title="No automations set up yet. Turn on an automation to send order updates, recover carts, and welcome new customers automatically."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {automations.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">{a.name}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">Trigger: {a.trigger}</p>
                </div>
                <button
                  onClick={() => void handleToggle(a)}
                  className={a.status === 'Active' ? 'text-emerald-600' : 'text-slate-300'}
                  aria-label="Toggle automation"
                >
                  {a.status === 'Active' ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[12px]">
                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 text-slate-600">
                  <Zap className="w-3 h-3" />
                  {a.trigger}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-300 self-center" />
                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-sm px-2 py-1 text-emerald-700">
                  <MessageCircle className="w-3 h-3" />
                  {a.templateId || '—'}
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 text-slate-600">
                  <Clock className="w-3 h-3" />
                  {a.delayMinutes === 0 ? 'Immediate' : `${a.delayMinutes} min delay`}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[12px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {a.messagesSent} sent · {a.lastTriggered}
                </span>
                <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[11px] ${automationStatusBadge(a.status)}`}>
                  {a.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-semibold text-slate-900">Available Automation Triggers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-3 font-medium">Trigger</th>
                <th className="py-2 px-3 font-medium">Description</th>
                <th className="py-2 px-3 font-medium">Default Template</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.keys(triggerDefaultTemplate) as AutomationTrigger[]).map((t) => (
                <tr key={t} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium text-slate-900">{t}</td>
                  <td className="py-2 px-3 text-slate-600">
                    {t === 'Order Placed' && 'Fires when a customer completes checkout'}
                    {t === 'Order Shipped' && 'Fires when order status changes to Shipped'}
                    {t === 'Order Delivered' && 'Fires when order status changes to Delivered'}
                    {t === 'Order Cancelled' && 'Fires when an order is cancelled'}
                    {t === 'Payment Received' && 'Fires when M-Pesa payment is confirmed'}
                    {t === 'Abandoned Cart' && 'Fires 1 hour after cart is abandoned'}
                    {t === 'Welcome Message' && 'Fires when a new customer messages for the first time'}
                    {t === 'Away Message' && 'Fires when a message arrives outside business hours'}
                  </td>
                  <td className="py-2 px-3 text-slate-500 font-mono">{triggerDefaultTemplate[t]}</td>
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
// TAB 5 — BROADCASTS
// ═══════════════════════════════════════════════════════════════════════════

function BroadcastsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, tRes] = await Promise.all([
        adminApi.whatsapp.broadcasts.list({}),
        adminApi.whatsapp.templates.list({ category: 'MARKETING' }),
      ]);
      setBroadcasts(bRes.map(adaptBroadcast));
      setTemplates(tRes.map(adaptTemplate));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load broadcasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = async (b: Broadcast) => {
    if (!confirm(`Send "${b.campaignName}" now?`)) return;
    try {
      await adminApi.whatsapp.broadcasts.send(Number(b.id));
      onToast('Broadcast queued for sending.');
      await load();
    } catch (e: any) {
      onToast(e?.message ?? 'Could not send the broadcast.');
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Broadcasts"
        subtitle="Send promotional messages to your customer list."
        action={
          <button onClick={() => setShowCreate(true)} className={btnPrimaryGreen}>
            <Plus className="w-3.5 h-3.5" />
            Create Broadcast
          </button>
        }
      />

      <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-900">
          Broadcasts use Marketing templates and cost more than Utility messages. Only send
          to customers who have opted in to receive marketing messages.
        </p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading broadcasts…" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : broadcasts.length === 0 ? (
        <EmptyState
          icon={<Send className="w-6 h-6" />}
          title="No broadcasts sent yet. Create a broadcast to send a promotion, announcement, or update to your customers."
          action={{
            label: 'Create Broadcast',
            onClick: () => setShowCreate(true),
            icon: <Plus className="w-3.5 h-3.5" />,
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3 font-medium">Campaign Name</th>
                  <th className="py-2 px-3 font-medium">Template Used</th>
                  <th className="py-2 px-3 font-medium text-center">Recipients</th>
                  <th className="py-2 px-3 font-medium text-center">Delivered</th>
                  <th className="py-2 px-3 font-medium text-center">Read</th>
                  <th className="py-2 px-3 font-medium text-center">Replied</th>
                  <th className="py-2 px-3 font-medium">Date Sent</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadcasts.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-900">{b.campaignName}</td>
                    <td className="py-2 px-3 font-mono text-slate-500">{b.templateName}</td>
                    <td className="py-2 px-3 text-center text-slate-700">{b.recipients.toLocaleString()}</td>
                    <td className="py-2 px-3 text-center text-slate-700">{b.delivered.toLocaleString()}</td>
                    <td className="py-2 px-3 text-center text-slate-700">{b.read.toLocaleString()}</td>
                    <td className="py-2 px-3 text-center text-slate-700">{b.replied.toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-500">{b.dateSent}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${broadcastStatusBadge(b.status)}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {(b.status === 'Draft' || b.status === 'Scheduled') && (
                        <button
                          onClick={() => void handleSend(b)}
                          className="text-[12px] font-medium text-emerald-700 hover:underline"
                        >
                          Send
                        </button>
                      )}
                      {b.status === 'Sending' && (
                        <span className="text-[12px] text-slate-400">In progress…</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateBroadcastModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            onToast('Broadcast created.');
            await load();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function CreateBroadcastModal({
  templates,
  onClose,
  onCreated,
  onToast,
}: {
  templates: Template[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [campaignName, setCampaignName] = useState('');
  const [templateName, setTemplateName] = useState(templates[0]?.name ?? '');
  const [audience, setAudience] = useState('all_opted_in');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) {
      onToast('Pick a template first.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.whatsapp.broadcasts.create({
        campaignName,
        templateName,
        audience,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      await onCreated();
    } catch (e: any) {
      onToast(e?.message ?? 'Could not create the broadcast.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Create Broadcast" subtitle="Send a promotional message to opted-in customers" widthClass="max-w-3xl">
      <form id="create-broadcast-form" onSubmit={handleSubmit} className="space-y-4 text-[13px]">
        <SectionLabel>Campaign Details</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Campaign Name" helper="For your reference only. Customers won't see this." required>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              required
              className={inputCls}
              placeholder="Weekend Flash Sale"
            />
          </Field>
          <Field label="Template" helper="Only Marketing templates can be used for broadcasts">
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className={inputCls}
            >
              {templates.length === 0 && <option value="">No marketing templates available</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <SectionLabel>Audience</SectionLabel>
        <Field label="Audience" helper="Only contacts who have opted in will receive the message.">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}>
            <option value="all_opted_in">All opted-in contacts</option>
            <option value="vip">VIP members</option>
            <option value="repeat_buyers">Repeat buyers</option>
            <option value="nairobi">Nairobi only</option>
          </select>
        </Field>

        <SectionLabel>Schedule</SectionLabel>
        <Field label="Schedule" helper="Leave blank to send immediately when you press Send.">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={inputCls}
          />
        </Field>
      </form>

      <ModalFooter>
        <button type="button" onClick={onClose} className={btnSecondary} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" form="create-broadcast-form" className={btnPrimaryGreen} disabled={submitting}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {submitting ? 'Creating…' : 'Create broadcast'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6 — CONTACTS
// ═══════════════════════════════════════════════════════════════════════════

function ContactsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.whatsapp.contacts.list({});
      setContacts(res.map(adaptContact));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        const q = search.toLowerCase();
        return (
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        );
      }),
    [contacts, search],
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Contacts"
        subtitle="Your customer list, built from WhatsApp conversations and store orders."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => onToast('Import coming soon')} className={btnSecondary}>
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <button onClick={() => onToast('Export coming soon')} className={btnSecondary}>
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        }
      />

      {loading ? (
        <LoadingPanel label="Loading contacts…" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No contacts yet. Contacts are created automatically when customers message you or place orders."
        />
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search contacts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls + ' pl-9'}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium">Phone Number</th>
                    <th className="py-2 px-3 font-medium">Tags</th>
                    <th className="py-2 px-3 font-medium">Last Contact</th>
                    <th className="py-2 px-3 font-medium">Opt-In Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">{c.name}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            c.tags.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded-sm text-[12px] bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{c.lastContact || '—'}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${c.optInStatus === 'Subscribed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {c.optInStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7 — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [summary, setSummary] = useState<AdminWhatsAppAnalyticsSummary | null>(null);
  const [series, setSeries] = useState<AdminWhatsAppAnalyticsSeries | null>(null);
  const [cost, setCost] = useState<AdminWhatsAppCostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, se, c] = await Promise.all([
        adminApi.whatsapp.analytics.summary(),
        adminApi.whatsapp.analytics.series(),
        adminApi.whatsapp.analytics.costBreakdown(),
      ]);
      setSummary(s);
      setSeries(se);
      setCost(c);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingPanel label="Loading analytics…" />;
  if (error) return <ErrorPanel message={error} onRetry={load} />;
  if (!summary || !series || !cost) return null;

  const chartData = series.days.map((d) => ({
    day: d.day,
    sent: d.sent,
    delivered: d.delivered,
    read: d.read,
    replies: d.replies,
  }));

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Analytics"
        subtitle="Track how your WhatsApp messages perform and how much they cost."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <KpiCard label="Messages Sent" value={summary.sent.toLocaleString()} helper="Total messages sent this period" />
        <KpiCard label="Messages Delivered" value={summary.delivered.toLocaleString()} helper="Successfully delivered" />
        <KpiCard label="Messages Read" value={summary.read.toLocaleString()} helper="Opened by the customer" />
        <KpiCard label="Replies Received" value={summary.replied.toLocaleString()} helper="Customer responses" />
        <KpiCard label="Total Cost" value={KES(Number(summary.totalCostKes) || 0)} helper="Estimated Meta messaging charges (KES)" accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Messages Over Time" subtitle="Daily message volume">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="sent" stroke="#0f172a" strokeWidth={2} />
              <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="replies" stroke="#ec4899" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost by Category" subtitle="Breakdown of Marketing vs. Utility vs. Authentication charges">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={cost.buckets}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {cost.buckets.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <RateCard label="Delivery Rate" value={`${summary.deliveryRate.toFixed(1)}%`} helper="Percentage of messages that reached the customer" />
        <RateCard label="Read Rate" value={`${summary.readRate.toFixed(1)}%`} helper="Percentage of messages opened by the customer" />
        <RateCard label="Response Rate" value={`${summary.responseRate.toFixed(1)}%`} helper="Percentage of messages that received a reply" />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
          <p className="text-[13px] font-semibold text-slate-900">Cost Breakdown</p>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Estimated based on Meta&apos;s published rates.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-3 font-medium">Category</th>
                <th className="py-2 px-3 font-medium text-center">Messages</th>
                <th className="py-2 px-3 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cost.buckets.map((b) => {
                const total = cost.buckets.reduce((acc, x) => acc + x.value, 0) || 1;
                return (
                  <tr key={b.name} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-900">{b.name}</td>
                    <td className="py-2 px-3 text-center text-slate-700">{b.value}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900">
                      {((b.value / total) * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RateCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className="text-[20px] font-bold text-slate-900 mt-0.5">{value}</p>
      <p className="text-[12px] text-slate-500 mt-1">{helper}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 8 — BILLING
// ═══════════════════════════════════════════════════════════════════════════

function BillingTab() {
  const [summary, setSummary] = useState<AdminWhatsAppBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await adminApi.whatsapp.billing.summary();
      setSummary(s);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load billing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const s = await adminApi.whatsapp.billing.refresh();
      setSummary(s);
    } catch (e: any) {
      // Banner stays as-is; the toast in the parent would be overkill here.
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading billing…" />;
  if (error) return <ErrorPanel message={error} onRetry={load} />;
  if (!summary) return null;

  const totalCount =
    summary.utilityCount + summary.marketingCount + summary.authCount + summary.serviceCount;

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Billing"
        subtitle="Track your WhatsApp messaging costs and manage payment settings."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <KpiCard label="This Month's Estimate" value={KES(Number(summary.totalKes) || 0)} helper="Estimated Meta charges" accent="emerald" />
        <KpiCard label="Messages This Month" value={totalCount.toLocaleString()} helper="Utility, Marketing, Auth & Service" />
        <KpiCard
          label="Free Service Conversations Used"
          value={`${summary.freeServiceUsed} / ${summary.freeServiceLimit.toLocaleString()}`}
          helper="You get 1,000 free service conversations per month"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Cost Summary</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Last synced: {new Date(summary.lastSyncedAt).toLocaleString('en-KE')}
            </p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className={btnSecondary}>
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {refreshing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          <LineRow label="Utility messages" value={KES(Number(summary.utilityKes) || 0)} helper={`${summary.utilityCount} messages`} />
          <LineRow label="Marketing messages" value={KES(Number(summary.marketingKes) || 0)} helper={`${summary.marketingCount} messages`} />
          <LineRow label="Authentication messages" value={KES(Number(summary.authKes) || 0)} helper={`${summary.authCount} messages`} />
          <LineRow label="Service (inbound)" value={Number(summary.serviceKes) === 0 ? 'Free' : KES(Number(summary.serviceKes))} helper={`${summary.serviceCount} conversations`} />
          <LineRow label="Total" value={KES(Number(summary.totalKes) || 0)} helper="Estimated for this month" emphasis />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-950 shrink-0 mt-0.5" />
        <p className="text-[13px] text-blue-900">
          Payment method and billing threshold are managed in Meta Business Manager. Open it
          to add or update a card.
        </p>
      </div>
    </div>
  );
}

function LineRow({
  label,
  value,
  helper,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-[13px] ${emphasis ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{label}</p>
        {helper && <p className="text-[12px] text-slate-500 mt-0.5">{helper}</p>}
      </div>
      <p className={`text-[13px] whitespace-nowrap ${emphasis ? 'font-semibold text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 9 — SETTINGS (local-only for now)
//
// These fields are not yet backed by API endpoints. Business hours,
// team access, and notification preferences stay as component state
// until the corresponding endpoints exist. Save writes a toast.
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab({ onToast }: { onToast: (msg: string) => void }) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Settings"
        subtitle="Configure your WhatsApp business profile, team access, and preferences."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-900">
          Business hours, team access, and notification preferences are saved locally for now.
          Backend endpoints for these settings are pending.
        </p>
      </div>

      <SettingsSection
        title="Business Hours"
        description="Set your operating hours. Messages received outside these hours can trigger an away message."
      >
        <div className="space-y-2">
          {days.map((d) => (
            <div key={d} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 text-slate-700">{d}</span>
              <input type="time" defaultValue="08:00" className={inputCls + ' max-w-[140px]'} />
              <span className="text-slate-400">–</span>
              <input type="time" defaultValue="18:00" className={inputCls + ' max-w-[140px]'} />
              <label className="inline-flex items-center gap-1.5 text-slate-600">
                <input type="checkbox" />
                Closed
              </label>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notification Preferences"
        description="Choose which events trigger alerts."
      >
        <div className="space-y-2">
          <ToggleRow label="New Message" helper="Alert me when a customer sends a message" defaultOn />
          <ToggleRow label="Unassigned Chat" helper="Alert me when a conversation has not been picked up" defaultOn />
          <ToggleRow label="Template Rejected" helper="Alert me when Meta rejects a template" defaultOn />
          <ToggleRow label="Low Quality Score" helper="Alert me if my WhatsApp quality score drops" defaultOn />
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button onClick={() => onToast('Settings saved')} className={btnPrimaryGreen}>
          <Check className="w-3.5 h-3.5" />
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PIECES
// ═══════════════════════════════════════════════════════════════════════════

const inputCls =
  'w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-600';

const btnPrimaryGreen =
  'inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 disabled:cursor-not-allowed';

const btnSecondary =
  'inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50 disabled:cursor-not-allowed';

const btnDanger =
  'inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-2 rounded-sm text-[13px] disabled:opacity-50';

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm py-16 flex flex-col items-center gap-2">
      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      <p className="text-[13px] text-slate-500">{label}</p>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-sm p-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <p className="text-[13px] text-red-700">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-[12px] font-medium text-red-700 hover:underline shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
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

function DetailRow({
  label,
  helper,
  value,
  valueNode,
}: {
  label: string;
  helper?: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        {helper && <p className="text-[12px] text-slate-500 mt-0.5">{helper}</p>}
      </div>
      <div className="text-[13px] text-slate-900 text-right whitespace-nowrap">
        {valueNode ?? value}
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  required,
  icon,
  children,
  defaultValue,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 mb-1">
        {icon}
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children ?? <input defaultValue={defaultValue} className={inputCls} />}
      {helper && <p className="text-[11px] text-slate-500 mt-1">{helper}</p>}
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

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  helper,
  defaultOn,
}: {
  label: string;
  helper: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer border border-slate-200 rounded-sm p-2 hover:bg-slate-50">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{helper}</p>
      </div>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="h-4 w-4 mt-1 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-600 shrink-0"
      />
    </label>
  );
}

function KpiCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: 'emerald';
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p className={`text-[16px] font-bold mt-0.5 ${accent === 'emerald' ? 'text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="text-[12px] text-slate-500 mt-1">{helper}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  action,
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
        <button onClick={action.onClick} className={btnPrimaryGreen}>
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}

function Modal({
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-2xl',
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-slate-200 rounded-sm w-full ${widthClass} max-h-[92vh] flex flex-col shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h3>
            <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-end gap-2 -mx-3 -mb-3 mt-3 sticky bottom-0 bg-white">
      {children}
    </div>
  );
}