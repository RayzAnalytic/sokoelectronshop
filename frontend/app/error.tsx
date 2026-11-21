'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                </div>

                <h1 className="text-[20px] font-semibold text-slate-900 mt-1">
                    Something went wrong
                </h1>

                <p className="text-[14px] text-slate-500 mt-1 max-w-sm mx-auto">
                    An unexpected error occurred. You can try again, or head back to the home page.
                </p>

                {error.digest && (
                    <p className="text-[12px] text-slate-400 mt-1 font-mono">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-5 py-2.5 rounded text-[13px] transition-colors w-full sm:w-auto"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-5 py-2.5 rounded text-[13px] transition-colors w-full sm:w-auto"
                    >
                        <Home className="w-3.5 h-3.5" />
                        Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
}