// app/auth/onboarding/steps/step4/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Check, X, Loader2, Smartphone } from 'lucide-react';

import { onboarding, ApiError, type PaymentEnv } from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

type MpesaState = {
    consumer_key: string;
    consumer_secret: string;
    passkey: string;
    shortcode: string;
    env: PaymentEnv;
};

export default function Step4Payments() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [mpesaEnabled, setMpesaEnabled] = useState(true);
    const [mpesa, setMpesa] = useState<MpesaState>({
        consumer_key: '',
        consumer_secret: '',
        passkey: '',
        shortcode: '',
        env: 'sandbox',
    });

    const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
    const [mpesaMsg, setMpesaMsg] = useState('');

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding
            .getStep4()
            .then((data) => {
                setMpesaEnabled(data.mpesa_enabled ?? true);
                setMpesa((m) => ({ ...m, ...data.mpesa }));
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // ── Test M-Pesa connection ──
    const testMpesa = async () => {
        setMpesaStatus('testing');
        setMpesaMsg('');
        try {
            const res = await onboarding.testStep4({
                credentials: mpesa as unknown as Record<string, unknown>,
            });
            setMpesaStatus(res.ok ? 'ok' : 'fail');
            setMpesaMsg(res.detail);
        } catch (err) {
            setMpesaStatus('fail');
            setMpesaMsg(err instanceof ApiError ? err.message : 'Test failed.');
        }
    };

    // ── Submit ──
    const handleContinue = async () => {
        setSaving(true);
        setError(null);

        if (!mpesaEnabled) {
            setError('Enable M-Pesa to accept payments.');
            setSaving(false);
            return;
        }

        try {
            await onboarding.submitStep4({
                mpesa_enabled: true,
                mpesa,
            });
            router.push(getNextRoute('step4'));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(
                    err.nonFieldError() ||
                    Object.values(err.fieldErrors())[0] ||
                    'Please check the highlighted fields.'
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
                    Step 4 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-950" />
                    How do you want to get paid?
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Connect M-Pesa to accept payments from your customers.
                </p>
            </div>

            <div className="border border-slate-200 rounded-sm bg-white">
                {/* Header */}
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-sm bg-green-50 text-green-700 flex items-center justify-center">
                            <Smartphone className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">M-Pesa</p>
                            <p className="text-[11px] text-slate-500">
                                Safaricom STK Push · most popular in Kenya
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {mpesaStatus === 'ok' && <Check className="h-4 w-4 text-emerald-600" />}
                        {mpesaStatus === 'fail' && <X className="h-4 w-4 text-red-600" />}
                        <button
                            type="button"
                            onClick={() => setMpesaEnabled(!mpesaEnabled)}
                            className={`relative h-5 w-9 rounded-full transition-colors ${mpesaEnabled ? 'bg-blue-950' : 'bg-slate-300'
                                }`}
                            aria-label="Toggle M-Pesa"
                        >
                            <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${mpesaEnabled ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Form */}
                {mpesaEnabled && (
                    <div className="p-4 pt-0 space-y-3 border-t border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                            <Field
                                label="Consumer key"
                                value={mpesa.consumer_key}
                                onChange={(v) => setMpesa({ ...mpesa, consumer_key: v })}
                            />
                            <Field
                                label="Consumer secret"
                                type="password"
                                value={mpesa.consumer_secret}
                                onChange={(v) => setMpesa({ ...mpesa, consumer_secret: v })}
                            />
                            <Field
                                label="Passkey"
                                type="password"
                                value={mpesa.passkey}
                                onChange={(v) => setMpesa({ ...mpesa, passkey: v })}
                            />
                            <Field
                                label="Shortcode"
                                value={mpesa.shortcode}
                                onChange={(v) => setMpesa({ ...mpesa, shortcode: v })}
                                placeholder="174379"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                Environment
                            </label>
                            <select
                                value={mpesa.env}
                                onChange={(e) =>
                                    setMpesa({ ...mpesa, env: e.target.value as PaymentEnv })
                                }
                                className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                <option value="sandbox">Sandbox</option>
                                <option value="production">Production</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={testMpesa}
                                disabled={mpesaStatus === 'testing'}
                                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs disabled:opacity-50"
                            >
                                {mpesaStatus === 'testing' ? 'Testing…' : 'Test connection'}
                            </button>
                            {mpesaMsg && (
                                <span
                                    className={`text-[11px] ${mpesaStatus === 'ok' ? 'text-emerald-700' : 'text-red-600'
                                        }`}
                                >
                                    {mpesaMsg}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-sm p-3 text-[11px] text-blue-950">
                You can find your M-Pesa Daraja credentials in your{' '}
                <span className="font-medium">Safaricom developer account</span>. We never store
                your secrets in plain text.
            </div>

            <StepFooter
                onContinue={handleContinue}
                loading={saving}
                currentSlug="step4"
                optional={false}
            />
        </div>
    );
}