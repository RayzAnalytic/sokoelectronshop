'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Check,
    UserCheck,
    Store,
    FileBadge,
    CreditCard,
    MessageCircle,
    Truck,
    FolderTree,
    Package,
    Share2,
    Palette,
    Users,
    Rocket,
} from 'lucide-react';
import { STEPS, StepSlug, getSlugFromPathname, getStepIndex } from '@/lib/onboardingSteps';

type IconType = React.ComponentType<{ className?: string }>;

const ICONS: Record<StepSlug, IconType> = {
    step1: UserCheck,
    step2: Store,
    step3: FileBadge,
    step4: CreditCard,
    step5: MessageCircle,
    step6: Truck,
    step7: FolderTree,
    step8: Package,
    step9: Share2,
    step10: Palette,
    step11: Users,
    step12: Rocket,
};

export default function Sidebar() {
    const pathname = usePathname();
    const activeSlug = getSlugFromPathname(pathname);
    const currentIdx = activeSlug ? getStepIndex(activeSlug) : -1;
    const isCompletionPage = pathname.includes('/auth/onboarding/complete');

    const stepNumber = currentIdx >= 0
        ? currentIdx + 1
        : isCompletionPage
            ? STEPS.length
            : 1;

    const progress = isCompletionPage
        ? 100
        : currentIdx < 0
            ? 0
            : Math.round((currentIdx / STEPS.length) * 100);

    return (
        <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 bg-white border-r border-slate-200 sticky top-16 h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="p-5 flex-1">
                <div className="mb-5 pb-5 border-b border-slate-100">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        Setup progress
                    </p>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-900">{progress}%</span>
                        <span className="text-[11px] text-slate-500">
                            {Math.min(stepNumber, STEPS.length)} of {STEPS.length} done
                        </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full bg-blue-950 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <nav className="space-y-0.5">
                    {STEPS.map((step, idx) => {
                        const Icon = ICONS[step.slug];
                        const isCurrent = idx === currentIdx;
                        const isComplete = idx < currentIdx || isCompletionPage;

                        return (
                            <Link
                                key={step.slug}
                                href={`/auth/onboarding/steps/${step.slug}`}
                                className={`flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors ${isCurrent
                                        ? 'bg-blue-50 border-l-2 border-blue-950'
                                        : isComplete
                                            ? 'hover:bg-slate-50'
                                            : 'hover:bg-slate-50 opacity-70'
                                    }`}
                                aria-current={isCurrent ? 'step' : undefined}
                            >
                                <span
                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${isCurrent
                                            ? 'bg-blue-950 text-white'
                                            : isComplete
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                                        }`}
                                >
                                    {isComplete && !isCurrent ? (
                                        <Check className="h-3.5 w-3.5" />
                                    ) : (
                                        <Icon className="h-3.5 w-3.5" />
                                    )}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p
                                            className={`text-xs font-semibold truncate ${isCurrent ? 'text-blue-950' : 'text-slate-800'
                                                }`}
                                        >
                                            {step.title}
                                        </p>
                                        {step.optional && (
                                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                                                Optional
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                        {step.description}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-5 border-t border-slate-100">
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                    You can complete the rest later from Settings.
                </p>
                <Link
                    href="/admin"
                    className="text-[11px] font-medium text-slate-600 hover:text-blue-950 hover:underline"
                >
                    Skip all setup →
                </Link>
            </div>
        </aside>
    );
}