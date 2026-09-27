'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { password, ApiError } from '@/lib/api';

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

  // ── Validate token on mount ──
  useEffect(() => {
    if (!token) {
      setValidatingToken(false);
      setTokenError(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await password.validateToken(token);
        if (!cancelled && !res.valid) {
          setTokenError(true);
        }
      } catch {
        if (!cancelled) setTokenError(true);
      } finally {
        if (!cancelled) setValidatingToken(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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

    try {
      await password.confirmReset({
        token,
        password: newPassword,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors();

        if (fields.token) {
          setTokenError(true);
          setError(fields.token);
          return;
        }
        if (fields.password) {
          setFieldErrors({ password: fields.password });
          return;
        }
        if (fields.confirm_password) {
          setFieldErrors({ confirmPassword: fields.confirm_password });
          return;
        }
        setError(err.nonFieldError() || err.message);
      } else {
        setError('Could not reach the server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Token validation in progress ──
  if (validatingToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-10 px-6 text-center">
          <svg
            className="animate-spin h-6 w-6 text-slate-400 mx-auto"
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
          <p className="text-[13px] text-slate-600 mt-3">
            Verifying reset link…
          </p>
        </div>
      </div>
    );
  }

  // ── Token invalid or expired ──
  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-6 px-5 sm:px-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-red-50 text-red-600 rounded-sm font-semibold text-[15px] mb-3">
              !
            </div>
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
              Reset link expired
            </h1>
            <p className="text-[13px] text-slate-600 mt-1">
              This password reset link is invalid or has already been used.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-[13px] text-red-700 mb-4">
            {error || 'Please request a new reset link to continue.'}
          </div>

          <Link
            href="/auth/forgot-password"
            className="w-full flex items-center justify-center bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition"
          >
            Request a new link
          </Link>

          <div className="mt-4 text-center text-[13px] text-slate-600">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-6 px-5 sm:px-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-emerald-50 text-emerald-600 rounded-sm font-semibold text-[15px] mb-3">
              ✓
            </div>
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
              Password reset successful
            </h1>
            <p className="text-[13px] text-slate-600 mt-1">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="w-full flex items-center justify-center bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-6 px-5 sm:px-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-950 text-white rounded-sm font-semibold text-[15px] mb-3">
            S
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
            Set a new password
          </h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Choose a strong password you haven&apos;t used before.
          </p>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* New password */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
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
                className={`w-full px-3 py-2 pr-14 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[13px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[13px] text-slate-500 mt-1">
              Must be at least 8 characters long.
            </p>
            {fieldErrors.password && (
              <p className="text-[13px] text-red-600 mt-1">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
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
                className={`w-full px-3 py-2 pr-14 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.confirmPassword
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[13px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
                tabIndex={-1}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-[13px] text-red-600 mt-1">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
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
                Resetting…
              </>
            ) : (
              'Reset password'
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-8 px-6 text-center text-[13px] text-slate-600">
            Loading reset password page…
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}