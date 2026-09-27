// app/auth/onboarding/steps/step1/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, Loader2 } from 'lucide-react';

import { onboarding, ApiError, auth, type Step1AccountPayload } from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

export default function Step1Account() {
    const router = useRouter();

    const [form, setForm] = useState<Step1AccountPayload>({
        fullName: '',
        email: '',
        phone: '',
        role: 'Owner',
        password: '',
        confirm: '',
        agreed: false,
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Prefill from backend ──
    useEffect(() => {
        setLoading(true);
        onboarding.getStep1()
            .then((data) => {
                setForm((f) => ({
                    ...f,
                    fullName: data.fullName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    role: (data.role as Step1AccountPayload['role']) || 'Owner',
                }));
            })
            .catch(() => {
                // If prefill fails, leave form empty
            })
            .finally(() => setLoading(false));
    }, []);

    // ── Submit ──
    const handleSubmit = async (): Promise<boolean> => {
        setSaving(true);
        setError(null);
        setErrors({});
        try {
            await onboarding.submitStep1({
                ...form,
                password: form.password || undefined,
                confirm: form.confirm || undefined,
            });
            // Refresh user cache in case name/email changed
            try {
                const me = await auth.me();
                const refresh = (await import('@/lib/api')).tokenStore.getRefresh();
                const access = (await import('@/lib/api')).tokenStore.getAccess();
                if (access && refresh) {
                    (await import('@/lib/api')).tokenStore.set(access, refresh, me);
                }
            } catch {
                // Non-fatal
            }
            return true;
        } catch (err) {
            if (err instanceof ApiError) {
                setErrors(err.fieldErrors());
                setError(err.nonFieldError());
            } else {
                setError('Something went wrong. Please try again.');
            }
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleContinue = async () => {
        const ok = await handleSubmit();
        if (ok) router.push(getNextRoute('step1'));
    };

    const handleSkip = async () => {
        // Step 1 is required — no skip
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
                    Step 1 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-blue-950" />
                    Confirm your account
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    This is the owner account for your store. You can add staff later.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-5 sm:p-6 space-y-4">
                <Field
                    label="Full name"
                    value={form.fullName}
                    onChange={(v) => setForm({ ...form, fullName: v })}
                    placeholder="e.g. Wanjiru Kamau"
                    error={errors.fullName}
                />
                <Field
                    label="Email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    type="email"
                    placeholder="you@example.com"
                    error={errors.email}
                />
                <Field
                    label="Phone number"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="+254 7XX XXX XXX"
                    error={errors.phone}
                />

                <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Role at shop
                    </label>
                    <select
                        value={form.role}
                        onChange={(e) =>
                            setForm({ ...form, role: e.target.value as Step1AccountPayload['role'] })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                        <option>Owner</option>
                        <option>Manager</option>
                        <option>Staff</option>
                    </select>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Change password (optional)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                            label="New password"
                            type="password"
                            value={form.password ?? ''}
                            onChange={(v) => setForm({ ...form, password: v })}
                            error={errors.password}
                        />
                        <Field
                            label="Confirm password"
                            type="password"
                            value={form.confirm ?? ''}
                            onChange={(v) => setForm({ ...form, confirm: v })}
                            error={errors.confirm}
                        />
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 cursor-pointer pt-2">
                        <input
                            type="checkbox"
                            checked={form.agreed}
                            onChange={(e) => setForm({ ...form, agreed: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                        />
                        <span className="text-xs text-slate-700">
                            I agree to the Terms &amp; Privacy Policy
                        </span>
                    </label>
                    {errors.agreed && (
                        <p className="text-[11px] text-red-600 mt-1">{errors.agreed}</p>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-sm p-3 text-[11px] text-blue-950">
                Order notifications and invoices will be sent to this email.
            </div>

            <StepFooter
                onContinue={handleContinue}
                onSkip={handleSkip}
                loading={saving}
                currentSlug="step1"
                optional={false}
            />
        </div>
    );
}