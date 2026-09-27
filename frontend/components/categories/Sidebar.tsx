// components/Sidebar.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { categories } from '@/data/categories';

export default function Sidebar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [clickedHref, setClickedHref] = useState<string | null>(null);

    return (
        <>
            {/* Mobile Toggle Button */}
            <div className="lg:hidden mb-2">
                <button
                    type="button"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-sm p-2.5 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Menu className="h-4 w-4 text-blue-600" />
                        Categories Navigation
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                        {mobileOpen ? 'Close' : 'Open'}
                    </span>
                </button>
            </div>

            {/* Sidebar Container */}
            <aside
                className={`lg:block ${mobileOpen ? 'block' : 'hidden'} 
                    bg-white border border-slate-200 rounded-sm p-2 shadow-sm
                    lg:sticky lg:top-36 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto 
                    scrollbar-thin scrollbar-thumb-slate-300`}
            >
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                    <h2 className="text-xs font-bold uppercase text-slate-800">
                        All Categories
                    </h2>
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        {categories.length}
                    </span>
                </div>

                <ul className="space-y-1">
                    {categories.map((cat) => {
                        const isActive = pathname === cat.href || clickedHref === cat.href;
                        const Icon = cat.icon;

                        return (
                            <li key={cat.slug}>
                                <Link
                                    href={cat.href}
                                    onClick={() => {
                                        setClickedHref(cat.href);
                                        setMobileOpen(false);
                                    }}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors group ${
                                        isActive
                                            ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <span className="flex items-center gap-2.5 truncate">
                                        {/* Image thumbnail */}
                                        <div
                                            className={`w-8 h-8 rounded overflow-hidden shrink-0 border ${
                                                isActive
                                                    ? 'border-blue-400/50 bg-blue-700'
                                                    : 'border-slate-200 bg-slate-50'
                                            }`}
                                        >
                                            <img
                                                src={cat.image}
                                                alt={cat.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                        </div>

                                        <span className="truncate">{cat.name}</span>
                                    </span>

                                    {/* Item count */}
                                    <span
                                        className={`text-[12px] shrink-0 ml-2 ${
                                            isActive ? 'text-blue-100' : 'text-slate-400'
                                        }`}
                                    >
                                        {cat.itemCount}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </aside>
        </>
    );
}