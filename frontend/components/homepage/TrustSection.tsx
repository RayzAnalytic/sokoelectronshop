'use client';

import React from 'react';
import Image from 'next/image';
import { ShieldCheck, Award, Truck, Headphones } from 'lucide-react';

export default function TrustSection() {
    const trustFeatures = [
        {
            icon: ShieldCheck,
            title: 'Secure Payments',
            description: 'Encrypted transactions with 256-bit SSL security and PCI-DSS compliance for all major credit cards and digital wallets.',
        },
        {
            icon: Award,
            title: 'Official Warranty',
            description: 'Every electronics product is backed by a 2-year manufacturer warranty with certified repair and replacement support.',
        },
        {
            icon: Truck,
            title: 'Reliable Delivery',
            description: 'Fast, insured shipping with real-time tracking, handling fragile electronics with specialized care packaging.',
        },
        {
            icon: Headphones,
            title: 'Customer Support',
            description: 'Dedicated technical support and customer service experts available via live chat and email 7 days a week.',
        },
    ];

    const paymentMethods = [
        {
            name: 'Stripe',
            description: 'Global credit & debit cards',
            logo: '/stripe.png',
            alt: 'Stripe Payment',
        },
        {
            name: 'Bank Transfer',
            description: 'Direct secure wire transfers',
            logo: '/bank.png',
            alt: 'Bank Transfer',
        },
        {
            name: 'M-Pesa',
            description: 'Instant mobile checkout',
            logo: '/mpesa.png',
            alt: 'M-Pesa Payment',
        },
        {
            name: 'Airtel Money',
            description: 'Fast mobile payments',
            logo: '/airtel.png',
            alt: 'Airtel Money Payment',
        },
    ];

    return (
        <section className="bg-white py-6 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">

                {/* Section Header */}
                <div className="text-center max-w-2xl mx-auto mb-3">
                    <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-950 bg-blue-50 px-2 py-0.5 rounded-sm mb-1.5">
                        <span>Why Shop With Us</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Built on Trust & Reliability
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-0.5">
                        We are committed to providing a seamless, secure shopping experience with verified guarantees you can depend on.
                    </p>
                </div>

                {/* Trust Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    {trustFeatures.map((feature, index) => {
                        const IconComponent = feature.icon;
                        return (
                            <div
                                key={index}
                                className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 flex flex-col justify-between hover:border-blue-200 transition-colors"
                            >
                                <div>
                                    <div className="w-8 h-8 rounded-sm bg-blue-950 text-white flex items-center justify-center mb-2 shadow-xs">
                                        <IconComponent className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
                                        {feature.title}
                                    </h3>
                                    <p className="text-[13px] text-slate-600 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Payment Methods Sub-Section with Image Logos */}
                <div className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2">
                    <div className="text-center mb-3">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Accepted Payment Methods
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {paymentMethods.map((method, idx) => (
                            <div
                                key={idx}
                                className="bg-white border border-slate-200 rounded-sm px-3 py-2 flex items-center gap-3 shadow-2xs hover:border-blue-950 transition-colors"
                            >
                                <div className="w-8 h-8 relative rounded-sm overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                    <Image
                                        src={method.logo}
                                        alt={method.alt}
                                        fill
                                        sizes="32px"
                                        className="object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                                        {method.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate">
                                        {method.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </section>
    );
}