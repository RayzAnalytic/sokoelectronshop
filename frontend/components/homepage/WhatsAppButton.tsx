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

const FALLBACK_PHONE = '254706479906';
const FALLBACK_DISPLAY = '0706479906';
const FALLBACK_SHOP = 'RAZE STORE';
const FALLBACK_HOURS = 'We typically reply within minutes';
const FALLBACK_MESSAGE = 'Hello! I would like to inquire about your products and services.';

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

type QuickAction = { id: string; label: string; message: string; icon: string };

export default function WhatsAppButton({
    hidden = false,
    className = '',
    onOpenChange,
}: WhatsAppButtonProps) {
    const [open, setOpen] = useState(false);
    const [remote, setRemote] = useState<WhatsapfloatConfig | null>(null);
    const [apiFailed, setApiFailed] = useState(false);

    const closeBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const ctrl = new AbortController();

        whatsapfloatApi
            .config(ctrl.signal)
            .then((data) => {
                setRemote(data);
                setApiFailed(false);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setApiFailed(true);
            });

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

    const config = useMemo(() => {
        const enabled = remote?.enabled !== false;
        const phoneNumber = remote?.phoneNumber || FALLBACK_PHONE;
        const displayNumber = remote?.displayNumber || FALLBACK_DISPLAY;
        const shopName = remote?.shopName || FALLBACK_SHOP;
        const hoursLabel = remote?.hoursLabel || FALLBACK_HOURS;
        const defaultMessage = remote?.defaultMessage || FALLBACK_MESSAGE;

        const rawActions: QuickAction[] = Array.isArray(remote?.quickActions)
            ? remote!.quickActions.map((a, i) => ({
                id: String(a.id ?? i),
                label: a.label,
                message: a.message,
                icon: a.icon ?? 'message',
            }))
            : [];

        return {
            enabled,
            phoneNumber,
            displayNumber,
            shopName,
            hoursLabel,
            defaultMessage,
            quickActions: rawActions.map((a) => ({ ...a, iconComp: iconFor(a.icon) })),
        };
    }, [remote]);

    if (hidden) return null;
    if (remote && !remote.enabled) return null;

    const buildWaLink = (msg: string) =>
        `https://wa.me/${config.phoneNumber}?text=${encodeURIComponent(msg)}`;

    const openWhatsApp = (msg: string) => {
        window.open(buildWaLink(msg), '_blank', 'noopener,noreferrer');
    };

    return (
        <>
            {open && (
                <div
                    aria-hidden="true"
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-40 bg-blue-950/50 backdrop-blur-sm transition-opacity duration-150"
                />
            )}

            <div
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
                    className="bg-white border border-slate-200 rounded overflow-hidden flex flex-col
                     w-[calc(100vw-1.5rem)] max-w-[520px]
                     md:w-[48vw] md:min-w-[500px] md:max-w-[600px]
                     h-auto min-h-[520px] md:min-h-[600px] md:max-h-[85vh]"
                >
                    <div className="bg-blue-950 text-white px-4 py-3 flex items-start gap-3 shrink-0">
                        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <FaWhatsapp className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold truncate">
                                Chat with {config.shopName}
                            </p>
                            <p className="text-[11px] text-slate-300 mt-0.5 uppercase tracking-wide">
                                Feel the Quality
                            </p>
                            {config.hoursLabel && (
                                <p className="text-[12px] text-slate-200 mt-0.5 flex items-center gap-1">
                                    <LuClock className="w-3 h-3" />
                                    {config.hoursLabel}
                                </p>
                            )}
                        </div>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close WhatsApp panel"
                            className="h-7 w-7 -mr-1 flex items-center justify-center rounded text-slate-200 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                            <LuX className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-full bg-blue-950/10 text-blue-950 flex items-center justify-center shrink-0">
                                <LuMessageCircle className="w-3.5 h-3.5" />
                            </span>
                            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                                <p className="text-[13px] text-slate-900 leading-relaxed">
                                    {apiFailed
                                        ? 'Tap the button below to chat with us directly on WhatsApp.'
                                        : "Hi there! 👋 Need expert help, looking for product reviews, or want to check stock? Send us a message directly on WhatsApp!"}
                                </p>
                            </div>
                        </div>

                        {config.quickActions.length > 0 && (
                            <>
                                <div className="text-[11px] uppercase text-slate-500 font-medium pt-1">
                                    Quick questions
                                </div>
                                <ul className="space-y-1.5">
                                    {config.quickActions.map((a) => (
                                        <li key={a.id}>
                                            <button
                                                type="button"
                                                onClick={() => openWhatsApp(a.message)}
                                                className="w-full group flex items-center gap-2.5 rounded border border-slate-200 bg-white hover:bg-blue-950/5 hover:border-blue-950 px-3 py-2.5 text-left transition-colors"
                                            >
                                                <span className="h-7 w-7 rounded bg-slate-50 text-slate-900 group-hover:bg-blue-950 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                                                    <a.iconComp className="w-3.5 h-3.5" />
                                                </span>
                                                <span className="flex-1 text-[13.5px] text-slate-900 font-medium">
                                                    {a.label}
                                                </span>
                                                <LuChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-950 shrink-0 transition-colors" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    <div className="border-t border-slate-200 p-2 bg-white shrink-0">
                        <button
                            type="button"
                            onClick={() => openWhatsApp(config.defaultMessage)}
                            className="w-full inline-flex items-center justify-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-bold px-4 py-3 rounded text-[14px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950"
                        >
                            <FaWhatsapp className="w-4 h-4" />
                            Open WhatsApp
                        </button>
                        <p className="text-[11px] text-slate-500 text-center mt-1">
                            {config.displayNumber}
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
                    className="group relative h-14 w-14 rounded-full bg-blue-950 hover:bg-blue-900 text-white shadow-blue-950/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-950/40"
                >
                    {open ? <LuX className="w-5 h-5" /> : <FaWhatsapp className="w-6 h-6" />}
                    {!open && (
                        <span className="absolute inset-0 rounded-full bg-blue-950 opacity-60 animate-ping pointer-events-none" />
                    )}
                </button>
            </div>
        </>
    );
}