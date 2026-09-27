'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart, ArrowRight } from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

interface NewArrivalProduct {
    id: string;
    name: string;
    brand: string;
    price: number;
    compareAtPrice?: number;
    stockStatus: StockStatus;
    image: string;
    rating?: number;
    reviewCount?: number;
    publishedAt: string;
    active: boolean;
    slug: string;
    stockCount: number;
}

// Newest 4 from the shared catalog (sorted by createdAt desc)
const newArrivalsData: NewArrivalProduct[] = [...allProducts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)
    .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? undefined,
        stockStatus: p.stock,
        image: p.images[0],
        rating: p.rating,
        reviewCount: p.reviewCount,
        publishedAt: p.createdAt,
        active: true,
        slug: p.id,
        stockCount: p.stockQuantity,
    }));

export default function NewArrivals() {
    const newProducts = newArrivalsData;
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    // Cart store
    const addItem = useCart((s) => s.addItem);

    const handleAddToCart = async (
        product: NewArrivalProduct,
        e: React.MouseEvent<HTMLButtonElement>
    ): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();
        if (product.stockStatus === 'Out of Stock') return;

        setCartAddingId(product.id);

        await addItem({
            variantId: product.id,
            productId: product.id,
            name: product.name,
            brand: product.brand,
            image: product.image,
            unitPrice: product.price,
            compareAtPrice: product.compareAtPrice,
            slug: product.slug,
            stockCount: product.stockCount,
            stock: product.stockStatus,
        });

        setCartAddingId(null);
    };

    if (newProducts.length === 0) {
        return (
            <section className="bg-slate-50 py-12 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-xl font-bold text-slate-900 mb-1">New Arrivals</h2>
                    <p className="text-xs text-slate-600 mb-4">No new products are available right now.</p>
                    <Link
                        href="/pages/products/newarrivals"
                        className="inline-flex items-center space-x-1 text-xs font-medium text-blue-950 hover:underline"
                    >
                        <span>Browse All Products</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-slate-50 py-6 lg:py-8 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">

                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-2">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                            New Arrivals
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 ">
                            Explore the latest electronics added to our store.
                        </p>
                    </div>
                    <Link
                        href="/pages/products/newarrivals"
                        className="text-xs font-semibold text-blue-950 hover:underline inline-flex items-center space-x-1 shrink-0"
                    >
                        <span>View All</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Product Grid - 4 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {newProducts.map((product) => {
                        const isAdding = cartAddingId === product.id;

                        return (
                            <Link
                                key={product.id}
                                href="/pages/products/newarrivals"
                                className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Image */}
                                    <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        {/* 45° NEW ribbon — keeps top-left corner */}
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
                                            image={product.image}
                                            unitPrice={product.price}
                                            compareAtPrice={product.compareAtPrice}
                                            slug={product.slug}
                                            stockCount={product.stockCount}
                                            stock={product.stockStatus}
                                            size="sm"
                                            className="absolute top-2 right-2 z-10"
                                        />

                                        {/* Stock Status — bottom left of image */}
                                        <span
                                            className={`absolute bottom-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${
                                                product.stockStatus === 'In Stock'
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

                                        {product.rating && (
                                            <div className="flex items-center space-x-1 mb-1">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                                <span className="text-xs font-medium text-slate-800">
                                                    {product.rating}
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
                                            KES {product.price.toLocaleString()}
                                        </span>
                                        {product.compareAtPrice && (
                                            <span className="text-[11px] text-slate-500 line-through">
                                                KES {product.compareAtPrice.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => handleAddToCart(product, e)}
                                        disabled={isAdding || product.stockStatus === 'Out of Stock'}
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded text-sm transition duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center space-x-1.5"
                                    >
                                        {isAdding ? (
                                            <span>Adding...</span>
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