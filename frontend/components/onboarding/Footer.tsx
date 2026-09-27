// components/onboarding/Footer.tsx

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { STEPS, getStepIndex, getNextRoute, getPreviousRoute } from '@/lib/onboardingSteps';

export default function Footer() {
    const router = useRouter();
    const pathname = usePathname();

    const currentIdx = STEPS.findIndex((s) => pathname.includes(s.slug));
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const stepNumber = safeIdx + 1;
    const isFirst = safeIdx === 0;
    const isLast = safeIdx === STEPS.length - 1;
    const currentStep = STEPS[safeIdx] ?? STEPS[0];

    const goBack = () => {
        if (isFirst) return;
        router.push(getPreviousRoute(currentStep.slug));
    };

    const goNext = () => {
        router.push(getNextRoute(currentStep.slug));
    };

    return (
        <footer className="sticky bottom-0 z-40 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
                {/* Back */}
                <button
                    type="button"
                    onClick={goBack}
                    disabled={isFirst}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Go back to previous step"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Back</span>
                </button>

                {/* Counter */}
                <p className="hidden md:block text-[11px] text-slate-500 truncate">
                    Step {stepNumber} of {STEPS.length} · {currentStep.title}
                </p>

                {/* Skip + Continue */}
                <div className="flex items-center gap-2">
                    {currentStep.optional && !isLast && (
                        <button
                            type="button"
                            onClick={goNext}
                            className="text-xs font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-sm transition-colors"
                        >
                            Skip
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={goNext}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition-colors"
                    >
                        {isLast ? (
                            <>
                                <Rocket className="h-3.5 w-3.5" />
                                Finish setup
                            </>
                        ) : (
                            <>
                                Continue
                                <ArrowRight className="h-3.5 w-3.5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </footer>
    );
}