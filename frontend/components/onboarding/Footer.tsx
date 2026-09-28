'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Rocket } from 'lucide-react';
import {
    STEPS,
    getSlugFromPathname,
    getStepIndex,
    getNextRoute,
    getPreviousRoute,
} from '@/lib/onboardingSteps';
import { useStepContext } from './StepContext';

export default function Footer() {
    const router = useRouter();
    const pathname = usePathname();
    const { submitHandler, loading, setLoading } = useStepContext();

    const slug = getSlugFromPathname(pathname);
    const safeIdx = slug ? getStepIndex(slug) : 0;
    const stepNumber = safeIdx + 1;
    const isFirst = safeIdx === 0;
    const isLast = safeIdx === STEPS.length - 1;
    const currentStep = STEPS[safeIdx] ?? STEPS[0];

    const goBack = () => {
        if (isFirst || loading) return;
        router.push(getPreviousRoute(currentStep.slug));
    };

    const goNext = async () => {
        if (loading) return;
        setLoading(true);
        try {
            if (submitHandler) {
                const ok = await submitHandler();
                if (!ok) return;
            }
            router.push(getNextRoute(currentStep.slug));
        } finally {
            setLoading(false);
        }
    };

    return (
        <footer className="sticky bottom-0 z-40 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={goBack}
                    disabled={isFirst || loading}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Back</span>
                </button>

                <p className="hidden md:block text-[11px] text-slate-500 truncate">
                    Step {stepNumber} of {STEPS.length} · {currentStep.title}
                </p>

                <div className="flex items-center gap-2">
                    {currentStep.optional && !isLast && (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={loading}
                            className="text-xs font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-sm transition-colors disabled:opacity-40"
                        >
                            Skip
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={goNext}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-medium px-4 py-2 rounded-sm text-xs transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Saving...
                            </>
                        ) : isLast ? (
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