// components/onboarding/Header.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Save } from 'lucide-react';
import { STEPS, getStepIndex } from '@/lib/onboardingSteps';

export default function Header() {
    const pathname = usePathname();
    const currentIdx = STEPS.findIndex((s) => pathname.includes(s.slug));
    const stepNumber = currentIdx >= 0 ? currentIdx + 1 : 1;
    const progress = (stepNumber / STEPS.length) * 100;

    return (
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
            <div className="h-16 flex items-center justify-between px-4 sm:px-6">
                {/* Left: brand + step counter */}
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/"
                        className="h-9 w-9 rounded-sm bg-blue-950 text-white flex items-center justify-center font-bold shrink-0 hover:bg-blue-900 transition-colors"
                        aria-label="Home"
                    >
                        S
                    </Link>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                            Setting up your store
                        </p>
                        <p className="text-[11px] text-slate-500">
                            Step {stepNumber} of {STEPS.length}
                        </p>
                    </div>
                </div>

                {/* Right: help + save & exit */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-sm transition-colors"
                        aria-label="Get help"
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Need help?
                    </button>
                    <Link
                        href="/admin/dashboard"
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs transition-colors"
                    >
                        <Save className="h-3.5 w-3.5 sm:hidden" />
                        <span className="hidden sm:inline">Save & exit</span>
                        <span className="sm:hidden">Save</span>
                    </Link>
                </div>
            </div>

            {/* Thin progress bar */}
            <div className="h-0.5 w-full bg-slate-100">
                <div
                    className="h-full bg-blue-950 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </header>
    );
}