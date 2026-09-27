// app/auth/onboarding/steps/step2/page.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Upload, X, Loader2 } from 'lucide-react';

import { onboarding, ApiError } from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

const COUNTIES = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu',
    'Machakos', 'Kajiado', 'Uasin Gishu', 'Kakamega', 'Nyeri',
];

type FormState = {
    name: string;
    tagline: string;
    description: string;
    logo: File | null;
    street: string;
    town: string;
    county: string;
    postalCode: string;
    supportEmail: string;
    supportPhone: string;
};

export default function Step2StoreProfile() {
    const router = useRouter();

    const [form, setForm] = useState<FormState>({
        name: '',
        tagline: '',
        description: '',
        logo: null,
        street: '',
        town: '',
        county: 'Nairobi',
        postalCode: '',
        supportEmail: '',
        supportPhone: '',
    });

    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding.getStep2()
            .then((data) => {
                setForm((f) => ({
                    ...f,
                    name: data.name || '',
                    tagline: data.tagline || '',
                    description: data.description || '',
                    street: data.street || '',
                    town: data.town || '',
                    county: data.county || 'Nairobi',
                    postalCode: data.postal_code || '',
                    supportEmail: data.support_email || '',
                    supportPhone: data.support_phone || '',
                }));
                if (data.logo) setLogoPreview(data.logo);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // ── Logo handler ──
    const handleLogoChange = (file: File | null) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setErrors((e) => ({ ...e, logo: 'Logo must be 2MB or smaller.' }));
            return;
        }
        setErrors((e) => ({ ...e, logo: '' }));
        setForm((f) => ({ ...f, logo: file }));
        if (logoPreview && logoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview);
        }
        setLogoPreview(URL.createObjectURL(file));
    };

    const clearLogo = () => {
        if (logoPreview && logoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview);
        }
        setForm((f) => ({ ...f, logo: null }));
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Submit ──
    const handleContinue = async () => {
        setSaving(true);
        setError(null);
        setErrors({});

        if (!form.name.trim()) {
            setErrors({ name: 'Store name is required.' });
            setSaving(false);
            return;
        }

        try {
            await onboarding.submitStep2({
                name: form.name,
                tagline: form.tagline,
                description: form.description,
                logo: form.logo,
                street: form.street,
                town: form.town,
                county: form.county,
                postal_code: form.postalCode,
                support_email: form.supportEmail,
                support_phone: form.supportPhone,
            });
            router.push(getNextRoute('step2'));
        } catch (err) {
            if (err instanceof ApiError) {
                setErrors(err.fieldErrors());
                setError(err.nonFieldError());
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
                    Step 2 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Store className="h-5 w-5 text-blue-950" />
                    Tell us about your shop
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    This appears on your storefront, invoices, and receipts.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-5 sm:p-6 space-y-5">
                {/* Logo */}
                <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Store logo
                    </span>
                    <div className="flex items-center gap-4">
                        <div className="relative w-20 h-20 rounded-sm bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview ? (
                                <>
                                    <img
                                        src={logoPreview}
                                        alt="Logo"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={clearLogo}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                                        aria-label="Remove logo"
                                    >
                                        <X className="h-3 w-3 text-slate-600" />
                                    </button>
                                </>
                            ) : (
                                <Upload className="h-6 w-6 text-slate-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <label className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-3 py-2 rounded-sm text-xs cursor-pointer">
                                <Upload className="h-3.5 w-3.5" />
                                {logoPreview ? 'Replace logo' : 'Upload logo'}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/svg+xml"
                                    className="hidden"
                                    onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
                                />
                            </label>
                            <p className="text-[10px] text-slate-500 mt-1">
                                PNG, JPG or SVG · max 2MB · square recommended
                            </p>
                            {errors.logo && (
                                <p className="text-[11px] text-red-600 mt-1">{errors.logo}</p>
                            )}
                        </div>
                    </div>
                </div>

                <Field
                    label="Store name"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    placeholder="e.g. TechHub Electronics"
                    error={errors.name}
                />
                <Field
                    label="Tagline"
                    value={form.tagline}
                    onChange={(v) => setForm({ ...form, tagline: v })}
                    placeholder="Genuine gadgets, delivered fast"
                    error={errors.tagline}
                />

                <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Store description
                    </label>
                    <textarea
                        rows={3}
                        maxLength={200}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="A short description that appears on the storefront."
                        className={[
                            'w-full bg-slate-50 border rounded-sm px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 resize-none',
                            errors.description
                                ? 'border-red-300 focus:ring-red-500'
                                : 'border-slate-200 focus:ring-blue-950',
                        ].join(' ')}
                    />
                    <div className="flex justify-between mt-0.5">
                        <span className="text-[11px] text-red-600">{errors.description}</span>
                        <span className="text-[10px] text-slate-400">
                            {form.description.length}/200
                        </span>
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                        Physical address
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                            label="Building / Street"
                            value={form.street}
                            onChange={(v) => setForm({ ...form, street: v })}
                            error={errors.street}
                        />
                        <Field
                            label="Town / City"
                            value={form.town}
                            onChange={(v) => setForm({ ...form, town: v })}
                            error={errors.town}
                        />
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                County
                            </label>
                            <select
                                value={form.county}
                                onChange={(e) => setForm({ ...form, county: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                {COUNTIES.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <Field
                            label="Postal code"
                            value={form.postalCode}
                            onChange={(v) => setForm({ ...form, postalCode: v })}
                            error={errors.postal_code}
                        />
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                        Support contact
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                            label="Support email"
                            type="email"
                            value={form.supportEmail}
                            onChange={(v) => setForm({ ...form, supportEmail: v })}
                            error={errors.support_email}
                        />
                        <Field
                            label="Support phone"
                            value={form.supportPhone}
                            onChange={(v) => setForm({ ...form, supportPhone: v })}
                            placeholder="+2547..."
                            error={errors.support_phone}
                        />
                    </div>
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
                currentSlug="step2"
                optional={false}
            />
        </div>
    );
}