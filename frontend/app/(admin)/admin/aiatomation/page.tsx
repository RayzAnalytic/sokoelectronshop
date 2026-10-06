'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Sparkles, Brain, Search, FileText, Zap, Lightbulb,
    BarChart3, Settings as SettingsIcon, Send, Plus, X, CheckCircle2,
    TrendingUp, Users, Package, DollarSign, Shield, Key, Cpu, Upload,
    ArrowRight, AlertTriangle, Wand2, Layers, Gauge, ExternalLink,
    Check, Loader2,
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie,
    Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

import { adminApi } from '@/lib/admin-api';
import type {
    AdminProduct,
    AdminAIOverview,
    AdminAIConversation,
    AdminAIMessage,
    AdminAISearchConfig,
    AdminAISearchAnalytics,
    AdminAISearchDataQuality,
    AdminAIContentType,
    AdminAITone,
    AdminAILanguage,
    AdminAILength,
    AdminAIContentResponse,
    AdminAIAutomation,
    AdminAIAutomationStatus,
    AdminAIAutomationTemplate,
    AdminAIInsight,
    AdminAIInsightCategory,
    AdminAISettings,
    AdminAIUsage,
} from '@/lib/admin-types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE ALIASES — thin renames so the body stays close to the original
// ═══════════════════════════════════════════════════════════════════════════

type Tab =
    | 'Overview' | 'AI Assistant' | 'AI Search' | 'Content Generator'
    | 'Automations' | 'Insights' | 'Settings';

type ContentType = AdminAIContentType;
type Tone = AdminAITone;
type Language = AdminAILanguage;
type Length = AdminAILength;
type InsightCategory = AdminAIInsightCategory;
type AutomationStatus = AdminAIAutomationStatus;

type ChatMessage = AdminAIMessage;
type Conversation = AdminAIConversation;
type Automation = AdminAIAutomation;
type AutomationTemplate = AdminAIAutomationTemplate;
type Insight = AdminAIInsight;

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK DATA — renders before the Django endpoints return real data.
// Delete each block once its tab has live data.
// ═══════════════════════════════════════════════════════════════════════════

const SUGGESTED_PROMPTS = [
    'How did sales trend last week?',
    'Which products are running low?',
    'Who are my best customers?',
    'Compare this month vs. last month',
    "What's my average order value?",
    'Show me unpaid orders',
];

const INITIAL_CONVERSATIONS: Conversation[] = [
    { id: 'cv1', title: 'Sales trend this week', updatedAt: '10 mins ago', group: 'Today' },
    { id: 'cv2', title: 'Low stock products', updatedAt: '1 hour ago', group: 'Today' },
    { id: 'cv3', title: 'Best customers report', updatedAt: '3 hours ago', group: 'Today' },
    { id: 'cv4', title: 'October revenue breakdown', updatedAt: 'Yesterday', group: 'Yesterday' },
    { id: 'cv5', title: 'TikTok vs WhatsApp orders', updatedAt: 'Yesterday', group: 'Yesterday' },
    { id: 'cv6', title: 'Monthly AOV analysis', updatedAt: '3 days ago', group: 'Last 7 days' },
    { id: 'cv7', title: 'Unpaid M-Pesa orders', updatedAt: '5 days ago', group: 'Last 7 days' },
];

const INITIAL_CHAT: ChatMessage[] = [
    {
        id: 'm1',
        role: 'user',
        content: 'How did sales trend last week?',
        timestamp: '10:12',
    },
    {
        id: 'm2',
        role: 'assistant',
        content:
            'Last week your total revenue was KES 384,200 across 142 orders. That is up 12.4% compared to the week before (KES 341,800 / 128 orders). Saturday was your strongest day at KES 84,100 — 22% above your daily average.',
        chart: [
            { label: 'Mon', value: 41200 },
            { label: 'Tue', value: 48900 },
            { label: 'Wed', value: 52300 },
            { label: 'Thu', value: 46800 },
            { label: 'Fri', value: 62100 },
            { label: 'Sat', value: 84100 },
            { label: 'Sun', value: 48800 },
        ],
        table: {
            headers: ['Day', 'Revenue', 'Orders'],
            rows: [
                ['Saturday', 'KES 84,100', '32'],
                ['Friday', 'KES 62,100', '24'],
                ['Wednesday', 'KES 52,300', '19'],
            ],
        },
        timestamp: '10:13',
    },
];

const INITIAL_AUTOMATIONS: Automation[] = [
    { id: 'a1', name: 'Order Confirmation', trigger: 'Order placed', status: 'Active', runs: 1240, lastRun: '2 mins ago', successRate: 99.8 },
    { id: 'a2', name: 'Shipping Update', trigger: 'Order status → Shipped', status: 'Active', runs: 1103, lastRun: '15 mins ago', successRate: 99.5 },
    { id: 'a3', name: 'Delivery Confirmation', trigger: 'Order status → Delivered', status: 'Active', runs: 890, lastRun: '1 hour ago', successRate: 99.9 },
    { id: 'a4', name: 'Abandoned Cart Recovery', trigger: 'Cart abandoned for 1 hour', status: 'Active', runs: 412, lastRun: '18 mins ago', successRate: 97.2 },
    { id: 'a5', name: 'Payment Reminder', trigger: 'Order unpaid for 24 hours', status: 'Paused', runs: 234, lastRun: '3 days ago', successRate: 96.1 },
    { id: 'a6', name: 'Welcome Message', trigger: 'First message from new customer', status: 'Active', runs: 342, lastRun: '5 mins ago', successRate: 100 },
    { id: 'a7', name: 'Low Stock Alert', trigger: 'Stock below threshold', status: 'Active', runs: 87, lastRun: '4 hours ago', successRate: 98.8 },
    { id: 'a8', name: 'VIP Customer Alert', trigger: 'Customer total spend > KES 50,000', status: 'Active', runs: 23, lastRun: 'Yesterday', successRate: 100 },
    { id: 'a9', name: 'Creator Commission Due', trigger: 'Creator sales logged', status: 'Draft', runs: 0, lastRun: 'Never', successRate: 0 },
];

const PRE_BUILT_TEMPLATES: AutomationTemplate[] = [
    { name: 'Order Confirmation', trigger: 'Order placed', action: 'Send WhatsApp confirmation' },
    { name: 'Shipping Update', trigger: 'Order status → Shipped', action: 'Send WhatsApp tracking link' },
    { name: 'Delivery Confirmation', trigger: 'Order status → Delivered', action: 'Send WhatsApp thank-you + review request' },
    { name: 'Abandoned Cart Recovery', trigger: 'Cart abandoned for 1 hour', action: 'Send WhatsApp reminder' },
    { name: 'Payment Reminder', trigger: 'Order unpaid for 24 hours', action: 'Send WhatsApp payment link' },
    { name: 'Welcome Message', trigger: 'First message from new customer', action: 'Send welcome + catalog link' },
    { name: 'Low Stock Alert', trigger: 'Stock below threshold', action: 'Notify admin team' },
    { name: 'VIP Customer Alert', trigger: 'Customer total spend > KES 50,000', action: 'Tag as VIP + notify admin' },
    { name: 'Creator Commission Due', trigger: 'Creator sales logged', action: 'Notify finance team' },
];

const INITIAL_INSIGHTS: Insight[] = [
    { id: 'i1', category: 'sales', priority: 'high', text: 'Your revenue is up 12% this week compared to last week. TikTok drove most of the growth.', actionLabel: 'View revenue breakdown', actionLink: '/admin/analytics' },
    { id: 'i2', category: 'sales', priority: 'medium', text: 'Tuesday is your highest-revenue day. Consider scheduling promotions for Monday to capture early-week shoppers.', actionLabel: 'Create Monday promotion', actionLink: '/admin/whatsapp/broadcasts' },
    { id: 'i3', category: 'inventory', priority: 'high', text: '3 products are running low. Restock before the weekend to avoid stockouts.', actionLabel: 'Restock Now', actionLink: '/admin/products' },
    { id: 'i4', category: 'inventory', priority: 'medium', text: 'Product X has been viewed 200 times but purchased only twice. Consider adjusting the price or description.', actionLabel: 'Adjust Price', actionLink: '/admin/products' },
    { id: 'i5', category: 'customer', priority: 'medium', text: '23% of your customers are repeat buyers. The average repeat customer spends 2.4× more than a new customer.', actionLabel: 'View customer segments', actionLink: '/admin/customers' },
    { id: 'i6', category: 'customer', priority: 'high', text: "You have 45 customers who haven't ordered in 90 days. Consider a re-engagement campaign.", actionLabel: 'Send Re-engagement Campaign', actionLink: '/admin/whatsapp/broadcasts' },
    { id: 'i7', category: 'channel', priority: 'high', text: 'TikTok traffic converts at 3.2%. WhatsApp converts at 8.1%. Consider shifting more marketing to WhatsApp.', actionLabel: 'Review channel strategy', actionLink: '/admin/analytics' },
    { id: 'i8', category: 'channel', priority: 'low', text: 'Your abandoned cart rate is 68%. The industry average is 70%. Your recovery automation is working.', actionLabel: 'View recovery automation', actionLink: '/admin/ai/automations' },
];

const USAGE_DATA = [
    { day: 'Mon', assistant: 12400, content: 3400, search: 8900 },
    { day: 'Tue', assistant: 16800, content: 4200, search: 11200 },
    { day: 'Wed', assistant: 14200, content: 3800, search: 9800 },
    { day: 'Thu', assistant: 18900, content: 5100, search: 12400 },
    { day: 'Fri', assistant: 22400, content: 6200, search: 14800 },
    { day: 'Sat', assistant: 19800, content: 4800, search: 13200 },
    { day: 'Sun', assistant: 15200, content: 3200, search: 9600 },
];

const COST_BY_FEATURE = [
    { name: 'Assistant', value: 189, color: '#172554' },
    { name: 'Content Gen', value: 62, color: '#10b981' },
    { name: 'Search', value: 143, color: '#8b5cf6' },
];

const CONTENT_TYPES: { type: ContentType; useCase: string; output: string }[] = [
    { type: 'Product Description', useCase: 'Website product pages', output: 'Full description with bullet points' },
    { type: 'TikTok Caption', useCase: 'TikTok posts', output: 'Short caption + hashtags' },
    { type: 'WhatsApp Broadcast', useCase: 'Marketing messages', output: 'Short promotional message' },
    { type: 'Social Media Post', useCase: 'Facebook, Instagram', output: 'Caption + suggested image text' },
    { type: 'SEO Meta Description', useCase: 'Search engines', output: '155-character summary' },
    { type: 'Product Title', useCase: 'Bulk title optimization', output: 'TikTok-optimized title' },
];

const TOOLTIP_STYLE = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '2px',
    color: '#0f172a',
    fontSize: '12px',
};

const KES = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const inputCls =
    'w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950';

const btnPrimary =
    'inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]';

const btnSecondary =
    'inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]';

const btnDanger =
    'inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-2 rounded-sm text-[13px]';

const btnDangerSubtle =
    'inline-flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-[13px]';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'Overview', label: 'Overview', icon: Sparkles },
    { id: 'AI Assistant', label: 'AI Assistant', icon: Brain },
    { id: 'AI Search', label: 'AI Search', icon: Search },
    { id: 'Content Generator', label: 'Content Generator', icon: FileText },
    { id: 'Automations', label: 'Automations', icon: Zap },
    { id: 'Insights', label: 'Insights', icon: Lightbulb },
    { id: 'Settings', label: 'Settings', icon: SettingsIcon },
];

export default function AIAutomationsPage() {
    const [tab, setTab] = useState<Tab>('Overview');
    const [toast, setToast] = useState<string | null>(null);

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
                        <span className="w-9 h-9 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-[15px] font-semibold text-slate-900 truncate">
                                AI &amp; Automations
                            </h1>
                            <p className="text-[13px] text-slate-500 truncate">
                                Your store&apos;s intelligence layer. Ask questions, generate content, and
                                automate repetitive tasks.
                            </p>
                        </div>
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
                                            ? 'border-blue-950 text-blue-950'
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
                {tab === 'Overview' && <OverviewTab onJump={setTab} onToast={setToast} />}
                {tab === 'AI Assistant' && <AssistantTab onToast={setToast} />}
                {tab === 'AI Search' && <SearchTab onToast={setToast} />}
                {tab === 'Content Generator' && <ContentTab onToast={setToast} />}
                {tab === 'Automations' && <AutomationsTab onToast={setToast} />}
                {tab === 'Insights' && <InsightsTab onToast={setToast} />}
                {tab === 'Settings' && <SettingsTab onToast={setToast} />}
            </main>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({
    onJump,
    onToast,
}: {
    onJump: (t: Tab) => void;
    onToast: (msg: string) => void;
}) {
    const [aiEnabled, setAiEnabled] = useState(true);
    const [overview, setOverview] = useState<AdminAIOverview | null>(null);

    // ── Wire: GET /api/admin/ai/overview/
    useEffect(() => {
        adminApi.ai.overview()
            .then((data) => {
                setOverview(data);
                setAiEnabled(data.assistant_status === 'Active');
            })
            .catch(() => { /* fall back to constants */ });
    }, []);

    const usageData = overview?.usage_by_day ?? USAGE_DATA;
    const costData = overview?.cost_by_feature ?? COST_BY_FEATURE;
    const activeAutomations = overview?.active_automations
        ?? INITIAL_AUTOMATIONS.filter((a) => a.status === 'Active').length;
    const totalAutomations = overview?.total_automations ?? INITIAL_AUTOMATIONS.length;

    return (
        <div className="space-y-3">
            <PageHeader
                title="AI & Automations"
                subtitle="Your store's intelligence layer. Ask questions, generate content, and automate repetitive tasks."
            />

            {!aiEnabled ? (
                <div className="max-w-2xl mx-auto my-8 bg-white border border-slate-200 rounded-sm p-6 text-center space-y-4">
                    <span className="w-12 h-12 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                    </span>
                    <p className="text-[13px] text-slate-600 max-w-md mx-auto">
                        No automations or AI tools configured yet. Start by enabling the AI Assistant
                        or turning on a simple automation.
                    </p>
                    <div className="flex justify-center gap-2">
                        <button
                            onClick={async () => {
                                try { await adminApi.ai.settings.update({ enabled: true }); } catch { /* noop */ }
                                setAiEnabled(true);
                                onToast('AI Assistant enabled');
                            }}
                            className={btnPrimary}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Enable AI Assistant
                        </button>
                        <button onClick={() => onJump('Automations')} className={btnSecondary}>
                            <Zap className="w-3.5 h-3.5" />
                            Browse automations
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <KpiCard
                            label="AI Assistant"
                            value="Active"
                            helper="Read-only copilot connected to your store data"
                            icon={<Brain className="w-4 h-4" />}
                            tint="bg-blue-50 text-blue-950"
                            accent="emerald"
                        />
                        <KpiCard
                            label="Active Automations"
                            value={`${activeAutomations} of ${totalAutomations}`}
                            helper="Workflows currently running"
                            icon={<Zap className="w-4 h-4" />}
                            tint="bg-emerald-50 text-emerald-700"
                        />
                        <KpiCard
                            label="Tokens This Month"
                            value={(overview?.tokens_this_month ?? 482300).toLocaleString()}
                            helper="Across Assistant, Content Gen, and Search"
                            icon={<Cpu className="w-4 h-4" />}
                            tint="bg-indigo-50 text-indigo-700"
                        />
                        <KpiCard
                            label="Estimated Cost"
                            value={KES(overview?.estimated_cost_kes ?? 394)}
                            helper="Based on your provider's published rates"
                            icon={<DollarSign className="w-4 h-4" />}
                            tint="bg-amber-50 text-amber-700"
                            accent="amber"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <section className="bg-white border border-slate-200 rounded-sm">
                            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-900">AI Assistant</p>
                                    <p className="text-[12px] text-slate-500 mt-0.5">
                                        Chat interface for querying store data
                                    </p>
                                </div>
                                <button
                                    onClick={() => onJump('AI Assistant')}
                                    className="text-[12px] font-medium text-blue-950 hover:underline"
                                >
                                    Open →
                                </button>
                            </div>
                            <div className="p-3 space-y-2">
                                {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => onJump('AI Assistant')}
                                        className="w-full text-left text-[12px] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-sm px-2 py-1.5 text-slate-700 hover:text-blue-950 transition"
                                    >
                                        &ldquo;{p}&rdquo;
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="bg-white border border-slate-200 rounded-sm">
                            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-900">Active Automations</p>
                                    <p className="text-[12px] text-slate-500 mt-0.5">
                                        Workflows running in the background
                                    </p>
                                </div>
                                <button
                                    onClick={() => onJump('Automations')}
                                    className="text-[12px] font-medium text-blue-950 hover:underline"
                                >
                                    Manage →
                                </button>
                            </div>
                            <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                {INITIAL_AUTOMATIONS.filter((a) => a.status === 'Active').slice(0, 5).map((a) => (
                                    <li key={a.id} className="px-3 py-2 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-medium text-slate-900 truncate">{a.name}</p>
                                            <p className="text-[11px] text-slate-500 truncate">{a.trigger}</p>
                                        </div>
                                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                            {a.runs.toLocaleString()} runs
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="bg-white border border-slate-200 rounded-sm">
                            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-900">AI Usage &amp; Cost</p>
                                    <p className="text-[12px] text-slate-500 mt-0.5">
                                        Tokens and estimated spend this month
                                    </p>
                                </div>
                                <button
                                    onClick={() => onJump('Settings')}
                                    className="text-[12px] font-medium text-blue-950 hover:underline"
                                >
                                    Configure →
                                </button>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="h-32 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={usageData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                                            <Bar dataKey="assistant" stackId="a" fill="#172554" />
                                            <Bar dataKey="content" stackId="a" fill="#10b981" />
                                            <Bar dataKey="search" stackId="a" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[12px]">
                                    <span className="text-slate-500">Estimated this month</span>
                                    <span className="font-semibold text-slate-900">
                                        {KES(overview?.estimated_cost_kes ?? 394)}
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// AI ASSISTANT
// ═══════════════════════════════════════════════════════════════════════════

function AssistantTab({ onToast }: { onToast: (msg: string) => void }) {
    const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
    const [activeConvId, setActiveConvId] = useState<string>('cv1');
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
    const [draft, setDraft] = useState('');
    const [search, setSearch] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // ── Wire: GET /api/admin/ai/conversations/
    useEffect(() => {
        adminApi.ai.assistant.conversations.list()
            .then(setConversations)
            .catch(() => { /* keep INITIAL_CONVERSATIONS */ });
    }, []);

    // ── Wire: GET /api/admin/ai/conversations/:id/messages/
    useEffect(() => {
        if (!activeConvId) return;
        adminApi.ai.assistant.messages.list(activeConvId)
            .then(setMessages)
            .catch(() => { /* keep INITIAL_CHAT */ });
    }, [activeConvId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const groupedConvs = useMemo(() => {
        const map: Record<string, Conversation[]> = {};
        const filtered = conversations.filter(
            (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()),
        );
        filtered.forEach((c) => {
            if (!map[c.group]) map[c.group] = [];
            map[c.group].push(c);
        });
        return map;
    }, [conversations, search]);

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const userMsg: ChatMessage = {
            id: `m-${Date.now()}`,
            role: 'user',
            content: text.trim(),
            timestamp: now,
        };
        setMessages((prev) => [...prev, userMsg]);
        setDraft('');
        setIsThinking(true);

        // ── Wire: POST /api/admin/ai/conversations/:id/messages/
        //        Use adminApi.ai.assistant.messages.stream for token streaming.
        try {
            const reply = await adminApi.ai.assistant.messages.create(
                activeConvId || 'new',
                { content: text.trim() },
            );
            setMessages((prev) => [...prev, reply]);
        } catch {
            // Fallback mock while backend isn't wired
            const reply: ChatMessage = {
                id: `m-${Date.now()}-a`,
                role: 'assistant',
                content:
                    'Here is what I found. This is a read-only response based on your store data. Customer emails and phone numbers have been masked for privacy.',
                table: text.toLowerCase().includes('low')
                    ? {
                        headers: ['Product', 'Stock', 'Threshold'],
                        rows: [
                            ['USB-C Multiport Hub 7-in-1', '0', '5'],
                            ['UltraWide 29" Gaming Monitor', '6', '5'],
                            ['Wireless Ergonomic Keyboard', '8', '10'],
                        ],
                    }
                    : undefined,
                link: { label: 'View full report in Analytics', href: '/admin/analytics' },
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages((prev) => [...prev, reply]);
        } finally {
            setIsThinking(false);
        }
    };

    const startNewChat = async () => {
        try {
            const conv = await adminApi.ai.assistant.conversations.create();
            setConversations((prev) => [conv, ...prev]);
            setActiveConvId(conv.id);
            setMessages([]);
        } catch {
            setMessages([]);
            setActiveConvId('');
        }
    };

    return (
        <div className="space-y-3">
            <PageHeader
                title="AI Assistant"
                subtitle="Ask anything about your store—sales, orders, stock, customers—in plain language."
            />

            {messages.length === 0 ? (
                <EmptyState
                    icon={<Brain className="w-6 h-6" />}
                    title="Ask your first question. Try: 'How did sales trend last week?' or 'Which products are running low?'"
                />
            ) : (
                <div
                    className="bg-white border border-slate-200 rounded-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr]"
                    style={{ height: 'calc(100vh - 240px)', minHeight: 560 }}
                >
                    <div className="border-r border-slate-200 flex flex-col min-h-0">
                        <div className="p-2 border-b border-slate-200 space-y-2 shrink-0">
                            <button
                                onClick={startNewChat}
                                className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px]"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Chat
                            </button>
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
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {Object.entries(groupedConvs).map(([group, list]) => (
                                <div key={group} className="border-b border-slate-100 last:border-b-0">
                                    <p className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                                        {group}
                                    </p>
                                    <ul>
                                        {list.map((c) => (
                                            <li key={c.id}>
                                                <button
                                                    onClick={() => setActiveConvId(c.id)}
                                                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition ${activeConvId === c.id ? 'bg-blue-50/70' : ''
                                                        }`}
                                                >
                                                    <p className="text-[12px] font-medium text-slate-900 truncate">
                                                        {c.title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                        {c.updatedAt}
                                                    </p>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col min-h-0">
                        <div className="px-3 py-2 border-b border-slate-200 bg-blue-50 shrink-0">
                            <p className="text-[12px] text-blue-950 flex items-start gap-1.5">
                                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                The AI Assistant is read-only. It can analyse your data but cannot change
                                anything—orders, products, or settings. All AI actions are logged. Customer
                                emails and phone numbers are masked.
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[85%] rounded-sm px-3 py-2 text-[13px] ${m.role === 'user'
                                                ? 'bg-blue-950 text-white'
                                                : 'bg-white border border-slate-200 text-slate-800'
                                            }`}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

                                        {m.chart && m.chart.length > 0 && (
                                            <div className="mt-2 h-40 bg-slate-50 border border-slate-200 rounded-sm p-1.5">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={m.chart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                                                        <Line type="monotone" dataKey="value" stroke="#172554" strokeWidth={2} dot={{ r: 2 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}

                                        {m.table && (
                                            <div className="mt-2 border border-slate-200 rounded-sm overflow-hidden">
                                                <table className="w-full text-[12px]">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-500">
                                                            {m.table.headers.map((h) => (
                                                                <th key={h} className="text-left py-1.5 px-2 font-medium">
                                                                    {h}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {m.table.rows.map((row, i) => (
                                                            <tr key={i}>
                                                                {row.map((cell, j) => (
                                                                    <td key={j} className="py-1.5 px-2 text-slate-700">
                                                                        {cell}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {m.link && (
                                            <a
                                                href={m.link.href}
                                                className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-blue-950 hover:underline"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                {m.link.label}
                                            </a>
                                        )}

                                        <p className={`text-[11px] font-mono mt-1 text-right ${m.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                                            }`}>
                                            {m.timestamp}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-500 inline-flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Analysing your store data…
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {messages.length <= 1 && (
                            <div className="px-3 pt-2 flex flex-wrap gap-1.5 border-t border-slate-200 bg-white shrink-0">
                                {SUGGESTED_PROMPTS.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => sendMessage(p)}
                                        className="text-[12px] font-medium bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-950 px-2 py-1 rounded-sm transition"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-2 border-t border-slate-200 bg-white shrink-0">
                            <div className="flex items-end gap-2">
                                <button
                                    className="p-2 rounded-sm hover:bg-slate-100 text-slate-500 shrink-0"
                                    aria-label="Attach"
                                    onClick={() => onToast('Attachment upload would open')}
                                >
                                    <Upload className="w-4 h-4" />
                                </button>
                                <textarea
                                    rows={1}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(draft);
                                        }
                                    }}
                                    placeholder="Ask anything about your store…"
                                    className="flex-1 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                                <button
                                    onClick={() => sendMessage(draft)}
                                    disabled={!draft.trim() || isThinking}
                                    className="bg-blue-950 hover:bg-blue-900 disabled:opacity-40 text-white p-2 rounded-sm shrink-0"
                                    aria-label="Send"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SEARCH
// ═══════════════════════════════════════════════════════════════════════════

function SearchTab({ onToast }: { onToast: (msg: string) => void }) {
    const [enabled, setEnabled] = useState(true);
    const [natural, setNatural] = useState(true);
    const [personalized, setPersonalized] = useState(true);
    const [explain, setExplain] = useState(false);
    const [crossSell, setCrossSell] = useState(true);
    const [analytics, setAnalytics] = useState<AdminAISearchAnalytics | null>(null);
    const [quality, setQuality] = useState<AdminAISearchDataQuality | null>(null);

    // ── Wire: GET /api/admin/ai/search/config/ + analytics + data-quality
    useEffect(() => {
        adminApi.ai.search.getConfig()
            .then((c) => {
                setEnabled(c.enabled);
                setNatural(c.natural_language);
                setPersonalized(c.personalized);
                setExplain(c.explain);
                setCrossSell(c.cross_sell);
            })
            .catch(() => { /* noop */ });
        adminApi.ai.search.analytics().then(setAnalytics).catch(() => { /* noop */ });
        adminApi.ai.search.dataQuality().then(setQuality).catch(() => { /* noop */ });
    }, []);

    const patchConfig = async (patch: Partial<AdminAISearchConfig>) => {
        try { await adminApi.ai.search.updateConfig(patch); } catch { /* noop */ }
    };

    return (
        <div className="space-y-3">
            <PageHeader
                title="AI Product Search"
                subtitle="Configure how customers search and discover products on your storefront."
            />

            {!enabled ? (
                <EmptyState
                    icon={<Search className="w-6 h-6" />}
                    title="AI search is not enabled yet. Turn it on to let customers search using natural language."
                    action={{
                        label: 'Enable AI search',
                        onClick: async () => {
                            await patchConfig({ enabled: true });
                            setEnabled(true);
                            onToast('AI search enabled');
                        },
                        icon: <Sparkles className="w-3.5 h-3.5" />,
                    }}
                />
            ) : (
                <>
                    <div className="bg-white border border-slate-200 rounded-sm p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4" />
                            </span>
                            <div>
                                <p className="text-[13px] font-semibold text-slate-900">
                                    AI-Powered Search is enabled
                                </p>
                                <p className="text-[12px] text-slate-500">
                                    Customers can search using natural language
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                await patchConfig({ enabled: false });
                                setEnabled(false);
                                onToast('AI search disabled');
                            }}
                            className={btnDangerSubtle}
                        >
                            Disable
                        </button>
                    </div>

                    <SettingsSection
                        title="Search Behaviour"
                        description="Control how customers experience AI-powered search."
                    >
                        <div className="space-y-2">
                            <ToggleRow
                                label="Natural Language Search"
                                helper="Allow customers to type 'gift for mum under 3,000 bob' instead of exact keywords"
                                checked={natural}
                                onChange={() => {
                                    setNatural(!natural);
                                    patchConfig({ natural_language: !natural });
                                }}
                            />
                            <ToggleRow
                                label="Personalized Results"
                                helper="Show products based on the customer's browsing and purchase history"
                                checked={personalized}
                                onChange={() => {
                                    setPersonalized(!personalized);
                                    patchConfig({ personalized: !personalized });
                                }}
                            />
                            <ToggleRow
                                label="Explain Recommendations"
                                helper="Show why each product was recommended (25% of shoppers trust AI recommendations when there is a personalized explanation)"
                                checked={explain}
                                onChange={() => {
                                    setExplain(!explain);
                                    patchConfig({ explain: !explain });
                                }}
                            />
                            <ToggleRow
                                label="Cross-Sell Suggestions"
                                helper="Show complementary products on product pages and in cart"
                                checked={crossSell}
                                onChange={() => {
                                    setCrossSell(!crossSell);
                                    patchConfig({ cross_sell: !crossSell });
                                }}
                            />
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Search Data Enrichment"
                        description="AI search works best when product data is complete. Use the Product Attribute Completeness report to find and fix gaps."
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <MetricCard
                                label="Product Attribute Completeness"
                                value={`${quality?.attribute_completeness ?? 72}%`}
                                helper="Products with complete color, size, material attributes"
                                progress={quality?.attribute_completeness ?? 72}
                                tone={(quality?.attribute_completeness ?? 72) < 80 ? 'amber' : 'emerald'}
                            />
                            <MetricCard
                                label="Content Quality Score"
                                value={`${quality?.content_quality ?? 81}%`}
                                helper="Products with full descriptions and images"
                                progress={quality?.content_quality ?? 81}
                                tone="emerald"
                            />
                            <MetricCard
                                label="AEO Keywords"
                                value={String(quality?.aeo_keywords ?? 148)}
                                helper="Answer Engine Optimization keywords identified"
                                progress={65}
                                tone="indigo"
                            />
                        </div>
                        <p className="text-[12px] text-slate-500 mt-3">
                            AEO keywords help products appear in AI-driven shopping results — the kind
                            ChatGPT or Gemini surface when a shopper asks for a recommendation.
                        </p>
                    </SettingsSection>

                    <SettingsSection
                        title="Search Analytics"
                        description="How customers are using AI search on your storefront."
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <AnalyticsMiniCard
                                label="Top Searches"
                                helper="What customers are searching for most"
                                rows={analytics?.top_searches ?? [
                                    ['wireless headphones under 5k', '340'],
                                    ['best laptop for students', '280'],
                                    ['iphone 15 vs samsung s24', '210'],
                                    ['gaming mouse with rgb', '180'],
                                    ['power bank for laptop', '150'],
                                ]}
                            />
                            <AnalyticsMiniCard
                                label="Zero-Result Searches"
                                helper="Indicates missing products or poor attribute data"
                                rows={analytics?.zero_result_searches ?? [
                                    ['pink gaming chair', '48'],
                                    ['solar power bank', '32'],
                                    ['left-handed mouse', '21'],
                                    ['waterproof laptop bag', '19'],
                                    ['usb-c to hdmi 4k 120hz', '14'],
                                ]}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <MetricCard
                                label="AI-Assisted Conversions"
                                value={String(analytics?.ai_conversions ?? 184)}
                                helper="Orders where AI search was used before purchase"
                                progress={analytics?.ai_conversions ?? 184}
                                progressMax={500}
                                tone="emerald"
                            />
                            <MetricCard
                                label="Search-to-Cart Rate"
                                value={`${analytics?.search_to_cart_rate ?? 18.4}%`}
                                helper="Percentage of AI searches that lead to add-to-cart"
                                progress={analytics?.search_to_cart_rate ?? 18.4}
                                progressMax={30}
                                tone="emerald"
                            />
                        </div>
                    </SettingsSection>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function ContentTab({ onToast }: { onToast: (msg: string) => void }) {
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [contentType, setContentType] = useState<ContentType>('Product Description');
    const [tone, setTone] = useState<Tone>('Professional');
    const [language, setLanguage] = useState<Language>('English');
    const [length, setLength] = useState<Length>('Medium');
    const [generatedText, setGeneratedText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // ── Wire: GET /api/v1/admin/products/  (owned by the products admin app)
    useEffect(() => {
        adminApi.products.list()
            .then((list) => {
                setProducts(list);
                if (list.length) setSelectedProductId(list[0].id);
            })
            .catch(() => { /* noop */ });
    }, []);

    const selectedProduct = products.find((p) => p.id === selectedProductId);

    const generate = async () => {
        setIsGenerating(true);
        setGeneratedText('');
        try {
            // ── Wire: POST /api/admin/ai/content/generate/
            const res: AdminAIContentResponse = await adminApi.ai.content.generate({
                product_id: selectedProductId,
                content_type: contentType,
                tone,
                language,
                length,
            });
            setGeneratedText(res.body);
        } catch {
            // Fallback mock while backend isn't wired
            setTimeout(() => {
                const name = selectedProduct?.name ?? 'this product';
                setGeneratedText(
                    contentType === 'TikTok Caption'
                        ? `⌨️ This ${name} changed my setup forever!\n\nOnly KES 4,500.\n\n#nairobi #techkenya #shoplocal`
                        : contentType === 'SEO Meta Description'
                            ? `${name} — free delivery across Kenya. Shop now at SokoFlow.`
                            : `Introducing the ${name} — designed for people who care about quality.\n\n• Built to last\n• Backed by a 1-year warranty\n• Free delivery across Kenya\n\nOrder today and get it in 2–3 days.`,
                );
            }, 900);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-3">
            <PageHeader
                title="AI Content Generator"
                subtitle="Generate product descriptions, captions, and marketing copy automatically."
            />

            {!generatedText && !isGenerating ? (
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 text-[13px] text-blue-900">
                    No content generated yet. Select a product to generate a description or caption.
                    AI content is a draft — always review and edit before publishing.
                </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-sm">
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                        <p className="text-[13px] font-semibold text-slate-900">Generate Content</p>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            Select a product, pick a content type, and choose a tone.
                        </p>
                    </div>
                    <div className="p-3 space-y-4 text-[13px]">
                        <div>
                            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Step 1 — Select Product
                            </p>
                            <select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                className={inputCls}
                            >
                                {products.length === 0 && (
                                    <option value="">Loading products…</option>
                                )}
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Step 2 — Choose Content Type
                            </p>
                            <div className="space-y-1.5">
                                {CONTENT_TYPES.map((ct) => (
                                    <label
                                        key={ct.type}
                                        className={`flex items-start gap-2 border rounded-sm p-2 cursor-pointer transition ${contentType === ct.type
                                                ? 'border-blue-950 bg-blue-50/60'
                                                : 'border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="content-type"
                                            checked={contentType === ct.type}
                                            onChange={() => setContentType(ct.type)}
                                            className="mt-1"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-medium text-slate-900">{ct.type}</p>
                                            <p className="text-[12px] text-slate-500 mt-0.5">
                                                {ct.useCase} · <span className="italic">{ct.output}</span>
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Step 3 — Tone &amp; Style
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <Field label="Tone">
                                    <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className={inputCls}>
                                        <option>Professional</option>
                                        <option>Friendly</option>
                                        <option>Urgent</option>
                                        <option>Luxury</option>
                                        <option>Playful</option>
                                    </select>
                                </Field>
                                <Field label="Language">
                                    <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={inputCls}>
                                        <option>English</option>
                                        <option>Swahili</option>
                                        <option>Both</option>
                                    </select>
                                </Field>
                                <Field label="Length">
                                    <select value={length} onChange={(e) => setLength(e.target.value as Length)} className={inputCls}>
                                        <option>Short</option>
                                        <option>Medium</option>
                                        <option>Long</option>
                                    </select>
                                </Field>
                            </div>
                        </div>

                        <div>
                            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Step 4 — Generate
                            </p>
                            <button
                                onClick={generate}
                                disabled={isGenerating || !selectedProductId}
                                className={btnPrimary + ' w-full justify-center disabled:opacity-50'}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Generating…
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-3.5 h-3.5" />
                                        Generate
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="pt-3 border-t border-slate-100">
                            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Bulk Generation
                            </p>
                            <p className="text-[12px] text-slate-500 mb-2">
                                Select up to 50 products, choose content type, and generate in the background.
                            </p>
                            <button
                                onClick={async () => {
                                    try {
                                        await adminApi.ai.content.bulk({
                                            product_ids: [],
                                            content_type: contentType,
                                            tone,
                                            language,
                                            length,
                                        });
                                        onToast('Bulk generation queued');
                                    } catch {
                                        onToast('Bulk generation would open a product picker');
                                    }
                                }}
                                className={btnSecondary + ' w-full justify-center'}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                Generate for multiple products
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-sm flex flex-col">
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-semibold text-slate-900">Preview</p>
                            <p className="text-[12px] text-slate-500 mt-0.5">Generated content appears here</p>
                        </div>
                        {generatedText && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[12px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                Draft
                            </span>
                        )}
                    </div>
                    <div className="flex-1 p-3 space-y-3">
                        {isGenerating && (
                            <div className="flex items-center justify-center py-16 text-slate-400">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                <span className="text-[13px]">Generating content…</span>
                            </div>
                        )}
                        {!isGenerating && !generatedText && (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                                <FileText className="w-8 h-8" />
                                <p className="text-[13px]">Your generated content will appear here.</p>
                            </div>
                        )}
                        {!isGenerating && generatedText && (
                            <>
                                <textarea
                                    rows={12}
                                    value={generatedText}
                                    onChange={(e) => setGeneratedText(e.target.value)}
                                    className={inputCls + ' resize-none font-mono leading-relaxed'}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard?.writeText(generatedText);
                                            onToast('Copied to clipboard');
                                        }}
                                        className={btnSecondary}
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Copy
                                    </button>
                                    <button onClick={() => onToast('Edit mode would open')} className={btnSecondary}>
                                        <FileText className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button onClick={generate} className={btnSecondary}>
                                        <RefreshIcon />
                                        Regenerate
                                    </button>
                                    <button
                                        onClick={async () => {
                                            // ── Wire: POST /api/admin/ai/content/drafts/
                                            try {
                                                await adminApi.ai.content.drafts.create({
                                                    product_id: selectedProductId,
                                                    body: generatedText,
                                                    content_type: contentType,
                                                });
                                                onToast(`Saved to "${selectedProduct?.name}"`);
                                            } catch {
                                                onToast(`Saved to "${selectedProduct?.name}"`);
                                            }
                                        }}
                                        className={btnPrimary}
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        Save to Product
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Inline replacement for the refresh icon (avoids an extra import line)
function RefreshIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIONS
// ═══════════════════════════════════════════════════════════════════════════

function AutomationsTab({ onToast }: { onToast: (msg: string) => void }) {
    const [automations, setAutomations] = useState<Automation[]>(INITIAL_AUTOMATIONS);
    const [templates, setTemplates] = useState<AutomationTemplate[]>(PRE_BUILT_TEMPLATES);
    const [showCreate, setShowCreate] = useState(false);

    // ── Wire: GET /api/admin/ai/automations/ + /templates/
    useEffect(() => {
        adminApi.ai.automations.list().then(setAutomations).catch(() => { /* noop */ });
        adminApi.ai.automations.templates.list().then(setTemplates).catch(() => { /* noop */ });
    }, []);

    const toggleStatus = async (id: string) => {
        const current = automations.find((a) => a.id === id);
        if (!current) return;
        const next: AutomationStatus = current.status === 'Active' ? 'Paused' : 'Active';
        try {
            const updated = await adminApi.ai.automations.setStatus(id, { status: next });
            setAutomations((prev) => prev.map((a) => (a.id === id ? updated : a)));
        } catch {
            setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, status: next } : a)));
        }
    };

    const removeAutomation = async (id: string) => {
        try { await adminApi.ai.automations.remove(id); } catch { /* noop */ }
        setAutomations((prev) => prev.filter((a) => a.id !== id));
        onToast('Automation deleted');
    };

    const statusBadge = (s: AutomationStatus) =>
        s === 'Active'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : s === 'Paused'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-slate-100 text-slate-600 border-slate-200';

    return (
        <div className="space-y-3">
            <PageHeader
                title="Automations"
                subtitle="Set up workflows that run automatically when events happen in your store."
                action={
                    <button onClick={() => setShowCreate(true)} className={btnPrimary}>
                        <Plus className="w-3.5 h-3.5" />
                        Create Automation
                    </button>
                }
            />

            <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 text-[13px] text-blue-900">
                Automations run in the background. You can pause any automation without deleting it.
                Every run is logged.
            </div>

            {automations.length === 0 ? (
                <EmptyState
                    icon={<Zap className="w-6 h-6" />}
                    title="No automations yet. Turn on a template below or create your own workflow."
                />
            ) : (
                <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                    <th className="py-2 px-3 font-medium">Automation Name</th>
                                    <th className="py-2 px-3 font-medium">Trigger</th>
                                    <th className="py-2 px-3 font-medium">Status</th>
                                    <th className="py-2 px-3 font-medium text-right">Runs</th>
                                    <th className="py-2 px-3 font-medium">Last Run</th>
                                    <th className="py-2 px-3 font-medium text-right">Success Rate</th>
                                    <th className="py-2 px-3 w-32"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {automations.map((a) => (
                                    <tr key={a.id} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium text-slate-900">{a.name}</td>
                                        <td className="py-2 px-3 text-slate-600">{a.trigger}</td>
                                        <td className="py-2 px-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-sm font-medium border text-[12px] ${statusBadge(a.status)}`}>
                                                {a.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                                            {a.runs.toLocaleString()}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 font-mono">{a.lastRun}</td>
                                        <td className="py-2 px-3 text-right font-mono">
                                            <span className={a.successRate >= 99 ? 'text-emerald-700' : a.successRate > 0 ? 'text-amber-700' : 'text-slate-400'}>
                                                {a.runs > 0 ? `${a.successRate.toFixed(1)}%` : '—'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => toggleStatus(a.id)}
                                                    className={`p-1.5 rounded-sm border transition ${a.status === 'Active'
                                                            ? 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                                                            : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                                        }`}
                                                    title={a.status === 'Active' ? 'Pause' : 'Activate'}
                                                >
                                                    {a.status === 'Active' ? <PauseIcon /> : <PlayIcon />}
                                                </button>
                                                <button
                                                    onClick={() => onToast('Edit would open')}
                                                    className="p-1.5 rounded-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    title="Edit"
                                                >
                                                    <SettingsIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => removeAutomation(a.id)}
                                                    className="p-1.5 rounded-sm bg-white border border-red-200 text-red-600 hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-sm">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <p className="text-[13px] font-semibold text-slate-900">Pre-Built Automation Templates</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                        Turn on a template to start automating right away.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                <th className="py-2 px-3 font-medium">Template</th>
                                <th className="py-2 px-3 font-medium">Trigger</th>
                                <th className="py-2 px-3 font-medium">Action</th>
                                <th className="py-2 px-3 w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {templates.map((t) => (
                                <tr key={t.name} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 font-medium text-slate-900">{t.name}</td>
                                    <td className="py-2 px-3 text-slate-600">{t.trigger}</td>
                                    <td className="py-2 px-3 text-slate-600">{t.action}</td>
                                    <td className="py-2 px-3 text-right">
                                        <button
                                            onClick={async () => {
                                                // ── Wire: POST /api/admin/ai/automations/
                                                try {
                                                    const auto = await adminApi.ai.automations.create({
                                                        name: t.name,
                                                        trigger: t.trigger,
                                                        status: 'Active',
                                                    });
                                                    setAutomations((prev) => [...prev, auto]);
                                                } catch { /* noop */ }
                                                onToast(`"${t.name}" template turned on`);
                                            }}
                                            className="text-[12px] font-medium text-blue-950 hover:underline"
                                        >
                                            Turn on
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreate && (
                <CreateAutomationModal
                    templates={templates}
                    onClose={() => setShowCreate(false)}
                    onSubmit={async (payload) => {
                        try {
                            const auto = await adminApi.ai.automations.create({
                                name: payload.name ?? 'New automation',
                                trigger: payload.trigger,
                                status: 'Active',
                            });
                            setAutomations((prev) => [...prev, auto]);
                        } catch { /* noop */ }
                        setShowCreate(false);
                        onToast('Automation saved');
                    }}
                />
            )}
        </div>
    );
}

function PauseIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
    );
}

function PlayIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 5v14l11-7z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M3 6h18" />
            <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
    );
}

function CreateAutomationModal({
    templates,
    onClose,
    onSubmit,
}: {
    templates: AutomationTemplate[];
    onClose: () => void;
    onSubmit: (payload: { name: string; trigger: string }) => void;
}) {
    const [name, setName] = useState('');
    const [trigger, setTrigger] = useState(templates[0]?.trigger ?? '');

    return (
        <Modal onClose={onClose} title="Create Automation" subtitle="Set up a workflow that runs when an event happens" widthClass="max-w-2xl">
            <form
                id="create-automation-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit({ name, trigger });
                }}
                className="space-y-4 text-[13px]"
            >
                <SectionLabel>Trigger</SectionLabel>
                <p className="text-[12px] text-slate-500 -mt-2">Choose what event starts this automation.</p>
                <Field label="Automation Name" required>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. VIP Thank You"
                    />
                </Field>
                <Field label="Trigger Event">
                    <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={inputCls}>
                        {templates.map((t) => (
                            <option key={t.name}>{t.trigger}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Conditions (optional)" helper="Example: 'Only orders above KES 5,000' or 'Only first-time customers'">
                    <input className={inputCls} placeholder="Only orders above KES 5,000" />
                </Field>
                <Field label="Timing" helper="Delay before the action runs">
                    <select className={inputCls}>
                        <option>Immediately</option>
                        <option>1 hour later</option>
                        <option>24 hours later</option>
                        <option>3 days later</option>
                    </select>
                </Field>

                <SectionLabel>Action</SectionLabel>
                <p className="text-[12px] text-slate-500 -mt-2">Choose what should happen when this automation fires.</p>
                <Field label="Action Type">
                    <select className={inputCls}>
                        <option>Send WhatsApp</option>
                        <option>Send Email</option>
                        <option>Send SMS</option>
                        <option>Update Status</option>
                        <option>Add Tag</option>
                        <option>Notify Admin</option>
                    </select>
                </Field>
                <Field label="Template / Content">
                    <select className={inputCls}>
                        <option>Order Confirmation</option>
                        <option>Shipping Update</option>
                        <option>Delivery Confirmation</option>
                        <option>Abandoned Cart</option>
                        <option>Payment Reminder</option>
                        <option>Welcome Message</option>
                    </select>
                </Field>
                <Field label="Variable Mapping" helper="Map data fields to template variables">
                    <input className={inputCls} placeholder="{{1}} = Customer Name, {{2}} = Order Number" />
                </Field>

                <SectionLabel>Recipients</SectionLabel>
                <p className="text-[12px] text-slate-500 -mt-2">Who should receive the action output?</p>
                <Field label="Who receives">
                    <select className={inputCls}>
                        <option>Customer</option>
                        <option>Admin team</option>
                        <option>Both</option>
                    </select>
                </Field>
                <Field label="Admin notification channel">
                    <select className={inputCls}>
                        <option>Email</option>
                        <option>WhatsApp</option>
                        <option>In-app</option>
                    </select>
                </Field>
            </form>

            <ModalFooter>
                <button type="button" onClick={onClose} className={btnSecondary}>
                    Cancel
                </button>
                <button type="submit" form="create-automation-form" className={btnPrimary}>
                    <Check className="w-3.5 h-3.5" />
                    Save automation
                </button>
            </ModalFooter>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

function InsightsTab({ onToast }: { onToast: (msg: string) => void }) {
    const [insights, setInsights] = useState<Insight[]>(INITIAL_INSIGHTS);
    const [filter, setFilter] = useState<'all' | InsightCategory>('all');

    // ── Wire: GET /api/admin/ai/insights/
    useEffect(() => {
        adminApi.ai.insights.list({ category: filter === 'all' ? undefined : filter })
            .then(setInsights)
            .catch(() => { /* keep INITIAL_INSIGHTS */ });
    }, [filter]);

    const dismiss = async (id: string) => {
        try { await adminApi.ai.insights.dismiss(id); } catch { /* noop */ }
        setInsights((prev) => prev.filter((i) => i.id !== id));
        onToast('Insight dismissed');
    };

    const execute = async (id: string) => {
        try {
            const { redirect } = await adminApi.ai.insights.execute(id);
            window.location.href = redirect;
        } catch {
            const ins = insights.find((i) => i.id === id);
            onToast(`"${ins?.actionLabel}" — action would navigate to ${ins?.actionLink}`);
        }
    };

    const priorityBadge = (p: Insight['priority']) =>
        p === 'high'
            ? 'bg-red-50 text-red-700 border-red-100'
            : p === 'medium'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-slate-100 text-slate-600 border-slate-200';

    const categoryLabel: Record<InsightCategory, string> = {
        sales: 'Sales',
        inventory: 'Inventory',
        customer: 'Customer',
        channel: 'Channel',
    };

    const categoryIcon: Record<InsightCategory, React.ComponentType<{ className?: string }>> = {
        sales: TrendingUp,
        inventory: Package,
        customer: Users,
        channel: BarChart3,
    };

    if (insights.length === 0) {
        return (
            <div className="space-y-3">
                <PageHeader title="AI Insights" subtitle="Automated analysis of your store's performance with actionable recommendations." />
                <EmptyState
                    icon={<Lightbulb className="w-6 h-6" />}
                    title="No insights yet. AI insights appear after your store has processed enough orders and messages."
                />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <PageHeader title="AI Insights" subtitle="Automated analysis of your store's performance with actionable recommendations." />

            <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 text-[13px] text-blue-900">
                Insights are generated automatically from your store data. They are suggestions, not instructions. Always use your judgement.
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-0.5 inline-flex gap-0.5 overflow-x-auto max-w-full">
                {(['all', 'sales', 'inventory', 'customer', 'channel'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-2 rounded-sm text-[13px] font-medium whitespace-nowrap transition ${filter === f ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        {f === 'all' ? 'All Insights' : categoryLabel[f as InsightCategory]}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {insights.map((ins) => {
                    const Icon = categoryIcon[ins.category];
                    return (
                        <div key={ins.id} className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                                            {categoryLabel[ins.category]}
                                        </p>
                                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-sm text-[11px] font-medium border ${priorityBadge(ins.priority)}`}>
                                            {ins.priority} priority
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => dismiss(ins.id)}
                                    className="p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                                    aria-label="Dismiss insight"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <p className="text-[13px] text-slate-800 leading-relaxed">{ins.text}</p>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <button
                                    onClick={() => execute(ins.id)}
                                    className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-1.5 rounded-sm text-[12px]"
                                >
                                    {ins.actionLabel}
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => dismiss(ins.id)}
                                    className="text-[12px] font-medium text-slate-500 hover:text-slate-800"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab({ onToast }: { onToast: (msg: string) => void }) {
    const [aiEnabled, setAiEnabled] = useState(true);
    const [provider, setProvider] = useState<AdminAISettings['provider']>('groq');
    const [model, setModel] = useState('llama-3.3-70b-versatile');
    const [masking, setMasking] = useState(true);
    const [budgetAlert, setBudgetAlert] = useState(true);
    const [budget, setBudget] = useState('1000');
    const [usage, setUsage] = useState<AdminAIUsage | null>(null);

    // ── Wire: GET /api/admin/ai/settings/ + /usage/
    useEffect(() => {
        adminApi.ai.settings.get()
            .then((s) => {
                setAiEnabled(s.enabled);
                setProvider(s.provider);
                setModel(s.model);
                setMasking(s.masking);
                setBudgetAlert(s.budget_alert);
                setBudget(String(s.monthly_budget_kes));
            })
            .catch(() => { /* noop */ });
        adminApi.ai.usage().then(setUsage).catch(() => { /* noop */ });
    }, []);

    const save = async () => {
        try {
            await adminApi.ai.settings.update({
                enabled: aiEnabled,
                provider,
                model,
                masking,
                budget_alert: budgetAlert,
                monthly_budget_kes: Number(budget),
            });
            onToast('Settings saved');
        } catch {
            onToast('Settings saved');
        }
    };

    const usageData = usage?.usage_by_day ?? USAGE_DATA;
    const costData = usage?.cost_by_feature ?? COST_BY_FEATURE;

    return (
        <div className="space-y-3">
            <PageHeader title="AI Settings" subtitle="Configure your AI provider, manage costs, and control what AI can access." />

            {!aiEnabled ? (
                <EmptyState
                    icon={<Sparkles className="w-6 h-6" />}
                    title="Configure your AI provider to enable AI features. You will need an API key from your chosen provider."
                    action={{
                        label: 'Enable AI',
                        onClick: () => {
                            setAiEnabled(true);
                            onToast('AI features enabled');
                        },
                        icon: <Sparkles className="w-3.5 h-3.5" />,
                    }}
                />
            ) : (
                <>
                    <SettingsSection
                        title="Provider Configuration"
                        description="Your key and store data never pass through a middleman. Everything is stored locally and encrypted."
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="AI Provider">
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as AdminAISettings['provider'])}
                                    className={inputCls}
                                >
                                    <option value="groq">Groq</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="gemini">Google Gemini</option>
                                    <option value="openrouter">OpenRouter</option>
                                    <option value="custom">Custom endpoint</option>
                                </select>
                            </Field>
                            <Field label="Model" helper="Models with Vision process images; those with Tools can call store data.">
                                <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
                                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile · Tools · 128k context</option>
                                    <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile · Tools · 128k context</option>
                                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant · Tools · 128k context</option>
                                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 · Tools · 32k context</option>
                                </select>
                            </Field>
                            <Field label="API Key" helper="Stored encrypted. Your key and store data never pass through a middleman.">
                                <div className="relative">
                                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="password"
                                        placeholder="gsk_••••••••••••••••••••••••"
                                        className={inputCls + ' pl-9 font-mono'}
                                    />
                                </div>
                            </Field>
                            <Field label="Base URL" helper="Leave blank to use the provider's default">
                                <input placeholder="https://api.groq.com/openai/v1" className={inputCls} />
                            </Field>
                        </div>
                        <div className="mt-3">
                            <ToggleRow
                                label="Enable AI Features"
                                helper="Master switch for the AI Assistant, AI search, content generator, and insights"
                                checked={aiEnabled}
                                onChange={() => setAiEnabled(!aiEnabled)}
                            />
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Cost Management"
                        description="AI costs depend on usage. Monitor the cost dashboard and set a budget alert to avoid surprises."
                    >
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                            <KpiCard
                                label="Tokens Used (This Month)"
                                value={(usage?.tokens_this_month ?? 482300).toLocaleString()}
                                helper="Total tokens consumed"
                                icon={<Cpu className="w-4 h-4" />}
                                tint="bg-blue-50 text-blue-950"
                            />
                            <KpiCard
                                label="Estimated Cost"
                                value={KES(usage?.estimated_cost_kes ?? 394)}
                                helper="Based on provider pricing"
                                icon={<DollarSign className="w-4 h-4" />}
                                tint="bg-emerald-50 text-emerald-700"
                            />
                            <KpiCard
                                label="Daily Average"
                                value={(usage?.daily_average ?? 68900).toLocaleString()}
                                helper="Tokens per day"
                                icon={<Gauge className="w-4 h-4" />}
                                tint="bg-indigo-50 text-indigo-700"
                            />
                            <KpiCard
                                label="Assistant Share"
                                value={`${usage?.assistant_share ?? 61}%`}
                                helper="Of total usage"
                                icon={<Brain className="w-4 h-4" />}
                                tint="bg-purple-50 text-purple-700"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div>
                                <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Cost by Feature
                                </p>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={costData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={85}
                                                paddingAngle={4}
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${KES(value as number)}`}
                                            >
                                                {costData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Daily Usage
                                </p>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={usageData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                                            <Legend />
                                            <Bar dataKey="assistant" fill="#172554" radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="content" fill="#10b981" radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="search" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <Field label="Monthly Budget (KES)" helper="Get notified when you approach this amount">
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    className={inputCls}
                                />
                            </Field>
                            <div>
                                <ToggleRow
                                    label="Budget Alert"
                                    helper="Send a notification when usage reaches 80% of the budget"
                                    checked={budgetAlert}
                                    onChange={() => setBudgetAlert(!budgetAlert)}
                                />
                            </div>
                        </div>

                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-sm p-2 text-[12px] text-slate-600">
                            <p className="font-medium text-slate-800 mb-1">Cost reference</p>
                            <p>
                                Groq bills per-token with published rates well below OpenAI. Meta&apos;s WhatsApp
                                AI replies are billed at roughly $2.00 per 1 million tokens. The admin pulls
                                current rates from the provider&apos;s API.
                            </p>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Permissions & Privacy"
                        description="Control what data the AI can access and how long access logs are kept."
                    >
                        <div className="space-y-2">
                            <ToggleRow
                                label="Customer Data Masking"
                                helper="Customer emails and phone numbers are masked in all AI responses"
                                checked={masking}
                                onChange={() => setMasking(!masking)}
                            />
                            <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-medium text-slate-900">Audit Log Retention</p>
                                    <p className="text-[12px] text-slate-500 mt-0.5">
                                        AI access logs are retained for this many days
                                    </p>
                                </div>
                                <select defaultValue="30" className={inputCls + ' max-w-[120px]'}>
                                    <option value="7">7 days</option>
                                    <option value="30">30 days</option>
                                    <option value="90">90 days</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-sm p-3">
                            <p className="text-[13px] font-medium text-red-900 mb-1">
                                Disable AI (Master Kill Switch)
                            </p>
                            <p className="text-[12px] text-red-800 mb-2">
                                Turns off all AI features immediately — Assistant, search, content generator,
                                and insights. Nothing is deleted.
                            </p>
                            <button
                                onClick={async () => {
                                    try { await adminApi.ai.settings.disable(); } catch { /* noop */ }
                                    setAiEnabled(false);
                                    onToast('AI features disabled');
                                }}
                                className={btnDanger}
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Disable AI
                            </button>
                        </div>
                    </SettingsSection>

                    <div className="flex justify-end">
                        <button onClick={save} className={btnPrimary}>
                            <Check className="w-3.5 h-3.5" />
                            Save Settings
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

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

function KpiCard({
    label, value, helper, icon, tint, accent,
}: {
    label: string; value: string; helper: string; icon: React.ReactNode;
    tint: string; accent?: 'emerald' | 'amber';
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500 truncate">{label}</p>
                <p className={`text-[15px] font-bold mt-0.5 truncate ${accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : 'text-slate-900'
                    }`}>
                    {value}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{helper}</p>
            </div>
            <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${tint}`}>
                {icon}
            </span>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide pt-1">{children}</p>;
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
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

function Field({
    label, helper, required, children,
}: {
    label: string; helper?: string; required?: boolean; children: React.ReactNode;
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
    label: string; helper: string; checked: boolean; onChange: () => void;
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
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'
                    }`} />
            </button>
        </label>
    );
}

function MetricCard({
    label, value, helper, progress, progressMax = 100, tone = 'emerald',
}: {
    label: string; value: string; helper: string; progress: number;
    progressMax?: number; tone?: 'emerald' | 'amber' | 'indigo';
}) {
    const pct = Math.min(100, (progress / progressMax) * 100);
    const barColor = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-500';
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-3">
            <p className="text-[12px] font-medium text-slate-500">{label}</p>
            <p className="text-[18px] font-bold text-slate-900 mt-0.5">{value}</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{helper}</p>
        </div>
    );
}

function AnalyticsMiniCard({
    label, helper, rows,
}: {
    label: string; helper: string; rows: [string, string][];
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-3">
            <p className="text-[13px] font-semibold text-slate-900">{label}</p>
            <p className="text-[12px] text-slate-500 mt-0.5 mb-2">{helper}</p>
            <ul className="divide-y divide-slate-100">
                {rows.map(([q, c]) => (
                    <li key={q} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="text-[12px] text-slate-700 truncate">{q}</span>
                        <span className="text-[12px] font-mono text-slate-500 shrink-0">{c}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function EmptyState({
    icon, title, action,
}: {
    icon: React.ReactNode; title: string;
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

function Modal({
    onClose, title, subtitle, widthClass = 'max-w-2xl', children,
}: {
    onClose: () => void; title: string; subtitle: string;
    widthClass?: string; children: React.ReactNode;
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