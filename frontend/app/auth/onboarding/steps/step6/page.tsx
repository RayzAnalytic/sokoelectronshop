// app/onboarding/steps/step6/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Send,
  Trash2,
  RefreshCw,
  Mail,
  ShieldCheck,
  UserCog,
  User,
  Eye,
  Check,
} from 'lucide-react';

type Role = 'Admin' | 'Manager' | 'Staff' | 'Viewer';

type Invite = {
  id: string;
  email: string;
  role: Role;
  status: 'Pending' | 'Sent';
};

type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  you?: boolean;
};

const ROLES: { value: Role; label: string; description: string; icon: any }[] = [
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Full access to everything, including billing and team.',
    icon: ShieldCheck,
  },
  {
    value: 'Manager',
    label: 'Manager',
    description: 'Manage products, orders, and customers. No billing access.',
    icon: UserCog,
  },
  {
    value: 'Staff',
    label: 'Staff',
    description: 'Process orders and update stock. Limited settings access.',
    icon: User,
  },
  {
    value: 'Viewer',
    label: 'Viewer',
    description: 'Read-only access to orders, products, and reports.',
    icon: Eye,
  },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Step6TeamPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Staff');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Owner is always present
  const [members, setMembers] = useState<Member[]>([
    {
      id: 'owner',
      name: 'You',
      email: 'you@yourstore.co.ke',
      role: 'Admin',
      you: true,
    },
  ]);

  const sendInvite = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter an email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (invites.some((i) => i.email.toLowerCase() === trimmed.toLowerCase())) {
      setError('That email is already invited.');
      return;
    }
    setError(null);
    setInvites((prev) => [
      ...prev,
      { id: uid(), email: trimmed, role, status: 'Pending' },
    ]);
    setEmail('');
    setRole('Staff');
  };

  const removeInvite = (id: string) =>
    setInvites((prev) => prev.filter((i) => i.id !== id));

  const resendInvite = (id: string) =>
    setInvites((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'Sent' } : i)),
    );

  const changeMemberRole = (id: string, newRole: Role) =>
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)),
    );

  const removeMember = (id: string) =>
    setMembers((prev) => prev.filter((m) => m.id !== id));

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <header className="text-center max-w-lg mx-auto space-y-2 pt-4">
        <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-950 border border-blue-100 flex items-center justify-center mx-auto">
          <Users className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold text-slate-900">
          Invite your team
        </h2>
        <p className="text-[13px] text-slate-500">
          Add teammates to help manage orders, products, and conversations.
        </p>
      </header>

      {/* ── Invite form ─────────────────────────────── */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendInvite();
                }
              }}
              placeholder="teammate@example.com"
              className="w-full bg-white border border-slate-200 rounded-sm pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
            />
          </div>
          {error && (
            <p className="text-[11px] text-rose-600 pt-0.5">{error}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[12px] font-medium text-slate-700">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950/40"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 pt-0.5">
            {ROLES.find((r) => r.value === role)?.description}
          </p>
        </div>

        <button
          type="button"
          onClick={sendInvite}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          <Send className="h-3.5 w-3.5" />
          Send Invitation
        </button>
      </div>

      {/* ── Role reference ──────────────────────────── */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-2">
        <p className="text-[12px] font-medium text-slate-700">
          Roles at a glance
        </p>
        <ul className="space-y-1.5">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.value} className="flex items-start gap-2 text-[12px]">
                <span className="w-6 h-6 rounded-sm bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-slate-500" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900">
                    {r.label}
                  </span>
                  <span className="block text-slate-500">
                    {r.description}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Pending invites ─────────────────────────── */}
      {invites.length > 0 && (
        <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-slate-700">
              Pending invitations
            </p>
            <span className="text-[11px] text-slate-400">
              {invites.length}
            </span>
          </div>

          <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="px-3 py-2 flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 truncate">
                      {inv.email}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {inv.role} • {inv.status}
                    </span>
                  </span>
                </span>

                <span className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => resendInvite(inv.id)}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-950 hover:bg-blue-50 rounded-sm transition"
                    aria-label="Resend invite"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeInvite(inv.id)}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition"
                    aria-label="Remove invite"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Current team ────────────────────────────── */}
      <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-slate-700">
            Current team
          </p>
          <span className="text-[11px] text-slate-400">
            {members.length}
          </span>
        </div>

        <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100">
          {members.map((m) => (
            <li
              key={m.id}
              className="px-3 py-2 flex items-center justify-between gap-2 text-[13px]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-sm bg-blue-950 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900 truncate">
                    {m.name}
                    {m.you && (
                      <span className="ml-1.5 text-[10px] font-semibold text-blue-950 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm">
                        You
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {m.email}
                  </span>
                </span>
              </span>

              <span className="flex items-center gap-2 shrink-0">
                {m.you ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
                    <Check className="h-3.5 w-3.5" />
                    Owner
                  </span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        changeMemberRole(m.id, e.target.value as Role)
                      }
                      className="bg-white border border-slate-200 rounded-sm px-2 py-1 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-950"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition"
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Skip ────────────────────────────────────── */}
      <div className="max-w-lg mx-auto text-center">
        <Link
          href="/onboarding/steps/step7"
          className="text-[12px] font-medium text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline transition"
        >
          Skip for now
        </Link>
      </div>

      {/* ── Nav ─────────────────────────────────────── */}
      <div className="max-w-lg mx-auto flex items-center gap-2 pt-2">
        <Link
          href="/onboarding/steps/step5"
          className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <Link
          href="/onboarding/steps/step7"
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition"
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}