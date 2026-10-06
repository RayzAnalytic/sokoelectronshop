// app/pages/new-arrivals/page.tsx
'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    ShoppingCart,
    X,
    Star,
    Check,
    AlertCircle,
} from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
    catalogApi,
    type CatalogNewArrival,
    type NewArrivalsQuery,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Helpers
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

const STOCK_OPTIONS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const;

const SORT_OPTIONS: { label: string; value: NonNullable<NewArrivalsQuery['sort_by']> }[] = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Rating', value: 'rating' },
];

const NEW_ARRIVALS_LIMIT = 48;

// ─────────────────────────────────────────────────────────────
// Public wrapper — Suspense boundary for useSearchParams()
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

    // ── Filter / sort state ───────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [selectedStock, setSelectedStock] = useState<string>('All');
    const [sortBy, setSortBy] =
        useState<NonNullable<NewArrivalsQuery['sort_by']>>('newest');

    // ── Data ──────────────────────────────────────────────────
    const [products, setProducts] = useState<CatalogNewArrival[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // ── Modal state ───────────────────────────────────────────
    const [activeDetailProduct, setActiveDetailProduct] =
        useState<CatalogNewArrival | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    // ── Toast ─────────────────────────────────────────────────
    const [cartNotification, setCartNotification] = useState<string | null>(null);

    const addItem = useCart((s) => s.addItem);

    // ── Debounce search ───────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // ── Fetch new arrivals whenever filters change ────────────
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setLoadError(null);

        const query: NewArrivalsQuery = {
            search: debouncedSearch || undefined,
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            brand: selectedBrand !== 'All' ? selectedBrand : undefined,
            min_price: minPrice || undefined,
            max_price: maxPrice || undefined,
            stock:
                selectedStock !== 'All'
                    ? (selectedStock as NewArrivalsQuery['stock'])
                    : undefined,
            sort_by: sortBy,
            limit: NEW_ARRIVALS_LIMIT,
        };

        catalogApi.newArrivals
            .list(query, ctrl.signal)
            .then(setProducts)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setLoadError('Failed to load new arrivals. Please try again.');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, [
        debouncedSearch,
        selectedCategory,
        selectedBrand,
        minPrice,
        maxPrice,
        selectedStock,
        sortBy,
    ]);

    // ── Fetch modal detail from ?open= ────────────────────────
    useEffect(() => {
        if (!openId) {
            setActiveDetailProduct(null);
            return;
        }
        const ctrl = new AbortController();

        catalogApi.newArrivals
            .detail(openId, ctrl.signal)
            .then((detail) => {
                setActiveDetailProduct(detail);
                setActiveImageIndex(0);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setActiveDetailProduct(null);
                router.replace(pathname, { scroll: false });
            });

        return () => ctrl.abort();
    }, [openId, router, pathname]);

    // ── URL helpers for the modal ─────────────────────────────
    const openProductInUrl = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('open', id);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const closeProductInUrl = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('open');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    // ── Dropdown sources derived from the returned products ──
    const categories = useMemo(
        () => ['All', ...Array.from(new Set(products.map((p) => p.category)))],
        [products],
    );
    const brands = useMemo(
        () => ['All', ...Array.from(new Set(products.map((p) => p.brand)))],
        [products],
    );

    // ── Add to cart ───────────────────────────────────────────
    const handleAddToCart = useCallback(
        async (product: CatalogNewArrival, e?: React.MouseEvent) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
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

                setCartNotification(`Added "${product.name}" to cart.`);
                setTimeout(() => setCartNotification(null), 3000);
            } finally {
                setCartAddingId(null);
            }
        },
        [addItem],
    );

    // ── Modal open/close ──────────────────────────────────────
    const openDetailsModal = (product: CatalogNewArrival, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openProductInUrl(product.id);
    };

    const closeDetailsModal = () => closeProductInUrl();

    // ── Clear filters ─────────────────────────────────────────
    const handleClearFilters = () => {
        setSearchQuery('');
        setDebouncedSearch('');
        setSelectedCategory('All');
        setSelectedBrand('All');
        setMinPrice('');
        setMaxPrice('');
        setSelectedStock('All');
        setSortBy('newest');
    };

    const hasActiveFilters =
        searchQuery.trim() !== '' ||
        selectedCategory !== 'All' ||
        selectedBrand !== 'All' ||
        minPrice !== '' ||
        maxPrice !== '' ||
        selectedStock !== 'All';

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────
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
                        <li>
                            <Link href="/" className="hover:text-blue-950">
                                Home
                            </Link>
                        </li>
                        <li>/</li>
                        <li className="text-slate-900 font-medium" aria-current="page">
                            New Arrivals
                        </li>
                    </ol>
                </nav>

                {/* Intro */}
                <section className="bg-white border border-slate-200 rounded-sm p-2 mb-2">
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1">
                        New Arrivals
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
                        Explore the latest electronics added to our store, from newly listed
                        devices and accessories to fresh arrivals across our categories.
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
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                                Brand
                            </label>
                            <select
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                {brands.map((brand) => (
                                    <option key={brand} value={brand}>
                                        {brand}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">
                                Min Price (KES)
                            </label>
                            <input
                                type="number"
                                placeholder="e.g. 20000"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">
                                Max Price (KES)
                            </label>
                            <input
                                type="number"
                                placeholder="e.g. 300000"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">
                                Availability
                            </label>
                            <select
                                value={selectedStock}
                                onChange={(e) => setSelectedStock(e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                {STOCK_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s === 'All' ? 'All Availability' : s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 uppercase mb-1">
                                Sort By
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) =>
                                    setSortBy(
                                        e.target.value as NonNullable<NewArrivalsQuery['sort_by']>,
                                    )
                                }
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-950"
                            >
                                {SORT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-500">
                            Showing filtered new arrivals
                        </span>
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
                        {loading
                            ? 'Loading…'
                            : `${products.length} ${products.length === 1 ? 'new arrival' : 'new arrivals'} found`}
                    </p>
                </div>

                {/* Error state */}
                {loadError && !loading && (
                    <div className="bg-white border border-red-200 rounded-sm p-8 text-center my-6">
                        <AlertCircle className="w-9 h-9 text-red-500 mx-auto mb-2.5" />
                        <h2 className="text-sm font-bold text-slate-900 mb-1">
                            {loadError}
                        </h2>
                        <p className="text-xs text-slate-500 mb-3">
                            Check your connection and try again.
                        </p>
                        <button
                            type="button"
                            onClick={() => setSortBy((s) => s)}
                            className="inline-flex items-center px-3.5 py-1.5 bg-blue-950 text-white rounded-sm text-xs font-medium hover:bg-blue-900 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && products.length === 0 && !loadError && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded-sm overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[16/10] bg-slate-100" />
                                <div className="p-2 space-y-2">
                                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && !loadError && products.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-sm p-8 text-center my-6">
                        <AlertCircle className="w-9 h-9 text-slate-400 mx-auto mb-2.5" />
                        <h2 className="text-sm font-bold text-slate-900 mb-1">
                            No new products are available right now.
                        </h2>
                        <p className="text-xs text-slate-500 mb-2">
                            Try adjusting your filters or search criteria.
                        </p>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="inline-flex items-center px-3.5 py-1.5 bg-blue-950 text-white rounded-sm text-xs font-medium hover:bg-blue-900 transition-colors"
                        >
                            Reset All Filters
                        </button>
                    </div>
                )}

                {/* Grid */}
                {!loading && !loadError && products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3">
                        {products.map((product) => {
                            const isSelectedForDetail =
                                activeDetailProduct?.id === product.id;
                            const isDull =
                                activeDetailProduct !== null && !isSelectedForDetail;
                            const price = toNum(product.price);
                            const comparePrice =
                                product.compareAtPrice !== null
                                    ? toNum(product.compareAtPrice)
                                    : null;
                            const isAdding = cartAddingId === product.id;

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
                                                src={product.images[0] ?? '/placeholder.jpeg'}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                            />

                                            <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none z-10">
                                                <div className="absolute transform -rotate-45 bg-blue-950 text-white font-bold text-[10px] tracking-widest py-1 left-[-40px] top-[18px] w-[140px] text-center shadow-xs">
                                                    NEW
                                                </div>
                                            </div>

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

                                            {toNum(product.rating) > 0 && (
                                                <div className="flex items-center space-x-1 mb-2">
                                                    <Star className="w-3 h-3 text-amber-500 fill-current" />
                                                    <span className="text-[12px] font-medium text-slate-800">
                                                        {toNum(product.rating).toFixed(1)}
                                                    </span>
                                                    <span className="text-[12px] text-slate-500">
                                                        ({product.reviewCount})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-3 pt-0 mt-auto">
                                        <div className="flex items-baseline space-x-1.5 mb-1">
                                            <span className="text-xs font-bold text-slate-900">
                                                {formatKES(price)}
                                            </span>
                                            {comparePrice !== null && (
                                                <span className="text-[10px] text-slate-500 line-through">
                                                    {formatKES(comparePrice)}
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
                                                disabled={
                                                    isAdding ||
                                                    product.stockStatus === 'Out of Stock'
                                                }
                                                className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded text-[13px] transition duration-150 disabled:opacity-50 flex items-center justify-center space-x-1"
                                            >
                                                {isAdding ? (
                                                    <span>…</span>
                                                ) : (
                                                    <>
                                                        <ShoppingCart className="w-3 h-3" />
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
                                        src={
                                            activeDetailProduct.images[activeImageIndex] ??
                                            activeDetailProduct.images[0] ??
                                            '/placeholder.jpeg'
                                        }
                                        alt={activeDetailProduct.name}
                                        className="w-full h-full object-cover"
                                    />

                                    <WishlistButton
                                        variantId={activeDetailProduct.id}
                                        productId={activeDetailProduct.id}
                                        name={activeDetailProduct.name}
                                        brand={activeDetailProduct.brand}
                                        image={activeDetailProduct.images[0] ?? ''}
                                        unitPrice={toNum(activeDetailProduct.price)}
                                        compareAtPrice={
                                            activeDetailProduct.compareAtPrice !== null
                                                ? toNum(activeDetailProduct.compareAtPrice)
                                                : undefined
                                        }
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
                                            <img
                                                src={imgUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
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
                                            {formatKES(toNum(activeDetailProduct.price))}
                                        </span>
                                        {activeDetailProduct.compareAtPrice !== null && (
                                            <span className="text-xs text-slate-400 line-through">
                                                {formatKES(
                                                    toNum(activeDetailProduct.compareAtPrice),
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                        {activeDetailProduct.description}
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-slate-100 space-y-2">
                                    <div className="text-[12px] text-slate-500">
                                        ID:{' '}
                                        <code className="bg-slate-100 px-1 py-0.5 rounded">
                                            {activeDetailProduct.id}
                                        </code>
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
                                            onClick={async () => {
                                                await handleAddToCart(activeDetailProduct);
                                                closeDetailsModal();
                                            }}
                                            disabled={
                                                activeDetailProduct.stockStatus === 'Out of Stock'
                                            }
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