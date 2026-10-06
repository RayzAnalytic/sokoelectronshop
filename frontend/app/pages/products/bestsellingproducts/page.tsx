// app/pages/best-selling/page.tsx
'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    Star,
    ShoppingCart,
    Search,
    ChevronRight,
    ShieldCheck,
    Truck,
    CreditCard,
    CheckCircle2,
    X,
    MessageSquare,
    Send,
    AlertCircle,
} from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
    catalogApi,
    type CatalogBestSeller,
    type CatalogBestSellerDetail,
    type CatalogRelatedProduct,
    type CatalogReview,
    type BestSellingQuery,
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

const PRICE_RANGES = [
    { label: 'All Prices', value: 'All' },
    { label: 'Under KES 5,000', value: 'under-5000' },
    { label: 'KES 5,000 – 20,000', value: '5000-20000' },
    { label: 'KES 20,000 – 50,000', value: '20000-50000' },
    { label: 'Over KES 50,000', value: 'over-50000' },
] as const;

const STOCK_OPTIONS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const;

const SORT_OPTIONS: { label: string; value: NonNullable<BestSellingQuery['sort_by']> }[] = [
    { label: 'Best Selling', value: 'best-selling' },
    { label: 'Price: Low to High', value: 'price-low-high' },
    { label: 'Price: High to Low', value: 'price-high-low' },
    { label: 'Customer Rating', value: 'rating' },
];

// ─────────────────────────────────────────────────────────────
// Suspense wrapper — useSearchParams() needs a boundary
// ─────────────────────────────────────────────────────────────
export default function BestSellingPage() {
    return (
        <Suspense fallback={null}>
            <BestSellingPageInner />
        </Suspense>
    );
}

// ─────────────────────────────────────────────────────────────
// The real page
// ─────────────────────────────────────────────────────────────
function BestSellingPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const openId = searchParams.get('open');

    // ── Filter / sort state ───────────────────────────────────
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [selectedPriceRange, setSelectedPriceRange] = useState<string>('All');
    const [selectedStock, setSelectedStock] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState<NonNullable<BestSellingQuery['sort_by']>>(
        'best-selling',
    );

    // ── Data ──────────────────────────────────────────────────
    const [products, setProducts] = useState<CatalogBestSeller[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // ── Modal state ───────────────────────────────────────────
    const [modalDetail, setModalDetail] = useState<CatalogBestSellerDetail | null>(null);
    const [modalImageIndex, setModalImageIndex] = useState(0);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    // ── Reviews state ─────────────────────────────────────────
    const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
    const [reviews, setReviews] = useState<CatalogReview[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewForm, setReviewForm] = useState({
        author: '',
        rating: 5,
        title: '',
        body: '',
    });
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);

    const addItem = useCart((s) => s.addItem);

    // ── Debounce search ───────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // ── Fetch best sellers whenever filters change ────────────
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setLoadError(null);

        const query: BestSellingQuery = {
            search: debouncedSearch || undefined,
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            brand: selectedBrand !== 'All' ? selectedBrand : undefined,
            price_range:
                selectedPriceRange !== 'All'
                    ? (selectedPriceRange as BestSellingQuery['price_range'])
                    : undefined,
            stock:
                selectedStock !== 'All'
                    ? (selectedStock as BestSellingQuery['stock'])
                    : undefined,
            sort_by: sortBy,
            limit: 48,
        };

        catalogApi.bestSelling
            .list(query, ctrl.signal)
            .then(setProducts)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setLoadError('Failed to load best sellers. Please try again.');
            })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
    }, [
        debouncedSearch,
        selectedCategory,
        selectedBrand,
        selectedPriceRange,
        selectedStock,
        sortBy,
    ]);

    // ── Fetch modal detail from ?open= ────────────────────────
    useEffect(() => {
        if (!openId) {
            setModalDetail(null);
            return;
        }
        const ctrl = new AbortController();

        catalogApi.bestSelling
            .detail(openId, ctrl.signal)
            .then((detail) => {
                setModalDetail(detail);
                setModalImageIndex(0);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setModalDetail(null);
                router.replace(pathname, { scroll: false });
            });

        return () => ctrl.abort();
    }, [openId, router, pathname]);

    // ── Fetch reviews when sub-modal opens ────────────────────
    useEffect(() => {
        if (!reviewsModalOpen || !modalDetail) return;
        const ctrl = new AbortController();
        setReviewsLoading(true);

        catalogApi.bestSelling.reviews
            .list(modalDetail.product.id, ctrl.signal)
            .then(setReviews)
            .catch(() => setReviews([]))
            .finally(() => setReviewsLoading(false));

        return () => ctrl.abort();
    }, [reviewsModalOpen, modalDetail]);

    // ── URL helpers for the modal ─────────────────────────────
    const openProductInUrl = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('open', id);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const replaceProductInUrl = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('open', id);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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

    // ── Reviews derived ───────────────────────────────────────
    const averageReviewRating = useMemo(() => {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        return Math.round((sum / reviews.length) * 10) / 10;
    }, [reviews]);

    // ── Add to cart ───────────────────────────────────────────
    const handleAddToCart = useCallback(
        async (product: CatalogBestSeller, e?: React.MouseEvent) => {
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
                        product.previousPrice !== null
                            ? toNum(product.previousPrice)
                            : undefined,
                    slug: product.id,
                    stockCount: 10,
                    stock: product.stockStatus,
                });
            } finally {
                setCartAddingId(null);
            }
        },
        [addItem],
    );

    // ── Modal open/close ──────────────────────────────────────
    const openModal = (product: CatalogBestSeller) => openProductInUrl(product.id);

    const closeModal = () => {
        closeProductInUrl();
        setReviewsModalOpen(false);
        setReviewSubmitted(false);
        setReviewError(null);
        setReviewForm({ author: '', rating: 5, title: '', body: '' });
    };

    const handleSelectRelated = (rp: CatalogRelatedProduct) => {
        replaceProductInUrl(rp.id);
        setModalImageIndex(0);
        setReviewsModalOpen(false);
    };

    // ── Submit review ─────────────────────────────────────────
    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalDetail) return;
        if (!reviewForm.author.trim() || !reviewForm.body.trim()) return;

        setReviewSubmitting(true);
        setReviewError(null);

        try {
            const created = await catalogApi.bestSelling.reviews.create(
                modalDetail.product.id,
                {
                    author: reviewForm.author.trim(),
                    rating: reviewForm.rating,
                    title: reviewForm.title.trim() || undefined,
                    body: reviewForm.body.trim(),
                },
            );
            setReviews((prev) => [created, ...prev]);
            setReviewSubmitted(true);
            setReviewForm({ author: '', rating: 5, title: '', body: '' });

            // Refresh detail so rating/reviewCount aggregates update
            catalogApi.bestSelling
                .detail(modalDetail.product.id)
                .then(setModalDetail)
                .catch(() => {
                    /* non-fatal */
                });
        } catch {
            setReviewError('Could not submit review. Please try again.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    // ── Clear filters ─────────────────────────────────────────
    const clearFilters = () => {
        setSelectedCategory('All');
        setSelectedBrand('All');
        setSelectedPriceRange('All');
        setSelectedStock('All');
        setSearchQuery('');
        setDebouncedSearch('');
        setSortBy('best-selling');
    };

    const hasActiveFilters =
        selectedCategory !== 'All' ||
        selectedBrand !== 'All' ||
        selectedPriceRange !== 'All' ||
        selectedStock !== 'All' ||
        searchQuery.trim() !== '';

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
            {/* Breadcrumb */}
            <div className="bg-white border-b border-slate-200 py-2 text-xs text-slate-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4 flex items-center space-x-2">
                    <Link href="/" className="hover:text-blue-950">Home</Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-900 font-medium">Best Sellers</span>
                </div>
            </div>

            {/* Hero */}
            <section className="bg-white border-b border-slate-200 py-5">
                <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                Best Selling Products
                            </h1>
                            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                                Explore the products customers are buying most from our electronics collection. Ranked automatically by actual completed orders and units sold.
                            </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-xs text-slate-600 shrink-0">
                            <span className="font-semibold text-slate-900 block mb-0.5">Kenya-wide Delivery</span>
                            <span>Dispatching daily from Nairobi warehouses</span>
                        </div>
                    </div>
                </div>
            </section>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-4 lg:px-4 py-2">
                {/* Category nav */}
                <div className="mb-1 overflow-x-auto pb-1">
                    <div className="flex items-center space-x-2 min-w-max">
                        {categories.map((cat) => {
                            const isActive = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-sm text-xs font-medium transition-colors ${isActive
                                            ? 'bg-blue-950 text-white shadow-xs'
                                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white border border-slate-200 rounded-sm p-1 sm:p-1 mb-2 shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                                Search Best Sellers
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search best sellers..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                                Brand
                            </label>
                            <select
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                            >
                                {brands.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                                Price Range
                            </label>
                            <select
                                value={selectedPriceRange}
                                onChange={(e) => setSelectedPriceRange(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                            >
                                {PRICE_RANGES.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                                Availability
                            </label>
                            <select
                                value={selectedStock}
                                onChange={(e) => setSelectedStock(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                            >
                                {STOCK_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s === 'All' ? 'All Availability' : s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Sort By
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) =>
                                        setSortBy(e.target.value as NonNullable<BestSellingQuery['sort_by']>)
                                    }
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                                >
                                    {SORT_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={clearFilters}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-3 rounded-sm text-xs transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Count */}
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-slate-600">
                        Showing{' '}
                        <span className="font-bold text-slate-900">{products.length}</span>{' '}
                        best-selling products
                    </p>
                </div>

                {/* Error state */}
                {loadError && !loading && (
                    <div className="bg-white border border-red-200 rounded-sm p-6 text-center my-4">
                        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                        <p className="text-xs text-red-700 mb-3">{loadError}</p>
                        <button
                            onClick={() => setSortBy((s) => s)}
                            className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-xs transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && products.length === 0 && !loadError && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 rounded-sm overflow-hidden animate-pulse"
                            >
                                <div className="aspect-[4/3] bg-slate-100" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Grid */}
                {!loading && !loadError && products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {products.map((product) => {
                            const isAdding = cartAddingId === product.id;
                            const price = toNum(product.price);
                            const previousPrice =
                                product.previousPrice !== null
                                    ? toNum(product.previousPrice)
                                    : null;

                            return (
                                <div
                                    key={product.id}
                                    className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden relative">
                                            <img
                                                src={product.images[0] ?? '/placeholder.jpeg'}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />

                                            <span className="absolute top-2.5 left-2.5 z-10 bg-blue-950 text-white font-medium text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                Best Seller
                                            </span>

                                            <WishlistButton
                                                variantId={product.id}
                                                productId={product.id}
                                                name={product.name}
                                                brand={product.brand}
                                                image={product.images[0] ?? ''}
                                                unitPrice={price}
                                                compareAtPrice={previousPrice ?? undefined}
                                                slug={product.id}
                                                stockCount={10}
                                                stock={product.stockStatus}
                                                size="sm"
                                                className="absolute top-2.5 right-2.5 z-10"
                                            />

                                            <span
                                                className={`absolute bottom-2.5 left-2.5 z-10 text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${product.stockStatus === 'In Stock'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : product.stockStatus === 'Low Stock'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {product.stockStatus}
                                            </span>
                                        </div>

                                        <div className="p-2 pb-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[13px] font-semibold text-slate-400 uppercase tracking-wider">
                                                    {product.brand}
                                                </span>
                                                <span className="text-[12px] text-slate-400">
                                                    {product.category}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => openModal(product)}
                                                className="text-left"
                                            >
                                                <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mb-1">
                                                    {product.name}
                                                </h3>
                                            </button>

                                            <div className="flex items-center space-x-1 mb-1">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                                <span className="text-xs font-bold text-slate-800">
                                                    {toNum(product.rating).toFixed(1)}
                                                </span>
                                                <span className="text-[12px] text-slate-500">
                                                    ({product.reviewCount})
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 pt-0 mt-auto">
                                        <div className="flex items-baseline space-x-2 mb-2">
                                            <span className="text-sm font-extrabold text-slate-900">
                                                {formatKES(price)}
                                            </span>
                                            {previousPrice !== null && (
                                                <span className="text-[12px] text-slate-400 line-through">
                                                    {formatKES(previousPrice)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openModal(product)}
                                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-2 rounded text-[13px] transition-colors flex items-center justify-center space-x-1"
                                            >
                                                <span>View Details</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => handleAddToCart(product, e)}
                                                disabled={isAdding || product.stockStatus === 'Out of Stock'}
                                                className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded text-[13px] transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
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
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Empty state */}
                {!loading && !loadError && products.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-sm p-8 text-center max-w-lg mx-auto my-6">
                        <div className="w-12 h-12 bg-blue-50 text-blue-950 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">
                            No best-selling products found
                        </h3>
                        <p className="text-xs text-slate-600 mb-6">
                            Try changing or clearing your filters to view other available electronics.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-xs transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </main>

            {/* PRODUCT MODAL */}
            {modalDetail && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
                    <div className="bg-white rounded-sm max-w-4xl w-full overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div>
                                <span className="text-[11px] font-semibold text-blue-950 uppercase tracking-wide">
                                    {modalDetail.product.brand} • {modalDetail.product.category}
                                </span>
                                <h2 className="text-base font-bold text-slate-900">Product Details</h2>
                            </div>
                            <button
                                onClick={closeModal}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5">
                                <div className="bg-slate-50 p-2 flex flex-col items-center space-y-2 rounded-sm">
                                    <div className="relative w-full aspect-square bg-white rounded-sm overflow-hidden border border-slate-200 shadow-xs">
                                        <img
                                            src={
                                                modalDetail.product.images[modalImageIndex] ??
                                                '/placeholder.jpeg'
                                            }
                                            alt={modalDetail.product.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <WishlistButton
                                            variantId={modalDetail.product.id}
                                            productId={modalDetail.product.id}
                                            name={modalDetail.product.name}
                                            brand={modalDetail.product.brand}
                                            image={modalDetail.product.images[0] ?? ''}
                                            unitPrice={toNum(modalDetail.product.price)}
                                            compareAtPrice={
                                                modalDetail.product.previousPrice !== null
                                                    ? toNum(modalDetail.product.previousPrice)
                                                    : undefined
                                            }
                                            slug={modalDetail.product.id}
                                            stockCount={10}
                                            stock={modalDetail.product.stockStatus}
                                            size="md"
                                            className="absolute top-3 left-3 z-10"
                                        />
                                    </div>
                                    <div className="flex items-center justify-center space-x-2">
                                        {modalDetail.product.images.map((img, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setModalImageIndex(idx)}
                                                className={`w-12 h-12 rounded-sm overflow-hidden border transition-all ${modalImageIndex === idx
                                                        ? 'border-blue-200 scale-105 shadow-sm'
                                                        : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-400'
                                                    }`}
                                            >
                                                <img
                                                    src={img}
                                                    alt={`View ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col justify-between space-y-3">
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                                                {modalDetail.product.brand} • {modalDetail.product.category}
                                            </span>
                                            <h2 className="text-lg font-bold text-slate-900 mt-1 leading-snug">
                                                {modalDetail.product.name}
                                            </h2>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setReviewsModalOpen(true)}
                                            className="flex items-center space-x-1.5 group/rating hover:opacity-80 transition"
                                            aria-label="View all reviews"
                                        >
                                            <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                                            <span className="text-xs font-bold text-slate-800 underline-offset-2 group-hover/rating:underline">
                                                {toNum(modalDetail.product.rating).toFixed(1)}
                                            </span>
                                            <span className="text-[12px] text-slate-500">
                                                ({modalDetail.product.reviewCount} reviews)
                                            </span>
                                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 ml-1" />
                                            <span
                                                className={`ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${modalDetail.product.stockStatus === 'In Stock'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : modalDetail.product.stockStatus === 'Low Stock'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {modalDetail.product.stockStatus}
                                            </span>
                                        </button>

                                        <div className="text-[12px] text-slate-600 leading-relaxed space-y-2">
                                            {modalDetail.product.description
                                                .split('\n\n')
                                                .map((para, i) => (
                                                    <p key={i}>{para}</p>
                                                ))}
                                        </div>

                                        <div className="flex items-baseline space-x-2 pt-1">
                                            <span className="text-lg font-extrabold text-slate-900">
                                                {formatKES(toNum(modalDetail.product.price))}
                                            </span>
                                            {modalDetail.product.previousPrice !== null && (
                                                <span className="text-[12px] text-slate-400 line-through">
                                                    {formatKES(toNum(modalDetail.product.previousPrice))}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <button
                                            onClick={async () => {
                                                await handleAddToCart(modalDetail.product);
                                                closeModal();
                                            }}
                                            disabled={modalDetail.product.stockStatus === 'Out of Stock'}
                                            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                            <span>
                                                Add to Cart — {formatKES(toNum(modalDetail.product.price))}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {modalDetail.related.length > 0 && (
                                <div className="px-5 pb-5 border-t border-slate-100 pt-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide">
                                            You may also like
                                        </h4>
                                        <span className="text-[11px] text-slate-400">
                                            {modalDetail.related.length} related items
                                        </span>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                                        {modalDetail.related.map((rp) => (
                                            <button
                                                key={rp.id}
                                                type="button"
                                                onClick={() => handleSelectRelated(rp)}
                                                className="shrink-0 w-40 text-left group/rel"
                                            >
                                                <div className="aspect-square rounded-sm bg-slate-100 overflow-hidden relative border border-slate-200 group-hover/rel:border-blue-300 transition-colors">
                                                    <img
                                                        src={rp.images[0] ?? '/placeholder.jpeg'}
                                                        alt={rp.name}
                                                        className="w-full h-full object-cover group-hover/rel:scale-105 transition-transform duration-300"
                                                    />
                                                </div>
                                                <p className="text-[11px] font-medium text-slate-500 uppercase mt-2 truncate">
                                                    {rp.brand}
                                                </p>
                                                <p className="text-[12px] font-semibold text-slate-900 truncate group-hover/rel:text-blue-950">
                                                    {rp.name}
                                                </p>
                                                <p className="text-[12px] font-bold text-slate-900 mt-0.5">
                                                    {formatKES(toNum(rp.price))}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEWS SUB-MODAL */}
            {modalDetail && reviewsModalOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
                    <div className="bg-white rounded-sm max-w-3xl w-full overflow-hidden shadow-2xl relative max-h-[88vh] flex flex-col">
                        <div className="flex items-start justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                                    Reviews for
                                </p>
                                <h2 className="text-base font-bold text-slate-900 truncate">
                                    {modalDetail.product.name}
                                </h2>
                            </div>
                            <button
                                onClick={() => setReviewsModalOpen(false)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-5 space-y-5">
                            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-sm p-4">
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-slate-900">
                                        {averageReviewRating.toFixed(1)}
                                    </p>
                                    <div className="flex justify-center text-amber-500 mt-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-3.5 h-3.5 ${i < Math.round(averageReviewRating)
                                                        ? 'fill-current'
                                                        : 'text-slate-300'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {reviews.length} reviews
                                    </p>
                                </div>
                                <div className="flex-1 border-l border-slate-200 pl-4">
                                    <p className="text-[12px] text-slate-600">
                                        Based on verified purchases and community submissions.
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Add your own review below ↓
                                    </p>
                                </div>
                            </div>

                            <form
                                onSubmit={handleSubmitReview}
                                className="bg-white border border-slate-200 rounded-sm p-4 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-900">Write a review</h3>
                                    {reviewSubmitted && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Submitted
                                        </span>
                                    )}
                                </div>

                                {reviewError && (
                                    <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                                        {reviewError}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                            Your name
                                        </label>
                                        <input
                                            type="text"
                                            value={reviewForm.author}
                                            onChange={(e) =>
                                                setReviewForm({ ...reviewForm, author: e.target.value })
                                            }
                                            placeholder="e.g. Jane W."
                                            required
                                            maxLength={120}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                            Rating
                                        </label>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                                                    className="p-1"
                                                    aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                                                >
                                                    <Star
                                                        className={`w-5 h-5 transition ${n <= reviewForm.rating
                                                                ? 'text-amber-500 fill-current'
                                                                : 'text-slate-300'
                                                            }`}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                        Title (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={reviewForm.title}
                                        onChange={(e) =>
                                            setReviewForm({ ...reviewForm, title: e.target.value })
                                        }
                                        placeholder="Summarize your experience"
                                        maxLength={200}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                        Your review
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={reviewForm.body}
                                        onChange={(e) =>
                                            setReviewForm({ ...reviewForm, body: e.target.value })
                                        }
                                        placeholder="Tell others what you think…"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-950"
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={reviewSubmitting}
                                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        {reviewSubmitting ? 'Posting…' : 'Post review'}
                                    </button>
                                </div>
                            </form>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-900">
                                    All reviews ({reviews.length})
                                </h3>

                                {reviewsLoading && (
                                    <p className="text-xs text-slate-500">Loading reviews…</p>
                                )}

                                {!reviewsLoading && reviews.length === 0 && (
                                    <p className="text-xs text-slate-500">
                                        No reviews yet. Be the first to review this product.
                                    </p>
                                )}

                                {reviews.map((review) => (
                                    <div
                                        key={review.id}
                                        className="border border-slate-200 rounded-sm p-3 space-y-1.5"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-slate-900 truncate">
                                                    {review.author}
                                                    {review.verified && (
                                                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                                            Verified
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            className={`w-3 h-3 ${i < review.rating
                                                                    ? 'text-amber-500 fill-current'
                                                                    : 'text-slate-300'
                                                                }`}
                                                        />
                                                    ))}
                                                    <span className="text-[10px] text-slate-400 ml-1 font-mono">
                                                        {review.date}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-800">
                                            {review.title}
                                        </p>
                                        <p className="text-[12px] text-slate-600 leading-relaxed">
                                            {review.body}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trust section */}
            <section className="bg-white border-t border-b border-slate-200 py-4 my-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-[12px] font-bold text-slate-900">Genuine Products</h4>
                                <p className="text-[13px] text-slate-600 mt-0.5">Sourced directly from authorized manufacturers and official distributors.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                                <Truck className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-[12px] font-bold text-slate-900">Fast Delivery</h4>
                                <p className="text-[13px] text-slate-600 mt-0.5">Reliable dispatch across Nairobi and countrywide delivery via secure courier.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-[12px] font-bold text-slate-900">Secure Payments</h4>
                                <p className="text-[13px] text-slate-600 mt-0.5">Pay safely via Safaricom M-Pesa, Airtel Money, or Stripe card payments.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 rounded-sm bg-blue-50 text-blue-950 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-[12px] font-bold text-slate-900">Manufacturer Warranty</h4>
                                <p className="text-[13px] text-slate-600 mt-0.5">All electronics come with standard official warranty coverage and support.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}