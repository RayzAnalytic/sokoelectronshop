'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { password, ApiError } from '@/lib/api';

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

    try {
      await password.requestReset(email);
      setSuccess(true);
    } catch (err) {
      // Backend always returns 200 for enumeration safety.
      // The only errors we might see are 429 (throttled) or network failures.
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            'Too many reset requests. Please wait a few minutes and try again.'
          );
        } else {
          // Any other server response is unexpected; still show success
          // to avoid leaking information.
          setSuccess(true);
        }
      } else {
        setError('Could not reach the server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-6 px-5 sm:px-8">

        {/* Brand Logo & Heading */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-950 text-white rounded-sm font-semibold text-[15px] mb-3">
            S
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
            Reset your password
          </h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Enter the email linked to your account and we will send you reset instructions.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-sm text-[13px] text-red-700 flex items-start gap-2">
            <svg
              className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 p-2 bg-emerald-50 border border-emerald-200 rounded-sm text-[13px] text-emerald-700 flex items-start gap-2">
            <svg
              className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              If an account exists for {email}, you will receive a password
              reset link shortly.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
              autoComplete="email"
              placeholder="name@example.com"
              className={`w-full px-3 py-2 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
                }`}
            />
            {fieldError && (
              <p className="text-[13px] text-red-600 mt-1">{fieldError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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

        <div className="mt-6 text-center text-[13px] text-slate-600">
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