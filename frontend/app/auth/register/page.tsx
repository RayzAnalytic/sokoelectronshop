'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { api, ApiError, type Me } from '@/lib/api';

const EMAIL_RE = /\S+@\S+\.\S+/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

const MIN_PASSWORD_LENGTH = 10;

const DEFAULT_RESEND_COOLDOWN_SECONDS = 30;

const CODE_LENGTH = 6;
const PENDING_VERIFY_KEY = 'auth.register.pendingVerify';

type Step = 'form' | 'verify';

type PendingVerify = {
    email: string;
    redirect_to: string | null;
    resendAt: number;
};

function sanitizeNext(raw: string | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/')) return null;
    if (trimmed.startsWith('//')) return null;
    if (trimmed.includes('://')) return null;
    return trimmed;
}

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

function detailOf(err: ApiError): string | null {
    if (typeof err.data === 'object' && err.data && 'detail' in err.data) {
        const d = (err.data as { detail: unknown }).detail;
        if (typeof d === 'string') return d;
    }
    return null;
}

export default function CustomerRegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const nextPath = sanitizeNext(searchParams.get('next'));

    const emailParam = searchParams.get('email') ?? '';

    const [email, setEmail] = useState(emailParam);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    const [signedInUser, setSignedInUser] = useState<Me | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        email?: string;
        phone?: string;
        password?: string;
        confirmPassword?: string;
    }>({});

    const [step, setStep] = useState<Step>('form');
    const [pendingEmail, setPendingEmail] = useState('');
    const [pendingRedirectTo, setPendingRedirectTo] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendIn, setResendIn] = useState(0);
    const [verifyError, setVerifyError] = useState('');
    const [verifyNotice, setVerifyNotice] = useState('');

    const isBusy = loading || loggingOut;

    useEffect(() => {
        let cancelled = false;

        try {
            const raw = sessionStorage.getItem(PENDING_VERIFY_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<PendingVerify>;
                if (parsed.email) {
                    setPendingEmail(parsed.email);
                    setPendingRedirectTo(parsed.redirect_to ?? null);
                    setStep('verify');
                    if (parsed.resendAt) {
                        const remaining = Math.max(
                            0,
                            Math.ceil((parsed.resendAt - Date.now()) / 1000),
                        );
                        setResendIn(remaining);
                    }
                }
            }
        } catch {
        }

        api
            .me()
            .then((u) => {
                if (cancelled) return;
                if (u) {
                    setSignedInUser(u);
                    if (!u.is_email_verified) {
                        setPendingEmail((prev) => prev || u.email);
                        setPendingRedirectTo(
                            (prev) => prev ?? (u.redirect_to || null),
                        );
                        setStep('verify');
                    }
                }
                setChecking(false);
            })
            .catch(() => {
                if (!cancelled) setChecking(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!emailParam) return;
        setEmail((prev) => prev || emailParam);
    }, [emailParam]);

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(t);
    }, [resendIn]);

    const persistPendingVerify = (p: PendingVerify) => {
        try {
            sessionStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify(p));
        } catch {
        }
    };

    const clearPendingVerify = () => {
        try {
            sessionStorage.removeItem(PENDING_VERIFY_KEY);
        } catch {
        }
    };

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
            const { redirect_to } = await api.register({
                email: email.trim(),
                phone: phone.trim(),
                password,
                confirm_password: confirmPassword,
            });

            const verifyEmail = email.trim();
            const resendAt =
                Date.now() + DEFAULT_RESEND_COOLDOWN_SECONDS * 1000;

            setPendingEmail(verifyEmail);
            setPendingRedirectTo(redirect_to ?? null);
            setCode('');
            setVerifyError('');
            setVerifyNotice('');
            setResendIn(DEFAULT_RESEND_COOLDOWN_SECONDS);
            setStep('verify');

            persistPendingVerify({
                email: verifyEmail,
                redirect_to: redirect_to ?? null,
                resendAt,
            });
        } catch (err) {
            if (err instanceof ApiError) {
                const detail = detailOf(err);

                if (err.status === 409) {
                    setError(
                        detail ??
                        'An account with this email or phone already exists. Try signing in instead.',
                    );
                } else if (err.status === 403) {
                    setError(
                        detail ??
                        'This email cannot be used to register a customer account. Please contact support.',
                    );
                } else if (err.status === 400) {
                    const mapped = extractFieldErrors(err.data);
                    if (Object.keys(mapped).length > 0) {
                        setFieldErrors(mapped);
                    }
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

    const handleVerifySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setVerifyError('');
        setVerifyNotice('');

        if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
            setVerifyError('Please enter the 6-digit code from your email.');
            return;
        }

        setVerifying(true);
        try {
            const { redirect_to, already_verified } = await api.verifyEmail(code);

            clearPendingVerify();

            void already_verified;
            router.replace(
                nextPath || redirect_to || pendingRedirectTo || '/pages/account',
            );
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) {
                clearPendingVerify();
                router.replace(
                    nextPath || pendingRedirectTo || '/pages/account',
                );
                return;
            }
            if (err instanceof ApiError) {
                setVerifyError(
                    detailOf(err) ??
                    'That code is incorrect or has expired. Please try again.',
                );
            } else if (err instanceof Error) {
                setVerifyError(err.message);
            } else {
                setVerifyError('Verification failed. Please try again.');
            }
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        if (resendIn > 0 || resending) return;

        setVerifyError('');
        setVerifyNotice('');
        setResending(true);
        try {
            const { detail, resend_in } = await api.resendVerification();

            setVerifyNotice(detail || 'A new code is on its way. Check your inbox.');

            const seconds = resend_in > 0 ? resend_in : DEFAULT_RESEND_COOLDOWN_SECONDS;
            const resendAt = Date.now() + seconds * 1000;
            setResendIn(seconds);
            persistPendingVerify({
                email: pendingEmail,
                redirect_to: pendingRedirectTo,
                resendAt,
            });
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) {
                clearPendingVerify();
                router.replace(
                    nextPath || pendingRedirectTo || '/pages/account',
                );
                return;
            }
            if (err instanceof ApiError) {
                setVerifyError(
                    detailOf(err) ??
                    'Could not resend the code. Please try again.',
                );
            } else if (err instanceof Error) {
                setVerifyError(err.message);
            } else {
                setVerifyError('Could not resend the code. Please try again.');
            }
        } finally {
            setResending(false);
        }
    };

    const handleStartOver = () => {
        clearPendingVerify();
        setStep('form');
        setCode('');
        setVerifyError('');
        setVerifyNotice('');
        setResendIn(0);
        if (pendingEmail) setEmail(pendingEmail);
        setPendingEmail('');
        setPendingRedirectTo(null);
    };

    const handleSwitchAccount = async () => {
        setLoggingOut(true);
        try {
            await api.logout();
        } catch {
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

    if (step === 'verify') {
        const canSubmit = code.length === CODE_LENGTH && !verifying;
        const canResend = resendIn === 0 && !resending;

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
                <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-3">
                    <header className="text-center space-y-2 pt-2">
                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-950 flex items-center justify-center">
                            <Mail className="w-6 h-6" />
                        </div>
                        <h1 className="text-[18px] font-semibold text-slate-900">
                            Verify your email
                        </h1>
                        <p className="text-[13px] text-slate-500">
                            We sent a {CODE_LENGTH}-digit code to{' '}
                            <span className="font-medium text-slate-700 break-all">
                                {pendingEmail}
                            </span>
                        </p>
                    </header>

                    {verifyError && (
                        <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700">
                            {verifyError}
                        </div>
                    )}

                    {verifyNotice && !verifyError && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-[12px] text-emerald-700">
                            {verifyNotice}
                        </div>
                    )}

                    <form onSubmit={handleVerifySubmit} className="space-y-2" noValidate>
                        <div className="space-y-1">
                            <label className="block text-[12px] font-medium text-slate-700">
                                Verification code
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]*"
                                maxLength={CODE_LENGTH}
                                value={code}
                                onChange={(e) =>
                                    setCode(
                                        e.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, CODE_LENGTH),
                                    )
                                }
                                disabled={verifying}
                                autoFocus
                                placeholder={'0'.repeat(CODE_LENGTH)}
                                className={`w-full bg-white border rounded px-3 py-2.5 text-[18px] text-center font-mono text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${verifyError
                                    ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                                    : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
                                    }`}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {verifying ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Verifying…
                                </>
                            ) : (
                                'Verify email'
                            )}
                        </button>
                    </form>

                    <div className="text-center text-[13px] text-slate-600 pt-1">
                        Didn&apos;t get the code?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={!canResend}
                            className="font-medium text-blue-950 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                        >
                            {resending
                                ? 'Sending…'
                                : resendIn > 0
                                    ? `Resend in ${resendIn}s`
                                    : 'Resend code'}
                        </button>
                    </div>

                    <div className="text-center pt-1">
                        <button
                            type="button"
                            onClick={handleStartOver}
                            disabled={verifying}
                            className="text-[13px] text-slate-500 hover:text-slate-800 disabled:opacity-50"
                        >
                            Wrong email? Start over
                        </button>
                    </div>

                    <p className="text-center text-[11px] text-slate-400 pt-1">
                        Codes expire after a few minutes. If it doesn&apos;t
                        arrive, check your spam folder before resending.
                    </p>
                </div>
            </div>
        );
    }

    if (signedInUser) {
        const continueHref = nextPath || signedInUser.redirect_to;

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
                <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded p-3 sm:p-5 space-y-3">
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
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded text-[13px] transition"
                        >
                            Continue
                        </Link>
                        <button
                            type="button"
                            onClick={handleSwitchAccount}
                            disabled={loggingOut}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
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

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded p-3 sm:p-5 space-y-3">
                <header className="text-center space-y-2 pt-2">
                    <h1 className="text-[18px] font-semibold text-slate-900">
                        Create your customer account
                    </h1>
                    <p className="text-[13px] text-slate-500">
                        Register to shop, track orders, and manage your details.
                    </p>
                </header>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded px-3 py-2 text-[12px] text-rose-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-2" noValidate>
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
                                        className={`h-1 flex-1 rounded transition-colors ${i < passwordScore(password)
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
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                                ? `/auth/login?next=${encodeURIComponent(nextPath)}${email ? `&email=${encodeURIComponent(email)}` : ''
                                }`
                                : '/auth/login'
                        }
                        className="font-medium text-blue-950 hover:underline"
                    >
                        Sign in
                    </Link>
                </div>

                <p className="text-center text-[11px] text-slate-400 pt-1">
                    Staff and admin accounts are provisioned by the administrator.
                    If you need access, contact your administrator.
                </p>
            </div>
        </div>
    );
}

function passwordScore(pw: string): number {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= MIN_PASSWORD_LENGTH) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    return Math.max(1, score);
}

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
                className={`w-full bg-white border rounded px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${error
                    ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
                    : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
                    }`}
            />
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
        </div>
    );
}

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
                    className={`w-full bg-white border rounded pl-3 pr-14 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${error
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