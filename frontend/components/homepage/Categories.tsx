'use client';

import React, { useEffect, useRef, useState } from 'react';
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

const MIN_FOR_MARQUEE = 6;
const STEP_INTERVAL_MS = 2600;
const STEP_TRANSITION_MS = 700;

const imageFor = (cat: CatalogCategory): string =>
    cat.image || LOCAL_CATEGORY_IMAGES[cat.slug] || '';

export default function CategoriesSection() {
    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const trackRef = useRef<HTMLDivElement | null>(null);
    const offsetRef = useRef(0);
    const stepRef = useRef(0);
    const halfRef = useRef(0);

    const [offset, setOffset] = useState(0);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        catalogApi.categories
            .list(ctrl.signal)
            .then((data) => {
                if (ctrl.signal.aborted) return;
                setCategories(data);
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setCategories([]);
            })
            .finally(() => {
                if (ctrl.signal.aborted) return;
                setLoading(false);
            });
        return () => ctrl.abort();
    }, []);

    const shouldMarquee = !loading && categories.length >= MIN_FOR_MARQUEE;
    const displayCategories = shouldMarquee
        ? [...categories, ...categories]
        : categories;

    useEffect(() => {
        if (!shouldMarquee) return;
        const track = trackRef.current;
        if (!track) return;

        const measure = () => {
            const card = track.querySelector<HTMLElement>('[data-card]');
            if (!card) return;
            const cs = window.getComputedStyle(track);
            const gap =
                parseFloat(cs.columnGap) ||
                parseFloat(cs.gap) ||
                8;
            stepRef.current = card.offsetWidth + gap;
            halfRef.current = stepRef.current * categories.length;
        };

        const raf = requestAnimationFrame(measure);
        const ro = new ResizeObserver(measure);
        ro.observe(track);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [shouldMarquee, categories.length]);

    useEffect(() => {
        if (!resetting) return;
        const raf = requestAnimationFrame(() => setResetting(false));
        return () => cancelAnimationFrame(raf);
    }, [resetting]);

    useEffect(() => {
        if (shouldMarquee) return;
        offsetRef.current = 0;
        setOffset(0);
    }, [shouldMarquee]);

    useEffect(() => {
        if (!shouldMarquee) return;
        if (typeof window === 'undefined') return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const id = window.setInterval(() => {
            const step = stepRef.current;
            const half = halfRef.current;
            if (!step || !half) return;

            const next = offsetRef.current - step;
            if (next <= -half) {
                offsetRef.current = 0;
                setOffset(0);
                setResetting(true);
            } else {
                offsetRef.current = next;
                setOffset(next);
            }
        }, STEP_INTERVAL_MS);

        return () => window.clearInterval(id);
    }, [shouldMarquee]);

    return (
        <section className="relative bg-blue-950 py-4 sm:py-6 border-b border-blue-900 overflow-hidden">
            <span
                aria-hidden="true"
                className="pointer-events-none select-none absolute -right-8 sm:-right-16 top-1/2 -translate-y-1/2 text-[320px] sm:text-[520px] font-black leading-none text-white/[0.03] tracking-tighter"
            >
                R
            </span>

            <div className="relative max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 mb-2 sm:mb-3">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-0">
                    <div className="min-w-0">
                        <h2 className="text-base xs:text-lg sm:text-xl lg:text-2xl font-bold text-white">
                            Shop by <span className="text-slate-300">Category</span>
                        </h2>
                        <p className="text-[11px] xs:text-[12px] sm:text-[13px] md:text-[14px] text-slate-300 mt-1.5 sm:mt-2">
                            Explore our wide range of premium electronics and hardware essentials.
                        </p>
                    </div>
                    <Link
                        href="/pages/categories"
                        className="inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto bg-white hover:bg-slate-100 text-blue-950 font-bold text-[11px] xs:text-[12px] sm:text-[13px] md:text-[14px] px-3.5 sm:px-4 py-2 rounded-full shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                        View all categories
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </div>

            <div className="category-carousel relative w-full py-1 overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div
                        ref={trackRef}
                        className={
                            shouldMarquee
                                ? 'flex gap-2 xs:gap-2.5 sm:gap-3 whitespace-nowrap'
                                : 'flex flex-wrap justify-center gap-2.5 sm:gap-4'
                        }
                        style={
                            shouldMarquee
                                ? {
                                    transform: `translate3d(${offset}px, 0, 0)`,
                                    transition: resetting
                                        ? 'none'
                                        : `transform ${STEP_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                                    willChange: 'transform',
                                    backfaceVisibility: 'hidden',
                                }
                                : undefined
                        }
                    >
                        {!loading && displayCategories.map((cat, index) => {
                            const IconComponent = iconFor(cat.icon);
                            const imageSrc = imageFor(cat);

                            return (
                                <Link
                                    key={`${cat.slug}-${index}`}
                                    data-card
                                    href={cat.href || `/pages/categories/${cat.slug}`}
                                    className="category-card group/card relative overflow-hidden block w-[130px] h-[140px] xs:w-[150px] xs:h-[160px] sm:w-[230px] sm:h-[210px] rounded sm:rounded-[3px] shrink-0 ring-1 ring-slate-700/60 shadow hover:shadow-lg hover:ring-white transition-all duration-300"
                                >
                                    {imageSrc ? (
                                        <img
                                            src={imageSrc}
                                            alt={cat.name}
                                            className="category-card-img absolute inset-0 w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 ease-in-out"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 group-hover/card:scale-105 transition-transform duration-500 ease-in-out" />
                                    )}

                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none select-none absolute top-0 right-1 text-[52px] sm:text-[72px] font-black leading-[0.85] text-white/[0.08] tracking-tighter group-hover/card:text-white/20 transition-colors duration-300 z-[1]"
                                    >
                                        R
                                    </span>

                                    <div className="absolute inset-x-0 bottom-0 h-2/3 sm:h-1/2 bg-gradient-to-t from-slate-950/95 via-slate-900/70 to-transparent" />

                                    <div className="absolute inset-x-0 bottom-0 p-1.5 xs:p-2 sm:p-3.5 flex items-end justify-between text-white gap-1 z-10">
                                        <div className="flex flex-col gap-1 xs:gap-1 sm:flex-row sm:items-center sm:gap-2.5 min-w-0">
                                            <div className="p-1.5 xs:p-1.5 sm:p-2 bg-slate-900 ring-2 ring-slate-700 group-hover/card:bg-white group-hover/card:ring-slate-300 transition-all duration-300 w-fit shrink-0 rounded-full shadow-md">
                                                <IconComponent className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-5 sm:h-5 text-white group-hover/card:text-blue-950 transition-colors duration-300" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-[11px] xs:text-[12px] sm:text-sm font-semibold text-white truncate">
                                                    {cat.name}
                                                </h3>
                                                <p className="text-[9px] xs:text-[10px] sm:text-xs text-slate-300 font-medium opacity-90 group-hover/card:opacity-100 mt-0.5 truncate">
                                                    {cat.itemCount}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="hidden sm:inline text-slate-400 group-hover/card:text-white text-lg transition-colors duration-300 shrink-0">
                                            ›
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}