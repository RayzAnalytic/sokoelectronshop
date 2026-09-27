// app/auth/onboarding/steps/step6/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Plus, Trash2, Loader2 } from 'lucide-react';

import {
    onboarding,
    ApiError,
    type ShippingPreset,
} from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

const PRESETS: Array<{ value: ShippingPreset; label: string; desc: string }> = [
    { value: 'national', label: 'Nationwide (Kenya)', desc: 'Nairobi, Mombasa, Kisumu + others' },
    { value: 'nairobi', label: 'Nairobi only', desc: 'Single zone' },
    { value: 'custom', label: 'Custom', desc: 'Start blank' },
];

type Rate = { id: string; method: string; price: string; eta: string };
type Zone = { id: string; name: string; counties: string; rates: Rate[] };

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Step6Shipping() {
    const router = useRouter();

    const [preset, setPreset] = useState<ShippingPreset>('national');
    const [zones, setZones] = useState<Zone[]>([
        {
            id: uid(),
            name: 'Nairobi',
            counties: 'Nairobi',
            rates: [{ id: uid(), method: 'Standard', price: '300', eta: '1-2 days' }],
        },
    ]);
    const [freeShipping, setFreeShipping] = useState(false);
    const [freeThreshold, setFreeThreshold] = useState('5000');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding.getStep6()
            .then((data) => {
                setPreset(data.preset || 'national');
                setFreeShipping(data.free_shipping_enabled ?? false);
                setFreeThreshold(data.free_shipping_threshold ?? '5000');
                if (data.zones && data.zones.length > 0) {
                    setZones(
                        data.zones.map((z) => ({
                            id: uid(),
                            name: z.name,
                            counties: (z.counties || []).join(', '),
                            rates: (z.rates || []).map((r) => ({
                                id: uid(),
                                method: r.method,
                                price: r.price,
                                eta: r.eta,
                            })),
                        })),
                    );
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // ── Zone CRUD ──
    const addZone = () => {
        setZones([
            ...zones,
            {
                id: uid(),
                name: '',
                counties: '',
                rates: [{ id: uid(), method: 'Standard', price: '', eta: '' }],
            },
        ]);
    };

    const removeZone = (id: string) =>
        setZones(zones.filter((z) => z.id !== id));

    const updateZone = (id: string, field: keyof Zone, value: string) =>
        setZones(zones.map((z) => (z.id === id ? { ...z, [field]: value } : z)));

    // ── Rate CRUD ──
    const addRate = (zoneId: string) =>
        setZones(
            zones.map((z) =>
                z.id === zoneId
                    ? {
                        ...z,
                        rates: [
                            ...z.rates,
                            { id: uid(), method: '', price: '', eta: '' },
                        ],
                    }
                    : z,
            ),
        );

    const updateRate = (
        zoneId: string,
        rateId: string,
        field: keyof Rate,
        value: string,
    ) =>
        setZones(
            zones.map((z) =>
                z.id === zoneId
                    ? {
                        ...z,
                        rates: z.rates.map((r) =>
                            r.id === rateId ? { ...r, [field]: value } : r,
                        ),
                    }
                    : z,
            ),
        );

    const removeRate = (zoneId: string, rateId: string) =>
        setZones(
            zones.map((z) =>
                z.id === zoneId
                    ? { ...z, rates: z.rates.filter((r) => r.id !== rateId) }
                    : z,
            ),
        );

    // ── Submit ──
    const handleContinue = async () => {
        setSaving(true);
        setError(null);

        // Client-side checks
        if (zones.length === 0) {
            setError('Add at least one shipping zone.');
            setSaving(false);
            return;
        }
        for (const z of zones) {
            if (!z.name.trim()) {
                setError('Every zone needs a name.');
                setSaving(false);
                return;
            }
            if (z.rates.length === 0) {
                setError(`Zone "${z.name}" needs at least one rate.`);
                setSaving(false);
                return;
            }
            for (const r of z.rates) {
                if (!r.price || isNaN(Number(r.price))) {
                    setError(`Zone "${z.name}" has a rate with no price.`);
                    setSaving(false);
                    return;
                }
            }
        }
        if (freeShipping && (!freeThreshold || isNaN(Number(freeThreshold)))) {
            setError('Enter a valid free-shipping threshold.');
            setSaving(false);
            return;
        }

        try {
            await onboarding.submitStep6({
                preset,
                zones: zones.map((z) => ({
                    name: z.name.trim(),
                    counties: z.counties
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean),
                    rates: z.rates.map((r) => ({
                        method: r.method || 'Standard',
                        price: r.price,
                        eta: r.eta,
                    })),
                })),
                free_shipping_enabled: freeShipping,
                free_shipping_threshold: freeShipping ? freeThreshold : undefined,
            });
            router.push(getNextRoute('step6'));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.nonFieldError() || 'Please check the highlighted fields.');
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                    Step 6 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-950" />
                    Where do you deliver?
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Set zones and rates. You can refine these later.
                </p>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                    <button
                        key={p.value}
                        type="button"
                        onClick={() => setPreset(p.value)}
                        className={`text-left p-3 rounded-sm border transition-colors ${preset === p.value
                                ? 'border-blue-950 bg-blue-50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                    >
                        <p className="text-xs font-semibold text-slate-900">{p.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                    </button>
                ))}
            </div>

            {/* Zones */}
            <div className="space-y-3">
                {zones.map((zone) => (
                    <div
                        key={zone.id}
                        className="bg-white border border-slate-200 rounded-sm p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Zone
                            </p>
                            {zones.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeZone(zone.id)}
                                    className="text-red-600 hover:bg-red-50 p-1.5 rounded-sm"
                                    aria-label="Remove zone"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field
                                label="Zone name"
                                value={zone.name}
                                onChange={(v) => updateZone(zone.id, 'name', v)}
                                placeholder="Nairobi"
                            />
                            <Field
                                label="Counties (comma-separated)"
                                value={zone.counties}
                                onChange={(v) => updateZone(zone.id, 'counties', v)}
                                placeholder="Nairobi, Kiambu, Machakos"
                            />
                        </div>

                        <div className="space-y-2">
                            {zone.rates.map((rate) => (
                                <div key={rate.id} className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="block text-[10px] text-slate-500 mb-1">
                                            Method
                                        </label>
                                        <input
                                            value={rate.method}
                                            onChange={(e) =>
                                                updateRate(zone.id, rate.id, 'method', e.target.value)
                                            }
                                            className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-[10px] text-slate-500 mb-1">
                                            KES
                                        </label>
                                        <input
                                            value={rate.price}
                                            onChange={(e) =>
                                                updateRate(zone.id, rate.id, 'price', e.target.value)
                                            }
                                            inputMode="decimal"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-[10px] text-slate-500 mb-1">
                                            ETA
                                        </label>
                                        <input
                                            value={rate.eta}
                                            onChange={(e) =>
                                                updateRate(zone.id, rate.id, 'eta', e.target.value)
                                            }
                                            className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-xs"
                                        />
                                    </div>
                                    {zone.rates.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRate(zone.id, rate.id)}
                                            className="text-slate-400 hover:text-red-600 p-2"
                                            aria-label="Remove rate"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addRate(zone.id)}
                                className="text-[11px] text-blue-950 hover:underline"
                            >
                                + Add rate
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addZone}
                    className="w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-blue-950 hover:bg-blue-50/30 rounded-sm p-4 text-xs font-medium text-slate-600"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add zone
                </button>
            </div>

            {/* Free shipping */}
            <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-slate-900">
                        Enable free shipping threshold
                    </span>
                    <button
                        type="button"
                        onClick={() => setFreeShipping(!freeShipping)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${freeShipping ? 'bg-blue-950' : 'bg-slate-300'
                            }`}
                        aria-label="Toggle free shipping"
                    >
                        <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${freeShipping ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                        />
                    </button>
                </label>
                {freeShipping && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">
                            Free delivery for orders above
                        </span>
                        <input
                            value={freeThreshold}
                            onChange={(e) => setFreeThreshold(e.target.value)}
                            inputMode="decimal"
                            className="w-28 bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-xs"
                        />
                        <span className="text-xs text-slate-600">KES</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <StepFooter
                onContinue={handleContinue}
                loading={saving}
                currentSlug="step6"
                optional={false}
            />
        </div>
    );
}