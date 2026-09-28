'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ShieldCheck,
    Truck,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

// ── 6 slides — theme + background image ──
const heroSlides = [
    {
        id: 1,
        badge: 'Featured Collection • New Season',
        headline: 'Top Picks Across Every Category.',
        description:
            'Handpicked electronics from the brands customers trust most — smartphones, laptops, audio, and accessories, all in stock and ready to ship.',
        image: '/hero01.png',
        primaryCta: { text: 'Shop Collection', href: '/pages/products' },
        secondaryCta: { text: 'Best Sellers', href: '/pages/products/bestsellingproducts' },
    },
    {
        id: 2,
        badge: 'Visit Our Store • Westlands Nairobi',
        headline: 'Experience Tech In Person.',
        description:
            'Walk in, try before you buy, and get help from our team in minutes. Two locations open 7 days a week.',
        image: '/hero02.png',
        primaryCta: { text: 'Find A Store', href: '/stores' },
        secondaryCta: { text: 'Talk To Us', href: '/support' },
    },
    {
        id: 3,
        badge: 'Modern Living • Smart Appliances',
        headline: 'Smart Appliances For Modern Homes.',
        description:
            'Fridges, power stations, and connected devices engineered for reliability — even when the grid is not.',
        image: '/hero03.png',
        primaryCta: { text: 'Shop Smart Home', href: '/pages/products' },
        secondaryCta: { text: 'View Power Stations', href: '/pages/products' },
    },
    {
        id: 4,
        badge: 'Customer Favorites • Top Rated',
        headline: 'The Best Products This Month.',
        description:
            'Ranked by real customer reviews. Nothing under 4.6 stars makes this list.',
        image: '/hero04.png',
        primaryCta: { text: 'Shop Best Sellers', href: '/pages/products/bestsellingproducts' },
        secondaryCta: { text: 'Read Reviews', href: '/pages/products' },
    },
    {
        id: 5,
        badge: 'Just Landed • New Arrivals',
        headline: 'New Products, Straight Off The Truck.',
        description:
            'The latest gear added this month — from M4 MacBooks to next-gen controllers. First come, first served.',
        image: '/hero05.png',
        primaryCta: { text: 'Shop New Arrivals', href: '/pages/products/newarrivals' },
        secondaryCta: { text: 'Special Deals', href: '/pages/products/specialdeals' },
    },
    {
        id: 6,
        badge: 'Browse By Category',
        headline: 'Find Exactly What You Need.',
        description:
            'Every product organized into clear categories — no endless scrolling, no guesswork.',
        image: '/hero06.png',
        primaryCta: { text: 'View All Categories', href: '/pages/categories' },
        secondaryCta: { text: 'Shop All', href: '/pages/products' },
    },
];

const guarantees = [
    { icon: Truck, label: 'Fast Delivery', sub: 'Free over KES 5,000' },
    { icon: ShieldCheck, label: '2-Year Warranty', sub: 'On all devices' },
    { icon: RotateCcw, label: '30-Day Returns', sub: 'No questions asked' },
];

const SLIDE_INTERVAL_MS = 3500;

export default function Hero() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Auto-advance
    useEffect(() => {
        if (isPaused) return;
        const t = setInterval(() => {
            setCurrentIndex((i) => (i + 1) % heroSlides.length);
        }, SLIDE_INTERVAL_MS);
        return () => clearInterval(t);
    }, [isPaused]);

    const currentSlide = heroSlides[currentIndex];

    const handlePrev = () =>
        setCurrentIndex((i) => (i - 1 + heroSlides.length) % heroSlides.length);
    const handleNext = () =>
        setCurrentIndex((i) => (i + 1) % heroSlides.length);

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
                        {heroSlides.map((slide, index) => (
                            <div
                                key={slide.id}
                                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${currentIndex === index
                                        ? 'opacity-100 scale-100'
                                        : 'opacity-0 scale-105 pointer-events-none'
                                    }`}
                                style={{
                                    backgroundImage: `url(${slide.image})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    transition:
                                        'opacity 1s ease-in-out, transform 6s ease-out',
                                }}
                            />
                        ))}

                        {/* Overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent z-10" />
                    </div>

                    {/* ── Content ── */}
                    <div className="relative z-20 px-6 sm:px-10 py-10 lg:py-14">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

                            {/* LEFT — content */}
                            <div className="lg:col-span-8 space-y-5">

                                {/* Eyebrow */}
                                <span className="inline-flex items-center gap-1.5 bg-white text-slate-900 text-[11px] font-medium px-2.5 py-1 rounded-sm">
                                    {currentSlide.badge}
                                </span>

                                {/* Headline */}
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.15]">
                                    {currentSlide.headline}
                                </h1>

                                {/* Description */}
                                <p className="text-sm sm:text-base text-slate-200 max-w-xl leading-relaxed">
                                    {currentSlide.description}
                                </p>

                                {/* CTAs */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                                    <Link
                                        href={currentSlide.primaryCta.href}
                                        className="group inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2.5 px-5 rounded-sm text-[13px] transition-colors"
                                    >
                                        <span>{currentSlide.primaryCta.text}</span>
                                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                                    </Link>
                                    <Link
                                        href={currentSlide.secondaryCta.href}
                                        className="inline-flex items-center justify-center bg-transparent hover:bg-white/10 text-white font-medium py-2.5 px-5 rounded-sm text-[13px] border border-white/30 hover:border-white/60 transition-colors"
                                    >
                                        {currentSlide.secondaryCta.text}
                                    </Link>
                                </div>

                                {/* Guarantees — small white cards */}
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
                                {heroSlides.map((slide, index) => (
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