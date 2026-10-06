// components/newarrivals/NewArrivals.tsx
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

// ─────────────────────────────────────────────────────────────
// Helpers — identical to app/pages/new-arrivals/page.tsx so both
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

const NEW_ARRIVALS_LIMIT = 4;

export default function NewArrivals() {
    const [products, setProducts] = useState<CatalogNewArrival[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

    // ── Fetch the newest 4 from the same endpoint as the page ──
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
            .then(setProducts)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setError('Could not load new arrivals.');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    const handleAddToCart = useCallback(
        async (
            product: CatalogNewArrival,
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

    // ── Loading skeleton (keeps layout from jumping) ──────────
    if (loading && products.length === 0) {
        return (
            <section className="bg-blue-950 py-6 lg:py-8 border-b border-blue-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-2">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                New Arrivals
                            </h2>
                            <p className="text-xs sm:text-sm text-blue-100">
                                Explore the latest electronics added to our store.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {Array.from({ length: NEW_ARRIVALS_LIMIT }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded-sm overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[16/10] bg-slate-100" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // ── Error state ───────────────────────────────────────────
    if (error && products.length === 0) {
        return (
            <section className="bg-blue-950 py-12 border-b border-blue-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-xl font-bold text-white mb-1">New Arrivals</h2>
                    <p className="text-xs text-blue-100 mb-4">{error}</p>
                    <Link
                        href="/pages/new-arrivals"
                        className="inline-flex items-center space-x-1 text-xs font-medium text-white hover:text-blue-100 hover:underline"
                    >
                        <span>Browse All Products</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </section>
        );
    }

    // ── Empty state ───────────────────────────────────────────
    if (products.length === 0) {
        return (
            <section className="bg-blue-950 py-12 border-b border-blue-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-xl font-bold text-white mb-1">New Arrivals</h2>
                    <p className="text-xs text-blue-100 mb-4">
                        No new products are available right now.
                    </p>
                    <Link
                        href="/pages/new-arrivals"
                        className="inline-flex items-center space-x-1 text-xs font-medium text-white hover:text-blue-100 hover:underline"
                    >
                        <span>Browse All Products</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </section>
        );
    }

    // ── Grid ──────────────────────────────────────────────────
    return (
        <section className="bg-blue-950 py-6 lg:py-8 border-b border-blue-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-2">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                            New Arrivals
                        </h2>
                        <p className="text-xs sm:text-sm text-blue-100">
                            Explore the latest electronics added to our store.
                        </p>
                    </div>
                    <Link
                        href="/pages/new-arrivals"
                        className="text-xs font-semibold text-white hover:text-blue-100 hover:underline inline-flex items-center space-x-1 shrink-0"
                    >
                        <span>View All</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Product Grid - 4 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {products.map((product) => {
                        const isAdding = cartAddingId === product.id;
                        const price = toNum(product.price);
                        const comparePrice =
                            product.compareAtPrice !== null
                                ? toNum(product.compareAtPrice)
                                : null;

                        return (
                            <Link
                                key={product.id}
                                href={`/pages/new-arrivals?open=${product.id}`}
                                className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Image */}
                                    <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                        <img
                                            src={product.images[0] ?? '/placeholder.jpeg'}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        {/* 45° NEW ribbon */}
                                        <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none z-10">
                                            <div className="absolute transform -rotate-45 bg-blue-950 text-white font-bold text-[10px] tracking-widest py-1 left-[-40px] top-[18px] w-[140px] text-center shadow-xs">
                                                NEW
                                            </div>
                                        </div>

                                        {/* Wishlist heart — top right */}
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
                                            className="absolute top-2 right-2 z-10"
                                        />

                                        {/* Stock status — bottom left */}
                                        <span
                                            className={`absolute bottom-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${product.stockStatus === 'In Stock'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : product.stockStatus === 'Low Stock'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}
                                        >
                                            {product.stockStatus}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="p-3 pb-2">
                                        <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
                                            {product.brand}
                                        </p>

                                        <h3 className="text-xs font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mb-1">
                                            {product.name}
                                        </h3>

                                        {toNum(product.rating) > 0 && (
                                            <div className="flex items-center space-x-1 mb-1">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                                <span className="text-xs font-medium text-slate-800">
                                                    {toNum(product.rating).toFixed(1)}
                                                </span>
                                                <span className="text-[11px] text-slate-500">
                                                    ({product.reviewCount})
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Price + Button */}
                                <div className="p-4 pt-0 mt-auto">
                                    <div className="flex items-baseline space-x-2 mb-3">
                                        <span className="text-sm font-bold text-slate-900">
                                            {formatKES(price)}
                                        </span>
                                        {comparePrice !== null && (
                                            <span className="text-[11px] text-slate-500 line-through">
                                                {formatKES(comparePrice)}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => handleAddToCart(product, e)}
                                        disabled={
                                            isAdding ||
                                            product.stockStatus === 'Out of Stock'
                                        }
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded text-sm transition duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center space-x-1.5"
                                    >
                                        {isAdding ? (
                                            <span>Adding...</span>
                                        ) : product.stockStatus === 'Out of Stock' ? (
                                            <span>Sold Out</span>
                                        ) : (
                                            <>
                                                <ShoppingCart className="w-3.5 h-3.5" />
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