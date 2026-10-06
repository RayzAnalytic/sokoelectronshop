'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Package, Heart, Truck, Star, ArrowRight, MapPin, Phone, Mail,
    Loader2, AlertCircle, Sparkles,
} from 'lucide-react';
import { accountApi, ApiError, type Address } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatKES = (n: number | string): string => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (!Number.isFinite(num)) return 'KES 0';
    return `KES ${num.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
};

/**
 * Backend sends `o.get_status_display()` values: "Pending", "Confirmed",
 * "Processing", "Shipped", "Delivered", "Cancelled".
 */
const statusColor = (status: string): string => {
    switch (status) {
        case 'Delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Shipped':
            return 'bg-blue-50 text-blue-900 border-blue-200';
        case 'Processing':
            return 'bg-indigo-50 text-indigo-900 border-indigo-200';
        case 'Confirmed':
            return 'bg-sky-50 text-sky-900 border-sky-200';
        case 'Cancelled':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'Pending':
        default:
            return 'bg-amber-50 text-amber-700 border-amber-200';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Local view types
// ─────────────────────────────────────────────────────────────────────────────
interface OverviewUser {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    joined_at: string | null;
}

interface OverviewRecentOrder {
    id: string;
    date: string;
    status: string;
    itemCount: number;
    total: number;
}

interface OverviewStats {
    total_orders: number;
    in_transit: number;
    wishlist_count: number;
    unread_notifications: number;
    pending_reviews: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountOverview() {
    const [user, setUser] = useState<OverviewUser | null>(null);
    const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
    const [recentOrders, setRecentOrders] = useState<OverviewRecentOrder[]>([]);
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // ── Load everything the overview page needs — single call ──
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const data = await accountApi.overview();
                if (cancelled) return;

                setUser({
                    id: data.user.id,
                    email: data.user.email,
                    first_name: data.user.first_name,
                    last_name: data.user.last_name,
                    // Fallback for older API responses that don't yet
                    // include `phone`. Once the serializer ships it,
                    // this `?? ''` never fires.
                    phone: (data.user as { phone?: string }).phone ?? '',
                    joined_at: data.user.joined_at,
                });

                setDefaultAddress(data.default_address ?? null);

                setRecentOrders(
                    (data.recent_orders || []).map((o) => ({
                        id: o.id,
                        date: o.date,
                        status: o.status,
                        itemCount: o.itemCount,
                        total: parseFloat(o.total),
                    })),
                );

                setStats(data.stats);
            } catch (err) {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiError
                        ? err.message || 'Could not load your account.'
                        : 'Could not load your account.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Derived display values ──
    const displayName = (user?.first_name || '').trim() || 'there';
    const userEmail = user?.email ?? '';
    // Phone precedence: profile → default address → empty. A customer
    // who has a phone on their account but no saved address sees their
    // phone; one with neither sees the "Add a phone number" link.
    const userPhone = user?.phone || defaultAddress?.phone || '';
    const joinedAt = user?.joined_at ?? null;

    const memberSince = joinedAt
        ? new Date(joinedAt).toLocaleDateString('en-KE', {
            month: 'long',
            year: 'numeric',
        })
        : null;

    // ── Stats with defaults ──
    const totalOrders = stats?.total_orders ?? 0;
    const inTransit = stats?.in_transit ?? 0;
    const wishlistCount = stats?.wishlist_count ?? 0;
    const pendingReviews = stats?.pending_reviews ?? 0;

    // ── Stat cards — each links to its destination page ──
    const statCards = [
        {
            label: 'Total Orders',
            value: totalOrders,
            icon: Package,
            tint: 'bg-blue-50 text-blue-950',
            href: '/pages/account/orders',
        },
        {
            label: 'In Transit',
            value: inTransit,
            icon: Truck,
            tint: 'bg-indigo-50 text-indigo-900',
            href: '/pages/account/orders',
        },
        {
            label: 'Wishlist Items',
            value: wishlistCount,
            icon: Heart,
            tint: 'bg-rose-50 text-rose-900',
            href: '/pages/account/wishlist',
        },
        {
            label: 'Awaiting Reviews',
            value: pendingReviews,
            icon: Star,
            tint: 'bg-amber-50 text-amber-900',
            href: '/pages/account/reviews',
        },
    ];

    // ── Loading skeleton ──
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-sm p-6">
                    <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-6 w-48 bg-slate-200 rounded mt-3 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="bg-white border border-slate-200 rounded-sm p-4 space-y-3 animate-pulse"
                        >
                            <div className="w-9 h-9 rounded-sm bg-slate-200" />
                            <div className="h-5 w-12 bg-slate-200 rounded" />
                            <div className="h-3 w-20 bg-slate-200 rounded" />
                        </div>
                    ))}
                </div>
                <div className="bg-white border border-slate-200 rounded-sm p-8 text-center text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Loading your account…
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Load error banner */}
            {loadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {loadError}
                </div>
            )}

            {/* Review prompt — soft nudge, only when there's something to review */}
            {pendingReviews > 0 && (
                <Link
                    href="/pages/account/reviews"
                    className="block bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300 rounded-sm p-4 transition-colors group"
                >
                    <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                                {pendingReviews === 1
                                    ? '1 item is waiting for your review'
                                    : `${pendingReviews} items are waiting for your review`}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                                Share your experience and help other shoppers decide.
                            </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-amber-700 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </Link>
            )}

            {/* Greeting */}
            <div className="bg-white border border-slate-200 rounded-sm p-6">
                <p className="text-sm text-slate-500">Welcome back,</p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    Hi, {displayName} 👋
                </h1>
                {memberSince && (
                    <p className="text-xs text-slate-500 mt-1">
                        Member since {memberSince}
                    </p>
                )}
            </div>

            {/* Stats — each card links to its page */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(({ label, value, icon: Icon, tint, href }) => (
                    <Link
                        key={label}
                        href={href}
                        className="bg-white border border-slate-200 rounded-sm p-4 hover:border-blue-200 hover:shadow-sm transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span
                                className={`w-9 h-9 rounded-sm flex items-center justify-center ${tint}`}
                            >
                                <Icon className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="text-xl font-bold text-slate-900">
                            {value.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </Link>
                ))}
            </div>

            {/* Recent Orders */}
            <div className="bg-white border border-slate-200 rounded-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-900">
                        Recent Orders
                    </h2>
                    <Link
                        href="/pages/account/orders"
                        className="text-xs font-medium text-blue-950 hover:underline inline-flex items-center gap-1"
                    >
                        View all <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-8 text-center">
                        <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">
                            You haven&apos;t placed any orders yet.
                        </p>
                        <Link
                            href="/pages/products"
                            className="mt-3 inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
                        >
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {recentOrders.map((order) => (
                            <li
                                key={order.id}
                                className="p-4 flex items-center justify-between gap-4"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-900 font-mono">
                                            #{order.id}
                                        </span>
                                        <span
                                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusColor(
                                                order.status,
                                            )}`}
                                        >
                                            {order.status}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                                        {order.itemCount} item
                                        {order.itemCount > 1 ? 's' : ''} •{' '}
                                        {new Date(order.date).toLocaleDateString(
                                            'en-KE',
                                            {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            },
                                        )}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-slate-900">
                                        {formatKES(order.total)}
                                    </p>
                                    <Link
                                        href={`/pages/account/orders?ref=${encodeURIComponent(order.id)}`}
                                        className="text-[11px] text-blue-950 hover:underline"
                                    >
                                        View
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Two columns: default address + account details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-500" /> Default
                            Address
                        </h2>
                        <Link
                            href="/pages/account/addresses"
                            className="text-xs text-blue-950 hover:underline"
                        >
                            Edit
                        </Link>
                    </div>

                    {defaultAddress ? (
                        <>
                            <p className="text-xs text-slate-700 leading-relaxed">
                                <span className="font-semibold text-slate-900">
                                    {defaultAddress.full_name}
                                </span>
                                <br />
                                {defaultAddress.street}
                                <br />
                                {defaultAddress.town}
                                {defaultAddress.county
                                    ? `, ${defaultAddress.county}`
                                    : ''}
                                {defaultAddress.postal_code
                                    ? ` ${defaultAddress.postal_code}`
                                    : ''}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {defaultAddress.phone}
                            </p>
                        </>
                    ) : (
                        <div className="text-xs text-slate-500 leading-relaxed">
                            No address saved yet.{' '}
                            <Link
                                href="/pages/account/addresses"
                                className="text-blue-950 hover:underline font-medium"
                            >
                                Add one →
                            </Link>
                        </div>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-slate-900">
                            Account Details
                        </h2>
                        <Link
                            href="/pages/account/settings"
                            className="text-xs text-blue-950 hover:underline"
                        >
                            Edit
                        </Link>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700">
                        <li className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{userEmail || '—'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {userPhone ? (
                                <span>{userPhone}</span>
                            ) : (
                                <Link
                                    href="/pages/account/settings"
                                    className="text-blue-950 hover:underline"
                                >
                                    Add a phone number
                                </Link>
                            )}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}