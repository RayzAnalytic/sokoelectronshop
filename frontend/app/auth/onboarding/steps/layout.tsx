// app/onboarding/steps/layout.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Store,
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
} from 'lucide-react';

const STEPS = [
  { id: 1, slug: 'step1', label: 'Account' },
  { id: 2, slug: 'step2', label: 'Store' },
  { id: 3, slug: 'step3', label: 'Shipping' },
  { id: 4, slug: 'step4', label: 'Category' },
  { id: 5, slug: 'step5', label: 'Product' },
  { id: 6, slug: 'step6', label: 'Team' },
  { id: 7, slug: 'step7', label: 'Finish' },
];

export default function OnboardingStepsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine current step from URL: /onboarding/steps/stepN
  const match = pathname?.match(/\/onboarding\/steps\/step(\d+)/);
  const currentStep = match ? parseInt(match[1], 10) : 1;
  const totalSteps = STEPS.length;

  const isLastStep = currentStep >= totalSteps;
  const isFirstStep = currentStep <= 1;

  const goBack = () => {
    if (!isFirstStep) router.push(`/onboarding/steps/step${currentStep - 1}`);
  };

  const goNext = () => {
    if (!isLastStep) router.push(`/onboarding/steps/step${currentStep + 1}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">

      {/* ─── HEADER ─── */}
      <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-3">
          <Link
            href="/onboarding"
            className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity"
          >
            <span className="h-7 w-7 rounded-sm bg-blue-950 text-white flex items-center justify-center shrink-0">
              <Store className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13px] font-semibold text-slate-900 truncate">
              SokoFlow
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[13px] text-slate-500 font-mono">
              Step {currentStep} of {totalSteps}
            </span>
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-2.5 py-2 rounded-sm text-[13px]"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save & exit</span>
              <span className="sm:hidden">Save</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── BODY: SIDEBAR + CONTENT ─── */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-3 sm:px-4 py-3 sm:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">

          {/* ─── SIDEBAR (progress rail) ─── */}
          <aside className="lg:col-span-3">
            <nav className="bg-white border border-slate-200 rounded-sm p-2 lg:sticky lg:top-20">
              <p className="hidden lg:block text-[13px] font-medium text-slate-400 px-2 mb-2">
                Setup progress
              </p>

              {/* Desktop: vertical list */}
              <ol className="hidden lg:block space-y-0.5">
                {STEPS.map((s) => {
                  const isDone = s.id < currentStep;
                  const isActive = s.id === currentStep;
                  return (
                    <li key={s.id}>
                      <Link
                        href={
                          isDone || isActive
                            ? `/onboarding/steps/${s.slug}`
                            : '#'
                        }
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-sm text-[13px] font-medium transition ${
                          isActive
                            ? 'bg-blue-950 text-white'
                            : isDone
                              ? 'text-slate-700 hover:bg-slate-100'
                              : 'text-slate-400 cursor-not-allowed'
                        }`}
                        aria-current={isActive ? 'step' : undefined}
                        aria-disabled={!isDone && !isActive}
                        onClick={(e) => {
                          if (!isDone && !isActive) e.preventDefault();
                        }}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 border ${
                            isActive
                              ? 'bg-white text-blue-950 border-white'
                              : isDone
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          {isDone ? <Check className="h-2.5 w-2.5" /> : s.id}
                        </span>
                        <span className="truncate">{s.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>

              {/* Mobile: horizontal dots + label */}
              <div className="lg:hidden flex items-center gap-2 px-1 py-1">
                <div className="flex items-center gap-1 shrink-0">
                  {STEPS.map((s) => {
                    const isDone = s.id < currentStep;
                    const isActive = s.id === currentStep;
                    return (
                      <span
                        key={s.id}
                        className={`h-1.5 rounded-full transition-all ${
                          isActive
                            ? 'w-6 bg-blue-950'
                            : isDone
                              ? 'w-1.5 bg-emerald-600'
                              : 'w-1.5 bg-slate-200'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[13px] font-medium text-slate-700 truncate">
                  {currentStep}. {STEPS[currentStep - 1]?.label}
                </span>
                <span className="ml-auto text-[13px] text-slate-400 font-mono shrink-0">
                  {currentStep}/{totalSteps}
                </span>
              </div>
            </nav>
          </aside>

          {/* ─── CONTENT ─── */}
          <main className="lg:col-span-9 min-w-0">
            <div className="bg-white border border-slate-200 rounded-sm">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* ─── FOOTER: BACK / NEXT ─── */}
      <footer className="bg-white border-t border-slate-200 sticky bottom-0 z-20">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirstStep}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5">
            {STEPS.map((s) => {
              const isDone = s.id < currentStep;
              const isActive = s.id === currentStep;
              return (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    isActive
                      ? 'w-6 bg-blue-950'
                      : isDone
                        ? 'w-1.5 bg-emerald-600'
                        : 'w-1.5 bg-slate-200'
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={isLastStep}
            className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-3 py-2 rounded-sm text-[13px]"
          >
            <span>{isLastStep ? 'Done' : 'Continue'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}