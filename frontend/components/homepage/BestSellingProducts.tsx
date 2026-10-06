// components/bestsellingproducts/BestSellingProducts.tsx
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

// ─────────────────────────────────────────────────────────────
// Helpers — identical to app/pages/best-selling/page.tsx so both
// views format prices and parse decimals the same way.
// ─────────────────────────────────────────────────────────────
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

export default function BestSellingProducts() {
    const [products, setProducts] = useState<CatalogBestSeller[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

    // ── Fetch top 8 from the same endpoint as the page ────────
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
            .then(setProducts)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setError('Could not load best sellers.');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    const handleAddToCart = useCallback(
        async (
            product: CatalogBestSeller,
            e: React.MouseEvent<HTMLButtonElement>,
        ): Promise<void> => {
            e.preventDefault();
            e.stopPropagation();
            if (product.stockStatus === 'Out of Stock') return;

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

    // ── Loading skeleton ──────────────────────────────────────
    if (loading && products.length === 0) {
        return (
            <section className="bg-slate-50 py-6 lg:py-8 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                Best Selling Products
                            </h2>
                            <p className="text-[13px] text-slate-600 mt-1">
                                Customer favorites loved for exceptional quality,
                                performance, and value.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {Array.from({ length: BEST_SELLERS_LIMIT }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded-sm overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[16/10] bg-slate-100" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                                    <div className="h-8 bg-slate-100 rounded mt-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // ── Error / empty states ──────────────────────────────────
    if (!loading && (error || products.length === 0)) {
        return (
            <section className="bg-slate-50 py-12 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-xl font-bold text-slate-900 mb-1">
                        Best Selling Products
                    </h2>
                    <p className="text-xs text-slate-600 mb-4">
                        {error ?? 'No best sellers are available right now.'}
                    </p>
                    <Link
                        href="/pages/best-selling"
                        className="inline-flex items-center space-x-1 text-xs font-medium text-blue-950 hover:underline"
                    >
                        <span>Browse Best Sellers</span>
                    </Link>
                </div>
            </section>
        );
    }

    // ── Grid ──────────────────────────────────────────────────
    return (
        <section className="bg-slate-50 py-6 lg:py-8 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Best Selling Products
                        </h2>
                        <p className="text-[13px] text-slate-600 mt-1">
                            Customer favorites loved for exceptional quality,
                            performance, and value.
                        </p>
                    </div>
                    <Link
                        href="/pages/best-selling"
                        className="text-[13px] font-medium text-blue-950 hover:underline mt-2 sm:mt-0 inline-flex items-center"
                    >
                        View all best sellers →
                    </Link>
                </div>

                {/* Product Grid - 4 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

                        return (
                            <Link
                                key={product.id}
                                href={`/pages/best-selling?open=${product.id}`}
                                className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Full-width flush image header */}
                                    <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                        <img
                                            src={product.images[0] ?? '/placeholder.jpeg'}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        {/* Left stack — Best Seller + stock badge */}
                                        <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5">
                                            <span className="bg-blue-950 text-white font-medium text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                Best Seller
                                            </span>
                                            {discountPercentage && (
                                                <span className="bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                    -{discountPercentage}%
                                                </span>
                                            )}
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${product.stockStatus === 'In Stock'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : product.stockStatus === 'Low Stock'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {product.stockStatus}
                                            </span>
                                        </div>

                                        {/* Wishlist heart — top right */}
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
                                            className="absolute top-2 right-2 z-10"
                                        />
                                    </div>

                                    {/* Content Info */}
                                    <div className="p-3 pb-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-medium text-slate-500 uppercase">
                                                {product.brand}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {product.category}
                                            </p>
                                        </div>

                                        <h3 className="text-[13px] font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mt-1 mb-1">
                                            {product.name}
                                        </h3>

                                        {toNum(product.rating) > 0 && (
                                            <div className="flex items-center space-x-1 mb-2">
                                                <div className="flex items-center text-amber-500">
                                                    <Star className="w-3.5 h-3.5 fill-current" />
                                                </div>
                                                <span className="text-[12px] font-medium text-slate-800">
                                                    {toNum(product.rating).toFixed(1)}
                                                </span>
                                                <span className="text-[11px] text-slate-500">
                                                    ({product.reviewCount})
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Price & Add to Cart Action */}
                                <div className="p-4 pt-0 mt-auto">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-baseline space-x-2">
                                            <span className="text-base font-bold text-slate-900">
                                                {formatKES(price)}
                                            </span>
                                            {previousPrice !== null && (
                                                <span className="text-[11px] text-slate-500 line-through">
                                                    {formatKES(previousPrice)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <button
                                        type="button"
                                        onClick={(e) => handleAddToCart(product, e)}
                                        disabled={
                                            isAdding ||
                                            product.stockStatus === 'Out of Stock'
                                        }
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded text-[13px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                                    >
                                        {isAdding ? (
                                            <>
                                                <svg
                                                    className="animate-spin h-4 w-4 text-white"
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
                                                <span>Adding...</span>
                                            </>
                                        ) : product.stockStatus === 'Out of Stock' ? (
                                            <span>Sold Out</span>
                                        ) : (
                                            <>
                                                <ShoppingCart className="w-4 h-4" />
                                                <span>Add to Cart</span>
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