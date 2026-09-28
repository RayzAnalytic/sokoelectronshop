'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Save } from 'lucide-react';
import { STEPS, getSlugFromPathname, getStepIndex } from '@/lib/onboardingSteps';

export default function Header() {
    const pathname = usePathname();
    const activeSlug = getSlugFromPathname(pathname);
    const currentIdx = activeSlug ? getStepIndex(activeSlug) : -1;
    const isCompletionPage = pathname.includes('/auth/onboarding/complete');

    const stepNumber = currentIdx >= 0
        ? currentIdx + 1
        : isCompletionPage
            ? STEPS.length
            : 1;

    const progress = React.useMemo(() => {
        if (isCompletionPage) return 100;
        if (currentIdx < 0) return 0;
        return Math.round((currentIdx / STEPS.length) * 100);
    }, [currentIdx, isCompletionPage]);

    return (
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
            <div className="h-16 flex items-center justify-between px-4 sm:px-6">
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
                            {isCompletionPage ? 'You are all set' : 'Setting up your store'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                            {isCompletionPage
                                ? `All ${STEPS.length} steps complete`
                                : `Step ${stepNumber} of ${STEPS.length}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-sm transition-colors"
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Need help?
                    </button>
                    <Link
                        href="/admin"
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs transition-colors"
                    >
                        <Save className="h-3.5 w-3.5 sm:hidden" />
                        <span className="hidden sm:inline">Save &amp; exit</span>
                        <span className="sm:hidden">Save</span>
                    </Link>
                </div>
            </div>

            <div className="h-0.5 w-full bg-slate-100">
                <div
                    className="h-full bg-blue-950 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </header>
    );
}