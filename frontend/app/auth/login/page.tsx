'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { auth, onboarding, ApiError } from '@/lib/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  const googleInitRef = useRef(false);
  const tokenSubmittedRef = useRef(false); // 👈 guards against double-submit

  const isBusy = loading || googleLoading;

  // ── Load Google Identity Services once ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (googleInitRef.current) return;

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      googleInitRef.current = true;
      // @ts-expect-error — window.google is added by the GSI script
      if (window.google?.accounts?.oauth2) {
        setGsiReady(true);
      } else {
        const interval = setInterval(() => {
          // @ts-expect-error
          if (window.google?.accounts?.oauth2) {
            setGsiReady(true);
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGsiReady(true);
    document.head.appendChild(script);
    googleInitRef.current = true;
  }, []);

  // ── Validation ──
  const validateForm = () => {
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errors.identifier = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(identifier.trim())) {
      errors.identifier = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Post-login redirect ──
  const redirectAfterLogin = async () => {
    try {
      const progress = await onboarding.getProgress();
      if (
        progress.status === 'NOT_STARTED' ||
        progress.status === 'IN_PROGRESS'
      ) {
        window.location.href = '/auth/onboarding';
      } else {
        window.location.href = '/pages/account';
      }
    } catch {
      window.location.href = '/pages/account';
    }
  };

  // ── Email + password login ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validateForm()) return;

    setLoading(true);

    try {
      await auth.login(
        {
          email: identifier.trim().toLowerCase(),
          password,
        },
        rememberMe
      );
      await redirectAfterLogin();
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors();
        const nfe = err.nonFieldError();

        if (fields.identifier || fields.email) {
          setFieldErrors((prev) => ({
            ...prev,
            identifier: fields.identifier || fields.email,
          }));
        }
        if (fields.password) {
          setFieldErrors((prev) => ({ ...prev, password: fields.password }));
        }

        setError(nfe || err.message || 'Sign-in failed.');
      } else {
        setError('Could not reach the server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In (OAuth 2.0 token flow — no FedCM, no One Tap) ──
  const handleGoogleSignIn = () => {
    setError('');
    setFieldErrors({});
    tokenSubmittedRef.current = false;   // 👈 reset guard for a new attempt

    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in is not configured. Contact support.');
      return;
    }

    // @ts-expect-error — window.google is added by the GSI script
    const google = window.google;
    if (!google?.accounts?.oauth2) {
      setError('Google Sign-In is still loading. Please try again in a moment.');
      return;
    }

    setGoogleLoading(true);

    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (tokenResponse: {
        access_token?: string;
        error?: string;
      }) => {
        // 👇 Prevent the same token from being submitted twice.
        // Google access tokens for the `userinfo` endpoint are single-use,
        // so a second submit with the same token would fail.
        if (tokenSubmittedRef.current) return;
        tokenSubmittedRef.current = true;

        if (!tokenResponse.access_token) {
          setError('Google sign-in was cancelled or failed.');
          setGoogleLoading(false);
          return;
        }

        try {
          await auth.loginWithGoogle(tokenResponse.access_token, true);
          await redirectAfterLogin();
        } catch (err) {
          if (err instanceof ApiError) {
            setError(err.nonFieldError() || err.message);
          } else {
            setError('Google sign-in failed. Please try again.');
          }
        } finally {
          setGoogleLoading(false);
        }
      },
    });

    client.requestAccessToken();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm shadow-sm py-6 px-5 sm:px-8">

        {/* Brand Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-950 text-white rounded-sm font-semibold text-[15px] mb-3">
            S
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Sign in to access your account.
          </p>
        </div>

        {/* Authentication Error */}
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

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isBusy || !gsiReady}
          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-medium py-2 px-4 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-slate-600"
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
              Connecting to Google…
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <span className="flex-1 h-px bg-slate-200" />
          <span className="text-[13px] text-slate-400 font-medium">
            or sign in with email
          </span>
          <span className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isBusy}
              autoComplete="email"
              placeholder="name@example.com"
              className={`w-full px-3 py-2 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.identifier
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
                }`}
            />
            {fieldErrors.identifier && (
              <p className="text-[13px] text-red-600 mt-1">
                {fieldErrors.identifier}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[13px] font-medium text-slate-700">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-[13px] font-medium text-blue-950 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full px-3 py-2 pr-14 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isBusy}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[13px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[13px] text-red-600 mt-1">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Remember me */}
          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isBusy}
              className="h-4 w-4 text-blue-950 focus:ring-blue-950 border-slate-300 rounded-sm cursor-pointer"
            />
            <label
              htmlFor="remember-me"
              className="ml-2 block text-[13px] text-slate-700 cursor-pointer"
            >
              Remember me
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isBusy}
            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                Authenticating…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Register Link */}
        <div className="mt-6 text-center text-[13px] text-slate-600">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/register"
            className="font-medium text-blue-950 hover:underline"
          >
            Register now
          </Link>
        </div>

      </div>
    </div>
  );
}

/* ───────── Google brand icon ───────── */
function GoogleIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}