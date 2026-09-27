import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { STEPS } from '@/lib/onboardingSteps';

export default function OnboardingWelcome() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-sm shadow-sm p-6 sm:p-10">

                {/* Icon */}
                <div className="w-16 h-16 rounded-sm bg-blue-50 flex items-center justify-center mx-auto">
                    <ShoppingBag className="h-8 w-8 text-blue-950" />
                </div>

                {/* Heading */}
                <div className="text-center mt-6">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Welcome to TechHub 👋
                    </h1>
                    <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                        Let's get your electronics shop online in about 10 minutes.
                        You can pause and resume anytime.
                    </p>
                </div>

                {/* Steps preview */}
                <div className="mt-8 border border-slate-200 rounded-sm bg-slate-50 p-4 sm:p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        What we'll set up
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {STEPS.map((step, idx) => (
                            <li key={step.slug} className="flex items-center gap-2 text-xs text-slate-700">
                                <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {idx + 1}
                                </span>
                                <span className="truncate">{step.title}</span>
                                {step.optional && (
                                    <span className="text-[9px] text-slate-400">(optional)</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CTA */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/auth/onboarding/steps/step1"
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-5 py-2.5 rounded-sm text-sm transition-colors"
                    >
                        Start setup
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                        href="/admin/"
                        className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-5 py-2.5 rounded-sm text-sm transition-colors"
                    >
                        I'll do this later
                    </Link>
                </div>

                <p className="text-[11px] text-slate-400 text-center mt-6">
                    Takes ~10 minutes · You can change everything later
                </p>
            </div>
        </div>
    );
}