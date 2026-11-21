'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    ShieldCheck,
    Award,
    Truck,
    Headphones,
    ArrowRight,
    RotateCcw,
    Banknote,
} from 'lucide-react';

export default function TrustSection() {
    const trustFeatures = [
        {
            icon: ShieldCheck,
            title: 'Secure Payments',
            description:
                'Encrypted transactions with 256-bit SSL and PCI-DSS compliance for cards and digital wallets.',
        },
        {
            icon: Award,
            title: 'Official Warranty',
            description:
                'Every product is backed by a 2-year manufacturer warranty with certified repair and replacement.',
        },
        {
            icon: Truck,
            title: 'Reliable Delivery',
            description:
                'Fast, insured shipping with real-time tracking and specialist care packaging.',
        },
        {
            icon: Headphones,
            title: 'Customer Support',
            description:
                'Live chat and email support, Monday to Saturday, 9am–7pm EAT.',
        },
    ];

    const paymentMethods = [
        {
            name: 'M-Pesa',
            description: 'Instant mobile checkout',
            logo: '/mpesa.png',
            alt: 'M-Pesa Payment',
            icon: null,
        },
        {
            name: 'Payment on Delivery',
            description: 'Pay cash when your order arrives',
            logo: null,
            alt: 'Payment on Delivery',
            icon: Banknote,
        },
    ];

    return (
        <section className="bg-white py-4 xs:py-5 sm:py-6 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-6">
                <div className="text-center max-w-2xl mx-auto mb-2">
                    <span className="inline-flex items-center text-[10px] xs:text-[11px] sm:text-[13px] font-semibold text-[#0B0D10] bg-[#00E5FF] border border-[#00E5FF] px-2 xs:px-2.5 py-0.5 xs:py-1 rounded mb-1">
                        Why Shop With Us
                    </span>
                    <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-[#111827]">
                        Built on <span className="text-[#00B8D4]">Trust</span> &amp; Reliability
                    </h2>
                    <p className="text-[11px] xs:text-[12px] sm:text-[13px] text-[#6B7280] mt-1  ">
                        We provide a seamless, secure shopping experience with
                        verified guarantees you can depend on.
                    </p>
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3 mb-3">
                    {trustFeatures.map((feature, index) => {
                        const IconComponent = feature.icon;
                        return (
                            <div
                                key={index}
                                className="bg-white border border-slate-200 rounded p-2 xs:p-2.5 sm:p-3 hover:border-[#00B8D4] hover:shadow transition-all duration-150"
                            >
                                <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded bg-[#0B0D10] text-[#00E5FF] flex items-center justify-center mb-1.5 xs:mb-2 sm:mb-2.5">
                                    <IconComponent className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
                                </div>
                                <h3 className="text-[11px] xs:text-[12px] sm:text-[13px] font-semibold text-[#111827] mb-0.5 xs:mb-1 ">
                                    {feature.title}
                                </h3>
                                <p className="text-[10px] xs:text-[11px] sm:text-[13px] text-[#6B7280] ">
                                    {feature.description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-[#F3F6F9] border border-slate-200 rounded p-2.5 xs:p-3 mb-2 xs:mb-2 flex items-start gap-2 xs:gap-2">
                    <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded bg-[#0B0D10] text-[#00E5FF] flex items-center justify-center shrink-0">
                        <RotateCcw className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] xs:text-[12px] sm:text-[13px] font-semibold text-[#111827] ">
                            30-Day Money-Back Guarantee
                        </p>
                        <p className="text-[10px] xs:text-[11px] sm:text-[13px] text-[#6B7280] mt-0.5 ">
                            Not satisfied? Return any item within 30 days for a
                            full refund. No restocking fees, no questions asked.
                        </p>
                    </div>
                </div>

                <div className="bg-[#F3F6F9] border border-slate-200 rounded p-2.5 xs:p-3 mb-4 xs:mb-5 sm:mb-6">
                    <h3 className="text-[10px] xs:text-[11px] sm:text-[13px] font-semibold text-[#6B7280] uppercase text-center mb-2 xs:mb-3">
                        Accepted Payment Methods
                    </h3>
                    <div className="flex flex-wrap justify-center gap-2 xs:gap-3">
                        {paymentMethods.map((method, idx) => {
                            const IconComponent = method.icon;
                            return (
                                <div
                                    key={idx}
                                    className="bg-white border border-slate-200 rounded px-2 xs:px-3 py-1.5 xs:py-2 flex items-center gap-2 xs:gap-3 hover:border-[#00B8D4] transition-colors max-w-full"
                                >
                                    <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 relative rounded overflow-hidden bg-[#F3F6F9] flex items-center justify-center shrink-0 border border-slate-200">
                                        {method.logo ? (
                                            <Image
                                                src={method.logo}
                                                alt={method.alt}
                                                fill
                                                sizes="40px"
                                                className="object-cover"
                                            />
                                        ) : IconComponent ? (
                                            <IconComponent className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-[#00B8D4]" />
                                        ) : null}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] xs:text-[12px] sm:text-[13px] font-semibold text-[#111827] truncate">
                                            {method.name}
                                        </p>
                                        <p className="text-[10px] xs:text-[11px] sm:text-[13px] text-[#6B7280] truncate">
                                            {method.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-center gap-2 xs:gap-3 mb-2">
                    <Link
                        href="/pages/products"
                        className="inline-flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] font-bold text-[11px] xs:text-[12px] sm:text-[13px] px-3 xs:px-4 py-1.5 xs:py-2 rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00B8D4]"
                    >
                        Start Shopping
                        <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                    </Link>
                    <Link
                        href="/support"
                        className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F3F6F9] text-[#111827] font-medium text-[11px] xs:text-[12px] sm:text-[13px] px-3 xs:px-4 py-1.5 xs:py-2 rounded border border-slate-200 hover:border-[#00B8D4] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00B8D4]"
                    >
                        Contact Support
                    </Link>
                </div>

                <p className="text-[10px] xs:text-[11px] sm:text-[13px] text-[#6B7280] text-center">
                    Questions?{' '}
                    <Link
                        href="/support"
                        className="text-[#111827] hover:text-[#00B8D4] hover:underline font-medium"
                    >
                        Chat with us
                    </Link>{' '}
                    or email{' '}
                    <a
                        href="mailto:support@havenstechnologies.co.ke"
                        className="text-[#111827] hover:text-[#00B8D4] hover:underline font-medium break-all"
                    >
                        support@havenstechnologies.co.ke
                    </a>
                </p>
            </div>
        </section>
    );
}