// app/auth/register/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { registerAdmin, saveTokens } from '@/lib/api';

const POST_SIGNUP_REDIRECT = '/auth/onboarding';

type FieldErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
};

export default function AdminRegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // ── Validation ──
  const validateForm = () => {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (!email.trim()) errors.email = 'Email address is required.';
    else if (!/\S+@\S+\.\S+/.test(email))
      errors.email = 'Please enter a valid email address.';
    if (!phone.trim()) errors.phone = 'Phone number is required.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 8)
      errors.password = 'Password must be at least 8 characters long.';
    if (password !== confirmPassword)
      errors.confirmPassword = 'Passwords do not match.';
    if (!termsAccepted)
      errors.termsAccepted = 'You must accept the terms and conditions.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setFieldErrors({});

    if (!validateForm()) return;

    setLoading(true);

    try {
      const data = await registerAdmin({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password1: password,
        password2: confirmPassword,
        terms_accepted: termsAccepted,
      });

      // Save JWT tokens
      if (data.access && data.refresh) {
        saveTokens(data.access, data.refresh);
      }

      setSuccess(true);

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = POST_SIGNUP_REDIRECT;
      }, 1200);
    } catch (err: any) {
      // Map backend field errors to frontend fieldErrors
      if (err.errors) {
        const mapped: FieldErrors = {};
        if (err.errors.email) mapped.email = err.errors.email[0];
        if (err.errors.phone) mapped.phone = err.errors.phone[0];
        if (err.errors.password1) mapped.password = err.errors.password1[0];
        if (err.errors.password2) mapped.confirmPassword = err.errors.password2[0];
        if (err.errors.full_name) mapped.fullName = err.errors.full_name[0];
        if (err.errors.terms_accepted)
          mapped.termsAccepted = err.errors.terms_accepted[0];
        setFieldErrors(mapped);
      }

      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-5 space-y-4">
        {/* Brand */}
        <header className="text-center space-y-2 pt-1">
          <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto font-semibold text-[15px]">
            S
          </span>
          <h1 className="text-[18px] font-semibold text-slate-900">
            Create admin account
          </h1>
          <p className="text-[13px] text-slate-500">
            Set up your store and start selling in minutes.
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
            Admin account created! Redirecting to onboarding…
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <Field
            label="Full name"
            value={fullName}
            onChange={setFullName}
            placeholder="John Doe"
            disabled={loading}
            error={fieldErrors.fullName}
          />

          <Field
            label="Work email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="admin@yourstore.co.ke"
            disabled={loading}
            error={fieldErrors.email}
          />

          <Field
            label="Phone number"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+254 7XX XXX XXX"
            disabled={loading}
            error={fieldErrors.phone}
          />

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
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
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
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

          {/* Terms */}
          <div className="space-y-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 mt-0.5 accent-blue-950 shrink-0 cursor-pointer"
              />
              <span className="text-[13px] text-slate-700 leading-snug">
                I agree to the{' '}
                <Link
                  href="/terms"
                  className="text-blue-950 font-medium hover:underline"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="text-blue-950 font-medium hover:underline"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>
            {fieldErrors.termsAccepted && (
              <p className="text-[11px] text-rose-600">
                {fieldErrors.termsAccepted}
              </p>
            )}
          </div>

          {/* Submit */}
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
                Creating account…
              </>
            ) : (
              'Create admin account'
            )}
          </button>
        </form>

        {/* Login link */}
        <div className="text-center text-[13px] text-slate-600 pt-1">
          Already have an account?{' '}
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

/* ---------- Field ---------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
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
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full bg-white border rounded-sm px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
          error
            ? 'border-rose-300 focus:ring-rose-200/40 focus:border-rose-400'
            : 'border-slate-200 focus:ring-blue-950/20 focus:border-blue-950/40'
        }`}
      />
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}