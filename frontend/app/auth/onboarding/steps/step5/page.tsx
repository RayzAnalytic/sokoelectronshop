// app/auth/onboarding/steps/step5/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Check, Loader2, Send } from 'lucide-react';

import { onboarding, ApiError } from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import Field from '@/components/onboarding/Field';
import StepFooter from '@/components/onboarding/StepFooter';

const PLACEHOLDERS = [
    '{store_name}',
    '{items}',
    '{total}',
    '{address}',
    '{customer_name}',
];

export default function Step5WhatsApp() {
    const router = useRouter();

    const [number, setNumber] = useState('');
    const [verified, setVerified] = useState(false);
    const [template, setTemplate] = useState(
        "Hello {store_name}, I'd like to order:\n{items}\nTotal: {total}\nMy delivery address: {address}",
    );
    const [toggles, setToggles] = useState({
        newOrderAlert: true,
        autoReply: false,
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // OTP modal
    const [otpOpen, setOtpOpen] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState<string | null>(null);

    // Test message
    const [testLoading, setTestLoading] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);

    // ── Prefill ──
    useEffect(() => {
        setLoading(true);
        onboarding.getStep5()
            .then((data) => {
                setNumber(data.number || '');
                setVerified(data.verified ?? false);
                setTemplate(data.template || '');
                setToggles({
                    newOrderAlert: data.new_order_alert ?? true,
                    autoReply: data.auto_reply ?? false,
                });
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const insertVar = (v: string) => setTemplate((t) => `${t} ${v}`);

    // ── OTP handling ──
    const handleOtpChange = (i: number, value: string) => {
        if (value.length > 1) value = value[value.length - 1];
        const next = [...otp];
        next[i] = value;
        setOtp(next);

        // Auto-focus next input
        if (value && i < 5) {
            const el = document.getElementById(`otp-${i + 1}`) as HTMLInputElement;
            el?.focus();
        }
    };

    const handleVerify = async () => {
        setOtpLoading(true);
        setOtpError(null);
        try {
            const res = await onboarding.verifyWhatsApp({
                number: number.trim(),
                otp: otp.join(''),
            });
            if (res.ok) {
                setVerified(true);
                setOtpOpen(false);
                setOtp(['', '', '', '', '', '']);
            } else {
                setOtpError(res.detail);
            }
        } catch (err) {
            setOtpError(err instanceof ApiError ? err.message : 'Verification failed.');
        } finally {
            setOtpLoading(false);
        }
    };

    // ── Send test message ──
    const handleSendTest = async () => {
        setTestLoading(true);
        setTestMessage(null);
        try {
            const res = await onboarding.sendWhatsAppTest({ template });
            setTestMessage(res.ok ? res.detail : res.detail);
        } catch (err) {
            setTestMessage(
                err instanceof ApiError ? err.message : 'Failed to send test.',
            );
        } finally {
            setTestLoading(false);
        }
    };

    // ── Submit ──
    const handleContinue = async () => {
        setSaving(true);
        setError(null);
        setErrors({});

        try {
            await onboarding.submitStep5({
                number: number.trim(),
                template,
                new_order_alert: toggles.newOrderAlert,
                auto_reply: toggles.autoReply,
            });
            router.push(getNextRoute('step5'));
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

    const previewTemplate = template
        .replace(/{store_name}/g, 'TechHub')
        .replace(/{items}/g, '1x Sony WH-1000XM5 — KES 38,999')
        .replace(/{total}/g, 'KES 38,999')
        .replace(/{address}/g, 'Riverside Drive, Nairobi')
        .replace(/{customer_name}/g, 'Wanjiru');

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                    Step 5 of 12
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-blue-950" />
                    Connect WhatsApp
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Customers will send their cart straight to your WhatsApp for fast ordering.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-5 sm:p-6 space-y-5">
                {/* Number + verify */}
                <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        WhatsApp business number
                    </span>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="+254 7XX XXX XXX"
                            disabled={verified}
                            className={[
                                'flex-1 bg-slate-50 border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1',
                                errors.number
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-slate-200 focus:ring-blue-950',
                                verified ? 'opacity-60' : '',
                            ].join(' ')}
                        />
                        <button
                            type="button"
                            onClick={() => setOtpOpen(true)}
                            disabled={!number.trim() || verified}
                            className={`px-4 py-2 rounded-sm text-xs font-medium whitespace-nowrap ${verified
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-50'
                                }`}
                        >
                            {verified ? (
                                <span className="inline-flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> Verified
                                </span>
                            ) : (
                                'Verify number'
                            )}
                        </button>
                    </div>
                    {errors.number && (
                        <p className="text-[11px] text-red-600 mt-1">{errors.number}</p>
                    )}
                </div>

                {/* Template */}
                <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Cart message template
                    </span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {PLACEHOLDERS.map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => insertVar(v)}
                                className="text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-sm border border-slate-200"
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <textarea
                        rows={5}
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        className={[
                            'w-full bg-slate-50 border rounded-sm px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1',
                            errors.template
                                ? 'border-red-300 focus:ring-red-500'
                                : 'border-slate-200 focus:ring-blue-950',
                        ].join(' ')}
                    />
                    {errors.template && (
                        <p className="text-[11px] text-red-600 mt-1">{errors.template}</p>
                    )}
                </div>

                {/* Preview bubble */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Preview
                    </p>
                    <div className="bg-[#e5f0d5] border border-emerald-100 rounded-sm p-3 max-w-sm">
                        <p className="text-[11px] text-slate-800 whitespace-pre-line leading-relaxed">
                            {previewTemplate}
                        </p>
                        <p className="text-[9px] text-slate-500 text-right mt-1">
                            12:34 ✓✓
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSendTest}
                        disabled={testLoading || !number}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-950 hover:underline disabled:opacity-50"
                    >
                        {testLoading ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <Send className="h-3 w-3" />
                                Send test message to my WhatsApp
                            </>
                        )}
                    </button>
                    {testMessage && (
                        <p className="text-[11px] text-slate-500 mt-1">{testMessage}</p>
                    )}
                </div>

                {/* Toggles */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                    {[
                        { key: 'newOrderAlert' as const, label: 'Send me a WhatsApp alert on new orders' },
                        { key: 'autoReply' as const, label: 'Auto-reply to new cart messages' },
                    ].map(({ key, label }) => (
                        <label
                            key={key}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <span className="text-xs text-slate-700">{label}</span>
                            <button
                                type="button"
                                onClick={() =>
                                    setToggles({ ...toggles, [key]: !toggles[key] })
                                }
                                className={`relative h-5 w-9 rounded-full transition-colors ${toggles[key] ? 'bg-blue-950' : 'bg-slate-300'
                                    }`}
                                aria-label={label}
                            >
                                <span
                                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${toggles[key] ? 'translate-x-4' : 'translate-x-0.5'
                                        }`}
                                />
                            </button>
                        </label>
                    ))}
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
                currentSlug="step5"
                optional={false}
            />

            {/* OTP modal */}
            {otpOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
                    onClick={() => !otpLoading && setOtpOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-sm rounded-sm shadow-2xl border border-slate-200 p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-sm font-bold text-slate-900">
                            Verify your WhatsApp number
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Open WhatsApp and send{' '}
                            <span className="font-mono font-bold">VERIFY</span> to{' '}
                            <span className="font-mono">+254 700 000 000</span>, then
                            enter the 6-digit code.
                        </p>

                        <div className="flex justify-center gap-2 mt-4">
                            {otp.map((d, i) => (
                                <input
                                    key={i}
                                    id={`otp-${i}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={d}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    className="w-10 h-12 text-center bg-slate-50 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-950"
                                />
                            ))}
                        </div>

                        {otpError && (
                            <p className="text-[11px] text-red-600 mt-3 text-center">
                                {otpError}
                            </p>
                        )}

                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setOtpOpen(false)}
                                disabled={otpLoading}
                                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-sm text-xs disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleVerify}
                                disabled={otpLoading || otp.some((d) => !d)}
                                className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-xs disabled:opacity-50"
                            >
                                {otpLoading ? 'Verifying…' : 'Verify'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}