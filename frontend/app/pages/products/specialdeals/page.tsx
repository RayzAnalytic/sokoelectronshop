'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Tag,
  Clock,
  Search,
  Filter,
  X,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Check,
  Eye,
} from 'lucide-react';
import { products as allProducts, type ProductFull } from '@/data/products';
import {
  discounts,
  computeStatus,
  discountedPrice,
  discountPercent,
  type PromotionType,
} from '@/data/discounts';
import { useCart } from '@/lib/store/cart';

// ==========================================
// TYPES
// ==========================================
interface DealProduct {
  id: string;
  productId: string;
  discountCode: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice: number;
  discountPct: number;
  inStock: boolean;
  stockCount: number;
  image: string;
  description: string;
  features: string[];
  specs: Record<string, string>;
  startDate: string;
  endDate: string;
  promotionType: PromotionType;
  rating?: number;
  reviewCount?: number;
}

// ==========================================
// JOIN: discounts × products → deal cards
// Dedupe by product — highest discount wins
// ==========================================
function buildDealCards(): DealProduct[] {
  const raw: DealProduct[] = [];

  for (const discount of discounts) {
    if (!discount.displayOnDealsPage) continue;

    const status = computeStatus(discount.startDate, discount.endDate);
    if (status === 'Expired') continue;

    let applicable: ProductFull[];
    if (discount.appliesTo === 'All Products') {
      applicable = allProducts;
    } else if (discount.appliesTo === 'Specific Products') {
      const ids = new Set(discount.linkedProductIds);
      applicable = allProducts.filter((p) => ids.has(p.id));
    } else {
      const cats = new Set(discount.linkedCategories);
      applicable = allProducts.filter((p) => cats.has(p.category));
    }

    for (const product of applicable) {
      const salePrice = discountedPrice(discount, product.price);
      if (salePrice >= product.price) continue;

      raw.push({
        id: `${discount.id}__${product.id}`,
        productId: product.id,
        discountCode: discount.code,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: salePrice,
        originalPrice: product.price,
        discountPct: discountPercent(discount, product.price),
        inStock: product.stock !== 'Out of Stock',
        stockCount: product.stockQuantity,
        image: product.images[0] ?? '/placeholder.jpeg',
        description: product.description,
        features: product.features ?? [],
        specs: product.specs ?? {},
        startDate: discount.startDate,
        endDate: discount.endDate,
        promotionType: discount.promotionType,
        rating: product.rating,
        reviewCount: product.reviewCount,
      });
    }
  }

  // Best discount first, one card per product
  const sorted = raw.sort((a, b) => b.discountPct - a.discountPct);
  const seen = new Set<string>();
  const unique: DealProduct[] = [];
  for (const card of sorted) {
    if (seen.has(card.productId)) continue;
    seen.add(card.productId);
    unique.push(card);
  }
  return unique;
}

const DEAL_CARDS = buildDealCards();

// ==========================================
// TIME HELPERS
// ==========================================
function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  if (days >= 1) return days === 1 ? '1 day remaining' : `${days} days remaining`;
  if (hours >= 1) return `${hours}hr${hours > 1 ? 's' : ''} remaining`;
  if (minutes >= 1) return `${minutes} min${minutes > 1 ? 's' : ''} remaining`;
  return 'Less than a minute';
}

function urgencyClass(ms: number): string {
  if (ms <= 0) return 'bg-slate-100 text-slate-500 border-slate-200';
  const hours = ms / 3_600_000;
  if (hours < 6) return 'bg-red-50 text-red-700 border-red-200';
  if (hours < 24) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

// ==========================================
// COMPONENT
// ==========================================
export default function SpecialDealsPage() {
  // null until mount — avoids SSR/client mismatch from Date.now()
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('All');
  const [selectedDiscountLevel, setSelectedDiscountLevel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Featured Deals');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const [modalProduct, setModalProduct] = useState<DealProduct | null>(null);

  const addItem = useCart((s) => s.addItem);

  // Deals whose promo window is open right now
  const validDeals = useMemo(() => {
    if (now === null) return DEAL_CARDS;
    return DEAL_CARDS.filter((deal) => {
      const start = new Date(deal.startDate.replace(' ', 'T')).getTime();
      const end = new Date(deal.endDate.replace(' ', 'T')).getTime();
      return now >= start && now <= end;
    });
  }, [now]);

  const categories = useMemo(() => {
    const set = new Set(validDeals.map((d) => d.category));
    return ['All', ...Array.from(set)];
  }, [validDeals]);

  const brands = useMemo(() => {
    const set = new Set(validDeals.map((d) => d.brand));
    return ['All', ...Array.from(set)];
  }, [validDeals]);

  const filteredDeals = useMemo(() => {
    return validDeals
      .filter((product) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            product.name.toLowerCase().includes(q) ||
            product.brand.toLowerCase().includes(q) ||
            product.category.toLowerCase().includes(q);
          if (!matches) return false;
        }

        if (selectedCategory !== 'All' && product.category !== selectedCategory) return false;
        if (selectedBrand !== 'All' && product.brand !== selectedBrand) return false;
        if (minPrice !== '' && product.price < Number(minPrice)) return false;
        if (maxPrice !== '' && product.price > Number(maxPrice)) return false;
        if (selectedAvailability === 'In Stock' && !product.inStock) return false;
        if (selectedAvailability === 'Out of Stock' && product.inStock) return false;

        if (selectedDiscountLevel !== 'All') {
          const threshold = parseInt(selectedDiscountLevel, 10);
          if (product.discountPct < threshold) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'Biggest Discount') return b.discountPct - a.discountPct;
        if (sortBy === 'Price: Low to High') return a.price - b.price;
        if (sortBy === 'Price: High to Low') return b.price - a.price;
        if (sortBy === 'Ending Soon')
          return (
            new Date(a.endDate.replace(' ', 'T')).getTime() -
            new Date(b.endDate.replace(' ', 'T')).getTime()
          );
        return 0;
      });
  }, [
    validDeals,
    searchQuery,
    selectedCategory,
    selectedBrand,
    minPrice,
    maxPrice,
    selectedAvailability,
    selectedDiscountLevel,
    sortBy,
  ]);

  const handleAddToCart = async (product: DealProduct): Promise<void> => {
    if (!product.inStock) return;

    await addItem({
      variantId: product.productId,
      productId: product.productId,
      name: product.name,
      brand: product.brand,
      image: product.image,
      unitPrice: product.price,
      compareAtPrice: product.originalPrice,
      slug: product.productId,
      stockCount: product.stockCount,
      stock: product.inStock ? 'In Stock' : 'Out of Stock',
    });

    setNotification(`Successfully added "${product.name}" to cart.`);
    setTimeout(() => setNotification(null), 3500);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedBrand('All');
    setMinPrice('');
    setMaxPrice('');
    setSelectedAvailability('All');
    setSelectedDiscountLevel('All');
    setSortBy('Featured Deals');
  };

  const activeFilterCount =
    (selectedCategory !== 'All' ? 1 : 0) +
    (selectedBrand !== 'All' ? 1 : 0) +
    (minPrice !== '' || maxPrice !== '' ? 1 : 0) +
    (selectedAvailability !== 'All' ? 1 : 0) +
    (selectedDiscountLevel !== 'All' ? 1 : 0) +
    (searchQuery.trim() !== '' ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-900 selection:text-white">

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center space-x-2 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Details modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-sm shadow-2xl max-w-2xl w-full overflow-hidden relative">
            <button
              onClick={() => setModalProduct(null)}
              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-slate-100 text-slate-600 rounded-full border border-slate-200 shadow-sm transition-colors"
              aria-label="Close modal"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-col sm:flex-row max-h-[85vh] overflow-y-auto">
              {/* LEFT: image + countdown */}
              <div className="sm:w-2/5 p-2 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200">
                <div className="aspect-square w-full bg-white rounded-sm overflow-hidden border border-slate-200 relative">
                  <img
                    src={modalProduct.image}
                    alt={modalProduct.name}
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute top-0 left-0 w-20 h-20 overflow-hidden pointer-events-none z-10">
                    <div className="absolute transform -rotate-45 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white font-bold text-[10px] tracking-widest py-1 left-[-36px] top-[16px] w-[130px] text-center shadow-xs">
                      {modalProduct.discountPct}% OFF
                    </div>
                  </div>
                </div>

                {(() => {
                  const ms = new Date(modalProduct.endDate.replace(' ', 'T')).getTime() - (now ?? Date.now());
                  return (
                    <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium border rounded px-2 py-1.5 ${urgencyClass(ms)}`}>
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatRemaining(ms)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT: details */}
              <div className="sm:w-3/5 p-3 flex flex-col justify-between space-y-2">
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                    {modalProduct.brand} • {modalProduct.category}
                  </p>

                  <h2 className="text-base font-bold text-slate-900 leading-snug">
                    {modalProduct.name}
                  </h2>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {modalProduct.description}
                  </p>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div>
                      <span className="text-lg font-extrabold text-red-600 block">
                        KES {modalProduct.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        KES {modalProduct.originalPrice.toLocaleString()}
                      </span>
                    </div>
                    <span
                      className={`text-[12px] font-semibold px-2 py-1 rounded-full ${
                        modalProduct.inStock
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}
                    >
                      {modalProduct.inStock
                        ? `In Stock (${modalProduct.stockCount})`
                        : 'Out of Stock'}
                    </span>
                  </div>

                  {modalProduct.features.length > 0 && (
                    <div>
                      <h4 className="text-[12px] font-bold text-slate-900 uppercase mb-1.5">
                        Key Highlights
                      </h4>
                      <ul className="space-y-1">
                        {modalProduct.features.map((feat, idx) => (
                          <li
                            key={idx}
                            className="text-[12px] text-slate-600 flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 bg-blue-950 rounded-full shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Object.keys(modalProduct.specs).length > 0 && (
                    <div>
                      <h4 className="text-[12px] font-bold text-slate-900 uppercase mb-1.5">
                        Specifications
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {Object.entries(modalProduct.specs).map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-slate-50 p-1.5 rounded border border-slate-200"
                          >
                            <span className="text-slate-400 block text-[12px]">
                              {key}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {val}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAddToCart(modalProduct);
                      setModalProduct(null);
                    }}
                    disabled={!modalProduct.inStock}
                    className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>{modalProduct.inStock ? 'Add to Cart' : 'Out of Stock'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalProduct(null)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-sm text-[13px] transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200 py-3">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex items-center space-x-2">
          <Link href="/" className="hover:underline text-slate-600">
            Home
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-medium text-slate-900">Deals</span>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-4 lg:px-4 py-3">
        {/* Hero */}
        <div className="bg-white border border-slate-200 rounded-sm p-2 mb-3 flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Special Deals &amp; Discounts
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Shop current offers and discounted electronics while the
              promotions last. Prices and inventory are verified directly from
              our inventory system.
            </p>
          </div>
          <div className="mt-1 md:mt-0 bg-slate-50 border border-slate-200 rounded-sm p-2 text-center shrink-0">
            <span className="block text-2xl font-bold text-blue-950">
              {validDeals.length}
            </span>
            <span className="text-xs font-medium text-slate-500 uppercase">
              Active Deals Available
            </span>
          </div>
        </div>

        {/* Category pills */}
        <div className="mb-1 overflow-x-auto pb-2">
          <div className="flex items-center space-x-2 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-medium rounded-sm transition-colors border ${
                  selectedCategory === cat
                    ? 'bg-blue-950 text-white border-blue-950 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat === 'All' ? 'All Deals' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filters bar */}
        <div className="bg-white border border-slate-200 rounded-sm p-1 mb-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center justify-between lg:justify-start space-x-4">
              <p className="text-xs text-slate-600 font-medium">
                Showing{' '}
                <span className="font-bold text-slate-900">
                  {filteredDeals.length}
                </span>{' '}
                of{' '}
                <span className="font-bold text-slate-900">
                  {validDeals.length}
                </span>{' '}
                deals
              </p>

              <button
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="lg:hidden inline-flex items-center space-x-1.5 text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </span>
              </button>
            </div>

            <div className="hidden lg:flex flex-wrap items-center gap-3">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-950 font-medium"
              >
                <option value="All">All Brands</option>
                {brands
                  .filter((b) => b !== 'All')
                  .map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
              </select>

              <select
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-950 font-medium"
              >
                <option value="All">All Availability</option>
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>

              <select
                value={selectedDiscountLevel}
                onChange={(e) => setSelectedDiscountLevel(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-950 font-medium"
              >
                <option value="All">Any Discount</option>
                <option value="10">10% or more</option>
                <option value="15">15% or more</option>
                <option value="20">20% or more</option>
              </select>

              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                <span className="text-[11px] text-slate-400">KES</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-16 text-xs bg-transparent focus:outline-none text-slate-800"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-16 text-xs bg-transparent focus:outline-none text-slate-800"
                />
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-red-600 hover:underline px-2 py-1"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Sort by:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-950 font-medium"
              >
                <option value="Featured Deals">Featured Deals</option>
                <option value="Biggest Discount">Biggest Discount</option>
                <option value="Price: Low to High">Price: Low to High</option>
                <option value="Price: High to Low">Price: High to Low</option>
                <option value="Ending Soon">Ending Soon</option>
              </select>
            </div>
          </div>

          {mobileFiltersOpen && (
            <div className="lg:hidden mt-4 pt-4 border-t border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Brand
                  </label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-700"
                  >
                    <option value="All">All Brands</option>
                    {brands
                      .filter((b) => b !== 'All')
                      .map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Availability
                  </label>
                  <select
                    value={selectedAvailability}
                    onChange={(e) => setSelectedAvailability(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-700"
                  >
                    <option value="All">All Availability</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Discount
                  </label>
                  <select
                    value={selectedDiscountLevel}
                    onChange={(e) => setSelectedDiscountLevel(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-700"
                  >
                    <option value="All">Any Discount</option>
                    <option value="10">10%+ OFF</option>
                    <option value="15">15%+ OFF</option>
                    <option value="20">20%+ OFF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Price Range (KES)
                  </label>
                  <div className="flex space-x-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded p-2"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded p-2"
                    />
                  </div>
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="w-full text-xs font-medium text-red-600 bg-red-50 border border-red-200 py-2 rounded"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-slate-400">Active filters:</span>
            {selectedCategory !== 'All' && (
              <span className="inline-flex items-center space-x-1 text-xs bg-slate-200 text-slate-800 px-2.5 py-1 rounded">
                <span>{selectedCategory}</span>
                <button onClick={() => setSelectedCategory('All')}>
                  <X className="w-3 h-3 hover:text-red-600" />
                </button>
              </span>
            )}
            {selectedBrand !== 'All' && (
              <span className="inline-flex items-center space-x-1 text-xs bg-slate-200 text-slate-800 px-2.5 py-1 rounded">
                <span>{selectedBrand}</span>
                <button onClick={() => setSelectedBrand('All')}>
                  <X className="w-3 h-3 hover:text-red-600" />
                </button>
              </span>
            )}
            {selectedAvailability !== 'All' && (
              <span className="inline-flex items-center space-x-1 text-xs bg-slate-200 text-slate-800 px-2.5 py-1 rounded">
                <span>{selectedAvailability}</span>
                <button onClick={() => setSelectedAvailability('All')}>
                  <X className="w-3 h-3 hover:text-red-600" />
                </button>
              </span>
            )}
            {selectedDiscountLevel !== 'All' && (
              <span className="inline-flex items-center space-x-1 text-xs bg-slate-200 text-slate-800 px-2.5 py-1 rounded">
                <span>{selectedDiscountLevel}%+ OFF</span>
                <button onClick={() => setSelectedDiscountLevel('All')}>
                  <X className="w-3 h-3 hover:text-red-600" />
                </button>
              </span>
            )}
            {(minPrice !== '' || maxPrice !== '') && (
              <span className="inline-flex items-center space-x-1 text-xs bg-slate-200 text-slate-800 px-2.5 py-1 rounded">
                <span>
                  KES {minPrice || '0'} - {maxPrice || 'Any'}
                </span>
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                  }}
                >
                  <X className="w-3 h-3 hover:text-red-600" />
                </button>
              </span>
            )}
            {searchQuery.trim() !== '' && (
              <span className="inline-flex items-center space-x-1 text-xs bg-slate-200 text-slate-800 px-2.5 py-1 rounded">
                <span>Search: &quot;{searchQuery}&quot;</span>
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-3 h-3 hover:text-red-600" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-xs text-blue-950 font-medium hover:underline ml-2"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white border border-slate-200 rounded-lg p-3 animate-pulse"
              >
                <div className="aspect-square bg-slate-200 rounded mb-3" />
                <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-slate-200 rounded w-1/2 mb-3" />
                <div className="h-7 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {hasError && (
          <div className="bg-white border border-red-200 rounded-lg p-12 text-center my-12">
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">
              We couldn&apos;t load current deals.
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              An error occurred while fetching promotional offers from our
              backend.
            </p>
            <button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 600);
              }}
              className="inline-flex items-center space-x-1.5 text-xs font-medium bg-blue-950 text-white px-4 py-2 rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !hasError && filteredDeals.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center my-8">
            <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {validDeals.length === 0
                ? 'No special deals available right now'
                : 'No deals match your current filters.'}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              {validDeals.length === 0
                ? 'Check back later for new offers and promotions.'
                : 'Try clearing your filters or search terms to see available offers.'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center text-xs font-medium bg-blue-950 text-white px-4 py-2 rounded"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && !hasError && filteredDeals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {filteredDeals.map((product) => {
              const remainingMs =
                now !== null
                  ? new Date(product.endDate.replace(' ', 'T')).getTime() - now
                  : null;

              return (
                <div
                  key={product.id}
                  className="group bg-white border border-slate-200 rounded-sm overflow-hidden transition-all duration-200 flex flex-col justify-between hover:border-blue-200 hover:shadow-sm"
                >
                  <div>
                    <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <div className="absolute top-0 left-0 w-20 h-20 overflow-hidden pointer-events-none z-10">
                        <div className="absolute transform -rotate-45 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white font-bold text-[10px] tracking-widest py-1 left-[-36px] top-[16px] w-[130px] text-center shadow-xs">
                          {product.discountPct}% OFF
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="text-[10px] font-medium text-slate-500 uppercase truncate mb-0.5">
                        {product.brand}
                      </p>

                      <h3 className="text-xs font-semibold text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-1 mb-1">
                        {product.name}
                      </h3>

                      {remainingMs !== null && (
                        <div
                          className={`flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 mb-1.5 ${urgencyClass(remainingMs)}`}
                        >
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {formatRemaining(remainingMs)}
                          </span>
                        </div>
                      )}

                      <div className="mb-1">
                        <span className="text-xs font-bold text-red-600 block">
                          KES {product.price.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          KES {product.originalPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 pt-0">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModalProduct(product)}
                        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-1.5 px-2 text-[12px] transition duration-150 flex items-center justify-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={!product.inStock}
                        className="bg-blue-950 hover:bg-blue-900 text-white font-medium py-1.5 px-2 text-[12px] transition duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center space-x-1 shadow-xs"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>{product.inStock ? 'Add' : 'Sold'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}