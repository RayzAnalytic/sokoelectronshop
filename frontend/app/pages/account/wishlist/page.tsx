'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Heart, ShoppingCart, Trash2, Star, Check, Loader2,
} from 'lucide-react';
import { ApiError, type WishlistStock } from '@/lib/api';
import { useCart } from '@/lib/store/cart';
import { useAuth } from '@/lib/hooks/use-auth';
import { useWishlist, type WishlistItem } from '@/lib/store/wishlist';

const formatKES = (n: number | string): string => {
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (!Number.isFinite(num)) return 'KES 0';
    return `KES ${num.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
};

const stockBadgeClass = (stock: WishlistStock | undefined): string => {
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

export default function WishlistPage() {
    const addToCart = useCart((s) => s.addItem);

    const { me, loading: authLoading } = useAuth();
    const isSignedIn = me !== null;

    const items = useWishlist((s) => s.items);
    const hydrated = useWishlist((s) => s._hydrated);
    const hydrate = useWishlist((s) => s.hydrate);
    const removeFromStore = useWishlist((s) => s.remove);

    const [addingId, setAddingId] = useState<string | null>(null);
    const [isAddingAll, setIsAddingAll] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    useEffect(() => {
        if (authLoading) return;
        void hydrate(isSignedIn);
    }, [authLoading, isSignedIn, hydrate]);

    const inStockCount = items.filter(
        (i) => i.stock !== 'Out of Stock',
    ).length;
    const hasInStock = inStockCount > 0;

    const handleRemove = async (item: WishlistItem) => {
        setRemovingId(item.variant_id);
        try {
            await removeFromStore(item.variant_id, isSignedIn);
            flash(`Removed "${item.product_name}" from wishlist.`);
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not remove from wishlist.'
                    : 'Could not remove from wishlist.',
            );
        } finally {
            setRemovingId(null);
        }
    };

    const toCartPayload = (item: WishlistItem) => ({
        variantId: String(item.variant_id),
        productId: String(item.product_id),
        name: item.product_name,
        brand: item.product_brand ?? '',
        image: item.product_image || item.variant_image || '',
        variantLabel: item.variant_name ?? '',
        unitPrice: item.unit_price,
        compareAtPrice:
            item.compare_at_price != null
                ? item.compare_at_price
                : undefined,
        stockCount: item.stock_count ?? 0,
        stock: item.stock ?? 'In Stock',
    });

    const handleAddToCart = async (item: WishlistItem) => {
        if (item.stock === 'Out of Stock') return;
        setAddingId(item.variant_id);

        try {
            await addToCart(toCartPayload(item));
            flash(`Added "${item.product_name}" to cart.`);
        } catch (err) {
            flash(
                err instanceof ApiError
                    ? err.message || 'Could not add to cart.'
                    : 'Could not add to cart.',
            );
        } finally {
            setAddingId(null);
        }
    };

    const handleAddAllToCart = async () => {
        if (isAddingAll) return;

        const inStock = items.filter((i) => i.stock !== 'Out of Stock');
        if (inStock.length === 0) {
            flash('No in-stock items to add.');
            return;
        }

        setIsAddingAll(true);

        let succeeded = 0;
        let failed = 0;

        for (const item of inStock) {
            try {
                await addToCart(toCartPayload(item));
                succeeded += 1;
            } catch {
                failed += 1;
            }
        }

        setIsAddingAll(false);

        if (failed === 0) {
            flash(
                `Added ${succeeded} item${succeeded > 1 ? 's' : ''} to cart.`,
            );
        } else if (succeeded === 0) {
            flash(
                `Could not add ${failed} item${failed > 1 ? 's' : ''} to cart.`,
            );
        } else {
            flash(
                `Added ${succeeded} item${succeeded > 1 ? 's' : ''}; ${failed} failed.`,
            );
        }
    };

    const isLoading = authLoading || !hydrated;

    return (
        <div className="space-y-2">
            {toast && (
                <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:bottom-6 sm:right-6 z-50 bg-slate-900 text-white text-xs px-3 py-3 rounded flex items-start sm:items-center gap-2 max-w-full sm:max-w-sm shadow-lg">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                    <span className="min-w-0 line-clamp-2 sm:line-clamp-none sm:truncate break-words">
                        {toast}
                    </span>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded p-3 sm:p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Heart className="h-5 w-5 text-rose-600 shrink-0" />
                        <span className="truncate">My Wishlist</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5 break-words">
                        {isLoading
                            ? 'Loading…'
                            : items.length === 0
                                ? 'No saved items'
                                : `${items.length} saved item${items.length !== 1 ? 's' : ''} · ${inStockCount} in stock`}
                    </p>
                </div>
                {!isLoading && items.length > 0 && (
                    <button
                        onClick={handleAddAllToCart}
                        disabled={!hasInStock || isAddingAll}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-950 hover:bg-blue-900 active:bg-blue-950 text-white font-medium px-3 py-2.5 sm:py-2 rounded text-xs transition disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto shrink-0"
                    >
                        {isAddingAll ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Adding…
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="h-3.5 w-3.5" />
                                Add All to Cart
                            </>
                        )}
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="bg-white border border-slate-200 rounded overflow-hidden animate-pulse"
                        >
                            <div className="aspect-[16/10] w-full bg-slate-200" />
                            <div className="p-3 sm:p-2 space-y-2">
                                <div className="h-3 w-16 bg-slate-200 rounded" />
                                <div className="h-3 w-3/4 bg-slate-200 rounded" />
                                <div className="h-3 w-1/3 bg-slate-200 rounded" />
                                <div className="h-9 w-full bg-slate-200 rounded mt-4" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded p-6 sm:p-12 text-center">
                    <Heart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <h2 className="text-sm font-semibold text-slate-900">
                        Your wishlist is empty
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Save products you love to view them later.
                    </p>
                    <Link
                        href="/pages/products"
                        className="mt-3 inline-block bg-blue-950 hover:bg-blue-900 active:bg-blue-950 text-white font-medium px-4 py-2.5 rounded text-xs transition"
                    >
                        Browse Products
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map((item) => {
                        const isAdding = addingId === item.variant_id;
                        const isRemoving = removingId === item.variant_id;
                        const discount =
                            item.discount_percent && item.discount_percent > 0
                                ? item.discount_percent
                                : null;
                        const href = item.product_slug
                            ? `/pages/products/${item.product_slug}`
                            : `/pages/products?q=${encodeURIComponent(item.product_name)}`;
                        const imgSrc =
                            item.product_image || item.variant_image || '';
                        const rating =
                            typeof item.rating === 'number' ? item.rating : NaN;

                        return (
                            <div
                                key={item.variant_id}
                                className={`group bg-white border border-slate-200 rounded overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all flex flex-col ${isRemoving ? 'opacity-50' : ''
                                    }`}
                            >
                                <div className="aspect-[20/16] w-full bg-slate-100 relative overflow-hidden">
                                    <Link href={href}>
                                        <img
                                            src={imgSrc}
                                            alt={item.product_name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </Link>
                                    {discount !== null && (
                                        <span className="absolute top-2 left-2 bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded">
                                            -{discount}%
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleRemove(item)}
                                        disabled={isRemoving}
                                        aria-label="Remove from wishlist"
                                        className="absolute top-2 right-2 h-8 w-8 sm:h-7 sm:w-7 rounded-full bg-white/90 hover:bg-white active:bg-white text-slate-600 hover:text-red-600 flex items-center justify-center transition-colors disabled:opacity-60"
                                    >
                                        {isRemoving ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                    {item.stock && (
                                        <span
                                            className={`absolute bottom-2 left-2 text-[11px] sm:text-[12px] font-medium px-1.5 py-0.5 rounded ${stockBadgeClass(item.stock)}`}
                                        >
                                            {item.stock}
                                        </span>
                                    )}
                                </div>

                                <div className="p-3 sm:p-2 flex-1 flex flex-col min-w-0">
                                    {item.product_brand && (
                                        <p className="text-[11px] sm:text-[12px] uppercase text-slate-500 font-medium truncate">
                                            {item.product_brand}
                                        </p>
                                    )}
                                    <Link
                                        href={href}
                                        className="text-xs font-semibold text-slate-900 hover:text-blue-950 line-clamp-2 mt-0.5 break-words"
                                    >
                                        {item.product_name}
                                    </Link>

                                    {item.variant_name &&
                                        item.variant_name !== 'Default' && (
                                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                {item.variant_name}
                                            </p>
                                        )}

                                    <div className="flex items-center gap-1 mt-1">
                                        <Star className="h-3 w-3 text-amber-500 fill-current shrink-0" />
                                        <span className="text-[11px] font-medium text-slate-700">
                                            {Number.isFinite(rating) && rating > 0
                                                ? rating.toFixed(1)
                                                : '—'}
                                        </span>
                                        <span className="text-[12px] text-slate-400">
                                            ({item.review_count ?? 0})
                                        </span>
                                    </div>

                                    <div className="flex items-baseline gap-1.5 mt-1 mb-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-900">
                                            {formatKES(item.unit_price)}
                                        </span>
                                        {item.compare_at_price != null && (
                                            <span className="text-[11px] sm:text-[12px] text-slate-400 line-through">
                                                {formatKES(item.compare_at_price)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto grid grid-cols-2 gap-1.5">
                                        <Link
                                            href={href}
                                            className="text-center bg-slate-100 hover:bg-slate-200 active:bg-slate-200 text-slate-800 font-medium py-2.5 sm:py-2 rounded text-[12px] transition-colors"
                                        >
                                            View
                                        </Link>
                                        <button
                                            onClick={() => handleAddToCart(item)}
                                            disabled={
                                                isAdding ||
                                                isAddingAll ||
                                                item.stock === 'Out of Stock'
                                            }
                                            className="bg-blue-950 hover:bg-blue-900 active:bg-blue-950 text-white font-medium py-2.5 sm:py-2 rounded text-[12px] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                            {isAdding ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    <span>Adding…</span>
                                                </>
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