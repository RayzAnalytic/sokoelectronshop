'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md text-center">
                <p className="text-[88px] font-bold text-red-600 select-none">
                    404
                </p>

                <h1 className="text-[20px] font-semibold text-slate-900 mt-4">
                    Page not found
                </h1>

                <p className="text-[14px] text-slate-500 mt-1 max-w-sm mx-auto">
                    We couldn&rsquo;t find the page you were looking for. It may have been moved, deleted, or never existed.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-5 py-2.5 rounded text-[13px] transition-colors w-full sm:w-auto"
                    >
                        <Home className="w-3.5 h-3.5" />
                        Back to home
                    </Link>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-5 py-2.5 rounded text-[13px] transition-colors w-full sm:w-auto"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Go back
                    </button>
                </div>
            </div>
        </div>
    );
}