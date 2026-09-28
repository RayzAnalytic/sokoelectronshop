'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Product = typeof allProducts[0];

type Review = {
    id: string;
    author: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verified: boolean;
};

// ─────────────────────────────────────────────────────────────
// Mock reviews — replace with real API later
// ─────────────────────────────────────────────────────────────
const MOCK_REVIEWS: Record<string, Review[]> = {
    default: [
        {
            id: 'r1',
            author: 'Brian K.',
            rating: 5,
            title: 'Excellent quality',
            body: 'Exactly as described. Fast shipping and well packaged. Would buy again.',
            date: '2026-09-12',
            verified: true,
        },
        {
            id: 'r2',
            author: 'Amina M.',
            rating: 4,
            title: 'Great value',
            body: 'Works well, solid build. Only minor gripe is the manual could be clearer.',
            date: '2026-09-05',
            verified: true,
        },
        {
            id: 'r3',
            author: 'Kevin O.',
            rating: 5,
            title: 'Highly recommend',
            body: 'Second purchase from this store. Consistent quality and fair pricing.',
            date: '2026-08-28',
            verified: true,
        },
    ],
};

export default function ProductsPage() {
    // Filter and sort states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [selectedPriceRange, setSelectedPriceRange] = useState('All');
    const [selectedStock, setSelectedStock] = useState('All');
    const [sortBy, setSortBy] = useState('featured');
    const [currentPage, setCurrentPage] = useState(1);
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);

    // Modal state
    const [activeProductDetail, setActiveProductDetail] = useState<Product | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Reviews modal state
    const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
    const [reviewsByProduct, setReviewsByProduct] = useState<Record<string, Review[]>>({});
    const [reviewForm, setReviewForm] = useState({
        author: '',
        rating: 5,
        title: '',
        body: '',
    });
    const [reviewSubmitted, setReviewSubmitted] = useState(false);

    // Cart store
    const addItem = useCart((s) => s.addItem);

    const itemsPerPage = 8;

    const categories = ['All', ...Array.from(new Set(allProducts.map((p) => p.category)))];
    const brands = ['All', ...Array.from(new Set(allProducts.map((p) => p.brand)))];
    const priceRanges = [
        { label: 'All Prices', value: 'All' },
        { label: 'Under $100', value: '0-100' },
        { label: '$100 - $500', value: '100-500' },
        { label: '$500 - $1,000', value: '500-1000' },
        { label: 'Over $1,000', value: '1000-plus' },
    ];
    const stockOptions = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

    // Filtering logic
    const filteredProducts = useMemo(() => {
        return allProducts.filter((product) => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.category.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
            const matchesBrand = selectedBrand === 'All' || product.brand === selectedBrand;

            let matchesPrice = true;
            if (selectedPriceRange === '0-100') matchesPrice = product.price < 100;
            else if (selectedPriceRange === '100-500') matchesPrice = product.price >= 100 && product.price <= 500;
            else if (selectedPriceRange === '500-1000') matchesPrice = product.price > 500 && product.price <= 1000;
            else if (selectedPriceRange === '1000-plus') matchesPrice = product.price > 1000;

            const matchesStock = selectedStock === 'All' || product.stock === selectedStock;

            return matchesSearch && matchesCategory && matchesBrand && matchesPrice && matchesStock;
        });
    }, [searchQuery, selectedCategory, selectedBrand, selectedPriceRange, selectedStock]);

    // Sorting logic
    const sortedProducts = useMemo(() => {
        const products = [...filteredProducts];
        if (sortBy === 'price-low') products.sort((a, b) => a.price - b.price);
        else if (sortBy === 'price-high') products.sort((a, b) => b.price - a.price);
        else if (sortBy === 'rating') products.sort((a, b) => b.rating - a.rating);
        else if (sortBy === 'newest') products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        else if (sortBy === 'featured') products.sort((a, b) => Number(b.featured) - Number(a.featured));
        return products;
    }, [filteredProducts, sortBy]);

    // Pagination
    const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedProducts.slice(start, start + itemsPerPage);
    }, [sortedProducts, currentPage]);

    // ── Related products for the active modal ──
    const relatedProducts = useMemo(() => {
        if (!activeProductDetail) return [];
        return allProducts
            .filter(
                (p) =>
                    p.id !== activeProductDetail.id &&
                    (p.category === activeProductDetail.category ||
                        p.brand === activeProductDetail.brand)
            )
            .slice(0, 6);
    }, [activeProductDetail]);

    // ── Reviews for the active product (merged with submitted ones) ──
    const reviewsForActiveProduct = useMemo(() => {
        if (!activeProductDetail) return [];
        const stored = reviewsByProduct[activeProductDetail.id];
        return stored && stored.length > 0
            ? stored
            : MOCK_REVIEWS.default;
    }, [activeProductDetail, reviewsByProduct]);

    const averageReviewRating = useMemo(() => {
        if (reviewsForActiveProduct.length === 0) return 0;
        const sum = reviewsForActiveProduct.reduce((acc, r) => acc + r.rating, 0);
        return Math.round((sum / reviewsForActiveProduct.length) * 10) / 10;
    }, [reviewsForActiveProduct]);

    // Handlers
    const handleAddToCart = async (product: Product, e: React.MouseEvent): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();
        if (product.stock === 'Out of Stock') return;
        setCartAddingId(product.id);
        await addItem({
            variantId: product.id,
            productId: product.id,
            name: product.name,
            brand: product.brand,
            image: product.images[0],
            unitPrice: product.price,
            compareAtPrice: product.compareAtPrice ?? undefined,
            slug: product.id,
            stockCount: product.stockQuantity ?? 10,
            stock: product.stock,
        });
        setCartAddingId(null);
    };

    const handleOpenDetails = (product: Product) => {
        setActiveProductDetail(product);
        setSelectedImageIndex(0);
    };

    const handleCloseDetails = () => {
        setActiveProductDetail(null);
        setReviewsModalOpen(false);
        setReviewSubmitted(false);
        setReviewForm({ author: '', rating: 5, title: '', body: '' });
    };

    const handleSubmitReview = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeProductDetail) return;
        if (!reviewForm.author.trim() || !reviewForm.body.trim()) return;

        const newReview: Review = {
            id: `r-${Date.now()}`,
            author: reviewForm.author.trim(),
            rating: reviewForm.rating,
            title: reviewForm.title.trim() || 'Review',
            body: reviewForm.body.trim(),
            date: new Date().toISOString().slice(0, 10),
            verified: false,
        };

        setReviewsByProduct((prev) => {
            const current = prev[activeProductDetail.id] ?? MOCK_REVIEWS.default;
            return { ...prev, [activeProductDetail.id]: [newReview, ...current] };
        });

        setReviewSubmitted(true);
        setReviewForm({ author: '', rating: 5, title: '', body: '' });
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedBrand('All');
        setSelectedPriceRange('All');
        setSelectedStock('All');
        setSortBy('featured');
        setCurrentPage(1);
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans relative">

            {/* MAIN CONTENT */}
            <div className={`transition-all duration-300 ${activeProductDetail ? 'filter blur-sm brightness-50 pointer-events-none select-none' : ''}`}>
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
                            Electronics & Hardware Catalog
                        </h1>
                        <p className="text-[13px] text-slate-600 mt-0.5">
                            Browse our complete inventory of certified electronics, high-performance workstations, and smart accessories.
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
                                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                    placeholder="Search products by name, brand, or category..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-200 focus:ring-1 focus:ring-blue-200"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
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
                                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
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
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Brand</label>
                                <select
                                    value={selectedBrand}
                                    onChange={(e) => { setSelectedBrand(e.target.value); setCurrentPage(1); }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Price Range</label>
                                <select
                                    value={selectedPriceRange}
                                    onChange={(e) => { setSelectedPriceRange(e.target.value); setCurrentPage(1); }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {priceRanges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Availability</label>
                                <select
                                    value={selectedStock}
                                    onChange={(e) => { setSelectedStock(e.target.value); setCurrentPage(1); }}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-200"
                                >
                                    {stockOptions.map((stock) => <option key={stock} value={stock}>{stock}</option>)}
                                </select>
                            </div>
                        </div>

                        {(selectedCategory !== 'All' || selectedBrand !== 'All' || selectedPriceRange !== 'All' || selectedStock !== 'All' || searchQuery !== '') && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[13px]">
                                <div className="flex items-center space-x-2 text-slate-600 flex-wrap gap-y-1">
                                    <span className="font-medium">Active Filters:</span>
                                    {selectedCategory !== 'All' && <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">Category: {selectedCategory}</span>}
                                    {selectedBrand !== 'All' && <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">Brand: {selectedBrand}</span>}
                                    {selectedPriceRange !== 'All' && <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">Price Range: {selectedPriceRange}</span>}
                                    {selectedStock !== 'All' && <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">Stock: {selectedStock}</span>}
                                    {searchQuery && <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800">Search: "{searchQuery}"</span>}
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
                            Showing <span className="font-semibold text-slate-900">{paginatedProducts.length}</span> of <span className="font-semibold text-slate-900">{sortedProducts.length}</span> results
                        </p>
                    </div>

                    {/* Product Grid */}
                    {paginatedProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {paginatedProducts.map((product) => {
                                const isAdding = cartAddingId === product.id;
                                const discountPercentage = product.compareAtPrice
                                    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
                                    : null;

                                return (
                                    <div
                                        key={product.id}
                                        className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                                <img
                                                    src={product.images[0]}
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
                                                    image={product.images[0]}
                                                    unitPrice={product.price}
                                                    compareAtPrice={product.compareAtPrice ?? undefined}
                                                    slug={product.id}
                                                    stockCount={product.stockQuantity ?? 10}
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
                                                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{product.brand}</p>
                                                    <p className="text-[11px] text-slate-400">{product.category}</p>
                                                </div>
                                                <h3 className="text-[13px] font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-1 mt-0.5 mb-1">
                                                    {product.name}
                                                </h3>
                                                {product.rating && (
                                                    <div className="flex items-center space-x-1 mb-2">
                                                        <div className="flex items-center text-amber-500">
                                                            <Star className="w-3.5 h-3.5 fill-current" />
                                                        </div>
                                                        <span className="text-[12px] font-medium text-slate-800">{product.rating}</span>
                                                        <span className="text-[11px] text-slate-500">({product.reviewCount})</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-3 pt-0 mt-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-sm font-bold text-slate-900">${product.price.toFixed(2)}</span>
                                                    {product.compareAtPrice && (
                                                        <span className="text-[11px] text-slate-500 line-through">${product.compareAtPrice.toFixed(2)}</span>
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
                                                    disabled={isAdding || product.stock === 'Out of Stock'}
                                                    className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-2 rounded text-[13px] transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                                                >
                                                    {isAdding ? (
                                                        <>
                                                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                    ) : (
                        <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-sm mb-12">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">No products found</h3>
                            <p className="text-[13px] text-slate-600 mb-4">
                                We couldn't find any items matching your selected filters or search criteria.
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
                                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-[13px] border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </main>
            </div>

            {/* ════════════════════════════════════════════════════
                PRODUCT DETAILS MODAL — larger + related + reviews
                ════════════════════════════════════════════════════ */}
            {activeProductDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-6xl rounded-sm shadow-2xl border border-slate-200 overflow-hidden relative max-h-[95vh] flex flex-col">

                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <div>
                                <span className="text-xs font-semibold text-blue-950 uppercase">
                                    {activeProductDetail.brand} • {activeProductDetail.category}
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">Product Specification</h2>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseDetails}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body — scrollable */}
                        <div className="overflow-y-auto flex-1">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

                                {/* LEFT — Gallery */}
                                <div className="space-y-3">
                                    <div className="relative aspect-[4/3] w-full rounded-sm bg-slate-100 overflow-hidden border border-slate-200">
                                        <img
                                            src={activeProductDetail.images[selectedImageIndex]}
                                            alt={activeProductDetail.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <WishlistButton
                                            variantId={activeProductDetail.id}
                                            productId={activeProductDetail.id}
                                            name={activeProductDetail.name}
                                            brand={activeProductDetail.brand}
                                            image={activeProductDetail.images[0]}
                                            unitPrice={activeProductDetail.price}
                                            compareAtPrice={activeProductDetail.compareAtPrice ?? undefined}
                                            slug={activeProductDetail.id}
                                            stockCount={activeProductDetail.stockQuantity ?? 10}
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
                                                <img src={imgUrl} alt={`Thumbnail ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* RIGHT — Info & Actions */}
                                <div className="flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                                            {activeProductDetail.name}
                                        </h3>

                                        {/* Rating — clickable */}
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
                                                {activeProductDetail.rating}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                ({activeProductDetail.reviewCount} verified reviews)
                                            </span>
                                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 ml-1" />
                                        </button>

                                        <div className="flex items-baseline space-x-3 mb-4">
                                            <span className="text-2xl font-bold text-slate-900">
                                                ${activeProductDetail.price.toFixed(2)}
                                            </span>
                                            {activeProductDetail.compareAtPrice && (
                                                <span className="text-sm text-slate-400 line-through">
                                                    ${activeProductDetail.compareAtPrice.toFixed(2)}
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

                                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                                            {activeProductDetail.description}
                                        </p>

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
                                            onClick={async (e) => {
                                                await handleAddToCart(activeProductDetail, e);
                                                handleCloseDetails();
                                            }}
                                            disabled={activeProductDetail.stock === 'Out of Stock'}
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

                            {/* RELATED PRODUCTS */}
                            {relatedProducts.length > 0 && (
                                <div className="px-6 pb-6 border-t border-slate-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            You may also like
                                        </h4>
                                        <span className="text-[11px] text-slate-400">
                                            {relatedProducts.length} related items
                                        </span>
                                    </div>

                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                                        {relatedProducts.map((rp) => {
                                            const rpDiscount = rp.compareAtPrice
                                                ? Math.round(((rp.compareAtPrice - rp.price) / rp.compareAtPrice) * 100)
                                                : null;

                                            return (
                                                <button
                                                    key={rp.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveProductDetail(rp);
                                                        setSelectedImageIndex(0);
                                                        setReviewsModalOpen(false);
                                                    }}
                                                    className="shrink-0 w-40 text-left group/rel"
                                                >
                                                    <div className="aspect-[4/3] rounded-sm bg-slate-100 overflow-hidden relative border border-slate-200 group-hover/rel:border-blue-300 transition-colors">
                                                        <img
                                                            src={rp.images[0]}
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
                                                        ${rp.price.toFixed(2)}
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

            {/* ════════════════════════════════════════════════════
                REVIEWS SUB-MODAL — opens on top of product modal
                ════════════════════════════════════════════════════ */}
            {activeProductDetail && reviewsModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 overflow-hidden relative max-h-[90vh] flex flex-col">

                        {/* Header */}
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

                        {/* Body — scrollable */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-5">

                            {/* Summary */}
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
                                        {reviewsForActiveProduct.length} reviews
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

                            {/* Add review form */}
                            <form onSubmit={handleSubmitReview} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
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
                                                        setReviewForm({ ...reviewForm, rating: n })
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
                                            setReviewForm({ ...reviewForm, title: e.target.value })
                                        }
                                        placeholder="Summarize your experience"
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
                                        className="inline-flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-sm text-xs transition"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        Post review
                                    </button>
                                </div>
                            </form>

                            {/* Reviews list */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-900">
                                    All reviews ({reviewsForActiveProduct.length})
                                </h3>

                                {reviewsForActiveProduct.map((review) => (
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