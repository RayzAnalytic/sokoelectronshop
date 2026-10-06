// app/auth/login/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api, ApiError, type Me } from '@/lib/api';

const ERROR_MESSAGES: Record<string, string> = {
  google: 'Google sign-in was cancelled.',
  state: 'Sign-in session expired. Please try again.',
  code: 'Google did not return an authorization code.',
  exchange: 'Could not verify your Google account. Please try again.',
  email: 'Your Google account did not include a verified email.',
  admin_email:
    'This email is registered as an admin. Please sign in via the admin page.',
};

/**
 * Reduce a `next` query param to a safe same-origin path.
 *
 * Returns `null` for anything that could be used as an open redirect:
 *   * absolute URLs (`https://evil.com`)
 *   * protocol-relative URLs (`//evil.com`)
 *   * anything that doesn't start with a single `/`
 *
 * The backend applies the same guard to the Google OAuth `next`
 * parameter, but email-based login never routes `next` through the
 * backend — the customer's browser handles the final navigation on its
 * own. Without this check, a crafted link like
 *
 *     /auth/login?next=https://evil.com
 *
 * would redirect a legitimate customer to an attacker-controlled page
 * immediately after a real, successful sign-in.
 */
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  if (trimmed.includes('://')) return null;
  return trimmed;
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorCode = searchParams.get('error');
  // Sanitized against open-redirect — see the helper's docstring.
  const nextPath = sanitizeNext(searchParams.get('next'));
  const emailParam = searchParams.get('email') ?? '';

  const [identifier, setIdentifier] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Non-null when a session already exists on this device. We show a
  // "Continue as …" card instead of the login form — no auto-redirect.
  // The previous version called `router.replace(nextPath)` the moment
  // it detected a session, which yanked the customer back to their
  // destination before they saw anything. That's the "bouncing" bug.
  const [signedInUser, setSignedInUser] = useState<Me | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState<string>(
    errorCode ? ERROR_MESSAGES[errorCode] ?? 'Sign-in failed.' : '',
  );
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  const isBusy = loading || googleLoading || loggingOut;

  // On mount, check whether we're already signed in. If yes, show the
  // continue card. If no, show the form. Never redirect — see the
  // `signedInUser` comment above.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (cancelled) return;
        if (u) setSignedInUser(u);
        setChecking(false);
      })
      .catch(() => {
        // Real error (network, 500). Let the user retry via the form.
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the identifier in sync if the URL's `email` param changes
  // after mount. Doesn't clobber a value the customer has already typed.
  useEffect(() => {
    if (!emailParam) return;
    setIdentifier((prev) => prev || emailParam);
  }, [emailParam]);

  const validateForm = () => {
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errors.identifier = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(identifier.trim())) {
      errors.identifier = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 10) {
      errors.password = 'Password must be at least 10 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validateForm()) return;

    setLoading(true);
    try {
      const { redirect_to } = await api.login(
        identifier.trim(),
        password,
        rememberMe,
      );
      // `next` (sanitized) wins over the server's default redirect.
      // This is how a customer who was mid-checkout or on the
      // order-success page lands back where they were, instead of
      // the account overview.
      router.replace(nextPath || redirect_to);
    } catch (err) {
      if (err instanceof ApiError) {
        // The login serializer returns a single generic message for
        // any auth failure (bad credentials, suspended account) as
        // `{ detail: "..." }`. There are no field-level errors to map
        // — the whole form is treated as one input.
        const detail =
          typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail: unknown }).detail)
            : 'Invalid email or password.';
        setError(detail);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    setFieldErrors({});
    setGoogleLoading(true);
    const base = api.googleLoginUrl();
    // Only forward `next` if it survived sanitization. The backend
    // applies the same guard on the OAuth callback, but sending a
    // value we know is bad would just be wasted work.
    const url = nextPath
      ? `${base}?next=${encodeURIComponent(nextPath)}`
      : base;
    window.location.href = url;
  };

  // Log out and drop back to the form. Used by the "Sign in as a
  // different account" link on the already-signed-in card.
  const handleSwitchAccount = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      /* swallow — user is switching anyway */
    } finally {
      setSignedInUser(null);
      setLoggingOut(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <svg
          className="animate-spin h-5 w-5 text-slate-400"
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
      </div>
    );
  }

  // ── ALREADY SIGNED IN — show a "Continue" card, not the form ─────
  if (signedInUser) {
    const continueHref = nextPath || signedInUser.redirect_to;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
          <header className="text-center space-y-2 pt-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="text-[18px] font-semibold text-slate-900">
              You&apos;re already signed in
            </h1>
            <p className="text-[13px] text-slate-500">
              Signed in as{' '}
              <span className="font-medium text-slate-700">
                {signedInUser.email}
              </span>
            </p>
          </header>

          <div className="space-y-2 pt-1">
            <Link
              href={continueHref}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
            >
              Continue
            </Link>
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={loggingOut}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Signing out…
                </>
              ) : (
                'Sign in as a different account'
              )}
            </button>
          </div>

          <div className="text-center pt-1">
            <Link
              href="/pages/products"
              className="text-[13px] text-slate-500 hover:text-slate-800"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── NOT SIGNED IN — show the login form ──────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
        <header className="text-center space-y-2 pt-2">
          <h1 className="text-[18px] font-semibold text-slate-900">
            Welcome back
          </h1>
          <p className="text-[13px] text-slate-500">
            Sign in to access your account.
          </p>
        </header>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-sm px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isBusy}
          className="w-full inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium px-4 py-2.5 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <>
              <svg
                className="animate-spin h-3.5 w-3.5 text-slate-500"
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

        <div className="flex items-center gap-3">
          <span className="flex-1 h-px bg-slate-200" />
          <span className="text-[12px] text-slate-400 font-medium">
            or sign in with email
          </span>
          <span className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <Field
            label="Email address"
            type="email"
            value={identifier}
            onChange={setIdentifier}
            placeholder="name@example.com"
            autoComplete="email"
            disabled={isBusy}
            error={fieldErrors.identifier}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-medium text-slate-700">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-[12px] font-medium text-blue-950 hover:underline"
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
                className={`w-full bg-white border rounded-sm pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.password
                    ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                    : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                disabled={isBusy}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[12px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[11px] text-rose-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isBusy}
              className="h-4 w-4 accent-blue-950 shrink-0 cursor-pointer"
            />
            <span className="text-[13px] text-slate-700">Remember me</span>
          </label>

          <button
            type="submit"
            disabled={isBusy}
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
                Authenticating…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="text-center text-[13px] text-slate-600 pt-1">
          Don&apos;t have an account?{' '}
          <Link
            href={
              nextPath
                ? `/auth/register?next=${encodeURIComponent(nextPath)}${identifier
                  ? `&email=${encodeURIComponent(identifier)}`
                  : ''
                }`
                : '/auth/register'
            }
            className="font-medium text-blue-950 hover:underline"
          >
            Register now
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Field ---------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[12px] font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className={`w-full bg-white border rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${error
            ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
            : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
          }`}
      />
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

/* ---------- Google brand icon ---------- */
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