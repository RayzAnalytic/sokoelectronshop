// components/featuredproducts/FeaturedProducts.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
    catalogApi,
    type CatalogProduct,
    type ProductsQuery,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Helpers — identical to the ones in app/pages/products/page.tsx
// so both pages format prices and parse decimals the same way.
// ─────────────────────────────────────────────────────────────
const toNum = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' ? v : Number(v);
};

function formatKES(amount: number): string {
    return `KES ${amount.toLocaleString('en-KE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

const FEATURED_LIMIT = 8;

export default function FeaturedProducts() {
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

    // ── Fetch featured products from the same API as /pages/products ──
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);

        const query: ProductsQuery = {
            sort_by: 'featured',
            page: 1,
            page_size: FEATURED_LIMIT,
        };

        catalogApi.products
            .list(query, ctrl.signal)
            .then((page) => setProducts(page.results))
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setError('Failed to load featured products.');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, []);

    const handleAddToCart = useCallback(
        async (
            product: CatalogProduct,
            e: React.MouseEvent<HTMLButtonElement>,
        ): Promise<void> => {
            e.preventDefault();
            e.stopPropagation();
            if (product.stock === 'Out of Stock') return;

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
                    slug: product.slug,
                    stockCount: product.stockQuantity,
                    stock: product.stock,
                });
            } finally {
                setCartAddingId(null);
            }
        },
        [addItem],
    );

    return (
        <section className="bg-white py-6 lg:py-8 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Featured Electronics
                        </h2>
                        <p className="text-[13px] text-slate-600 mt-1">
                            Top-rated hardware and audio essentials handpicked for
                            performance and reliability.
                        </p>
                    </div>
                    <Link
                        href="/pages/products"
                        className="text-[13px] font-medium text-blue-950 hover:underline mt-2 sm:mt-0 inline-flex items-center"
                    >
                        View all products →
                    </Link>
                </div>

                {/* Error state */}
                {error && !loading && (
                    <div className="text-center py-10 bg-red-50 border border-red-200 rounded-sm">
                        <p className="text-[13px] text-red-700">{error}</p>
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && products.length === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: FEATURED_LIMIT }).map((_, i) => (
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
                )}

                {/* Empty state */}
                {!loading && !error && products.length === 0 && (
                    <p className="text-center py-10 text-[13px] text-slate-500">
                        No featured products at the moment.
                    </p>
                )}

                {/* Product Grid — 4 columns, same layout as before */}
                {!loading && !error && products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {products.map((product) => {
                            const isAdding = cartAddingId === product.id;
                            const price = toNum(product.price);
                            const comparePrice =
                                product.compareAtPrice !== null
                                    ? toNum(product.compareAtPrice)
                                    : null;

                            // Prefer the backend's discount percentage; fall back
                            // to computing it when the field is null.
                            const discountPercentage =
                                product.discountPercentage ??
                                (comparePrice && comparePrice > price
                                    ? Math.round(
                                        ((comparePrice - price) / comparePrice) * 100,
                                    )
                                    : null);

                            return (
                                <Link
                                    key={product.id}
                                    href={`/pages/products?open=${product.id}`}
                                    className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Product Image */}
                                        <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                            <img
                                                src={product.images[0] ?? '/placeholder.jpeg'}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />

                                            {/* Left stack — discount + stock badges */}
                                            <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5">
                                                {discountPercentage && (
                                                    <span className="bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                        -{discountPercentage}%
                                                    </span>
                                                )}
                                                <span
                                                    className={`text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${product.stock === 'In Stock'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : product.stock === 'Low Stock'
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    {product.stock}
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
                                                compareAtPrice={comparePrice ?? undefined}
                                                slug={product.slug}
                                                stockCount={product.stockQuantity}
                                                stock={product.stock}
                                                size="sm"
                                                className="absolute top-2 right-2 z-10"
                                            />
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-3 pb-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                                                    {product.brand}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {product.category}
                                                </p>
                                            </div>

                                            <h3 className="text-[13px] font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-1 mt-0.5 mb-1">
                                                {product.name}
                                            </h3>

                                            {Number(product.rating) > 0 && (
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

                                    {/* Price and Add to Cart */}
                                    <div className="p-3 pt-0 mt-auto">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-baseline space-x-2">
                                                <span className="text-sm font-bold text-slate-900">
                                                    {formatKES(price)}
                                                </span>
                                                {comparePrice !== null && (
                                                    <span className="text-[11px] text-slate-500 line-through">
                                                        {formatKES(comparePrice)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => handleAddToCart(product, e)}
                                            disabled={
                                                isAdding ||
                                                product.stock === 'Out of Stock'
                                            }
                                            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded text-[13px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                                        >
                                            {isAdding ? (
                                                <>
                                                    <svg
                                                        className="animate-spin h-3.5 w-3.5 text-white"
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
                                            ) : product.stock === 'Out of Stock' ? (
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
                )}
            </div>
        </section>
    );
}