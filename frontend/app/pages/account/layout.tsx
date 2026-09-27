'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Package, Heart, MapPin, Settings,
    LogOut, User, Menu, X, Bell
} from 'lucide-react';
import Header from '@/components/homepage/Navbar';
import Footer from '@/components/homepage/Footer';
import { currentUser } from '@/data/account';

const navItems = [
    { label: 'Overview', href: '/pages/account', icon: LayoutDashboard },
    { label: 'My Orders', href: '/pages/account/orders', icon: Package },
    { label: 'Wishlist', href: '/pages/account/wishlist', icon: Heart },
    { label: 'Addresses', href: '/pages/account/addresses', icon: MapPin },
    { label: 'Notifications', href: '/pages/account/notifications', icon: Bell },
    { label: 'Settings', href: '/pages/account/settings', icon: Settings },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
                <Header />
            </div>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-6 py-6">
                <div className="flex flex-col lg:flex-row gap-6 items-start">

                    {/* Sidebar */}
                    <nav aria-label="Account" className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24">
                        {/* Mobile toggle */}
                        <button
                            type="button"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="lg:hidden w-full flex items-center justify-between bg-white border border-slate-200 rounded-sm p-3 text-sm font-semibold text-slate-800 shadow-xs"
                        >
                            <span className="flex items-center gap-2">
                                <Menu className="h-4 w-4 text-blue-950" />
                                Account Menu
                            </span>
                            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                        </button>

                        {/* Panel */}
                        <div className={`${mobileOpen ? 'block' : 'hidden'} lg:block mt-2 lg:mt-0 bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden`}>

                            {/* User header */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-950 text-white flex items-center justify-center font-bold text-sm">
                                        {currentUser.firstName[0]}{currentUser.lastName[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                            {currentUser.firstName} {currentUser.lastName}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate">
                                            {currentUser.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500">Loyalty points</span>
                                    <span className="font-semibold text-blue-950">
                                        {currentUser.loyaltyPoints.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Nav items */}
                            <ul className="p-2 space-y-0.5">
                                {navItems.map((item) => {
                                    const isActive =
                                        item.href === '/pages/account'
                                            ? pathname === '/pages/account'
                                            : pathname.startsWith(item.href);
                                    const Icon = item.icon;
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={() => setMobileOpen(false)}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                                                    isActive
                                                        ? 'bg-blue-50 text-blue-950 font-semibold border-l-2 border-blue-950'
                                                        : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-950' : 'text-slate-500'}`} />
                                                <span>{item.label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Sign out */}
                            <div className="p-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Sign out</span>
                                </button>
                            </div>
                        </div>
                    </nav>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 w-full">
                        {children}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}