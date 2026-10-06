// app/pages/products/page.tsx
'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    Search,
    Star,
    ShoppingCart,
    ChevronRight,
    Home,
    X,
    ArrowUpDown,
    Eye,
    ShieldCheck,
    Truck,
    RotateCcw,
    Send,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';
import {
    catalogApi,
    type CatalogProduct,
    type CatalogProductDetail,
    type CatalogReview,
    type ProductsQuery,
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

const ITEMS_PER_PAGE = 8;

const PRICE_RANGES = [
    { label: 'All Prices', value: 'All' },
    { label: 'Under KES 10,000', value: '0-10000' },
    { label: 'KES 10,000 - KES 50,000', value: '10000-50000' },
    { label: 'KES 50,000 - KES 100,000', value: '50000-100000' },
    { label: 'Over KES 100,000', value: '100000-plus' },
] as const;

const STOCK_OPTIONS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const;

// ─────────────────────────────────────────────────────────────
// Public page — Suspense wrapper (useSearchParams)
// ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
    return (
        <Suspense fallback={null}>
            <ProductsPageInner />
        </Suspense>
    );
}

// ─────────────────────────────────────────────────────────────
// The actual page
// ─────────────────────────────────────────────────────────────
function ProductsPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const openId = searchParams.get('open');

    // ── Filter / sort state ───────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [selectedPriceRange, setSelectedPriceRange] = useState('All');
    const [selectedStock, setSelectedStock] = useState<string>('All');
    const [sortBy, setSortBy] = useState<ProductsQuery['sort_by']>('featured');
    const [currentPage, setCurrentPage] = useState(1);

    // ── Data ──────────────────────────────────────────────────
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [categories, setCategories] = useState<string[]>(['All']);
    const [brands, setBrands] = useState<string[]>(['All']);

    // ── Modal state ───────────────────────────────────────────
    const [activeProductDetail, setActiveProductDetail] =
        useState<CatalogProductDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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

    // ── Debounce search input ─────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // ── Fetch categories + brands once ────────────────────────
    useEffect(() => {
        const ctrl = new AbortController();
        Promise.all([
            catalogApi.categories.list(ctrl.signal),
            catalogApi.brands.list(ctrl.signal),
        ])
            .then(([cats, brs]) => {
                setCategories(['All', ...cats.map((c) => c.name)]);
                setBrands(['All', ...brs.map((b) => b.name)]);
            })
            .catch(() => {
                /* non-fatal — dropdowns fall back to 'All' */
            });
        return () => ctrl.abort();
    }, []);

    // ── Fetch products whenever filters change ────────────────
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setLoadError(null);

        const query: ProductsQuery = {
            search: debouncedSearch || undefined,
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            brand: selectedBrand !== 'All' ? selectedBrand : undefined,
            price_range:
                selectedPriceRange !== 'All'
                    ? (selectedPriceRange as ProductsQuery['price_range'])
                    : undefined,
            stock:
                selectedStock !== 'All'
                    ? (selectedStock as ProductsQuery['stock'])
                    : undefined,
            sort_by: sortBy,
            page: currentPage,
            page_size: ITEMS_PER_PAGE,
        };

        catalogApi.products
            .list(query, ctrl.signal)
            .then((page) => {
                setProducts(page.results);
                setTotalCount(page.count);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setProducts([]);
                setTotalCount(0);
                setLoadError('Failed to load products. Please try again.');
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
        currentPage,
    ]);

    // ── Detail modal driven by ?open= ─────────────────────────
    useEffect(() => {
        if (!openId) {
            setActiveProductDetail(null);
            return;
        }
        const ctrl = new AbortController();
        setDetailLoading(true);

        catalogApi.products
            .detail(openId, ctrl.signal)
            .then((detail) => {
                setActiveProductDetail(detail);
                setSelectedImageIndex(0);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setActiveProductDetail(null);
                // Unknown product — strip the query param
                router.replace(pathname, { scroll: false });
            })
            .finally(() => setDetailLoading(false));

        return () => ctrl.abort();
    }, [openId, router, pathname]);

    // ── Fetch reviews when sub-modal opens ────────────────────
    useEffect(() => {
        if (!reviewsModalOpen || !activeProductDetail) return;
        const ctrl = new AbortController();
        setReviewsLoading(true);

        catalogApi.products.reviews
            .list(activeProductDetail.id, ctrl.signal)
            .then(setReviews)
            .catch(() => setReviews([]))
            .finally(() => setReviewsLoading(false));

        return () => ctrl.abort();
    }, [reviewsModalOpen, activeProductDetail]);

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

    // ── Derived pagination ────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

    // ── Reviews derived ───────────────────────────────────────
    const averageReviewRating = useMemo(() => {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        return Math.round((sum / reviews.length) * 10) / 10;
    }, [reviews]);

    // ── Add to cart ───────────────────────────────────────────
    const handleAddToCart = useCallback(
        async (product: CatalogProduct, e?: React.MouseEvent): Promise<void> => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
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

    // ── Modal open/close handlers ─────────────────────────────
    const handleOpenDetails = (product: CatalogProduct) => {
        openProductInUrl(product.id);
    };

    const handleCloseDetails = () => {
        closeProductInUrl();
        setReviewsModalOpen(false);
        setReviewSubmitted(false);
        setReviewError(null);
        setReviewForm({ author: '', rating: 5, title: '', body: '' });
    };

    const handleSelectRelated = (productId: string) => {
        replaceProductInUrl(productId);
        setSelectedImageIndex(0);
        setReviewsModalOpen(false);
    };

    // ── Submit review ─────────────────────────────────────────
    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeProductDetail) return;
        if (!reviewForm.author.trim() || !reviewForm.body.trim()) return;

        setReviewSubmitting(true);
        setReviewError(null);

        try {
            const created = await catalogApi.products.reviews.create(
                activeProductDetail.id,
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

            // Refresh the detail so rating/reviewCount aggregates update
            catalogApi.products
                .detail(activeProductDetail.id)
                .then(setActiveProductDetail)
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
    const clearAllFilters = () => {
        setSearchQuery('');
        setDebouncedSearch('');
        setSelectedCategory('All');
        setSelectedBrand('All');
        setSelectedPriceRange('All');
        setSelectedStock('All');
        setSortBy('featured');
        setCurrentPage(1);
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
        <div className="min-h-screen bg-white text-slate-900 font-sans relative">
            <div
                className={`transition-all duration-300 ${activeProductDetail
                        ? 'filter blur-sm brightness-50 pointer-events-none select-none'
                        : ''
                    }`}
            >
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Breadcrumb */}
                    <nav className="flex items-center space-x-2 text-[13px] text-slate-500 mb-4">
                        <Link href="/" className="hover:text-slate-900 flex items-center space-x-1">
                            <Home className="w-3.5 h-3.5" />
                            <span>Home</span>
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-900 font-medium">Products Catalog</span>
                    </nav>

                    {/* Heading */}
                    <div className="mb-5 border-b border-slate-200 pb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            Electronics &amp; Hardware Catalog
                        </h1>
                        <p className="text-[13px] text-slate-600 mt-0.5">
                            Browse our complete inventory of certified electronics,
                            high-performance workstations, and smart accessories.
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 mb-4 space-y-2">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder="Search products by name, brand, or category..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-200 focus:ring-1 focus:ring-blue-200"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setCurrentPage(1);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                                <span className="text-[13px] font-medium text-slate-700 flex items-center space-x-1">
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    <span>Sort by:</span>
                                </span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => {
                                        setSortBy(e.target.value as ProductsQuery['sort_by']);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    <option value="featured">Featured</option>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="rating">Highest Rated</option>
                                    <option value="newest">Newest Arrivals</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Category
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Brand
                                </label>
                                <select
                                    value={selectedBrand}
                                    onChange={(e) => {
                                        setSelectedBrand(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {brands.map((brand) => (
                                        <option key={brand} value={brand}>
                                            {brand}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Price Range
                                </label>
                                <select
                                    value={selectedPriceRange}
                                    onChange={(e) => {
                                        setSelectedPriceRange(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {PRICE_RANGES.map((range) => (
                                        <option key={range.value} value={range.value}>
                                            {range.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Availability
                                </label>
                                <select
                                    value={selectedStock}
                                    onChange={(e) => {
                                        setSelectedStock(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {STOCK_OPTIONS.map((stock) => (
                                        <option key={stock} value={stock}>
                                            {stock}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[13px]">
                                <div className="flex items-center space-x-2 text-slate-600 flex-wrap gap-y-1">
                                    <span className="font-medium">Active Filters:</span>
                                    {selectedCategory !== 'All' && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">
                                            Category: {selectedCategory}
                                        </span>
                                    )}
                                    {selectedBrand !== 'All' && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">
                                            Brand: {selectedBrand}
                                        </span>
                                    )}
                                    {selectedPriceRange !== 'All' && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">
                                            Price Range: {selectedPriceRange}
                                        </span>
                                    )}
                                    {selectedStock !== 'All' && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">
                                            Stock: {selectedStock}
                                        </span>
                                    )}
                                    {searchQuery && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">
                                            Search: &ldquo;{searchQuery}&rdquo;
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="text-blue-950 font-medium hover:underline text-[13px]"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Count */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-[13px] text-slate-600">
                            Showing{' '}
                            <span className="font-semibold text-slate-900">
                                {products.length}
                            </span>{' '}
                            of{' '}
                            <span className="font-semibold text-slate-900">
                                {totalCount}
                            </span>{' '}
                            results
                        </p>
                    </div>

                    {/* Error state */}
                    {loadError && !loading && (
                        <div className="text-center py-12 bg-red-50 border border-red-200 rounded-sm mb-8">
                            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                            <p className="text-[13px] text-red-700 mb-3">{loadError}</p>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => p)}
                                className="bg-blue-950 text-white px-4 py-2 rounded text-[13px] font-medium hover:bg-blue-900"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Loading skeleton */}
                    {loading && products.length === 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-white border border-slate-200 rounded-sm overflow-hidden animate-pulse"
                                >
                                    <div className="aspect-[16/10] bg-slate-100" />
                                    <div className="p-3 space-y-2">
                                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Product Grid */}
                    {!loading && products.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {products.map((product) => {
                                const isAdding = cartAddingId === product.id;
                                const price = toNum(product.price);
                                const comparePrice =
                                    product.compareAtPrice !== null
                                        ? toNum(product.compareAtPrice)
                                        : null;
                                const discountPercentage =
                                    product.discountPercentage ?? null;

                                return (
                                    <div
                                        key={product.id}
                                        className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                                <img
                                                    src={product.images[0] ?? '/placeholder.jpeg'}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                                {discountPercentage && (
                                                    <span className="absolute top-2 left-2 z-10 bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                        -{discountPercentage}%
                                                    </span>
                                                )}
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
                                                <span
                                                    className={`absolute bottom-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded shadow-xs ${product.stock === 'In Stock'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : product.stock === 'Low Stock'
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    {product.stock}
                                                </span>
                                            </div>

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

                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDetails(product)}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-2 rounded text-[13px] transition duration-150 flex items-center justify-center space-x-1"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Details</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleAddToCart(product, e)}
                                                    disabled={
                                                        isAdding ||
                                                        product.stock === 'Out of Stock'
                                                    }
                                                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded text-[13px] transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
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
                                                            <span>...</span>
                                                        </>
                                                    ) : product.stock === 'Out of Stock' ? (
                                                        <span>Sold Out</span>
                                                    ) : (
                                                        <>
                                                            <ShoppingCart className="w-3.5 h-3.5" />
                                                            <span>Cart</span>
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
                        <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-sm mb-12">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">
                                No products found
                            </h3>
                            <p className="text-[13px] text-slate-600 mb-4">
                                We couldn&apos;t find any items matching your selected filters
                                or search criteria.
                            </p>
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="bg-blue-950 text-white px-4 py-2 rounded text-[13px] font-medium hover:bg-blue-900 transition"
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center space-x-2 pb-12">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-[13px] border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>

                            {Array.from({ length: totalPages }).map((_, idx) => {
                                const pageNumber = idx + 1;
                                return (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={`w-9 h-9 text-[13px] rounded font-medium transition ${currentPage === pageNumber
                                                ? 'bg-blue-950 text-white'
                                                : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        {pageNumber}
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                                }
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-[13px] border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </main>
            </div>

            {/* PRODUCT DETAILS MODAL */}
            {activeProductDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl rounded-sm shadow-2xl border border-slate-200 overflow-hidden relative max-h-[95vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div>
                                <span className="text-xs font-semibold text-blue-950 uppercase">
                                    {activeProductDetail.brand} • {activeProductDetail.category}
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Product Specification
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseDetails}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <div className="relative aspect-[4/3] w-full rounded-sm bg-slate-100 overflow-hidden border border-slate-200">
                                        <img
                                            src={
                                                activeProductDetail.images[selectedImageIndex] ??
                                                '/placeholder.jpeg'
                                            }
                                            alt={activeProductDetail.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <WishlistButton
                                            variantId={activeProductDetail.id}
                                            productId={activeProductDetail.id}
                                            name={activeProductDetail.name}
                                            brand={activeProductDetail.brand}
                                            image={activeProductDetail.images[0] ?? ''}
                                            unitPrice={toNum(activeProductDetail.price)}
                                            compareAtPrice={
                                                activeProductDetail.compareAtPrice !== null
                                                    ? toNum(activeProductDetail.compareAtPrice)
                                                    : undefined
                                            }
                                            slug={activeProductDetail.slug}
                                            stockCount={activeProductDetail.stockQuantity}
                                            stock={activeProductDetail.stock}
                                            size="md"
                                            className="absolute top-3 right-3 z-10"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {activeProductDetail.images.map((imgUrl, imgIdx) => (
                                            <button
                                                key={imgIdx}
                                                type="button"
                                                onClick={() => setSelectedImageIndex(imgIdx)}
                                                className={`aspect-[4/3] rounded-sm bg-slate-100 overflow-hidden border transition ${selectedImageIndex === imgIdx
                                                        ? 'border-blue-300 ring-1 ring-blue-300'
                                                        : 'border-transparent opacity-70 hover:opacity-100'
                                                    }`}
                                            >
                                                <img
                                                    src={imgUrl}
                                                    alt={`Thumbnail ${imgIdx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                                            {activeProductDetail.name}
                                        </h3>

                                        <button
                                            type="button"
                                            onClick={() => setReviewsModalOpen(true)}
                                            className="flex items-center space-x-1.5 mb-4 group/rating hover:opacity-80 transition"
                                            aria-label="View all reviews"
                                        >
                                            <div className="flex items-center text-amber-500">
                                                <Star className="w-4 h-4 fill-current" />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800 underline-offset-2 group-hover/rating:underline">
                                                {toNum(activeProductDetail.rating).toFixed(1)}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                ({activeProductDetail.reviewCount} verified reviews)
                                            </span>
                                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 ml-1" />
                                        </button>

                                        <div className="flex items-baseline space-x-3 mb-4">
                                            <span className="text-2xl font-bold text-slate-900">
                                                {formatKES(toNum(activeProductDetail.price))}
                                            </span>
                                            {activeProductDetail.compareAtPrice !== null && (
                                                <span className="text-sm text-slate-400 line-through">
                                                    {formatKES(
                                                        toNum(activeProductDetail.compareAtPrice),
                                                    )}
                                                </span>
                                            )}
                                            <span
                                                className={`text-xs font-medium px-2 py-0.5 ${activeProductDetail.stock === 'In Stock'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                    }`}
                                            >
                                                {activeProductDetail.stock}
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">
                                            {activeProductDetail.description}
                                        </p>

                                        {activeProductDetail.features.length > 0 && (
                                            <div className="mb-4">
                                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5">
                                                    Key Highlights
                                                </h4>
                                                <ul className="space-y-1">
                                                    {activeProductDetail.features.map((f, i) => (
                                                        <li
                                                            key={i}
                                                            className="text-xs text-slate-600 flex items-start gap-1.5"
                                                        >
                                                            <span className="w-1.5 h-1.5 bg-blue-950 rounded-full mt-1.5 shrink-0" />
                                                            <span>{f}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {Object.keys(activeProductDetail.specs).length > 0 && (
                                            <div className="mb-6">
                                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5">
                                                    Specifications
                                                </h4>
                                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                                    {Object.entries(
                                                        activeProductDetail.specs,
                                                    ).map(([k, v]) => (
                                                        <div
                                                            key={k}
                                                            className="bg-slate-50 p-1.5 rounded border border-slate-200"
                                                        >
                                                            <span className="text-slate-400 block text-[11px]">
                                                                {k}
                                                            </span>
                                                            <span className="font-semibold text-slate-800">
                                                                {v}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2 mb-6 text-xs text-slate-600 border-t border-b border-slate-100 py-3">
                                            <div className="flex items-center space-x-2">
                                                <ShieldCheck className="w-4 h-4 text-blue-950" />
                                                <span>1 Year Manufacturer Warranty Included</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Truck className="w-4 h-4 text-blue-950" />
                                                <span>Fast Express Delivery Available</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RotateCcw className="w-4 h-4 text-blue-950" />
                                                <span>30-Day Hassle-Free Return Policy</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await handleAddToCart(activeProductDetail);
                                                handleCloseDetails();
                                            }}
                                            disabled={
                                                activeProductDetail.stock === 'Out of Stock'
                                            }
                                            className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded text-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                            <span>Add to Cart</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCloseDetails}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 px-4 rounded text-sm transition"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {activeProductDetail.relatedProducts.length > 0 && (
                                <div className="px-6 pb-6 border-t border-slate-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            You may also like
                                        </h4>
                                        <span className="text-[11px] text-slate-400">
                                            {activeProductDetail.relatedProducts.length} related items
                                        </span>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                                        {activeProductDetail.relatedProducts.map((rp) => {
                                            const rpPrice = toNum(rp.price);
                                            const rpCompare =
                                                rp.compareAtPrice !== null
                                                    ? toNum(rp.compareAtPrice)
                                                    : null;
                                            const rpDiscount =
                                                rp.discountPercentage ??
                                                (rpCompare && rpCompare > rpPrice
                                                    ? Math.round(
                                                        ((rpCompare - rpPrice) / rpCompare) * 100,
                                                    )
                                                    : null);

                                            return (
                                                <button
                                                    key={rp.id}
                                                    type="button"
                                                    onClick={() => handleSelectRelated(rp.id)}
                                                    className="shrink-0 w-40 text-left group/rel"
                                                >
                                                    <div className="aspect-[4/3] rounded-sm bg-slate-100 overflow-hidden relative border border-slate-200 group-hover/rel:border-blue-300 transition-colors">
                                                        <img
                                                            src={rp.images[0] ?? '/placeholder.jpeg'}
                                                            alt={rp.name}
                                                            className="w-full h-full object-cover group-hover/rel:scale-105 transition-transform duration-300"
                                                        />
                                                        {rpDiscount && (
                                                            <span className="absolute top-1 left-1 bg-red-600 text-white font-semibold text-[9px] px-1.5 py-0.5 rounded">
                                                                -{rpDiscount}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-500 uppercase mt-2 truncate">
                                                        {rp.brand}
                                                    </p>
                                                    <p className="text-[12px] font-semibold text-slate-900 truncate group-hover/rel:text-blue-950">
                                                        {rp.name}
                                                    </p>
                                                    <p className="text-[12px] font-bold text-slate-900 mt-0.5">
                                                        {formatKES(rpPrice)}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* REVIEWS SUB-MODAL */}
            {activeProductDetail && reviewsModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 overflow-hidden relative max-h-[90vh] flex flex-col">
                        <div className="flex items-start justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                                    Reviews for
                                </p>
                                <h2 className="text-base font-bold text-slate-900 truncate">
                                    {activeProductDetail.name}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewsModalOpen(false)}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition shrink-0"
                            >
                                <X className="w-5 h-5" />
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
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Write a review
                                    </h3>
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
                                                setReviewForm({
                                                    ...reviewForm,
                                                    author: e.target.value,
                                                })
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
                                                    onClick={() =>
                                                        setReviewForm({
                                                            ...reviewForm,
                                                            rating: n,
                                                        })
                                                    }
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
                                            setReviewForm({
                                                ...reviewForm,
                                                title: e.target.value,
                                            })
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
                                            setReviewForm({
                                                ...reviewForm,
                                                body: e.target.value,
                                            })
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
        </div>
    );
}