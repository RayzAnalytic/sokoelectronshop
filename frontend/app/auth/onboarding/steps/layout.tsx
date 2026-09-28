'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/onboarding/Header';
import Sidebar from '@/components/onboarding/Sidebar';
import Footer from '@/components/onboarding/Footer';
import { StepProvider } from '@/components/onboarding/StepContext';
import { STEPS, getStepBySlug, getStepNumber, getSlugFromPathname } from '@/lib/onboardingSteps';

export default function OnboardingStepsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const slug = getSlugFromPathname(pathname) ?? 'step1';
    const current = getStepBySlug(slug);
    const stepNumber = getStepNumber(slug);
    const total = STEPS.length;

    return (
        <StepProvider>
            <div className="min-h-screen flex flex-col bg-slate-50">
                <Header />

                <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2">
                    <p className="text-[11px] font-medium text-slate-700 truncate">
                        {current?.title ?? 'Onboarding'}
                        <span className="text-slate-400 ml-2">
                            ({stepNumber}/{total})
                        </span>
                    </p>
                </div>

                <div className="flex flex-1">
                    <Sidebar />
                    <main className="flex-1 min-w-0">
                        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                            {children}
                        </div>
                    </main>
                </div>

                <Footer />
            </div>
        </StepProvider>
    );
}