'use client';

import { TbMessageChatbot } from 'react-icons/tb';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LuX, LuSend, LuSearch, LuBot } from 'react-icons/lu';
import { aiApi, ApiError, type AIChatProduct } from '@/lib/api';

interface AIAssistantButtonProps {
    shopName?: string;
    hidden?: boolean;
    className?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    /** Product cards returned by the AI endpoint, rendered inline. */
    products?: AIChatProduct[];
    /** Suggested follow-up questions. */
    chips?: string[];
}

/**
 * Accepts DRF decimals as strings. `formatKES("78500.00")` → "KES 78,500".
 */
const formatKES = (value: number | string): string => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `KES ${n.toLocaleString('en-KE')}`;
};

export default function AIAssistantButton({
    shopName = 'MyShop',
    hidden = false,
    className = '',
}: AIAssistantButtonProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);

    const [messages, setMessages] = useState<Message[]>(() => [
        {
            id: 'greeting',
            role: 'assistant',
            text: `Hi! 👋 I'm your shopping assistant for ${shopName}. I can help you find products, compare options, check availability, and answer questions about our store.`,
            chips: [
                'Show me laptops',
                'Delivery info',
                'Payment via M-Pesa',
                "What's on sale?",
            ],
        },
    ]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Auto-scroll to latest
    useEffect(() => {
        if (!open) return;
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, open, typing]);

    // Focus input on open; close on Escape
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => inputRef.current?.focus(), 200);
        return () => {
            window.removeEventListener('keydown', onKey);
            clearTimeout(t);
        };
    }, [open]);

    // Abort any in-flight request when the component unmounts
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    // ─────────────────────────────────────────────────────────────────
    // Send a message to the backend AI endpoint
    // ─────────────────────────────────────────────────────────────────
    const send = async (raw: string) => {
        const text = raw.trim();
        if (!text || typing) return;

        setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text }]);
        setInput('');
        setTyping(true);

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const data = await aiApi.chat(
                { message: text, session_id: sessionId },
                ctrl.signal,
            );

            setSessionId(data.session_id);

            setMessages((m) => [
                ...m,
                {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    text: data.message,
                    products: data.products,
                    chips: data.chips,
                },
            ]);
        } catch (err) {
            // If the request was aborted (unmount, close), stay silent
            if (err instanceof DOMException && err.name === 'AbortError') return;

            let reply =
                "Sorry, I couldn't reach the assistant right now. Please try again in a moment.";

            if (err instanceof ApiError) {
                if (err.status === 404) {
                    // Backend route `/api/ai/chat/` isn't registered yet.
                    reply =
                        "The AI assistant isn't available on this store yet. Please try again later.";
                } else if (err.status === 503) {
                    reply =
                        "The AI assistant isn't configured yet. Please contact support.";
                } else if (err.status === 429) {
                    reply =
                        "I'm receiving too many requests right now. Please wait a moment and try again.";
                } else if (err.status === 502) {
                    reply =
                        'The assistant is temporarily unavailable. Please try again shortly.';
                }
            }

            setMessages((m) => [
                ...m,
                {
                    id: `a-err-${Date.now()}`,
                    role: 'assistant',
                    text: reply,
                    chips: ['Try again'],
                },
            ]);
        } finally {
            setTyping(false);
            abortRef.current = null;
        }
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        send(input);
    };

    if (hidden) return null;

    return (
        <>
            {/* ── Panel ─────────────────────────────────────────────── */}
            <div
                id="ai-panel"
                role="dialog"
                aria-label="AI shopping assistant"
                aria-hidden={!open}
                className={`fixed z-40 bottom-[5.5rem] right-4 left-4 sm:left-auto sm:right-6 sm:w-[380px] origin-bottom-right transition-all duration-200 ease-out ${open
                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                    : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                    } ${className}`}
            >
                <div className="bg-white border border-slate-200 rounded-sm shadow-xl overflow-hidden flex flex-col h-[520px] max-h-[calc(100vh-7rem)]">
                    {/* Header */}
                    <div className="bg-slate-950 text-white px-4 py-3 flex items-center gap-3 shrink-0">
                        <div className="relative h-9 w-9 rounded-full bg-blue-950 flex items-center justify-center shrink-0">
                            <TbMessageChatbot className="h-4 w-4" />
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold leading-tight truncate">
                                AI Assistant
                            </p>
                            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                Grounded in our live catalog
                            </p>
                        </div>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close assistant"
                            className="h-7 w-7 -mr-1 flex items-center justify-center rounded-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                            <LuX className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50"
                    >
                        {messages.map((m) => (
                            <MessageBubble key={m.id} message={m} onChip={send} />
                        ))}
                        {typing && <TypingBubble />}
                    </div>

                    {/* Input */}
                    <form
                        onSubmit={onSubmit}
                        className="border-t border-slate-200 bg-white p-2 shrink-0"
                    >
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about products, delivery, M-Pesa…"
                                    aria-label="Message the AI assistant"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-950 focus:border-blue-950"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!input.trim() || typing}
                                aria-label="Send message"
                                className="h-9 w-9 shrink-0 rounded-sm bg-blue-950 hover:bg-blue-900 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950/40"
                            >
                                <LuSend className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center mt-1.5">
                            Prices and stock update live from our catalog
                        </p>
                    </form>
                </div>
            </div>

            {/* ── Floating toggle ───────────────────────────────────── */}
            <div className="fixed z-40 bottom-[5.5rem] right-5 sm:bottom-[6.5rem] sm:right-6">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
                    aria-expanded={open}
                    aria-controls="ai-panel"
                    className="group relative h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-white/90 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40"
                >
                    {open ? (
                        <LuX className="w-5 h-5" />
                    ) : (
                        <TbMessageChatbot className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                </button>

                {!open && (
                    <span
                        aria-hidden="true"
                        className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    >
                        AI Assistant
                    </span>
                )}
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────
function MessageBubble({
    message,
    onChip,
}: {
    message: Message;
    onChip: (text: string) => void;
}) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isUser && (
                <span className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center shrink-0">
                    <LuBot className="w-3.5 h-3.5" />
                </span>
            )}

            <div
                className={`max-w-[90%] space-y-2 ${isUser ? 'items-end' : 'items-start'
                    }`}
            >
                <div
                    className={`rounded-sm px-3 py-2 text-[12.5px] leading-relaxed ${isUser
                        ? 'bg-blue-950 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                >
                    {message.text}
                </div>

                {/* Product suggestions */}
                {message.products && message.products.length > 0 && (
                    <ul className="space-y-1.5">
                        {message.products.map((p) => (
                            <li key={p.id}>
                                <Link
                                    href={p.url || `/pages/products?open=${p.id}`}
                                    className="group flex items-center gap-2.5 bg-white border border-slate-200 hover:border-blue-200 hover:shadow-sm rounded-sm p-2 transition-all"
                                >
                                    <div className="h-11 w-11 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={p.images[0] ?? '/placeholder.jpeg'}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium truncate">
                                            {p.brand}
                                        </p>
                                        <p className="text-[12px] font-semibold text-slate-900 truncate group-hover:text-blue-950">
                                            {p.name}
                                        </p>
                                        <div className="flex items-baseline gap-1.5 mt-0.5">
                                            <span className="text-[12px] font-bold text-slate-900">
                                                {formatKES(p.price)}
                                            </span>
                                            <span
                                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${p.stock === 'In Stock'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : p.stock === 'Low Stock'
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-red-50 text-red-700'
                                                    }`}
                                            >
                                                {p.stock}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Follow-up chips */}
                {message.chips && message.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {message.chips.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onChip(c)}
                                className="text-[11.5px] font-medium text-blue-950 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 px-2.5 py-1 rounded-full transition-colors"
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TypingBubble() {
    return (
        <div className="flex gap-2">
            <span className="h-7 w-7 rounded-full bg-blue-950 text-white flex items-center justify-center shrink-0">
                <LuBot className="w-3.5 h-3.5" />
            </span>
            <div className="bg-white border border-slate-200 rounded-sm px-3 py-2.5 flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 120}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}