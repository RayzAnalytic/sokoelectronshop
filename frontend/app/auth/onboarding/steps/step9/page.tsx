// app/auth/onboarding/steps/step9/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Share2, Check, Loader2, ExternalLink } from 'lucide-react';

import {
    onboarding,
    social,
    ApiError,
    type Step9PlatformId,
    type Step9SocialResponse,
} from '@/lib/api';
import { getNextRoute } from '@/lib/onboardingSteps';
import StepFooter from '@/components/onboarding/StepFooter';

type PlatformMeta = {
    id: Step9PlatformId;
    name: string;
    desc: string;
    gateNote?: string;
    authRoute?: string;   // route to hit to start OAuth
};

const PLATFORM_META: PlatformMeta[] = [
    {
        id: 'tiktok_shop',
        name: 'TikTok Shop',
        desc: 'Requires seller approval',
        gateNote:
            'TikTok Shop requires seller approval before connecting. Apply in your TikTok Seller Center, then return here.',
    },
    {
        id: 'instagram',
        name: 'Instagram',
        desc: 'Business account required',
    },
    {
        id: 'facebook',
        name: 'Facebook Page',
        desc: 'Connect your business page',
    },
    {
        id: 'youtube',
        name: 'YouTube',
        desc: 'Requires channel monetization',
        gateNote:
            'YouTube Shopping requires an approved, monetized channel. Apply in YouTube Studio, then return here.',
    },
    {
        id: 'x',
        name: 'X (Twitter)',
        desc: 'Optional',
    },
];

export default function Step9Social() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [status, setStatus] = useState<Step9SocialResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connecting, setConnecting] = useState<Step9PlatformId | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ── Load status ──
    const loadStatus = () => {
        setLoading(true);
        onboarding
            .getStep9()
            .then(setStatus)
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadStatus();

        // If we just returned from an OAuth callback, show a toast/notice
        const justConnected = searchParams.get('connected');
        if (justConnected) {
            // Status has been refreshed by the loadStatus() call above.
            // The callback handler already created the SocialAccount row.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Handle Connect ──
    const handleConnect = async (id: Step9PlatformId) => {
        setError(null);
        setConnecting(id);

        try {
            // TikTok Shop has a dedicated authorize endpoint that returns
            // an authorization URL, then the browser navigates to it.
            if (id === 'tiktok_shop') {
                const res = await social.tiktokAuthorize();
                window.location.href = res.authorization_url;
                return;
            }

            // Instagram / Facebook / YouTube / X use standard OAuth redirects.
            // Replace these with your actual routes when wired up:
            const routes: Record<string, string> = {
                instagram: '/api/social/instagram/authorize/',
                facebook: '/api/social/facebook/authorize/',
                youtube: '/api/social/youtube/authorize/',
                x: '/api/social/twitter/authorize/',
            };
            const route = routes[id];
            if (!route) {
                setError(`OAuth flow for ${id} is not yet configured.`);
                setConnecting(null);
                return;
            }

            // Simplest path: navigate the browser to the OAuth start URL.
            // Your backend redirects to the provider, then back to
            // /auth/onboarding/steps/step9?connected=<id>.
            window.location.href = route;
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : `Could not start ${id} connection.`,
            );
            setConnecting(null);
        }
    };

    // ── Continue / Skip ──
    const handleContinue = async (skip = false) => {
        setSaving(true);
        setError(null);

        const connected: Step9PlatformId[] =
            status?.platforms.filter((p) => p.connected).map((p) => p.id) ?? [];

        try {
            await onboarding.submitStep9({
                connected_platforms: skip ? [] : connected,
            });
            router.push(getNextRoute('step9'));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.nonFieldError() || 'Could not save.');
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

    const connectedMap = new Map(
        (status?.platforms ?? []).map((p) => [p.id, p] as const),
    );

    const gatedPending = PLATFORM_META.filter((p) => {
        const s = connectedMap.get(p.id);
        return p.gateNote && !s?.connected;
    });

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                    Step 9 of 12 · Optional
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-blue-950" />
                    Connect your social channels
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    Manage posts and sync orders from TikTok, Instagram, Facebook, and
                    YouTube. Optional.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLATFORM_META.map((p) => {
                    const s = connectedMap.get(p.id);
                    const isConnected = s?.connected ?? false;
                    const isConnecting = connecting === p.id;

                    return (
                        <div
                            key={p.id}
                            className="bg-white border border-slate-200 rounded-sm p-4 flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                    {p.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {isConnected && s?.username
                                        ? `@${s.username}`
                                        : p.desc}
                                </p>
                            </div>
                            {isConnected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                                    <Check className="h-3 w-3" /> Connected
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleConnect(p.id)}
                                    disabled={isConnecting}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium shrink-0 ${p.gateNote
                                            ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            : 'bg-blue-950 hover:bg-blue-900 text-white'
                                        } disabled:opacity-50`}
                                >
                                    {isConnecting ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Connecting…
                                        </>
                                    ) : (
                                        <>
                                            <ExternalLink className="h-3 w-3" />
                                            Connect
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {gatedPending.map((p) => (
                <div
                    key={p.id}
                    className="bg-amber-50 border border-amber-100 rounded-sm p-3 text-[11px] text-amber-900"
                >
                    {p.gateNote}{' '}
                    <a
                        href={
                            p.id === 'tiktok_shop'
                                ? 'https://seller.tiktok.com'
                                : 'https://studio.youtube.com'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline"
                    >
                        Open seller portal →
                    </a>
                </div>
            ))}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-sm px-3 py-2">
                    {error}
                </div>
            )}

            <StepFooter
                onContinue={() => handleContinue(false)}
                onSkip={() => handleContinue(true)}
                loading={saving}
                currentSlug="step9"
                optional
            />
        </div>
    );
}