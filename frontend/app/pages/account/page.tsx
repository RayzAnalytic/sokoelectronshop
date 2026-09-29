'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Package, Heart, Truck, Sparkles, ArrowRight, MapPin, Phone, Mail,
    Loader2, AlertCircle,
} from 'lucide-react';
import {
    accountApi,
    ApiError,
    type Me,
    type Address,
} from '@/lib/api';

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

const statusColor = (status: string): string => {
    switch (status) {
        case 'Delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Shipped':
            return 'bg-blue-50 text-blue-900 border-blue-200';
        case 'Cancelled':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'Pending':
        default:
            return 'bg-amber-50 text-amber-700 border-amber-200';
    }
};

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountOverview() {
    const [user, setUser] = useState<Me | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
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

                // The overview endpoint returns a partial user; fill in the
                // required Me fields with sensible defaults.
                setUser({
                    id: data.user.id,
                    email: data.user.email,
                    first_name: data.user.first_name,
                    last_name: data.user.last_name,
                    role: 'CUSTOMER',
                    status: 'ACTIVE',
                    is_email_verified: true,
                    redirect_to: '/pages/account',
                    joined_at: data.user.joined_at ?? undefined,
                    default_address: data.default_address,
                });

                setAddresses(
                    data.default_address ? [data.default_address] : [],
                );

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

    // ── Default address — prefer the flagged one, fall back to first ──
    const defaultAddress = useMemo(() => {
        if (addresses.length === 0) return null;
        return addresses.find((a) => a.is_default) ?? addresses[0];
    }, [addresses]);

    // ── Derived display values ──
    const displayName = (user?.first_name || '').trim() || 'there';
    const userEmail = user?.email ?? '';
    const userPhone = defaultAddress?.phone ?? '';
    const joinedAt = user?.joined_at ?? null;

    const memberSince = joinedAt
        ? new Date(joinedAt).toLocaleDateString('en-KE', {
            month: 'long',
            year: 'numeric',
        })
        : null;

    // ── Stats — read from the endpoint ──
    const totalOrders = stats?.total_orders ?? 0;
    const inTransit = stats?.in_transit ?? 0;
    const wishlistCount = stats?.wishlist_count ?? 0;
    const loyaltyPoints = 0; // placeholder — no Loyalty model yet

    const statCards = [
        {
            label: 'Total Orders',
            value: totalOrders,
            icon: Package,
            tint: 'bg-blue-50 text-blue-950',
        },
        {
            label: 'In Transit',
            value: inTransit,
            icon: Truck,
            tint: 'bg-indigo-50 text-indigo-900',
        },
        {
            label: 'Wishlist Items',
            value: wishlistCount,
            icon: Heart,
            tint: 'bg-rose-50 text-rose-900',
        },
        {
            label: 'Loyalty Points',
            value: loyaltyPoints,
            icon: Sparkles,
            tint: 'bg-amber-50 text-amber-900',
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

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(({ label, value, icon: Icon, tint }) => (
                    <div
                        key={label}
                        className="bg-white border border-slate-200 rounded-sm p-4"
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
                    </div>
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
                    <div className="p-8 text-center text-xs text-slate-500">
                        No orders yet.
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
                                        <span className="text-xs font-semibold text-slate-900">
                                            {order.id}
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
                                        href="/pages/account/orders"
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
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {userEmail || '—'}
                        </li>
                        <li className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {userPhone || 'Add a phone via your default address'}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}