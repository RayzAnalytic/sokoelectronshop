'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const DEFAULT_TARGET = '/pages/account';

export default function AuthCallbackPage() {
    const ran = useRef(false);
    const [message, setMessage] = useState('Signing you in…');

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
 
        console.log(
            '[auth/callback] href =', window.location.href,
            '\n[auth/callback] hash =', window.location.hash,
        );

        const result = api.handleGoogleCallback(); 
        console.log(
            '[auth/callback] result =', result,
            '\n[auth/callback] token after =',
            typeof window !== 'undefined'
                ? (window.localStorage.getItem('myshop.access') ?? '<none>').slice(0, 24) + '…'
                : '<ssr>',
        );

        if (!result) {
            const existing = api.getAccessToken();
            if (existing) {
                window.location.replace(DEFAULT_TARGET);
                return;
            }
            setMessage('Sign-in failed. Redirecting…');
            window.location.replace('/auth/login?error=oauth_failed');
            return;
        }

        const target =
            result.next && result.next !== '/' && result.next !== DEFAULT_TARGET
                ? result.next
                : result.redirect_to || DEFAULT_TARGET;

        window.location.replace(target);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <svg className="animate-spin h-5 w-5 text-slate-400 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="mt-2 text-[13px] text-slate-500">{message}</p>
            </div>
        </div>
    );
}