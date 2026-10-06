// app/auth/register/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api, ApiError, type Me } from '@/lib/api';

const EMAIL_RE = /\S+@\S+\.\S+/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

// Minimum password length — matches `AUTH_PASSWORD_VALIDATORS`'s
// MinimumLengthValidator on the backend.
const MIN_PASSWORD_LENGTH = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reduce a `next` query param to a safe same-origin path.
 *
 * Returns `null` for anything that could be used as an open redirect:
 *   * absolute URLs (`https://evil.com`)
 *   * protocol-relative URLs (`//evil.com`)
 *   * anything that doesn't start with a single `/`
 *
 * Same guard the backend applies to the Google OAuth flow's `next`
 * param. Doing it here closes the same vulnerability on email signup,
 * where the value never reaches the backend.
 */
function sanitizeNext(raw: string | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/')) return null;
    if (trimmed.startsWith('//')) return null;
    if (trimmed.includes('://')) return null;
    return trimmed;
}

/**
 * Extract DRF field errors from an error response.
 *
 * The backend's `RegisterView` returns validation failures as:
 *
 *     {
 *       "detail": "This password is too common.",
 *       "errors": {
 *         "password": ["This password is too common."],
 *         "phone": ["An account with this phone number already exists."]
 *       }
 *     }
 *
 * Mapping these onto the form's field errors means a duplicate-phone
 * response highlights the phone field instead of dumping a generic
 * message at the top of the form.
 */
function extractFieldErrors(
    data: unknown,
): { email?: string; phone?: string; password?: string; confirmPassword?: string } {
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

    const pick = (key: string): string | undefined => map[key]?.[0];

    return {
        email: pick('email'),
        phone: pick('phone'),
        password: pick('password'),
        confirmPassword: pick('confirm_password'),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerRegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Set by the checkout flow and by the login page. When present, we
    // return the customer here after successful registration instead of
    // the API's default `redirect_to` (which is /pages/account). This is
    // what keeps the cart selection + coupon alive across the
    // register → checkout round-trip.
    //
    // Sanitized against open-redirect: only same-origin paths survive.
    const nextPath = sanitizeNext(searchParams.get('next'));

    // Optional prefill — the login page passes this when a customer
    // clicked "Register now" instead of signing in. The order-success
    // page passes this when a guest chooses "Create an account".
    const emailParam = searchParams.get('email') ?? '';

    const [email, setEmail] = useState(emailParam);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    // Non-null when a session already exists on this device. We show a
    // "You're already signed in" card instead of the register form —
    // no auto-redirect. The previous version called
    // `router.replace(nextPath || redirect_to)` the moment it detected
    // a session, which yanked the customer away before they saw
    // anything. Same bouncing bug as the login page had.
    const [signedInUser, setSignedInUser] = useState<Me | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        email?: string;
        phone?: string;
        password?: string;
        confirmPassword?: string;
    }>({});

    const isBusy = loading || loggingOut;

    // On mount, check whether we're already signed in. If yes, show
    // the continue card. If no, show the form. Never redirect.
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
                if (!cancelled) setChecking(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Keep the email in sync if the URL's `email` param changes after
    // mount. Doesn't clobber a value the customer has already typed.
    useEffect(() => {
        if (!emailParam) return;
        setEmail((prev) => prev || emailParam);
    }, [emailParam]);

    const validateForm = () => {
        const errors: {
            email?: string;
            phone?: string;
            password?: string;
            confirmPassword?: string;
        } = {};

        if (!email.trim()) {
            errors.email = 'Email address is required.';
        } else if (!EMAIL_RE.test(email.trim())) {
            errors.email = 'Please enter a valid email address.';
        }

        if (!phone.trim()) {
            errors.phone = 'Phone number is required.';
        } else if (!PHONE_RE.test(phone.trim())) {
            errors.phone = 'Please enter a valid phone number.';
        }

        if (!password) {
            errors.password = 'Password is required.';
        } else if (password.length < MIN_PASSWORD_LENGTH) {
            errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
        }

        if (!confirmPassword) {
            errors.confirmPassword = 'Please confirm your password.';
        } else if (confirmPassword !== password) {
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

        setLoading(true);
        try {
            // Backend enforces role=CUSTOMER for this endpoint.
            // Never send `role` from the client.
            const { redirect_to } = await api.register({
                email: email.trim(),
                phone: phone.trim(),
                password,
                confirm_password: confirmPassword,
            });
            // `?next=` wins over the API's default redirect. This is
            // how a customer who was mid-checkout returns to their
            // cart selection and coupon instead of the account
            // overview, and how a guest on the order-success page
            // lands on their orders list.
            router.replace(nextPath || redirect_to);
        } catch (err) {
            if (err instanceof ApiError) {
                const detail =
                    typeof err.data === 'object' && err.data && 'detail' in err.data
                        ? String((err.data as { detail: unknown }).detail)
                        : null;

                if (err.status === 409) {
                    // Email or phone already belongs to a CUSTOMER.
                    // The backend's detail is specific ("An account
                    // with this phone number already exists..."),
                    // so prefer it over the generic fallback.
                    setError(
                        detail ??
                        'An account with this email or phone already exists. Try signing in instead.',
                    );
                } else if (err.status === 403) {
                    // Email belongs to an OWNER/STAFF account.
                    setError(
                        detail ??
                        'This email cannot be used to register a customer account. Please contact support.',
                    );
                } else if (err.status === 400) {
                    // Validation failure. The backend sends field-level
                    // errors in `err.data.errors` — map them so the
                    // corresponding inputs are highlighted instead of
                    // dumping a single generic message.
                    const mapped = extractFieldErrors(err.data);
                    if (Object.keys(mapped).length > 0) {
                        setFieldErrors(mapped);
                    }
                    // Still show the flattened summary so the customer
                    // sees something even if the field mapping missed.
                    if (detail) setError(detail);
                    else if (Object.keys(mapped).length === 0) {
                        setError('Please check your details and try again.');
                    }
                } else {
                    setError(
                        detail ?? 'Could not create your account. Please try again.',
                    );
                }
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Log out and drop back to the register form. Used by the
    // "Register a different account" link on the already-signed-in card.
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

    // ── ALREADY SIGNED IN — show a "Continue" card, not the form ────
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
                                'Register a different account'
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

    // ── NOT SIGNED IN — show the register form ───────────────────────
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
                <header className="text-center space-y-2 pt-2">
                    <h1 className="text-[18px] font-semibold text-slate-900">
                        Create your customer account
                    </h1>
                    <p className="text-[13px] text-slate-500">
                        Register to shop, track orders, and manage your details.
                    </p>
                </header>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-sm px-3 py-2 text-[12px] text-rose-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                    <Field
                        label="Email address"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="name@example.com"
                        autoComplete="email"
                        disabled={isBusy}
                        error={fieldErrors.email}
                    />

                    <Field
                        label="Phone number"
                        type="tel"
                        value={phone}
                        onChange={setPhone}
                        placeholder="+254 7XX XXX XXX"
                        autoComplete="tel"
                        disabled={isBusy}
                        error={fieldErrors.phone}
                    />

                    <PasswordField
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        show={showPassword}
                        onToggle={() => setShowPassword((s) => !s)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isBusy}
                        error={fieldErrors.password}
                    />

                    <PasswordField
                        label="Confirm password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((s) => !s)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isBusy}
                        error={fieldErrors.confirmPassword}
                    />

                    {password && (
                        <div className="space-y-1 pt-0.5">
                            <div className="flex items-center gap-1">
                                {[0, 1, 2].map((i) => (
                                    <span
                                        key={i}
                                        className={`h-1 flex-1 rounded-sm transition-colors ${i < passwordScore(password)
                                                ? ['bg-rose-400', 'bg-amber-400', 'bg-emerald-500'][
                                                passwordScore(password) - 1
                                                ]
                                                : 'bg-slate-200'
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-500">
                                {password.length < MIN_PASSWORD_LENGTH
                                    ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
                                    : ['Weak password.', 'Fair password.', 'Strong password.'][
                                    passwordScore(password) - 1
                                    ]}
                            </p>
                        </div>
                    )}

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
                                Creating account…
                            </>
                        ) : (
                            'Create account'
                        )}
                    </button>
                </form>

                <div className="text-center text-[13px] text-slate-600 pt-1">
                    Already have an account?{' '}
                    <Link
                        href={
                            nextPath
                                ? `/auth/login?next=${encodeURIComponent(nextPath)}${email
                                    ? `&email=${encodeURIComponent(email)}`
                                    : ''
                                }`
                                : '/auth/login'
                        }
                        className="font-medium text-blue-950 hover:underline"
                    >
                        Sign in
                    </Link>
                </div>

                <p className="text-center text-[11px] text-slate-400 pt-1 leading-relaxed">
                    Staff and admin accounts are provisioned by the administrator.
                    If you need access, contact your administrator.
                </p>
            </div>
        </div>
    );
}

/* ---------- Password strength ---------- */
function passwordScore(pw: string): number {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= MIN_PASSWORD_LENGTH) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    return Math.max(1, score);
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

/* ---------- PasswordField ---------- */
function PasswordField({
    label,
    value,
    onChange,
    show,
    onToggle,
    placeholder,
    autoComplete,
    disabled,
    error,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
    placeholder?: string;
    autoComplete?: string;
    disabled?: boolean;
    error?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="block text-[12px] font-medium text-slate-700">
                {label}
            </label>
            <div className="relative">
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    className={`w-full bg-white border rounded-sm pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${error
                            ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                            : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
                        }`}
                />
                <button
                    type="button"
                    onClick={onToggle}
                    disabled={disabled}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[12px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                    {show ? 'Hide' : 'Show'}
                </button>
            </div>
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
        </div>
    );
}