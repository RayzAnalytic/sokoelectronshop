'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    Bot, Send, X, CheckCircle2, TrendingUp, Users, Package, Shield, ArrowRight,
    AlertTriangle, RefreshCw, MessageSquare, Bell, ChevronRight, CreditCard,
    Truck, Star, Megaphone, BarChart3, Copy, Trash2, Lightbulb, Zap, Filter,
    Clock, Plus, Search, Pin, PinOff, Download, ThumbsUp, ThumbsDown, Square,
    Edit3, RotateCcw, Maximize2, Minimize2, PanelRight, Sun, Moon,
    Mic, MicOff, Paperclip, Settings, Check, ChevronDown, FileText, Volume2,
    VolumeX, Sparkles, Activity, Calendar, History, Hash, TrendingDown, Sliders,
    BookOpen, Loader2, Info, XCircle, ShieldCheck, Lock, Eye, EyeOff, Workflow,
    Target, Gauge, Wand2, Globe, Database, Undo2, ListChecks, Timer, Flag, Mail,
    Image as ImageIcon, ChevronLeft, ExternalLink, Command, LayoutDashboard,
    PanelLeft, Minimize, ArrowUpRight, Bug, PanelBottom, ShieldAlert, KeyRound,
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie,
    AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { IoCloseSharp } from 'react-icons/io5';

import { adminApi } from '@/lib/admin-api';
import type {
    AdminAIConversation, AdminAIMessage, AdminAIChartSpec, AdminAIAlert,
    AdminAIAlertSeverity, AdminAIInsight, AdminAIAutomationExtended,
} from '@/lib/admin-types';

export type CopilotTab = 'chat' | 'alerts' | 'insights' | 'actions' | 'automations';
export type PanelMode = 'floating' | 'docked' | 'fullscreen' | 'minimized';
export type Theme = 'light' | 'dark' | 'auto';
export type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

type IconComponent = React.ComponentType<{ className?: string }>;

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    streaming?: boolean;
    chart?: AdminAIChartSpec;
    table?: { headers: string[]; rows: string[][] };
    link?: { label: string; href: string };
    quickReplies?: string[];
    isVerified?: boolean;
    missingData?: string[];
    feedback?: 'up' | 'down' | null;
    actions?: MessageAction[];
    provenance?: ProvenanceItem[];
    toolCalls?: ToolCall[];
    attachments?: Attachment[];
    error?: string;
}

interface MessageAction {
    id: string;
    label: string;
    icon?: IconComponent;
    tone?: 'default' | 'danger' | 'primary';
    href?: string;
    prompt?: string;
    requiresConfirmation?: boolean;
    params?: Record<string, unknown>;
}

interface ProvenanceItem {
    label: string;
    detail?: string;
    href?: string;
    count?: number;
}

interface ToolCall {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    params?: Record<string, unknown>;
    resultSummary?: string;
    durationMs?: number;
}

interface Attachment {
    id: string;
    name: string;
    size: number;
    type: string;
    preview?: string;
}

interface RoutePrompt {
    label: string;
    prompt: string;
    icon: IconComponent;
    tone: Tone;
}

interface RoutePack {
    label: string;
    description: string;
    prompts: RoutePrompt[];
    tools?: string[];
    fields?: string[];
    kpis?: { label: string; value?: string; href?: string }[];
}

interface PageContext {
    path: string;
    label: string;
    description: string;
    pack?: RoutePack;
}

interface QuickAction {
    id: string;
    label: string;
    description: string;
    icon: IconComponent;
    prompt?: string;
    href?: string;
    tone?: Tone;
}

interface ConversationSummary {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
    pinned?: boolean;
    preview?: string;
}

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    action?: { label: string; onClick: () => void };
    duration?: number;
}

interface PendingAction {
    id: string;
    tool: string;
    title: string;
    description: string;
    params: Record<string, unknown>;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    preview?: { label: string; value: string }[];
    requiresConfirmation?: boolean;
}

interface AuditEntry {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    target?: string;
    params?: Record<string, unknown>;
    status: 'success' | 'failed' | 'pending' | 'cancelled';
}

interface DigestItem {
    label: string;
    value: string;
    delta?: number;
    tone: Tone;
    href?: string;
}

interface PersistedState {
    messages: Record<string, ChatMessage[]>;
    conversations: ConversationSummary[];
    activeConversationId: string | null;
    tab: CopilotTab;
    mode: PanelMode;
    theme: Theme;
}

interface AIAutomationCopilotProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
}

const rp = (
    label: string,
    description: string,
    prompts: RoutePrompt[],
    tools?: string[],
): RoutePack => ({ label, description, prompts, tools });

const ROUTE_PACKS: Record<string, RoutePack> = {
    '/admin': rp('Overview', "Dashboard KPIs and today's snapshot", [
        { label: 'Daily digest', prompt: "Give me today's daily digest", icon: Calendar, tone: 'blue' },
        { label: 'Needs attention', prompt: 'What needs my attention today?', icon: Bell, tone: 'amber' },
        { label: 'Revenue trend', prompt: 'How is revenue trending this week?', icon: TrendingUp, tone: 'emerald' },
        { label: 'Anomalies', prompt: 'Any anomalies I should know about?', icon: Activity, tone: 'rose' },
        { label: 'Top products', prompt: 'What are my top-selling products this week?', icon: Package, tone: 'violet' },
        { label: 'Forecast', prompt: 'Forecast sales for next week', icon: Gauge, tone: 'slate' },
    ], ['getDashboardKpis', 'listAlerts', 'getAnomalies']),
    '/admin/analytics': rp('Analytics', 'Revenue, orders, and channel performance', [
        { label: 'Explain revenue', prompt: 'Why did revenue change this week?', icon: TrendingUp, tone: 'blue' },
        { label: 'Channel mix', prompt: 'Break down revenue by channel this month', icon: BarChart3, tone: 'emerald' },
        { label: 'Compare periods', prompt: 'Compare this week vs last week', icon: Sliders, tone: 'violet' },
        { label: 'Cohort', prompt: 'Show customer cohorts for the last 30 days', icon: Users, tone: 'amber' },
        { label: 'Drill down', prompt: 'Which products drove the change?', icon: Package, tone: 'rose' },
    ], ['getRevenue', 'getChannels', 'comparePeriods']),
    '/admin/reports': rp('Reports', 'Scheduled and on-demand reports', [
        { label: 'Schedule report', prompt: 'Schedule a weekly sales report', icon: Calendar, tone: 'blue' },
        { label: 'Last export', prompt: 'Explain the last export I generated', icon: FileText, tone: 'slate' },
        { label: 'Top metrics', prompt: 'What are the key metrics in last month?', icon: BarChart3, tone: 'emerald' },
        { label: 'Build report', prompt: 'Build a report of refunds this quarter', icon: Workflow, tone: 'violet' },
    ], ['scheduleReport', 'explainExport', 'buildReport']),
    '/admin/products': rp('Products', 'Catalogue, pricing, and stock', [
        { label: 'Low stock', prompt: 'Which products are low in stock?', icon: Package, tone: 'amber' },
        { label: 'Slow movers', prompt: 'Show me slow-moving products', icon: TrendingDown, tone: 'rose' },
        { label: 'Price anomalies', prompt: 'Any price anomalies I should review?', icon: Target, tone: 'blue' },
        { label: 'Draft copy', prompt: 'Draft product descriptions for my top 3 items', icon: Wand2, tone: 'violet' },
        { label: 'Best sellers', prompt: 'Top 10 best-selling products this month', icon: TrendingUp, tone: 'emerald' },
    ], ['searchProducts', 'getInventory', 'draftDescription']),
    '/admin/categories': rp('Categories', 'Product category tree', [
        { label: 'Underperforming', prompt: 'Which categories are underperforming?', icon: TrendingDown, tone: 'rose' },
        { label: 'Restructure', prompt: 'Suggest a category restructure', icon: Workflow, tone: 'violet' },
        { label: 'Coverage', prompt: 'Which categories have no products?', icon: Package, tone: 'amber' },
    ], ['listCategories', 'getCategoryPerformance']),
    '/admin/brands': rp('Brands', 'Brand catalogue', [
        { label: 'Best margin', prompt: 'Which brand has the best margin?', icon: TrendingUp, tone: 'emerald' },
        { label: 'Low sellers', prompt: 'Which brands are underperforming?', icon: TrendingDown, tone: 'rose' },
        { label: 'Supplier links', prompt: 'Show brands and their supplier links', icon: Truck, tone: 'blue' },
    ], ['listBrands', 'getBrandPerformance']),
    '/admin/inventory': rp('Inventory', 'Stock levels and thresholds', [
        { label: 'Stockout forecast', prompt: 'Forecast stockouts for the next 2 weeks', icon: Gauge, tone: 'rose' },
        { label: 'Reorder', prompt: 'Suggest reorder quantities for low-stock items', icon: Package, tone: 'amber' },
        { label: 'Dead stock', prompt: 'Show me dead stock', icon: TrendingDown, tone: 'slate' },
        { label: 'Thresholds', prompt: 'Which thresholds should I adjust?', icon: Sliders, tone: 'blue' },
    ], ['getInventory', 'forecastStockout', 'suggestReorder']),
    '/admin/suppliers': rp('Suppliers', 'Supplier performance and orders', [
        { label: 'Late deliveries', prompt: 'Which suppliers are delivering late?', icon: Truck, tone: 'rose' },
        { label: 'Lead time', prompt: 'Rank suppliers by lead time', icon: Clock, tone: 'blue' },
        { label: 'Cost compare', prompt: 'Compare supplier costs for the same SKUs', icon: TrendingUp, tone: 'emerald' },
    ], ['listSuppliers', 'getSupplierPerformance']),
    '/admin/discounts': rp('Discounts', 'Promo codes and rules', [
        { label: 'Simulate', prompt: 'Simulate 15% off slow movers for a week', icon: Wand2, tone: 'violet' },
        { label: 'Dead codes', prompt: 'Show unused promo codes I can clean up', icon: Trash2, tone: 'rose' },
        { label: 'Active promos', prompt: 'What promotions are active right now?', icon: Zap, tone: 'blue' },
        { label: 'Best coupon', prompt: 'Which coupon had the highest conversion?', icon: TrendingUp, tone: 'emerald' },
    ], ['listDiscounts', 'simulateDiscount', 'analyzeCoupons']),
    '/admin/reviews': rp('Reviews', 'Customer reviews and ratings', [
        { label: 'Low-rated', prompt: 'Show reviews at 3 stars or below', icon: Star, tone: 'amber' },
        { label: 'Draft replies', prompt: 'Draft replies to my recent 1-star reviews', icon: Wand2, tone: 'violet' },
        { label: 'Sentiment', prompt: 'What is sentiment by product?', icon: Activity, tone: 'blue' },
        { label: 'Top complaints', prompt: 'Top complaint themes this month', icon: AlertTriangle, tone: 'rose' },
    ], ['listReviews', 'draftReply', 'analyzeSentiment']),
    '/admin/orders': rp('Orders', 'All orders across channels', [
        { label: 'Unpaid', prompt: 'Show me unpaid orders', icon: CreditCard, tone: 'rose' },
        { label: 'Past due', prompt: 'Any orders past expected delivery?', icon: Truck, tone: 'amber' },
        { label: 'Bulk update', prompt: 'Mark order #4821 as fulfilled', icon: Zap, tone: 'violet' },
        { label: 'Big orders', prompt: 'Show orders over $500 in the last 7 days', icon: TrendingUp, tone: 'emerald' },
        { label: 'Cancellations', prompt: 'Why did customers cancel this week?', icon: XCircle, tone: 'rose' },
    ], ['searchOrders', 'getOrder', 'updateOrderStatus', 'refundOrder']),
    '/admin/transactions': rp('Transactions', 'Ledger and reconciliation', [
        { label: 'Reconcile', prompt: 'Reconcile the last ledger gap', icon: Shield, tone: 'blue' },
        { label: 'Duplicates', prompt: 'Are there any duplicate charges?', icon: AlertTriangle, tone: 'rose' },
        { label: 'Failed txns', prompt: 'Show me failed transactions this week', icon: XCircle, tone: 'amber' },
    ], ['listTransactions', 'reconcile', 'findDuplicates']),
    '/admin/payments': rp('Payments', 'Payment methods and settlement', [
        { label: 'Failure rate', prompt: 'What is my payment failure rate?', icon: Activity, tone: 'rose' },
        { label: 'Retry failed', prompt: 'Retry failed charges from today', icon: RefreshCw, tone: 'amber' },
        { label: 'Settlement', prompt: 'When is my next payout and how much?', icon: CreditCard, tone: 'emerald' },
    ], ['listPayments', 'retryFailed', 'getSettlement']),
    '/admin/shipping': rp('Shipping', 'Carriers, zones, and delivery', [
        { label: 'Past ETA', prompt: 'Any orders past expected delivery?', icon: Truck, tone: 'rose' },
        { label: 'Carrier perf', prompt: 'Rank carriers by on-time delivery', icon: BarChart3, tone: 'blue' },
        { label: 'Zones', prompt: 'Which zones are slowest?', icon: Globe, tone: 'violet' },
        { label: 'Cost', prompt: 'Compare shipping cost per carrier', icon: TrendingUp, tone: 'emerald' },
    ], ['getShipments', 'carrierPerformance', 'zonePerformance']),
    '/admin/returnsrefunds': rp('Returns & Refunds', 'Customer returns and refund requests', [
        { label: 'Pending', prompt: 'Show pending returns and refunds', icon: RefreshCw, tone: 'rose' },
        { label: 'Reasons', prompt: 'What are the top refund reasons?', icon: AlertTriangle, tone: 'amber' },
        { label: 'Approve all', prompt: 'Approve all pending refunds under $50', icon: Zap, tone: 'violet' },
        { label: 'Patterns', prompt: 'Any repeat returners I should review?', icon: Users, tone: 'blue' },
    ], ['listReturns', 'approveRefund', 'analyzeReturnReasons']),
    '/admin/customers': rp('Customers', 'Customer list and segments', [
        { label: 'Churn risk', prompt: 'Which customers are at churn risk?', icon: TrendingDown, tone: 'rose' },
        { label: 'VIPs', prompt: 'Who are my VIP customers?', icon: Star, tone: 'amber' },
        { label: 'LTV', prompt: 'Segment customers by LTV', icon: Users, tone: 'violet' },
        { label: 'New this week', prompt: 'New customers this week vs last', icon: TrendingUp, tone: 'emerald' },
    ], ['listCustomers', 'getChurnRisk', 'segmentByLtv']),
    '/admin/users': rp('Users', 'Admin users and permissions', [
        { label: 'Permission audit', prompt: 'Audit admin permissions', icon: ShieldCheck, tone: 'blue' },
        { label: 'Inactive', prompt: 'List inactive admin accounts', icon: Clock, tone: 'amber' },
        { label: 'Risky grants', prompt: 'Any risky permission grants?', icon: ShieldAlert, tone: 'rose' },
    ], ['listAdmins', 'auditPermissions']),
    '/admin/newsletter': rp('Newsletter', 'Subscribers and sends', [
        { label: 'Draft campaign', prompt: 'Draft a newsletter for new products', icon: Wand2, tone: 'violet' },
        { label: 'Open rate', prompt: 'How are open rates trending?', icon: Mail, tone: 'blue' },
        { label: 'Best subject', prompt: 'Which subject line performed best?', icon: TrendingUp, tone: 'emerald' },
    ], ['listNewsletters', 'draftNewsletter', 'analyzeOpens']),
    '/admin/social': rp('Social', 'Social channels performance', [
        { label: 'Best post', prompt: 'Which posts performed best this month?', icon: TrendingUp, tone: 'emerald' },
        { label: 'Best time', prompt: 'When should I post for best reach?', icon: Clock, tone: 'blue' },
        { label: 'Draft', prompt: 'Draft a post for our top product', icon: Wand2, tone: 'violet' },
    ], ['listSocialPosts', 'draftPost', 'analyzeReach']),
    '/admin/tiktok': rp('TikTok Business', 'TikTok Shop performance', [
        { label: 'Conversion', prompt: 'What is my TikTok shop conversion rate?', icon: Activity, tone: 'blue' },
        { label: 'Top videos', prompt: 'Top performing videos this week', icon: TrendingUp, tone: 'emerald' },
        { label: 'Products', prompt: 'Which products sell best on TikTok?', icon: Package, tone: 'violet' },
    ], ['getTikTokPerformance', 'listVideos']),
    '/admin/whatsapp': rp('WhatsApp', 'Conversations and broadcasts', [
        { label: 'Draft broadcast', prompt: 'Draft a WhatsApp broadcast for Black Friday', icon: Megaphone, tone: 'emerald' },
        { label: 'Unanswered', prompt: 'Which WhatsApp conversations are unanswered?', icon: MessageSquare, tone: 'rose' },
        { label: 'Best time', prompt: 'Best time to send broadcasts?', icon: Clock, tone: 'blue' },
    ], ['listWhatsAppThreads', 'draftBroadcast', 'sendBroadcast']),
    '/admin/banner': rp('Banner', 'Homepage and category banners', [
        { label: 'CTR', prompt: 'Which banners have the highest CTR?', icon: BarChart3, tone: 'blue' },
        { label: 'Draft variants', prompt: 'Draft copy variants for my top banner', icon: Wand2, tone: 'violet' },
        { label: 'Dead banners', prompt: 'Which banners should I retire?', icon: Trash2, tone: 'rose' },
    ], ['listBanners', 'draftBannerCopy', 'analyzeCtr']),
    '/admin/campaigns': rp('Campaigns', 'Marketing campaigns', [
        { label: 'ROI', prompt: 'ROI by campaign this quarter', icon: TrendingUp, tone: 'emerald' },
        { label: 'Best channel', prompt: 'Which channel is my best for campaigns?', icon: BarChart3, tone: 'blue' },
        { label: 'Draft next steps', prompt: 'What should I run next based on results?', icon: Lightbulb, tone: 'violet' },
    ], ['listCampaigns', 'getCampaignRoi']),
    '/admin/settings': rp('Settings', 'Store configuration', [
        { label: 'Explain flag', prompt: 'What does the "auto-capture" flag do?', icon: Info, tone: 'blue' },
        { label: 'Config drift', prompt: 'Any configuration drift since last week?', icon: AlertTriangle, tone: 'rose' },
        { label: 'Audit log', prompt: 'Show recent config changes', icon: History, tone: 'slate' },
    ], ['getSettings', 'getConfigDrift', 'auditConfig']),
};

const GENERAL_PROMPTS: RoutePrompt[] = [
    { label: 'Sales trend', prompt: 'How did sales trend last week?', icon: TrendingUp, tone: 'blue' },
    { label: 'Needs attention', prompt: 'What needs my attention today?', icon: Bell, tone: 'amber' },
    { label: 'Top customers', prompt: 'Who are my top customers?', icon: Users, tone: 'violet' },
    { label: 'Week vs week', prompt: 'Compare this week vs last week', icon: BarChart3, tone: 'emerald' },
    { label: 'Pending returns', prompt: 'Show pending returns and refunds', icon: RefreshCw, tone: 'rose' },
    { label: 'Best channel', prompt: 'Which sales channel performed best this month?', icon: Megaphone, tone: 'blue' },
];

const QUICK_ACTIONS: QuickAction[] = [
    { id: 'qa-low-stock', label: 'Low stock report', description: 'Products below threshold, ready to reorder', icon: Package, prompt: 'Which products are low in stock?', tone: 'amber' },
    { id: 'qa-unpaid', label: 'Unpaid orders', description: 'Orders awaiting payment confirmation', icon: CreditCard, prompt: 'Show me unpaid orders', tone: 'rose' },
    { id: 'qa-sales', label: 'Revenue trend', description: 'Sales performance this week', icon: TrendingUp, prompt: 'How did sales trend last week?', tone: 'blue' },
    { id: 'qa-customers', label: 'Top customers', description: 'Highest lifetime value customers', icon: Users, prompt: 'Who are my best customers?', tone: 'violet' },
    { id: 'qa-returns', label: 'Pending returns', description: 'Returns and refunds awaiting action', icon: RefreshCw, href: '/admin/returnsrefunds', tone: 'rose' },
    { id: 'qa-shipping', label: 'Delivery delays', description: 'Orders past their expected delivery date', icon: Truck, href: '/admin/shipping', tone: 'amber' },
    { id: 'qa-reviews', label: 'Low-rated reviews', description: 'Reviews at 3 stars or below', icon: Star, href: '/admin/reviews', tone: 'amber' },
    { id: 'qa-broadcast', label: 'Draft a broadcast', description: 'Write a WhatsApp promo for review', icon: Megaphone, href: '/admin/whatsapp', tone: 'emerald' },
    { id: 'qa-digest', label: 'Daily digest', description: "Today's snapshot across all modules", icon: Calendar, prompt: "Give me today's daily digest", tone: 'blue' },
];

const TOOLTIP_STYLE: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '2px',
    color: '#0f172a',
    fontSize: '13px',
    padding: '6px 8px',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
};

const CHART_COLORS = ['#172554', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#0891b2'];

const STORAGE_KEY = 'ai-copilot:v2';
const AUDIT_KEY = 'ai-copilot:audit:v1';
const ALERT_POLL_MS = 60_000;

const SNOOZE_OPTIONS: Array<{ label: string; minutes: number }> = [
    { label: '15m', minutes: 15 },
    { label: '1h', minutes: 60 },
    { label: '4h', minutes: 240 },
    { label: '1d', minutes: 1440 },
];

const TONE_CLASSES: Record<Tone, { chip: string; icon: string; soft: string; border: string }> = {
    blue: { chip: 'bg-blue-50 text-blue-950 border-blue-100', icon: 'bg-blue-50 text-blue-950', soft: 'bg-blue-50 text-blue-950', border: 'border-blue-100' },
    emerald: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'bg-emerald-50 text-emerald-700', soft: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100' },
    amber: { chip: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'bg-amber-50 text-amber-700', soft: 'bg-amber-50 text-amber-700', border: 'border-amber-100' },
    violet: { chip: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'bg-violet-50 text-violet-700', soft: 'bg-violet-50 text-violet-700', border: 'border-violet-100' },
    rose: { chip: 'bg-rose-50 text-rose-700 border-rose-100', icon: 'bg-rose-50 text-rose-700', soft: 'bg-rose-50 text-rose-700', border: 'border-rose-100' },
    slate: { chip: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'bg-slate-100 text-slate-600', soft: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
};

const nowHHMM = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fullNow = () => new Date().toISOString();

function uid(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function resolvePageContext(pathname: string): PageContext {
    if (ROUTE_PACKS[pathname]) return { path: pathname, ...ROUTE_PACKS[pathname], pack: ROUTE_PACKS[pathname] };
    const match = Object.keys(ROUTE_PACKS)
        .filter((p) => p !== '/admin' && pathname.startsWith(p))
        .sort((a, b) => b.length - a.length)[0];
    if (match) return { path: pathname, ...ROUTE_PACKS[match], pack: ROUTE_PACKS[match] };
    return {
        path: pathname,
        label: 'Admin',
        description: 'General admin dashboard context',
        pack: { label: 'Admin', description: 'General admin dashboard context', prompts: GENERAL_PROMPTS },
    };
}

function isIconComponent(value: unknown): value is IconComponent {
    return typeof value === 'function';
}

function sanitizeActions(raw: unknown): MessageAction[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    return raw
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a) => ({
            id: typeof a.id === 'string' ? a.id : uid('a'),
            label: typeof a.label === 'string' ? a.label : 'Action',
            tone: a.tone === 'danger' || a.tone === 'primary' || a.tone === 'default' ? a.tone : undefined,
            href: typeof a.href === 'string' ? a.href : undefined,
            prompt: typeof a.prompt === 'string' ? a.prompt : undefined,
            requiresConfirmation: a.requiresConfirmation === true,
            params: a.params && typeof a.params === 'object' ? (a.params as Record<string, unknown>) : undefined,
            icon: isIconComponent(a.icon) ? a.icon : undefined,
        }));
}

function sanitizeProvenance(raw: unknown): ProvenanceItem[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    return raw
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
        .map((p) => ({
            label: typeof p.label === 'string' ? p.label : '',
            detail: typeof p.detail === 'string' ? p.detail : undefined,
            href: typeof p.href === 'string' ? p.href : undefined,
            count: typeof p.count === 'number' ? p.count : undefined,
        }));
}

function sanitizeToolCalls(raw: unknown): ToolCall[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    return raw
        .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
        .map((t) => ({
            id: typeof t.id === 'string' ? t.id : uid('tc'),
            name: typeof t.name === 'string' ? t.name : 'tool',
            status: t.status === 'done' || t.status === 'error' || t.status === 'running' ? t.status : 'done',
            params: t.params && typeof t.params === 'object' ? (t.params as Record<string, unknown>) : undefined,
            resultSummary: typeof t.resultSummary === 'string' ? t.resultSummary : undefined,
            durationMs: typeof t.durationMs === 'number' ? t.durationMs : undefined,
        }));
}

function toChatMessage(m: AdminAIMessage): ChatMessage {
    const raw = m as unknown as Record<string, unknown>;
    return {
        id: String(m.id),
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
        timestamp: m.timestamp || nowHHMM(),
        chart: m.chart ?? undefined,
        table: m.table ?? undefined,
        link: m.link ?? undefined,
        quickReplies: m.quickReplies ?? m.quick_replies ?? undefined,
        isVerified: m.isVerified,
        missingData: m.missingData,
        actions: sanitizeActions(raw.actions),
        provenance: sanitizeProvenance(raw.provenance),
        toolCalls: sanitizeToolCalls(raw.toolCalls),
    };
}

function loadPersisted(): PersistedState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedState;
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            messages: parsed.messages ?? {},
            conversations: parsed.conversations ?? [],
            activeConversationId: parsed.activeConversationId ?? null,
            tab: parsed.tab ?? 'chat',
            mode: parsed.mode ?? 'floating',
            theme: parsed.theme ?? 'auto',
        };
    } catch {
        return null;
    }
}

function savePersisted(state: PersistedState) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
}

function loadAudit(): AuditEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(AUDIT_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as AuditEntry[];
    } catch {
        return [];
    }
}

function saveAudit(entries: AuditEntry[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, 200)));
    } catch {}
}

function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        const token = match[0];
        if (token.startsWith('**')) {
            parts.push(<strong key={`b-${key++}`} className="font-semibold">{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('*')) {
            parts.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>);
        } else if (token.startsWith('`')) {
            parts.push(<code key={`c-${key++}`} className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded-sm text-[12.5px] font-mono">{token.slice(1, -1)}</code>);
        } else if (token.startsWith('[')) {
            const m = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (m) {
                parts.push(
                    <a key={`a-${key++}`} href={m[2]} className="text-blue-600 underline hover:text-blue-800 transition-colors" target="_blank" rel="noopener noreferrer">
                        {m[1]}
                    </a>,
                );
            }
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let codeLines: string[] = [];
    let inCode = false;
    let key = 0;

    const flushList = () => {
        if (!listItems.length) return;
        if (listType === 'ol') {
            nodes.push(<ol key={`l-${key++}`} className="list-decimal pl-5 space-y-0.5 my-1">{listItems}</ol>);
        } else {
            nodes.push(<ul key={`l-${key++}`} className="list-disc pl-5 space-y-0.5 my-1">{listItems}</ul>);
        }
        listItems = [];
        listType = null;
    };
    const flushCode = () => {
        if (!codeLines.length) return;
        nodes.push(
            <pre key={`c-${key++}`} className="bg-slate-900 text-slate-100 p-2 rounded-sm text-[12px] overflow-x-auto my-1.5">
                <code>{codeLines.join('\n')}</code>
            </pre>,
        );
        codeLines = [];
    };

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (inCode) { flushCode(); inCode = false; }
            else { flushList(); inCode = true; }
            continue;
        }
        if (inCode) { codeLines.push(line); continue; }
        const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (olMatch) {
            if (listType !== 'ol') { flushList(); listType = 'ol'; }
            listItems.push(<li key={`li-${key++}`}>{renderInline(olMatch[2])}</li>);
            continue;
        }
        const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (ulMatch) {
            if (listType !== 'ul') { flushList(); listType = 'ul'; }
            listItems.push(<li key={`li-${key++}`}>{renderInline(ulMatch[1])}</li>);
            continue;
        }
        flushList();
        if (!line.trim()) { nodes.push(<div key={`sp-${key++}`} className="h-1" />); continue; }
        const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
        if (hMatch) {
            const level = hMatch[1].length;
            const cls = level === 1 ? 'text-[15px] font-bold my-2' : level === 2 ? 'text-[14px] font-semibold my-1.5' : 'text-[13.5px] font-semibold my-1';
            nodes.push(<p key={`h-${key++}`} className={cls}>{renderInline(hMatch[2])}</p>);
            continue;
        }
        const bqMatch = line.match(/^>\s+(.*)$/);
        if (bqMatch) {
            nodes.push(<blockquote key={`bq-${key++}`} className="border-l-2 border-slate-300 pl-2 italic text-slate-600 my-1">{renderInline(bqMatch[1])}</blockquote>);
            continue;
        }
        nodes.push(<p key={`p-${key++}`} className="my-0.5 leading-relaxed">{renderInline(line)}</p>);
    }
    flushList();
    flushCode();
    return nodes;
}

function buildExportMarkdown(messages: ChatMessage[], context: PageContext): string {
    const lines: string[] = [
        `# AI Copilot — ${context.label}`,
        `_Exported ${new Date().toLocaleString()}_`,
        '',
    ];
    for (const m of messages) {
        const who = m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Copilot' : 'System';
        lines.push(`### ${who} · ${m.timestamp}`);
        lines.push(m.content || '_no content_');
        if (m.chart) lines.push(`_[chart: ${m.chart.type}]_`);
        if (m.table) {
            lines.push('| ' + m.table.headers.join(' | ') + ' |');
            lines.push('|' + m.table.headers.map(() => '---').join('|') + '|');
            for (const row of m.table.rows) lines.push('| ' + row.join(' | ') + ' |');
        }
        if (m.link) lines.push(`[${m.link.label}](${m.link.href})`);
        lines.push('');
    }
    return lines.join('\n');
}

function downloadFile(name: string, content: string, mime = 'text/markdown') {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        const el = ref.current;
        if (!el) return;
        const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const nodes = Array.from(el.querySelectorAll<HTMLElement>(selector)).filter((n) => n.offsetParent !== null);
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        el.addEventListener('keydown', onKey);
        return () => el.removeEventListener('keydown', onKey);
    }, [ref, enabled]);
}

export default function AIAutomationCopilot({
    open: openProp,
    onOpenChange,
    defaultOpen = false,
}: AIAutomationCopilotProps = {}) {
    const pathname = usePathname() || '/admin';
    const router = useRouter();

    const context = useMemo(() => resolvePageContext(pathname), [pathname]);

    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const open = openProp ?? internalOpen;
    const setOpen = useCallback(
        (next: boolean | ((prev: boolean) => boolean)) => {
            const resolved = typeof next === 'function' ? next(open) : next;
            if (openProp === undefined) setInternalOpen(resolved);
            onOpenChange?.(resolved);
        },
        [open, openProp, onOpenChange],
    );

    const [tab, setTab] = useState<CopilotTab>('chat');
    const [mode, setMode] = useState<PanelMode>('floating');
    const [theme, setTheme] = useState<Theme>('auto');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [streamingId, setStreamingId] = useState<string | null>(null);
    const [alerts, setAlerts] = useState<AdminAIAlert[]>([]);
    const [insights, setInsights] = useState<AdminAIInsight[]>([]);
    const [automations, setAutomations] = useState<AdminAIAutomationExtended[]>([]);
    const [automationsLoading, setAutomationsLoading] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [listening, setListening] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [piiMasked, setPiiMasked] = useState(true);
    const [readOnly, setReadOnly] = useState(false);
    const [query, setQuery] = useState('');
    const [slashOpen, setSlashOpen] = useState(false);
    const [editMessageId, setEditMessageId] = useState<string | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);
    const notifiedAlerts = useRef<Set<string>>(new Set());

    const activeMessages = useMemo(
        () => (activeConversationId ? messagesByConv[activeConversationId] ?? [] : []),
        [activeConversationId, messagesByConv],
    );

    const setActiveMessages = useCallback(
        (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
            setMessagesByConv((prev) => {
                const id = activeConversationId && /^\d+$/.test(activeConversationId)
                    ? activeConversationId
                    : 'local';
                const current = prev[id] ?? [];
                return { ...prev, [id]: updater(current) };
            });
        },
        [activeConversationId],
    );

    const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = uid('t');
        setToasts((prev) => [...prev, { id, ...toast }]);
        const ms = toast.duration ?? 3200;
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ms);
    }, []);

    const appendAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
        const full: AuditEntry = { id: uid('audit'), timestamp: fullNow(), ...entry };
        setAuditEntries((prev) => {
            const next = [full, ...prev].slice(0, 200);
            saveAudit(next);
            return next;
        });
    }, []);

    const effectiveTheme: Theme = theme === 'auto'
        ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

    const isDark = effectiveTheme === 'dark';

    useEffect(() => {
        const persisted = loadPersisted();
        if (persisted) {
            setMessagesByConv(persisted.messages);
            setConversations(persisted.conversations);
            setActiveConversationId(persisted.activeConversationId);
            setTab(persisted.tab);
            setMode(persisted.mode);
            setTheme(persisted.theme);
        }
        setAuditEntries(loadAudit());
    }, []);

    useEffect(() => {
        const handle = setTimeout(() => {
            savePersisted({
                messages: messagesByConv,
                conversations,
                activeConversationId,
                tab,
                mode,
                theme,
            });
        }, 250);
        return () => clearTimeout(handle);
    }, [messagesByConv, conversations, activeConversationId, tab, mode, theme]);

    const loadAlerts = useCallback((signal?: AbortSignal) => {
        adminApi.ai.alerts
            .list({}, signal)
            .then((list) => setAlerts(list as unknown as AdminAIAlert[]))
            .catch(() => {});
    }, []);

    const loadInsights = useCallback((signal?: AbortSignal) => {
        adminApi.ai.insights
            .list({}, signal)
            .then((list) => setInsights(list))
            .catch(() => {});
    }, []);

    const loadAutomations = useCallback((signal?: AbortSignal) => {
        setAutomationsLoading(true);
        adminApi.ai.automations
            .list({}, signal)
            .then((list) => setAutomations(list))
            .catch(() => {})
            .finally(() => setAutomationsLoading(false));
    }, []);

    useEffect(() => {
        const ctrl = new AbortController();
        loadAlerts(ctrl.signal);
        loadInsights(ctrl.signal);
        const interval = setInterval(() => loadAlerts(), ALERT_POLL_MS);
        return () => { ctrl.abort(); clearInterval(interval); };
    }, [loadAlerts, loadInsights]);

    useEffect(() => {
        if (open && tab === 'automations') loadAutomations();
    }, [open, tab, loadAutomations]);

    useEffect(() => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default' && open) {
            Notification.requestPermission().catch(() => {});
        }
    }, [open]);

    useEffect(() => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        for (const a of alerts) {
            if (a.severity !== 'high') continue;
            if (a.isDismissed || a.acknowledgedAt) continue;
            const key = String(a.id);
            if (notifiedAlerts.current.has(key)) continue;
            notifiedAlerts.current.add(key);
            try {
                new Notification(a.title, { body: a.description, tag: key });
            } catch {}
        }
    }, [alerts]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                if (open) { e.preventDefault(); setSidebarOpen((v) => !v); }
            }
            if (e.key === 'Escape') {
                if (pendingAction) { setPendingAction(null); return; }
                if (settingsOpen) { setSettingsOpen(false); return; }
                if (open) setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, setOpen, pendingAction, settingsOpen]);

    useEffect(() => {
        if (!open) return;
        const isSmall = window.matchMedia('(max-width: 767px)').matches;
        if (!isSmall) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [activeMessages, isThinking, activeConversationId]);

    useEffect(() => {
        if (open && tab === 'chat') {
            const t = setTimeout(() => composerRef.current?.focus(), 120);
            return () => clearTimeout(t);
        }
    }, [open, tab]);

    useEffect(() => {
        if (open) return;
        abortRef.current?.abort();
        abortRef.current = null;
    }, [open]);

    useFocusTrap(panelRef, open && mode !== 'minimized');

    const alertBadge = alerts.filter(
        (a) => a.severity !== 'low' && a.isActive !== false && !a.isDismissed && !a.acknowledgedAt,
    ).length;

    const navigate = useCallback(
        (href: string) => {
            setOpen(false);
            router.push(href);
        },
        [router, setOpen],
    );

    const createConversation = useCallback(
        async (title = 'New conversation'): Promise<string> => {
            const id = uid('conv');
            const summary: ConversationSummary = {
                id,
                title,
                updatedAt: fullNow(),
                messageCount: 0,
            };
            setConversations((prev) => [summary, ...prev]);
            setMessagesByConv((prev) => ({ ...prev, [id]: [] }));
            setActiveConversationId(id);
            try {
                const remote: AdminAIConversation = await adminApi.ai.assistant.conversations.create({
                    origin_path: context.path,
                    origin_module: context.label,
                });
                const remoteId = String(remote.id);
                setConversations((prev) => prev.map((c) => c.id === id ? { ...c, id: remoteId } : c));
                setMessagesByConv((prev) => ({ ...prev, [remoteId]: prev[id] ?? [] }));
                setActiveConversationId(remoteId);
                return remoteId;
            } catch {
                return id;
            }
        },
        [context.path, context.label],
    );

    const ensureConversation = useCallback(async (): Promise<string> => {
        if (activeConversationId && /^\d+$/.test(activeConversationId)) {
            return activeConversationId;
        }
        return createConversation();
    }, [activeConversationId, createConversation]);

    const stopStreaming = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        if (streamingId) {
            setActiveMessages((prev) => prev.map((m) => m.id === streamingId ? { ...m, streaming: false } : m));
        }
        setStreamingId(null);
        setIsThinking(false);
        pushToast({ type: 'info', message: 'Generation stopped' });
    }, [streamingId, setActiveMessages, pushToast]);

    const sendMessage = useCallback(
        async (text: string, opts: { regenerateFor?: string; attachmentsOverride?: Attachment[] } = {}) => {
            const trimmed = text.trim();
            if (!trimmed || isThinking) return;

            const convId = await ensureConversation();
            const useAttachments = opts.attachmentsOverride ?? attachments;

            const setMessagesForConv = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
                setMessagesByConv((prev) => ({
                    ...prev,
                    [convId]: updater(prev[convId] ?? []),
                }));
            };

            setMessagesByConv((prev) => {
                const stranded = prev['local'];
                if (!stranded || stranded.length === 0) return prev;
                const copy = { ...prev };
                delete copy['local'];
                copy[convId] = [...stranded, ...(copy[convId] ?? [])];
                return copy;
            });

            if (activeConversationId !== convId) {
                setActiveConversationId(convId);
            }

            let userMsg: ChatMessage;
            if (opts.regenerateFor) {
                userMsg = activeMessages.find((m) => m.id === opts.regenerateFor) ?? {
                    id: uid('m'),
                    role: 'user',
                    content: trimmed,
                    timestamp: nowHHMM(),
                };
                setMessagesForConv((prev) => prev.filter((m) => m.id !== opts.regenerateFor).filter((m) => !m.streaming));
            } else {
                userMsg = {
                    id: uid('m'),
                    role: 'user',
                    content: trimmed,
                    timestamp: nowHHMM(),
                    attachments: useAttachments.length ? useAttachments : undefined,
                };
                setMessagesForConv((prev) => [...prev, userMsg]);
            }
            setDraft('');
            setAttachments([]);
            setEditMessageId(null);
            setIsThinking(true);
            setSlashOpen(false);

            setConversations((prev) => prev.map((c) => c.id === convId ? {
                ...c,
                title: c.title === 'New conversation' ? trimmed.slice(0, 48) : c.title,
                updatedAt: fullNow(),
                messageCount: c.messageCount + 2,
                preview: trimmed.slice(0, 80),
            } : c));

            const streamId = uid('s');
            setStreamingId(streamId);
            setMessagesForConv((prev) => [
                ...prev,
                { id: streamId, role: 'assistant', content: '', timestamp: '', streaming: true },
            ]);

            const ctrl = new AbortController();
            abortRef.current = ctrl;

            const updateStream = (patch: Partial<ChatMessage>) => {
                setMessagesForConv((prev) => prev.map((m) => m.id === streamId ? { ...m, ...patch } : m));
            };

            const streamContext = {
                path: context.path,
                label: context.label,
                description: context.description,
                tools: context.pack?.tools ?? [],
                fields: context.pack?.fields ?? [],
                readOnly,
                piiMasked,
            } as { path?: string; module?: string; label?: string; description?: string };

            try {
                await adminApi.ai.assistant.messages.stream(convId, trimmed, {
                    onChunk: (chunk) => {
                        setMessagesForConv((prev) => prev.map((m) => m.id === streamId ? { ...m, content: m.content + chunk } : m));
                    },
                    onMeta: (meta) => {
                        updateStream({
                            chart: meta.chart ?? undefined,
                            table: meta.table ?? undefined,
                            link: meta.link ?? undefined,
                            quickReplies: meta.quickReplies ?? undefined,
                            provenance: sanitizeProvenance(meta.provenance),
                            actions: sanitizeActions(meta.actions),
                            toolCalls: sanitizeToolCalls(meta.toolCalls),
                        });
                    },
                    onAction: (action) => {
                        if (action) setPendingAction(action as unknown as PendingAction);
                    },
                    onDone: (finalMessage) => {
                        const mapped = toChatMessage(finalMessage);
                        updateStream({ ...mapped, id: streamId, streaming: false });
                    },
                    onError: (err) => {
                        updateStream({
                            content: err.message || 'I could not reach the data service. Please try again.',
                            timestamp: nowHHMM(),
                            streaming: false,
                            error: 'stream_error',
                            actions: [
                                { id: 'retry', label: 'Retry', icon: RotateCcw, tone: 'primary', prompt: trimmed },
                            ],
                        });
                    },
                    signal: ctrl.signal,
                    context: streamContext,
                    attachments: useAttachments.map((a) => ({ name: a.name, size: a.size, type: a.type })),
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'I could not reach the data service. Please try again.';
                updateStream({
                    content: msg,
                    timestamp: nowHHMM(),
                    streaming: false,
                    error: 'network',
                    actions: [{ id: 'retry', label: 'Retry', icon: RotateCcw, tone: 'primary', prompt: trimmed }],
                });
            } finally {
                abortRef.current = null;
                setStreamingId(null);
                setIsThinking(false);
            }
        },
        [activeMessages, activeConversationId, attachments, context, ensureConversation, isThinking, readOnly, piiMasked],
    );

    const regenerate = useCallback((assistantMessageId: string) => {
        const list = activeMessages;
        const idx = list.findIndex((m) => m.id === assistantMessageId);
        if (idx <= 0) return;
        const userMsg = [...list.slice(0, idx)].reverse().find((m) => m.role === 'user');
        if (!userMsg) return;
        void sendMessage(userMsg.content, { regenerateFor: userMsg.id });
    }, [activeMessages, sendMessage]);

    const editMessage = useCallback((messageId: string) => {
        const msg = activeMessages.find((m) => m.id === messageId);
        if (!msg) return;
        setDraft(msg.content);
        setEditMessageId(messageId);
        composerRef.current?.focus();
    }, [activeMessages]);

    const sendFeedback = useCallback(async (messageId: string, value: 'up' | 'down') => {
        setActiveMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, feedback: value } : m));
        pushToast({ type: 'success', message: value === 'up' ? 'Thanks — noted' : 'Thanks — we will improve' });
        try {
            if (activeConversationId && /^\d+$/.test(activeConversationId)) {
                await adminApi.ai.assistant.messages.feedback(messageId, value);
            }
        } catch {}
    }, [activeConversationId, setActiveMessages, pushToast]);

    const handleDismissAlert = useCallback(async (id: string) => {
        setAlerts((prev) => prev.filter((a) => String(a.id) !== id));
        try { await adminApi.ai.alerts.dismiss(id); } catch {}
    }, []);

    const handleAcknowledgeAlert = useCallback(async (id: string) => {
        setAlerts((prev) => prev.map((a) => String(a.id) === id ? { ...a, acknowledgedAt: new Date().toISOString() } : a));
        try { await adminApi.ai.alerts.acknowledge(id); pushToast({ type: 'success', message: 'Alert acknowledged' }); } catch {}
    }, [pushToast]);

    const handleSnoozeAlert = useCallback(async (id: string, minutes: number) => {
        const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        setAlerts((prev) => prev.map((a) => String(a.id) === id ? { ...a, snoozedUntil: until } : a));
        try { await adminApi.ai.alerts.snooze(id, minutes); pushToast({ type: 'info', message: `Snoozed for ${minutes}m` }); } catch {}
    }, [pushToast]);

    const handleDismissInsight = useCallback(async (id: string) => {
        setInsights((prev) => prev.filter((i) => String(i.id) !== id));
        try { await adminApi.ai.insights.dismiss(id); } catch {}
    }, []);

    const handleExecuteInsight = useCallback(async (id: string, fallbackHref: string) => {
        try {
            const res = await adminApi.ai.insights.execute(id);
            navigate(res.redirect || fallbackHref);
        } catch {
            navigate(fallbackHref);
        }
    }, [navigate]);

    const confirmPendingAction = useCallback(async () => {
        if (!pendingAction) return;
        const action = pendingAction;
        setPendingAction(null);
        try {
            await adminApi.ai.actions.execute({ tool: action.tool, params: action.params, confirm: true });
            appendAudit({ actor: 'AI Copilot', action: action.tool, target: action.title, params: action.params, status: 'success' });
            pushToast({
                type: 'success',
                message: `${action.title} · done`,
                action: { label: 'Undo', onClick: () => pushToast({ type: 'info', message: 'Undo not yet available' }) },
            });
        } catch (err) {
            appendAudit({ actor: 'Store Assistant', action: action.tool, target: action.title, params: action.params, status: 'failed' });
            pushToast({ type: 'error', message: err instanceof Error ? err.message : 'Action failed' });
        }
    }, [pendingAction, appendAudit, pushToast]);

    const toggleAutomation = useCallback(async (id: string | number, nextActive: boolean) => {
        try {
            const res = await adminApi.ai.automations.setStatus(id, {
                status: nextActive ? 'Active' : 'Paused',
                is_enabled: nextActive,
            });
            setAutomations((prev) => prev.map((a) => a.id === res.id ? res : a));
            pushToast({ type: 'success', message: nextActive ? 'Automation activated' : 'Automation paused' });
        } catch (err) {
            pushToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not update automation' });
        }
    }, [pushToast]);

    const runAutomationNow = useCallback(async (id: string | number) => {
        try {
            const run = await adminApi.ai.automations.runNow(id, { confirm: true });
            pushToast({ type: 'success', message: `Run ${run.status}` });
            loadAutomations();
        } catch (err) {
            pushToast({ type: 'error', message: err instanceof Error ? err.message : 'Run failed' });
        }
    }, [pushToast, loadAutomations]);

    const clearChat = useCallback(async () => {
        if (!activeConversationId) return;
        abortRef.current?.abort();
        abortRef.current = null;
        try {
            if (/^\d+$/.test(activeConversationId)) {
                await adminApi.ai.assistant.conversations.remove(activeConversationId);
            }
        } catch {}
        setMessagesByConv((prev) => {
            const copy = { ...prev };
            delete copy[activeConversationId];
            return copy;
        });
        setConversations((prev) => prev.filter((c) => c.id !== activeConversationId));
        setActiveConversationId(null);
        pushToast({ type: 'success', message: 'Conversation cleared' });
    }, [activeConversationId, pushToast]);

    const switchConversation = useCallback((id: string) => {
        setActiveConversationId(id);
        setSidebarOpen(false);
    }, []);

    const deleteConversation = useCallback(async (id: string) => {
        try {
            if (/^\d+$/.test(id)) await adminApi.ai.assistant.conversations.remove(id);
        } catch {}
        setConversations((prev) => prev.filter((c) => c.id !== id));
        setMessagesByConv((prev) => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
        });
        if (activeConversationId === id) setActiveConversationId(null);
    }, [activeConversationId]);

    const renameConversation = useCallback(async (id: string, title: string) => {
        setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
        try {
            if (/^\d+$/.test(id)) await adminApi.ai.assistant.conversations.rename(id, title);
        } catch {}
    }, []);

    const togglePinConversation = useCallback((id: string) => {
        setConversations((prev) => prev.map((c) => c.id === id ? { ...c, pinned: !c.pinned } : c));
    }, []);

    const exportCurrentConversation = useCallback(() => {
        const md = buildExportMarkdown(activeMessages, context);
        const name = `ai-copilot-${(context.label || 'chat').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
        downloadFile(name, md);
        pushToast({ type: 'success', message: 'Conversation exported' });
    }, [activeMessages, context, pushToast]);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const list: Attachment[] = [];
        for (const file of Array.from(files)) {
            const item: Attachment = {
                id: uid('att'),
                name: file.name,
                size: file.size,
                type: file.type,
            };
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    setAttachments((prev) => prev.map((a) => a.id === item.id ? { ...a, preview: String(reader.result) } : a));
                };
                reader.readAsDataURL(file);
            }
            list.push(item);
        }
        setAttachments((prev) => [...prev, ...list]);
    }, []);

    const startListening = useCallback(() => {
        if (typeof window === 'undefined') return;
        const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
            || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
        if (!SR) { pushToast({ type: 'info', message: 'Voice input not supported in this browser' }); return; }
        const rec = new SR() as {
            lang: string; continuous: boolean; interimResults: boolean;
            onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            onerror: () => void; onend: () => void; start: () => void; stop: () => void; abort: () => void;
        };
        rec.lang = 'en-US';
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (e) => {
            const text = Array.from(e.results).map((r) => r[0].transcript).join(' ');
            setDraft((d) => (d ? d + ' ' + text : text));
        };
        rec.onerror = () => { setListening(false); };
        rec.onend = () => { setListening(false); };
        recognitionRef.current = rec;
        setListening(true);
        rec.start();
    }, [pushToast]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    const speakLast = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            pushToast({ type: 'info', message: 'Voice output not supported' });
            return;
        }
        if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
        const lastAssistant = [...activeMessages].reverse().find((m) => m.role === 'assistant' && m.content);
        if (!lastAssistant) return;
        const u = new SpeechSynthesisUtterance(lastAssistant.content);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(u);
    }, [activeMessages, speaking, pushToast]);

    const openNewChat = useCallback(() => { void createConversation(); setTab('chat'); }, [createConversation]);

    const isFullscreen = mode === 'fullscreen';
    const isDocked = mode === 'docked';

    const panelClasses = useMemo(() => {
        if (isFullscreen) {
            return 'fixed inset-0 z-[130] flex flex-col bg-white border-0 shadow-none overflow-hidden';
        }
        if (isDocked) {
            return 'fixed top-0 right-0 bottom-0 z-[130] w-full md:w-[520px] flex flex-col bg-white border-l border-slate-200 shadow-2xl overflow-hidden';
        }
        if (mode === 'minimized') return 'hidden';
        return 'fixed z-[130] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col bg-white border border-slate-200 rounded-sm shadow-2xl overflow-hidden w-[calc(100vw-0.75rem)] h-[calc(100vh-0.75rem)] md:w-[95vw] md:h-[80vh] md:min-h-[620px] md:max-w-[1360px] md:max-h-[860px]';
    }, [isFullscreen, isDocked, mode]);

    const allPrompts = context.pack?.prompts ?? GENERAL_PROMPTS;
    const filteredPrompts = query
        ? allPrompts.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()) || p.prompt.toLowerCase().includes(query.toLowerCase()))
        : allPrompts;

    return (
        <>
            <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

            <FloatingButton
                open={open}
                badge={alertBadge}
                mode={mode}
                onClick={() => {
                    if (mode === 'minimized') { setMode('floating'); setOpen(true); return; }
                    setOpen((v) => !v);
                }}
            />

            {mode === 'minimized' && open && (
                <MinimizedPill
                    onRestore={() => setMode('floating')}
                    onClose={() => { setMode('floating'); setOpen(false); }}
                    messages={activeMessages}
                    context={context}
                />
            )}

            {open && mode !== 'minimized' && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal={isFullscreen || isDocked}
                    aria-label="AI Copilot"
                    className={panelClasses}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                    <div className={isDark ? 'dark flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100' : 'flex-1 min-h-0 flex flex-col bg-white'}>
                        <PanelHeader
                            context={context}
                            tab={tab}
                            onTab={setTab}
                            alertCount={alertBadge}
                            mode={mode}
                            onMode={setMode}
                            theme={theme}
                            onTheme={setTheme}
                            onClose={() => setOpen(false)}
                            onClear={clearChat}
                            onExport={exportCurrentConversation}
                            onToggleSidebar={() => setSidebarOpen((v) => !v)}
                            onOpenSettings={() => setSettingsOpen(true)}
                            onNewChat={openNewChat}
                            sidebarOpen={sidebarOpen}
                        />

                        <div className="flex-1 min-h-0 flex flex-col relative">
                            {sidebarOpen && (
                                <ConversationSidebar
                                    conversations={conversations}
                                    activeId={activeConversationId}
                                    onSelect={switchConversation}
                                    onNew={openNewChat}
                                    onDelete={deleteConversation}
                                    onRename={renameConversation}
                                    onPin={togglePinConversation}
                                    onClose={() => setSidebarOpen(false)}
                                />
                            )}

                            <div className="flex-1 min-h-0 flex flex-col">
                                {tab === 'chat' && (
                                    <ChatView
                                        messages={activeMessages}
                                        streamingId={streamingId}
                                        isThinking={isThinking}
                                        messagesEndRef={messagesEndRef}
                                        onQuickReply={(t) => void sendMessage(t)}
                                        onNavigate={navigate}
                                        onFeedback={sendFeedback}
                                        onRegenerate={regenerate}
                                        onEdit={editMessage}
                                        onStop={stopStreaming}
                                        onRetry={(prompt) => void sendMessage(prompt)}
                                        prompts={filteredPrompts}
                                        query={query}
                                        onQueryChange={setQuery}
                                        context={context}
                                        digest={tab === 'chat' && activeMessages.length === 0 ? buildDigest(alerts, insights) : []}
                                        disabled={isThinking}
                                        readOnly={readOnly}
                                    />
                                )}
                                {tab === 'alerts' && (
                                    <AlertsView
                                        alerts={alerts}
                                        onDismiss={handleDismissAlert}
                                        onAcknowledge={handleAcknowledgeAlert}
                                        onSnooze={handleSnoozeAlert}
                                        onNavigate={navigate}
                                        onRefresh={() => loadAlerts()}
                                    />
                                )}
                                {tab === 'insights' && (
                                    <InsightsView
                                        insights={insights}
                                        onDismiss={handleDismissInsight}
                                        onNavigate={handleExecuteInsight}
                                        onRefresh={() => loadInsights()}
                                    />
                                )}
                                {tab === 'actions' && (
                                    <ActionsView
                                        actions={QUICK_ACTIONS}
                                        onRun={(action) => {
                                            if (action.href) navigate(action.href);
                                            else if (action.prompt) { setTab('chat'); void sendMessage(action.prompt); }
                                        }}
                                    />
                                )}
                                {tab === 'automations' && (
                                    <AutomationsView
                                        automations={automations}
                                        loading={automationsLoading}
                                        onToggle={toggleAutomation}
                                        onRun={runAutomationNow}
                                        onRefresh={() => loadAutomations()}
                                    />
                                )}
                            </div>

                            {tab === 'chat' && (
                                <Composer
                                    ref={composerRef}
                                    value={draft}
                                    onChange={setDraft}
                                    onSend={() => {
                                        if (editMessageId) {
                                            void sendMessage(draft, { regenerateFor: editMessageId });
                                        } else {
                                            void sendMessage(draft);
                                        }
                                    }}
                                    onStop={stopStreaming}
                                    disabled={isThinking}
                                    streaming={!!streamingId}
                                    attachments={attachments}
                                    onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
                                    onAttach={() => fileRef.current?.click()}
                                    listening={listening}
                                    onMicToggle={() => listening ? stopListening() : startListening()}
                                    speaking={speaking}
                                    onSpeakToggle={speakLast}
                                    slashOpen={slashOpen}
                                    onSlashChange={setSlashOpen}
                                    editMessageId={editMessageId}
                                    onCancelEdit={() => { setEditMessageId(null); setDraft(''); }}
                                    context={context}
                                />
                            )}

                            <input
                                ref={fileRef}
                                type="file"
                                multiple
                                className="hidden"
                                accept=".csv,.txt,.json,.md,image/*"
                                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                            />
                        </div>

                        <PanelFooter context={context} readOnly={readOnly} piiMasked={piiMasked} />
                    </div>
                </div>
            )}

            {pendingAction && (
                <ConfirmDialog
                    action={pendingAction}
                    onConfirm={confirmPendingAction}
                    onCancel={() => { setPendingAction(null); appendAudit({ actor: 'AI Copilot', action: pendingAction.tool, target: pendingAction.title, params: pendingAction.params, status: 'cancelled' }); }}
                />
            )}

            {settingsOpen && (
                <SettingsDrawer
                    onClose={() => setSettingsOpen(false)}
                    theme={theme}
                    onTheme={setTheme}
                    readOnly={readOnly}
                    onReadOnly={setReadOnly}
                    piiMasked={piiMasked}
                    onPiiMasked={setPiiMasked}
                    auditEntries={auditEntries}
                    onClearAudit={() => { setAuditEntries([]); saveAudit([]); pushToast({ type: 'success', message: 'Audit log cleared' }); }}
                    context={context}
                />
            )}
        </>
    );
}

function buildDigest(alerts: AdminAIAlert[], insights: AdminAIInsight[]): DigestItem[] {
    const high = alerts.filter((a) => a.severity === 'high' && !a.acknowledgedAt).length;
    const medium = alerts.filter((a) => a.severity === 'medium' && !a.acknowledgedAt).length;
    const newInsights = insights.length;
    return [
        { label: 'Critical alerts', value: String(high), tone: high > 0 ? 'rose' : 'slate', href: '#alerts' },
        { label: 'Warnings', value: String(medium), tone: medium > 0 ? 'amber' : 'slate', href: '#alerts' },
        { label: 'New insights', value: String(newInsights), tone: newInsights > 0 ? 'violet' : 'slate', href: '#insights' },
    ];
}

export function useCopilot() {
    const [open, setOpen] = useState(false);
    return { open, setOpen, toggle: () => setOpen((v) => !v) };
}

export function AskAIButton({ prompt, className, children }: { prompt: string; className?: string; children?: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={() => { window.dispatchEvent(new CustomEvent('ai-copilot:ask', { detail: { prompt } })); }}
            className={className ?? 'inline-flex items-center gap-1 text-[12px] text-blue-700 hover:underline'}
        >
            <Sparkles className="w-3.5 h-3.5" />
            {children ?? 'Ask AI'}
        </button>
    );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    return (
        <div className="fixed bottom-20 right-4 z-[200] flex flex-col gap-2 max-w-[320px]">
            {toasts.map((t) => {
                const tone = t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-rose-600' : 'bg-slate-900';
                return (
                    <div key={t.id} className={`${tone} text-white px-3 py-2 rounded-full shadow-xl flex items-start gap-2 text-[13px] animate-in fade-in slide-in-from-bottom-2`}>
                        {t.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : t.type === 'error' ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                        <span className="flex-1">{t.message}</span>
                        {t.action && (
                            <button onClick={t.action.onClick} className="ml-1 underline text-white/90 hover:text-white text-[13px] shrink-0">
                                {t.action.label}
                            </button>
                        )}
                        <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="ml-1 opacity-70 hover:opacity-100 shrink-0">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function FloatingButton({ open, badge, mode, onClick }: { open: boolean; badge: number; mode: PanelMode; onClick: () => void }) {
    const isMinimized = mode === 'minimized';
    return (
        <button
            onClick={onClick}
            aria-label={open ? 'Close AI Copilot' : 'Open AI Copilot'}
            aria-expanded={open}
            className={`fixed bottom-4 right-4 z-[135] h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition ${open && !isMinimized ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-blue-950 hover:bg-blue-900 text-white'}`}
        >
            {open && !isMinimized ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            {!open && badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-rose-500 text-white text-[12px] font-semibold flex items-center justify-center px-1 border-2 border-white">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
}

function MinimizedPill({ onRestore, onClose, messages, context }: { onRestore: () => void; onClose: () => void; messages: ChatMessage[]; context: PageContext }) {
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.content);
    return (
        <div className="fixed bottom-20 right-4 z-[135] w-[300px] bg-white border border-slate-200 rounded-sm shadow-2xl p-2 flex items-start gap-2">
            <span className="w-8 h-8 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
            </span>
            <button onClick={onRestore} className="flex-1 text-left min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-900 truncate">{context.label} · AI</p>
                <p className="text-[12px] text-slate-500 line-clamp-2 leading-snug">{last?.content ?? 'Tap to resume conversation'}</p>
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

function PanelHeader({
    context, tab, onTab, alertCount, mode, onMode, theme, onTheme, onClose, onClear,
    onExport, onToggleSidebar, onOpenSettings, onNewChat, sidebarOpen,
}: {
    context: PageContext;
    tab: CopilotTab;
    onTab: (t: CopilotTab) => void;
    alertCount: number;
    mode: PanelMode;
    onMode: (m: PanelMode) => void;
    theme: Theme;
    onTheme: (t: Theme) => void;
    onClose: () => void;
    onClear: () => void;
    onExport: () => void;
    onToggleSidebar: () => void;
    onOpenSettings: () => void;
    onNewChat: () => void;
    sidebarOpen: boolean;
}) {
    const tabs: Array<{ id: CopilotTab; label: string; icon: IconComponent; badge?: number }> = [
        { id: 'chat', label: 'Chat', icon: MessageSquare },
        { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount },
        { id: 'insights', label: 'Insights', icon: Lightbulb },
        { id: 'automations', label: 'Automations', icon: Workflow },
        { id: 'actions', label: 'Actions', icon: Zap },
    ];

    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="border-b border-slate-200 bg-white shrink-0">
            <div className="px-2 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <button
                        onClick={onToggleSidebar}
                        aria-label="Toggle conversations"
                        className={`p-1.5 rounded-sm hover:bg-slate-100 ${sidebarOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <PanelLeft className="w-4 h-4" />
                    </button>
                    <span className="w-8 h-8 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-slate-900 truncate">Store Assistant</h2>
                        <p className="text-[13px] text-slate-500 truncate">{context.label}</p>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={onNewChat} aria-label="New chat" title="New chat (⌘N)" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={onExport} aria-label="Export" title="Export conversation" className="hidden sm:inline-flex p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                        <Download className="w-4 h-4" />
                    </button>
                    
                    <div className="relative">
                        <button onClick={() => setMenuOpen((v) => !v)} aria-label="Layout" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                            <LayoutDashboard className="w-4 h-4" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-sm shadow-xl py-1 z-10">
                                <button onClick={() => { onMode('floating'); setMenuOpen(false); }} className="w-full text-left px-2 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2"><Maximize2 className="w-3.5 h-3.5" /> Floating</button>
                                <button onClick={() => { onMode('docked'); setMenuOpen(false); }} className="w-full text-left px-2 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2"><PanelRight className="w-3.5 h-3.5" /> Docked</button>
                                <button onClick={() => { onMode('fullscreen'); setMenuOpen(false); }} className="w-full text-left px-2 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2"><Maximize2 className="w-3.5 h-3.5" /> Fullscreen</button>
                                <button onClick={() => { onMode('minimized'); setMenuOpen(false); }} className="w-full text-left px-2 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2"><Minimize className="w-3.5 h-3.5" /> Minimise</button>
                            </div>
                        )}
                    </div>
                    <button onClick={onOpenSettings} aria-label="Settings" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                        <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={onClear} aria-label="Clear conversation" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800">
                        <IoCloseSharp className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <nav role="tablist" aria-label="Copilot sections" className="px-2 pb-2 flex items-center gap-1 overflow-x-auto">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={active}
                            onClick={() => onTab(t.id)}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-[13px] font-medium transition whitespace-nowrap ${active ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                            {t.badge ? (
                                <span className={`ml-0.5 min-w-[18px] h-[18px] rounded-sm text-[12px] font-semibold flex items-center justify-center px-1 ${active ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'}`}>
                                    {t.badge > 9 ? '9+' : t.badge}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </nav>
        </header>
    );
}

function ConversationSidebar({
    conversations, activeId, onSelect, onNew, onDelete, onRename, onPin, onClose,
}: {
    conversations: ConversationSummary[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onPin: (id: string) => void;
    onClose: () => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    const sorted = [...conversations].sort((a, b) => {
        if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return (
        <div className="absolute inset-y-0 left-0 z-20 w-[260px] bg-white border-r border-slate-200 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-2 py-2 border-b border-slate-200">
                <p className="text-[13px] font-semibold text-slate-900">Conversations</p>
                <div className="flex items-center gap-1">
                    <button onClick={onNew} aria-label="New conversation" className="p-1 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800"><Plus className="w-4 h-4" /></button>
                    <button onClick={onClose} aria-label="Close sidebar" className="p-1 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800"><X className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                {sorted.length === 0 && (
                    <p className="text-[12px] text-slate-400 px-2 py-4 text-center">No conversations yet</p>
                )}
                {sorted.map((c) => (
                    <div key={c.id} className={`group rounded-sm border ${activeId === c.id ? 'bg-blue-50 border-blue-100' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-1 px-2 py-1.5">
                            <button onClick={() => onSelect(c.id)} className="flex-1 text-left min-w-0">
                                {editingId === c.id ? (
                                    <input
                                        autoFocus
                                        value={titleDraft}
                                        onChange={(e) => setTitleDraft(e.target.value)}
                                        onBlur={() => { onRename(c.id, titleDraft.trim() || c.title); setEditingId(null); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { onRename(c.id, titleDraft.trim() || c.title); setEditingId(null); }
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        className="w-full bg-white border border-blue-200 rounded-sm px-1 py-0.5 text-[12.5px]"
                                    />
                                ) : (
                                    <p className="text-[12.5px] font-medium text-slate-900 truncate">{c.title}</p>
                                )}
                                <p className="text-[11px] text-slate-400 truncate">{c.messageCount} msgs · {new Date(c.updatedAt).toLocaleDateString()}</p>
                            </button>
                            <button onClick={() => onPin(c.id)} aria-label="Pin" className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700">
                                {c.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                            </button>
                            <button onClick={() => { setEditingId(c.id); setTitleDraft(c.title); }} aria-label="Rename" className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700">
                                <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDelete(c.id)} aria-label="Delete" className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ChatView({
    messages, streamingId, isThinking, messagesEndRef, onQuickReply, onNavigate, onFeedback,
    onRegenerate, onEdit, onStop, onRetry, prompts, query, onQueryChange, context, digest, disabled, readOnly,
}: {
    messages: ChatMessage[];
    streamingId: string | null;
    isThinking: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onQuickReply: (t: string) => void;
    onNavigate: (href: string) => void;
    onFeedback: (id: string, v: 'up' | 'down') => void;
    onRegenerate: (id: string) => void;
    onEdit: (id: string) => void;
    onStop: () => void;
    onRetry: (prompt: string) => void;
    prompts: RoutePrompt[];
    query: string;
    onQueryChange: (v: string) => void;
    context: PageContext;
    digest: DigestItem[];
    disabled: boolean;
    readOnly: boolean;
}) {
    const empty = messages.length === 0;
    const hasStreaming = messages.some((m) => m.streaming);

    return (
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-2">
                {empty && !isThinking && (
                    <div className="h-full flex flex-col min-h-0">
                        <div className="flex flex-col items-center justify-center gap-2 py-4 shrink-0">
                            <span className="w-12 h-12 rounded-sm bg-blue-950 text-white flex items-center justify-center">
                                <Sparkles className="w-5 h-5" />
                            </span>
                            <p className="text-[15px] font-semibold text-slate-800 text-center">Ask anything about {context.label}</p>
                            <p className="text-[12.5px] text-slate-500 text-center max-w-[320px]">
                                I can see <b>{context.label}</b> and every other admin module. Choose a suggestion, search, or type below.
                            </p>
                            <div className="relative w-full max-w-[360px]">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(e) => onQueryChange(e.target.value)}
                                    placeholder="Search suggestions…"
                                    className="w-full bg-white border border-slate-200 rounded-sm pl-7 pr-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                            </div>
                        </div>

                        {digest.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5 mb-2">
                                {digest.map((d) => (
                                    <button
                                        key={d.label}
                                        onClick={() => onQuickReply(`Show me ${d.label.toLowerCase()}`)}
                                        className={`text-left rounded-sm border p-2 ${TONE_CLASSES[d.tone].chip}`}
                                    >
                                        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{d.label}</p>
                                        <p className="text-[18px] font-bold leading-tight">{d.value}</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 gap-1.5 content-start pb-1">
                            {prompts.length === 0 && (
                                <p className="col-span-full text-center text-[12.5px] text-slate-400 py-4">No suggestions match &quot;{query}&quot;</p>
                            )}
                            {prompts.map((item) => {
                                const Icon = isIconComponent(item.icon) ? item.icon : Sparkles;
                                return (
                                    <button
                                        key={item.label}
                                        onClick={() => onQuickReply(item.prompt)}
                                        disabled={disabled}
                                        className="text-left bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-sm p-2 transition group disabled:opacity-50 flex flex-col gap-1.5 min-h-[72px]"
                                    >
                                        <span className={`w-7 h-7 rounded-sm flex items-center justify-center border shrink-0 ${TONE_CLASSES[item.tone].chip}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="text-[12px] font-semibold text-slate-800 leading-tight line-clamp-2">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {readOnly && (
                            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-sm px-2 py-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                Read-only mode is on. AI actions will not execute.
                            </div>
                        )}
                    </div>
                )}

                {messages.map((m) => (
                    <MessageBubble
                        key={m.id}
                        message={m}
                        streaming={streamingId === m.id}
                        onQuickReply={onQuickReply}
                        onNavigate={onNavigate}
                        onFeedback={onFeedback}
                        onRegenerate={onRegenerate}
                        onEdit={onEdit}
                        onStop={onStop}
                        onRetry={onRetry}
                        disabled={disabled}
                    />
                ))}

                {isThinking && !hasStreaming && (
                    <div className="flex justify-start">
                        <TypingCard label={`Analyzing ${context.label}…`} />
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}

function TypingDots() {
    return (
        <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
        </span>
    );
}

function TypingCard({ label }: { label?: string }) {
    return (
        <div role="status" aria-live="polite" className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg rounded-tl-none px-2.5 py-2 shadow-sm">
            <span className="w-6 h-6 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
            </span>
            <TypingDots />
            {label && <span className="text-[12.5px] text-slate-500 font-medium">{label}</span>}
        </div>
    );
}

function MessageBubble({
    message, streaming, onQuickReply, onNavigate, onFeedback, onRegenerate, onEdit, onStop, onRetry, disabled,
}: {
    message: ChatMessage;
    streaming: boolean;
    onQuickReply: (t: string) => void;
    onNavigate: (href: string) => void;
    onFeedback: (id: string, v: 'up' | 'down') => void;
    onRegenerate: (id: string) => void;
    onEdit: (id: string) => void;
    onStop: () => void;
    onRetry: (prompt: string) => void;
    disabled: boolean;
}) {
    const isUser = message.role === 'user';
    const showTypingCard = !isUser && streaming && !message.content;
    const [provenanceOpen, setProvenanceOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    if (showTypingCard) {
        return (
            <div className="flex justify-start">
                <TypingCard />
            </div>
        );
    }

    const copy = () => {
        navigator.clipboard?.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    const cornerClasses = isUser ? 'rounded-lg rounded-tr-none' : 'rounded-lg rounded-tl-none';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[88%]">
                <div className={`${cornerClasses} px-3 py-2 text-[13.5px] ${isUser ? 'bg-blue-950 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {message.attachments.map((a) => (
                                <span key={a.id} className={`inline-flex items-center gap-1 text-[11.5px] px-1.5 py-0.5 rounded-sm border ${isUser ? 'border-blue-800 bg-blue-900 text-blue-100' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                    {a.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                    {a.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {message.content && (
                        <div className="whitespace-pre-wrap leading-relaxed">
                            {isUser ? message.content : renderMarkdown(message.content)}
                            {streaming && <span className="inline-block w-1 h-3.5 bg-slate-400 ml-0.5 align-middle animate-pulse" />}
                        </div>
                    )}

                    {streaming && (
                        <div className="mt-2 flex justify-start">
                            <button onClick={onStop} className="inline-flex items-center gap-1 text-[11.5px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-sm transition">
                                <Square className="w-3 h-3" />
                                Stop
                            </button>
                        </div>
                    )}

                    {message.chart && !streaming && <ChartBlock spec={message.chart} />}
                    {message.table && !streaming && <TableBlock table={message.table} />}

                    {message.toolCalls && message.toolCalls.length > 0 && !streaming && (
                        <div className="mt-2 space-y-1">
                            {message.toolCalls.map((tc) => (
                                <div key={tc.id} className={`flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-sm border ${tc.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : tc.status === 'error' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-blue-50 text-blue-950 border-blue-100'}`}>
                                    {tc.status === 'done' ? <CheckCircle2 className="w-3 h-3" /> : tc.status === 'error' ? <XCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                                    <span className="font-mono">{tc.name}</span>
                                    {tc.resultSummary && <span className="opacity-75 truncate">· {tc.resultSummary}</span>}
                                    {tc.durationMs != null && <span className="ml-auto opacity-60">{tc.durationMs}ms</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isUser && !streaming && message.isVerified === false && message.missingData && message.missingData.length > 0 && (
                        <div className="mt-2 flex items-start gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-sm px-2 py-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>Some data could not be resolved: {message.missingData.join('; ')}</span>
                        </div>
                    )}

                    {message.provenance && message.provenance.length > 0 && !streaming && (
                        <div className="mt-2">
                            <button onClick={() => setProvenanceOpen((v) => !v)} className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-slate-800 transition-colors">
                                <Database className="w-3 h-3" />
                                Based on {message.provenance.length} source{message.provenance.length === 1 ? '' : 's'}
                                <ChevronDown className={`w-3 h-3 transition ${provenanceOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {provenanceOpen && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {message.provenance.map((p, i) => (
                                        <button key={i} onClick={() => p.href && onNavigate(p.href)} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                                            <Database className="w-2.5 h-2.5" />
                                            {p.label}
                                            {p.count != null && <span className="opacity-60">({p.count})</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {message.link && !streaming && (
                        <button onClick={() => onNavigate(message.link!.href)} className={`mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline transition-colors ${isUser ? 'text-blue-100' : 'text-blue-950'}`}>
                            <ArrowRight className="w-3.5 h-3.5" />
                            {message.link.label}
                        </button>
                    )}

                    {message.actions && message.actions.length > 0 && !streaming && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {message.actions.map((a) => {
                                const Icon: IconComponent = isIconComponent(a.icon) ? a.icon : Zap;
                                const tone = a.tone === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-200' : a.tone === 'primary' ? 'bg-blue-950 text-white border-blue-950 hover:bg-blue-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300';
                                return (
                                    <button
                                        key={a.id}
                                        onClick={() => {
                                            if (a.href) onNavigate(a.href);
                                            else if (a.prompt) onRetry(a.prompt);
                                        }}
                                        className={`inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-1 rounded-sm border transition ${tone}`}
                                    >
                                        <Icon className="w-3 h-3" />
                                        {a.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {!isUser && !streaming && message.quickReplies && message.quickReplies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {message.quickReplies.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => onQuickReply(q)}
                                    disabled={disabled}
                                    className="text-[11.5px] font-medium bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-950 px-2 py-1 rounded-sm transition disabled:opacity-50"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={`mt-1.5 flex items-center justify-between gap-2 ${isUser ? 'text-blue-200' : 'text-slate-400'}`}>
                        <span className="text-[10.5px] font-mono">{message.timestamp}</span>
                        <div className="flex items-center gap-0.5">
                            {isUser && !streaming && (
                                <button onClick={() => onEdit(message.id)} aria-label="Edit" className="p-1 rounded-sm hover:bg-white/10 text-current">
                                    <Edit3 className="w-3 h-3" />
                                </button>
                            )}
                            {!isUser && !streaming && message.content && (
                                <>
                                    <button onClick={copy} aria-label="Copy" className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    <button onClick={() => onRegenerate(message.id)} aria-label="Regenerate" className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                        <RotateCcw className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => onFeedback(message.id, 'up')} aria-label="Helpful" className={`p-1 rounded-sm hover:bg-slate-100 transition-colors ${message.feedback === 'up' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                        <ThumbsUp className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => onFeedback(message.id, 'down')} aria-label="Not helpful" className={`p-1 rounded-sm hover:bg-slate-100 transition-colors ${message.feedback === 'down' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                        <ThumbsDown className="w-3 h-3" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChartBlock({ spec }: { spec: AdminAIChartSpec }) {
    const type = spec.type as string;

    if (type === 'pie' || type === 'doughnut') {
        return (
            <div className="mt-2 rounded-sm border border-slate-200 bg-slate-50 p-2">
                <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={spec.data} cx="50%" cy="50%" innerRadius={type === 'doughnut' ? 40 : 0} outerRadius={70} paddingAngle={type === 'doughnut' ? 3 : 0} dataKey="value" label={(entry: { name?: string }) => `${entry.name ?? ''}`} labelLine={false}>
                                {spec.data.map((entry, i) => (
                                    <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    if (type === 'area') {
        return (
            <div className="mt-2 rounded-sm border border-slate-200 bg-slate-50 p-2">
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={spec.data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                            <defs>
                                {spec.series.map((s, i) => (
                                    <linearGradient key={s.key} id={`copilot-grad-${i}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={s.color} stopOpacity={0.45} />
                                        <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey={spec.xKey} stroke="#94a3b8" fontSize={11} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                            {spec.series.map((s, i) => (
                                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#copilot-grad-${i}-${s.key})`} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    const Chart = type === 'line' ? LineChart : BarChart;

    return (
        <div className="mt-1 rounded-sm border border-slate-200 bg-slate-50 p-2">
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <Chart data={spec.data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey={spec.xKey} stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {spec.series.map((s) =>
                            type === 'line' ? (
                                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} />
                            ) : (
                                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[2, 2, 0, 0]} />
                            ),
                        )}
                    </Chart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function TableBlock({ table }: { table: { headers: string[]; rows: string[][] } }) {
    return (
        <div className="mt-1 border border-slate-200 rounded-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-[12px]">
                <thead>
                    <tr className="bg-slate-50 text-slate-500">
                        {table.headers.map((h) => (
                            <th key={h} className="text-left py-1.5 px-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {table.rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j} className="py-1.5 px-2 text-slate-700 whitespace-nowrap">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const Composer = React.forwardRef<HTMLTextAreaElement, {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onStop: () => void;
    disabled: boolean;
    streaming: boolean;
    attachments: Attachment[];
    onRemoveAttachment: (id: string) => void;
    onAttach: () => void;
    listening: boolean;
    onMicToggle: () => void;
    speaking: boolean;
    onSpeakToggle: () => void;
    slashOpen: boolean;
    onSlashChange: (v: boolean) => void;
    editMessageId: string | null;
    onCancelEdit: () => void;
    context: PageContext;
}>(function Composer({
    value, onChange, onSend, onStop, disabled, streaming, attachments, onRemoveAttachment, onAttach,
    listening, onMicToggle, speaking, onSpeakToggle, slashOpen, onSlashChange, editMessageId, onCancelEdit, context,
}, ref) {
    const canSend = !!value.trim() && !disabled;
    const slashCommands = [
        { cmd: '/orders', hint: 'Search orders' },
        { cmd: '/products', hint: 'Search products' },
        { cmd: '/refund', hint: 'Start a refund' },
        { cmd: '/broadcast', hint: 'Draft WhatsApp broadcast' },
        { cmd: '/digest', hint: 'Daily digest' },
        { cmd: '/report', hint: 'Build a report' },
        { cmd: '/forecast', hint: 'Forecast sales' },
        { cmd: '/automation', hint: 'Run an automation' },
    ];
    const showSlash = slashOpen || value.startsWith('/');

    return (
        <div className="border-t border-slate-200 bg-white p-2 shrink-0">
            {editMessageId && (
                <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-sm px-2 py-1">
                    <Edit3 className="w-3 h-3" />
                    Editing message — send to regenerate from here
                    <button onClick={onCancelEdit} className="ml-auto text-amber-700 hover:text-amber-900 transition-colors">Cancel</button>
                </div>
            )}

            {showSlash && (
                <div className="mb-1.5 bg-white border border-slate-200 rounded-sm shadow-md max-h-[180px] overflow-y-auto">
                    {slashCommands
                        .filter((s) => s.cmd.startsWith(value.split(' ')[0]) || value.startsWith('/'))
                        .map((s) => (
                            <button
                                key={s.cmd}
                                onClick={() => { onChange(s.cmd + ' '); onSlashChange(false); (ref as React.RefObject<HTMLTextAreaElement>).current?.focus(); }}
                                className="w-full text-left px-2 py-1 text-[12px] hover:bg-slate-50 flex items-center gap-2"
                            >
                                <Command className="w-3 h-3 text-slate-400" />
                                <span className="font-mono text-slate-900">{s.cmd}</span>
                                <span className="text-slate-400 ml-auto">{s.hint}</span>
                            </button>
                        ))}
                </div>
            )}

            {attachments.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                    {attachments.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 rounded-sm px-1.5 py-0.5">
                            {a.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                            <span className="max-w-[120px] truncate">{a.name}</span>
                            <span className="text-slate-400">{formatBytes(a.size)}</span>
                            <button onClick={() => onRemoveAttachment(a.id)} className="text-slate-400 hover:text-rose-600 transition-colors"><X className="w-2.5 h-2.5" /></button>
                        </span>
                    ))}
                </div>
            )}

            <div className="relative">
                <textarea
                    ref={ref}
                    rows={2}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        onSlashChange(e.target.value.startsWith('/'));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (canSend) onSend();
                        }
                    }}
                    placeholder={`Ask about ${context.label}… (⌘J to toggle)`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-3 pr-20 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-200 focus:bg-white focus:border-blue-200 min-h-[68px] max-h-40"
                />
                <div className="absolute bottom-1.5 right-1 flex items-center gap-0.5">
                    <button onClick={onAttach} aria-label="Attach file" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                        <Paperclip className="w-4 h-4" />
                    </button>
                    <button onClick={onMicToggle} aria-label={listening ? 'Stop dictation' : 'Voice input'} className={`p-1.5 rounded-sm hover:bg-slate-100 transition-colors ${listening ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'}`}>
                        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button onClick={onSpeakToggle} aria-label={speaking ? 'Stop speaking' : 'Read last reply'} className={`p-1.5 rounded-sm hover:bg-slate-100 transition-colors ${speaking ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                        {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    {streaming ? (
                        <button onClick={onStop} aria-label="Stop" className="p-1.5 rounded-sm bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                            <Square className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={onSend} disabled={!canSend} aria-label="Send" className="p-1.5 rounded-sm disabled:opacity-40 text-blue-700 hover:bg-blue-50 transition-colors">
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <p className="mt-1 text-[10.5px] text-slate-400 flex items-center justify-between">
                <span className="inline-flex items-center gap-1"><Command className="w-2.5 h-2.5" />↵ to send · Shift+↵ newline · / for commands</span>
                <span className="hidden sm:inline">{value.length} chars</span>
            </p>
        </div>
    );
});

function AlertsView({
    alerts, onDismiss, onAcknowledge, onSnooze, onNavigate, onRefresh,
}: {
    alerts: AdminAIAlert[];
    onDismiss: (id: string) => void;
    onAcknowledge: (id: string) => void;
    onSnooze: (id: string, minutes: number) => void;
    onNavigate: (href: string) => void;
    onRefresh: () => void;
}) {
    if (alerts.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-[13px]">All caught up.</p>
                <button onClick={onRefresh} className="text-[12px] text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" />Refresh</button>
            </div>
        );
    }

    const groups: Array<{ key: AdminAIAlertSeverity; label: string }> = [
        { key: 'high', label: 'Needs attention now' },
        { key: 'medium', label: 'Soon' },
        { key: 'low', label: 'FYI' },
    ];

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50 p-2 space-y-2">
            <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Live alerts</p>
                <button onClick={onRefresh} className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" />Refresh</button>
            </div>
            {groups.map((g) => {
                const list = alerts.filter((a) => a.severity === g.key);
                if (list.length === 0) return null;
                return (
                    <div key={g.key} className="space-y-1.5">
                        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label} · {list.length}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {list.map((a) => (
                                <AlertCard
                                    key={String(a.id)}
                                    alert={a}
                                    onDismiss={() => onDismiss(String(a.id))}
                                    onAcknowledge={() => onAcknowledge(String(a.id))}
                                    onSnooze={(m) => onSnooze(String(a.id), m)}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AlertCard({ alert, onDismiss, onAcknowledge, onSnooze, onNavigate }: {
    alert: AdminAIAlert;
    onDismiss: () => void;
    onAcknowledge: () => void;
    onSnooze: (minutes: number) => void;
    onNavigate: (href: string) => void;
}) {
    const [snoozeOpen, setSnoozeOpen] = useState(false);

    const tone = alert.severity === 'high'
        ? { chip: 'bg-rose-50 text-rose-700 border-rose-100', icon: AlertTriangle as IconComponent }
        : alert.severity === 'medium'
            ? { chip: 'bg-amber-50 text-amber-700 border-amber-100', icon: Bell as IconComponent }
            : { chip: 'bg-slate-100 text-slate-600 border-slate-200', icon: Info as IconComponent };
    const Icon = tone.icon;

    const isSnoozed = alert.snoozedUntil && new Date(alert.snoozedUntil) > new Date();
    const isAcknowledged = !!alert.acknowledgedAt;

    return (
        <div className={`bg-white border rounded-sm p-2 space-y-1.5 ${isAcknowledged ? 'opacity-70' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-start gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 border ${tone.chip}`}>
                        <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 leading-tight">{alert.title}</p>
                        <p className="text-[12px] text-slate-500 mt-1 leading-snug">{alert.description}</p>
                        {isSnoozed && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                                <Clock className="w-3 h-3" />
                                Snoozed until {new Date(alert.snoozedUntil!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {isAcknowledged && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />Acknowledged
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={onDismiss} aria-label="Dismiss alert" className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0 transition-colors">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {snoozeOpen && (
                <div className="flex items-center gap-1 pt-1">
                    {SNOOZE_OPTIONS.map((opt) => (
                        <button key={opt.label} onClick={() => { onSnooze(opt.minutes); setSnoozeOpen(false); }} className="text-[11px] font-medium bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-950 px-2 py-1 rounded-sm transition">
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono text-slate-400">{alert.timestamp}</span>
                    {!isAcknowledged && (
                        <button onClick={onAcknowledge} className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors">Acknowledge</button>
                    )}
                    {!isSnoozed && !snoozeOpen && (
                        <button onClick={() => setSnoozeOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
                            <Clock className="w-3 h-3" />Snooze
                        </button>
                    )}
                </div>
                <button onClick={() => onNavigate(alert.href)} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-950 hover:underline transition-colors">
                    {alert.actionLabel}
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

function InsightsView({ insights, onDismiss, onNavigate, onRefresh }: {
    insights: AdminAIInsight[];
    onDismiss: (id: string) => void;
    onNavigate: (id: string, fallbackHref: string) => void;
    onRefresh: () => void;
}) {
    if (insights.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50">
                <Lightbulb className="w-8 h-8" />
                <p className="text-[13px]">No new insights right now.</p>
                <button onClick={onRefresh} className="text-[12px] text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" />Refresh</button>
            </div>
        );
    }

    const categoryIcon: Record<string, IconComponent> = {
        sales: TrendingUp,
        inventory: Package,
        customer: Users,
        channel: BarChart3,
    };

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50 p-2">
            <div className="flex items-center justify-between px-1 mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Insights</p>
                <button onClick={onRefresh} className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" />Refresh</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {insights.map((ins) => {
                    const Icon = categoryIcon[ins.category] ?? Lightbulb;
                    const tone = ins.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-100' : ins.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200';
                    return (
                        <div key={String(ins.id)} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
                            <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-7 h-7 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{ins.category}</p>
                                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-sm text-[10.5px] font-medium border ${tone}`}>{ins.priority}</span>
                                    </div>
                                </div>
                                <button onClick={() => onDismiss(String(ins.id))} aria-label="Dismiss insight" className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <p className="text-[12.5px] text-slate-800 leading-snug">{ins.text}</p>
                            <div className="flex items-center justify-end pt-1.5 border-t border-slate-100">
                                <button onClick={() => onNavigate(String(ins.id), ins.href)} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-950 hover:underline transition-colors">
                                    {ins.actionLabel}
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AutomationsView({
    automations, loading, onToggle, onRun, onRefresh,
}: {
    automations: AdminAIAutomationExtended[];
    loading: boolean;
    onToggle: (id: string | number, nextActive: boolean) => Promise<void> | void;
    onRun: (id: string | number) => Promise<void> | void;
    onRefresh: () => void;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'Active' | 'Paused' | 'Draft'>('all');
    const [runningId, setRunningId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        if (filter === 'all') return automations;
        return automations.filter((a) => a.status === filter);
    }, [automations, filter]);

    const toggleExpanded = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (loading && automations.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50">
                <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
                <p className="text-[13px]">Loading automations…</p>
            </div>
        );
    }

    if (automations.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50">
                <Workflow className="w-8 h-8" />
                <p className="text-[13px]">No automations configured yet.</p>
                <button onClick={onRefresh} className="text-[12px] text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors">
                    <RefreshCw className="w-3 h-3" />Refresh
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50 p-2">
            <div className="flex items-center justify-between px-1 mb-1.5 gap-1">
                <div className="flex items-center gap-1 overflow-x-auto">
                    {(['all', 'Active', 'Paused', 'Draft'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border whitespace-nowrap transition-colors ${filter === f ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {f === 'all' ? 'All' : f}
                        </button>
                    ))}
                </div>
                <button onClick={onRefresh} className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-1 shrink-0 transition-colors">
                    <RefreshCw className="w-3 h-3" />Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filtered.map((a) => {
                    const isExpanded = expanded.has(String(a.id));
                    const statusTone = a.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : a.status === 'Paused'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200';
                    const lastRunTone = a.lastRunStatus === 'success'
                        ? 'text-emerald-700'
                        : a.lastRunStatus === 'failed'
                            ? 'text-rose-700'
                            : 'text-slate-500';
                    const isRunning = runningId === String(a.id);

                    return (
                        <div key={String(a.id)} className="bg-white border border-slate-200 rounded-sm p-2 space-y-1.5">
                            <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-start gap-2 min-w-0">
                                    <span className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 border ${statusTone}`}>
                                        <Workflow className="w-3.5 h-3.5" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-slate-900 leading-tight truncate">{a.name}</p>
                                        <p className="text-[11px] text-slate-500 truncate">{String(a.kind).replace(/_/g, ' ')} · {a.scheduleKind}</p>
                                    </div>
                                </div>
                                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10.5px] font-semibold border shrink-0 ${statusTone}`}>{a.status}</span>
                            </div>

                            <p className="text-[11.5px] text-slate-600 line-clamp-2 leading-snug">{a.description || 'No description'}</p>

                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Activity className="w-3 h-3" />
                                    <span>{a.successRate}% success</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Timer className="w-3 h-3" />
                                    <span>{a.runs} runs</span>
                                </div>
                                <div className={`flex items-center gap-1 ${lastRunTone}`}>
                                    <Clock className="w-3 h-3" />
                                    <span>Last: {a.lastRun || '—'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Calendar className="w-3 h-3" />
                                    <span>Next: {a.nextRunAt ? new Date(a.nextRunAt).toLocaleDateString() : '—'}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onToggle(a.id, a.status !== 'Active')}
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border transition-colors ${a.status === 'Active' ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'}`}
                                    >
                                        {a.status === 'Active' ? 'Pause' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRunningId(String(a.id));
                                            void onRun(a.id);
                                            setTimeout(() => setRunningId(null), 1200);
                                        }}
                                        disabled={isRunning || a.status !== 'Active'}
                                        className="text-[11px] font-medium px-2 py-0.5 rounded-sm bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
                                    >
                                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                        Run now
                                    </button>
                                </div>
                                <button
                                    onClick={() => toggleExpanded(String(a.id))}
                                    className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
                                >
                                    {isExpanded ? 'Hide' : 'Runs'}
                                    <ChevronDown className={`w-3 h-3 transition ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="mt-1 space-y-1 pt-1.5 border-t border-slate-100">
                                    {a.recentRuns.length === 0 ? (
                                        <p className="text-[11px] text-slate-400">No runs recorded yet.</p>
                                    ) : (
                                        a.recentRuns.slice(0, 3).map((r) => (
                                            <div key={r.id} className="flex items-start gap-1 text-[11px]">
                                                <span className={`w-1.5 h-1.5 rounded-sm mt-1 shrink-0 ${r.status === 'success' ? 'bg-emerald-500' : r.status === 'failed' ? 'bg-rose-500' : r.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-slate-700 truncate">{r.summary || r.status}</p>
                                                    <p className="text-slate-400 text-[10.5px]">
                                                        {r.startedRelative} · {r.durationMs}ms · {r.itemsAffected} items
                                                        {r.costKes > 0 && ` · ${r.costKes.toFixed(2)} KES`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ActionsView({ actions, onRun }: { actions: QuickAction[]; onRun: (a: QuickAction) => void }) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50 p-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {actions.map((a) => {
                    const Icon: IconComponent = isIconComponent(a.icon) ? a.icon : Zap;
                    const tone = TONE_CLASSES[a.tone ?? 'blue'];
                    return (
                        <button key={a.id} onClick={() => onRun(a)} className="text-left bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-sm p-2 transition group">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className={`w-7 h-7 rounded-sm flex items-center justify-center border shrink-0 ${tone.chip}`}>
                                    <Icon className="w-4 h-4" />
                                </span>
                                <p className="text-[13px] font-semibold text-slate-900 truncate">{a.label}</p>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 ml-auto shrink-0 transition-colors" />
                            </div>
                            <p className="text-[11.5px] text-slate-500 leading-snug line-clamp-2">{a.description}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ConfirmDialog({ action, onConfirm, onCancel }: { action: PendingAction; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-[160] bg-slate-900/40 flex items-center justify-center px-3" role="dialog" aria-modal="true">
            <div className="bg-white rounded-sm shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-sm flex items-center justify-center ${action.destructive ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-950'}`}>
                        {action.destructive ? <AlertTriangle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900">{action.title}</p>
                        <p className="text-[11.5px] text-slate-500 font-mono">{action.tool}</p>
                    </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                    <p className="text-[13px] text-slate-700 leading-relaxed">{action.description}</p>
                    {action.preview && action.preview.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 space-y-0.5">
                            {action.preview.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-[12px]">
                                    <span className="text-slate-500">{p.label}</span>
                                    <span className="text-slate-900 font-medium font-mono">{p.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {action.destructive && (
                        <div className="flex items-start gap-1.5 text-[11.5px] text-rose-700 bg-rose-50 border border-rose-100 rounded-sm px-2 py-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            This action is destructive and will be logged in the audit trail.
                        </div>
                    )}
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-1.5">
                    <button onClick={onCancel} className="px-3 py-1.5 text-[12.5px] font-medium rounded-sm border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors">
                        {action.cancelLabel ?? 'Cancel'}
                    </button>
                    <button onClick={onConfirm} className={`px-3 py-1.5 text-[12.5px] font-medium rounded-sm text-white transition-colors ${action.destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-950 hover:bg-blue-900'}`}>
                        {action.confirmLabel ?? 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SettingsDrawer({ onClose, theme, onTheme, readOnly, onReadOnly, piiMasked, onPiiMasked, auditEntries, onClearAudit, context }: {
    onClose: () => void;
    theme: Theme;
    onTheme: (t: Theme) => void;
    readOnly: boolean;
    onReadOnly: (v: boolean) => void;
    piiMasked: boolean;
    onPiiMasked: (v: boolean) => void;
    auditEntries: AuditEntry[];
    onClearAudit: () => void;
    context: PageContext;
}) {
    return (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 flex justify-end" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="bg-white w-full max-w-[420px] h-full shadow-2xl border-l border-slate-200 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-3 border-b border-slate-200 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-sm bg-slate-100 text-slate-700 flex items-center justify-center"><Settings className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900">Copilot settings</p>
                        <p className="text-[11.5px] text-slate-500 truncate">Context: {context.label}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close settings" className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Appearance</p>
                        <div className="grid grid-cols-3 gap-1.5">
                            {(['light', 'dark', 'auto'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => onTheme(t)}
                                    className={`rounded-sm border px-2 py-2 text-[12px] font-medium flex flex-col items-center gap-1 transition-colors ${theme === t ? 'border-blue-300 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {t === 'light' ? <Sun className="w-4 h-4" /> : t === 'dark' ? <Moon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Safety</p>
                        <ToggleRow icon={Lock} label="Read-only mode" hint="AI can answer questions but cannot execute write actions." value={readOnly} onChange={onReadOnly} />
                        <ToggleRow icon={EyeOff} label="Mask PII" hint="Emails, phone numbers, and addresses are hidden by default." value={piiMasked} onChange={onPiiMasked} />
                    </section>

                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Capabilities on this page</p>
                        <div className="flex flex-wrap gap-1">
                            {(context.pack?.tools ?? []).map((t) => (
                                <span key={t} className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 border border-slate-200">{t}</span>
                            ))}
                            {(!context.pack?.tools || context.pack.tools.length === 0) && (
                                <span className="text-[11.5px] text-slate-400">No tools wired for this route yet.</span>
                            )}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Audit log ({auditEntries.length})</p>
                            {auditEntries.length > 0 && (
                                <button onClick={onClearAudit} className="text-[11px] text-rose-600 hover:underline transition-colors">Clear</button>
                            )}
                        </div>
                        <div className="space-y-1 max-h-[220px] overflow-y-auto">
                            {auditEntries.length === 0 && <p className="text-[11.5px] text-slate-400">No AI actions recorded yet.</p>}
                            {auditEntries.map((e) => (
                                <div key={e.id} className="bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 text-[11px] flex items-start gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${e.status === 'success' ? 'bg-emerald-500' : e.status === 'failed' ? 'bg-rose-500' : e.status === 'cancelled' ? 'bg-slate-400' : 'bg-amber-500'}`} />
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 truncate">{e.action}{e.target ? ` · ${e.target}` : ''}</p>
                                        <p className="text-slate-400">{new Date(e.timestamp).toLocaleString()} · {e.actor}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Keyboard</p>
                        <div className="grid grid-cols-2 gap-1 text-[11.5px] text-slate-600">
                            <kbd className="bg-slate-100 border border-slate-200 rounded-sm px-1.5 py-0.5 font-mono">⌘J</kbd><span>Toggle panel</span>
                            <kbd className="bg-slate-100 border border-slate-200 rounded-sm px-1.5 py-0.5 font-mono">⌘K</kbd><span>Toggle sidebar</span>
                            <kbd className="bg-slate-100 border border-slate-200 rounded-sm px-1.5 py-0.5 font-mono">⌘↵</kbd><span>Send</span>
                            <kbd className="bg-slate-100 border border-slate-200 rounded-sm px-1.5 py-0.5 font-mono">Esc</kbd><span>Close / cancel</span>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function ToggleRow({ icon: Icon, label, hint, value, onChange }: {
    icon: IconComponent;
    label: string;
    hint: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    const SafeIcon: IconComponent = isIconComponent(Icon) ? Icon : Zap;
    return (
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-sm p-2">
            <span className="w-7 h-7 rounded-sm bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <SafeIcon className="w-3.5 h-3.5" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-900">{label}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>
            </div>
            <button onClick={() => onChange(!value)} role="switch" aria-checked={value} className={`w-8 h-4 rounded-full relative transition shrink-0 ${value ? 'bg-blue-950' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition ${value ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

function PanelFooter({ context, readOnly, piiMasked }: { context: PageContext; readOnly: boolean; piiMasked: boolean }) {
    return (
        <footer className="border-t border-slate-200 bg-white px-2 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" />{readOnly ? 'Read-only' : 'Write enabled'}</span>
                <span className="inline-flex items-center gap-1">{piiMasked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}PII {piiMasked ? 'masked' : 'visible'}</span>
                <span className="hidden sm:inline-flex items-center gap-1"><KeyRound className="w-3 h-3" />Audited</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono truncate">
                <Filter className="w-3 h-3" />
                {context.label}
            </span>
        </footer>
    );
}