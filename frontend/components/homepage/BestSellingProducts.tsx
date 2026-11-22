'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
    catalogApi,
    type CatalogBestSeller,
    type BestSellingQuery,
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

const BEST_SELLERS_LIMIT = 8;

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

export default function BestSellingProducts() {
    const [products, setProducts] = useState<CatalogBestSeller[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);

        const query: BestSellingQuery = {
            sort_by: 'best-selling',
            limit: BEST_SELLERS_LIMIT,
        };

        catalogApi.bestSelling
            .list(query, ctrl.signal)
            .then((data) => {
                if (ctrl.signal.aborted) return;
                setProducts(data);
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setError('Could not load best sellers.');
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
            product: CatalogBestSeller,
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
                        product.previousPrice !== null
                            ? toNum(product.previousPrice)
                            : undefined,
                    slug: product.id,
                    stockCount: 10,
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
            <section className="bg-white py-4 xs:py-5 sm:py-6 lg:py-8 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-5 lg:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 xs:mb-3 gap-1.5 sm:gap-0">
                        <div className="min-w-0">
                            <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
                                Best Selling <span className="text-blue-950">Products</span>
                            </h2>
                            <p className="text-[11px] xs:text-[12px] sm:text-[13px] text-slate-500 mt-1">
                                Customer favorites loved for exceptional quality,
                                performance, and value.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-2 sm:gap-2">
                        {Array.from({ length: BEST_SELLERS_LIMIT }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[20/16] bg-slate-100" />
                                <div className="p-2 xs:p-3 space-y-1.5 xs:space-y-2">
                                    <div className="h-2.5 xs:h-3 bg-slate-100 rounded w-1/3" />
                                    <div className="h-3 xs:h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-2.5 xs:h-3 bg-slate-100 rounded w-1/2" />
                                    <div className="h-7 xs:h-8 bg-slate-100 rounded mt-2 xs:mt-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (!loading && hasLoadedOnce && (error || products.length === 0)) {
        return (
            <section className="bg-white py-10 xs:py-12 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-base xs:text-lg sm:text-xl font-bold text-slate-900 mb-0.5">
                        Best Selling <span className="text-blue-950">Products</span>
                    </h2>
                    <p className="text-[11px] xs:text-[12px] sm:text-xs text-slate-500 mb-3">
                        {error ?? 'No best sellers are available right now.'}
                    </p>
                    <Link
                        href="/pages/bestsellingproducts"
                        className="inline-flex items-center space-x-1 text-[12px] xs:text-[13px] sm:text-sm font-medium text-slate-900 hover:text-blue-950 hover:underline transition-colors"
                    >
                        <span>Browse Best Sellers</span>
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-white py-4 xs:py-5 sm:py-6 lg:py-6 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-5 lg:px-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 gap-1.5 sm:gap-0">
                    <div className="min-w-0">
                        <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
                            Best Selling <span className="text-blue-950">Products</span>
                        </h2>
                        <p className="text-[11px] xs:text-[12px] sm:text-[13px] text-slate-500 mt-1">
                            Customer favorites loved for exceptional quality,
                            performance, and value.
                        </p>
                    </div>
                    <Link
                        href="/pages/best-selling"
                        className="text-[11px] xs:text-[12px] sm:text-[13px] font-medium text-slate-900 hover:text-blue-950 hover:underline mt-1 sm:mt-0 inline-flex items-center shrink-0 self-start sm:self-auto transition-colors"
                    >
                        View all best sellers →
                    </Link>
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
                    {products.map((product) => {
                        const isAdding = cartAddingId === product.id;
                        const price = toNum(product.price);
                        const previousPrice =
                            product.previousPrice !== null
                                ? toNum(product.previousPrice)
                                : null;

                        const discountPercentage =
                            previousPrice && previousPrice > price
                                ? Math.round(
                                    ((previousPrice - price) / previousPrice) * 100,
                                )
                                : null;

                        const stockKind = normalizeStock(product.stockStatus);
                        const stock = STOCK_STYLES[stockKind];
                        const isOutOfStock = stockKind === 'out';

                        return (
                            <Link
                                key={product.id}
                                href={`/pages/bestsellingproducts?open=${product.id}`}
                                className="group bg-white border border-slate-200 rounded overflow-hidden hover:border-blue-950 hover:shadow-lg transition-all duration-150 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="aspect-[20/16] w-full bg-slate-50 overflow-hidden relative">
                                        <img
                                            src={product.images[0] ?? '/placeholder.jpeg'}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        <div className="absolute top-1 xs:top-1.5 sm:top-2 left-1 xs:left-1.5 sm:left-2 z-10 flex flex-col items-start gap-0.5">
                                            <span className="bg-blue-950 text-white font-bold text-[10px] xs:text-[10px] sm:text-[12px] px-1 xs:px-1.5 sm:px-2 py-0.5 rounded">
                                                Best Seller
                                            </span>
                                            {discountPercentage && (
                                                <span className="bg-blue-950 text-white font-bold text-[9px] xs:text-[10px] sm:text-[12px] px-1 xs:px-1.5 sm:px-2 py-0.5 rounded shadow">
                                                    -{discountPercentage}%
                                                </span>
                                            )}
                                            <span
                                                className={`text-[9px] xs:text-[10px] sm:text-[12px] font-semibold px-1 xs:px-1.5 sm:px-2 py-0.5 rounded ${stock.bg}`}
                                            >
                                                {stock.label}
                                            </span>
                                        </div>

                                        <WishlistButton
                                            variantId={product.id}
                                            productId={product.id}
                                            name={product.name}
                                            brand={product.brand}
                                            image={product.images[0] ?? ''}
                                            unitPrice={price}
                                            compareAtPrice={previousPrice ?? undefined}
                                            slug={product.id}
                                            stockCount={10}
                                            stock={product.stockStatus}
                                            size="sm"
                                            className="absolute top-1 xs:top-1.5 sm:top-2 right-1 xs:right-1.5 sm:right-2 z-10"
                                        />
                                    </div>

                                    <div className="p-1.5 xs:p-2 sm:p-3 pb-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="text-[10px] xs:text-[11px] sm:text-[12px] font-medium text-slate-500 uppercase truncate">
                                                {product.brand}
                                            </p>
                                            <p className="text-[10px] xs:text-[11px] sm:text-[12px] text-slate-500 truncate shrink-0">
                                                {product.category}
                                            </p>
                                        </div>

                                        <h3 className="text-[11px] xs:text-[12px] sm:text-[13px] font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mt-0.5 mb-1">
                                            {product.name}
                                        </h3>

                                        {toNum(product.rating) > 0 && (
                                            <div className="flex items-center space-x-1 mb-1.5 xs:mb-2">
                                                <div className="flex items-center text-blue-950">
                                                    <Star className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                                                </div>
                                                <span className="text-[10px] xs:text-[11px] sm:text-[12px] font-medium text-slate-900">
                                                    {toNum(product.rating).toFixed(1)}
                                                </span>
                                                <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-slate-500 truncate">
                                                    ({product.reviewCount})
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-1.5 xs:p-2 pt-0 mt-auto">
                                    <div className="flex items-center justify-between mb-1.5 xs:mb-2 gap-1">
                                        <div className="flex items-baseline flex-wrap gap-x-1 xs:gap-x-1.5 sm:gap-x-2 gap-y-0.5 min-w-0">
                                            <span className="text-[11px] xs:text-[12px] sm:text-sm md:text-base font-bold text-slate-900 whitespace-nowrap">
                                                {formatKES(price)}
                                            </span>
                                            {previousPrice !== null && (
                                                <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-slate-500 line-through whitespace-nowrap">
                                                    {formatKES(previousPrice)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => handleAddToCart(product, e)}
                                        disabled={isAdding || isOutOfStock}
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-bold py-1.5 xs:py-2 px-2 xs:px-3 rounded text-[11px] xs:text-[12px] sm:text-[13px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 xs:space-x-1.5"
                                    >
                                        {isAdding ? (
                                            <>
                                                <svg
                                                    className="animate-spin h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 text-white shrink-0"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    />
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    />
                                                </svg>
                                                <span className="truncate">Adding...</span>
                                            </>
                                        ) : isOutOfStock ? (
                                            <span className="truncate">Sold Out</span>
                                        ) : (
                                            <>
                                                <ShoppingCart className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 shrink-0" />
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