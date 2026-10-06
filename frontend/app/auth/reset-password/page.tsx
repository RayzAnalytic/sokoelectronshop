// app/auth/reset-password/page.tsx
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

// Must match `AUTH_PASSWORD_VALIDATORS`'s MinimumLengthValidator on the
// backend. The register page uses the same constant. Changing one
// without the other means a password that passes here fails there.
const MIN_PASSWORD_LENGTH = 10;

/**
 * Extract DRF field errors from a reset-password error response.
 *
 * The backend returns validation failures as:
 *
 *     {
 *       "detail": "This password is too common.",
 *       "errors": { "new_password": ["This password is too common."] }
 *     }
 *
 * Mapping these onto the form's field errors highlights the password
 * input instead of dumping a generic banner.
 */
function extractFieldErrors(
  data: unknown,
): { password?: string; confirmPassword?: string } {
  if (!data || typeof data !== 'object') return {};
  const errors = (data as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') return {};

  const map: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) {
      map[key] = value.map(String);
    } else if (typeof value === 'string') {
      map[key] = [value];
    }
  }

  return {
    password: map['new_password']?.[0],
    confirmPassword: map['confirm_password']?.[0],
  };
}

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

  // ── Token validation ──
  // Runs once on mount. Two failure paths:
  //   * No token in the URL — immediately shows the expired screen.
  //   * Token is invalid/expired — the backend's verify endpoint
  //     returns 400, and we show the same expired screen.
  // The verify call is idempotent (it doesn't consume the token) so
  // the customer can safely reload the page.
  useEffect(() => {
    if (!token) {
      setValidatingToken(false);
      setTokenError(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await api.verifyResetToken(token);
        if (cancelled) return;
        setValidatingToken(false);
      } catch (err) {
        if (cancelled) return;
        // 400 is the documented "invalid or expired" response. Any
        // other status (5xx, network) is a real error and shouldn't
        // show the "expired" screen — but the customer's only path
        // forward from here is to request a new link anyway, so we
        // treat it the same.
        setTokenError(true);
        if (err instanceof ApiError && err.status !== 400) {
          setError('Something went wrong. Please request a new link.');
        }
        setValidatingToken(false);
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
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword !== confirmPassword) {
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
      // The backend consumes the token on success — `used_at` is
      // stamped and any other pending tokens for the same user are
      // invalidated. A second submission with the same token returns
      // 410 Gone, which we treat as "expired" below.
      await api.resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        // 400 — either the token was never valid (shouldn't happen
        //       after the mount check) or the new password failed
        //       Django's validators.
        // 410 — token was consumed between the mount check and this
        //       submit. Same expired screen.
        if (err.status === 410) {
          setTokenError(true);
          return;
        }

        if (err.status === 400) {
          const mapped = extractFieldErrors(err.data);
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped);
          }
          const detail =
            typeof err.data === 'object' && err.data && 'detail' in err.data
              ? String((err.data as { detail: unknown }).detail)
              : null;
          if (detail) setError(detail);
          else if (Object.keys(mapped).length === 0) {
            setError('Please check your password and try again.');
          }
          return;
        }

        const detail =
          typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail: unknown }).detail)
            : null;
        setError(
          detail ?? 'Could not reset your password. Please try again.',
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
                className={`w-full bg-white border rounded-sm pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.password
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
              Must be at least {MIN_PASSWORD_LENGTH} characters long.
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
                className={`w-full bg-white border rounded-sm pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.confirmPassword
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