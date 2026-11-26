'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import Link from 'next/link';
import {
    FileText,
    Bell,
    Zap,
    History,
    Plus,
    Search,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronDown,
    ChevronRight,
    Eye,
    Pencil,
    Trash2,
    Send,
    Archive,
    Globe,
    MessageSquare,
    ShoppingBag,
    CreditCard,
    Truck,
    Package,
    RotateCw,
    Copy,
    ExternalLink,
    Filter,
    Play,
    Pause,
    MoreVertical,
    X,
    Lock,
    ShieldAlert,
    Info,
} from 'lucide-react';

type Tab = 'templates' | 'notifications' | 'automations' | 'history';

type TemplateCategory = 'utility' | 'marketing' | 'authentication';
type TemplateStatus = 'approved' | 'pending' | 'rejected' | 'disabled' | 'draft';

type Template = {
    id: string;
    name: string;
    category: TemplateCategory;
    language: string;
    status: TemplateStatus;
    bodyPreview: string;
    headerType: 'none' | 'text' | 'image' | 'document';
    footer: string | null;
    variableCount: number;
    buttonCount: number;
    updatedAt: string;
    rejectionReason: string | null;
    metaTemplateId: string | null;
};

type NotificationEvent =
    | 'order_created'
    | 'payment_confirmed'
    | 'payment_failed'
    | 'order_processing'
    | 'order_dispatched'
    | 'order_delivered'
    | 'order_cancelled'
    | 'refund_processed';

type NotificationConfig = {
    id: string;
    event: NotificationEvent;
    label: string;
    description: string;
    templateId: string | null;
    templateName: string | null;
    enabled: boolean;
    lastExecutedAt: string | null;
    lastResult: 'success' | 'failed' | 'skipped' | null;
    failureDetail: string | null;
    requiresConsent: boolean;
    requiresVerifiedState: boolean;
};

type TriggerType =
    | 'order_created'
    | 'payment_confirmed'
    | 'order_dispatched'
    | 'order_delivered'
    | 'message_received'
    | 'purchase_completed';

type ActionType = 'send_template' | 'route_to_inbox';

type Workflow = {
    id: string;
    name: string;
    enabled: boolean;
    trigger: TriggerType;
    triggerLabel: string;
    conditions: string[];
    action: ActionType;
    templateId: string | null;
    templateName: string | null;
    delaySeconds: number;
    lastRunAt: string | null;
    lastRunResult: 'success' | 'failed' | 'skipped' | null;
    successCount: number;
    failureCount: number;
};

type MessageLogStatus = 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';

type MessageLog = {
    id: string;
    messageId: string;
    recipient: string;
    customerName: string | null;
    templateName: string | null;
    category: TemplateCategory;
    orderReference: string | null;
    sentAt: string;
    status: MessageLogStatus;
    failureReason: string | null;
};

const TABS: Array<{ key: Tab; label: string; icon: typeof FileText }> = [
    { key: 'templates', label: 'Templates', icon: FileText },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'automations', label: 'Automations', icon: Zap },
    { key: 'history', label: 'History & logs', icon: History },
];

const CATEGORY_META: Record<
    TemplateCategory,
    { label: string; bg: string; text: string; border: string }
> = {
    utility: {
        label: 'Utility',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
    },
    marketing: {
        label: 'Marketing',
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        border: 'border-purple-200',
    },
    authentication: {
        label: 'Authentication',
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
    },
};

const TEMPLATE_STATUS_META: Record<
    TemplateStatus,
    { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }
> = {
    approved: {
        label: 'Approved',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: CheckCircle2,
    },
    pending: {
        label: 'Pending',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: Clock,
    },
    rejected: {
        label: 'Rejected',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: XCircle,
    },
    disabled: {
        label: 'Disabled',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: Lock,
    },
    draft: {
        label: 'Draft',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: Pencil,
    },
};

const LOG_STATUS_META: Record<
    MessageLogStatus,
    { label: string; bg: string; text: string; border: string }
> = {
    accepted: {
        label: 'Accepted',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
    },
    sent: {
        label: 'Sent',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
    },
    delivered: {
        label: 'Delivered',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
    },
    read: {
        label: 'Read',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
    },
    failed: {
        label: 'Failed',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
    },
};

function formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function CategoryPill({ category }: { category: TemplateCategory }) {
    const m = CATEGORY_META[category];
    return (
        <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            {m.label}
        </span>
    );
}

function StatusPill({ status }: { status: TemplateStatus }) {
    const m = TEMPLATE_STATUS_META[status];
    const Icon = m.icon;
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            <Icon className="w-2.5 h-2.5" />
            {m.label}
        </span>
    );
}

function LogStatusPill({ status }: { status: MessageLogStatus }) {
    const m = LOG_STATUS_META[status];
    return (
        <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.bg} ${m.border} ${m.text}`}
        >
            {m.label}
        </span>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: typeof FileText;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-2 mb-2">
            <div className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
                <p className="text-[11px] text-slate-500">{description}</p>
            </div>
            {action}
        </div>
    );
}

function TemplateDetailDrawer({
    template,
    onClose,
    onSync,
    onDisable,
    syncing,
    disabling,
}: {
    template: Template | null;
    onClose: () => void;
    onSync: () => void;
    onDisable: () => void;
    syncing: boolean;
    disabling: boolean;
}) {
    if (!template) return null;
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
            <div className="w-full max-w-md bg-white h-full shadow-lg flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-[13px] font-semibold text-slate-900 truncate">
                            {template.name}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-900"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <CategoryPill category={template.category} />
                        <StatusPill status={template.status} />
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                            <Globe className="w-3 h-3" />
                            {template.language}
                        </span>
                        <span className="text-[10px] text-slate-400">
                            Updated {formatRelative(template.updatedAt)}
                        </span>
                    </div>

                    {template.metaTemplateId && (
                        <div className="text-[11px] text-slate-500">
                            Meta ID:{' '}
                            <span className="font-mono">{template.metaTemplateId}</span>
                        </div>
                    )}

                    {template.status === 'rejected' && template.rejectionReason && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5 text-[11px] text-rose-700 flex items-start gap-1.5">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium">Rejected by Meta</p>
                                <p>{template.rejectionReason}</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="text-[11px] font-medium text-slate-700 mb-1">
                            Preview
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[12px] text-slate-700 whitespace-pre-wrap break-words">
                            {template.headerType !== 'none' && (
                                <div className="text-[10px] text-slate-500 mb-1 uppercase">
                                    Header · {template.headerType}
                                </div>
                            )}
                            {template.bodyPreview}
                            {template.footer && (
                                <div className="text-[10px] text-slate-500 mt-1 border-t border-slate-200 pt-1">
                                    {template.footer}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-slate-50 rounded px-2 py-1.5">
                            <p className="text-[10px] text-slate-500">Variables</p>
                            <p className="text-[13px] font-semibold text-slate-900">
                                {template.variableCount}
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded px-2 py-1.5">
                            <p className="text-[10px] text-slate-500">Buttons</p>
                            <p className="text-[13px] font-semibold text-slate-900">
                                {template.buttonCount}
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 text-[11px] text-blue-800 flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                            Approval and current status are managed by Meta. Refresh to
                            synchronise the latest status.
                        </span>
                    </div>
                </div>
                <div className="border-t border-slate-100 p-2 flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onSync}
                        disabled={syncing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {syncing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <RotateCw className="w-3 h-3" />
                        )}
                        Sync status
                    </button>
                    <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white border border-slate-200 text-[11px] text-slate-400 cursor-not-allowed"
                        title="Editing eligible templates is handled server-side"
                    >
                        <Pencil className="w-3 h-3" />
                        Edit
                    </button>
                    <span className="flex-1" />
                    <button
                        type="button"
                        onClick={onDisable}
                        disabled={disabling || template.status === 'disabled'}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white border border-rose-200 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {disabling ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Archive className="w-3 h-3" />
                        )}
                        Disable
                    </button>
                </div>
            </div>
        </div>
    );
}

function NotificationRow({
    config,
    templates,
    onToggle,
    onSelectTemplate,
    busy,
}: {
    config: NotificationConfig;
    templates: Template[];
    onToggle: () => void;
    onSelectTemplate: (templateId: string | null) => void;
    busy: boolean;
}) {
    const [open, setOpen] = useState(false);
    const resultIcon =
        config.lastResult === 'success'
            ? CheckCircle2
            : config.lastResult === 'failed'
                ? XCircle
                : Clock;
    const resultColor =
        config.lastResult === 'success'
            ? 'text-emerald-500'
            : config.lastResult === 'failed'
                ? 'text-rose-500'
                : 'text-slate-400';
    const ResultIcon = resultIcon;

    const eligibleTemplates = templates.filter(
        (t) => t.status === 'approved' || t.id === config.templateId,
    );

    return (
        <div className="border border-slate-200 rounded">
            <div className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-medium text-slate-900 truncate">
                            {config.label}
                        </p>
                        {config.requiresConsent && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
                                Consent
                            </span>
                        )}
                        {config.requiresVerifiedState && (
                            <span className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 rounded px-1">
                                Verified state
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                        {config.description}
                    </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <ResultIcon className={`w-3 h-3 ${resultColor}`} />
                    {config.lastExecutedAt
                        ? formatRelative(config.lastExecutedAt)
                        : 'Never run'}
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={config.enabled}
                    onClick={onToggle}
                    disabled={busy}
                    className={`relative w-9 h-5 rounded-full transition disabled:opacity-50 ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                    <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${config.enabled ? 'left-4' : 'left-0.5'}`}
                    />
                </button>
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100"
                >
                    {open ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>

            {open && (
                <div className="border-t border-slate-100 px-3 py-2 space-y-2 bg-slate-50">
                    <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                            Template
                        </label>
                        <select
                            value={config.templateId ?? ''}
                            onChange={(e) =>
                                onSelectTemplate(e.target.value || null)
                            }
                            disabled={busy}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40 disabled:opacity-50"
                        >
                            <option value="">Select a template…</option>
                            {eligibleTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} · {t.language} · {t.status}
                                </option>
                            ))}
                        </select>
                        {eligibleTemplates.length === 0 && (
                            <p className="text-[10px] text-rose-600 mt-1">
                                No approved templates available. Create and get
                                approval first.
                            </p>
                        )}
                    </div>
                    {config.failureDetail && (
                        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
                            {config.failureDetail}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function WhatsAppMessagesPage() {
    const [tab, setTab] = useState<Tab>('templates');

    const [templates, setTemplates] = useState<Template[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [templatesError, setTemplatesError] = useState('');
    const [templateSearch, setTemplateSearch] = useState('');
    const [templateFilter, setTemplateFilter] = useState<
        'all' | TemplateCategory
    >('all');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [syncingTemplateId, setSyncingTemplateId] = useState<string | null>(null);
    const [disablingTemplateId, setDisablingTemplateId] = useState<string | null>(
        null,
    );

    const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
    const [notificationsLoading, setNotificationsLoading] = useState(true);
    const [notificationsError, setNotificationsError] = useState('');
    const [busyNotificationId, setBusyNotificationId] = useState<string | null>(
        null,
    );

    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [workflowsLoading, setWorkflowsLoading] = useState(true);
    const [workflowsError, setWorkflowsError] = useState('');
    const [busyWorkflowId, setBusyWorkflowId] = useState<string | null>(null);

    const [logs, setLogs] = useState<MessageLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [logsError, setLogsError] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [logStatus, setLogStatus] = useState<'all' | MessageLogStatus>('all');
    const [logCategory, setLogCategory] = useState<'all' | TemplateCategory>('all');
    const [logDateFrom, setLogDateFrom] = useState('');
    const [logDateTo, setLogDateTo] = useState('');

    const loadTemplates = useCallback(async (silent = false) => {
        if (!silent) setTemplatesLoading(true);
        setTemplatesError('');
        try {
            const res = await fetch('/api/whatsapp/templates', { cache: 'no-store' });
            if (!res.ok) throw new Error('failed');
            const data = (await res.json()) as Template[];
            setTemplates(data);
        } catch {
            setTemplatesError('Could not load templates.');
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    const loadNotifications = useCallback(async (silent = false) => {
        if (!silent) setNotificationsLoading(true);
        setNotificationsError('');
        try {
            const res = await fetch('/api/whatsapp/notifications/config', {
                cache: 'no-store',
            });
            if (!res.ok) throw new Error('failed');
            const data = (await res.json()) as NotificationConfig[];
            setNotifications(data);
        } catch {
            setNotificationsError('Could not load notification configuration.');
        } finally {
            setNotificationsLoading(false);
        }
    }, []);

    const loadWorkflows = useCallback(async (silent = false) => {
        if (!silent) setWorkflowsLoading(true);
        setWorkflowsError('');
        try {
            const res = await fetch('/api/whatsapp/workflows', {
                cache: 'no-store',
            });
            if (!res.ok) throw new Error('failed');
            const data = (await res.json()) as Workflow[];
            setWorkflows(data);
        } catch {
            setWorkflowsError('Could not load automation workflows.');
        } finally {
            setWorkflowsLoading(false);
        }
    }, []);

    const loadLogs = useCallback(
        async (silent = false) => {
            if (!silent) setLogsLoading(true);
            setLogsError('');
            try {
                const params = new URLSearchParams();
                if (logSearch.trim()) params.set('q', logSearch.trim());
                if (logStatus !== 'all') params.set('status', logStatus);
                if (logCategory !== 'all') params.set('category', logCategory);
                if (logDateFrom) params.set('from', logDateFrom);
                if (logDateTo) params.set('to', logDateTo);
                const res = await fetch(
                    `/api/whatsapp/messages/logs?${params.toString()}`,
                    { cache: 'no-store' },
                );
                if (!res.ok) throw new Error('failed');
                const data = (await res.json()) as MessageLog[];
                setLogs(data);
            } catch {
                setLogsError('Could not load message logs.');
            } finally {
                setLogsLoading(false);
            }
        },
        [logSearch, logStatus, logCategory, logDateFrom, logDateTo],
    );

    useEffect(() => {
        if (tab === 'templates') loadTemplates();
    }, [tab, loadTemplates]);

    useEffect(() => {
        if (tab === 'notifications') loadNotifications();
    }, [tab, loadNotifications]);

    useEffect(() => {
        if (tab === 'automations') loadWorkflows();
    }, [tab, loadWorkflows]);

    useEffect(() => {
        if (tab !== 'history') return;
        const t = setTimeout(() => loadLogs(), 250);
        return () => clearTimeout(t);
    }, [tab, loadLogs]);

    const filteredTemplates = useMemo(() => {
        const q = templateSearch.trim().toLowerCase();
        return templates.filter((t) => {
            if (templateFilter !== 'all' && t.category !== templateFilter) return false;
            if (!q) return true;
            return (
                t.name.toLowerCase().includes(q) ||
                t.bodyPreview.toLowerCase().includes(q)
            );
        });
    }, [templates, templateSearch, templateFilter]);

    const handleSyncTemplate = async (id: string) => {
        setSyncingTemplateId(id);
        try {
            const res = await fetch(`/api/whatsapp/templates/${id}/sync`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('sync failed');
            await loadTemplates(true);
            if (selectedTemplate?.id === id) {
                const fresh = await fetch(`/api/whatsapp/templates/${id}`, {
                    cache: 'no-store',
                });
                if (fresh.ok) {
                    const data = (await fresh.json()) as Template;
                    setSelectedTemplate(data);
                }
            }
        } catch {
        } finally {
            setSyncingTemplateId(null);
        }
    };

    const handleDisableTemplate = async (id: string) => {
        setDisablingTemplateId(id);
        try {
            const res = await fetch(`/api/whatsapp/templates/${id}/disable`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('disable failed');
            await loadTemplates(true);
            setSelectedTemplate(null);
        } catch {
        } finally {
            setDisablingTemplateId(null);
        }
    };

    const handleToggleNotification = async (id: string) => {
        const target = notifications.find((n) => n.id === id);
        if (!target) return;
        if (target.enabled && !target.templateId) {
            return;
        }
        setBusyNotificationId(id);
        try {
            const res = await fetch(`/api/whatsapp/notifications/config/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !target.enabled }),
            });
            if (!res.ok) throw new Error('update failed');
            await loadNotifications(true);
        } catch {
        } finally {
            setBusyNotificationId(null);
        }
    };

    const handleSelectNotificationTemplate = async (
        id: string,
        templateId: string | null,
    ) => {
        setBusyNotificationId(id);
        try {
            const res = await fetch(`/api/whatsapp/notifications/config/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: templateId }),
            });
            if (!res.ok) throw new Error('update failed');
            await loadNotifications(true);
        } catch {
        } finally {
            setBusyNotificationId(null);
        }
    };

    const handleToggleWorkflow = async (id: string) => {
        const target = workflows.find((w) => w.id === id);
        if (!target) return;
        setBusyWorkflowId(id);
        try {
            const res = await fetch(`/api/whatsapp/workflows/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !target.enabled }),
            });
            if (!res.ok) throw new Error('update failed');
            await loadWorkflows(true);
        } catch {
        } finally {
            setBusyWorkflowId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="px-3 sm:px-4 lg:px-5 py-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-semibold text-slate-900">
                            Messages & Automation
                        </h1>
                        <p className="text-[12px] text-slate-500">
                            Templates, transactional notifications and automated workflows.
                        </p>
                    </div>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => {
                            if (tab === 'templates') loadTemplates(true);
                            else if (tab === 'notifications') loadNotifications(true);
                            else if (tab === 'automations') loadWorkflows(true);
                            else loadLogs(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        Refresh
                    </button>
                </div>

                <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] border-b-2 -mb-px transition whitespace-nowrap ${active ? 'border-blue-950 text-blue-950 font-medium' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {tab === 'templates' && (
                    <div className="space-y-2">
                        <SectionHeader
                            icon={FileText}
                            title="Message templates"
                            description="Manage WhatsApp message templates and their Meta approval status."
                            action={
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-950 text-white text-[11px] font-medium opacity-60 cursor-not-allowed"
                                    title="Template creation is handled via Analytics & Settings"
                                >
                                    <Plus className="w-3 h-3" />
                                    New template
                                </button>
                            }
                        />

                        <div className="bg-white border border-slate-200 rounded">
                            <div className="p-2 border-b border-slate-100 flex flex-wrap items-center gap-1.5">
                                <div className="relative flex-1 min-w-[160px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        placeholder="Search templates…"
                                        className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    {(['all', 'utility', 'marketing', 'authentication'] as const).map(
                                        (k) => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => setTemplateFilter(k)}
                                                className={`inline-flex items-center px-2 py-1 rounded text-[11px] transition ${templateFilter === k ? 'bg-blue-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                {k === 'all' ? 'All' : CATEGORY_META[k].label}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            {templatesLoading ? (
                                <div className="p-2 space-y-1.5">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-12 bg-slate-50 rounded animate-pulse"
                                        />
                                    ))}
                                </div>
                            ) : templatesError ? (
                                <div className="p-3 text-[12px] text-rose-600 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {templatesError}
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="py-8 text-center text-[12px] text-slate-500">
                                    <FileText className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                                    No templates match this filter.
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {filteredTemplates.map((t) => (
                                        <li key={t.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTemplate(t)}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[12px] font-medium text-slate-900 truncate">
                                                        {t.name}
                                                    </span>
                                                    <CategoryPill category={t.category} />
                                                    <StatusPill status={t.status} />
                                                    <span className="flex-1" />
                                                    <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
                                                        {formatRelative(t.updatedAt)}
                                                    </span>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                </div>
                                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                                    {t.bodyPreview}
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Globe className="w-2.5 h-2.5" />
                                                        {t.language}
                                                    </span>
                                                    {t.variableCount > 0 && (
                                                        <span>{t.variableCount} var</span>
                                                    )}
                                                    {t.buttonCount > 0 && (
                                                        <span>{t.buttonCount} btns</span>
                                                    )}
                                                    {t.status === 'rejected' &&
                                                        t.rejectionReason && (
                                                            <span className="text-rose-600 truncate">
                                                                {t.rejectionReason}
                                                            </span>
                                                        )}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 text-[11px] text-blue-800 flex items-start gap-1.5">
                            <Info className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>
                                Template approval status is controlled by Meta. Newly
                                created templates remain pending until Meta confirms
                                approval.
                            </span>
                        </div>
                    </div>
                )}

                {tab === 'notifications' && (
                    <div className="space-y-2">
                        <SectionHeader
                            icon={Bell}
                            title="Transactional notifications"
                            description="Automatically send approved templates on verified e-commerce events."
                        />
                        {notificationsLoading ? (
                            <div className="space-y-1.5">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-14 bg-white border border-slate-200 rounded animate-pulse"
                                    />
                                ))}
                            </div>
                        ) : notificationsError ? (
                            <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {notificationsError}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                                No notification configuration available.
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {notifications.map((n) => (
                                    <NotificationRow
                                        key={n.id}
                                        config={n}
                                        templates={templates}
                                        onToggle={() => handleToggleNotification(n.id)}
                                        onSelectTemplate={(id) =>
                                            handleSelectNotificationTemplate(n.id, id)
                                        }
                                        busy={busyNotificationId === n.id}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                            <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>
                                Notifications are only dispatched after verified events from
                                the Payments and Delivery systems. Marketing messages respect
                                customer consent.
                            </span>
                        </div>
                    </div>
                )}

                {tab === 'automations' && (
                    <div className="space-y-2">
                        <SectionHeader
                            icon={Zap}
                            title="Automation workflows"
                            description="Configure triggered workflows using supported events and actions."
                            action={
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-950 text-white text-[11px] font-medium opacity-60 cursor-not-allowed"
                                    title="Workflow creation is handled via Analytics & Settings"
                                >
                                    <Plus className="w-3 h-3" />
                                    New workflow
                                </button>
                            }
                        />
                        {workflowsLoading ? (
                            <div className="space-y-1.5">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-20 bg-white border border-slate-200 rounded animate-pulse"
                                    />
                                ))}
                            </div>
                        ) : workflowsError ? (
                            <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {workflowsError}
                            </div>
                        ) : workflows.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded p-6 text-center text-[12px] text-slate-500">
                                <Zap className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                                No automation workflows configured yet.
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {workflows.map((w) => (
                                    <div
                                        key={w.id}
                                        className="bg-white border border-slate-200 rounded"
                                    >
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-[12px] font-medium text-slate-900 truncate">
                                                        {w.name}
                                                    </p>
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${w.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                                                    >
                                                        {w.enabled ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    Trigger: {w.triggerLabel} →{' '}
                                                    {w.action === 'send_template'
                                                        ? `Send template${w.templateName ? ` (${w.templateName})` : ''}`
                                                        : 'Route to Inbox'}
                                                    {w.delaySeconds > 0 &&
                                                        ` · ${w.delaySeconds}s delay`}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleWorkflow(w.id)}
                                                disabled={busyWorkflowId === w.id}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                {busyWorkflowId === w.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : w.enabled ? (
                                                    <Pause className="w-3 h-3" />
                                                ) : (
                                                    <Play className="w-3 h-3" />
                                                )}
                                                {w.enabled ? 'Pause' : 'Enable'}
                                            </button>
                                        </div>
                                        <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                                            <div>
                                                <p className="text-[10px] text-slate-500">
                                                    Last run
                                                </p>
                                                <p className="text-slate-800">
                                                    {w.lastRunAt
                                                        ? formatRelative(w.lastRunAt)
                                                        : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500">
                                                    Last result
                                                </p>
                                                <p
                                                    className={
                                                        w.lastRunResult === 'success'
                                                            ? 'text-emerald-600'
                                                            : w.lastRunResult === 'failed'
                                                                ? 'text-rose-600'
                                                                : 'text-slate-500'
                                                    }
                                                >
                                                    {w.lastRunResult ?? '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500">
                                                    Success
                                                </p>
                                                <p className="text-slate-800">
                                                    {w.successCount}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500">
                                                    Failures
                                                </p>
                                                <p
                                                    className={
                                                        w.failureCount > 0
                                                            ? 'text-rose-600'
                                                            : 'text-slate-800'
                                                    }
                                                >
                                                    {w.failureCount}
                                                </p>
                                            </div>
                                            {w.conditions.length > 0 && (
                                                <div className="col-span-full text-[10px] text-slate-500">
                                                    Conditions: {w.conditions.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'history' && (
                    <div className="space-y-2">
                        <SectionHeader
                            icon={History}
                            title="Message history & logs"
                            description="Every outbound WhatsApp message with its delivery status."
                        />
                        <div className="bg-white border border-slate-200 rounded">
                            <div className="p-2 border-b border-slate-100 flex flex-wrap items-center gap-1.5">
                                <div className="relative flex-1 min-w-[160px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={logSearch}
                                        onChange={(e) => setLogSearch(e.target.value)}
                                        placeholder="Search recipient, order, template…"
                                        className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                    />
                                </div>
                                <select
                                    value={logStatus}
                                    onChange={(e) =>
                                        setLogStatus(
                                            e.target.value as 'all' | MessageLogStatus,
                                        )
                                    }
                                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                >
                                    <option value="all">All status</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="sent">Sent</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="read">Read</option>
                                    <option value="failed">Failed</option>
                                </select>
                                <select
                                    value={logCategory}
                                    onChange={(e) =>
                                        setLogCategory(
                                            e.target.value as 'all' | TemplateCategory,
                                        )
                                    }
                                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                >
                                    <option value="all">All categories</option>
                                    <option value="utility">Utility</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="authentication">Authentication</option>
                                </select>
                                <input
                                    type="date"
                                    value={logDateFrom}
                                    onChange={(e) => setLogDateFrom(e.target.value)}
                                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                />
                                <input
                                    type="date"
                                    value={logDateTo}
                                    onChange={(e) => setLogDateTo(e.target.value)}
                                    className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                />
                            </div>

                            {logsLoading ? (
                                <div className="p-2 space-y-1.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-12 bg-slate-50 rounded animate-pulse"
                                        />
                                    ))}
                                </div>
                            ) : logsError ? (
                                <div className="p-3 text-[12px] text-rose-600 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {logsError}
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="py-8 text-center text-[12px] text-slate-500">
                                    <History className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                                    No messages match these filters.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-500">
                                                <th className="text-left font-medium px-3 py-1.5">
                                                    Recipient
                                                </th>
                                                <th className="text-left font-medium px-3 py-1.5">
                                                    Template
                                                </th>
                                                <th className="text-left font-medium px-3 py-1.5">
                                                    Category
                                                </th>
                                                <th className="text-left font-medium px-3 py-1.5">
                                                    Order
                                                </th>
                                                <th className="text-left font-medium px-3 py-1.5">
                                                    Sent
                                                </th>
                                                <th className="text-left font-medium px-3 py-1.5">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {logs.map((l) => (
                                                <tr key={l.id} className="hover:bg-slate-50">
                                                    <td className="px-3 py-1.5">
                                                        <div className="text-[12px] text-slate-800 truncate max-w-[180px]">
                                                            {l.customerName ?? l.recipient}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            {l.recipient}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-[12px] text-slate-700 truncate max-w-[160px]">
                                                        {l.templateName ?? '—'}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <CategoryPill category={l.category} />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-[12px]">
                                                        {l.orderReference ? (
                                                            <span className="font-mono text-slate-700">
                                                                {l.orderReference}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-[11px] text-slate-600 whitespace-nowrap">
                                                        {formatDateTime(l.sentAt)}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <LogStatusPill status={l.status} />
                                                            {l.failureReason && (
                                                                <span
                                                                    className="text-[10px] text-rose-600 truncate max-w-[140px]"
                                                                    title={l.failureReason}
                                                                >
                                                                    {l.failureReason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <TemplateDetailDrawer
                template={selectedTemplate}
                onClose={() => setSelectedTemplate(null)}
                onSync={() =>
                    selectedTemplate && handleSyncTemplate(selectedTemplate.id)
                }
                onDisable={() =>
                    selectedTemplate && handleDisableTemplate(selectedTemplate.id)
                }
                syncing={syncingTemplateId === selectedTemplate?.id}
                disabling={disablingTemplateId === selectedTemplate?.id}
            />
        </div>
    );
}

export default WhatsAppMessagesPage;