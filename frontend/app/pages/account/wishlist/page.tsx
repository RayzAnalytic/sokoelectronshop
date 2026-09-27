'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingCart, Trash2, Star, Check } from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useWishlist, type WishlistItem } from '@/lib/store/wishlist';
import { useCart } from '@/lib/store/cart';

const formatKES = (n: number) => `KES ${n.toLocaleString()}`;

export default function WishlistPage() {
    const wishlistItems = useWishlist((s) => s.items);
    const removeFromWishlist = useWishlist((s) => s.removeItem);
    const addToCart = useCart((s) => s.addItem);

    const [addingId, setAddingId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // The wishlist store hydrates from localStorage on the client only.
    // Deferring the render until mounted avoids a hydration mismatch.
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Look up extra display metadata (rating, reviewCount, category) from the catalog.
    // The wishlist store only keeps the fields needed to render the card + restore to cart.
    const productMeta = useMemo(() => {
        const map = new Map<string, { rating: number; reviewCount: number; category: string }>();
        allProducts.forEach((p) => {
            map.set(p.id, {
                rating: p.rating,
                reviewCount: p.reviewCount,
                category: p.category,
            });
        });
        return map;
    }, []);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const handleRemove = (variantId: string) => {
        removeFromWishlist(variantId);
        flash('Removed from wishlist.');
    };

    const handleAddToCart = async (item: WishlistItem) => {
        if (item.stock === 'Out of Stock') return;
        setAddingId(item.variantId);

        await addToCart({
            variantId: item.variantId,
            productId: item.productId,
            name: item.name,
            brand: item.brand,
            image: item.image,
            unitPrice: item.unitPrice,
            compareAtPrice: item.compareAtPrice,
            slug: item.slug,
            stockCount: item.stockCount,
            stock: item.stock,
        });

        setAddingId(null);
        flash(`Added "${item.name}" to cart.`);
    };

    const handleAddAllToCart = async () => {
        const inStock = wishlistItems.filter((i) => i.stock !== 'Out of Stock');
        if (inStock.length === 0) {
            flash('No in-stock items to add.');
            return;
        }

        for (const item of inStock) {
            await addToCart({
                variantId: item.variantId,
                productId: item.productId,
                name: item.name,
                brand: item.brand,
                image: item.image,
                unitPrice: item.unitPrice,
                compareAtPrice: item.compareAtPrice,
                slug: item.slug,
                stockCount: item.stockCount,
                stock: item.stock,
            });
        }

        flash(`Added ${inStock.length} item${inStock.length > 1 ? 's' : ''} to cart.`);
    };

    // ── SSR guard ──
    if (!isMounted) {
        return (
            <div className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-sm p-5">
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Heart className="h-5 w-5 text-rose-600" />
                        My Wishlist
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Loading…</p>
                </div>
            </div>
        );
    }

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
                        {wishlistItems.length} saved item
                        {wishlistItems.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {wishlistItems.length > 0 && (
                    <button
                        onClick={handleAddAllToCart}
                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                    >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add All to Cart
                    </button>
                )}
            </div>

            {/* Empty state */}
            {wishlistItems.length === 0 ? (
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
                        className="mt-4 inline-block bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs"
                    >
                        Browse Products
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {wishlistItems.map((item) => {
                        const isAdding = addingId === item.variantId;
                        const discount = item.compareAtPrice
                            ? Math.round(
                                  ((item.compareAtPrice - item.unitPrice) /
                                      item.compareAtPrice) *
                                      100
                              )
                            : null;
                        const meta = productMeta.get(item.variantId);
                        const href = `/pages/products/${item.slug}`;

                        return (
                            <div
                                key={item.variantId}
                                className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all flex flex-col"
                            >
                                {/* Image */}
                                <div className="aspect-[16/10] w-full bg-slate-100 relative overflow-hidden">
                                    <Link href={href}>
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </Link>
                                    {discount !== null && (
                                        <span className="absolute top-2 left-2 bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded shadow-xs">
                                            -{discount}%
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleRemove(item.variantId)}
                                        aria-label="Remove from wishlist"
                                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-red-600 flex items-center justify-center shadow-xs transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    {item.stock && (
                                        <span
                                            className={`absolute bottom-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded shadow-xs ${
                                                item.stock === 'In Stock'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : item.stock === 'Low Stock'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}
                                        >
                                            {item.stock}
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-3 flex-1 flex flex-col">
                                    {item.brand && (
                                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                                            {item.brand}
                                        </p>
                                    )}
                                    <Link
                                        href={href}
                                        className="text-xs font-semibold text-slate-900 hover:text-blue-950 line-clamp-2 mt-0.5"
                                    >
                                        {item.name}
                                    </Link>

                                    {meta && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star className="h-3 w-3 text-amber-500 fill-current" />
                                            <span className="text-[11px] font-medium text-slate-700">
                                                {meta.rating}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                ({meta.reviewCount})
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-baseline gap-1.5 mt-2 mb-3">
                                        <span className="text-sm font-bold text-slate-900">
                                            {formatKES(item.unitPrice)}
                                        </span>
                                        {item.compareAtPrice && (
                                            <span className="text-[10px] text-slate-400 line-through">
                                                {formatKES(item.compareAtPrice)}
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
                                                isAdding || item.stock === 'Out of Stock'
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