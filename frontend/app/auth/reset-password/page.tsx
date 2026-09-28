// app/auth/reset-password/page.tsx
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Simulated token validation (frontend only) ──
  useEffect(() => {
    if (!token) {
      setValidatingToken(false);
      setTokenError(true);
      return;
    }

    const t = setTimeout(() => {
      // For demo: any token with "expired" in it is treated as invalid.
      // Replace with real validation once backend is wired.
      if (token.toLowerCase().includes('expired')) {
        setTokenError(true);
      }
      setValidatingToken(false);
    }, 500);

    return () => clearTimeout(t);
  }, [token]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newPassword) {
      errors.password = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validateForm()) return;
    if (!token) {
      setTokenError(true);
      return;
    }

    setLoading(true);

    // Simulate a request
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 600);
  };

  // ── Token validation in progress ──
  if (validatingToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-6 text-center space-y-3">
          <svg
            className="animate-spin h-5 w-5 text-slate-400 mx-auto"
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
          <p className="text-[13px] text-slate-500">
            Verifying reset link…
          </p>
        </div>
      </div>
    );
  }

  // ── Token invalid or expired ──
  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
          <header className="text-center space-y-2 pt-2">
            <span className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto font-semibold text-[15px]">
              !
            </span>
            <h1 className="text-[18px] font-semibold text-slate-900">
              Reset link expired
            </h1>
            <p className="text-[13px] text-slate-500">
              This password reset link is invalid or has already been used.
            </p>
          </header>

          <div className="bg-rose-50 border border-rose-200 rounded-sm px-3 py-2 text-[12px] text-rose-700">
            {error || 'Please request a new reset link to continue.'}
          </div>

          <Link
            href="/auth/forgot-password"
            className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
          >
            Request a new link
          </Link>

          <div className="text-center text-[13px] text-slate-600">
            <Link
              href="/auth/login"
              className="font-medium text-blue-950 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
          <header className="text-center space-y-2 pt-2">
            <span className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto font-semibold text-[15px]">
              ✓
            </span>
            <h1 className="text-[18px] font-semibold text-slate-900">
              Password reset successful
            </h1>
            <p className="text-[13px] text-slate-500">
              Your password has been updated. You can now sign in with your new
              password.
            </p>
          </header>

          <Link
            href="/auth/login"
            className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
        <header className="text-center space-y-2 pt-2">
          <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto font-semibold text-[15px]">
            S
          </span>
          <h1 className="text-[18px] font-semibold text-slate-900">
            Set a new password
          </h1>
          <p className="text-[13px] text-slate-500">
            Choose a strong password you haven&apos;t used before.
          </p>
        </header>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-sm px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {/* New password */}
          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-slate-700">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full bg-white border rounded-sm pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
                  fieldErrors.password
                    ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                    : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[12px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Must be at least 8 characters long.
            </p>
            {fieldErrors.password && (
              <p className="text-[11px] text-rose-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-slate-700">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full bg-white border rounded-sm pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
                  fieldErrors.confirmPassword
                    ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                    : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[12px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-[11px] text-rose-600">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
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
                Resetting…
              </>
            ) : (
              'Reset password'
            )}
          </button>
        </form>

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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-6 text-center text-[13px] text-slate-500">
            Loading reset password page…
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}