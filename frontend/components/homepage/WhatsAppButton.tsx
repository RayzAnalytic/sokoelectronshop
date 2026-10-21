'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import {
    LuX,
    LuChevronRight,
    LuMessageCircle,
    LuPackage,
    LuTruck,
    LuShoppingBag,
    LuHeadphones,
    LuClock,
} from 'react-icons/lu';
import { whatsapfloatApi, type WhatsapfloatConfig } from '@/lib/api';

interface WhatsAppButtonProps {
    hidden?: boolean;
    className?: string;
    onOpenChange?: (open: boolean) => void;
}

const ICON_MAP = {
    shopping_bag: LuShoppingBag,
    package: LuPackage,
    truck: LuTruck,
    headphones: LuHeadphones,
    message: LuMessageCircle,
    clock: LuClock,
} as const;

type IconName = keyof typeof ICON_MAP;

function iconFor(name: string): React.ComponentType<{ className?: string }> {
    return ICON_MAP[name as IconName] ?? LuMessageCircle;
}

export default function WhatsAppButton({
    hidden = false,
    className = '',
    onOpenChange,
}: WhatsAppButtonProps) {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<WhatsapfloatConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const panelRef = useRef<HTMLDivElement | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const ctrl = new AbortController();

        whatsapfloatApi
            .config(ctrl.signal)
            .then(setConfig)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setConfig(null);
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);

    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);

        const focusTimer = setTimeout(() => closeBtnRef.current?.focus(), 40);

        const isSmall = window.matchMedia('(max-width: 767px)').matches;
        const prevOverflow = document.body.style.overflow;
        if (isSmall) document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKey);
            clearTimeout(focusTimer);
            if (isSmall) document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    // ── Derive quick actions from config ───────────────────────
    // `config` may be present but without `quickActions` (optional field /
    // partial payload), so guard the field itself and normalize to [].
    const quickActions = useMemo(() => {
        if (!config?.quickActions) return [];
        return config.quickActions.map((a) => ({
            ...a,
            icon: iconFor(a.icon),
        }));
    }, [config]);

    if (loading || hidden || !config || !config.enabled) return null;

    const buildWaLink = (msg: string) =>
        `https://wa.me/${config.phoneNumber}?text=${encodeURIComponent(msg)}`;

    const openWhatsApp = (msg: string) => {
        window.open(buildWaLink(msg), '_blank', 'noopener,noreferrer');
    };

    return (
        <>
            {/* ── Backdrop ────────────────────────────────────────────── */}
            {open && (
                <div
                    aria-hidden="true"
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-150"
                />
            )}

            {/* ── Panel (centered) ────────────────────────────────────── */}
            <div
                ref={panelRef}
                id="wa-panel"
                role="dialog"
                aria-modal="false"
                aria-label={`Contact ${config.shopName} on WhatsApp`}
                aria-hidden={!open}
                className={`fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center transition-all duration-200 ease-out ${open
                    ? 'opacity-100 scale-100 pointer-events-auto'
                    : 'opacity-0 scale-95 pointer-events-none'
                    } ${className}`}
            >
                <div
                    className="bg-white border border-slate-200 rounded-md shadow-2xl overflow-hidden flex flex-col
                     w-[calc(100vw-1.5rem)] max-w-[520px]
                     md:w-[48vw] md:min-w-[500px] md:max-w-[600px]
                     h-auto min-h-[520px] md:min-h-[600px] md:max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="bg-[#25D366] text-white px-4 py-3 flex items-start gap-3 shrink-0">
                        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <FaWhatsapp className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold leading-tight truncate">
                                Chat with {config.shopName}
                            </p>
                            <p className="text-[12px] text-white/85 leading-tight mt-0.5 flex items-center gap-1">
                                <LuClock className="w-3 h-3" />
                                {config.hoursLabel}
                            </p>
                        </div>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close WhatsApp panel"
                            className="h-7 w-7 -mr-1 flex items-center justify-center rounded-md text-white/80 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                            <LuX className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body — flex-1 so it fills the panel's height */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-full bg-[#25D366]/10 text-[#1faa52] flex items-center justify-center shrink-0">
                                <LuMessageCircle className="w-3.5 h-3.5" />
                            </span>
                            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                                <p className="text-[13px] text-slate-700 leading-relaxed">
                                    Hi there 👋 We&apos;re online. Pick a topic below or
                                    send us a message directly on WhatsApp.
                                </p>
                            </div>
                        </div>

                        {quickActions.length > 0 && (
                            <>
                                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium pt-1">
                                    Quick questions
                                </div>

                                <ul className="space-y-1.5">
                                    {quickActions.map((a) => (
                                        <li key={a.id}>
                                            <button
                                                type="button"
                                                onClick={() => openWhatsApp(a.message)}
                                                className="w-full group flex items-center gap-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-3 py-2.5 text-left transition-colors"
                                            >
                                                <span className="h-7 w-7 rounded-md bg-slate-100 text-slate-600 group-hover:bg-[#25D366]/10 group-hover:text-[#1faa52] flex items-center justify-center shrink-0 transition-colors">
                                                    <a.icon className="w-3.5 h-3.5" />
                                                </span>
                                                <span className="flex-1 text-[13.5px] text-slate-800 font-medium">
                                                    {a.label}
                                                </span>
                                                <LuChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-200 p-3 bg-white shrink-0">
                        <button
                            type="button"
                            onClick={() => openWhatsApp(config.defaultMessage)}
                            className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1faa52] text-white font-medium px-4 py-3 rounded-sm text-[14px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50"
                        >
                            <FaWhatsapp className="w-4 h-4" />
                            Open WhatsApp
                        </button>
                        <p className="text-[11px] text-slate-400 text-center mt-2">
                            {config.displayNumber || config.phoneNumber}
                        </p>
                    </div>
                </div>
            </div>

            <div className="fixed z-50 bottom-3 right-6">
                <button
                    id="wa-toggle"
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-label={open ? 'Close WhatsApp panel' : 'Open WhatsApp'}
                    aria-expanded={open}
                    aria-controls="wa-panel"
                    className="group relative h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#1faa52] text-white shadow-lg shadow-[#25D366]/25 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
                >
                    {open ? (
                        <LuX className="w-5 h-5" />
                    ) : (
                        <FaWhatsapp className="w-6 h-6" />
                    )}

                    {!open && (
                        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-ping pointer-events-none" />
                    )}
                </button>
            </div>
        </>
    );
}