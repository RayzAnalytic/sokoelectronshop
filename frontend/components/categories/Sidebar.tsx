'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Menu,
    Smartphone,
    Laptop,
    Tablet,
    Tv,
    Headphones,
    Gamepad2,
    Camera,
    Watch,
    Speaker,
    Router,
    Cable,
    HardDrive,
    Home,
    Package,
    type LucideIcon,
} from 'lucide-react';
import { catalogApi, type CatalogCategory } from '@/lib/api';

const ICONS: Record<string, LucideIcon> = {
    Smartphone,
    Laptop,
    Tablet,
    Tv,
    Headphones,
    Gamepad2,
    Camera,
    Watch,
    Speaker,
    Router,
    Cable,
    HardDrive,
    Home,
};

const iconFor = (name: string | undefined): LucideIcon =>
    (name && ICONS[name]) || Package;

const LOCAL_CATEGORY_IMAGES: Record<string, string> = {
    'smartphones': '/smartphone2.jpeg',
    'laptops': '/laptop2.jpeg',
    'tablets': '/laptop3.jpeg',
    'tvs': '/tvs.jpeg',
    'audio': '/Headphone.jpeg',
    'gaming': '/gamecontroller.jpeg',
    'cameras': '/camera.jpeg',
    'wearables': '/xiaomiwatch.jpeg',
    'speakers': '/jbl.jpeg',
    'networking': '/Router.jpeg',
    'accessories': '/dellmonitor.jpeg',
    'storage': '/harddrive.jpeg',
    'smart-home': '/powerstation.jpeg',
};

const imageFor = (cat: CatalogCategory): string =>
    cat.image || LOCAL_CATEGORY_IMAGES[cat.slug] || '';

export default function Sidebar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [clickedHref, setClickedHref] = useState<string | null>(null);

    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);

        catalogApi.categories
            .list(ctrl.signal)
            .then(setCategories)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setCategories([]);
                setError('Could not load categories.');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    return (
        <>
            <div className="lg:hidden mb-2">
                <button
                    type="button"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="w-full flex items-center justify-between bg-white border border-slate-200 rounded p-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Menu className="h-4 w-4 text-blue-950" />
                        Categories Navigation
                    </span>
                    <span className="text-[13px] font-normal text-slate-500">
                        {mobileOpen ? 'Close' : 'Open'}
                    </span>
                </button>
            </div>

            <aside
                className={`lg:block ${mobileOpen ? 'block' : 'hidden'} 
                    bg-white border border-slate-200 rounded p-2 
                    lg:sticky lg:top-36 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto 
                    scrollbar-thin scrollbar-thumb-slate-300`}
            >
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
                    <h2 className="text-xs font-bold uppercase text-slate-900">
                        All Categories
                    </h2>
                    <span className="text-[13px] font-medium text-blue-950 bg-blue-950/10 border border-blue-950/20 px-2 py-0.5 rounded-full">
                        {loading ? '…' : categories.length}
                    </span>
                </div>

                {loading && categories.length === 0 && (
                    <ul className="space-y-1">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <li
                                key={i}
                                className="flex items-center gap-2.5 px-2 py-1.5 animate-pulse"
                            >
                                <div className="w-8 h-8 rounded bg-slate-100" />
                                <div className="flex-1 h-3 bg-slate-100 rounded" />
                            </li>
                        ))}
                    </ul>
                )}

                {error && !loading && (
                    <p className="text-[13px] text-slate-500 py-3 px-2">
                        {error}
                    </p>
                )}

                {!loading && !error && (
                    <ul className="space-y-1">
                        {categories.map((cat) => {
                            const isActive =
                                pathname === cat.href || clickedHref === cat.href;
                            const Icon = iconFor(cat.icon);
                            const imageSrc = imageFor(cat);

                            return (
                                <li key={cat.slug}>
                                    <Link
                                        href={cat.href}
                                        onClick={() => {
                                            setClickedHref(cat.href);
                                            setMobileOpen(false);
                                        }}
                                        className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors group ${isActive
                                            ? 'bg-blue-950 text-white font-semibold'
                                            : 'text-slate-900 hover:bg-blue-950/10 hover:text-blue-950'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2 truncate">
                                            <div
                                                className={`w-8 h-8 rounded overflow-hidden shrink-0 border flex items-center justify-center ${isActive
                                                    ? 'border-white/20 bg-white'
                                                    : 'border-slate-200 bg-slate-50'
                                                    }`}
                                            >
                                                {imageSrc ? (
                                                    <img
                                                        src={imageSrc}
                                                        alt={cat.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    />
                                                ) : (
                                                    <Icon
                                                        className={`w-4 h-4 ${isActive
                                                            ? 'text-blue-950'
                                                            : 'text-slate-400'
                                                            }`}
                                                    />
                                                )}
                                            </div>

                                            <span className="truncate">{cat.name}</span>
                                        </span>

                                        <span
                                            className={`text-[13px] shrink-0 ml-2 ${isActive ? 'text-white/80' : 'text-slate-400'
                                                }`}
                                        >
                                            {cat.itemCount}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </aside>
        </>
    );
}