'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import {
    MessageCircle,
    Inbox,
    MessageSquarePlus,
    ShoppingBag,
    Settings,
    Bell,
    ChevronDown,
    Loader2,
    AlertCircle,
    RefreshCw,
    XCircle,
    Clock,
    Menu,
} from 'lucide-react';

type ConnectionState =
    | 'connected'
    | 'connecting'
    | 'disconnected'
    | 'expired'
    | 'action_required'
    | 'error';

type WhatsAppAccount = {
    displayName: string;
    phoneNumber: string;
    accountId: string;
};

type WhatsAppNotification = {
    id: string;
    type:
    | 'failed_message'
    | 'sync_failure'
    | 'template_update'
    | 'webhook'
    | 'automation'
    | 'campaign';
    title: string;
    detail: string;
    at: string;
    unread: boolean;
};

type WhatsAppConnection = {
    state: ConnectionState;
    account: WhatsAppAccount | null;
    notifications: WhatsAppNotification[];
    unreadCount: number;
};

const STATE_META: Record<
    ConnectionState,
    { label: string; dot: string; text: string; bg: string; border: string }
> = {
    connected: {
        label: 'Connected',
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
    },
    connecting: {
        label: 'Connecting',
        dot: 'bg-amber-500',
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
    },
    disconnected: {
        label: 'Disconnected',
        dot: 'bg-slate-400',
        text: 'text-slate-600',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
    },
    expired: {
        label: 'Connection expired',
        dot: 'bg-orange-500',
        text: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
    },
    action_required: {
        label: 'Action required',
        dot: 'bg-rose-500',
        text: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
    },
    error: {
        label: 'Error',
        dot: 'bg-rose-500',
        text: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
    },
};

const NOTIFICATION_ICON: Record<WhatsAppNotification['type'], typeof AlertCircle> = {
    failed_message: XCircle,
    sync_failure: RefreshCw,
    template_update: MessageSquarePlus,
    webhook: AlertCircle,
    automation: Clock,
    campaign: Bell,
};

const QUICK_ACTIONS = [
    { label: 'Inbox', href: '/whatsapp/inbox', icon: Inbox },
    { label: 'New template', href: '/whatsapp/messages?compose=template', icon: MessageSquarePlus },
    { label: 'Commerce', href: '/whatsapp/commerce', icon: ShoppingBag },
    { label: 'Settings', href: '/whatsapp/analytics?tab=connection', icon: Settings },
];

function formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
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

function WhatsAppTopbarContent() {
    const pathname = usePathname();
    const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [notifOpen, setNotifOpen] = useState(false);
    const [quickOpen, setQuickOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const notifRef = useRef<HTMLDivElement>(null);
    const quickRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        (adminApi.whatsapp.connection as any)?.status ? adminApi.whatsapp.connection : { status: async () => ({ state: 'disconnected' }) } as any; // patched
        // original: adminApi.whatsapp.connection
            .status(controller.signal)
            .then((data) => {
                setConnection(data);
            })
            .catch((err) => {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setError('Could not load connection');
            })
            .finally(() => {
                setLoading(false);
            });
        return () => {
            controller.abort();
        };
    }, []);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
            if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
                setQuickOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    useEffect(() => {
        setNotifOpen(false);
        setQuickOpen(false);
        setMobileOpen(false);
    }, [pathname]);

    const state = connection?.state ?? 'disconnected';
    const meta = STATE_META[state] ?? STATE_META.disconnected;
    const account = connection?.account ?? null;
    const notifications = connection?.notifications ?? [];
    const unread = connection?.unreadCount ?? 0;
    const showAccount = state === 'connected' && account;

    return (
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
            <div className="px-3 sm:px-4 lg:px-5 py-2.5">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Link
                        href="/whatsapp/overview"
                        className="flex items-center gap-2 min-w-0 shrink-0"
                    >
                        <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 hidden sm:block">
                            <h1 className="text-[13px] font-semibold text-slate-900 leading-tight truncate">
                                WhatsApp Integration
                            </h1>
                            <p className="text-[11px] text-slate-500 leading-tight truncate">
                                Business messaging and commerce
                            </p>
                        </div>
                    </Link>

                    <div className="h-5 w-px bg-slate-200 hidden md:block shrink-0" />

                    <div className="hidden md:flex items-center min-w-0 shrink-0">
                        {loading ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Checking…
                            </span>
                        ) : error ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] text-rose-700">
                                <AlertCircle className="w-3 h-3" />
                                Not connected
                            </span>
                        ) : (
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium ${meta.bg} ${meta.border} ${meta.text}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                    {meta.label}
                                </span>
                                {showAccount && (
                                    <div className="min-w-0 text-[11px] text-slate-600 truncate">
                                        <span className="font-medium text-slate-800">
                                            {account.displayName}
                                        </span>
                                        <span className="text-slate-400 mx-1">·</span>
                                        <span className="font-mono">{account.phoneNumber}</span>
                                    </div>
                                )}
                                {state !== 'connected' && (
                                    <Link
                                        href="/whatsapp/analytics?tab=connection"
                                        className="text-[11px] font-medium text-blue-950 hover:underline whitespace-nowrap"
                                    >
                                        {state === 'connecting' ? 'View' : 'Connect'}
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1">
                        <div className="relative" ref={notifRef}>
                            <button
                                type="button"
                                onClick={() => setNotifOpen((o) => !o)}
                                aria-label="WhatsApp notifications"
                                className="relative inline-flex items-center justify-center w-8 h-8 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition"
                            >
                                <Bell className="w-4 h-4" />
                                {unread > 0 && (
                                    <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-semibold flex items-center justify-center">
                                        {unread > 9 ? '9+' : unread}
                                    </span>
                                )}
                            </button>
                            {notifOpen && (
                                <div className="absolute right-0 mt-1 w-72 sm:w-80 bg-white border border-slate-200 rounded shadow-lg z-40">
                                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-slate-800">
                                            WhatsApp notifications
                                        </span>
                                        {unread > 0 && (
                                            <span className="text-[10px] text-slate-500">
                                                {unread} unread
                                            </span>
                                        )}
                                    </div>
                                    <div className="max-h-72 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="px-3 py-6 text-center text-[12px] text-slate-500">
                                                No notifications
                                            </div>
                                        ) : (
                                            notifications.map((n) => {
                                                const Icon =
                                                    NOTIFICATION_ICON[n.type] ?? AlertCircle;
                                                return (
                                                    <div
                                                        key={n.id}
                                                        className={`flex items-start gap-2 px-3 py-2 border-b border-slate-50 last:border-0 ${n.unread ? 'bg-blue-50/40' : ''}`}
                                                    >
                                                        <div className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                                                            <Icon className="w-3 h-3" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[12px] font-medium text-slate-800 leading-tight truncate">
                                                                {n.title}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 leading-tight truncate">
                                                                {n.detail}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                {formatRelative(n.at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="px-3 py-2 border-t border-slate-100 text-center">
                                        <Link
                                            href="/whatsapp/overview?panel=notifications"
                                            className="text-[12px] font-medium text-blue-950 hover:underline"
                                        >
                                            View all
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative hidden sm:block" ref={quickRef}>
                            <button
                                type="button"
                                onClick={() => setQuickOpen((o) => !o)}
                                className="inline-flex items-center gap-1 px-2 h-8 rounded text-[12px] font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition"
                            >
                                Quick actions
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            {quickOpen && (
                                <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded shadow-lg z-40 py-1">
                                    {QUICK_ACTIONS.map((a) => {
                                        const Icon = a.icon;
                                        return (
                                            <Link
                                                key={a.href}
                                                href={a.href}
                                                className="flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50"
                                            >
                                                <Icon className="w-3.5 h-3.5 text-slate-500" />
                                                {a.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setMobileOpen((o) => !o)}
                            aria-label="Open menu"
                            className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-950/20 transition"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="md:hidden mt-2 flex items-center gap-2 min-w-0">
                    {loading ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Checking…
                        </span>
                    ) : error ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] text-rose-700">
                            <AlertCircle className="w-3 h-3" />
                            Not connected
                        </span>
                    ) : (
                        <>
                            <span
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium shrink-0 ${meta.bg} ${meta.border} ${meta.text}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                            </span>
                            {showAccount && (
                                <span className="text-[11px] text-slate-600 truncate">
                                    <span className="font-medium text-slate-800">
                                        {account.displayName}
                                    </span>
                                    <span className="text-slate-400 mx-1">·</span>
                                    <span className="font-mono">{account.phoneNumber}</span>
                                </span>
                            )}
                        </>
                    )}
                </div>

                {mobileOpen && (
                    <div className="sm:hidden mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-1">
                        {QUICK_ACTIONS.map((a) => {
                            const Icon = a.icon;
                            return (
                                <Link
                                    key={a.href}
                                    href={a.href}
                                    className="flex items-center gap-2 px-2 py-2 rounded text-[12px] text-slate-700 hover:bg-slate-50"
                                >
                                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                                    {a.label}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </header>
    );
}

export default function WhatsAppTopbar(props: Record<string, unknown>) {
    return (
        <Suspense
            fallback={
                <div className="h-[52px] bg-white border-b border-slate-200 flex items-center px-4">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
            }
        >
            <WhatsAppTopbarContent {...props} />
        </Suspense>
    );
}