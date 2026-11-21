'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ShieldCheck,
    Truck,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { type Banner, bannersApi } from '@/lib/api';

const guarantees = [
    { icon: Truck, label: 'Fast Delivery', sub: 'Free over KES 5,000' },
    { icon: ShieldCheck, label: '2-Year Warranty', sub: 'On all devices' },
    { icon: RotateCcw, label: '30-Day Returns', sub: 'No questions asked' },
];

const SLIDE_INTERVAL_MS = 3500;
const MAX_HERO_SLIDES = 10;

const API_ORIGIN =
    (typeof process !== 'undefined' &&
        process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')) ||
    'http://localhost:8000';

function resolveImageUrl(url: string): string {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
    return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function overlayFor(slide: Banner): string {
    const o = slide.overlay_opacity / 100;
    switch (slide.overlay_style) {
        case 'DARK':
            return `linear-gradient(rgba(2,6,23,${o}),rgba(2,6,23,${o}))`;
        case 'LIGHT':
            return `linear-gradient(rgba(255,255,255,${o}),rgba(255,255,255,${o}))`;
        case 'GRADIENT':
            return `linear-gradient(90deg, rgba(2,6,23,${o}) 0%, rgba(2,6,23,${o * 0.5}) 50%, rgba(2,6,23,0) 100%)`;
        default:
            return 'none';
    }
}

export default function Hero() {
    const [slides, setSlides] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const seenImpressions = useRef<Set<number>>(new Set());

    useEffect(() => {
        const ctrl = new AbortController();
        let cancelled = false;

        bannersApi
            .hero(ctrl.signal)
            .then((rows) => {
                if (cancelled) return;
                const valid = rows
                    .filter((s) => !!s.desktop_image)
                    .slice(0, MAX_HERO_SLIDES);
                setSlides(valid);
            })
            .catch(() => {
                if (!cancelled) setSlides([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            ctrl.abort();
        };
    }, []);

    useEffect(() => {
        if (isPaused || slides.length < 2) return;
        const t = setInterval(() => {
            setCurrentIndex((i) => (i + 1) % slides.length);
        }, SLIDE_INTERVAL_MS);
        return () => clearInterval(t);
    }, [isPaused, slides.length]);

    useEffect(() => {
        if (currentIndex >= slides.length) setCurrentIndex(0);
    }, [slides.length, currentIndex]);

    useEffect(() => {
        const slide = slides[currentIndex];
        if (!slide) return;
        if (seenImpressions.current.has(slide.id)) return;
        seenImpressions.current.add(slide.id);
        bannersApi.track(slide.id, 'impression').catch(() => { });
    }, [currentIndex, slides]);

    const handlePrev = () => {
        if (!slides.length) return;
        setCurrentIndex((i) => (i - 1 + slides.length) % slides.length);
    };

    const handleNext = () => {
        if (!slides.length) return;
        setCurrentIndex((i) => (i + 1) % slides.length);
    };

    const handleCtaClick = useCallback((slideId: number) => {
        bannersApi.track(slideId, 'click').catch(() => { });
    }, []);

    if (loading) {
        return (
            <section className="bg-white">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                    <div className="rounded-lg sm:rounded-2xl lg:rounded-3xl bg-[#F3F6F9] animate-pulse aspect-[4/5] xs:aspect-[16/10] sm:aspect-[16/7]" />
                </div>
            </section>
        );
    }

    if (!slides.length) return null;

    const currentSlide = slides[currentIndex] ?? slides[0];
    if (!currentSlide) return null;

    const isLight = currentSlide.overlay_style === 'LIGHT';
    const textColor = isLight ? 'text-[#111827]' : 'text-white';
    const subColor = isLight ? 'text-[#6B7280]' : 'text-white/80';

    return (
        <section className="bg-white">
            <div className="max-w-7xl mx-auto px-2.5 xs:px-3 sm:px-6 lg:px-8 py-3 sm:py-6 lg:py-6">
                <div
                    className="relative bg-[#11161D] overflow-hidden rounded-md xs:rounded-lg border border-[#0B0D10]"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    <div className="absolute inset-0 z-0">
                        {slides.map((slide, index) => (
                            <div
                                key={slide.id}
                                className={`absolute inset-0 transition-all duration-1000 ease-in-out ${currentIndex === index
                                    ? 'opacity-100 scale-100'
                                    : 'opacity-0 scale-105 pointer-events-none'
                                    }`}
                            >
                                <picture>
                                    {slide.mobile_image && (
                                        <source
                                            media="(max-width: 660px)"
                                            srcSet={resolveImageUrl(slide.mobile_image)}
                                        />
                                    )}
                                    {slide.tablet_image && (
                                        <source
                                            media="(max-width: 1044px)"
                                            srcSet={resolveImageUrl(slide.tablet_image)}
                                        />
                                    )}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={resolveImageUrl(slide.desktop_image)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </picture>
                                <div
                                    className="absolute inset-0"
                                    style={{ background: overlayFor(slide) }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Watermark — Havens "H" */}
                    <span
                        aria-hidden="true"
                        className="pointer-events-none select-none absolute -right-4 sm:-right-10 top-1/2 -translate-y-1/2 z-10 text-[280px] sm:text-[420px] md:text-[520px] font-black leading-none text-white/[0.06] tracking-tighter"
                    >
                        H
                    </span>

                    <div className="relative z-20 px-3 xs:px-4 sm:px-8 md:px-10 py-5 xs:py-6 sm:py-8 md:py-10 lg:py-14">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-center">
                            <div className="lg:col-span-8 space-y-2 xs:space-y-3 sm:space-y-5">
                                {currentSlide.badge && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-[10px] xs:text-[11px] sm:text-[12px] md:text-[13px] font-medium px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-sm ${isLight
                                            ? 'text-[#0B0D10] bg-[#00E5FF]'
                                            : 'text-[#00E5FF] bg-[#00E5FF]/10 ring-1 ring-[#00E5FF]/30'
                                            }`}
                                    >
                                        {currentSlide.badge}
                                    </span>
                                )}

                                <h1
                                    className={`text-[18px] xs:text-[20px] sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.2] xs:leading-[1.18] sm:leading-[1.15] ${textColor}`}
                                >
                                    {currentSlide.headline}
                                </h1>

                                {/* Brand tagline — cyan on dark, deep teal on light */}
                                <p
                                    className={`text-[10px] xs:text-[11px] sm:text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-[#00B8D4]' : 'text-[#00E5FF]'
                                        }`}
                                >
                                    Havens Technologies — Feel the Quality
                                </p>

                                <p
                                    className={`text-[11px] xs:text-[12px] sm:text-sm md:text-base max-w-sm sm:max-w-md md:max-w-xl leading-relaxed ${subColor}`}
                                >
                                    {currentSlide.description}
                                </p>

                                <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-2.5 sm:gap-3 pt-1 sm:pt-2">
                                    {currentSlide.primary_cta_text && (
                                        <Link
                                            href={currentSlide.primary_cta_href || '#'}
                                            onClick={() => handleCtaClick(currentSlide.id)}
                                            className="group inline-flex items-center justify-center gap-2 font-bold py-2 xs:py-2.5 px-4 xs:px-5 rounded-sm text-[12px] xs:text-[13px] bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] transition-colors"
                                        >
                                            <span>{currentSlide.primary_cta_text}</span>
                                            <ArrowRight className="w-3.5 h-3.5 xs:w-4 xs:h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                        </Link>
                                    )}
                                    {currentSlide.secondary_cta_text && (
                                        <Link
                                            href={currentSlide.secondary_cta_href || '#'}
                                            onClick={() => handleCtaClick(currentSlide.id)}
                                            className={`inline-flex items-center justify-center bg-transparent font-medium py-2 xs:py-2.5 px-4 xs:px-5 rounded-sm text-[12px] xs:text-[13px] border transition-colors ${isLight
                                                ? 'text-[#111827] border-[#111827]/30 hover:bg-[#111827]/5 hover:border-[#111827]/60'
                                                : 'text-white border-[#00E5FF]/50 hover:bg-[#00E5FF]/10 hover:border-[#00E5FF]'
                                                }`}
                                        >
                                            {currentSlide.secondary_cta_text}
                                        </Link>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-1 xs:gap-1.5 sm:gap-2 pt-2 xs:pt-3 sm:pt-4 max-w-xl">
                                    {guarantees.map(({ icon: Icon, label, sub }) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 rounded-sm px-0.5 xs:px-1 sm:px-2.5 py-1 xs:py-1.5 sm:py-2 min-w-0"
                                        >
                                            <div className="p-0.5 xs:p-1 sm:p-1.5 rounded-sm shrink-0">
                                                <Icon
                                                    className={`w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 ${isLight ? 'text-[#00B8D4]' : 'text-[#00E5FF]'
                                                        }`}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className={`text-[9px] xs:text-[10px] sm:text-[11px] font-semibold leading-tight truncate ${isLight ? 'text-[#111827]' : 'text-white'
                                                        }`}
                                                >
                                                    {label}
                                                </p>
                                                <p
                                                    className={`text-[8px] xs:text-[9px] sm:text-[10px] leading-tight truncate mt-0.5 ${isLight ? 'text-[#6B7280]' : 'text-white/70'
                                                        }`}
                                                >
                                                    {sub}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div
                            className={`flex flex-row items-center justify-between mt-4 xs:mt-5 sm:mt-6 md:mt-8 pt-3 xs:pt-4 sm:pt-5 md:pt-6 border-t z-20 relative gap-2 sm:gap-0 ${isLight ? 'border-[#111827]/10' : 'border-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => setCurrentIndex(index)}
                                        className={`h-1 xs:h-1.5 rounded-full transition-all duration-300 ${currentIndex === index
                                            ? `w-5 xs:w-6 sm:w-7 ${isLight ? 'bg-[#00B8D4]' : 'bg-[#00E5FF]'}`
                                            : `w-1.5 xs:w-2 sm:w-2.5 ${isLight
                                                ? 'bg-[#111827]/30 hover:bg-[#111827]/50'
                                                : 'bg-white/40 hover:bg-[#00E5FF]/70'
                                            }`
                                            }`}
                                        aria-label={`Go to slide ${index + 1}`}
                                    />
                                ))}
                            </div>

                            <div className="flex items-center gap-1.5 xs:gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    className={`p-1 xs:p-1.5 sm:p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B8D4] bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10]`}
                                    aria-label="Previous slide"
                                >
                                    <ChevronLeft className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className={`p-1 xs:p-1.5 sm:p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B8D4] bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10]`}
                                    aria-label="Next slide"
                                >
                                    <ChevronRight className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}