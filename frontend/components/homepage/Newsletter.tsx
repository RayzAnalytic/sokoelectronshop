// components/newslettersection/NewsletterSection.tsx
'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { newsletterApi } from '@/lib/api';

interface NewsletterSectionProps {
    /** Where the signup originated. Defaults to 'Footer Popup'. */
    source?: 'Footer Popup' | 'Checkout' | 'WhatsApp Opt-in';
    /** Optional heading override. */
    heading?: string;
    /** Optional supporting copy override. */
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
                // Treat as a soft warning, not an error banner that
                // implies something broke — the address is fine, it's
                // just already on the list.
                setError(res.detail);
            } else {
                // 'subscribed' | 'reactivated'
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
        <section className="bg-slate-50 py-6 lg:py-8 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-sm max-w-3xl mx-auto text-center">

                    <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-950 rounded-lg mb-2">
                        <Mail className="w-5 h-5" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        {heading}
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-1 max-w-md mx-auto mb-6">
                        {subheading}
                    </p>

                    {/* Success State */}
                    {success && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded text-[13px] text-emerald-700 flex items-center justify-center space-x-2"
                        >
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-[13px] text-red-700 flex items-center justify-center space-x-2"
                        >
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Subscription Form */}
                    <form
                        onSubmit={handleSubscribe}
                        className="max-w-md mx-auto"
                        noValidate
                    >
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-2">
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
                                    className={`w-full px-3 py-2 text-[13px] bg-white border ${fieldError
                                            ? 'border-red-500 focus:ring-red-500'
                                            : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
                                        } rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-5 rounded text-[14px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                        Subscribing...
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
                                className="text-[13px] text-red-600 mt-1.5 text-left"
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