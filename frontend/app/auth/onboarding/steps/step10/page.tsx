// app/auth/onboarding/steps/step10/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Check, Loader2 } from 'lucide-react';

import {
    onboarding,
    ApiError,
    type ThemeFont,
    type ThemePreset,
} from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import StepFooter from '@/components/onboarding/StepFooter';

const PRESETS: Array<{
    id: ThemePreset;
    name: string;
    primary: string;
    accent: string;
}> = [
        { id: 'blue', name: 'Trust Blue', primary: '#1e3a8a', accent: '#3b82f6' },
        { id: 'dark', name: 'Tech Dark', primary: '#0f172a', accent: '#06b6d4' },
        { id: 'white', name: 'Clean White', primary: '#111827', accent: '#10b981' },
        { id: 'orange', name: 'Warm Orange', primary: '#9a3412', accent: '#fb923c' },
        { id: 'green', name: 'Fresh Green', primary: '#065f46', accent: '#34d399' },
        { id: 'red', name: 'Bold Red', primary: '#991b1b', accent: '#f87171' },
    ];

const FONTS: ThemeFont[] = ['Inter', 'Poppins', 'Roboto'];

export default function Step10Theme() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selected, setSelected] = useState<ThemePreset>('blue');
    const [primary, setPrimary] = useState('#1e3a8a');
    const [accent, setAccent] = useState('#3b82f6');
    const [font, setFont] = useState<ThemeFont>('Inter');
    const [radius, setRadius] = useState(4);
    const [darkStore, setDarkStore] = useState(false);

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding
            .getStep10()
            .then((data) => {
                setSelected(data.preset);
                setPrimary(data.primary);
                setAccent(data.accent);
                setFont(data.font);
                setRadius(data.radius);
                setDarkStore(data.dark_store);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const applyPreset = (p: (typeof PRESETS)[number]) => {
        setSelected(p.id);
        setPrimary(p.primary);
        setAccent(p.accent);
    };

    // Manual color changes flip preset → 'custom'
    const handlePrimary = (v: string) => {
        setPrimary(v);
        setSelected('custom');
    };
    const handleAccent = (v: string) => {
        setAccent(v);
        setSelected('custom');
    };

    const handleContinue = async () => {
        setSaving(true);
        setError(null);
        try {
            await onboarding.submitStep10({
                preset: selected,
                primary,
                accent,
                font,
                radius,
                dark_store: darkStore,
            });
            router.push(getNextRoute('step10'));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(
                    err.nonFieldError() ||
                    Object.values(err.fieldErrors())[0] ||
                    'Please check your input.',
                );
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
                    Step 10 of 12 · Optional
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Palette className="h-5 w-5 text-blue-950" />
                    Make it yours
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Pick a color palette and layout. You can change these anytime.
                </p>
            </div>

            {/* Preset cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESETS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={`relative rounded-sm border-2 p-3 text-left transition-colors ${selected === p.id
                                ? 'border-blue-950'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        {selected === p.id && (
                            <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-950 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                            </span>
                        )}
                        <div
                            className="h-12 rounded-sm mb-2"
                            style={{ background: p.primary }}
                        />
                        <div
                            className="h-4 rounded-sm w-2/3"
                            style={{ background: p.accent }}
                        />
                        <p className="text-xs font-semibold text-slate-900 mt-2">
                            {p.name}
                        </p>
                    </button>
                ))}
            </div>

            {/* Customization */}
            <div className="bg-white border border-slate-200 rounded-sm p-5 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Customize
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                        <span className="block text-[11px] text-slate-500 mb-1">
                            Primary color
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={primary}
                                onChange={(e) => handlePrimary(e.target.value)}
                                className="h-9 w-12 rounded-sm border border-slate-200"
                            />
                            <input
                                value={primary}
                                onChange={(e) => handlePrimary(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono"
                            />
                        </div>
                    </label>
                    <label className="block">
                        <span className="block text-[11px] text-slate-500 mb-1">
                            Accent color
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={accent}
                                onChange={(e) => handleAccent(e.target.value)}
                                className="h-9 w-12 rounded-sm border border-slate-200"
                            />
                            <input
                                value={accent}
                                onChange={(e) => handleAccent(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono"
                            />
                        </div>
                    </label>
                </div>

                <label className="block">
                    <span className="block text-[11px] text-slate-500 mb-1">
                        Font family
                    </span>
                    <select
                        value={font}
                        onChange={(e) => setFont(e.target.value as ThemeFont)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs"
                    >
                        {FONTS.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </select>
                </label>

                <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                        Border radius — {radius}px
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={24}
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        className="w-full accent-blue-950"
                    />
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-700">
                        Enable dark mode for storefront
                    </span>
                    <button
                        type="button"
                        onClick={() => setDarkStore(!darkStore)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${darkStore ? 'bg-blue-950' : 'bg-slate-300'
                            }`}
                        aria-label="Toggle dark mode"
                    >
                        <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${darkStore ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                        />
                    </button>
                </label>
            </div>

            {/* Live preview */}
            <div className="bg-white border border-slate-200 rounded-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Preview
                </p>
                <div
                    className="rounded-sm p-4 transition-colors"
                    style={{
                        background: darkStore ? '#0f172a' : '#f8fafc',
                        borderRadius: radius,
                        fontFamily: font,
                    }}
                >
                    <div
                        className="rounded-sm p-4 mb-3"
                        style={{ background: primary, borderRadius: radius }}
                    >
                        <p className="text-white font-bold">
                            Shop the latest electronics
                        </p>
                        <p className="text-white/70 text-[11px] mt-1">
                            Free delivery in Nairobi
                        </p>
                    </div>
                    <button
                        className="text-white font-medium px-4 py-2 text-xs"
                        style={{ background: accent, borderRadius: radius }}
                        type="button"
                    >
                        Shop Now
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <StepFooter
                onContinue={handleContinue}
                loading={saving}
                currentSlug="step10"
                optional
            />
        </div>
    );
}