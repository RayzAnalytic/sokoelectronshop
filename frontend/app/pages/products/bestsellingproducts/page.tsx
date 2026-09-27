'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { products as allProducts } from '@/data/products';
import { useCart } from '@/lib/store/cart';
import { WishlistButton } from '@/components/wishlistbutton/WishlistButton';

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

interface Product {
    id: string;
    bestSeller: boolean;
    brand: string;
    name: string;
    description: string;
    price: number;
    previousPrice?: number;
    rating: number;
    reviewCount: number;
    stockStatus: StockStatus;
    images: string[];
    category: string;
}

// Best sellers = top 8 by review count from the shared catalog
const bestSellersData: Product[] = [...allProducts]
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 8)
    .map((p) => ({
        id: p.id,
        bestSeller: true,
        brand: p.brand,
        name: p.name,
        description: p.description,
        price: p.price,
        previousPrice: p.compareAtPrice ?? undefined,
        rating: p.rating,
        reviewCount: p.reviewCount,
        stockStatus: p.stock,
        images: p.images,
        category: p.category,
    }));

const categories = ['All', ...Array.from(new Set(bestSellersData.map((p) => p.category)))];
const brands = ['All', ...Array.from(new Set(bestSellersData.map((p) => p.brand)))];

export default function BestSellingPage() {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [selectedPriceRange, setSelectedPriceRange] = useState('All');
    const [selectedStock, setSelectedStock] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('best-selling');

    const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>(
        bestSellersData.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
    );
    const [cartAddingId, setCartAddingId] = useState<string | null>(null);
    const [selectedModalProduct, setSelectedModalProduct] = useState<Product | null>(null);
    const [modalImageIndex, setModalImageIndex] = useState(0);

    // Cart store
    const addItem = useCart((s) => s.addItem);

    // Filtering
    const filteredProducts = bestSellersData.filter((product) => {
        if (selectedCategory !== 'All' && product.category !== selectedCategory) return false;
        if (selectedBrand !== 'All' && product.brand !== selectedBrand) return false;

        if (selectedPriceRange === 'under-5000' && product.price >= 5000) return false;
        if (selectedPriceRange === '5000-20000' && (product.price < 5000 || product.price > 20000)) return false;
        if (selectedPriceRange === '20000-50000' && (product.price < 20000 || product.price > 50000)) return false;
        if (selectedPriceRange === 'over-50000' && product.price <= 50000) return false;

        if (selectedStock !== 'All' && product.stockStatus !== selectedStock) return false;

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            const matchesName = product.name.toLowerCase().includes(query);
            const matchesBrand = product.brand.toLowerCase().includes(query);
            const matchesCategory = product.category.toLowerCase().includes(query);
            if (!matchesName && !matchesBrand && !matchesCategory) return false;
        }

        return true;
    }).sort((a, b) => {
        if (sortBy === 'price-low-high') return a.price - b.price;
        if (sortBy === 'price-high-low') return b.price - a.price;
        if (sortBy === 'rating') return b.rating - a.rating;
        return 0;
    });

    const handleThumbnailClick = (productId: string, imgIdx: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveImageIndices(prev => ({ ...prev, [productId]: imgIdx }));
    };

    const handleAddToCart = async (product: Product, e: React.MouseEvent): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();
        if (product.stockStatus === 'Out of Stock') return;

        setCartAddingId(product.id);

        await addItem({
            variantId: product.id,
            productId: product.id,
            name: product.name,
            brand: product.brand,
            image: product.images[0],
            unitPrice: product.price,
            compareAtPrice: product.previousPrice,
            slug: product.id,
            stockCount: 10,
            stock: product.stockStatus,
        });

        setCartAddingId(null);
    };

    const clearFilters = () => {
        setSelectedCategory('All');
        setSelectedBrand('All');
        setSelectedPriceRange('All');
        setSelectedStock('All');
        setSearchQuery('');
        setSortBy('best-selling');
    };

    const openModal = (product: Product) => {
        setSelectedModalProduct(product);
        setModalImageIndex(0);
    };

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
                                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
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
                                <option value="All">All Prices</option>
                                <option value="under-5000">Under KES 5,000</option>
                                <option value="5000-20000">KES 5,000 – 20,000</option>
                                <option value="20000-50000">KES 20,000 – 50,000</option>
                                <option value="over-50000">Over KES 50,000</option>
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
                                <option value="All">All Availability</option>
                                <option value="In Stock">In Stock</option>
                                <option value="Low Stock">Low Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Sort By
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                                >
                                    <option value="best-selling">Best Selling</option>
                                    <option value="price-low-high">Price: Low to High</option>
                                    <option value="price-high-low">Price: High to Low</option>
                                    <option value="rating">Customer Rating</option>
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
                        Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> best-selling products
                    </p>
                </div>

                {/* Grid */}
                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredProducts.map((product) => {
                            const isAdding = cartAddingId === product.id;
                            const activeImgIdx = activeImageIndices[product.id] ?? 0;

                            return (
                                <div
                                    key={product.id}
                                    className="group bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-blue-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden relative">
                                            <img
                                                src={product.images[activeImgIdx]}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />

                                            {/* Best Seller badge — top left */}
                                            <span className="absolute top-2.5 left-2.5 z-10 bg-blue-950 text-white font-medium text-[10px] px-2 py-0.5 rounded shadow-xs">
                                                Best Seller
                                            </span>

                                            {/* Wishlist heart — top right */}
                                            <WishlistButton
                                                variantId={product.id}
                                                productId={product.id}
                                                name={product.name}
                                                brand={product.brand}
                                                image={product.images[0]}
                                                unitPrice={product.price}
                                                compareAtPrice={product.previousPrice}
                                                slug={product.id}
                                                stockCount={10}
                                                stock={product.stockStatus}
                                                size="sm"
                                                className="absolute top-2.5 right-2.5 z-10"
                                            />

                                            {/* Stock status — bottom left */}
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

                                            <Link href={`/pages/products/${product.id}`}>
                                                <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2 mb-1">
                                                    {product.name}
                                                </h3>
                                            </Link>

                                            <div className="flex items-center space-x-1 mb-1">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                                <span className="text-xs font-bold text-slate-800">{product.rating}</span>
                                                <span className="text-[12px] text-slate-500">({product.reviewCount})</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 pt-0 mt-auto">
                                        <div className="flex items-baseline space-x-2 mb-2">
                                            <span className="text-sm font-extrabold text-slate-900">
                                                KES {product.price.toLocaleString()}
                                            </span>
                                            {product.previousPrice && (
                                                <span className="text-[12px] text-slate-400 line-through">
                                                    KES {product.previousPrice.toLocaleString()}
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
                ) : (
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

            {/* Modal */}
            {selectedModalProduct && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2">
                    <div className="bg-white rounded-sm max-w-2xl w-full overflow-hidden shadow-2xl relative">
                        <button
                            onClick={() => setSelectedModalProduct(null)}
                            className="absolute top-3 right-3 bg-slate-100 hover:bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center z-20 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2">
                            <div className="bg-slate-50 p-2 flex flex-col items-center space-y-2">
                                <div className="relative w-full aspect-square bg-white rounded-sm overflow-hidden border border-slate-200 shadow-xs">
                                    <img
                                        src={selectedModalProduct.images[modalImageIndex]}
                                        alt={selectedModalProduct.name}
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Wishlist heart — top-left of the modal image */}
                                    <WishlistButton
                                        variantId={selectedModalProduct.id}
                                        productId={selectedModalProduct.id}
                                        name={selectedModalProduct.name}
                                        brand={selectedModalProduct.brand}
                                        image={selectedModalProduct.images[0]}
                                        unitPrice={selectedModalProduct.price}
                                        compareAtPrice={selectedModalProduct.previousPrice}
                                        slug={selectedModalProduct.id}
                                        stockCount={10}
                                        stock={selectedModalProduct.stockStatus}
                                        size="md"
                                        className="absolute top-3 left-3 z-10"
                                    />
                                </div>
                                <div className="flex items-center justify-center space-x-2">
                                    {selectedModalProduct.images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setModalImageIndex(idx)}
                                            className={`w-12 h-12 rounded-sm overflow-hidden border transition-all ${modalImageIndex === idx
                                                ? 'border-blue-200 scale-105 shadow-sm'
                                                : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-400'
                                                }`}
                                        >
                                            <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 flex flex-col justify-between space-y-2">
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[12px] font-semibold text-blue-600 uppercase">
                                            {selectedModalProduct.brand} • {selectedModalProduct.category}
                                        </span>
                                        <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                                            {selectedModalProduct.name}
                                        </h2>
                                    </div>

                                    <div className="flex items-center space-x-1.5">
                                        <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                                        <span className="text-xs font-bold text-slate-800">{selectedModalProduct.rating}</span>
                                        <span className="text-[12px] text-slate-500">({selectedModalProduct.reviewCount} reviews)</span>
                                        <span className={`ml-2 text-[12px] font-medium px-2 py-0.5 rounded-full ${selectedModalProduct.stockStatus === 'In Stock'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : selectedModalProduct.stockStatus === 'Low Stock'
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {selectedModalProduct.stockStatus}
                                        </span>
                                    </div>

                                    <p className="text-[12px] text-slate-600 leading-relaxed">
                                        {selectedModalProduct.description}
                                    </p>

                                    <div className="flex items-baseline space-x-2 pt-1">
                                        <span className="text-lg font-extrabold text-slate-900">
                                            KES {selectedModalProduct.price.toLocaleString()}
                                        </span>
                                        {selectedModalProduct.previousPrice && (
                                            <span className="text-[12px] text-slate-400 line-through">
                                                KES {selectedModalProduct.previousPrice.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2.5 pt-2">
                                    <Link
                                        href={`/pages/products/${selectedModalProduct.id}`}
                                        className="block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-4 rounded-sm text-[13px] transition-colors"
                                    >
                                        Open Full Product Page →
                                    </Link>
                                    <button
                                        onClick={async (e) => {
                                            await handleAddToCart(selectedModalProduct, e);
                                            setSelectedModalProduct(null);
                                        }}
                                        disabled={selectedModalProduct.stockStatus === 'Out of Stock'}
                                        className="w-full bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-sm text-[13px] transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        <span>Add to Cart — KES {selectedModalProduct.price.toLocaleString()}</span>
                                    </button>
                                </div>
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