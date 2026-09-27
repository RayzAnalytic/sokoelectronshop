// components/onboarding/StepFooter.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Rocket } from 'lucide-react';
import { STEPS, getPreviousRoute, getNextRoute, getStepIndex } from '@/lib/onboardingSteps';

type StepFooterProps = {
    onContinue: () => Promise<void> | void;
    onSkip?: () => Promise<void> | void;
    loading?: boolean;
    currentSlug: string;
    optional?: boolean;
};

export default function StepFooter({
    onContinue,
    onSkip,
    loading = false,
    currentSlug,
    optional = false,
}: StepFooterProps) {
    const router = useRouter();
    const idx = getStepIndex(currentSlug);
    const isFirst = idx === 0;
    const isLast = idx === STEPS.length - 1;

    const handleBack = () => {
        if (isFirst) return;
        router.push(getPreviousRoute(currentSlug));
    };

    const handleContinue = async () => {
        if (loading) return;
        await onContinue();
    };

    const handleSkip = async () => {
        if (loading) return;
        if (onSkip) {
            await onSkip();
        } else {
            router.push(getNextRoute(currentSlug));
        }
    };

    return (
        <div className="pt-2 flex items-center justify-between gap-3">
            {/* Back */}
            <button
                type="button"
                onClick={handleBack}
                disabled={isFirst || loading}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
            </button>

            {/* Skip + Continue */}
            <div className="flex items-center gap-2">
                {optional && !isLast && (
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={loading}
                        className="text-xs font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-sm transition-colors disabled:opacity-40"
                    >
                        Skip
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleContinue}
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
    );
}