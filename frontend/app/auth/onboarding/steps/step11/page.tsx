// app/auth/onboarding/steps/step11/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, X, Loader2, Mail } from 'lucide-react';

import {
    onboarding,
    ApiError,
    type TeamRole,
} from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import StepFooter from '@/components/onboarding/StepFooter';

const ROLES: Array<{ value: TeamRole; label: string; desc: string }> = [
    {
        value: 'admin',
        label: 'Administrator',
        desc: 'Full access to everything',
    },
    {
        value: 'manager',
        label: 'Manager',
        desc: 'Everything except billing & users',
    },
    {
        value: 'orders',
        label: 'Order Processor',
        desc: 'Orders and customers only',
    },
    {
        value: 'content',
        label: 'Content Editor',
        desc: 'Products, categories, pages, blog',
    },
];

type Invite = { id: string; email: string; role: TeamRole };

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Step11Team() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [role, setRole] = useState<TeamRole>('orders');
    const [invites, setInvites] = useState<Invite[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Prefill existing pending invites ──
    useEffect(() => {
        setLoading(true);
        onboarding
            .getStep11()
            .then((data) => {
                setInvites(
                    (data.invites || []).map((i) => ({
                        id: i.id ?? uid(),
                        email: i.email,
                        role: i.role,
                    })),
                );
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const add = () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) return;

        // Duplicate check
        if (invites.some((i) => i.email === trimmed)) {
            setError('This email has already been added.');
            return;
        }

        setError(null);
        setInvites([
            ...invites,
            { id: uid(), email: trimmed, role },
        ]);
        setEmail('');
    };

    const remove = (id: string) =>
        setInvites(invites.filter((i) => i.id !== id));

    const handleContinue = async () => {
        setSaving(true);
        setError(null);

        try {
            await onboarding.submitStep11({
                invites: invites.map((i) => ({
                    email: i.email,
                    role: i.role,
                })),
            });
            router.push(getNextRoute('step11'));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(
                    err.nonFieldError() ||
                    Object.values(err.fieldErrors())[0] ||
                    'Could not send invites.',
                );
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                    Step 11 of 12 · Optional
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-950" />
                    Invite your team
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Add staff and choose what they can access. Skip if you're running solo.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="staff@example.com"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                add();
                            }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                    />
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as TeamRole)}
                        className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs"
                    >
                        {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={add}
                        disabled={!email.includes('@')}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs disabled:opacity-50"
                    >
                        <Mail className="h-3.5 w-3.5" />
                        Add invite
                    </button>
                </div>

                {invites.length > 0 && (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {invites.map((inv) => (
                            <li
                                key={inv.id}
                                className="flex items-center justify-between py-3"
                            >
                                <div>
                                    <p className="text-xs font-semibold text-slate-900">
                                        {inv.email}
                                    </p>
                                    <p className="text-[10px] text-slate-500 capitalize">
                                        {inv.role}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => remove(inv.id)}
                                    className="text-slate-400 hover:text-red-600 p-1.5"
                                    aria-label="Remove invite"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map((r) => (
                    <div
                        key={r.value}
                        className="bg-white border border-slate-200 rounded-sm p-4"
                    >
                        <p className="text-xs font-semibold text-slate-900">
                            {r.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {r.desc}
                        </p>
                    </div>
                ))}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <StepFooter
                onContinue={handleContinue}
                loading={saving}
                currentSlug="step11"
                optional
            />
        </div>
    );
}