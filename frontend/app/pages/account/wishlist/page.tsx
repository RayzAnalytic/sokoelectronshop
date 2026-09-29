'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Heart, ShoppingCart, Trash2, Star, Check, Loader2, AlertCircle,
} from 'lucide-react';
import {
    accountApi,
    ApiError,
    type WishlistRow,
    type WishlistStock,
} from '@/lib/api';
import { useCart } from '@/lib/store/cart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatKES = (n: number | string): string => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (!Number.isFinite(num)) return 'KES 0';
    return `KES ${num.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
};

const stockBadgeClass = (stock: WishlistStock): string => {
    switch (stock) {
        case 'In Stock':
            return 'bg-emerald-100 text-emerald-800';
        case 'Low Stock':
            return 'bg-amber-100 text-amber-800';
        case 'Out of Stock':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-slate-100 text-slate-700';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function WishlistPage() {
    const addToCart = useCart((s) => s.addItem);

    const [items, setItems] = useState<WishlistRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [addingId, setAddingId] = useState<number | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    // ── Initial fetch ──
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const list = await accountApi.wishlist.list();
                if (cancelled) return;
                setItems(list);
            } catch (err) {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiError
                        ? err.message || 'Could not load your wishlist.'
                        : 'Could not load your wishlist.',
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Remove ──
    const handleRemove = async (item: WishlistRow) => {
        setRemovingId(item.id);

        // Optimistic.
        const previous = items;
        setItems((prev) => prev.filter((i) => i.id !== item.id));

        try {
            await accountApi.wishlist.remove(item.id);
            flash(`Removed "${item.product.name}" from wishlist.`);
        } catch (err) {
            setItems(previous);
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not remove from wishlist.'
                    : 'Could not remove from wishlist.',
            );
        } finally {
            setRemovingId(null);
        }
    };

    // ── Add to cart (client-side cart) ──
    const handleAddToCart = async (item: WishlistRow) => {
        if (item.stock === 'Out of Stock') return;
        setAddingId(item.id);

        await addToCart({
            variantId: String(item.variant_id),
            productId: String(item.product.id),
            name: item.product.name,
            brand: item.product.brand,
            image: item.product.image || item.variant_image,
            unitPrice: parseFloat(item.unit_price),
            compareAtPrice: item.compare_at_price
                ? parseFloat(item.compare_at_price)
                : undefined,
            slug: item.product.slug,
            stockCount: item.stock_count,
            stock: item.stock,
        });

        setAddingId(null);
        flash(`Added "${item.product.name}" to cart.`);
    };

    const handleAddAllToCart = async () => {
        const inStock = items.filter((i) => i.stock !== 'Out of Stock');
        if (inStock.length === 0) {
            flash('No in-stock items to add.');
            return;
        }

        for (const item of inStock) {
            await addToCart({
                variantId: String(item.variant_id),
                productId: String(item.product.id),
                name: item.product.name,
                brand: item.product.brand,
                image: item.product.image || item.variant_image,
                unitPrice: parseFloat(item.unit_price),
                compareAtPrice: item.compare_at_price
                    ? parseFloat(item.compare_at_price)
                    : undefined,
                slug: item.product.slug,
                stockCount: item.stock_count,
                stock: item.stock,
            });
        }

        flash(
            `Added ${inStock.length} item${inStock.length > 1 ? 's' : ''} to cart.`,
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Heart className="h-5 w-5 text-rose-600" />
                        My Wishlist
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isLoading
                            ? 'Loading…'
                            : `${items.length} saved item${items.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
                {!isLoading && items.length > 0 && (
                    <button
                        onClick={handleAddAllToCart}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
                    >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add All to Cart
                    </button>
                )}
            </div>

            {/* Load error */}
            {loadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {loadError}
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="bg-white border border-slate-200 rounded-sm overflow-hidden animate-pulse"
                        >
                            <div className="aspect-[16/10] w-full bg-slate-200" />
                            <div className="p-3 space-y-3">
                                <div className="h-3 w-16 bg-slate-200 rounded" />
                                <div className="h-3 w-3/4 bg-slate-200 rounded" />
                                <div className="h-3 w-1/3 bg-slate-200 rounded" />
                                <div className="h-8 w-full bg-slate-200 rounded mt-4" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                /* Empty state */
                <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
                    <Heart className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-sm font-semibold text-slate-900">
                        Your wishlist is empty
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Save products you love to view them later.
                    </p>
                    <Link
                        href="/pages/products"
                        className="mt-4 inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
                    >
                        Browse Products
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((item) => {
                        const isAdding = addingId === item.id;
                        const isRemoving = removingId === item.id;
                        const discount = item.discount_percent > 0
                            ? item.discount_percent
                            : null;
                        const href = `/pages/products/${item.product.slug}`;
                        const imgSrc = item.product.image || item.variant_image;
                        const rating = parseFloat(item.product.rating);

                        return (
                            <div
                                key={item.id}
                                className={`group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all flex flex-col ${isRemoving ? 'opacity-50' : ''
                                    }`}
                            >
                                {/* Image */}
                                <div className="aspect-[16/10] w-full bg-slate-100 relative overflow-hidden">
                                    <Link href={href}>
                                        <img
                                            src={imgSrc}
                                            alt={item.product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </Link>
                                    {discount !== null && (
                                        <span className="absolute top-2 left-2 bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded shadow-xs">
                                            -{discount}%
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleRemove(item)}
                                        disabled={isRemoving}
                                        aria-label="Remove from wishlist"
                                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-red-600 flex items-center justify-center shadow-xs transition-colors disabled:opacity-60"
                                    >
                                        {isRemoving ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                    {item.stock && (
                                        <span
                                            className={`absolute bottom-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded shadow-xs ${stockBadgeClass(item.stock)}`}
                                        >
                                            {item.stock}
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-3 flex-1 flex flex-col">
                                    {item.product.brand && (
                                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                                            {item.product.brand}
                                        </p>
                                    )}
                                    <Link
                                        href={href}
                                        className="text-xs font-semibold text-slate-900 hover:text-blue-950 line-clamp-2 mt-0.5"
                                    >
                                        {item.product.name}
                                    </Link>

                                    {item.variant_name && item.variant_name !== 'Default' && (
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {item.variant_name}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 text-amber-500 fill-current" />
                                        <span className="text-[11px] font-medium text-slate-700">
                                            {Number.isFinite(rating) ? rating.toFixed(1) : '—'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            ({item.product.review_count})
                                        </span>
                                    </div>

                                    <div className="flex items-baseline gap-1.5 mt-2 mb-3">
                                        <span className="text-sm font-bold text-slate-900">
                                            {formatKES(item.unit_price)}
                                        </span>
                                        {item.compare_at_price && (
                                            <span className="text-[10px] text-slate-400 line-through">
                                                {formatKES(item.compare_at_price)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto grid grid-cols-2 gap-1.5">
                                        <Link
                                            href={href}
                                            className="text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 rounded-sm text-[12px] transition-colors"
                                        >
                                            View
                                        </Link>
                                        <button
                                            onClick={() => handleAddToCart(item)}
                                            disabled={
                                                isAdding ||
                                                item.stock === 'Out of Stock'
                                            }
                                            className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 rounded-sm text-[12px] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                            {isAdding ? (
                                                <span>Adding…</span>
                                            ) : item.stock === 'Out of Stock' ? (
                                                <span>Sold Out</span>
                                            ) : (
                                                <>
                                                    <ShoppingCart className="h-3 w-3" />
                                                    <span>Add</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}