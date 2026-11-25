'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    ShoppingBag,
    UserRound,
    Megaphone,
    Wallet,
} from 'lucide-react';

type NavItem = {
    id: string;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
};

const BASE = '/admin/tiktok';

const NAV: NavItem[] = [
    { id: 'overview', label: 'Overview', href: `${BASE}/BusinessOverview`, icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', href: `${BASE}/CustomersLeadsInbox`, icon: Users },
    { id: 'orders', label: 'Orders', href: `${BASE}/OrdersProductsFulfillment`, icon: ShoppingBag },
    { id: 'creators', label: 'Creators', href: `${BASE}/CreatorsAffiliates`, icon: UserRound },
    { id: 'marketing', label: 'Marketing', href: `${BASE}/MarketingContentCampaigns`, icon: Megaphone },
    { id: 'finance', label: 'Finance', href: `${BASE}/FinanceAnalyticsSettings`, icon: Wallet },
];

const cn = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(' ');

function TikTokLogo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden="true"
        >
            <path
                d="M20.5 7.5a6.8 6.8 0 0 1-3.2-.8v7.5a5.6 5.6 0 1 1-5.6-5.6c.24 0 .47.02.7.05v2.87a2.85 2.85 0 0 0-2.15 2.75 2.8 2.8 0 1 0 5.6 0V2.5h2.9c.1.85.36 1.66.78 2.4a6.8 6.8 0 0 0 2.97 2.4v2.2Z"
                fill="#25F4EE"
                transform="translate(-1.5, -0.5)"
            />
            <path
                d="M20.5 7.5a6.8 6.8 0 0 1-3.2-.8v7.5a5.6 5.6 0 1 1-5.6-5.6c.24 0 .47.02.7.05v2.87a2.85 2.85 0 0 0-2.15 2.75 2.8 2.8 0 1 0 5.6 0V2.5h2.9c.1.85.36 1.66.78 2.4a6.8 6.8 0 0 0 2.97 2.4v2.2Z"
                fill="#FE2C55"
                opacity="0.85"
            />
            <path
                d="M20.5 7.5a6.8 6.8 0 0 1-3.2-.8v7.5a5.6 5.6 0 1 1-5.6-5.6c.24 0 .47.02.7.05v2.87a2.85 2.85 0 0 0-2.15 2.75 2.8 2.8 0 1 0 5.6 0V2.5h2.9c.1.85.36 1.66.78 2.4a6.8 6.8 0 0 0 2.97 2.4v2.2Z"
                fill="#000000"
                transform="translate(0.5, 0.5)"
            />
        </svg>
    );
}

export default function TikTokBusinessLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const navRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!navRef.current) return;
        const active = navRef.current.querySelector<HTMLElement>(
            '[data-active="true"]',
        );
        active?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }, [pathname]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-[1700px] mx-auto px-2 lg:px-3">
                    <div className="py-2 flex items-center justify-between gap-2">
                        <Link
                            href={`${BASE}/BusinessOverview`}
                            className="flex items-center gap-2 min-w-0"
                        >
                            <span className="w-9 h-9 rounded border border-slate-200 flex items-center justify-center shrink-0">
                                <TikTokLogo className="w-5 h-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-[13px] font-semibold text-slate-900 truncate">
                                    TikTok Business
                                </h1>
                                <p className="text-[13px] text-slate-500 truncate mt-0.5 hidden sm:block">
                                    Orders, customers, creators, marketing, finance.
                                </p>
                            </div>
                        </Link>
                    </div>

                    <nav
                        ref={navRef}
                        aria-label="TikTok Business sections"
                        className="relative flex items-center gap-0.5 -mb-px overflow-x-auto"
                    >
                        {NAV.map((item) => {
                            const Icon = item.icon;
                            const active = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    data-active={active}
                                    className={cn(
                                        'relative inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors rounded',
                                        active
                                            ? 'text-slate-900'
                                            : 'text-slate-500 hover:text-slate-800',
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {item.label}
                                    {active && (
                                        <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-blue-950" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </header>

            <main className="max-w-[1700px] mx-auto px-2 lg:px-3 py-2 space-y-2">
                {children}
            </main>
        </div>
    );
}