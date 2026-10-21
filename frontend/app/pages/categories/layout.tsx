'use client';

import React, { Suspense, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Sidebar from '@/components/categories/Sidebar';
import Header from '@/components/homepage/Navbar';
import Footer from '@/components/homepage/Footer';

import WhatsAppButton from '@/components/homepage/WhatsAppButton';
import AIAssistantButton from '@/components/homepage/AIAssistantButton';

import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface CategoriesLayoutProps {
    children: React.ReactNode;
}

export default function CategoriesLayout({ children }: CategoriesLayoutProps) {
    return (
        <Suspense fallback={null}>
            <CategoriesLayoutInner>{children}</CategoriesLayoutInner>
        </Suspense>
    );
}

const SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_VALUES: Record<string, string[]> = {
    q: [''],
    stock: ['all'],
    sort: ['featured'],
};

function CategoriesLayoutInner({ children }: CategoriesLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const urlSearch = searchParams.get('q') ?? '';
    const stockFilter = searchParams.get('stock') ?? 'all';
    const sortBy = searchParams.get('sort') ?? 'featured';

    const [searchInput, setSearchInput] = useState(urlSearch);

    useEffect(() => {
        setSearchInput(urlSearch);
    }, [urlSearch]);

    const setParam = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        const defaults = DEFAULT_VALUES[key] ?? [];

        if (value === null || defaults.includes(value)) {
            params.delete(key);
        } else {
            params.set(key, value);
        }

        params.delete('page');

        const qs = params.toString();
        startTransition(() => {
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        });
    };

    useEffect(() => {
        if (searchInput === urlSearch) return;

        const t = setTimeout(() => {
            setParam('q', searchInput.trim() || null);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput, urlSearch]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };

    return (
        <div className="min-h-screen flex flex-col bg-white">
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
                <Header />
            </div>

            <main className="flex-1 max-w-7xl w-full mx-auto pr-3 sm:pr-3 py-4 lg:py-4">
                <a
                    href="#grid"
                    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-white focus:text-slate-900 focus:shadow-md focus:rounded-sm border border-slate-200"
                >
                    Skip to products
                </a>

                <div className="flex flex-col lg:flex-row gap-4 items-start relative">
                    <nav
                        aria-label="Categories"
                        className="
                            w-full lg:w-[250px] shrink-0
                            lg:sticky lg:top-[105px]
                            lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto
                            scrollbar-thin scrollbar-thumb-slate-700
                            z-20
                        "
                    >
                        <Sidebar />
                    </nav>

                    <div className="w-full flex-1 min-w-0 flex flex-col gap-2">
                        <div className="sticky top-[100px] z-30 bg-white/95 backdrop-blur-md pb-2 pt-1 -mx-1 px-1">
                            <div className="bg-white p-1.5 rounded-sm border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={handleSearchChange}
                                        placeholder="Search Categories..."
                                        className="w-full rounded-sm border border-slate-200 bg-white pl-9 pr-3 py-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                                    />
                                    {isPending && (
                                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 animate-pulse">
                                            Filtering...
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-3 rounded-sm border border-slate-200 text-xs text-slate-700">
                                        <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                                        <select
                                            aria-label="Filter by stock status"
                                            value={stockFilter}
                                            onChange={(e) => setParam('stock', e.target.value)}
                                            className="bg-transparent text-xs text-slate-900 focus:outline-none cursor-pointer"
                                        >
                                            <option value="all">All Stock</option>
                                            <option value="in-stock">In Stock Only</option>
                                            <option value="low-stock">Low Stock</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-3 rounded-sm border border-slate-200 text-xs text-slate-700">
                                        <ArrowUpDown className="h-3 w-3 text-slate-500" />
                                        <select
                                            aria-label="Sort products"
                                            value={sortBy}
                                            onChange={(e) => setParam('sort', e.target.value)}
                                            className="bg-transparent text-xs text-slate-900 focus:outline-none cursor-pointer"
                                        >
                                            <option value="featured">Featured</option>
                                            <option value="price-low">Price: Low to High</option>
                                            <option value="price-high">Price: High to Low</option>
                                            <option value="newest">Newest Arrivals</option>
                                            <option value="rating">Highest Rated</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <section
                            id="grid"
                            aria-labelledby="page-title"
                            aria-live="polite"
                            className="w-full min-w-0"
                        >
                            {children}
                        </section>
                    </div>
                </div>
            </main>

            <Footer />

            <AIAssistantButton shopName="MyShop" />
            <WhatsAppButton />
        </div>
    );
}