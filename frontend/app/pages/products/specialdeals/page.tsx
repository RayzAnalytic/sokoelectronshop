'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
import { useCart } from '@/lib/store/cart';
import {
  catalogApi,
  type CatalogDealCard,
  type CatalogCategoryRef,
  type CatalogBrandRef,
  type SpecialDealsQuery,
  type DealSortBy,
} from '@/lib/api';

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

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

const stockStatusFor = (deal: CatalogDealCard): StockStatus => {
  if (!deal.inStock || deal.stockCount <= 0) return 'Out of Stock';
  if (deal.stockCount < 5) return 'Low Stock';
  return 'In Stock';
};

function stockBadgeClasses(status: StockStatus): string {
  if (status === 'In Stock') return 'bg-green-600 text-white';
  if (status === 'Low Stock') return 'bg-orange-500 text-white';
  return 'bg-red-600 text-white';
}

const SORT_OPTIONS: DealSortBy[] = [
  'Featured Deals',
  'Biggest Discount',
  'Price: Low to High',
  'Price: High to Low',
  'Ending Soon',
];

export default function SpecialDealsPage() {
  return (
    <Suspense fallback={null}>
      <SpecialDealsPageInner />
    </Suspense>
  );
}

function SpecialDealsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openId = searchParams.get('open');

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('All');
  const [selectedDiscountLevel, setSelectedDiscountLevel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<DealSortBy>('Featured Deals');
  const [reloadKey, setReloadKey] = useState(0);

  const [deals, setDeals] = useState<CatalogDealCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [categories, setCategories] = useState<CatalogCategoryRef[]>([]);
  const [brands, setBrands] = useState<CatalogBrandRef[]>([]);

  const [modalProduct, setModalProduct] = useState<CatalogDealCard | null>(null);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      catalogApi.specialDeals.categories(ctrl.signal),
      catalogApi.specialDeals.brands(ctrl.signal),
    ])
      .then(([cats, brs]) => {
        setCategories(cats);
        setBrands(brs);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setHasError(false);

    const query: SpecialDealsQuery = {
      search: debouncedSearch || undefined,
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
      brand: selectedBrand !== 'All' ? selectedBrand : undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice || undefined,
      availability:
        selectedAvailability !== 'All'
          ? (selectedAvailability as SpecialDealsQuery['availability'])
          : undefined,
      discount_level:
        selectedDiscountLevel !== 'All'
          ? (Number(selectedDiscountLevel) as SpecialDealsQuery['discount_level'])
          : undefined,
      sort_by: sortBy,
    };

    catalogApi.specialDeals
      .list(query, ctrl.signal)
      .then(setDeals)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setDeals([]);
        setHasError(true);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [
    debouncedSearch,
    selectedCategory,
    selectedBrand,
    minPrice,
    maxPrice,
    selectedAvailability,
    selectedDiscountLevel,
    sortBy,
    reloadKey,
  ]);

  useEffect(() => {
    if (!openId) {
      setModalProduct(null);
      return;
    }
    const ctrl = new AbortController();

    catalogApi.specialDeals
      .detail(openId, ctrl.signal)
      .then(setModalProduct)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setModalProduct(null);
        router.replace(pathname, { scroll: false });
      });

    return () => ctrl.abort();
  }, [openId, router, pathname]);

  const openProductInUrl = (productId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('open', productId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeProductInUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('open');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const categoryNames = useMemo(
    () => ['All', ...categories.map((c) => c.name)],
    [categories],
  );
  const brandNames = useMemo(
    () => ['All', ...brands.map((b) => b.name)],
    [brands],
  );

  const handleAddToCart = useCallback(
    async (product: CatalogDealCard) => {
      if (!product.inStock) return;

      await addItem({
        variantId: product.productId,
        productId: product.productId,
        name: product.name,
        brand: product.brand,
        image: product.image,
        unitPrice: toNum(product.price),
        compareAtPrice: toNum(product.originalPrice),
        slug: product.slug,
        stockCount: product.stockCount,
        stock: stockStatusFor(product),
      });

      setNotification(`Successfully added "${product.name}" to cart.`);
      setTimeout(() => setNotification(null), 3500);
    },
    [addItem],
  );

  const clearAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
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
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center space-x-2 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-sm shadow-2xl max-w-2xl w-full overflow-hidden relative">
            <button
              onClick={closeProductInUrl}
              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-slate-100 text-slate-600 rounded-full border border-slate-200 shadow-sm transition-colors"
              aria-label="Close modal"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-col sm:flex-row max-h-[85vh] overflow-y-auto">
              <div className="sm:w-2/5 p-2 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200">
                <div className="aspect-square w-full bg-white rounded-sm overflow-hidden border border-slate-200 relative">
                  <img
                    src={modalProduct.image || '/placeholder.jpeg'}
                    alt={modalProduct.name}
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute top-0 left-0 w-20 h-20 overflow-hidden pointer-events-none z-10">
                    <div className="absolute transform -rotate-45 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white font-bold text-[10px] tracking-widest py-1 left-[-36px] top-[16px] w-[130px] text-center shadow-xs">
                      {modalProduct.discountPct}% OFF
                    </div>
                  </div>
                </div>

                {modalProduct.endDate ? (
                  (() => {
                    const ms =
                      new Date(modalProduct.endDate).getTime() -
                      (now ?? Date.now());
                    return (
                      <div
                        className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium border rounded px-2 py-1.5 ${urgencyClass(ms)}`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatRemaining(ms)}</span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium border rounded px-2 py-1.5 bg-slate-50 text-slate-600 border-slate-200">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Ongoing deal</span>
                  </div>
                )}
              </div>

              <div className="sm:w-3/5 p-3 flex flex-col justify-between space-y-2">
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                    {modalProduct.brand} • {modalProduct.category}
                  </p>

                  <h2 className="text-base font-bold text-slate-900 leading-snug">
                    {modalProduct.name}
                  </h2>

                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {modalProduct.description}
                  </p>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div>
                      <span className="text-lg font-extrabold text-red-600 block">
                        {formatKES(toNum(modalProduct.price))}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {formatKES(toNum(modalProduct.originalPrice))}
                      </span>
                    </div>
                    <span
                      className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${stockBadgeClasses(stockStatusFor(modalProduct))}`}
                    >
                      {stockStatusFor(modalProduct) === 'Out of Stock'
                        ? 'Out of Stock'
                        : `${stockStatusFor(modalProduct)} (${modalProduct.stockCount})`}
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
                        {Object.entries(modalProduct.specs).map(
                          ([key, val]) => (
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
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAddToCart(modalProduct);
                      closeProductInUrl();
                    }}
                    disabled={!modalProduct.inStock}
                    className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-medium py-2 px-3 rounded-sm text-[13px] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>
                      {modalProduct.inStock ? 'Add to Cart' : 'Out of Stock'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={closeProductInUrl}
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
        <div className="bg-white border border-slate-200 rounded-sm p-2 mb-3 flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Special Deals &amp; Discounts
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Shop current offers and discounted electronics while the
              promotions last. Prices and inventory are verified directly
              from our inventory system.
            </p>
          </div>
          <div className="mt-1 md:mt-0 bg-slate-50 border border-slate-200 rounded-sm p-2 text-center shrink-0">
            <span className="block text-2xl font-bold text-blue-950">
              {loading ? '…' : deals.length}
            </span>
            <span className="text-xs font-medium text-slate-500 uppercase">
              Active Deals Available
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-3 mb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
              >
                {categoryNames.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Search Deals
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
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
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
              >
                {brandNames.map((b) => (
                  <option key={b} value={b}>
                    {b === 'All' ? 'All Brands' : b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Availability
              </label>
              <select
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
              >
                <option value="All">All Availability</option>
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Discount
              </label>
              <select
                value={selectedDiscountLevel}
                onChange={(e) => setSelectedDiscountLevel(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
              >
                <option value="All">Any Discount</option>
                <option value="10">10% or more</option>
                <option value="15">15% or more</option>
                <option value="20">20% or more</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as DealSortBy)}
                  className="w-full bg-white border border-slate-200 rounded-sm px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-950 text-slate-800"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearAllFilters}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-3 rounded-sm text-xs transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="lg:hidden mt-3 pt-3 border-t border-slate-200">
            <button
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="inline-flex items-center space-x-1.5 text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                More Filters{' '}
                {activeFilterCount > 0 && `(${activeFilterCount})`}
              </span>
            </button>
          </div>

          {mobileFiltersOpen && (
            <div className="lg:hidden mt-3 pt-3 border-t border-slate-200 space-y-3">
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
                    className="w-1/2 text-xs bg-white border border-slate-200 rounded p-2"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-1/2 text-xs bg-white border border-slate-200 rounded p-2"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-3">
          <p className="text-xs text-slate-600 font-medium">
            Showing{' '}
            <span className="font-bold text-slate-900">{deals.length}</span>{' '}
            active deals
          </p>
        </div>

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

        {loading && (
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

        {hasError && !loading && (
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
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center space-x-1.5 text-xs font-medium bg-blue-950 text-white px-4 py-2 rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {!loading && !hasError && deals.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center my-8">
            <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {activeFilterCount === 0
                ? 'No special deals available right now'
                : 'No deals match your current filters.'}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              {activeFilterCount === 0
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

        {!loading && !hasError && deals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {deals.map((product) => {
              const stockStatus = stockStatusFor(product);
              const remainingMs =
                now !== null && product.endDate
                  ? new Date(product.endDate).getTime() - now
                  : null;

              return (
                <div
                  key={product.id}
                  className="group bg-white border border-slate-200 rounded-sm overflow-hidden transition-all duration-200 flex flex-col justify-between hover:border-blue-200 hover:shadow-sm"
                >
                  <div>
                    <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                      <img
                        src={product.image || '/placeholder.jpeg'}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <div className="absolute top-0 left-0 w-20 h-20 overflow-hidden pointer-events-none z-10">
                        <div className="absolute transform -rotate-45 bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white font-bold text-[10px] tracking-widest py-1 left-[-36px] top-[16px] w-[130px] text-center shadow-xs">
                          {product.discountPct}% OFF
                        </div>
                      </div>

                      <span
                        className={`absolute top-2 right-2 text-[12px] font-semibold px-2 py-0.5 rounded shadow-xs ${stockBadgeClasses(stockStatus)}`}
                      >
                        {stockStatus}
                      </span>
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
                          className={`flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 mb-1.5 ${urgencyClass(
                            remainingMs,
                          )}`}
                        >
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {formatRemaining(remainingMs)}
                          </span>
                        </div>
                      )}

                      <div className="mb-1">
                        <span className="text-xs font-bold text-red-600 block">
                          {formatKES(toNum(product.price))}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          {formatKES(toNum(product.originalPrice))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 pt-0">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          openProductInUrl(product.productId)
                        }
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
                        <span>
                          {product.inStock ? 'Add' : 'Sold'}
                        </span>
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