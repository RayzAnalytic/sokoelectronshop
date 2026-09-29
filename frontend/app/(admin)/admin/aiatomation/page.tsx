'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Sparkles,
    Search,
    Bot,
    Lightbulb,
    FileText,
    Megaphone,
    ShoppingCart,
    Bell,
    CreditCard,
    Truck,
    Star,
    Package,
    Mail,
    MessageSquare,
    Smartphone,
    TrendingUp,
    Users,
    Eye,
    MousePointerClick,
    CheckCircle2,
    Save,
    ChevronDown,
    ChevronRight,
    Clock,
    Zap,
    Target,
    BarChart3,
    RefreshCw,
    Play,
    Pause,
    Copy,
    X,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type TabKey = 'overview' | 'ai' | 'automations' | 'insights';
type Channel = 'email' | 'sms' | 'push';
type AutomationCategory = 'recovery' | 'transactional' | 'engagement';

interface AIFeature {
    id: string;
    name: string;
    description: string;
    icon: typeof Sparkles;
    enabled: boolean;
    usageThisMonth: number;
    accent: string;
}

interface Automation {
    id: string;
    name: string;
    description: string;
    icon: typeof ShoppingCart;
    category: AutomationCategory;
    enabled: boolean;
    trigger: string;
    delayMinutes: number;
    channel: Channel;
    template: string;
    stats: { sent: number; opened: number; clicked: number; converted: number };
}

interface InsightMetric {
    label: string;
    value: string;
    delta: number;
    hint: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_AI_FEATURES: AIFeature[] = [
    {
        id: 'ai-search',
        name: 'AI product search',
        description:
            'Understands natural-language queries ("wireless headphones under 5k") and ranks results by intent.',
        icon: Search,
        enabled: true,
        usageThisMonth: 8420,
        accent: 'text-blue-950 bg-blue-50',
    },
    {
        id: 'ai-assistant',
        name: 'AI shop assistant',
        description:
            'Chat widget that answers product questions, helps with sizing, and hands off to a human when needed.',
        icon: Bot,
        enabled: true,
        usageThisMonth: 1890,
        accent: 'text-indigo-700 bg-indigo-50',
    },
    {
        id: 'ai-recommendations',
        name: 'AI product recommendations',
        description:
            'Personalised "You may also like" and "Frequently bought together" sections across the storefront.',
        icon: Lightbulb,
        enabled: true,
        usageThisMonth: 24100,
        accent: 'text-amber-700 bg-amber-50',
    },
    {
        id: 'ai-descriptions',
        name: 'AI product descriptions',
        description:
            'Generates SEO-friendly titles, short summaries, and long descriptions from a product name and category.',
        icon: FileText,
        enabled: true,
        usageThisMonth: 142,
        accent: 'text-emerald-700 bg-emerald-50',
    },
    {
        id: 'ai-marketing',
        name: 'AI marketing messages',
        description:
            'Drafts email and SMS campaigns tailored to customer segments, with tone controls (bold, warm, minimal).',
        icon: Megaphone,
        enabled: false,
        usageThisMonth: 0,
        accent: 'text-rose-700 bg-rose-50',
    },
];

const INITIAL_AUTOMATIONS: Automation[] = [
    // ── Recovery ──────────────────────────────────────────────────────────────
    {
        id: 'auto-cart',
        name: 'Abandoned-cart recovery',
        description: 'Nudges customers who added items but did not complete checkout.',
        icon: ShoppingCart,
        category: 'recovery',
        enabled: true,
        trigger: 'Cart idle for 1 hour',
        delayMinutes: 60,
        channel: 'email',
        template:
            'Hi {{customer_name}},\n\nYou left {{item_count}} item(s) in your cart — {{cart_total}}. Complete your order in the next 24 hours and get free delivery.\n\n{{cart_link}}\n\n— {{shop_name}}',
        stats: { sent: 412, opened: 218, clicked: 96, converted: 34 },
    },
    // ── Transactional ─────────────────────────────────────────────────────────
    {
        id: 'auto-order',
        name: 'Order confirmation',
        description: 'Sent immediately when an order is placed.',
        icon: CheckCircle2,
        category: 'transactional',
        enabled: true,
        trigger: 'Order placed',
        delayMinutes: 0,
        channel: 'email',
        template:
            'Thanks for your order, {{customer_name}}!\n\nOrder {{order_id}} — {{order_total}}\nWe will notify you as soon as it ships.',
        stats: { sent: 1240, opened: 1180, clicked: 620, converted: 0 },
    },
    {
        id: 'auto-payment',
        name: 'Payment received',
        description: 'Receipt is emailed as soon as payment is confirmed.',
        icon: CreditCard,
        category: 'transactional',
        enabled: true,
        trigger: 'Payment confirmed',
        delayMinutes: 0,
        channel: 'email',
        template:
            'Payment received for order {{order_id}}.\n\nAmount: {{order_total}}\nMethod: {{payment_method}}',
        stats: { sent: 1215, opened: 1120, clicked: 410, converted: 0 },
    },
    {
        id: 'auto-shipping',
        name: 'Shipping notification',
        description: 'Sends tracking number and ETA when the order leaves the warehouse.',
        icon: Truck,
        category: 'transactional',
        enabled: true,
        trigger: 'Order marked as shipped',
        delayMinutes: 0,
        channel: 'email',
        template:
            'Good news, {{customer_name}} — order {{order_id}} is on its way.\n\nTracking: {{tracking_number}}\nEstimated delivery: {{eta}}',
        stats: { sent: 1103, opened: 980, clicked: 720, converted: 0 },
    },
    {
        id: 'auto-backinstock',
        name: 'Back-in-stock alert',
        description: 'Fires when an out-of-stock product a customer asked about is restocked.',
        icon: Package,
        category: 'transactional',
        enabled: true,
        trigger: 'Product restocked',
        delayMinutes: 0,
        channel: 'email',
        template:
            '{{product_name}} is back in stock!\n\nWe will hold it for 48 hours — grab yours before it sells out again.\n\n{{product_link}}',
        stats: { sent: 340, opened: 290, clicked: 190, converted: 62 },
    },
    // ── Engagement ────────────────────────────────────────────────────────────
    {
        id: 'auto-review',
        name: 'Review request',
        description: 'Asks for a rating a few days after delivery, when the product has settled in.',
        icon: Star,
        category: 'engagement',
        enabled: true,
        trigger: 'Order delivered',
        delayMinutes: 4320, // 3 days
        channel: 'email',
        template:
            'Hi {{customer_name}},\n\nHow is your {{product_name}}? We would love to hear what you think — it only takes 30 seconds.\n\n{{review_link}}',
        stats: { sent: 890, opened: 512, clicked: 240, converted: 148 },
    },
    {
        id: 'auto-restock-nudge',
        name: 'Restock nudge',
        description: 'Warns frequent buyers when their favourite items are running low.',
        icon: RefreshCw,
        category: 'engagement',
        enabled: false,
        trigger: 'Customer viewed product 3+ times',
        delayMinutes: 1440, // 24 h
        channel: 'email',
        template:
            'Still thinking about {{product_name}}? Stock is running low — only {{stock_left}} left.',
        stats: { sent: 0, opened: 0, clicked: 0, converted: 0 },
    },
];

const INSIGHT_METRICS: InsightMetric[] = [
    {
        label: 'AI revenue assisted',
        value: 'KES 842,300',
        delta: 18.4,
        hint: 'Revenue from sessions that used AI search, assistant, or recommendations.',
    },
    {
        label: 'Conversion lift',
        value: '+22.6%',
        delta: 4.1,
        hint: 'Compared to sessions without AI features enabled.',
    },
    {
        label: 'Cart recovery rate',
        value: '8.3%',
        delta: 1.2,
        hint: 'Abandoned carts turned into orders within 24 hours.',
    },
    {
        label: 'Avg. order value',
        value: 'KES 12,840',
        delta: -0.8,
        hint: 'Customers who used AI recommendations spent more per order.',
    },
];

const TOP_ASSISTANT_QUERIES = [
    { query: 'wireless headphones under 5k', count: 340, conversion: 12.4 },
    { query: 'best laptop for students', count: 280, conversion: 9.1 },
    { query: 'iphone 15 vs samsung s24', count: 210, conversion: 14.2 },
    { query: 'gaming mouse with rgb', count: 180, conversion: 8.6 },
    { query: 'power bank for laptop', count: 150, conversion: 11.0 },
];

const RECOMMENDATION_PERFORMANCE = [
    { placement: 'Product page — "You may also like"', impressions: 42200, ctr: 6.4, revenue: 184300 },
    { placement: 'Homepage — "Picked for you"', impressions: 28400, ctr: 4.1, revenue: 96200 },
    { placement: 'Cart — "Frequently bought together"', impressions: 18900, ctr: 8.2, revenue: 141200 },
    { placement: 'Order confirmation — "Buy again"', impressions: 9200, ctr: 3.8, revenue: 42100 },
];

const TAB_CONFIG: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'ai', label: 'AI features', icon: Sparkles },
    { key: 'automations', label: 'Automations', icon: Zap },
    { key: 'insights', label: 'Customer insights', icon: Users },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AIAutomationsPage() {
    const [tab, setTab] = useState<TabKey>('overview');
    const [aiFeatures, setAiFeatures] = useState(INITIAL_AI_FEATURES);
    const [automations, setAutomations] = useState(INITIAL_AUTOMATIONS);
    const [expandedAutomation, setExpandedAutomation] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Automation | null>(null);
    const [toast, setToast] = useState('');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('ai-automations-draft');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.aiFeatures) setAiFeatures(parsed.aiFeatures);
                if (parsed.automations) setAutomations(parsed.automations);
            } catch {
                /* ignore */
            }
        }
    }, []);

    function flash(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    }

    function saveAll() {
        localStorage.setItem(
            'ai-automations-draft',
            JSON.stringify({ aiFeatures, automations, savedAt: new Date().toISOString() }),
        );
        setLastSaved(new Date());
        flash('Settings saved');
    }

    function toggleFeature(id: string) {
        setAiFeatures((prev) =>
            prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
        );
    }

    function toggleAutomation(id: string) {
        setAutomations((prev) =>
            prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
        );
    }

    function updateAutomation(id: string, patch: Partial<Automation>) {
        setAutomations((prev) =>
            prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        );
    }

    // ── KPI totals
    const totals = useMemo(() => {
        const sent = automations.reduce((s, a) => s + a.stats.sent, 0);
        const opened = automations.reduce((s, a) => s + a.stats.opened, 0);
        const clicked = automations.reduce((s, a) => s + a.stats.clicked, 0);
        const converted = automations.reduce((s, a) => s + a.stats.converted, 0);
        const enabledAI = aiFeatures.filter((f) => f.enabled).length;
        const enabledAuto = automations.filter((a) => a.enabled).length;
        return { sent, opened, clicked, converted, enabledAI, enabledAuto };
    }, [automations, aiFeatures]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 relative">

            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-3 py-3 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-blue-950" />
                            AI &amp; Automations
                        </h1>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            {totals.enabledAI} of {aiFeatures.length} AI features ·{' '}
                            {totals.enabledAuto} of {automations.length} automations active
                            {lastSaved && (
                                <>
                                    {' · '}
                                    <span className="text-slate-400">
                                        Saved {lastSaved.toLocaleTimeString('en-KE', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={saveAll}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] transition"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save changes</span>
                        <span className="sm:hidden">Save</span>
                    </button>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-3 py-3 space-y-3">

                {/* KPI CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <KpiCard
                        icon={Mail}
                        label="Messages sent (30d)"
                        value={totals.sent.toLocaleString()}
                        sub={`${((totals.opened / Math.max(totals.sent, 1)) * 100).toFixed(1)}% open rate`}
                        accent="text-blue-950 bg-blue-50"
                    />
                    <KpiCard
                        icon={MousePointerClick}
                        label="Clicks"
                        value={totals.clicked.toLocaleString()}
                        sub={`${((totals.clicked / Math.max(totals.sent, 1)) * 100).toFixed(1)}% CTR`}
                        accent="text-indigo-700 bg-indigo-50"
                    />
                    <KpiCard
                        icon={CheckCircle2}
                        label="Conversions"
                        value={totals.converted.toLocaleString()}
                        sub={`${((totals.converted / Math.max(totals.sent, 1)) * 100).toFixed(1)}% conversion`}
                        accent="text-emerald-700 bg-emerald-50"
                    />
                    <KpiCard
                        icon={Zap}
                        label="Active automations"
                        value={`${totals.enabledAuto}/${automations.length}`}
                        sub={`${totals.enabledAI} AI features on`}
                        accent="text-amber-700 bg-amber-50"
                    />
                </div>

                {/* TABS */}
                <div className="bg-white border border-slate-200 rounded-sm p-1 flex items-center gap-1 overflow-x-auto">
                    {TAB_CONFIG.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium whitespace-nowrap transition ${tab === t.key
                                    ? 'bg-blue-50 text-blue-950 border border-blue-950'
                                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                                }`}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* TAB CONTENT */}
                {tab === 'overview' && (
                    <OverviewTab
                        aiFeatures={aiFeatures}
                        automations={automations}
                        onJump={setTab}
                    />
                )}

                {tab === 'ai' && (
                    <AIFeaturesTab features={aiFeatures} onToggle={toggleFeature} />
                )}

                {tab === 'automations' && (
                    <AutomationsTab
                        automations={automations}
                        expanded={expandedAutomation}
                        onExpand={(id) => setExpandedAutomation(id === expandedAutomation ? null : id)}
                        onToggle={toggleAutomation}
                        onUpdate={updateAutomation}
                        onEditTemplate={setEditingTemplate}
                    />
                )}

                {tab === 'insights' && <InsightsTab />}
            </main>

            {/* Template editor */}
            {editingTemplate && (
                <TemplateEditor
                    automation={editingTemplate}
                    onClose={() => setEditingTemplate(null)}
                    onSave={(template) => {
                        updateAutomation(editingTemplate.id, { template });
                        setEditingTemplate(null);
                        flash('Template updated');
                    }}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-[110] bg-slate-900 text-white text-[13px] px-4 py-2.5 rounded-sm shadow-lg">
                    {toast}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    accent,
}: {
    icon: typeof Mail;
    label: string;
    value: string;
    sub: string;
    accent: string;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-sm flex items-center justify-center ${accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[13px] font-medium text-slate-500 truncate">{label}</span>
            </div>
            <div className="text-[15px] font-bold text-slate-900">{value}</div>
            <div className="text-[11px] text-slate-400">{sub}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────────────────────────────────────
function Toggle({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-950' : 'bg-slate-300'
                }`}
        >
            <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'
                    }`}
            />
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({
    aiFeatures,
    automations,
    onJump,
}: {
    aiFeatures: AIFeature[];
    automations: Automation[];
    onJump: (tab: TabKey) => void;
}) {
    const topAutomations = [...automations]
        .filter((a) => a.enabled && a.stats.sent > 0)
        .sort((a, b) => b.stats.converted - a.stats.converted)
        .slice(0, 4);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* AI features summary */}
            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <header className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            AI features
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Smart capabilities running on your storefront.
                        </p>
                    </div>
                    <button
                        onClick={() => onJump('ai')}
                        className="text-[13px] font-medium text-blue-950 hover:underline"
                    >
                        Configure →
                    </button>
                </header>
                <ul className="divide-y divide-slate-100">
                    {aiFeatures.map((f) => (
                        <li key={f.id} className="py-2 flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${f.accent}`}>
                                <f.icon className="w-4 h-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-medium text-slate-900 truncate">
                                        {f.name}
                                    </span>
                                    <span
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm border ${f.enabled
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}
                                    >
                                        {f.enabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {f.usageThisMonth.toLocaleString()} uses this month
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Top automations */}
            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                <header className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            Top automations
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Ranked by conversions in the last 30 days.
                        </p>
                    </div>
                    <button
                        onClick={() => onJump('automations')}
                        className="text-[13px] font-medium text-blue-950 hover:underline"
                    >
                        Manage →
                    </button>
                </header>
                {topAutomations.length === 0 ? (
                    <p className="text-[13px] text-slate-400 py-4 text-center">
                        No data yet — enable an automation to see results.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {topAutomations.map((a) => {
                            const convRate = a.stats.sent
                                ? (a.stats.converted / a.stats.sent) * 100
                                : 0;
                            return (
                                <li
                                    key={a.id}
                                    className="flex items-center gap-3 rounded-sm border border-slate-100 bg-slate-50/50 p-2"
                                >
                                    <span className="w-8 h-8 rounded-sm flex items-center justify-center bg-white border border-slate-200 text-blue-950 shrink-0">
                                        <a.icon className="w-4 h-4" />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium text-slate-900 truncate">
                                            {a.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {a.stats.sent.toLocaleString()} sent ·{' '}
                                            {a.stats.converted.toLocaleString()} converted
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[13px] font-bold text-emerald-700">
                                            {convRate.toFixed(1)}%
                                        </div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                                            CVR
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* Top assistant queries */}
            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <header>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        Top assistant queries
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        What customers are asking the AI shop assistant.
                    </p>
                </header>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-1.5 px-2 font-medium">Query</th>
                                <th className="py-1.5 px-2 font-medium text-right">Sessions</th>
                                <th className="py-1.5 px-2 font-medium text-right">CVR</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {TOP_ASSISTANT_QUERIES.map((q) => (
                                <tr key={q.query} className="hover:bg-slate-50">
                                    <td className="py-1.5 px-2 text-slate-800 truncate max-w-[240px]">
                                        {q.query}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-slate-600 tabular-nums">
                                        {q.count}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-emerald-700 font-medium tabular-nums">
                                        {q.conversion.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Recommendation performance */}
            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <header>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        Recommendation performance
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        Where AI recommendations appear and how they convert.
                    </p>
                </header>
                <ul className="space-y-1.5">
                    {RECOMMENDATION_PERFORMANCE.map((r) => (
                        <li
                            key={r.placement}
                            className="flex items-center gap-2 text-[13px] rounded-sm border border-slate-100 p-2"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-800 truncate">
                                    {r.placement}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {r.impressions.toLocaleString()} impressions
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[13px] font-semibold text-slate-900">
                                    {r.ctr.toFixed(1)}%
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    KES {r.revenue.toLocaleString()}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI features tab
// ─────────────────────────────────────────────────────────────────────────────
function AIFeaturesTab({
    features,
    onToggle,
}: {
    features: AIFeature[];
    onToggle: (id: string) => void;
}) {
    return (
        <div className="space-y-2">
            {features.map((f) => (
                <div
                    key={f.id}
                    className="bg-white border border-slate-200 rounded-sm p-3 flex items-start gap-3"
                >
                    <span className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${f.accent}`}>
                        <f.icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[13px] font-medium text-slate-900">{f.name}</h3>
                            <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm border ${f.enabled
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}
                            >
                                {f.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                            {f.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {f.usageThisMonth.toLocaleString()} uses (30d)
                            </span>
                        </div>
                    </div>
                    <Toggle checked={f.enabled} onChange={() => onToggle(f.id)} />
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Automations tab
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<AutomationCategory, string> = {
    recovery: 'Recovery',
    transactional: 'Transactional',
    engagement: 'Engagement',
};

const CATEGORY_DESCRIPTION: Record<AutomationCategory, string> = {
    recovery: 'Bring back customers who nearly bought.',
    transactional: 'Confirm, notify, and keep orders on track.',
    engagement: 'Turn one-time buyers into repeat customers.',
};

const CHANNEL_ICON: Record<Channel, typeof Mail> = {
    email: Mail,
    sms: Smartphone,
    push: MessageSquare,
};

function AutomationsTab({
    automations,
    expanded,
    onExpand,
    onToggle,
    onUpdate,
    onEditTemplate,
}: {
    automations: Automation[];
    expanded: string | null;
    onExpand: (id: string) => void;
    onToggle: (id: string) => void;
    onUpdate: (id: string, patch: Partial<Automation>) => void;
    onEditTemplate: (a: Automation) => void;
}) {
    const grouped = useMemo(() => {
        const map: Record<AutomationCategory, Automation[]> = {
            recovery: [],
            transactional: [],
            engagement: [],
        };
        automations.forEach((a) => map[a.category].push(a));
        return map;
    }, [automations]);

    const order: AutomationCategory[] = ['recovery', 'transactional', 'engagement'];

    return (
        <div className="space-y-3">
            {order.map((cat) => (
                <section key={cat} className="space-y-2">
                    <header className="flex items-center gap-2 px-1">
                        <h2 className="text-[13px] font-semibold text-slate-900">
                            {CATEGORY_LABEL[cat]}
                        </h2>
                        <span className="text-[11px] text-slate-400">
                            · {CATEGORY_DESCRIPTION[cat]}
                        </span>
                    </header>

                    <div className="space-y-2">
                        {grouped[cat].map((a) => {
                            const isExpanded = expanded === a.id;
                            const ChannelIcon = CHANNEL_ICON[a.channel];
                            const openRate = a.stats.sent
                                ? (a.stats.opened / a.stats.sent) * 100
                                : 0;
                            const clickRate = a.stats.sent
                                ? (a.stats.clicked / a.stats.sent) * 100
                                : 0;
                            const convRate = a.stats.sent
                                ? (a.stats.converted / a.stats.sent) * 100
                                : 0;

                            return (
                                <div
                                    key={a.id}
                                    className="bg-white border border-slate-200 rounded-sm overflow-hidden"
                                >
                                    <div className="p-3 flex items-start gap-3">
                                        <button
                                            type="button"
                                            onClick={() => onExpand(a.id)}
                                            className="w-9 h-9 rounded-sm flex items-center justify-center bg-blue-50 text-blue-950 shrink-0 hover:bg-blue-100 transition"
                                        >
                                            <a.icon className="w-4 h-4" />
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-[13px] font-medium text-slate-900">
                                                    {a.name}
                                                </h3>
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-sm border ${a.enabled
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                                        }`}
                                                >
                                                    {a.enabled ? (
                                                        <>
                                                            <Play className="w-2.5 h-2.5" />
                                                            Active
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Pause className="w-2.5 h-2.5" />
                                                            Paused
                                                        </>
                                                    )}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                    <ChannelIcon className="w-3 h-3" />
                                                    {a.channel}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                                                {a.description}
                                            </p>

                                            {/* Inline stats */}
                                            {a.stats.sent > 0 && (
                                                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                                                    <span>
                                                        <span className="font-medium text-slate-700">
                                                            {a.stats.sent.toLocaleString()}
                                                        </span>{' '}
                                                        sent
                                                    </span>
                                                    <span>
                                                        <span className="font-medium text-slate-700">
                                                            {openRate.toFixed(1)}%
                                                        </span>{' '}
                                                        open
                                                    </span>
                                                    <span>
                                                        <span className="font-medium text-slate-700">
                                                            {clickRate.toFixed(1)}%
                                                        </span>{' '}
                                                        click
                                                    </span>
                                                    {a.stats.converted > 0 && (
                                                        <span className="text-emerald-700">
                                                            <span className="font-medium">
                                                                {convRate.toFixed(1)}%
                                                            </span>{' '}
                                                            conv
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Toggle
                                                checked={a.enabled}
                                                onChange={() => onToggle(a.id)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => onExpand(a.id)}
                                                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-sm hover:bg-slate-100 transition"
                                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded config */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-3">
                                            {/* Trigger + delay + channel */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <ConfigField label="Trigger" icon={Zap}>
                                                    <div className="text-[13px] text-slate-800">
                                                        {a.trigger}
                                                    </div>
                                                </ConfigField>
                                                <ConfigField label="Delay" icon={Clock}>
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={a.delayMinutes}
                                                            onChange={(e) =>
                                                                onUpdate(a.id, {
                                                                    delayMinutes: Math.max(0, parseInt(e.target.value) || 0),
                                                                })
                                                            }
                                                            className="w-20 bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950 tabular-nums"
                                                        />
                                                        <span className="text-[12px] text-slate-500">
                                                            {formatDelay(a.delayMinutes)}
                                                        </span>
                                                    </div>
                                                </ConfigField>
                                                <ConfigField label="Channel" icon={Mail}>
                                                    <select
                                                        value={a.channel}
                                                        onChange={(e) =>
                                                            onUpdate(a.id, { channel: e.target.value as Channel })
                                                        }
                                                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
                                                    >
                                                        <option value="email">Email</option>
                                                        <option value="sms">SMS</option>
                                                        <option value="push">Push</option>
                                                    </select>
                                                </ConfigField>
                                            </div>

                                            {/* Template preview */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="text-[12px] font-medium text-slate-700">
                                                        Message template
                                                    </div>
                                                    <button
                                                        onClick={() => onEditTemplate(a)}
                                                        className="text-[12px] font-medium text-blue-950 hover:underline"
                                                    >
                                                        Edit template →
                                                    </button>
                                                </div>
                                                <div className="bg-white border border-slate-200 rounded-sm p-2 text-[12px] text-slate-600 whitespace-pre-line leading-relaxed max-h-32 overflow-hidden">
                                                    {a.template}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function ConfigField({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon: typeof Zap;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-sm p-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">
                <Icon className="w-3 h-3" />
                {label}
            </div>
            {children}
        </div>
    );
}

function formatDelay(minutes: number): string {
    if (minutes === 0) return 'Immediately';
    if (minutes < 60) return `in ${minutes} min`;
    if (minutes < 1440) return `in ${Math.round(minutes / 60)} h`;
    return `in ${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Insights tab
// ─────────────────────────────────────────────────────────────────────────────
function InsightsTab() {
    return (
        <div className="space-y-3">
            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {INSIGHT_METRICS.map((m) => {
                    const positive = m.delta >= 0;
                    return (
                        <div
                            key={m.label}
                            className="bg-white border border-slate-200 rounded-sm p-3 space-y-1"
                        >
                            <div className="text-[13px] font-medium text-slate-500">
                                {m.label}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[18px] font-bold text-slate-900">
                                    {m.value}
                                </span>
                                <span
                                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${positive ? 'text-emerald-700' : 'text-rose-600'
                                        }`}
                                >
                                    {positive ? (
                                        <ArrowUpRight className="w-3 h-3" />
                                    ) : (
                                        <ArrowDownRight className="w-3 h-3" />
                                    )}
                                    {Math.abs(m.delta).toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                {m.hint}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Two-column: AI session behaviour + top segments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                    <header>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            AI vs non-AI sessions
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Last 30 days · sessions that interacted with an AI feature
                        </p>
                    </header>
                    <div className="space-y-3">
                        <ComparisonBar
                            label="Conversion rate"
                            left={4.8}
                            right={3.1}
                            leftLabel="With AI"
                            rightLabel="Without AI"
                            format={(v) => `${v.toFixed(1)}%`}
                        />
                        <ComparisonBar
                            label="Avg. order value"
                            left={12840}
                            right={10200}
                            leftLabel="With AI"
                            rightLabel="Without AI"
                            format={(v) => `KES ${v.toLocaleString()}`}
                        />
                        <ComparisonBar
                            label="Time to purchase"
                            left={6.2}
                            right={11.4}
                            leftLabel="With AI"
                            rightLabel="Without AI"
                            format={(v) => `${v.toFixed(1)} min`}
                            invert
                        />
                    </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
                    <header>
                        <h2 className="text-[15px] font-semibold text-slate-900">
                            Customer segments
                        </h2>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                            Grouped by behaviour over the last 90 days
                        </p>
                    </header>
                    <ul className="space-y-1.5">
                        {[
                            { name: 'Loyal buyers', count: 320, hint: '3+ orders, RAV > 8k', accent: 'bg-emerald-500' },
                            { name: 'Repeat customers', count: 890, hint: '2 orders', accent: 'bg-blue-950' },
                            { name: 'New customers', count: 1420, hint: '1 order or signed up recently', accent: 'bg-indigo-500' },
                            { name: 'Window shoppers', count: 3240, hint: 'Browsed 3+ times, never bought', accent: 'bg-amber-500' },
                            { name: 'Cart abandoners', count: 610, hint: 'Abandoned a cart in the last 30 days', accent: 'bg-rose-500' },
                        ].map((s) => (
                            <li
                                key={s.name}
                                className="flex items-center gap-3 rounded-sm border border-slate-100 p-2 hover:bg-slate-50 transition"
                            >
                                <span className={`w-2 h-8 rounded-sm ${s.accent} shrink-0`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-slate-900 truncate">
                                        {s.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                        {s.hint}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">
                                        {s.count.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                                        customers
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            {/* Top products by AI-assisted revenue */}
            <section className="bg-white border border-slate-200 rounded-sm p-3 space-y-2">
                <header>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        Top products driven by AI
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        Revenue attributed to sessions that used AI search, assistant, or recommendations
                    </p>
                </header>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-1.5 px-2 font-medium">Product</th>
                                <th className="py-1.5 px-2 font-medium text-right">AI views</th>
                                <th className="py-1.5 px-2 font-medium text-right">Orders</th>
                                <th className="py-1.5 px-2 font-medium text-right">Revenue</th>
                                <th className="py-1.5 px-2 font-medium text-right">CVR</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[
                                { name: 'Apex Ultra X1 Pro Smartphone', views: 4820, orders: 42, revenue: 3578000, cvr: 0.87 },
                                { name: 'Zenith StudioBook Pro 16 Laptop', views: 2140, orders: 18, revenue: 2699982, cvr: 0.84 },
                                { name: 'Sony WH-1000XM5', views: 3120, orders: 31, revenue: 1302000, cvr: 0.99 },
                                { name: 'Dell UltraSharp 27" 4K Monitor', views: 1890, orders: 15, revenue: 675000, cvr: 0.79 },
                                { name: 'Logitech MX Master 3S', views: 2640, orders: 22, revenue: 319000, cvr: 0.83 },
                            ].map((p) => (
                                <tr key={p.name} className="hover:bg-slate-50">
                                    <td className="py-1.5 px-2 text-slate-800 truncate max-w-[280px]">
                                        {p.name}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-slate-600 tabular-nums">
                                        {p.views.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-slate-600 tabular-nums">
                                        {p.orders}
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-medium text-slate-900 tabular-nums">
                                        KES {p.revenue.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-emerald-700 font-medium tabular-nums">
                                        {p.cvr.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function ComparisonBar({
    label,
    left,
    right,
    leftLabel,
    rightLabel,
    format,
    invert = false,
}: {
    label: string;
    left: number;
    right: number;
    leftLabel: string;
    rightLabel: string;
    format: (v: number) => string;
    /** If true, smaller numbers are better (e.g. time to purchase). */
    invert?: boolean;
}) {
    const max = Math.max(left, right) || 1;
    const leftW = (left / max) * 100;
    const rightW = (right / max) * 100;
    const better = invert ? left < right : left > right;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-slate-700">{label}</span>
                {better && (
                    <span className="text-[11px] font-medium text-emerald-700">
                        AI performs better
                    </span>
                )}
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="w-24 text-[11px] text-slate-500 shrink-0">{leftLabel}</span>
                    <div className="flex-1 bg-slate-100 rounded-sm h-4 overflow-hidden">
                        <div
                            className="h-full bg-blue-950 rounded-sm transition-all"
                            style={{ width: `${leftW}%` }}
                        />
                    </div>
                    <span className="w-24 text-right text-[12px] font-medium text-slate-900 tabular-nums shrink-0">
                        {format(left)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-24 text-[11px] text-slate-500 shrink-0">{rightLabel}</span>
                    <div className="flex-1 bg-slate-100 rounded-sm h-4 overflow-hidden">
                        <div
                            className="h-full bg-slate-400 rounded-sm transition-all"
                            style={{ width: `${rightW}%` }}
                        />
                    </div>
                    <span className="w-24 text-right text-[12px] font-medium text-slate-500 tabular-nums shrink-0">
                        {format(right)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template editor
// ─────────────────────────────────────────────────────────────────────────────
const AVAILABLE_VARIABLES = [
    '{{customer_name}}',
    '{{order_id}}',
    '{{order_total}}',
    '{{item_count}}',
    '{{cart_total}}',
    '{{cart_link}}',
    '{{product_name}}',
    '{{product_link}}',
    '{{tracking_number}}',
    '{{eta}}',
    '{{review_link}}',
    '{{stock_left}}',
    '{{payment_method}}',
    '{{shop_name}}',
];

function TemplateEditor({
    automation,
    onClose,
    onSave,
}: {
    automation: Automation;
    onClose: () => void;
    onSave: (template: string) => void;
}) {
    const [text, setText] = useState(automation.template);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    function insertVariable(v: string) {
        const el = textareaRef.current;
        if (!el) {
            setText((t) => t + v);
            return;
        }
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const next = text.slice(0, start) + v + text.slice(end);
        setText(next);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + v.length, start + v.length);
        });
    }

    return (
        <div
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
            onClick={onClose}
        >
            <div
                className="bg-white border border-slate-200 rounded-sm max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-8 h-8 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                            <automation.icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                                Edit template
                            </h3>
                            <p className="text-[13px] text-slate-500 truncate">
                                {automation.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-500"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[13px] font-medium text-slate-700">
                                Message body
                            </label>
                            <span className="text-[11px] text-slate-400 tabular-nums">
                                {text.length} chars
                            </span>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={10}
                            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-950 resize-none leading-relaxed"
                        />
                    </div>

                    <div>
                        <div className="text-[13px] font-medium text-slate-700 mb-1">
                            Available variables
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">
                            Click a variable to insert it at the cursor position.
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {AVAILABLE_VARIABLES.map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => insertVariable(v)}
                                    className="text-[12px] font-mono bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-sm hover:bg-blue-50 hover:border-blue-950 hover:text-blue-950 transition"
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-sm p-2 text-[12px] text-slate-700">
                        <div className="flex items-center gap-1.5 font-medium text-blue-950 mb-1">
                            <Copy className="w-3.5 h-3.5" />
                            Tip
                        </div>
                        Keep transactional messages short. For engagement or recovery,
                        personalise with customer name and reference what they looked at.
                    </div>
                </div>

                <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-2 shrink-0 bg-white">
                    <button
                        onClick={onClose}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(text)}
                        className="bg-blue-950 hover:bg-blue-900 text-white font-medium px-3 py-2 rounded-sm text-[13px] inline-flex items-center gap-1.5"
                    >
                        <Save className="w-3.5 h-3.5" />
                        Save template
                    </button>
                </div>
            </div>
        </div>
    );
}