'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function NewsletterSection() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');

    const handleSubscribe = (e :any) => {
        e.preventDefault();
        setError('');
        setFieldError('');
        setSuccess(false);

        if (!email.trim()) {
            setFieldError('Email address is required.');
            return;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            setFieldError('Please enter a valid email address.');
            return;
        }

        setLoading(true);

        // Actual API subscription submission simulation to backend database/mailing service
        setTimeout(() => {
            setLoading(false);

            // Simulate backend validation check (e.g. email already subscribed)
            if (email === 'already@example.com') {
                setError('This email address is already subscribed to our newsletter.');
            } else {
                setSuccess(true);
                setEmail('');
            }
        }, 1000);
    };

    return (
        <section className="bg-slate-50 py-6 lg:py-8 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-sm max-w-3xl mx-auto text-center">

                    <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-950 rounded-lg mb-2">
                        <Mail className="w-5 h-5" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Subscribe to Our Newsletter
                    </h2>
                    <p className="text-[13px] text-slate-600 mt-1 max-w-md mx-auto mb-6">
                        Receive weekly updates on new electronics arrivals, exclusive price drops, and tech buying guides. Unsubscribe at any time.
                    </p>

                    {/* Success State */}
                    {success && (
                        <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded text-[13px] text-emerald-700 flex items-center justify-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>You have successfully subscribed to our newsletter!</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-[13px] text-red-700 flex items-center justify-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Subscription Form */}
                    <form onSubmit={handleSubscribe} className="max-w-md mx-auto" noValidate>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-2">
                            <div className="flex-1">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    placeholder="Enter your email address"
                                    className={`w-full px-3 py-2 text-[13px] bg-white border ${fieldError ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
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
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Subscribing...
                                    </>
                                ) : (
                                    'Subscribe'
                                )}
                            </button>
                        </div>
                        {fieldError && (
                            <p className="text-[13px] text-red-600 mt-1.5 text-left">{fieldError}</p>
                        )}
                    </form>

                </div>
            </div>
        </section>
    );
}