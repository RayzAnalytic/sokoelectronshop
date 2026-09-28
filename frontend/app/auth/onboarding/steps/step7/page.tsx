// app/onboarding/steps/step7/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Store,
  Truck,
  Sparkles,
  CreditCard,
  Users,
} from 'lucide-react';

const COMPLETED = [
  { id: 1, label: 'Account', icon: ShieldCheck },
  { id: 2, label: 'Store', icon: Store },
  { id: 3, label: 'Shipping', icon: Truck },
  { id: 4, label: 'Category', icon: Sparkles },
  { id: 5, label: 'Product', icon: CreditCard },
  { id: 6, label: 'Team', icon: Users },
];

export default function Step7FinishPage() {
  return (
    <div className="p-3 sm:p-6 space-y-4">

      <header className="text-center max-w-lg mx-auto space-y-2 pt-4">
        <span className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold text-slate-900">
          Your store is ready 🎉
        </h2>
        <p className="text-[13px] text-slate-500">
          You're all set up. Head to your dashboard to start managing orders,
          products, and conversations.
        </p>
      </header>

      <ul className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm divide-y divide-slate-100">
        {COMPLETED.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.id}
              className="px-3 py-2 flex items-center justify-between gap-2 text-[13px]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-900 truncate">
                  {s.label}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done
              </span>
            </li>
          );
        })}
      </ul>

      <div className="max-w-lg mx-auto pt-2">
        <Link
          href="/admin"
          className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          Go to Dashboard
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}