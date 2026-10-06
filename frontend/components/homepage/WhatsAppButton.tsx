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
    /** Set true to force-hide the widget on a specific page (e.g. checkout). */
    hidden?: boolean;
    className?: string;
}

/**
 * Backend icon name → Lucide component.
 * The backend only emits the six values below (see WhatsAppQuickAction.ICON_CHOICES
 * in the `whatsapfloat` Django app).
 * Anything unrecognised falls back to a generic message icon.
 */
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
}: WhatsAppButtonProps) {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<WhatsapfloatConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const panelRef = useRef<HTMLDivElement | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);

    // ── Fetch config once on mount ─────────────────────────────
    useEffect(() => {
        const ctrl = new AbortController();

        whatsapfloatApi
            .config(ctrl.signal)
            .then(setConfig)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                // Silent failure — the widget just doesn't render
                setConfig(null);
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    // ── Close on Escape, and on outside click when open ───────
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (panelRef.current && !panelRef.current.contains(target)) {
                const toggle = document.getElementById('wa-toggle');
                if (toggle && toggle.contains(target)) return;
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('mousedown', onClick);
        const t = setTimeout(() => closeBtnRef.current?.focus(), 40);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onClick);
            clearTimeout(t);
        };
    }, [open]);

    // ── Derive quick actions from config ───────────────────────
    const quickActions = useMemo(() => {
        if (!config) return [];
        return config.quickActions.map((a) => ({
            ...a,
            icon: iconFor(a.icon),
        }));
    }, [config]);

    // ── Bail out while loading, hidden, or disabled ────────────
    if (loading || hidden || !config || !config.enabled) return null;

    const buildWaLink = (msg: string) =>
        `https://wa.me/${config.phoneNumber}?text=${encodeURIComponent(msg)}`;

    const openWhatsApp = (msg: string) => {
        window.open(buildWaLink(msg), '_blank', 'noopener,noreferrer');
    };

    return (
        <>
            {/* ── Panel ───────────────────────────────────────────────── */}
            <div
                ref={panelRef}
                id="wa-panel"
                role="dialog"
                aria-label={`Contact ${config.shopName} on WhatsApp`}
                aria-hidden={!open}
                className={`fixed z-40 bottom-[5.5rem] right-4 left-4 sm:left-auto sm:right-6 sm:w-[360px] origin-bottom-right transition-all duration-200 ease-out ${open
                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                    : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                    } ${className}`}
            >
                <div className="bg-white border border-slate-200 rounded-sm shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-[#25D366] text-white px-4 py-3 flex items-start gap-3">
                        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <FaWhatsapp className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold leading-tight truncate">
                                Chat with {config.shopName}
                            </p>
                            <p className="text-[11px] text-white/85 leading-tight mt-0.5 flex items-center gap-1">
                                <LuClock className="w-3 h-3" />
                                {config.hoursLabel}
                            </p>
                        </div>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close WhatsApp panel"
                            className="h-7 w-7 -mr-1 flex items-center justify-center rounded-sm text-white/80 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                            <LuX className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-full bg-[#25D366]/10 text-[#1faa52] flex items-center justify-center shrink-0">
                                <LuMessageCircle className="w-3.5 h-3.5" />
                            </span>
                            <div className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2">
                                <p className="text-[12px] text-slate-700 leading-relaxed">
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
                                                className="w-full group flex items-center gap-2.5 rounded-sm border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-3 py-2.5 text-left transition-colors"
                                            >
                                                <span className="h-7 w-7 rounded-sm bg-slate-100 text-slate-600 group-hover:bg-[#25D366]/10 group-hover:text-[#1faa52] flex items-center justify-center shrink-0 transition-colors">
                                                    <a.icon className="w-3.5 h-3.5" />
                                                </span>
                                                <span className="flex-1 text-[13px] text-slate-800 font-medium">
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
                    <div className="border-t border-slate-200 p-3 bg-white">
                        <button
                            type="button"
                            onClick={() => openWhatsApp(config.defaultMessage)}
                            className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1faa52] text-white font-medium px-4 py-2.5 rounded-sm text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50"
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

            {/* ── Floating toggle ─────────────────────────────────────── */}
            <div className="fixed z-40 bottom-5 right-4 sm:bottom-6 sm:right-6">
                {!open && (
                    <span
                        aria-hidden="true"
                        className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    >
                        Chat on WhatsApp
                    </span>
                )}
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