// components/CategoriesSection.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { categories } from '@/data/categories';

export default function CategoriesSection() {
    return (
        <section className="bg-slate-50 py-6 lg:py-8 border-b border-slate-200 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Shop by Category
                        </h2>
                        <p className="text-[13px] text-slate-600 mt-1">
                            Explore our wide range of premium electronics and hardware essentials.
                        </p>
                    </div>
                    <Link
                        href="/pages/categories"
                        className="text-[13px] font-medium text-blue-950 hover:underline mt-2 sm:mt-0 inline-flex items-center"
                    >
                        View all categories →
                    </Link>
                </div>
            </div>

            {/* Marquee Row Container with 'group' to track hover across the whole slider */}
            <div className="max-w-6xl m-auto relative flex overflow-x-hidden group py-1">
                <div className="flex animate-marquee gap-2 sm:gap-3 whitespace-nowrap">
                    {/* Render list twice to create a seamless infinite loop effect */}
                    {[...categories, ...categories].map((cat, index) => {
                        const IconComponent = cat.icon;
                        return (
                            <Link
                                key={`${cat.slug}-${index}`}
                                href="/pages/categories"
                                className="group/card relative overflow-hidden block
                                    w-[112px] h-[140px] rounded-sm
                                    sm:w-[148px] sm:h-[188px] sm:rounded-[3px]
                                    shrink-0 ring-1 ring-slate-200/70 shadow-sm
                                    hover:shadow-md hover:ring-blue-600/40 transition-all duration-300"
                            >
                                {/* Category Thumbnail - Full Bleed */}
                                <img
                                    src={cat.image}
                                    alt={cat.name}
                                    className="absolute inset-0 w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 ease-in-out"
                                />

                                {/* Gradient Overlay - Darkens bottom for text legibility */}
                                <div className="absolute inset-x-0 bottom-0 h-2/3 sm:h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent"></div>

                                {/* Category Details - Floated Bottom, Small Spacing */}
                                <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 flex items-end justify-between text-white">
                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                        <div className="p-1 sm:p-1.5 rounded-lg bg-white/10 backdrop-blur-sm group-hover/card:bg-blue-600 transition-colors duration-300 w-fit">
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

            {/* Tailwind Keyframes Configuration */}
            <style jsx global>{`
                @keyframes marquee {
                    0% { transform: translateX(0%); }
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