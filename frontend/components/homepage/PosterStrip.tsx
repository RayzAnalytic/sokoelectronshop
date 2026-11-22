'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface Poster {
    id: number;
    placement: string;
    order: number;
    headline: string;
    subheadline: string;
    desktop_image: string;
    mobile_image: string;
    cta_text: string;
    cta_href: string;
    brand_name: string;
    sponsor_label: string;
    status: 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'EXPIRED';
    start_at: string | null;
    end_at: string | null;
}

interface Props {
    posters?: Poster[];
    className?: string;
}

const MAX_POSTERS = 6;
const MARQUEE_THRESHOLD = 4;
const PLACEMENT = 'HOME_AFTER_BESTSELLING';

const API_ORIGIN =
    (typeof process !== 'undefined' &&
        process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')) ||
    'http://localhost:8000';

function resolveUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/media/')) return `${API_ORIGIN}${url}`;
    if (url.startsWith('/')) return url;
    return `${API_ORIGIN}/${url}`;
}

function isLive(poster: Poster, now: number): boolean {
    if (poster.status !== 'ACTIVE') return false;
    if (poster.start_at && new Date(poster.start_at).getTime() > now) return false;
    if (poster.end_at && new Date(poster.end_at).getTime() <= now) return false;
    return true;
}

function gradientFor(seed: string): string {
    const gradients = [
        'from-blue-950 via-slate-900 to-blue-950',
        'from-slate-900 via-blue-950 to-blue-900/40',
        'from-blue-950 via-blue-900/30 to-slate-900',
        'from-slate-900 via-blue-950 to-blue-800/30',
        'from-blue-950 via-slate-900 to-blue-900/50',
    ];

    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return gradients[hash % gradients.length];
}

export default function PosterStrip({
    posters: initialPosters,
    className = '',
}: Props) {
    const [now, setNow] = useState<number | null>(null);
    const [loaded, setLoaded] = useState<Poster[] | null>(null);

    useEffect(() => {
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (initialPosters) {
            setLoaded(initialPosters);
            return;
        }

        let cancelled = false;

        async function loadPosters() {
            try {
                const response = await fetch(
                    `${API_ORIGIN}/api/v1/posters/?placement=${PLACEMENT}`,
                    { credentials: 'include' },
                );

                if (!response.ok) throw new Error(`Poster request failed: ${response.status}`);

                const data = await response.json();
                if (cancelled) return;

                const rows: Poster[] = Array.isArray(data)
                    ? data
                    : (data.results ?? []);

                setLoaded(rows);
            } catch {
                if (!cancelled) setLoaded([]);
            }
        }

        loadPosters();

        return () => {
            cancelled = true;
        };
    }, [initialPosters]);

    const visible = useMemo(() => {
        const sorted = [...(loaded ?? [])].sort((a, b) => a.order - b.order);
        if (now === null) return sorted.slice(0, MAX_POSTERS);
        return sorted.filter((poster) => isLive(poster, now)).slice(0, MAX_POSTERS);
    }, [loaded, now]);

    if (!visible.length) return null;

    const isLooping = visible.length >= MARQUEE_THRESHOLD;
    const loopPosters = isLooping ? [...visible, ...visible] : visible;

    return (
        <section
            aria-label="Promotions and featured collections"
            className={`poster-section relative overflow-hidden bg-white py-9 sm:py-12 ${className}`}
        >
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-blue-950/10 blur-3xl" />
                <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-slate-400/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-[1440px]">
                <div className="poster-marquee group" role="region" aria-label="Promotional posters">
                    <div
                        className={`poster-track ${isLooping ? 'is-looping' : 'is-static'}`}
                        style={
                            isLooping
                                ? { animationDuration: `${Math.max(30, visible.length * 13)}s` }
                                : undefined
                        }
                    >
                        {loopPosters.map((poster, index) => (
                            <PosterCard
                                key={`${poster.id}-${index}`}
                                poster={poster}
                                isClone={isLooping && index >= visible.length}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .poster-marquee {
                    width: 100%;
                    overflow: hidden;
                    padding: 8px 0 18px;
                    -webkit-mask-image: linear-gradient(
                        to right,
                        transparent,
                        #000 3%,
                        #000 97%,
                        transparent
                    );
                    mask-image: linear-gradient(
                        to right,
                        transparent,
                        #000 3%,
                        #000 97%,
                        transparent
                    );
                }

                .poster-track {
                    display: flex;
                    width: max-content;
                    gap: 20px;
                    padding-left: 20px;
                    will-change: transform;
                }

                .poster-track.is-looping {
                    animation-name: poster-scroll-left;
                    animation-timing-function: linear;
                    animation-iteration-count: infinite;
                }

                .poster-track.is-static {
                    width: 100%;
                    max-width: 100%;
                    justify-content: center;
                    padding-left: 0;
                    padding-right: 0;
                    overflow-x: auto;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }

                .poster-track.is-static::-webkit-scrollbar {
                    display: none;
                }

                .poster-marquee:hover .poster-track.is-looping,
                .poster-marquee:focus-within .poster-track.is-looping {
                    animation-play-state: paused;
                }

                @keyframes poster-scroll-left {
                    from {
                        transform: translateX(0);
                    }
                    to {
                        transform: translateX(-50%);
                    }
                }

                @media (max-width: 640px) {
                    .poster-track {
                        gap: 12px;
                        padding-left: 12px;
                    }

                    .poster-track.is-static {
                        padding-left: 0;
                        padding-right: 0;
                        justify-content: flex-start;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .poster-track.is-looping {
                        animation: none;
                    }
                }
            `}</style>
        </section>
    );
}

function PosterCard({
    poster,
    isClone = false,
}: {
    poster: Poster;
    isClone?: boolean;
}) {
    const [imgError, setImgError] = useState(false);
    const cardRef = useRef<HTMLDivElement | null>(null);
    const impressionSent = useRef(false);

    const desktopSrc = resolveUrl(poster.desktop_image);
    const mobileSrc = resolveUrl(poster.mobile_image);

    const hasImage = Boolean(desktopSrc) && !imgError;
    const gradient = gradientFor(poster.headline || 'poster');

    useEffect(() => {
        if (isClone) return;
        if (impressionSent.current || poster.id < 0) return;

        const element = cardRef.current;
        if (!element || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !impressionSent.current) {
                        impressionSent.current = true;
                        fetch(
                            `${API_ORIGIN}/api/v1/posters/${poster.id}/track/impression/`,
                            { method: 'POST', credentials: 'include' },
                        ).catch(() => undefined);
                    }
                });
            },
            { threshold: 0.5 },
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [poster.id, isClone]);

    const trackClick = () => {
        if (poster.id < 0) return;

        fetch(`${API_ORIGIN}/api/v1/posters/${poster.id}/track/click/`, {
            method: 'POST',
            credentials: 'include',
        }).catch(() => undefined);
    };

    return (
        <article ref={cardRef} className="w-[min(82vw,440px)] shrink-0 sm:w-[420px] lg:w-[460px]">
            <Link
                href={poster.cta_href || '#'}
                onClick={trackClick}
                aria-label={`${poster.headline}. ${poster.cta_text || 'Explore offer'}`}
                className="poster-card group relative block aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-blue-950 shadow-[0_14px_40px_rgba(11,13,16,0.16)] outline-none transition duration-300 hover:-translate-y-1 hover:border-blue-950 hover:shadow-[0_22px_55px_rgba(23,37,84,0.25)] focus-visible:ring-2 focus-visible:ring-slate-400/50"
            >
                {hasImage ? (
                    <picture>
                        {mobileSrc && (
                            <source
                                media="(max-width: 640px)"
                                srcSet={mobileSrc}
                            />
                        )}
                        <img
                            src={desktopSrc}
                            alt=""
                            loading="lazy"
                            onError={() => setImgError(true)}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                        />
                    </picture>
                ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-blue-950/95 via-slate-900/55 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/65 via-transparent to-transparent" />

                <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/25 transition-transform duration-700 group-hover:scale-125" />
                <div className="absolute -right-8 -top-16 h-48 w-48 rounded-full border border-slate-400/20" />

                <div className="relative flex h-full max-w-[78%] flex-col items-start justify-end p-4 text-white sm:p-5">
                    {poster.sponsor_label && (
                        <span className="mb-3 inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[9px] font-bold uppercase text-white backdrop-blur-md sm:text-[10px]">
                            {poster.sponsor_label}
                        </span>
                    )}

                    {poster.brand_name && (
                        <span className="mb-1 text-[10px] font-bold uppercase text-slate-300 sm:text-xs">
                            {poster.brand_name}
                        </span>
                    )}

                    <h3 className="text-xl font-extrabold text-white drop-shadow sm:text-2xl lg:text-[28px]">
                        {poster.headline}
                    </h3>

                    {poster.subheadline && (
                        <p className="mt-2 line-clamp-2 max-w-[340px] text-xs text-slate-300 sm:text-sm">
                            {poster.subheadline}
                        </p>
                    )}

                    {poster.cta_text && (
                        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-blue-950 transition-all duration-200 group-hover:gap-3 group-hover:bg-slate-200 sm:text-sm">
                            {poster.cta_text}
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </div>

                <span className="pointer-events-none absolute bottom-5 right-5 hidden h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-blue-950/50 text-white backdrop-blur-md transition-all duration-300 group-hover:translate-x-1 group-hover:border-white group-hover:bg-white group-hover:text-blue-950 sm:flex">
                    <ArrowRight className="h-5 w-5" />
                </span>
            </Link>
        </article>
    );
}
