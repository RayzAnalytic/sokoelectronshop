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
    RotateCcw
} from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

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

    // Modal state for viewing details
    const [activeProductDetail, setActiveProductDetail] = useState<typeof allProducts[0] | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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
        if (sortBy === 'price-low') {
            products.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-high') {
            products.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'rating') {
            products.sort((a, b) => b.rating - a.rating);
        } else if (sortBy === 'newest') {
            products.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        } else if (sortBy === 'featured') {
            products.sort((a, b) => Number(b.featured) - Number(a.featured));
        }
        return products;
    }, [filteredProducts, sortBy]);

    // Pagination logic
    const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedProducts.slice(start, start + itemsPerPage);
    }, [sortedProducts, currentPage]);

    const handleAddToCart = async (
        product: typeof allProducts[0],
        e: React.MouseEvent
    ): Promise<void> => {
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

    const handleOpenDetails = (product: typeof allProducts[0]) => {
        setActiveProductDetail(product);
        setSelectedImageIndex(0);
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

            {/* MAIN CONTENT AREA - Dark/Blurred when modal is open */}
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

                    {/* Page heading */}
                    <div className="mb-5 border-b border-slate-200 pb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            Electronics & Hardware Catalog
                        </h1>
                        <p className="text-[13px] text-slate-600 mt-0.5">
                            Browse our complete inventory of certified electronics, high-performance workstations, and smart accessories.
                        </p>
                    </div>

                    {/* Filter area */}
                    <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 sm:p-3 mb-4 space-y-2">
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
                                    onChange={(e) => {
                                        setSortBy(e.target.value);
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
                                        <option key={cat} value={cat}>{cat}</option>
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
                                        <option key={brand} value={brand}>{brand}</option>
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
                                    {priceRanges.map((range) => (
                                        <option key={range.value} value={range.value}>{range.label}</option>
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
                                    {stockOptions.map((stock) => (
                                        <option key={stock} value={stock}>{stock}</option>
                                    ))}
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

                    {/* Product count */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-[13px] text-slate-600">
                            Showing <span className="font-semibold text-slate-900">{paginatedProducts.length}</span> of <span className="font-semibold text-slate-900">{sortedProducts.length}</span> results
                        </p>
                    </div>

                    {/* Product Grid - 4 Columns with gap-4 */}
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
                                            {/* Product Image - Full Width Flush to Top */}
                                            <div className="aspect-[16/10] w-full bg-slate-100 overflow-hidden relative">
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />

                                                {/* Discount Tag — top-left */}
                                                {discountPercentage && (
                                                    <span className="absolute top-2 left-2 z-10 bg-red-600 text-white font-semibold text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                        -{discountPercentage}%
                                                    </span>
                                                )}

                                                {/* Wishlist heart — top-right */}
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

                                                {/* Stock Status Badge — bottom-left */}
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

                                            {/* Content Area */}
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

                                        {/* Price and Two Action Buttons (View Details & Add to Cart) */}
                                        <div className="p-3 pt-0 mt-auto">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-baseline space-x-2">
                                                    <span className="text-sm font-bold text-slate-900">
                                                        ${product.price.toFixed(2)}
                                                    </span>
                                                    {product.compareAtPrice && (
                                                        <span className="text-[11px] text-slate-500 line-through">
                                                            ${product.compareAtPrice.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Two Buttons Row */}
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {/* View Details Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDetails(product)}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-2 rounded text-[13px] transition duration-150 flex items-center justify-center space-x-1"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Details</span>
                                                </button>

                                                {/* Add to Cart Button */}
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
                                className="bg-blue-950 text-white px-4 py-2 rounded text-[13px] font-medium hover:bg-blue-950 transition"
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

            {/* PRODUCT DETAILS POPUP MODAL */}
            {activeProductDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-slate-200 overflow-hidden relative max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
                            <div>
                                <span className="text-xs font-semibold text-blue-950 uppercase">
                                    {activeProductDetail.brand} • {activeProductDetail.category}
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">Product Specification</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveProductDetail(null)}
                                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Left: Gallery */}
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
                                <div className="grid grid-cols-3 gap-2">
                                    {activeProductDetail.images.map((imgUrl, imgIdx) => (
                                        <button
                                            key={imgIdx}
                                            type="button"
                                            onClick={() => setSelectedImageIndex(imgIdx)}
                                            className={`aspect-[4/3] rounded-sm bg-slate-100 overflow-hidden border transition ${selectedImageIndex === imgIdx ? 'border-blue-300 ring-1 ring-blue-300' : 'border-transparent opacity-70 hover:opacity-100'
                                                }`}
                                        >
                                            <img src={imgUrl} alt={`Thumbnail ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Info & Actions */}
                            <div className="flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                                        {activeProductDetail.name}
                                    </h3>

                                    <div className="flex items-center space-x-1 mb-4">
                                        <div className="flex items-center text-amber-500">
                                            <Star className="w-4 h-4 fill-current" />
                                        </div>
                                        <span className="text-sm font-semibold text-slate-800">
                                            {activeProductDetail.rating}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            ({activeProductDetail.reviewCount} verified reviews)
                                        </span>
                                    </div>

                                    <div className="flex items-baseline space-x-3 mb-4">
                                        <span className="text-2xl font-bold text-slate-900">
                                            ${activeProductDetail.price.toFixed(2)}
                                        </span>
                                        {activeProductDetail.compareAtPrice && (
                                            <span className="text-sm text-slate-400 line-through">
                                                ${activeProductDetail.compareAtPrice.toFixed(2)}
                                            </span>
                                        )}
                                        <span className={`text-xs font-medium px-2 py-0.5 ${activeProductDetail.stock === 'In Stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
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
                                            setActiveProductDetail(null);
                                        }}
                                        disabled={activeProductDetail.stock === 'Out of Stock'}
                                        className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2.5 px-4 rounded text-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        <span>Add to Cart</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveProductDetail(null)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2.5 px-4 rounded text-sm transition"
                                    >
                                        Close
                                    </button>
                                </div>

                            </div>

                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}