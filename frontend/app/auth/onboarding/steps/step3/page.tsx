// app/auth/onboarding/steps/step3/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileBadge, Check, X, Loader2 } from 'lucide-react';

import { onboarding, ApiError, type BusinessType, type ETimsEnv } from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

const BUSINESS_TYPES: Array<{
    value: BusinessType;
    label: string;
    desc: string;
}> = [
        { value: 'sole', label: 'Sole Proprietor', desc: 'Registered business name' },
        { value: 'ltd', label: 'Limited Company', desc: 'Registered with eCitizen' },
        { value: 'partner', label: 'Partnership', desc: 'Two or more owners' },
        { value: 'none', label: 'Not registered yet', desc: 'Informal / side hustle' },
    ];

type FormState = {
    type: BusinessType;
    kraPin: string;
    regNumber: string;
    vatRegistered: boolean;
    vatNumber: string;
    eTimsEnabled: boolean;
    eTimsDeviceId: string;
    eTimsPin: string;
    eTimsApiKey: string;
    eTimsEnv: ETimsEnv;
    invoiceFooter: string;
};

export default function Step3Business() {
    const router = useRouter();

    const [form, setForm] = useState<FormState>({
        type: 'sole',
        kraPin: '',
        regNumber: '',
        vatRegistered: false,
        vatNumber: '',
        eTimsEnabled: false,
        eTimsDeviceId: '',
        eTimsPin: '',
        eTimsApiKey: '',
        eTimsEnv: 'sandbox',
        invoiceFooter: 'Thank you for shopping with us!',
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [eTimsStatus, setETimsStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
    const [eTimsMessage, setETimsMessage] = useState('');

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding.getStep3()
            .then((data) => {
                setForm((f) => ({
                    ...f,
                    type: data.type || 'sole',
                    kraPin: data.kra_pin || '',
                    regNumber: data.reg_number || '',
                    vatRegistered: data.vat_registered ?? false,
                    vatNumber: data.vat_number || '',
                    eTimsEnabled: data.etims_enabled ?? false,
                    eTimsDeviceId: data.etims_device_id || '',
                    eTimsPin: data.etims_pin || '',
                    eTimsApiKey: '', // never prefilled
                    eTimsEnv: data.etims_env || 'sandbox',
                    invoiceFooter: data.invoice_footer || 'Thank you for shopping with us!',
                }));
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // ── Test eTIMS connection ──
    const testETims = async () => {
        setETimsStatus('testing');
        setETimsMessage('');
        try {
            const res = await onboarding.testETims({
                device_id: form.eTimsDeviceId,
                pin: form.eTimsPin,
                api_key: form.eTimsApiKey,
                env: form.eTimsEnv,
            });
            if (res.ok) {
                setETimsStatus('ok');
                setETimsMessage(res.detail);
            } else {
                setETimsStatus('fail');
                setETimsMessage(res.detail);
            }
        } catch (err) {
            setETimsStatus('fail');
            setETimsMessage(err instanceof ApiError ? err.message : 'Test failed.');
        }
    };

    // ── Submit ──
    const handleSubmit = async (skip = false): Promise<boolean> => {
        setSaving(true);
        setError(null);
        setErrors({});

        // Skip → save minimal "not registered" state so backend marks step done
        const payload = skip
            ? { type: 'none' as BusinessType, invoice_footer: form.invoiceFooter }
            : {
                type: form.type,
                kra_pin: form.kraPin,
                reg_number: form.regNumber,
                vat_registered: form.vatRegistered,
                vat_number: form.vatNumber,
                etims_enabled: form.eTimsEnabled,
                etims_device_id: form.eTimsDeviceId,
                etims_pin: form.eTimsPin,
                etims_api_key: form.eTimsApiKey,
                etims_env: form.eTimsEnv,
                invoice_footer: form.invoiceFooter,
            };

        try {
            await onboarding.submitStep3(payload);
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
        const ok = await handleSubmit(false);
        if (ok) router.push(getNextRoute('step3'));
    };

    const handleSkip = async () => {
        const ok = await handleSubmit(true);
        if (ok) router.push(getNextRoute('step3'));
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
                    Step 3 of 12 · Optional
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <FileBadge className="h-5 w-5 text-blue-950" />
                    Business &amp; tax information
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Required for KRA compliance and eTIMS invoicing in Kenya.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-5 sm:p-6 space-y-5">
                {/* Business type */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Business type
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {BUSINESS_TYPES.map((t) => (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setForm({ ...form, type: t.value })}
                                className={`text-left p-3 rounded-sm border transition-colors ${form.type === t.value
                                        ? 'border-blue-950 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }`}
                            >
                                <p className="text-xs font-semibold text-slate-900">{t.label}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {form.type !== 'none' && (
                    <>
                        <Field
                            label="KRA PIN"
                            value={form.kraPin}
                            onChange={(v) => setForm({ ...form, kraPin: v.toUpperCase() })}
                            placeholder="A123456789X"
                            error={errors.kra_pin}
                        />

                        {form.type !== 'sole' && (
                            <Field
                                label="Business registration number"
                                value={form.regNumber}
                                onChange={(v) => setForm({ ...form, regNumber: v })}
                                error={errors.reg_number}
                            />
                        )}

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.vatRegistered}
                                onChange={(e) =>
                                    setForm({ ...form, vatRegistered: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                            />
                            <span className="text-xs text-slate-700">
                                I am VAT registered (16%)
                            </span>
                        </label>

                        {form.vatRegistered && (
                            <Field
                                label="VAT number"
                                value={form.vatNumber}
                                onChange={(v) => setForm({ ...form, vatNumber: v })}
                                error={errors.vat_number}
                            />
                        )}
                    </>
                )}

                {form.vatRegistered && form.type !== 'none' && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                eTIMS integration
                            </p>
                            {eTimsStatus === 'ok' && (
                                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Connected
                                </span>
                            )}
                            {eTimsStatus === 'fail' && (
                                <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <X className="h-3 w-3" /> Failed
                                </span>
                            )}
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.eTimsEnabled}
                                onChange={(e) =>
                                    setForm({ ...form, eTimsEnabled: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                            />
                            <span className="text-xs text-slate-700">
                                Enable eTIMS invoicing
                            </span>
                        </label>

                        {form.eTimsEnabled && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field
                                        label="Device ID"
                                        value={form.eTimsDeviceId}
                                        onChange={(v) => setForm({ ...form, eTimsDeviceId: v })}
                                        error={errors.etims_device_id}
                                    />
                                    <Field
                                        label="eTIMS PIN"
                                        value={form.eTimsPin}
                                        onChange={(v) => setForm({ ...form, eTimsPin: v })}
                                        error={errors.etims_pin}
                                    />
                                </div>
                                <Field
                                    label="API key"
                                    type="password"
                                    value={form.eTimsApiKey}
                                    onChange={(v) => setForm({ ...form, eTimsApiKey: v })}
                                    error={errors.etims_api_key}
                                />

                                <div className="flex gap-2">
                                    <select
                                        value={form.eTimsEnv}
                                        onChange={(e) =>
                                            setForm({ ...form, eTimsEnv: e.target.value as ETimsEnv })
                                        }
                                        className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    >
                                        <option value="sandbox">Sandbox</option>
                                        <option value="production">Production</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={testETims}
                                        disabled={
                                            eTimsStatus === 'testing' ||
                                            !form.eTimsDeviceId ||
                                            !form.eTimsPin ||
                                            !form.eTimsApiKey
                                        }
                                        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-sm text-xs disabled:opacity-50"
                                    >
                                        {eTimsStatus === 'testing' ? 'Testing…' : 'Test connection'}
                                    </button>
                                </div>
                                {eTimsMessage && (
                                    <p
                                        className={`text-[11px] ${eTimsStatus === 'ok'
                                                ? 'text-emerald-700'
                                                : 'text-red-600'
                                            }`}
                                    >
                                        {eTimsMessage}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Invoice footer text
                    </label>
                    <textarea
                        rows={2}
                        value={form.invoiceFooter}
                        onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-sm p-3 text-[11px] text-amber-900">
                Not registered yet? You can skip this and add it later in Settings → Tax.
            </div>

            <StepFooter
                onContinue={handleContinue}
                onSkip={handleSkip}
                loading={saving}
                currentSlug="step3"
                optional
            />
        </div>
    );
}