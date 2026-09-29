'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    ShoppingCart, X, Star, Check, AlertCircle
} from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

interface Product {
    id: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    compareAtPrice?: number;
    stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
    stockQuantity: number;
    images: string[];
    description: string;
    rating?: number;
    reviewCount?: number;
    createdAt: string;
}

// Newest 8 from the shared catalog
const initialProducts: Product[] = [...allProducts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? undefined,
        stockStatus: p.stock,
        stockQuantity: p.stockQuantity,
        images: p.images,
        description: p.description,
        rating: p.rating,
        reviewCount: p.reviewCount,
        createdAt: p.createdAt,
    }));

// ─────────────────────────────────────────────────────────────
// Public page — Suspense wrapper (useSearchParams requires it)
// ─────────────────────────────────────────────────────────────
export default function NewArrivalsPage() {
    return (
        <Suspense fallback={null}>
            <NewArrivalsPageInner />
        </Suspense>
    );
}

// ─────────────────────────────────────────────────────────────
// The real page
// ─────────────────────────────────────────────────────────────
function NewArrivalsPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const openId = searchParams.get('open');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [selectedStock, setSelectedStock] = useState('All');
    const [sortBy, setSortBy] = useState('newest');

    const [cartNotification, setCartNotification] = useState<string | null>(null);

    const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const addItem = useCart((s) => s.addItem);

    // ── URL is the source of truth for the modal ──────────────
    useEffect(() => {
        if (!openId) {
            setActiveDetailProduct(null);
            return;
        }
        const found = initialProducts.find((p) => p.id === openId);
        if (found) {
            setActiveDetailProduct(found);
            setActiveImageIndex(0);
        } else {
            router.replace(pathname, { scroll: false });
        }
    }, [openId, router, pathname]);

    function openProductInUrl(id: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('open', id);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }

    function closeProductInUrl() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('open');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    const categories = useMemo(() => {
        const set = new Set(initialProducts.map(p => p.category));
        return ['All', ...Array.from(set)];
    }, []);

    const brands = useMemo(() => {
        const set = new Set(initialProducts.map(p => p.brand));
        return ['All', ...Array.from(set)];
    }, []);

    const filteredProducts = useMemo(() => {
        const result = initialProducts.filter(product => {
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                const matchesName = product.name.toLowerCase().includes(q);
                const matchesBrand = product.brand.toLowerCase().includes(q);
                const matchesDesc = product.description.toLowerCase().includes(q);
                if (!matchesName && !matchesBrand && !matchesDesc) return false;
            }
            if (selectedCategory !== 'All' && product.category !== selectedCategory) return false;
            if (selectedBrand !== 'All' && product.brand !== selectedBrand) return false;
            if (minPrice !== '' && product.price < Number(minPrice)) return false;
            if (maxPrice !== '' && product.price > Number(maxPrice)) return false;
            if (selectedStock !== 'All' && product.stockStatus !== selectedStock) return false;
            return true;
        });

        return result.sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortBy === 'price-low') return a.price - b.price;
            if (sortBy === 'price-high') return b.price - a.price;
            if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
            return 0;
        });
    }, [searchQuery, selectedCategory, selectedBrand, minPrice, maxPrice, selectedStock, sortBy]);

    const handleClearFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedBrand('All');
        setMinPrice('');
        setMaxPrice('');
        setSelectedStock('All');
        setSortBy('newest');
    };

    const handleAddToCart = async (product: Product, e?: React.MouseEvent): Promise<void> => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (product.stockStatus === 'Out of Stock') return;

        await addItem({
            variantId: product.id,
            productId: product.id,
            name: product.name,
            brand: product.brand,
            image: product.images[0],
            unitPrice: product.price,
            compareAtPrice: product.compareAtPrice,
            slug: product.id,
            stockCount: product.stockQuantity,
            stock: product.stockStatus,
        });

        setCartNotification(`Added "${product.name}" to cart.`);
        setTimeout(() => setCartNotification(null), 3000);
    };

    // URL-driven open
    const openDetailsModal = (product: Product, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openProductInUrl(product.id);
    };

    // URL-driven close
    const closeDetailsModal = () => {
        closeProductInUrl();
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">

            {cartNotification && (
                <div className="fixed bottom-4 right-4 z-50 bg-blue-950 text-white text-xs px-4 py-3 rounded-sm shadow-lg flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{cartNotification}</span>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4 py-4">

                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="mb-3 text-xs text-slate-500">
                    <ol className="flex items-center space-x-2">
                        <li><Link href="/" className="hover:text-blue-950">Home</Link></li>
                        <li>/</li>
                        <li className="text-slate-900 font-medium" aria-current="page">New Arrivals</li>
                    </ol>
                </nav>

                {/* Intro */}
                <section className="bg-white border border-slate-200 rounded-sm p-2 mb-2">
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1">
                        New Arrivals
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
                        Explore the latest electronics added to our store, from newly listed devices and accessories to fresh arrivals across our categories.
                    </p>
                </section>

                {/* Category nav */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-2">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                                ? 'bg-blue-950 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white border border-slate-200 rounded-sm p-2 mb-2 shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Brand</label>
                            <select
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">Min Price (KES)</label>
                            <input
                                type="number"
                                placeholder="e.g. 20000"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">Max Price (KES)</label>
                            <input
                                type="number"
                                placeholder="e.g. 300000"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">Availability</label>
                            <select
                                value={selectedStock}
                                onChange={(e) => setSelectedStock(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                <option value="All">All Availability</option>
                                <option value="In Stock">In Stock</option>
                                <option value="Low Stock">Low Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">Sort By</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                <option value="newest">Newest</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="rating">Rating</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-500">Showing filtered new arrivals</span>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="text-xs font-semibold text-blue-950 hover:underline"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                {/* Result count */}
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-slate-700">
                        {filteredProducts.length} {filteredProducts.length === 1 ? 'new arrival' : 'new arrivals'} found
                    </p>
                </div>

                {/* Grid */}
                {filteredProducts.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-sm p-8 text-center my-6">
                        <AlertCircle className="w-9 h-9 text-slate-400 mx-auto mb-2.5" />
                        <h2 className="text-sm font-bold text-slate-900 mb-1">No new products are available right now.</h2>
                        <p className="text-xs text-slate-500 mb-2">Try adjusting your filters or search criteria.</p>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="inline-flex items-center px-3.5 py-1.5 bg-blue-950 text-white rounded-sm text-xs font-medium hover:bg-blue-900 transition-colors"
                        >
                            Reset All Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3">
                        {filteredProducts.map((product) => {
                            const isSelectedForDetail = activeDetailProduct?.id === product.id;
                            const isDull = activeDetailProduct !== null && !isSelectedForDetail;

                            return (
                                <div
                                    key={product.id}
                                    className={`bg-white border rounded-sm overflow-hidden transition-all duration-200 flex flex-col justify-between ${isDull
                                        ? 'opacity-40 grayscale-[20%]'
                                        : 'border-slate-200 shadow-xs hover:border-blue-200 hover:shadow-sm'
                                        }`}
                                >
                                    <div>
                                        {/* Image with NEW ribbon */}
                                        <div className="aspect-[16/10] w-full bg-slate-100 relative overflow-hidden">
                                            <img
                                                src={product.images[0]}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
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
                                                image={product.images[0]}
                                                unitPrice={product.price}
                                                compareAtPrice={product.compareAtPrice}
                                                slug={product.id}
                                                stockCount={product.stockQuantity}
                                                stock={product.stockStatus}
                                                size="sm"
                                                className="absolute top-2 right-2 z-10"
                                            />

                                            {/* Stock badge — bottom left of image */}
                                            <span
                                                className={`absolute bottom-2 left-2 z-10 text-[11px] font-medium px-2 py-0.5 rounded-sm shadow-xs ${product.stockStatus === 'In Stock'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : product.stockStatus === 'Low Stock'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {product.stockStatus}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="p-2 pb-1.5">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[12px] font-semibold text-slate-500 uppercase">
                                                    {product.brand} • {product.category}
                                                </span>
                                            </div>

                                            <h3 className="text-[15px] font-semibold text-slate-900 line-clamp-2 mb-1.5">
                                                {product.name}
                                            </h3>

                                            <p className="text-[13px] text-slate-600 line-clamp-2 mb-2">
                                                {product.description}
                                            </p>

                                            {product.rating && (
                                                <div className="flex items-center space-x-1 mb-2">
                                                    <Star className="w-3 h-3 text-amber-500 fill-current" />
                                                    <span className="text-[12px] font-medium text-slate-800">{product.rating}</span>
                                                    <span className="text-[12px] text-slate-500">({product.reviewCount})</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-3 pt-0 mt-auto">
                                        <div className="flex items-baseline space-x-1.5 mb-1">
                                            <span className="text-xs font-bold text-slate-900">
                                                KES {product.price.toLocaleString()}
                                            </span>
                                            {product.compareAtPrice && (
                                                <span className="text-[10px] text-slate-500 line-through">
                                                    KES {product.compareAtPrice.toLocaleString()}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={(e) => openDetailsModal(product, e)}
                                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-2 rounded text-[13px] transition duration-150 flex items-center justify-center space-x-1"
                                            >
                                                <span>Details</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => handleAddToCart(product, e)}
                                                disabled={product.stockStatus === 'Out of Stock'}
                                                className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded text-[13px] transition duration-150 disabled:opacity-50 flex items-center justify-center space-x-1"
                                            >
                                                <ShoppingCart className="w-3 h-3" />
                                                <span>Add</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Details Modal */}
            {activeDetailProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-sm shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 relative">
                        <button
                            type="button"
                            onClick={closeDetailsModal}
                            className="absolute top-2.5 right-2.5 z-20 w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-slate-100 text-slate-600 rounded-full border border-slate-200 shadow-sm transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex flex-col sm:flex-row max-h-[90vh] overflow-y-auto">
                            <div className="sm:w-2/5 p-2 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200">
                                <div className="relative aspect-square w-full bg-white rounded-sm overflow-hidden border border-slate-200">
                                    <img
                                        src={activeDetailProduct.images[activeImageIndex] || activeDetailProduct.images[0]}
                                        alt={activeDetailProduct.name}
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Wishlist heart — top-left of modal image */}
                                    <WishlistButton
                                        variantId={activeDetailProduct.id}
                                        productId={activeDetailProduct.id}
                                        name={activeDetailProduct.name}
                                        brand={activeDetailProduct.brand}
                                        image={activeDetailProduct.images[0]}
                                        unitPrice={activeDetailProduct.price}
                                        compareAtPrice={activeDetailProduct.compareAtPrice}
                                        slug={activeDetailProduct.id}
                                        stockCount={activeDetailProduct.stockQuantity}
                                        stock={activeDetailProduct.stockStatus}
                                        size="md"
                                        className="absolute top-3 left-3 z-10"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 mt-2">
                                    {activeDetailProduct.images.map((imgUrl, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`aspect-square rounded-sm overflow-hidden border transition-all ${activeImageIndex === idx
                                                ? 'border-blue-200 ring-1 ring-blue-950/20'
                                                : 'border-slate-200 opacity-70 hover:opacity-100'
                                                }`}
                                        >
                                            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="sm:w-3/5 p-3 flex flex-col justify-between space-y-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[12px] font-semibold text-slate-500 uppercase">
                                            {activeDetailProduct.brand} • {activeDetailProduct.category}
                                        </span>
                                        <span
                                            className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${activeDetailProduct.stockStatus === 'In Stock'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                : activeDetailProduct.stockStatus === 'Low Stock'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                    : 'bg-red-50 text-red-700 border border-red-100'
                                                }`}
                                        >
                                            {activeDetailProduct.stockStatus}
                                        </span>
                                    </div>

                                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                                        {activeDetailProduct.name}
                                    </h2>

                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-extrabold text-slate-900">
                                            KES {activeDetailProduct.price.toLocaleString()}
                                        </span>
                                        {activeDetailProduct.compareAtPrice && (
                                            <span className="text-xs text-slate-400 line-through">
                                                KES {activeDetailProduct.compareAtPrice.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        {activeDetailProduct.description}
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-slate-100 space-y-2">
                                    <div className="text-[12px] text-slate-500">
                                        ID: <code className="bg-slate-100 px-1 py-0.5 rounded">{activeDetailProduct.id}</code>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={closeDetailsModal}
                                            className="flex-1 text-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-sm text-[13px] font-medium transition-colors"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                await handleAddToCart(activeDetailProduct, e);
                                                closeDetailsModal();
                                            }}
                                            disabled={activeDetailProduct.stockStatus === 'Out of Stock'}
                                            className="flex-1 px-3 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-sm text-[13px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                            <ShoppingCart className="w-3.5 h-3.5" />
                                            Add to Cart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}