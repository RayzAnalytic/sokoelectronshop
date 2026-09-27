'use client';

import React from 'react';
import Link from 'next/link';
import { categories } from '@/data/categories';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    // Pull the first 6 categories from the shared data file
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
        <footer className="bg-white border-t border-slate-200 text-slate-600 text-[13px]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">

                {/* Top: Brand + Link Columns */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">

                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1 space-y-3">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8 h-8 bg-blue-950 text-white rounded-lg font-bold text-sm shadow-sm">
                                N
                            </div>
                            <span className="font-bold text-slate-900 text-sm tracking-tight">
                                NordicStore
                            </span>
                        </Link>
                        <p className="text-slate-600 leading-relaxed max-w-xs text-[12px]">
                            Premium electronics and certified hardware, backed by comprehensive warranties.
                        </p>
                        <p className="text-[12px] text-slate-500 pt-1">
                            support@nordicstore.example
                        </p>
                    </div>

                    {/* Shop */}
                    <div>
                        <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-3 text-[11px]">
                            Shop
                        </h3>
                        <ul className="space-y-2">
                            {categoriesLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="hover:text-blue-950 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-3 text-[11px]">
                            Support
                        </h3>
                        <ul className="space-y-2">
                            {supportLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="hover:text-blue-950 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Account */}
                    <div>
                        <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-3 text-[11px]">
                            Account
                        </h3>
                        <ul className="space-y-2">
                            {accountLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="hover:text-blue-950 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">

                    <p className="text-slate-500 text-[12px] order-2 sm:order-1">
                        &copy; {currentYear} NordicStore Inc.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] order-1 sm:order-2">
                        {legalLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="hover:text-blue-950 transition-colors"
                            >
                                {link.name}
                            </Link>
                        ))}
                        <span className="hidden sm:inline text-slate-300">|</span>
                        {socialLinks.map((social) => (
                            <a
                                key={social.name}
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-950 transition-colors"
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