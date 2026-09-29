'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ShieldCheck,
    Truck,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { type Banner, activeHeroSlides } from '@/lib/bannerStore';

const guarantees = [
    { icon: Truck, label: 'Fast Delivery', sub: 'Free over KES 5,000' },
    { icon: ShieldCheck, label: '2-Year Warranty', sub: 'On all devices' },
    { icon: RotateCcw, label: '30-Day Returns', sub: 'No questions asked' },
];

const SLIDE_INTERVAL_MS = 3500;

export default function Hero() {
    const [slides, setSlides] = useState<Banner[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Load slides from the store on mount
    useEffect(() => {
        setSlides(activeHeroSlides());
        setHydrated(true);
    }, []);

    // Auto-advance
    useEffect(() => {
        if (isPaused || slides.length < 2) return;
        const t = setInterval(() => {
            setCurrentIndex((i) => (i + 1) % slides.length);
        }, SLIDE_INTERVAL_MS);
        return () => clearInterval(t);
    }, [isPaused, slides.length]);

    // Keep index in range when slides change
    useEffect(() => {
        if (currentIndex >= slides.length) setCurrentIndex(0);
    }, [slides.length, currentIndex]);

    const handlePrev = () =>
        setCurrentIndex((i) => (i - 1 + slides.length) % slides.length);
    const handleNext = () =>
        setCurrentIndex((i) => (i + 1) % slides.length);

    // Skeleton before hydration / when no active banners
    if (!hydrated) {
        return (
            <section className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                    <div className="rounded-3xl bg-slate-100 animate-pulse aspect-[16/7]" />
                </div>
            </section>
        );
    }

    if (!slides.length) return null;

    const currentSlide = slides[currentIndex];

    // Overlay per slide — driven by the admin design tab
    const overlayBg = (() => {
        const o = currentSlide.overlay_opacity / 100;
        switch (currentSlide.overlay_style) {
            case 'DARK':
                return `linear-gradient(rgba(2,6,23,${o}),rgba(2,6,23,${o}))`;
            case 'LIGHT':
                return `linear-gradient(rgba(255,255,255,${o}),rgba(255,255,255,${o}))`;
            case 'GRADIENT':
                return `linear-gradient(90deg, rgba(2,6,23,${o}) 0%, rgba(2,6,23,${o * 0.5}) 50%, rgba(2,6,23,0) 100%)`;
            default:
                return 'none';
        }
    })();

    const isLight = currentSlide.overlay_style === 'LIGHT';
    const textColor = isLight ? 'text-slate-900' : 'text-white';
    const subColor = isLight ? 'text-slate-700' : 'text-slate-200';

    return (
        <section className="bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                {/* ── The inset hero card ── */}
                <div
                    className="relative bg-slate-950 overflow-hidden rounded-3xl border border-slate-200"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    {/* ── Background image layers ── */}
                    <div className="absolute inset-0 z-0">
                        {slides.map((slide, index) => (
                            <div
                                key={slide.id}
                                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${currentIndex === index
                                        ? 'opacity-100 scale-100'
                                        : 'opacity-0 scale-105 pointer-events-none'
                                    }`}
                            >
                                <picture>
                                    {slide.mobile_image && (
                                        <source
                                            media="(max-width: 640px)"
                                            srcSet={slide.mobile_image}
                                        />
                                    )}
                                    {slide.tablet_image && (
                                        <source
                                            media="(max-width: 1024px)"
                                            srcSet={slide.tablet_image}
                                        />
                                    )}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={slide.desktop_image}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        style={{
                                            transition:
                                                'opacity 1s ease-in-out, transform 6s ease-out',
                                        }}
                                    />
                                </picture>
                                <div
                                    className="absolute inset-0"
                                    style={{ background: overlayBg }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* ── Content ── */}
                    <div className="relative z-20 px-6 sm:px-10 py-10 lg:py-14">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            <div className="lg:col-span-8 space-y-5">
                                {/* Eyebrow */}
                                {currentSlide.badge && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-sm ${isLight
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-white text-slate-900'
                                            }`}
                                    >
                                        {currentSlide.badge}
                                    </span>
                                )}

                                {/* Headline */}
                                <h1
                                    className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.15] ${textColor}`}
                                >
                                    {currentSlide.headline}
                                </h1>

                                {/* Description */}
                                <p
                                    className={`text-sm sm:text-base max-w-xl leading-relaxed ${subColor}`}
                                >
                                    {currentSlide.description}
                                </p>

                                {/* CTAs */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                                    {currentSlide.primary_cta_text && (
                                        <Link
                                            href={currentSlide.primary_cta_href || '#'}
                                            className="group inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2.5 px-5 rounded-sm text-[13px] transition-colors"
                                        >
                                            <span>{currentSlide.primary_cta_text}</span>
                                            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                        </Link>
                                    )}
                                    {currentSlide.secondary_cta_text && (
                                        <Link
                                            href={currentSlide.secondary_cta_href || '#'}
                                            className="inline-flex items-center justify-center bg-transparent hover:bg-white/10 text-white font-medium py-2.5 px-5 rounded-sm text-[13px] border border-white/30 hover:border-white/60 transition-colors"
                                        >
                                            {currentSlide.secondary_cta_text}
                                        </Link>
                                    )}
                                </div>

                                {/* Guarantees */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-4 max-w-xl">
                                    {guarantees.map(({ icon: Icon, label, sub }) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-2 rounded-sm px-2.5 py-2"
                                        >
                                            <div className="p-1.5 rounded-sm shrink-0">
                                                <Icon className="w-3 h-3 text-blue-100" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold text-slate-100 leading-tight truncate">
                                                    {label}
                                                </p>
                                                <p className="text-[10px] text-slate-100 leading-tight truncate mt-0.5">
                                                    {sub}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Controls ── */}
                        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-white/10 z-20 relative">
                            {/* Dots */}
                            <div className="flex items-center gap-2 mb-4 sm:mb-0">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => setCurrentIndex(index)}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === index
                                                ? 'w-7 bg-white'
                                                : 'w-2.5 bg-white/40 hover:bg-white/70'
                                            }`}
                                        aria-label={`Go to slide ${index + 1}`}
                                    />
                                ))}
                            </div>

                            {/* Prev / Next */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    className="bg-white hover:bg-slate-100 text-slate-900 p-2 rounded-sm transition-colors"
                                    aria-label="Previous slide"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="bg-white hover:bg-slate-100 text-slate-900 p-2 rounded-sm transition-colors"
                                    aria-label="Next slide"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}