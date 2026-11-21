'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { newsletterApi } from '@/lib/api';

interface NewsletterSectionProps {
    source?: 'Footer Popup' | 'Checkout' | 'WhatsApp Opt-in';
    heading?: string;
    subheading?: string;
}

export default function NewsletterSection({
    source = 'Footer Popup',
    heading = 'Subscribe to Our Newsletter',
    subheading = 'Receive weekly updates on new electronics arrivals, exclusive price drops, and tech buying guides. Unsubscribe at any time.',
}: NewsletterSectionProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState('');

    const clearFeedback = () => {
        if (success) setSuccess(null);
        if (error) setError(null);
        if (fieldError) setFieldError('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        clearFeedback();
    };

    const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setFieldError('');
        setSuccess(null);

        const trimmed = email.trim();

        if (!trimmed) {
            setFieldError('Email address is required.');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(trimmed)) {
            setFieldError('Please enter a valid email address.');
            return;
        }

        setLoading(true);
        try {
            const res = await newsletterApi.subscribe({
                email: trimmed,
                source,
            });

            if (res.status === 'already_subscribed') {
                setError(res.detail);
            } else {
                setSuccess(res.detail);
                setEmail('');
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Something went wrong. Please try again.',
            );
        } finally {
            setLoading(false);
        }
    };

    const inputId = 'newsletter-email';
    const fieldErrorId = 'newsletter-email-error';

    return (
        <section className="bg-[#F3F6F9] py-4 xs:py-5 sm:py-6 lg:py-6 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-5 lg:px-6">
                <div className="bg-white border border-slate-200 rounded p-3 xs:p-4 sm:p-5 max-w-3xl mx-auto text-center">

                    {/* Icon badge — Matte Carbon Black with Electric Neon Cyan icon */}
                    <div className="inline-flex items-center justify-center w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 bg-[#0B0D10] text-[#00E5FF] rounded mb-1.5 xs:mb-2">
                        <Mail className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5" />
                    </div>

                    <h2 className="text-base xs:text-lg sm:text-xl font-bold text-[#111827]">
                        {heading}
                    </h2>
                    <p className="text-[11px] xs:text-[12px] sm:text-[13px] text-[#6B7280] mt-1 max-w-md mx-auto mb-3 xs:mb-4">
                        {subheading}
                    </p>

                    {/* Success — cyan tinted confirmation */}
                    {success && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="mb-3 xs:mb-4 p-2 xs:p-3 bg-[#00E5FF]/10 border border-[#00E5FF] rounded text-[11px] xs:text-[12px] sm:text-[13px] text-[#0B0D10] flex items-center justify-center space-x-2"
                        >
                            <CheckCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-[#00B8D4] shrink-0" />
                            <span className="text-left">{success}</span>
                        </div>
                    )}

                    {/* Error — cool gray emphasis (no red in palette) */}
                    {error && (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="mb-4 xs:mb-5 sm:mb-6 p-2 xs:p-3 bg-[#F3F6F9] border border-[#6B7280] rounded text-[11px] xs:text-[12px] sm:text-[13px] text-[#111827] flex items-center justify-center space-x-2"
                        >
                            <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-[#6B7280] shrink-0" />
                            <span className="text-left">{error}</span>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubscribe}
                        className="max-w-md mx-auto"
                        noValidate
                    >
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 xs:space-y-3 sm:space-y-0 sm:space-x-2">
                            <div className="flex-1">
                                <label htmlFor={inputId} className="sr-only">
                                    Email address
                                </label>
                                <input
                                    id={inputId}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={handleChange}
                                    disabled={loading}
                                    placeholder="Enter your email address"
                                    aria-invalid={fieldError ? true : undefined}
                                    aria-describedby={fieldError ? fieldErrorId : undefined}
                                    className={`w-full px-2.5 xs:px-3 py-1.5 xs:py-2 text-[12px] xs:text-[13px] bg-white border ${fieldError
                                            ? 'border-[#6B7280] focus:ring-[#6B7280]'
                                            : 'border-slate-300 focus:border-[#00B8D4] focus:ring-[#00B8D4]'
                                        } rounded text-[#111827] placeholder-[#6B7280] focus:outline-none focus:ring-1 disabled:bg-[#F3F6F9] disabled:text-[#6B7280]`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] font-bold py-1.5 xs:py-2 px-4 xs:px-5 rounded text-[12px] xs:text-[13px] sm:text-[14px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 xs:h-4 xs:w-4" />
                                        <span className="truncate">Subscribing...</span>
                                    </>
                                ) : (
                                    'Subscribe'
                                )}
                            </button>
                        </div>
                        {fieldError && (
                            <p
                                id={fieldErrorId}
                                role="alert"
                                className="text-[11px] xs:text-[12px] sm:text-[13px] text-[#6B7280] mt-1.5 text-left"
                            >
                                {fieldError}
                            </p>
                        )}
                    </form>

                </div>
            </div>
        </section>
    );
}