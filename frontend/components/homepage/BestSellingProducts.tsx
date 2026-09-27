'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart } from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

type StockStatus = 'In Stock' | 'Out of Stock' | 'Low Stock';

interface Product {
    id: string;
    bestSeller: boolean;
    salesVolume: string;
    brand: string;
    name: string;
    price: number;
    previousPrice: number | null;
    rating: number;
    reviewCount: number;
    stockStatus: StockStatus;
    image: string;
    category: string;
    href: string;
    slug: string;
    stockCount: number;
}

// Derive "k+ sold this month" from reviewCount
const formatSalesVolume = (reviewCount: number): string => {
    if (reviewCount >= 1000) return `${(reviewCount / 1000).toFixed(1)}k+ sold this month`;
    return `${reviewCount}+ sold this month`;
};

// Best sellers = top 8 by review count
// Every card links to the best-selling products page
const productsData: Product[] = [...allProducts]
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 8)
    .map((p) => ({
        id: p.id,
        bestSeller: true,
        salesVolume: formatSalesVolume(p.reviewCount),
        brand: p.brand,
        name: p.name,
        price: p.price,
        previousPrice: p.compareAtPrice,
        rating: p.rating,
        reviewCount: p.reviewCount,
        stockStatus: p.stock,
        image: p.images[0],
        category: p.category,
        href: '/pages/products/bestsellingproducts',
        slug: p.id,
        stockCount: p.stockQuantity,
    }));

export default function BestSellingProducts() {
    const bestSellingProducts = productsData;

    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    // Cart store
    const addItem = useCart((s) => s.addItem);

    const handleAddToCart = async (product: Product, e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();
        setCartAddingId(product.id);

        await addItem({
            variantId: product.id,
            productId: product.id,
            name: product.name,
            brand: product.brand,
            image: product.image,
            unitPrice: product.price,
            compareAtPrice: product.previousPrice ?? undefined,
            slug: product.slug,
            stockCount: product.stockCount,
            stock: product.stockStatus,
        });

        setCartAddingId(null);
    };

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
                            Customer favorites loved for exceptional quality, performance, and value.
                        </p>
                    </div>
                    <Link
                        href="/pages/products/bestsellingproducts"
                        className="text-[13px] font-medium text-blue-950 hover:underline mt-2 sm:mt-0 inline-flex items-center"
                    >
                        View all best sellers →
                    </Link>
                </div>

                {/* Product Grid - 4 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {bestSellingProducts.map((product) => {
                        const isAdding = cartAddingId === product.id;
                        const discountPercentage = product.previousPrice
                            ? Math.round(((product.previousPrice - product.price) / product.previousPrice) * 100)
                            : null;

                        return (
                            <Link
                                key={product.id}
                                href={product.href}
                                className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Full-width flush image header */}
                                    <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        {/* Left stack — sales volume + stock badge */}
                                        <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5">
                                            <span className="bg-blue-950 text-white font-medium text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                {product.salesVolume}
                                            </span>
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${
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

                                        {/* Wishlist heart — top right */}
                                        <WishlistButton
                                            variantId={product.id}
                                            productId={product.id}
                                            name={product.name}
                                            brand={product.brand}
                                            image={product.image}
                                            unitPrice={product.price}
                                            compareAtPrice={product.previousPrice ?? undefined}
                                            slug={product.slug}
                                            stockCount={product.stockCount}
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

                                        {product.rating && (
                                            <div className="flex items-center space-x-1 mb-2">
                                                <div className="flex items-center text-amber-500">
                                                    <Star className="w-3.5 h-3.5 fill-current" />
                                                </div>
                                                <span className="text-[12px] font-medium text-slate-800">
                                                    {product.rating}
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
                                                ${product.price.toFixed(2)}
                                            </span>
                                            {product.previousPrice && (
                                                <span className="text-[11px] text-slate-500 line-through">
                                                    ${product.previousPrice.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <button
                                        type="button"
                                        onClick={(e) => handleAddToCart(product, e)}
                                        disabled={isAdding}
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded text-[13px] transition duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center space-x-1.5"
                                    >
                                        {isAdding ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>Adding...</span>
                                            </>
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