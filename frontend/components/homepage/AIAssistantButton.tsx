'use client';

import { TbMessageChatbot } from 'react-icons/tb';
import React, {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import { LuX, LuSend, LuBot } from 'react-icons/lu';
import { aiApi, ApiError, type AIChatProduct } from '@/lib/api';

interface AIAssistantButtonProps {
    shopName?: string;
    hidden?: boolean;
    className?: string;
    onOpenChange?: (open: boolean) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    products?: AIChatProduct[];
    chips?: string[];
}

const formatKES = (value: number | string): string => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `KES ${n.toLocaleString('en-KE')}`;
};

/* Palette-locked stock chips */
const STOCK_STYLES: Record<string, string> = {
    'In Stock': 'bg-[#00E5FF]/15 text-[#0B0D10]',
    'Low Stock': 'bg-[#00B8D4]/15 text-[#00B8D4]',
    'Out of Stock': 'bg-[#6B7280]/15 text-[#6B7280]',
};

export default function AIAssistantButton({
    shopName = 'Havens Technologies',
    hidden = false,
    className = '',
    onOpenChange,
}: AIAssistantButtonProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');

    const initialGreeting: Message = {
        id: 'greeting',
        role: 'assistant',
        text: `Hi! I'm your shopping assistant for ${shopName}. I can help you find products, compare options, check availability, and answer questions about our store.`,
        chips: [
            'Show me laptops',
            'Delivery info',
            'Payment via M-Pesa',
            "What's on sale?",
        ],
    };

    const [messages, setMessages] = useState<Message[]>([initialGreeting]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const fabRef = useRef<HTMLButtonElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const panelId = useId();

    const closePanel = useCallback(() => {
        setOpen(false);
        fabRef.current?.focus();
    }, []);

    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);

    useEffect(() => {
        if (!open) return;
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, open, typing]);

    useEffect(() => {
        if (hidden && open) setOpen(false);
    }, [hidden, open]);

    useEffect(() => {
        if (!open || hidden) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closePanel();
        };
        window.addEventListener('keydown', onKey);

        const focusTimer = setTimeout(() => inputRef.current?.focus(), 200);

        const isSmall = window.matchMedia('(max-width: 767px)').matches;
        const prevOverflow = document.body.style.overflow;
        if (isSmall) document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKey);
            clearTimeout(focusTimer);
            if (isSmall) document.body.style.overflow = prevOverflow;
        };
    }, [open, hidden, closePanel]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const send = useCallback(
        async (raw: string) => {
            const text = raw.trim();
            if (!text || typing) return;

            const userId = `u-${Date.now()}`;
            setMessages((m) => [...m, { id: userId, role: 'user', text }]);
            setInput('');
            setTyping(true);
            setAnnouncement('Assistant is typing');

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
                setAnnouncement(data.message);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }

                let reply =
                    "Sorry, I couldn't reach the assistant right now. Please try again in a moment.";

                if (err instanceof ApiError) {
                    if (err.status === 404) {
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
                    },
                ]);
                setAnnouncement(reply);
            } finally {
                setTyping(false);
                abortRef.current = null;
            }
        },
        [typing, sessionId],
    );

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        send(input);
    };

    const onInputKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    const onChipClick = useCallback(
        (chip: string) => {
            if (typing) return;
            send(chip);
        },
        [typing, send],
    );

    if (hidden) return null;

    return (
        <>
            {open && (
                <div
                    aria-hidden="true"
                    onClick={closePanel}
                    className="fixed inset-0 z-40 bg-[#0B0D10]/50 backdrop-blur-sm transition-opacity duration-150"
                />
            )}

            <div
                id={panelId}
                role="dialog"
                aria-modal="false"
                aria-label="AI shopping assistant"
                aria-hidden={!open}
                ref={(el) => {
                    if (!el) return;
                    if (open) el.removeAttribute('inert');
                    else el.setAttribute('inert', '');
                }}
                className={`fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center transition-all duration-200 ease-out ${open
                    ? 'opacity-100 scale-100 pointer-events-auto'
                    : 'opacity-0 scale-95 pointer-events-none'
                    } ${className}`}
            >
                <div
                    className="bg-white border border-slate-200 rounded overflow-hidden flex flex-col
                     w-[calc(100vw-0.5rem)] h-[calc(100dvh-0.5rem)]
                     md:w-[72vw] md:min-w-[620px] md:max-w-[860px] md:h-[88vh] md:min-h-[560px] md:max-h-[900px]"
                >
                    {/* Header — Matte Carbon Black */}
                    <div className="bg-[#0B0D10] text-white px-4 py-3 flex items-center gap-2 shrink-0">
                        <div className="relative h-9 w-9 rounded-full bg-[#00E5FF] text-[#0B0D10] flex items-center justify-center shrink-0">
                            <TbMessageChatbot className="h-4 w-4" />
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00E5FF] border-2 border-[#0B0D10]" />
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#00B8D4] ring-2 ring-[#0B0D10]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold truncate">
                                {shopName}
                            </p>
                            <p className="text-[11px] text-[#00E5FF] mt-0.5 tracking-wide uppercase">
                                Feel the Quality
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closePanel}
                            aria-label="Close assistant"
                            className="h-7 w-7 -mr-1 flex items-center justify-center rounded text-slate-200 hover:text-[#00E5FF] hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/70"
                        >
                            <LuX className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Message stream — Soft Light Gray */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#F3F6F9]"
                    >
                        {messages.map((m) => (
                            <MessageBubble
                                key={m.id}
                                message={m}
                                onChip={onChipClick}
                                chipsDisabled={typing}
                            />
                        ))}
                        {typing && <TypingBubble />}
                    </div>

                    <div
                        role="status"
                        aria-live="polite"
                        className="sr-only"
                    >
                        {announcement}
                    </div>

                    <form
                        onSubmit={onSubmit}
                        className="border-t border-slate-200 bg-white p-2 shrink-0"
                    >
                        <div className="relative">
                            <textarea
                                ref={inputRef}
                                rows={2}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={onInputKeyDown}
                                placeholder="Ask about products, delivery, M-Pesa…"
                                aria-label="Message the AI assistant"
                                className="w-full bg-[#F3F6F9] border border-slate-200 rounded-sm pl-3 pr-14 py-3 text-[14px] text-[#111827] placeholder:text-[#6B7280] resize-none focus:outline-none focus:ring-1 focus:ring-[#00B8D4]/60 focus:border-[#00B8D4] min-h-[72px] max-h-40 leading-relaxed"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || typing}
                                aria-label="Send message"
                                className="absolute bottom-2.5 right-2 h-9 w-9 text-[#6B7280] hover:text-[#00B8D4] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <LuSend className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[12px] text-[#6B7280] text-center mt-1">
                            Prices and stock update live from our catalog
                        </p>
                    </form>
                </div>
            </div>

            {/* FAB — Matte Carbon Black with Electric Neon Cyan icon */}
            <div
                className={`fixed z-50 bottom-[5.5rem] right-6 transition-opacity duration-150 ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
            >
                <button
                    ref={fabRef}
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Open AI assistant"
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="group relative h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[#0B0D10] hover:bg-[#00B8D4] text-[#00E5FF] hover:text-[#0B0D10] shadow-[#0B0D10]/40 ring-2 ring-white/90 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#00B8D4]/40"
                >
                    <TbMessageChatbot className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#00E5FF] ring-2 ring-white" />
                </button>

                <span
                    aria-hidden="true"
                    className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-[#0B0D10] text-[#00E5FF] text-[11px] font-medium px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                    Havens Assistant
                </span>
            </div>
        </>
    );
}

function MessageBubble({
    message,
    onChip,
    chipsDisabled,
}: {
    message: Message;
    onChip: (text: string) => void;
    chipsDisabled: boolean;
}) {
    const isUser = message.role === 'user';

    const bubbleCorner = isUser
        ? 'rounded-lg rounded-tr-none'
        : 'rounded-lg rounded-tl-none';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isUser && (
                <span className="h-8 w-8 rounded-full bg-[#0B0D10] text-[#00E5FF] flex items-center justify-center shrink-0">
                    <LuBot className="w-4 h-4" />
                </span>
            )}

            <div
                className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'
                    }`}
            >
                {/* User bubble — Electric Neon Cyan with bold black text */}
                <div
                    className={`${bubbleCorner} px-3.5 py-2.5 text-[13px] whitespace-pre-wrap ${isUser
                        ? 'bg-[#00E5FF] text-[#0B0D10] font-semibold'
                        : 'bg-white border border-slate-200 text-[#111827]'
                        }`}
                >
                    {message.text}
                </div>

                {message.products && message.products.length > 0 && (
                    <ul className="space-y-2">
                        {message.products.map((p) => {
                            const image = p.images?.[0] || '/placeholder.jpeg';
                            const stockClass =
                                STOCK_STYLES[p.stock] ??
                                'bg-[#6B7280]/15 text-[#6B7280]';
                            const showBrand = !!p.brand && p.brand !== p.name;
                            return (
                                <li key={p.id}>
                                    <Link
                                        href={
                                            p.url ||
                                            `/pages/products?open=${p.id}`
                                        }
                                        className="group flex items-center gap-3 bg-white border border-slate-200 hover:border-[#00B8D4] hover:shadow rounded p-2.5 transition-all"
                                    >
                                        <div className="h-14 w-14 rounded-md bg-[#F3F6F9] border border-slate-100 overflow-hidden shrink-0">
                                            <img
                                                src={image}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {showBrand && (
                                                <p className="text-[11px] uppercase text-[#6B7280] font-medium truncate">
                                                    {p.brand}
                                                </p>
                                            )}
                                            <p className="text-[13px] font-semibold text-[#111827] truncate group-hover:text-[#00B8D4] transition-colors">
                                                {p.name}
                                            </p>
                                            <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className="text-[13px] font-bold text-[#111827]">
                                                    {formatKES(p.price)}
                                                </span>
                                                <span
                                                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${stockClass}`}
                                                >
                                                    {p.stock}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {message.chips && message.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {message.chips.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onChip(c)}
                                disabled={chipsDisabled}
                                className="text-[12px] font-medium text-[#0B0D10] bg-[#00B8D4]/10 border border-[#00B8D4]/30 hover:bg-[#00E5FF]/20 hover:border-[#00E5FF] hover:text-[#0B0D10] px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span className="h-8 w-8 rounded-full bg-[#0B0D10] text-[#00E5FF] flex items-center justify-center shrink-0">
                <LuBot className="w-4 h-4" />
            </span>
            <div className="bg-white border border-slate-200 rounded-lg rounded-tl-none px-3.5 py-2.5 flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-[#00B8D4] animate-bounce"
                        style={{ animationDelay: `${i * 120}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}