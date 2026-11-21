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

type StockKind = 'in' | 'low' | 'out' | 'unknown';

function normalizeStock(raw: string | undefined): StockKind {
    const s = (raw || '').toLowerCase().replace(/[_\s-]/g, '');
    if (s === 'instock' || s === 'in') return 'in';
    if (s === 'lowstock' || s === 'low') return 'low';
    if (s === 'outofstock' || s === 'out' || s === 'soldout') return 'out';
    return 'unknown';
}

/* Palette-locked stock chips */
const STOCK_STYLES: Record<StockKind, { bg: string; dot: boolean; label: string }> = {
    in: { bg: 'bg-[#00E5FF] text-[#0B0D10]', dot: false, label: 'In Stock' },
    low: { bg: 'bg-[#00B8D4] text-[#0B0D10]', dot: false, label: 'Low Stock' },
    out: { bg: 'bg-[#6B7280] text-white', dot: false, label: 'Out of Stock' },
    unknown: { bg: 'bg-[#6B7280] text-white', dot: false, label: 'Unknown' },
};

function stockStyle(raw: string | undefined) {
    return STOCK_STYLES[normalizeStock(raw)];
}

export default function FeaturedProducts() {
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

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
            .then((page) => {
                if (ctrl.signal.aborted) return;
                setProducts(page.results);
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setError('Failed to load featured products.');
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
            product: CatalogProduct,
            e: React.MouseEvent<HTMLButtonElement>,
        ): Promise<void> => {
            e.preventDefault();
            e.stopPropagation();

            if (normalizeStock(product.stock) === 'out') return;

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
        <section className="bg-white py-4 xs:py-5 sm:py-6 lg:py-6 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-4 lg:px-4">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 xs:mb-5 sm:mb-6 gap-1.5 sm:gap-0">
                    <div className="min-w-0">
                        <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-[#111827]">
                            Featured <span className="text-[#00B8D4]">Electronics</span>
                        </h2>
                        <p className="text-[11px] xs:text-[12px] sm:text-[13px] md:text-[14px] text-[#6B7280] mt-0.5">
                            Top-rated hardware and audio essentials handpicked for
                            performance and reliability.
                        </p>
                    </div>
                    <Link
                        href="/pages/products"
                        className="text-[11px] xs:text-[12px] sm:text-[13px] md:text-[14px] font-medium text-[#111827] hover:text-[#00B8D4] hover:underline mt-1 sm:mt-0 inline-flex items-center shrink-0 self-start sm:self-auto transition-colors"
                    >
                        View all products →
                    </Link>
                </div>

                {error && !loading && (
                    <div className="text-center py-8 xs:py-10 bg-[#F3F6F9] border border-slate-200 rounded">
                        <p className="text-[12px] xs:text-[13px] text-[#6B7280]">{error}</p>
                    </div>
                )}

                {loading && products.length === 0 && (
                    <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-3 sm:gap-3">
                        {Array.from({ length: FEATURED_LIMIT }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[20/16] bg-[#F3F6F9]" />
                                <div className="p-2 xs:p-3 space-y-1.5 xs:space-y-2">
                                    <div className="h-2.5 xs:h-3 bg-[#F3F6F9] rounded w-1/3" />
                                    <div className="h-3 xs:h-4 bg-[#F3F6F9] rounded w-3/4" />
                                    <div className="h-2.5 xs:h-3 bg-[#F3F6F9] rounded w-1/2" />
                                    <div className="h-7 xs:h-8 bg-[#F3F6F9] rounded mt-2 xs:mt-2" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && hasLoadedOnce && !error && products.length === 0 && (
                    <p className="text-center py-8 xs:py-10 text-[12px] xs:text-[13px] text-[#6B7280]">
                        No featured products at the moment.
                    </p>
                )}

                {!loading && !error && products.length > 0 && (
                    <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xs:gap-3 sm:gap-4">
                        {products.map((product) => {
                            const isAdding = cartAddingId === product.id;
                            const price = toNum(product.price);
                            const comparePrice =
                                product.compareAtPrice !== null
                                    ? toNum(product.compareAtPrice)
                                    : null;

                            const discountPercentage =
                                product.discountPercentage ??
                                (comparePrice && comparePrice > price
                                    ? Math.round(
                                        ((comparePrice - price) / comparePrice) * 100,
                                    )
                                    : null);

                            const stockKind = normalizeStock(product.stock);
                            const stock = STOCK_STYLES[stockKind];
                            const isOutOfStock = stockKind === 'out';

                            return (
                                <Link
                                    key={product.id}
                                    href={`/pages/products?open=${product.id}`}
                                    className="group bg-white border border-slate-200 rounded overflow-hidden hover:border-[#00B8D4] hover:shadow-lg transition-all duration-150 flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="aspect-[20/16] w-full bg-[#F3F6F9] overflow-hidden relative">
                                            <img
                                                src={product.images[0] ?? '/placeholder.jpeg'}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />

                                            <div className="absolute top-1 xs:top-1.5 sm:top-2 left-1 xs:left-1.5 sm:left-2 z-10 flex flex-col items-start gap-1 xs:gap-1.5">
                                                {discountPercentage && (
                                                    <span className="bg-[#00E5FF] text-[#0B0D10] font-bold text-[9px] xs:text-[10px] sm:text-[11px] px-1 xs:px-1.5 sm:px-2 py-0.5 rounded shadow">
                                                        -{discountPercentage}%
                                                    </span>
                                                )}

                                                <span
                                                    className={`inline-flex items-center gap-1 text-[9px] xs:text-[10px] sm:text-[11px] font-semibold px-1 xs:px-1.5 sm:px-2 py-0.5 rounded shadow ${stock.bg}`}
                                                >
                                                    {stock.dot && (
                                                        <span
                                                            className="w-1.5 h-1.5 rounded-full bg-white/90"
                                                            aria-hidden="true"
                                                        />
                                                    )}
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
                                                compareAtPrice={comparePrice ?? undefined}
                                                slug={product.slug}
                                                stockCount={product.stockQuantity}
                                                stock={product.stock}
                                                size="sm"
                                                className="absolute top-1 xs:top-1.5 sm:top-2 right-1 xs:right-1.5 sm:right-2 z-10"
                                            />
                                        </div>

                                        <div className="p-1.5 xs:p-2 pb-1.5 xs:pb-2">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-[10px] xs:text-[11px] sm:text-[12px] font-medium text-[#6B7280] uppercase truncate">
                                                    {product.brand}
                                                </p>
                                                <p className="text-[10px] xs:text-[11px] sm:text-[12px] text-[#6B7280] truncate shrink-0">
                                                    {product.category}
                                                </p>
                                            </div>

                                            <h3 className="text-[11px] xs:text-[12px] sm:text-[13px] font-semibold text-[#111827] group-hover:text-[#00B8D4] transition-colors line-clamp-1 mt-0.5 mb-1">
                                                {product.name}
                                            </h3>

                                            {Number(product.rating) > 0 && (
                                                <div className="flex items-center space-x-1 mb-1">
                                                    <div className="flex items-center text-[#00B8D4]">
                                                        <Star className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                                                    </div>
                                                    <span className="text-[10px] xs:text-[11px] sm:text-[12px] font-medium text-[#111827]">
                                                        {toNum(product.rating).toFixed(1)}
                                                    </span>
                                                    <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-[#6B7280] truncate">
                                                        ({product.reviewCount})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-1.5 xs:p-2 pt-0 mt-auto">
                                        <div className="flex items-center justify-between mb-1.5 xs:mb-2 gap-1">
                                            <div className="flex items-baseline flex-wrap gap-x-1.5 xs:gap-x-2 gap-y-0.5 min-w-0">
                                                <span className="text-[11px] xs:text-[12px] sm:text-sm font-bold text-[#111827] whitespace-nowrap">
                                                    {formatKES(price)}
                                                </span>
                                                {comparePrice !== null && (
                                                    <span className="text-[10px] xs:text-[11px] sm:text-[12px] text-[#6B7280] line-through whitespace-nowrap">
                                                        {formatKES(comparePrice)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => handleAddToCart(product, e)}
                                            disabled={isAdding || isOutOfStock}
                                            className="w-full bg-[#00E5FF] hover:bg-[#00B8D4] text-[#0B0D10] font-bold py-1.5 xs:py-2 px-2 xs:px-3 rounded text-[11px] xs:text-[12px] sm:text-[13px] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 xs:space-x-1.5"
                                        >
                                            {isAdding ? (
                                                <>
                                                    <svg
                                                        className="animate-spin h-3 w-3 xs:h-3.5 xs:w-3.5 text-[#0B0D10] shrink-0"
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
                )}
            </div>
        </section>
    );
}