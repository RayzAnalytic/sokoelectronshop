'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, MessageCircle, Send, X } from 'lucide-react';
import {
    aiApi,
    whatsapfloatApi,
    type AIChatProduct,
    type WhatsapfloatConfig,
} from '@/lib/api';

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
    );
}

type Tab = 'ai' | 'whatsapp';

interface Msg {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    products?: AIChatProduct[];
    chips?: string[];
}

interface Props {
    shopName?: string;
}

export default function SupportWidget({ shopName = 'Havens Technologies' }: Props) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('ai');

    const [waConfig, setWaConfig] = useState<WhatsapfloatConfig | null>(null);

    const [messages, setMessages] = useState<Msg[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        whatsapfloatApi
            .config()
            .then(setWaConfig)
            .catch(() => setWaConfig(null));
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending, tab, open]);

    useEffect(() => {
        if (open && tab === 'ai' && messages.length === 0) {
            setMessages([
                {
                    id: 'greet',
                    role: 'assistant',
                    content: `Hi! I'm the ${shopName} assistant. Ask me about products, prices, delivery, or anything else.`,
                },
            ]);
        }
    }, [open, tab, messages.length, shopName]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (open && tab === 'ai') {
            const t = setTimeout(() => textareaRef.current?.focus(), 150);
            return () => clearTimeout(t);
        }
    }, [open, tab]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }, [input]);

    async function sendMessage(text: string) {
        const trimmed = text.trim();
        if (!trimmed || sending) return;

        setSending(true);
        setInput('');
        setMessages((prev) => [
            ...prev,
            { id: `u-${Date.now()}`, role: 'user', content: trimmed },
        ]);

        try {
            const res = await aiApi.chat({
                message: trimmed,
                session_id: sessionId,
            });
            setSessionId(res.session_id);

            if (res.requires_auth) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `a-${Date.now()}`,
                        role: 'assistant',
                        content:
                            'Please sign in to continue chatting, or switch to WhatsApp to talk to us now.',
                    },
                ]);
                return;
            }

            setMessages((prev) => [
                ...prev,
                {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    content: res.message,
                    products: res.products,
                    chips: res.chips,
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `e-${Date.now()}`,
                    role: 'assistant',
                    content:
                        'Sorry, I couldn\u2019t answer that. You can try again or switch to WhatsApp.',
                },
            ]);
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    }

    function openWhatsApp(message?: string) {
        if (!waConfig?.phoneNumber) return;
        const digits = waConfig.phoneNumber.replace(/\D/g, '');
        const text = encodeURIComponent(
            message || waConfig.defaultMessage || 'Hello!',
        );
        window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
    }

    return (
        <>
            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="group fixed bottom-4 right-4 z-[90] h-14 w-14 rounded-full bg-[#0B0D10] hover:bg-[#00B8D4] text-[#00E5FF] hover:text-[#0B0D10] shadow-lg ring-2 ring-white/90 flex items-center justify-center transition"
                    aria-label="Open support"
                >
                    <MessageCircle className="w-6 h-6" />
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#00E5FF] ring-2 ring-white" />
                </button>
            )}

            {open && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6">
                    <div
                        className="absolute inset-0 bg-[#0B0D10]/60 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />

                    <div className="relative w-[96vw] h-[95vh] md:w-[min(85vw,1240px)] md:h-[min(90vh,900px)] bg-white border border-slate-200 rounded-sm flex flex-col overflow-hidden">
                        {/* Header — Matte Carbon Black */}
                        <div className="shrink-0 border-b border-slate-200 bg-white">
                            <div className="px-3 sm:px-4 pt-3 flex items-center justify-between">
                                <div>
                                    <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#111827]">
                                        {shopName} Support
                                    </h3>
                                    <p className="text-[10px] sm:text-[11px] text-[#00B8D4] uppercase tracking-[0.15em] font-semibold">
                                        Feel the Quality
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="h-8 w-8 rounded-md hover:bg-[#00B8D4]/10 hover:text-[#00B8D4] text-[#111827] flex items-center justify-center transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-stretch px-2 sm:px-3 pt-2 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setTab('ai')}
                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 text-[12px] sm:text-[13px] font-medium border-b-2 rounded-t-md transition ${tab === 'ai'
                                            ? 'text-[#111827] border-[#00E5FF] bg-[#00E5FF]/10'
                                            : 'text-[#6B7280] border-transparent hover:text-[#111827] hover:bg-[#F3F6F9]'
                                        }`}
                                >
                                    <Bot className="w-3.5 h-3.5" />
                                    AI Assistant
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTab('whatsapp')}
                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 text-[12px] sm:text-[13px] font-medium border-b-2 rounded-t-md transition ${tab === 'whatsapp'
                                            ? 'text-[#111827] border-[#00B8D4] bg-[#00B8D4]/10'
                                            : 'text-[#6B7280] border-transparent hover:text-[#111827] hover:bg-[#F3F6F9]'
                                        }`}
                                >
                                    <WhatsAppIcon className="w-3.5 h-3.5" />
                                    WhatsApp
                                </button>
                            </div>
                        </div>

                        {tab === 'ai' && (
                            <>
                                <div
                                    ref={scrollRef}
                                    className="flex-1 overflow-y-auto bg-[#F3F6F9] p-3 sm:p-3 space-y-2"
                                >
                                    {messages.map((m) => (
                                        <div
                                            key={m.id}
                                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`flex flex-col gap-1.5 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'
                                                    }`}
                                            >
                                                <div
                                                    className={`px-3.5 py-2.5 text-[13px] whitespace-pre-wrap ${m.role === 'user'
                                                            ? 'bg-[#00E5FF] text-[#0B0D10] font-semibold rounded-md rounded-tr-none'
                                                            : 'bg-white text-[#111827] border border-slate-200 rounded-md rounded-tl-none'
                                                        }`}
                                                >
                                                    {m.content}
                                                </div>

                                                {m.products && m.products.length > 0 && (
                                                    <div className="w-full space-y-1.5">
                                                        {m.products.map((p) => (
                                                            <Link
                                                                key={p.id}
                                                                href={p.url}
                                                                className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2 py-1.5 hover:border-[#00B8D4] transition-colors"
                                                            >
                                                                {p.images[0] && (
                                                                    <img
                                                                        src={p.images[0]}
                                                                        alt={p.name}
                                                                        className="w-10 h-10 rounded object-cover border border-slate-200"
                                                                    />
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-[12px] font-medium text-[#111827] truncate">
                                                                        {p.name}
                                                                    </div>
                                                                    <div className="text-[11px] text-[#6B7280]">
                                                                        KES{' '}
                                                                        {Number(p.price).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <ArrowRight className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}

                                                {m.chips && m.chips.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {m.chips.map((chip) => (
                                                            <button
                                                                key={chip}
                                                                type="button"
                                                                onClick={() => sendMessage(chip)}
                                                                className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[#111827] hover:border-[#00E5FF] hover:text-[#0B0D10] hover:bg-[#00E5FF]/10 transition-colors"
                                                            >
                                                                {chip}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {sending && (
                                        <div className="flex justify-start">
                                            <div className="bg-white border border-slate-200 px-3 py-2 rounded-md rounded-tl-none flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#00B8D4] animate-bounce" />
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full bg-[#00B8D4] animate-bounce"
                                                    style={{ animationDelay: '150ms' }}
                                                />
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full bg-[#00B8D4] animate-bounce"
                                                    style={{ animationDelay: '300ms' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setTab('whatsapp')}
                                    className="shrink-0 w-full inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-[12px] text-[#6B7280] hover:text-[#00B8D4] font-medium border-t border-slate-200 bg-white py-2 transition-colors"
                                >
                                    <WhatsAppIcon className="w-3.5 h-3.5 text-[#00B8D4]" />
                                    Prefer a human? Switch to WhatsApp
                                </button>

                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        sendMessage(input);
                                    }}
                                    className="shrink-0 border-t border-slate-200 p-2 sm:p-3 bg-white"
                                >
                                    <div className="relative">
                                        <textarea
                                            ref={textareaRef}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ask about products, delivery… "
                                            rows={1}
                                            className="w-full border border-slate-300 rounded pl-3 pr-12 py-3 text-[13px] text-[#111827] placeholder:text-[#6B7280] bg-[#F3F6F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00B8D4]/60 focus:border-[#00B8D4] transition resize-none min-h-[60px] max-h-[200px] overflow-y-auto"
                                        />
                                        <button
                                            type="submit"
                                            disabled={sending || !input.trim()}
                                            className="absolute right-1.5 bottom-1.5 h-9 w-9 disabled:opacity-40 text-[#6B7280] hover:text-[#00B8D4] flex items-center justify-center transition-colors"
                                            aria-label="Send"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                        {tab === 'whatsapp' && (
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-[#F3F6F9]">
                                {waConfig?.displayNumber || waConfig?.phoneNumber ? (
                                    <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-full bg-[#00E5FF]/15 text-[#00B8D4] flex items-center justify-center shrink-0">
                                            <WhatsAppIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[13px] font-semibold text-[#111827]">
                                                {waConfig?.displayNumber || waConfig?.phoneNumber}
                                            </div>
                                            <div className="text-[11px] text-[#6B7280]">
                                                {waConfig?.hoursLabel || 'Reply within minutes'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[13px] text-[#6B7280] bg-white border border-slate-200 rounded p-3">
                                        WhatsApp is not configured yet.
                                    </div>
                                )}

                                {waConfig?.quickActions && waConfig.quickActions.length > 0 ? (
                                    <>
                                        <div className="text-[13px] uppercase text-[#6B7280] font-medium pt-1 px-1">
                                            Quick messages
                                        </div>
                                        <div className="space-y-1.5">
                                            {waConfig.quickActions.map((a) => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => openWhatsApp(a.message)}
                                                    className="w-full text-left bg-white border border-slate-200 rounded-md p-3 hover:border-[#00B8D4] hover:bg-[#00B8D4]/5 transition-colors flex items-center gap-2.5"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-[#00E5FF]/15 text-[#00B8D4] flex items-center justify-center shrink-0">
                                                        <WhatsAppIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[12px] font-semibold text-[#111827] truncate">
                                                            {a.label}
                                                        </div>
                                                        <div className="text-[11px] text-[#6B7280] line-clamp-2">
                                                            {a.message}
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-[#6B7280] shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => openWhatsApp()}
                                        className="w-full inline-flex items-center justify-center gap-2 bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] font-bold py-3 rounded text-[13px] transition"
                                    >
                                        <WhatsAppIcon className="w-4 h-4" />
                                        Start a WhatsApp chat
                                    </button>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setTab('ai')}
                                        className="w-full inline-flex items-center justify-center gap-1.5 text-[13px] sm:text-[13px] text-[#6B7280] hover:text-[#00B8D4] font-medium py-3 rounded hover:bg-white transition-colors"
                                    >
                                        <Bot className="w-3.5 h-3.5" />
                                        Or ask our AI assistant instead
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}