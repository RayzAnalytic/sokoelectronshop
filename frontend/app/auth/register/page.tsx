'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { auth, ApiError } from '@/lib/api';

const POST_SIGNUP_REDIRECT = '/auth/onboarding';

type FieldErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
};

export default function RegisterPage() {
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
    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!phone.trim()) {
      errors.phone = 'Phone number is required.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!termsAccepted) {
      errors.termsAccepted = 'You must accept the terms and conditions.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) return;

    setLoading(true);

    try {
      await auth.register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        confirmPassword,
        termsAccepted,
      });

      setSuccess(true);
      setTimeout(() => {
        window.location.href = POST_SIGNUP_REDIRECT;
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors();
        const mapped: FieldErrors = {};

        if (fields.fullName) mapped.fullName = fields.fullName;
        if (fields.email) mapped.email = fields.email;
        if (fields.phone) mapped.phone = fields.phone;
        if (fields.password) mapped.password = fields.password;
        if (fields.confirmPassword) mapped.confirmPassword = fields.confirmPassword;
        if (fields.termsAccepted) mapped.termsAccepted = fields.termsAccepted;

        setFieldErrors(mapped);
        setError(err.nonFieldError() || '');
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
            Create account
          </h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Sign up to get started with your new customer account.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-sm text-[13px] text-red-700 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="mb-4 p-2 bg-emerald-50 border border-emerald-200 rounded-sm text-[13px] text-emerald-700 flex items-start gap-2">
            <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Account created successfully! Redirecting to onboarding…</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Full Name */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              placeholder="John Doe"
              className={`w-full px-3 py-2 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.fullName ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'}`}
            />
            {fieldErrors.fullName && (
              <p className="text-[13px] text-red-600 mt-1">{fieldErrors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="name@example.com"
              className={`w-full px-3 py-2 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'}`}
            />
            {fieldErrors.email && (
              <p className="text-[13px] text-red-600 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              placeholder="+254 7XX XXX XXX"
              className={`w-full px-3 py-2 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.phone ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'}`}
            />
            {fieldErrors.phone && (
              <p className="text-[13px] text-red-600 mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full px-3 py-2 pr-14 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'}`}
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
              <p className="text-[13px] text-red-600 mt-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full px-3 py-2 pr-14 text-[13px] bg-white border rounded-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500 ${fieldErrors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-blue-950 focus:ring-blue-950'}`}
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

          {/* Terms */}
          <div>
            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 mt-0.5 text-blue-950 focus:ring-blue-950 border-slate-300 rounded-sm cursor-pointer shrink-0"
              />
              <label htmlFor="terms" className="ml-2 block text-[13px] text-slate-700 cursor-pointer">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-950 font-medium hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-950 font-medium hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {fieldErrors.termsAccepted && (
              <p className="text-[13px] text-red-600 mt-1">
                {fieldErrors.termsAccepted}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center text-[13px] text-slate-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-blue-950 hover:underline">
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
}