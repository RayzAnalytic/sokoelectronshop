// components/trustsection/TrustSection.tsx
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
    MapPin,
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
        <section className="bg-white py-6 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6">
                <div className="text-center max-w-2xl mx-auto mb-3">
                    <span className="inline-flex items-center text-[13px] font-medium text-blue-950 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md mb-1">
                        Why Shop With Us
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                        Built on Trust &amp; Reliability
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-1">
                        We provide a seamless, secure shopping experience with
                        verified guarantees you can depend on.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    {trustFeatures.map((feature, index) => {
                        const IconComponent = feature.icon;
                        return (
                            <div
                                key={index}
                                className="bg-white border border-slate-200 rounded-sm p-3 hover:border-blue-200 hover:shadow-sm transition-all duration-150"
                            >
                                <div className="w-9 h-9 rounded-sm bg-blue-950 text-white flex items-center justify-center mb-2.5">
                                    <IconComponent className="w-4 h-4" />
                                </div>
                                <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
                                    {feature.title}
                                </h3>
                                <p className="text-[13px] text-slate-600">
                                    {feature.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-blue-950 text-white flex items-center justify-center shrink-0">
                        <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900">
                            30-Day Money-Back Guarantee
                        </p>
                        <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">
                            Not satisfied? Return any item within 30 days for a
                            full refund. No restocking fees, no questions asked.
                        </p>
                    </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 mb-6">
                    <h3 className="text-[13px] font-semibold text-slate-500 uppercase text-center mb-3">
                        Accepted Payment Methods
                    </h3>
                    <div className="flex flex-wrap justify-center gap-3">
                        {paymentMethods.map((method, idx) => {
                            const IconComponent = method.icon;
                            return (
                                <div
                                    key={idx}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-3 hover:border-blue-950 transition-colors"
                                >
                                    <div className="w-10 h-10 relative rounded-md overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                        {method.logo ? (
                                            <Image
                                                src={method.logo}
                                                alt={method.alt}
                                                fill
                                                sizes="40px"
                                                className="object-cover"
                                            />
                                        ) : IconComponent ? (
                                            <IconComponent className="w-5 h-5 text-blue-950" />
                                        ) : null}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                                            {method.name}
                                        </p>
                                        <p className="text-[13px] text-slate-500 truncate">
                                            {method.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
                    <Link
                        href="/pages/products"
                        className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-medium text-[13px] px-4 py-2 rounded-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-950/40"
                    >
                        Start Shopping
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                        href="/support"
                        className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 font-medium text-[13px] px-4 py-2 rounded-sm border border-slate-200 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                    >
                        Contact Support
                    </Link>
                </div>

                <p className="text-[13px] text-slate-500 text-center">
                    Questions?{' '}
                    <Link
                        href="/support"
                        className="text-blue-950 hover:underline font-medium"
                    >
                        Chat with us
                    </Link>{' '}
                    or email{' '}
                    <a
                        href="mailto:support@myshop.co.ke"
                        className="text-blue-950 hover:underline font-medium"
                    >
                        support@myshop.co.ke
                    </a>
                </p>
            </div>
        </section>
    );
}