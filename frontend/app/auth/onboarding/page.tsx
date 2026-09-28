// app/onboarding/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Store,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Users,
  Truck,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function OnboardingWelcomePage() {
  const steps = [
    { label: 'Account', icon: ShieldCheck, desc: 'Secure your owner account' },
    { label: 'Store', icon: Store, desc: 'Set your store identity' },
    { label: 'Shipping', icon: Truck, desc: 'Define delivery basics' },
    { label: 'Category', icon: Sparkles, desc: 'Create your first category' },
    { label: 'Product', icon: CreditCard, desc: 'Add your first product' },
    { label: 'Team', icon: Users, desc: 'Invite staff (optional)' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* subtle top accent */}
      <div className="h-1 bg-blue-950" />

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">

        {/* Brand mark */}
        <div className="flex items-center gap-2.5 mb-10">
          <span className="h-9 w-9 rounded-sm bg-blue-950 text-white flex items-center justify-center">
            <Store className="h-4 w-4" />
          </span>
          <span className="text-[13px] font-semibold text-slate-900">SokoFlow</span>
        </div>

        {/* Headline */}
        <div className="space-y-3 mb-8">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-blue-50 text-blue-950 border border-blue-100 px-2.5 py-1 rounded-sm">
            <Sparkles className="h-3 w-3" />
            Setup wizard
          </span>
          <h1 className="text-[24px] sm:text-[28px] font-semibold text-slate-900 leading-tight">
            Welcome to SokoFlow
          </h1>
          <p className="text-[13px] text-slate-500 max-w-xl leading-relaxed">
            In a few short steps, we'll set up your store so you can start selling
            through WhatsApp and accepting M-Pesa payments. Everything can be edited
            later from your dashboard.
          </p>
        </div>

        {/* What you'll do */}
        <div className="bg-white border border-slate-200 rounded-sm p-3 sm:p-4 mb-8">
          <p className="text-[13px] font-semibold text-slate-900 mb-3">
            Here's what we'll set up together
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.label}
                  className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-sm p-2"
                >
                  <span className="w-7 h-7 rounded-sm bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900">
                      {i + 1}. {s.label}
                    </p>
                    <p className="text-[13px] text-slate-500 truncate">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Time + reassurance */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-sm">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Takes about 3 minutes
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-sm">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Editable later
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-sm">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            No card required
          </span>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Link
            href="/onboarding/steps/step1"
            className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
          >
            Skip to dashboard
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-[13px] text-slate-400 mt-8 max-w-md leading-relaxed">
          By continuing you agree to our Terms of Service and Privacy Policy.
          You can cancel or leave the wizard at any time — your progress is saved.
        </p>
      </div>
    </main>
  );
}