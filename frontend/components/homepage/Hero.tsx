'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Truck, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const heroSlides = [
    {
        id: 1,
        badge: 'Spring Electronics Sale • Free express shipping over $75',
        headline: 'Next-Gen Smartphones & Ultra-Fast 5G Devices.',
        description: 'Experience cutting-edge mobile processing, stunning OLED displays, and professional multi-lens camera systems built for everyday performance.',
        image: '/phone.jpeg',
        primaryCta: { text: 'Shop Smartphones', href: '/shop/smartphones' },
        secondaryCta: { text: 'View All Deals', href: '/shop/sale' },
    },
    {
        id: 2,
        badge: 'New Arrival • Professional Grade Hardware',
        headline: 'High-Performance Laptops & Studio Workstations.',
        description: 'Power through intensive creative workflows, coding, and multitasking with next-generation processors and vibrant high-refresh rate displays.',
        image: '/Lenovo.jpeg',
        primaryCta: { text: 'Shop Laptops', href: '/shop/laptops' },
        secondaryCta: { text: 'Compare Specs', href: '/shop/compare' },
    },
    {
        id: 3,
        badge: 'Audio Essentials • Active Noise Cancellation',
        headline: 'Immersive Studio Sound & Wireless Audio Gear.',
        description: 'Block out distractions with advanced active noise-canceling headphones and premium wireless earbuds engineered for pristine acoustics.',
        image: '/immersivestudio.jpeg',
        primaryCta: { text: 'Shop Audio Gear', href: '/shop/audio' },
        secondaryCta: { text: 'Best Sellers', href: '/shop/best-sellers' },
    },
    {
        id: 4,
        badge: 'Home Entertainment • 4K OLED & Smart TVs',
        headline: 'Cinematic Visuals & Smart Home Displays.',
        description: 'Transform your living room with ultra-HD resolution, cinematic HDR contrast, and seamless smart streaming integrations.',
        image: '/scimaticvisuals.jpeg',
        primaryCta: { text: 'Shop TVs & Displays', href: '/shop/tvs' },
        secondaryCta: { text: 'Special Offers', href: '/shop/sale' },
    },
    {
        id: 5,
        badge: 'Gaming Hardware • Zero Latency Precision',
        headline: 'Pro Gaming Controllers & Rig Accessories.',
        description: 'Gain the competitive edge with ergonomic wireless controllers, mechanical precision switches, and customizable haptic feedback.',
        image: '/progamingcontrollers.jpeg',
        primaryCta: { text: 'Shop Gaming', href: '/shop/gaming' },
        secondaryCta: { text: 'Explore Accessories', href: '/shop/accessories' },
    },
    {
        id: 6,
        badge: 'Mobile Productivity • Ultra-Thin Form Factors',
        headline: 'Versatile Tablets & Digital Creation Tools.',
        description: 'Sketch, design, and stream on the go with lightweight tablets featuring high-precision stylus support and all-day battery life.',
        image: '/versatiletablets.jpeg',
        primaryCta: { text: 'Shop Tablets', href: '/shop/tablets' },
        secondaryCta: { text: 'View New Arrivals', href: '/shop' },
    },
];

const guarantees = [
    { icon: Truck, label: 'Fast Delivery', sub: 'Free over $75' },
    { icon: ShieldCheck, label: '2-Year Warranty', sub: 'On all devices' },
    { icon: RotateCcw, label: '30-Day Returns', sub: 'No questions asked' },
];

export default function Hero() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % heroSlides.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [isPaused]);

    const currentSlide = heroSlides[currentIndex];

    const handlePrev = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + heroSlides.length) % heroSlides.length);
    };

    const handleNext = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % heroSlides.length);
    };

    return (
        <section
            className="relative bg-slate-950 overflow-hidden border-b border-slate-800"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Sliding Background Image with Dark Overlay for Readability */}
            <div className="absolute inset-0 z-0">
                {heroSlides.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                            currentIndex === index
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-105 pointer-events-none'
                        }`}
                        style={{
                            backgroundImage: `url(${slide.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            transition: 'opacity 1s ease-in-out, transform 6s ease-out',
                        }}
                    />
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-slate-950/20 z-10" />
            </div>

            <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

                    {/* Left Column: Badge, Headline, Copy, CTAs & Guarantees */}
                    <div className="lg:col-span-8 space-y-6">

                        
                        <h1 className="text-3xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                            {currentSlide.headline}
                        </h1>

                        {/* Supporting Copy */}
                        <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                            {currentSlide.description}
                        </p>

                        {/* CTAs as rounded cards */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                            <Link
                                href={currentSlide.primaryCta.href}
                                className="group inline-flex items-center justify-center gap-2
                                    bg-white hover:bg-blue-50 text-slate-950
                                    font-semibold py-3 px-6 rounded-sm text-[13px]
                                    shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-blue-500/10
                                    ring-1 ring-white/20 hover:ring-blue-300/40
                                    transition-all duration-300"
                            >
                                <span>{currentSlide.primaryCta.text}</span>
                                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                            </Link>
                            <Link
                                href={currentSlide.secondaryCta.href}
                                className="inline-flex items-center justify-center
                                    bg-white/5 hover:bg-white/10 text-white
                                    font-medium py-3 px-6 rounded-sm text-[13px]
                                    border border-white/15 hover:border-white/30
                                    backdrop-blur-md
                                    transition-all duration-300"
                            >
                                {currentSlide.secondaryCta.text}
                            </Link>
                        </div>

                        {/* Guarantees as small rounded cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-6 max-w-2xl border-t border-white/10">
                            {guarantees.map(({ icon: Icon, label, sub }) => (
                                <div
                                    key={label}
                                    className="flex items-center gap-2.5
                                        rounded-sm bg-white/5 hover:bg-white/10
                                        border border-white/10 hover:border-white/20
                                        backdrop-blur-md px-3 py-2.5
                                        transition-colors duration-300"
                                >
                                    <div className="p-1.5 rounded-sm bg-blue-500/15 border border-blue-400/20 shrink-0">
                                        <Icon className="w-3.5 h-3.5 text-blue-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-white leading-tight truncate">
                                            {label}
                                        </p>
                                        <p className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">
                                            {sub}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                </div>

                {/* Carousel Controls & Slide Indicators Bottom Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-5 border-t border-white/10 z-20 relative">

                    {/* Slide Indicators / Dots */}
                    <div className="flex items-center gap-2 mb-4 sm:mb-0">
                        {heroSlides.map((slide, index) => (
                            <button
                                key={slide.id}
                                type="button"
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    currentIndex === index
                                        ? 'w-7 bg-blue-500'
                                        : 'w-2.5 bg-white/20 hover:bg-white/35'
                                }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>

                    {/* Previous / Next Buttons as rounded cards */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="group
                                bg-white/5 hover:bg-white/10
                                text-slate-200 hover:text-white
                                p-2 rounded-full
                                border border-white/15 hover:border-white/30
                                backdrop-blur-md
                                transition-all duration-300"
                            aria-label="Previous slide"
                        >
                            <ChevronLeft className="w-7 h-7 transition-transform duration-300 group-hover:-translate-x-0.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            className="group
                                bg-white/5 hover:bg-white/10
                                text-slate-200 hover:text-white
                                p-2 rounded-full
                                border border-white/15 hover:border-white/30
                                backdrop-blur-md
                                transition-all duration-300"
                            aria-label="Next slide"
                        >
                            <ChevronRight className="w-7 h-7 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </button>
                    </div>

                </div>

            </div>
        </section>
    );
}