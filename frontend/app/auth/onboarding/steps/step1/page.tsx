// app/onboarding/steps/step1/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function Step1AccountPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) return setError('Full name is required');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email');
    if (!phone.trim()) return setError('Phone number is required');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    // TODO: call your API to save account data
    router.push('/auth/onboarding/steps/step2');
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3">

      {/* Step heading */}
      <header className="border-b border-slate-100 pb-3">
        <span className="w-9 h-9 rounded-sm bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mb-2">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <h2 className="text-[15px] font-semibold text-slate-900">
          Create your owner account
        </h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          This will be the main administrator login for your store.
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-sm p-2 text-[13px]">
          {error}
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Full name"
          icon={User}
          value={fullName}
          onChange={setFullName}
          placeholder="e.g. Alex Doe"
        />
        <Field
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="alex@store.co.ke"
        />
        <Field
          label="Phone"
          icon={Phone}
          value={phone}
          onChange={setPhone}
          placeholder="+254 712 345 678"
        />
        <div>
          <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1">
              Password
            </span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-9 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-sm hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1">
              Confirm password
            </span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
              />
            </div>
          </label>
        </div>
      </div>

      <p className="text-[13px] text-slate-400">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}

/* ──────── Reusable field ──────── */
function Field({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-slate-700 mb-1">
        {label}
      </span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-950"
        />
      </div>
    </label>
  );
}