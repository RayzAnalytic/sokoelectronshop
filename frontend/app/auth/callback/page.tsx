// app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const result = api.handleGoogleCallback();

        if (!result) {
            router.replace('/auth/login?error=oauth_failed');
            return;
        }

        const target =
            result.redirect_to ||
            result.next ||
            '/pages/account';

        router.replace(target);
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <svg
                    className="animate-spin h-5 w-5 text-slate-400 mx-auto"
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
                <p className="mt-3 text-[13px] text-slate-500">
                    Signing you in…
                </p>
            </div>
        </div>
    );
}