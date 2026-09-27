'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Bell, Package, Truck, Tag, ShieldCheck, CheckCircle2, Check, Info, AlertCircle
} from 'lucide-react';

type NotifType = 'order' | 'shipping' | 'promo' | 'security' | 'system';

interface Notification {
    id: string;
    type: NotifType;
    title: string;
    body: string;
    date: string; // ISO
    read: boolean;
    href?: string;
}

const INITIAL: Notification[] = [
    {
        id: 'n1',
        type: 'order',
        title: 'Order confirmed',
        body: 'Your order ORD-2026-04812 (Sony WH-1000XM5) has been confirmed. Payment via M-Pesa received.',
        date: '2026-09-18T10:26:00Z',
        read: false,
        href: '/pages/account/orders',
    },
    {
        id: 'n2',
        type: 'shipping',
        title: 'Out for delivery',
        body: 'Order ORD-2026-04694 is out for delivery with Glovo. Expected today before 6 PM.',
        date: '2026-09-22T09:00:00Z',
        read: false,
        href: '/pages/account/orders',
    },
    {
        id: 'n3',
        type: 'promo',
        title: 'Flash deal: 17% off Xiaomi Mi Band 7',
        body: 'Limited-time offer on fitness trackers. Ends in 48 hours.',
        date: '2026-09-21T15:30:00Z',
        read: false,
        href: '/pages/products/specialdeals',
    },
    {
        id: 'n4',
        type: 'security',
        title: 'New login detected',
        body: 'We noticed a new sign-in from a Chrome browser on Nairobi. If this wasn\'t you, secure your account.',
        date: '2026-09-20T11:10:00Z',
        read: true,
        href: '/pages/account/settings',
    },
    {
        id: 'n5',
        type: 'order',
        title: 'Order delivered',
        body: 'Order ORD-2026-04510 has been delivered. Thanks for shopping with us!',
        date: '2026-08-31T12:20:00Z',
        read: true,
        href: '/pages/account/orders',
    },
    {
        id: 'n6',
        type: 'system',
        title: 'Your account is verified',
        body: 'Your email and phone number are now verified. Enjoy faster checkout.',
        date: '2026-03-14T08:00:00Z',
        read: true,
    },
];

const ICONS: Record<NotifType, { Icon: any; tint: string }> = {
    order: { Icon: Package, tint: 'bg-blue-50 text-blue-950' },
    shipping: { Icon: Truck, tint: 'bg-indigo-50 text-indigo-900' },
    promo: { Icon: Tag, tint: 'bg-rose-50 text-rose-900' },
    security: { Icon: ShieldCheck, tint: 'bg-amber-50 text-amber-900' },
    system: { Icon: Info, tint: 'bg-slate-100 text-slate-700' },
};

function groupLabel(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'This week';
    if (diffDays <= 30) return 'This month';
    return 'Earlier';
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL);
    const [filter, setFilter] = useState<'All' | 'Unread'>('All');
    const [toast, setToast] = useState<string | null>(null);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    };

    const visible = notifications.filter((n) => (filter === 'Unread' ? !n.read : true));

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Group by date label
    const groups: { label: string; items: Notification[] }[] = [];
    for (const n of visible) {
        const label = groupLabel(n.date);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(n);
        else groups.push({ label, items: [n] });
    }

    const markRead = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        flash('All notifications marked as read.');
    };

    const clearAll = () => {
        setNotifications([]);
        flash('Notifications cleared.');
    };

    return (
        <div className="space-y-5">
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {toast}
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
                        {unreadCount > 0
                            ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                            : 'You\'re all caught up'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="inline-flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-2 rounded-sm text-xs"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* Filter tabs */}
            <div className="bg-white border border-slate-200 rounded-sm p-3 flex items-center gap-1.5">
                {(['All', 'Unread'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            filter === tab
                                ? 'bg-blue-950 text-white'
                                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        {tab}{tab === 'Unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                    </button>
                ))}
            </div>

            {/* Empty state */}
            {visible.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                    <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-sm font-semibold text-slate-900">
                        {filter === 'Unread' ? 'No unread notifications' : 'No notifications yet'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        We'll notify you here about orders, deliveries, and offers.
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {groups.map((group) => (
                        <section key={group.label}>
                            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 px-1">
                                {group.label}
                            </h2>
                            <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
                                {group.items.map((n) => {
                                    const { Icon, tint } = ICONS[n.type];
                                    const Wrapper: any = n.href ? Link : 'div';
                                    return (
                                        <li key={n.id}>
                                            <Wrapper
                                                href={n.href ?? '#'}
                                                onClick={() => markRead(n.id)}
                                                className={`flex items-start gap-3 p-4 transition-colors ${
                                                    n.read ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50'
                                                }`}
                                            >
                                                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-xs ${n.read ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>
                                                            {n.title}
                                                        </p>
                                                        {!n.read && (
                                                            <span className="h-2 w-2 rounded-full bg-blue-950 shrink-0 mt-1" aria-label="unread" />
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                                        {n.body}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                                        {new Date(n.date).toLocaleString('en-KE', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            </Wrapper>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}