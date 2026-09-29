'use client';
import { TbMessageChatbot } from "react-icons/tb";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    LuSparkles,
    LuX,
    LuSend,
    LuSearch,
    LuShoppingBag,
    LuTruck,
    LuCreditCard,
    LuStore,
    LuLightbulb,
    LuBot,
} from 'react-icons/lu';
import { products as allProducts, type ProductFull } from '@/data/products';

interface AIAssistantButtonProps {
    shopName?: string;
    hidden?: boolean;
    className?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    /** Optional product suggestions attached to an assistant reply. */
    products?: ProductFull[];
    /** Optional follow-up suggestion chips. */
    chips?: string[];
}

const formatKES = (n: number) => `KES ${n.toLocaleString()}`;

// ─────────────────────────────────────────────────────────────────
// Rule-based reply engine — grounded in the real catalog + policies
// Replace `respond()` with a real API call when the backend is ready.
// ─────────────────────────────────────────────────────────────────
function respond(query: string): Omit<Message, 'id' | 'role'> {
    const q = query.toLowerCase().trim();

    // Greetings
    if (/^(hi|hello|hey|habari|jambo|good (morning|afternoon|evening))/.test(q)) {
        return {
            text: "Hi! 👋 I'm your shopping assistant. What are you looking for today?",
            chips: ['Show me laptops', 'Best sellers', 'Delivery info'],
        };
    }

    // Delivery
    if (/\b(deliver|delivery|shipping|ship|how long)\b/.test(q)) {
        return {
            text: 'We deliver countrywide. Nairobi orders arrive in 1–2 days, other regions in 2–4 days. Delivery is free on orders over KES 5,000.',
            chips: ['Payment via M-Pesa', 'Return policy'],
        };
    }

    // Payment — M-Pesa only
    if (/\b(pay|payment|mpesa|m-?pesa|checkout|lipa)\b/.test(q)) {
        return {
            text: "We accept M-Pesa only. At checkout you'll get a payment prompt on your phone — enter your M-Pesa PIN to confirm the order. No card details needed.",
            chips: ['Delivery info', 'Return policy'],
        };
    }

    // Return policy
    if (/\b(return|refund|exchange|warranty)\b/.test(q)) {
        return {
            text: 'You have 30 days to return any item in its original condition. Refunds land back in 3–5 working days. Every product carries the official manufacturer warranty.',
            chips: ['Delivery info', 'Payment via M-Pesa'],
        };
    }

    // Store info
    if (/\b(store|shop|location|address|hours|open|contact|reach)\b/.test(q)) {
        return {
            text: 'Our main store is in Westlands, Nairobi — open 7 days a week, 9am–7pm. You can also reach us on WhatsApp for instant help.',
            chips: ['Show me products', 'Delivery info'],
        };
    }

    // Recommendations
    if (/\b(recommend|suggest|best|top|popular|favourite|favorite)\b/.test(q)) {
        const top = [...allProducts]
            .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
            .slice(0, 3);
        return {
            text: 'Here are our highest-rated products right now:',
            products: top,
            chips: ['Best sellers', 'Show me deals'],
        };
    }

    // Price under X
    const under = q.match(/under\s+(?:kes\s*)?(\d[\d,]*)/);
    if (under) {
        const max = Number(under[1].replace(/,/g, ''));
        const matches = allProducts
            .filter((p) => p.price <= max)
            .sort((a, b) => b.price - a.price)
            .slice(0, 3);
        if (matches.length) {
            return {
                text: `Here's what we have under ${formatKES(max)}:`,
                products: matches,
                chips: ['Show more options', 'Delivery info'],
            };
        }
    }

    // Category
    const matchedCategory = allProducts.find((p) =>
        q.includes(p.category.toLowerCase()),
    );
    if (matchedCategory) {
        const matches = allProducts
            .filter((p) => p.category === matchedCategory.category)
            .slice(0, 3);
        return {
            text: `Here are some ${matchedCategory.category.toLowerCase()} we have:`,
            products: matches,
            chips: ['Show more', 'Delivery info'],
        };
    }

    // Keyword search
    const keywords = q
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    if (keywords.length) {
        const scored = allProducts
            .map((p) => {
                let score = 0;
                for (const kw of keywords) {
                    if (p.name.toLowerCase().includes(kw)) score += 3;
                    if (p.brand.toLowerCase().includes(kw)) score += 2;
                    if (p.category.toLowerCase().includes(kw)) score += 2;
                    if (p.description.toLowerCase().includes(kw)) score += 1;
                }
                return { p, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((x) => x.p);

        if (scored.length) {
            return {
                text: `Here's what I found for "${query}":`,
                products: scored,
                chips: ['Show more', 'Delivery info', 'Payment via M-Pesa'],
            };
        }
    }

    // Fallback
    return {
        text: "I can help you find products, check delivery and M-Pesa payment info, and answer questions about our store. Try one of these:",
        chips: [
            'Show me laptops',
            "What's on sale?",
            'Delivery info',
            'Payment via M-Pesa',
        ],
    };
}

export default function AIAssistantButton({
    shopName = 'MyShop',
    hidden = false,
    className = '',
}: AIAssistantButtonProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [messages, setMessages] = useState<Message[]>(() => [
        {
            id: 'greeting',
            role: 'assistant',
            text: `Hi! 👋 I'm your shopping assistant for ${shopName}. I can help you find products, compare options, check availability, and answer questions about our store.`,
            chips: [
                'Search products',
                'Delivery info',
                'Payment via M-Pesa',
                'Product recommendations',
            ],
        },
    ]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

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

    const send = (raw: string) => {
        const text = raw.trim();
        if (!text) return;
        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: 'user',
            text,
        };
        setMessages((m) => [...m, userMsg]);
        setInput('');
        setTyping(true);

        // Simulate a short "thinking" pause for a natural feel
        setTimeout(() => {
            const reply = respond(text);
            setMessages((m) => [
                ...m,
                { id: `a-${Date.now()}`, role: 'assistant', ...reply },
            ]);
            setTyping(false);
        }, 350);
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        send(input);
    };

    // Compute total in-stock count once for a small dynamic hint
    const inStockCount = useMemo(
        () => allProducts.filter((p) => p.stock !== 'Out of Stock').length,
        [],
    );

    if (hidden) return null;

    return (
        <>
            {/* ── Panel ───────────────────────────────────────────────── */}
            <div
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
                                disabled={!input.trim()}
                                aria-label="Send message"
                                className="h-9 w-9 shrink-0 rounded-sm bg-blue-950 hover:bg-blue-900 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-950/40"
                            >
                                <LuSend className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center mt-1.5">
                            {inStockCount} products in stock · prices update live
                        </p>
                    </form>
                </div>
            </div>

            {/* ── Floating toggle ─────────────────────────────────────── */}
            <div className="fixed z-40 bottom-[5.5rem] right-5 sm:bottom-[6.5rem] sm:right-6">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
                    aria-expanded={open}
                    aria-controls="ai-panel"
                    className="group relative h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-blue-950 hover:bg-blue-900 text-white shadow-lg shadow-blue-950/25 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-950/30"
                >
                    {open ? (
                        <LuX className="w-5 h-5" />
                    ) : (
                            <TbMessageChatbot className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                </button>

                {/* Tooltip (desktop, closed) */}
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

            <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
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
                                    href={`/pages/products?open=${p.id}`}
                                    className="group flex items-center gap-2.5 bg-white border border-slate-200 hover:border-blue-200 hover:shadow-sm rounded-sm p-2 transition-all"
                                >
                                    <div className="h-11 w-11 rounded-sm bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={p.images[0]}
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