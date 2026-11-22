'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
    catalogApi,
    type CatalogNewArrival,
    type NewArrivalsQuery,
} from '@/lib/api';

const toNum = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' ? v : Number(v);
};

function formatKES(amount: number): string {
    return `KES ${amount.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;
}

const NEW_ARRIVALS_LIMIT = 4;

type StockKind = 'in' | 'low' | 'out' | 'unknown';

function normalizeStock(raw: string | undefined): StockKind {
    const s = (raw || '').toLowerCase().replace(/[_\s-]/g, '');
    if (s === 'instock' || s === 'in') return 'in';
    if (s === 'lowstock' || s === 'low') return 'low';
    if (s === 'outofstock' || s === 'out' || s === 'soldout') return 'out';
    return 'unknown';
}

const STOCK_STYLES: Record<StockKind, { bg: string; label: string }> = {
    in: { bg: 'bg-blue-950 text-white', label: 'In Stock' },
    low: { bg: 'bg-blue-900 text-white', label: 'Low Stock' },
    out: { bg: 'bg-slate-400 text-white', label: 'Out of Stock' },
    unknown: { bg: 'bg-slate-300 text-slate-700', label: 'Unknown' },
};

export default function NewArrivals() {
    const [products, setProducts] = useState<CatalogNewArrival[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);

        const query: NewArrivalsQuery = {
            sort_by: 'newest',
            limit: NEW_ARRIVALS_LIMIT,
        };

        catalogApi.newArrivals
            .list(query, ctrl.signal)
            .then((data) => {
                if (ctrl.signal.aborted) return;
                setProducts(data);
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setError('Could not load new arrivals.');
            })
            .finally(() => {
                if (ctrl.signal.aborted) return;
                setLoading(false);
                setHasLoadedOnce(true);
            });

        return () => ctrl.abort();
    }, []);

    const handleAddToCart = useCallback(
        async (
            product: CatalogNewArrival,
            e: React.MouseEvent<HTMLButtonElement>,
        ): Promise<void> => {
            e.preventDefault();
            e.stopPropagation();

            if (normalizeStock(product.stockStatus) === 'out') return;

            setCartAddingId(product.id);
            try {
                await addItem({
                    variantId: product.id,
                    productId: product.id,
                    name: product.name,
                    brand: product.brand,
                    image: product.images[0] ?? '',
                    unitPrice: toNum(product.price),
                    compareAtPrice:
                        product.compareAtPrice !== null
                            ? toNum(product.compareAtPrice)
                            : undefined,
                    slug: product.id,
                    stockCount: product.stockQuantity,
                    stock: product.stockStatus,
                });
            } finally {
                setCartAddingId(null);
            }
        },
        [addItem],
    );

    if (loading && products.length === 0) {
        return (
            <section className="bg-blue-950 py-4 xs:py-5 sm:py-6 lg:py-6 border-b border-blue-900">
                <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-5 lg:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-2 gap-1.5 sm:gap-2">
                        <div className="min-w-0">
                            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-white">
                                New Arrivals
                            </h2>
                            <p className="text-[11px] xs:text-[12px] sm:text-sm text-slate-300">
                                Explore the latest electronics added to our store.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
                        {Array.from({ length: NEW_ARRIVALS_LIMIT }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[20/16] bg-slate-100" />
                                <div className="p-2 xs:p-3 space-y-1.5 xs:space-y-2">
                                    <div className="h-2.5 xs:h-3 bg-slate-100 rounded w-1/2" />
                                    <div className="h-3 xs:h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-2.5 xs:h-3 bg-slate-100 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (hasLoadedOnce && error && products.length === 0) {
        return (
            <section className="bg-blue-950 py-10 xs:py-12 border-b border-blue-900">
                <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-base xs:text-lg sm:text-xl font-bold text-white mb-1">
                        New Arrivals
                    </h2>
                    <p className="text-[11px] xs:text-[12px] sm:text-xs text-slate-300 mb-3">
                        {error}
                    </p>
                    <Link
                        href="/pages/new-arrivals"
                        className="inline-flex items-center space-x-1 text-[12px] xs:text-[13px] sm:text-sm font-medium text-white hover:text-slate-300 hover:underline transition-colors"
                    >
                        <span>Browse All Products</span>
                        <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                    </Link>
                </div>
            </section>
        );
    }

    if (hasLoadedOnce && products.length === 0) {
        return (
            <section className="bg-blue-950 py-10 xs:py-12 border-b border-blue-900">
                <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-base xs:text-lg sm:text-xl font-bold text-white mb-1">
                        New Arrivals
                    </h2>
                    <p className="text-[12px] xs:text-[13px] sm:text-sm text-slate-300 mb-2">
                        No new products are available right now.
                    </p>
                    <Link
                        href="/pages/new-arrivals"
                        className="inline-flex items-center space-x-1 text-[12px] xs:text-[13px] sm:text-sm font-medium text-white hover:text-slate-300 hover:underline transition-colors"
                    >
                        <span>Browse All Products</span>
                        <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-blue-950 py-4 xs:py-5 sm:py-6 lg:py-6 border-b border-blue-900">
            <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-5 lg:px-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 xs:mb-4 sm:mb-5 gap-1.5 sm:gap-2">
                    <div className="min-w-0">
                        <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-white">
                            New <span className="text-slate-300">Arrivals</span>
                        </h2>
                        <p className="text-[11px] xs:text-[12px] sm:text-xs md:text-sm text-slate-300">
                            Explore the latest electronics added to our store.
                        </p>
                    </div>
                    <Link
                        href="/pages/products/newarrivals"
                        className="text-[11px] xs:text-[12px] sm:text-sm font-semibold text-white hover:text-slate-300 hover:underline inline-flex items-center space-x-1 shrink-0 self-start sm:self-auto transition-colors"
                    >
                        <span>View All</span>
                        <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                    </Link>
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
                    {products.map((product) => {
                        const isAdding = cartAddingId === product.id;
                        const price = toNum(product.price);
                        const comparePrice =
                            product.compareAtPrice !== null
                                ? toNum(product.compareAtPrice)
                                : null;

                        const stockKind = normalizeStock(product.stockStatus);
                        const stock = STOCK_STYLES[stockKind];
                        const isOutOfStock = stockKind === 'out';

                        return (
                            <Link
                                key={product.id}
                                href={`/pages/new-arrivals?open=${product.id}`}
                                className="group bg-white border border-slate-200 rounded overflow-hidden hover:border-blue-950 hover:shadow-lg transition-all duration-150 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="aspect-[20/16] w-full bg-slate-50 overflow-hidden relative">
                                        <img
                                            src={product.images[0] ?? '/placeholder.jpeg'}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        <div className="absolute top-0 left-0 w-20 h-20 xs:w-24 xs:h-24 overflow-hidden pointer-events-none z-10">
                                            <div className="absolute transform -rotate-45 bg-gradient-to-br from-blue-950 via-blue-950 to-blue-900 text-white font-extrabold text-[10px] xs:text-[11px] sm:text-[13px] py-1 left-[-42px] top-[14px] xs:top-[18px] w-[150px] text-center shadow-sm">
                                                NEW
                                            </div>
                                        </div>

                                        <WishlistButton
                                            variantId={product.id}
                                            productId={product.id}
                                            name={product.name}
                                            brand={product.brand}
                                            image={product.images[0] ?? ''}
                                            unitPrice={price}
                                            compareAtPrice={comparePrice ?? undefined}
                                            slug={product.id}
                                            stockCount={product.stockQuantity}
                                            stock={product.stockStatus}
                                            size="sm"
                                            className="absolute top-1 xs:top-1.5 sm:top-2 right-1 xs:right-1.5 sm:right-2 z-10"
                                        />

                                        <span
                                            className={`absolute bottom-1 xs:bottom-1.5 sm:bottom-2 left-1 xs:left-1.5 sm:left-2 z-10 text-[9px] xs:text-[10px] sm:text-[12px] font-semibold px-1 xs:px-1.5 sm:px-2 py-0.5 rounded shadow-sm ${stock.bg}`}
                                        >
                                            {stock.label}
                                        </span>
                                    </div>

                                    <div className="p-1.5 xs:p-2 pb-1.5 xs:pb-2">
                                        <p className="text-[10px] xs:text-[11px] sm:text-[12px] font-semibold text-slate-500 uppercase mb-0.5 xs:mb-1 truncate">
                                            {product.brand}
                                        </p>

                                        <h3 className="text-[11px] xs:text-[12px] sm:text-sm font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mb-0.5 xs:mb-1">
                                            {product.name}
                                        </h3>

                                        {toNum(product.rating) > 0 && (
                                            <div className="flex items-center space-x-1 mb-0.5 xs:mb-1">
                                                <Star className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 fill-blue-950 text-blue-950 shrink-0" />
                                                <span className="text-[10px] xs:text-[11px] sm:text-xs font-medium text-slate-900">
                                                    {toNum(product.rating).toFixed(1)}
                                                </span>
                                                <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-slate-500 truncate">
                                                    ({product.reviewCount})
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-1.5 xs:p-2 sm:p-3 pt-0 mt-auto">
                                    <div className="flex items-baseline flex-wrap gap-x-1 xs:gap-x-1.5 sm:gap-x-2 gap-y-0.5 mb-1.5 xs:mb-2 sm:mb-3 min-w-0">
                                        <span className="text-[11px] xs:text-[12px] sm:text-sm font-bold text-slate-900 whitespace-nowrap">
                                            {formatKES(price)}
                                        </span>
                                        {comparePrice !== null && (
                                            <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-slate-500 line-through whitespace-nowrap">
                                                {formatKES(comparePrice)}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => handleAddToCart(product, e)}
                                        disabled={isAdding || isOutOfStock}
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-bold py-1.5 xs:py-2 px-1.5 xs:px-2 sm:px-3 rounded text-[10px] xs:text-[11px] sm:text-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 xs:space-x-1.5"
                                    >
                                        {isAdding ? (
                                            <span className="truncate">Adding...</span>
                                        ) : isOutOfStock ? (
                                            <span className="truncate">Sold Out</span>
                                        ) : (
                                            <>
                                                <ShoppingCart className="w-3 h-3 xs:w-3.5 xs:h-3.5 shrink-0" />
                                                <span className="truncate">Add to Cart</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}