// app/auth/onboarding/steps/step12/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Check,
    Rocket,
    Store,
    Edit3,
    Minus,
    Loader2,
    AlertCircle,
} from 'lucide-react';

import {
    onboarding,
    ApiError,
    type Step12FinishResponse,
} from '@/lib/api';

export default function Step12Finish() {
    const router = useRouter();

    const [data, setData] = useState<Step12FinishResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [liveConfirmed, setLiveConfirmed] = useState(false);

    // ── Load summary ──
    useEffect(() => {
        setLoading(true);
        onboarding
            .getStep12()
            .then((res) => {
                setData(res);
                if (res.status === 'SUBMITTED') setLiveConfirmed(true);
            })
            .catch(() => setError('Could not load summary.'))
            .finally(() => setLoading(false));
    }, []);

    // ── Finalize ──
    const handleGoLive = async () => {
        setFinalizing(true);
        setError(null);
        try {
            await onboarding.finalizeStep12({ confirm: true });
            setLiveConfirmed(true);
            // Refresh summary to show new status
            const res = await onboarding.getStep12();
            setData(res);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(
                    err.nonFieldError() || 'Could not finalize onboarding.',
                );
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setFinalizing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                {error ?? 'Could not load summary.'}
            </div>
        );
    }

    const { steps, stats, ready_to_go_live, status, submitted_at } = data;
    const isSubmitted = status === 'SUBMITTED' || status === 'APPROVED';

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isSubmitted
                        ? 'bg-emerald-50 border border-emerald-100'
                        : 'bg-blue-50 border border-blue-100'
                        }`}
                >
                    <Rocket
                        className={`h-7 w-7 ${isSubmitted ? 'text-emerald-600' : 'text-blue-950'
                            }`}
                    />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-4">
                    {isSubmitted
                        ? "You're all set! 🎉"
                        : ready_to_go_live
                            ? "You're ready to sell! 🎉"
                            : 'Almost there'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    {isSubmitted
                        ? 'Your store has been submitted for review.'
                        : ready_to_go_live
                            ? "Here's a summary of what you set up."
                            : `Complete ${data.missing_steps.length} more step(s) to go live.`}
                </p>
            </div>

            {!isSubmitted && !ready_to_go_live && (
                <div className="bg-amber-50 border border-amber-100 rounded-sm p-3 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">
                            {data.missing_steps.length} required step(s) remain
                        </p>
                        <p className="mt-0.5">
                            Complete the required steps below, then come back here
                            to go live.
                        </p>
                    </div>
                </div>
            )}

            {/* Checklist */}
            <div className="bg-white border border-slate-200 rounded-sm">
                <div className="p-3 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Setup summary
                </div>
                <ul className="divide-y divide-slate-100">
                    {steps.map((step) => {
                        const isDone = step.state === 'done';
                        return (
                            <li
                                key={step.slug}
                                className="flex items-center justify-between p-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span
                                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}
                                    >
                                        {isDone ? (
                                            <Check className="h-3.5 w-3.5" />
                                        ) : (
                                            <Minus className="h-3.5 w-3.5" />
                                        )}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-900 truncate">
                                            {step.title}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate">
                                            {isDone
                                                ? 'Completed'
                                                : step.optional
                                                    ? 'Skipped — optional'
                                                    : 'Skipped — required'}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={`/auth/onboarding/steps/${step.slug}`}
                                    className="text-[11px] text-blue-950 hover:underline inline-flex items-center gap-1 shrink-0"
                                >
                                    <Edit3 className="h-3 w-3" />
                                    Edit
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Categories added', value: stats.categories_added },
                    { label: 'Products added', value: stats.products_added },
                    { label: 'Payment methods', value: stats.payment_methods },
                    { label: 'Team invites', value: stats.team_members },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="bg-white border border-slate-200 rounded-sm p-4 text-center"
                    >
                        <p className="text-2xl font-bold text-slate-900">
                            {s.value}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                            {s.label}
                        </p>
                    </div>
                ))}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            {/* CTAs */}
            {isSubmitted ? (
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                        href="/admin"
                        className="flex-1 text-center bg-blue-950 hover:bg-blue-900 text-white font-medium py-3 rounded-sm text-sm transition-colors"
                    >
                        Go to Dashboard
                    </Link>
                    <Link
                        href="/"
                        target="_blank"
                        className="flex-1 text-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-sm text-sm transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                        <Store className="h-4 w-4" />
                        Preview my store
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={handleGoLive}
                        disabled={!ready_to_go_live || finalizing}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-sm text-sm transition-colors"
                    >
                        {finalizing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting…
                            </>
                        ) : (
                            <>
                                <Rocket className="h-4 w-4" />
                                Go Live
                            </>
                        )}
                    </button>
                    <Link
                        href="/admin"
                        className="flex-1 text-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-sm text-sm transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                        Finish later
                    </Link>
                </div>
            )}

            <p className="text-[11px] text-slate-400 text-center">
                {isSubmitted && submitted_at
                    ? `Submitted on ${new Date(submitted_at).toLocaleDateString()}. You can revisit this setup anytime from Settings → Onboarding.`
                    : 'You can revisit this setup anytime from Settings → Onboarding.'}
            </p>
        </div>
    );
}