'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Bell, Package, Truck, Tag, ShieldCheck, CheckCircle2, Check, Info,
    AlertCircle, Loader2, Star, Trash2, X,
    type LucideIcon,
} from 'lucide-react';
import {
    accountApi,
    ApiError,
    type NotificationRow,
    type NotificationType,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Icon map
// ─────────────────────────────────────────────────────────────────────────────
// Every member of NotificationType has an entry — TS flags the Record as
// incomplete if a new type is added to the union and this map is missed.
// At runtime, `ICONS[n.type] ?? ICONS.system` guards against an older
// backend that sends a `type` the frontend doesn't know yet.
const ICONS: Record<NotificationType, { Icon: LucideIcon; tint: string }> = {
    order: { Icon: Package, tint: 'bg-blue-50 text-blue-950' },
    shipping: { Icon: Truck, tint: 'bg-indigo-50 text-indigo-900' },
    promo: { Icon: Tag, tint: 'bg-rose-50 text-rose-900' },
    security: { Icon: ShieldCheck, tint: 'bg-amber-50 text-amber-900' },
    system: { Icon: Info, tint: 'bg-slate-100 text-slate-700' },
    review: { Icon: Star, tint: 'bg-orange-50 text-orange-900' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function groupLabel(dateStr: string): string {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Earlier';

    const today = new Date();
    const diffMs = today.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Today';        // future timestamps → treat as today
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'This week';
    if (diffDays <= 30) return 'This month';
    return 'Earlier';
}

function iconFor(type: NotificationType): { Icon: LucideIcon; tint: string } {
    return ICONS[type] ?? ICONS.system;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filter, setFilter] = useState<'All' | 'Unread'>('All');
    const [toast, setToast] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    };

    // ── Initial fetch ──
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const list = await accountApi.notifications.list();
                if (cancelled) return;
                setNotifications(list);
            } catch (err) {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiError
                        ? err.message || 'Could not load your notifications.'
                        : 'Could not load your notifications.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Derived ──
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const visible = useMemo(
        () =>
            notifications.filter((n) =>
                filter === 'Unread' ? !n.is_read : true,
            ),
        [notifications, filter],
    );

    const groups = useMemo(() => {
        const out: { label: string; items: NotificationRow[] }[] = [];
        for (const n of visible) {
            const label = groupLabel(n.created_at);
            const last = out[out.length - 1];
            if (last && last.label === label) last.items.push(n);
            else out.push({ label, items: [n] });
        }
        return out;
    }, [visible]);

    // ── Actions ──

    /**
     * Optimistic mark-read with rollback. Used for notifications that
     * don't navigate — a failed rollback is visible on the row and worth
     * surfacing.
     */
    const markRead = async (id: number) => {
        const target = notifications.find((n) => n.id === id);
        if (!target || target.is_read) return;

        const previous = notifications;
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === id
                    ? { ...n, is_read: true, read_at: new Date().toISOString() }
                    : n,
            ),
        );

        try {
            await accountApi.notifications.markRead(id);
        } catch {
            setNotifications(previous);
            flash('Could not mark as read.');
        }
    };

    /**
     * Fire-and-forget mark-read. Used when the row navigates away — the
     * component unmounts, so a rollback would run on nothing. If the
     * call fails the notification just stays unread on the next visit.
     */
    const markReadSilent = (id: number) => {
        const target = notifications.find((n) => n.id === id);
        if (!target || target.is_read) return;
        void accountApi.notifications.markRead(id).catch(() => {
            /* the page is navigating away; nothing to do */
        });
    };

    const markAllRead = async () => {
        if (busy) return;
        setBusy(true);

        const previous = notifications;
        const now = new Date().toISOString();
        setNotifications((prev) =>
            prev.map((n) =>
                n.is_read ? n : { ...n, is_read: true, read_at: now },
            ),
        );

        try {
            await accountApi.notifications.markAllRead();
            flash('All notifications marked as read.');
        } catch {
            setNotifications(previous);
            flash('Could not mark all as read.');
        } finally {
            setBusy(false);
        }
    };

    /**
     * Delete one notification. Optimistic — the row disappears
     * immediately; on failure it returns and a toast explains why.
     *
     * `stopPropagation` matters here: the row is often wrapped in a
     * `<Link>` when `href` is set, and without it the click would
     * navigate before the delete resolved.
     */
    const removeOne = async (
        e: React.MouseEvent<HTMLButtonElement>,
        id: number,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        if (removingId !== null) return;

        setRemovingId(id);
        const previous = notifications;
        setNotifications((prev) => prev.filter((n) => n.id !== id));

        try {
            await accountApi.notifications.remove(id);
            flash('Notification dismissed.');
        } catch {
            setNotifications(previous);
            flash('Could not dismiss the notification.');
        } finally {
            setRemovingId(null);
        }
    };

    const confirmClearAll = async () => {
        if (busy) return;
        setBusy(true);

        const previous = notifications;
        setNotifications([]);
        setClearConfirmOpen(false);

        try {
            await accountApi.notifications.clearAll();
            flash('Notifications cleared.');
        } catch {
            setNotifications(previous);
            flash('Could not clear notifications.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-5">
            {toast && (
                <div className="fixed bottom-6 right-6 z-[80] bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-start gap-2 max-w-md">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{toast}</span>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="h-5 w-5 text-blue-950" />
                        Notifications
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isLoading
                            ? 'Loading…'
                            : unreadCount > 0
                                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                                : "You're all caught up"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={markAllRead}
                            disabled={busy}
                            aria-busy={busy}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setClearConfirmOpen(true)}
                            disabled={busy}
                            aria-busy={busy}
                            className="inline-flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* Load error */}
            {loadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {loadError}
                </div>
            )}

            {/* Filter tabs */}
            <div className="bg-white border border-slate-200 rounded-sm p-3 flex items-center gap-1.5">
                {(['All', 'Unread'] as const).map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setFilter(tab)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === tab
                            ? 'bg-blue-950 text-white'
                            : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                    >
                        {tab}
                        {tab === 'Unread' && unreadCount > 0
                            ? ` (${unreadCount})`
                            : ''}
                    </button>
                ))}
            </div>

            {/* Loading skeleton */}
            {isLoading ? (
                <div className="space-y-5">
                    {[0, 1].map((g) => (
                        <section key={g}>
                            <div className="h-3 w-20 bg-slate-200 rounded mb-2 mx-1 animate-pulse" />
                            <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                                {[0, 1, 2].map((i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-3 p-4 animate-pulse"
                                    >
                                        <span className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 w-1/3 bg-slate-200 rounded" />
                                            <div className="h-3 w-full bg-slate-200 rounded" />
                                            <div className="h-2 w-24 bg-slate-200 rounded" />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            ) : visible.length === 0 ? (
                /* Empty state */
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                    <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-sm font-semibold text-slate-900">
                        {filter === 'Unread'
                            ? 'No unread notifications'
                            : 'No notifications yet'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        We&apos;ll notify you here about orders, deliveries, and
                        offers.
                    </p>
                </div>
            ) : (
                /* Grouped list */
                <div className="space-y-5">
                    {groups.map((group) => (
                        <section key={group.label}>
                            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 px-1">
                                {group.label}
                            </h2>
                            <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                                {group.items.map((n) => {
                                    const { Icon, tint } = iconFor(n.type);
                                    const isRemoving = removingId === n.id;

                                    const content = (
                                        <>
                                            <span
                                                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tint}`}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p
                                                        className={`text-xs ${n.is_read
                                                            ? 'font-medium text-slate-800'
                                                            : 'font-bold text-slate-900'
                                                            }`}
                                                    >
                                                        {n.title}
                                                    </p>
                                                    {!n.is_read && (
                                                        <span
                                                            className="h-2 w-2 rounded-full bg-blue-950 shrink-0 mt-1"
                                                            aria-label="unread"
                                                        />
                                                    )}
                                                </div>
                                                {n.body && (
                                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                                        {n.body}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-slate-400 mt-1.5">
                                                    {new Date(
                                                        n.created_at,
                                                    ).toLocaleString('en-KE', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                        </>
                                    );

                                    const rowClass = `flex items-start gap-3 p-4 transition-colors ${n.is_read
                                        ? 'hover:bg-slate-50'
                                        : 'bg-blue-50/40 hover:bg-blue-50'
                                        } ${isRemoving ? 'opacity-50' : ''}`;

                                    return (
                                        <li
                                            key={n.id}
                                            className="relative group"
                                        >
                                            {n.href ? (
                                                <Link
                                                    href={n.href}
                                                    onClick={() =>
                                                        markReadSilent(n.id)
                                                    }
                                                    className={rowClass}
                                                >
                                                    {content}
                                                </Link>
                                            ) : (
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => markRead(n.id)}
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === 'Enter' ||
                                                            e.key === ' '
                                                        ) {
                                                            e.preventDefault();
                                                            markRead(n.id);
                                                        }
                                                    }}
                                                    className={`${rowClass} cursor-pointer`}
                                                >
                                                    {content}
                                                </div>
                                            )}

                                            {/* Dismiss button — floats on the
                                                right edge, visible on hover
                                                (or always on touch devices
                                                via the focus-within class). */}
                                            <button
                                                type="button"
                                                onClick={(e) =>
                                                    removeOne(e, n.id)
                                                }
                                                disabled={isRemoving}
                                                aria-label="Dismiss notification"
                                                className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-sm bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40 z-10"
                                            >
                                                {isRemoving ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <X className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {/* Clear-all confirm */}
            {clearConfirmOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
                    onClick={() =>
                        !busy && setClearConfirmOpen(false)
                    }
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="bg-white border border-slate-200 rounded-sm shadow-2xl w-full max-w-md p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <span className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                <Trash2 className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900">
                                    Clear all notifications?
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    This permanently removes all{' '}
                                    <span className="font-medium text-slate-700">
                                        {notifications.length}
                                    </span>{' '}
                                    notification
                                    {notifications.length === 1 ? '' : 's'} from
                                    your account. This cannot be undone.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setClearConfirmOpen(false)}
                                disabled={busy}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmClearAll}
                                disabled={busy}
                                aria-busy={busy}
                                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {busy ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Clearing…
                                    </>
                                ) : (
                                    'Clear all'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}