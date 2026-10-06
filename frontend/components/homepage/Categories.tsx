// components/homepage/Categories.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Smartphone, Laptop, Tablet, Tv, Headphones, Gamepad2, Camera, Watch,
    Speaker, Router, Cable, HardDrive, Home, Package, type LucideIcon,
} from 'lucide-react';
import { catalogApi, type CatalogCategory } from '@/lib/api';

const ICONS: Record<string, LucideIcon> = {
    Smartphone, Laptop, Tablet, Tv, Headphones, Gamepad2, Camera, Watch,
    Speaker, Router, Cable, HardDrive, Home,
};

const iconFor = (name: string | undefined): LucideIcon =>
    (name && ICONS[name]) || Package;

// Local image fallback for when the API's `image` field is empty.
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

export default function CategoriesSection() {
    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        catalogApi.categories
            .list(ctrl.signal)
            .then(setCategories)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setCategories([]);
            })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);

    return (
        <section className="bg-blue-950 py-6 lg:py-8 border-b border-blue-900 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            Shop by Category
                        </h2>
                        <p className="text-[13px] text-blue-100 mt-1">
                            Explore our wide range of premium electronics and hardware essentials.
                        </p>
                    </div>
                    <Link
                        href="/pages/categories"
                        className="text-[13px] font-medium text-white hover:text-blue-100 hover:underline mt-2 sm:mt-0 inline-flex items-center"
                    >
                        View all categories →
                    </Link>
                </div>
            </div>

            <div className="max-w-6xl m-auto relative flex overflow-x-hidden group py-1">
                <div className="flex animate-marquee gap-2 sm:gap-3 whitespace-nowrap">
                    {!loading && [...categories, ...categories].map((cat, index) => {
                        const IconComponent = iconFor(cat.icon);
                        const imageSrc = imageFor(cat);

                        return (
                            <Link
                                key={`${cat.slug}-${index}`}
                                href={cat.href || `/pages/categories/${cat.slug}`}
                                className="group/card relative overflow-hidden block w-[112px] h-[140px] rounded-sm sm:w-[148px] sm:h-[188px] sm:rounded-[3px] shrink-0 ring-1 ring-white/10 shadow-sm hover:shadow-md hover:ring-white/40 transition-all duration-300"
                            >
                                {imageSrc ? (
                                    <img
                                        src={imageSrc}
                                        alt={cat.name}
                                        className="absolute inset-0 w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 ease-in-out"
                                    />
                                ) : (
                                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 group-hover/card:scale-105 transition-transform duration-500 ease-in-out">
                                        <IconComponent className="w-10 h-10 sm:w-12 sm:h-12 text-white/30" />
                                    </div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 h-2/3 sm:h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

                                <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 flex items-end justify-between text-white">
                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                        <div className="p-1 sm:p-1.5 rounded-lg bg-white/15 backdrop-blur-sm group-hover/card:bg-white/25 transition-colors duration-300 w-fit">
                                            <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-[11px] sm:text-xs font-semibold text-white tracking-tight truncate">
                                                {cat.name}
                                            </h3>
                                            <p className="text-[9px] sm:text-[10px] text-slate-200 font-medium mt-0.5 opacity-90 group-hover/card:opacity-100">
                                                {cat.itemCount}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="hidden sm:inline text-white/50 group-hover/card:text-white text-base transition-colors duration-300">
                                        ›
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            <style jsx global>{`
                @keyframes marquee {
                    0%   { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    display: flex;
                    width: max-content;
                    animation: marquee 40s linear infinite;
                }
            `}</style>
        </section>
    );
}