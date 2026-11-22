'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { categories } from '@/data/categories';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    const categoriesLinks = categories.slice(0, 6).map((cat) => ({
        name: cat.name,
        href: cat.href,
    }));

    const supportLinks = [
        { name: 'Help Center', href: '/support' },
        { name: 'Order Tracking', href: '/orders/track' },
        { name: 'Returns & Refunds', href: '/returns' },
        { name: 'Shipping Info', href: '/shipping' },
    ];

    const accountLinks = [
        { name: 'Sign In', href: '/login' },
        { name: 'Register', href: '/register' },
        { name: 'Order History', href: '/account/orders' },
        { name: 'Wishlist', href: '/account/wishlist' },
    ];

    const legalLinks = [
        { name: 'Terms', href: '/terms' },
        { name: 'Privacy', href: '/privacy' },
        { name: 'Cookies', href: '/cookies' },
    ];

    const socialLinks = [
        { name: 'GitHub', href: 'https://github.com' },
        { name: 'LinkedIn', href: 'https://linkedin.com' },
        { name: 'Twitter', href: 'https://twitter.com' },
    ];

    return (
        <footer className="bg-blue-950 text-slate-300 text-[11px] xs:text-[12px] sm:text-[13px]">
            <div className="h-0.5 bg-white" />

            <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-6 xs:py-7 sm:py-8 lg:py-10">

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 xs:gap-6 sm:gap-8 lg:gap-12">

                    <div className="col-span-2 md:col-span-1 space-y-2 xs:space-y-3">
                        <Link
                            href="/"
                            className="flex flex-col items-start shrink-0"
                            aria-label="RAZE STORE — Feel the Quality"
                        >
                            <Image
                                src="/logo.jpeg"
                                alt="RAZE STORE"
                                width={400}
                                height={100}
                                priority
                                className="h-9 sm:h-10 w-auto object-contain"
                            />
                            <span className="mt-1.5 text-[10px] xs:text-[11px] tracking-[0.18em] uppercase text-slate-300 font-semibold">
                                Feel the Quality
                            </span>
                        </Link>
                        <p className="text-slate-300 max-w-xs text-[11px] xs:text-[12px] pt-1">
                            Premium electronics and certified hardware, backed by comprehensive warranties.
                        </p>
                        <p className="text-[11px] xs:text-[12px] text-white pt-1 truncate">
                            support@razestore.co.ke
                        </p>
                        <a
                            href="tel:+254705479906"
                            className="block text-[11px] xs:text-[12px] text-white hover:text-slate-300 transition-colors truncate"
                        >
                            0705 479 906
                        </a>
                    </div>

                    <div>
                        <h3 className="font-semibold text-white uppercase mb-2 xs:mb-3 text-[10px] xs:text-[11px]">
                            Shop
                        </h3>
                        <ul className="space-y-1.5 xs:space-y-2">
                            {categoriesLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-slate-300 hover:text-white transition-colors inline-block truncate max-w-full"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold text-white uppercase mb-2 xs:mb-3 text-[10px] xs:text-[11px]">
                            Support
                        </h3>
                        <ul className="space-y-1.5 xs:space-y-2">
                            {supportLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-slate-300 hover:text-white transition-colors inline-block truncate max-w-full"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold text-white uppercase mb-2 xs:mb-3 text-[10px] xs:text-[11px]">
                            Account
                        </h3>
                        <ul className="space-y-1.5 xs:space-y-2">
                            {accountLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-slate-300 hover:text-white transition-colors inline-block truncate max-w-full"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

                <div className="mt-6 xs:mt-7 sm:mt-8 pt-4 xs:pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 xs:gap-3">

                    <p className="text-slate-400 text-[10px] xs:text-[11px] sm:text-[12px] order-2 sm:order-1 text-center sm:text-left">
                        &copy; {currentYear} RAZE STORE. All rights reserved.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-x-3 xs:gap-x-4 sm:gap-x-5 gap-y-1.5 xs:gap-y-2 text-[10px] xs:text-[11px] sm:text-[12px] order-1 sm:order-2">
                        {legalLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                            >
                                {link.name}
                            </Link>
                        ))}
                        <span className="hidden sm:inline text-slate-500">|</span>
                        {socialLinks.map((social) => (
                            <a
                                key={social.name}
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                            >
                                {social.name}
                            </a>
                        ))}
                    </div>

                </div>

            </div>
        </footer>
    );
}