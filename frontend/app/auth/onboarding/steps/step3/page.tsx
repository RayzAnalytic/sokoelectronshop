// app/onboarding/steps/step3/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  Plus,
  Trash2,
  Store,
} from 'lucide-react';

type Zone = { id: number; name: string; fee: string };

export default function Step3DeliveryPage() {
  const [method, setMethod] = useState<'delivery' | 'pickup' | 'both'>('delivery');
  const [zones, setZones] = useState<Zone[]>([{ id: 1, name: '', fee: '' }]);
  const [defaultFee, setDefaultFee] = useState('');
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [eta, setEta] = useState('');

  const addZone = () =>
    setZones((z) => [...z, { id: Date.now(), name: '', fee: '' }]);

  const removeZone = (id: number) =>
    setZones((z) => z.filter((x) => x.id !== id));

  const updateZone = (id: number, key: keyof Zone, value: string) =>
    setZones((z) => z.map((x) => (x.id === id ? { ...x, [key]: value } : x)));

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header className="text-center max-w-lg mx-auto space-y-2 pt-4">
        <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto">
          <Truck className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold text-slate-900">
          How do you deliver?
        </h2>
        <p className="text-[13px] text-slate-500">
          Set your delivery method, zones, and fees.
        </p>
      </header>

      {/* Delivery method */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        <p className="text-[12px] font-medium text-slate-700">
          Delivery method
        </p>
        <div className="space-y-2">
          {[
            { value: 'delivery', label: 'Delivery only' },
            { value: 'pickup', label: 'Pickup only' },
            { value: 'both', label: 'Delivery & pickup' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 bg-white border rounded-sm px-3 py-2 cursor-pointer text-[13px] transition ${
                method === opt.value
                  ? 'border-blue-950/40 ring-2 ring-blue-950/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="method"
                value={opt.value}
                checked={method === opt.value}
                onChange={() => setMethod(opt.value as any)}
                className="accent-blue-950"
              />
              <span className="font-medium text-slate-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Delivery zones */}
      {(method === 'delivery' || method === 'both') && (
        <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-slate-700">
              Delivery zones
            </p>
            <button
              type="button"
              onClick={addZone}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium px-2.5 py-1.5 rounded-sm text-[12px] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add zone
            </button>
          </div>

          <div className="space-y-2">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center gap-2">
                <input
                  value={zone.name}
                  onChange={(e) => updateZone(zone.id, 'name', e.target.value)}
                  placeholder="Zone name"
                  className="flex-1 min-w-0 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                />
                <input
                  value={zone.fee}
                  onChange={(e) => updateZone(zone.id, 'fee', e.target.value)}
                  placeholder="Fee"
                  className="w-20 bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
                />
                <button
                  type="button"
                  onClick={() => removeZone(zone.id)}
                  disabled={zones.length === 1}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-700">
              Default delivery fee
            </label>
            <input
              value={defaultFee}
              onChange={(e) => setDefaultFee(e.target.value)}
              placeholder="e.g. 250"
              className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
          </div>
        </div>
      )}

      {/* Pickup + ETA */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2">
            <Store className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-900">
              Enable pickup
            </span>
          </span>
          <input
            type="checkbox"
            checked={pickupEnabled}
            onChange={(e) => setPickupEnabled(e.target.checked)}
            className="accent-blue-950 h-4 w-4"
          />
        </label>

        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Estimated delivery time
          </label>
          <input
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            placeholder="e.g. 1–3 business days"
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
          />
        </div>
      </div>

      <div className="max-w-lg mx-auto flex items-center gap-2 pt-2">
        <Link
          href="/auth/onboarding/steps/step2"
          className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <Link
          href="/auth/onboarding/steps/step4"
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}