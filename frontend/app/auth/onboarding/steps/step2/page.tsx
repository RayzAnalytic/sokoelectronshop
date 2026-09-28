// app/onboarding/steps/step2/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Store,
  Upload,
  MapPin,
  Phone,
  Lock,
} from 'lucide-react';

export default function Step2StorePage() {
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [logo, setLogo] = useState<string | null>(null);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header className="text-center max-w-lg mx-auto space-y-2 pt-4">
        <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto">
          <Store className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold text-slate-900">
          Tell us about your store
        </h2>
        <p className="text-[13px] text-slate-500">
          This information appears on your storefront and receipts.
        </p>
      </header>

      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        {/* Store name */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Store name
          </label>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="e.g. Nairobi Threads"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
          />
        </div>

        {/* Logo upload */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Store logo
          </label>
          <label className="flex items-center gap-3 bg-white border border-dashed border-slate-300 rounded-sm px-3 py-3 cursor-pointer hover:border-blue-950/40 transition">
            <span className="w-9 h-9 rounded-sm bg-slate-100 flex items-center justify-center shrink-0">
              <Upload className="h-4 w-4 text-slate-500" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-slate-900 truncate">
                {logo ? logo : 'Upload logo'}
              </span>
              <span className="block text-[11px] text-slate-500">
                PNG or JPG, up to 2MB
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                setLogo(e.target.files?.[0]?.name ?? null)
              }
            />
          </label>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Store phone
          </label>
          <div className="relative">
            <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              className="w-full bg-white border border-slate-200 rounded-sm pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Location
          </label>
          <div className="relative">
            <MapPin className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Westlands, Nairobi"
              className="w-full bg-white border border-slate-200 rounded-sm pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
          </div>
        </div>

        {/* Locked fields */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-700">
              Currency
            </label>
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-600">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              KES
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-700">
              Country
            </label>
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-600">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              Kenya
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto flex items-center gap-2 pt-2">
        <Link
          href="/auth/onboarding/steps/step1"
          className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <Link
          href="/auth/onboarding/steps/step3"
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}