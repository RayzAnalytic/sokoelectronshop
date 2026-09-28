// app/auth/forgot-password/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const validateForm = () => {
    if (!email.trim()) {
      setFieldError('Email address is required.');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setFieldError('Please enter a valid email address.');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) return;

    setLoading(true);

    // Simulate a short request so the loading state is visible
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
        {/* Brand */}
        <header className="text-center space-y-2 pt-2">
          <h1 className="text-[18px] font-semibold text-slate-900">
            Reset your password
          </h1>
          <p className="text-[13px] text-slate-500">
            Enter the email linked to your account and we will send you reset
            instructions.
          </p>
        </header>

        {/* Global error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-sm px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2 text-[12px] text-emerald-700">
            If an account exists for {email}, you will receive a password reset
            link shortly.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-slate-700">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
              autoComplete="email"
              placeholder="name@example.com"
              className={`w-full bg-white border rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
                fieldError
                  ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                  : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
              }`}
            />
            {fieldError && (
              <p className="text-[11px] text-rose-600">{fieldError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Sending reset instructions…
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>

        {/* Sign in link */}
        <div className="text-center text-[13px] text-slate-600 pt-1">
          Remember your password?{' '}
          <Link
            href="/auth/login"
            className="font-medium text-blue-950 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}