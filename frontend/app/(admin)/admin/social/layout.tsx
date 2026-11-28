'use client';

import { Suspense } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Bell,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    CircleDashed,
    Clock,
    HelpCircle,
    Inbox,
    LayoutDashboard,
    Loader2,
    Megaphone,
    MessageSquare,
    Music2,
    PenSquare,
    PlusCircle,
    RefreshCw,
    Search,
    Settings,
    ShieldAlert,
    Sparkles,
    UserPlus,
    type LucideIcon,
} from 'lucide-react';
import { FaInstagram, FaFacebook, FaYoutube, FaTiktok } from 'react-icons/fa6';
import { adminApi as api } from '@/lib/admin-api'
import { ApiError } from '@/lib/api'


type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

type ConnectionStatus =
    | 'connected'
    | 'not_connected'
    | 'connecting'
    | 'authorization_expired'
    | 'permission_required'
    | 'sync_failed'
    | 'temporarily_unavailable';

type PlatformAccount = {
    platform: PlatformKey;
    status: ConnectionStatus;
    account_name?: string | null;
    display_name?: string | null;
    username?: string | null;
    last_synced_at?: string | null;
    error?: string | null;
};

type SocialNotification = {
    id: string;
    kind:
    | 'publish_failed'
    | 'schedule_reminder'
    | 'auth_expiring'
    | 'disconnected'
    | 'unanswered_messages'
    | 'campaign_issue'
    | 'sync_failed'
    | string;
    title: string;
    body?: string | null;
    href?: string | null;
    created_at?: string | null;
    severity?: 'info' | 'warning' | 'error' | string | null;
};

type NavItem = {
    href: string;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
    { href: '/admin/social', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
    { href: '/admin/social/accounts', label: 'Accounts', shortLabel: 'Accounts', icon: UserPlus },
    { href: '/admin/social/content-studio', label: 'Content Studio', shortLabel: 'Content', icon: PenSquare },
    { href: '/admin/social/publishing-calendar', label: 'Publishing Calendar', shortLabel: 'Calendar', icon: CalendarDays },
    { href: '/admin/social/inbox-community', label: 'Inbox & Community', shortLabel: 'Inbox', icon: Inbox },
    { href: '/admin/social/campaigns', label: 'Campaigns', shortLabel: 'Campaigns', icon: Megaphone },
    { href: '/admin/social/analytics', label: 'Analytics & Reports', shortLabel: 'Analytics', icon: BarChart3 },
];

const PLATFORM_META: Record<
    PlatformKey,
    { label: string; icon: React.ComponentType<{ className?: string }>; brand: string }
> = {
    youtube: { label: 'YouTube', icon: FaYoutube, brand: 'text-rose-600 bg-rose-50' },
    facebook: { label: 'Facebook', icon: FaFacebook, brand: 'text-blue-700 bg-blue-50' },
    instagram: { label: 'Instagram', icon: FaInstagram, brand: 'text-pink-600 bg-pink-50' },
    tiktok: { label: 'TikTok', icon: FaTiktok, brand: 'text-slate-900 bg-slate-100' },
};

const PLATFORM_ORDER: PlatformKey[] = ['youtube', 'facebook', 'instagram', 'tiktok'];

function statusMeta(status: ConnectionStatus): {
    label: string;
    dotClass: string;
    textClass: string;
    chipClass: string;
    warn: boolean;
} {
    switch (status) {
        case 'connected':
            return {
                label: 'Connected',
                dotClass: 'bg-emerald-500',
                textClass: 'text-emerald-700',
                chipClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                warn: false,
            };
        case 'connecting':
            return {
                label: 'Connecting…',
                dotClass: 'bg-blue-500 animate-pulse',
                textClass: 'text-blue-700',
                chipClass: 'bg-blue-50 border-blue-200 text-blue-700',
                warn: false,
            };
        case 'not_connected':
            return {
                label: 'Not connected',
                dotClass: 'bg-slate-300',
                textClass: 'text-slate-500',
                chipClass: 'bg-slate-50 border-slate-200 text-slate-500',
                warn: false,
            };
        case 'authorization_expired':
            return {
                label: 'Authorization expired',
                dotClass: 'bg-amber-500',
                textClass: 'text-amber-700',
                chipClass: 'bg-amber-50 border-amber-200 text-amber-700',
                warn: true,
            };
        case 'permission_required':
            return {
                label: 'Permission required',
                dotClass: 'bg-amber-500',
                textClass: 'text-amber-700',
                chipClass: 'bg-amber-50 border-amber-200 text-amber-700',
                warn: true,
            };
        case 'sync_failed':
            return {
                label: 'Sync failed',
                dotClass: 'bg-rose-500',
                textClass: 'text-rose-700',
                chipClass: 'bg-rose-50 border-rose-200 text-rose-700',
                warn: true,
            };
        case 'temporarily_unavailable':
        default:
            return {
                label: 'Temporarily unavailable',
                dotClass: 'bg-slate-400',
                textClass: 'text-slate-600',
                chipClass: 'bg-slate-50 border-slate-200 text-slate-600',
                warn: true,
            };
    }
}

function formatRelative(iso: string | null | undefined): string {
    if (!iso) return 'Never synced';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 'Never synced';
    const diff = Date.now() - then;
    if (diff < 0) return 'Just now';
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

function notificationSeverityClasses(sev: string | null | undefined): string {
    switch (sev) {
        case 'error':
            return 'bg-rose-50 border-rose-200 text-rose-700';
        case 'warning':
            return 'bg-amber-50 border-amber-200 text-amber-700';
        default:
            return 'bg-blue-50 border-blue-200 text-blue-700';
    }
}

function currentPageFromPath(pathname: string): { label: string; href: string } {
    const match = NAV_ITEMS.find(
        (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
    );
    if (match) return { label: match.label, href: match.href };
    return { label: 'Overview', href: '/admin/social' };
}

function InlineSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

function PlatformPill({
    account,
    connecting,
}: {
    account: PlatformAccount;
    connecting: boolean;
}) {
    const meta = PLATFORM_META[account.platform];
    const Icon = meta.icon;
    const effectiveStatus: ConnectionStatus = connecting ? 'connecting' : account.status;
    const sm = statusMeta(effectiveStatus);
    const displayAccount = account.account_name || account.display_name || account.username || null;

    return (
        <Link
            href={`/admin/social/accounts?platform=${account.platform}`}
            className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded px-2.5 py-2 transition min-w-0"
            title={
                sm.warn && account.error
                    ? account.error
                    : `${meta.label} — ${sm.label}`
            }
        >
            <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded ${meta.brand} shrink-0`}
            >
                <Icon className="w-4 h-4" />
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-slate-900 truncate">
                        {meta.label}
                    </span>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${sm.dotClass}`} />
                </span>
                <span className="block text-[13px] text-slate-500 truncate">
                    {effectiveStatus === 'connected' && displayAccount
                        ? displayAccount
                        : sm.label}
                </span>
                <span className="block text-[13px] text-slate-400 truncate">
                    {effectiveStatus === 'connected'
                        ? `Synced ${formatRelative(account.last_synced_at)}`
                        : sm.warn
                            ? 'Needs attention'
                            : 'Not linked'}
                </span>
            </span>

            {sm.warn && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
        </Link>
    );
}

function NotificationsMenu({
    notifications,
    loading,
    error,
}: {
    notifications: SocialNotification[];
    loading: boolean;
    error: string | null;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const count = notifications.length;

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="relative inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                aria-label="Notifications"
                aria-expanded={open}
            >
                <Bell className="w-4 h-4" />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[12px] leading-4 text-center font-medium">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-1.5 w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded shadow-lg z-40 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                        <span className="text-[12px] font-semibold text-slate-900">
                            Notifications
                        </span>
                        <Link
                            href="/admin/social/inbox-community"
                            onClick={() => setOpen(false)}
                            className="text-[13px] text-blue-950 hover:underline"
                        >
                            View inbox
                        </Link>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading && (
                            <div className="flex items-center gap-2 px-3 py-4 text-[13px] text-slate-500">
                                <InlineSpinner /> Loading notifications…
                            </div>
                        )}

                        {!loading && error && (
                            <div className="px-3 py-4 text-[13px] text-rose-700 bg-rose-50">
                                {error}
                            </div>
                        )}

                        {!loading && !error && count === 0 && (
                            <div className="px-3 py-6 text-center text-[13px] text-slate-500">
                                <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-500 mb-1.5" />
                                You&apos;re all caught up.
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            notifications.map((n) => {
                                const inner = (
                                    <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                        <span
                                            className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded border ${notificationSeverityClasses(
                                                n.severity,
                                            )} shrink-0`}
                                        >
                                            <AlertTriangle className="w-3 h-3" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[12px] font-medium text-slate-900 truncate">
                                                {n.title}
                                            </span>
                                            {n.body && (
                                                <span className="block text-[11px] text-slate-500 line-clamp-2">
                                                    {n.body}
                                                </span>
                                            )}
                                            {n.created_at && (
                                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                                    {formatRelative(n.created_at)}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                );
                                return n.href ? (
                                    <Link
                                        key={n.id}
                                        href={n.href}
                                        onClick={() => setOpen(false)}
                                        className="block"
                                    >
                                        {inner}
                                    </Link>
                                ) : (
                                    <div key={n.id}>{inner}</div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}

function QuickActions() {
    const actions = [
        { href: '/admin/social/content-studio?action=create', label: 'Create content', icon: PlusCircle },
        { href: '/admin/social/publishing-calendar?action=schedule', label: 'Schedule post', icon: CalendarDays },
        { href: '/admin/social/inbox-community', label: 'View messages', icon: MessageSquare },
        { href: '/admin/social/accounts?action=connect', label: 'Connect account', icon: UserPlus },
    ];

    return (
        <div className="flex items-center gap-1.5">
            {actions.map((a) => {
                const Icon = a.icon;
                return (
                    <Link
                        key={a.href}
                        href={a.href}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-medium text-slate-700 transition"
                        title={a.label}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">{a.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}

function SocialLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || '/admin/social';
    const router = useRouter();

    const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [accountsError, setAccountsError] = useState<string | null>(null);

    const [notifications, setNotifications] = useState<SocialNotification[]>([]);
    const [notifLoading, setNotifLoading] = useState(true);
    const [notifError, setNotifError] = useState<string | null>(null);

    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLInputElement | null>(null);

    const currentPage = currentPageFromPath(pathname);
    const isOverviewPath =
        pathname === '/admin/social' || pathname === '/admin/social/overview';

    const loadAccounts = useCallback(async () => {
        setAccountsError(null);
        try {
            const res = await ((api as any).social?.accounts?.list ? (api as any).social.accounts.list() : (api as any).getSocialAccounts?.());
            const list: PlatformAccount[] = Array.isArray(res?.accounts)
                ? res.accounts
                : [];
            const byPlatform = new Map<PlatformKey, PlatformAccount>();
            for (const a of list) {
                if (a && PLATFORM_ORDER.includes(a.platform)) {
                    const existing = byPlatform.get(a.platform);
                    if (!existing || (existing.status !== 'connected' && a.status === 'connected')) {
                        byPlatform.set(a.platform, a);
                    }
                }
            }
            const normalized: PlatformAccount[] = PLATFORM_ORDER.map(
                (p) =>
                    byPlatform.get(p) ?? {
                        platform: p,
                        status: 'not_connected',
                        account_name: null,
                        last_synced_at: null,
                    },
            );
            setAccounts(normalized);
        } catch (err) {
            if (err instanceof ApiError) {
                setAccountsError(
                    typeof err.data === 'object' &&
                        err.data &&
                        'detail' in err.data &&
                        typeof (err.data as { detail: unknown }).detail === 'string'
                        ? (err.data as { detail: string }).detail
                        : 'Could not load account connections.',
                );
            } else {
                setAccountsError('Could not load account connections.');
            }
            setAccounts(null);
        } finally {
            setAccountsLoading(false);
        }
    }, []);

    const loadNotifications = useCallback(async () => {
        setNotifError(null);
        try {
            const res = await (api as any).social?.notifications?.list?.({}) ?? await (api as any).social?.notifications?.({}) ?? { notifications: [] };
            const list: SocialNotification[] = Array.isArray(res?.notifications)
                ? res.notifications
                : Array.isArray(res?.results)
                    ? res.results
                    : [];
            setNotifications(list);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setNotifications([]);
                setNotifError(null);
            } else {
                setNotifError('Could not load notifications.');
                setNotifications([]);
            }
        } finally {
            setNotifLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccounts();
        void loadNotifications();
    }, [loadAccounts, loadNotifications]);

    useEffect(() => {
        if (pathname.startsWith('/admin/social/accounts')) {
            void loadAccounts();
        }
    }, [pathname, loadAccounts]);

    useEffect(() => {
        if (searchOpen) searchRef.current?.focus();
    }, [searchOpen]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        setRefreshError(null);
        try {
            const sync = (api as any).social?.syncSocialAccounts ?? (api as any).syncSocialAccounts;
            if (typeof sync === 'function') {
                await sync();
            }
            await Promise.all([loadAccounts(), loadNotifications()]);
        } catch (err) {
            if (err instanceof ApiError) {
                setRefreshError(
                    typeof err.data === 'object' &&
                        err.data &&
                        'detail' in err.data &&
                        typeof (err.data as { detail: unknown }).detail === 'string'
                        ? (err.data as { detail: string }).detail
                        : 'Refresh failed. Please try again.',
                );
            } else {
                setRefreshError('Refresh failed. Please try again.');
            }
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        router.push(`/admin/social/content-studio?q=${encodeURIComponent(q)}`);
        setSearchOpen(false);
        setSearchQuery('');
    };

    const accountsSummary = useMemo(() => {
        if (!accounts) return null;
        const connected = accounts.filter((a) => a.status === 'connected').length;
        const attention = accounts.filter(
            (a) =>
                a.status === 'authorization_expired' ||
                a.status === 'permission_required' ||
                a.status === 'sync_failed',
        ).length;
        return { connected, attention, total: accounts.length };
    }, [accounts]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-4 py-3 sm:py-4 space-y-2">
                <header className="bg-white border border-slate-200 rounded p-3 sm:p-4 space-y-2">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="min-w-0">
                            <nav
                                className="flex items-center gap-1 text-[13px] text-slate-500 flex-wrap"
                                aria-label="Breadcrumb"
                            >
                                <Link
                                    href="/admin"
                                    className="hover:text-slate-800"
                                >
                                    Dashboard
                                </Link>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <Link
                                    href="/admin/social"
                                    className="hover:text-slate-800"
                                >
                                    Social Media Management
                                </Link>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span className="text-slate-700 font-medium truncate">
                                    {currentPage.label}
                                </span>
                            </nav>

                            <h1 className="mt-1 text-[18px] font-semibold text-slate-900">
                                Social Media Management
                            </h1>
                            <p className="text-[12px] sm:text-[13px] text-slate-500">
                                Manage your social accounts, content, campaigns
                                and performance.
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                            {searchOpen ? (
                                <form
                                    onSubmit={handleSearchSubmit}
                                    className="flex items-center gap-1"
                                >
                                    <input
                                        ref={searchRef}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onBlur={() => {
                                            if (!searchQuery.trim()) setSearchOpen(false);
                                        }}
                                        placeholder="Search content, campaigns…"
                                        className="w-44 sm:w-56 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                                    />
                                    <button
                                        type="submit"
                                        className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                        aria-label="Submit search"
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setSearchOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[12px] text-slate-600"
                                    aria-label="Open search"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Search</span>
                                </button>
                            )}

                            <NotificationsMenu
                                notifications={notifications}
                                loading={notifLoading}
                                error={notifError}
                            />

                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Refresh"
                                title={
                                    refreshError ??
                                    'Refresh account connections and notifications'
                                }
                            >
                                {refreshing ? (
                                    <InlineSpinner />
                                ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                )}
                            </button>

                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white">
                                <Activity className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[11px] text-slate-600">
                                    {accountsLoading || !accountsSummary
                                        ? 'Checking accounts…'
                                        : `${accountsSummary.connected}/${accountsSummary.total} connected`}
                                </span>
                                {accountsSummary && accountsSummary.attention > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                                        <AlertTriangle className="w-3 h-3" />
                                        {accountsSummary.attention} need attention
                                    </span>
                                )}
                            </div>

                            <Link
                                href="/admin/settings"
                                className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                aria-label="Settings"
                                title="Settings"
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </Link>

                            <Link
                                href="/admin/help"
                                className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                aria-label="Help"
                                title="Help"
                            >
                                <HelpCircle className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {refreshError && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700">
                            {refreshError}
                        </div>
                    )}

                    <div>
                        {accountsLoading && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                {PLATFORM_ORDER.map((p) => (
                                    <div
                                        key={p}
                                        className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2.5 py-2 animate-pulse"
                                    >
                                        <span className="w-7 h-7 rounded bg-slate-100" />
                                        <span className="min-w-0 flex-1 space-y-1">
                                            <span className="block h-2.5 w-16 bg-slate-100 rounded" />
                                            <span className="block h-2 w-24 bg-slate-100 rounded" />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!accountsLoading && accountsError && (
                            <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-[12px] text-amber-800">
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{accountsError}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAccountsLoading(true);
                                        void loadAccounts();
                                    }}
                                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 bg-white hover:bg-amber-50 text-[11px] font-medium text-amber-800"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Retry
                                </button>
                            </div>
                        )}

                        {!accountsLoading && !accountsError && accounts && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                {accounts.map((a) => (
                                    <PlatformPill
                                        key={a.platform}
                                        account={a}
                                        connecting={refreshing && a.status !== 'connected'}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                <nav
                    className="bg-white border border-slate-200 rounded overflow-x-auto"
                    aria-label="Social Media Management sections"
                >
                    <ul className="flex items-stretch min-w-max">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const active =
                                pathname === item.href ||
                                pathname.startsWith(`${item.href}/`);
                            return (
                                <li key={item.href} className="flex-1 min-w-fit">
                                    <Link
                                        href={item.href}
                                        aria-current={active ? 'page' : undefined}
                                        className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition whitespace-nowrap ${active
                                            ? 'text-blue-950 border-blue-950 bg-slate-50'
                                            : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        <span className="hidden sm:inline">
                                            {item.label}
                                        </span>
                                        <span className="sm:hidden">
                                            {item.shortLabel}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="bg-white border border-slate-200 rounded px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-950" />
                        <span className="text-[12px] font-medium text-slate-700">
                            Quick actions
                        </span>
                    </div>
                    <QuickActions />
                </div>

                <main className="min-w-0">
                    {children ? (
                        children
                    ) : (
                        <div className="bg-white border border-slate-200 rounded p-6 text-center">
                            <CircleDashed className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                            <p className="text-[13px] text-slate-600">
                                This section is not available.
                            </p>
                            {!isOverviewPath && (
                                <Link
                                    href="/admin/social"
                                    className="inline-block mt-2 text-[13px] font-medium text-blue-950 hover:underline"
                                >
                                    Return to overview
                                </Link>
                            )}
                        </div>
                    )}
                </main>

                <footer className="text-center text-[13px] text-slate-400 py-2">
                    <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Platform data reflects the last successful synchronization.
                    </span>
                </footer>
            </div>
        </div>
    );
}

export default function SocialLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    <div className="flex items-center gap-2 text-slate-500 text-[13px]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Social Media Management…
                    </div>
                </div>
            }
        >
            <SocialLayoutContent>{children}</SocialLayoutContent>
        </Suspense>
    );
}